"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const maintenance = require("../js/planner-allergen-maintenance.js");

const foods = [
  { id: "hafer", name: "Hafer", allergenGroup: "Glutenhaltiges Getreide", allergenFamily: "hafer" },
  { id: "haferdrink", name: "Haferdrink", allergenGroup: "Glutenhaltiges Getreide", allergenFamily: "hafer" },
  { id: "weizen", name: "Weizen", allergenGroup: "Glutenhaltiges Getreide" },
  { id: "dinkel", name: "Dinkel", allergenGroup: "Glutenhaltiges Getreide" },
  { id: "mandel", name: "Mandel", allergenGroup: "Schalenfrüchte", allergenFamily: "nuss:mandel" },
  { id: "walnuss", name: "Walnuss", allergenGroup: "Schalenfrüchte", allergenFamily: "nuss:walnuss" },
  { id: "sesam", name: "Sesam", allergenGroup: "Sesam", allergenFamily: "sesam" },
  { id: "tahin", name: "Tahin", allergenGroup: "Sesam", allergenFamily: "sesam" },
];

function outcome(log, id) {
  return log.foodOutcomes?.[id] || log.outcome || "";
}

function runtimeContext(setupSource) {
  const source = fs.readFileSync(path.join(root, "js", "planner-allergen-maintenance.js"), "utf8");
  const context = vm.createContext({ console, Set, Map, Object, Array, Number, String, Math, Date, JSON });
  vm.runInContext(setupSource, context);
  vm.runInContext(source, context);
  return context;
}

test("Glutenpflege ist gruppenweit, ohne die Einführungsfamilien gleichzusetzen", () => {
  const glutenKeys = ["hafer", "haferdrink", "weizen", "dinkel"]
    .map((id) => maintenance.targetForFood(foods.find((item) => item.id === id)).key);
  assert.deepEqual([...new Set(glutenKeys)], ["allergen:Glutenhaltiges Getreide"]);
  assert.equal(foods.find((item) => item.id === "hafer").allergenFamily, "hafer");
  assert.equal(foods.find((item) => item.id === "weizen").allergenFamily, undefined);
});

test("Fein modellierte Nussfamilien bleiben in der Pflege getrennt", () => {
  const mandel = maintenance.targetForFood(foods.find((item) => item.id === "mandel"));
  const walnuss = maintenance.targetForFood(foods.find((item) => item.id === "walnuss"));
  assert.equal(mandel.key, "family:nuss:mandel");
  assert.equal(walnuss.key, "family:nuss:walnuss");
  assert.notEqual(mandel.key, walnuss.key);
});

test("Historisch erfüllt nur tatsächlich gegessene Zielquelle die Pflege", () => {
  const target = maintenance.targetForFood(foods.find((item) => item.id === "hafer"));
  const logs = [
    { date: "2026-08-01", foodIds: ["hafer"], foodOutcomes: { hafer: "eaten" } },
    { date: "2026-08-08", foodIds: ["weizen"], foodOutcomes: { weizen: "not_offered" } },
    { date: "2026-08-10", foodIds: ["dinkel"], foodOutcomes: { dinkel: "eaten" } },
  ];
  assert.equal(
    maintenance.latestSuccessfulExposureDate(target, foods, logs, outcome, "2026-08-20"),
    "2026-08-10",
  );
});

test("Ein anderes gegessenes glutenhaltiges FOOD setzt dasselbe Pflegeziel zurück", () => {
  const ranks = new Map([["hafer", 2], ["weizen", 2], ["dinkel", 2]]);
  const logs = [
    { date: "2026-08-01", foodIds: ["hafer"], foodOutcomes: { hafer: "eaten" } },
    { date: "2026-08-17", foodIds: ["weizen"], foodOutcomes: { weizen: "eaten" } },
  ];
  const due = maintenance.dueTargets({
    foods,
    logs,
    on: "2026-08-20",
    intervalDays: 7,
    rankFn: (item) => ranks.get(item.id) || 0,
    outcomeForFoodFn: outcome,
  });
  assert.equal(due.some((target) => target.key === "allergen:Glutenhaltiges Getreide"), false);
});

