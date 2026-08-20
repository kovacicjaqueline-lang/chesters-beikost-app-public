"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const guardSource = fs.readFileSync(path.join(root, "js", "product-allergens-guards.js"), "utf8");

function runGuard(extra = {}) {
  const context = { console, ...extra };
  vm.createContext(context);
  vm.runInContext(guardSource, context);
  return context;
}

function sulfiteSnapshot(status, productId = "product-1") {
  return { productId, productAllergens: { sulfites: status } };
}

test("custom intrinsic allergen guard rejects Sulfite and Schwefeldioxid terms", () => {
  const context = runGuard();
  for (const value of ["Sulfite", "Sulfit", "Schwefeldioxid", "sulphites"]) {
    assert.equal(context.productAllergenForbiddenIntrinsicValue(value), true, value);
  }
  for (const value of ["Milch", "Sesam", "Glutenhaltiges Getreide", "Ei"]) {
    assert.equal(context.productAllergenForbiddenIntrinsicValue(value), false, value);
  }
});

test("editing a historical log never rereads a current recipe batch snapshot", () => {
  const historical = sulfiteSnapshot("present", "product-old");
  const context = runGuard({
    pendingLog: { editId: "log-1", productAllergenSnapshots: { rosine: historical } },
    selectedRecipeInventoryId: "recipe-batch-1",
    selectedLogFoods: new Set(["rosine"]),
    selectedInventoryFoods: new Set(),
    state: {
      inventory: [{
        id: "recipe-batch-1",
        kind: "recipe",
        ingredientProductSnapshots: { rosine: sulfiteSnapshot("absent", "product-new") },
      }],
    },
    document: { getElementById: () => ({ checked: true }) },
    currentLogDraftSnapshots: () => ({}),
    normalizeProductAllergenSnapshot: (snapshot) => snapshot,
    productAllergenLogSelection: () => "product-old",
    preservedOrCurrentSnapshot: (_id, _selected, previous) => previous,
  });

  assert.equal(context.productAllergenRecipeBatchSnapshotActive(), false);
  assert.equal(context.currentLogDraftSnapshots().rosine.productAllergens.sulfites, "present");
});

test("new log only inherits recipe batch snapshot when recipe inventory is actually selected", () => {
  let useRecipe = false;
  const context = runGuard({
    pendingLog: { productAllergenSnapshots: {} },
    selectedRecipeInventoryId: "recipe-batch-1",
    selectedLogFoods: new Set(["rosine"]),
    selectedInventoryFoods: new Set(),
    state: {
      inventory: [{
        id: "recipe-batch-1",
        kind: "recipe",
        ingredientProductSnapshots: { rosine: sulfiteSnapshot("present", "product-batch") },
      }],
    },
    document: { getElementById: (id) => id === "useRecipeInventory" ? { get checked() { return useRecipe; } } : null },
    currentLogDraftSnapshots: () => ({}),
    normalizeProductAllergenSnapshot: (snapshot) => snapshot,
    productAllergenLogSelection: () => "",
    preservedOrCurrentSnapshot: () => sulfiteSnapshot("unknown", ""),
  });

  assert.equal(context.productAllergenRecipeBatchSnapshotActive(), false);
  assert.equal(context.currentLogDraftSnapshots().rosine.productAllergens.sulfites, "unknown");

  useRecipe = true;
  assert.equal(context.productAllergenRecipeBatchSnapshotActive(), true);
  assert.equal(context.currentLogDraftSnapshots().rosine.productAllergens.sulfites, "present");
});

test("guard module loads after product model and before app start and is precached", () => {
  const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const modelPos = indexSource.indexOf('js/product-allergens.js?v=10.1.25');
  const guardPos = indexSource.indexOf('js/product-allergens-guards.js?v=10.1.25');
  const appPos = indexSource.indexOf('app.js?v=10.1.25');
  assert.ok(modelPos >= 0 && guardPos > modelPos && appPos > guardPos);
  assert.match(swSource, /\.\/js\/product-allergens-guards\.js/);
});
