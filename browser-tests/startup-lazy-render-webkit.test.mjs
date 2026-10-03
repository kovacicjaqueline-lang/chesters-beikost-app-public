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
  await page.waitForFunction(() => !!window.__beikostTest?.getState);
  await page.waitForFunction(() => {
    const persisted = window.__beikostTest?.getState?.()?.backupMeta?.storagePersisted;
    return persisted && persisted !== "unknown";
  });
  await page.waitForFunction(() => window.__mobilePlanUiInstalled === true);

  const startup = await page.evaluate(() => ({
    homeText: document.getElementById("todayCard")?.textContent?.trim() || "",
    planChildren: document.getElementById("blockPlan")?.childElementCount || 0,
    foodsChildren: document.getElementById("foodList")?.childElementCount || 0,
    prepChildren: document.getElementById("prepNow")?.childElementCount || 0,
    logChildren: document.getElementById("logList")?.childElementCount || 0,
  }));

  assert.ok(startup.homeText.length > 0, "Die sichtbare Heute-Ansicht muss beim ersten Start sofort gerendert werden");
  assert.equal(startup.planChildren, 0, "Der unsichtbare Plan-Tab darf beim Start noch nicht gerendert werden");
  assert.equal(startup.foodsChildren, 0, "Der unsichtbare Lebensmittel-Tab darf beim Start noch nicht vollständig gerendert werden");
  assert.equal(startup.prepChildren, 0, "Der unsichtbare Prep-Tab darf beim Start noch nicht vollständig gerendert werden");
  assert.equal(startup.logChildren, 0, "Der unsichtbare Mehr-/Protokoll-Tab darf beim Start noch nicht vollständig gerendert werden");

  const planTransition = await page.evaluate(async () => {
    const originalRenderPlan = renderPlan;
    window.__planRenderCalls = 0;
    renderPlan = function measuredRenderPlan(...args) {
      window.__planRenderCalls += 1;
      return originalRenderPlan.apply(this, args);
    };
    window.__restoreMeasuredRenderPlan = () => { renderPlan = originalRenderPlan; };
    const beforeRenderOpportunity = new Promise((resolve) => {
      requestAnimationFrame(() => resolve({
        active: document.getElementById("plan")?.classList.contains("active") || false,
        renderCalls: window.__planRenderCalls,
      }));
    });
    document.querySelector('nav button[data-view="plan"]')?.click();
    const immediate = {
      active: document.getElementById("plan")?.classList.contains("active") || false,
      appBarTitle: document.getElementById("appBarTitle")?.textContent || "",
      busy: document.getElementById("plan")?.getAttribute("aria-busy"),
      renderCalls: window.__planRenderCalls,
    };
    return { immediate, beforeRenderOpportunity: await beforeRenderOpportunity };
  });
  assert.deepEqual(
    planTransition.immediate,
    { active: true, appBarTitle: "Plan", busy: "true", renderCalls: 0 },
    "Der Zieltab muss synchron sichtbar werden, ohne den teuren Render im Klick-Task auszuführen",
  );
  assert.deepEqual(
    planTransition.beforeRenderOpportunity,
    { active: true, renderCalls: 0 },
    "Vor dem Plan-Render muss der Browser eine Render-Gelegenheit mit aktivem Zieltab erhalten",
  );
  await page.waitForFunction(() =>
    (document.getElementById("blockPlan")?.childElementCount || 0) > 0 &&
    !!document.getElementById("planWeekOverview") &&
    !document.getElementById("plan")?.hasAttribute("aria-busy"),
  );
  assert.equal(await page.evaluate(() => window.__planRenderCalls), 1, "Der Tabwechsel darf den Plan genau einmal rendern");
  await page.evaluate(() => window.__restoreMeasuredRenderPlan?.());
  assert.ok(await page.locator("#plan.view.active").count(), "Plan muss erst nach Navigation aktiv und gerendert sein");
  assert.equal(await page.locator("#planWeekOverview .plan-week-day").count(), 7, "Der erste Plan-Render baut die Mobile-Woche auf");
  assert.equal(await page.locator("#prepNow > *").count(), 0, "Plan-Navigation darf den versteckten Prep-Bereich nicht mitrendern");

  const prepTransition = await page.evaluate(async () => {
    const profiledFunctions = [
      "populateBatchCalculator",
      "prepItems",
      "prepDemand",
      "computePrepDemand",
      "viewRenderPrepPlanDays",
      "viewRenderPlanDays",
      "planDisplayDays",
      "viewRenderRecipeStates",
      "recipeStates",
      "recipeStatesCore",
      "shoppingItems",
    ];
    const prepFrom = state.settings.planFrom && state.settings.planFrom >= today()
      ? state.settings.planFrom
      : today();
    window.__prepWeekCacheHitBefore = !!globalThis.__plannerWeekCache?.has(prepFrom, 7);
    window.__prepStageProfile = {};
    window.__prepStageOriginals = {};
    for (const name of profiledFunctions) {
      const original = window[name];
      if (typeof original !== "function") continue;
      window.__prepStageOriginals[name] = original;
      window[name] = function profilePrepStage(...args) {
        const startedAt = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          window.__prepStageProfile[name] = (window.__prepStageProfile[name] || 0) + performance.now() - startedAt;
        }
      };
    }
    const originalRenderPrep = renderPrep;
    window.__prepRenderCalls = 0;
    renderPrep = function measuredRenderPrep(...args) {
      window.__prepRenderCalls += 1;
      const startedAt = performance.now();
      const result = originalRenderPrep.apply(this, args);
      window.__prepRenderDurationMs = performance.now() - startedAt;
      return result;
    };
    window.__restoreMeasuredRenderPrep = () => { renderPrep = originalRenderPrep; };
    const beforeRenderOpportunity = new Promise((resolve) => {
      requestAnimationFrame(() => resolve({
        active: document.getElementById("prep")?.classList.contains("active") || false,
        busy: document.getElementById("prep")?.getAttribute("aria-busy"),
        loadingText: document.querySelector("#prep > .prep-render-loading")?.textContent || "",
        loadingVisible: (() => {
          const loading = document.querySelector("#prep > .prep-render-loading");
          return !!loading && getComputedStyle(loading).display !== "none" && loading.getClientRects().length > 0;
        })(),
        prepShellDisplay: getComputedStyle(document.querySelector("#prep > .prep-mobile-head")).display,
        renderCalls: window.__prepRenderCalls,
      }));
    });
    document.querySelector('nav button[data-view="prep"]')?.click();
    return {
      immediate: {
        active: document.getElementById("prep")?.classList.contains("active") || false,
        busy: document.getElementById("prep")?.getAttribute("aria-busy"),
        loadingText: document.querySelector("#prep > .prep-render-loading")?.textContent || "",
        loadingVisible: (() => {
          const loading = document.querySelector("#prep > .prep-render-loading");
          return !!loading && getComputedStyle(loading).display !== "none" && loading.getClientRects().length > 0;
        })(),
        prepShellDisplay: getComputedStyle(document.querySelector("#prep > .prep-mobile-head")).display,
        renderCalls: window.__prepRenderCalls,
      },
      beforeRenderOpportunity: await beforeRenderOpportunity,
    };
  });
  const expectedPrepLoading = {
    active: true,
    busy: "true",
    loadingText: "Vorbereitung wird geladen …",
    loadingVisible: true,
    prepShellDisplay: "none",
    renderCalls: 0,
  };
  assert.deepEqual(prepTransition.immediate, expectedPrepLoading, "Prep zeigt einen Ladezustand statt veralteter Inhalte");
  assert.deepEqual(prepTransition.beforeRenderOpportunity, expectedPrepLoading, "Der Browser erhält eine Paint-Gelegenheit mit Ladehinweis vor dem synchronen Prep-Render");
  await page.waitForFunction(() =>
    document.querySelectorAll("#prepSummary > span").length === 3 &&
    !document.getElementById("prep")?.hasAttribute("aria-busy"),
  );
  assert.equal(await page.evaluate(() => window.__prepRenderCalls), 1, "Prep wird nach der Ladeansicht genau einmal gerendert");
  assert.equal(
    await page.locator("#recipeList > *").count(),
    0,
    "Der Prep-Render darf den vollständigen Rezeptkatalog nicht vorzeitig aufbauen",
  );
  const prepRenderDurationMs = await page.evaluate(() => window.__prepRenderDurationMs);
  assert.equal(
    await page.evaluate(() => window.__prepWeekCacheHitBefore),
    true,
    "Der sichtbare Planner-Snapshot muss nach dem Persistieren der Auto-Locks für Prep wiederverwendbar sein",
  );
  assert.ok(
    prepRenderDurationMs < 100,
    `Der synchrone Prep-Render soll keinen langen Main-Thread-Block verursachen (gemessen: ${prepRenderDurationMs.toFixed(1)} ms; Phasen: ${JSON.stringify(await page.evaluate(() => window.__prepStageProfile))})`,
  );
  console.log(`[prep-render-profile] ${JSON.stringify({ totalMs: Number(prepRenderDurationMs.toFixed(1)), weekCacheHitBefore: await page.evaluate(() => window.__prepWeekCacheHitBefore), stages: await page.evaluate(() => window.__prepStageProfile) })}`);
  assert.equal(await page.locator("#prep > .prep-render-loading").count(), 0, "Nach dem Render darf der Ladehinweis nicht stehen bleiben");
  const renderedPrepChildren = await page.locator("#prepNow > *").count();
  await page.evaluate(() => window.__restoreMeasuredRenderPrep?.());
  await page.evaluate(() => Object.entries(window.__prepStageOriginals || {}).forEach(([name, original]) => { window[name] = original; }));

  const rapidTransition = await page.evaluate(() => {
    const originalRenderPrep = renderPrep;
    const originalRenderFoods = renderFoods;
    window.__rapidTabRenderCalls = { prep: 0, foods: 0 };
    renderPrep = function measuredRenderPrep(...args) {
      window.__rapidTabRenderCalls.prep += 1;
      return originalRenderPrep.apply(this, args);
    };
    renderFoods = function measuredRenderFoods(...args) {
      window.__rapidTabRenderCalls.foods += 1;
      return originalRenderFoods.apply(this, args);
    };
    window.__restoreRapidTabRenders = () => {
      renderPrep = originalRenderPrep;
      renderFoods = originalRenderFoods;
    };
    const prepChildrenBefore = document.getElementById("prepNow")?.childElementCount || 0;
    document.querySelector('nav button[data-view="prep"]')?.click();
    document.querySelector('nav button[data-view="foods"]')?.click();
    return {
      active: document.getElementById("foods")?.classList.contains("active") || false,
      prepChildrenBefore,
      prepChildren: document.getElementById("prepNow")?.childElementCount || 0,
      prepBusy: document.getElementById("prep")?.getAttribute("aria-busy"),
      prepLoadingCount: document.querySelectorAll("#prep > .prep-render-loading").length,
    };
  });
  assert.equal(rapidTransition.active, true, "Der letzte Zieltab muss sichtbar bleiben");
  assert.equal(rapidTransition.prepChildrenBefore, renderedPrepChildren);
  assert.equal(
    rapidTransition.prepChildren,
    rapidTransition.prepChildrenBefore,
    "Ein überholter Zwischentab darf weder synchron gerendert noch geleert werden",
  );
  assert.equal(rapidTransition.prepBusy, null);
  assert.equal(rapidTransition.prepLoadingCount, 0);
  await page.waitForFunction(() =>
    (document.getElementById("foodList")?.childElementCount || 0) > 0 &&
    !document.getElementById("foods")?.hasAttribute("aria-busy"),
  );
  assert.deepEqual(
    await page.evaluate(() => window.__rapidTabRenderCalls),
    { prep: 0, foods: 1 },
    "Schnelle Mehrfachnavigation muss ausschließlich den letzten Zieltab rendern",
  );
  await page.evaluate(() => window.__restoreRapidTabRenders?.());
  assert.ok(await page.locator("#foods.view.active").count(), "Lebensmittel muss nach Navigation aktiv sein");
  assert.equal(await page.locator("#prepNow > *").count(), renderedPrepChildren, "Lebensmittel-Navigation darf den Prep-Inhalt nicht verändern");

  await page.locator('[data-catalog-mode="recipes"]').click();
  await page.waitForFunction(() => (document.getElementById("recipeList")?.childElementCount || 0) > 0);
  assert.ok(await page.locator("#recipesSection:not([hidden])").count(), "Der Rezeptkatalog muss nach dem Umschalten vollständig gerendert werden");
  assert.equal(await page.locator("#prepNow > *").count(), renderedPrepChildren, "Rezept-Navigation darf den Prep-Inhalt nicht verändern");

  await page.evaluate(() => {
    const list = document.getElementById("recipeList");
    if (list) list.innerHTML = '<div id="staleRecipeMarker">veraltet</div>';
    renderCurrentView();
  });
  await page.waitForFunction(() =>
    !document.getElementById("staleRecipeMarker") &&
    (document.getElementById("recipeList")?.childElementCount || 0) > 0,
  );
  assert.equal(
    await page.locator("#prepNow > *").count(),
    renderedPrepChildren,
    "Ein späterer Current-View-Render muss nur den sichtbaren Rezeptkatalog aktualisieren",
  );

  await page.locator('nav button[data-view="more"]').click();
  await page.waitForFunction(() => (document.getElementById("statisticsBody")?.childElementCount || 0) > 0);
  assert.ok(await page.locator("#more.view.active").count(), "Mehr muss nach Navigation aktiv und gerendert sein");
  assert.equal(await page.locator("#productAllergenCard").count(), 0, "Die entfernte Produktkennzeichnung darf nicht mehr gerendert werden");

  assert.deepEqual(pageErrors, [], `Beim Start und Lazy-Render dürfen keine JavaScript-Fehler auftreten: ${pageErrors.join(" | ")}`);

} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
