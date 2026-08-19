"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const {
  HANDLING_MODES,
  FOOD_HANDLING_CONTRACT,
  RECIPE_HANDLING_CONTRACT,
} = require(path.join(root, "data", "food-handling.js"));
const {
  normalizeFeedingApproach,
  handlingModeFamily,
  preferredHandlingModes,
  handlingEligibility,
  recipeHandlingEligibility,
  foodHandlingEligibility,
  legacyRecipeStageAllowed,
} = require(path.join(root, "js", "handling-readiness.js"));

const policySource = fs.readFileSync(
  path.join(root, "js", "handling-readiness.js"),
  "utf8",
);
const contractSource = fs.readFileSync(
  path.join(root, "data", "food-handling.js"),
  "utf8",
);

test("HANDLING: Beikostform ist Präferenz mit migrationssicherem mixed-Fallback", () => {
  assert.equal(normalizeFeedingApproach("spoon"), "spoon");
  assert.equal(normalizeFeedingApproach("fingerfood"), "fingerfood");
  assert.equal(normalizeFeedingApproach("mixed"), "mixed");
  assert.equal(normalizeFeedingApproach(""), "mixed");
  assert.equal(normalizeFeedingApproach("unknown"), "mixed");
});

test("HANDLING: Löffel und Fingerfood sind parallele Modusfamilien, keine Stufen", () => {
  assert.equal(handlingModeFamily(HANDLING_MODES.SPOON_SMOOTH), "spoon");
  assert.equal(handlingModeFamily(HANDLING_MODES.SPOON_MASHED), "spoon");
  assert.equal(handlingModeFamily(HANDLING_MODES.FINGER_GRASPABLE), "fingerfood");
});

test("HANDLING: feedingApproach sortiert nur Präferenzen und entfernt keine sichere Form", () => {
  const modes = [
    HANDLING_MODES.SPOON_MASHED,
    HANDLING_MODES.FINGER_GRASPABLE,
  ];
  assert.deepEqual(preferredHandlingModes(modes, "mixed"), modes);
  assert.deepEqual(preferredHandlingModes(modes, "spoon"), modes);
  assert.deepEqual(preferredHandlingModes(modes, "fingerfood"), [
    HANDLING_MODES.FINGER_GRASPABLE,
    HANDLING_MODES.SPOON_MASHED,
  ]);
});

test("HANDLING: migrierter Pancake ist handlingseitig auch bei textureStage 1 möglich", () => {
  const recipe = { name: "Obst-Hafer-Pancakes", stage: 2 };
  const result = recipeHandlingEligibility(
    recipe,
    { textureStage: 1, feedingApproach: "mixed" },
    RECIPE_HANDLING_CONTRACT,
  );
  assert.equal(result.migrated, true);
  assert.deepEqual(result.eligibleModes, [HANDLING_MODES.FINGER_GRASPABLE]);
  assert.deepEqual(result.blockedReasons, []);
});

test("HANDLING: Legacy-Rezept ohne Contract behält explizit den Stage-Fallback", () => {
  const recipe = { name: "Nicht migriert", stage: 3 };
  const result = recipeHandlingEligibility(
    recipe,
    { textureStage: 1 },
    RECIPE_HANDLING_CONTRACT,
  );
  assert.equal(result.migrated, false);
  assert.deepEqual(result.blockedReasons, ["legacy-stage-fallback"]);
  assert.equal(legacyRecipeStageAllowed(recipe, 1), false);
  assert.equal(legacyRecipeStageAllowed(recipe, 3), true);
});

test("HANDLING: Karotte kann früh parallel Löffel- und greifbare Form anbieten", () => {
  const result = foodHandlingEligibility(
    "karotte",
    { textureStage: 1, feedingApproach: "mixed" },
    FOOD_HANDLING_CONTRACT,
  );
  assert.equal(result.migrated, true);
  assert.ok(result.eligibleModes.includes(HANDLING_MODES.SPOON_SMOOTH));
  assert.ok(result.eligibleModes.includes(HANDLING_MODES.SPOON_MASHED));
  assert.ok(result.eligibleModes.includes(HANDLING_MODES.FINGER_GRASPABLE));
});

