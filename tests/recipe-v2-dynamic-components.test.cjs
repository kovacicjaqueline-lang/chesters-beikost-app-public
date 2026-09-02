"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const {
  RECIPE_COMPONENT_KINDS,
  installFoodRecipeComponentMetadata,
  recipeComponentFoodNames,
  recipeCategoryChoiceNames,
  installRecipeV2ComponentOptions,
} = require("../js/recipe-v2-component-options.js");

function loadArray(filePath, expression) {
  const source = fs.readFileSync(filePath, "utf8");
  const context = vm.createContext({ console });
  vm.runInContext(source, context, { filename: filePath });
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
}

function freshData() {
  return {
    foods: loadArray(path.join(ROOT, "data/foods.js"), "FOOD_DB"),
    recipes: loadArray(path.join(ROOT, "data/recipes.js"), "RECIPES"),
  };
}

function recipeByName(recipes, name) {
  const recipe = recipes.find((item) => item?.name === name);
  assert.ok(recipe, `${name}: Rezept fehlt`);
  return recipe;
}

function assertChoiceField(recipes, foods, recipeName, field, kind) {
  const recipe = recipeByName(recipes, recipeName);
  const expected = recipeComponentFoodNames(kind, foods);
  assert.ok(expected.length > 0, `${recipeName}: mindestens eine datengetriebene Option erwartet`);
  assert.deepEqual(recipe[field], expected, `${recipeName}.${field} muss aus FOOD-Capabilities abgeleitet sein`);
  return { recipe, expected };
}

test("alle variablen Obst-Slots werden aus FOOD.category=Obst abgeleitet", () => {
  const { foods, recipes } = freshData();
  const foodByName = new Map(foods.map((item) => [item.name, item]));
  const variableFruitRecipeNames = recipes
    .filter((recipe) =>
      Array.isArray(recipe.oneOf) &&
      recipe.oneOf.length > 0 &&
      recipe.oneOf.every((name) => foodByName.get(name)?.category === "Obst"),
    )
    .map((recipe) => recipe.name);

  assert.ok(variableFruitRecipeNames.length > 0, "mindestens ein variabler Obst-Slot erwartet");
  const expected = recipeCategoryChoiceNames("Obst", foods);
  assert.ok(expected.includes("Brombeere"), "Brombeere muss als aktives kanonisches Obst enthalten sein");

  installRecipeV2ComponentOptions(recipes, foods);

  for (const name of variableFruitRecipeNames) {
    const recipe = recipeByName(recipes, name);
    assert.deepEqual(recipe.oneOf, expected, `${name}: Obst-Slot unvollständig`);
    assert.ok(recipe.oneOf.includes("Brombeere"), `${name}: Brombeere fehlt`);
    if (Array.isArray(recipe.variantLabels)) {
      assert.deepEqual(recipe.variantLabels, expected, `${name}: variantLabels nicht synchron`);
    }
  }

  assert.ok(recipeByName(recipes, "Obst-Reisbrei").oneOf.includes("Brombeere"));
});

