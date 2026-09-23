import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const address = server.address();
const port = address.port;
const browser = await webkit.launch();

function normalizedPlan(days = []) {
  return days.map((day) => ({
    date: day.date,
    meals: (day.meals || []).map((meal) => ({
      meal: meal.meal,
      active: !!meal.active,
      empty: !!meal.empty,
      focusId: meal.focusId || "",
      foodIds: [...(meal.foodIds || [])],
      baseFoodIds: [...(meal.baseFoodIds || [])],
      sampleFoodIds: [...(meal.sampleFoodIds || [])],
      recipeName: meal.recipeName || "",
      type: meal.type || "",
    })),
  }));
}

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !!window.__beikostTest?.getState && window.__plannerPoliciesReady === true,
    null,
    { timeout: 60000 },
  );

  const setup = await page.evaluate(() => {
    window.__beikostTest.reset();
    const start = window.__beikostTest.today();
    const next = window.__beikostTest.addDays;
    const current = window.__beikostTest.getState();
    const enabled = new Set([
      "bangus-milkfish",
      "huhn",
      "kartoffel",
      "brokkoli",
      "zucchini",
      "polenta",
      "apfel",
      "weizengriess",
    ]);

    current.settings.phaseSelected = "drei";
    current.settings.startDate = next(start, -60);
    current.settings.planFrom = start;
    current.settings.preferInventoryInPlan = true;
    current.settings.seasonal = false;
    current.settings.phMode = "off";
    current.settings.newFoodEvery = 30;
    current.logs = [];
    current.manualMeals = {};
    current.planLocks = {};
    current.overrides = {};
    current.autoLockExcluded = {};
    current.shoppingHints = {
      "bangus-milkfish": { status: "needed", source: "plan" },
    };
    current.pantry = { "bangus-milkfish": false };
    current.followUps = {};
    current.deferred = {};
    for (let index = 0; index < 7; index++) current.deferred[next(start, index)] = true;

    for (const item of current.foods) {
      item.active = enabled.has(item.id);
      if (enabled.has(item.id)) item.manualStatus = "Regelmäßig";
    }

    current.inventory = [
      { id: "quality-huhn", kind: "food", foodId: "huhn", portions: 5, size: "20 g", frozenDate: start },
      { id: "quality-kartoffel", kind: "food", foodId: "kartoffel", portions: 5, size: "35 g", frozenDate: start },
      { id: "quality-brokkoli", kind: "food", foodId: "brokkoli", portions: 12, size: "35 g", frozenDate: start },
      { id: "quality-zucchini", kind: "food", foodId: "zucchini", portions: 3, size: "35 g", frozenDate: start },
      { id: "quality-polenta", kind: "food", foodId: "polenta", portions: 5, size: "35 g", frozenDate: start },
      { id: "quality-apfel", kind: "food", foodId: "apfel", portions: 7, size: "35 g", frozenDate: start },
      { id: "quality-weizengriess", kind: "food", foodId: "weizengriess", portions: 4, size: "35 g", frozenDate: start },
    ];

    window.__beikostTest.setState(current);
    const snapshot = window.__beikostTest.getState();
    const mainDays = window.buildDays(start, 7, false);
    const lunchPorridgeAllowed = window.__beikostTest.recipeSuitableForMeal("Obst-Polentabrei", "lunch");

    return { start, snapshot, mainDays, lunchPorridgeAllowed };
  });

  assert.equal(setup.lunchPorridgeAllowed, false, "Obst-Polentabrei darf nicht automatisch in den Lunch-Slot rutschen");

  const mainMeals = setup.mainDays.flatMap((day) =>
    (day.meals || [])
      .filter((meal) => meal.active && !meal.empty && ["breakfast", "lunch", "dinner"].includes(meal.meal))
      .map((meal) => ({ ...meal, date: day.date })),
  );
  assert.ok(mainMeals.length >= 7, "Testzustand muss genug automatisch geplante Hauptmahlzeiten erzeugen");
  assert.equal(
    mainMeals.some((meal) => (meal.foodIds || []).includes("bangus-milkfish")),
    false,
    "als nicht verfügbar markierter Bangus darf in keinem der sieben Tage erscheinen",
  );

  for (const meal of mainMeals) {
    const intentionalSingleSample =
      (meal.foodIds || []).length === 1 &&
      (meal.sampleFoodIds || []).includes(meal.foodIds[0]) &&
      ["neu", "gezielt wiederholen", "Allergen einführen", "Allergen wiederholen", "manuell"].includes(meal.type);
    if (!meal.recipeName && !intentionalSingleSample) {
      assert.ok(
        (meal.foodIds || []).length >= 2,
        `${meal.date} ${meal.meal} darf keine normale Einzelzutat sein: ${JSON.stringify(meal)}`,
      );
    }
    if (["huhn", "weizengriess"].includes(meal.focusId) && !intentionalSingleSample) {
      assert.ok(
        (meal.foodIds || []).length >= 2,
        `${meal.focusId} braucht in einer normalen Hauptmahlzeit einen passenden Begleiter`,
      );
    }
  }

  const lunchRecipeCategories = await page.evaluate((days) =>
    days.flatMap((day) => (day.meals || [])
      .filter((meal) => meal.meal === "lunch" && meal.recipeName)
      .map((meal) => ({
        recipeName: meal.recipeName,
        category: window.recipeByName(meal.recipeName)?.category || "",
      }))),
    setup.mainDays,
  );
  assert.equal(
    lunchRecipeCategories.some((entry) => ["porridge", "pancakes", "baking"].includes(entry.category)),
    false,
    `Lunch enthält Frühstücksrezept: ${JSON.stringify(lunchRecipeCategories)}`,
  );

  const mainSignatures = mainMeals
    .filter((meal) => ["lunch", "dinner"].includes(meal.meal))
    .map((meal) => meal.recipeName || [...(meal.foodIds || [])].sort().join("+"))
    .filter(Boolean);
  assert.ok(mainSignatures.length > 1, "Testzustand muss mehrere Lunch-/Dinner-Slots enthalten");
  assert.ok(
    new Set(mainSignatures).size > 1,
    `Sieben-Tage-Plan darf bei vorhandenen Alternativen nicht auf eine Mahlzeit kollabieren: ${JSON.stringify(mainSignatures)}`,
  );

  const workerDays = await page.evaluate(({ start, snapshot }) => new Promise((resolve, reject) => {
    const worker = new Worker("js/planner-week-worker.js?v=10.1.26");
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Planner-Worker antwortete nicht"));
    }, 30000);
    worker.onmessage = (event) => {
      const data = event.data || {};
      if (data.requestId !== 1) return;
      clearTimeout(timeout);
      worker.terminate();
      if (data.type === "error") reject(new Error(data.message || "Planner-Worker fehlgeschlagen"));
      else resolve(data.weeks?.[0]?.days || []);
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message || "Planner-Worker konnte nicht geladen werden"));
    };
    worker.postMessage({
      type: "build",
      requestId: 1,
      inputRevision: 0,
      starts: [start],
      state: snapshot,
    });
  }), { start: setup.start, snapshot: setup.snapshot });

  assert.deepEqual(
    normalizedPlan(workerDays),
    normalizedPlan(setup.mainDays),
    "Hauptthread und 7-Tage-Worker müssen für denselben State denselben Plan liefern",
  );
} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
