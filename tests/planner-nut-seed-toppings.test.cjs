"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const policy = require("../js/planner-food-role-stability.js");
const {
  installFoodRecipeComponentMetadata,
} = require("../js/recipe-v2-component-options.js");

function makeFood(id, name, category, overrides = {}) {
  return {
    id,
    name,
    category,
    priority: 1,
    active: true,
    meals: ["breakfast", "lunch", "dinner"],
    allergenGroup: "",
    safeForm: "",
    ...overrides,
  };
}

const FAMILY_FOODS = [
  makeFood("erdnuss", "Erdnuss", "Nuss", {
    allergenGroup: "Erdnuss",
    foodFamily: "nuss:erdnuss",
    allergenFamily: "nuss:erdnuss",
    priority: 10,
    safeForm: "Nur als glattes Mus oder sehr fein gemahlen und verdünnt; niemals ganze Nüsse.",
  }),
  makeFood("erdnussmus", "Erdnussmus", "Nuss", {
    allergenGroup: "Erdnuss",
    foodFamily: "nuss:erdnuss",
    allergenFamily: "nuss:erdnuss",
    priority: 11,
  }),
  makeFood("sesam", "Sesam", "Samen", {
    allergenGroup: "Sesam",
    foodFamily: "sesam",
    allergenFamily: "sesam",
    priority: 12,
    safeForm: "Sehr fein gemahlen oder als glattes Mus in kleiner Menge; keine harten ganzen Kerne.",
  }),
  makeFood("tahin", "Tahin", "Samen", {
    allergenGroup: "Sesam",
    foodFamily: "sesam",
    allergenFamily: "sesam",
    priority: 13,
  }),
  makeFood("hafer", "Hafer", "Getreide/Stärke", { priority: 2 }),
  makeFood("banane", "Banane", "Obst", { priority: 3 }),
  makeFood("apfel", "Apfel", "Obst", { priority: 4 }),
  makeFood("naturjoghurt", "Naturjoghurt", "Milchprodukt", { allergenGroup: "Milch", priority: 5 }),
];

installFoodRecipeComponentMetadata(FAMILY_FOODS);

test("Nuss/Samen: FOOD-Freigabe ersetzt die separate Mus-/Pasten-ID-Liste", () => {
  const peanut = FAMILY_FOODS.find((food) => food.id === "erdnuss");
  const sesame = FAMILY_FOODS.find((food) => food.id === "sesam");
  assert.equal(policy.plannerNutSeedPreferredToppingForm(peanut, FAMILY_FOODS)?.id, "erdnuss");
  assert.equal(policy.plannerNutSeedPreferredToppingForm(sesame, FAMILY_FOODS)?.id, "sesam");
  assert.equal(policy.plannerNutSeedToppingForm(peanut), true);
  assert.equal(policy.plannerNutSeedToppingForm(sesame), true);
  assert.equal(policy.plannerNutSeedToppingForm(FAMILY_FOODS.find((food) => food.id === "erdnussmus")), false);
});

test("Nuss/Samen: frühe bekannte Wiederholung bleibt Sample statt normalem Fokus", () => {
  const result = policy.plannerNutSeedNormalizeIntroductionResult(
    { f: FAMILY_FOODS.find((food) => food.id === "erdnuss"), type: "bekannt kombinieren" },
    FAMILY_FOODS,
  );
  assert.equal(result.f.id, "erdnuss");
  assert.equal(result.type, "gezielt wiederholen");
});

test("Nussmus-Topping: nur Obst+Getreide-Porridge ist ein passender Rezeptkandidat", () => {
  assert.equal(policy.plannerNutSeedFruitGrainPorridgeCandidate({
    recipe: { name: "Obst-Getreide-Brei", category: "porridge" }, ids: ["hafer", "banane"],
  }, FAMILY_FOODS), true);
  assert.equal(policy.plannerNutSeedFruitGrainPorridgeCandidate({
    recipe: { name: "Milch-Getreide-Brei", category: "porridge" }, ids: ["hafer", "naturjoghurt"],
  }, FAMILY_FOODS), false);
  assert.equal(policy.plannerNutSeedFruitGrainPorridgeCandidate({
    recipe: { name: "Bananen-Hafer-Pancakes", category: "pancakes" }, ids: ["hafer", "banane"],
  }, FAMILY_FOODS), false);
});

