"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const handling = require("../js/handling-readiness.js");
const recipeFirst = require("../js/planner-recipe-first.js");
const proactive = require("../js/planner-proactive-recipe.js");
const mealEligibility = require("../js/planner-meal-eligibility.js");
const {
  FOOD_HANDLING_CONTRACT,
  RECIPE_HANDLING_CONTRACT,
} = require("../data/food-handling.js");

const root = path.resolve(__dirname, "..");
const handlingContractSource = fs.readFileSync(path.join(root, "data", "food-handling.js"), "utf8");
const handlingSource = fs.readFileSync(path.join(root, "js", "handling-readiness.js"), "utf8");

function canonicalData() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "data", "foods.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "data", "recipes.js"), "utf8"), context);
  return {
    foods: vm.runInContext("FOOD_DB", context),
    recipes: vm.runInContext("RECIPES", context),
  };
}

function rindMeal(extra = {}) {
  return {
    meal: "lunch",
    active: true,
    focusId: "rind",
    foodIds: ["rind", "hafer", "ei"],
    baseFoodIds: ["hafer"],
    sampleFoodIds: [],
    foodRoles: { rind: "component", hafer: "base", ei: "component" },
    recipeName: "Rind-Hafer-Bällchen",
    type: "Rezept",
    ...extra,
  };
}

test("Rind-Hafer Integration: PLAN-08 erkennt Rind + Hafer + Ei als exakte Rezeptvariante zum Mittag", () => {
  const { foods, recipes } = canonicalData();
  const recipe = recipes.find((item) => item.name === "Rind-Hafer-Bällchen");
  assert.ok(recipe);
  const byName = new Map(foods.map((item) => [item.name, item]));
  const suitableForMeal = (candidate, meal) =>
    (candidate.requires || []).every((name) =>
      mealEligibility.plannerFoodMealEligible(byName.get(name), meal.meal),
    );

  const candidates = recipeFirst.plannerExactRecipeCandidates(
    ["rind", "hafer", "ei"],
    { meal: "lunch" },
    [recipe],
    foods,
    suitableForMeal,
    () => true,
    () => true,
  );
  assert.deepEqual(candidates.map((item) => item.name), ["Rind-Hafer-Bällchen"]);
});

test("Rind-Hafer Integration: Rind-Gate verhindert dieselbe Rezeptkombination zum Frühstück", () => {
  const { foods, recipes } = canonicalData();
  const recipe = recipes.find((item) => item.name === "Rind-Hafer-Bällchen");
  const rind = foods.find((item) => item.id === "rind");
  assert.ok(recipe);
  assert.ok(rind);
  assert.equal(mealEligibility.plannerFoodMealEligible(rind, "breakfast"), false);
  assert.equal(mealEligibility.plannerFoodMealEligible(rind, "lunch"), true);

  const byName = new Map(foods.map((item) => [item.name, item]));
  const suitableForMeal = (candidate, meal) =>
    (candidate.requires || []).every((name) =>
      mealEligibility.plannerFoodMealEligible(byName.get(name), meal.meal),
    );
  const candidates = recipeFirst.plannerExactRecipeCandidates(
    ["rind", "hafer", "ei"],
    { meal: "breakfast" },
    [recipe],
    foods,
    suitableForMeal,
    () => true,
    () => true,
  );
  assert.deepEqual(candidates, []);
});

test("Rind-Hafer Integration: genau eine geplante Rind-Kostprobe darf Recipe-first bleiben", () => {
  const { foods, recipes } = canonicalData();
  const recipe = recipes.find((item) => item.name === "Rind-Hafer-Bällchen");
  assert.ok(recipe);
  const meal = rindMeal({
    recipeName: "",
    type: "neu",
    sampleFoodIds: ["rind"],
    foodRoles: { rind: "sample", hafer: "base", ei: "component" },
  });

  const candidates = proactive.plannerProactiveRecipeCandidates(
    meal,
    [recipe],
    foods,
    () => true,
    (name) => name !== "Rind",
    () => true,
    () => true,
    "2026-08-19",
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].recipe.name, "Rind-Hafer-Bällchen");
  assert.equal(candidates[0].sampleFoodId, "rind");
  assert.deepEqual(Array.from(candidates[0].addedIds), []);
});

test("Rind-Hafer Integration: presentationMode ist additiv und spoon erfindet keine Löffelform", () => {
  const fresh = rindMeal();
  const result = handling.applyPresentationModeToAutomaticMeal(
    fresh,
    { textureStage: 1, feedingApproach: "spoon" },
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  );
  assert.equal(result.presentationMode, "finger-graspable");
  assert.equal(result.recipeName, "Rind-Hafer-Bällchen");
  assert.deepEqual(result.foodIds, ["rind", "hafer", "ei"]);
  assert.deepEqual(result.foodRoles, { rind: "component", hafer: "base", ei: "component" });
});

test("Rind-Hafer Integration: bestehende Auto-/Manual-/historische Locks werden nicht nachträglich umgedeutet", () => {
  for (const extra of [
    { lockedMode: "auto" },
    { lockedMode: "manual" },
    { manualAdded: true },
  ]) {
    const meal = rindMeal(extra);
    handling.applyPresentationModeToAutomaticMeal(
      meal,
      { textureStage: 3, feedingApproach: "fingerfood" },
      FOOD_HANDLING_CONTRACT,
      RECIPE_HANDLING_CONTRACT,
    );
    assert.equal(Object.hasOwn(meal, "presentationMode"), false);
    assert.equal(meal.recipeName, "Rind-Hafer-Bällchen");
  }
});

test("Rind-Hafer Integration: Alters-/Planner-Gates bleiben neben der migrierten Konsistenzsperre hart", () => {
  const merged = handling.mergeRecipeHandlingState(
    {
      name: "Rind-Hafer-Bällchen",
      ingredientMissing: [],
      requirementMissing: ["Alter: noch nicht erreicht", "Konsistenz: weich-stückig"],
      missing: ["Alter: noch nicht erreicht", "Konsistenz: weich-stückig"],
      unlocked: false,
    },
    { textureStage: 1, feedingApproach: "fingerfood" },
    RECIPE_HANDLING_CONTRACT,
  );
  assert.deepEqual(merged.requirementMissing, ["Alter: noch nicht erreicht"]);
  assert.deepEqual(merged.missing, ["Alter: noch nicht erreicht"]);
  assert.equal(merged.unlocked, false);
});

test("Rind-Hafer Integration: Steuerlogik bleibt unabhängig von safeForm-/Recipe-note-Freitext", () => {
  const eligibility = handling.recipeHandlingEligibility(
    {
      name: "Rind-Hafer-Bällchen",
      note: "Beliebiger Freitext, der fälschlich Löffelkost behauptet.",
      safeForm: "Beliebiger Freitext.",
    },
    { textureStage: 1, feedingApproach: "mixed" },
    RECIPE_HANDLING_CONTRACT,
  );
  assert.deepEqual(eligibility.eligibleModes, ["finger-graspable"]);
  assert.equal(FOOD_HANDLING_CONTRACT.rind, undefined);
  assert.doesNotMatch(handlingContractSource, /applyReviewedRindHaferCopy|REVIEWED_RIND_SAFE_FORM|REVIEWED_RIND_HAFER_RECIPE_COPY/);
  assert.doesNotMatch(handlingContractSource, /state\.foods|Object\.assign\(recipe|FOOD_DB\.find/);
  assert.doesNotMatch(handlingSource, /presentationMode\s*=\s*[^;\n]*textureStage/);
});
