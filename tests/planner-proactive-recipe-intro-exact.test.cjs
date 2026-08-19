"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const proactive = require("../js/planner-proactive-recipe.js");

function item(id, name) {
  return { id, name, active: true, meals: ["lunch"], category: "Gemüse" };
}

test("PLAN-08 proactive: exakt passendes Rezept darf genau die eine geplante neue Zutat enthalten", () => {
  const foods = [item("basis", "Basis"), item("neu", "Neu")];
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "neu",
    foodIds: ["basis", "neu"],
    baseFoodIds: ["basis"],
    sampleFoodIds: ["neu"],
    recipeName: "",
    type: "neu",
  };
  const recipe = {
    name: "Basis-Neu-Rezept",
    category: "balls",
    requires: ["Basis", "Neu"],
    requirementMissing: [],
  };
  const candidates = proactive.plannerProactiveRecipeCandidates(
    meal,
    [recipe],
    foods,
    () => true,
    (name) => name === "Basis",
    () => true,
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].recipe.name, "Basis-Neu-Rezept");
  assert.equal(candidates[0].sampleFoodId, "neu");
  assert.deepEqual(Array.from(candidates[0].addedIds), []);
});
