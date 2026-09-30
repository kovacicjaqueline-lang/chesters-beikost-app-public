"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const {
  copiedPlanMealPayload,
  applyPlanMealCopy,
} = require("../js/plan-meal-copy.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("Plan-Kopie behält den Mahlzeiteninhalt, setzt aber Zieltag und manuellen Schutzkontext", () => {
  const source = {
    date: "2026-09-30",
    meal: "breakfast",
    focusId: "ei",
    foodIds: ["polenta", "ei"],
    baseFoodIds: ["polenta"],
    sampleFoodIds: ["ei"],
    recipeName: "",
    manualAdded: false,
    note: "Eigene Notiz",
    createdAt: "alt",
  };
  const before = clone(source);

  const copied = copiedPlanMealPayload(source, "2026-10-02", "2026-09-30T16:00:00.000Z");

  assert.deepEqual(source, before, "die Quellmahlzeit darf nicht verändert werden");
  assert.deepEqual(copied.foodIds, ["polenta", "ei"]);
  assert.deepEqual(copied.baseFoodIds, ["polenta"]);
  assert.deepEqual(copied.sampleFoodIds, ["ei"]);
  assert.equal(copied.date, "2026-10-02");
  assert.equal(copied.manualAdded, true);
  assert.equal(copied.note, "Eigene Notiz");
  assert.equal(copied.createdAt, "2026-09-30T16:00:00.000Z");
});

test("Plan-Kopie ersetzt nur den Ziel-Slot und lässt Quelle, Quell-Lock und Quell-Override unangetastet", () => {
  const sourceKey = "2026-09-30|breakfast";
  const targetKey = "2026-10-02|breakfast";
  const sourceMeal = {
    date: "2026-09-30",
    meal: "breakfast",
    focusId: "ei",
    foodIds: ["polenta", "ei"],
    note: "",
  };
  const sourceLock = { mode: "manual", focusId: "ei" };
  const sourceOverride = "ei";
  const state = {
    manualMeals: {
      [sourceKey]: clone(sourceMeal),
      [targetKey]: { date: "2026-10-02", meal: "breakfast", focusId: "birne" },
    },
    planLocks: {
      [sourceKey]: clone(sourceLock),
      [targetKey]: { mode: "manual", focusId: "birne" },
    },
    overrides: {
      [sourceKey]: sourceOverride,
      [targetKey]: "birne",
    },
  };
  let snapshotCall = null;

  const result = applyPlanMealCopy(state, sourceMeal, "2026-10-02", {
    keyFor: (date, meal) => `${date}|${meal}`,
    createdAt: "2026-09-30T16:00:00.000Z",
    snapshot: (date, meal, item, mode) => {
      snapshotCall = { date, meal, item: clone(item), mode };
      return { mode, focusId: item.focusId, foodIds: [...item.foodIds] };
    },
  });

  assert.equal(result.targetKey, targetKey);
  assert.deepEqual(state.manualMeals[sourceKey], sourceMeal);
  assert.deepEqual(state.planLocks[sourceKey], sourceLock);
  assert.equal(state.overrides[sourceKey], sourceOverride);
  assert.equal(state.overrides[targetKey], undefined);
  assert.equal(state.manualMeals[targetKey].date, "2026-10-02");
  assert.equal(state.manualMeals[targetKey].manualAdded, true);
  assert.deepEqual(state.manualMeals[targetKey].foodIds, ["polenta", "ei"]);
  assert.deepEqual(state.planLocks[targetKey], {
    mode: "manual",
    focusId: "ei",
    foodIds: ["polenta", "ei"],
  });
  assert.deepEqual(snapshotCall, {
    date: "2026-10-02",
    meal: "breakfast",
    item: {
      ...sourceMeal,
      date: "2026-10-02",
      manualAdded: true,
      createdAt: "2026-09-30T16:00:00.000Z",
      active: true,
    },
    mode: "manual",
  });
});

test("Plan-UI lädt die Kopieraktion versioniert, offline und ausschließlich an Plan-Verschiebeaktionen", () => {
  const moduleSource = fs.readFileSync(path.join(root, "js", "plan-meal-copy.js"), "utf8");
  const loader = fs.readFileSync(path.join(root, "js", "plan-checks-ui.js"), "utf8");
  const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

  assert.match(loader, /`plan-meal-copy\.js\$\{version\}`/);
  assert.ok(
    loader.indexOf("plan-meal-copy.js") < loader.indexOf("plan-mobile-ui.js"),
    "Kopieraktion soll vor der mobilen Plan-Nachbearbeitung installiert sein",
  );
  assert.match(serviceWorker, /\.\/js\/plan-meal-copy\.js\?v=10\.1\.26/);
  assert.match(moduleSource, /document\.getElementById\("plan"\)/);
  assert.match(moduleSource, /\.moveMeal\[data-move-payload\]/);
  assert.match(moduleSource, /Mahlzeit kopieren/);
  assert.match(moduleSource, /type=\"date\" min=\"\$\{firstTarget\}\"/);
  assert.match(moduleSource, /visibleMealExists\(targetDate, payload\.meal\)/);
  assert.match(moduleSource, /nextFreeMealDate\(targetDate, payload\.meal\)/);
});
