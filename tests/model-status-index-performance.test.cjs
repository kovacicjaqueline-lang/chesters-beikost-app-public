"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const modelSource = fs.readFileSync(path.join(root, "js", "model.js"), "utf8");

function loadModel(logs) {
  const context = {
    console,
    FOOD_DB: [],
    RECIPES: [],
    STATUS_ORDER: { Offen: 0, Probiert: 1, Bekannt: 2, Pausiert: -1 },
    state: { foods: [], logs, inventory: [], settings: {} },
  };
  vm.createContext(context);
  vm.runInContext(modelSource, context);
  return context;
}

test("FOOD-Status nutzt den zentralen Log-Index statt Logs bei jedem rank/status erneut zu scannen", () => {
  const logs = [
    {
      id: "eaten",
      date: "2026-09-20",
      meal: "lunch",
      foodIds: ["karotte"],
      foodOutcomes: { karotte: "eaten" },
      createdAt: "2026-09-20T11:00:00.000Z",
    },
    {
      id: "tried",
      date: "2026-09-21",
      meal: "dinner",
      foodIds: ["karotte"],
      foodOutcomes: { karotte: "tried" },
      createdAt: "2026-09-21T17:00:00.000Z",
    },
  ];
  const context = loadModel(logs);
  const food = { id: "karotte", manualStatus: "auto" };

  assert.equal(context.autoStatus(food), "Probiert");

  logs[1].foodOutcomes.karotte = "eaten";
  assert.equal(context.autoStatus(food), "Probiert", "ein unveränderter Log-Index bleibt bis zur expliziten Invalidierung stabil");

  context.invalidateLogsForCache();
  assert.equal(context.autoStatus(food), "Bekannt", "nach Invalidierung muss der Status aus den geänderten Logs neu aufgebaut werden");
  assert.equal(context.statusSource(food), "automatisch aus 2 getrennten gegessenen Expositionen");

  let rescans = 0;
  for (const log of logs) {
    const outcomes = log.foodOutcomes;
    Object.defineProperty(log, "foodOutcomes", {
      configurable: true,
      get() {
        rescans += 1;
        throw new Error("Log wurde trotz vorhandenem Index erneut gescannt");
      },
    });
    log.__outcomes = outcomes;
  }

  for (let index = 0; index < 1000; index += 1) {
    assert.equal(context.status(food), "Bekannt");
    assert.equal(context.rank(food), 2);
  }
  assert.equal(context.statusSource(food), "automatisch aus 2 getrennten gegessenen Expositionen");
  assert.equal(rescans, 0);
});
