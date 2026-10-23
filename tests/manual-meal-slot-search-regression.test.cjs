"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  manualMealFlowRoleInfoForManualSlot,
} = require("../js/manual-meal-flow.js");

const root = path.resolve(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(root, "js", "manual-meal-flow.js"), "utf8");

function slotAwareRoleInfo(item, meal) {
  if (!(item.meals || []).includes(meal))
    return { role: "excluded", reason: "meal", food: item };
  if (item.unavailable)
    return { role: "excluded", reason: "unavailable", food: item };
  return { role: "component", reason: "known_component", food: item };
}

test("manuelle Frühstückssuche lässt Tomate trotz lunch/dinner Auto-Slots zu", () => {
  const tomate = {
    id: "tomate",
    name: "Tomate",
    active: true,
    category: "Gemüse",
    meals: ["lunch", "dinner"],
  };

  assert.deepEqual(slotAwareRoleInfo(tomate, "breakfast"), {
    role: "excluded",
    reason: "meal",
    food: tomate,
  });

  const result = manualMealFlowRoleInfoForManualSlot(
    slotAwareRoleInfo,
    tomate,
    "breakfast",
    "2026-09-30",
  );

  assert.equal(result.role, "component");
  assert.equal(result.reason, "known_component");
  assert.ok(result.food.meals.includes("breakfast"));
  assert.deepEqual(tomate.meals, ["lunch", "dinner"], "kanonische Auto-Slots dürfen nicht verändert werden");
});

test("Cross-Slot-Korrektur umgeht keine übrigen manuellen Ausschlüsse", () => {
  const tomate = {
    id: "tomate",
    name: "Tomate",
    active: true,
    category: "Gemüse",
    meals: ["lunch", "dinner"],
    unavailable: true,
  };

  const result = manualMealFlowRoleInfoForManualSlot(
    slotAwareRoleInfo,
    tomate,
    "breakfast",
    "2026-09-30",
  );

  assert.equal(result.role, "excluded");
  assert.equal(result.reason, "unavailable");
});

test("Runtime wendet die Cross-Slot-Korrektur vor Suche und manueller Validierung an", () => {
  const rolePatch = runtimeSource.indexOf("manualMealRoleInfo = function manualFlowManualMealRoleInfo");
  const validationPatch = runtimeSource.indexOf("manualMealValidation = function manualFlowManualMealValidation");

  assert.ok(rolePatch >= 0, "manualMealRoleInfo muss für den manuellen Editor gepatcht werden");
  assert.ok(validationPatch > rolePatch, "Rollenprüfung muss vor der manuellen Validierung installiert sein");
  assert.match(runtimeSource, /manualMealFlowRoleInfoForManualSlot\(/);
});
