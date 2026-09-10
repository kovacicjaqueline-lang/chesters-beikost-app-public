"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appVersion = JSON.parse(fs.readFileSync(path.join(root, "VERSION.json"), "utf8")).version;
const planningSource = fs.readFileSync(path.join(root, "js", "planning.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const rolePolicySource = fs.readFileSync(path.join(root, "js", "planner-food-role-stability.js"), "utf8");
const rolePolicy = require("../js/planner-food-role-stability.js");

function makeFood(id, name, category, rankValue) {
  return {
    id,
    name,
    category,
    meals: ["lunch", "dinner"],
    active: true,
    allergenGroup: "",
    priority: id === "kartoffel" ? 1 : 2,
    manualStatus: rankValue >= 2 ? "Verträgliche Basis" : "Probiert",
  };
}

function buildRuntime() {
  const date = "2026-08-18";
  const kartoffel = makeFood("kartoffel", "Kartoffel", "Wurzel/Knolle", 3);
  const gurke = makeFood("gurke", "Gurke", "Gemüse", 1);
  const foods = [kartoffel, gurke];
  const ranks = { kartoffel: 3, gurke: 1 };
  const context = {};
  vm.createContext(context);
  vm.runInContext(planningSource, context);

  const state = {
    foods,
    logs: [
      {
        id: "log-gurke-1",
        date: "2026-08-17",
        meal: "lunch",
        foodIds: ["gurke"],
        foodOutcomes: { gurke: "eaten" },
      },
    ],
    inventory: [],
    overrides: { [`${date}|lunch`]: "kartoffel" },
    deferred: {},
    planLocks: {},
    autoLockExcluded: {},
    manualMeals: {},
    shoppingHints: {},
    pantry: {},
    followUps: {},
    settings: {
      startDate: "2026-07-14",
      birthDate: "2026-01-24",
      phaseSelected: "aufbau",
      amountSelected: "taste",
      newFoodEvery: 2,
      preferInventoryInPlan: false,
      seasonal: false,
    },
  };

  context.state = state;
  context.FOOD_DB = foods;
  context.ID_ALIASES = {};
  context.RECIPES = [];
  context.rank = (item) => Number(ranks[item?.id] ?? 0);
  context.status = (item) => {
    const value = Number(ranks[item?.id] ?? 0);
    return value >= 3 ? "Regelmäßig" : value >= 2 ? "Verträgliche Basis" : value >= 1 ? "Probiert" : "Offen";
  };
  context.outcomeForFood = (log, id) => log?.foodOutcomes?.[id] || "not_offered";
  context.today = () => date;
  context.diffDays = (a, b) => Math.floor((new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000);
  context.food = (id) => state.foods.find((item) => item.id === id) || null;
  context.isFoodUnavailable = () => false;
  context.activeMeal = (meal) => meal === "lunch";
  context.companionFor = (_focus, meal) => meal === "lunch" ? gurke : null;
  context.foodIllustrationPath = () => "";
  context.bootstrapStorage = async () => {};
  context.recipeStates = () => [];
  context.recipeInventoryPortions = () => 0;
  context.oldestRecipeBatch = () => null;
  context.combinationPaused = () => false;
  context.enforceSingleStarch = (_focus, companions) => companions;
  context.ironCompanion = () => null;
  context.currentAmountLevel = () => "taste";
  context.AMOUNT_LEVELS = { taste: { rank: 0, targetGrams: 25 } };
  context.phasePortion = () => 25;
  context.applyPlannedMealAmounts = (meal) => ({ ...meal, ingredientAmounts: Object.fromEntries((meal.foodIds || []).map((id) => [id, 12])) });
  context.reserveMealInventory = (meal) => meal;
  context.isStarchyFood = (item) => item?.category === "Wurzel/Knolle";
  context.compactMealRolesHtml = () => "";
  context.esc = (value) => String(value ?? "");
  context.save = () => Promise.resolve();

  vm.runInContext(appSource, context);
  context.installFoodPolicyRuntime();
  vm.runInContext(rolePolicySource, context);
  assert.equal(context.installPlannerFoodRoleStabilityRuntime(), true);

  return { date, state, context };
}

function plannerContext() {
  return {
    reserved: new Set(),
    introduced: [],
    plannedUse: new Map(),
    lastFocus: new Map(),
    inventoryReserved: new Map(),
    recipeReserved: new Map(),
    recipePlannedUse: new Map(),
    fullMilkDates: new Set(),
  };
}

test("PLAN-08 P0: Kartoffel + Gurke hat unmittelbar nach automatischer Planung kanonische Rollen", () => {
  const { date, context } = buildRuntime();
  const day = context.buildDay(date, 1, plannerContext());
  const lunch = day.meals.find((meal) => meal.meal === "lunch");

  assert.ok(lunch);
  assert.deepEqual(Array.from(lunch.foodIds), ["kartoffel", "gurke"]);
  assert.deepEqual(Array.from(lunch.baseFoodIds), ["kartoffel"]);
  assert.deepEqual(Array.from(lunch.sampleFoodIds), []);
  assert.deepEqual(JSON.parse(JSON.stringify(lunch.foodRoles)), {
    kartoffel: "base",
    gurke: "component",
  });

  const validation = context.manualMealValidation(lunch, "lunch", date);
  assert.equal(validation.ok, true, validation.message);
  assert.deepEqual(Array.from(validation.bases), ["kartoffel"]);
  assert.deepEqual(Array.from(validation.components), ["gurke"]);

  const prepared = context.prepareManualMealData(lunch, "lunch", date);
  assert.equal(prepared.ok, true, prepared.message);
  assert.deepEqual(Array.from(prepared.data.baseFoodIds), ["kartoffel"]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(prepared.data.foodRoles)),
    JSON.parse(JSON.stringify(lunch.foodRoles)),
  );
});

test("PLAN-08 P0: Rollen bleiben über Auto-Snapshot, JSON-Roundtrip und Hydration identisch", () => {
  const { date, state, context } = buildRuntime();
  const lunch = context.buildDay(date, 1, plannerContext()).meals.find((meal) => meal.meal === "lunch");
  const snapshot = context.mealSnapshot(date, "lunch", lunch, "auto");
  const persisted = JSON.parse(JSON.stringify(snapshot));

  assert.deepEqual(persisted.baseFoodIds, ["kartoffel"]);
  assert.deepEqual(persisted.foodRoles, { kartoffel: "base", gurke: "component" });

  state.planLocks[`${date}|lunch`] = persisted;
  const hydrated = context.lockedMeal(date, "lunch");
  assert.deepEqual(Array.from(hydrated.baseFoodIds), ["kartoffel"]);
  assert.deepEqual(JSON.parse(JSON.stringify(hydrated.foodRoles)), {
    kartoffel: "base",
    gurke: "component",
  });

  const validation = context.manualMealValidation(hydrated, "lunch", date);
  assert.equal(validation.ok, true, validation.message);
  assert.deepEqual(Array.from(validation.bases), ["kartoffel"]);
  assert.deepEqual(Array.from(validation.components), ["gurke"]);
});

test("PLAN-08 P0: bestehender falscher Auto-Lock wird beim Hydratisieren repariert, Validierung bleibt streng", async () => {
  const { date, state, context } = buildRuntime();
  state.planLocks[`${date}|lunch`] = {
    date,
    meal: "lunch",
    active: true,
    focusId: "kartoffel",
    foodIds: ["kartoffel", "gurke"],
    baseFoodIds: ["gurke"],
    sampleFoodIds: [],
    foodRoles: { kartoffel: "component", gurke: "base" },
    recipeName: "",
    recipeInventoryId: "",
    type: "bekannt",
    note: "Legacy-Auto-Lock mit vertauschten Rollen.",
    mode: "auto",
  };

  const before = context.manualMealValidation(state.planLocks[`${date}|lunch`], "lunch", date);
  assert.equal(before.ok, false);
  assert.match(before.message, /Noch nicht als Hauptbasis geeignet: Gurke/);

  const hydrated = context.lockedMeal(date, "lunch");
  assert.deepEqual(Array.from(hydrated.baseFoodIds), ["kartoffel"]);
  assert.deepEqual(JSON.parse(JSON.stringify(hydrated.foodRoles)), {
    kartoffel: "base",
    gurke: "component",
  });
  assert.deepEqual(Array.from(state.planLocks[`${date}|lunch`].baseFoodIds), ["kartoffel"]);
  assert.deepEqual(JSON.parse(JSON.stringify(state.planLocks[`${date}|lunch`].foodRoles)), {
    kartoffel: "base",
    gurke: "component",
  });

  const after = context.manualMealValidation(hydrated, "lunch", date);
  assert.equal(after.ok, true, after.message);
  await Promise.resolve();
});

test("PLAN-08 P0: Wochenkarte verwendet denselben Rollenvertrag wie der Editor", () => {
  const { date, context } = buildRuntime();
  const lunch = context.buildDay(date, 1, plannerContext()).meals.find((meal) => meal.meal === "lunch");
  const rows = rolePolicy.plannerCompactFoodRoleRows(
    JSON.parse(JSON.stringify(lunch)),
    (meal) => context.manualMealRoleState(meal),
  );

  assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
    { id: "kartoffel", role: "base", label: "Hauptmahlzeit" },
    { id: "gurke", role: "component", label: "Bestandteil" },
  ]);

  const html = context.compactMealRolesHtml(lunch);
  assert.match(html, /Kartoffel/);
  assert.match(html, /Hauptmahlzeit/);
  assert.match(html, /Gurke/);
  assert.match(html, /Bestandteil/);
});

