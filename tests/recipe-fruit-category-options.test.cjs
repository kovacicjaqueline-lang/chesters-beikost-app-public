"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const {
  recipeCategoryChoiceNames,
  installRecipeCategoryComponentOptions,
  installRecipeV2ComponentOptions,
} = require("../js/recipe-v2-component-options.js");

function loadArray(filePath, expression) {
  const source = fs.readFileSync(filePath, "utf8");
  const context = vm.createContext({ console });
  vm.runInContext(source, context, { filename: filePath });
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
}

const foods = loadArray(path.join(ROOT, "data/foods.js"), "FOOD_DB");
const recipes = loadArray(path.join(ROOT, "data/recipes.js"), "RECIPES");

test("variable Obst-Rezeptkomponenten werden zentral aus FOOD.category abgeleitet", () => {
  const beforeByName = new Map(foods.map((item) => [item.name, item]));
  const variableFruitRecipes = recipes.filter((recipe) =>
    Array.isArray(recipe.oneOf) &&
    recipe.oneOf.length > 0 &&
    recipe.oneOf.every((name) => beforeByName.get(name)?.category === "Obst")
  );
  assert.ok(variableFruitRecipes.length > 0, "mindestens ein variabler Obst-Slot erwartet");

  const expectedFruitNames = recipeCategoryChoiceNames("Obst", foods);
  assert.ok(expectedFruitNames.includes("Brombeere"), "Brombeere muss kanonisch als aktives Obst vorhanden sein");

  assert.equal(installRecipeV2ComponentOptions(recipes, foods), true);

  for (const recipe of variableFruitRecipes) {
    assert.deepEqual(recipe.oneOf, expectedFruitNames, `${recipe.name}: Obst-Auswahl ist nicht zentral vollständig`);
    assert.ok(recipe.oneOf.includes("Brombeere"), `${recipe.name}: Brombeere fehlt`);
    if (Array.isArray(recipe.variantLabels)) {
      assert.deepEqual(recipe.variantLabels, expectedFruitNames, `${recipe.name}: variantLabels sind nicht synchron`);
    }
  }

  const ricePorridge = recipes.find((recipe) => recipe.name === "Obst-Reisbrei");
  assert.ok(ricePorridge, "Obst-Reisbrei muss vorhanden sein");
  assert.ok(ricePorridge.oneOf.includes("Brombeere"), "Obst-Reisbrei muss Brombeere aus FOOD.category erhalten");
});

test("Nicht-Obst-oneOf-Gruppen werden durch die Kategorieableitung nicht verändert", () => {
  const fixture = [{ name: "Gemüse-Test", oneOf: ["Karotte", "Zucchini"] }];
  assert.equal(installRecipeCategoryComponentOptions(fixture, foods, "Obst"), false);
  assert.deepEqual(fixture[0].oneOf, ["Karotte", "Zucchini"]);
});