test("Getreide, Milch, Gemüse und Bohnen werden aus zentralen FOOD-Capabilities abgeleitet", () => {
  const { foods, recipes } = freshData();
  installRecipeV2ComponentOptions(recipes, foods);

  const milkPorridgeGrain = assertChoiceField(
    recipes,
    foods,
    "Milch-Getreide-Brei",
    "oneOf",
    RECIPE_COMPONENT_KINDS.MILK_PORRIDGE_GRAIN,
  );
  assert.ok(milkPorridgeGrain.expected.includes("Hafer"));
  assert.ok(milkPorridgeGrain.expected.includes("Hirse"));
  assert.ok(milkPorridgeGrain.expected.includes("Polenta"));
  assert.equal(milkPorridgeGrain.expected.includes("Reis"), false, "Reis darf nicht allein wegen seiner Kategorie in den Milchbrei-Slot rutschen");

  const milkChoices = assertChoiceField(
    recipes,
    foods,
    "Milch-Getreide-Brei",
    "milkChoices",
    RECIPE_COMPONENT_KINDS.MILK_PORRIDGE_LIQUID,
  );
  for (const name of ["Kuhmilch", "Naturjoghurt", "Buttermilch", "Haferdrink", "Sojabohne", "Mandel", "Kokos"]) {
    assert.ok(milkChoices.expected.includes(name), `Milch-Getreide-Brei: ${name} fehlt`);
  }

  const bananaBread = assertChoiceField(
    recipes,
    foods,
    "Baby-Bananenbrot",
    "oneOf",
    RECIPE_COMPONENT_KINDS.BANANA_BREAD_GRAIN,
  );
  assert.deepEqual(new Set(bananaBread.expected), new Set(["Hafer", "Dinkel", "Weizen"]));

  const pancakeVeg = assertChoiceField(
    recipes,
    foods,
    "Gemüse-Hafer-Pancakes",
    "oneOf",
    RECIPE_COMPONENT_KINDS.PANCAKE_VEGETABLE,
  );
  assert.deepEqual(new Set(pancakeVeg.expected), new Set(["Kürbis", "Süßkartoffel"]));
  assert.equal(pancakeVeg.expected.includes("Karfiol"), false);

  const muffinExpected = recipeComponentFoodNames(RECIPE_COMPONENT_KINDS.SOFT_MUFFIN_VEGETABLE, foods);
  assert.deepEqual(new Set(muffinExpected), new Set(["Zucchini", "Karotte", "Brokkoli", "Süßkartoffel"]));
  for (const name of ["Gemüse-Hafer-Muffins", "Gemüse-Joghurt-Mini-Muffins", "Huhn-Gemüse-Muffins"]) {
    const recipe = recipeByName(recipes, name);
    assert.deepEqual(recipe.oneOf, muffinExpected, `${name}: Gemüse-Slot muss zentral abgeleitet sein`);
    if (Array.isArray(recipe.variantLabels)) assert.deepEqual(recipe.variantLabels, muffinExpected);
  }

  const beanStampf = assertChoiceField(
    recipes,
    foods,
    "Bohnen-Kartoffel-Stampf",
    "oneOf",
    RECIPE_COMPONENT_KINDS.BEAN_POTATO_STAMPF,
  );
  assert.deepEqual(new Set(beanStampf.expected), new Set(["Weiße Bohnen", "Schwarze Bohnen"]));
});

test("numerische Variantenlabels bleiben nach dynamischer Ableitung synchron", () => {
  const { foods, recipes } = freshData();
  installRecipeV2ComponentOptions(recipes, foods);

  for (const name of [
    "Obst-Hafer-Pancakes",
    "Obst-Hafer-Muffins",
    "Obst-Hafer-Joghurt",
    "Gemüse-Hafer-Pancakes",
    "Gemüse-Hafer-Muffins",
    "Gemüse-Joghurt-Mini-Muffins",
    "Bohnen-Kartoffel-Stampf",
  ]) {
    const recipe = recipeByName(recipes, name);
    if (!recipe.family || !Array.isArray(recipe.variantLabels)) continue;
    assert.equal(recipe.variantLabels.length, recipe.oneOf.length, `${name}: variantLabels-Anzahl`);
    const match = String(recipe.familyLabel || "").match(/^(\d+)\s+/);
    if (match) assert.equal(Number(match[1]), recipe.oneOf.length, `${name}: familyLabel-Anzahl`);
  }
});

test("neues FOOD mit recipeComponentKinds wird ohne Rezeptlisten-Änderung automatisch aufgenommen", () => {
  const { foods } = freshData();
  const newGrain = {
    id: "test-getreide",
    name: "Testgetreide",
    category: "Getreide/Stärke",
    priority: 0.5,
    active: true,
    recipeComponentKinds: [RECIPE_COMPONENT_KINDS.MILK_PORRIDGE_GRAIN],
  };
  const sameCategoryWithoutCapability = {
    id: "test-getreide-ohne-capability",
    name: "Testgetreide ohne Capability",
    category: "Getreide/Stärke",
    priority: 0.6,
    active: true,
  };
  const fixtureFoods = [newGrain, sameCategoryWithoutCapability, ...foods];
  const recipes = [{
    name: "Milch-Getreide-Brei",
    oneOf: ["Hafer"],
    milkChoices: ["Kuhmilch"],
  }];

  installFoodRecipeComponentMetadata(fixtureFoods);
  installRecipeV2ComponentOptions(recipes, fixtureFoods);

  assert.ok(recipes[0].oneOf.includes("Testgetreide"));
  assert.equal(recipes[0].oneOf.includes("Testgetreide ohne Capability"), false);
});

test("gekoppelte alternatives-Varianten bleiben unverändert", () => {
  const { foods, recipes } = freshData();
  const before = new Map(
    recipes
      .filter((recipe) => Array.isArray(recipe.alternatives))
      .map((recipe) => [recipe.name, JSON.stringify(recipe.alternatives)]),
  );

  installRecipeV2ComponentOptions(recipes, foods);

  for (const [name, serialized] of before) {
    assert.equal(JSON.stringify(recipeByName(recipes, name).alternatives), serialized, `${name}: alternatives dürfen nicht dynamisiert werden`);
  }
});
