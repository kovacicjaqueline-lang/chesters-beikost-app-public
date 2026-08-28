"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const policy = require("../js/planner-food-role-stability.js");
const proactive = require("../js/planner-proactive-recipe.js");
const recipeComponents = require("../js/recipe-v2-component-options.js");

function makeFood(id, category, extra = {}) {
  return {
    id,
    name: id,
    category,
    active: true,
    meals: ["breakfast", "lunch", "dinner"],
    priority: 1,
    ...extra,
  };
}

test("Review: Nuss/Samen sind am zentralen Auto-Focus-Gate gesperrt", () => {
  const source = fs.readFileSync(path.join(root, "js", "planner-food-role-stability.js"), "utf8");
  const foods = [makeFood("erdnuss", "Nuss"), makeFood("apfel", "Obst")];
  const context = {
    state: { foods, overrides: {}, planLocks: {} },
    buildDay: () => ({ meals: [] }),
    lockedMeal: () => null,
    manualMealRoleInfo: () => ({ role: "base" }),
    manualMealRoleState: () => null,
    compactMealRolesHtml: () => "",
    food: (id) => foods.find((item) => item.id === id),
    esc: String,
    plannerFoodCanBeBase: () => true,
    plannerFoodCanBeAutomaticFocus: () => true,
    plannerAutomaticLockRoleViolation: () => false,
    introductionCandidate: () => null,
    knownCandidate: () => null,
    chooseFocus: () => null,
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__install = installPlannerFoodRoleStabilityRuntime;`, context);
  assert.equal(context.__install(), true);
  assert.equal(context.plannerFoodCanBeAutomaticFocus(context.food("erdnuss")), false);
  assert.equal(context.plannerFoodCanBeAutomaticFocus(context.food("apfel")), true);
});

test("Review: Topping-Vorrat wird genau einmal im FOOD-Reservierungskontext reserviert", () => {
  const meal = { inventoryFoodIds: ["hafer"] };
  const ctx = { inventoryReserved: new Map([["hafer", 1]]) };
  const portions = (id) => id === "erdnussmus" ? 1 : 0;

  policy.plannerReserveNutSeedSampleInventory(meal, "erdnussmus", ctx, true, portions);
  assert.deepEqual(meal.inventoryFoodIds, ["hafer", "erdnussmus"]);
  assert.equal(ctx.inventoryReserved.get("erdnussmus"), 1);

  policy.plannerReserveNutSeedSampleInventory(meal, "erdnussmus", ctx, true, portions);
  assert.deepEqual(meal.inventoryFoodIds, ["hafer", "erdnussmus"]);
  assert.equal(ctx.inventoryReserved.get("erdnussmus"), 1);
});

test("Review: Recipe-first-Topping-Promotion behält die Mus-Reservierung", () => {
  const source = fs.readFileSync(path.join(root, "js", "planner-food-role-stability.js"), "utf8");
  const foods = [
    makeFood("erdnussmus", "Nuss", { name: "Erdnussmus", foodFamily: "nuss:erdnuss", allergenFamily: "nuss:erdnuss" }),
    makeFood("hafer", "Getreide/Stärke", { name: "Hafer" }),
    makeFood("banane", "Obst", { name: "Banane" }),
  ];
  const byId = (id) => foods.find((item) => item.id === id);
  const recipe = { name: "Obst-Getreide-Brei", category: "porridge", requires: ["Hafer", "Banane"], milkMeal: "" };
  const plannerCtx = { inventoryReserved: new Map(), recipePlannedUse: new Map() };
  const context = {
    state: {
      foods,
      overrides: {},
      planLocks: {},
      settings: { preferInventoryInPlan: true },
    },
    food: byId,
    esc: String,
    foodHasRecipeComponentKind: recipeComponents.foodHasRecipeComponentKind,
    foodRecipeComponentForm: recipeComponents.foodRecipeComponentForm,
    plannerFoodCanBeBase: () => true,
    plannerFoodCanBeAutomaticFocus: () => true,
    plannerAutomaticLockRoleViolation: () => false,
    introductionCandidate: () => null,
    knownCandidate: () => null,
    chooseFocus: () => null,
    manualMealRoleInfo: (foodOrId) => {
      const item = typeof foodOrId === "string" ? byId(foodOrId) : foodOrId;
      return { food: item, role: item?.category === "Nuss" ? "component" : "base" };
    },
    manualMealRoleState: () => null,
    compactMealRolesHtml: () => "",
    lockedMeal: () => null,
    buildDay: () => ({
      meals: [{
        meal: "breakfast",
        active: true,
        focusId: "erdnussmus",
        foodIds: ["hafer", "erdnussmus"],
        baseFoodIds: ["hafer"],
        sampleFoodIds: ["erdnussmus"],
        foodRoles: { hafer: "base", erdnussmus: "sample" },
        inventoryFoodIds: ["erdnussmus"],
        recipeName: "",
        type: "Allergen wiederholen",
        note: "Allergen wiederholen.",
      }],
    }),
    recipeStates: () => [recipe],
    plannerRecipeSuitableForMeal: () => true,
    recipeIngredientReady: () => true,
    plannerProactiveRuntimeFoodEligible: () => true,
    plannerProactiveRecipeNameVariants: (item) => [item.requires || []],
    plannerProactiveRecipeRoleState: (_meal, candidate) => ({
      ids: [...candidate.ids],
      bases: [...candidate.ids],
      samples: [],
      components: [],
      foodRoles: Object.fromEntries(candidate.ids.map((id) => [id, "base"])),
    }),
    plannerSelectProactiveRecipe: (candidates) => candidates[0] || null,
    plannerApplyProactiveRecipeMeal: (meal, candidate, date, ctx, reserveFn, roleState) => {
      for (const id of meal.inventoryFoodIds || []) {
        const current = Number(ctx.inventoryReserved.get(id) || 0);
        if (current <= 1) ctx.inventoryReserved.delete(id);
        else ctx.inventoryReserved.set(id, current - 1);
      }
      meal.inventoryFoodIds = [];
      meal.foodIds = [...roleState.ids];
      meal.baseFoodIds = [...roleState.bases];
      meal.sampleFoodIds = [];
      meal.foodRoles = { ...roleState.foodRoles };
      meal.recipeName = candidate.recipe.name;
      reserveFn(meal, ctx);
      return meal;
    },
    reserveMealInventory: (meal, ctx) => {
      for (const id of meal.foodIds || []) {
        meal.inventoryFoodIds ||= [];
        if (!meal.inventoryFoodIds.includes(id)) meal.inventoryFoodIds.push(id);
        ctx.inventoryReserved.set(id, Number(ctx.inventoryReserved.get(id) || 0) + 1);
      }
      return meal;
    },
    inventoryPortions: (id) => id === "erdnussmus" ? 1 : 0,
    plannerRecipeMilkContextCompatible: () => true,
    recipeContainsMeatOrFish: () => false,
    applyPlannedMealAmounts: (meal) => meal,
  };
  plannerCtx.inventoryReserved.set("erdnussmus", 1);
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__install = installPlannerFoodRoleStabilityRuntime;`, context);
  assert.equal(context.__install(), true);

  const meal = context.buildDay("2026-08-19", 0, plannerCtx).meals[0];
  assert.equal(meal.recipeName, "Obst-Getreide-Brei");
  assert.ok(meal.inventoryFoodIds.includes("erdnussmus"));
  assert.equal(plannerCtx.inventoryReserved.get("erdnussmus"), 1);
});