test("Ein geplantes Rezept kann mehrere Pflegeziele voraussichtlich abdecken", () => {
  const recipe = { name: "Hafer-Tahin-Brei" };
  const plan = { recipeName: recipe.name };
  const keys = maintenance.projectedTargetKeysForRecord(plan, foods, {
    recipeByNameFn: (name) => name === recipe.name ? recipe : null,
    recipeFoodIdsFn: () => ["hafer", "tahin"],
  });
  assert.deepEqual(new Set(keys), new Set([
    "allergen:Glutenhaltiges Getreide",
    "family:sesam",
  ]));
});

test("Geplante Abdeckung bleibt Prognose und verändert die historische letzte Exposition nicht", () => {
  const target = maintenance.targetForFood(foods.find((item) => item.id === "hafer"));
  const logs = [
    { date: "2026-08-01", foodIds: ["hafer"], foodOutcomes: { hafer: "eaten" } },
  ];
  const ctx = {};
  maintenance.markProjectedRecord(ctx, { foodIds: ["weizen"] }, foods);
  assert.equal(maintenance.ensureProjectedTargetSet(ctx).has(target.key), true);
  assert.equal(
    maintenance.latestSuccessfulExposureDate(target, foods, logs, outcome, "2026-08-20"),
    "2026-08-01",
  );
});

test("Fällige Ziele werden pro Maintenance-Ziel dedupliziert", () => {
  const ranks = new Map([["hafer", 2], ["weizen", 2], ["dinkel", 2]]);
  const logs = [
    { date: "2026-08-01", foodIds: ["hafer"], foodOutcomes: { hafer: "eaten" } },
  ];
  const due = maintenance.dueTargets({
    foods,
    logs,
    on: "2026-08-20",
    intervalDays: 7,
    rankFn: (item) => ranks.get(item.id) || 0,
    outcomeForFoodFn: outcome,
  }).filter((target) => target.key === "allergen:Glutenhaltiges Getreide");
  assert.equal(due.length, 1);
});

test("Alternative bekannte Quelle kann ein fälliges Ziel bedienen", () => {
  const target = maintenance.targetForFood(foods.find((item) => item.id === "hafer"));
  const candidates = [
    { f: { id: "kartoffel", name: "Kartoffel" }, type: "bekannt" },
    { f: foods.find((item) => item.id === "weizen"), type: "bekannt" },
  ];
  const result = maintenance.candidateForTarget(target, {
    meal: "lunch",
    on: "2026-08-20",
    ctx: {},
    candidateFn: (_meal, _on, _ctx, blocked) => candidates.find((entry) => !blocked.includes(entry.f.id)) || null,
  });
  assert.equal(result.f.id, "weizen");
});

