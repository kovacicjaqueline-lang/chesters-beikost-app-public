"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const policyPath = path.join(root, "js", "food-status-preferences.js");
const workerPath = path.join(root, "js", "planner-week-worker.js");
const policySource = fs.readFileSync(policyPath, "utf8");
const workerSource = fs.readFileSync(workerPath, "utf8");
const {
  foodStatusPreferenceStoredMealVisible,
} = require(policyPath);

test("inaktive automatische Frühstücks-Locks bleiben gespeichert, werden heute und künftig aber nicht angezeigt", () => {
  const inactiveBreakfast = () => false;
  const activeLunch = () => true;
  const automatic = { mode: "auto", manualAdded: false };
  const manual = { mode: "manual", manualAdded: true };

  assert.equal(
    foodStatusPreferenceStoredMealVisible(
      "2026-09-22",
      "breakfast",
      automatic,
      "2026-09-22",
      inactiveBreakfast,
    ),
    false,
  );
  assert.equal(
    foodStatusPreferenceStoredMealVisible(
      "2026-09-23",
      "breakfast",
      automatic,
      "2026-09-22",
      inactiveBreakfast,
    ),
    false,
  );
  assert.equal(
    foodStatusPreferenceStoredMealVisible(
      "2026-09-23",
      "lunch",
      automatic,
      "2026-09-22",
      activeLunch,
    ),
    true,
  );
  assert.equal(
    foodStatusPreferenceStoredMealVisible(
      "2026-09-23",
      "breakfast",
      manual,
      "2026-09-22",
      inactiveBreakfast,
    ),
    true,
  );
  assert.equal(
    foodStatusPreferenceStoredMealVisible(
      "2026-09-21",
      "breakfast",
      automatic,
      "2026-09-22",
      inactiveBreakfast,
    ),
    true,
    "historische Locks werden nicht umgedeutet oder gelöscht",
  );
});

test("nicht-standalone Fisch-Allergen nutzt die kulinarische Begleiterauswahl statt direkt irgendeine bekannte Basis", () => {
  const context = {
    state: {
      foods: [
        {
          id: "brombeere",
          category: "Obst",
          priority: 1,
          active: true,
          allergenGroup: "",
          meals: ["breakfast", "lunch", "dinner"],
        },
        {
          id: "zucchini",
          category: "Gemüse",
          priority: 2,
          active: true,
          allergenGroup: "",
          meals: ["lunch", "dinner"],
        },
      ],
    },
    plannerAllergenCanBeStandalone: () => false,
    isTrustedBase: () => true,
    eligible: (food, meal) => food.active && food.meals.includes(meal),
    status: () => "Bekannt",
    canCombine: () => true,
    isMilkProductFood: () => false,
    isMeatOrFish: (food) => ["Fleisch", "Fisch", "Meeresfrucht"].includes(food?.category),
    culinaryCompatibilityScore: (_focus, candidate) => candidate.id === "zucchini" ? -54 : 1000,
    usageCount: () => 0,
    console,
  };
  vm.createContext(context);
  vm.runInContext(`${policySource}\nthis.pickCompanion = foodStatusPreferenceCompanionFor;`, context);

  const focus = {
    id: "bangus-milkfish",
    category: "Fisch",
    allergenGroup: "Fisch",
    plannerIntroductionMode: "with_base",
  };
  const result = context.pickCompanion(focus, "lunch", "2026-09-22", "gezielt wiederholen");

  assert.equal(result?.id, "zucchini");
  assert.doesNotMatch(
    policySource,
    /focus\.allergenGroup\s*&&\s*!standaloneAllergen\)\s*return\s+knownBase/,
  );
});

test("Planner-Worker installiert denselben Food-Status-/Präferenz-Adapter wie die sichtbare App", () => {
  assert.ok(workerSource.includes("./food-status-preferences.js?v=10.1.26"));
  const preferenceInstall = workerSource.indexOf("installFoodStatusPreferencePolicy();");
  const foodPolicyInstall = workerSource.indexOf("installFoodPolicyRuntime();");
  assert.ok(preferenceInstall >= 0);
  assert.ok(foodPolicyInstall > preferenceInstall);
});
