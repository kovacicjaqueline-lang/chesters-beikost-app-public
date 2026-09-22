import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState && typeof window.renderView === "function");
  await page.evaluate(() => window.__beikostTest.reset());
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));

  const profile = await page.evaluate(() => {
    const median = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const round = (value) => Number(value.toFixed(2));
    const measure = (callback, runs = 7) => {
      callback();
      const samples = [];
      for (let index = 0; index < runs; index += 1) {
        const startedAt = performance.now();
        callback();
        samples.push(performance.now() - startedAt);
      }
      return {
        medianMs: round(median(samples)),
        minMs: round(Math.min(...samples)),
        maxMs: round(Math.max(...samples)),
        samplesMs: samples.map(round),
      };
    };

    const views = {};
    for (const id of ["home", "plan", "prep", "foods", "more"]) {
      views[id] = measure(() => window.renderView(id));
    }
    const fullApp = measure(() => window.renderAll(), 5);

    return {
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      stateBytes: new Blob([JSON.stringify(window.__beikostTest.getState())]).size,
      views,
      fullApp,
    };
  });

  for (const [id, timing] of Object.entries(profile.views)) {
    assert.ok(Number.isFinite(timing.medianMs), `${id} median render duration must be finite`);
    assert.equal(timing.samplesMs.length, 7, `${id} must record seven render samples`);
  }
  assert.ok(Number.isFinite(profile.fullApp.medianMs), "full-app median render duration must be finite");

  console.log(`VIEW_RENDER_PROFILE ${JSON.stringify(profile)}`);
} finally {
  await closeBrowserApp({ context, browser, server });
}

console.log("WebKit per-view render latency profile passed.");
