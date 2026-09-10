"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const foodsSource = fs.readFileSync(path.join(root, "data", "foods.js"), "utf8");

function readRind() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(foodsSource, context);
  return vm.runInContext('FOOD_DB.find((item) => item.id === "rind") || null', context);
}

test("Rind safeForm keeps the reviewed soft non-round serving guidance", () => {
  const food = readRind();
  assert.ok(food);
  assert.match(food.safeForm, /vollständig.*durchgaren/i);
  assert.doesNotMatch(food.safeForm, /später/i);
  assert.match(food.safeForm, /weich/i);
  assert.match(food.safeForm, /länglich|flach/i);
  assert.match(food.safeForm, /keine.*rund|nicht.*rund/i);
});
