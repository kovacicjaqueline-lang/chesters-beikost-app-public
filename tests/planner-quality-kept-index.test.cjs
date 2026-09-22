"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const quality = require("../js/planner-quality-rotation.js");

function keptState(planLocks, manualMeals = {}, carriedPlans = {}, actions = {}) {
  return {
    planLocks,
    manualMeals,
    backupMeta: {
      plannerLinking: {
        carriedPlans,
        rolloverHandled: actions,
      },
    },
  };
}

test("Kept-Plan-Index erhält Datumsgrenze, Quellreihenfolge und Keep-Filter", () => {
  const state = keptState(
    {
      "2026-08-20|breakfast": {
        planId: "same-id",
        focusId: "bulgur",
        foodIds: ["bulgur", "brombeere"],
      },
      "2026-08-21|breakfast": {
        planId: "same-id",
        focusId: "hafer",
        foodIds: ["hafer", "apfel"],
      },
      "2026-08-20|lunch": {
        planId: "shifted",
        focusId: "karotte",
        foodIds: ["karotte"],
      },
    },
    {
      "2026-08-20|dinner": {
        planId: "same-id",
        focusId: "reis",
        foodIds: ["reis"],
      },
    },
    {
      carried: {
        planId: "carried",
        date: "2026-08-20",
        meal: "dinner",
        focusId: "zucchini",
        foodIds: ["zucchini"],
      },
    },
    {
      "same-id": { action: "keep" },
      shifted: { action: "shift" },
      carried: { action: "keep" },
    },
  );

  const index = quality.plannerQualityKeptPlanIndex(state);
  assert.deepEqual(
    quality.plannerQualityKeptPlanInstances(state, "2026-08-20", index).map((plan) => plan.focusId),
    ["bulgur", "zucchini"],
    "Plan-Lock muss vor manueller Dublette gewinnen; verschobene Pläne bleiben ausgeschlossen",
  );
  assert.deepEqual(
    quality.plannerQualityKeptPlanInstances(state, "2026-08-21", index).map((plan) => plan.focusId),
    ["hafer"],
    "dieselbe planId an einem anderen Datum bleibt wie bisher separat sichtbar",
  );
});

test("Kept-Plan-Quellen werden innerhalb eines Planner-Kontexts nur einmal indexiert", () => {
  const locks = {
    "2026-08-20|breakfast": {
      planId: "day-1",
      focusId: "bulgur",
      foodIds: ["bulgur", "brombeere"],
    },
    "2026-08-21|breakfast": {
      planId: "day-2",
      focusId: "hafer",
      foodIds: ["hafer", "apfel"],
    },
  };
  let planLockReads = 0;
  const state = keptState({}, {}, {}, {
    "day-1": { action: "keep" },
    "day-2": { action: "keep" },
  });
  Object.defineProperty(state, "planLocks", {
    configurable: true,
    enumerable: true,
    get() {
      planLockReads += 1;
      return locks;
    },
  });

  const context = quality.plannerQualityEnsureContext({});
  quality.plannerQualitySeedKeptPlans(context, "2026-08-21", state);
  quality.plannerQualitySeedKeptPlans(context, "2026-08-22", state);
  quality.plannerQualitySeedKeptPlans(context, "2026-08-23", state);

  assert.equal(planLockReads, 1, "ein Planlauf darf Locks nicht für jeden Tag erneut vollständig scannen");
  assert.equal(context.qualityLastFoodUse.get("bulgur"), "2026-08-20");
  assert.equal(context.qualityLastFoodUse.get("hafer"), "2026-08-21");

  let replacementReads = 0;
  const replacement = keptState({}, {}, {}, {});
  Object.defineProperty(replacement, "planLocks", {
    configurable: true,
    enumerable: true,
    get() {
      replacementReads += 1;
      return {};
    },
  });
  quality.plannerQualitySeedKeptPlans(context, "2026-08-24", replacement);
  assert.equal(replacementReads, 1, "ein neuer State muss einen neuen Laufzeitindex erhalten");
});
