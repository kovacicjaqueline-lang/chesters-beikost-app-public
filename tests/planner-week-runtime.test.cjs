"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { applyFoodPolicyData } = require("../app.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function loadPlanner() {
  const context = vm.createContext({ console, structuredClone, Date, Set, Map, Object, Array, Number, String, Math, JSON });
  vm.runInContext(read("data/foods.js"), context);
  vm.runInContext(read("data/recipes.js"), context);
  vm.runInContext(`${read("js/state.js")}\nglobalThis.__foods = FOOD_DB; globalThis.__aliases = ID_ALIASES;`, context);
  vm.runInContext(read("js/utils.js"), context);
  vm.runInContext(read("js/migrations.js"), context);
  vm.runInContext(read("js/model.js"), context);
  applyFoodPolicyData(context.__foods, context.__aliases);
  vm.runInContext(read("js/prep.js"), context);

  const trustedIds = ["kartoffel", "karotte", "zucchini", "brokkoli", "kuerbis", "hafer", "hirse", "reis", "polenta", "apfel", "banane", "birne", "rind", "huhn", "joghurt", "brombeere"];
  const logs = trustedIds.flatMap((id) => [1, 2].map((index) => ({
    id: `${id}-${index}`,
    date: `2026-09-${String(index).padStart(2, "0")}`,
    meal: "lunch",
    foodIds: [id],
    foodOutcomes: { [id]: "eaten" },
    createdAt: `2026-09-${String(index).padStart(2, "0")}T10:00:00.000Z`,
  })));
  const state = {
    settings: {
      startDate: "2026-01-24",
      planFrom: "2026-09-22",
      phaseSelected: "aufbau",
      phaseModelVersion: 2,
      amountSelected: "building",
      newFoodEvery: 7,
      preferInventoryInPlan: false,
      seasonal: false,
      phMode: "off",
      travelPrep: false,
      allergenDays: 7,
    },
    foods: clone(context.__foods),
    logs,
    inventory: [],
    overrides: {},
    deferred: {},
    pantry: {},
    planLocks: {},
    autoLockExcluded: {},
    manualMeals: {},
    combinationPauses: {},
    followUps: {},
    shoppingHints: {},
    backupMeta: { plannerLinking: { carriedPlans: {}, rolloverHandled: {} } },
  };
  context.__seed = state;
  vm.runInContext("state = __seed;", context);
  context.today = () => "2026-09-22";
  vm.runInContext(read("js/planning.js"), context);
  vm.runInContext(`${read("js/planner-culinary-quality.js")}\nglobalThis.__buildDays = buildDays; globalThis.__ensureMealComponentPlan = plannerEnsureMealComponentPlan;`, context);
  context.planQualityIssues = () => [];
  vm.runInContext(`${read("js/planner-quality-rotation.js")}\nglobalThis.__installQuality = installPlannerQualityRotationRuntime;`, context);
  assert.equal(context.__installQuality(), true);
  return { context, state };
}

test("phasenplan ergänzt eine freie Mittagsmahlzeit und lässt Kostproben sowie manuelle Mahlzeiten unverändert", () => {
  const { context, state } = loadPlanner();
  state.settings.phaseSelected = "aufbau";
  state.foods = state.foods.filter((item) => ["kartoffel", "zucchini", "huhn", "rapsoel"].includes(item.id));
  const ctx = context.freshPlanContext();
  const meal = {
    meal: "lunch", active: true, focusId: "kartoffel", foodIds: ["kartoffel"],
    baseFoodIds: ["kartoffel"], sampleFoodIds: [], optionalAddons: [],
  };

  const planned = context.__ensureMealComponentPlan(meal, "2026-09-22", ctx);
  const assessment = context.plannerMealComponentAssessment(
    [...planned.foodIds, ...planned.optionalAddons], state.foods, null, "aufbau", "lunch",
  );
  assert.equal(assessment.complete, true);
  assert.ok(planned.foodIds.includes("zucchini"));
  assert.ok(planned.foodIds.includes("huhn"));
  assert.ok(planned.optionalAddons.includes("rapsoel"));

  const sample = { meal: "lunch", active: true, foodIds: ["huhn"], sampleFoodIds: ["huhn"] };
  const manual = { meal: "lunch", active: true, manualAdded: true, foodIds: ["kartoffel"] };
  assert.equal(context.__ensureMealComponentPlan(sample, "2026-09-22", ctx), sample);
  assert.equal(context.__ensureMealComponentPlan(manual, "2026-09-22", ctx), manual);
  assert.deepEqual(clone(sample.foodIds), ["huhn"]);
  assert.deepEqual(clone(manual.foodIds), ["kartoffel"]);

  state.recipes = [{ name: "Kartoffelgericht", cookingFat: "Rapsöl" }];
  const recipeMeal = {
    meal: "lunch", active: true, focusId: "kartoffel", recipeName: "Kartoffelgericht",
    foodIds: ["kartoffel"], baseFoodIds: ["kartoffel"], sampleFoodIds: [], optionalAddons: [],
  };
  const recipePlanned = context.__ensureMealComponentPlan(recipeMeal, "2026-09-23", context.freshPlanContext());
  assert.equal(recipePlanned.recipeName, "Kartoffelgericht", "Ergänzungen dürfen die Rezeptidentität nicht ersetzen");
  assert.equal(recipePlanned.compositionMode, "recipe-plus-food");
  assert.deepEqual(clone(recipePlanned.recipeIngredientFoodIds), ["kartoffel"]);
  assert.ok(recipePlanned.additionalFoodIds.includes("zucchini"));
  assert.ok(recipePlanned.additionalFoodIds.includes("huhn"));
});

