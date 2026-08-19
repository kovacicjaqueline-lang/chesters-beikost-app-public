"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const planningSource = fs.readFileSync(
  path.resolve(__dirname, "..", "js", "planning.js"),
  "utf8",
);
const milkPolicySource = fs.readFileSync(
  path.resolve(__dirname, "..", "js", "planner-milk-policy.js"),
  "utf8",
);

function makeFood(id, name, category, meals, extra = {}) {
  return {
    id,
    name,
    category,
    meals: [...meals],
    active: true,
    allergenGroup: "",
    priority: 10,
    ...extra,
  };
}

function runtime({ foods, ranks, overrides, activeMeals, amountRank = 1, index = 1 }) {
  const date = "2026-08-18";
  const context = {};
  vm.createContext(context);
  vm.runInContext(planningSource, context);

  const state = {
    foods,
    logs: [],
    inventory: [],
    overrides: { ...overrides },
    deferred: {},
    planLocks: {},
    autoLockExcluded: {},
    manualMeals: {},
    followUps: {},
    settings: {
      newFoodEvery: 2,
      preferInventoryInPlan: false,
      startDate: "2026-08-01",
      phaseSelected: "aufbau",
      birthDate: "2026-01-24",
    },
  };

  context.state = state;
  context.rank = (food) => Number(ranks[food?.id] ?? 3);
  context.status = (food) => {
    const value = Number(ranks[food?.id] ?? 3);
    return value >= 3 ? "Regelmäßig" : value >= 2 ? "Verträgliche Basis" : value >= 1 ? "Probiert" : "Offen";
  };
  context.outcomeForFood = () => "eaten";
  context.today = () => date;
  context.food = (id) => state.foods.find((item) => item.id === id) || null;
  context.eligible = (food, meal, on) => context.eligibleCore(food, meal, on);
  context.activeMeal = (meal) => activeMeals.includes(meal);
  context.inventoryPortions = () => 0;
  context.recipeInventoryPortions = () => 0;
  context.oldestRecipeBatch = () => null;
  context.recipeStates = () => [];
  context.recipeByName = () => null;
  context.phasePortion = () => 50;
  context.AMOUNT_LEVELS = { test: { rank: amountRank } };
  context.currentAmountLevel = () => "test";
  context.applyPlannedMealAmounts = (meal) => meal;
  context.reserveMealInventory = (meal) => meal;

  vm.runInContext(
    `${milkPolicySource}\nthis.__installPlannerMilkPolicyRuntime = installPlannerMilkPolicyRuntime;`,
    context,
  );
  assert.equal(context.__installPlannerMilkPolicyRuntime(), true);

  const plannerContext = {
    reserved: new Set(),
    introduced: [],
    plannedUse: new Map(),
    lastFocus: new Map(),
    inventoryReserved: new Map(),
    recipeReserved: new Map(),
    recipePlannedUse: new Map(),
    fullMilkDates: new Set(),
  };

  return {
    state,
    context,
    date,
    buildDay: () => context.buildDay(date, index, plannerContext),
  };
}

function meal(day, name) {
  return day.meals.find((item) => item.meal === name);
}

function fullMilkMeals(day, context) {
  return day.meals.filter((item) => item.active && context.mealMilkLevel(item) === "full");
}

test("MILK-01: eine volle Milchmahlzeit verhindert eine zweite automatische volle Milchmahlzeit am selben Tag", () => {
  const yoghurt = makeFood("naturjoghurt", "Naturjoghurt", "Milchprodukt", ["breakfast", "lunch"]);
  const apple = makeFood("apfel", "Apfel", "Obst", ["breakfast", "lunch"]);
  const oil = makeFood("rapsoel", "Rapsöl", "Fett", ["lunch"]);
  const rt = runtime({
    foods: [yoghurt, apple, oil],
    ranks: { naturjoghurt: 3, apfel: 3, rapsoel: 3 },
    overrides: {
      "2026-08-18|breakfast": "naturjoghurt",
      "2026-08-18|lunch": "apfel",
    },
    activeMeals: ["breakfast", "lunch"],
  });

  const day = rt.buildDay();
  const breakfast = meal(day, "breakfast");
  const lunch = meal(day, "lunch");

  assert.equal(rt.context.mealMilkLevel(breakfast), "full");
  assert.equal(fullMilkMeals(day, rt.context).length, 1);
  assert.equal((lunch.foodIds || []).includes("naturjoghurt"), false, "Milchprodukt darf nach voller Milchmahlzeit nicht erneut als Begleiter hineinrutschen");
});

test("MILK-01: milkMeal small blockiert eine spätere volle Milchmahlzeit nicht", () => {
  const buttermilk = makeFood("buttermilch", "Buttermilch", "Milchprodukt", ["breakfast", "lunch"]);
  const yoghurt = makeFood("naturjoghurt", "Naturjoghurt", "Milchprodukt", ["lunch"]);
  const apple = makeFood("apfel", "Apfel", "Obst", ["breakfast", "lunch"]);
  const rt = runtime({
    foods: [buttermilk, yoghurt, apple],
    ranks: { buttermilch: 0, naturjoghurt: 3, apfel: 3 },
    overrides: {
      "2026-08-18|breakfast": "buttermilch",
      "2026-08-18|lunch": "naturjoghurt",
    },
    activeMeals: ["breakfast", "lunch"],
  });

  const day = rt.buildDay();
  assert.equal(rt.context.mealMilkLevel(meal(day, "breakfast")), "small");
  assert.equal(rt.context.mealMilkLevel(meal(day, "lunch")), "full");
  assert.equal(fullMilkMeals(day, rt.context).length, 1);
});

test("MILK-01: volle Milchmahlzeit wird automatisch nicht mit Fleisch oder Fisch kombiniert", () => {
  const yoghurt = makeFood("naturjoghurt", "Naturjoghurt", "Milchprodukt", ["lunch"]);
  const meat = makeFood("rind", "Rind", "Fleisch", ["lunch"]);
  const rt = runtime({
    foods: [yoghurt, meat],
    ranks: { naturjoghurt: 3, rind: 3 },
    overrides: { "2026-08-18|lunch": "naturjoghurt" },
    activeMeals: ["lunch"],
  });

  const lunch = meal(rt.buildDay(), "lunch");
  assert.equal(rt.context.mealMilkLevel(lunch), "full");
  assert.equal((lunch.foodIds || []).includes("rind"), false);
});

test("MILK-01: Rapsöl wird einer vollen Milchmahlzeit nicht automatisch ergänzt", () => {
  const yoghurt = makeFood("naturjoghurt", "Naturjoghurt", "Milchprodukt", ["lunch"]);
  const apple = makeFood("apfel", "Apfel", "Obst", ["lunch"]);
  const oil = makeFood("rapsoel", "Rapsöl", "Fett", ["lunch"]);
  const rt = runtime({
    foods: [yoghurt, apple, oil],
    ranks: { naturjoghurt: 3, apfel: 3, rapsoel: 3 },
    overrides: { "2026-08-18|lunch": "naturjoghurt" },
    activeMeals: ["lunch"],
    amountRank: 1,
  });

  const lunch = meal(rt.buildDay(), "lunch");
  assert.equal(rt.context.mealMilkLevel(lunch), "full");
  assert.equal((lunch.optionalAddons || []).includes("rapsoel"), false);
});
