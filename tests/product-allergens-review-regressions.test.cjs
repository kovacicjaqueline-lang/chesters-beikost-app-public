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

function snapshot(foodId, productId, name, status, brand = "Marke") {
  return {
    foodId,
    productId,
    productName: name,
    brand,
    productAllergens: { sulfites: status },
  };
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
  assert.match(source, /genericModal/);
});

test("ambiguous recipe batches require explicit actual-ingredient confirmation", () => {
  const context = runGuard();
  assert.equal(context.productAllergenRecipeNeedsExplicitChoice({ requires: ["Hafer"] }), false);
  assert.equal(context.productAllergenRecipeNeedsExplicitChoice({ requires: ["Hafer"], alternatives: [["Hirse"]] }), true);
  assert.equal(context.productAllergenRecipeNeedsExplicitChoice({ requires: ["Hafer"], oneOf: ["Banane", "Mango"] }), true);
  assert.equal(context.productAllergenRecipeNeedsExplicitChoice({ requires: ["Hafer"], milkChoices: ["Milch", "Joghurt"] }), true);
});

test("confirmed actual recipe ingredients are persisted on the inventory batch", () => {
  assert.match(source, /actualRecipeIngredientsConfirmed\s*=\s*true/);
  assert.match(source, /data-inventory-recipe-confirm/);
});

test("mixed legacy intrinsic allergen keeps the real allergen and strips Sulfite only", () => {
  const context = runGuard({
    DEFAULT: {},
    migrateState: (value) => JSON.parse(JSON.stringify(value)),
  });
  const migrated = context.migrateState({
    foods: [
      { id: "custom-milk", name: "Eigenes Produkt", allergenGroup: "Milch / Sulfite" },
      { id: "custom-sesame", name: "Eigenes Produkt 2", allergenGroup: "Sesam und Schwefeldioxid" },
      { id: "custom-only", name: "Eigenes Produkt 3", allergenGroup: "Schwefeldioxid / Sulfite" },
      { id: "custom-parentheses", name: "Eigenes Produkt 4", allergenGroup: "Milch (Sulfite)" },
    ],
  });
  assert.equal(migrated.foods[0].allergenGroup, "Milch");
  assert.equal(migrated.foods[1].allergenGroup, "Sesam");
  assert.equal(migrated.foods[2].allergenGroup, "");
  assert.equal(migrated.foods[3].allergenGroup, "Milch");
});

test("historical product label wins when the same product id was edited later", () => {
  const previous = snapshot("rosine", "p1", "Alte Rosinen", "present", "Altmarke");
  const current = { id: "p1", foodId: "rosine", name: "Neue Rosinen", brand: "Neumarke", productAllergens: { sulfites: "absent" } };
  const context = runGuard({
    normalizeProductAllergenSnapshot: (value) => ({ ...value, productAllergens: { sulfites: value?.productAllergens?.sulfites || "unknown" } }),
    concreteProduct: () => current,
    snapshotForConcreteProduct: () => snapshot("rosine", "p1", "Neue Rosinen", "absent", "Neumarke"),
    normalizeSulfiteStatus: (value) => value || "unknown",
    productSnapshotLabel: (value) => [value.brand, value.productName].filter(Boolean).join(" · "),
    sulfiteStatusLabel: (value) => value,
  });
  assert.equal(context.productAllergenSnapshotUiDiffers("rosine", "p1", previous, current), true);
  assert.match(context.productAllergenOptionLabel("rosine", current, "p1", previous), /Altmarke · Alte Rosinen · historisch · present/);
});

test("confirmed recipe batch foodIds replace generic planner recipe ids", () => {
  const batch = {
    id: "batch-1",
    kind: "recipe",
    recipeName: "Obstbrei",
    actualRecipeIngredientsConfirmed: true,
    foodIds: ["hafer", "mango"],
  };
  const foods = new Map([["hafer", { id: "hafer" }], ["banane", { id: "banane" }], ["mango", { id: "mango" }]]);
  const context = runGuard({
    state: { inventory: [batch], settings: {} },
    food: (id) => foods.get(id) || null,
    foodRolesFor: (ids) => Object.fromEntries(ids.map((id) => [id, "base"])),
    plannedMealAmounts: (meal) => ({ targetGrams: 70, sampleGrams: 0, totalOfferedGrams: 70, amounts: Object.fromEntries(meal.foodIds.map((id) => [id, 35])) }),
    reserveMealInventory: (meal) => meal,
  });
  const meal = context.reserveMealInventory({
    recipeName: "Obstbrei",
    recipeInventoryId: "batch-1",
    foodIds: ["hafer", "banane"],
    baseFoodIds: ["hafer", "banane"],
    sampleFoodIds: [],
    focusId: "hafer",
  }, {});
  assert.deepEqual(Array.from(meal.foodIds), ["hafer", "mango"]);
  assert.deepEqual(Array.from(meal.baseFoodIds), ["hafer", "mango"]);
  assert.equal(meal.ingredientAmounts.mango, 35);
  assert.equal(Object.prototype.hasOwnProperty.call(meal.ingredientAmounts, "banane"), false);
});

