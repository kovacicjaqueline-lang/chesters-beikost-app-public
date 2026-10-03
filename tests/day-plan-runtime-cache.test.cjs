"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDayPlanRuntimeCache,
  dayPlanRuntimePlannerInput,
} = require("../js/planner-log-rollover-cascade.js");

function plannerState() {
  return {
    settings: {
      startDate: "2026-07-14",
      phaseSelected: "kennenlernen",
      textureStage: 1,
      targetFoods: 100,
      planCheckEvaluationRevision: 0,
    },
    foods: [{ id: "apfel", active: true, meals: ["lunch"] }],
    logs: [],
    inventory: [],
    overrides: {},
    deferred: {},
    pantry: {},
    planLocks: {},
    autoLockExcluded: {},
    manualMeals: {},
    combinationPauses: {},
    followUps: {},
    shoppingHints: {},
    backupMeta: {
      lastExternalBackup: "",
      plannerLinking: { carriedPlans: {}, rolloverHandled: {} },
    },
  };
}

test("Day-Plan-Berechnungen werden zwischen identischen Planner-Eingaben wiederverwendet", () => {
  let buildCalls = 0;
  let day = "2026-09-18";
  let state = plannerState();
  const runtime = createDayPlanRuntimeCache(
    (from, n, applyAutoLocks) => {
      buildCalls += 1;
      return [{ from, n, applyAutoLocks, buildCalls }];
    },
    () => dayPlanRuntimePlannerInput(state),
    () => day,
  );

  const first = runtime.buildDays("2026-09-18", 7, true);
  const second = runtime.buildDays("2026-09-18", 7, true);

  assert.strictEqual(second, first);
  assert.equal(buildCalls, 1);
  assert.deepEqual(runtime.stats(), {
    generation: 0,
    hits: 1,
    misses: 1,
    entries: 1,
    maxEntries: 64,
  });

  runtime.buildDays("2026-09-18", 1, true);
  runtime.buildDays("2026-09-18", 7, false);
  assert.equal(buildCalls, 3, "Planlänge und Auto-Lock-Modus müssen getrennte Cache-Einträge bleiben");

  day = "2026-09-19";
  runtime.buildDays("2026-09-18", 7, true);
  assert.equal(buildCalls, 4, "ein neuer Kalendertag darf keinen Plan vom Vortag wiederverwenden");
});

test("relevante Planner-State-Änderungen wirken auch ohne save() sofort auf den Cache-Key", () => {
  let buildCalls = 0;
  let state = plannerState();
  const runtime = createDayPlanRuntimeCache(
    () => ({ build: ++buildCalls, override: state.overrides["2026-09-18|lunch"] || "" }),
    () => dayPlanRuntimePlannerInput(state),
    () => "2026-09-18",
  );

  const normal = runtime.buildDays("2026-09-18", 7, false);
  assert.strictEqual(runtime.buildDays("2026-09-18", 7, false), normal);
  assert.equal(buildCalls, 1);

  state.overrides["2026-09-18|lunch"] = "banane";
  const simulated = runtime.buildDays("2026-09-18", 7, false);
  assert.notStrictEqual(simulated, normal);
  assert.equal(simulated.override, "banane");
  assert.equal(buildCalls, 2, "temporärer Planner-State muss neu berechnet werden");
  assert.strictEqual(runtime.buildDays("2026-09-18", 7, false), simulated);
  assert.equal(buildCalls, 2);

  delete state.overrides["2026-09-18|lunch"];
  const restored = runtime.buildDays("2026-09-18", 7, false);
  assert.notStrictEqual(restored, simulated);
  assert.equal(buildCalls, 3, "nach dem Restore muss wieder der echte Ausgangszustand berechnet werden");
  assert.strictEqual(runtime.buildDays("2026-09-18", 7, false), restored);
  assert.equal(buildCalls, 3, "der wiederhergestellte Zustand wird danach erneut gecacht");
});

test("reine Backup- und Plan-Check-Metadaten invalidieren den Tagesplan nicht", () => {
  let buildCalls = 0;
  let state = plannerState();
  const runtime = createDayPlanRuntimeCache(
    () => ({ build: ++buildCalls }),
    () => dayPlanRuntimePlannerInput(state),
    () => "2026-09-18",
  );

  const first = runtime.buildDays("2026-09-18", 7, false);
  state.backupMeta.lastExternalBackup = "2026-09-18T20:00:00.000Z";
  state.settings.targetFoods = 120;
  state.settings.planCheckEvaluationRevision += 1;

  assert.strictEqual(runtime.buildDays("2026-09-18", 7, false), first);
  assert.equal(buildCalls, 1, "plannerfremde UI-/Backup-Daten dürfen keinen Rebuild auslösen");

  state.backupMeta.plannerLinking.carriedPlans.test = { date: "2026-09-19", meal: "lunch" };
  assert.notStrictEqual(runtime.buildDays("2026-09-18", 7, false), first);
  assert.equal(buildCalls, 2, "Planner-Linking bleibt ein relevanter Planner-Eingang");
});

test("eine State-Änderung während der Berechnung cached nur das finale Ergebnis", () => {
  let buildCalls = 0;
  let state = plannerState();
  const runtime = createDayPlanRuntimeCache(
    () => {
      buildCalls += 1;
      if (buildCalls === 1) state.planLocks["2026-09-18|lunch"] = { mode: "auto", focusId: "apfel" };
      return { buildCalls };
    },
    () => dayPlanRuntimePlannerInput(state),
    () => "2026-09-18",
  );

  const first = runtime.buildDays("2026-09-18", 7, true);
  assert.equal(runtime.stats().entries, 1);
  assert.strictEqual(runtime.buildDays("2026-09-18", 7, true), first);
  assert.equal(buildCalls, 1, "das finale Ergebnis nach Auto-Lock-Mutation soll direkt wiederverwendbar sein");
});

test("bewusste Neuplanung kann bei identischem State einen Rebuild erzwingen", () => {
  let buildCalls = 0;
  let state = plannerState();
  const runtime = createDayPlanRuntimeCache(
    () => ({ build: ++buildCalls }),
    () => dayPlanRuntimePlannerInput(state),
    () => "2026-09-18",
  );

  const first = runtime.buildDays("2026-09-18", 7, true);
  runtime.invalidate();
  const rebuilt = runtime.buildDays("2026-09-18", 7, true);
  assert.notStrictEqual(rebuilt, first);
  assert.equal(buildCalls, 2);
  assert.strictEqual(runtime.buildDays("2026-09-18", 7, true), rebuilt);
  assert.equal(buildCalls, 2);
});

test("der Runtime-Cache bleibt begrenzt", () => {
  let buildCalls = 0;
  let state = plannerState();
  const runtime = createDayPlanRuntimeCache(
    (from) => ({ from, build: ++buildCalls }),
    () => dayPlanRuntimePlannerInput(state),
    () => "2026-09-18",
    3,
  );

  runtime.buildDays("2026-09-18");
  runtime.buildDays("2026-09-19");
  runtime.buildDays("2026-09-20");
  runtime.buildDays("2026-09-21");
  assert.equal(runtime.stats().entries, 3);

  runtime.buildDays("2026-09-18");
  assert.equal(buildCalls, 5, "der älteste Eintrag muss nach Überschreiten des Limits neu berechnet werden");
});
