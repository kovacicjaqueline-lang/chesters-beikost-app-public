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
const { plannerCulinaryAssessment } = require("../js/planner-culinary-quality.js");

test("automatic lunch blocks breakfast-style porridge, not savory porridge", () => {
  const breakfastPorridge = {
    name: "Obst-Polentabrei",
    category: "porridge",
    breakfastStyle: true,
  };
  const savoryPorridge = {
    name: "Süßkartoffel-Rote-Linsen-Brei",
    category: "porridge",
  };
  const pancakes = { name: "Ube-Bananen-Pancakes", category: "pancakes" };
  const baking = { name: "Gemüse-Muffins", category: "baking" };
  const family = { name: "Huhn-Brokkoli-Reis", category: "family" };
  const baseSuitable = () => true;

  assert.equal(plannerFinalAutomaticRecipeSuitable(breakfastPorridge, "lunch", baseSuitable), false);
  assert.equal(plannerFinalAutomaticRecipeSuitable(breakfastPorridge, "dinner", baseSuitable), true);
  assert.equal(plannerFinalAutomaticRecipeSuitable(savoryPorridge, "lunch", baseSuitable), true);
  assert.equal(plannerFinalAutomaticRecipeSuitable(savoryPorridge, "dinner", baseSuitable), true);
  assert.equal(plannerFinalAutomaticRecipeSuitable(pancakes, "lunch", baseSuitable), true);
  assert.equal(plannerFinalAutomaticRecipeSuitable(baking, "lunch", baseSuitable), true);
  assert.equal(plannerFinalAutomaticRecipeSuitable(family, "lunch", baseSuitable), true);
});

