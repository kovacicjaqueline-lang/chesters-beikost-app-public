"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { RECIPE_V2_COMPONENT_OPTIONS, installRecipeV2ComponentOptions } = require("../js/recipe-v2-component-options.js");

test("Milch-Getreide-Brei definiert alle Milchoptionen zentral", () => {
  const recipe = { name: "Milch-Getreide-Brei", milkChoices: ["Kuhmilch"] };
  assert.equal(installRecipeV2ComponentOptions([recipe]), true);
  assert.deepEqual(recipe.milkChoices, ["Kuhmilch", "Naturjoghurt", "Buttermilch", "Haferdrink", "Sojabohne", "Mandel", "Kokos"]);
  assert.deepEqual(recipe.milkChoices, [...RECIPE_V2_COMPONENT_OPTIONS["Milch-Getreide-Brei"].milkChoices]);
});
