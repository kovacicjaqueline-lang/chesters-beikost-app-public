const test = require("node:test");
const assert = require("node:assert/strict");

const {
  plannerFinalAutomaticRecipeSuitable,
  plannerFinalAutoLockNeedsRepair,
  plannerFinalMealAssessment,
} = require("../js/planner-final-quality.js");

test("automatic lunch rejects porridge while keeping other existing lunch recipe paths eligible", () => {
  const porridge = { name: "Obst-Polentabrei", category: "porridge" };
  const pancakes = { name: "Ube-Bananen-Pancakes", category: "pancakes" };
  const baking = { name: "Gemüse-Muffins", category: "baking" };
  const family = { name: "Huhn-Brokkoli-Reis", category: "family" };
  const baseSuitable = () => true;

  assert.equal(plannerFinalAutomaticRecipeSuitable(porridge, "lunch", baseSuitable), false);
  assert.equal(plannerFinalAutomaticRecipeSuitable(porridge, "dinner", baseSuitable), true);
  assert.equal(plannerFinalAutomaticRecipeSuitable(pancakes, "lunch", baseSuitable), true);
  assert.equal(plannerFinalAutomaticRecipeSuitable(baking, "lunch", baseSuitable), true);
  assert.equal(plannerFinalAutomaticRecipeSuitable(family, "lunch", baseSuitable), true);
});

test("automatic recipe exclusions stay a hard gate", () => {
  const recipe = { name: "Test", category: "family", excludeMeals: ["lunch"] };
  assert.equal(plannerFinalAutomaticRecipeSuitable(recipe, "lunch", () => true), false);
});

test("normal automatic singleton is invalid but an explicit single sample remains valid", () => {
  const foods = [{ id: "huhn", category: "Fleisch" }];
  const normal = {
    active: true,
    meal: "lunch",
    focusId: "huhn",
    foodIds: ["huhn"],
    sampleFoodIds: [],
    type: "bekannt",
  };
  const sample = {
    ...normal,
    sampleFoodIds: ["huhn"],
    type: "neu",
  };

  assert.equal(plannerFinalMealAssessment(normal, foods).allowed, false);
  assert.equal(plannerFinalMealAssessment(sample, foods).allowed, true);
});

test("manual meals are not rewritten by the automatic quality gate", () => {
  const manual = {
    active: true,
    meal: "lunch",
    focusId: "huhn",
    foodIds: ["huhn"],
    manualAdded: true,
  };
  assert.equal(plannerFinalMealAssessment(manual, [{ id: "huhn", category: "Fleisch" }]).allowed, true);
});

test("valid auto locks stay protected but an unavailable stored ingredient reopens repair", () => {
  const date = "2026-09-24";
  const meal = {
    active: true,
    meal: "lunch",
    focusId: "huhn",
    foodIds: ["huhn"],
    sampleFoodIds: [],
    type: "bekannt",
    lockedMode: "auto",
  };
  const state = {
    planLocks: {
      [`${date}|lunch`]: {
        mode: "auto",
        focusId: "bangus-milkfish",
        foodIds: ["bangus-milkfish", "kartoffel"],
        baseFoodIds: ["kartoffel"],
        sampleFoodIds: [],
      },
    },
  };

  assert.equal(
    plannerFinalAutoLockNeedsRepair(meal, date, state, () => false),
    false,
    "ein intakter Auto-Lock bleibt geschützt",
  );
  assert.equal(
    plannerFinalAutoLockNeedsRepair(meal, date, state, (id) => id === "bangus-milkfish"),
    true,
    "ein Auto-Lock mit inzwischen fehlender gespeicherter Zutat muss neu bewertet werden",
  );
});
