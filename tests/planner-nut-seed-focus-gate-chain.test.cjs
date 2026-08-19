"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.resolve(__dirname, "..", "js", "planner-food-role-stability.js"),
  "utf8",
);

function policyChainHarness() {
  const peanut = {
    id: "erdnuss",
    name: "Erdnuss",
    category: "Nuss",
    active: true,
    meals: ["breakfast", "lunch", "dinner"],
    foodFamily: "nuss:erdnuss",
    allergenFamily: "nuss:erdnuss",
    allergenGroup: "Erdnuss",
    priority: 10,
  };
  const peanutButter = {
    ...peanut,
    id: "erdnussmus",
    name: "Erdnussmus",
    priority: 11,
  };
  const apple = {
    id: "apfel",
    name: "Apfel",
    category: "Obst",
    active: true,
    meals: ["breakfast", "lunch", "dinner"],
    allergenGroup: "",
    priority: 2,
  };
  const foods = [peanut, peanutButter, apple];
  const context = {
    console,
    state: { foods, overrides: {}, planLocks: {}, settings: {} },
    buildDay: () => ({ meals: [] }),
    lockedMeal: () => null,
    manualMealRoleInfo: (foodOrId) => {
      const food = typeof foodOrId === "string"
        ? foods.find((item) => item.id === foodOrId)
        : foodOrId;
      return { food, role: food?.category === "Nuss" ? "component" : "base" };
    },
    manualMealRoleState: () => null,
    compactMealRolesHtml: () => "",
    food: (id) => foods.find((item) => item.id === id) || null,
    esc: (value) => String(value ?? ""),
    plannerFoodCanBeBase: () => true,
    plannerFoodCanBeAutomaticFocus: () => true,
    plannerAutomaticLockRoleViolation: () => false,
    eligible: (food, meal) => !!food?.active && food.meals.includes(meal),
    relatedFamilyFoodIds: (food, pool) => pool
      .filter((candidate) => candidate.foodFamily === food.foodFamily)
      .map((candidate) => candidate.id),
  };

  // Minimale Nachbildung des bereits vorhandenen FOOD-Policy-Prinzips:
  // introductionCandidate und knownCandidate fragen denselben globalen Fokus-Gate ab.
  context.introductionCandidate = () =>
    context.plannerFoodCanBeAutomaticFocus(peanut)
      ? { f: peanut, type: "Allergen einführen" }
      : null;
  context.knownCandidate = () =>
    context.plannerFoodCanBeAutomaticFocus(peanut)
      ? { f: peanut, type: "bekannt" }
      : { f: apple, type: "bekannt" };
  context.chooseFocus = () => context.knownCandidate();

  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__install = installPlannerFoodRoleStabilityRuntime;`, context);
  assert.equal(context.__install(), true);
  return context;
}

test("Nuss/Samen Policy-Kette: normaler Auto-Fokus bleibt gesperrt, Einführung durch denselben Gate bleibt möglich", () => {
  const context = policyChainHarness();

  assert.equal(context.plannerFoodCanBeAutomaticFocus(context.food("erdnuss")), false);

  const intro = context.introductionCandidate(
    "breakfast",
    "2026-08-19",
    { reserved: new Set() },
    [],
  );
  assert.ok(intro, "Einführung darf vom zentralen Fokus-Gate nicht weggefiltert werden");
  assert.equal(intro.f.id, "erdnussmus");
  assert.equal(intro.type, "Allergen einführen");

  assert.equal(
    context.plannerFoodCanBeAutomaticFocus(context.food("erdnuss")),
    false,
    "Sample-Freigabe darf nach dem Einführungspfad nicht am globalen Gate hängen bleiben",
  );
  assert.equal(
    context.knownCandidate("breakfast", "2026-08-19", {}, []).f.id,
    "apfel",
    "bekannte Nuss darf außerhalb des Sample-Pfads nicht wieder normaler Fokus werden",
  );
});
