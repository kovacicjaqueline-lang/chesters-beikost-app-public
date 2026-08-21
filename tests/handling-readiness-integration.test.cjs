"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const contractSource = fs.readFileSync(
  path.join(root, "data", "food-handling.js"),
  "utf8",
);
const policySource = fs.readFileSync(
  path.join(root, "js", "handling-readiness.js"),
  "utf8",
);
const utilsSource = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");

function runtime(recipeStates, settings = {}) {
  const context = {
    console,
    state: {
      settings: {
        textureStage: 1,
        feedingApproach: "mixed",
        handlingCapabilities: {
          smallSoftPieces: false,
          structuredChew: false,
        },
        ...settings,
      },
    },
    recipeStatesCore: () => JSON.parse(JSON.stringify(recipeStates)),
    followUpPreparationOptions: () => [
      { key: "standard", label: "Sichere Standardform", text: "Standard" },
    ],
  };
  vm.createContext(context);
  vm.runInContext(contractSource, context);
  vm.runInContext(policySource, context);
  assert.equal(context.installHandlingReadinessRuntime(), true);
  return context;
}

test("HANDLING runtime: migrierter Pancake verliert nur die historische Konsistenz-Sperre", () => {
  const ctx = runtime([
    {
      name: "Obst-Hafer-Pancakes",
      stage: 2,
      ingredientMissing: [],
      requirementMissing: ["Konsistenz: dick püriert / weich zerdrückt"],
      missing: ["Konsistenz: dick püriert / weich zerdrückt"],
      unlocked: false,
      almost: true,
    },
  ]);
  const recipe = ctx.recipeStatesCore()[0];
  assert.deepEqual([...recipe.requirementMissing], []);
  assert.deepEqual([...recipe.missing], []);
  assert.equal(recipe.unlocked, true);
  assert.equal(recipe.handlingMigrated, true);
  assert.deepEqual([...recipe.handlingModes], ["finger-graspable"]);
  assert.equal(recipe.oralProcessing, "easy-bite-separate");
});

test("HANDLING runtime: Alter und fehlende Zutaten bleiben trotz Migration harte Sperren", () => {
  const ctx = runtime([
    {
      name: "Obst-Hafer-Pancakes",
      stage: 2,
      ingredientMissing: ["Ei"],
      requirementMissing: [
        "Konsistenz: dick püriert / weich zerdrückt",
        "Alter: frühestens ab etwa 8 Monaten",
      ],
      missing: [
        "Ei",
        "Konsistenz: dick püriert / weich zerdrückt",
        "Alter: frühestens ab etwa 8 Monaten",
      ],
      unlocked: false,
      almost: false,
    },
  ]);
  const recipe = ctx.recipeStatesCore()[0];
  assert.deepEqual([...recipe.ingredientMissing], ["Ei"]);
  assert.deepEqual([...recipe.requirementMissing], [
    "Alter: frühestens ab etwa 8 Monaten",
  ]);
  assert.deepEqual([...recipe.missing], [
    "Ei",
    "Alter: frühestens ab etwa 8 Monaten",
  ]);
  assert.equal(recipe.unlocked, false);
});

test("ORAL runtime: structured-chew ersetzt Stage nicht durch Alter, sondern durch konkrete Fähigkeit", () => {
  const base = {
    name: "Rind-Hafer-Bällchen",
    stage: 3,
    ingredientMissing: [],
    requirementMissing: ["Konsistenz: weich-stückig / Fingerfood"],
    missing: ["Konsistenz: weich-stückig / Fingerfood"],
    unlocked: false,
    almost: true,
  };
  const blocked = runtime([base]).recipeStatesCore()[0];
  assert.deepEqual([...blocked.requirementMissing], [
    "Orale Verarbeitung: strukturiertes Kauen noch nicht bestätigt",
  ]);
  assert.equal(blocked.unlocked, false);
  assert.equal(blocked.oralProcessing, "structured-chew-required");
  assert.equal(blocked.oralRequiredCapability, "structured-chew");

  const ready = runtime(
    [base],
    { handlingCapabilities: { smallSoftPieces: false, structuredChew: true } },
  ).recipeStatesCore()[0];
  assert.deepEqual([...ready.requirementMissing], []);
  assert.equal(ready.unlocked, true);
  assert.deepEqual([...ready.handlingModes], ["finger-graspable"]);
});

