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
const LOGS_STORE = "logs";
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
    get length() { return entries.size; },
    key(index) { return [...entries.keys()][index] ?? null; },
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
    DB_VERSION: 2,
    DB_STORE: "app",
    DB_LOGS_STORE: LOGS_STORE,
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
    load,
    bootstrapStorage,
    getState: () => clone(state),
    setState: (next) => { state = clone(next); },
    setIdbGet: (fn) => { idbGet = fn; },
    setIdbPut: (fn) => { idbPut = fn; },
    setIdbGetLogs: (fn) => { idbGetLogs = fn; },
    setIdbSaveStateAndLogs: (fn) => { idbSaveStateAndLogs = fn; },
    createSnapshot,
  };`, context);

  const runtime = context.__storageTest;
  runtime.setIdbGet(async (key) => key === STATE_RECORD ? clone(idb.state) : []);
  runtime.setIdbPut(async (key, value) => {
    if (key === SNAPSHOT_RECORD && idb.failNextSnapshot) {
      idb.failNextSnapshot = false;
      throw new Error("transient IndexedDB snapshot failure");
    }
    if (key !== STATE_RECORD) return true;
    if (idb.failNextWrite) {
      idb.failNextWrite = false;
      throw new Error("transient IndexedDB write failure");
    }
    idb.state = clone(value);
    return true;
  });
  runtime.setIdbGetLogs(async () => clone(idb.logs || []));
  runtime.setIdbSaveStateAndLogs(async (snapshot, changes, allLogs) => {
    if (idb.failNextWrite) {
      idb.failNextWrite = false;
      throw new Error("transient IndexedDB write failure");
    }
    idb.state = clone(snapshot);
    if (Array.isArray(allLogs)) idb.logs = clone(allLogs);
    else {
      idb.logs = idb.logs || [];
      idb.logs = idb.logs.filter((entry) => !(changes?.deleteIds || []).includes(entry.id));
      for (const entry of changes?.upserts || []) {
        idb.logs = idb.logs.filter((old) => old.id !== entry.id);
        idb.logs.push(clone(entry));
      }
    }
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

test("CR-002: Ein neuer Protokolleintrag wird als einzelner Datensatz ergänzt", async () => {
  const oldLogs = [
    { id: "log-1", createdAt: "2026-08-20T10:00:00.000Z" },
    { id: "log-2", createdAt: "2026-08-21T10:00:00.000Z" },
  ];
  const initial = { ...stateWithRevision("v1"), logs: oldLogs };
  const localStorage = createLocalStorage({ [KEY]: JSON.stringify(initial) });
  const idb = { state: clone(initial), logs: [] };
  const runtime = createStorageRuntime({ localStorage, idb, initialState: initial });
  await runtime.bootstrapStorage();

  const oldLocalLog1 = localStorage.getItem(`${KEY}-log-log-1`);
  const oldLocalLog2 = localStorage.getItem(`${KEY}-log-log-2`);
  const next = runtime.getState();
  const added = { id: "log-3", createdAt: "2026-08-22T10:00:00.000Z" };
  next.logs.push(added);
  runtime.setState(next);
  await runtime.save({ logMutation: { upserts: [added] } });

  assert.equal(Object.hasOwn(idb.state, "logs"), false);
  assert.deepEqual(idb.logs.map((entry) => entry.id).sort(), ["log-1", "log-2", "log-3"]);
  assert.deepEqual(JSON.parse(localStorage.getItem(KEY)).logs, undefined);
  assert.equal(localStorage.getItem(`${KEY}-log-log-1`), oldLocalLog1);
  assert.equal(localStorage.getItem(`${KEY}-log-log-2`), oldLocalLog2);
  assert.equal(JSON.parse(localStorage.getItem(`${KEY}-log-log-3`)).log.id, "log-3");
  assert.deepEqual(runtime.getState().logs.map((log) => log.id), ["log-1", "log-2", "log-3"]);

  const localReload = runtime.load();
  assert.deepEqual(Array.from(localReload.logs, (log) => log.id), ["log-1", "log-2", "log-3"]);
  const idbReload = createStorageRuntime({
    localStorage,
    idb,
    initialState: JSON.parse(localStorage.getItem(KEY)),
  });
  await idbReload.bootstrapStorage();
  assert.deepEqual(idbReload.getState().logs.map((log) => log.id), ["log-1", "log-2", "log-3"]);

  const edited = idbReload.getState();
  edited.logs[0] = { ...edited.logs[0], note: "bearbeitet" };
  idbReload.setState(edited);
  await idbReload.save({ logMutation: { upserts: [edited.logs[0]] } });
  assert.equal(idb.logs.find((entry) => entry.id === "log-1").log.note, "bearbeitet");

  const withoutSecond = idbReload.getState();
  withoutSecond.logs = withoutSecond.logs.filter((log) => log.id !== "log-2");
  idbReload.setState(withoutSecond);
  await idbReload.save({ logMutation: { deleteIds: ["log-2"] } });
  assert.deepEqual(idb.logs.map((entry) => entry.id).sort(), ["log-1", "log-3"]);

  idbReload.setState(initial);
  await idbReload.save({ replaceLogs: true });
  assert.deepEqual(idb.logs.map((entry) => entry.id).sort(), ["log-1", "log-2"]);
  assert.equal(localStorage.getItem(`${KEY}-log-log-3`), null);
});

test("CR-003: einzelner Log-Eintrag wird nach einem IndexedDB-Fehler aus der Notfallkopie wiederhergestellt", async () => {
  const initial = {
    ...stateWithRevision("before-failure"),
    logs: [{ id: "existing-log", createdAt: "2026-08-21T10:00:00.000Z" }],
  };
  const localStorage = createLocalStorage({ [KEY]: JSON.stringify(initial) });
  const idb = { state: clone(initial), logs: [] };
  const firstRun = createStorageRuntime({ localStorage, idb, initialState: initial });
  await firstRun.bootstrapStorage();

  const added = { id: "pending-log", createdAt: "2026-08-22T10:00:00.000Z" };
  const next = firstRun.getState();
  next.logs.push(added);
  next.revision = "after-failure";
  firstRun.setState(next);
  idb.failNextWrite = true;
  await firstRun.save({ logMutation: { upserts: [added] } });

  assert.equal(localStorage.getItem(RECOVERY_KEY), "1");
  assert.equal(idb.logs.some((entry) => entry.id === "pending-log"), false);
  assert.equal(JSON.parse(localStorage.getItem(`${KEY}-log-pending-log`)).log.id, "pending-log");

  const secondRun = createStorageRuntime({
    localStorage,
    idb,
    initialState: JSON.parse(localStorage.getItem(KEY)),
  });
  await secondRun.bootstrapStorage();

  assert.equal(secondRun.getState().revision, "after-failure");
  assert.deepEqual(secondRun.getState().logs.map((log) => log.id), ["existing-log", "pending-log"]);
  assert.deepEqual(idb.logs.map((entry) => entry.id).sort(), ["existing-log", "pending-log"]);
  assert.equal(localStorage.getItem(RECOVERY_KEY), null);
});


test("CR-001: Zwischenstände bleiben bei einem IndexedDB-Fehler lokal verfügbar", async () => {
  const state = stateWithRevision("snapshot-v1");
  const localStorage = createLocalStorage();
  const idb = { state: clone(state), failNextWrite: false, failNextSnapshot: true };
  const runtime = createStorageRuntime({ localStorage, idb, initialState: state });

  const first = await runtime.createSnapshot("vor Backup");
  assert.equal(first.length, 1);
  const fallbackKey = `${KEY}-snapshots-fallback`;
  const savedFallback = JSON.parse(localStorage.getItem(fallbackKey));
  assert.equal(savedFallback.length, 1);
  assert.equal(savedFallback[0].state.revision, "snapshot-v1");

  runtime.setIdbGet(async () => null);
  const second = await runtime.createSnapshot("zweiter Zwischenstand");
  assert.equal(second.length, 2);
  assert.equal(second[0].state.revision, "snapshot-v1");
});
