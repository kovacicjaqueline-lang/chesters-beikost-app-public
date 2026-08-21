"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const source = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const json = (value) => JSON.parse(JSON.stringify(value));
const appVersion = JSON.parse(source("VERSION.json")).version;
const cacheVersion = appVersion.replace(/\./g, "-");

function runtime() {
  const context = vm.createContext({ console, structuredClone });
  vm.runInContext(source("data/foods.js"), context);
  vm.runInContext(source("data/recipes.js"), context);
  vm.runInContext(`${source("js/state.js")}\nglobalThis.__foods=FOOD_DB;globalThis.__recipes=RECIPES;`, context);
  vm.runInContext(source("js/utils.js"), context);
  vm.runInContext(source("js/migrations.js"), context);
  vm.runInContext(`${source("js/model.js")}\nglobalThis.__recipeSearchText=recipeSearchText;globalThis.__recipeFoodFromStructuredLabel=recipeFoodFromStructuredLabel;`, context);
  vm.runInContext(`state = {
    settings: { birthDate:'2026-01-24', startDate:'2026-07-14', phaseSelected:'kennenlernen', seasonal:false, travelDate:'2027-01-29', travelPrep:false, phMode:'off', allergenDays:7 },
    foods: FOOD_DB,
    logs: [],
    inventory: [],
    overrides: {},
    planLocks: {},
    manualMeals: {},
    combinationPauses: {},
    followUps: {},
    inactivePlanKept: {}
  };`, context);
  return context;
}

test("FOOD/PLAN-08: historisches Slash-Rezeptlabel wird vor Planning kanonisch aufgelöst", () => {
  const context = runtime();
  const recipe = json(context.__recipes).find((item) => item.name === "Gemüse-Nudel-Sauce");
  assert.ok(recipe, "Referenzrezept vorhanden");
  assert.ok(recipe.requires.includes("Nudeln"), "kanonischer sichtbarer FOOD-Name");
  assert.ok(!recipe.requires.includes("Nudeln/Pasta"), "historisches Slash-Label nicht mehr als strukturierte Zutat");
  assert.equal(context.__recipeFoodFromStructuredLabel("Nudeln/Pasta", context.__foods)?.id, "nudeln-pasta");
});

test("FOOD/PLAN-08: Slash-Fallback greift nur, wenn alle Begriffe dasselbe FOOD meinen", () => {
  const context = runtime();
  assert.equal(context.__recipeFoodFromStructuredLabel("Nudeln/Pasta", context.__foods)?.id, "nudeln-pasta");
  assert.equal(context.__recipeFoodFromStructuredLabel("Banane/Apfel", context.__foods), null);
  assert.equal(context.__recipeFoodFromStructuredLabel("Nudeln/Unbekannt", context.__foods), null);
});

test("FOOD/PLAN-08: Rezeptsuche findet nach Kanonisierung weiterhin den FOOD-Alias Pasta", () => {
  const context = runtime();
  const recipe = context.__recipes.find((item) => item.name === "Gemüse-Nudel-Sauce");
  assert.match(context.__recipeSearchText(recipe), /Pasta/);
});

test("FOOD/PLAN-08: normaler Planner und Recipe-first verwenden für reales Legacy-Rezept dieselben kanonischen FOOD-IDs", () => {
  const context = runtime();
  vm.runInContext(`${source("js/planning.js")}\nglobalThis.__recipeFoodIds=recipeFoodIds;`, context);
  vm.runInContext(`${source("js/planner-recipe-first.js")}\nglobalThis.__variantIds=plannerRecipeVariantIdSets;`, context);
  const recipe = context.__recipes.find((item) => item.name === "Gemüse-Nudel-Sauce");
  context.__recipe = recipe;
  const normalIds = json(vm.runInContext("__recipeFoodIds(__recipe)", context)).sort();
  const variantIds = json(vm.runInContext("__variantIds(__recipe, __foods, () => true)", context));
  assert.deepEqual(normalIds, ["nudeln-pasta", "tomate", "zucchini"]);
  assert.deepEqual(variantIds, [["nudeln-pasta", "tomate", "zucchini"]]);
});

test("FOOD/PLAN-08: dynamische Planner-Policy-Kette wird bereits beim Service-Worker-Install gecacht", () => {
  const wrapper = source("sw.js");
  const core = source("sw-core.js");
  assert.match(wrapper, /importScripts\("\.\/sw-core\.js"\)/);
  const required = [
    "./js/planner-meal-eligibility.js",
    "./js/planner-milk-policy.js",
    "./js/planner-iron-preference.js",
    "./data/food-presentation.js",
    "./js/planner-meal-presentation.js",
    "./js/planner-recipe-first.js",
  ];
  for (const file of required) assert.ok(wrapper.includes(`\"${file}\"`), file);
  assert.match(wrapper, /caches\.open\(CACHE\)/);
  assert.match(wrapper, /cache:\s*"reload"/);
  assert.match(core, new RegExp(`const CACHE='chester-beikost-v${cacheVersion}-icons-final'`));
});
