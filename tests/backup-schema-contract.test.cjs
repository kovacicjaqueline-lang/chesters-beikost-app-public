"use strict";

const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const clone = (value) => JSON.parse(JSON.stringify(value));

function numericConstant(text, name) {
  const match = text.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)\\s*;`));
  assert.ok(match, `${name} muss als numerische Runtime-Konstante definiert sein`);
  return Number(match[1]);
}

const versionMeta = JSON.parse(read("VERSION.json"));
const stateSource = read("js/state.js");
const storageSource = read("js/storage.js");
const recipeSource = read("js/recipe-inventory-ingredients.js");
const stateSchemaVersion = numericConstant(stateSource, "SCHEMA_VERSION");

function fixtureState() {
  return {
    settings: { phaseSelected: "aufbau" },
    foods: [{ id: "rosine", name: "Rosine", active: true, allergenGroup: "" }],
    logs: [{
      id: "log-1",
      date: "2026-08-20",
      foodIds: ["rosine"],
      foodOutcomes: { rosine: "eaten" },
      productAllergenSnapshots: { rosine: { productId: "p1", productAllergens: { sulfites: "present" } } },
    }],
    inventory: [{
      id: "inventory-1",
      kind: "recipe",
      recipeName: "Obstbrei",
      foodIds: ["rosine"],
      actualRecipeIngredientsConfirmed: true,
      ingredientProductSnapshots: { rosine: { productId: "p1", productAllergens: { sulfites: "present" } } },
    }],
    products: [{ id: "p1", foodId: "rosine", name: "Bio-Rosinen", productAllergens: { sulfites: "present" } }],
    backupMeta: {},
  };
}

function loadRuntime(initialState = fixtureState()) {
  const localWrites = new Map();
  const context = {
    console,
    crypto: webcrypto,
    TextEncoder,
    clone,
    KEY: "test-state",
    APP_VERSION: versionMeta.version,
    SCHEMA_VERSION: stateSchemaVersion,
    DB_NAME: "test-db",
    DB_VERSION: 1,
    DB_STORE: "app",
    STATE_RECORD: "state",
    SNAPSHOT_RECORD: "snapshots",
    LEGACY_KEYS: [],
    DEFAULT: { foods: [], logs: [], inventory: [] },
    state: clone(initialState),
    localStorage: {
      setItem(key, value) { localWrites.set(key, value); },
      getItem(key) { return localWrites.get(key) || null; },
    },
    migrateState(source) {
      return clone(source || {});
    },
  };
  vm.createContext(context);
  vm.runInContext(storageSource, context, { filename: "js/storage.js" });
  vm.runInContext(recipeSource, context, { filename: "js/recipe-inventory-ingredients.js" });
  return { context, localWrites };
}

async function checksum(context, payload) {
  return context.sha256Text(JSON.stringify(payload));
}

test("aktueller Export verwendet wieder das kanonische Backup-Schema 5", async () => {
  assert.equal(versionMeta.stateSchemaVersion, stateSchemaVersion);
  assert.equal(versionMeta.backupSchemaVersion, stateSchemaVersion);
  assert.equal(Object.hasOwn(versionMeta, "productAllergenSchemaVersion"), false);

  const { context } = loadRuntime();
  const pack = await context.buildBackupPackage();
  assert.equal(pack.schemaVersion, stateSchemaVersion);
  assert.equal(pack.payload.schemaVersion, stateSchemaVersion);
  assert.equal(Object.hasOwn(pack, "productAllergenSchemaVersion"), false);
  assert.equal(Object.hasOwn(pack.payload, "productAllergenSchemaVersion"), false);
  assert.equal(Object.hasOwn(pack.payload, "products"), false);
  assert.equal(Object.hasOwn(pack.payload.logs[0], "productAllergenSnapshots"), false);
  assert.equal(Object.hasOwn(pack.payload.inventory[0], "ingredientProductSnapshots"), false);
  assert.equal(pack.checksum, await checksum(context, pack.payload));
});

test("früheres Sulfit-Backup-Schema 6 bleibt importierbar und wird bereinigt", async () => {
  const { context } = loadRuntime();
  const payload = fixtureState();
  payload.schemaVersion = 6;
  payload.productAllergenSchemaVersion = 1;
  const pack = {
    type: "chester-beikost-backup",
    appVersion: "10.1.26",
    schemaVersion: 6,
    productAllergenSchemaVersion: 1,
    checksum: await checksum(context, payload),
    payload,
  };

  const validated = await context.validateBackup(JSON.stringify(pack));
  const restored = context.migrateState(validated.payload);
  assert.equal(restored.products, undefined);
  assert.equal(restored.logs[0].productAllergenSnapshots, undefined);
  assert.equal(restored.inventory[0].ingredientProductSnapshots, undefined);
  assert.equal(restored.inventory[0].actualRecipeIngredientsConfirmed, true);
});

test("Legacy-Sulfit in einem Custom-Allergen wird ohne Verlust echter Allergene entfernt", () => {
  const { context } = loadRuntime();
  const migrated = context.migrateState({ foods: [
    { id: "custom-1", name: "Eigenes Produkt", allergenGroup: "Milch / Sulfite" },
    { id: "custom-2", name: "Eigenes Produkt 2", allergenGroup: "Schwefeldioxid / Sulfite" },
  ] });
  assert.equal(migrated.foods.find((item) => item.id === "custom-1").allergenGroup, "Milch");
  assert.equal(migrated.foods.find((item) => item.id === "custom-2").allergenGroup, "");
});

test("Migration behält die tatsächliche Rezeptzutaten-Bestätigung", () => {
  const { context } = loadRuntime();
  const migrated = context.migrateState(fixtureState());
  assert.equal(migrated.inventory[0].actualRecipeIngredientsConfirmed, true);
  assert.deepEqual(migrated.inventory[0].foodIds, ["rosine"]);
});
