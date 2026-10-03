"use strict";

/* Speicher, Backup und Wiederherstellung
 * IndexedDB-Hauptspeicher, localStorage-Fallback, Zwischenstände, Prüfsummen, Importvorschau und Restore.
 * Technische Basis: V9.2R; fachliches Verhalten unverändert zu V9.2.
 */

let openDbPromise = null;
function openDb() {
  if (openDbPromise) return openDbPromise;
  openDbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB nicht verfügbar"));
    let request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      let db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      if (!db.objectStoreNames.contains(DB_LOGS_STORE)) db.createObjectStore(DB_LOGS_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => {
      let db = request.result;
      let discard = () => {
        if (openDbPromise) openDbPromise = null;
      };
      db.onversionchange = () => {
        db.close();
        discard();
      };
      db.onclose = discard;
      resolve(db);
    };
    request.onerror = () => {
      openDbPromise = null;
      reject(request.error || new Error("Datenbankfehler"));
    };
  });
  return openDbPromise;
}
async function idbGet(key) {
  let db = await openDb();
  return new Promise((resolve, reject) => {
    let tx = db.transaction(DB_STORE, "readonly");
    let req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key, value) {
  let db = await openDb();
  return new Promise((resolve, reject) => {
    let tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGetLogs() {
  let db = await openDb();
  return new Promise((resolve, reject) => {
    let tx = db.transaction(DB_LOGS_STORE, "readonly");
    let req = tx.objectStore(DB_LOGS_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbSaveStateAndLogs(snapshot, logChanges = null, allLogs = null) {
  let db = await openDb();
  return new Promise((resolve, reject) => {
    let tx = db.transaction([DB_STORE, DB_LOGS_STORE], "readwrite");
    tx.objectStore(DB_STORE).put(snapshot, STATE_RECORD);
    let logs = tx.objectStore(DB_LOGS_STORE);
    if (Array.isArray(allLogs)) {
      logs.clear();
      allLogs.forEach((entry) => logs.put(entry));
    } else {
      for (let id of logChanges?.deleteIds || []) logs.delete(id);
      for (let entry of logChanges?.upserts || []) logs.put(entry);
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB-Transaktion abgebrochen"));
  });
}
const LOCAL_LOG_PREFIX = `${KEY}-log-`;
function localLogKey(id) {
  return `${LOCAL_LOG_PREFIX}${encodeURIComponent(String(id))}`;
}
function localLogEntries() {
  let entries = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      let key = localStorage.key(index);
      if (!key?.startsWith(LOCAL_LOG_PREFIX)) continue;
      let entry = JSON.parse(localStorage.getItem(key));
      if (entry?.log && entry.log.id !== undefined && entry.log.id !== null) entries.push(entry);
    }
  } catch (_) {}
  return entries.sort((a, b) => a.order - b.order || a.log.id.localeCompare(b.log.id));
}
function localLogRecord(id) {
  try {
    let entry = JSON.parse(localStorage.getItem(localLogKey(id)) || "null");
    return String(entry?.log?.id) === String(id) ? entry : null;
  } catch (_) { return null; }
}
function localLogEntry(log, order) {
  return { id: log.id, order, log };
}
function writeLocalStateAndLogs(snapshot, logChanges = null, allLogs = null) {
  try {
    if (Array.isArray(allLogs)) {
      let retainedKeys = new Set(allLogs.map((entry) => localLogKey(entry.id)));
      allLogs.forEach((entry) => localStorage.setItem(localLogKey(entry.id), JSON.stringify(entry)));
      for (let index = localStorage.length - 1; index >= 0; index--) {
        let key = localStorage.key(index);
        if (key?.startsWith(LOCAL_LOG_PREFIX) && !retainedKeys.has(key)) localStorage.removeItem(key);
      }
    } else {
      for (let entry of logChanges?.upserts || []) localStorage.setItem(localLogKey(entry.id), JSON.stringify(entry));
      for (let id of logChanges?.deleteIds || []) localStorage.removeItem(localLogKey(id));
    }
    localStorage.setItem(KEY, JSON.stringify(snapshot));
    return true;
  } catch (_) { return false; }
}
function persistedStateSnapshot(source = state) {
  let sourceWithoutLogs = { ...source };
  delete sourceWithoutLogs.logs;
  let snapshot = clone(sourceWithoutLogs);
  snapshot.schemaVersion = SCHEMA_VERSION;
  snapshot.appVersion = APP_VERSION;
  return snapshot;
}
function orderLogs(entries = []) {
  return entries.slice().sort((a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id))).map((entry) => entry.log);
}
const BACKUP_FOOD_PERSONAL_FIELDS = [
  "priority",
  "active",
  "liked",
  "manualStatus",
  "notes",
  "reactionPauseSourceLogId",
  "reactionPausePreviousStatus",
];
const BACKUP_APP_FOCUS_MODES = new Set(["planning-documentation", "everyday-recipes"]);
const BACKUP_DEFAULT_APP_FOCUS_MODE = "planning-documentation";

function normalizeBackupSettings(settings = {}) {
  let normalized = isBackupObject(settings) ? clone(settings) : {};
  if (!BACKUP_APP_FOCUS_MODES.has(normalized.appFocusMode)) {
    normalized.appFocusMode = BACKUP_DEFAULT_APP_FOCUS_MODE;
  }
  return normalized;
}

function backupCanonicalFoods() {
  return typeof FOOD_DB !== "undefined" && Array.isArray(FOOD_DB) ? FOOD_DB : [];
}
function backupFoodPreferences(data = {}) {
  let canonical = new Map(backupCanonicalFoods().map((food) => [food.id, food]));
  return (data.foods || []).filter((food) => canonical.has(food.id)).map((food) => {
    let base = canonical.get(food.id);
    let changes = { id: food.id };
    for (let key of BACKUP_FOOD_PERSONAL_FIELDS) {
      if (Object.hasOwn(food, key) && JSON.stringify(food[key]) !== JSON.stringify(base[key])) changes[key] = clone(food[key]);
    }
    return changes;
  }).filter((food) => Object.keys(food).length > 1);
}
function backupCustomFoods(data = {}) {
  let canonicalIds = new Set(backupCanonicalFoods().map((food) => food.id));
  return (data.foods || []).filter((food) => !canonicalIds.has(food.id)).map(clone);
}
function backupPayloadToState(payload = {}) {
  let source = clone(payload || {});
  if (Array.isArray(source.foods)) {
    source.settings = normalizeBackupSettings(source.settings);
    return source;
  }
  let canonicalFoods = backupCanonicalFoods().map(clone);
  let preferences = Array.isArray(source.foodPreferences) ? source.foodPreferences : [];
  let preferenceById = new Map(preferences.filter((food) => food && food.id).map((food) => [food.id, food]));
  for (let food of canonicalFoods) {
    let changes = preferenceById.get(food.id);
    if (!changes) continue;
    for (let key of BACKUP_FOOD_PERSONAL_FIELDS) if (Object.hasOwn(changes, key)) food[key] = clone(changes[key]);
  }
  source.foods = canonicalFoods.concat(Array.isArray(source.customFoods) ? source.customFoods.map(clone) : []);
  source.settings = normalizeBackupSettings(source.settings);
  delete source.customFoods;
  delete source.foodPreferences;
  delete source.schemaVersion;
  delete source.appVersion;
  delete source.productAllergenSchemaVersion;
  return source;
}
function stateSummary(data = state) {
  let foods = Array.isArray(data.foods) ? data.foods : [];
  let canonicalIds = new Set(backupCanonicalFoods().map((food) => food.id));
  return {
    customFoods: Array.isArray(data.customFoods) ? data.customFoods.length : foods.filter((food) => !canonicalIds.has(food.id)).length,
    foodPreferences: Array.isArray(data.foodPreferences) ? data.foodPreferences.length : backupFoodPreferences(data).length,
    logs: (data.logs || []).length,
    inventoryBatches: (data.inventory || []).length,
    planLocks: Object.keys(data.planLocks || {}).length,
    manualMeals: Object.keys(data.manualMeals || {}).length,
    dayClosures: Object.keys(data.dayClosures || {}).length,
    settings: Object.keys(data.settings || {}).length,
    followUps: Object.keys(data.followUps || {}).length,
  };
}
function isBackupObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
function validateBackupPayloadShape(payload) {
  if (!isBackupObject(payload)) throw new Error("Die Backup-Nutzdaten sind ungültig.");
  for (let key of ["foods", "customFoods", "foodPreferences", "logs", "inventory", "products"]) {
    if (payload[key] !== undefined && !Array.isArray(payload[key])) throw new Error("Die Backup-Nutzdaten sind ungültig.");
  }
  for (let key of ["settings", "overrides", "deferred", "pantry", "planLocks", "autoLockExcluded", "manualMeals", "dayClosures", "inactivePlanKept", "combinationPauses", "followUps", "shoppingHints", "backupMeta"]) {
    if (payload[key] !== undefined && !isBackupObject(payload[key])) throw new Error("Die Backup-Nutzdaten sind ungültig.");
  }
  for (let food of [...(payload.foods || []), ...(payload.customFoods || [])]) {
    if (!isBackupObject(food) || (!food.id && !food.name)) throw new Error("Die Backup-Nutzdaten sind ungültig.");
  }
  for (let preference of payload.foodPreferences || []) {
    if (!isBackupObject(preference) || !preference.id) throw new Error("Die Backup-Nutzdaten sind ungültig.");
  }
  return true;
}
async function sha256Text(text) {
  if (!crypto?.subtle) return "unsupported";
  let bytes = new TextEncoder().encode(text);
  let digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const SNAPSHOT_FALLBACK_KEY = `${KEY}-snapshots-fallback`;
function readFallbackSnapshots() {
  try {
    let raw = localStorage.getItem(SNAPSHOT_FALLBACK_KEY);
    let parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}
function writeFallbackSnapshots(snapshots) {
  try { localStorage.setItem(SNAPSHOT_FALLBACK_KEY, JSON.stringify(snapshots.slice(-5))); } catch (_) {}
}
async function createSnapshot(reason = "automatisch") {
  let snapshots = await idbGet(SNAPSHOT_RECORD).catch(() => null);
  if (!Array.isArray(snapshots)) snapshots = readFallbackSnapshots();
  snapshots.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), reason, state: clone(state) });
  snapshots = snapshots.slice(-5);
  let persisted = await idbPut(SNAPSHOT_RECORD, snapshots).then(() => true).catch(() => false);
  if (!persisted) writeFallbackSnapshots(snapshots);
  return snapshots;
}
let saveQueue = Promise.resolve();
let storageStateRevision = 0;
let indexedDbUnavailable = false;
const IDB_RECOVERY_PENDING_KEY = `${KEY}-idb-recovery-pending`;
function pendingIdbRecoveryState() {
  try {
    if (localStorage.getItem(IDB_RECOVERY_PENDING_KEY) !== "1") return null;
    let raw = localStorage.getItem(KEY);
    if (!raw) return null;
    let recovered = migrateState(JSON.parse(raw));
    if (!Array.isArray(recovered.logs) || recovered.logs.length === 0) {
      let splitLogs = localLogEntries();
      if (splitLogs.length) recovered.logs = orderLogs(splitLogs);
    }
    return recovered;
  } catch (_) {
    return null;
  }
}
function save(options = {}) {
  storageStateRevision++;
  if (typeof invalidateFoodLookupCache === "function") invalidateFoodLookupCache();
  let snapshot = persistedStateSnapshot(state);
  let allLogs = null;
  let logChanges = null;
  if (options.replaceLogs) {
    allLogs = (state.logs || []).map((log, index) => localLogEntry(log, index));
  } else if (options.logMutation) {
    let upserts = (options.logMutation.upserts || []).map((log) => {
      let stored = localLogRecord(log.id);
      let createdAt = Date.parse(log.createdAt || "");
      let order = stored?.order ?? (Number.isFinite(createdAt) ? createdAt : Date.now());
      return localLogEntry(log, order);
    });
    logChanges = { upserts, deleteIds: options.logMutation.deleteIds || [] };
  }
  // The emergency mirror stores app data and log records separately, so adding a
  // log writes only that record instead of serializing the complete history.
  let localBackupWritten = writeLocalStateAndLogs(snapshot, logChanges, allLogs);
  if (indexedDbUnavailable || !globalThis.indexedDB) return Promise.resolve();
  saveQueue = saveQueue.then(async () => {
    if (options.snapshotReason) await createSnapshot(options.snapshotReason);
    if (Array.isArray(allLogs) || logChanges) await idbSaveStateAndLogs(snapshot, logChanges, allLogs);
    else await idbPut(STATE_RECORD, snapshot);
  }).catch((error) => {
    indexedDbUnavailable = true;
    if (localBackupWritten) {
      try { localStorage.setItem(IDB_RECOVERY_PENDING_KEY, "1"); } catch (_) {}
    }
    state.backupMeta.storagePersisted = "unavailable";
    if (!/denied|not available|nicht verfügbar|SecurityError/i.test(String(error))) {
      console.error("Speichern in IndexedDB fehlgeschlagen", error);
      showStorageError?.("Die lokale App-Datenbank ist nicht erreichbar. Die Notfallkopie im Browser bleibt aktiv.");
    }
  });
  return saveQueue;
}

function load() {
  try {
    for (let key of [KEY, ...LEGACY_KEYS]) {
      let raw = localStorage.getItem(key);
      if (!raw) continue;
      let loaded = migrateState(JSON.parse(raw));
      if (!Array.isArray(loaded.logs) || loaded.logs.length === 0) {
        let splitLogs = localLogEntries();
        if (splitLogs.length) loaded.logs = orderLogs(splitLogs);
      }
      return loaded;
    }
    return clone(DEFAULT);
  } catch (e) {
    return clone(DEFAULT);
  }
}

/* PLAN-FROM-TODAY START */
function isIsoCalendarDate(value) {
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return false;
  let year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  let daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}
function syncPlanFromToToday(data = state, currentDate = today()) {
  if (!data?.settings || !isIsoCalendarDate(currentDate)) return false;
  let planFrom = String(data.settings.planFrom || "");
  if (isIsoCalendarDate(planFrom) && planFrom >= currentDate) return false;
  data.settings.planFrom = currentDate;
  return true;
}
async function syncPlanFromOnAppOpen() {
  if (!syncPlanFromToToday()) return false;
  await save();
  renderCurrentView();
  return true;
}
function installPlanFromVisibilitySync(doc) {
  if (!doc?.addEventListener) return false;
  let lastVisibleDay = today();
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState !== "visible") return;
    let currentDay = today();
    let calendarDayChanged = currentDay !== lastVisibleDay;
    lastVisibleDay = currentDay;
    if (calendarDayChanged) {
      if (syncPlanFromToToday(state, currentDay)) void save();
      return;
    }
    void syncPlanFromOnAppOpen();
  });
  return true;
}
/* PLAN-FROM-TODAY END */

async function bootstrapStorage() {
  const revisionAtStart = storageStateRevision;
  let recoveryState = pendingIdbRecoveryState();
  let idbState = await idbGet(STATE_RECORD).catch(() => null);
  if (storageStateRevision === revisionAtStart) {
    if (idbState && !recoveryState) {
      if (Array.isArray(idbState.logs)) {
        state = migrateState(idbState);
        let entries = state.logs.map((log, index) => localLogEntry(log, index));
        let migrated = await idbSaveStateAndLogs(persistedStateSnapshot(state), null, entries).then(() => true).catch(() => false);
        if (!migrated) {
          indexedDbUnavailable = true;
          try { localStorage.setItem(IDB_RECOVERY_PENDING_KEY, "1"); } catch (_) {}
        }
        writeLocalStateAndLogs(persistedStateSnapshot(state), null, entries);
      } else {
        let entries = await idbGetLogs().catch(() => []);
        state = migrateState({ ...idbState, logs: orderLogs(entries) });
        writeLocalStateAndLogs(persistedStateSnapshot(state), null, entries);
      }
    } else {
      state = recoveryState || migrateState(state);
      state.backupMeta.migratedAt = new Date().toISOString();
      let entries = (state.logs || []).map((log, index) => localLogEntry(log, index));
      writeLocalStateAndLogs(persistedStateSnapshot(state), null, entries);
      let wroteState = await idbSaveStateAndLogs(persistedStateSnapshot(state), null, entries).then(() => true).catch(() => false);
      let check = wroteState ? await idbGet(STATE_RECORD).catch(() => null) : null;
      if (check) {
        if (recoveryState) {
          try { localStorage.removeItem(IDB_RECOVERY_PENDING_KEY); } catch (_) {}
        }
      } else {
        indexedDbUnavailable = true;
        try { localStorage.setItem(IDB_RECOVERY_PENDING_KEY, "1"); } catch (_) {}
      }
    }
  }
  if (navigator.storage?.persist) {
    try {
      let granted = await navigator.storage.persist();
      state.backupMeta.storagePersisted = granted ? "granted" : "denied";
    } catch (_) { state.backupMeta.storagePersisted = "unavailable"; }
  } else state.backupMeta.storagePersisted = "unavailable";
  syncPlanFromToToday();
  await save();
  globalThis.installRecipeV2ComponentRuntime?.();
  renderCurrentView();
}
function showStorageError(message) {
  let box=document.getElementById("storageError");
  if (box) { box.textContent=message; box.style.display="block"; }
}
function renderStorageStatus() {
  let box=document.getElementById("storageStatus"); if(!box) return;
  let persistent=state.backupMeta?.storagePersisted;
  let last=state.backupMeta?.lastExternalBackup;
  let databaseStatus = indexedDbUnavailable || !window.indexedDB ? "Notfallkopie aktiv" : "Bereit";
  let persistenceStatus = persistent === "granted" ? "gewährt" : persistent === "denied" ? "nicht gewährt" : persistent === "unknown" ? "noch nicht geprüft" : "nicht verfügbar";
  let migration = state.backupMeta?.legacyMilkMigration?.needsReview ? `<div class="storage-line legacy-migration-note"><span>Altbestand Milch/Joghurt</span><b>getrennt übernommen · bitte prüfen</b></div>` : "";
  box.innerHTML=`<div class="storage-line"><span>Lokaler Speicher</span><b>${databaseStatus}</b></div><div class="storage-line"><span>Dauerhaft speichern</span><b>${persistenceStatus}</b></div><div class="storage-line"><span>Letztes externes Backup</span><b>${last?new Date(last).toLocaleDateString("de-AT"):"noch keines"}</b></div>${migration}`;
  let reminder=document.getElementById("backupReminder");
  if(reminder){ let stale=!last || (Date.now()-new Date(last).getTime())>14*86400000; reminder.style.display=stale?"block":"none"; }
}
async function buildBackupPackage() {
  let payload = clone(state);
  payload.settings = normalizeBackupSettings(payload.settings);
  payload.customFoods = backupCustomFoods(state);
  payload.foodPreferences = backupFoodPreferences(state);
  delete payload.foods;
  delete payload.backupMeta;
  delete payload.schemaVersion;
  delete payload.appVersion;
  delete payload.productAllergenSchemaVersion;
  let payloadText = JSON.stringify(payload);
  return { type:"chester-beikost-backup", appVersion:APP_VERSION, schemaVersion:SCHEMA_VERSION, createdAt:new Date().toISOString(), summary:stateSummary(payload), checksum:await sha256Text(payloadText), payload };
}
async function exportBackup() {
  let pack=await buildBackupPackage();
  let blob=new Blob([JSON.stringify(pack,null,2)],{type:"application/json"}), a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=`chester-beikost-backup-${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500);
  state.backupMeta.lastExternalBackup=new Date().toISOString(); await save(); renderStorageStatus(); showToast("Externes Backup erstellt.");
}
async function validateBackup(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    throw new Error("Die Backup-Datei kann nicht gelesen werden. Bitte wähle eine gültige Beikost-Backup-Datei.");
  }
  if (parsed?.type === "chester-beikost-backup" && parsed.payload) {
    let checksum = await sha256Text(JSON.stringify(parsed.payload));
    if (parsed.checksum !== "unsupported" && checksum !== "unsupported" && checksum !== parsed.checksum) throw new Error("Die Backup-Datei scheint beschädigt oder verändert zu sein.");
    if (Number(parsed.schemaVersion) > SCHEMA_VERSION) throw new Error("Dieses Backup stammt aus einer neueren App-Version.");
    validateBackupPayloadShape(parsed.payload);
    parsed.summary = stateSummary(parsed.payload);
    return parsed;
  }
  let looksLegacy = parsed && typeof parsed === "object" && !Array.isArray(parsed) && (Array.isArray(parsed.foods) || Array.isArray(parsed.logs) || parsed.settings || parsed.inventory || parsed.overrides);
  if (!looksLegacy) throw new Error("Keine gültige Beikost-Backup-Datei.");
  let payload = parsed;
  validateBackupPayloadShape(payload);
  return {
    type: "chester-beikost-legacy-backup",
    appVersion: parsed.appVersion || "8.8 oder älter",
    schemaVersion: Number(parsed.schemaVersion) || 0,
    createdAt: parsed.createdAt || parsed.exportedAt || new Date().toISOString(),
    summary: stateSummary(migrateState(payload)),
    checksum: "legacy-ohne-pruefsumme",
    payload,
    legacy: true,
  };
}
function backupPreviewHtml(pack) {
  let s = pack.summary || stateSummary(pack.payload);
  let legacy = pack.legacy ? `<div class="notice olive"><b>Älteres Backup erkannt.</b> Beim Wiederherstellen werden die Daten an den aktuellen Stand angepasst. Der frühere gemeinsame Eintrag Kuhmilch/Joghurt wird vorsichtig getrennt und zur Kontrolle markiert.</div>` : "";
  return `${legacy}<div class="notice warn"><b>Persönliche Daten werden ersetzt.</b> Der integrierte Lebensmittel- und Rezeptkatalog der App bleibt erhalten. Davor wird automatisch ein lokaler Zwischenstand angelegt.</div><div class="backup-summary"><div><b>${s.customFoods||0}</b><span>Eigene Lebensmittel</span></div><div><b>${s.foodPreferences||0}</b><span>Lebensmittel-Einstellungen</span></div><div><b>${s.logs||0}</b><span>Protokolle</span></div><div><b>${s.inventoryBatches||0}</b><span>Vorratseinträge</span></div><div><b>${(s.planLocks||0)+(s.manualMeals||0)}</b><span>Plan-Daten</span></div><div><b>${s.settings||0}</b><span>Einstellungen</span></div></div><p class="small">Backup vom ${new Date(pack.createdAt).toLocaleString("de-AT")} · App ${esc(pack.appVersion||"unbekannt")}${pack.legacy ? " · älteres Backupformat" : ""}</p><div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelBackupRestore" type="button">Abbrechen</button><button class="btn danger" id="confirmBackupRestore" type="button">Backup wiederherstellen</button></div>`;
}
async function handleBackupImport(file) {
  let storageError = document.getElementById("storageError");
  if (storageError) { storageError.textContent = ""; storageError.style.display = "none"; }
  try {
    let pack=await validateBackup(await file.text());
    openGeneric("Backup prüfen",backupPreviewHtml(pack));
    document.getElementById("cancelBackupRestore").onclick=closeGeneric;
    document.getElementById("confirmBackupRestore").onclick=async()=>{ await createSnapshot("vor Wiederherstellung"); state=migrateState(backupPayloadToState(pack.payload)); await save({ replaceLogs: true }); closeGeneric(); renderCurrentView(); renderStorageStatus(); showToast("Backup wiederhergestellt."); };
  } catch(error) {
    showStorageError(error.message || "Datei konnte nicht importiert werden.");
    document.getElementById("storageError")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
async function openSnapshots() {
  let snapshots=await idbGet(SNAPSHOT_RECORD).catch(()=>null); if (!Array.isArray(snapshots)) snapshots=readFallbackSnapshots();
  openGeneric("Lokale Zwischenstände",snapshots.length?snapshots.slice().reverse().map((snap)=>`<button class="snapshot-row" data-snapshot="${snap.id}"><b>${new Date(snap.createdAt).toLocaleString("de-AT")}</b><span>${esc(snap.reason)}</span></button>`).join(""):'<div class="empty">Noch keine Zwischenstände vorhanden.</div>');
  document.querySelectorAll("[data-snapshot]").forEach((button)=>button.onclick=()=>{
    let snap=snapshots.find((x)=>x.id===button.dataset.snapshot);
    if(!snap)return;
    openGeneric("Zwischenstand wiederherstellen?", `<div class="notice warn"><b>Der aktuelle Stand wird ersetzt.</b><br>Davor wird automatisch ein neuer Zwischenstand angelegt.</div><p class="small">Ausgewählt: ${new Date(snap.createdAt).toLocaleString("de-AT")} · ${esc(snap.reason)}</p><div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelSnapshotRestore" type="button">Abbrechen</button><button class="btn danger" id="confirmSnapshotRestore" type="button">Wiederherstellen</button></div>`);
    document.getElementById("cancelSnapshotRestore").onclick=()=>{ closeGeneric(); openSnapshots(); };
    document.getElementById("confirmSnapshotRestore").onclick=async()=>{ await createSnapshot("vor Zwischenstand-Wiederherstellung"); state=migrateState(backupPayloadToState(snap.state)); await save({ replaceLogs: true }); closeGeneric(); renderCurrentView(); showToast("Zwischenstand wiederhergestellt."); };
  });
}

if (typeof document !== "undefined") installPlanFromVisibilitySync(document);
