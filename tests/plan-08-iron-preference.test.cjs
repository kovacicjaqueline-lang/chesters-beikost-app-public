"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const ironPolicy = require("../js/planner-iron-preference.js");
const ironPolicySource = fs.readFileSync(
  path.join(root, "js", "planner-iron-preference.js"),
  "utf8",
);
const milkPolicySource = fs.readFileSync(
  path.join(root, "js", "planner-milk-policy.js"),
  "utf8",
);
const planningSource = fs.readFileSync(
  path.join(root, "js", "planning.js"),
  "utf8",
);

function loadRealFoods() {
  const source = fs.readFileSync(path.join(root, "data", "foods.js"), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__FOODS = FOOD_DB;`, context);
  return JSON.parse(JSON.stringify(context.__FOODS));
}

const realFoods = loadRealFoods();

function item(id, {
  category = "Gemüse",
  ironRich = false,
  sort = 0,
  trusted = true,
  allowed = true,
  plannerRank = 2,
  meals = ["breakfast", "lunch", "dinner"],
  allergenGroup = "",
} = {}) {
  return {
    id,
    name: id,
    category,
    ironRich,
    sort,
    trusted,
    allowed,
    plannerRank,
    meals,
    allergenGroup,
  };
}

function installIronRuntime({ foods, amount = "building", pausedPairs = [] }) {
  const paused = new Set(pausedPairs.map((ids) => [...ids].sort().join("+")));
  const context = {
    state: { foods: foods.map((food) => ({ ...food })) },
    AMOUNT_LEVELS: { taste: { rank: 0 }, building: { rank: 1 } },
    currentAmountLevel: () => amount,
    isTrustedBase: (food) => !!food?.trusted,
    isMilkProductFood: (food) => ["kuhmilch", "naturjoghurt", "buttermilch"].includes(food?.id),
    rank: (food) => Number(food?.plannerRank || 0),
    isStarchyFood: (food) => ["Getreide/Stärke", "Wurzel/Knolle"].includes(food?.category),
    enforceSingleStarch: (focus, companions) => {
      const all = [focus, ...(companions || [])].filter(Boolean);
      const starches = all.filter((food) => ["Getreide/Stärke", "Wurzel/Knolle"].includes(food.category));
      if (starches.length <= 1) return companions || [];
      const keep = ["Getreide/Stärke", "Wurzel/Knolle"].includes(focus?.category)
        ? focus.id
        : starches[0].id;
      return (companions || []).filter(
        (food) => !["Getreide/Stärke", "Wurzel/Knolle"].includes(food.category) || food.id === keep,
      );
    },
    combinationPaused: (ids) => paused.has([...ids].sort().join("+")),
    companionFor: (focus, meal) => {
      const pool = context.state.foods
        .filter((candidate) =>
          candidate.id !== focus.id &&
          candidate.allowed !== false &&
          candidate.meals.includes(meal) &&
          !candidate.allergenGroup &&
          !["Kraut/Gewürz", "Fett"].includes(candidate.category),
        )
        .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
      return pool[0] || null;
    },
    ironCompanion: () => item("legacy-third", { ironRich: true, category: "Fleisch" }),
  };
  vm.createContext(context);
  vm.runInContext(
    `${ironPolicySource}\nthis.__installIron = installPlannerIronPreferenceRuntime;`,
    context,
  );
  assert.equal(context.__installIron(), true);
  return context;
}

function installRealPlanner(foodIds) {
  const selectedFoods = foodIds.map((id) => {
    const food = realFoods.find((entry) => entry.id === id);
    assert.ok(food, `Real FOOD missing: ${id}`);
    return JSON.parse(JSON.stringify(food));
  });
  const state = {
    foods: selectedFoods,
    logs: [],
    settings: {},
  };
  const context = {
    state,
    status: () => "Regelmäßig",
    rank: () => 2,
    outcomeForFood: () => "eaten",
    normalizeName: (value) => String(value || "").toLocaleLowerCase("de"),
    currentAmountLevel: () => "building",
    AMOUNT_LEVELS: { building: { rank: 1 } },
    today: () => "2026-08-18",
  };
  vm.createContext(context);
  vm.runInContext(planningSource, context);
  context.state = state;
  context.status = () => "Regelmäßig";
  context.rank = () => 2;
  context.outcomeForFood = () => "eaten";
  context.normalizeName = (value) => String(value || "").toLocaleLowerCase("de");
  context.currentAmountLevel = () => "building";
  context.AMOUNT_LEVELS = { building: { rank: 1 } };
  context.food = (id) => state.foods.find((entry) => entry.id === id) || null;
  context.eligible = (food, meal, on) => context.eligibleCore(food, meal, on);

  vm.runInContext(
    `${milkPolicySource}\nthis.__installMilk = installPlannerMilkPolicyRuntime;`,
    context,
  );
  assert.equal(context.__installMilk(), true);
  vm.runInContext(
    `${ironPolicySource}\nthis.__installIron = installPlannerIronPreferenceRuntime;`,
    context,
  );
  assert.equal(context.__installIron(), true);
  return context;
}

function selected(context, focusId, meal = "lunch", focusType = "bekannt") {
  const focus = context.state.foods.find((food) => food.id === focusId);
  return context.companionFor(focus, meal, "2026-08-18", focusType);
}

test("PLAN-08-X1: bestätigte schräge Obst-Kombinationen sind nur weiche Priorität, keine Pair-Blacklist", () => {
  const banana = { category: "Obst" };
  assert.equal(
    ironPolicy.plannerAutomaticPairPreferencePenalty(banana, { category: "Getreide/Stärke" }, "lunch"),
    0,
  );
  assert.equal(
    ironPolicy.plannerAutomaticPairPreferencePenalty(banana, { category: "Gemüse" }, "lunch"),
    1,
  );
  assert.equal(
    ironPolicy.plannerAutomaticPairPreferencePenalty(banana, { category: "Fleisch" }, "lunch"),
    2,
  );
  assert.equal(
    ironPolicy.plannerAutomaticPairPreferencePenalty(banana, { category: "Gemüse" }, "breakfast"),
    0,
  );
});

test("PLAN-08-X1: geeigneter eisenreicher Begleiter wird innerhalb der Zweierkombination bevorzugt", () => {
  const context = installIronRuntime({
    foods: [
      item("karotte", { sort: 0 }),
      item("banane", { category: "Obst", sort: 1 }),
      item("rind", { category: "Fleisch", ironRich: true, sort: 20 }),
    ],
  });
  assert.equal(selected(context, "karotte")?.id, "rind");
  assert.equal(context.ironCompanion(item("karotte"), "lunch", "2026-08-18", ["karotte", "rind"]), null);
});

test("PLAN-08-X1: ohne geeigneten Eisenbegleiter bleibt die normale Zweierkombination und es entsteht keine dritte FOOD-Komponente", () => {
  const context = installIronRuntime({
    foods: [
      item("karotte"),
      item("banane", { category: "Obst", sort: 1 }),
      item("rind", { category: "Fleisch", ironRich: true, allowed: false, sort: 0 }),
    ],
  });
  assert.equal(selected(context, "karotte")?.id, "banane");
  assert.equal(context.ironCompanion(), null);
});

test("PLAN-08-X1: Karotte + Banane + Rind wird nicht mehr durch einen nachträglichen Eisenfallback erzeugt", () => {
  const context = installIronRuntime({
    foods: [
      item("karotte"),
      item("banane", { category: "Obst", sort: 0 }),
      item("rind", { category: "Fleisch", ironRich: true, sort: 50 }),
    ],
  });
  const companion = selected(context, "karotte");
  assert.equal(companion?.id, "rind");
  assert.deepEqual(["karotte", companion.id], ["karotte", "rind"]);
  assert.equal(context.ironCompanion(), null);
});

test("PLAN-08-X1: Karotte + Birne + Rote Linsen wird auf die zentrale Eisen-Zweierkombination reduziert", () => {
  const context = installIronRuntime({
    foods: [
      item("karotte"),
      item("birne", { category: "Obst", sort: 0 }),
      item("rote-linsen", { category: "Hülsenfrucht", ironRich: true, sort: 50 }),
    ],
  });
  const companion = selected(context, "karotte");
  assert.equal(companion?.id, "rote-linsen");
  assert.equal(context.ironCompanion(), null);
});

test("PLAN-08-X1: eisenreicher Fokus erhält keinen zusätzlichen Eisenfallback", () => {
  const context = installIronRuntime({
    foods: [
      item("rind", { category: "Fleisch", ironRich: true }),
      item("zucchini", { sort: 0 }),
      item("rote-linsen", { category: "Hülsenfrucht", ironRich: true, sort: 10 }),
    ],
  });
  assert.equal(selected(context, "rind")?.id, "zucchini");
  assert.equal(context.ironCompanion(), null);
});

test("PLAN-08-X1: Frühstück bleibt unverändert ohne Eisenpräferenz", () => {
  const context = installIronRuntime({
    foods: [
      item("hafer", { category: "Getreide/Stärke" }),
      item("banane", { category: "Obst", sort: 0 }),
      item("rind", { category: "Fleisch", ironRich: true, sort: 50 }),
    ],
  });
  assert.equal(selected(context, "hafer", "breakfast")?.id, "banane");
  assert.equal(context.ironCompanion(), null);
});

test("PLAN-08-X1: Einführung/Kostprobe bleibt FOOD-first und übernimmt keine Eisenpräferenz", () => {
  const focus = item("karotte", { trusted: false });
  const context = installIronRuntime({
    foods: [
      focus,
      item("banane", { category: "Obst", sort: 0 }),
      item("rind", { category: "Fleisch", ironRich: true, sort: 50 }),
    ],
  });
  assert.equal(selected(context, "karotte", "lunch", "neu")?.id, "banane");
  assert.equal(context.ironCompanion(), null);
});

test("PLAN-08-X1: Single-Starch verhindert einen eisenreichen zweiten Stärke-Begleiter", () => {
  const context = installIronRuntime({
    foods: [
      item("kartoffel", { category: "Wurzel/Knolle" }),
      item("brokkoli", { category: "Gemüse", sort: 0 }),
      item("hafer", { category: "Getreide/Stärke", ironRich: true, sort: 50 }),
    ],
  });
  assert.equal(selected(context, "kartoffel")?.id, "brokkoli");
});

test("PLAN-08-X1: bestehendes rank>=2-Gate für Eisenkandidaten bleibt erhalten", () => {
  const context = installIronRuntime({
    foods: [
      item("karotte"),
      item("banane", { category: "Obst", sort: 0 }),
      item("zucchini", { category: "Gemüse", sort: 10 }),
      item("rind", { category: "Fleisch", ironRich: true, plannerRank: 1, sort: 50 }),
    ],
  });
  assert.equal(selected(context, "karotte")?.id, "zucchini");
});

test("PLAN-08-X1: bestehende Milchkomponente verhindert unverändert eine zusätzliche Eisenoptimierung", () => {
  const context = installIronRuntime({
    foods: [
      item("karotte"),
      item("naturjoghurt", { category: "Milchprodukt", sort: 0 }),
      item("rind", { category: "Fleisch", ironRich: true, sort: 50 }),
    ],
  });
  assert.equal(selected(context, "karotte")?.id, "naturjoghurt");
  assert.equal(context.ironCompanion(), null);
});

test("PLAN-08-X1: pausierte Eisenkombination wird weder als Eisenpräferenz noch als weicher Fallback bevorzugt", () => {
  const context = installIronRuntime({
    foods: [
      item("karotte"),
      item("banane", { category: "Obst", sort: 0 }),
      item("rind", { category: "Fleisch", ironRich: true, sort: 50 }),
    ],
    pausedPairs: [["karotte", "rind"]],
  });
  assert.equal(selected(context, "karotte")?.id, "banane");
});

test("PLAN-08-X1 real: Banane + Karotte wird bei neutraler realer Alternative nicht bevorzugt", () => {
  const context = installRealPlanner(["banane", "karotte", "hafer", "rind"]);
  assert.equal(selected(context, "banane")?.id, "hafer");
});

test("PLAN-08-X1 real: Eisenpräferenz macht aus Banane + Karotte nicht Banane + Rind", () => {
  const context = installRealPlanner(["banane", "karotte", "rind"]);
  assert.equal(selected(context, "banane")?.id, "karotte");
  assert.notEqual(selected(context, "banane")?.id, "rind");
  assert.equal(context.ironCompanion(), null);
});

test("PLAN-08-X1 real: Karotte kann mit Rind als plausible eisenreiche Zweierkombination bevorzugt werden", () => {
  const context = installRealPlanner(["karotte", "banane", "zucchini", "rind"]);
  assert.equal(selected(context, "karotte")?.id, "rind");
  assert.equal(context.ironCompanion(), null);
});

test("PLAN-08-X1: MILK-01 bleibt vor der Eisenpräferenz ein harter Begleiter-Gate", () => {
  const foods = [
    item("pferd", { category: "Fleisch", ironRich: false }),
    item("naturjoghurt", { category: "Milchprodukt", ironRich: true, sort: 0 }),
    item("kartoffel", { category: "Wurzel/Knolle", sort: 20 }),
  ];
  const context = {
    state: { foods: foods.map((food) => ({ ...food })) },
    AMOUNT_LEVELS: { building: { rank: 1 } },
    currentAmountLevel: () => "building",
    isTrustedBase: () => true,
    isMilkProductFood: (food) => ["kuhmilch", "naturjoghurt", "buttermilch"].includes(food?.id),
    isMeatOrFish: (food) => ["Fleisch", "Fisch", "Meeresfrucht"].includes(food?.category),
    rank: (food) => Number(food?.plannerRank || 0),
    enforceSingleStarch: (_focus, companions) => companions || [],
    combinationPaused: () => false,
    buildDay: () => ({ meals: [] }),
    companionFor: (focus, meal) => context.state.foods
      .filter((candidate) => candidate.id !== focus.id && candidate.meals.includes(meal))
      .sort((a, b) => a.sort - b.sort)[0] || null,
    ironCompanion: () => item("legacy-third", { ironRich: true }),
  };
  vm.createContext(context);
  vm.runInContext(
    `${milkPolicySource}\nthis.__installMilk = installPlannerMilkPolicyRuntime;`,
    context,
  );
  assert.equal(context.__installMilk(), true);
  vm.runInContext(
    `${ironPolicySource}\nthis.__installIron = installPlannerIronPreferenceRuntime;`,
    context,
  );
  assert.equal(context.__installIron(), true);

  const focus = context.state.foods.find((food) => food.id === "pferd");
  assert.equal(context.companionFor(focus, "lunch", "2026-08-18", "bekannt")?.id, "kartoffel");
  assert.equal(context.ironCompanion(), null);
});

test("PLAN-08-X1: Loader kettet MILK-01 -> Eisenpräferenz -> Präsentation -> Recipe-first", () => {
  const utils = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");
  assert.match(utils, /planner-milk-policy\.js\?v=10\.1\.25/);
  assert.match(utils, /planner-iron-preference\.js\?v=10\.1\.25/);
  assert.match(utils, /ironScript\.addEventListener\("load", loadPresentationStack/);
  assert.match(utils, /presentationScript\.addEventListener\("load", loadRecipeFirstPolicy/);
});
