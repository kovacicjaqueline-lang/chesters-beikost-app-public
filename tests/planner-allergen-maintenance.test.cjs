"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const maintenance = require("../js/planner-allergen-maintenance.js");

const foods = [
  { id: "hafer", name: "Hafer", allergenGroup: "Glutenhaltiges Getreide", allergenFamily: "hafer" },
  { id: "haferdrink", name: "Haferdrink", allergenGroup: "Glutenhaltiges Getreide", allergenFamily: "hafer" },
  { id: "weizen", name: "Weizen", allergenGroup: "Glutenhaltiges Getreide" },
  { id: "dinkel", name: "Dinkel", allergenGroup: "Glutenhaltiges Getreide" },
  { id: "sesam", name: "Sesam", allergenGroup: "Sesam", allergenFamily: "sesam" },
  { id: "tahin", name: "Tahin", allergenGroup: "Sesam", allergenFamily: "sesam" },
];

function outcome(log, id) {
  return log.foodOutcomes?.[id] || log.outcome || "not_offered";
}

test("Maintenance-Ziele verwenden allergenFamily, aber nicht die breite Allergen-Gruppe als Austauschregel", () => {
  assert.equal(maintenance.targetForFood(foods[0]).key, "family:hafer");
  assert.equal(maintenance.targetForFood(foods[1]).key, "family:hafer");
  assert.equal(maintenance.targetForFood(foods[2]).key, "food:weizen");
  assert.equal(maintenance.targetForFood(foods[3]).key, "food:dinkel");
  assert.notEqual(
    maintenance.targetForFood(foods[0]).key,
    maintenance.targetForFood(foods[2]).key,
    "Hafer darf nicht allein über 'Glutenhaltiges Getreide' durch Weizen ersetzt werden",
  );
  assert.notEqual(
    maintenance.targetForFood(foods[2]).key,
    maintenance.targetForFood(foods[3]).key,
    "die breite Gluten-Gruppe erzeugt ohne explizite Familie keine neue Gleichsetzung",
  );
});

test("historische Erfüllung zählt nur tatsächlich gegessene kanonische Ziel-Zutaten", () => {
  const target = maintenance.targetForFood(foods[0]);
  const logs = [
    { date: "2026-08-10", foodIds: ["hafer"], foodOutcomes: { hafer: "eaten" } },
    { date: "2026-08-15", foodIds: ["haferdrink"], foodOutcomes: { haferdrink: "not_offered" } },
    { date: "2026-08-18", foodIds: ["weizen"], foodOutcomes: { weizen: "eaten" } },
  ];
  assert.equal(
    maintenance.latestSuccessfulExposureDate(target, foods, logs, outcome, "2026-08-24"),
    "2026-08-10",
  );
});

test("eine gegessene gleichwertige Familien-Variante aktualisiert dasselbe Maintenance-Ziel", () => {
  const target = maintenance.targetForFood(foods[0]);
  const logs = [
    { date: "2026-08-10", foodIds: ["hafer"], foodOutcomes: { hafer: "eaten" } },
    { date: "2026-08-22", foodIds: ["haferdrink"], foodOutcomes: { haferdrink: "eaten" } },
  ];
  assert.equal(
    maintenance.latestSuccessfulExposureDate(target, foods, logs, outcome, "2026-08-24"),
    "2026-08-22",
  );
});

test("geplante Abdeckung unterdrückt die erneute Planung, verändert aber nicht die historische Erfüllung", () => {
  const rank = (item) => item.id === "hafer" || item.id === "haferdrink" ? 2 : 0;
  const logs = [
    { date: "2026-08-10", foodIds: ["hafer"], foodOutcomes: { hafer: "eaten" } },
  ];
  const target = maintenance.targetForFood(foods[0]);
  const dueWithoutPlan = maintenance.dueTargets({
    foods,
    logs,
    on: "2026-08-24",
    intervalDays: 7,
    rankFn: rank,
    outcomeForFoodFn: outcome,
  });
  assert.deepEqual(dueWithoutPlan.map((item) => item.key), ["family:hafer"]);

  const projected = new Set(["family:hafer"]);
  const dueWithPlan = maintenance.dueTargets({
    foods,
    logs,
    on: "2026-08-24",
    intervalDays: 7,
    rankFn: rank,
    outcomeForFoodFn: outcome,
    projectedTargetKeys: projected,
  });
  assert.deepEqual(dueWithPlan, []);
  assert.equal(
    maintenance.latestSuccessfulExposureDate(target, foods, logs, outcome, "2026-08-24"),
    "2026-08-10",
    "eine Planung darf nicht als historisch gegessen verbucht werden",
  );
});