test("HANDLING: Fingerfood-Präferenz bevorzugt Karottenstick ohne Löffelformen zu sperren", () => {
  const result = foodHandlingEligibility(
    "karotte",
    { textureStage: 1, feedingApproach: "fingerfood" },
    FOOD_HANDLING_CONTRACT,
  );
  assert.equal(result.preferredModes[0], HANDLING_MODES.FINGER_GRASPABLE);
  assert.equal(result.eligibleModes.length, 3);
});

test("HANDLING: Wave 1 enthält nur freigegebene Referenzfälle, keine Safety-/Later-Review-Fälle", () => {
  for (const name of [
    "Rind-Hafer-Bällchen",
    "Geflügel-Gemüse-Hafer-Bällchen",
    "Lachs-Kartoffel-Bällchen",
    "Bangus-Kartoffel-Taler",
    "Eier-Finger",
    "Ei-Champignon-Cups",
    "Hummus mit weichen Gemüsesticks",
    "Fleisch-Gemüse-Bällchen",
    "Obst-Hafer-Muffins",
    "Gemüse-Hafer-Muffins",
    "Kürbis-Hirse-Muffins",
  ]) {
    assert.equal(RECIPE_HANDLING_CONTRACT[name], undefined, name);
  }
});

test("HANDLING: Wave-1-Pancakes und Omelettstreifen sind explizit soft graspable", () => {
  for (const name of [
    "Obst-Hafer-Pancakes",
    "Birne-Hirse-Pancakes",
    "Gemüse-Hafer-Pancakes",
    "Omelettstreifen",
    "Zucchini-Omelett",
  ]) {
    assert.deepEqual(
      [...RECIPE_HANDLING_CONTRACT[name].modes],
      [HANDLING_MODES.FINGER_GRASPABLE],
      name,
    );
  }
});

test("HANDLING: zusätzliche kleine-Stücke-Fähigkeit ist vorgesehen, aber nicht pauschal aktiv", () => {
  const contract = {
    modes: [HANDLING_MODES.FINGER_SMALL_SOFT],
    requiredCapabilities: {
      [HANDLING_MODES.FINGER_SMALL_SOFT]: "small-soft-pieces",
    },
  };
  assert.deepEqual(
    handlingEligibility(contract, { handlingCapabilities: { smallSoftPieces: false } }).eligibleModes,
    [],
  );
  assert.deepEqual(
    handlingEligibility(contract, { handlingCapabilities: { smallSoftPieces: true } }).eligibleModes,
    [HANDLING_MODES.FINGER_SMALL_SOFT],
  );
});

test("HANDLING: Steuerlogik parst keine safeForm-/note-Freitexte", () => {
  assert.doesNotMatch(policySource, /\.safeForm\b/);
  assert.doesNotMatch(policySource, /\.note\b/);
  assert.doesNotMatch(policySource, /text\.includes\(/);
  assert.doesNotMatch(contractSource, /safeForm\s*:/);
});

test("HANDLING: Wave 1 Contract ist klein und explizit", () => {
  assert.deepEqual(Object.keys(FOOD_HANDLING_CONTRACT).sort(), [
    "avocado",
    "banane",
    "brokkoli",
    "karfiol",
    "karotte",
    "kartoffel",
    "suesskartoffel",
    "zucchini",
  ]);
  assert.deepEqual(Object.keys(RECIPE_HANDLING_CONTRACT).sort(), [
    "Avocado-Bananen-Creme",
    "Bananen-Ei-Pancakes",
    "Birne-Hirse-Pancakes",
    "Brokkoli-Kartoffel-Stampf",
    "Gemüse-Hafer-Pancakes",
    "Obst-Hafer-Pancakes",
    "Omelettstreifen",
    "Zucchini-Kartoffel-Brei",
    "Zucchini-Omelett",
  ].sort());
});
