"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const handling = require("../js/handling-readiness.js");

const root = path.resolve(__dirname, "..");
const recipesSource = fs.readFileSync(path.join(root, "data", "recipes.js"), "utf8");
const recipeRuntimeSource = fs.readFileSync(path.join(root, "js", "recipes.js"), "utf8");
const handlingContractSource = fs.readFileSync(path.join(root, "data", "food-handling.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

function browserCatalog() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(recipesSource, context);
  vm.runInContext(recipeRuntimeSource, context);
  const recipeBeforeHandling = vm.runInContext(
    'RECIPES.find((item) => item.name === "Bananen-Ei-Pancakes") || null',
    context,
  );
  vm.runInContext(handlingContractSource, context);
  const contract = vm.runInContext(
    'RECIPE_HANDLING_CONTRACT["Bananen-Ei-Pancakes"] || null',
    context,
  );
  return { recipe: recipeBeforeHandling, contract };
}

test("Bananen-Ei-Pancakes: Rezeptkatalog ist vor app.js und damit vor ersten Auto-Locks vollständig", () => {
  const dataRecipes = indexSource.indexOf('src="data/recipes.js?v=');
  const recipeRuntime = indexSource.indexOf('src="js/recipes.js?v=');
  const appRuntime = indexSource.indexOf('src="app.js?v=');
  assert.ok(dataRecipes >= 0 && recipeRuntime > dataRecipes && appRuntime > recipeRuntime);
  assert.ok(browserCatalog().recipe, "Rezept muss bereits nach js/recipes.js vorhanden sein, nicht erst nach der späten Handling-Policy");
});

test("Bananen-Ei-Pancakes: eigenständiges Rezept ohne Pflicht-Hafer", () => {
  const { recipe } = browserCatalog();
  assert.ok(recipe, "eigenständige Rezeptkarte muss im Browserkatalog vorhanden sein");
  assert.equal(recipe.name, "Bananen-Ei-Pancakes");
  assert.equal(recipe.category, "pancakes");
  assert.deepEqual(Array.from(recipe.requires), ["Banane", "Ei"]);
  assert.equal(recipe.requires.includes("Hafer"), false);
  assert.equal(recipe.legacyNames?.includes("Obst-Hafer-Pancakes") || false, false);
  assert.match(recipe.note, /vollständig.*durchgaren|vollständig.*durchbacken/i);
  assert.match(recipe.note, /weich/i);
});

test("Bananen-Ei-Pancakes: expliziter Handling-Contract ist finger-graspable", () => {
  const { contract } = browserCatalog();
  assert.ok(contract);
  assert.deepEqual(Array.from(contract.modes), ["finger-graspable"]);
});

test("Bananen-Ei-Pancakes: frühe textureStage allein sperrt das migrierte Rezept nicht", () => {
  const { contract } = browserCatalog();
  const merged = handling.mergeRecipeHandlingState(
    {
      name: "Bananen-Ei-Pancakes",
      stage: 2,
      ingredientMissing: [],
      requirementMissing: ["Konsistenz: weich-zerdrückt"],
      missing: ["Konsistenz: weich-zerdrückt"],
      unlocked: false,
    },
    { textureStage: 1, feedingApproach: "mixed" },
    { "Bananen-Ei-Pancakes": contract },
  );
  assert.equal(merged.handlingMigrated, true);
  assert.deepEqual(merged.requirementMissing, []);
  assert.equal(merged.unlocked, true);
  assert.deepEqual(merged.handlingModes, ["finger-graspable"]);
});

test("Bananen-Ei-Pancakes: fehlendes Ei bleibt trotz Handling-Contract harte Sperre", () => {
  const { contract } = browserCatalog();
  const merged = handling.mergeRecipeHandlingState(
    {
      name: "Bananen-Ei-Pancakes",
      stage: 2,
      ingredientMissing: ["Ei"],
      requirementMissing: ["Konsistenz: weich-zerdrückt"],
      missing: ["Ei", "Konsistenz: weich-zerdrückt"],
      unlocked: false,
    },
    { textureStage: 1, feedingApproach: "fingerfood" },
    { "Bananen-Ei-Pancakes": contract },
  );
  assert.equal(merged.handlingMigrated, true);
  assert.deepEqual(merged.ingredientMissing, ["Ei"]);
  assert.deepEqual(merged.missing, ["Ei"]);
  assert.equal(merged.unlocked, false);
});

test("Bananen-Ei-Pancakes: spoon-Präferenz überschreibt die einzige sichere Rezeptform nicht", () => {
  const { contract } = browserCatalog();
  const mode = handling.presentationModeForMeal(
    {
      meal: "breakfast",
      active: true,
      focusId: "banane",
      foodIds: ["banane", "ei"],
      baseFoodIds: ["ei"],
      sampleFoodIds: [],
      recipeName: "Bananen-Ei-Pancakes",
    },
    { textureStage: 1, feedingApproach: "spoon" },
    {},
    { "Bananen-Ei-Pancakes": contract },
  );
  assert.equal(mode, "finger-graspable");
});
