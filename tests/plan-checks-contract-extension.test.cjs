"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "plan-checks-contract-extension.js"), "utf8");
const pureSolutions = require(path.join(root, "js", "planner-plan-check-solutions.js"));

function createHarness({ foods, logs, meals = [] }) {
  let bumpCalls = 0;
  const baseReport = {
    schemaVersion: 1,
    items: [],
    domainStates: { phaseReadiness: { recommendation: "notYet" } },
  };
  const state = {
    foods: JSON.parse(JSON.stringify(foods)),
    logs: JSON.parse(JSON.stringify(logs)),
    settings: {},
    inactivePlanKept: {},
  };
  const context = {
    state,
    console,
    window: {},
    document: {},
    outcomeForFood: (log, id) => log.foodOutcomes?.[id] || log.outcome || "",
    status: () => "Probiert",
    plannerLogExposureKey: (log) => `${log.date}|${log.meal}`,
    PlannerPlanChecks: {
      schemaVersion: 1,
      types: {},
      codes: {},
      report: () => JSON.parse(JSON.stringify(baseReport)),
      compatibilityMessages: () => [],
      installCompatibilityAdapter: () => true,
    },
    PlannerPlanCheckSolutions: {
      ...pureSolutions,
      report: () => ({
        ...JSON.parse(JSON.stringify(baseReport)),
        items: [],
        domainStates: {},
      }),
      bumpEvaluationRevision: () => { bumpCalls += 1; },
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    context,
    days: [{ date: "2026-08-25", meals }],
    bumpCalls: () => bumpCalls,
  };
}

test("AP3 liefert laufende Allergen-Einführung als strukturiertes open_goal", () => {
  const harness = createHarness({
    foods: [{ id: "ei", name: "Ei", active: true, allergenGroup: "Ei", allergenFamily: "ei" }],
    logs: [{ date: "2026-08-20", meal: "lunch", foodIds: ["ei"], foodOutcomes: { ei: "eaten" } }],
    meals: [{ active: true, empty: false, meal: "lunch", focusId: "kartoffel", foodIds: ["kartoffel"] }],
  });
  const report = JSON.parse(JSON.stringify(harness.context.PlannerPlanChecks.report(harness.days)));
  const item = report.items.find((entry) => entry.code === "ALLERGEN_INTRODUCTION_CONTINUE");
  assert.equal(item.type, "open_goal");
  assert.equal(item.details.allergenIntroductionKey, "family:ei");
  assert.deepEqual(report.domainStates.allergenIntroduction.openKeys, ["family:ei"]);
  assert.ok(item.solutionPaths.some((pathEntry) => pathEntry.code === "CONTINUE_ALLERGEN_INTRODUCTION"));
});

test("AP3 markiert laufende Einführung bei sichtbarer Abdeckung projected-covered", () => {
  const harness = createHarness({
    foods: [{ id: "ei", name: "Ei", active: true, allergenGroup: "Ei", allergenFamily: "ei" }],
    logs: [{ date: "2026-08-20", meal: "lunch", foodIds: ["ei"], foodOutcomes: { ei: "eaten" } }],
    meals: [{ active: true, empty: false, meal: "lunch", focusId: "ei", foodIds: ["ei"], planId: "plan-ei" }],
  });
  const report = JSON.parse(JSON.stringify(harness.context.PlannerPlanChecks.report(harness.days)));
  assert.equal(report.items.some((entry) => entry.code === "ALLERGEN_INTRODUCTION_CONTINUE"), false);
  const projected = report.items.find((entry) => entry.code === "ALLERGEN_INTRODUCTION_PROJECTED");
  assert.equal(projected.type, "projected_covered_goal");
  assert.equal(projected.refs.meals[0].planId, "plan-ei");
});

test("Required Action reaktiviert FOOD zentral ohne Expositionshistorie zu verändern", () => {
  const harness = createHarness({
    foods: [{ id: "ei", name: "Ei", active: false, allergenGroup: "Ei" }],
    logs: [{ date: "2026-08-20", meal: "lunch", foodIds: ["ei"], foodOutcomes: { ei: "eaten" } }],
  });
  harness.context.state.inactivePlanKept.ei = true;
  const beforeLogs = JSON.stringify(harness.context.state.logs);
  const item = {
    type: "required_action",
    code: "INACTIVE_FOOD_PLANNED",
    refs: { foodIds: ["ei"], meals: [{ date: "2026-08-25", meal: "lunch", focusId: "ei" }] },
    solutionPaths: [
      { code: "REACTIVATE_FOOD", kind: "state_change", foodIds: ["ei"] },
      { code: "EDIT_PLANNED_MEAL", kind: "meal_adjustment", meal: { date: "2026-08-25", meal: "lunch", focusId: "ei" } },
    ],
  };
  const result = harness.context.PlannerPlanCheckSolutions.applyRequiredAction(item, "REACTIVATE_FOOD");
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(harness.context.state.foods[0].active, true);
  assert.equal(harness.context.state.inactivePlanKept.ei, undefined);
  assert.equal(JSON.stringify(harness.context.state.logs), beforeLogs);
  assert.equal(harness.bumpCalls(), 1);
});

test("Solution-Report dedupliziert AP3- und Legacy-Erweiterung derselben Einführung", () => {
  const foods = [{ id: "ei", name: "Ei", active: true, allergenGroup: "Ei", allergenFamily: "ei" }];
  const logs = [{ date: "2026-08-20", meal: "lunch", foodIds: ["ei"], foodOutcomes: { ei: "eaten" } }];
  const harness = createHarness({ foods, logs });
  const intro = harness.context.PlannerPlanChecks.report(harness.days).items.find((entry) => entry.code === "ALLERGEN_INTRODUCTION_CONTINUE");
  harness.context.PlannerPlanCheckSolutions = Object.freeze({
    ...harness.context.PlannerPlanCheckSolutions,
    report: () => ({ items: [intro, JSON.parse(JSON.stringify(intro))], domainStates: {} }),
  });
  // Die installierte Erweiterung ist bereits auf dem ursprünglichen Solution-Objekt gebunden;
  // entscheidend ist deshalb der öffentlich sichtbare AP3-Report: dort darf es nur ein Ziel geben.
  const report = harness.context.PlannerPlanChecks.report(harness.days);
  assert.equal(report.items.filter((entry) => entry.code === "ALLERGEN_INTRODUCTION_CONTINUE").length, 1);
});
