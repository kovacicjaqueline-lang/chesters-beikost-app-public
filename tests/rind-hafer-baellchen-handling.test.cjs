"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const handling = require("../js/handling-readiness.js");

const root = path.resolve(__dirname, "..");
const foodsSource = fs.readFileSync(path.join(root, "data", "foods.js"), "utf8");
const recipesSource = fs.readFileSync(path.join(root, "data", "recipes.js"), "utf8");
const handlingContractSource = fs.readFileSync(path.join(root, "data", "food-handling.js"), "utf8");

function reviewedState() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(foodsSource, context);
  vm.runInContext(recipesSource, context);
  vm.runInContext(handlingContractSource, context);
  return {
    food: vm.runInContext('FOOD_DB.find((item) => item.id === "rind") || null', context),
    recipe: vm.runInContext('RECIPES.find((item) => item.name === "Rind-Hafer-Bällchen") || null', context),
    recipeContract: vm.runInContext('RECIPE_HANDLING_CONTRACT["Rind-Hafer-Bällchen"] || null', context),
    foodContract: vm.runInContext('FOOD_HANDLING_CONTRACT.rind || null', context),
  };
}

test("Rind-Hafer-Bällchen Review: Rind-Safe-Form enthält keine lineare spätere Fingerfood-Sperre mehr", () => {
  const { food } = reviewedState();
  assert.ok(food);
  assert.match(food.safeForm, /vollständig.*durchgaren/i);
  assert.doesNotMatch(food.safeForm, /später/i);
  assert.match(food.safeForm, /weich/i);
  assert.match(food.safeForm, /länglich|flach/i);
  assert.match(food.safeForm, /keine.*rund|nicht.*rund/i);
});

test("Rind-Hafer-Bällchen Review: kanonische Rezept-Copy ist bereits konkret genug", () => {
  const { recipe } = reviewedState();
  assert.ok(recipe);
  assert.equal(recipe.batch, "8–10 kleine weiche Stücke");
  assert.match(recipe.note, /vollständig.*durchgaren/i);
  assert.match(recipe.note, /länglich|flach/i);
  assert.match(recipe.note, /keine.*rund|nicht.*rund/i);
  assert.match(recipe.note, /keine.*hart|nicht.*hart/i);
  assert.match(recipe.skillRequirement, /zerdrück/i);
  assert.match(recipe.skillRequirement, /beaufsichtigt/i);
});

test("Rind-Hafer-Bällchen Review: nur das konkrete Rezept wird als finger-graspable migriert", () => {
  const { recipeContract, foodContract } = reviewedState();
  assert.ok(recipeContract);
  assert.deepEqual(Array.from(recipeContract.modes), ["finger-graspable"]);
  assert.equal(foodContract, null, "Rind als FOOD wird in diesem Einzelreview nicht pauschal migriert");
});

test("Rind-Hafer-Bällchen Review: textureStage 1 allein sperrt das konkretisierte Rezept nicht", () => {
  const { recipeContract } = reviewedState();
  const merged = handling.mergeRecipeHandlingState(
    {
      name: "Rind-Hafer-Bällchen",
      stage: 3,
      ingredientMissing: [],
      requirementMissing: ["Konsistenz: weich-stückig"],
      missing: ["Konsistenz: weich-stückig"],
      unlocked: false,
    },
    { textureStage: 1, feedingApproach: "mixed" },
    { "Rind-Hafer-Bällchen": recipeContract },
  );
  assert.equal(merged.handlingMigrated, true);
  assert.deepEqual(merged.requirementMissing, []);
  assert.equal(merged.unlocked, true);
  assert.deepEqual(merged.handlingModes, ["finger-graspable"]);
});

test("Rind-Hafer-Bällchen Review: fehlendes Ei bleibt eine harte Rezept-Sperre", () => {
  const { recipeContract } = reviewedState();
  const merged = handling.mergeRecipeHandlingState(
    {
      name: "Rind-Hafer-Bällchen",
      stage: 3,
      ingredientMissing: ["Ei"],
      requirementMissing: ["Konsistenz: weich-stückig"],
      missing: ["Ei", "Konsistenz: weich-stückig"],
      unlocked: false,
    },
    { textureStage: 1, feedingApproach: "fingerfood" },
    { "Rind-Hafer-Bällchen": recipeContract },
  );
  assert.equal(merged.handlingMigrated, true);
  assert.deepEqual(merged.ingredientMissing, ["Ei"]);
  assert.deepEqual(merged.missing, ["Ei"]);
  assert.equal(merged.unlocked, false);
});

test("Rind-Hafer-Bällchen Review: Handling-Contract verändert keine kanonischen FOOD-/Recipe-Daten", () => {
  assert.doesNotMatch(handlingContractSource, /applyReviewedRindHaferCopy/);
  assert.doesNotMatch(handlingContractSource, /REVIEWED_RIND_SAFE_FORM|REVIEWED_RIND_HAFER_RECIPE_COPY/);
  assert.doesNotMatch(handlingContractSource, /state\.foods|FOOD_DB\.find|Object\.assign\(recipe/);
});

test("Rind-Hafer-Bällchen Review: übrige SAFETY-REVIEW-Fälle bleiben unmigriert", () => {
  const contract = require(path.join(root, "data", "food-handling.js")).RECIPE_HANDLING_CONTRACT;
  for (const name of [
    "Geflügel-Gemüse-Hafer-Bällchen",
    "Lachs-Kartoffel-Bällchen",
    "Bangus-Kartoffel-Taler",
    "Eier-Finger",
    "Ei-Champignon-Cups",
    "Hummus mit weichen Gemüsesticks",
    "Fleisch-Gemüse-Bällchen",
  ]) {
    assert.equal(contract[name], undefined, name);
  }
});
