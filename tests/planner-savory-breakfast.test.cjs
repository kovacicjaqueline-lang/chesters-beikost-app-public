"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const {
  PLANNER_SAVORY_BREAKFAST_FOOD_IDS,
  plannerApplySavoryBreakfastMealAudit,
  plannerFoodMealEligible,
  plannerRecipeSuitableForMealCore,
} = require("../js/planner-meal-eligibility.js");

function loadGlobalConst(relativePath, expression) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const context = { console, module: { exports: {} }, exports: {} };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__result = ${expression};`, context);
  return JSON.parse(JSON.stringify(context.__result));
}

function foodByName(foods, name) {
  return foods.find((item) => item?.name === name) || null;
}

function recipeHasBreakfastEligibleIngredients(recipe, foods) {
  const required = recipe?.requires || [];
  if (!required.every((name) => plannerFoodMealEligible(foodByName(foods, name), "breakfast"))) {
    return false;
  }
  const choices = recipe?.oneOf || [];
  return !choices.length || choices.some((name) => plannerFoodMealEligible(foodByName(foods, name), "breakfast"));
}

test("herzhafte Frühstücks-FOODs werden gezielt in FOOD.meals normalisiert", () => {
  const foods = loadGlobalConst("data/foods.js", "FOOD_DB");
  const expectedIds = ["tomate", "zucchini", "karotte", "kuerbis", "brokkoli"];

  assert.deepEqual(
    [...PLANNER_SAVORY_BREAKFAST_FOOD_IDS].sort(),
    [...expectedIds].sort(),
  );

  plannerApplySavoryBreakfastMealAudit(foods);

  for (const id of expectedIds) {
    const item = foods.find((food) => food.id === id);
    assert.ok(item, `${id} muss im kanonischen FOOD-Bestand existieren`);
    assert.ok(item.meals.includes("breakfast"), `${item.name} muss nach dem Audit frühstücksgeeignet sein`);
    assert.equal(plannerFoodMealEligible(item, "breakfast"), true);
  }

  const karfiol = foods.find((food) => food.id === "karfiol");
  assert.ok(karfiol);
  assert.equal(
    plannerFoodMealEligible(karfiol, "breakfast"),
    false,
    "nicht pauschal jedes Gemüse fürs automatische Frühstück freigeben",
  );
});

test("kuratierte Frühstücks-FOODs funktionieren auch aus einem unnormalisierten Snapshot", () => {
  const zucchini = { id: "zucchini", meals: ["lunch", "dinner"] };
  const karfiol = { id: "karfiol", meals: ["lunch", "dinner"] };

  assert.equal(plannerFoodMealEligible(zucchini, "breakfast"), true);
  assert.deepEqual(zucchini.meals, ["lunch", "dinner", "breakfast"]);
  assert.equal(plannerFoodMealEligible(karfiol, "breakfast"), false);
  assert.deepEqual(karfiol.meals, ["lunch", "dinner"]);
});

test("vorhandene herzhafte Getreide-Rezepte werden als Frühstück nutzbar", () => {
  const foods = loadGlobalConst("data/foods.js", "FOOD_DB");
  const recipes = loadGlobalConst("data/recipes.js", "RECIPES");
  plannerApplySavoryBreakfastMealAudit(foods);

  const savoryBreakfastRecipes = [
    "Gemüse-Hafer-Pancakes",
    "Zucchini-Hafer-Pancakes",
    "Kürbis-Hafer-Brei",
    "Karotten-Polenta-Brei",
    "Zucchini-Quinoa-Brei",
  ];

  for (const name of savoryBreakfastRecipes) {
    const recipe = recipes.find((item) => item.name === name);
    assert.ok(recipe, `${name} muss im Rezeptbestand existieren`);
    assert.equal(
      plannerRecipeSuitableForMealCore(recipe, "breakfast", foods, () => true),
      true,
      `${name} braucht weiterhin eine gültige Frühstücksbasis`,
    );
    assert.equal(
      recipeHasBreakfastEligibleIngredients(recipe, foods),
      true,
      `${name} darf keine fürs Frühstück gesperrte Pflichtzutat enthalten`,
    );
  }

  const meatRecipe = recipes.find((item) => item.name === "Rind-Hafer-Bällchen");
  assert.ok(meatRecipe);
  assert.equal(
    plannerRecipeSuitableForMealCore(meatRecipe, "breakfast", foods, () => true),
    false,
    "die bestehende Frühstücks-Rezeptstruktur bleibt erhalten",
  );
});
