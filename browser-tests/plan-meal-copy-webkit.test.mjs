import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

function canonical(ids = []) {
  return [...new Set(ids)].filter(Boolean).sort().join("+");
}

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
let context = null;

try {
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.buildDays && window.__plannerPoliciesReady === true);

  const today = await page.evaluate(() => {
    window.__beikostTest.reset();
    const current = window.__beikostTest.today();
    const state = window.__beikostTest.getState();
    state.settings.phaseSelected = "aufbau";
    state.settings.planFrom = current;
    state.settings.preferInventoryInPlan = false;
    state.settings.newFoodEvery = 99;
    state.manualMeals = {};
    state.planLocks = {};
    state.overrides = {};
    state.autoLockExcluded = {};
    state.followUps = {};
    state.deferred = {};
    state.inventory = [];
    for (const food of state.foods) {
      if (
        food.active &&
        food.autoPlan !== false &&
        (food.meals || []).some((meal) => ["breakfast", "lunch", "dinner"].includes(meal))
      ) {
        food.manualStatus = "Regelmäßig";
      }
    }
    window.__beikostTest.setState(state);
    return current;
  });

  await page.locator('nav button[data-view="plan"]').click();
  await page.waitForFunction(() => document.querySelectorAll("#blockPlan .copyPlanMeal").length > 0);

  const copyButton = page.locator("#blockPlan .copyPlanMeal").first();
  const details = copyButton.locator("xpath=ancestor::details[contains(@class,'meal-plan-actions')]").first();
  await details.locator(":scope > summary").click();
  await copyButton.waitFor({ state: "visible" });
  assert.equal(await copyButton.innerText(), "Mahlzeit kopieren");

  const source = await copyButton.evaluate((button) =>
    JSON.parse(decodeURIComponent(button.dataset.copyPayload || "")),
  );
  assert.ok(source?.date && source?.meal, "Kopieraktion braucht den vollständigen Quell-Slot");
  const sourceFoods = canonical(source.foodIds || []);
  assert.ok(sourceFoods, "Quellmahlzeit muss konkrete Lebensmittel enthalten");

  await copyButton.click();
  const dateInput = page.locator("#copyMealDate");
  await dateInput.waitFor({ state: "visible" });
  const firstTarget = await page.evaluate((date) => window.__beikostTest.addDays(date, 1), source.date);
  assert.equal(await dateInput.inputValue(), firstTarget, "Datumsauswahl startet am Folgetag");
  assert.equal(await dateInput.getAttribute("min"), firstTarget, "Quelle kann nicht auf denselben oder einen früheren Tag kopiert werden");

  await page.locator("#copyMealTargetConfirm").click();
  await page.locator("#copyMealReplace").waitFor({ state: "visible" });
  await page.locator("#copyMealReplace").click();

  const targetKey = `${firstTarget}|${source.meal}`;
  await page.waitForFunction(({ key, foods }) => {
    const state = window.__beikostTest.getState();
    const copied = state.manualMeals?.[key];
    const lock = state.planLocks?.[key];
    const current = [...new Set(copied?.foodIds || [])].filter(Boolean).sort().join("+");
    return current === foods && copied?.manualAdded === true && lock?.mode === "manual";
  }, { key: targetKey, foods: sourceFoods });

  const persisted = await page.evaluate(({ sourceDate, sourceMeal, targetKey }) => {
    const state = window.__beikostTest.getState();
    const sourceDay = window.__beikostTest.buildDays(sourceDate, 1, false)[0];
    const sourceEntry = sourceDay?.meals?.find((meal) => meal.meal === sourceMeal && meal.active);
    const copied = state.manualMeals?.[targetKey];
    const lock = state.planLocks?.[targetKey];
    return {
      sourceFoods: [...new Set(sourceEntry?.foodIds || [])].filter(Boolean).sort().join("+"),
      copiedFoods: [...new Set(copied?.foodIds || [])].filter(Boolean).sort().join("+"),
      copiedDate: copied?.date || "",
      copiedManual: copied?.manualAdded === true,
      lockMode: lock?.mode || "",
    };
  }, { sourceDate: source.date, sourceMeal: source.meal, targetKey });

  assert.equal(persisted.sourceFoods, sourceFoods, "Quellmahlzeit bleibt nach dem Kopieren unverändert");
  assert.equal(persisted.copiedFoods, sourceFoods, "Ziel enthält dieselbe Mahlzeit");
  assert.equal(persisted.copiedDate, firstTarget);
  assert.equal(persisted.copiedManual, true);
  assert.equal(persisted.lockMode, "manual", "Kopie wird vor automatischer Neuplanung geschützt");
  assert.match(await page.locator("#toastText").innerText(), /kopiert und vor automatischen Änderungen geschützt/i);

  assert.equal(today <= source.date, true, "Test verwendet einen sichtbaren aktuellen Plan-Slot");
} finally {
  await closeBrowserApp({ context, browser, server });
}
