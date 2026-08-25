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
  const source = fs.readFileSync(path.join(root, "js", "planner-allergen-maintenance.js"), "utf8");
  const context = vm.createContext({ console, Set, Map, Object, Array, Number, String, Math, Date, JSON });
  vm.runInContext(`
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
  `, context);
  vm.runInContext(source, context);
  const day = vm.runInContext(`buildDay("2026-08-20", 0, freshPlanContext())`, context);
  assert.equal(day.meals[0].focusId, "banane");
  assert.equal(day.meals[0].type, "neu");
  assert.equal(day.meals[1].focusId, "weizen");
  assert.equal(day.meals[1].type, "bekannt kombinieren");
  assert.equal(day.meals[1].sampleFoodIds.length, 0);
});
