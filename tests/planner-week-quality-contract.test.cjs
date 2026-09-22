"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const checksSource = fs.readFileSync(path.join(root, "js", "plan-checks.js"), "utf8");

function makeContext(foods) {
  const byId = new Map(foods.map((item) => [item.id, item]));
  const state = {
    foods,
    logs: [],
    settings: { phaseSelected: "aufbau", allergenDays: 7 },
  };
  const context = {
    state,
    food: (id) => byId.get(id) || null,
    rank: (record) => Number(record?.rank || 0),
    isTrustedBase: (record) => Number(record?.rank || 0) >= 2 && record?.plannerRole !== "component",
    mealIsCompleted: () => false,
    isPlannedIntroductionSequence: () => false,
    mealContainsMilkProduct: (ids = []) => ids.some((id) => byId.get(id)?.category === "Milchprodukt"),
    isMeatOrFish: (record) => ["Fleisch", "Fisch"].includes(record?.category),
    mealMilkLevel: (meal) => meal.milkLevel || "none",
    currentAmountLevel: () => "normal",
    AMOUNT_LEVELS: { normal: { rank: 1 } },
    today: () => "2026-09-22",
  };
  vm.createContext(context);
  vm.runInContext(checksSource, context);
  return context;
}

function meal(date, overrides = {}) {
  return {
    date,
    active: true,
    empty: false,
    meal: "lunch",
    focusId: "kartoffel",
    foodIds: ["kartoffel"],
    baseFoodIds: ["kartoffel"],
    sampleFoodIds: [],
    type: "bekannt",
    milkLevel: "none",
    ...overrides,
  };
}

function day(date, meals) {
  return { date, meals };
}

function codes(report) {
  return report.items.map((item) => item.code);
}

const WEEK = [
  ["2026-09-22", "kartoffel", ["kartoffel", "zucchini"]],
  ["2026-09-23", "reis", ["reis", "karotte"]],
  ["2026-09-24", "hafer", ["hafer", "apfel"]],
  ["2026-09-25", "hirse", ["hirse", "brokkoli"]],
  ["2026-09-26", "rind", ["rind", "brokkoli"]],
  ["2026-09-27", "joghurt", ["joghurt", "birne"]],
  ["2026-09-28", "polenta", ["polenta", "erbsen"]],
];

test("7-Tage-Plan erfüllt Abwechslung sowie die modellierten Eisen- und Milchvorgaben", () => {
  const foods = [
    "kartoffel", "zucchini", "reis", "karotte", "hafer", "apfel", "hirse",
    "brokkoli", "rind", "joghurt", "birne", "polenta", "erbsen",
  ].map((id) => ({
    id,
    name: id,
    rank: 2,
    active: true,
    category: id === "rind" ? "Fleisch" : id === "joghurt" ? "Milchprodukt" : "Gemüse",
    ironRich: id === "rind",
  }));
  const context = makeContext(foods);
  const days = WEEK.map(([date, focusId, foodIds]) => day(date, [
    meal(date, {
      focusId,
      foodIds,
      baseFoodIds: [foodIds[0]],
      milkLevel: focusId === "joghurt" ? "full" : "none",
    }),
  ]));
  const report = context.PlannerPlanChecks.report(days);
  const focusIds = days.flatMap((entry) => entry.meals).map((entry) => entry.focusId);
  const combinations = days.flatMap((entry) => entry.meals)
    .map((entry) => [...entry.foodIds].sort().join("+"));

  assert.equal(days.length, 7);
  assert.equal(new Set(focusIds).size, 7, "die Woche muss unterschiedliche Fokus-Lebensmittel verwenden");
  assert.equal(new Set(combinations).size, 7, "die Woche muss unterschiedliche Kombinationen verwenden");
  assert.equal(codes(report).includes("FOCUS_ROTATION_LOW"), false);
  assert.equal(codes(report).includes("CONSECUTIVE_FOCUS_REPEAT"), false);
  assert.equal(codes(report).includes("IRON_RICH_MISSING"), false);
  assert.equal(codes(report).includes("MILK_WITH_MEAT_OR_FISH"), false);
  assert.equal(codes(report).includes("MULTIPLE_FULL_MILK_MEALS"), false);
});

test("7-Tage-Qualitätsprüfung erkennt Wiederholung und Ernährungskonflikte", () => {
  const foods = [
    { id: "kartoffel", name: "Kartoffel", rank: 2, active: true },
    { id: "joghurt", name: "Joghurt", rank: 2, active: true, category: "Milchprodukt" },
    { id: "rind", name: "Rind", rank: 2, active: true, category: "Fleisch", ironRich: true },
  ];
  const context = makeContext(foods);
  const days = [
    day("2026-09-22", [meal("2026-09-22", { focusId: "kartoffel" })]),
    day("2026-09-23", [meal("2026-09-23", { focusId: "kartoffel" })]),
    day("2026-09-24", [meal("2026-09-24", { focusId: "kartoffel" })]),
    day("2026-09-25", [meal("2026-09-25", { focusId: "kartoffel" })]),
    day("2026-09-26", [meal("2026-09-26", {
      focusId: "joghurt",
      foodIds: ["joghurt", "rind"],
      milkLevel: "full",
    })]),
    day("2026-09-27", [meal("2026-09-27", {
      focusId: "kartoffel",
      milkLevel: "full",
    })]),
    day("2026-09-28", [meal("2026-09-28", { focusId: "kartoffel" })]),
  ];
  const report = context.PlannerPlanChecks.report(days);
  const reportCodes = codes(report);

  assert.equal(reportCodes.includes("FOCUS_ROTATION_LOW"), true);
  assert.equal(reportCodes.includes("CONSECUTIVE_FOCUS_REPEAT"), true);
  assert.equal(reportCodes.includes("MILK_WITH_MEAT_OR_FISH"), true);
  assert.equal(reportCodes.includes("MULTIPLE_FULL_MILK_MEALS"), false);
  assert.equal(reportCodes.includes("IRON_RICH_MISSING"), false, "Rind deckt die modellierte Eisenanforderung");
});
