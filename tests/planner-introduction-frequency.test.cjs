"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const policy = require("../js/planner-introduction-policy.js");
const root = path.resolve(__dirname, "..");

function blankContext() {
  return {
    reserved: new Set(),
    introduced: [],
    plannedUse: new Map(),
    lastFocus: new Map(),
    inventoryReserved: new Map(),
    recipeReserved: new Map(),
    recipePlannedUse: new Map(),
    fullMilkDates: new Set(),
    qualityFoodUse: new Map(),
    qualityLastFoodUse: new Map(),
    qualityPairUse: new Map(),
    qualityDuePlanned: new Set(),
  };
}

function withRuntimeGlobals(setup, run) {
  const names = [
    "buildDay", "introductionCandidate", "reserveMealInventory", "applyPlannedMealAmounts",
    "canCombine", "food", "rank", "lastOutcome", "manualMealRoleInfo", "state",
    "activeMeal", "mealIsCompleted", "status", "automaticFoodEligibility",
    "plannerFoodCanBeAutomaticFocus", "isFoodUnavailable", "inventoryPortions", "usageCount",
    "mealMilkLevel", "plannerQualityRecordMeal", "dueAllergen", "relatedFamilyFoodIds",
    "manualMealFor", "lockedMeal", "mealSnapshot",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, global[name]]));
  const previousFlag = global.__plannerIntroductionPolicyRuntimeInstalled;
  try {
    delete global.__plannerIntroductionPolicyRuntimeInstalled;
    setup();
    assert.equal(policy.installPlannerIntroductionPolicyRuntime(), true);
    run();
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete global[name];
      else global[name] = previous[name];
    }
    if (previousFlag === undefined) delete global.__plannerIntroductionPolicyRuntimeInstalled;
    else global.__plannerIntroductionPolicyRuntimeInstalled = previousFlag;
  }
}

