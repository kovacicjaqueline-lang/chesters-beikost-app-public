"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  manualMealFlowKey,
  manualMealFlowNormalizePreparationKeys,
  manualMealFlowStoredConflict,
  manualMealFlowRemoveSource,
} = require("../js/manual-meal-flow.js");

const root = path.resolve(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(root, "js", "manual-meal-flow.js"), "utf8");
const planningSource = fs.readFileSync(path.join(root, "js", "planning.js"), "utf8");
const presentationSource = fs.readFileSync(path.join(root, "js", "planner-meal-presentation.js"), "utf8");
const handlingSource = fs.readFileSync(path.join(root, "js", "handling-readiness.js"), "utf8");
const css = fs.readFileSync(path.join(root, "ui-meal-editor-footer.css"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("manueller Zieltag bleibt exakt der aufgerufene Tag und wird nicht auf morgen verschoben", () => {
  assert.equal(manualMealFlowKey("2026-08-19", "breakfast"), "2026-08-19|breakfast");
  assert.match(runtimeSource, /sourceDate:\s*date,[^]*targetDate:\s*date,/);
  assert.match(runtimeSource, /originalStoreManualMeal\(targetDate,\s*meal,\s*payload\)/);
  assert.doesNotMatch(runtimeSource, /targetDate\s*=\s*addDays\([^,]+,\s*1\)/);
});

test("Datum darf auf heute, Zukunft und vorherige Tage geändert werden, solange der Zielslot frei ist", () => {
  const state = { manualMeals: {}, planLocks: {}, overrides: {} };
  assert.equal(manualMealFlowStoredConflict(state, "2026-08-20", "2026-08-19", "breakfast"), "");
  assert.equal(manualMealFlowStoredConflict(state, "2026-08-19", "2026-08-24", "breakfast"), "");
  assert.match(runtimeSource, /type=\"date\" id=\"manualMealTargetDate\"/);
  assert.doesNotMatch(runtimeSource, /manualMealTargetDate[^>]*(?:min|max)=/);
});

test("belegte Zielslots werden nicht still überschrieben", () => {
  const manualKey = "2026-08-19|breakfast";
  assert.match(
    manualMealFlowStoredConflict({ manualMeals: { [manualKey]: { manualAdded: true } } }, "2026-08-20", "2026-08-19", "breakfast"),
    /manuelle Mahlzeit/,
  );
  assert.match(
    manualMealFlowStoredConflict({ planLocks: { [manualKey]: { mode: "auto" } } }, "2026-08-20", "2026-08-19", "breakfast"),
    /fest eingeplant/,
  );
  assert.match(
    manualMealFlowStoredConflict({ overrides: { [manualKey]: "banane" } }, "2026-08-20", "2026-08-19", "breakfast"),
    /belegt/,
  );
  assert.match(
    manualMealFlowStoredConflict({}, "2026-08-20", "2026-08-19", "breakfast", true),
    /protokolliert/,
  );
});

test("Datumsänderung entfernt nur die manuelle Quelle und lässt fremde Locks unangetastet", () => {
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

test("automatische Quelle wird von der manuellen Datums-Rekey-Logik nicht gelöscht", () => {
  const source = "2026-08-20|breakfast";
  const state = {
    manualMeals: {},
    planLocks: { [source]: { mode: "auto" } },
    overrides: { [source]: "banane" },
    autoLockExcluded: {},
  };
  manualMealFlowRemoveSource(state, "2026-08-20", "2026-08-19", "breakfast");
  assert.deepEqual(state.planLocks[source], { mode: "auto" });
  assert.equal(state.overrides[source], "banane");
});

test("Konsistenz-/Darreichungsauswahl bleibt pro Lebensmittel getrennt", () => {
  assert.deepEqual(
    manualMealFlowNormalizePreparationKeys(
      { banane: "mashed", pfirsich: "standard", fremd: "fingerfood", leer: "" },
      ["banane", "pfirsich"],
    ),
    { banane: "mashed", pfirsich: "standard" },
  );
  assert.match(runtimeSource, /followUpPreparationOptions\(foodId\)/);
  assert.match(runtimeSource, /foodPreparationKeys/);
  assert.match(runtimeSource, /Konsistenz \/ Darreichung/);
  assert.match(handlingSource, /handlingPreparationOptions/);
  assert.doesNotMatch(runtimeSource, /spoon-smooth|spoon-mashed|spoon-soft-lumpy|finger-graspable|finger-small-soft/);
});

test("explizite FOOD-Darreichung wird in Manual-Lock, Verschieben und Protokoll durchgereicht", () => {
  assert.match(runtimeSource, /snapshot\.foodPreparationKeys/);
  assert.match(runtimeSource, /manualFlowPlaceMovedMeal/);
  assert.match(runtimeSource, /foodPreparationKeys:\s*preparationKeys/);
  assert.match(runtimeSource, /savedLog\.foodPreparationKeys/);
});

test("manuelle Karten verwenden die etablierte dishTitle-Logik inklusive Hauptbasis plus Kostprobe", () => {
  assert.ok(
    planningSource.includes("return `${naturalMealFoodTitle(base)} und ${sampleName} als Kostprobe`;"),
    "bestehende Mahlzeitenbenennung für Basis + Kostprobe muss erhalten bleiben",
  );
  assert.match(runtimeSource, /meal\?\.manualAdded\s*\|\|\s*meal\?\.lockedMode\s*===\s*\"manual\"/);
  assert.match(runtimeSource, /return dishTitle\(meal\)/);
});

test("Speichern beendet den Tastaturfokus und kehrt deterministisch in den Plan zum Zieltag zurück", () => {
  assert.match(runtimeSource, /document\.activeElement\?\.blur\?\.\(\)/);
  assert.match(runtimeSource, /showView\(\"plan\"\)/);
  assert.match(runtimeSource, /state\.settings\.planFrom\s*=\s*targetDate/);
  assert.match(runtimeSource, /scrollIntoView\?\.\(\{ behavior: \"smooth\", block: \"center\" \}\)/);
});

test("manuelle Karte unterdrückt nativen Details-Marker und trennt primäre/destruktive Aktion mit Design-Tokens", () => {
  assert.match(css, /\.manual-meal\s*>\s*summary\s*\{[^}]*list-style:\s*none;/);
  assert.match(css, /\.manual-meal\s*>\s*summary::\-webkit-details-marker\s*\{[^}]*display:\s*none;/);
  assert.match(css, /\.manual-meal-actions\s*\{[^}]*display:\s*grid;[^}]*gap:\s*var\(--space-group\)\s*!important;[^}]*margin-top:\s*var\(--space-related\);/);
  assert.match(css, /manual-meal-target-date\s*\{[^}]*margin-bottom:\s*var\(--space-group\);/);
  assert.match(runtimeSource, /actions\.append\(log,\s*remove\)/);
});

test("neuer Flow wird dynamisch geladen, offline vorgehalten und UI-08 bleibt erhalten", () => {
  assert.match(presentationSource, /js\/manual-meal-flow\.js\?v=10\.1\.25/);
  assert.match(serviceWorker, /\.\/js\/manual-meal-flow\.js/);
  assert.match(css, /UI-08: Kompakter Plan-Kopf/);
  assert.match(css, /#plan \.plan-defaults\.plan-defaults-compact/);
});
