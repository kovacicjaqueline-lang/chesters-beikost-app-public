import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";



const server = await startStaticServer();
const address = server.address();
const port = address.port;
const browser = await webkit.launch();

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();

  await page.goto("http://127.0.0.1:" + port + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState && !!window.__plannerWeekCache);
  await page.waitForFunction(() => window.__plannerPoliciesReady === true);
  await page.evaluate(() => {
    window.__plannerWeekCache.clear("worker-test");
    window.__plannerWeekCache.warmup();
  });
  await page.waitForFunction(() => window.__plannerWeekCache.workerStats().supported === true, null, { timeout: 10000 });

  const before = await page.evaluate(() => {
    const current = window.__beikostTest.getState();
    return {
      planLocks: JSON.stringify(current.planLocks || {}),
      manualMeals: JSON.stringify(current.manualMeals || {}),
      overrides: JSON.stringify(current.overrides || {}),
    };
  });

  await page.waitForFunction(() => {
    const stats = window.__plannerWeekCache.workerStats();
    return stats.completed > 0 || stats.fallbacks > 0;
  }, null, { timeout: 60000 });

  const result = await page.evaluate(() => {
    const current = window.__beikostTest.getState();
    return {
      stats: window.__plannerWeekCache.workerStats(),
      planLocks: JSON.stringify(current.planLocks || {}),
      manualMeals: JSON.stringify(current.manualMeals || {}),
      overrides: JSON.stringify(current.overrides || {}),
    };
  });

  assert.equal(result.stats.fallbacks, 0, "Worker-Fallback unerwartet: " + JSON.stringify(result.stats));
  assert.equal(result.stats.completed > 0, true, "Worker lieferte kein Ergebnis: " + JSON.stringify(result.stats));
  assert.equal(result.stats.requests > 0, true);
  assert.equal(result.planLocks, before.planLocks, "Worker darf keine Plan-Locks im Hauptthread verändern");
  assert.equal(result.manualMeals, before.manualMeals, "Worker darf keine manuellen Mahlzeiten im Hauptthread verändern");
  assert.equal(result.overrides, before.overrides, "Worker darf keine Overrides im Hauptthread verändern");

} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
