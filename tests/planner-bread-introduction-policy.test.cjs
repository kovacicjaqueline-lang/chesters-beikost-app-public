"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const policy = require("../js/planner-introduction-policy.js");

const bread = {
  id: "brot",
  active: true,
  category: "Getreide/Stärke",
  allergenGroup: "Glutenhaltiges Getreide",
};

const egg = {
  id: "ei",
  active: true,
  category: "Ei",
  allergenGroup: "Ei",
  plannerIntroductionMode: "standalone",
};

test("Brot ist kein automatisches Allergen-Einführungsziel", () => {
  assert.equal(policy.plannerIntroductionModeForFood(bread), "none");
  assert.equal(policy.plannerIntroductionFoodAllowsAutomaticAllergenLearning(bread), false);
  assert.equal(
    policy.plannerIntroductionCandidateShouldSkip(
      { f: bread, type: "Allergen einführen" },
      () => 0,
      () => "",
      true,
      false,
    ),
    true,
  );
  assert.equal(
    policy.plannerIntroductionCandidateShouldSkip(
      { f: bread, type: "Allergen wiederholen" },
      () => 1,
      () => "eaten",
      true,
      false,
    ),
    true,
  );
});

test("manuell gewähltes Brot bleibt zulässig und wird nicht automatisch zur Wiederholung umgedeutet", () => {
  assert.equal(
    policy.plannerIntroductionCandidateShouldSkip(
      { f: bread, type: "manuell" },
      () => 0,
      () => "",
      true,
      false,
    ),
    false,
  );
  assert.deepEqual(
    policy.plannerIntroductionNormalizeCandidate(
      { f: bread, type: "manuell" },
      "2026-09-28",
      () => true,
      () => "eaten",
    ),
    { f: bread, type: "manuell" },
  );
});

test("Prefilter blockiert Brot automatisch, aber nicht bei explizitem Override", () => {
  assert.deepEqual(
    policy.plannerIntroductionPrefilterBlockedFoods(
      [bread, egg],
      [],
      "",
      true,
      false,
      () => "",
    ),
    ["brot"],
  );
  assert.deepEqual(
    policy.plannerIntroductionPrefilterBlockedFoods(
      [bread, egg],
      [],
      "brot",
      true,
      false,
      () => "",
    ),
    [],
  );
});

test("echte Allergen-Einführungen wie Ei bleiben unverändert erlaubt", () => {
  assert.equal(policy.plannerIntroductionModeForFood(egg), "standalone");
  assert.equal(policy.plannerIntroductionFoodAllowsAutomaticAllergenLearning(egg), true);
  assert.equal(
    policy.plannerIntroductionCandidateShouldSkip(
      { f: egg, type: "Allergen einführen" },
      () => 0,
      () => "",
      true,
      false,
    ),
    false,
  );
});
