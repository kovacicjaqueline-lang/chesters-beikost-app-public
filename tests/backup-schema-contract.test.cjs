"use strict";

const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function source(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function numericConstant(text, name) {
  const match = text.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)\\s*;`));
  assert.ok(match, `${name} muss als numerische Runtime-Konstante definiert sein`);
  return Number(match[1]);
}

const versionMeta = JSON.parse(source("VERSION.json"));
const stateSource = source("js/state.js");
const storageSource = source("js/storage.js");
const productSource = source("js/product-allergens.js");
const guardSource = source("js/product-allergens-guards.js");

const STATE_SCHEMA_VERSION = numericConstant(stateSource, "SCHEMA_VERSION");
const BACKUP_SCHEMA_VERSION = numericConstant(guardSource, "PRODUCT_ALLERGEN_BACKUP_SCHEMA_VERSION");
const PRODUCT_ALLERGEN_SCHEMA_VERSION = numericConstant(guardSource, "PRODUCT_ALLERGEN_DATA_SCHEMA_VERSION");

function sulfiteSnapshot(status = "present") {
  return {
    foodId: "rosine",
    productId: "product-rosine-1",
    productName: "Bio-Rosinen",
    brand: "Testmarke",
    productAllergens: { sulfites: status },
  };
}

function fixtureState() {
  const snapshot = sulfiteSnapshot();
  return {
    settings: { phaseSelected: "aufbau" },
    foods: [{ id: "rosine", name: "Rosine", active: true, allergenGroup: "" }],
    logs: [{
      id: "log-1",
      date: "2026-08-20",
      meal: "breakfast",
      foodIds: ["rosine"],
      focusId: "rosine",
      outcome: "eaten",
      foodOutcomes: { rosine: "eaten" },
      productAllergenSnapshots: { rosine: snapshot },
    }],
    inventory: [{
      id: "inventory-1",
      kind: "food",
      foodId: "rosine",
      portions: 2,
      productAllergenSnapshot: snapshot,
    }],
    products: [{
      id: "product-rosine-1",
      foodId: "rosine",
      foodName: "Rosine",
      name: "Bio-Rosinen",
      brand: "Testmarke",
      productAllergens: { sulfites: "present" },
    }],
    overrides: {},
    deferred: {},
    pantry: {},
    planLocks: {},
    autoLockExcluded: {},
    manualMeals: {},
    inactivePlanKept: {},
    combinationPauses: {},
    followUps: {},
    shoppingHints: {},
    backupMeta: {},
  };
}

function loadBackupRuntime(initialState = fixtureState()) {
  const localWrites = new Map();
  const context = {
    console,
    crypto: webcrypto,
    TextEncoder,
    clone,
    KEY: "test-state",
    APP_VERSION: versionMeta.version,
    SCHEMA_VERSION: STATE_SCHEMA_VERSION,
    DB_NAME: "test-db",
    DB_VERSION: 1,
    DB_STORE: "app",
    STATE_RECORD: "state",
    SNAPSHOT_RECORD: "snapshots",
    LEGACY_KEYS: [],
    DEFAULT: {},
    state: clone(initialState),
    localStorage: {
      setItem(key, value) { localWrites.set(key, value); },
      getItem(key) { return localWrites.get(key) || null; },
    },
    migrateState(sourceState) {
      const migrated = clone(sourceState || {});
      delete migrated.schemaVersion;
      return migrated;
    },
  };
  vm.createContext(context);
  vm.runInContext(storageSource, context, { filename: "js/storage.js" });
  vm.runInContext(productSource, context, { filename: "js/product-allergens.js" });
  vm.runInContext(guardSource, context, { filename: "js/product-allergens-guards.js" });
  return { context, localWrites };
}

async function checksum(context, payload) {
  return context.sha256Text(JSON.stringify(payload));
}

test("CR-002: VERSION metadata names the three actual schema contracts explicitly", () => {
  assert.equal(Object.hasOwn(versionMeta, "schemaVersion"), false, "mehrdeutige generische schemaVersion darf keine Kompatibilitätsaussage mehr vortäuschen");
  assert.equal(versionMeta.stateSchemaVersion, STATE_SCHEMA_VERSION);
  assert.equal(versionMeta.backupSchemaVersion, BACKUP_SCHEMA_VERSION);
  assert.equal(versionMeta.productAllergenSchemaVersion, PRODUCT_ALLERGEN_SCHEMA_VERSION);
  assert.match(versionMeta.schemaCompatibility, /State-Schema 5/);
  assert.match(versionMeta.schemaCompatibility, /Backup-Schema 6/);
  assert.match(versionMeta.schemaCompatibility, /Produktallergen-Datenschema 1/);
});

test("CR-002: aktueller Export validiert in derselben Runtime und bleibt nach Migration importierbar", async () => {
  const original = fixtureState();
  const { context, localWrites } = loadBackupRuntime(original);

  const pack = await context.buildBackupPackage();
  assert.equal(pack.schemaVersion, BACKUP_SCHEMA_VERSION);
  assert.equal(pack.payload.schemaVersion, BACKUP_SCHEMA_VERSION);
  assert.equal(pack.productAllergenSchemaVersion, PRODUCT_ALLERGEN_SCHEMA_VERSION);
  assert.equal(pack.payload.productAllergenSchemaVersion, PRODUCT_ALLERGEN_SCHEMA_VERSION);

  const validated = await context.validateBackup(JSON.stringify(pack));
  const restored = context.migrateState(validated.payload);
  const plainRestored = clone(restored);

  assert.deepEqual(plainRestored.products, original.products);
  assert.deepEqual(plainRestored.logs[0].productAllergenSnapshots, original.logs[0].productAllergenSnapshots);
  assert.deepEqual(plainRestored.inventory[0].productAllergenSnapshot, original.inventory[0].productAllergenSnapshot);
  assert.equal(plainRestored.productAllergenSchemaVersion, PRODUCT_ALLERGEN_SCHEMA_VERSION);

  context.state = restored;
  await context.save();
  assert.equal(JSON.parse(localWrites.get("test-state")).schemaVersion, STATE_SCHEMA_VERSION, "nach dem Import bleibt der lokale Persistenzmarker State-Schema 5");
});

test("CR-002: unterstütztes Vorgänger-Backup-Schema 5 bleibt importierbar", async () => {
  const { context } = loadBackupRuntime();
  const payload = fixtureState();
  payload.schemaVersion = STATE_SCHEMA_VERSION;
  delete payload.productAllergenSchemaVersion;
  const pack = {
    type: "chester-beikost-backup",
    appVersion: "10.1.25",
    schemaVersion: STATE_SCHEMA_VERSION,
    createdAt: "2026-08-19T12:00:00.000Z",
    checksum: await checksum(context, payload),
    payload,
  };

  const validated = await context.validateBackup(JSON.stringify(pack));
  assert.equal(validated.schemaVersion, STATE_SCHEMA_VERSION);
  const restored = clone(context.migrateState(validated.payload));
  assert.equal(restored.productAllergenSchemaVersion, PRODUCT_ALLERGEN_SCHEMA_VERSION);
});

test("CR-002: Backup-Schema 6 bleibt an den Produktallergen-Marker gebunden", async () => {
  const { context } = loadBackupRuntime();
  const payload = fixtureState();
  payload.schemaVersion = BACKUP_SCHEMA_VERSION;
  const pack = {
    type: "chester-beikost-backup",
    appVersion: versionMeta.version,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    checksum: await checksum(context, payload),
    payload,
  };

  await assert.rejects(
    () => context.validateBackup(JSON.stringify(pack)),
    /neueren App-Version/,
  );
});

test("CR-002: eine unbekannte zukünftige Backup-Version wird kontrolliert abgelehnt", async () => {
  const { context } = loadBackupRuntime();
  const futureVersion = BACKUP_SCHEMA_VERSION + 1;
  const payload = fixtureState();
  payload.schemaVersion = futureVersion;
  payload.productAllergenSchemaVersion = PRODUCT_ALLERGEN_SCHEMA_VERSION;
  const pack = {
    type: "chester-beikost-backup",
    appVersion: "99.0.0",
    schemaVersion: futureVersion,
    productAllergenSchemaVersion: PRODUCT_ALLERGEN_SCHEMA_VERSION,
    checksum: await checksum(context, payload),
    payload,
  };

  await assert.rejects(
    () => context.validateBackup(JSON.stringify(pack)),
    /neueren App-Version/,
  );
});
