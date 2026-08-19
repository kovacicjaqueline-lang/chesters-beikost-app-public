"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const policySource = fs.readFileSync(
  path.join(root, "js", "planner-meal-eligibility.js"),
  "utf8",
);

const {
  plannerFoodMealEligible,
  plannerAutomaticFoodMealEligible,
  pruneMealIneligibleAutomaticPlanState,
} = require("../js/planner-meal-eligibility.js");

test("FOOD.meals ist für die drei Hauptmahlzeiten hart, Snack bleibt rezeptgetrieben", () => {
  const meat = { id: "pferd", meals: ["lunch", "dinner"] };
  const fruit = { id: "banane", meals: ["breakfast", "lunch", "dinner"] };

  assert.equal(plannerFoodMealEligible(meat, "breakfast"), false);
  assert.equal(plannerFoodMealEligible(meat, "lunch"), true);
  assert.equal(plannerFoodMealEligible(meat, "dinner"), true);
  assert.equal(plannerFoodMealEligible(meat, "snack"), true);
  assert.equal(plannerFoodMealEligible(fruit, "breakfast"), true);
});

test("allgemeine FOOD-Eignung und Mahlzeiteneignung müssen gemeinsam erfüllt sein", () => {
  const food = { id: "x", meals: ["lunch"], autoPlan: false };
  const automatic = (item) => item.autoPlan !== false;

  assert.equal(
    plannerAutomaticFoodMealEligible(food, "breakfast", "2026-08-18", {}, automatic),
    false,
  );
  assert.equal(
    plannerAutomaticFoodMealEligible(food, "lunch", "2026-08-18", {}, automatic),
    false,
  );
  food.autoPlan = true;
  assert.equal(
    plannerAutomaticFoodMealEligible(food, "lunch", "2026-08-18", {}, automatic),
    true,
  );
});

test("alte automatische Locks mit falscher FOOD-Mahlzeit werden entfernt, manuelle und Snack-Locks bleiben", () => {
  const state = {
    foods: [
      { id: "pferd", meals: ["lunch", "dinner"] },
      { id: "banane", meals: ["breakfast", "lunch", "dinner"] },
    ],
    overrides: {
      "2026-08-18|breakfast": "pferd",
      "2026-08-18|snack": "pferd",
    },
    followUps: {
      pferd: { status: "scheduled", dueDate: "2026-08-18" },
    },
    planLocks: {
      "2026-08-18|breakfast": {
        mode: "auto",
        focusId: "pferd",
        foodIds: ["pferd"],
        followUpFoodId: "pferd",
      },
      "2026-08-19|breakfast": {
        mode: "manual",
        focusId: "pferd",
        foodIds: ["pferd"],
      },
      "2026-08-18|snack": {
        mode: "auto",
        focusId: "pferd",
        foodIds: ["pferd"],
      },
      "2026-08-19|lunch": {
        mode: "auto",
        focusId: "pferd",
        foodIds: ["pferd"],
      },
    },
  };

  assert.equal(pruneMealIneligibleAutomaticPlanState(state), true);
  assert.equal(state.planLocks["2026-08-18|breakfast"], undefined);
  assert.equal(state.overrides["2026-08-18|breakfast"], undefined);
  assert.equal(state.followUps.pferd.status, "later");
  assert.equal(state.followUps.pferd.dueDate, "");
  assert.ok(state.planLocks["2026-08-19|breakfast"]);
  assert.ok(state.planLocks["2026-08-18|snack"]);
  assert.ok(state.planLocks["2026-08-19|lunch"]);
});