test("7-Tage-Worker installiert die Planner-Wrapper in derselben Reihenfolge wie der Browser", () => {
  const source = read("js/planner-week-worker.js");
  const weekCacheImport = source.indexOf('"./planner-week-cache.js?v=10.1.26&planner-cache=5"');
  const rolloverImport = source.indexOf('"./planner-log-rollover.js?v=10.1.26"');
  const cascadeImport = source.indexOf('"./planner-log-rollover-cascade.js?v=10.1.26"');
  const appImport = source.indexOf('importScripts("../app.js?v=10.1.26")');
  const recipeInventoryImport = source.indexOf('"./recipe-inventory-ingredients.js?v=10.1.26"');
  const recipeV2Import = source.indexOf('"./recipe-v2-component-options.js?v=10.1.26"');
  const cascadeModules = [
    '"./meal-card-unification.js?v=10.1.26"',
    '"./planner-log-rollover-review-fixes.js?v=10.1.26"',
    '"./planner-random-swap.js?v=10.1.26"',
    '"./planner-task-alternatives.js?v=10.1.26"',
    '"./planner-missing-ingredient.js?v=10.1.26"',
  ].map((path) => source.indexOf(path));
  const foodPolicyInstall = source.indexOf("installFoodPolicyRuntime();");
  const maintenanceImports = [...source.matchAll(/importScripts\("\.\/planner-allergen-maintenance\.js\?v=10\.1\.26"\)/g)];
  const firstMaintenanceImport = maintenanceImports[0]?.index ?? -1;
  const plannerPolicies = [
    '"./planner-meal-eligibility.js?v=10.1.26"',
    '"./planner-milk-policy.js?v=10.1.26"',
    '"./planner-iron-preference.js?v=10.1.26"',
    '"./planner-meal-presentation.js?v=10.1.26"',
    '"./planner-recipe-first.js?v=10.1.26"',
    '"./planner-proactive-recipe.js?v=10.1.26"',
    '"./planner-food-role-stability.js?v=10.1.26"',
    '"./planner-quality-rotation.js?v=10.1.26"',
    '"./planner-introduction-policy.js?v=10.1.26"',
    '"./planner-final-quality.js?v=10.1.26"',
  ].map((path) => source.indexOf(path));
  const handlingReadinessImport = source.indexOf('"./handling-readiness.js?v=10.1.26"');

  assert.ok(weekCacheImport >= 0 && weekCacheImport < rolloverImport, "Worker muss den Save-Cache vor der Rollover-Schicht installieren");
  assert.ok(rolloverImport >= 0, "Worker muss die Plan-ID-/Rollover-Basis der App laden");
  assert.ok(cascadeImport > rolloverImport, "Rollover-Cascade und Tagesplan-Cache liegen vor den späteren Policies");
  assert.ok(cascadeModules.every((index) => index >= 0), "Worker muss alle synchronen Cascade-Module laden");
  assert.ok(cascadeModules.every((index, position) => position === 0 || index > cascadeModules[position - 1]), "Cascade-Module bleiben in derselben Reihenfolge wie im Browser");
  assert.ok(recipeInventoryImport > cascadeModules.at(-1) && recipeV2Import > recipeInventoryImport && appImport > recipeV2Import, "Statische Rezept- und UI-Schichten folgen vor app.js");
  assert.ok(foodPolicyInstall > appImport, "Food-Policy wird wie in der App während des Bootstraps installiert");
  assert.ok(plannerPolicies.every((index) => index >= 0), "Worker muss alle Planner-Policies laden");
  assert.ok(plannerPolicies.every((index, position) => position === 0 || index > plannerPolicies[position - 1]), "Planner-Policies bleiben in Browser-Reihenfolge");
  assert.equal(maintenanceImports.length, 1, "Der Worker lädt die Allergenpflege genau einmal");
  assert.ok(firstMaintenanceImport > plannerPolicies.at(-1), "Allergenpflege folgt wie im Browser auf Final Quality");
  assert.ok(handlingReadinessImport > firstMaintenanceImport, "Handling-Readiness folgt der gesamten Planner-Wrapper-Kette");

  const maintenanceSource = read("js/planner-allergen-maintenance.js");
  assert.match(maintenanceSource, /currentScript\.dataset\.plannerAllergenMaintenance\s*=\s*"maintenance-v2"/);
});

