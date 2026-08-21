"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appVersion = JSON.parse(fs.readFileSync(path.join(root, "VERSION.json"), "utf8")).version;
const recipeFirst = require("../js/planner-recipe-first.js");
const recipeFirstSource = fs.readFileSync(path.join(root, "js", "planner-recipe-first.js"), "utf8");
const ironSource = fs.readFileSync(path.join(root, "js", "planner-iron-preference.js"), "utf8");
const utilsSource = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");

test("PLAN-08 review: Recipe-first darf den bereits verwendeten Milch-Tageskontext nicht umklassifizieren", () => {
  assert.equal(
    recipeFirst.plannerRecipeMilkContextCompatible(
      { milkMeal: "full" },
      { milkMeal: "small" },
    ),
    false,
  );
  assert.equal(
    recipeFirst.plannerRecipeMilkContextCompatible(
      { milkMeal: "full" },
      { milkMeal: "full" },
    ),
    true,
  );
  assert.equal(
    recipeFirst.plannerRecipeMilkContextCompatible(
      { milkMeal: "" },
      { milkMeal: "" },
    ),
    true,
  );
});

test("PLAN-08 review: full FOOD-Milchmahlzeit wird nicht nachträglich zu small-Rezept promoviert", () => {
  const meal = {
    meal: "breakfast",
    active: true,
    focusId: "naturjoghurt",
    foodIds: ["naturjoghurt", "hafer"],
    baseFoodIds: ["hafer"],
    sampleFoodIds: [],
    inventoryFoodIds: [],
    recipeName: "",
    milkMeal: "full",
    type: "bekannt",
  };
  const recipe = {
    name: "Kleines Joghurt-Rezept",
    requires: ["Naturjoghurt", "Hafer"],
    requirementMissing: [],
    milkMeal: "small",
  };
  const context = {
    state: {
      foods: [
        { id: "naturjoghurt", name: "Naturjoghurt" },
        { id: "hafer", name: "Hafer" },
      ],
      settings: { preferInventoryInPlan: false },
    },
    buildDay: () => ({ date: "2026-08-18", meals: [JSON.parse(JSON.stringify(meal))] }),
    recipeStates: () => [recipe],
    plannerRecipeSuitableForMeal: () => true,
    recipeIngredientReady: () => true,
    recipeContainsMeatOrFish: () => false,
    recipeInventoryPortions: () => 0,
    reserveMealInventory: (plannedMeal) => plannedMeal,
  };
  vm.createContext(context);
  vm.runInContext(`${recipeFirstSource}\nthis.__install = installPlannerRecipeFirstRuntime;`, context);
  assert.equal(context.__install(), true);

  const ctx = {
    recipePlannedUse: new Map(),
    recipeReserved: new Map(),
    inventoryReserved: new Map(),
    fullMilkDates: new Set(["2026-08-18"]),
  };
  const planned = context.buildDay("2026-08-18", 0, ctx).meals[0];
  assert.equal(planned.recipeName, "");
  assert.equal(planned.milkMeal, "full");
  assert.equal(ctx.recipePlannedUse.size, 0);
  assert.equal(ctx.fullMilkDates.has("2026-08-18"), true);
});

function x1Context({ recipes = [] } = {}) {
  const foods = [
    { id: "banane", name: "Banane", category: "Obst", meals: ["lunch"], ironRich: false, sort: 0 },
    { id: "karotte", name: "Karotte", category: "Gemüse", meals: ["lunch"], ironRich: false, sort: 0 },
    { id: "rind", name: "Rind", category: "Fleisch", meals: ["lunch"], ironRich: true, sort: 20 },
  ];
  const context = {
    state: { foods },
    AMOUNT_LEVELS: { building: { rank: 1 } },
    currentAmountLevel: () => "building",
    isTrustedBase: () => true,
    isMilkProductFood: () => false,
    rank: () => 2,
    enforceSingleStarch: (_focus, companions) => companions || [],
    combinationPaused: () => false,
    recipeStates: () => recipes,
    plannerRecipeSuitableForMeal: () => true,
    companionFor: (focus, meal) => context.state.foods
      .filter((candidate) => candidate.id !== focus.id && candidate.meals.includes(meal))
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))[0] || null,
    ironCompanion: () => foods[2],
  };
  vm.createContext(context);
  vm.runInContext(`${ironSource}\nthis.__install = installPlannerIronPreferenceRuntime;`, context);
  assert.equal(context.__install(), true);
  return context;
}

