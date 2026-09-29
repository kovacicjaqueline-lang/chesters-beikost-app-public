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
    setIdbGetLogs: (fn) => { idbGetLogs = fn; },
    setIdbSaveStateAndLogs: (fn) => { idbSaveStateAndLogs = fn; },
    createSnapshot,
  };`, context);

  const runtime = context.__storageTest;
  runtime.setIdbGet(async (key) => key === STATE_RECORD ? clone(idb.state) : []);
  runtime.setIdbGetLogs(async () => [...(idb.logs?.values() || [])]
    .sort((a, b) => (a.__storageOrder ?? 0) - (b.__storageOrder ?? 0))
    .map(({ __storageOrder, ...log }) => clone(log)));
  runtime.setIdbSaveStateAndLogs(async (snapshot, options = {}) => {
    if (!idb.puts) idb.puts = [];
    let nextLogs = new Map(idb.logs || []);
    let sequence = Number(idb.sequence) || 0;
    if (options.fullSyncLogs) {
      idb.puts.push("full-log-sync");
      const logs = (options.logs || []).filter((log) => log?.id);
      nextLogs = new Map(logs.map((log, index) => [`log:${log.id}`, { ...clone(log), __storageOrder: index }]));
      sequence = logs.length;
    } else {
      for (const log of options.logChanges || []) {
        idb.puts.push(`log:${log.id}`);
        const existing = nextLogs.get(`log:${log.id}`);
        const order = Number.isFinite(existing?.__storageOrder) ? existing.__storageOrder : sequence++;
        nextLogs.set(`log:${log.id}`, { ...clone(log), __storageOrder: order });
      }
      for (const id of options.removedLogIds || []) {
        idb.puts.push(`log:${id}`);
        nextLogs.delete(`log:${id}`);
      }
    }
    idb.puts.push(STATE_RECORD);
    if (idb.failNextWrite) {
      idb.failNextWrite = false;
      throw new Error("transient IndexedDB write failure");
    }
    idb.logs = nextLogs;
    idb.sequence = sequence;
    idb.state = clone(snapshot);
    return true;
  });
  runtime.setIdbPut(async (key, value) => {
    if (!idb.puts) idb.puts = [];
    idb.puts.push(key);
    if (key === SNAPSHOT_RECORD && idb.failNextSnapshot) {
      idb.failNextSnapshot = false;
      throw new Error("transient IndexedDB snapshot failure");
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

test("Protokollspeicherung schreibt den neuen Eintrag einzeln und hält Logs aus dem Zustandsdatensatz heraus", async () => {
  const oldLog = { id: "old-log", outcome: "eaten" };
  const nextLog = { id: "new-log", outcome: "tried" };
  const localStorage = createLocalStorage();
  const idb = {
    state: { ...stateWithRevision("v1"), storageLayoutVersion: 2, logs: [] },
    logs: new Map([["log:old-log", oldLog]]),
  };
  const runtime = createStorageRuntime({ localStorage, idb, initialState: { ...stateWithRevision("v1"), logs: [oldLog, nextLog] } });

  await runtime.save({ logChanges: [nextLog] });

  assert.deepEqual(idb.puts, ["log:new-log", STATE_RECORD]);
  assert.equal(idb.logs.get("log:old-log").outcome, oldLog.outcome, "vorhandene Log-Datensätze werden beim Hinzufügen nicht ersetzt");
  assert.equal(idb.logs.get("log:new-log").outcome, nextLog.outcome);
  assert.deepEqual(idb.state.logs, []);
  assert.equal(localStorage.getItem(KEY), null, "erfolgreiche normale Speicherungen schreiben keine vollständige JSON-Kopie synchron");
});

test("ein fehlgeschlagener Log-Schreibvorgang bleibt als eine unvollständige IndexedDB-Änderung aus", async () => {
  const oldLog = { id: "old-log", outcome: "eaten" };
  const nextLog = { id: "new-log", outcome: "tried" };
  const localStorage = createLocalStorage();
  const idb = {
    state: { ...stateWithRevision("v1"), storageLayoutVersion: 2, logs: [] },
    logs: new Map([["log:old-log", oldLog]]),
    failNextWrite: true,
  };
  const runtime = createStorageRuntime({ localStorage, idb, initialState: { ...stateWithRevision("v2"), logs: [oldLog, nextLog] } });

  await runtime.save({ logChanges: [nextLog] });

  assert.equal(idb.state.revision, "v1", "der Zustandsdatensatz bleibt unverändert");
  assert.equal(idb.logs.has("log:new-log"), false, "der neue Log-Datensatz wird nicht halb gespeichert");
  assert.equal(JSON.parse(localStorage.getItem(KEY)).revision, "v2", "die Notfallkopie enthält den vollständigen neuen Stand");
  assert.equal(localStorage.getItem(RECOVERY_KEY), "1");
});

test("bestehender IndexedDB-Zustand wird einmalig in einzelne Log-Datensätze migriert", async () => {
  const oldLogs = [{ id: "z-legacy-log", outcome: "eaten" }, { id: "a-legacy-log", outcome: "tried" }];
  const idb = { state: { ...stateWithRevision("legacy"), logs: oldLogs } };
  const localStorage = createLocalStorage();
  const runtime = createStorageRuntime({ localStorage, idb, initialState: idb.state });

  await runtime.bootstrapStorage();

  assert.deepEqual(runtime.getState().logs, oldLogs, "Migration bewahrt die bisherige Log-Reihenfolge unabhängig von IDs");
  assert.equal(idb.state.storageLayoutVersion, 2);
  assert.deepEqual(idb.state.logs, []);
  assert.equal(idb.logs.get("log:z-legacy-log").outcome, oldLogs[0].outcome);
  assert.equal(idb.sequence, 2);
  assert.equal(JSON.parse(localStorage.getItem(KEY)).logs[0].id, "z-legacy-log", "Migration hinterlässt eine vollständige Notfallkopie");
});

test("Löschen entfernt genau den ausgewählten Log-Datensatz", async () => {
  const keep = { id: "keep-log", outcome: "eaten" };
  const remove = { id: "remove-log", outcome: "tried" };
  const idb = { state: { ...stateWithRevision("v1"), storageLayoutVersion: 2, logs: [] }, logs: new Map([["log:keep-log", keep], ["log:remove-log", remove]]) };
  const runtime = createStorageRuntime({ localStorage: createLocalStorage(), idb, initialState: { ...stateWithRevision("v1"), logs: [keep] } });

  await runtime.save({ removedLogIds: ["remove-log"] });

  assert.deepEqual([...idb.logs.keys()], ["log:keep-log"]);
  assert.deepEqual(idb.puts, ["log:remove-log", STATE_RECORD]);
});