test("volles Milch-Getreide-Rezept bleibt auch im Lunch-Slot unverändert", () => {
  const { context, state } = loadPlanner();
  state.settings.phaseSelected = "kennenlernen";
  state.foods = state.foods.filter((item) =>
    ["hafer", "naturjoghurt", "rapsoel", "zucchini", "ei"].includes(item.id),
  );
  for (const item of state.foods) {
    item.active = true;
    item.manualStatus = "Regelmäßig";
  }
  state.recipes = [{
    name: "Milch-Getreide-Brei",
    milkPorridge: true,
    milkMeal: "full",
  }];

  const meal = {
    meal: "lunch",
    active: true,
    focusId: "hafer",
    recipeName: "Milch-Getreide-Brei",
    foodIds: ["hafer", "naturjoghurt"],
    baseFoodIds: ["hafer"],
    sampleFoodIds: [],
    optionalAddons: [],
  };
  context.__ensureMealComponentPlan(meal, "2026-09-22", context.freshPlanContext());

  assert.deepEqual(clone(meal.foodIds), ["hafer", "naturjoghurt"]);
  assert.deepEqual(clone(meal.optionalAddons), []);
  assert.equal(meal.recipeName, "Milch-Getreide-Brei");
});

test("echter buildDays-Plan erzeugt eine abwechslungsreiche 7-Tage-Woche", () => {
  const { context, state } = loadPlanner();
  const days = context.__buildDays("2026-09-22", 7, false);

  assert.equal(days.length, 7);
  assert.deepEqual(clone(days.map((day) => day.date)), [
    "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25",
    "2026-09-26", "2026-09-27", "2026-09-28",
  ]);
  const activeMeals = days.flatMap((day) => day.meals.filter((meal) => meal.active && !meal.empty));
  const focusIds = activeMeals.map((meal) => meal.focusId).filter(Boolean);
  const combinations = activeMeals.map((meal) => [...new Set(meal.foodIds || [])].sort().join("+"));

  assert.equal(activeMeals.length, 14, "Phase Aufbau muss genau Mittagessen und Abendessen für 7 Tage erzeugen");
  assert.equal(activeMeals.some((meal) => ["breakfast", "snack"].includes(meal.meal)), false);
  assert.ok(new Set(focusIds).size >= 5, "die echten Tagesvorschläge müssen über die Woche rotieren");
  assert.ok(new Set(combinations).size >= 5, "die echten Mahlzeitenkombinationen müssen über die Woche rotieren");
  const blackberryMeals = activeMeals.filter((meal) => (meal.foodIds || []).includes("brombeere"));
  assert.ok(blackberryMeals.length <= 2, "Brombeere darf bei gleich geeigneten Alternativen nicht fast jede Mahlzeit dominieren");
  assert.ok(activeMeals.some((meal) => meal.foodIds.some((id) => state.foods.find((food) => food.id === id)?.ironRich)), "die Woche muss die modellierte Eisenregel sichtbar bedienen");
  for (const meal of activeMeals) {
    const items = meal.foodIds.map((id) => state.foods.find((food) => food.id === id)).filter(Boolean);
    assert.equal(items.some((food) => food.category === "Milchprodukt") && items.some((food) => ["Fleisch", "Fisch", "Meeresfrucht"].includes(food.category)), false, "Milch und Fleisch/Fisch dürfen nicht in derselben Mahlzeit kombiniert werden");
  }
  assert.equal(state.logs.length, 32);
});

