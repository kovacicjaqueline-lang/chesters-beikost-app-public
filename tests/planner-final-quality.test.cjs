const test = require("node:test");
const assert = require("node:assert/strict");

const {
  plannerFinalAutomaticRecipeSuitable,
  plannerFinalMealAssessment,
} = require("../js/planner-final-quality.js");

test("automatic lunch rejects breakfast-style recipes while dinner keeps porridge eligible", () => {
  const porridge = { name: "Obst-Polentabrei", category: "porridge" };
  const family = { name: "Huhn-Brokkoli-Reis", category: "family" };
  const baseSuitable = () => true;

  assert.equal(plannerFinalAutomaticRecipeSuitable(porridge, "lunch", baseSuitable), false);
  assert.equal(plannerFinalAutomaticRecipeSuitable(porridge, "dinner", baseSuitable), true);
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