test("Review: bekanntes Nuss-/Samen-FOOD bleibt als echte Rezeptkomponente zulässig", () => {
  const recipesSource = fs.readFileSync(path.join(root, "data", "recipes.js"), "utf8");
  const recipeContext = {};
  vm.createContext(recipeContext);
  vm.runInContext(`${recipesSource}\nthis.__recipes = RECIPES;`, recipeContext);
  const recipes = JSON.parse(JSON.stringify(recipeContext.__recipes));
  const recipe = recipes.find((item) => item.name === "Bananen-Haferbrei mit Erdnussmus");
  assert.ok(recipe, "reales Erdnussmus-Rezept muss im Katalog bleiben");
  assert.deepEqual(recipe.requires, ["Banane", "Hafer", "Erdnuss"]);

  const foods = [
    makeFood("banane", "Obst", { name: "Banane" }),
    makeFood("hafer", "Getreide/Stärke", { name: "Hafer" }),
    makeFood("erdnuss", "Nuss", { name: "Erdnuss", allergenGroup: "Erdnuss" }),
  ];
  const meal = {
    meal: "breakfast",
    active: true,
    foodIds: ["banane", "hafer"],
    baseFoodIds: ["banane", "hafer"],
    sampleFoodIds: [],
    foodRoles: { banane: "base", hafer: "base" },
  };

  const candidates = proactive.plannerProactiveRecipeCandidates(
    meal,
    [recipe],
    foods,
    () => true,
    () => true,
    () => true,
    () => true,
    "2026-08-19",
  );
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].addedIds, ["erdnuss"]);

  const roles = proactive.plannerProactiveRecipeRoleState(
    meal,
    candidates[0],
    "2026-08-19",
    (id) => ({ role: id === "erdnuss" ? "component" : "base" }),
  );
  assert.ok(roles);
  assert.equal(roles.foodRoles.erdnuss, "component");
  assert.deepEqual(roles.samples, []);
});
