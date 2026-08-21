"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const guardSource = fs.readFileSync(path.join(root, "js", "product-allergens-guards.js"), "utf8");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runGuard(extra = {}) {
  const context = { console, ...extra };
  vm.createContext(context);
  vm.runInContext(guardSource, context);
  return context;
}

function sulfiteSnapshot(status, productId = "product-1", productName = "Produkt") {
  return {
    foodId: "rosine",
    productId,
    productName,
    brand: "Testmarke",
    productAllergens: { sulfites: status },
  };
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

test("legacy custom Sulfite allergenGroup is removed during migration", () => {
  const context = runGuard({
    DEFAULT: {},
    migrateState: (source) => clone(source),
  });
  const migrated = context.migrateState({
    foods: [
      { id: "custom-1", name: "Eigenes Produkt", allergenGroup: "Schwefeldioxid / Sulfite" },
      { id: "custom-2", name: "Eigenes Milchprodukt", allergenGroup: "Milch" },
    ],
  });
  assert.equal(migrated.foods[0].allergenGroup, "");
  assert.equal(migrated.foods[1].allergenGroup, "Milch");
  assert.equal(migrated.productAllergenSchemaVersion, 1);
});

test("not_offered foods are excluded from Sulfite applicability", () => {
  const context = runGuard();
  assert.deepEqual(
    Array.from(context.productAllergenApplicableFoodIds(
      ["hafer", "rosine"],
      { hafer: "eaten", rosine: "not_offered" },
    )),
    ["hafer"],
  );
});

test("deleted or moved product remains selectable as historical snapshot", () => {
  const previous = sulfiteSnapshot("present", "product-old", "Alte Rosinen");
  const context = runGuard({
    normalizeProductAllergenSnapshot: (snapshot) => snapshot,
    productSnapshotLabel: (snapshot) => `${snapshot.brand} · ${snapshot.productName}`,
    sulfiteStatusLabel: (status) => status,
    esc: (value) => String(value || ""),
  });
  const html = context.productAllergenHistoricalOption("rosine", "product-old", [], previous);
  assert.match(html, /value="product-old" selected/);
  assert.match(html, /historisch/);
  assert.match(html, /present/);
});

test("editing a historical log never rereads a current recipe batch snapshot", () => {
  const historical = sulfiteSnapshot("present", "product-old");
  const context = runGuard({
    pendingLog: {
      editId: "log-1",
      foodOutcomes: { rosine: "eaten" },
      productAllergenSnapshots: { rosine: historical },
    },
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
    emptyProductAllergenSnapshot: (id) => ({ foodId: id, productAllergens: { sulfites: "unknown" } }),
    normalizeProductAllergenSnapshot: (snapshot) => snapshot,
    productAllergenLogSelection: () => "product-old",
    preservedOrCurrentSnapshot: (_id, selected, previous) => selected === previous.productId ? previous : sulfiteSnapshot("unknown", ""),
  });

  assert.equal(context.productAllergenRecipeBatchSnapshotActive(), false);
  assert.equal(context.currentLogDraftSnapshots().rosine.productAllergens.sulfites, "present");
});

test("not_offered selection is snapshotted as unknown", () => {
  const context = runGuard({
    pendingLog: {
      foodOutcomes: { rosine: "not_offered" },
      productAllergenSnapshots: { rosine: sulfiteSnapshot("present") },
    },
    selectedRecipeInventoryId: "",
    selectedLogFoods: new Set(["rosine"]),
    selectedInventoryFoods: new Set(),
    state: { inventory: [] },
    document: { getElementById: () => null },
    currentLogDraftSnapshots: () => ({}),
    emptyProductAllergenSnapshot: (id) => ({ foodId: id, productAllergens: { sulfites: "unknown" } }),
    normalizeProductAllergenSnapshot: (snapshot) => snapshot,
    productAllergenLogSelection: () => "product-1",
    preservedOrCurrentSnapshot: () => sulfiteSnapshot("present"),
  });
  assert.equal(context.currentLogDraftSnapshots().rosine.productAllergens.sulfites, "unknown");
});

test("new log only inherits recipe batch snapshot when recipe inventory is actually selected", () => {
  let useRecipe = false;
  const context = runGuard({
    pendingLog: { foodOutcomes: { rosine: "eaten" }, productAllergenSnapshots: {} },
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
    emptyProductAllergenSnapshot: (id) => ({ foodId: id, productAllergens: { sulfites: "unknown" } }),
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

test("recipe batch stores the actually chosen variant and oneOf ingredient", () => {
  const foods = [
    { id: "hafer", name: "Hafer" },
    { id: "hirse", name: "Hirse" },
    { id: "ei", name: "Ei" },
    { id: "banane", name: "Banane" },
    { id: "mango", name: "Mango" },
  ];
  const recipe = {
    requires: ["Hafer", "Ei"],
    alternatives: [["Hirse", "Ei"]],
    oneOf: ["Banane", "Mango"],
  };
  const context = runGuard({
    state: { foods },
    foodByName: (name, list) => list.find((item) => item.name === name),
    recipeFoodIds: () => ["hafer", "ei", "banane"],
  });
  const choice = context.productAllergenRecipeChoiceState(recipe, ["hirse", "ei", "mango"]);
  assert.equal(choice.variantIndex, 1);
  assert.equal(choice.oneOfId, "mango");
  assert.deepEqual(
    Array.from(context.productAllergenRecipeActualFoodIds(recipe, choice)),
    ["hirse", "ei", "mango"],
  );
});

test("product-aware backups use schema 6 and remain readable by this runtime", async () => {
  const sha256Text = async (text) => `hash:${text.length}`;
  const context = runGuard({
    buildBackupPackage: async () => ({
      type: "chester-beikost-backup",
      schemaVersion: 5,
      payload: { products: [{ id: "p1" }] },
      checksum: "",
    }),
    validateBackup: async (raw) => {
      const parsed = JSON.parse(raw);
      if (Number(parsed.schemaVersion) > 5) throw new Error("Dieses Backup stammt aus einer neueren App-Version.");
      return parsed;
    },
    sha256Text,
  });
  const pack = await context.buildBackupPackage();
  assert.equal(pack.schemaVersion, 6);
  assert.equal(pack.payload.schemaVersion, 6);
  assert.equal(pack.productAllergenSchemaVersion, 1);
  assert.equal((await context.validateBackup(JSON.stringify(pack))).schemaVersion, 6);
});

test("schema 6 without product marker is still rejected as newer", async () => {
  const context = runGuard({
    validateBackup: async (raw) => {
      const parsed = JSON.parse(raw);
      if (Number(parsed.schemaVersion) > 5) throw new Error("Dieses Backup stammt aus einer neueren App-Version.");
      return parsed;
    },
  });
  await assert.rejects(
    () => context.validateBackup(JSON.stringify({ type: "chester-beikost-backup", schemaVersion: 6, payload: {} })),
    /neueren App-Version/,
  );
});

test("guard module loads after product model and before app start and is precached", () => {
  const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const modelPos = indexSource.indexOf('src="js/product-allergens.js?v=');
  const guardPos = indexSource.indexOf('src="js/product-allergens-guards.js?v=');
  const appPos = indexSource.indexOf('src="app.js?v=');
  assert.ok(modelPos >= 0 && guardPos > modelPos && appPos > guardPos);
  assert.match(swSource, /\.\/js\/product-allergens-guards\.js/);
});
