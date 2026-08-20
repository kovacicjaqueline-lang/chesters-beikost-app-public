"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "product-allergens-guards.js"), "utf8");

function runGuard(extra = {}) {
  const context = { console, ...extra };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

test("hidden individual outcome rows do not override the shared meal outcome", () => {
  let individual = false;
  const document = {
    getElementById: (id) => {
      if (id === "mainOutcome") return { value: "eaten" };
      if (id === "individualRatings") return { get checked() { return individual; } };
      return null;
    },
    querySelectorAll: (selector) => selector === "[data-individual-result]"
      ? [{ dataset: { individualResult: "rosine" }, value: "not_offered" }]
      : [],
  };
  const context = runGuard({
    pendingLog: { foodOutcomes: {}, sampleFoodIds: [] },
    selectedLogFoods: new Set(["rosine"]),
    document,
  });

  assert.equal(context.productAllergenCurrentLogOutcomes().rosine, "eaten");
  individual = true;
  assert.equal(context.productAllergenCurrentLogOutcomes().rosine, "not_offered");
});

test("recipe inventory uses actual ingredient ids before the base save listener runs", () => {
  assert.match(source, /recipeFoodIdsForActualInventoryBatch/);
  assert.match(source, /capture:\s*true/);
});
