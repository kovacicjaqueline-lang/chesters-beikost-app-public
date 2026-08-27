"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { applyFoodPolicyData } = require("../app.js");
const {
  RECIPE_COMPONENT_KINDS,
  RECIPE_COMPONENT_FORMS,
  RECIPE_V2_COMPONENT_OPTIONS,
  foodHasRecipeComponentKind,
  foodRecipeComponentForm,
  installFoodRecipeComponentMetadata,
  installRecipeV2ComponentOptions,
} = require("../js/recipe-v2-component-options.js");

function actualFoods() {
  const source = fs.readFileSync(path.resolve(__dirname, "..", "data", "foods.js"), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__FOOD_DB = FOOD_DB;`, context);
  return context.__FOOD_DB.map((item) => ({ ...item }));
}

function policyFoods() {
  const foods = actualFoods();
  applyFoodPolicyData(foods, {});
  installFoodRecipeComponentMetadata(foods);
  return foods;
}

test("Milch-Getreide-Brei definiert alle Milchoptionen zentral", () => {
  const recipe = { name: "Milch-Getreide-Brei", milkChoices: ["Kuhmilch"] };
  assert.equal(installRecipeV2ComponentOptions([recipe], []), true);
  assert.deepEqual(recipe.milkChoices, ["Kuhmilch", "Naturjoghurt", "Buttermilch", "Haferdrink", "Sojabohne", "Mandel", "Kokos"]);
  assert.deepEqual(recipe.milkChoices, [...RECIPE_V2_COMPONENT_OPTIONS["Milch-Getreide-Brei"].milkChoices]);
});

test("Nuss-/Sesampasten werden nur aus strukturierten FOOD-Eigenschaften abgeleitet", () => {
  const foods = policyFoods();

  for (const id of ["erdnuss", "mandel", "walnuss", "haselnuss", "cashew", "pistazie", "pecannuss", "paranuss", "macadamia", "sesam"]) {
    const item = foods.find((food) => food.id === id);
    assert.ok(item, id);
    assert.equal(foodHasRecipeComponentKind(item, RECIPE_COMPONENT_KINDS.SMOOTH_PASTE), true, id);
    assert.equal(foodRecipeComponentForm(item), RECIPE_COMPONENT_FORMS.CANONICAL, id);
  }

  for (const id of ["erdnussmus", "pistazienmus", "tahin"]) {
    const item = foods.find((food) => food.id === id);
    assert.ok(item, id);
    assert.equal(foodHasRecipeComponentKind(item, RECIPE_COMPONENT_KINDS.SMOOTH_PASTE), true, id);
    assert.equal(foodRecipeComponentForm(item), RECIPE_COMPONENT_FORMS.PREPARED, id);
  }

  for (const id of ["maroni", "leinsamen"]) {
    const item = foods.find((food) => food.id === id);
    assert.ok(item, id);
    assert.equal(foodHasRecipeComponentKind(item, RECIPE_COMPONENT_KINDS.SMOOTH_PASTE), false, id);
    assert.equal(foodRecipeComponentForm(item), "", id);
  }

  const fixture = {
    id: "fixture-nut",
    name: "Fixture-Nuss",
    category: "Nuss",
    allergenGroup: "Schalenfrüchte",
    safeForm: "Dieser sichtbare Text erwähnt absichtlich kein Mus.",
  };
  assert.equal(
    foodHasRecipeComponentKind(fixture, RECIPE_COMPONENT_KINDS.SMOOTH_PASTE),
    true,
    "UI-/Safety-Freitext darf die Maschinenklassifikation nicht steuern",
  );
});

test("Joghurt-Nussmus bezieht geeignete kanonische Nüsse zentral aus FOOD", () => {
  const foods = policyFoods();
  const recipe = {
    name: "Joghurt-Nussmus-Miniportion",
    oneOf: ["Erdnuss"],
  };

  assert.equal(installRecipeV2ComponentOptions([recipe], foods), true);
  const expected = foods
    .filter((item) => item.active !== false && item.category === "Nuss")
    .filter((item) => foodHasRecipeComponentKind(item, RECIPE_COMPONENT_KINDS.SMOOTH_PASTE))
    .filter((item) => foodRecipeComponentForm(item) === RECIPE_COMPONENT_FORMS.CANONICAL)
    .sort((a, b) =>
      (Number(a.priority) || 9999) - (Number(b.priority) || 9999) ||
      String(a.name || "").localeCompare(String(b.name || ""), "de"),
    )
    .map((item) => item.name);

  assert.deepEqual(recipe.oneOf, expected);
  for (const name of ["Pistazie", "Pecannuss", "Paranuss", "Macadamia"]) {
    assert.ok(recipe.oneOf.includes(name), name);
  }
  for (const name of ["Maroni", "Erdnussmus", "Pistazienmus", "Tahin"]) {
    assert.equal(recipe.oneOf.includes(name), false, name);
  }
  assert.equal(recipe.editorComponents.oneOf.label, "Nussmus");
});