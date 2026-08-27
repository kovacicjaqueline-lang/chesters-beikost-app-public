"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  RECIPE_COMPONENT_KINDS,
  RECIPE_V2_COMPONENT_OPTIONS,
  foodHasRecipeComponentKind,
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

test("Milch-Getreide-Brei definiert alle Milchoptionen zentral", () => {
  const recipe = { name: "Milch-Getreide-Brei", milkChoices: ["Kuhmilch"] };
  assert.equal(installRecipeV2ComponentOptions([recipe], []), true);
  assert.deepEqual(recipe.milkChoices, ["Kuhmilch", "Naturjoghurt", "Buttermilch", "Haferdrink", "Sojabohne", "Mandel", "Kokos"]);
  assert.deepEqual(recipe.milkChoices, [...RECIPE_V2_COMPONENT_OPTIONS["Milch-Getreide-Brei"].milkChoices]);
});

test("FOOD-Metadaten kennzeichnen sichere Mus-/Pastenkomponenten ohne Nuss-ID-Liste", () => {
  const foods = actualFoods();
  assert.equal(installFoodRecipeComponentMetadata(foods), true);

  for (const id of ["erdnuss", "mandel", "walnuss", "haselnuss", "cashew", "pistazie", "pecannuss", "paranuss", "macadamia"]) {
    const item = foods.find((food) => food.id === id);
    assert.ok(item, id);
    assert.equal(
      foodHasRecipeComponentKind(item, RECIPE_COMPONENT_KINDS.SMOOTH_PASTE),
      true,
      id,
    );
  }

  const maroni = foods.find((food) => food.id === "maroni");
  assert.ok(maroni);
  assert.equal(foodHasRecipeComponentKind(maroni, RECIPE_COMPONENT_KINDS.SMOOTH_PASTE), false);
});

test("Joghurt-Nussmus bezieht alle geeigneten aktiven Nüsse aus FOOD", () => {
  const foods = actualFoods();
  const recipe = {
    name: "Joghurt-Nussmus-Miniportion",
    oneOf: ["Erdnuss"],
  };

  assert.equal(installRecipeV2ComponentOptions([recipe], foods), true);
  const expected = foods
    .filter((item) => item.active !== false && item.category === "Nuss")
    .filter((item) => foodHasRecipeComponentKind(item, RECIPE_COMPONENT_KINDS.SMOOTH_PASTE))
    .sort((a, b) =>
      (Number(a.priority) || 9999) - (Number(b.priority) || 9999) ||
      String(a.name || "").localeCompare(String(b.name || ""), "de"),
    )
    .map((item) => item.name);

  assert.deepEqual(recipe.oneOf, expected);
  for (const name of ["Pistazie", "Pecannuss", "Paranuss", "Macadamia"]) {
    assert.ok(recipe.oneOf.includes(name), name);
  }
  assert.equal(recipe.oneOf.includes("Maroni"), false);
  assert.equal(recipe.editorComponents.oneOf.label, "Nussmus");
});
