"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const quality = require("../js/planner-quality-rotation.js");

const root = path.resolve(__dirname, "..");

function ctx() {
  return quality.plannerQualityEnsureContext({});
}

test("manuelle bekannte Mahlzeit ohne Kostprobe wird für die Planprüfung nicht als Einführung umgedeutet", () => {
  const days = [{
    date: "2026-08-21",
    meals: [{
      meal: "lunch",
      active: true,
      focusId: "ei",
      foodIds: ["ei"],
      baseFoodIds: [],
      sampleFoodIds: [],
      type: "manuell",
      manualAdded: true,
    }],
  }];
  const normalized = quality.plannerQualityNormalizeQualityDays(days);
  assert.equal(normalized[0].meals[0].type, "bekannt");
  assert.deepEqual(normalized[0].meals[0].sampleFoodIds, []);
  assert.equal(days[0].meals[0].type, "manuell", "Eingabedaten dürfen nicht mutiert werden");
});

test("echte Kostprobe bleibt ein Lernslot, bekannte manuelle Mahlzeit dagegen nicht", () => {
  assert.equal(quality.plannerQualityMealConsumesLearningSlot({
    active: true,
    type: "manuell",
    sampleFoodIds: [],
  }), false);
  assert.equal(quality.plannerQualityMealConsumesLearningSlot({
    active: true,
    type: "manuell",
    sampleFoodIds: ["ei"],
  }), true);
  assert.equal(quality.plannerQualityMealConsumesLearningSlot({
    active: true,
    type: "Allergen wiederholen",
    sampleFoodIds: [],
  }), true);
});

test("Rotation erfasst alle FOOD-Rollen und exakte Paare, nicht nur focusId", () => {
  const state = ctx();
  quality.plannerQualityRecordMeal(
    {
      active: true,
      focusId: "kartoffel",
      foodIds: ["kartoffel", "gurke", "huhn"],
      baseFoodIds: ["gurke", "huhn"],
      sampleFoodIds: [],
    },
    "2026-08-21",
    state,
  );
  assert.equal(state.qualityFoodUse.get("kartoffel"), 1);
  assert.equal(state.qualityFoodUse.get("gurke"), 1);
  assert.equal(state.qualityFoodUse.get("huhn"), 1);
  assert.equal(state.qualityLastFoodUse.get("gurke"), "2026-08-21");
  assert.equal(state.qualityPairUse.get("gurke+kartoffel"), 1);
  assert.equal(state.qualityPairUse.get("huhn+kartoffel"), 1);
  assert.equal(state.qualityPairUse.get("gurke+huhn"), 1);
});

test("Nicht verschieben zählt die Vortagsplanung für die Rotation, aber nicht als Nutzung", () => {
  const data = {
    planLocks: {
      "2026-08-20|breakfast": {
        planId: "yesterday-plan",
        date: "2026-08-20",
        meal: "breakfast",
        focusId: "bulgur",
        foodIds: ["bulgur", "brombeere"],
      },
      "2026-08-20|lunch": {
        planId: "shifted-plan",
        date: "2026-08-20",
        meal: "lunch",
        focusId: "apfel",
        foodIds: ["apfel"],
      },
    },
    backupMeta: {
      plannerLinking: {
        rolloverHandled: {
          "yesterday-plan": { action: "keep", at: "2026-08-21T07:00:00.000Z" },
          "shifted-plan": { action: "shift", at: "2026-08-21T07:00:00.000Z" },
        },
      },
    },
    logs: [],
  };
  const context = ctx();

  quality.plannerQualitySeedKeptPlans(context, "2026-08-21", data);

  assert.equal(context.qualityLastFoodUse.get("bulgur"), "2026-08-20");
  assert.equal(context.qualityLastFoodUse.get("brombeere"), "2026-08-20");
  assert.equal(context.qualityPairUse.get("brombeere+bulgur"), 1);
  assert.equal(context.qualityLastFoodUse.has("apfel"), false);
  assert.deepEqual(data.logs, [], "Nicht verschieben darf keinen gegessenen/protokollierten Eintrag erzeugen");
});