test("Nussmus-Topping: Rezeptzutaten müssen bekannt/auto-geeignet sein und das Sample bleibt außerhalb der Rezeptidentität", () => {
  const meal = {
    meal: "breakfast", active: true,
    foodIds: ["hafer", "erdnuss"], baseFoodIds: ["hafer"],
    sampleFoodIds: ["erdnuss"], type: "Allergen wiederholen",
  };
  const recipes = [
    { name: "Obst-Getreide-Brei", category: "porridge", requires: ["Hafer", "Banane"] },
    { name: "Milch-Getreide-Brei", category: "porridge", requires: ["Hafer", "Naturjoghurt"] },
  ];
  global.plannerProactiveRecipeNameVariants = (recipe) => [recipe.requires || []];
  try {
    const candidates = policy.plannerNutSeedToppingRecipeCandidates(
      meal, "erdnuss", recipes, FAMILY_FOODS,
      () => true,
      (name) => name !== "Naturjoghurt",
      () => true,
      () => true,
      "2026-08-19",
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].recipe.name, "Obst-Getreide-Brei");
    assert.deepEqual(Array.from(candidates[0].ids), ["banane", "hafer"]);
    assert.equal(candidates[0].ids.includes("erdnuss"), false);
    assert.deepEqual(Array.from(candidates[0].addedIds), ["banane"]);
  } finally {
    delete global.plannerProactiveRecipeNameVariants;
  }
});

