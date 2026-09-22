"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const policySource = fs.readFileSync(path.join(root, "js", "food-status-preferences.js"), "utf8");

function loadPolicy({ foods = [], ranks = {}, outcomes = {} } = {}) {
  const context = {
    state: { foods, overrides: {} },
    rank: (item) => Number(ranks[item?.id] ?? 0),
    lastOutcome: (id) => outcomes[id] || "",
  };
  vm.createContext(context);
  vm.runInContext(
    `${policySource}\nthis.__policy = { foodStatusPreferenceIntroductionExclude, foodStatusPreferenceNextAutomaticResult };`,
    context,
  );
  return { context, policy: context.__policy };
}

test("Introduction-Vorfilter blockiert nur ohnehin übersprungene Probiert- und Auto-Fokus-Kandidaten", () => {
  const foods = [
    { id: "probiert", allergenGroup: "" },
    { id: "abgelehnt", allergenGroup: "" },
    { id: "allergen", allergenGroup: "Ei" },
    { id: "bekannt", allergenGroup: "" },
    { id: "component", allergenGroup: "" },
    { id: "override", allergenGroup: "" },
  ];
  const { context, policy } = loadPolicy({
    foods,
    ranks: { probiert: 1, abgelehnt: 1, allergen: 1, bekannt: 2, component: 0, override: 1 },
    outcomes: { probiert: "eaten", abgelehnt: "not_accepted", allergen: "eaten", override: "eaten" },
  });

  const blocked = policy.foodStatusPreferenceIntroductionExclude(
    foods,
    ["schon-ausgeschlossen"],
    "override",
    context.rank,
    context.lastOutcome,
    (item) => !["component", "override"].includes(item.id),
  );

  assert.deepEqual(
    Array.from(blocked).sort(),
    ["probiert", "component", "schon-ausgeschlossen"].sort(),
  );
});

test("Introduction-Vorfilter reduziert Probiert- und Component-Skip-Schleifen auf einen Producer-Aufruf", () => {
  const ordinary = Array.from({ length: 80 }, (_, index) => ({
    id: `probiert-${index}`,
    allergenGroup: "",
  }));
  const components = Array.from({ length: 80 }, (_, index) => ({
    id: `component-${index}`,
    allergenGroup: "",
  }));
  const allergen = { id: "ei", allergenGroup: "Ei" };
  const foods = [...ordinary, ...components, allergen];
  const ranks = {
    ...Object.fromEntries(ordinary.map((item) => [item.id, 1])),
    ...Object.fromEntries(components.map((item) => [item.id, 0])),
    ei: 1,
  };
  const outcomes = Object.fromEntries(ordinary.map((item) => [item.id, "eaten"]));
  outcomes.ei = "eaten";
  const { context, policy } = loadPolicy({ foods, ranks, outcomes });

  const blocked = policy.foodStatusPreferenceIntroductionExclude(
    foods,
    [],
    "",
    context.rank,
    context.lastOutcome,
    (item) => !item.id.startsWith("component-"),
  );
  let producerCalls = 0;
  const result = policy.foodStatusPreferenceNextAutomaticResult((exclude) => {
    producerCalls += 1;
    const item = foods.find((candidate) => !exclude.includes(candidate.id));
    return item ? { f: item, type: "bekannt kombinieren" } : null;
  }, blocked);

  assert.equal(result?.f?.id, "ei");
  assert.equal(producerCalls, 1);
});

test("Introduction-Vorfilter lässt Override und echte Ablehnungs-Wiederholung unangetastet", () => {
  const foods = [
    { id: "override", allergenGroup: "" },
    { id: "abgelehnt", allergenGroup: "" },
  ];
  const { context, policy } = loadPolicy({
    foods,
    ranks: { override: 1, abgelehnt: 1 },
    outcomes: { override: "eaten", abgelehnt: "not_accepted" },
  });

  const blocked = policy.foodStatusPreferenceIntroductionExclude(
    foods,
    [],
    "override",
    context.rank,
    context.lastOutcome,
    (item) => item.id === "abgelehnt",
  );
  assert.deepEqual(Array.from(blocked), []);

  let calls = 0;
  const overrideResult = policy.foodStatusPreferenceNextAutomaticResult(() => {
    calls += 1;
    return { f: foods[0], type: "manuell" };
  }, blocked);
  assert.equal(overrideResult?.f?.id, "override");
  assert.equal(calls, 1);

  const retryResult = policy.foodStatusPreferenceNextAutomaticResult(() => ({
    f: foods[1],
    type: "bekannt kombinieren",
  }), blocked);
  assert.equal(retryResult?.f?.id, "abgelehnt");
});
