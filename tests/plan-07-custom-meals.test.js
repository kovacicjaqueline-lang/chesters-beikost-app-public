"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const migrationsSource = fs.readFileSync(path.join(root, "js", "migrations.js"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadFoodDb() {
  const source = fs.readFileSync(path.join(root, "data", "foods.js"), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__foodDb = FOOD_DB;`, context);
  return clone(context.__foodDb);
}

const FOOD_DB = loadFoodDb();

function baseMigrationContext() {
  const context = {
    FOOD_DB: clone(FOOD_DB),
    ID_ALIASES: {},
    LEGACY_MILK_ID: "__legacy_milk__",
    clone,
  };
  vm.createContext(context);
  vm.runInContext(migrationsSource, context);
  return context;
}

function loadPlannerEligibleCore() {
  const source = fs.readFileSync(path.join(root, "js", "planning.js"), "utf8");
  const context = { status: () => "Offen" };
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(typeof context.eligibleCore, "function");
  return context.eligibleCore;
}

const eligibleCore = loadPlannerEligibleCore();

function fakeElement(value = "") {
  const field = {
    classList: { add() {}, remove() {}, contains() { return false; } },
    querySelector() { return null; },
  };
  return {
    value,
    checked: false,
    innerHTML: "",
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return field; },
    insertAdjacentHTML() {},
    focus() {},
    addEventListener(type, handler) { this[`on${type}`] = handler; },
  };
}

function uiContext() {
  const context = baseMigrationContext();
  const elements = {
    logModal: fakeElement(),
  };
  elements.logModal.classList.contains = () => false;
  context.__elements = elements;
  context.__lastBody = "";
  context.document = {
    getElementById(id) { return elements[id] || null; },
    querySelectorAll() { return []; },
  };
  context.state = {
    foods: [{ id: "seed", name: "Karotte", alias: "", priority: 1 }],
    inventory: [],
    logs: [],
    settings: {},
  };
  context.save = () => { context.__saved = true; };
  context.esc = (value) => String(value);
  vm.runInContext(uiSource, context);

  context.openGeneric = (_title, body) => {
    context.__lastBody = body;
    Object.assign(elements, {
      customName: fakeElement(""),
      customCat: fakeElement("Gemüse"),
      customMealBreakfast: fakeElement("breakfast"),
      customMealLunch: fakeElement("lunch"),
      customMealDinner: fakeElement("dinner"),
      customAllergen: fakeElement(""),
      customSafe: fakeElement(""),
      customFoodMessage: fakeElement(""),
      cancelCustom: fakeElement(""),
      saveCustom: fakeElement(""),
    });
  };
  context.closeGeneric = () => { context.__closed = true; };
  context.renderAll = () => { context.__rendered = true; };
  return context;
}

test("custom form renders only the three approved meal checkboxes and applies category defaults", () => {
  const context = uiContext();
  context.addCustomFoodForm();
  const e = context.__elements;
  assert.match(context.__lastBody, /Passend für/);
  assert.doesNotMatch(context.__lastBody, /value="snack"/);
  assert.equal(e.customMealBreakfast.checked, false);
  assert.equal(e.customMealLunch.checked, true);
  assert.equal(e.customMealDinner.checked, true);

  e.customCat.value = "Obst";
  e.customCat.onchange();
  assert.equal(e.customMealBreakfast.checked, true);
  assert.equal(e.customMealLunch.checked, true);
  assert.equal(e.customMealDinner.checked, true);
});

test("manual checkbox selection is saved exactly through the real custom-food form", () => {
  const context = uiContext();
  context.addCustomFoodForm();
  const e = context.__elements;
  e.customName.value = "Pferdefleisch";
  e.customCat.value = "Fleisch";
  e.customCat.onchange();
  e.customMealBreakfast.checked = false;
  e.customMealLunch.checked = false;
  e.customMealDinner.checked = true;
  e.saveCustom.onclick();

  const saved = context.state.foods.find((food) => food.name === "Pferdefleisch");
  assert.deepEqual(clone(saved.meals), ["dinner"]);
  assert.equal(context.__saved, true);
  assert.equal(context.__closed, true);
  assert.equal(context.__rendered, true);
});

test("no selected meals stays empty and is rejected by the existing planner filter", () => {
  const context = uiContext();
  context.addCustomFoodForm();
  const e = context.__elements;
  e.customName.value = "Ohne Auto-Planung";
  e.customMealBreakfast.checked = false;
  e.customMealLunch.checked = false;
  e.customMealDinner.checked = false;
  e.saveCustom.onclick();
  const saved = clone(context.state.foods.find((food) => food.name === "Ohne Auto-Planung"));
  assert.deepEqual(saved.meals, []);
  for (const meal of ["breakfast", "lunch", "dinner"]) {
    assert.equal(eligibleCore(saved, meal, "2026-08-17"), false);
  }
});

test("new custom meat defaults to lunch and dinner and is not breakfast-eligible", () => {
  const context = uiContext();
  context.addCustomFoodForm();
  const e = context.__elements;
  e.customName.value = "Testfleisch";
  e.customCat.value = "Fleisch";
  e.customCat.onchange();
  e.saveCustom.onclick();
  const saved = clone(context.state.foods.find((food) => food.name === "Testfleisch"));
  assert.deepEqual(saved.meals, ["lunch", "dinner"]);
  assert.equal(eligibleCore(saved, "breakfast", "2026-08-17"), false);
  assert.equal(eligibleCore(saved, "lunch", "2026-08-17"), true);
  assert.equal(eligibleCore(saved, "dinner", "2026-08-17"), true);
});

test("new custom fruit defaults to breakfast, lunch and dinner", () => {
  const context = uiContext();
  context.addCustomFoodForm();
  const e = context.__elements;
  e.customName.value = "Testobst";
  e.customCat.value = "Obst";
  e.customCat.onchange();
  e.saveCustom.onclick();
  const saved = context.state.foods.find((food) => food.name === "Testobst");
  assert.deepEqual(clone(saved.meals), ["breakfast", "lunch", "dinner"]);
});

test("real mergeFoods migrates legacy custom meat fallback to lunch and dinner", () => {
  const context = baseMigrationContext();
  const result = context.mergeFoods([{
    id: "custom-pferdefleisch",
    name: "Pferdefleisch",
    category: "Fleisch",
    meals: ["breakfast", "lunch", "dinner"],
  }]);
  const migrated = result.find((food) => food.id === "custom-pferdefleisch");
  assert.deepEqual(clone(migrated.meals), ["lunch", "dinner"]);
});

test("real mergeFoods migrates missing custom meals by category", () => {
  const context = baseMigrationContext();
  const result = context.mergeFoods([{
    id: "custom-fleisch-ohne-meals",
    name: "Testfleisch ohne meals",
    category: "Fleisch",
  }]);
  const migrated = result.find((food) => food.id === "custom-fleisch-ohne-meals");
  assert.deepEqual(clone(migrated.meals), ["lunch", "dinner"]);
});

test("real mergeFoods preserves individual custom meals, including an empty selection", () => {
  const context = baseMigrationContext();
  const result = context.mergeFoods([
    { id: "custom-individual", name: "Individuell", category: "Fleisch", meals: ["breakfast"] },
    { id: "custom-empty", name: "Ohne Planung", category: "Fleisch", meals: [] },
  ]);
  assert.deepEqual(clone(result.find((food) => food.id === "custom-individual").meals), ["breakfast"]);
  assert.deepEqual(clone(result.find((food) => food.id === "custom-empty").meals), []);
});

test("normal FOOD_DB records remain unchanged by custom meal migration", () => {
  const context = baseMigrationContext();
  const before = clone(FOOD_DB);
  const savedNormal = {
    ...clone(FOOD_DB.find((food) => food.id === "karotte")),
    meals: ["breakfast", "lunch", "dinner"],
  };
  const merged = clone(context.mergeFoods([savedNormal]));
  assert.deepEqual(merged, before);
});

test("all approved custom categories expose exactly the accepted defaults", () => {
  const context = baseMigrationContext();
  const expected = {
    "Gemüse": ["lunch", "dinner"],
    "Obst": ["breakfast", "lunch", "dinner"],
    "Getreide/Stärke": ["breakfast", "lunch", "dinner"],
    "Hülsenfrucht": ["lunch", "dinner"],
    "Fleisch": ["lunch", "dinner"],
    "Fisch": ["lunch", "dinner"],
    "Milchprodukt": ["breakfast", "lunch", "dinner"],
    "Ei": ["breakfast", "lunch", "dinner"],
    "Nuss": ["breakfast", "lunch", "dinner"],
    "Samen": ["breakfast", "lunch", "dinner"],
    "Kraut/Gewürz": ["lunch", "dinner"],
    "Wurzel/Knolle": ["lunch", "dinner"],
  };
  for (const [category, meals] of Object.entries(expected)) {
    assert.deepEqual(clone(context.customMealDefaults(category)), meals);
  }
  assert.equal(context.customMealDefaults("Unbekannt"), null);
});
