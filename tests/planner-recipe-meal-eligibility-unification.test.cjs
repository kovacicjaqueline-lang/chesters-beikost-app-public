"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  plannerRecipeSuitableForMealCore,
  plannerRecipeBreakfastHasBaseCore,
} = require("../js/planner-meal-eligibility.js");
const {
  plannerRecipeSuitableForMeal,
  plannerFoodCanBeBase,
} = require("../app.js");

function loadRecipes() {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "data", "recipes.js"),
    "utf8",
  );
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__recipes = RECIPES;`, context);
  return context.__recipes;
}

test("zentrale Rezept-Eignung respektiert excludeMeals vor den übrigen Mahlzeitenregeln", () => {
  const chickenMuffins = loadRecipes().find(
    (recipe) => recipe.name === "Huhn-Gemüse-Muffins",
  );
  assert.ok(chickenMuffins);
  assert.deepEqual(Array.from(chickenMuffins.excludeMeals || []), ["breakfast"]);

  assert.equal(
    plannerRecipeSuitableForMealCore(chickenMuffins, "breakfast"),
    false,
  );
  assert.equal(plannerRecipeSuitableForMealCore(chickenMuffins, "snack"), true);
  assert.equal(plannerRecipeSuitableForMealCore(chickenMuffins, "lunch"), true);
});

test("zentrale Frühstücksbasis behält den bestehenden Base-Vertrag", () => {
  const foods = [
    { id: "hafer", name: "Hafer", category: "Getreide/Stärke" },
    { id: "haferdrink", name: "Haferdrink", category: "Getreide/Stärke", plannerRole: "component" },
    { id: "kuhmilch", name: "Kuhmilch", category: "Milchprodukt" },
    { id: "apfel", name: "Apfel", category: "Obst" },
  ];
  const canBeBase = (food) => food?.plannerRole !== "component";

  assert.equal(
    plannerRecipeBreakfastHasBaseCore(
      { category: "porridge", requires: ["Hafer", "Apfel"] },
      foods,
      canBeBase,
    ),
    true,
  );
  assert.equal(
    plannerRecipeBreakfastHasBaseCore(
      { category: "porridge", requires: ["Haferdrink", "Apfel"] },
      foods,
      canBeBase,
    ),
    false,
  );
  assert.equal(
    plannerRecipeBreakfastHasBaseCore(
      { category: "porridge", requires: ["Kuhmilch", "Apfel"] },
      foods,
      canBeBase,
    ),
    false,
  );
});

test("bestehender App-Pfad bleibt für alle kanonischen Rezepte semantisch identisch zum Core", () => {
  const meals = ["breakfast", "snack", "lunch", "dinner"];
  for (const recipe of loadRecipes()) {
    for (const meal of meals) {
      assert.equal(
        plannerRecipeSuitableForMealCore(
          recipe,
          meal,
          [],
          plannerFoodCanBeBase,
        ),
        plannerRecipeSuitableForMeal(recipe, meal),
        `${recipe.name} / ${meal}`,
      );
    }
  }
});

test("Runtime legt App- und Planner-Einstieg auf dieselbe zentrale Funktion", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "js", "planner-meal-eligibility.js"),
    "utf8",
  );
  const recipes = loadRecipes();
  const chickenMuffins = recipes.find(
    (recipe) => recipe.name === "Huhn-Gemüse-Muffins",
  );
  const context = {
    console,
    window: {},
    document: {},
    state: {
      foods: [
        { id: "hafer", name: "Hafer", category: "Getreide/Stärke" },
        { id: "apfel", name: "Apfel", category: "Obst" },
      ],
    },
    plannerFoodCanBeBase: () => true,
    recipeSuitableForMeal: () => true,
    plannerRecipeSuitableForMeal: () => true,
    plannerRecipeBreakfastHasBase: () => true,
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  assert.equal(
    context.recipeSuitableForMeal,
    context.plannerRecipeSuitableForMeal,
  );
  assert.equal(
    context.recipeSuitableForMeal(chickenMuffins, "breakfast"),
    false,
  );
  assert.equal(context.__plannerRecipeMealEligibilityCoreInstalled, true);
});

test("Haupt-App führt die zentrale Rezept-Eignung nach app.js tatsächlich aus", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
  const appScript = '<script src="app.js?v=10.1.26"></script>';
  const eligibilityScript = '<script src="js/planner-meal-eligibility.js?v=10.1.26"></script>';
  const appIndex = html.indexOf(appScript);
  const eligibilityIndex = html.indexOf(eligibilityScript);

  assert.ok(appIndex >= 0, "app.js muss im Haupt-Boot vorhanden sein");
  assert.ok(eligibilityIndex > appIndex, "zentrale Rezept-Eignung muss nach app.js ausgeführt werden");
});
