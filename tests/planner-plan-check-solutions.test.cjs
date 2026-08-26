"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const solutions = require("../js/planner-plan-check-solutions.js");

test("Solution-IDs sind stabil und unterscheiden konkrete Mutationen", () => {
  const base = {
    goalKey: "family:erdnuss",
    date: "2026-08-27",
    meal: "breakfast",
    after: { foodIds: ["hafer", "erdnussmus"], recipeName: "" },
  };
  assert.equal(solutions.solutionId(base), solutions.solutionId({ ...base }));
  assert.notEqual(
    solutions.solutionId(base),
    solutions.solutionId({ ...base, after: { foodIds: ["hafer"], recipeName: "Hafer-Erdnuss-Brei" } }),
  );
});

test("Laufende Allergen-Einführung hat vor Maintenance-Zielen Vorrang", () => {
  const items = solutions.sortGoalItems([
    {
      code: "ALLERGEN_MAINTENANCE_DUE",
      details: { allergenTargetKey: "family:ei", lastEatenDate: "2026-08-01" },
    },
    {
      code: solutions.INTRO_OPEN_CODE,
      details: { allergenIntroductionKey: "family:erdnuss", lastExposureDate: "2026-08-20" },
    },
  ]);
  assert.equal(items[0].code, solutions.INTRO_OPEN_CODE);
});

test("Maintenance-Ziele werden nach ältester tatsächlicher Gabe sortiert", () => {
  const items = solutions.sortGoalItems([
    { code: "ALLERGEN_MAINTENANCE_DUE", details: { allergenTargetKey: "family:milch", lastEatenDate: "2026-08-12" } },
    { code: "ALLERGEN_MAINTENANCE_DUE", details: { allergenTargetKey: "family:ei", lastEatenDate: "2026-08-03" } },
  ]);
  assert.equal(items[0].details.allergenTargetKey, "family:ei");
});

test("Plan-Signatur bleibt strukturiert und ignoriert sichtbare Copy", () => {
  const signature = solutions.planSignature([{ date: "2026-08-25", meals: [{
    meal: "lunch",
    active: true,
    focusId: "karotte",
    foodIds: ["karotte"],
    baseFoodIds: ["karotte"],
    sampleFoodIds: [],
    recipeName: "",
    planId: "plan-1",
    visibleText: "Dieser Text darf keine Fachlogik tragen",
  }] }]);
  assert.deepEqual(signature, [{
    date: "2026-08-25",
    meal: "lunch",
    planId: "plan-1",
    focusId: "karotte",
    foodIds: ["karotte"],
    baseFoodIds: ["karotte"],
    sampleFoodIds: [],
    recipeName: "",
    source: "",
  }]);
});

test("Goal-Key verwendet strukturierte Zielidentität statt sichtbarer Texte", () => {
  assert.equal(
    solutions.goalKey({ code: "ALLERGEN_MAINTENANCE_DUE", details: { allergenTargetKey: "family:sesam" }, title: "beliebige Copy" }),
    "family:sesam",
  );
  assert.equal(
    solutions.goalKey({ code: solutions.INTRO_OPEN_CODE, details: { allergenIntroductionKey: "family:erdnuss" } }),
    "family:erdnuss",
  );
});

test("Allergen-Fortsetzung verdrängt keine andere laufende Kostprobe", () => {
  const item = { refs: { foodIds: ["brot"] } };
  const before = {
    foodIds: ["banane", "mais"],
    baseFoodIds: ["banane"],
    sampleFoodIds: ["mais"],
  };
  const after = {
    foodIds: ["pfirsich", "brot"],
    baseFoodIds: ["pfirsich"],
    sampleFoodIds: ["brot"],
  };
  assert.equal(solutions.introductionMutationKeepsMealContext(item, before, after), false);
});

test("Allergen-Fortsetzung erfindet keinen neuen Begleiter", () => {
  const item = { refs: { foodIds: ["brot"] } };
  const before = {
    foodIds: ["banane"],
    baseFoodIds: ["banane"],
    sampleFoodIds: [],
  };
  const after = {
    foodIds: ["pfirsich", "brot"],
    baseFoodIds: ["pfirsich"],
    sampleFoodIds: ["brot"],
  };
  assert.equal(solutions.introductionMutationKeepsMealContext(item, before, after), false);
});

test("Allergen-Fortsetzung darf eine bestehende Basis weiterverwenden", () => {
  const item = { refs: { foodIds: ["brot"] } };
  const before = {
    foodIds: ["banane"],
    baseFoodIds: ["banane"],
    sampleFoodIds: [],
  };
  const after = {
    foodIds: ["banane", "brot"],
    baseFoodIds: ["banane"],
    sampleFoodIds: ["brot"],
  };
  assert.equal(solutions.introductionMutationKeepsMealContext(item, before, after), true);
});