test("HANDLING runtime: Nockerl werden nur durch small-soft-pieces freigegeben", () => {
  const base = {
    name: "Huhn-Zucchini-Nockerl",
    stage: 3,
    ingredientMissing: [],
    requirementMissing: ["Konsistenz: weich-stückig / Fingerfood"],
    missing: ["Konsistenz: weich-stückig / Fingerfood"],
    unlocked: false,
    almost: true,
  };
  const blocked = runtime([base]).recipeStatesCore()[0];
  assert.deepEqual([...blocked.requirementMissing], [
    "Darreichungsform: kleine weiche Stücke noch nicht bestätigt",
  ]);
  assert.equal(blocked.unlocked, false);
  assert.equal(blocked.oralProcessing, "soft-breakdown");

  const ready = runtime(
    [base],
    { handlingCapabilities: { smallSoftPieces: true, structuredChew: false } },
  ).recipeStatesCore()[0];
  assert.deepEqual([...ready.requirementMissing], []);
  assert.equal(ready.unlocked, true);
  assert.deepEqual([...ready.handlingModes], ["finger-small-soft"]);
});

test("HANDLING runtime: synthetisches unmigriertes Rezept bleibt im Legacy-Stage-Verhalten", () => {
  const original = {
    name: "Nicht migriert",
    stage: 3,
    ingredientMissing: [],
    requirementMissing: ["Konsistenz: weich-stückig / Fingerfood"],
    missing: ["Konsistenz: weich-stückig / Fingerfood"],
    unlocked: false,
    almost: true,
  };
  const ctx = runtime([original]);
  const recipe = ctx.recipeStatesCore()[0];
  assert.deepEqual([...recipe.requirementMissing], original.requirementMissing);
  assert.deepEqual([...recipe.missing], original.missing);
  assert.equal(recipe.unlocked, false);
  assert.equal(recipe.handlingMigrated, false);
});

test("HANDLING runtime: Karotte bietet bei textureStage 1 parallel Löffel und weiches Fingerfood", () => {
  const ctx = runtime([]);
  const options = ctx.followUpPreparationOptions("karotte");
  assert.ok(options.some((option) => option.mode === "spoon-smooth"));
  assert.ok(options.some((option) => option.mode === "spoon-mashed"));
  assert.ok(options.some((option) => option.mode === "finger-graspable"));
  assert.ok(options.some((option) => option.key === "standard"));
});

test("HANDLING runtime: textureStage 2 bevorzugt bei Löffelkost Karotte zerdrückt statt glatt", () => {
  const ctx = runtime([], { feedingApproach: "spoon", textureStage: 2 });
  const options = ctx.followUpPreparationOptions("karotte");
  assert.equal(options[0].mode, "spoon-mashed");
  assert.equal(options[1].mode, "spoon-smooth");
  assert.ok(options.some((option) => option.mode === "finger-graspable"));
});

test("HANDLING runtime: spoon-soft-lumpy bleibt an Texturentwicklung gekoppelt, finger-graspable nicht", () => {
  const ctx = runtime([]);
  assert.equal(
    ctx.handlingModeTextureAllowed("spoon-soft-lumpy", { textureStage: 1 }),
    false,
  );
  assert.equal(
    ctx.handlingModeTextureAllowed("finger-graspable", { textureStage: 1 }),
    true,
  );
});

test("HANDLING runtime: Fingerfood-Präferenz sortiert nur, sie entfernt Löffeloptionen nicht", () => {
  const ctx = runtime([], { feedingApproach: "fingerfood" });
  const options = ctx.followUpPreparationOptions("karotte");
  assert.equal(options[0].mode, "finger-graspable");
  assert.ok(options.some((option) => option.mode === "spoon-smooth"));
  assert.ok(options.some((option) => option.mode === "spoon-mashed"));
});

test("HANDLING loader: Contract wird vor finalem Planner-Reveal geladen und installiert", () => {
  assert.match(utilsSource, /data\/food-handling\.js\?v=10\.1\.25/);
  assert.match(utilsSource, /js\/handling-readiness\.js\?v=10\.1\.25/);
  assert.match(
    utilsSource,
    /installHandlingReadinessRuntime\(\);[\s\S]*window\.__handlingReadinessReady = true;[\s\S]*completePlannerPolicies\(\);/,
  );
  assert.match(
    utilsSource,
    /if \(window\.__handlingReadinessReady\) \{\s*completePlannerPolicies\(\);/,
  );
});

test("HANDLING loader: bestehende PLAN-08-Loaderkette bleibt erhalten", () => {
  assert.match(utilsSource, /planner-milk-policy\.js\?v=10\.1\.25/);
  assert.match(utilsSource, /planner-iron-preference\.js\?v=10\.1\.25/);
  assert.match(utilsSource, /data\/food-presentation\.js\?v=10\.1\.25/);
  assert.match(utilsSource, /planner-meal-presentation\.js\?v=10\.1\.25/);
  assert.match(utilsSource, /planner-recipe-first\.js\?v=10\.1\.25/);
  assert.match(
    utilsSource,
    /contractScript\.addEventListener\("load", loadPresentationPolicy, \{ once: true \}\)/,
  );
});
