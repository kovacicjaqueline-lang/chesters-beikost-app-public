Warning: truncated output (original token count: 7257)
Total output lines: 520

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";
import { installBrowserTimingProbe } from "./helpers/browser-timing-probe.mjs";



async function waitForApp(page) {
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState &&
    typeof window.openLog === "function" &&
    typeof window.editLogEntry === "function",
  );
}

async function selectFood(page, name) {
  const search = page.locator("#logFoodSearch");
  if (!(await search.isVisible())) {
    const foodTab = page.locator('[data-flow-log-selector="foods"]');
    if (await foodTab.count()) await foodTab.click();
  }
  if (!(await search.isVisible())) {
    const searchToggle = page.locator('[data-flow-log-search-toggle="foods"]');
    if (await searchToggle.count()) await searchToggle.click();
  }
  await search.waitFor({ state: "visible" });
  await search.fill(name);
  const result = page.locator(".addLogFoodResult").filter({ hasText: name }).first();
  await result.waitFor();
  await result.click();
}

async function searchRecipe(page, name) {
  const search = page.locator("#logRecipeSearch");
  if (!(await search.isVisible())) {
    const recipeTab = page.locator('[data-flow-log-selector="recipes"]');
    if (await recipeTab.count()) await recipeTab.click();
  }
  if (!(await search.isVisible())) {
    const searchToggle = page.locator('[data-flow-log-search-toggle="recipes"]');
    if (await searchToggle.count()) await searchToggle.click();
  }
  await search.fill(name);
}

// Mobile sheets keep long-form controls outside the viewport after a rerender.
async function selectLogOption(page, selector, value) {
  const control = page.locator(selector);
  await control.scrollIntoViewIfNeeded();
  await control.selectOption(value);
}

async function reset(page) {
  await page.evaluate(async () => {
    const state = structuredClone(window.__beikostTestBaseline);
    state.logs = [];
    state.followUps = {};
    state.shoppingHints = {};
    state.backupMeta.chesterContextSeeded = true;
    window.__beikostTest.setState(state);
    await window.save({ replaceLogs: true });
  });
}