test("PLAN-08 review: Banane + Karotte wird FOOD-only nicht als letzter automatischer Fallback erzwungen", () => {
  const context = x1Context({ recipes: [] });
  const banana = context.state.foods.find((food) => food.id === "banane");
  assert.equal(context.companionFor(banana, "lunch", "2026-08-18", "bekannt"), null);
  assert.equal(context.ironCompanion(), null);
});

test("PLAN-08 review: genau ein freigeschaltetes exaktes Rezept darf ein sonst schräges Paar legitimieren", () => {
  const context = x1Context({
    recipes: [
      {
        name: "Banane-Karotte-Rezept",
        requires: ["Banane", "Karotte"],
        unlocked: true,
        requirementMissing: [],
      },
    ],
  });
  const banana = context.state.foods.find((food) => food.id === "banane");
  assert.equal(context.companionFor(banana, "lunch", "2026-08-18", "bekannt")?.id, "karotte");
});

test("PLAN-08 review: erster sichtbarer Render erfolgt erst nach vollständiger Browser-Policy-Kette", () => {
  let domReady = null;
  let renders = 0;
  const appended = [];
  const body = { style: { visibility: "" } };
  const context = {
    console: { error: () => {} },
    renderAll: () => { renders += 1; },
    normalizeName: (value) => String(value || "").toLowerCase(),
  };
  context.window = context;
  context.window.addEventListener = (type, fn) => {
    if (type === "DOMContentLoaded") domReady = fn;
  };

  const document = {
    body,
    querySelector: () => null,
    createElement: () => ({
      src: "",
      dataset: {},
      listeners: {},
      addEventListener(type, fn) {
        (this.listeners[type] ||= []).push(fn);
      },
    }),
    head: {
      appendChild(script) {
        appended.push(script.src);
        if (script.src.includes("planner-meal-eligibility")) context.installPlannerMealEligibilityRuntime = () => true;
        if (script.src.includes("planner-milk-policy")) context.installPlannerMilkPolicyRuntime = () => true;
        if (script.src.includes("planner-iron-preference")) context.installPlannerIronPreferenceRuntime = () => true;
        if (script.src.includes("food-presentation")) context.FOOD_PRESENTATION_CONTRACT = {};
        if (script.src.includes("planner-meal-presentation")) context.installPlannerMealPresentationRuntime = () => true;
        if (script.src.includes("planner-recipe-first")) context.installPlannerRecipeFirstRuntime = () => true;
        if (script.src.includes("planner-proactive-recipe")) context.installPlannerProactiveRecipeRuntime = () => true;
        if (script.src.includes("planner-food-role-stability")) context.installPlannerFoodRoleStabilityRuntime = () => true;
        if (script.src.includes("planner-quality-rotation")) context.installPlannerQualityRotationRuntime = () => true;
        if (script.src.includes("food-handling")) {
          context.FOOD_HANDLING_CONTRACT = {};
          context.RECIPE_HANDLING_CONTRACT = {};
        }
        if (script.src.includes("handling-readiness")) context.installHandlingReadinessRuntime = () => true;
        for (const fn of script.listeners.load || []) fn();
      },
    },
  };
  context.document = document;

  vm.createContext(context);
  vm.runInContext(utilsSource, context);
  assert.equal(body.style.visibility, "hidden");
  assert.equal(renders, 0);
  assert.equal(context.__plannerPoliciesReady, false);
  assert.equal(typeof domReady, "function");

  domReady();

  assert.deepEqual(appended, [
    `js/planner-meal-eligibility.js?v=${appVersion}`,
    `js/planner-milk-policy.js?v=${appVersion}`,
    `js/planner-iron-preference.js?v=${appVersion}`,
    `data/food-presentation.js?v=${appVersion}`,
    `js/planner-meal-presentation.js?v=${appVersion}`,
    `js/planner-recipe-first.js?v=${appVersion}`,
    `js/planner-proactive-recipe.js?v=${appVersion}`,
    `js/planner-food-role-stability.js?v=${appVersion}`,
    `js/planner-quality-rotation.js?v=${appVersion}`,
    `data/food-handling.js?v=${appVersion}`,
    `js/handling-readiness.js?v=${appVersion}`,
  ]);
  assert.equal(context.__handlingReadinessReady, true);
  assert.equal(context.__plannerPoliciesReady, true);
  assert.equal(renders, 1);
  assert.equal(body.style.visibility, "");
});