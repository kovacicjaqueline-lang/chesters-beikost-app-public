"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  plannerCompletedLogOnlyDayState,
} = require("../js/planner-meal-presentation.js");

function plannerCore(logs = [], openPlans = []) {
  return {
    logsForDate(_state, date) {
      return logs.filter((log) => log.date === date);
    },
    logQualifiesAsCompletion(log) {
      if (log.foodOutcomes && typeof log.foodOutcomes === "object")
        return Object.values(log.foodOutcomes).some((outcome) => outcome !== "not_offered");
      return log.outcome !== "not_offered";
    },
    openPlanInstances(_state, predicate) {
      return openPlans.filter(predicate);
    },
  };
}

test("vergangener Tag mit tatsächlichen Logs und ohne offenen Plan ist einklappbar", () => {
  const date = "2026-08-22";
  const logs = [
    { date, meal: "lunch", outcome: "eaten", amount: "20" },
    { date, meal: "snack", foodOutcomes: { tomate: "eaten" }, amount: "" },
  ];
  assert.deepEqual(
    plannerCompletedLogOnlyDayState({}, plannerCore(logs), date),
    { canCollapse: true, count: 2, completedCount: 2, grams: 20 },
  );
});

test("ein noch offener konkreter Plan verhindert den Abschlusszustand", () => {
  const date = "2026-08-22";
  const logs = [{ date, meal: "lunch", outcome: "eaten", amount: "20" }];
  const openPlans = [{ date, meal: "dinner", planId: "open-dinner" }];
  assert.equal(
    plannerCompletedLogOnlyDayState({}, plannerCore(logs, openPlans), date).canCollapse,
    false,
  );
});

test("nur nicht angeboten gilt nicht als abgeschlossener Tag", () => {
  const date = "2026-08-22";
  const logs = [{ date, meal: "lunch", outcome: "not_offered", amount: "" }];
  assert.deepEqual(
    plannerCompletedLogOnlyDayState({}, plannerCore(logs), date),
    { canCollapse: false, count: 1, completedCount: 0, grams: 0 },
  );
});

test("Bearbeiten-Aktion wird im Plan in einer zentrierten Vollbreiten-Zeile platziert", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "js", "planner-meal-presentation.js"),
    "utf8",
  );
  assert.match(source, /#blockPlan \.completed-edit-actions\s*\{[\s\S]*?justify-content:\s*center;/);
  assert.match(source, /querySelectorAll\("\.mealbox\.completed \.completed-body-direct \.editCompletedLog"\)/);
  assert.match(source, /actions\.className = "completed-edit-actions";/);
  assert.match(source, /plannerCollapseFinishedLogOnlyDays\(\);\s*plannerCenterCompletedEditActions\(\);/);
});
