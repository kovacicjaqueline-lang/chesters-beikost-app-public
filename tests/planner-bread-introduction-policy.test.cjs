"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const policy = require("../js/planner-introduction-policy.js");
const root = path.resolve(__dirname, "..");
const canonicalFoods = {};
vm.createContext(canonicalFoods);
vm.runInContext(fs.readFileSync(path.join(root, "data/foods.js"), "utf8") +
  "\nthis.foods = FOOD_DB;", canonicalFoods);

const food = (id) => canonicalFoods.foods.find((item) => item.id === id);
const bread = food("brot");
const egg = food("ei");

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

function buildRealDay({ focusId, focusRank, override = false, due = false }) {
  const date = "2026-09-28";
  const base = { ...food("karotte"), meals: ["lunch"] };
  const focus = { ...food(focusId), meals: ["lunch"] };
  const foods = [focus, base];
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "js/planning.js"), "utf8"), context);
  context.state = {
    foods, logs: [], inventory: [], pantry: {}, manualMeals: {}, planLocks: {},
    overrides: override ? { [`${date}|lunch`]: focusId } : {}, deferred: {},
    settings: { newFoodEvery: 1, allergenDays: 7, preferInventoryInPlan: false,
      phaseSelected: "aufbau", birthDate: "2026-01-24" },
  };
  context.food = (id) => foods.find((item) => item.id === id) || null;
  context.rank = (item) => item?.id === focusId ? focusRank : 2;
  context.status = (item) => context.rank(item) >= 2 ? "Verträgliche Basis" : "Offen";
  context.lastOutcome = () => "";
  context.lastDate = () => due ? "2026-09-01" : "";
  context.eatenExposureCount = () => 0;
  context.usageCount = () => 0;
  context.isFoodUnavailable = () => false;
  context.activeMeal = (meal) => meal === "lunch";
  context.mealIsCompleted = () => false;
  context.manualMealRoleInfo = () => ({ role: "excluded" });
  context.recipeStates = () => [];
  context.recipeInventoryPortions = () => 0;
  context.oldestRecipeBatch = () => null;
  context.combinationPaused = () => false;
  context.companionFor = () => base;
  context.ironCompanion = () => null;
  context.currentAmountLevel = () => "taste";
  context.AMOUNT_LEVELS = { taste: { rank: 0 } };
  context.applyPlannedMealAmounts = (meal) => meal;
  context.reserveMealInventory = () => {};
  context.manualMealFor = () => null;
  context.lockedMeal = () => null;
  context.today = () => date;
  vm.runInContext(fs.readFileSync(path.join(root, "js/planner-introduction-policy.js"), "utf8"), context);
  assert.equal(context.installPlannerIntroductionPolicyRuntime(), true);
  const ctx = vm.runInContext(`({
    reserved: new Set(), introduced: [], plannedUse: new Map(), lastFocus: new Map(),
    inventoryReserved: new Map(), recipeReserved: new Map(), recipePlannedUse: new Map(),
    fullMilkDates: new Set()
  })`, context);
  return context.buildDay(date, 0, ctx).meals.find((meal) => meal.meal === "lunch");
}

test("echter buildDay führt Brot weder neu noch erneut automatisch ein", () => {
  for (const rank of [0, 1, 2]) {
    const meal = buildRealDay({ focusId: "brot", focusRank: rank, due: rank === 2 });
    assert.notEqual(meal?.type, "Allergen einführen");
    assert.notEqual(meal?.type, "Allergen wiederholen");
    assert.equal((meal?.sampleFoodIds || []).includes("brot"), false);
  }
});

test("echter buildDay lässt bewusst gewähltes Brot und automatische Ei-Einführung zu", () => {
  const manual = buildRealDay({ focusId: "brot", focusRank: 0, override: true });
  assert.equal(manual?.focusId, "brot");
  const knownManual = buildRealDay({ focusId: "brot", focusRank: 2, override: true });
  assert.equal(knownManual?.focusId, "brot");
  const eggMeal = buildRealDay({ focusId: "ei", focusRank: 0 });
  assert.equal(eggMeal?.focusId, "ei");
  assert.equal(eggMeal?.type, "Allergen einführen");
  for (const id of ["weizen", "lachs"]) {
    const item = food(id);
    assert.equal(policy.plannerIntroductionFoodAllowsAutomaticAllergenLearning(item), true);
    assert.equal(policy.plannerIntroductionCandidateShouldSkip(
      { f: item, type: "Allergen einführen" }, () => 0, () => "", true, false,
    ), false);
    const meal = buildRealDay({ focusId: id, focusRank: 0 });
    assert.equal(meal?.focusId, id, `${id} bleibt mit bekannter Basis einführbar`);
    assert.equal(meal?.type, "Allergen einführen");
    assert.deepEqual(Array.from(meal?.baseFoodIds || []), ["karotte"]);
  }
});