test("bei gleich zulässigen Kandidaten schlägt neue Kombination eine wiederholte", () => {
  const state = ctx();
  state.qualityFoodUse.set("gurke", 2);
  state.qualityFoodUse.set("zucchini", 0);
  state.qualityLastFoodUse.set("gurke", "2026-08-20");
  state.qualityPairUse.set("gurke+kartoffel", 2);
  const results = [
    { f: { id: "gurke" }, type: "bekannt" },
    { f: { id: "zucchini" }, type: "bekannt" },
  ];
  const chosen = quality.plannerQualityChooseResult(
    results,
    state,
    "2026-08-21",
    (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000),
    "kartoffel",
  );
  assert.equal(chosen.f.id, "zucchini");
});

test("Frühstücks-Begleiter wechseln bei vorhandener Alternative statt täglich zu wiederholen", () => {
  const state = ctx();
  state.qualityLastFoodUse.set("brombeere", "2026-08-20");
  const results = [
    { f: { id: "brombeere" } },
    { f: { id: "apfel" } },
  ];
  const filtered = quality.plannerQualityBreakfastCompanionResults(
    results,
    state,
    "2026-08-21",
    (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000),
  );
  assert.deepEqual(filtered.map((entry) => entry.f.id), ["apfel"]);
});

test("Frühstücks-Rotation fällt auf den vorhandenen Begleiter zurück, wenn es keine Alternative gibt", () => {
  const state = ctx();
  state.qualityLastFoodUse.set("brombeere", "2026-08-20");
  const results = [{ f: { id: "brombeere" } }];
  assert.deepEqual(
    quality.plannerQualityBreakfastCompanionResults(
      results,
      state,
      "2026-08-21",
      (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000),
    ),
    results,
  );
});

test("Runtime rotiert Brombeere als Frühstücks-Begleiter am Folgetag", () => {
  const names = [
    "buildDay", "freshPlanContext", "introductionCandidate", "knownCandidate", "companionFor",
    "planQualityIssues", "manualMealFor", "lockedMeal", "dueAllergen", "knownBase", "food",
    "isTrustedBase", "diffDays", "lastDate", "activeMeal", "rank", "state",
    "relatedFamilyFoodIds", "plannerAutomaticPairPreferencePenalty",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, global[name]]));
  const previousFlag = global.__plannerQualityRotationRuntimeInstalled;

  try {
    delete global.__plannerQualityRotationRuntimeInstalled;
    const foods = [
      { id: "hafer", name: "Hafer", allergenGroup: "", meals: ["breakfast"], priority: 1 },
      { id: "brombeere", name: "Brombeere", allergenGroup: "", meals: ["breakfast"], priority: 2 },
      { id: "apfel", name: "Apfel", allergenGroup: "", meals: ["breakfast"], priority: 3 },
    ];
    global.state = {
      foods,
      settings: {},
      deferred: {},
      planLocks: {},
      overrides: {},
    };
    global.food = (id) => global.state.foods.find((item) => item.id === id);
    global.isTrustedBase = (item) => item?.id === "hafer";
    global.dueAllergen = () => false;
    global.knownBase = () => global.food("hafer");
    global.lastDate = () => "";
    global.diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
    global.activeMeal = (meal) => meal === "breakfast";
    global.rank = () => 2;
    global.relatedFamilyFoodIds = (item) => [item.id];
    global.plannerAutomaticPairPreferencePenalty = () => 0;
    global.manualMealFor = () => null;
    global.lockedMeal = () => null;
    global.freshPlanContext = () => ({
      reserved: new Set(),
      introduced: [],
      plannedUse: new Map(),
      lastFocus: new Map(),
      inventoryReserved: new Map(),
      recipeReserved: new Map(),
      recipePlannedUse: new Map(),
      fullMilkDates: new Set(),
    });
    global.introductionCandidate = () => null;
    global.knownCandidate = () => ({ f: global.food("hafer"), type: "bekannt" });
    global.companionFor = (focus) => global.state.foods.find(
      (item) => item.id !== focus?.id && item.meals.includes("breakfast"),
    ) || null;
    global.planQualityIssues = () => [];
    global.buildDay = (date, index, context) => {
      const focus = global.food("hafer");
      const companion = global.companionFor(focus, "breakfast", date, "bekannt");
      return {
        date,
        index,
        meals: [{
          meal: "breakfast",
          active: true,
          focusId: focus.id,
          foodIds: [focus.id, companion.id],
          baseFoodIds: [focus.id, companion.id],
          sampleFoodIds: [],
          type: "bekannt",
        }],
      };
    };

    assert.equal(quality.installPlannerQualityRotationRuntime(), true);
    const context = global.freshPlanContext();
    const first = global.buildDay("2026-08-20", 0, context);
    const second = global.buildDay("2026-08-21", 1, context);
    assert.equal(first.meals[0].foodIds[1], "brombeere");
    assert.equal(second.meals[0].foodIds[1], "apfel");
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete global[name];
      else global[name] = value;
    }
    if (previousFlag === undefined) delete global.__plannerQualityRotationRuntimeInstalled;
    else global.__plannerQualityRotationRuntimeInstalled = previousFlag;
  }
});

