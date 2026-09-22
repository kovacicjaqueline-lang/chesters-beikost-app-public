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
  assert.ok(activeMeals.filter((meal) => meal.focusId === "brombeere").length <= 2, "Brombeere darf bei gleich geeigneten Alternativen nicht fast jede Mahlzeit dominieren");
  assert.ok(activeMeals.some((meal) => meal.foodIds.some((id) => state.foods.find((food) => food.id === id)?.ironRich)), "die Woche muss die modellierte Eisenregel sichtbar bedienen");
  for (const meal of activeMeals) {
    const items = meal.foodIds.map((id) => state.foods.find((food) => food.id === id)).filter(Boolean);
    assert.equal(items.some((food) => food.category === "Milchprodukt") && items.some((food) => ["Fleisch", "Fisch", "Meeresfrucht"].includes(food.category)), false, "Milch und Fleisch/Fisch dürfen nicht in derselben Mahlzeit kombiniert werden");
  }
  assert.equal(state.logs.length, 32);
});
