"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const policy = require("../js/planner-introduction-policy.js");

function withPlannerRuntime({ foods, outcomes = {}, overrides = {}, ranks = {} }, run) {
  const names = [
    "buildDay",
    "introductionCandidate",
    "reserveMealInventory",
    "applyPlannedMealAmounts",
    "canCombine",
    "food",
    "rank",
    "lastOutcome",
    "manualMealRoleInfo",
    "state",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, global[name]]));
  const previousFlag = global.__plannerIntroductionPolicyRuntimeInstalled;
  let producerCalls = 0;

  try {
    delete global.__plannerIntroductionPolicyRuntimeInstalled;
    global.state = {
      foods,
      overrides,
      manualMeals: {},
      planLocks: {},
      settings: { newFoodEvery: 4 },
    };
    global.food = (id) => foods.find((item) => item.id === id) || null;
    global.rank = (item) => Number(ranks[item?.id] ?? 0);
    global.lastOutcome = (id) => outcomes[id] || "";
    global.canCombine = () => true;
    global.reserveMealInventory = () => {};
    global.applyPlannedMealAmounts = (meal) => meal;
    global.manualMealRoleInfo = () => ({ role: "excluded" });
    global.buildDay = () => ({ meals: [] });
    global.introductionCandidate = (meal, on, _ctx, exclude = []) => {
      producerCalls += 1;
      const overrideId = global.state.overrides?.[`${on}|${meal}`] || "";
      if (overrideId && !exclude.includes(overrideId)) {
        const item = global.food(overrideId);
        if (item) return { f: item, type: "manuell" };
      }
      const item = foods.find((candidate) => !exclude.includes(candidate.id));
      if (!item) return null;
      if (global.rank(item) === 1) return { f: item, type: "bekannt kombinieren" };
      return { f: item, type: item.allergenGroup ? "Allergen einführen" : "neu" };
    };

    assert.equal(policy.installPlannerIntroductionPolicyRuntime(), true);
    run(() => producerCalls);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete global[name];
      else global[name] = previous[name];
    }
    if (previousFlag === undefined) delete global.__plannerIntroductionPolicyRuntimeInstalled;
    else global.__plannerIntroductionPolicyRuntimeInstalled = previousFlag;
  }
}

test("Vorfilter blockiert gewöhnliche Nicht-Allergene vor dem ersten Producer-Aufruf", () => {
  const foods = Array.from({ length: 120 }, (_, index) => ({
    id: `normal-${index}`,
    allergenGroup: "",
  }));
  foods.push({ id: "ei", allergenGroup: "Ei" });

  withPlannerRuntime({ foods }, (getProducerCalls) => {
    const result = global.introductionCandidate("lunch", "2026-09-23", {}, []);
    assert.equal(result?.f?.id, "ei");
    assert.equal(result?.type, "Allergen einführen");
    assert.equal(getProducerCalls(), 1);
  });
});

test("Vorfilter erhält manuellen Override und echte not_accepted-Wiederholung", () => {
  const foods = [
    { id: "override", allergenGroup: "" },
    { id: "abgelehnt", allergenGroup: "" },
    { id: "normal", allergenGroup: "" },
  ];

  const blocked = policy.plannerIntroductionPrefilterBlockedFoods(
    foods,
    [],
    "override",
    true,
    false,
    (id) => id === "abgelehnt" ? "not_accepted" : "",
  );

  assert.equal(blocked.includes("override"), false);
  assert.equal(blocked.includes("abgelehnt"), false);
  assert.equal(blocked.includes("normal"), true);
});

test("Vorfilter blockiert Allergene nur wenn die bestehende Policy sie verbietet", () => {
  const foods = [
    { id: "ei", allergenGroup: "Ei" },
    { id: "normal", allergenGroup: "" },
  ];

  const allergenAllowed = policy.plannerIntroductionPrefilterBlockedFoods(
    foods,
    [],
    "",
    true,
    false,
    () => "",
  );
  assert.equal(allergenAllowed.includes("ei"), false);

  const allergenBlocked = policy.plannerIntroductionPrefilterBlockedFoods(
    foods,
    [],
    "",
    false,
    true,
    () => "",
  );
  assert.equal(allergenBlocked.includes("ei"), true);
});