test("Runtime: fällige Glutenpflege wird nicht zur Lernaufgabe und blockiert einen neuen FOOD-Slot nicht", () => {
  const context = runtimeContext(`
    var window = {};
    var document = {};
    var state = {
      settings: { allergenDays: 7 },
      foods: [
        { id: "hafer", name: "Hafer", allergenGroup: "Glutenhaltiges Getreide", allergenFamily: "hafer", _rank: 2 },
        { id: "weizen", name: "Weizen", allergenGroup: "Glutenhaltiges Getreide", _rank: 2 },
        { id: "banane", name: "Banane", allergenGroup: "", _rank: 0 }
      ],
      logs: [{ date: "2026-08-01", foodIds: ["hafer"], foodOutcomes: { hafer: "eaten" } }],
      manualMeals: {}, planLocks: {}
    };
    function food(id) { return state.foods.find((item) => item.id === id); }
    function rank(item) { return item?._rank || 0; }
    function outcomeForFood(log, id) { return log.foodOutcomes?.[id] || ""; }
    function dueAllergen(item, on) { return item?.id === "hafer"; }
    function manualMealFor() { return null; }
    function lockedMeal() { return null; }
    function recipeByName() { return null; }
    function recipeFoodIds() { return []; }
    function recipeStockCandidate() { return null; }
    function snackRecipeCandidate() { return null; }
    function addDays(value, amount) { let d = new Date(value + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0,10); }
    function introductionCandidate() { return { f: food("banane"), type: "neu" }; }
    function knownCandidate(meal, on, ctx, blocked) {
      for (let id of ["weizen", "hafer"]) if (!(blocked || []).includes(id)) return { f: food(id), type: "bekannt" };
      return null;
    }
    function freshPlanContext() { return {}; }
    function ensureAutoLocks() { return false; }
    function buildDay(date, index, ctx) {
      let first = dueAllergen(food("hafer"), date)
        ? { meal: "lunch", active: true, focusId: "hafer", foodIds: ["hafer"], baseFoodIds: [], sampleFoodIds: ["hafer"], type: "Allergen wiederholen" }
        : { meal: "lunch", active: true, focusId: "banane", foodIds: ["banane"], baseFoodIds: [], sampleFoodIds: ["banane"], type: "neu" };
      let known = knownCandidate("dinner", date, ctx, []);
      let second = known ? { meal: "dinner", active: true, focusId: known.f.id, foodIds: [known.f.id], baseFoodIds: [known.f.id], sampleFoodIds: [], type: known.type } : { meal: "dinner", active: true, empty: true };
      return { date, index, meals: [first, second] };
    }
    function buildDays(from, n = 7) {
      let ctx = freshPlanContext();
      return Array.from({ length: n }, (_, index) => buildDay(addDays(from, index), index, ctx));
    }
  `);
  const day = vm.runInContext(`buildDay("2026-08-20", 0, freshPlanContext())`, context);
  assert.equal(day.meals[0].focusId, "banane");
  assert.equal(day.meals[0].type, "neu");
  assert.equal(day.meals[1].focusId, "weizen");
  assert.equal(day.meals[1].type, "bekannt kombinieren");
  assert.equal(day.meals[1].sampleFoodIds.length, 0);
});

test("Runtime: fällige Mandelpflege priorisiert ein geeignetes bekanntes Rezept ohne Lernslot", () => {
  const context = runtimeContext(`
    var window = {};
    var document = {};
    var recipes = {
      normal: { name: "Apfel-Hirse-Brei" },
      mandel: { name: "Apfel-Hirse-Brei mit Mandelmus" }
    };
    var state = {
      settings: { allergenDays: 7 },
      foods: [
        { id: "apfel", name: "Apfel", allergenGroup: "", _rank: 2 },
        { id: "hirse", name: "Hirse", allergenGroup: "", _rank: 2 },
        { id: "mandel", name: "Mandel", allergenGroup: "Schalenfrüchte", allergenFamily: "nuss:mandel", _rank: 2 }
      ],
      logs: [{ date: "2026-08-01", foodIds: ["mandel"], foodOutcomes: { mandel: "eaten" } }],
      manualMeals: {}, planLocks: {}
    };
    function food(id) { return state.foods.find((item) => item.id === id); }
    function rank(item) { return item?._rank || 0; }
    function outcomeForFood(log, id) { return log.foodOutcomes?.[id] || ""; }
    function dueAllergen() { return false; }
    function manualMealFor() { return null; }
    function lockedMeal() { return null; }
    function recipeByName(name) { return Object.values(recipes).find((recipe) => recipe.name === name) || null; }
    function recipeFoodIds(recipe) { return recipe?.name === recipes.mandel.name ? ["apfel", "hirse", "mandel"] : ["apfel", "hirse"]; }
    function recipeStockCandidate() { return null; }
    function snackRecipeCandidate() { return null; }
    function knownCandidate() { return { f: food("apfel"), type: "bekannt" }; }
    function plannerSelectProactiveRecipe(candidates) { return candidates[0] || null; }
    function addDays(value, amount) { let d = new Date(value + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0,10); }
    function freshPlanContext() { return {}; }
    function buildDay(date, index, ctx) {
      let candidates = [
        { recipe: recipes.normal, ids: ["apfel", "hirse"], sampleFoodId: "" },
        { recipe: recipes.mandel, ids: ["apfel", "hirse", "mandel"], sampleFoodId: "" }
      ];
      let selected = plannerSelectProactiveRecipe(candidates, ctx);
      return { date, index, meals: [{
        meal: "breakfast", active: true, focusId: "apfel", foodIds: [...selected.ids],
        baseFoodIds: ["apfel", "hirse"], sampleFoodIds: [], recipeName: selected.recipe.name,
        type: "Rezept"
      }] };
    }
    function buildDays(from, n = 7) {
      let ctx = freshPlanContext();
      return Array.from({ length: n }, (_, index) => buildDay(addDays(from, index), index, ctx));
    }
  `);
  const day = vm.runInContext(`buildDay("2026-08-20", 0, freshPlanContext())`, context);
  assert.equal(day.meals[0].recipeName, "Apfel-Hirse-Brei mit Mandelmus");
  assert.equal(day.meals[0].foodIds.includes("mandel"), true);
  assert.equal(day.meals[0].sampleFoodIds.length, 0);
});

