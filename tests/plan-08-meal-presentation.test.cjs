"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const foodsSource = fs.readFileSync(path.join(root, "data", "foods.js"), "utf8");
const contractSource = fs.readFileSync(path.join(root, "data", "food-presentation.js"), "utf8");
const planningSource = fs.readFileSync(path.join(root, "js", "planning.js"), "utf8");
const policySource = fs.readFileSync(
  path.join(root, "js", "planner-meal-presentation.js"),
  "utf8",
);

function loadFoods() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${foodsSource}\nthis.__FOODS = FOOD_DB;`, context);
  return JSON.parse(JSON.stringify(context.__FOODS));
}

function createRuntime() {
  const foods = loadFoods();
  const context = {
    console,
    state: { foods },
    food: (id) => foods.find((item) => item.id === id),
  };

  vm.createContext(context);
  vm.runInContext(
    `${planningSource}\nthis.__originalDishTitle = dishTitle; this.__naturalFoodList = naturalFoodList;`,
    context,
  );
  vm.runInContext(`${contractSource}\nthis.__presentationContract = FOOD_PRESENTATION_CONTRACT;`, context);
  vm.runInContext(policySource, context);
  assert.equal(context.installPlannerMealPresentationRuntime(), true);
  return context;
}

test("PLAN-08: Regressionen verwenden echten Planner, FOOD-Stamm und separaten Präsentationsvertrag", () => {
  const runtime = createRuntime();
  assert.equal(typeof runtime.__originalDishTitle, "function");
  assert.equal(typeof runtime.dishTitle, "function");
  assert.ok(runtime.state.foods.length > 100);
  assert.equal(runtime.__presentationContract.gurke.role, "fresh-side");
  for (const id of ["ei", "banane", "suesskartoffel", "gurke", "hafer", "naturjoghurt"]) {
    assert.ok(runtime.food(id), `echter FOOD-Datensatz fehlt: ${id}`);
  }
});

test("PLAN-08: Ei + Banane bleibt zulässig und wird ohne Rezept nicht als erfundene Eierspeise oder Pancake benannt", () => {
  const runtime = createRuntime();
  const meal = {
    meal: "breakfast",
    foodIds: ["ei", "banane"],
    baseFoodIds: ["banane"],
    sampleFoodIds: [],
  };
  assert.equal(runtime.__originalDishTitle(meal), "Eierspeise mit Banane");
  assert.equal(runtime.dishTitle(meal), "Ei und Banane");
  assert.doesNotMatch(runtime.dishTitle(meal), /Eierspeise|Pancake/i);
});

test("PLAN-08: Süßkartoffel + Gurke wird über FOOD-Präsentationsdaten als getrennte Komponenten dargestellt", () => {
  const runtime = createRuntime();
  assert.equal(
    runtime.dishTitle({ meal: "lunch", foodIds: ["suesskartoffel", "gurke"], sampleFoodIds: [] }),
    "Süßkartoffel und Gurke · getrennte Komponenten",
  );
});

test("PLAN-08: Milchprodukt + Getreide wird nicht fälschlich getrennt", () => {
  const runtime = createRuntime();
  for (const [milkId, expected] of [
    ["naturjoghurt", "Naturjoghurt mit Hafer"],
    ["kuhmilch", "Kuhmilch mit Hafer"],
    ["buttermilch", "Buttermilch mit Hafer"],
  ]) {
    const title = runtime.dishTitle({ meal: "breakfast", foodIds: [milkId, "hafer"], sampleFoodIds: [] });
    assert.equal(title, expected);
    assert.doesNotMatch(title, /getrennt/i);
  }
});

test("PLAN-08: echtes Rezept behält seinen Rezeptnamen", () => {
  const runtime = createRuntime();
  assert.equal(
    runtime.dishTitle({
      meal: "breakfast",
      foodIds: ["banane", "hafer", "ei"],
      sampleFoodIds: [],
      recipeName: "Obst-Hafer-Pancakes",
    }),
    "Obst-Hafer-Pancakes",
  );
});

test("PLAN-08: bestehender Obst-Getreide-Brei bleibt unverändert", () => {
  const runtime = createRuntime();
  assert.equal(
    runtime.dishTitle({ meal: "breakfast", foodIds: ["banane", "hafer"], sampleFoodIds: [] }),
    "Banane-Hafer-Brei",
  );
});

test("PLAN-08: sonstige plausible FOOD-Titel bleiben beim bestehenden Planner", () => {
  const runtime = createRuntime();
  assert.equal(
    runtime.dishTitle({ meal: "lunch", foodIds: ["suesskartoffel", "zucchini"], sampleFoodIds: [] }),
    "Süßkartoffel mit Zucchini",
  );
});

test("PLAN-08: Kostproben behalten die bestehende Sample-Darstellung", () => {
  const runtime = createRuntime();
  assert.equal(
    runtime.dishTitle({
      meal: "breakfast",
      foodIds: ["hafer", "banane"],
      baseFoodIds: ["hafer"],
      sampleFoodIds: ["banane"],
    }),
    "Hafer und Banane als Kostprobe",
  );
});

test("PLAN-08: Präsentationspolicy enthält keine FOOD-spezifische Rollenliste und parst keine Freitexte", () => {
  assert.doesNotMatch(policySource, /PLANNER_FOOD_PRESENTATION_ROLES/);
  assert.doesNotMatch(policySource, /\.safeForm\b/);
  assert.doesNotMatch(policySource, /\.prep\b/);
  assert.doesNotMatch(policySource, /text\.includes\(/);
  assert.equal(policySource.includes('"gurke"'), false);
});

test("PLAN-08: Präsentationsvertrag enthält nur Einzel-FOOD-Schlüssel, keine Paarregeln", () => {
  const runtime = createRuntime();
  const keys = Object.keys(runtime.__presentationContract);
  assert.deepEqual(keys, ["gurke"]);
  assert.equal(keys.some((key) => key.includes("+")), false);
});

test("PLAN-08: Browser-Loader hängt PLAN-08 erst nach geladenem Präsentationsvertrag ein", () => {
  const utils = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");
  assert.match(utils, /planner-milk-policy\.js\?v=10\.1\.25/);
  assert.match(utils, /data\/food-presentation\.js\?v=10\.1\.25/);
  assert.match(utils, /planner-meal-presentation\.js\?v=10\.1\.25/);
  assert.match(utils, /contractScript\.addEventListener\("load", loadPresentationPolicy, \{ once: true \}\)/);
  assert.match(utils, /existingContract\.addEventListener\("load", loadPresentationPolicy, \{ once: true \}\)/);
  assert.match(utils, /if \(typeof FOOD_PRESENTATION_CONTRACT !== "undefined"\) \{\s*loadPresentationPolicy\(\);/s);
});
