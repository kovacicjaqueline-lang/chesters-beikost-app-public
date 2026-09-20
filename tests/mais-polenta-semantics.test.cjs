"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function runFile(context, relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

function loadContext() {
  const context = {
    clone: (value) => JSON.parse(JSON.stringify(value)),
    normalizeName: (value) => String(value || "").trim().toLowerCase(),
    state: { foods: [], settings: {} },
  };
  vm.createContext(context);
  runFile(context, "data/foods.js");
  vm.runInContext("state.foods = FOOD_DB;", context);
  runFile(context, "js/utils.js");
  runFile(context, "app.js");
  vm.runInContext(
    `this.__foodDb = FOOD_DB;
     this.__foodByName = foodByName;
     this.__applyFoodPolicyData = applyFoodPolicyData;`,
    context,
  );
  return context;
}

function aliases(food) {
  return String(food?.alias || "")
    .split(/[,;/|]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

test("Mais und Polenta bleiben sichtbar und semantisch getrennt", () => {
  const context = loadContext();
  const mais = context.__foodDb.find((food) => food.id === "mais-polenta");
  const polenta = context.__foodDb.find((food) => food.id === "polenta");

  assert.equal(mais?.name, "Mais");
  assert.equal(mais?.autoPlan, false);
  assert.equal(aliases(mais).includes("Polenta"), false);
  assert.equal(polenta?.name, "Polenta");
  assert.equal(context.__foodByName("Polenta")?.id, "polenta");
  assert.equal(context.__foodByName("Mais")?.id, "mais-polenta");
});

test("historische mais-polenta-ID wird manuell verfügbar, aber nicht auto-planbar migriert", () => {
  const context = loadContext();
  const foods = context.__foodDb.map((food) => ({ ...food }));
  const aliasesById = {};

  context.__applyFoodPolicyData(foods, aliasesById);

  const mais = foods.find((food) => food.id === "mais");
  assert.ok(mais);
  assert.equal(mais.autoPlan, false);
  assert.equal(mais.alias, "");
  assert.equal(aliasesById["mais-polenta"], "mais");
});