test("echter Tagesplan rotiert einen bekannten Begleiter zwischen Mittag- und Abendessen", () => {
  const { context, state } = loadPlanner();
  state.foods = state.foods.filter((food) =>
    !food.ironRich && !["Fleisch", "Fisch", "Meeresfrucht"].includes(food.category),
  );
  state.overrides["2026-09-22|lunch"] = "zucchini";
  state.overrides["2026-09-22|dinner"] = "apfel";

  const day = context.__buildDays("2026-09-22", 1, false)[0];
  const lunch = day.meals.find((meal) => meal.meal === "lunch");
  const dinner = day.meals.find((meal) => meal.meal === "dinner");
  const lunchComponents = lunch.foodIds.filter((id) => id !== lunch.focusId);

  assert.equal(lunch.focusId, "zucchini");
  assert.equal(dinner.focusId, "apfel");
  assert.ok(lunchComponents.length > 0, "Mittagessen muss im Fixture einen Begleiter haben");
  assert.equal(
    lunchComponents.some((id) => dinner.foodIds.includes(id)),
    false,
    "der Abend darf keinen Mittagsbegleiter wiederverwenden, wenn bekannte Alternativen verfügbar sind",
  );
});

test("bloß probiertes Nicht-Allergen blockiert kein offenes FOOD; echte Ablehnung bleibt gezieltes Follow-up", () => {
  const { context, state } = loadPlanner();
  state.foods = state.foods.filter((food) => ["hirse", "birne"].includes(food.id));
  state.logs = [{
    id: "hirse-tried",
    date: "2026-09-21",
    meal: "lunch",
    foodIds: ["hirse"],
    foodOutcomes: { hirse: "tried" },
    entryType: "sample",
  }];

  const candidate = context.introductionCandidate("lunch", "2026-09-22", context.freshPlanContext());
  assert.equal(candidate.f.id, "birne");
  assert.equal(candidate.type, "neu");

  state.logs[0].outcome = "not_accepted";
  state.logs[0].foodOutcomes.hirse = "not_accepted";
  const followUp = context.introductionCandidate("lunch", "2026-09-22", context.freshPlanContext());
  assert.equal(followUp.f.id, "hirse");
  assert.equal(followUp.type, "gezielt wiederholen");
});

test("reiner Tracking-Snapshot blockiert die Rotation der übrigen Tagesslots nicht", () => {
  const { context, state } = loadPlanner();
  state.foods = state.foods.filter((item) =>
    !item.ironRich && !["Fleisch", "Fisch", "Meeresfrucht"].includes(item.category),
  );
  state.overrides["2026-09-22|lunch"] = "zucchini";
  state.overrides["2026-09-22|dinner"] = "apfel";
  state.planLocks["2026-09-22|lunch"] = {
    mode: "auto", plannerTrackingSnapshot: true, focusId: "zucchini",
    foodIds: ["zucchini", "polenta"], baseFoodIds: ["polenta"],
  };
  const originalLockedMeal = context.lockedMeal;
  context.lockedMeal = (date, meal) => state.planLocks[`${date}|${meal}`]?.plannerTrackingSnapshot
    ? null : originalLockedMeal(date, meal);

  const day = context.__buildDays("2026-09-22", 1, false)[0];
  const lunch = day.meals.find((meal) => meal.meal === "lunch");
  const dinner = day.meals.find((meal) => meal.meal === "dinner");
  assert.ok(lunch.foodIds.length > 1);
  assert.equal(lunch.foodIds.some((id) => dinner.foodIds.includes(id)), false);
});

test("bekanntes geeignetes Rezept wird vor freiem Paar gewählt und mit allen Zutaten geplant", () => {
  const { context, state } = loadPlanner();
  vm.runInContext(read("js/planner-recipe-first.js"), context);
  context.recipeStates = () => [{
    name: "Test-Huhn-Zucchini-Hafer", category: "family",
    requires: ["Huhn", "Zucchini", "Hafer"], cookingFat: "Rapsöl", unlocked: true,
    ingredientMissing: [], requirementMissing: [],
  }];
  context.recipeIngredientReady = (name) => ["Huhn", "Zucchini", "Hafer"].includes(name);
  state.deferred["2026-09-22"] = true;

  const day = context.__buildDays("2026-09-22", 1, false)[0];
  const lunch = day.meals.find((meal) => meal.meal === "lunch");
  const dinner = day.meals.find((meal) => meal.meal === "dinner");
  assert.equal(lunch.recipeName, "Test-Huhn-Zucchini-Hafer");
  assert.deepEqual(clone(lunch.foodIds).sort(), ["hafer", "huhn", "zucchini"]);
  assert.notEqual(dinner.recipeName, lunch.recipeName, "dasselbe Rezept nicht zweimal am Tag");
});

