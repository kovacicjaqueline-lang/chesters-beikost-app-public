"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const core = require("../js/log-core.js");
const migrationSource = fs.readFileSync(path.join(root, "js", "migrations.js"), "utf8");
const logSource = fs.readFileSync(path.join(root, "js", "log.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const clone = (value) => JSON.parse(JSON.stringify(value));

function defaultState() {
  return {
    settings: {
      birthDate: "2020-01-01",
      startDate: "2026-01-01",
      phaseSelected: "aufbau",
      phaseModelVersion: 2,
      phaseMode: "manual-v2",
      amountSelected: "taste",
      textureStage: 4,
      phMode: "off",
    },
    foods: [], logs: [], inventory: [], overrides: {}, deferred: {}, pantry: {},
    planLocks: {}, autoLockExcluded: {}, manualMeals: {}, inactivePlanKept: {},
    combinationPauses: {}, followUps: {}, shoppingHints: {},
    backupMeta: { chesterContextSeeded: true },
  };
}

function migrationContext() {
  const context = {
    FOOD_DB: [],
    ID_ALIASES: {},
    LEGACY_MILK_ID: "__legacy_milk__",
    DEFAULT: defaultState(),
    AMOUNT_LEVELS: { taste: { rank: 0 } },
    clone,
    suggestedAmountLevelFromLogs: () => "taste",
    diffDays: () => 0,
    today: () => "2026-08-19",
    logHasMealContext: core.logHasMealContext,
    validLogTextureStage: core.validLogTextureStage,
  };
  vm.createContext(context);
  vm.runInContext(`${migrationSource}\nthis.__migrateStateCore = migrateStateCore;`, context);
  return context;
}

function customFood(id = "karotte") {
  return {
    id,
    name: id === "karotte" ? "Karotte" : id,
    category: "Gemüse",
    meals: ["lunch", "dinner"],
    active: true,
    manualStatus: "auto",
  };
}

test("free and legacy sample entries are not meal slots", () => {
  assert.equal(core.logHasMealContext({ entryType: "food", meal: "lunch" }), true);
  assert.equal(core.logHasMealContext({ entryType: "food", meal: "" }), false);
  assert.equal(core.logHasMealContext({ entryType: "sample", meal: "lunch" }), false);
});

test("planned exposures stay slot-based while free exposures remain distinct", () => {
  assert.equal(core.logExposureKey({ id: "p1", date: "2026-08-19", entryType: "food", meal: "lunch" }), "2026-08-19|lunch");
  assert.equal(core.logExposureKey({ id: "p2", date: "2026-08-19", entryType: "food", meal: "lunch" }), "2026-08-19|lunch");
  assert.notEqual(
    core.logExposureKey({ id: "f1", date: "2026-08-19", entryType: "food", meal: "" }),
    core.logExposureKey({ id: "f2", date: "2026-08-19", entryType: "food", meal: "" }),
  );
});

test("texture progress uses only explicitly documented positive experiences", () => {
  const logs = [
    { foodIds: ["a"], textureStage: 1, textureKnown: true, foodOutcomes: { a: "tried" } },
    { foodIds: ["b"], textureStage: 1, textureKnown: true, foodOutcomes: { b: "eaten" } },
    { foodIds: ["c"], textureStage: 2, textureKnown: false, foodOutcomes: { c: "eaten" } },
    { foodIds: ["d"], textureStage: 3, textureKnown: true, foodOutcomes: { d: "not_offered" } },
  ];
  const outcome = (log, id) => log.foodOutcomes[id];
  assert.deepEqual(core.logTextureCounts(logs, outcome), [2, 0, 0, 0]);
});

test("new offered entries require a deliberate texture choice, legacy unknown edits do not", () => {
  assert.equal(core.logTextureSelectionRequired({ positiveOutcome: true, textureValue: "" }), true);
  assert.equal(core.logTextureSelectionRequired({ positiveOutcome: false, textureValue: "" }), false);
  assert.equal(core.logTextureSelectionRequired({ positiveOutcome: true, textureValue: "2" }), false);
  assert.equal(core.logTextureSelectionRequired({ positiveOutcome: true, isEdit: true, legacyUnknown: true, textureValue: "" }), false);
});

test("visible learning role distinguishes first introduction from repetition", () => {
  assert.equal(core.learningRoleLabel(0, "Offen"), "Einführung");
  assert.equal(core.learningRoleLabel(1, "Probiert"), "Wiederholung");
  assert.equal(core.learningRoleLabel(0, "Offen", "gezielt wiederholen"), "Wiederholung");
});

test("legacy standalone sample reload removes invented texture instead of falling back to current stage", () => {
  const source = defaultState();
  source.settings.textureStage = 4;
  source.foods = [customFood()];
  source.logs = [{
    id: "legacy-sample",
    date: "2026-08-10",
    meal: "lunch",
    entryType: "sample",
    foodIds: ["karotte"],
    focusId: "karotte",
    baseFoodIds: [],
    sampleFoodIds: ["karotte"],
    foodOutcomes: { karotte: "tried" },
    outcome: "tried",
    textureStage: 4,
  }];

  const migrated = clone(migrationContext().__migrateStateCore(source));
  assert.equal(migrated.logs[0].textureKnown, false);
  assert.equal(Object.hasOwn(migrated.logs[0], "textureStage"), false);
  assert.equal(migrated.logs[0].meal, "lunch");
  assert.equal(core.logHasMealContext(migrated.logs[0]), false);
});

test("real historical meal texture survives reload", () => {
  const source = defaultState();
  source.foods = [customFood()];
  source.logs = [{
    id: "meal",
    date: "2026-08-10",
    meal: "lunch",
    entryType: "meal",
    foodIds: ["karotte"],
    focusId: "karotte",
    baseFoodIds: ["karotte"],
    sampleFoodIds: [],
    foodOutcomes: { karotte: "eaten" },
    outcome: "eaten",
    textureStage: 2,
  }];

  const migrated = clone(migrationContext().__migrateStateCore(source));
  assert.equal(migrated.logs[0].textureKnown, true);
  assert.equal(migrated.logs[0].textureStage, 2);
});

test("free unknown unified log remains unknown through another migration round", () => {
  const source = defaultState();
  source.foods = [customFood()];
  source.logs = [{
    id: "free",
    date: "2026-08-10",
    meal: "",
    entryType: "food",
    foodIds: ["karotte"],
    focusId: "karotte",
    baseFoodIds: [],
    sampleFoodIds: ["karotte"],
    foodOutcomes: { karotte: "tried" },
    outcome: "tried",
    textureKnown: false,
  }];

  const migrated = clone(migrationContext().__migrateStateCore(source));
  assert.equal(migrated.logs[0].textureKnown, false);
  assert.equal(Object.hasOwn(migrated.logs[0], "textureStage"), false);
});

test("unified log source has no meal selector or current-texture fallback", () => {
  assert.equal(logSource.includes('id="logMeal"'), false);
  assert.equal(logSource.includes('entryType: "food"'), true);
  assert.equal(logSource.includes('<option value="">Bitte auswählen</option>'), true);
  assert.equal(logSource.includes("log.textureStage || state.settings.textureStage"), false);
});

test("browser loads canonical log core before migrations without a runtime policy", () => {
  const corePos = indexSource.indexOf('src="js/log-core.js');
  const migrationPos = indexSource.indexOf('src="js/migrations.js');
  assert.ok(corePos >= 0 && corePos < migrationPos);
  assert.equal(indexSource.includes("unified-food-log-policy.js"), false);
});


test("explicitly known historical sample texture survives migration", () => {
  const source = defaultState();
  source.foods = [customFood()];
  source.logs = [{ id: "known-sample", date: "2026-08-10", meal: "lunch", entryType: "sample", foodIds: ["karotte"], focusId: "karotte", sampleFoodIds: ["karotte"], foodOutcomes: { karotte: "tried" }, outcome: "tried", textureKnown: true, textureStage: 3 }];
  const migrated = clone(migrationContext().__migrateStateCore(source));
  assert.equal(migrated.logs[0].entryType, "sample");
  assert.equal(migrated.logs[0].meal, "lunch");
  assert.equal(migrated.logs[0].textureKnown, true);
  assert.equal(migrated.logs[0].textureStage, 3);
});

test("rejection and reaction do not require texture, positive outcomes do", () => {
  assert.equal(core.logTextureSelectionRequired({ positiveOutcome: false, textureValue: "" }), false);
  assert.equal(core.logTextureSelectionRequired({ positiveOutcome: true, textureValue: "" }), true);
});