test("Runtime rotiert eine per Nicht verschieben quittierte Vortagsplanung am Folgetag", () => {
  const names = [
    "buildDay", "freshPlanContext", "introductionCandidate", "knownCandidate", "companionFor",
    "planQualityIssues", "manualMealFor", "lockedMeal", "dueAllergen", "knownBase", "food",
    "isTrustedBase", "diffDays", "lastDate", "activeMeal", "rank", "state",
    "relatedFamilyFoodIds", "plannerAutomaticPairPreferencePenalty",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, global[name]]));
  const previousFlag = global.__plannerQualityRotationRuntimeInstalled;

  try {
    delete global.__plannerQualityRotationRuntimeInstalled;
    const foods = [
      { id: "bulgur", name: "Bulgur", allergenGroup: "", meals: ["breakfast"], priority: 1 },
      { id: "brombeere", name: "Brombeere", allergenGroup: "", meals: ["breakfast"], priority: 2 },
      { id: "apfel", name: "Apfel", allergenGroup: "", meals: ["breakfast"], priority: 3 },
    ];
    global.state = {
      foods,
      settings: {},
      deferred: {},
      planLocks: {
        "2026-08-20|breakfast": {
          planId: "yesterday-plan",
          date: "2026-08-20",
          meal: "breakfast",
          focusId: "bulgur",
          foodIds: ["bulgur", "brombeere"],
        },
      },
      manualMeals: {},
      overrides: {},
      logs: [],
      backupMeta: {
        plannerLinking: {
          rolloverHandled: {
            "yesterday-plan": { action: "keep", at: "2026-08-21T07:00:00.000Z" },
          },
        },
      },
    };
    global.food = (id) => global.state.foods.find((item) => item.id === id);
    global.isTrustedBase = (item) => item?.id === "bulgur";
    global.dueAllergen = () => false;
    global.knownBase = () => global.food("bulgur");
    global.lastDate = () => "";
    global.diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
    global.activeMeal = (meal) => meal === "breakfast";
    global.rank = () => 2;
    global.relatedFamilyFoodIds = (item) => [item.id];
    global.plannerAutomaticPairPreferencePenalty = () => 0;
    global.manualMealFor = () => null;
    global.lockedMeal = () => null;
    global.freshPlanContext = () => ({
      reserved: new Set(),
      introduced: [],
      plannedUse: new Map(),
      lastFocus: new Map(),
      inventoryReserved: new Map(),
      recipeReserved: new Map(),
      recipePlannedUse: new Map(),
      fullMilkDates: new Set(),
    });
    global.introductionCandidate = () => null;
    global.knownCandidate = () => ({ f: global.food("bulgur"), type: "bekannt" });
    global.companionFor = (focus) => global.state.foods.find(
      (item) => item.id !== focus?.id && item.meals.includes("breakfast"),
    ) || null;
    global.planQualityIssues = () => [];
    global.buildDay = (date, index, context) => {
      const focus = global.food("bulgur");
      const companion = global.companionFor(focus, "breakfast", date, "bekannt");
      return {
        date,
        index,
        meals: [{
          meal: "breakfast",
          active: true,
          focusId: focus.id,
          foodIds: [focus.id, companion.id],
          baseFoodIds: [focus.id, companion.id],
          sampleFoodIds: [],
          type: "bekannt",
        }],
      };
    };

    assert.equal(quality.installPlannerQualityRotationRuntime(), true);
    const context = global.freshPlanContext();
    const day = global.buildDay("2026-08-21", 0, context);

    assert.equal(day.meals[0].foodIds[1], "apfel");
    assert.deepEqual(global.state.logs, [], "Rotation darf keinen Nutzungs-/Essenseintrag erzeugen");
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete global[name];
      else global[name] = value;
    }
    if (previousFlag === undefined) delete global.__plannerQualityRotationRuntimeInstalled;
    else global.__plannerQualityRotationRuntimeInstalled = previousFlag;
  }
});