test("Woche neu planen rotiert nur zwischen gleichwertigen Rezepten", () => {
  const { context, state } = loadPlanner();
  const recipes = [
    { name: "A Frisch", unlocked: true, ids: ["kuerbis", "brokkoli"] },
    { name: "Z Kürzlich", unlocked: true, ids: ["karotte", "zucchini"] },
  ];
  context.recipeStates = () => recipes;
  context.plannerRecipeVariantIdSets = (recipe) => [recipe.ids];
  context.recipeSuitableForMeal = () => true;
  context.plannerFoodCanBeAutomaticFocus = () => true;
  context.eligible = () => true;
  context.canCombine = () => true;
  context.combinationPaused = () => false;
  context.plannerCulinaryRecipeScore = () => 10;
  state.settings.planRebuildGeneration = 1;
  const ctx = context.freshPlanContext();
  ctx.qualityLastFoodUse = new Map([
    ["karotte", "2026-09-21"], ["zucchini", "2026-09-21"],
  ]);

  const selected = context.knownRecipeCandidate("lunch", "2026-09-22", ctx);
  assert.equal(selected.recipe.name, "A Frisch", "Replan darf eine schlechter bewertete Rezeptoption nicht über Rotation bevorzugen");
});

test("freie bekannte Mahlzeit darf eine dritte passende Zutat erhalten, ohne neue FOODS einzuführen", () => {
  const { context, state } = loadPlanner();
  state.deferred["2026-09-22"] = true;
  const ctx = vm.runInContext("freshPlanContext()", context);
  const result = context.enrichKnownFreeMeal({
    meal: "lunch", active: true, focusId: "polenta", foodIds: ["polenta", "zucchini"],
    baseFoodIds: ["zucchini"], sampleFoodIds: [],
  }, "2026-09-22", ctx);
  assert.equal(result.foodIds.length, 3);
  assert.deepEqual(clone(result.sampleFoodIds), []);
  assert.ok(result.foodIds.every((id) => state.logs.some((log) => log.foodIds.includes(id))));
  assert.equal(result.portionTargetGrams, context.phasePortion());
});

test("Rezeptvorrat überspringt Stufe nur für ausdrücklich glatt pürierte und freigegebene Charge", () => {
  const { context, state } = loadPlanner();
  const recipe = {
    name: "Test-Chili", smoothBatchAllowed: true, category: "family",
    requires: ["Zucchini", "Hafer"], stage: 4, unlocked: false,
    ingredientMissing: [], requirementMissing: ["Darreichungsform: aktuell noch nicht passend"],
  };
  const batch = { id: "smooth-batch", kind: "recipe", recipeName: recipe.name, foodIds: ["zucchini", "hafer"], portions: 2, frozenDate: "2026-09-20", preparationMode: "spoon-smooth" };
  state.inventory.push(batch);
  state.settings.preferInventoryInPlan = true;
  state.settings.birthDate = "2026-01-24";
  assert.equal(context.plannerSmoothRecipeBatch(recipe, batch, "2026-09-22"), true);
  assert.equal(context.plannerRecipeBatchFor(recipe, "2026-09-22", { recipeReserved: new Map() })?.id, batch.id);
  batch.preparationMode = "";
  assert.equal(context.plannerRecipeBatchFor(recipe, "2026-09-22", { recipeReserved: new Map() }), null);
  batch.preparationMode = "spoon-smooth";
  assert.equal(context.plannerSmoothRecipeBatch({ ...recipe, hardMinMonths: 24 }, batch, "2026-09-22"), false);
  assert.equal(context.plannerSmoothRecipeBatch({ ...recipe, ingredientMissing: ["Tomate"] }, batch, "2026-09-22"), false);
  assert.equal(context.plannerSmoothRecipeBatch({ ...recipe, smoothBatchAllowed: false }, batch, "2026-09-22"), false);
});

test("glatt pürierte Vorratscharge bleibt als konkrete Darreichungsform im Plan erkennbar", () => {
  const { context, state } = loadPlanner();
  vm.runInContext(read("js/handling-readiness.js"), context);
  context.recipeByName = () => ({ name: "Test-Chili", smoothBatchAllowed: true });
  state.inventory.push({ id: "smooth", kind: "recipe", recipeName: "Test-Chili", portions: 2, preparationMode: "spoon-smooth" });
  const meal = { meal: "lunch", active: true, foodIds: ["zucchini", "hafer"], sampleFoodIds: [], recipeName: "Test-Chili", recipeInventoryId: "smooth", preparationMode: "spoon-smooth" };
  assert.equal(context.presentationModeForMeal(meal, { textureStage: 2 }), "spoon-smooth");
  state.inventory[0].preparationMode = "";
  assert.notEqual(context.presentationModeForMeal(meal, { textureStage: 2 }), "spoon-smooth");
});