test("automatic planning does not use a confirmed batch when an actual ingredient is paused", () => {
  const batch = { id: "batch-1", kind: "recipe", actualRecipeIngredientsConfirmed: true, foodIds: ["hafer", "mango"] };
  const foods = new Map([
    ["hafer", { id: "hafer", active: true, meals: ["breakfast"] }],
    ["banane", { id: "banane", active: true, meals: ["breakfast"] }],
    ["mango", { id: "mango", active: true, meals: ["breakfast"] }],
  ]);
  const context = runGuard({
    state: { inventory: [batch], settings: {} },
    food: (id) => foods.get(id) || null,
    status: (item) => item.id === "mango" ? "Pausiert" : "Regelmäßig",
    reserveMealInventory: (meal) => meal,
  });
  const meal = context.reserveMealInventory({
    meal: "breakfast",
    type: "Rezeptvorrat",
    recipeInventoryId: "batch-1",
    foodIds: ["hafer", "banane"],
    baseFoodIds: ["hafer", "banane"],
    sampleFoodIds: [],
    focusId: "hafer",
  }, {});
  assert.equal(meal.recipeInventoryId, "");
  assert.equal(meal.type, "Rezept");
  assert.deepEqual(Array.from(meal.foodIds), ["hafer", "banane"]);
});

test("openLog still records actual confirmed batch ingredients even if they are no longer auto-eligible", () => {
  const batch = { id: "batch-1", kind: "recipe", actualRecipeIngredientsConfirmed: true, foodIds: ["hafer", "mango"] };
  const foods = new Map([
    ["hafer", { id: "hafer", active: true }],
    ["banane", { id: "banane", active: true }],
    ["mango", { id: "mango", active: true }],
  ]);
  let received = null;
  const context = runGuard({
    state: { inventory: [batch], settings: {} },
    food: (id) => foods.get(id) || null,
    status: (item) => item.id === "mango" ? "Pausiert" : "Regelmäßig",
    foodRolesFor: () => ({}),
    plannedMealAmounts: (meal) => ({ targetGrams: 70, sampleGrams: 0, totalOfferedGrams: 70, amounts: Object.fromEntries(meal.foodIds.map((id) => [id, 35])) }),
    openLog: (plan) => { received = plan; return plan; },
  });
  context.openLog({ recipeInventoryId: "batch-1", foodIds: ["hafer", "banane"], baseFoodIds: ["hafer", "banane"], sampleFoodIds: [], focusId: "hafer" });
  assert.deepEqual(Array.from(received.foodIds), ["hafer", "mango"]);
});

test("openLog repairs a stale planned recipe batch before the log draft is created", () => {
  const batch = {
    id: "batch-1",
    kind: "recipe",
    actualRecipeIngredientsConfirmed: true,
    foodIds: ["hafer", "mango"],
  };
  let received = null;
  const foods = new Map([["hafer", { id: "hafer" }], ["mango", { id: "mango" }], ["banane", { id: "banane" }]]);
  const context = runGuard({
    state: { inventory: [batch], settings: {} },
    food: (id) => foods.get(id) || null,
    foodRolesFor: () => ({}),
    plannedMealAmounts: (meal) => ({ targetGrams: 70, sampleGrams: 0, totalOfferedGrams: 70, amounts: Object.fromEntries(meal.foodIds.map((id) => [id, 35])) }),
    openLog: (plan) => { received = plan; return plan; },
  });
  context.openLog({ recipeInventoryId: "batch-1", foodIds: ["hafer", "banane"], baseFoodIds: ["hafer", "banane"], sampleFoodIds: [], focusId: "hafer" });
  assert.deepEqual(Array.from(received.foodIds), ["hafer", "mango"]);
});
