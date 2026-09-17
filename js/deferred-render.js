"use strict";

/* Sichtbare UI-Reaktion vor teuren Voll- und View-Rendern
 * State-Mutation und Persistenz bleiben synchron im auslösenden Event-Pfad.
 * Teure Renderarbeit wird hinter die nächste Render-Gelegenheit verschoben.
 */

let deferredRenderAllPending = false;
let deferredRenderAllCallbacks = [];
let deferredRenderScopeDepth = 0;
let deferredRenderScopeBase = null;
let deferredRenderScopeRequested = false;
let deferredRenderScopeCallbacks = [];
let deferredViewRenderPending = false;
let deferredViewRenderId = "";
let deferredViewRenderCallback = null;
const deferredRenderClickTargets = new WeakSet();
const tabNavigationClickTargets = new WeakSet();
let tabNavigationRenderActive = false;
let viewRenderRevision = 0;
let viewRenderCacheInstalled = false;
const renderedViewSignatures = new Map();
const cachedViewIds = ["home", "plan", "prep", "foods", "more"];

function currentViewRenderSignature(viewId) {
  let id = String(viewId || "home");
  let transient = [];
  if (id === "foods") {
    transient.push(
      typeof foodFilter === "undefined" ? "" : String(foodFilter),
      typeof foodReorderMode === "undefined" ? "" : String(foodReorderMode),
      document.getElementById("foodSearch")?.value || "",
    );
  } else if (id === "more") {
    transient.push(
      typeof statisticsRange === "undefined" ? "" : String(statisticsRange),
      typeof recipeQuery === "undefined" ? "" : String(recipeQuery),
      typeof recipeFilter === "undefined" ? "" : String(recipeFilter),
      typeof logFoodQuery === "undefined" ? "" : String(logFoodQuery),
    );
  }
  return `${viewRenderRevision}|${transient.join("|")}`;
}

function invalidateViewRenderCache() {
  viewRenderRevision += 1;
}

function queueTabNavigationRenderEnd() {
  let finish = () => { tabNavigationRenderActive = false; };
  if (typeof queueMicrotask === "function") queueMicrotask(finish);
  else Promise.resolve().then(finish);
}

function installTabNavigationRenderMarker(button) {
  if (!button || tabNavigationClickTargets.has(button)) return;
  tabNavigationClickTargets.add(button);
  button.addEventListener("click", () => {
    tabNavigationRenderActive = true;
    queueTabNavigationRenderEnd();
  }, true);
}

function installViewRenderCache() {
  if (viewRenderCacheInstalled || typeof renderView !== "function") return;

  let baseRenderView = renderView;
  renderView = function renderViewWithCache(viewId, ...args) {
    let id = String(viewId || "home");
    let signature = currentViewRenderSignature(id);
    if (tabNavigationRenderActive && renderedViewSignatures.get(id) === signature) return;
    let result = baseRenderView.call(this, viewId, ...args);
    renderedViewSignatures.set(id, currentViewRenderSignature(id));
    return result;
  };

  if (typeof save === "function") {
    let baseSave = save;
    save = function saveWithViewRenderInvalidation(...args) {
      invalidateViewRenderCache();
      return baseSave.apply(this, args);
    };
  }

  if (typeof renderAll === "function") {
    let baseRenderAll = renderAll;
    renderAll = function renderAllWithViewRenderInvalidation(...args) {
      invalidateViewRenderCache();
      let result = baseRenderAll.apply(this, args);
      cachedViewIds.forEach((id) => renderedViewSignatures.set(id, currentViewRenderSignature(id)));
      return result;
    };
  }

  document
    .querySelectorAll("nav button[data-view]")
    .forEach(installTabNavigationRenderMarker);

  viewRenderCacheInstalled = true;
}