async function captureTestBaseline(page) {
  await page.evaluate(() => {
    const api = window.__beikostTest;
    api.reset();
    window.__beikostTestBaseline = api.getState();
  });
}

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
const timingProbe = installBrowserTimingProbe(page);

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await captureTestBaseline(page);

  // 1. Freier Eintrag: optionale tatsächliche Mahlzeit, bewusste Textur, Rollenpersistenz.
  await reset(page);
  await page.evaluate(() => window.openLog(null));
  assert.equal(await page.locator("#logMeal").count(), 1, "Freier Eintrag braucht eine optionale Mahlzeitenzuordnung");
  assert.equal(await page.locator("#logMeal").inputValue(), "", "Freier Eintrag darf keine Mahlzeit vorauswählen");
  assert.equal(await page.locator("#logTexture").inputValue(), "", "Neue Textur darf nicht vorausgewählt sein");
  assert.equal(await page.locator("#logTexture + .small").count(), 0, "Das Konsistenzfeld darf keinen zusätzlichen Hinweistext anzeigen");
  await selectFood(page, "Karotte");
  await selectLogOption(page, "#logTexture", "1");
  await page.locator("#logAmount").fill("5");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);

  let freeLog = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(freeLog.entryType, "food");
  assert.equal(freeLog.meal, "");
  assert.equal(freeLog.textureKnown, true);
  assert.equal(freeLog.textureStage, 1);
  assert.equal(freeLog.amount, "5");
  assert.deepEqual(freeLog.sampleFoodIds, ["karotte"]);
  assert.equal(freeLog.foodRoles.karotte, "sample");
  assert.equal(await page.evaluate(() => successfulMealSlotCount(today())), 0, "Freier Eintrag darf kein Phasen-Mahlzeitenslot sein");

  // Bearbeiten ersetzt denselben Log und behält Rollen; Reload behält echte Textur.
  const freeId = freeLog.id;
  await page.evaluate((id) => window.editLogEntry(id), freeId);
  await selectLogOption(page, "#logTexture", "2");
  await page.locator("#logAmount").fill("8");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
  let edited = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(edited.id, freeId);
  assert.equal(edited.textureStage, 2);
  assert.equal(edited.amount, "8");
  assert.equal(edited.foodRoles.karotte, "sample");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  let reloaded = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(reloaded.id, freeId);
  assert.equal(reloaded.meal, "");
  assert.equal(reloaded.textureKnown, true);
  assert.equal(reloaded.textureStage, 2);
  assert.equal(reloaded.foodRoles.karotte, "sample");
  await captureTestBaseline(page);

  // Eine freie tatsächliche Mahlzeit schließt bei eindeutiger Zuordnung den offenen Plan-Slot ab.
  await reset(page);
  const freeAssignedDate = await page.evaluate(() => window.__beikostTest.today());
  await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    state.planLocks[`${date}|lunch`] = {
      planId: "free-assigned-lunch",
      date,
      meal: "lunch",
      focusId: "karotte",
      foodIds: ["karotte"],
      baseFoodIds: [],
      sampleFoodIds: ["karotte"],
      …4257 tokens truncated… }) => !!window.__plannerLogRolloverCore.linkedCompletionLog(window.__beikostTest.getState(), planId, date, "lunch"), { planId: plannedMealId, date: plannedDate }),
    true,
    "Der konkrete Plan muss nach unverändertem Speichern verknüpft abgeschlossen sein",
  );

  // Beim Bearbeiten darf eine fehlgeschlagene Validierung weder den gespeicherten Kontext noch plannedMealId verändern.
  await page.evaluate((id) => window.editLogEntry(id), planned.id);
  assert.doesNotMatch(await page.locator("#logForm").innerText(), /aus dem Plan/);
  await page.locator("#logAmount").evaluate((element) => { element.dataset.contextRenderSentinel = "stable"; });
  await page.getByRole("button", { name: "Ändern", exact: true }).click();
  await page.locator("#logDate").fill(movedDateIso);
  await page.locator("#logDate").dispatchEvent("change");
  assert.equal(await page.locator("#logDate").inputValue(), movedDateIso, "Datumsänderung muss ohne Rückfrage sofort übernommen werden");
  assert.equal(await page.locator("#logAmount").getAttribute("data-context-render-sentinel"), "stable", "Datumswechsel darf das Formular nicht vollständig neu rendern");
  assert.equal(await page.getByText("Entwurf verschieben?", { exact: true }).count(), 0, "Datumsänderung darf keine Rückfrage öffnen");
  assert.equal(await page.locator("#logModal").evaluate((node) => node.classList.contains("open")), true, "Datumsänderung muss im Formular bleiben");
  await selectLogOption(page, "#logMeal", "dinner");
  assert.equal(await page.locator("#logAmount").getAttribute("data-context-render-sentinel"), "stable", "Mahlzeitenänderung darf das Formular nicht vollständig neu rendern");
  assert.doesNotMatch(await page.locator("#logForm").innerText(), /aus dem Plan/, "Nach einer Kontextkorrektur ist die ursprüngliche Planung nicht mehr relevant");
  await selectLogOption(page, "#logTexture", "");
  await page.locator("#saveLog").click();
  assert.equal(await page.locator("#logModal").evaluate((node) => node.classList.contains("open")), true, "Ungültige Korrektur muss im Formular bleiben");
  assert.equal(await page.locator(".unified-texture-error").count(), 1);
  let failedEditState = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(failedEditState.date, plannedDate, "Fehlgeschlagener Save darf das gespeicherte Datum nicht ändern");
  assert.equal(failedEditState.meal, "lunch", "Fehlgeschlagener Save darf die gespeicherte Mahlzeit nicht ändern");
  assert.equal(failedEditState.plannedMealId, plannedMealId, "Fehlgeschlagener Save darf die Plan-Verknüpfung nicht lösen");

  // Gültige Korrektur speichert den tatsächlichen Kontext und lässt den ursprünglichen Plan offen.
  await selectLogOption(page, "#logTexture", "1");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => document.getElementById("logModal") && !document.getElementById("logModal").classList.contains("open"));
  planned = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(planned.date, movedDateIso);
  assert.equal(planned.meal, "dinner");
  assert.equal(Object.hasOwn(planned, "plannedMealId"), false, "Abweichender tatsächlicher Kontext darf den ursprünglichen Plan nicht fälschlich abschließen");
  assert.equal(planned.individualRatings, true);
  assert.equal(planned.foodOutcomes.brokkoli, "not_accepted");
  assert.equal(
    await page.evaluate(({ planId, date }) => window.__plannerLogRolloverCore.openPlanInstances(window.__beikostTest.getState(), (plan) => plan.planId === planId && plan.date === date && plan.meal === "lunch").length, { planId: plannedMealId, date: plannedDate }),
    1,
    "Der ursprüngliche Plan muss nach abweichendem tatsächlichem Kontext offen bleiben",
  );
  assert.equal(await page.evaluate((date) => successfulMealSlotCount(date), movedDateIso), 1);

  // Späteres Bearbeiten korrigiert den tatsächlichen Slot weiter, ohne eine Plan-Verknüpfung neu zu erfinden.
  await page.evaluate((id) => window.editLogEntry(id), planned.id);
  assert.doesNotMatch(await page.locator("#logForm").innerText(), /aus dem Plan/);
  await page.getByRole("button", { name: "Ändern", exact: true }).click();
  await selectLogOption(page, "#logMeal", "breakfast");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => document.getElementById("logModal") && !document.getElementById("logModal").classList.contains("open"));
  planned = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(planned.meal, "breakfast");
  assert.equal(Object.hasOwn(planned, "plannedMealId"), false);
  assert.equal(planned.individualRatings, true);
  assert.equal(planned.foodOutcomes.brokkoli, "not_accepted");

  // 8. Familienstatus: zwei freie Gaben am selben Tag bleiben zwei Expositionen.
  await reset(page);
  await page.evaluate(() => {
    const state = window.__beikostTest.getState();
    const date = window.__beikostTest.today();
    state.logs = [
      { id: "free-1", date, meal: "", entryType: "food", foodIds: ["sesam"], focusId: "sesam", baseFoodIds: ["sesam"], sampleFoodIds: [], foodRoles: { sesam: "base" }, foodOutcomes: { sesam: "eaten" }, outcome: "eaten", textureKnown: true, textureStage: 1 },
      { id: "free-2", date, meal: "", entryType: "food", foodIds: ["sesam"], focusId: "sesam", baseFoodIds: ["sesam"], sampleFoodIds: [], foodRoles: { sesam: "base" }, foodOutcomes: { sesam: "eaten" }, outcome: "eaten", textureKnown: true, textureStage: 1 },
    ];
    window.__beikostTest.setState(state);
  });
  assert.equal(
    await page.evaluate(() => window.__beikostTest.familySuccessfulExposureCount("sesam")),
    2,
    "Freie Gaben dürfen im Familienstatus nicht über date|meal zusammenfallen",
  );
} finally {
  console.log(`[browser-timing-probe] ${JSON.stringify(timingProbe.report())}`);
  await closeBrowserApp({ context, browser, server });
}

console.log("WebKit unified food log integration regression passed.");