test("PLAN-08 P0: Einführung behält sichere Basis und genau eine Kostprobe", () => {
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "neu",
    foodIds: ["kartoffel", "neu"],
    baseFoodIds: ["kartoffel"],
    sampleFoodIds: ["neu"],
    foodRoles: { kartoffel: "base", neu: "sample" },
    recipeName: "",
    type: "neu",
  };
  const roles = rolePolicy.plannerAutomaticFoodRoleState(
    meal,
    (id) => id === "kartoffel" ? { role: "base" } : { role: "sample" },
    "2026-08-18",
  );
  assert.deepEqual(roles, {
    ids: ["kartoffel", "neu"],
    bases: ["kartoffel"],
    samples: ["neu"],
    components: [],
    foodRoles: { kartoffel: "base", neu: "sample" },
  });
});

test("PLAN-08 P0: Loader installiert Proactive Recipe-first, Rollenstabilität, Qualitätsrotation, Einführungspolicy und Allergenpflege vor dem sichtbaren Abschlussrender", () => {
  const utils = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");
  assert.ok(utils.includes(`planner-proactive-recipe.js?v=${appVersion}`));
  assert.ok(utils.includes(`planner-quality-rotation.js?v=${appVersion}`));
  assert.ok(utils.includes(`planner-introduction-policy.js?v=${appVersion}`));
  assert.ok(utils.includes(`planner-allergen-maintenance.js?v=${appVersion}`));
  assert.match(utils, /installPlannerRecipeFirstRuntime\(\);\s*loadProactiveRecipePolicy\(\);/);
  assert.match(utils, /installPlannerProactiveRecipeRuntime\(\);\s*loadRoleStabilityPolicy\(\);/);
  assert.match(utils, /installPlannerFoodRoleStabilityRuntime\(\);\s*loadQualityPolicy\(\);/);
  assert.match(utils, /installPlannerQualityRotationRuntime\(\);\s*loadIntroductionPolicy\(\);/);
  assert.match(utils, /installPlannerIntroductionPolicyRuntime\(\);\s*loadMaintenancePolicy\(\);/);
  assert.match(utils, /PlannerAllergenMaintenance[\s\S]*finishPlannerPolicies\(\);/);
});