function afterNextPaint(callback) {
  if (typeof callback !== "function") return;
  let afterPaint = () => {
    if (typeof setTimeout === "function") setTimeout(callback, 0);
    else callback();
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(afterPaint);
  else afterPaint();
}

function renderAllAfterNextPaint(afterRender = null) {
  if (typeof afterRender === "function") deferredRenderAllCallbacks.push(afterRender);
  if (deferredRenderAllPending) return;
  deferredRenderAllPending = true;
  afterNextPaint(() => {
    deferredRenderAllPending = false;
    let callbacks = deferredRenderAllCallbacks;
    deferredRenderAllCallbacks = [];
    if (typeof renderAll === "function") renderAll();
    callbacks.forEach((callback) => callback());
  });
}

function renderViewAfterNextPaint(viewId, callback) {
  if (typeof callback !== "function") return;
  deferredViewRenderId = String(viewId || "");
  deferredViewRenderCallback = callback;
  if (deferredViewRenderPending) return;
  deferredViewRenderPending = true;
  afterNextPaint(() => {
    deferredViewRenderPending = false;
    let id = deferredViewRenderId;
    let render = deferredViewRenderCallback;
    deferredViewRenderId = "";
    deferredViewRenderCallback = null;
    if (typeof render !== "function") return;
    tabNavigationRenderActive = true;
    try {
      render(id);
    } finally {
      tabNavigationRenderActive = false;
    }
  });
}

function cancelDeferredViewRender() {
  deferredViewRenderId = "";
  deferredViewRenderCallback = null;
}

function beginDeferredFullRender() {
  if (typeof renderAll !== "function") return false;
  deferredRenderScopeDepth++;
  if (deferredRenderScopeDepth > 1) return true;
  deferredRenderScopeBase = renderAll;
  deferredRenderScopeRequested = false;
  deferredRenderScopeCallbacks = [];
  renderAll = function requestDeferredFullRender() {
    deferredRenderScopeRequested = true;
  };
  return true;
}

function endDeferredFullRender(afterRender = null) {
  if (!deferredRenderScopeDepth) return;
  if (typeof afterRender === "function") deferredRenderScopeCallbacks.push(afterRender);
  deferredRenderScopeDepth--;
  if (deferredRenderScopeDepth) return;

  let base = deferredRenderScopeBase;
  let requested = deferredRenderScopeRequested;
  let callbacks = deferredRenderScopeCallbacks;
  deferredRenderScopeBase = null;
  deferredRenderScopeRequested = false;
  deferredRenderScopeCallbacks = [];
  if (typeof base === "function") renderAll = base;

  if (requested) renderAllAfterNextPaint(() => callbacks.forEach((callback) => callback()));
  else callbacks.forEach((callback) => callback());
}

function runWithDeferredFullRender(callback, afterRender = null) {
  if (typeof callback !== "function") return;
  if (!beginDeferredFullRender()) return callback();
  try {
    return callback();
  } finally {
    endDeferredFullRender(afterRender);
  }
}

function queueDeferredFullRenderEnd() {
  let finish = () => endDeferredFullRender();
  if (typeof queueMicrotask === "function") queueMicrotask(finish);
  else Promise.resolve().then(finish);
}

function deferFullRenderForClick(button) {
  if (!button || deferredRenderClickTargets.has(button)) return;
  deferredRenderClickTargets.add(button);
  button.addEventListener("click", () => {
    if (beginDeferredFullRender()) queueDeferredFullRenderEnd();
  }, true);
}

function installSaveUiLatencyFlows() {
  if (typeof document === "undefined") return;

  installViewRenderCache();

  let genericBody = document.getElementById("genericBody");
  if (genericBody) {
    let genericIds = new Set([
      "saveConcreteProduct",
      "deleteConcreteProduct",
      "saveInv",
      "saveCustom",
      "useExistingCustom",
    ]);
    genericBody.addEventListener("click", (event) => {
      let button = event.target?.closest?.("button");
      if (!button || !genericIds.has(button.id)) return;
      if (beginDeferredFullRender()) queueDeferredFullRenderEnd();
    }, true);
  }

  deferFullRenderForClick(document.getElementById("saveSettings"));

  if (typeof setTextureStage === "function") {
    let baseSetTextureStage = setTextureStage;
    setTextureStage = function setTextureStageWithoutBlockingFullRender(...args) {
      return runWithDeferredFullRender(() => baseSetTextureStage.apply(this, args));
    };
  }

  if (typeof saveLog === "function") {
    let baseSaveLog = saveLog;
    saveLog = function saveLogWithoutBlockingFullRender(...args) {
      let editId = pendingLog?.editId || "";
      let beforeRef = editId ? state.logs.find((log) => log.id === editId) : null;
      let beforeIds = editId ? null : new Set(state.logs.map((log) => log.id));
      let result;
      let savedLog = null;
      if (!beginDeferredFullRender()) return baseSaveLog.apply(this, args);
      try {
        result = baseSaveLog.apply(this, args);
        savedLog = editId
          ? state.logs.find((log) => log.id === editId)
          : state.logs.find((log) => !beforeIds.has(log.id));
        if (editId && savedLog === beforeRef) savedLog = null;
        return result;
      } finally {
        let savedId = savedLog?.id || "";
        endDeferredFullRender(savedId ? () => {
          let details = document.getElementById("logDetails");
          if (details) details.open = true;
          let entry = document.querySelector(`[data-log="${savedId}"]`);
          (entry || document.getElementById("logSection"))?.scrollIntoView({ behavior: "smooth", block: "start" });
        } : null);
      }
    };
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installSaveUiLatencyFlows, { once: true });
  else installSaveUiLatencyFlows();
}
