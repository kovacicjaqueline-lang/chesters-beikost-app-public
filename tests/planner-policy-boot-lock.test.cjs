"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const handling = require("../js/handling-readiness.js");
const root = path.resolve(__dirname, "..");
const handlingSource = fs.readFileSync(path.join(root, "js", "handling-readiness.js"), "utf8");
const utilsSource = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");

test("Planner-Boot: nur im aktuellen unvollständigen Seiten-Boot erzeugte normale Auto-Locks werden verworfen", () => {
  const startedAt = Date.parse("2026-08-18T21:30:00.000Z");
  const state = {
    planLocks: {
      historicalAuto: {
        mode: "auto",
        createdAt: "2026-08-18T21:29:59.000Z",
      },
      bootAuto: {
        mode: "auto",
        createdAt: "2026-08-18T21:30:00.500Z",
      },
      bootManual: {
        mode: "manual",
        createdAt: "2026-08-18T21:30:00.500Z",
      },
      bootFollowUp: {
        mode: "auto",
        followUpFoodId: "ei",
        createdAt: "2026-08-18T21:30:00.500Z",
      },
      undatedAuto: {
        mode: "auto",
      },
    },
  };

  assert.equal(handling.pruneCurrentPagePrePolicyAutoLocks(state, startedAt), true);
  assert.deepEqual(Object.keys(state.planLocks).sort(), [
    "bootFollowUp",
    "bootManual",
    "historicalAuto",
    "undatedAuto",
  ]);
});

test("Planner-Boot: historische Locks bleiben unverändert, wenn kein sicherer Seitenstart bekannt ist", () => {
  const state = {
    planLocks: {
      existing: {
        mode: "auto",
        createdAt: "2026-08-18T21:30:00.500Z",
      },
    },
  };
  assert.equal(handling.pruneCurrentPagePrePolicyAutoLocks(state, Number.NaN), false);
  assert.ok(state.planLocks.existing);
});

test("Planner-Boot: Boot-Locks werden vor PresentationMode-Runtime und finalem sichtbaren Render bereinigt", () => {
  assert.match(utilsSource, /window\.__plannerPoliciesReady\s*=\s*false/);
  assert.match(
    handlingSource,
    /pruneCurrentPagePrePolicyAutoLocks\(state\);[\s\S]*installPresentationModeRuntime\(\)/,
  );
  assert.match(
    utilsSource,
    /installHandlingReadinessRuntime\(\);[\s\S]*window\.__handlingReadinessReady\s*=\s*true;[\s\S]*completePlannerPolicies\(\)/,
  );
  assert.match(
    utilsSource,
    /window\.__plannerPoliciesReady\s*=\s*true;[\s\S]*renderAll\(\)/,
  );
});
