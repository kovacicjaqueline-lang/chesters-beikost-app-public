"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  manualMealFlowKey,
  manualMealFlowLearningValidation,
  manualMealFlowNormalizePreparationKeys,
  manualMealFlowStoredConflict,
  manualMealFlowRemoveSource,
} = require("../js/manual-meal-flow.js");

test("manueller Planplatz verwendet einen stabilen Datum-Mahlzeit-Schlüssel", () => {
  assert.equal(manualMealFlowKey("2026-08-19", "breakfast"), "2026-08-19|breakfast");
});

test("Zieldatum bleibt frei, solange der konkrete Slot unbelegt ist", () => {
  const state = { manualMeals: {}, planLocks: {}, overrides: {} };
  assert.equal(manualMealFlowStoredConflict(state, "2026-08-20", "2026-08-19", "breakfast"), "");
});

test("belegte manuelle, feste oder protokollierte Zielslots werden erkannt", () => {
  const key = "2026-08-19|breakfast";
  assert.match(
    manualMealFlowStoredConflict({ manualMeals: { [key]: { manualAdded: true } } }, "2026-08-20", "2026-08-19", "breakfast"),
    /manuelle Mahlzeit/,
  );
  assert.match(
    manualMealFlowStoredConflict({ planLocks: { [key]: { mode: "auto" } } }, "2026-08-20", "2026-08-19", "breakfast"),
    /fest eingeplant/,
  );
  assert.match(manualMealFlowStoredConflict({}, "2026-08-20", "2026-08-19", "breakfast", true), /protokolliert/);
});

test("beim Verschieben werden nur die Daten der manuellen Quelle entfernt", () => {
  const source = "2026-08-20|breakfast";
  const other = "2026-08-20|lunch";
  const state = {
    manualMeals: { [source]: { manualAdded: true }, [other]: { manualAdded: true } },
    planLocks: { [source]: { mode: "manual" }, [other]: { mode: "auto" } },
    overrides: { [source]: "banane", [other]: "karotte" },
    autoLockExcluded: { [source]: true, [other]: true },
  };

  assert.equal(manualMealFlowRemoveSource(state, "2026-08-20", "2026-08-19", "breakfast"), true);
  assert.equal(state.manualMeals[source], undefined);
  assert.equal(state.planLocks[source], undefined);
  assert.equal(state.overrides[source], undefined);
  assert.equal(state.autoLockExcluded[source], undefined);
  assert.deepEqual(state.manualMeals[other], { manualAdded: true });
  assert.deepEqual(state.planLocks[other], { mode: "auto" });
  assert.equal(state.overrides[other], "karotte");
  assert.equal(state.autoLockExcluded[other], true);
});

test("Zubereitungsauswahl wird auf vorhandene Lebensmittel und nichtleere Schlüssel begrenzt", () => {
  assert.deepEqual(
    manualMealFlowNormalizePreparationKeys(
      { banane: "mashed", pfirsich: "standard", fremd: "fingerfood", leer: " " },
      ["banane", "pfirsich"],
    ),
    { banane: "mashed", pfirsich: "standard" },
  );
});

test("mehrere neue Kostproben erzeugen einen Hinweis, blockieren aber nicht das Speichern", () => {
  const result = manualMealFlowLearningValidation(
    { ids: ["banane", "pfirsich"], samples: ["banane", "pfirsich"], messages: [] },
    () => "Offen",
    (id) => ({ banane: "Banane", pfirsich: "Pfirsich" })[id],
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.multipleUnsafeIds, []);
  assert.match(result.advisory, /Banane, Pfirsich/);
});
