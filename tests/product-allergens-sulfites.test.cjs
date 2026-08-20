"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "product-allergens.js"), "utf8");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadContext(extra = {}) {
  const context = {
    console,
    state: { products: [], foods: [], logs: [], inventory: [] },
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

function snapshot(context, foodId, productId, status) {
  return context.normalizeProductAllergenSnapshot({
    foodId,
    productId,
    productName: productId ? `Produkt ${productId}` : "",
    productAllergens: { sulfites: status },
  }, foodId);
}

test("Sulfite have three explicit product states and missing stays unknown", () => {
  const context = loadContext();
  assert.equal(context.normalizeSulfiteStatus("present"), "present");
  assert.equal(context.normalizeSulfiteStatus("absent"), "absent");
  assert.equal(context.normalizeSulfiteStatus("unknown"), "unknown");
  assert.equal(context.normalizeSulfiteStatus(""), "unknown");
  assert.equal(context.normalizeSulfiteStatus(undefined), "unknown");
});

test("generic FOOD use never becomes positive by identity", () => {
  const context = loadContext({
    state: {
      products: [],
      foods: [
        { id: "rosine", name: "Rosine", allergenGroup: "", foodFamily: "trockenobst" },
        { id: "dattel", name: "Dattel", allergenGroup: "", allergenFamily: "trockenobst" },
      ],
      logs: [],
      inventory: [],
    },
  });
  assert.equal(context.sulfiteAggregateStatus(["rosine"], {}), "unknown");
  assert.equal(context.sulfiteAggregateStatus(["dattel"], {}), "unknown");
  assert.equal(context.sulfiteAggregateStatus(["rosine", "dattel"], {}), "unknown");
});

test("recipe/meal aggregate is present if any actually used product declares sulfites", () => {
  const context = loadContext();
  const snapshots = {
    rosine: snapshot(context, "rosine", "p1", "present"),
    hafer: snapshot(context, "hafer", "p2", "absent"),
  };
  assert.equal(context.sulfiteAggregateStatus(["rosine", "hafer"], snapshots), "present");
});

test("recipe/meal aggregate is absent only when every used ingredient is explicitly checked absent", () => {
  const context = loadContext();
  const checked = {
    rosine: snapshot(context, "rosine", "p1", "absent"),
    hafer: snapshot(context, "hafer", "p2", "absent"),
  };
  assert.equal(context.sulfiteAggregateStatus(["rosine", "hafer"], checked), "absent");

  const partlyUnknown = {
    rosine: snapshot(context, "rosine", "p1", "absent"),
    hafer: snapshot(context, "hafer", "", "unknown"),
  };
  assert.equal(context.sulfiteAggregateStatus(["rosine", "hafer"], partlyUnknown), "unknown");
});

test("historical snapshot is preserved when the same product is edited later", () => {
  const context = loadContext({
    state: {
      products: [{
        id: "product-rosine",
        foodId: "rosine",
        name: "Rosinen neu geprüft",
        brand: "Test",
        productAllergens: { sulfites: "absent" },
      }],
      foods: [{ id: "rosine", name: "Rosine" }],
      logs: [],
      inventory: [],
    },
  });
  const oldSnapshot = snapshot(context, "rosine", "product-rosine", "present");
  const preserved = context.preservedOrCurrentSnapshot("rosine", "product-rosine", oldSnapshot);
  assert.equal(preserved.productAllergens.sulfites, "present");

  const changedSelection = context.preservedOrCurrentSnapshot("rosine", "", oldSnapshot);
  assert.equal(changedSelection.productAllergens.sulfites, "unknown");
});

test("migration materializes legacy missing log and inventory product status as unknown", () => {
  const context = loadContext({
    DEFAULT: {},
    canonicalId: (id) => id,
    migrateState: (input) => ({
      foods: clone(input.foods || []),
      logs: clone(input.logs || []),
      inventory: clone(input.inventory || []),
    }),
  });
  const migrated = context.migrateState({
    foods: [{ id: "rosine", name: "Rosine" }, { id: "hafer", name: "Hafer" }],
    logs: [{ id: "log-1", foodIds: ["rosine"] }],
    inventory: [
      { id: "food-batch", kind: "food", foodId: "rosine", portions: 2 },
      { id: "recipe-batch", kind: "recipe", foodIds: ["rosine", "hafer"], portions: 2 },
    ],
  });
  assert.deepEqual(clone(migrated.products), []);
  assert.equal(migrated.logs[0].productAllergenSnapshots.rosine.productAllergens.sulfites, "unknown");
  assert.equal(migrated.inventory[0].productAllergenSnapshot.productAllergens.sulfites, "unknown");
  assert.equal(migrated.inventory[1].ingredientProductSnapshots.rosine.productAllergens.sulfites, "unknown");
  assert.equal(migrated.inventory[1].ingredientProductSnapshots.hafer.productAllergens.sulfites, "unknown");
});

test("migration preserves positive, negative and unknown product records separately", () => {
  const context = loadContext({
    DEFAULT: {},
    canonicalId: (id) => id,
    migrateState: (input) => ({ foods: clone(input.foods || []), logs: [], inventory: [] }),
  });
  const migrated = context.migrateState({
    foods: [{ id: "rosine", name: "Rosine" }],
    products: [
      { id: "p-present", foodId: "rosine", name: "A", productAllergens: { sulfites: "present" } },
      { id: "p-absent", foodId: "rosine", name: "B", productAllergens: { sulfites: "absent" } },
      { id: "p-unknown", foodId: "rosine", name: "C", productAllergens: { sulfites: "unknown" } },
    ],
  });
  assert.deepEqual(
    clone(migrated.products.map((item) => item.productAllergens.sulfites)),
    ["present", "absent", "unknown"],
  );
});

test("static FOOD and recipe data receive no blanket Sulfite assignment", () => {
  const foodsSource = fs.readFileSync(path.join(root, "data", "foods.js"), "utf8");
  const recipesSource = fs.readFileSync(path.join(root, "data", "recipes.js"), "utf8");
  assert.doesNotMatch(foodsSource, /allergenGroup\s*:\s*["']Sulf/i);
  assert.doesNotMatch(foodsSource, /allergenFamily\s*:\s*["']Sulf/i);
  assert.doesNotMatch(foodsSource, /foodFamily\s*:\s*["']Sulf/i);
  assert.doesNotMatch(recipesSource, /sulfite/i);
});

test("product module is loaded before app start and is available offline", () => {
  const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const productPos = indexSource.indexOf('src="js/product-allergens.js?v=');
  const appPos = indexSource.indexOf('src="app.js?v=');
  assert.ok(productPos >= 0, "product allergen module must be loaded");
  assert.ok(appPos > productPos, "product allergen module must wrap migration/UI before app startup");
  assert.match(swSource, /\.\/js\/product-allergens\.js/);
});

test("product module never maps Sulfites into intrinsic allergen or family fields", () => {
  assert.doesNotMatch(source, /allergenGroup\s*=/);
  assert.doesNotMatch(source, /allergenFamily\s*=/);
  assert.doesNotMatch(source, /foodFamily\s*=/);
});
