"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createDayPlanRuntimeCache } = require("../js/planner-log-rollover-cascade.js");

test("Day-Plan-Berechnungen werden zwischen unveränderten Renderzyklen wiederverwendet", () => {
  let buildCalls = 0;
  let day = "2026-09-18";
  const runtime = createDayPlanRuntimeCache(
    (from, n, applyAutoLocks) => {
      buildCalls += 1;
      return [{ from, n, applyAutoLocks, buildCalls }];
    },
    () => true,
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

test("Speichern invalidiert den Day-Plan-Cache synchron vor dem nächsten Render", () => {
  let buildCalls = 0;
  let saveCalls = 0;
  const saveResult = Promise.resolve("saved");
  const runtime = createDayPlanRuntimeCache(
    () => ({ build: ++buildCalls }),
    () => {
      saveCalls += 1;
      return saveResult;
    },
    () => "2026-09-18",
  );

  const beforeSave = runtime.buildDays("2026-09-18", 7, true);
  assert.strictEqual(runtime.buildDays("2026-09-18", 7, true), beforeSave);

  assert.strictEqual(runtime.save({ snapshotReason: "test" }), saveResult);
  assert.equal(saveCalls, 1);
  assert.equal(runtime.stats().entries, 0, "Invalidierung muss schon beim save()-Aufruf erfolgt sein");

  const afterSave = runtime.buildDays("2026-09-18", 7, true);
  assert.notStrictEqual(afterSave, beforeSave);
  assert.equal(buildCalls, 2);
  assert.equal(runtime.stats().generation, 1);
});

test("eine Invalidierung während der Planner-Berechnung cached nur das finale Ergebnis der neuen Generation", () => {
  let buildCalls = 0;
  let runtime;
  runtime = createDayPlanRuntimeCache(
    () => {
      buildCalls += 1;
      if (buildCalls === 1) runtime.save();
      return { buildCalls };
    },
    () => true,
    () => "2026-09-18",
  );

  const first = runtime.buildDays("2026-09-18", 7, true);
  assert.equal(runtime.stats().generation, 1);
  assert.equal(runtime.stats().entries, 1);
  assert.strictEqual(runtime.buildDays("2026-09-18", 7, true), first);
  assert.equal(buildCalls, 1, "das nach Auto-Lock-Save finale Ergebnis soll direkt wiederverwendbar sein");
});

test("der Runtime-Cache bleibt begrenzt", () => {
  let buildCalls = 0;
  const runtime = createDayPlanRuntimeCache(
    (from) => ({ from, build: ++buildCalls }),
    () => true,
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
