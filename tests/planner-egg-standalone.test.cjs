"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const planningSource = fs.readFileSync(path.join(root, "js", "planning.js"), "utf8");
const statusPreferenceSource = fs.readFileSync(path.join(root, "js", "food-status-preferences.js"), "utf8");
const foodsSource = fs.readFileSync(path.join(root, "data", "foods.js"), "utf8");

function createPlannerContext(items) {
  const context = {
    state: { foods: items, logs: [], settings: { allergenDays: 7 }, overrides: {} },
    status: (item) => item?._status || "Offen",
    rank: (item) => Number(item?._rank || 0),
    usageCount: () => 0,
    eatenExposureCount: (id) => (id === "kartoffel" || id === "mais" ? 1 : 0),
    lastOutcome: () => "",
    lastDate: () => "",
    dueAllergen: () => false,
    today: () => "2026-09-19",
    isFoodUnavailable: () => false,
    eligibleCore: (item, meal) => item.active !== false && item.meals.includes(meal),
    normalizeName: (value) => String(value || "").toLowerCase(),
    currentAmountLevel: () => "taste",
    AMOUNT_LEVELS: { taste: { rank: 0 } },
    mealContainsMilkProduct: () => false,
    isMilkProductFood: () => false,
    isMeatOrFish: () => false,
    combinationHistory: () => [],
    combinationPaused: () => false,
    food: (id) => items.find((item) => item.id === id) || null,
  };
  context.eligible = (item, meal) => context.eligibleCore(item, meal, "2026-09-19");
  vm.createContext(context);
  vm.runInContext(planningSource, context);
  context.state = { foods: items, logs: [], settings: { allergenDays: 7 }, overrides: {} };
  context.food = (id) => context.state.foods.find((item) => item.id === id) || null;
  context.isFoodUnavailable = () => false;
  context.eligible = (item, meal) => context.eligibleCore(item, meal, "2026-09-19");
  return context;
}

function item(id, options = {}) {
  return {
    id,
    name: id,
    category: "Gemüse",
    active: true,
    meals: ["breakfast", "lunch", "dinner"],
    allergenGroup: "",
    _status: "Offen",
    _rank: 0,
    ...options,
  };
}

test("Ei trägt den zentralen Standalone-Einführungsvertrag im FOOD-Stamm", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${foodsSource}\nthis.__egg = FOOD_DB.find((item) => item.id === "ei");`, context);
  assert.equal(context.__egg.plannerIntroductionMode, "standalone");
  assert.match(context.__egg.safeForm, /Eierspeise/);
  assert.match(context.__egg.safeForm, /Omelett/);
});

test("neues Ei bleibt trotz mehrerer bekannter Basen ohne erzwungenen Companion", () => {
  const egg = item("ei", {
    category: "Ei",
    allergenGroup: "Ei",
    plannerIntroductionMode: "standalone",
  });
  const context = createPlannerContext([
    egg,
    item("mais", { category: "Getreide/Stärke", _status: "Verträgliche Basis", _rank: 2 }),
    item("kartoffel", { category: "Wurzel/Knolle", _status: "Verträgliche Basis", _rank: 2 }),
  ]);

  assert.equal(context.companionFor(egg, "lunch", "2026-09-19", "Allergen einführen"), null);
  assert.equal(context.companionFor(egg, "lunch", "2026-09-19", "Allergen wiederholen"), null);
});

test("unbekannte Allergene ohne Standalone-Vertrag behalten die bekannte Basispflicht", () => {
  const allergen = item("hafer", {
    category: "Getreide/Stärke",
    allergenGroup: "Glutenhaltiges Getreide",
  });
  const potato = item("kartoffel", {
    category: "Wurzel/Knolle",
    _status: "Verträgliche Basis",
    _rank: 2,
  });
  const context = createPlannerContext([allergen, potato]);
  assert.equal(
    context.companionFor(allergen, "lunch", "2026-09-19", "Allergen einführen")?.id,
    "kartoffel",
  );
});

test("Ei darf als Einführung ausgewählt werden, wenn keine bekannte Basis vorhanden ist", () => {
  const egg = item("ei", {
    category: "Ei",
    allergenGroup: "Ei",
    plannerIntroductionMode: "standalone",
  });
  const context = createPlannerContext([egg]);
  const result = context.introductionCandidate(
    "lunch",
    "2026-09-19",
    { reserved: new Set() },
    [],
  );
  assert.equal(result?.f.id, "ei");
  assert.equal(result?.type, "Allergen einführen");
});

test("der Status-Adapter übernimmt den Standalone-Vertrag und hält andere Allergene basispflichtig", () => {
  const egg = item("ei", {
    category: "Ei",
    allergenGroup: "Ei",
    plannerIntroductionMode: "standalone",
  });
  const gluten = item("hafer", {
    category: "Getreide/Stärke",
    allergenGroup: "Glutenhaltiges Getreide",
  });
  const potato = item("kartoffel", {
    category: "Wurzel/Knolle",
    _status: "Bekannt",
    _rank: 2,
  });
  const context = createPlannerContext([egg, gluten, potato]);
  vm.runInContext(`${statusPreferenceSource}\nthis.__installStatus = installFoodStatusPreferencePolicy;`, context);
  assert.equal(context.__installStatus(), true);
  assert.equal(context.companionFor(egg, "lunch", "2026-09-19", "Allergen einführen"), null);
  assert.equal(
    context.companionFor(gluten, "lunch", "2026-09-19", "Allergen einführen")?.id,
    "kartoffel",
  );
});

test("bekanntes Ei bleibt für spätere normale Kombinationen offen", () => {
  const egg = item("ei", {
    category: "Ei",
    allergenGroup: "Ei",
    plannerIntroductionMode: "standalone",
    _status: "Verträgliche Basis",
    _rank: 2,
  });
  const zucchini = item("zucchini", {
    _status: "Verträgliche Basis",
    _rank: 2,
  });
  const context = createPlannerContext([egg, zucchini]);
  assert.equal(context.companionFor(egg, "lunch", "2026-09-19", "bekannt")?.id, "zucchini");
});
