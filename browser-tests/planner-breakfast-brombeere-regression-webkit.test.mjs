import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, configureBrowserTestPage, startStaticServer } from "./helpers/app-harness.mjs";

function dayMeals(day) {
  if (Array.isArray(day?.meals)) return day.meals;
  if (Array.isArray(day)) return day;
  return [];
}

function mealFingerprint(days, mealKey) {
  const meal = dayMeals(days?.[0]).find((entry) => entry?.meal === mealKey) || null;
  if (!meal) return null;
  return {
    meal: meal.meal,
    focusId: meal.focusId || "",
    foodIds: [...(meal.foodIds || [])].sort(),
    baseFoodIds: [...(meal.baseFoodIds || [])].sort(),
    sampleFoodIds: [...(meal.sampleFoodIds || [])].sort(),
    recipeName: meal.recipeName || "",
    type: meal.type || "",
  };
}

async function waitForApp(page) {
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState &&
    typeof window.lockedMeal === "function" &&
    typeof window.buildDays === "function" &&
    typeof window.planDisplayDays === "function" &&
    typeof window.companionFor === "function" &&
    window.__plannerPoliciesReady === true,
  );
}

async function seedRegressionState(page) {
  return page.evaluate(() => {
    const bridge = window.__beikostTest;
    bridge.reset();
    const state = bridge.getState();
    const date = bridge.today();
    const keepIds = new Set(["bangus-milkfish", "brombeere", "zucchini"]);

    state.settings.startDate = date;
    state.settings.planFrom = date;
    state.settings.phaseSelected = "aufbau";
    state.settings.seasonal = false;
    state.planLocks = {};
    state.manualMeals = {};
    state.overrides = {};
    state.logs = [];

    for (const item of state.foods) {
      item.active = keepIds.has(item.id);
      item.manualStatus = "Pausiert";
    }

    const fish = state.foods.find((item) => item.id === "bangus-milkfish");
    const blackberry = state.foods.find((item) => item.id === "brombeere");
    const zucchini = state.foods.find((item) => item.id === "zucchini");
    if (!fish || !blackberry || !zucchini) throw new Error("Regression fixture foods missing");

    fish.active = true;
    fish.manualStatus = "Offen";
    blackberry.active = true;
    blackberry.manualStatus = "Bekannt";
    zucchini.active = true;
    zucchini.manualStatus = "Bekannt";

    state.overrides[`${date}|lunch`] = fish.id;
    state.planLocks[`${date}|breakfast`] = {
      date,
      meal: "breakfast",
      focusId: blackberry.id,
      foodIds: [blackberry.id],
      baseFoodIds: [blackberry.id],
      sampleFoodIds: [],
      optionalAddons: [],
      inventoryFoodIds: [],
      recipeName: "",
      recipeInventoryId: "",
      type: "bekannt",
      note: "stale automatic breakfast lock",
      manualAdded: false,
      active: true,
      mode: "auto",
      locked: true,
      planId: "regression-stale-breakfast",
    };

    bridge.setState(state);
    return { date };
  });
}

async function buildInWorker(page, start) {
  return page.evaluate(async (from) => {
    const snapshot = structuredClone(window.__beikostTest.getState());
    const worker = new Worker(new URL("js/planner-week-worker.js?v=10.1.26", document.baseURI));
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Planner worker regression test timed out")), 15_000);
        worker.onerror = (event) => {
          clearTimeout(timeout);
          reject(new Error(event?.message || "Planner worker failed"));
        };
        worker.onmessage = (event) => {
          const data = event?.data || {};
          if (data.requestId !== "planner-regression") return;
          clearTimeout(timeout);
          if (data.type === "error") reject(new Error(data.message || "Planner worker returned error"));
          else resolve(data);
        };
        worker.postMessage({
          type: "build",
          requestId: "planner-regression",
          inputRevision: 1,
          starts: [from],
          state: snapshot,
        });
      });
    } finally {
      worker.terminate();
    }
  }, start);
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
  const page = configureBrowserTestPage(await context.newPage(), {
    actionTimeoutMs: 30_000,
    navigationTimeoutMs: 30_000,
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const { date } = await seedRegressionState(page);

  const lockPath = await page.evaluate((on) => {
    const key = `${on}|breakfast`;
    const visible = window.lockedMeal(on, "breakfast");
    const stored = window.__beikostTest.getState().planLocks?.[key] || null;
    const displayed = window.planDisplayDays(on, 1);
    const breakfast = (Array.isArray(displayed?.[0]?.meals) ? displayed[0].meals : Array.isArray(displayed?.[0]) ? displayed[0] : [])
      .find((meal) => meal?.meal === "breakfast") || null;
    return {
      visible,
      stored,
      displayedBreakfast: breakfast ? {
        active: breakfast.active === true,
        focusId: breakfast.focusId || "",
        foodIds: [...(breakfast.foodIds || [])],
      } : null,
    };
  }, date);

  assert.equal(lockPath.visible, null, "Installierter lockedMeal-Wrapper blendet inaktives automatisches Frühstück aus");
  assert.ok(lockPath.stored, "Der inaktive Frühstücks-Lock bleibt im Zustand erhalten");
  assert.equal(lockPath.stored.manualAdded, false);
  assert.equal(lockPath.stored.focusId, "brombeere");
  assert.deepEqual(lockPath.displayedBreakfast, {
    active: false,
    focusId: "",
    foodIds: [],
  }, "Der reale Planner-Pfad behält nur den inaktiven Frühstücks-Platzhalter und verwendet den alten Auto-Lock nicht");

  const companion = await page.evaluate((on) => {
    const fish = window.__beikostTest.getState().foods.find((item) => item.id === "bangus-milkfish");
    return window.companionFor(fish, "lunch", on, "manuell")?.id || "";
  }, date);
  assert.equal(companion, "zucchini", "Die installierte Policy wählt für Fisch den kulinarischen Gemüse-Begleiter statt Brombeere");

  const mainDays = await page.evaluate((on) => structuredClone(window.buildDays(on, 1, false)), date);
  const mainLunch = mealFingerprint(mainDays, "lunch");
  assert.ok(mainLunch, "Hauptthread erzeugt ein Mittagessen");
  assert.equal(mainLunch.focusId, "bangus-milkfish", "Der erzwungene Fisch bleibt Fokus des echten Planner-Laufs");
  assert.ok(mainLunch.foodIds.includes("zucchini"), "Der echte Planner-Lauf kombiniert Fisch mit Zucchini");
  assert.equal(mainLunch.foodIds.includes("brombeere"), false, "Brombeere wird nicht als Fisch-Basis eingeplant");
  assert.equal(mainLunch.baseFoodIds.includes("brombeere"), false, "Brombeere erhält im echten Planner-Lauf keine Basisrolle");

  const workerResult = await buildInWorker(page, date);
  assert.equal(workerResult.type, "result", "Echter Planner-Worker liefert ein Ergebnis statt eines Fallbacks");
  assert.equal(workerResult.inputRevision, 1);
  assert.equal(workerResult.weeks?.length, 1);
  const workerLunch = mealFingerprint(workerResult.weeks?.[0]?.days || [], "lunch");
  assert.deepEqual(workerLunch, mainLunch, "Worker und Hauptthread liefern für den Regression-State dieselbe Mittagessen-Planung");
  assert.equal(workerLunch?.foodIds.includes("brombeere"), false, "Auch der Worker plant keine Brombeere als Fisch-Basis");
} finally {
  await closeBrowserApp({ context, browser, server });
}
