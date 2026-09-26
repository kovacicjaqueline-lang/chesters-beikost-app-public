const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  plannerFinalAutomaticRecipeSuitable,
  plannerFinalAutoLockNeedsRepair,
  plannerFinalShouldReleaseAutoLock,
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

test("an open automatic snapshot does not protect an unsuitable singleton", () => {
  const autoLockedBread = {
    active: true,
    meal: "lunch",
    focusId: "brot",
    foodIds: ["brot"],
    sampleFoodIds: [],
    type: "Allergen weiter anbieten",
    lockedMode: "auto",
  };
  const manualKeep = { ...autoLockedBread, lockedMode: "manual" };
  const foods = [{ id: "brot", category: "Getreide/Stärke" }];

  assert.equal(
    plannerFinalMealAssessment(autoLockedBread, foods).allowed,
    false,
    "ein offener automatischer Snapshot ist kein bewusstes Behalten und muss die Qualitätsprüfung durchlaufen",
  );
  assert.equal(
    plannerFinalMealAssessment(manualKeep, foods).allowed,
    true,
    "eine bewusst manuell geschützte Mahlzeit bleibt unverändert",
  );
  assert.equal(
    plannerFinalMealAssessment({ ...autoLockedBread, followUpFoodId: "brot" }, foods).allowed,
    true,
    "ein fachlich bewusstes Follow-up bleibt geschützt",
  );
  assert.equal(
    plannerFinalShouldReleaseAutoLock(autoLockedBread, { mode: "auto" }, false),
    true,
    "ein ungeeigneter automatischer Snapshot muss zur Neuplanung freigegeben werden",
  );
  assert.equal(
    plannerFinalShouldReleaseAutoLock(
      { ...autoLockedBread, followUpFoodId: "brot" },
      { mode: "auto", followUpFoodId: "brot" },
      false,
    ),
    false,
  );
});

test("an unsuitable automatic singleton lock is released by the final runtime gate", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "planner-final-quality.js"), "utf8");
  const date = "2026-09-26";
  const state = {
    foods: [{ id: "brot", category: "Getreide/Stärke", active: true }],
    planLocks: {
      [`${date}|lunch`]: {
        mode: "auto",
        focusId: "brot",
        foodIds: ["brot"],
        sampleFoodIds: [],
      },
    },
  };
  const context = {
    state,
    food: (id) => state.foods.find((item) => item.id === id) || null,
    isFoodUnavailable: () => false,
    buildDay: (plannedDate) => ({
      date: plannedDate,
      meals: [{
        active: true,
        meal: "lunch",
        focusId: "brot",
        foodIds: ["brot"],
        sampleFoodIds: [],
        type: "Allergen weiter anbieten",
        lockedMode: "auto",
      }],
    }),
  };
  vm.createContext(context);
  vm.runInContext(`${source}\ninstallPlannerFinalQualityRuntime(globalThis);`, context);
  const day = vm.runInContext(`buildDay("${date}", 0, {})`, context);

  assert.equal(day.meals[0].empty, true);
  assert.equal(state.planLocks[`${date}|lunch`], undefined);

  const followUpLock = {
    mode: "auto",
    focusId: "brot",
    foodIds: ["brot"],
    sampleFoodIds: [],
    followUpFoodId: "brot",
  };
  state.planLocks[`${date}|lunch`] = followUpLock;
  const followUpDay = vm.runInContext(`buildDay("${date}", 0, {})`, context);
  assert.equal(followUpDay.meals[0].empty, undefined);
  assert.equal(state.planLocks[`${date}|lunch`], followUpLock);
});

test("availability repair still reopens an automatic lock with an unavailable ingredient", () => {
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
