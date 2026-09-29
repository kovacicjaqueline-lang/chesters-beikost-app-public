"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const handling = require("../js/handling-readiness.js");
const root = path.resolve(__dirname, "..");
const handlingSource = fs.readFileSync(path.join(root, "js", "handling-readiness.js"), "utf8");
const utilsSource = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
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

test("Planner-Boot: Final-Quality und Allergenpflege werden nach Introduction und vor Handling/finalem Render installiert", () => {
  assert.match(utilsSource, /window\.__plannerPoliciesReady\s*=\s*false/);
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
  assert.match(
    utilsSource,
    /window\.__plannerPoliciesReady\s*=\s*true;[\s\S]*settlePlannerReadiness\("ready"\);[\s\S]*renderCurrentView\(\)/,
  );
});

test("Planner-Readiness blockiert nur plannerabhängige Ansichten und öffnet bei Fehler keinen Teilplan", () => {
  assert.match(utilsSource, /window\.PlannerReadiness\s*=\s*Object\.freeze/);
  assert.doesNotMatch(utilsSource, /plannerPolicyBody\.style\.visibility/);
  assert.match(utilsSource, /settlePlannerReadiness\("failed"[\s\S]*renderCurrentView\(\)/);
  assert.doesNotMatch(utilsSource, /failPlannerPolicies[\s\S]*renderAll\(\)/);
  assert.match(uiSource, /function renderView\(id\)[\s\S]*!plannerViewReady\(\)[\s\S]*renderPlannerReadinessPlaceholder\(id\)/);
  assert.match(uiSource, /function renderAll\(\)[\s\S]*if \(plannerViewReady\(\)\)[\s\S]*renderFoods\(\)[\s\S]*renderSettings\(\)/);
  assert.match(uiSource, /if \(viewId === "plan"\)[\s\S]*toolbar\.inert = !plannerViewReady\(\)/);
  assert.match(indexSource, /html:not\(\.app-ready\) #appResumeScreen/);
});

test("Planner-Boot-Fehler rendert keinen Teilplan und lässt die Planner-Readiness fehlgeschlagen", () => {
  let domReady;
  let renderCurrentViewCalls = 0;
  let renderAllCalls = 0;
  let firstScript;
  const context = {
    console: { error() {} },
    renderCurrentView() { renderCurrentViewCalls += 1; },
    renderAll() { renderAllCalls += 1; },
    window: null,
    document: {
      body: { style: {} },
      querySelector: () => null,
      createElement: () => ({
        dataset: {},
        listeners: {},
        addEventListener(type, callback) {
          (this.listeners[type] ||= []).push(callback);
        },
      }),
      head: { appendChild(script) { firstScript = script; } },
    },
  };
  context.window = context;
  context.addEventListener = (type, callback) => {
    if (type === "DOMContentLoaded") domReady = callback;
  };

  vm.runInNewContext(utilsSource, context);
  domReady();
  firstScript.listeners.error[0]({ error: new Error("Planner-Policy fehlt") });

  assert.equal(context.PlannerReadiness.state, "failed");
  assert.equal(context.__plannerPoliciesReady, false);
  assert.equal(renderCurrentViewCalls, 1);
  assert.equal(renderAllCalls, 0);
});