test("breakfastStyle marks only the audited breakfast porridges", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "data", "recipes.js"), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__recipes = RECIPES;`, context);
  const recipes = JSON.parse(JSON.stringify(context.__recipes));
  const actual = recipes
    .filter((recipe) => recipe.breakfastStyle === true)
    .map((recipe) => recipe.name)
    .sort();
  const expected = [
    "Apfel-Hirse-Brei mit Mandelmus",
    "Bananen-Haferbrei mit Erdnussmus",
    "Buttermilch-Grieß-Obstbrei",
    "Buttermilch-Hafer-Obstbrei",
    "Buttermilch-Hirse-Obstbrei",
    "Obst-Buchweizenbrei",
    "Obst-Grieß-Joghurt",
    "Obst-Grießbrei",
    "Obst-Hafer-Joghurt",
    "Obst-Haferbrei",
    "Obst-Hirse-Joghurt",
    "Obst-Hirsebrei",
    "Obst-Joghurt",
    "Obst-Polentabrei",
    "Obst-Quinoabrei",
    "Obst-Reisbrei",
  ].sort();

  assert.deepEqual(actual, expected);
  assert.equal(
    recipes.find((recipe) => recipe.name === "Süßkartoffel-Rote-Linsen-Brei").breakfastStyle,
    undefined,
  );
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

test("eine Kostprobe mit genau einer vertrauten Basis bleibt ein Lernangebot statt ein volles Gericht", () => {
  const foods = [
    { id: "kartoffel", category: "Wurzel/Knolle" },
    { id: "mangold", category: "Blattgemüse" },
    { id: "fenchel", category: "Gemüse" },
  ];
  const assess = (sampleFoodIds) => plannerFinalMealAssessment({
    active: true,
    meal: "lunch",
    focusId: sampleFoodIds[0],
    foodIds: ["kartoffel", ...sampleFoodIds],
    baseFoodIds: ["kartoffel"],
    sampleFoodIds,
    type: "neu",
  }, foods, {
    culinaryAssessment: (ids, items, meal, options) => plannerCulinaryAssessment(ids, items, meal, options),
  });

  const singleSample = assess(["mangold"]);
  assert.equal(singleSample.allowed, true);
  assert.equal(singleSample.learningOnly, true);

  const multipleSamples = assess(["mangold", "fenchel"]);
  assert.equal(multipleSamples.learningOnly, false, "mehrere Kostproben werden nicht als einzelnes Lernangebot eingestuft");
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

test("Plan-Check-Kandidaten durchlaufen finale Qualität auch bei geschütztem Ausgangs-Slot", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "planner-final-quality.js"), "utf8");
  const context = {
    state: { foods: [{ id: "brot" }, { id: "karotte" }] },
    buildDay: () => ({ meals: [] }),
    plannerCulinaryAssessment: (ids) => ({ allowed: ids.length >= 2 }),
  };
  vm.createContext(context);
  vm.runInContext(`${source}\ninstallPlannerFinalQualityRuntime(globalThis);`, context);

  const manualSingleton = {
    active: true,
    meal: "lunch",
    focusId: "brot",
    foodIds: ["brot"],
    lockedMode: "manual",
    manualAdded: true,
  };
  assert.equal(
    context.PlannerFinalQuality.assessAutomaticMeal(manualSingleton).allowed,
    false,
    "eine vorgeschlagene automatische Änderung darf den Schutz des Ausgangs-Slots nicht als Qualitätsfreigabe übernehmen",
  );
  assert.equal(
    context.PlannerFinalQuality.assessAutomaticMeal({ ...manualSingleton, foodIds: ["brot", "karotte"] }).allowed,
    true,
  );
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

test("finaler bekannter Ersatz übernimmt ein exakt passendes geeignetes Rezept", () => {
  const finalQualitySource = fs.readFileSync(path.join(__dirname, "..", "js", "planner-final-quality.js"), "utf8");
  const recipeFirstSource = fs.readFileSync(path.join(__dirname, "..", "js", "planner-recipe-first.js"), "utf8");
  const state = {
    foods: [
      { id: "brot", name: "Brot", category: "Getreide/Stärke", active: true },
      { id: "polenta", name: "Polenta", category: "Getreide/Stärke", active: true },
      { id: "zucchini", name: "Zucchini", category: "Gemüse", active: true },
    ],
    settings: { preferInventoryInPlan: false },
  };
  const recipe = {
    name: "Polenta-Zucchini-Sticks",
    category: "balls",
    requires: ["Polenta", "Zucchini"],
    requirementMissing: [],
    ingredientMissing: [],
  };
  let activeQualityContext = null;
  const context = {
    state,
    food: (id) => state.foods.find((item) => item.id === id) || null,
    recipeStates: () => [recipe],
    recipeByName: (name) => name === recipe.name ? recipe : null,
    recipeSuitableForMeal: () => true,
    plannerCulinaryRecipeIngredientReady: () => true,
    plannerCulinaryAssessment: (ids) => ({ allowed: ids.length > 1, issues: [] }),
    plannerQualityWithActiveContext: (ctx, callback) => {
      const previous = activeQualityContext;
      activeQualityContext = ctx;
      try {
        return callback();
      } finally {
        activeQualityContext = previous;
      }
    },
    isFoodUnavailable: () => false,
    buildDay: (date) => ({
      date,
      meals: [{
        active: true,
        meal: "lunch",
        focusId: "brot",
        foodIds: ["brot"],
        sampleFoodIds: [],
        type: "bekannt",
      }],
    }),
    companionFor: (focus) => focus.id === "polenta" && state.foods.some((item) => item.id === "zucchini")
      ? state.foods.find((item) => item.id === "zucchini")
      : null,
    knownCandidate: (_meal, _date, _ctx, exclude = []) => exclude.includes("polenta")
      ? null
      : activeQualityContext
        ? ({ f: state.foods.find((item) => item.id === "polenta"), type: "bekannt" })
        : null,
  };

  vm.createContext(context);
  vm.runInContext(`${recipeFirstSource}\n${finalQualitySource}\ninstallPlannerFinalQualityRuntime(globalThis);`, context);
  const day = vm.runInContext('buildDay("2026-10-02", 0, {})', context);

  assert.deepEqual(JSON.parse(JSON.stringify(day.meals[0].foodIds)), ["polenta", "zucchini"]);
  assert.equal(day.meals[0].recipeName, "Polenta-Zucchini-Sticks");
  assert.equal(day.meals[0].type, "Rezept");
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