function installFakePlanner({ foods, ranks, outcomes = {}, dueIds = [], snackRecipe = false, initialState = {} }) {
  const byId = new Map(foods.map((item) => [item.id, item]));
  global.state = {
    foods,
    settings: { newFoodEvery: 4, preferInventoryInPlan: false },
    manualMeals: {},
    planLocks: {},
    overrides: {},
    deferred: {},
    ...initialState,
  };
  global.food = (id) => byId.get(id) || null;
  global.rank = (item) => Number(ranks[item?.id] ?? 0);
  global.lastOutcome = (id) => outcomes[id] || "";
  global.canCombine = (item) => global.rank(item) >= 1;
  global.status = (item) => global.rank(item) >= 2 ? "Verträgliche Basis" : global.rank(item) === 1 ? "Probiert" : "Offen";
  global.automaticFoodEligibility = () => true;
  global.plannerFoodCanBeAutomaticFocus = () => true;
  global.isFoodUnavailable = () => false;
  global.inventoryPortions = () => 0;
  global.usageCount = () => 0;
  global.activeMeal = () => true;
  global.mealIsCompleted = () => false;
  global.mealMilkLevel = () => "";
  global.manualMealRoleInfo = () => ({ role: "excluded" });
  global.applyPlannedMealAmounts = (meal) => meal;
  global.reserveMealInventory = (meal) => meal;
  global.relatedFamilyFoodIds = (item) => [item.id];
  global.dueAllergen = (item) => dueIds.includes(item?.id);
  global.plannerQualityRecordMeal = () => {};
  global.manualMealFor = (date, meal) => {
    const record = global.state.manualMeals?.[`${date}|${meal}`];
    return record ? { ...record, meal, active: true } : null;
  };
  global.lockedMeal = (date, meal) => {
    const record = global.state.planLocks?.[`${date}|${meal}`];
    return record ? { ...record, meal, active: true } : null;
  };
  global.mealSnapshot = (_date, meal, plan, mode = "auto") => ({
    ...JSON.parse(JSON.stringify(plan)),
    meal,
    mode,
  });

  global.introductionCandidate = (meal, on, ctx, exclude = []) => {
    const override = global.state.overrides?.[`${on}|${meal}`];
    if (override) {
      const item = global.food(override);
      if (item && !exclude.includes(item.id) && (item.meals || []).includes(meal)) {
        return { f: item, type: "manuell" };
      }
    }
    const pool = foods.filter((item) =>
      (item.meals || []).includes(meal) &&
      !exclude.includes(item.id),
    );
    const retry = pool.find((item) => global.rank(item) === 1);
    if (retry) return { f: retry, type: "bekannt kombinieren" };
    const due = pool.find((item) =>
      global.dueAllergen(item, on) && !ctx?.qualityDuePlanned?.has(item.id),
    );
    if (due) return { f: due, type: "Allergen wiederholen" };
    const fresh = pool.find((item) => global.rank(item) === 0);
    return fresh ? { f: fresh, type: fresh.allergenGroup ? "Allergen einführen" : "neu" } : null;
  };

  global.buildDay = (date, index, ctx) => {
    const meals = [];
    const activeMeals = ["breakfast", "lunch", "snack", "dinner"];
    const forcedIntroMeal = ["breakfast", "lunch", "dinner"].find((meal) => {
      const item = global.food(global.state.overrides?.[`${date}|${meal}`]);
      return item && global.rank(item) < 2;
    }) || "";
    const introDue = !global.state.deferred?.[date] &&
      (forcedIntroMeal || index % Math.max(1, Number(global.state.settings.newFoodEvery) || 2) === 0);
    let introAssigned = false;
    const used = [];

    for (const meal of activeMeals) {
      const fixed = global.manualMealFor(date, meal) || global.lockedMeal(date, meal);
      if (fixed) {
        meals.push(fixed);
        used.push(fixed.focusId);
        if (policy.plannerIntroductionMealIsLearning(fixed)) introAssigned = true;
        continue;
      }
      if (meal === "snack") {
        meals.push(snackRecipe
          ? { meal, active: true, focusId: "basis", foodIds: ["basis"], baseFoodIds: ["basis"], sampleFoodIds: [], recipeName: "Bekannter Snack", recipeInventoryId: "", type: "Rezept" }
          : { meal, active: true, empty: true });
        continue;
      }

      let selected = null;
      if (introDue && !introAssigned && (!forcedIntroMeal || forcedIntroMeal === meal)) {
        selected = global.introductionCandidate(meal, date, ctx, used);
      }
      if (!selected) {
        meals.push({ meal, active: true, focusId: "basis", foodIds: ["basis"], baseFoodIds: ["basis"], sampleFoodIds: [], type: "bekannt", stackApplied: true });
        used.push("basis");
        continue;
      }

      const learningType = ["neu", "gezielt wiederholen", "Allergen einführen", "Allergen wiederholen", "manuell"].includes(selected.type);
      const base = selected.f.id === "basis" ? null : global.food("basis");
      const ids = base ? [base.id, selected.f.id] : [selected.f.id];
      meals.push({
        meal,
        active: true,
        focusId: selected.f.id,
        foodIds: ids,
        baseFoodIds: base ? [base.id] : [],
        sampleFoodIds: learningType ? [selected.f.id] : [],
        type: selected.type,
        note: selected.type === "manuell"
          ? "Bekannte Lebensmittel sinnvoll rotieren; Vorrat bevorzugt nutzen."
          : "Planner-Stack angewendet.",
        stackApplied: true,
      });
      used.push(selected.f.id);
      if (learningType) introAssigned = true;
    }
    return { date, index, meals, introDue, introAssigned };
  };
}

test("bekannt kombinieren ist kein Lernslot; echte Kostprobe bleibt Lernslot", () => {
  assert.equal(policy.plannerIntroductionMealIsLearning({ active: true, type: "bekannt kombinieren", sampleFoodIds: [] }), false);
  assert.equal(policy.plannerIntroductionMealIsLearning({ active: true, type: "manuell", sampleFoodIds: [] }), false);
  assert.equal(policy.plannerIntroductionMealIsLearning({ active: true, type: "manuell", sampleFoodIds: ["brokkoli"] }), true);
});

test("erfolgreich Probiert blockiert keine frische Einführung, echte Ablehnung bleibt zulässig", () => {
  const tried = { f: { id: "zucchini", allergenGroup: "" }, type: "bekannt kombinieren" };
  assert.equal(policy.plannerIntroductionCandidateShouldSkip(tried, () => 1, () => "eaten", true), true);
  assert.equal(policy.plannerIntroductionCandidateShouldSkip(tried, () => 1, () => "not_accepted", true), false);
});

test("fälliges Allergen wird auch aus altem 'bekannt kombinieren'-Ergebnis als Allergen-Wiederholung erkannt", () => {
  const result = policy.plannerIntroductionNormalizeCandidate(
    { f: { id: "hafer", allergenGroup: "Gluten" }, type: "bekannt kombinieren" },
    "2026-08-23",
    (item) => item.id === "hafer",
    () => "eaten",
  );
  assert.equal(result.type, "Allergen wiederholen");
});

