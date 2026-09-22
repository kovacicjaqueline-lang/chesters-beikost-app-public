import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");



function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

function roundedTiming(timing) {
  return Object.fromEntries(Object.entries(timing).map(([key, value]) => [key, round(value)]));
}

function roundedDurations(durations) {
  return Object.fromEntries(
    Object.entries(durations).map(([key, values]) => [key, values.map((value) => round(value))]),
  );
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
    const longTaskSupported = globalThis.PerformanceObserver?.supportedEntryTypes?.includes("longtask") || false;
    const metrics = {
      events: [],
      calls: { save: 0, renderCurrentView: 0, renderAll: 0 },
      durations: { saveSync: [], renderCurrentView: [], renderAll: [] },
      mutations: 0,
      longTasks: [],
      longTaskSupported,
      interactionArmedAt: null,
      interactionAt: null,
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

    if (longTaskSupported) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metrics.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
    }

    const interactionProbe = document.createElement("button");
    interactionProbe.id = "resume-interaction-probe";
    interactionProbe.type = "button";
    interactionProbe.setAttribute("aria-label", "Resume interaction probe");
    interactionProbe.style.cssText = "position:fixed;left:1px;top:1px;width:2px;height:2px;padding:0;border:0;opacity:.01;z-index:2147483647";
    interactionProbe.addEventListener("click", () => {
      metrics.interactionAt = performance.now();
    });
    document.body.appendChild(interactionProbe);

    const observer = new MutationObserver((records) => {
      metrics.mutations += records.length;
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });

    const navigationSnapshot = () => performance.getEntriesByType("navigation").map((entry) => ({
      type: entry.type,
      startTime: entry.startTime,
      duration: entry.duration,
      domComplete: entry.domComplete,
      loadEventEnd: entry.loadEventEnd,
    }));

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
        metrics.longTasks.length = 0;
        metrics.interactionArmedAt = null;
        metrics.interactionAt = null;
      },
      armInteraction() {
        metrics.interactionArmedAt = performance.now();
        metrics.interactionAt = null;
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
          longTaskSupported: metrics.longTaskSupported,
          longTasks: structuredClone(metrics.longTasks),
          interactionDelayMs: metrics.interactionArmedAt !== null && metrics.interactionAt !== null
            ? metrics.interactionAt - metrics.interactionArmedAt
            : null,
          navigationEntries: navigationSnapshot(),
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
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const secondFrameAt = performance.now();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const eventLoopReadyAt = performance.now();
        delete document.visibilityState;
        return {
          dispatchMs: dispatchReturnedAt - startedAt,
          firstFrameMs: firstFrameAt - startedAt,
          secondFrameMs: secondFrameAt - startedAt,
          eventLoopReadyMs: eventLoopReadyAt - startedAt,
        };
      },
      dispatchResumeBurst() {
        const startedAt = performance.now();
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: false }));
        window.dispatchEvent(new Event("focus"));
        return performance.now() - startedAt;
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

  async function measureInteraction() {
    await page.evaluate(() => window.__resumeProbe.armInteraction());
    const wallClockStartedAt = performance.now();
    await page.locator("#resume-interaction-probe").click({ force: true });
    const wallClockMs = performance.now() - wallClockStartedAt;
    const browserDelayMs = await page.evaluate(() => window.__resumeProbe.snapshot().interactionDelayMs);
    return { wallClockMs, browserDelayMs };
  }

  const today = await page.evaluate(() => window.__beikostTest.today());
  const yesterday = await page.evaluate(() => window.__beikostTest.addDays(window.__beikostTest.today(), -1));
  const tomorrow = await page.evaluate(() => window.__beikostTest.addDays(window.__beikostTest.today(), 1));

  await setPlanFrom(today);
  await resetProbe();
  const sameDayTiming = await page.evaluate(() => window.__resumeProbe.syntheticVisibility("visible"));
  const sameDayInteraction = await measureInteraction();
  const sameDay = await page.evaluate(() => window.__resumeProbe.snapshot());

  console.log(`APP_RESUME_PRECHECK ${JSON.stringify({
    resourceFailures,
    timing: sameDayTiming,
    interaction: sameDayInteraction,
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
  assert.equal(sameDay.navigationEntries.length, 1, "Same-day resume must not create a new navigation entry");
  assert.ok(
    sameDay.htmlBackground !== "rgba(0, 0, 0, 0)" || sameDay.bodyBackground !== "rgba(0, 0, 0, 0)",
    "The rendered app canvas needs an opaque root or body background after CSS has loaded",
  );

  await setPlanFrom(yesterday);
  await resetProbe();
  const staleTiming = await page.evaluate(() => window.__resumeProbe.syntheticVisibility("visible"));
  await page.waitForFunction((expected) => window.__beikostTest.getState().settings.planFrom === expected, today);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  const staleInteraction = await measureInteraction();
  const staleDay = await page.evaluate(() => window.__resumeProbe.snapshot());

  assert.equal(staleDay.calls.save, 1, "A stale plan date should be persisted exactly once on resume");
  assert.equal(staleDay.calls.renderCurrentView, 1, "A stale plan date should rerender only the current view once");
  assert.equal(staleDay.calls.renderAll, 0, "Plan-date synchronization alone must not trigger a full-app render");
  assert.equal(staleDay.activeViewDisplay, "block", "The current view must stay visible while the stale plan date is processed");

  await setPlanFrom(today);
  await resetProbe();
  const burstDurationMs = await page.evaluate(() => window.__resumeProbe.dispatchResumeBurst());
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const resumeBurst = await page.evaluate(() => window.__resumeProbe.snapshot());
  assert.equal(resumeBurst.calls.renderAll, 0, "Same-day visibility/pageshow/focus burst must not trigger a full render");
  assert.equal(resumeBurst.calls.renderCurrentView, 0, "Same-day visibility/pageshow/focus burst must keep the current DOM");

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
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  const realSwitchInteraction = realVisibilityChanged ? await measureInteraction() : null;
  const realSwitch = await page.evaluate(() => window.__resumeProbe.snapshot());
  await cover.close();

  await setPlanFrom(today);
  await resetProbe();
  const calendarRolloverTiming = await page.evaluate(async (nextDay) => {
    const originalToday = window.today;
    window.today = () => nextDay;
    try {
      return await window.__resumeProbe.syntheticVisibility("visible");
    } finally {
      window.today = originalToday;
    }
  }, tomorrow);
  await page.waitForFunction((expected) => window.__beikostTest.getState().settings.planFrom === expected, tomorrow);
  const calendarRolloverInteraction = await measureInteraction();
  const calendarRollover = await page.evaluate(() => window.__resumeProbe.snapshot());
  assert.equal(calendarRollover.calls.renderAll, 0, "Calendar rollover resume must not trigger a full-app render");
  assert.equal(calendarRollover.calls.renderCurrentView, 1, "Calendar rollover resume must refresh the active view exactly once");

  const report = {
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    startup: {
      loadWallClockMs: round(loadWallClockMs),
      readyWallClockMs: round(readyWallClockMs),
    },
    resourceFailures,
    sameDay: {
      timing: roundedTiming(sameDayTiming),
      interaction: {
        wallClockMs: round(sameDayInteraction.wallClockMs),
        browserDelayMs: sameDayInteraction.browserDelayMs === null ? null : round(sameDayInteraction.browserDelayMs),
      },
      calls: sameDay.calls,
      durations: roundedDurations(sameDay.durations),
      mutations: sameDay.mutations,
      longTaskSupported: sameDay.longTaskSupported,
      longTasks: sameDay.longTasks.map((entry) => ({ startTime: round(entry.startTime), duration: round(entry.duration) })),
      navigationEntries: sameDay.navigationEntries.map((entry) => ({ ...entry, duration: round(entry.duration) })),
      events: sameDay.events,
    },
    stalePlanFrom: {
      timing: roundedTiming(staleTiming),
      interaction: {
        wallClockMs: round(staleInteraction.wallClockMs),
        browserDelayMs: staleInteraction.browserDelayMs === null ? null : round(staleInteraction.browserDelayMs),
      },
      calls: staleDay.calls,
      durations: roundedDurations(staleDay.durations),
      mutations: staleDay.mutations,
      longTasks: staleDay.longTasks.map((entry) => ({ startTime: round(entry.startTime), duration: round(entry.duration) })),
      events: staleDay.events,
    },
    resumeEventBurst: {
      dispatchMs: round(burstDurationMs),
      calls: resumeBurst.calls,
      durations: roundedDurations(resumeBurst.durations),
      mutations: resumeBurst.mutations,
      longTasks: resumeBurst.longTasks.map((entry) => ({ startTime: round(entry.startTime), duration: round(entry.duration) })),
      eventTypes: resumeBurst.events.map((event) => event.type),
    },
    realPageSwitch: {
      supportedByHeadlessWebKit: realVisibilityChanged,
      interaction: realSwitchInteraction ? {
        wallClockMs: round(realSwitchInteraction.wallClockMs),
        browserDelayMs: realSwitchInteraction.browserDelayMs === null ? null : round(realSwitchInteraction.browserDelayMs),
      } : null,
      calls: realSwitch.calls,
      durations: roundedDurations(realSwitch.durations),
      mutations: realSwitch.mutations,
      longTasks: realSwitch.longTasks.map((entry) => ({ startTime: round(entry.startTime), duration: round(entry.duration) })),
      events: realSwitch.events,
    },
    calendarRollover: {
      timing: roundedTiming(calendarRolloverTiming),
      interaction: {
        wallClockMs: round(calendarRolloverInteraction.wallClockMs),
        browserDelayMs: calendarRolloverInteraction.browserDelayMs === null ? null : round(calendarRolloverInteraction.browserDelayMs),
      },
      calls: calendarRollover.calls,
      durations: roundedDurations(calendarRollover.durations),
      mutations: calendarRollover.mutations,
      longTasks: calendarRollover.longTasks.map((entry) => ({ startTime: round(entry.startTime), duration: round(entry.duration) })),
      events: calendarRollover.events,
    },
    shell: {
      htmlBackground: sameDay.htmlBackground,
      bodyBackground: sameDay.bodyBackground,
      bgVariable: sameDay.bgVariable,
      activeView: sameDay.activeView,
      activeViewDisplay: sameDay.activeViewDisplay,
      bodyVisibility: sameDay.bodyVisibility,
      bodyDisplay: sameDay.bodyDisplay,
      bodyOpacity: sameDay.bodyOpacity,
      stylesheets: sameDay.stylesheets,
    },
  };

  const metricsDirectory = path.join(root, "artifacts", "browser-tests", "app-resume");
  fs.mkdirSync(metricsDirectory, { recursive: true });
  fs.writeFileSync(path.join(metricsDirectory, "webkit-resume-metrics.json"), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`APP_RESUME_METRICS ${JSON.stringify(report)}`);
} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
