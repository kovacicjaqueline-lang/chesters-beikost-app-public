import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
};

function startStaticServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filePath = path.resolve(root, `.${pathname}`);
    if (filePath !== path.join(root, "index.html") && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.stat(filePath, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      fs.createReadStream(filePath).pipe(response);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const resourceFailures = [];
  page.on("requestfailed", (request) => resourceFailures.push({
    url: request.url(),
    error: request.failure()?.errorText || "request failed",
  }));
  page.on("response", (response) => {
    if (response.status() >= 400) resourceFailures.push({
      url: response.url(),
      error: `HTTP ${response.status()}`,
    });
  });

  const navigationStartedAt = performance.now();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  const loadWallClockMs = performance.now() - navigationStartedAt;
  await page.waitForFunction(() => !!window.__beikostTest?.getState);
  const readyWallClockMs = performance.now() - navigationStartedAt;

  await page.evaluate(() => {
    const metrics = {
      events: [],
      calls: { save: 0, renderCurrentView: 0, renderAll: 0 },
      durations: { saveSync: [], renderCurrentView: [], renderAll: [] },
      mutations: 0,
    };

    for (const type of ["visibilitychange", "pageshow", "pagehide", "focus", "blur"]) {
      const target = type === "visibilitychange" ? document : window;
      target.addEventListener(type, (event) => {
        metrics.events.push({
          type,
          at: performance.now(),
          visibilityState: document.visibilityState,
          persisted: "persisted" in event ? event.persisted : null,
        });
      });
    }

    const wrap = (name) => {
      const base = globalThis[name];
      if (typeof base !== "function") return;
      globalThis[name] = function measuredResumeCall(...args) {
        const startedAt = performance.now();
        metrics.calls[name] += 1;
        try {
          return base.apply(this, args);
        } finally {
          metrics.durations[name === "save" ? "saveSync" : name].push(performance.now() - startedAt);
        }
      };
    };
    wrap("save");
    wrap("renderCurrentView");
    wrap("renderAll");

    const observer = new MutationObserver((records) => {
      metrics.mutations += records.length;
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });

    globalThis.__resumeProbe = {
      metrics,
      reset() {
        metrics.events.length = 0;
        metrics.calls.save = 0;
        metrics.calls.renderCurrentView = 0;
        metrics.calls.renderAll = 0;
        metrics.durations.saveSync.length = 0;
        metrics.durations.renderCurrentView.length = 0;
        metrics.durations.renderAll.length = 0;
        metrics.mutations = 0;
      },
      snapshot() {
        const activeView = document.querySelector(".view.active");
        const htmlStyle = getComputedStyle(document.documentElement);
        const bodyStyle = getComputedStyle(document.body);
        return {
          events: structuredClone(metrics.events),
          calls: { ...metrics.calls },
          durations: structuredClone(metrics.durations),
          mutations: metrics.mutations,
          visibilityState: document.visibilityState,
          activeView: activeView?.id || "",
          activeViewDisplay: activeView ? getComputedStyle(activeView).display : "",
          htmlBackground: htmlStyle.backgroundColor,
          bodyBackground: bodyStyle.backgroundColor,
          bgVariable: htmlStyle.getPropertyValue("--bg").trim(),
          bodyVisibility: bodyStyle.visibility,
          bodyDisplay: bodyStyle.display,
          bodyOpacity: bodyStyle.opacity,
          readyState: document.readyState,
          stylesheets: [...document.styleSheets].map((sheet) => ({ href: sheet.href || "inline", rules: (() => {
            try { return sheet.cssRules.length; } catch (_) { return null; }
          })() })),
        };
      },
      async syntheticVisibility(state) {
        let currentState = state;
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => currentState,
        });
        const startedAt = performance.now();
        document.dispatchEvent(new Event("visibilitychange"));
        const dispatchReturnedAt = performance.now();
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const firstFrameAt = performance.now();
        delete document.visibilityState;
        return {
          dispatchMs: dispatchReturnedAt - startedAt,
          firstFrameMs: firstFrameAt - startedAt,
        };
      },
    };
  });

  async function setPlanFrom(value) {
    await page.evaluate((nextPlanFrom) => {
      const next = window.__beikostTest.getState();
      next.settings.planFrom = nextPlanFrom;
      window.__beikostTest.setState(next);
    }, value);
    await page.waitForFunction((nextPlanFrom) => window.__beikostTest.getState().settings.planFrom === nextPlanFrom, value);
  }

  async function resetProbe() {
    await page.evaluate(() => window.__resumeProbe.reset());
  }

  const today = await page.evaluate(() => window.__beikostTest.today());
  const yesterday = await page.evaluate(() => window.__beikostTest.addDays(window.__beikostTest.today(), -1));

  await setPlanFrom(today);
  await resetProbe();
  const sameDayTiming = await page.evaluate(() => window.__resumeProbe.syntheticVisibility("visible"));
  const sameDay = await page.evaluate(() => window.__resumeProbe.snapshot());

  console.log(`APP_RESUME_PRECHECK ${JSON.stringify({
    resourceFailures,
    timing: sameDayTiming,
    shell: {
      htmlBackground: sameDay.htmlBackground,
      bodyBackground: sameDay.bodyBackground,
      bgVariable: sameDay.bgVariable,
      stylesheets: sameDay.stylesheets,
      activeView: sameDay.activeView,
      activeViewDisplay: sameDay.activeViewDisplay,
    },
    calls: sameDay.calls,
    mutations: sameDay.mutations,
  })}`);

  assert.equal(sameDay.calls.save, 0, "Same-day resume must not persist state");
  assert.equal(sameDay.calls.renderCurrentView, 0, "Same-day resume must keep the existing view instead of rerendering it");
  assert.equal(sameDay.calls.renderAll, 0, "Same-day resume must never trigger a full-app render");
  assert.equal(sameDay.activeViewDisplay, "block", "The active app view must remain visible during same-day resume");
  assert.notEqual(sameDay.bodyDisplay, "none", "The app body must not be hidden on resume");
  assert.notEqual(sameDay.bodyVisibility, "hidden", "The app body must remain visible on resume");
  assert.notEqual(sameDay.bodyOpacity, "0", "The app body must not be transparent on resume");
  assert.ok(
    sameDay.htmlBackground !== "rgba(0, 0, 0, 0)" || sameDay.bodyBackground !== "rgba(0, 0, 0, 0)",
    "The rendered app canvas needs an opaque root or body background after CSS has loaded",
  );

  await setPlanFrom(yesterday);
  await resetProbe();
  const staleTiming = await page.evaluate(() => window.__resumeProbe.syntheticVisibility("visible"));
  await page.waitForFunction((expected) => window.__beikostTest.getState().settings.planFrom === expected, today);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  const staleDay = await page.evaluate(() => window.__resumeProbe.snapshot());

  assert.equal(staleDay.calls.save, 1, "A stale plan date should be persisted exactly once on resume");
  assert.equal(staleDay.calls.renderCurrentView, 1, "A stale plan date should rerender only the current view once");
  assert.equal(staleDay.calls.renderAll, 0, "Date rollover must not trigger a full-app render");
  assert.equal(staleDay.activeViewDisplay, "block", "The current view must stay visible while the date rollover is processed");

  await resetProbe();
  const cover = await context.newPage();
  await cover.setContent("<!doctype html><title>cover</title><p>background page</p>");
  let realVisibilityChanged = false;
  try {
    await page.waitForFunction(() => document.visibilityState === "hidden", null, { timeout: 1000 });
    realVisibilityChanged = true;
  } catch (_) {
    realVisibilityChanged = false;
  }
  await page.bringToFront();
  if (realVisibilityChanged) {
    await page.waitForFunction(() => document.visibilityState === "visible", null, { timeout: 1000 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  }
  const realSwitch = await page.evaluate(() => window.__resumeProbe.snapshot());
  await cover.close();

  const report = {
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    startup: {
      loadWallClockMs: Number(loadWallClockMs.toFixed(1)),
      readyWallClockMs: Number(readyWallClockMs.toFixed(1)),
    },
    resourceFailures,
    sameDay: {
      timing: Object.fromEntries(Object.entries(sameDayTiming).map(([key, value]) => [key, Number(value.toFixed(2))])),
      calls: sameDay.calls,
      mutations: sameDay.mutations,
      eventTypes: sameDay.events.map((event) => event.type),
    },
    staleDay: {
      timing: Object.fromEntries(Object.entries(staleTiming).map(([key, value]) => [key, Number(value.toFixed(2))])),
      calls: staleDay.calls,
      durations: Object.fromEntries(Object.entries(staleDay.durations).map(([key, values]) => [key, values.map((value) => Number(value.toFixed(2)))])),
      mutations: staleDay.mutations,
      eventTypes: staleDay.events.map((event) => event.type),
    },
    realPageSwitch: {
      supportedByHeadlessWebKit: realVisibilityChanged,
      calls: realSwitch.calls,
      mutations: realSwitch.mutations,
      eventTypes: realSwitch.events.map((event) => event.type),
    },
    shell: {
      htmlBackground: sameDay.htmlBackground,
      bodyBackground: sameDay.bodyBackground,
      bgVariable: sameDay.bgVariable,
      activeView: sameDay.activeView,
      activeViewDisplay: sameDay.activeViewDisplay,
      stylesheets: sameDay.stylesheets,
    },
  };

  console.log(`APP_RESUME_METRICS ${JSON.stringify(report)}`);
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