test("Snack-FOOD-Pfad ist eng auf bekanntes geeignetes Obst begrenzt", () => {
  const options = {
    statusFn: () => "Verträgliche Basis",
    unavailableFn: () => false,
    canCombineFn: (item) => item.known,
    automaticEligibilityFn: () => true,
    focusAllowedFn: () => true,
  };
  assert.equal(policy.plannerIntroductionKnownSnackFruitEligible({ id: "banane", active: true, category: "Obst", allergenGroup: "", known: true }, "2026-08-23", options), true);
  assert.equal(policy.plannerIntroductionKnownSnackFruitEligible({ id: "mango", active: true, category: "Obst", allergenGroup: "", known: false }, "2026-08-23", options), false);
  assert.equal(policy.plannerIntroductionKnownSnackFruitEligible({ id: "kartoffel", active: true, category: "Wurzel/Knolle", allergenGroup: "", known: true }, "2026-08-23", options), false);
});

test("Runtime plant täglich je ein neues Nicht-Allergen pro Hauptmahlzeit; Probiert blockiert nicht", () => {
  withRuntimeGlobals(() => {
    installFakePlanner({
      foods: [
        { id: "probiert", active: true, category: "Gemüse", allergenGroup: "", meals: ["breakfast", "lunch", "dinner"], priority: 1 },
        { id: "frueh", active: true, category: "Obst", allergenGroup: "", meals: ["breakfast"], priority: 2 },
        { id: "mittag", active: true, category: "Gemüse", allergenGroup: "", meals: ["lunch"], priority: 3 },
        { id: "abend", active: true, category: "Obst", allergenGroup: "", meals: ["dinner"], priority: 4 },
        { id: "basis", active: true, category: "Wurzel/Knolle", allergenGroup: "", meals: ["breakfast", "lunch", "dinner"], priority: 5 },
        { id: "banane", active: true, category: "Obst", allergenGroup: "", meals: [], priority: 6 },
      ],
      ranks: { probiert: 1, basis: 2, banane: 2 },
      outcomes: { probiert: "eaten" },
    });
  }, () => {
    const day = global.buildDay("2026-08-23", 1, blankContext());
    const byMeal = Object.fromEntries(day.meals.map((meal) => [meal.meal, meal]));
    assert.deepEqual(byMeal.breakfast.sampleFoodIds, ["frueh"]);
    assert.deepEqual(byMeal.lunch.sampleFoodIds, ["mittag"]);
    assert.deepEqual(byMeal.dinner.sampleFoodIds, ["abend"]);
    assert.equal(byMeal.breakfast.stackApplied, true);
    assert.equal(byMeal.lunch.stackApplied, true, "zusätzliche Einführung muss erneut den vollständigen Planner-Stack durchlaufen");
    assert.equal(byMeal.dinner.stackApplied, true);
    assert.equal(byMeal.snack.focusId, "banane");
    assert.deepEqual(byMeal.snack.sampleFoodIds, []);
    assert.equal(global.manualMealRoleInfo("banane", "snack").role, "base");
    assert.equal(global.manualMealRoleInfo("frueh", "snack").role, "excluded");
    assert.equal(global.state.settings.newFoodEvery, 4, "Legacy-Einstellung darf nicht mutiert werden");
  });
});

test("Runtime macht eine Allergen-Einführung zur einzigen Lernaufgabe des Tages", () => {
  withRuntimeGlobals(() => {
    installFakePlanner({
      foods: [
        { id: "ei", active: true, category: "Ei", allergenGroup: "Ei", meals: ["breakfast"], priority: 1 },
        { id: "mittag", active: true, category: "Gemüse", allergenGroup: "", meals: ["lunch"], priority: 2 },
        { id: "abend", active: true, category: "Obst", allergenGroup: "", meals: ["dinner"], priority: 3 },
        { id: "basis", active: true, category: "Wurzel/Knolle", allergenGroup: "", meals: ["breakfast", "lunch", "dinner"], priority: 4 },
      ],
      ranks: { basis: 2 },
    });
  }, () => {
    const day = global.buildDay("2026-08-23", 1, blankContext());
    const learning = day.meals.filter(policy.plannerIntroductionMealIsLearning);
    assert.equal(learning.length, 1);
    assert.equal(learning[0].focusId, "ei");
    assert.equal(learning[0].stackApplied, true);
    assert.equal(policy.plannerIntroductionMealIsAllergenLearning(learning[0], global.food), true);
  });
});

