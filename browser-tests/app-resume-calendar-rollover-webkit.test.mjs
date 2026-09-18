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

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);

  const tomorrow = await page.evaluate(() => window.__beikostTest.addDays(window.__beikostTest.today(), 1));
  await page.evaluate((nextDay) => {
    const next = window.__beikostTest.getState();
    next.settings.planFrom = nextDay;
    window.__beikostTest.setState(next);
  }, tomorrow);
  await page.waitForFunction(
    (nextDay) => window.__beikostTest.getState().settings.planFrom === nextDay,
    tomorrow,
  );

  await page.evaluate(() => {
    const calls = { renderAll: 0, renderCurrentView: 0, invalidateViewRenderCache: 0 };
    const events = [];
    for (const name of Object.keys(calls)) {
      const base = globalThis[name];
      assertFunction(name, base);
      globalThis[name] = function measuredCalendarRolloverCall(...args) {
        calls[name] += 1;
        events.push(name);
        return base.apply(this, args);
      };
    }
    globalThis.__calendarRolloverProbe = calls;
    globalThis.__calendarRolloverEvents = events;

    function assertFunction(name, value) {
      if (typeof value !== "function") throw new Error(`${name} is not available`);
    }
  });

  const result = await page.evaluate(async (nextDay) => {
    const originalToday = window.today;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    try {
      window.today = () => nextDay;
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const activeView = document.querySelector(".view.active");
      return {
        calls: { ...window.__calendarRolloverProbe },
        events: [...window.__calendarRolloverEvents],
        activeView: activeView?.id || "",
        activeViewDisplay: activeView ? getComputedStyle(activeView).display : "",
        bodyVisibility: getComputedStyle(document.body).visibility,
        bodyOpacity: getComputedStyle(document.body).opacity,
      };
    } finally {
      window.today = originalToday;
      delete document.visibilityState;
    }
  }, tomorrow);

  assert.equal(result.calls.renderAll, 0, "Calendar rollover resume must not trigger a full-app render");
  assert.ok(result.calls.invalidateViewRenderCache >= 1, "Calendar rollover must invalidate cached hidden views");
  assert.equal(result.calls.renderCurrentView, 1, "Calendar rollover must refresh only the active view once when planFrom is already current");
  const firstInvalidation = result.events.indexOf("invalidateViewRenderCache");
  const firstViewRender = result.events.indexOf("renderCurrentView");
  assert.ok(
    firstInvalidation !== -1 && firstViewRender !== -1 && firstInvalidation < firstViewRender,
    "Calendar rollover must invalidate cached views before refreshing the active view",
  );
  assert.equal(result.activeView, "home", "Calendar rollover must preserve the active view");
  assert.equal(result.activeViewDisplay, "block", "The active view must remain visible during calendar rollover");
  assert.notEqual(result.bodyVisibility, "hidden", "The app body must remain visible during calendar rollover");
  assert.notEqual(result.bodyOpacity, "0", "The app body must remain opaque during calendar rollover");

  console.log(`APP_RESUME_CALENDAR_ROLLOVER ${JSON.stringify(result)}`);
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
