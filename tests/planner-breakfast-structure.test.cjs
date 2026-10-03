"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { plannerRecipeSuitableForMeal } = require("../app.js");

const planningSource = fs.readFileSync(
  path.join(__dirname, "..", "js", "planning.js"),
  "utf8",
);

function plannerContext({ override = "", trustedBase = false } = {}) {
  const date = "2026-09-21";
  const foods = [
    { id: "banane", name: "Banane", category: "Obst", priority: 1, active: true, allergenGroup: "", meals: ["breakfast"] },
    { id: "hafer", name: "Hafer", category: "Getreide/Stärke", priority: 2, active: true, allergenGroup: "", meals: ["breakfast"] },
    { id: "apfel", name: "Apfel", category: "Obst", priority: 3, active: true, allergenGroup: "", meals: ["breakfast"] },
  ];
  const state = {
    foods,
    logs: [],
    inventory: [],
    overrides: override ? { [`${date}|breakfast`]: override } : {},
    deferred: {},
    planLocks: {},
    manualMeals: {},
    settings: {
      preferInventoryInPlan: false,
      newFoodEvery: 2,
      amountSelected: "taste",
      startDate: date,
      phaseSelected: "aufbau",
    },
  };
  const context = {
    console,
    state,
    rank: () => 0,
    status: (food) => trustedBase && food?.id === "hafer" ? "Verträgliche Basis" : "Offen",
    outcomeForFood: () => "not_offered",
    today: () => date,
    diffDays: () => 1,
    food: (id) => foods.find((item) => item.id === id) || null,
    foodByName: (name, pool) => (pool || foods).find((item) => item.name === name) || null,
    eligible: (food) => !!food?.active && food.meals.includes("breakfast"),
    activeMeal: (meal) => meal === "breakfast",
    phaseMealKeys: () => ["breakfast"],
    isFoodUnavailable: () => false,
    dueAllergen: () => false,
    lastOutcome: () => "",
    lastDate: () => "",
    effectivePriority: (food) => food.priority,
    inventoryPortions: () => 0,
    recipeStockCandidate: () => null,
    recipeSuitableForMeal: () => false,
    applyRecipeFoodComposition: (meal) => meal,
    reserveMealInventory: (meal) => meal,
    mealMilkLevel: () => "",
    isMilkProductFood: () => false,
    isMeatOrFish: () => false,
    mealContainsMilkProduct: () => false,
    isStarchyFood: (food) => food?.category === "Getreide/Stärke",
    ironCompanion: () => null,
    combinationPaused: () => false,
    enforceSingleStarch: (_focus, companions) => companions,
    currentAmountLevel: () => "taste",
    AMOUNT_LEVELS: { taste: { rank: 0 } },
    phasePortion: () => 25,
    applyPlannedMealAmounts: (meal) => meal,
    manualMealFor: () => null,
    lockedMeal: () => null,
    plannerFoodCanBeBase: (food) => food?.id !== "haferdrink",
    plannerFoodCanBeAutomaticFocus: () => true,
    normalizeName: (value) => String(value || "").toLowerCase(),
  };
  vm.createContext(context);
  vm.runInContext(`${planningSource}\nthis.__buildDay = buildDay; this.__freshPlanContext = freshPlanContext;`, context);
  return { context, state, date };
}

test("Frühstücksrezepte mit echter Basis sind geeignet, reine Obstrezepte nicht", () => {
  assert.equal(
    plannerRecipeSuitableForMeal({ category: "porridge", requires: ["Hafer"], oneOf: ["Banane"] }, "breakfast"),
    true,
  );
  assert.equal(
    plannerRecipeSuitableForMeal({ category: "porridge", requires: ["Apfel", "Birne"] }, "breakfast"),
    false,
  );
});

test("Automatisches Frühstück führt bei fehlender Basis zuerst Getreide ein", () => {
  const { context, date } = plannerContext();
  const day = context.__buildDay(date, 0, context.__freshPlanContext());
  const breakfast = day.meals.find((meal) => meal.meal === "breakfast");

  assert.ok(breakfast);
  assert.deepEqual(Array.from(breakfast.foodIds), ["hafer"]);
  assert.deepEqual(Array.from(breakfast.sampleFoodIds), ["hafer"]);
  assert.match(breakfast.note, /Frühstücksbasis zuerst/);
});

test("Explizite Obst-Kostprobe bleibt als bewusster Override erlaubt", () => {
  const { context, date } = plannerContext({ override: "banane" });
  const day = context.__buildDay(date, 0, context.__freshPlanContext());
  const breakfast = day.meals.find((meal) => meal.meal === "breakfast");

  assert.ok(breakfast);
  assert.deepEqual(Array.from(breakfast.foodIds), ["banane"]);
  assert.deepEqual(Array.from(breakfast.sampleFoodIds), ["banane"]);
});
