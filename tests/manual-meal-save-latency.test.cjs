"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(root, "js", "manual-meal-flow.js"), "utf8");

test("Mahlzeiten-Speichern gibt den Browser vor dem teuren Gesamtrender frei", () => {
  const restoreStart = runtimeSource.indexOf("function manualMealFlowRestorePlan");
  const restoreEnd = runtimeSource.indexOf("function installManualMealFlowRuntime", restoreStart);
  const restoreWrapper = runtimeSource.slice(restoreStart, restoreEnd);

  const closeIndex = restoreWrapper.indexOf('closeGeneric === "function"');
  const showPlanIndex = restoreWrapper.indexOf('showView("plan")');
  const renderIndex = restoreWrapper.indexOf("renderAll()");

  assert.ok(closeIndex >= 0, "Dialog muss direkt geschlossen werden");
  assert.ok(showPlanIndex > closeIndex, "Planansicht muss vor dem Gesamtrender sichtbar geschaltet werden");
  assert.ok(renderIndex > showPlanIndex, "der teure Gesamtrender darf erst nach der sichtbaren Rückkehr starten");
  assert.match(restoreWrapper, /manualMealFlowAfterNextPaint\(restore\)/);
  assert.match(runtimeSource, /requestAnimationFrame\(afterPaint\)/);
  assert.match(runtimeSource, /setTimeout\(callback, 0\)/);
});

test("bestehende Planmahlzeiten unterdrücken den synchronen renderAll-Aufruf beim Speichern", () => {
  const editStart = runtimeSource.indexOf("saveEditedPlanMeal = function manualFlowSaveEditedPlanMeal");
  const editEnd = runtimeSource.indexOf("let originalMealDisplayTitle", editStart);
  const editWrapper = runtimeSource.slice(editStart, editEnd);

  assert.match(editWrapper, /manualMealFlowWithDeferredRender\(\(\) =>/);
  assert.match(editWrapper, /originalSaveEditedPlanMeal\.call/);
  assert.match(runtimeSource, /renderAll = \(\) => \{ renderRequested = true; \};/);
  assert.match(runtimeSource, /if \(renderRequested\) manualMealFlowAfterNextPaint\(originalRenderAll\);/);
});