test("Runtime: verworfene Maintenance-Kombination gibt das Ziel für einen späteren Slot desselben Tages wieder frei", () => {
  const context = runtimeContext(`
    var window = {};
    var document = {};
    var state = {
      settings: { allergenDays: 7 },
      foods: [
        { id: "hafer", name: "Hafer", allergenGroup: "Glutenhaltiges Getreide", allergenFamily: "hafer", _rank: 2 },
        { id: "weizen", name: "Weizen", allergenGroup: "Glutenhaltiges Getreide", _rank: 2 },
        { id: "kartoffel", name: "Kartoffel", allergenGroup: "", _rank: 2 }
      ],
      logs: [{ date: "2026-08-01", foodIds: ["hafer"], foodOutcomes: { hafer: "eaten" } }],
      manualMeals: {}, planLocks: {}
    };
    function food(id) { return state.foods.find((item) => item.id === id); }
    function rank(item) { return item?._rank || 0; }
    function outcomeForFood(log, id) { return log.foodOutcomes?.[id] || ""; }
    function dueAllergen() { return false; }
    function manualMealFor() { return null; }
    function lockedMeal() { return null; }
    function recipeByName() { return null; }
    function recipeFoodIds() { return []; }
    function recipeStockCandidate() { return null; }
    function snackRecipeCandidate() { return null; }
    function knownCandidate(meal, on, ctx, blocked) {
      for (let id of ["kartoffel", "weizen"]) if (!(blocked || []).includes(id)) return { f: food(id), type: "bekannt" };
      return null;
    }
    function combinationPaused(ids) { return ids.includes("weizen") && ids.includes("kartoffel"); }
    function addDays(value, amount) { let d = new Date(value + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0,10); }
    function freshPlanContext() { return {}; }
    function buildDay(date, index, ctx) {
      let lunchCandidate = knownCandidate("lunch", date, ctx, []);
      let lunchIds = [lunchCandidate.f.id, "kartoffel"];
      let lunch = combinationPaused(lunchIds, date)
        ? { meal: "lunch", active: true, focusId: "kartoffel", foodIds: ["kartoffel"], baseFoodIds: ["kartoffel"], sampleFoodIds: [], type: "bekannt" }
        : { meal: "lunch", active: true, focusId: lunchCandidate.f.id, foodIds: lunchIds, baseFoodIds: lunchIds, sampleFoodIds: [], type: lunchCandidate.type };
      let dinnerCandidate = knownCandidate("dinner", date, ctx, []);
      let dinner = { meal: "dinner", active: true, focusId: dinnerCandidate.f.id, foodIds: [dinnerCandidate.f.id], baseFoodIds: [dinnerCandidate.f.id], sampleFoodIds: [], type: dinnerCandidate.type };
      return { date, index, meals: [lunch, dinner] };
    }
    function buildDays(from, n = 7) {
      let ctx = freshPlanContext();
      return Array.from({ length: n }, (_, index) => buildDay(addDays(from, index), index, ctx));
    }
  `);
  const day = vm.runInContext(`buildDay("2026-08-20", 0, freshPlanContext())`, context);
  assert.equal(day.meals[0].focusId, "kartoffel");
  assert.equal(day.meals[1].focusId, "weizen");
  assert.equal(day.meals[1].type, "bekannt kombinieren");
});

