"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  RECIPE_WATER_INSTRUCTION_FIXES,
  installRecipeWaterInstructionFixes,
} = require("../js/planned-recipe-details.js");

function currentRuntimeRecipes() {
  let context = vm.createContext({ console });
  let dataSource = fs.readFileSync(path.join(__dirname, "../data/recipes.js"), "utf8");
  let runtimeSource = fs.readFileSync(path.join(__dirname, "../js/recipes.js"), "utf8");
  vm.runInContext(dataSource, context, { filename: "data/recipes.js" });
  vm.runInContext(runtimeSource, context, { filename: "js/recipes.js" });
  return vm.runInContext("RECIPES.map((recipe) => ({ ...recipe }))", context);
}

test("every runtime recipe that lists water explains its use", () => {
  let recipes = currentRuntimeRecipes();
  assert.equal(installRecipeWaterInstructionFixes(recipes), true);

  let waterRecipes = recipes.filter((recipe) => /Wasser/i.test(String(recipe.ingredients || "")));
  assert.ok(waterRecipes.some((recipe) => recipe.name === "Rind-Gemüse-Bolognese"));

  for (let recipe of waterRecipes) {
    assert.match(
      String(recipe.note || ""),
      /Wasser/i,
      `${recipe.name} lists water but does not explain it in the preparation`,
    );
  }

  assert.match(
    RECIPE_WATER_INSTRUCTION_FIXES["Rind-Gemüse-Bolognese"],
    /Karotte und Tomate mit dem Wasser weich kochen/,
  );
});

test("water instruction fixes update only audited recipes and are idempotent", () => {
  let recipes = [
    { name: "Rind-Gemüse-Bolognese", note: "alte Zubereitung" },
    { name: "Obst-Quinoabrei", note: "alte Zubereitung" },
    { name: "Unverändertes Rezept", note: "bleibt gleich" },
  ];

  assert.equal(installRecipeWaterInstructionFixes(recipes), true);
  assert.equal(
    recipes[0].note,
    RECIPE_WATER_INSTRUCTION_FIXES["Rind-Gemüse-Bolognese"],
  );
  assert.equal(recipes[1].note, RECIPE_WATER_INSTRUCTION_FIXES["Obst-Quinoabrei"]);
  assert.equal(recipes[2].note, "bleibt gleich");
  assert.equal(installRecipeWaterInstructionFixes(recipes), false);
});