function runtimeContext() {
  const recipe = {
    name: "Test-Pancakes",
    requires: ["Hafer", "Zucchini"],
    alternatives: [["Hafer", "Banane"]],
  };
  const context = {
    console,
    Date,
    Set,
    Map,
    WeakMap,
    state: {
      settings: {},
      foods: [
        { id: "hafer", name: "Hafer", meals: ["breakfast", "lunch", "dinner"] },
        { id: "zucchini", name: "Zucchini", meals: ["lunch", "dinner"] },
        { id: "banane", name: "Banane", meals: ["breakfast", "lunch", "dinner"] },
        { id: "pferd", name: "Pferdefleisch", meals: ["lunch", "dinner"] },
      ],
      planLocks: {},
      overrides: {},
      followUps: {},
    },
    __followUpCalls: 0,
    automaticFoodEligibility: () => true,
    companionFor(focus) {
      return context.state.foods.find((item) => item.id !== focus.id) || null;
    },
    recipeStockCandidate() {
      const sets = [recipe.requires, ...recipe.alternatives];
      const names = new Set(context.state.foods.map((item) => item.name));
      return sets.some((set) => set.every((name) => names.has(name))) ? recipe : null;
    },
    snackRecipeCandidate() {
      return recipe;
    },
    recipeFoodIds(selected) {
      const sets = [selected.requires || [], ...(selected.alternatives || [])];
      const names = new Map(context.state.foods.map((item) => [item.name, item.id]));
      const set = sets.find((candidate) => candidate.every((name) => names.has(name))) || [];
      return set.map((name) => names.get(name));
    },
    applyFollowUpPlan(record, requestedDate = "") {
      context.__followUpCalls++;
      const date = requestedDate || record.dueDate || "2026-08-20";
      const meal = record.meal || "lunch";
      const key = `${date}|${meal}`;
      context.state.planLocks[key] = {
        mode: "auto",
        focusId: record.foodId,
        foodIds: [record.foodId],
        followUpFoodId: record.foodId,
      };
      context.state.overrides[key] = record.foodId;
      return { ok: true, date };
    },
    pruneIneligibleAutomaticPlanState() {
      return false;
    },
    food(id) {
      return context.state.foods.find((item) => item.id === id) || null;
    },
    removeFollowUpPlan(foodId) {
      for (const [key, lock] of Object.entries(context.state.planLocks)) {
        if (lock.followUpFoodId === foodId) delete context.state.planLocks[key];
      }
    },
    save() {},
    renderAll() {},
  };
  vm.createContext(context);
  vm.runInContext(
    `${policySource}\nthis.__installPlannerMealEligibilityRuntime = installPlannerMealEligibilityRuntime;`,
    context,
  );
  assert.equal(context.__installPlannerMealEligibilityRuntime(), true);
  return { context, recipe };
}

test("Begleiter werden vor Kombinationslogik auf FOOD.meals begrenzt", () => {
  const { context } = runtimeContext();
  const focus = context.state.foods.find((item) => item.id === "hafer");
  const companion = context.companionFor(focus, "breakfast", "2026-08-18");

  assert.equal(companion.id, "banane");
  assert.notEqual(companion.id, "zucchini");
  assert.notEqual(companion.id, "pferd");
});

test("automatischer Rezeptpfad verwendet auch nach Kandidatenauswahl nur mahlzeitgeeignete FOOD-Zutaten", () => {
  const { context } = runtimeContext();
  const recipe = context.recipeStockCandidate("breakfast", "2026-08-18", {});
  assert.ok(recipe);

  const ids = context.recipeFoodIds(recipe);
  assert.deepEqual(Array.from(ids), ["hafer", "banane"]);
  assert.equal(ids.includes("zucchini"), false);
});

test("Snack bleibt von der neuen Hauptmahlzeiten-FOOD-Schranke unberührt", () => {
  const { context } = runtimeContext();
  const recipe = context.snackRecipeCandidate("2026-08-18", {});
  const ids = context.recipeFoodIds(recipe);

  assert.deepEqual(Array.from(ids), ["hafer", "zucchini"]);
});

test("automatische Wiedervorlage wird nicht in eine für das FOOD ungeeignete Hauptmahlzeit geschrieben", () => {
  const { context } = runtimeContext();
  const record = {
    foodId: "pferd",
    meal: "breakfast",
    status: "scheduled",
    dueDate: "2026-08-20",
  };

  const result = context.applyFollowUpPlan(record, "2026-08-20");
  assert.deepEqual({ ok: result.ok, date: result.date }, { ok: true, date: "" });
  assert.equal(context.__followUpCalls, 0);
  assert.equal(record.status, "later");
  assert.equal(record.dueDate, "");
  assert.equal(context.state.planLocks["2026-08-20|breakfast"], undefined);
});

test("gepatchte zentrale Bereinigung entfernt auch Rezept-/FOOD-Locks mit unpassender Zutat", () => {
  const { context } = runtimeContext();
  context.state.planLocks = {
    "2026-08-18|breakfast": {
      mode: "auto",
      focusId: "hafer",
      foodIds: ["hafer", "zucchini"],
      recipeName: "Test-Pancakes",
    },
    "2026-08-18|snack": {
      mode: "auto",
      focusId: "zucchini",
      foodIds: ["zucchini"],
      recipeName: "Snack-Test",
    },
  };

  assert.equal(context.pruneIneligibleAutomaticPlanState(context.state), true);
  assert.equal(context.state.planLocks["2026-08-18|breakfast"], undefined);
  assert.ok(context.state.planLocks["2026-08-18|snack"]);
});
