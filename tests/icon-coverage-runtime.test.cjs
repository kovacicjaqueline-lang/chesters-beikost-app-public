"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ICONS_SOURCE = fs.readFileSync(path.join(__dirname, "..", "js", "icons.js"), "utf8");
const APP_SOURCE = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function runtimeAudit() {
  const foods = [
    {
      id: "mais-polenta",
      name: "Mais",
      alias: "Mais/Polenta",
      category: "Getreide/Stärke",
      priority: 1,
      active: true,
      allergenGroup: "",
      meals: ["breakfast", "lunch", "dinner"],
      count100: true,
      manualStatus: "auto",
    },
    { id: "runtime-obst", name: "Runtime-Obst", category: "Obst", priority: 2, active: true },
    { id: "runtime-unbekannt", name: "Runtime-Unbekannt", category: "Unbekannt", priority: 3, active: true },
  ];

  const context = {
    FOOD_DB: foods,
    ID_ALIASES: {},
    RECIPES: [],
    console: { error() {} },
    document: { addEventListener() {} },
    esc: (value) => String(value),
    food: (id) => foods.find((item) => item.id === id),
    rank: () => 0,
    eatenExposureCount: () => 0,
    eligibleCore: () => true,
    isTrustedBase: () => false,
    knownBase: () => null,
    chooseFocus: () => null,
    introductionCandidate: () => null,
    knownCandidate: () => null,
    companionFor: () => null,
    breakfastReady: () => false,
    manualMealRoleInfo: () => ({}),
    manualMealValidation: (plan) => plan,
    recipeSuitableForMeal: () => true,
    buildDay: () => ({ meals: [] }),
    displayStatus: () => "",
    applyFollowUpPlan: () => ({ ok: false }),
    recipeFoodIds: () => [],
    bootstrapStorage: async () => {},
    recipeStockCandidate: () => null,
    snackRecipeCandidate: () => null,
  };

  vm.createContext(context);
  vm.runInContext(ICONS_SOURCE, context, { filename: "js/icons.js" });
  vm.runInContext(APP_SOURCE, context, { filename: "app.js" });
  vm.runInContext("installFoodPolicyRuntime()", context);

  return {
    audit: vm.runInContext("auditIllustrationCoverage()", context),
    mais: vm.runInContext("FOOD_DB.find((item) => item.id === 'mais')", context),
    maisPath: vm.runInContext("foodIllustrationPath(FOOD_DB.find((item) => item.id === 'mais'))", context),
  };
}

test("Icon-Coverage nutzt die echte Runtime-Auflösung aus app.js für Mais", () => {
  const { audit, mais, maisPath } = runtimeAudit();

  assert.equal(mais.illustrationId, "mais-polenta");
  assert.equal(maisPath, "assets/illustrations-v2/foods/mais-polenta.svg");
  assert.equal(Array.from(audit.foodsMissing).includes("Mais"), false);
});

test("Icon-Coverage erkennt echte Kategorie- und Generic-Fallbacks weiterhin", () => {
  const { audit } = runtimeAudit();
  const missing = Array.from(audit.foodsMissing);

  assert.equal(missing.includes("Runtime-Obst"), true);
  assert.equal(missing.includes("Runtime-Unbekannt"), true);
  assert.equal(missing.includes("Honig"), true);
});