test("Runtime: erledigter Lock mit tried zählt weder als Projektion noch als historische Erfüllung", () => {
  const context = runtimeContext(`
    var window = {};
    var document = {};
    var state = {
      settings: { allergenDays: 7 },
      foods: [
        { id: "hafer", name: "Hafer", allergenGroup: "Glutenhaltiges Getreide", allergenFamily: "hafer", _rank: 2 },
        { id: "weizen", name: "Weizen", allergenGroup: "Glutenhaltiges Getreide", _rank: 2 },
        { id: "kartoffel", name: "Kartoffel", allergenGroup: "", _rank: 2 }
      ],
      logs: [
        { date: "2026-08-01", foodIds: ["hafer"], foodOutcomes: { hafer: "eaten" } },
        { date: "2026-08-20", meal: "lunch", foodIds: ["weizen"], foodOutcomes: { weizen: "tried" } }
      ],
      manualMeals: {},
      planLocks: {
        "2026-08-20|lunch": { focusId: "weizen", foodIds: ["weizen"], baseFoodIds: ["weizen"], sampleFoodIds: [], type: "bekannt", mode: "auto" }
      }
    };
    function food(id) { return state.foods.find((item) => item.id === id); }
    function rank(item) { return item?._rank || 0; }
    function outcomeForFood(log, id) { return log.foodOutcomes?.[id] || ""; }
    function dueAllergen() { return false; }
    function mealIsCompleted(date, meal) { return date === "2026-08-20" && meal === "lunch"; }
    function manualMealFor() { return null; }
    function lockedMeal(date, meal) {
      let lock = state.planLocks[date + "|" + meal];
      return lock ? { ...lock, meal, active: true } : null;
    }
    function recipeByName() { return null; }
    function recipeFoodIds() { return []; }
    function recipeStockCandidate() { return null; }
    function snackRecipeCandidate() { return null; }
    function knownCandidate(meal, on, ctx, blocked) {
      for (let id of ["kartoffel", "weizen"]) if (!(blocked || []).includes(id)) return { f: food(id), type: "bekannt" };
      return null;
    }
    function addDays(value, amount) { let d = new Date(value + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0,10); }
    function freshPlanContext() { return {}; }
    function buildDay(date, index, ctx) {
      let fixed = lockedMeal(date, "lunch");
      if (fixed) return { date, index, meals: [fixed] };
      let candidate = knownCandidate("lunch", date, ctx, []);
      return { date, index, meals: [{ meal: "lunch", active: true, focusId: candidate.f.id, foodIds: [candidate.f.id], baseFoodIds: [candidate.f.id], sampleFoodIds: [], type: candidate.type }] };
    }
    function buildDays(from, n = 7) {
      let ctx = freshPlanContext();
      return Array.from({ length: n }, (_, index) => buildDay(addDays(from, index), index, ctx));
    }
  `);
  const days = vm.runInContext(`buildDays("2026-08-20", 2)`, context);
  assert.equal(days[0].meals[0].focusId, "weizen");
  assert.equal(days[1].meals[0].focusId, "weizen");
  assert.equal(days[1].meals[0].type, "bekannt kombinieren");
});
