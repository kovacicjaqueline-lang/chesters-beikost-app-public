"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const handling = require("../js/handling-readiness.js");
const root = path.resolve(__dirname, "..");
const handlingSource = fs.readFileSync(path.join(root, "js", "handling-readiness.js"), "utf8");
const utilsSource = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");

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

test("Planner-Boot: erster Render wartet auf Policies und Storage, ohne den gesamten Body zu verbergen", () => {
  assert.match(utilsSource, /window\.__plannerPoliciesReady\s*=\s*false/);
  assert.match(utilsSource, /window\.__plannerPoliciesReadyPromise\s*=\s*new Promise/);
  assert.match(utilsSource, /resolvePlannerPoliciesReady\(true\)/);
  assert.doesNotMatch(utilsSource, /body\.style\.visibility\s*=\s*["']hidden/);
  assert.match(
    utilsSource,
    /installPlannerIntroductionPolicyRuntime\(\);[\s\S]*loadFinalQualityPolicy\(\)/,
  );
  assert.match(
    utilsSource,
    /installPlannerFinalQualityRuntime\(\);[\s\S]*loadMaintenancePolicy\(\)/,
  );
  assert.match(
    utilsSource,
    /let installMaintenanceAndFinish = \(\) => \{[\s\S]*PlannerAllergenMaintenance[\s\S]*finishPlannerPolicies\(\);[\s\S]*\};/,
  );
  assert.match(
    utilsSource,
    /maintenanceScript\.src = "js\/planner-allergen-maintenance\.js\?v=10\.1\.26";[\s\S]*maintenanceScript\.addEventListener\("load", installMaintenanceAndFinish, \{ once: true \}\)/,
  );
  assert.match(
    swSource,
    /planner-introduction-policy\.js[\s\S]*planner-final-quality\.js[\s\S]*planner-allergen-maintenance\.js/,
  );
  assert.match(
    handlingSource,
    /pruneCurrentPagePrePolicyAutoLocks\(state\);[\s\S]*installPresentationModeRuntime\(\)/,
  );
  assert.match(
    utilsSource,
    /installHandlingReadinessRuntime\(\);[\s\S]*window\.__handlingReadinessReady\s*=\s*true;[\s\S]*completePlannerPolicies\(\)/,
  );
  assert.match(appSource, /const plannerPoliciesReady = window\.__plannerPoliciesReadyPromise/);
  assert.match(
    appSource,
    /Promise\.resolve\(plannerPoliciesReady\)[\s\S]*\.then\(\(ready\) => \{[\s\S]*bootstrapStorage\(\)[\s\S]*\.finally\(\(\) => \{[\s\S]*window\.__plannerPoliciesReady = plannerPoliciesInstalled;[\s\S]*renderCurrentView\(\)/,
  );
  assert.match(indexSource, /id="appBootStatus" role="status"/);
  assert.match(indexSource, /<main id="appMain" inert>/);
  assert.match(indexSource, /<nav inert>/);
  assert.match(indexSource, /html\.app-boot-pending main>\.view\{display:none!important\}/);
});
