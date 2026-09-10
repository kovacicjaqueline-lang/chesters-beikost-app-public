"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const core = require("../js/planner-allergen-maintenance.js");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "planner-allergen-maintenance.js"), "utf8");

const foods = [
  { id: "banane", name: "Banane", allergenGroup: "" },
  { id: "ei", name: "Ei", allergenGroup: "Ei" },
  { id: "erdnuss", name: "Erdnuss", allergenGroup: "Erdnuss" },
];

function dueMaintenanceTargets() {
  return core.dueTargets({
    foods,
    logs: [
      { date: "2026-08-01", foodIds: ["ei"], foodOutcomes: { ei: "eaten" } },
      { date: "2026-08-02", foodIds: ["erdnuss"], foodOutcomes: { erdnuss: "eaten" } },
    ],
    on: "2026-08-20",
    intervalDays: 7,
    rankFn: (item) => item.allergenGroup ? 2 : 0,
    outcomeForFoodFn: (log, id) => log.foodOutcomes?.[id] || "",
  });
}

test("fällige etablierte Allergene werden an der tatsächlich deckenden Mahlzeit markiert", () => {
  let meals = [{
    meal: "breakfast",
    foodIds: ["banane", "ei", "erdnuss"],
    sampleFoodIds: [],
  }];
  core.annotateMaintenanceFoodIds(dueMaintenanceTargets(), meals, foods);
  assert.deepEqual(meals[0].allergenMaintenanceFoodIds, ["ei", "erdnuss"]);
});

test("ein Pflegeziel wird nur an der ersten deckenden Mahlzeit desselben Tages markiert", () => {
  let due = dueMaintenanceTargets().filter((target) => target.allergenGroup === "Ei");
  let meals = [
    { meal: "breakfast", foodIds: ["ei"], sampleFoodIds: [] },
    { meal: "lunch", foodIds: ["ei", "banane"], sampleFoodIds: [] },
  ];
  core.annotateMaintenanceFoodIds(due, meals, foods);
  assert.deepEqual(meals[0].allergenMaintenanceFoodIds, ["ei"]);
  assert.equal(meals[1].allergenMaintenanceFoodIds, undefined);
});

test("Lernproben werden nicht fälschlich als langfristige Allergenpflege markiert", () => {
  let due = dueMaintenanceTargets().filter((target) => target.allergenGroup === "Ei");
  let meals = [{
    meal: "breakfast",
    foodIds: ["banane", "ei"],
    baseFoodIds: ["banane"],
    sampleFoodIds: ["ei"],
  }];
  core.annotateMaintenanceFoodIds(due, meals, foods);
  assert.equal(meals[0].allergenMaintenanceFoodIds, undefined);
});

test("Runtime-Hook ermittelt fällige Pflege vor dem Tagesplan und annotiert danach den echten Plan", () => {
  assert.match(source, /let dueTargetsBeforeDay = runtimeDueTargets\(date, ctx\);/);
  assert.match(source, /CORE\.annotateMaintenanceFoodIds\(\s*dueTargetsBeforeDay,/s);
});
