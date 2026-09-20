"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RECIPE_WATER_INSTRUCTION_FIXES,
  installRecipeWaterInstructionFixes,
} = require("../js/planned-recipe-details.js");

test("audited recipe water instructions state how the water is used", () => {
  assert.equal(Object.keys(RECIPE_WATER_INSTRUCTION_FIXES).length, 33);

  for (let [name, note] of Object.entries(RECIPE_WATER_INSTRUCTION_FIXES)) {
    assert.match(note, /Wasser/i, `${name} must explicitly mention its listed water`);
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