test("fällige Allergen-Warnung erklärt den fehlenden freien Slot statt nur 'fällig' zu melden", () => {
  assert.equal(
    quality.plannerQualityRewriteIssue(
      "Hafer ist als Allergen fällig, aber noch nicht eingeplant.",
      [{ id: "hafer", name: "Hafer" }],
    ),
    "Hafer sollte als Allergen wieder angeboten werden; in der sichtbaren Planung ist dafür aktuell kein geeigneter freier Slot.",
  );
});

test("Runtime: fälliges Allergen wird außerhalb newFoodEvery eingeplant und nicht an Folgetagen dupliziert", () => {
  const names = [
    "buildDay", "freshPlanContext", "introductionCandidate", "knownCandidate", "companionFor",
    "planQualityIssues", "manualMealFor", "lockedMeal", "dueAllergen", "knownBase", "food",
    "isTrustedBase", "diffDays", "lastDate", "activeMeal", "rank", "state",
    "relatedFamilyFoodIds", "plannerAutomaticPairPreferencePenalty",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, global[name]]));
  const previousFlag = global.__plannerQualityRotationRuntimeInstalled;
  let manualPreset = null;

  const foods = [
    { id: "hafer", name: "Hafer", allergenGroup: "Gluten", meals: ["lunch"], priority: 1 },
    { id: "kartoffel", name: "Kartoffel", allergenGroup: "", meals: ["breakfast", "lunch"], priority: 2 },
    { id: "gurke", name: "Gurke", allergenGroup: "", meals: ["breakfast", "lunch"], priority: 3 },
    { id: "ei", name: "Ei", allergenGroup: "Ei", meals: ["breakfast"], priority: 4 },
  ];

  try {
    delete global.__plannerQualityRotationRuntimeInstalled;
    global.state = {
      foods,
      settings: { newFoodEvery: 7 },
      deferred: {},
      planLocks: {},
      overrides: {},
    };
    global.food = (id) => global.state.foods.find((item) => item.id === id);
    global.isTrustedBase = (item) => ["kartoffel", "gurke"].includes(item?.id);
    global.dueAllergen = (item) => item?.id === "hafer";
    global.knownBase = () => global.food("kartoffel");
    global.lastDate = (id) => id === "hafer" ? "2026-08-01" : "2026-08-10";
    global.diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
    global.activeMeal = (meal) => ["breakfast", "lunch"].includes(meal);
    global.rank = (item) => item?.id === "ei" ? 0 : 2;
    global.relatedFamilyFoodIds = (item) => [item.id];
    global.plannerAutomaticPairPreferencePenalty = () => 0;
    global.manualMealFor = (_date, meal) => meal === "breakfast" ? manualPreset : null;
    global.lockedMeal = () => null;
    global.freshPlanContext = () => ({
      reserved: new Set(),
      introduced: [],
      plannedUse: new Map(),
      lastFocus: new Map(),
      inventoryReserved: new Map(),
      recipeReserved: new Map(),
      recipePlannedUse: new Map(),
      fullMilkDates: new Set(),
    });
    global.introductionCandidate = (meal) => {
      const item = global.state.foods.find((candidate) => global.dueAllergen(candidate) && candidate.meals.includes(meal));
      return item ? { f: item, type: "Allergen wiederholen" } : null;
    };
    global.knownCandidate = () => ({ f: global.food("gurke"), type: "bekannt" });
    global.companionFor = (focus) => focus?.id === "kartoffel" ? global.food("gurke") : global.food("kartoffel");
    global.planQualityIssues = (days) => {
      const meal = days?.[0]?.meals?.[0];
      if (["neu", "manuell"].includes(meal?.type) && !(meal?.baseFoodIds || []).length)
        return ["Ei hat keine verträgliche Basis."];
      if (days?.[0]?.forceDueIssue) return ["Hafer ist als Allergen fällig, aber noch nicht eingeplant."];
      return [];
    };
    global.buildDay = (date, index, context) => {
      let meals = [];
      let manual = global.manualMealFor(date, "breakfast");
      if (manual) meals.push(manual);
      let introDue = !global.state.deferred?.[date] && index % Math.max(1, Number(global.state.settings.newFoodEvery) || 2) === 0;
      let selected = introDue ? global.introductionCandidate("lunch", date, context, []) : null;
      if (!selected) selected = global.knownCandidate("lunch", date, context, []);
      let base = global.companionFor(selected.f, "lunch", date, selected.type);
      meals.push({
        meal: "lunch",
        active: true,
        focusId: selected.f.id,
        foodIds: base ? [selected.f.id, base.id] : [selected.f.id],
        baseFoodIds: base ? [base.id] : [],
        sampleFoodIds: [],
        type: selected.type,
      });
      return { date, index, meals, introDue };
    };

    assert.equal(quality.installPlannerQualityRotationRuntime(), true);

    const firstCtx = global.freshPlanContext();
    const first = global.buildDay("2026-08-21", 1, firstCtx);
    assert.equal(first.meals.at(-1).focusId, "hafer", "Fälligkeit muss den normalen 7-Tage-Takt übersteuern");
    assert.equal(global.state.settings.newFoodEvery, 7, "Einstellung darf nicht dauerhaft verändert werden");
    assert.equal(firstCtx.qualityDuePlanned.has("hafer"), true);

    const second = global.buildDay("2026-08-22", 2, firstCtx);
    assert.equal(second.meals.at(-1).focusId, "gurke", "innerhalb derselben Planung darf Hafer nicht täglich erneut eingeplant werden");

    manualPreset = {
      meal: "breakfast",
      active: true,
      focusId: "ei",
      foodIds: ["ei"],
      baseFoodIds: [],
      sampleFoodIds: [],
      type: "manuell",
      manualAdded: true,
    };
    const knownManualCtx = global.freshPlanContext();
    const knownManualDay = global.buildDay("2026-08-23", 3, knownManualCtx);
    assert.equal(knownManualDay.meals.at(-1).focusId, "hafer", "bekannte manuelle Mahlzeit ohne Kostprobe darf fällige Wiederholung nicht blockieren");

    manualPreset = {
      ...manualPreset,
      sampleFoodIds: ["ei"],
    };
    const sampleCtx = global.freshPlanContext();
    const sampleDay = global.buildDay("2026-08-24", 4, sampleCtx);
    assert.equal(sampleDay.meals.at(-1).focusId, "gurke", "manueller Lernslot muss eine zweite automatische Einführung/Wiederholung am selben Tag verhindern");

    const manualKnownIssues = global.planQualityIssues([{ meals: [{
      active: true,
      type: "manuell",
      foodIds: ["ei"],
      baseFoodIds: [],
      sampleFoodIds: [],
    }] }]);
    assert.deepEqual(manualKnownIssues, []);

    const rewritten = global.planQualityIssues([{ forceDueIssue: true, meals: [{
      active: true,
      type: "bekannt",
      foodIds: ["gurke"],
      baseFoodIds: [],
      sampleFoodIds: [],
    }] }]);
    assert.deepEqual(rewritten, ["Hafer sollte als Allergen wieder angeboten werden; in der sichtbaren Planung ist dafür aktuell kein geeigneter freier Slot."]);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete global[name];
      else global[name] = previous[name];
    }
    if (previousFlag === undefined) delete global.__plannerQualityRotationRuntimeInstalled;
    else global.__plannerQualityRotationRuntimeInstalled = previousFlag;
  }
});

test("Browser-Loader und Offline-Precache enthalten die neue Policy nach Rollenstabilität", () => {
  const utils = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.match(
    utils,
    /installPlannerFoodRoleStabilityRuntime\(\);\s*loadQualityPolicy\(\);/,
    "Quality-Policy muss unmittelbar nach installierter Rollenstabilität weitergeladen werden",
  );
  assert.match(utils, /planner-quality-rotation\.js\?v=10\.1\.26/);
  assert.match(sw, /\.\/js\/planner-quality-rotation\.js/);
});
