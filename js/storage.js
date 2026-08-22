"use strict";

/* Speicher, Backup und Wiederherstellung
 * IndexedDB-Hauptspeicher, localStorage-Fallback, Zwischenstände, Prüfsummen, Importvorschau und Restore.
 * Technische Basis: V9.2R; fachliches Verhalten unverändert zu V9.2.
 */

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB nicht verfügbar"));
    let request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      let db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Datenbankfehler"));
  });
}
async function idbGet(key) {
  let db = await openDb();
  return new Promise((resolve, reject) => {
    let tx = db.transaction(DB_STORE, "readonly");
    let req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
async function idbPut(key, value) {
  let db = await openDb();
  return new Promise((resolve, reject) => {
    let tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
function stateSummary(data = state) {
  return {
    foods: (data.foods || []).length,
    logs: (data.logs || []).length,
    inventoryBatches: (data.inventory || []).length,
    planLocks: Object.keys(data.planLocks || {}).length,
    manualMeals: Object.keys(data.manualMeals || {}).length,
    settings: Object.keys(data.settings || {}).length,
  };
}
async function sha256Text(text) {
  if (!crypto?.subtle) return "unsupported";
  let bytes = new TextEncoder().encode(text);
  let digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function createSnapshot(reason = "automatisch") {
  let snapshots = (await idbGet(SNAPSHOT_RECORD).catch(() => [])) || [];
  snapshots.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), reason, state: clone(state) });
  snapshots = snapshots.slice(-5);
  await idbPut(SNAPSHOT_RECORD, snapshots).catch(() => {});
  return snapshots;
}
let saveQueue = Promise.resolve();
let indexedDbUnavailable = false;
const IDB_RECOVERY_PENDING_KEY = `${KEY}-idb-recovery-pending`;
function pendingIdbRecoveryState() {
  try {
    if (localStorage.getItem(IDB_RECOVERY_PENDING_KEY) !== "1") return null;
    let raw = localStorage.getItem(KEY);
    return raw ? migrateState(JSON.parse(raw)) : null;
  } catch (_) {
    return null;
  }
}
function save(options = {}) {
  let snapshot = clone(state);
  snapshot.schemaVersion = SCHEMA_VERSION;
  snapshot.appVersion = APP_VERSION;
  // Mirror for migration and emergency recovery; IndexedDB remains the primary store when available.
  let localBackupWritten = false;
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
    localBackupWritten = true;
  } catch (_) {}
  if (indexedDbUnavailable || !globalThis.indexedDB) return Promise.resolve();
  saveQueue = saveQueue.then(async () => {
    if (options.snapshotReason) await createSnapshot(options.snapshotReason);
    await idbPut(STATE_RECORD, snapshot);
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
      return migrateState(JSON.parse(raw));
    }
    return clone(DEFAULT);
  } catch (e) {
    return clone(DEFAULT);
  }
}
async function bootstrapStorage() {
  let recoveryState = pendingIdbRecoveryState();
  let idbState = await idbGet(STATE_RECORD).catch(() => null);
  if (idbState && !recoveryState) {
    state = migrateState(idbState);
  } else {
    state = recoveryState || migrateState(state);
    state.backupMeta.migratedAt = new Date().toISOString();
    let wroteState = await idbPut(STATE_RECORD, clone(state)).then(() => true).catch(() => false);
    // Keep the old localStorage record until the database can be read back successfully.
    let check = wroteState ? await idbGet(STATE_RECORD).catch(() => null) : null;
    if (check) {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        if (recoveryState) localStorage.removeItem(IDB_RECOVERY_PENDING_KEY);
      } catch (_) {}
    }
  }
  if (navigator.storage?.persist) {
    try {
      let granted = await navigator.storage.persist();
      state.backupMeta.storagePersisted = granted ? "granted" : "denied";
    } catch (_) { state.backupMeta.storagePersisted = "unavailable"; }
  } else state.backupMeta.storagePersisted = "unavailable";
  if (!state.settings.planFrom) state.settings.planFrom = today();
  await save();
  renderAll();
  renderStorageStatus();
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
  let payload=clone(state); payload.schemaVersion=SCHEMA_VERSION; payload.appVersion=APP_VERSION;
  let payloadText=JSON.stringify(payload);
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
    return parsed;
  }
  let looksLegacy = parsed && typeof parsed === "object" && !Array.isArray(parsed) && (Array.isArray(parsed.foods) || Array.isArray(parsed.logs) || parsed.settings || parsed.inventory || parsed.overrides);
  if (!looksLegacy) throw new Error("Keine gültige Beikost-Backup-Datei.");
  let payload = parsed;
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
  return `${legacy}<div class="notice warn"><b>Vorhandene Daten werden ersetzt.</b> Davor wird automatisch ein lokaler Zwischenstand angelegt.</div><div class="backup-summary"><div><b>${s.foods||0}</b><span>Lebensmittel</span></div><div><b>${s.logs||0}</b><span>Protokolle</span></div><div><b>${s.inventoryBatches||0}</b><span>Vorratseinträge</span></div><div><b>${(s.planLocks||0)+(s.manualMeals||0)}</b><span>Plan-Daten</span></div><div><b>${s.settings||0}</b><span>Einstellungen</span></div></div><p class="small">Backup vom ${new Date(pack.createdAt).toLocaleString("de-AT")} · App ${esc(pack.appVersion||"unbekannt")}${pack.legacy ? " · älteres Backupformat" : ""}</p><div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelBackupRestore" type="button">Abbrechen</button><button class="btn danger" id="confirmBackupRestore">Backup wiederherstellen</button></div>`;
}
async function handleBackupImport(file) {
  let storageError = document.getElementById("storageError");
  if (storageError) { storageError.textContent = ""; storageError.style.display = "none"; }
  try {
    let pack=await validateBackup(await file.text());
    openGeneric("Backup prüfen",backupPreviewHtml(pack));
    document.getElementById("cancelBackupRestore").onclick=closeGeneric;
    document.getElementById("confirmBackupRestore").onclick=async()=>{ await createSnapshot("vor Wiederherstellung"); state=migrateState(pack.payload); await save(); closeGeneric(); renderAll(); renderStorageStatus(); showToast("Backup wiederhergestellt."); };
  } catch(error) {
    showStorageError(error.message || "Datei konnte nicht importiert werden.");
    document.getElementById("storageError")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
async function openSnapshots() {
  let snapshots=(await idbGet(SNAPSHOT_RECORD).catch(()=>[]))||[];
  openGeneric("Lokale Zwischenstände",snapshots.length?snapshots.slice().reverse().map((snap)=>`<button class="snapshot-row" data-snapshot="${snap.id}"><b>${new Date(snap.createdAt).toLocaleString("de-AT")}</b><span>${esc(snap.reason)}</span></button>`).join(""):'<div class="empty">Noch keine Zwischenstände vorhanden.</div>');
  document.querySelectorAll("[data-snapshot]").forEach((button)=>button.onclick=()=>{
    let snap=snapshots.find((x)=>x.id===button.dataset.snapshot);
    if(!snap)return;
    openGeneric("Zwischenstand wiederherstellen?", `<div class="notice warn"><b>Der aktuelle Stand wird ersetzt.</b><br>Davor wird automatisch ein neuer Zwischenstand angelegt.</div><p class="small">Ausgewählt: ${new Date(snap.createdAt).toLocaleString("de-AT")} · ${esc(snap.reason)}</p><div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelSnapshotRestore" type="button">Abbrechen</button><button class="btn danger" id="confirmSnapshotRestore" type="button">Wiederherstellen</button></div>`);
    document.getElementById("cancelSnapshotRestore").onclick=()=>{ closeGeneric(); openSnapshots(); };
    document.getElementById("confirmSnapshotRestore").onclick=async()=>{ await createSnapshot("vor Zwischenstand-Wiederherstellung"); state=migrateState(snap.state); await save(); closeGeneric(); renderAll(); showToast("Zwischenstand wiederhergestellt."); };
  });
}
