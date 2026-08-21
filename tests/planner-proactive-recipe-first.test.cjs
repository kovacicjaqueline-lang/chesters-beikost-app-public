"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { plannerRecipeSuitableForMeal } = require("../app.js");
const proactive = require("../js/planner-proactive-recipe.js");

const root = path.resolve(__dirname, "..");
const policySource = fs.readFileSync(path.join(root, "js", "planner-proactive-recipe.js"), "utf8");

function loadConstant(pathname, expression) {
  const source = fs.readFileSync(path.join(root, pathname), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__VALUE = ${expression};`, context);
  return JSON.parse(JSON.stringify(context.__VALUE));
}

const foods = loadConstant("data/foods.js", "FOOD_DB");
const recipes = loadConstant("data/recipes.js", "RECIPES");
const byName = (name) => foods.find((item) => item.name === name);

function mealFor(names, sampleNames = [], meal = "lunch") {
  return {
    meal,
    active: true,
    focusId: byName(names[0])?.id || names[0],
    foodIds: names.map((name) => byName(name)?.id || name),
    baseFoodIds: names.slice(1).map((name) => byName(name)?.id || name),
    sampleFoodIds: sampleNames.map((name) => byName(name)?.id || name),
    recipeName: "",
  };
}

function syntheticFood(id, name, meals = ["lunch", "dinner"]) {
  return { id, name, meals, active: true, category: "Gemüse" };
}

test("PLAN-08 proactive: bekannte Zweierkombination kann zu eindeutigem komplexeren Rezept erweitert werden", () => {
  const meal = mealFor(["Huhn", "Zucchini"]);
  const ready = new Set(["Huhn", "Zucchini", "Hafer"]);
  const candidates = proactive.plannerProactiveRecipeCandidates(
    meal,
    recipes,
    foods,
    plannerRecipeSuitableForMeal,
    (name) => ready.has(name),
    () => true,
    () => true,
    "2026-08-18",
  );
  assert.ok(candidates.some((candidate) => candidate.recipe.name === "Geflügel-Gemüse-Hafer-Bällchen"));
  const selected = proactive.plannerSelectProactiveRecipe(
    candidates.filter((candidate) => candidate.recipe.name === "Geflügel-Gemüse-Hafer-Bällchen"),
    { recipePlannedUse: new Map() },
  );
  assert.equal(selected.recipe.name, "Geflügel-Gemüse-Hafer-Bällchen");
  assert.ok(selected.addedIds.includes(byName("Hafer").id));
});

test("PLAN-08 proactive: genau EIN neues Lebensmittel im Rezept ist erlaubt", () => {
  const localFoods = [
    syntheticFood("basis", "Basis"),
    syntheticFood("neu", "Neu"),
    syntheticFood("hafer", "Hafer"),
  ];
  const localRecipe = {
    name: "Basis-Neu-Hafer-Rezept",
    category: "balls",
    requires: ["Basis", "Neu", "Hafer"],
    requirementMissing: [],
  };
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "neu",
    foodIds: ["basis", "neu"],
    baseFoodIds: ["basis"],
    sampleFoodIds: ["neu"],
    recipeName: "",
    type: "neu",
  };
  const candidates = proactive.plannerProactiveRecipeCandidates(
    meal,
    [localRecipe],
    localFoods,
    () => true,
    (name) => name !== "Neu",
    () => true,
  );
  assert.equal(candidates.length, 1);
  assert.deepEqual(Array.from(candidates[0].addedIds), ["hafer"]);
  assert.equal(candidates[0].sampleFoodId, "neu");
});

test("PLAN-08 proactive: zwei neue Lebensmittel werden nie über ein Rezept eingeführt", () => {
  const localFoods = [
    syntheticFood("basis", "Basis"),
    syntheticFood("neu-a", "Neu A"),
    syntheticFood("neu-b", "Neu B"),
  ];
  const recipe = {
    name: "Zwei-Neue-Rezept",
    category: "balls",
    requires: ["Basis", "Neu A", "Neu B"],
    requirementMissing: [],
  };
  const twoSamples = {
    meal: "lunch",
    active: true,
    focusId: "neu-a",
    foodIds: ["basis", "neu-a", "neu-b"],
    baseFoodIds: ["basis"],
    sampleFoodIds: ["neu-a", "neu-b"],
    recipeName: "",
  };
  assert.equal(
    proactive.plannerProactiveRecipeCandidates(twoSamples, [recipe], localFoods, () => true, (name) => name === "Basis", () => true).length,
    0,
  );

  const oneSampleButSecondUnknown = {
    ...twoSamples,
    foodIds: ["basis", "neu-a"],
    sampleFoodIds: ["neu-a"],
  };
  assert.equal(
    proactive.plannerProactiveRecipeCandidates(oneSampleButSecondUnknown, [recipe], localFoods, () => true, (name) => name === "Basis", () => true).length,
    0,
  );
});

test("PLAN-08 proactive: ohne Einführung darf das Rezept keine unbekannte Zutat ergänzen", () => {
  const localFoods = [
    syntheticFood("a", "A"),
    syntheticFood("b", "B"),
    syntheticFood("neu", "Neu"),
  ];
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "a",
    foodIds: ["a", "b"],
    baseFoodIds: ["b"],
    sampleFoodIds: [],
    recipeName: "",
  };
  const recipe = { name: "A-B-Neu", category: "balls", requires: ["A", "B", "Neu"], requirementMissing: [] };
  assert.equal(
    proactive.plannerProactiveRecipeCandidates(meal, [recipe], localFoods, () => true, (name) => name !== "Neu", () => true).length,
    0,
  );
});

test("PLAN-08 proactive: ergänzte bekannte Zutaten müssen für die Mahlzeit automatisch geeignet sein", () => {
  const localFoods = [
    syntheticFood("a", "A"),
    syntheticFood("b", "B"),
    syntheticFood("c", "C", ["dinner"]),
  ];
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "a",
    foodIds: ["a", "b"],
    baseFoodIds: ["b"],
    sampleFoodIds: [],
    recipeName: "",
  };
  const recipe = { name: "A-B-C", category: "balls", requires: ["A", "B", "C"], requirementMissing: [] };
  assert.equal(
    proactive.plannerProactiveRecipeCandidates(
      meal,
      [recipe],
      localFoods,
      () => true,
      () => true,
      (item, mealKey) => item.meals.includes(mealKey),
    ).length,
    0,
  );
});

test("PLAN-08 proactive: gleichrangige unterschiedliche Rezeptformen werden nicht geraten", () => {
  const candidates = [
    { recipe: { name: "Pancake" }, ids: ["a", "b", "c"], addedIds: ["c"] },
    { recipe: { name: "Brot" }, ids: ["a", "b", "c"], addedIds: ["c"] },
  ];
  assert.equal(proactive.plannerSelectProactiveRecipe(candidates, { recipePlannedUse: new Map() }), null);
  assert.equal(
    proactive.plannerSelectProactiveRecipe(candidates, { recipePlannedUse: new Map([["Pancake", 2], ["Brot", 0]]) }).recipe.name,
    "Brot",
  );
});

test("PLAN-08 proactive: Rezept mit Kostprobe behält kanonische base/component/sample-Rollen", () => {
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "neu",
    foodIds: ["basis", "neu"],
    baseFoodIds: ["basis"],
    sampleFoodIds: ["neu"],
    recipeName: "",
    type: "neu",
  };
  const candidate = {
    recipe: { name: "Basis-Neu-Hafer-Rezept" },
    ids: ["basis", "neu", "hafer"],
    addedIds: ["hafer"],
  };
  const roles = proactive.plannerProactiveRecipeRoleState(
    meal,
    candidate,
    "2026-08-18",
    (id) => id === "basis" ? { role: "base" } : id === "hafer" ? { role: "component" } : { role: "sample" },
  );
  assert.deepEqual(JSON.parse(JSON.stringify(roles)), {
    ids: ["basis", "hafer", "neu"],
    bases: ["basis"],
    samples: ["neu"],
    components: ["hafer"],
    foodRoles: { basis: "base", hafer: "component", neu: "sample" },
  });
});

test("PLAN-08 proactive: Runtime erhält Einführungstyp, Kostprobe und Rollenvertrag im Rezept", () => {
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "neu",
    foodIds: ["basis", "neu"],
    baseFoodIds: ["basis"],
    sampleFoodIds: ["neu"],
    inventoryFoodIds: [],
    recipeName: "",
    recipeInventoryId: "",
    milkMeal: "",
    type: "neu",
    note: "Neue Kostprobe.",
  };
  const recipe = {
    name: "Basis-Neu-Hafer-Rezept",
    category: "balls",
    requires: ["Basis", "Neu", "Hafer"],
    requirementMissing: [],
  };
  const context = {
    state: {
      foods: [
        syntheticFood("basis", "Basis"),
        syntheticFood("neu", "Neu"),
        syntheticFood("hafer", "Hafer"),
      ],
      settings: {},
    },
    buildDay: () => ({ date: "2026-08-18", meals: [JSON.parse(JSON.stringify(meal))] }),
    recipeStates: () => [recipe],
    plannerRecipeSuitableForMeal: () => true,
    recipeIngredientReady: (name) => name !== "Neu",
    recipeContainsMeatOrFish: () => false,
    plannerRecipeFirstFreshMeal: (entry) => entry?.type === "Rezept" && !!entry.recipeName,
    plannerRecipeMilkContextCompatible: () => true,
    manualMealRoleInfo: (id) => id === "basis" ? { role: "base" } : id === "hafer" ? { role: "component" } : { role: "sample" },
    reserveMealInventory: (entry) => {
      entry.__reservedAsFreshRecipe = context.plannerRecipeFirstFreshMeal(entry);
      return entry;
    },
    plannerReleaseFoodInventoryReservations: () => {},
    applyPlannedMealAmounts: (entry) => { entry.__amountsRebuilt = true; return entry; },
    food: (id) => context.state.foods.find((item) => item.id === id),
  };
  vm.createContext(context);
  vm.runInContext(`${policySource}\nthis.__install = installPlannerProactiveRecipeRuntime;`, context);
  assert.equal(context.__install(), true);
  const ctx = { recipePlannedUse: new Map() };
  const planned = context.buildDay("2026-08-18", 0, ctx).meals[0];
  assert.equal(planned.recipeName, recipe.name);
  assert.equal(planned.type, "neu");
  assert.deepEqual(Array.from(planned.sampleFoodIds), ["neu"]);
  assert.deepEqual(Array.from(planned.baseFoodIds), ["basis"]);
  assert.deepEqual(JSON.parse(JSON.stringify(planned.foodRoles)), { basis: "base", hafer: "component", neu: "sample" });
  assert.equal(planned.__reservedAsFreshRecipe, true);
  assert.equal(planned.__amountsRebuilt, true);
  assert.equal(ctx.recipePlannedUse.get(recipe.name), 1);
  assert.equal(context.plannerRecipeFirstFreshMeal(planned), true);
});

test("PLAN-08 proactive: Browser-Loader installiert Proactive Recipe-first vor Rollenstabilität und sichtbarem Render", () => {
  const utils = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");
  assert.match(utils, /planner-proactive-recipe\.js\?v=\d+\.\d+\.\d+/);
  assert.match(utils, /installPlannerRecipeFirstRuntime\(\);\s*loadProactiveRecipePolicy\(\);/);
  assert.match(utils, /installPlannerProactiveRecipeRuntime\(\);\s*loadRoleStabilityPolicy\(\);/);
});

test("PLAN-08 proactive: erster Offline-Start precached Rollenstabilität und Proactive Recipe-first", () => {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.match(sw, /\.\/js\/planner-proactive-recipe\.js/);
  assert.match(sw, /\.\/js\/planner-food-role-stability\.js/);
});