function runtimeHarness() {
  const source = fs.readFileSync(path.join(root, "js", "planner-food-role-stability.js"), "utf8");
  const foods = FAMILY_FOODS.map((food) => ({ ...food, recipeComponentKinds: [...(food.recipeComponentKinds || [])] }));
  const byId = (id) => foods.find((food) => food.id === id);
  const state = { foods, overrides: {}, planLocks: {} };
  const recipe = {
    name: "Obst-Getreide-Brei",
    category: "porridge",
    requires: ["Hafer", "Banane"],
    milkMeal: "",
  };
  const context = {
    console,
    state,
    food: byId,
    esc: (value) => String(value ?? ""),
    save: () => {},
    renderAll: () => {},
    pruneIneligibleAutomaticPlanState: () => false,
    relatedFamilyFoodIds: (foodRecord, pool) => pool
      .filter((candidate) =>
        candidate.foodFamily === foodRecord.foodFamily ||
        candidate.allergenFamily === foodRecord.allergenFamily,
      )
      .map((candidate) => candidate.id),
    plannerFoodCanBeBase: () => true,
    plannerFoodCanBeAutomaticFocus: () => true,
    plannerAutomaticLockRoleViolation: () => false,
    eligible: (foodRecord, meal) => !!foodRecord?.active && (foodRecord.meals || []).includes(meal),
    introductionCandidate: () => ({ f: byId("erdnuss"), type: "Allergen einführen" }),
    knownCandidate: (meal, on, ctx, exclude = []) => {
      const pool = [byId("erdnuss"), byId("apfel")].filter((item) => !exclude.includes(item.id));
      return pool[0] ? { f: pool[0], type: "bekannt / kombiniert" } : null;
    },
    chooseFocus: (meal, on, exclude = []) => {
      const pool = [byId("erdnuss"), byId("apfel")].filter((item) => !exclude.includes(item.id));
      return pool[0] ? { f: pool[0], type: "bekannt" } : null;
    },
    manualMealRoleInfo: (foodOrId) => {
      const item = typeof foodOrId === "string" ? byId(foodOrId) : foodOrId;
      return { food: item, role: ["Nuss", "Samen"].includes(item?.category) ? "component" : "base" };
    },
    manualMealRoleState: () => null,
    compactMealRolesHtml: () => "",
    lockedMeal: () => null,
    buildDay: () => ({
      date: "2026-08-19",
      index: 0,
      meals: [{
        meal: "breakfast",
        active: true,
        focusId: "erdnuss",
        foodIds: ["hafer", "erdnuss"],
        baseFoodIds: ["hafer"],
        sampleFoodIds: ["erdnuss"],
        foodRoles: { hafer: "base", erdnuss: "sample" },
        optionalAddons: [],
        inventoryFoodIds: [],
        recipeName: "",
        type: "Allergen wiederholen",
        note: "Allergen mit bekannter Basis gezielt wiederholen.",
      }],
    }),
    recipeStates: () => [recipe],
    plannerRecipeSuitableForMeal: () => true,
    recipeIngredientReady: () => true,
    plannerProactiveRuntimeFoodEligible: () => true,
    plannerProactiveRecipeNameVariants: (item) => [item.requires || []],
    plannerProactiveRecipeRoleState: (meal, candidate) => ({
      ids: [...candidate.ids],
      bases: [...candidate.ids],
      samples: [],
      components: [],
      foodRoles: Object.fromEntries(candidate.ids.map((id) => [id, "base"])),
    }),
    plannerSelectProactiveRecipe: (candidates) => candidates[0] || null,
    plannerApplyProactiveRecipeMeal: (meal, candidate, date, ctx, reserveFn, roleState) => {
      meal.foodIds = [...roleState.ids];
      meal.baseFoodIds = [...roleState.bases];
      meal.sampleFoodIds = [];
      meal.foodRoles = { ...roleState.foodRoles };
      meal.recipeName = candidate.recipe.name;
      meal.recipeInventoryId = "";
      meal.type = "Rezept";
      reserveFn?.(meal, ctx);
      return meal;
    },
    reserveMealInventory: () => {},
    plannerRecipeMilkContextCompatible: () => true,
    recipeContainsMeatOrFish: () => false,
    applyPlannedMealAmounts: (meal) => {
      meal.__amountsReapplied = true;
      return meal;
    },
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__install = installPlannerFoodRoleStabilityRuntime;`, context);
  assert.equal(context.__install(), true);
  return context;
}

test("Runtime: Nuss/Samen werden nicht Basis oder normaler bekannter Fokus, Sample-Pfade bleiben möglich", () => {
  const context = runtimeHarness();
  assert.equal(context.plannerFoodCanBeBase(context.food("erdnuss")), false);
  assert.equal(context.plannerFoodCanBeBase(context.food("sesam")), false);
  assert.equal(context.plannerFoodCanBeBase(context.food("hafer")), true);
  const intro = context.introductionCandidate("breakfast", "2026-08-19", { reserved: new Set() }, []);
  assert.equal(intro.f.id, "erdnuss");
  assert.equal(intro.type, "Allergen einführen");
  assert.equal(context.knownCandidate("breakfast", "2026-08-19", {}, []).f.id, "apfel");
  assert.equal(context.chooseFocus("breakfast", "2026-08-19", [], "2026-08-19|breakfast").f.id, "apfel");
});

test("Runtime: bestehender manueller Override auf Nuss/Samen wird Sample statt Hauptfokus", () => {
  const context = runtimeHarness();
  context.state.overrides["2026-08-19|breakfast"] = "erdnuss";
  const result = context.knownCandidate("breakfast", "2026-08-19", {}, []);
  assert.equal(result.f.id, "erdnuss");
  assert.equal(result.type, "manuell");
});

test("Runtime: alte automatische Nuss-/Samen-Hauptfokusse werden ungültig, echte Samples bleiben gültig", () => {
  const context = runtimeHarness();
  assert.equal(context.plannerAutomaticLockRoleViolation({
    mode: "auto", focusId: "erdnuss", foodIds: ["erdnuss", "hafer"],
    baseFoodIds: ["hafer"], sampleFoodIds: [], type: "bekannt",
  }, context.state.foods), true);
  assert.equal(context.plannerAutomaticLockRoleViolation({
    mode: "auto", focusId: "erdnuss", foodIds: ["hafer", "erdnuss"],
    baseFoodIds: ["hafer"], sampleFoodIds: ["erdnuss"], type: "Allergen wiederholen",
  }, context.state.foods), false);
});

test("Runtime: FOOD-freigegebenes Erdnuss-Sample wird als Topping auf eindeutigen Obst-Getreide-Brei übernommen", () => {
  const context = runtimeHarness();
  const meal = context.buildDay("2026-08-19", 0, { recipePlannedUse: new Map() }).meals[0];
  assert.equal(meal.recipeName, "Obst-Getreide-Brei");
  assert.deepEqual(Array.from(meal.foodIds).sort(), ["banane", "erdnuss", "hafer"]);
  assert.deepEqual(Array.from(meal.baseFoodIds).sort(), ["banane", "hafer"]);
  assert.deepEqual(Array.from(meal.sampleFoodIds), ["erdnuss"]);
  assert.equal(meal.foodRoles.erdnuss, "sample");
  assert.equal(meal.type, "Allergen wiederholen");
  assert.equal(meal.__amountsReapplied, true);
  assert.match(meal.note, /Erdnuss als Kostproben-Topping zum Obst-Getreide-Brei/);
});