test("fällige Allergen-Wiederholung bleibt exklusiv und wird nicht als bekannte Kombination versteckt", () => {
  withRuntimeGlobals(() => {
    installFakePlanner({
      foods: [
        { id: "hafer", active: true, category: "Getreide/Stärke", allergenGroup: "Gluten", meals: ["breakfast"], priority: 1 },
        { id: "mittag", active: true, category: "Gemüse", allergenGroup: "", meals: ["lunch"], priority: 2 },
        { id: "abend", active: true, category: "Obst", allergenGroup: "", meals: ["dinner"], priority: 3 },
        { id: "basis", active: true, category: "Wurzel/Knolle", allergenGroup: "", meals: ["breakfast", "lunch", "dinner"], priority: 4 },
      ],
      ranks: { hafer: 1, basis: 2 },
      outcomes: { hafer: "eaten" },
      dueIds: ["hafer"],
    });
  }, () => {
    const day = global.buildDay("2026-08-23", 1, blankContext());
    const learning = day.meals.filter(policy.plannerIntroductionMealIsLearning);
    assert.equal(learning.length, 1);
    assert.equal(learning[0].focusId, "hafer");
    assert.equal(learning[0].type, "Allergen wiederholen");
    assert.deepEqual(learning[0].sampleFoodIds, ["hafer"]);
  });
});

test("geschützte Nicht-Allergen-Kostprobe blockiert weitere Nicht-Allergene, aber kein Allergen wird dazugemischt", () => {
  withRuntimeGlobals(() => {
    installFakePlanner({
      foods: [
        { id: "birne", active: true, category: "Obst", allergenGroup: "", meals: ["breakfast"], priority: 1 },
        { id: "hafer", active: true, category: "Getreide/Stärke", allergenGroup: "Gluten", meals: ["lunch"], priority: 2 },
        { id: "mittag", active: true, category: "Gemüse", allergenGroup: "", meals: ["lunch"], priority: 3 },
        { id: "abend", active: true, category: "Obst", allergenGroup: "", meals: ["dinner"], priority: 4 },
        { id: "basis", active: true, category: "Wurzel/Knolle", allergenGroup: "", meals: ["breakfast", "lunch", "dinner"], priority: 5 },
      ],
      ranks: { hafer: 1, basis: 2 },
      outcomes: { hafer: "eaten" },
      dueIds: ["hafer"],
      initialState: {
        planLocks: {
          "2026-08-23|breakfast": {
            meal: "breakfast", active: true, focusId: "birne", foodIds: ["basis", "birne"],
            baseFoodIds: ["basis"], sampleFoodIds: ["birne"], type: "neu", mode: "manual",
          },
        },
      },
    });
  }, () => {
    const day = global.buildDay("2026-08-23", 1, blankContext());
    const learning = day.meals.filter(policy.plannerIntroductionMealIsLearning);
    assert.deepEqual(learning.map((meal) => meal.focusId), ["birne", "mittag", "abend"]);
    assert.equal(day.meals.some((meal) => (meal.foodIds || []).includes("hafer")), false);
    const breakfast = day.meals.find((meal) => meal.meal === "breakfast");
    assert.deepEqual(breakfast.sampleFoodIds, ["birne"], "geschützte Rollen müssen nach interner Normalisierung unverändert sichtbar bleiben");
  });
});

test("vorhandenes Snack-Rezept wird nicht durch Obst ersetzt", () => {
  withRuntimeGlobals(() => {
    installFakePlanner({
      foods: [
        { id: "basis", active: true, category: "Wurzel/Knolle", allergenGroup: "", meals: ["breakfast", "lunch", "dinner"], priority: 1 },
        { id: "banane", active: true, category: "Obst", allergenGroup: "", meals: [], priority: 2 },
      ],
      ranks: { basis: 2, banane: 2 },
      snackRecipe: true,
    });
  }, () => {
    const day = global.buildDay("2026-08-23", 1, blankContext());
    const snack = day.meals.find((meal) => meal.meal === "snack");
    assert.equal(snack.recipeName, "Bekannter Snack");
  });
});

test("Browser-Loader und Offline-Precache installieren die Einführungspolicy nach der Quality-Policy", () => {
  const utils = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.match(utils, /installPlannerQualityRotationRuntime\(\);\s*loadIntroductionPolicy\(\);/);
  assert.match(utils, /planner-introduction-policy\.js\?v=10\.1\.26/);
  assert.match(sw, /\.\/js\/planner-introduction-policy\.js/);
});
