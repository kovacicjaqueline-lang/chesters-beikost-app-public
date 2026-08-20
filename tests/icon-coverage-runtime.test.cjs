"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ICONS_SOURCE = fs.readFileSync(path.join(__dirname, "..", "js", "icons.js"), "utf8");

function auditWithRuntimeResolution(foods) {
  const context = {
    FOOD_DB: foods,
    RECIPES: [],
    console: { error() {} },
    document: { addEventListener() {} },
    esc: (value) => String(value),
    food: (id) => foods.find((item) => item.id === id),
  };

  vm.createContext(context);
  vm.runInContext(ICONS_SOURCE, context, { filename: "js/icons.js" });
  vm.runInContext(`{
    const originalFoodIllustrationPathForTest = foodIllustrationPath;
    foodIllustrationPath = function policyAwareFoodIllustrationPathForTest(f) {
      if (f?.illustrationId && FOOD_ICON_PATHS[f.illustrationId]) return FOOD_ICON_PATHS[f.illustrationId];
      return originalFoodIllustrationPathForTest(f);
    };
  }`, context);

  return vm.runInContext("auditIllustrationCoverage()", context);
}

test("Icon-Coverage berücksichtigt die effektive Runtime-Auflösung über illustrationId", () => {
  const audit = auditWithRuntimeResolution([
    { id: "mais", name: "Mais", category: "Getreide/Stärke", illustrationId: "mais-polenta" },
  ]);

  assert.deepEqual(Array.from(audit.foodsMissing), []);
  assert.equal(audit.foodCount, 1);
});

test("Icon-Coverage erkennt einen echten Kategorie-Fallback weiterhin als fehlend", () => {
  const audit = auditWithRuntimeResolution([
    { id: "runtime-obst", name: "Runtime-Obst", category: "Obst", illustrationId: "nicht-vorhanden" },
  ]);

  assert.deepEqual(Array.from(audit.foodsMissing), ["Runtime-Obst"]);
});

test("Icon-Coverage erkennt den generischen Fallback weiterhin als fehlend", () => {
  const audit = auditWithRuntimeResolution([
    { id: "runtime-unbekannt", name: "Runtime-Unbekannt", category: "Unbekannt" },
  ]);

  assert.deepEqual(Array.from(audit.foodsMissing), ["Runtime-Unbekannt"]);
});
