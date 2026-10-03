"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const planningSource = fs.readFileSync(
  path.join(__dirname, "..", "js", "planning.js"),
  "utf8",
);

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function plannerContext() {
  const startDate = "2026-09-22";
  const foods = [
    { id: "kartoffel", name: "Kartoffel", category: "Wurzel/Knolle", active: true, meals: ["lunch", "dinner"], priority: 1 },
    { id: "zucchini", name: "Zucchini", category: "Gemüse", active: true, meals: ["lunch", "dinner"], priority: 2 },
  ];
  const state = {
    foods,
    logs: [],
    inventory: [],
    overrides: {},
    deferred: {},
    planLocks: {},
    manualMeals: Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [
        `${addDays(startDate, index)}|breakfast`,
        {
          mode: "auto",
          focusId: "kartoffel",
          foodIds: ["kartoffel"],
          manualAdded: false,
        },
      ]),
    ),
    settings: {
      startDate,
      phaseSelected: "aufbau",
      newFoodEvery: 2,
      preferInventoryInPlan: false,
      amountSelected: "taste",
    },
  };
  const context = {
    state,
    clone: (value) => JSON.parse(JSON.stringify(value)),
    addDays,
    today: () => startDate,
    diffDays: (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000),
    phaseMealKeys: () => ["lunch", "dinner"],
    food: (id) => foods.find((item) => item.id === id) || null,
    rank: () => 2,
    status: () => "Verträgliche Basis",
    outcomeForFood: () => "not_offered",
    isFoodUnavailable: () => false,
    eligible: (item, meal) => !!item?.active && item.meals.includes(meal),
    automaticFoodEligibility: () => true,
    plannerFoodCanBeAutomaticFocus: () => true,
    plannerFoodCanBeBase: () => true,
    effectivePriority: (item) => item.priority,
    usageCount: () => 0,
    lastOutcome: () => "",
    lastDate: () => "",
    inventoryPortions: () => 0,
    recipeStockCandidate: () => null,
    recipeSuitableForMeal: () => false,
    snackRecipeCandidate: () => null,
    applyRecipeFoodComposition: (meal) => meal,
    reserveMealInventory: (meal) => meal,
    mealMilkLevel: () => "",
    mealContainsMilkProduct: () => false,
    isMilkProductFood: () => false,
    isMeatOrFish: () => false,
    isStarchyFood: () => false,
    ironCompanion: () => null,
    combinationPaused: () => false,
    enforceSingleStarch: (_focus, companions) => companions,
    currentAmountLevel: () => "taste",
    AMOUNT_LEVELS: { taste: { rank: 0 } },
    phasePortion: () => 25,
    applyPlannedMealAmounts: (meal) => meal,
    foodRolesFor: () => ({}),
  };
  vm.createContext(context);
  vm.runInContext(`${planningSource}\nthis.__buildDays = buildDays;`, context);
  context.introductionCandidate = () => null;
  context.knownCandidate = (meal) => ({ f: foods.find((item) => item.meals.includes(meal)), type: "bekannt" });
  context.companionFor = () => null;
  return { context, state, startDate };
}

test("Aufbau-Wochenplanung reaktiviert alte oder automatische Frühstücksmetadaten nicht", () => {
  const { context, startDate } = plannerContext();
  const days = context.__buildDays(startDate, 7, false);

  assert.equal(days.length, 7);
  for (const day of days) {
    assert.equal(
      JSON.stringify(Array.from(day.meals.filter((meal) => meal.active).map((meal) => meal.meal))),
      JSON.stringify(["lunch", "dinner"]),
      `${day.date} darf in Phase aufbau kein automatisches Frühstück enthalten`,
    );
  }
});

test("eine ausdrücklich manuell hinzugefügte Mahlzeit darf einen inaktiven Slot behalten", () => {
  const { context, state, startDate } = plannerContext();
  state.manualMeals[`${startDate}|breakfast`].manualAdded = true;
  const day = context.__buildDays(startDate, 1, false)[0];

  assert.equal(day.meals.find((meal) => meal.meal === "breakfast")?.active, true);
});
