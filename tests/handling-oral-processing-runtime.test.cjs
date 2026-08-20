"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RECIPE_HANDLING_CONTRACT,
  RECIPE_ORAL_PROCESSING_CONTRACT,
} = require("../data/food-handling.js");
const {
  recipeOralProcessingState,
  mergeRecipeHandlingState,
} = require("../js/handling-readiness.js");

function legacyState(name, stage = 3) {
  return {
    name,
    stage,
    ingredientMissing: [],
    requirementMissing: ["Konsistenz: weich-stückig / Fingerfood"],
    missing: ["Konsistenz: weich-stückig / Fingerfood"],
    unlocked: false,
    almost: true,
  };
}

test("ORAL runtime: Omelettstreifen liefert Profil und konkrete Servierbedingung", () => {
  const oral = recipeOralProcessingState(
    "Omelettstreifen",
    RECIPE_ORAL_PROCESSING_CONTRACT,
  );
  assert.equal(oral.oralProcessing, "easy-bite-separate");
  assert.match(oral.oralServingRequirement, /breite gut greifbare Streifen/i);
});

test("ORAL runtime: Oral-only Lachs bleibt im konservativen Handling-Stage-Fallback", () => {
  const original = legacyState("Lachs-Kartoffel-Bällchen");
  const merged = mergeRecipeHandlingState(
    original,
    { textureStage: 1, feedingApproach: "mixed" },
    RECIPE_HANDLING_CONTRACT,
    RECIPE_ORAL_PROCESSING_CONTRACT,
  );

  assert.equal(merged.oralProcessing, "soft-breakdown");
  assert.match(merged.oralServingRequirement, /grätenfrei/i);
  assert.equal(merged.handlingMigrated, false);
  assert.deepEqual(merged.requirementMissing, original.requirementMissing);
  assert.deepEqual(merged.missing, original.missing);
  assert.equal(merged.unlocked, false);
});

test("ORAL runtime: bestehend migrierter Omelett-Referenzfall behält Handling-Semantik", () => {
  const original = legacyState("Omelettstreifen", 2);
  const merged = mergeRecipeHandlingState(
    original,
    { textureStage: 1, feedingApproach: "mixed" },
    RECIPE_HANDLING_CONTRACT,
    RECIPE_ORAL_PROCESSING_CONTRACT,
  );

  assert.equal(merged.oralProcessing, "easy-bite-separate");
  assert.equal(merged.handlingMigrated, true);
  assert.deepEqual(merged.handlingModes, ["finger-graspable"]);
  assert.deepEqual(merged.requirementMissing, []);
  assert.deepEqual(merged.missing, []);
  assert.equal(merged.unlocked, true);
});

test("ORAL runtime: offener Fall erhält weder Profil noch Servierbedingung", () => {
  const original = legacyState("Baby-Bananenbrot");
  const merged = mergeRecipeHandlingState(
    original,
    { textureStage: 1, feedingApproach: "mixed" },
    RECIPE_HANDLING_CONTRACT,
    RECIPE_ORAL_PROCESSING_CONTRACT,
  );

  assert.equal(merged.oralProcessing, "");
  assert.equal(merged.oralServingRequirement, "");
  assert.equal(merged.handlingMigrated, false);
  assert.deepEqual(merged.requirementMissing, original.requirementMissing);
  assert.equal(merged.unlocked, false);
});

test("ORAL runtime: Oral-Metadaten allein verändern Eligibility nicht", () => {
  const original = {
    ...legacyState("Geflügel-Gemüse-Hafer-Bällchen"),
    requirementMissing: [
      "Konsistenz: weich-stückig / Fingerfood",
      "Alter: frühestens ab etwa 8 Monaten",
    ],
    missing: [
      "Konsistenz: weich-stückig / Fingerfood",
      "Alter: frühestens ab etwa 8 Monaten",
    ],
  };
  const merged = mergeRecipeHandlingState(
    original,
    { textureStage: 1, feedingApproach: "mixed" },
    {},
    RECIPE_ORAL_PROCESSING_CONTRACT,
  );

  assert.equal(merged.oralProcessing, "easy-bite-separate");
  assert.equal(merged.handlingMigrated, false);
  assert.deepEqual(merged.requirementMissing, original.requirementMissing);
  assert.deepEqual(merged.missing, original.missing);
  assert.equal(merged.unlocked, false);
});
