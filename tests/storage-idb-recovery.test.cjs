"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const storageSource = fs.readFileSync(path.join(root, "js", "storage.js"), "utf8");
const KEY = "chester-beikost-pwa-v6";
const RECOVERY_KEY = `${KEY}-idb-recovery-pending`;
const STATE_RECORD = "state";
const SNAPSHOT_RECORD = "snapshots";
const clone = (value) => JSON.parse(JSON.stringify(value));

function stateWithRevision(revision) {
  return {
    revision,
    settings: { planFrom: "2026-08-22" },
    backupMeta: { storagePersisted: "unknown" },
  };
}

function createLocalStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
  };
}

function createStorageRuntime({ localStorage, idb, initialState }) {
  const context = {
    APP_VERSION: "10.1.26",
    SCHEMA_VERSION: 5,
    DB_NAME: "chester-beikost-db",
    DB_VERSION: 1,
    DB_STORE: "app",
    STATE_RECORD,
    SNAPSHOT_RECORD,
    KEY,
    LEGACY_KEYS: [],
    DEFAULT: stateWithRevision("default"),
    state: clone(initialState),
    indexedDB: {},
    window: { indexedDB: {} },
    navigator: { storage: {} },
    localStorage,
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
    },
    console: { error: () => {} },
    clone,
    migrateState: clone,
    today: () => "2026-08-22",
    renderAll: () => {},
    renderCurrentView: () => {},
  };

  vm.createContext(context);
  vm.runInContext(`${storageSource}\nthis.__storageTest = {
    save,
    bootstrapStorage,
    getState: () => clone(state),
    setState: (next) => { state = clone(next); },
    setIdbGet: (fn) => { idbGet = fn; },
    setIdbPut: (fn) => { idbPut = fn; },
  };`, context);

  const runtime = context.__storageTest;
  runtime.setIdbGet(async (key) => key === STATE_RECORD ? clone(idb.state) : []);
  runtime.setIdbPut(async (key, value) => {
    if (key !== STATE_RECORD) return true;
    if (idb.failNextWrite) {
      idb.failNextWrite = false;
      throw new Error("transient IndexedDB write failure");
    }
    idb.state = clone(value);
    return true;
  });
  return runtime;
}

test("CR-001: newer local emergency copy wins after transient IndexedDB write failure", async () => {
  const v1 = stateWithRevision("v1");
  const localStorage = createLocalStorage({ [KEY]: JSON.stringify(v1) });
  const idb = { state: clone(v1), failNextWrite: false };

  const firstRun = createStorageRuntime({ localStorage, idb, initialState: v1 });
  await firstRun.bootstrapStorage();

  const v2 = firstRun.getState();
  v2.revision = "v2";
  firstRun.setState(v2);
  idb.failNextWrite = true;
  await firstRun.save();

  const v3 = firstRun.getState();
  v3.revision = "v3";
  firstRun.setState(v3);
  await firstRun.save();

  assert.equal(idb.state.revision, "v1");
  assert.equal(JSON.parse(localStorage.getItem(KEY)).revision, "v3");
  assert.equal(localStorage.getItem(RECOVERY_KEY), "1");

  const reloadedLocalState = JSON.parse(localStorage.getItem(KEY));
  const secondRun = createStorageRuntime({ localStorage, idb, initialState: reloadedLocalState });
  await secondRun.bootstrapStorage();

  assert.equal(secondRun.getState().revision, "v3");
  assert.equal(idb.state.revision, "v3");
  assert.equal(JSON.parse(localStorage.getItem(KEY)).revision, "v3");
  assert.equal(localStorage.getItem(RECOVERY_KEY), null);
});
