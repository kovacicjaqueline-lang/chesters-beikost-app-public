"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { plannerRecipeSuitableForMeal } = require("../app.js");
const recipeFirst = require("../js/planner-recipe-first.js");

const root = path.resolve(__dirname, "..");
const policySource = fs.readFileSync(path.join(root, "js", "planner-recipe-first.js"), "utf8");

function loadConstant(pathname, expression) {
  const source = fs.readFileSync(path.join(root, pathname), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__VALUE = ${expression};`, context);
  return JSON.parse(JSON.stringify(context.__VALUE));
}

const foods = loadConstant("data/foods.js", "FOOD_DB");
const recipes = loadConstant("data/recipes.js", "RECIPES");
const foodId = (name) => foods.find((item) => item.name === name)?.id;

function candidates(names, meal) {
  return recipeFirst.plannerExactRecipeCandidates(
    names.map(foodId).filter(Boolean),
    meal,
    recipes,
    foods,
    plannerRecipeSuitableForMeal,
    () => true,
  );
}

function exact(names, meal) {
  return recipeFirst.plannerSelectExactRecipe(candidates(names, meal));
}

function runtimeContext({
  meal,
  recipe,
  suitable = () => true,
  coreSuitable = () => true,
  preferInventory = false,
  inventoryPortions = 0,
} = {}) {
  const state = {
    foods: (meal?.foodIds || []).map((id) => ({ id, name: id })),
    settings: { preferInventoryInPlan: preferInventory },
  };
  const context = {
    state,
    buildDay: () => ({
      date: "2026-08-18",
      meals: [JSON.parse(JSON.stringify(meal))],
    }),
    recipeStates: () => [recipe],
    plannerRecipeSuitableForMeal: suitable,
    recipeSuitableForMeal: coreSuitable,
    recipeIngredientReady: () => true,
    recipeContainsMeatOrFish: () => false,
    recipeInventoryPortions: () => inventoryPortions,
    reserveMealInventory: (plannedMeal, ctx) => {
      if (!preferInventory || inventoryPortions <= (ctx.recipeReserved?.get(recipe.name) || 0)) return plannedMeal;
      plannedMeal.recipeInventoryId = "recipe-batch-1";
      ctx.recipeReserved?.set(recipe.name, (ctx.recipeReserved.get(recipe.name) || 0) + 1);
      plannedMeal.inventoryFoodIds = [];
      return plannedMeal;
    },
  };
  vm.createContext(context);
  vm.runInContext(`${policySource}\nthis.__installRecipeFirst = installPlannerRecipeFirstRuntime;`, context);
  return context;
}

test("PLAN-08 recipe-first: exakte Rezeptkandidaten werden erkannt, aber mehrdeutige Darreichungsformen nicht geraten", () => {
  const breakfastNames = candidates(["Banane", "Hafer", "Ei"], "breakfast").map((recipe) => recipe.name);
  assert.ok(breakfastNames.includes("Obst-Hafer-Pancakes"));
  assert.ok(breakfastNames.includes("Baby-Bananenbrot"));
  assert.equal(exact(["Banane", "Hafer", "Ei"], "breakfast"), null);

  const lunchNames = candidates(["Huhn", "Zucchini", "Hafer"], "lunch").map((recipe) => recipe.name);
  assert.ok(lunchNames.includes("Geflügel-Gemüse-Hafer-Bällchen"));
});

test("PLAN-08 recipe-first: eindeutige Zweierrezepte werden erkannt, mehrdeutige bleiben FOOD-only", () => {
  assert.equal(exact(["Lachs", "Kartoffel"], "lunch")?.name, "Lachs-Kartoffel-Bällchen");
  const broccoliNames = candidates(["Brokkoli", "Kartoffel"], "lunch").map((recipe) => recipe.name);
  assert.ok(broccoliNames.includes("Brokkoli-Kartoffel-Stampf"));
  assert.ok(broccoliNames.includes("Brokkoli-Kartoffel-Taler"));
  assert.equal(exact(["Brokkoli", "Kartoffel"], "lunch"), null);
});

test("PLAN-08 recipe-first: fehlende Rezeptzutat wird nicht erfunden", () => {
  assert.equal(exact(["Banane", "Ei"], "breakfast"), null);
  assert.equal(exact(["Süßkartoffel", "Gurke"], "lunch"), null);
});

test("PLAN-08 recipe-first: kanonische Rezept-Mahlzeiteneignung bleibt hart", () => {
  assert.equal(exact(["Lachs", "Kartoffel"], "breakfast"), null);
  const excluded = { name: "Test", category: "baking", excludeMeals: ["breakfast"] };
  assert.equal(plannerRecipeSuitableForMeal(excluded, "breakfast"), false);
});

test("PLAN-08 recipe-first: Runtime verwendet plannerRecipeSuitableForMeal statt des älteren Core-Fallbacks", () => {
  const meal = {
    meal: "breakfast",
    active: true,
    focusId: "a",
    foodIds: ["a", "b"],
    baseFoodIds: ["b"],
    sampleFoodIds: [],
    inventoryFoodIds: [],
    recipeName: "",
  };
  const recipe = { name: "Nicht zum Frühstück", requires: ["a", "b"], requirementMissing: [] };
  const context = runtimeContext({ meal, recipe, suitable: () => false, coreSuitable: () => true });
  assert.equal(context.__installRecipeFirst(), true);
  assert.equal(context.buildDay("2026-08-18", 0, { recipePlannedUse: new Map() }).meals[0].recipeName, "");
});

test("PLAN-08 recipe-first: Runtime bucht Promotion in Rezeptrotation und bevorzugten Rezeptvorrat ein", () => {
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "huhn",
    foodIds: ["huhn", "zucchini", "hafer"],
    baseFoodIds: ["zucchini", "hafer"],
    sampleFoodIds: [],
    inventoryFoodIds: ["huhn"],
    recipeName: "",
    note: "Bekannte Lebensmittel sinnvoll rotieren.",
  };
  const recipe = {
    name: "Geflügel-Gemüse-Hafer-Bällchen",
    requires: ["huhn", "zucchini", "hafer"],
    requirementMissing: [],
  };
  const context = runtimeContext({ meal, recipe, preferInventory: true, inventoryPortions: 1 });
  assert.equal(context.__installRecipeFirst(), true);
  const ctx = {
    inventoryReserved: new Map([["huhn", 1]]),
    recipeReserved: new Map(),
    recipePlannedUse: new Map(),
    fullMilkDates: new Set(),
  };
  const planned = context.buildDay("2026-08-18", 0, ctx).meals[0];
  assert.equal(planned.recipeName, "Geflügel-Gemüse-Hafer-Bällchen");
  assert.equal(planned.recipeInventoryId, "recipe-batch-1");
  assert.equal(planned.type, "Rezeptvorrat");
  assert.equal(Array.from(planned.inventoryFoodIds || []).length, 0);
  assert.equal(ctx.inventoryReserved.has("huhn"), false);
  assert.equal(ctx.recipeReserved.get(recipe.name), 1);
  assert.equal(ctx.recipePlannedUse.get(recipe.name), 1);
  assert.match(planned.note, /Passendes vorhandenes Rezept/);
});

test("PLAN-08 recipe-first: frisches Rezept wird ohne erfundene Vorratsportion als Rezept geführt", () => {
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "a",
    foodIds: ["a", "b"],
    baseFoodIds: ["b"],
    sampleFoodIds: [],
    inventoryFoodIds: ["a"],
    recipeName: "",
  };
  const recipe = { name: "Frisches Rezept", requires: ["a", "b"], requirementMissing: [] };
  const context = runtimeContext({ meal, recipe, preferInventory: false, inventoryPortions: 1 });
  assert.equal(context.__installRecipeFirst(), true);
  const ctx = {
    inventoryReserved: new Map([["a", 1]]),
    recipeReserved: new Map(),
    recipePlannedUse: new Map(),
  };
  const planned = context.buildDay("2026-08-18", 0, ctx).meals[0];
  assert.equal(planned.recipeName, "Frisches Rezept");
  assert.equal(planned.recipeInventoryId, "");
  assert.equal(planned.type, "Rezept");
  assert.equal(ctx.recipeReserved.size, 0);
  assert.equal(ctx.recipePlannedUse.get(recipe.name), 1);
});

test("PLAN-08 recipe-first: Kostprobe/Einführung bleibt FOOD-first", () => {
  const meal = {
    meal: "breakfast",
    active: true,
    focusId: "ei",
    foodIds: ["banane", "ei"],
    baseFoodIds: ["banane"],
    sampleFoodIds: ["ei"],
    inventoryFoodIds: [],
    recipeName: "",
  };
  const recipe = { name: "Fake-Rezept", requires: ["banane", "ei"], requirementMissing: [] };
  const context = runtimeContext({ meal, recipe });
  assert.equal(context.__installRecipeFirst(), true);
  assert.equal(context.buildDay("2026-08-18", 0, { recipePlannedUse: new Map() }).meals[0].recipeName, "");
});

test("PLAN-08 recipe-first: mehrere exakte Treffer werden nur durch bestehende Rotationssignale eindeutig", () => {
  const fake = [{ name: "Pancake" }, { name: "Puffer" }];
  assert.equal(recipeFirst.plannerSelectExactRecipe(fake, {
    recipePlannedUse: new Map(),
    recipeReserved: new Map(),
  }), null);
  const selected = recipeFirst.plannerSelectExactRecipe(fake, {
    recipePlannedUse: new Map([["Pancake", 2], ["Puffer", 0]]),
    recipeReserved: new Map(),
  });
  assert.equal(selected.name, "Puffer");
});

test("PLAN-08 recipe-first: vorhandener Rezeptvorrat gewinnt bei aktivierter Vorratspräferenz", () => {
  const candidates = [{ name: "A" }, { name: "B" }];
  const selected = recipeFirst.plannerSelectExactRecipe(
    candidates,
    {
      recipePlannedUse: new Map([["A", 5], ["B", 0]]),
      recipeReserved: new Map(),
    },
    true,
    (name) => name === "A" ? 1 : 0,
  );
  assert.equal(selected.name, "A");
});

test("PLAN-08 recipe-first: frische Recipe-first-Mahlzeit verschwindet aus Einzel-Prep, bleibt aber im Einkauf und erscheint als Rezeptaufgabe", () => {
  const prepNow = { innerHTML: "" };
  const metric = { textContent: "0" };
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "huhn",
    foodIds: ["huhn", "zucchini", "hafer"],
    recipeName: "Geflügel-Gemüse-Hafer-Bällchen",
    recipeInventoryId: "",
    type: "Rezept",
  };
  const context = {
    state: { settings: { planFrom: "2026-08-18" } },
    buildDays: () => [{ date: "2026-08-18", meals: [meal] }],
    prepDemand: () => context.buildDays().flatMap((day) => day.meals.flatMap((entry) => entry.foodIds || [])).map((id) => ({ foodId: id })),
    shoppingItems: () => context.prepDemand().map((demand) => demand.foodId),
    renderPrepCore: () => {
      const demands = context.prepDemand();
      context.__shopping = context.shoppingItems();
      prepNow.innerHTML = demands.length
        ? demands.map((demand) => `<div class="prep-task" data-food="${demand.foodId}">${demand.foodId}</div>`).join("")
        : '<div class="empty">Aktuell ist nichts vorab zuzubereiten.</div>';
      metric.textContent = String(demands.length);
    },
    document: {
      getElementById: (id) => id === "prepNow" ? prepNow : null,
      querySelector: (selector) => selector === "#prepSummary .prep-metric b" ? metric : null,
    },
    today: () => "2026-08-18",
    addDays: () => "2026-08-19",
    shortDate: (date) => date,
    mealName: () => "Mittagessen",
    mealIsCompleted: () => false,
    recipeByName: () => ({
      ingredients: "Huhn, Zucchini und Hafer",
      note: "Kleine flache Stücke vollständig durchgaren.",
      batch: "8–10 kleine weiche Stücke",
    }),
    food: (id) => ({ id, name: id }),
    esc: (value) => String(value),
  };
  vm.createContext(context);
  vm.runInContext(`${policySource}\nthis.__installPrep = installPlannerRecipeFirstPrepRuntime;`, context);
  assert.equal(context.__installPrep(), true);
  context.renderPrepCore();
  assert.deepEqual(Array.from(context.__shopping), ["huhn", "zucchini", "hafer"]);
  assert.doesNotMatch(prepNow.innerHTML, /data-food=/);
  assert.match(prepNow.innerHTML, /Geflügel-Gemüse-Hafer-Bällchen/);
  assert.match(prepNow.innerHTML, /Als geplantes Rezept zubereiten/);
  assert.equal(metric.textContent, "1");
});

test("PLAN-08 recipe-first: Loader-Reihenfolge setzt Recipe-first nach Präsentation", () => {
  const utils = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");
  assert.match(utils, /planner-meal-presentation\.js\?v=\d+\.\d+\.\d+/);
  assert.match(utils, /planner-recipe-first\.js\?v=\d+\.\d+\.\d+/);
  assert.match(utils, /presentationScript\.addEventListener\("load", loadRecipeFirstPolicy/);
});
