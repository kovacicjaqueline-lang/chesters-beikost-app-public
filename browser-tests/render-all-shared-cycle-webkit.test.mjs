import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";



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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState &&
    typeof window.renderAll === "function" &&
    typeof window.withViewRenderCycle === "function" &&
    typeof window.viewRenderBuildDays === "function",
  );
  await page.waitForFunction(() => window.__plannerPoliciesReady === true);

  const measurement = await page.evaluate(() => {
    const baseBuildDays = buildDays;
    const baseWithViewRenderCycle = withViewRenderCycle;
    const originalRenderers = {
      renderHome,
      renderPlan,
      renderLogs,
      renderStatistics,
      renderFoods,
      renderPrep,
      renderAllergenModule,
      renderSettings,
      renderAudit,
      renderStorageStatus,
    };
    let matchingBuilds = 0;
    const cycleIds = [];

    buildDays = function countedBuildDays(from, n = 7, applyAutoLocks = true) {
      if (String(from) === today() && Number(n) === 7 && applyAutoLocks !== false) matchingBuilds += 1;
      return baseBuildDays.apply(this, arguments);
    };
    withViewRenderCycle = function observedViewRenderCycle(viewId, callback) {
      cycleIds.push(String(viewId || ""));
      return baseWithViewRenderCycle(viewId, callback);
    };

    const noop = () => {};
    renderHome = noop;
    renderPlan = () => viewRenderBuildDays(today(), 7);
    renderLogs = noop;
    renderStatistics = noop;
    renderFoods = noop;
    renderPrep = () => viewRenderBuildDays(today(), 7);
    renderAllergenModule = noop;
    renderSettings = noop;
    renderAudit = noop;
    renderStorageStatus = noop;

    try {
      renderAll();
      const duringFullRender = matchingBuilds;
      viewRenderBuildDays(today(), 7);
      viewRenderBuildDays(today(), 7);
      return {
        firstCycleId: cycleIds[0] || "",
        duringFullRender,
        outsideCycleAdditionalBuilds: matchingBuilds - duringFullRender,
      };
    } finally {
      buildDays = baseBuildDays;
      withViewRenderCycle = baseWithViewRenderCycle;
      renderHome = originalRenderers.renderHome;
      renderPlan = originalRenderers.renderPlan;
      renderLogs = originalRenderers.renderLogs;
      renderStatistics = originalRenderers.renderStatistics;
      renderFoods = originalRenderers.renderFoods;
      renderPrep = originalRenderers.renderPrep;
      renderAllergenModule = originalRenderers.renderAllergenModule;
      renderSettings = originalRenderers.renderSettings;
      renderAudit = originalRenderers.renderAudit;
      renderStorageStatus = originalRenderers.renderStorageStatus;
    }
  });

  assert.equal(
    measurement.firstCycleId,
    "all",
    "Der installierte renderAll()-Wrapper muss einen gemeinsamen Full-Render-Zyklus öffnen",
  );
  assert.equal(
    measurement.duringFullRender,
    1,
    "Zwei Renderer müssen im selben renderAll()-Zyklus denselben 7-Tage-buildDays-Aufruf teilen",
  );
  assert.equal(
    measurement.outsideCycleAdditionalBuilds,
    2,
    "Der gemeinsame Full-Render-Cache darf nach renderAll() nicht außerhalb des Render-Zyklus weiterleben",
  );
  assert.deepEqual(pageErrors, [], `Der Full-Render darf keine JavaScript-Fehler erzeugen: ${pageErrors.join(" | ")}`);

} finally {
  await closeBrowserApp({ context, browser, server });
}
