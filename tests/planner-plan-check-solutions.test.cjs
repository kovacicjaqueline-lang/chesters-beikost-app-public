"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const maintenance = require("../js/planner-allergen-maintenance.js");
const solutions = require("../js/planner-plan-check-solutions.js");

const groupLevelTargets = maintenance.GROUP_LEVEL_MAINTENANCE_TARGETS;

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

test("Gluten-Einführung nutzt für Hafer und Brot dasselbe Gruppenziel", () => {
  const hafer = {
    id: "hafer",
    name: "Hafer",
    allergenGroup: "Glutenhaltiges Getreide",
    allergenFamily: "hafer",
  };
  const brot = {
    id: "brot",
    name: "Brot",
    allergenGroup: "Glutenhaltiges Getreide",
  };
  assert.equal(
    solutions.allergenIntroductionTarget(hafer, groupLevelTargets).key,
    "allergen:Glutenhaltiges Getreide",
  );
  assert.equal(
    solutions.allergenIntroductionTarget(brot, groupLevelTargets).key,
    "allergen:Glutenhaltiges Getreide",
  );
  assert.deepEqual(
    solutions.introductionTargetFoodIds(brot, [hafer, brot], groupLevelTargets),
    ["hafer", "brot"],
  );
});

test("Etablierte Gluten-Exposition macht Brot nicht wieder zu einem Einmal-Kontakt", () => {
  const foods = [
    {
      id: "hafer",
      name: "Hafer",
      allergenGroup: "Glutenhaltiges Getreide",
      allergenFamily: "hafer",
    },
    {
      id: "brot",
      name: "Brot",
      allergenGroup: "Glutenhaltiges Getreide",
    },
  ];
  const logs = [
    { date: "2026-08-14", meal: "breakfast", foodIds: ["hafer"] },
    { date: "2026-08-16", meal: "lunch", foodIds: ["brot"] },
  ];
  const eaten = () => "eaten";
  assert.equal(
    solutions.successfulIntroductionExposureCount(
      foods[1],
      foods,
      logs,
      eaten,
      null,
      groupLevelTargets,
    ),
    2,
  );
  assert.deepEqual(
    solutions.latestIntroductionExposure(foods[1], foods, logs, eaten, groupLevelTargets),
    { date: "2026-08-16", foodId: "brot" },
  );
});

test("Andere Allergen-Einführungsziele werden nicht pauschal auf Gruppenebene gezogen", () => {
  const sesam = {
    id: "tahin",
    name: "Tahin",
    allergenGroup: "Sesam",
    allergenFamily: "sesam",
  };
  const lachs = {
    id: "lachs",
    name: "Lachs",
    allergenGroup: "Fisch",
  };
  assert.equal(solutions.allergenIntroductionTarget(sesam, groupLevelTargets).key, "family:sesam");
  assert.equal(solutions.allergenIntroductionTarget(lachs, groupLevelTargets).key, "food:lachs");
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
