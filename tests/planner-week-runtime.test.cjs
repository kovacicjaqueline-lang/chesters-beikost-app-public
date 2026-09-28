"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { applyFoodPolicyData } = require("../app.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function loadPlanner() {
  const context = vm.createContext({ console, structuredClone, Date, Set, Map, Object, Array, Number, String, Math, JSON });
  vm.runInContext(read("data/foods.js"), context);
  vm.runInContext(read("data/recipes.js"), context);
  vm.runInContext(`${read("js/state.js")}\nglobalThis.__foods = FOOD_DB; globalThis.__aliases = ID_ALIASES;`, context);
  vm.runInContext(read("js/utils.js"), context);
  vm.runInContext(read("js/migrations.js"), context);
  vm.runInContext(read("js/model.js"), context);
  applyFoodPolicyData(context.__foods, context.__aliases);
  vm.runInContext(read("js/prep.js"), context);

  const trustedIds = ["kartoffel", "karotte", "zucchini", "brokkoli", "kuerbis", "hafer", "hirse", "reis", "polenta", "apfel", "banane", "birne", "rind", "huhn", "joghurt", "brombeere"];
  const logs = trustedIds.flatMap((id) => [1, 2].map((index) => ({
    id: `${id}-${index}`,
    date: `2026-09-${String(index).padStart(2, "0")}`,
    meal: "lunch",
    foodIds: [id],
    foodOutcomes: { [id]: "eaten" },
    createdAt: `2026-09-${String(index).padStart(2, "0")}T10:00:00.000Z`,
  })));
  const state = {
    settings: {
      startDate: "2026-01-24",
      planFrom: "2026-09-22",
      phaseSelected: "aufbau",
      phaseModelVersion: 2,
      amountSelected: "building",
      newFoodEvery: 7,
      preferInventoryInPlan: false,
      seasonal: false,
      phMode: "off",
      travelPrep: false,
      allergenDays: 7,
    },
    foods: clone(context.__foods),
    logs,
    inventory: [],
    overrides: {},
    deferred: {},
    pantry: {},
    planLocks: {},
    autoLockExcluded: {},
    manualMeals: {},
    combinationPauses: {},
    followUps: {},
    shoppingHints: {},
    backupMeta: { plannerLinking: { carriedPlans: {}, rolloverHandled: {} } },
  };
  context.__seed = state;
  vm.runInContext("state = __seed;", context);
  context.today = () => "2026-09-22";
  vm.runInContext(`${read("js/planning.js")}\nglobalThis.__buildDays = buildDays;`, context);
  context.planQualityIssues = () => [];
  vm.runInContext(`${read("js/planner-quality-rotation.js")}\nglobalThis.__installQuality = installPlannerQualityRotationRuntime;`, context);
  assert.equal(context.__installQuality(), true);
  return { context, state };
}

test("echter buildDays-Plan erzeugt eine abwechslungsreiche 7-Tage-Woche", () => {
  const { context, state } = loadPlanner();
  const days = context.__buildDays("2026-09-22", 7, false);

  assert.equal(days.length, 7);
  assert.deepEqual(clone(days.map((day) => day.date)), [
    "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25",
    "2026-09-26", "2026-09-27", "2026-09-28",
  ]);
  const activeMeals = days.flatMap((day) => day.meals.filter((meal) => meal.active && !meal.empty));
  const focusIds = activeMeals.map((meal) => meal.focusId).filter(Boolean);
  const combinations = activeMeals.map((meal) => [...new Set(meal.foodIds || [])].sort().join("+"));

  assert.equal(activeMeals.length, 14, "Phase Aufbau muss genau Mittagessen und Abendessen für 7 Tage erzeugen");
  assert.equal(activeMeals.some((meal) => ["breakfast", "snack"].includes(meal.meal)), false);
  assert.ok(new Set(focusIds).size >= 5, "die echten Tagesvorschläge müssen über die Woche rotieren");
  assert.ok(new Set(combinations).size >= 5, "die echten Mahlzeitenkombinationen müssen über die Woche rotieren");
  const blackberryMeals = activeMeals.filter((meal) => (meal.foodIds || []).includes("brombeere"));
  assert.ok(blackberryMeals.length <= 2, "Brombeere darf bei gleich geeigneten Alternativen nicht fast jede Mahlzeit dominieren");
  assert.ok(activeMeals.some((meal) => meal.foodIds.some((id) => state.foods.find((food) => food.id === id)?.ironRich)), "die Woche muss die modellierte Eisenregel sichtbar bedienen");
  for (const meal of activeMeals) {
    const items = meal.foodIds.map((id) => state.foods.find((food) => food.id === id)).filter(Boolean);
    assert.equal(items.some((food) => food.category === "Milchprodukt") && items.some((food) => ["Fleisch", "Fisch", "Meeresfrucht"].includes(food.category)), false, "Milch und Fleisch/Fisch dürfen nicht in derselben Mahlzeit kombiniert werden");
  }
  assert.equal(state.logs.length, 32);
});

