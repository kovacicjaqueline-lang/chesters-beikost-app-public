"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const precompute = fs.readFileSync(path.join(root, "js", "plan-checks-solution-precompute.js"), "utf8");
const cooperative = fs.readFileSync(path.join(root, "js", "plan-checks-cooperative-search.js"), "utf8");
const loader = fs.readFileSync(path.join(root, "js", "plan-checks-ui.js"), "utf8");
const uiCore = fs.readFileSync(path.join(root, "js", "plan-checks-ui-core.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("offene Plan-Check-Ziele werden gemeinsam vorab gestartet", () => {
  assert.match(precompute, /const tasks = missing\.map\(/);
  assert.match(precompute, /Promise\.allSettled\(tasks\)/);
  assert.match(precompute, /scheduler\?\.postTask/);
  assert.match(precompute, /priority: "background"/);
  assert.match(precompute, /solutions\.findSolutionAsync/);
});

test("fertige Einzelziele aktualisieren die UI vor dem Ende des gesamten Batches", () => {
  const schedule = precompute.slice(
    precompute.indexOf("function scheduleGoalBatch"),
    precompute.indexOf("function goalState"),
  );
  const perGoalRender = schedule.indexOf("rerenderCurrentEvaluation(evaluationKey)");
  const batchBarrier = schedule.indexOf("Promise.allSettled(tasks)");
  assert.ok(
    perGoalRender >= 0 && batchBarrier > perGoalRender,
    "Ein fertiges Ziel muss die sichtbare UI aktualisieren, bevor auf alle übrigen Zielprüfungen gewartet wird",
  );
});

test("kooperative Suche gibt zwischen Zielslots an den Browser zurück", () => {
  assert.match(cooperative, /async function findSolutionAsync/);
  assert.match(cooperative, /await yieldControl\(\)/);
  assert.match(cooperative, /scopedDaysForSlot\(days, slot\)/);
  assert.match(cooperative, /freezeOtherVisibleMeals\(days, targetKey\)/);
  assert.match(cooperative, /candidateRemainsValid\(candidate, item, days, baselineProjectedKeys\)/);
  assert.match(cooperative, /scheduler\?\.yield/);
});

test("kooperative Slotsuche lässt im inneren Solver ausschließlich den Zielslot aktiv", () => {
  const scoped = cooperative.slice(
    cooperative.indexOf("function scopedDaysForSlot"),
    cooperative.indexOf("function freezeOtherVisibleMeals"),
  );
  assert.match(scoped, /day\.date === target\.date && meal\.meal === target\.meal/);
  assert.doesNotMatch(
    scoped,
    /day\.date < current/,
    "Historische gespeicherte Mahlzeiten dürfen nicht als innerer Lösungsslot wieder auftauchen",
  );
});

test("kooperative Suche überspringt fachlich ungeeignete Slots vor dem teuren Solver", () => {
  assert.match(cooperative, /function goalFoodCanUseSlot\(item, slot\)/);
  assert.match(cooperative, /plannerAutomaticFoodMealEligible/);
  const search = cooperative.slice(
    cooperative.indexOf("async function findSolutionAsync"),
    cooperative.indexOf("globalScope.PlannerPlanCheckSolutions = Object.freeze"),
  );
  const eligibilityIndex = search.indexOf("goalFoodCanUseSlot(item, slot)");
  const solverIndex = search.indexOf("base.findSolution(item, scopedDays");
  assert.ok(
    eligibilityIndex >= 0 && solverIndex > eligibilityIndex,
    "Die bestehende FOOD-/Mahlzeiten-Eignung muss vor dem synchronen Solver geprüft werden",
  );
});

test("kooperative Suche isoliert temporären State vor jedem Yield", () => {
  const isolated = cooperative.slice(
    cooperative.indexOf("function withIsolatedState"),
    cooperative.indexOf("function candidateRemainsValid"),
  );
  assert.match(isolated, /const original = state/);
  assert.match(isolated, /state = cloneValue\(state\)/);
  assert.match(isolated, /finally[\s\S]*state = original/);
});

test("Vorberechnete Ergebnisse sind an den Evaluation-Key gebunden und alte Cache-Einträge werden verworfen", () => {
  assert.match(precompute, /solutions\.evaluationKey\(days\)/);
  assert.match(precompute, /evaluationStillCurrent\(evaluationKey\)/);
  assert.match(precompute, /cacheKey\(evaluationKey, item\)/);
  assert.match(precompute, /function activateEvaluation\(evaluationKey\)/);
  assert.match(precompute, /cache\.delete\(key\)/);
  assert.match(precompute, /shouldContinue: \(\) => evaluationStillCurrent\(evaluationKey\)/);
});

test("Lösung ansehen erscheint erst nach einer gefundenen Lösung", () => {
  const renderer = precompute.slice(
    precompute.indexOf("function renderGoalState"),
    precompute.indexOf("function renderPrecomputedPlanQuality"),
  );
  assert.match(renderer, /stateEntry\.status === "pending"/);
  assert.match(renderer, /Passende Möglichkeit wird geprüft/);
  assert.match(renderer, /stateEntry\.status === "none"/);
  assert.match(renderer, /Für diese Woche gibt es keine passende Möglichkeit/);
  assert.match(renderer, /Diese Woche so lassen/);
  assert.ok(
    renderer.indexOf('stateEntry.status === "none"') < renderer.indexOf("Lösung ansehen"),
    "Der CTA darf erst nach Pending-/None-Behandlung gerendert werden",
  );
});

test("der erste Core-Render installiert Precompute explizit ohne renderAll-Wrapper", () => {
  const preservationIndex = loader.indexOf("plan-checks-solution-preservation.js");
  const cooperativeIndex = loader.indexOf("plan-checks-cooperative-search.js");
  const precomputeIndex = loader.indexOf("plan-checks-solution-precompute.js");
  const coreIndex = loader.indexOf("plan-checks-ui-core.js");
  assert.ok(
    preservationIndex >= 0 && cooperativeIndex > preservationIndex && precomputeIndex > cooperativeIndex && coreIndex > precomputeIndex,
    "Preservation, kooperative Suche, Precompute und UI-Core müssen in dieser Reihenfolge geladen werden",
  );
  assert.match(precompute, /globalScope\.__installPlanCheckSolutionPrecompute = installPrecompute/);
  assert.match(uiCore, /globalScope\.__installPlanCheckSolutionPrecompute\(\{ renderNow: false \}\)/);
  assert.doesNotMatch(precompute, /renderAll = function installPrecomputeBeforeInitialCoreRender/);
  assert.doesNotMatch(
    precompute,
    /renderAll = baseRenderAll/,
    "Der asynchrone Bootstrap darf keinen später installierten renderAll-Wrapper mit einer alten Referenz überschreiben",
  );
});

test("Der erste Lösungsschritt verwendet die vorberechnete Lösung statt erneut zu suchen", () => {
  assert.match(precompute, /startGoalFlow\(item, stateEntry\.solution\)/);
  assert.match(precompute, /preparedMatches[\s\S]*\? preparedSolution[\s\S]*: solutions\.findSolution/);
});

test("Runtime und Offline-Precache laden kooperative Suche und Vorberechnung", () => {
  assert.match(loader, /plan-checks-cooperative-search\.js/);
  assert.match(loader, /plan-checks-solution-precompute\.js/);
  assert.match(sw, /\.\/js\/plan-checks-cooperative-search\.js\?v=10\.1\.26/);
  assert.match(sw, /\.\/js\/plan-checks-solution-precompute\.js\?v=10\.1\.26/);
});
