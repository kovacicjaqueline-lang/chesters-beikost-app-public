"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const contractSource = fs.readFileSync(path.join(root, "data", "food-handling.js"), "utf8");
const policySource = fs.readFileSync(path.join(root, "js", "handling-readiness.js"), "utf8");
const key = "2026-08-22|lunch";

function runtime({
  mode = "auto",
  gradedBite = false,
  structuredChew = false,
  followUpFoodId = "",
} = {}) {
  const context = {
    console,
    saveCalls: 0,
    state: {
      settings: {
        textureStage: 3,
        feedingApproach: "mixed",
        handlingCapabilities: { smallSoftPieces: false, gradedBite, structuredChew },
      },
      planLocks: {
        [key]: {
          mode,
          recipeName: "Baby-Bananenbrot",
          followUpFoodId,
          createdAt: "2026-08-20T08:00:00.000Z",
        },
      },
    },
    recipeStatesCore: () => [],
    followUpPreparationOptions: () => [],
    recipeByName: (name) => ({ name }),
    planLockKey: (date, meal) => `${date}|${meal}`,
    lockedMeal: (date, meal) => {
      const lock = context.state.planLocks[`${date}|${meal}`];
      if (!lock) return null;
      return {
        meal,
        active: true,
        recipeName: lock.recipeName,
        lockedMode: lock.mode,
      };
    },
    save: () => { context.saveCalls += 1; },
  };
  vm.createContext(context);
  vm.runInContext(contractSource, context, { filename: "data/food-handling.js" });
  vm.runInContext(policySource, context, { filename: "js/handling-readiness.js" });
  assert.equal(context.installHandlingReadinessRuntime(), true);
  return context;
}

test("HANDLING upgrade: alter Auto-Lock wird verworfen, wenn structured-chew fehlt", () => {
  const ctx = runtime({ gradedBite: true, structuredChew: false });
  assert.equal(ctx.lockedMeal("2026-08-22", "lunch"), null);
  assert.equal(ctx.state.planLocks[key], undefined);
  assert.equal(ctx.saveCalls, 1);
});

test("HANDLING upgrade: Auto-Lock bleibt mit structured-chew auch ohne graded-bite bestehen", () => {
  const ctx = runtime({ gradedBite: false, structuredChew: true });
  assert.equal(ctx.lockedMeal("2026-08-22", "lunch").recipeName, "Baby-Bananenbrot");
  assert.ok(ctx.state.planLocks[key]);
  assert.equal(ctx.saveCalls, 0);
});

test("HANDLING upgrade: manuelle Locks und Wiedervorlagen werden nicht automatisch entfernt", () => {
  const manual = runtime({ mode: "manual" });
  assert.equal(manual.lockedMeal("2026-08-22", "lunch").recipeName, "Baby-Bananenbrot");
  assert.ok(manual.state.planLocks[key]);
  assert.equal(manual.saveCalls, 0);

  const followUp = runtime({ followUpFoodId: "huhn" });
  assert.equal(followUp.lockedMeal("2026-08-22", "lunch").recipeName, "Baby-Bananenbrot");
  assert.ok(followUp.state.planLocks[key]);
  assert.equal(followUp.saveCalls, 0);
});