test("echter Tagesplan rotiert einen bekannten Begleiter zwischen Mittag- und Abendessen", () => {
  const { context, state } = loadPlanner();
  state.foods = state.foods.filter((food) =>
    !food.ironRich && !["Fleisch", "Fisch", "Meeresfrucht"].includes(food.category),
  );
  state.overrides["2026-09-22|lunch"] = "zucchini";
  state.overrides["2026-09-22|dinner"] = "apfel";

  const day = context.__buildDays("2026-09-22", 1, false)[0];
  const lunch = day.meals.find((meal) => meal.meal === "lunch");
  const dinner = day.meals.find((meal) => meal.meal === "dinner");
  const lunchComponents = lunch.foodIds.filter((id) => id !== lunch.focusId);

  assert.equal(lunch.focusId, "zucchini");
  assert.equal(dinner.focusId, "apfel");
  assert.ok(lunchComponents.length > 0, "Mittagessen muss im Fixture einen Begleiter haben");
  assert.equal(
    lunchComponents.some((id) => dinner.foodIds.includes(id)),
    false,
    "der Abend darf keinen Mittagsbegleiter wiederverwenden, wenn bekannte Alternativen verfügbar sind",
  );
});

test("reiner Tracking-Snapshot blockiert die Rotation der übrigen Tagesslots nicht", () => {
  const { context, state } = loadPlanner();
  state.foods = state.foods.filter((item) =>
    !item.ironRich && !["Fleisch", "Fisch", "Meeresfrucht"].includes(item.category),
  );
  state.overrides["2026-09-22|lunch"] = "zucchini";
  state.overrides["2026-09-22|dinner"] = "apfel";
  state.planLocks["2026-09-22|lunch"] = {
    mode: "auto", plannerTrackingSnapshot: true, focusId: "zucchini",
    foodIds: ["zucchini", "polenta"], baseFoodIds: ["polenta"],
  };
  const originalLockedMeal = context.lockedMeal;
  context.lockedMeal = (date, meal) => state.planLocks[`${date}|${meal}`]?.plannerTrackingSnapshot
    ? null : originalLockedMeal(date, meal);

  const day = context.__buildDays("2026-09-22", 1, false)[0];
  const lunch = day.meals.find((meal) => meal.meal === "lunch");
  const dinner = day.meals.find((meal) => meal.meal === "dinner");
  assert.ok(lunch.foodIds.length > 1);
  assert.equal(lunch.foodIds.some((id) => dinner.foodIds.includes(id)), false);
});

test("bekanntes geeignetes Rezept wird vor freiem Paar gewählt und mit allen Zutaten geplant", () => {
  const { context, state } = loadPlanner();
  vm.runInContext(read("js/planner-recipe-first.js"), context);
  context.recipeStates = () => [{
    name: "Test-Huhn-Zucchini-Hafer", category: "family",
    requires: ["Huhn", "Zucchini", "Hafer"], unlocked: true,
    ingredientMissing: [], requirementMissing: [],
  }];
  context.recipeIngredientReady = (name) => ["Huhn", "Zucchini", "Hafer"].includes(name);
  state.deferred["2026-09-22"] = true;

  const day = context.__buildDays("2026-09-22", 1, false)[0];
  const lunch = day.meals.find((meal) => meal.meal === "lunch");
  const dinner = day.meals.find((meal) => meal.meal === "dinner");
  assert.equal(lunch.recipeName, "Test-Huhn-Zucchini-Hafer");
  assert.deepEqual(clone(lunch.foodIds).sort(), ["hafer", "huhn", "zucchini"]);
  assert.notEqual(dinner.recipeName, lunch.recipeName, "dasselbe Rezept nicht zweimal am Tag");
});

