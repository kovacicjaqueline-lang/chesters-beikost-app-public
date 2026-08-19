"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const planningSource = fs.readFileSync(path.join(root, "js", "planning.js"), "utf8");
const milkPolicySource = fs.readFileSync(path.join(root, "js", "planner-milk-policy.js"), "utf8");

function makeFood(id, name, category, extra = {}) {
  return {
    id,
    name,
    category,
    meals: ["lunch", "dinner"],
    active: true,
    allergenGroup: "",
    priority: 10,
    ...extra,
  };
}

function createPlannerContext(foods) {
  const state = { foods, logs: [], settings: {} };
  const context = {
    state,
    status: () => "Regelmäßig",
    rank: () => 3,
    outcomeForFood: () => "eaten",
    food: (id) => state.foods.find((item) => item.id === id) || null,
    today: () => "2026-08-18",
  };
  vm.createContext(context);
  vm.runInContext(planningSource, context);
  context.state = state;
  context.status = () => "Regelmäßig";
  context.rank = () => 3;
  context.outcomeForFood = () => "eaten";
  context.food = (id) => state.foods.find((item) => item.id === id) || null;
  context.eligible = (item, meal, on) => context.eligibleCore(item, meal, on);
  return context;
}

function companionForWithPolicy(focus, foods) {
  const context = createPlannerContext(foods);
  vm.runInContext(`${milkPolicySource}\nthis.__installMilkPolicy = installPlannerMilkPolicyRuntime;`, context);
  assert.equal(context.__installMilkPolicy(), true);
  return context.companionFor(focus, "lunch", "2026-08-18", "bekannt");
}

function scheduledBaseWithPolicy(focus, foods) {
  const context = createPlannerContext(foods);
  vm.runInContext(`
    scheduleAllergen = function(foodId, date, requestedMeal = "lunch") {
      let f = food(foodId);
      let mealCandidates = [...new Set([requestedMeal, "lunch", "breakfast", "dinner"])]
        .filter((meal) => f.meals.includes(meal));
      let selection = mealCandidates
        .map((meal) => ({ meal, base: knownBase(meal, [f.id]) }))
        .find((item) => item.base);
      return selection?.base?.id || null;
    };
  `, context);
  vm.runInContext(`${milkPolicySource}\nthis.__installMilkPolicy = installPlannerMilkPolicyRuntime;`, context);
  assert.equal(context.__installMilkPolicy(), true);
  return context.scheduleAllergen(focus.id, "2026-08-19", "lunch");
}

test("MILK-01 adversarial: Milch-Allergenfokus darf knownBase nicht mit Fleisch umgehen", () => {
  const yoghurt = makeFood("naturjoghurt", "Naturjoghurt", "Milchprodukt", { allergenGroup: "Milch" });
  const beef = makeFood("rind", "Rind", "Fleisch");
  const result = companionForWithPolicy(yoghurt, [yoghurt, beef]);
  assert.equal(result, null);
});

test("MILK-01 adversarial: Fisch-Allergenfokus darf knownBase nicht mit voller Milchbasis umgehen", () => {
  const salmon = makeFood("lachs", "Lachs", "Fisch", { allergenGroup: "Fisch" });
  const yoghurt = makeFood("naturjoghurt", "Naturjoghurt", "Milchprodukt");
  const result = companionForWithPolicy(salmon, [salmon, yoghurt]);
  assert.equal(result, null);
});

test("MILK-01 adversarial: manuelles Milch-Allergen-Einplanen nutzt keine Fleischbasis", () => {
  const yoghurt = makeFood("naturjoghurt", "Naturjoghurt", "Milchprodukt", { allergenGroup: "Milch" });
  const beef = makeFood("rind", "Rind", "Fleisch");
  assert.equal(scheduledBaseWithPolicy(yoghurt, [yoghurt, beef]), null);
});

test("MILK-01 adversarial: manuelles Fisch-Allergen-Einplanen nutzt keine Milchbasis", () => {
  const salmon = makeFood("lachs", "Lachs", "Fisch", { allergenGroup: "Fisch" });
  const yoghurt = makeFood("naturjoghurt", "Naturjoghurt", "Milchprodukt");
  assert.equal(scheduledBaseWithPolicy(salmon, [salmon, yoghurt]), null);
});
