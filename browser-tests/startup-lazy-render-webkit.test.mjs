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
    document.querySelector('nav button[data-view="prep"]')?.click();
    document.querySelector('nav button[data-view="foods"]')?.click();
    return {
      active: document.getElementById("foods")?.classList.contains("active") || false,
      prepChildren: document.getElementById("prepNow")?.childElementCount || 0,
    };
  });
  assert.deepEqual(
    rapidTransition,
    { active: true, prepChildren: 0 },
    "Ein überholter Zwischentab darf weder sichtbar bleiben noch synchron gerendert werden",
  );
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
  assert.equal(await page.locator("#prepNow > *").count(), 0, "Lebensmittel-Navigation darf den versteckten Prep-Bereich nicht mitrendern");

  await page.locator('[data-catalog-mode="recipes"]').click();
  await page.waitForFunction(() => (document.getElementById("recipeList")?.childElementCount || 0) > 0);
  assert.ok(await page.locator("#recipesSection:not([hidden])").count(), "Der Rezeptkatalog muss nach dem Umschalten vollständig gerendert werden");
  assert.equal(await page.locator("#prepNow > *").count(), 0, "Rezept-Navigation darf den versteckten Prep-Bereich nicht mitrendern");

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
    0,
    "Ein späterer Current-View-Render muss nur den sichtbaren Rezeptkatalog aktualisieren",
  );

  await page.locator('nav button[data-view="more"]').click();
  await page.waitForFunction(() => (document.getElementById("statisticsBody")?.childElementCount || 0) > 0);
  assert.ok(await page.locator("#more.view.active").count(), "Mehr muss nach Navigation aktiv und gerendert sein");
  assert.equal(await page.locator("#productAllergenCard").count(), 0, "Die entfernte Produktkennzeichnung darf nicht mehr gerendert werden");

  assert.deepEqual(pageErrors, [], `Beim Start und Lazy-Render dürfen keine JavaScript-Fehler auftreten: ${pageErrors.join(" | ")}`);

} finally {
  await closeBrowserApp({ context, browser, server });
}