test("ein Rezept kann über seine kanonischen Zutaten mehrere bekannte Maintenance-Ziele abdecken", () => {
  const record = { recipeName: "Hafer-Sesam-Brei" };
  const recipe = { name: "Hafer-Sesam-Brei" };
  const keys = maintenance.projectedTargetKeysForRecord(record, foods, {
    recipeByNameFn: () => recipe,
    recipeFoodIdsFn: () => ["hafer", "sesam"],
  });
  assert.deepEqual(new Set(keys), new Set(["family:hafer", "family:sesam"]));
});

test("Maintenance priorisiert nur Kandidaten, die der bestehende bekannte Kandidatenpfad bereits zulässt", () => {
  const target = maintenance.targetForFood(foods[0]);
  const allowed = [
    { f: foods[2], type: "bekannt" },
    { f: foods[0], type: "bekannt / Vorrat" },
  ];
  const candidateFn = (_meal, _on, _ctx, exclude) =>
    allowed.find((item) => !exclude.includes(item.f.id)) || null;
  const result = maintenance.candidateForTarget(target, {
    meal: "breakfast",
    on: "2026-08-24",
    ctx: {},
    exclude: [],
    candidateFn,
  });
  assert.equal(result?.f.id, "hafer");
});

test("Runtime-Regression: fällige Hafer-Pflege blockiert keinen neuen Lernslot", () => {
  const source = fs.readFileSync(path.join(__dirname, "../js/planner-allergen-maintenance.js"), "utf8");
  const oats = {
    id: "hafer",
    name: "Hafer",
    allergenGroup: "Glutenhaltiges Getreide",
    allergenFamily: "hafer",
  };
  const carrot = { id: "karotte", name: "Karotte", allergenGroup: "" };
  const state = {
    foods: [oats, carrot],
    logs: [{ date: "2026-08-10", foodIds: ["hafer"], foodOutcomes: { hafer: "eaten" } }],
    settings: { allergenDays: 7 },
    manualMeals: {},
    planLocks: {},
  };
  const ctx = {
    reserved: new Set(), introduced: [], plannedUse: new Map(), lastFocus: new Map(),
    inventoryReserved: new Map(), recipeReserved: new Map(), recipePlannedUse: new Map(), fullMilkDates: new Set(),
  };
  const sandbox = {
    console,
    Set,
    Map,
    Date,
    JSON,
    Math,
    Number,
    String,
    Object,
    Array,
    globalThis: null,
    window: {},
    document: {},
    state,
    dueAllergen: () => true,
    rank: (item) => item.id === "hafer" ? 2 : 0,
    outcomeForFood: outcome,
    food: (id) => state.foods.find((item) => item.id === id) || null,
    recipeByName: () => null,
    recipeFoodIds: () => [],
    manualMealFor: () => null,
    lockedMeal: () => null,
    recipeStockCandidate: () => null,
    snackRecipeCandidate: () => null,
    knownCandidate: (_meal, _on, _ctx, exclude = []) =>
      exclude.includes("hafer") ? null : { f: oats, type: "bekannt" },
    introductionCandidate: () =>
      sandbox.dueAllergen(oats, "2026-08-24")
        ? { f: oats, type: "Allergen wiederholen" }
        : { f: carrot, type: "neu" },
    buildDay: (_date, _index, innerCtx) => {
      const learning = sandbox.introductionCandidate("lunch", "2026-08-24", innerCtx, []);
      const maintenanceCandidate = sandbox.knownCandidate("dinner", "2026-08-24", innerCtx, [learning.f.id]);
      return {
        date: "2026-08-24",
        meals: [
          { meal: "lunch", active: true, focusId: learning.f.id, foodIds: [learning.f.id], sampleFoodIds: [learning.f.id], type: learning.type },
          maintenanceCandidate
            ? { meal: "dinner", active: true, focusId: maintenanceCandidate.f.id, foodIds: [maintenanceCandidate.f.id], sampleFoodIds: [], type: maintenanceCandidate.type }
            : { meal: "dinner", active: true, empty: true },
        ],
      };
    },
    freshPlanContext: () => ctx,
    addDays: (date) => date,
    ensureAutoLocks: () => false,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "planner-allergen-maintenance.js" });

  assert.equal(sandbox.dueAllergen(oats, "2026-08-24"), false);
  const day = sandbox.buildDay("2026-08-24", 0, ctx);
  assert.equal(day.meals[0].focusId, "karotte");
  assert.equal(day.meals[0].type, "neu");
  assert.equal(day.meals[1].focusId, "hafer");
  assert.equal(day.meals[1].sampleFoodIds.length, 0);
  assert.equal(day.meals[1].type, "bekannt kombinieren");
});
