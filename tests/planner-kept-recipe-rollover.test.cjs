"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const quality = require("../js/planner-quality-rotation.js");

test("Nicht verschieben merkt auch das konkrete Vortagsrezept für die Rotation", () => {
  const state = {
    planLocks: {
      "2026-09-29|lunch": {
        planId: "apple-pear-compote",
        date: "2026-09-29",
        meal: "lunch",
        focusId: "apfel",
        foodIds: ["apfel", "birne"],
        recipeName: "Apfel-Birnen-Kompott",
      },
      "2026-09-29|dinner": {
        planId: "shifted-recipe",
        date: "2026-09-29",
        meal: "dinner",
        focusId: "polenta",
        foodIds: ["polenta", "tomate"],
        recipeName: "Polenta mit Tomate",
      },
    },
    manualMeals: {},
    backupMeta: {
      plannerLinking: {
        carriedPlans: {},
        rolloverHandled: {
          "apple-pear-compote": { action: "keep", at: "2026-09-30T07:00:00.000Z" },
          "shifted-recipe": { action: "shift", at: "2026-09-30T07:00:00.000Z" },
        },
      },
    },
    logs: [],
  };
  const context = quality.plannerQualityEnsureContext({});

  quality.plannerQualitySeedKeptPlans(context, "2026-09-30", state);

  assert.equal(context.recipePlannedUse.get("Apfel-Birnen-Kompott"), 1);
  assert.equal(context.recipeLastUse.get("Apfel-Birnen-Kompott"), "2026-09-29");
  assert.equal(context.recipePlannedUse.has("Polenta mit Tomate"), false);
  assert.equal(context.qualityLastFoodUse.get("apfel"), "2026-09-29");
  assert.equal(context.qualityLastFoodUse.get("birne"), "2026-09-29");
  assert.deepEqual(state.logs, [], "Nicht verschieben darf weiterhin keinen Essens-Log erzeugen");
});