test("freie bekannte Mahlzeit darf eine dritte passende Zutat erhalten, ohne neue FOODS einzuführen", () => {
  const { context, state } = loadPlanner();
  vm.runInContext(read("js/planner-culinary-quality.js"), context);
  state.deferred["2026-09-22"] = true;
  const ctx = vm.runInContext("freshPlanContext()", context);
  const result = context.enrichKnownFreeMeal({
    meal: "lunch", active: true, focusId: "polenta", foodIds: ["polenta", "zucchini"],
    baseFoodIds: ["zucchini"], sampleFoodIds: [],
  }, "2026-09-22", ctx);
  assert.equal(result.foodIds.length, 3);
  assert.deepEqual(clone(result.sampleFoodIds), []);
  assert.ok(result.foodIds.every((id) => state.logs.some((log) => log.foodIds.includes(id))));
  assert.equal(result.portionTargetGrams, context.phasePortion());
});

test("Rezeptvorrat überspringt Stufe nur für ausdrücklich glatt pürierte und freigegebene Charge", () => {
  const { context, state } = loadPlanner();
  const recipe = {
    name: "Test-Chili", smoothBatchAllowed: true, category: "family",
    requires: ["Zucchini", "Hafer"], stage: 4, unlocked: false,
    ingredientMissing: [], requirementMissing: ["Darreichungsform: aktuell noch nicht passend"],
  };
  const batch = { id: "smooth-batch", kind: "recipe", recipeName: recipe.name, foodIds: ["zucchini", "hafer"], portions: 2, frozenDate: "2026-09-20", preparationMode: "spoon-smooth" };
  state.inventory.push(batch);
  state.settings.preferInventoryInPlan = true;
  state.settings.birthDate = "2026-01-24";
  assert.equal(context.plannerSmoothRecipeBatch(recipe, batch, "2026-09-22"), true);
  assert.equal(context.plannerRecipeBatchFor(recipe, "2026-09-22", { recipeReserved: new Map() })?.id, batch.id);
  batch.preparationMode = "";
  assert.equal(context.plannerRecipeBatchFor(recipe, "2026-09-22", { recipeReserved: new Map() }), null);
  batch.preparationMode = "spoon-smooth";
  assert.equal(context.plannerSmoothRecipeBatch({ ...recipe, hardMinMonths: 24 }, batch, "2026-09-22"), false);
  assert.equal(context.plannerSmoothRecipeBatch({ ...recipe, ingredientMissing: ["Tomate"] }, batch, "2026-09-22"), false);
  assert.equal(context.plannerSmoothRecipeBatch({ ...recipe, smoothBatchAllowed: false }, batch, "2026-09-22"), false);
});

test("glatt pürierte Vorratscharge bleibt als konkrete Darreichungsform im Plan erkennbar", () => {
  const { context, state } = loadPlanner();
  vm.runInContext(read("js/handling-readiness.js"), context);
  context.recipeByName = () => ({ name: "Test-Chili", smoothBatchAllowed: true });
  state.inventory.push({ id: "smooth", kind: "recipe", recipeName: "Test-Chili", portions: 2, preparationMode: "spoon-smooth" });
  const meal = { meal: "lunch", active: true, foodIds: ["zucchini", "hafer"], sampleFoodIds: [], recipeName: "Test-Chili", recipeInventoryId: "smooth", preparationMode: "spoon-smooth" };
  assert.equal(context.presentationModeForMeal(meal, { textureStage: 2 }), "spoon-smooth");
  state.inventory[0].preparationMode = "";
  assert.notEqual(context.presentationModeForMeal(meal, { textureStage: 2 }), "spoon-smooth");
});
