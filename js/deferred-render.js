"use strict";

/* Sichtbare UI-Reaktion vor teuren Voll-Rendern
 * State-Mutation und Persistenz bleiben synchron im auslösenden Event-Pfad.
 * Nur renderAll() wird hinter die nächste Render-Gelegenheit verschoben.
 */

let deferredRenderAllPending = false;
let deferredRenderAllCallbacks = [];
let deferredRenderScopeDepth = 0;
let deferredRenderScopeBase = null;
let deferredRenderScopeRequested = false;
let deferredRenderScopeCallbacks = [];
const deferredRenderClickTargets = new WeakSet();
let startupLazyRenderActive = false;

function currentAppViewId() {
  if (typeof document === "undefined") return "home";
  return document.querySelector(".view.active")?.id || "home";
}

function renderCurrentAppView(id = currentAppViewId()) {
  if (id === "home") {
    if (typeof renderHome === "function") renderHome();
    return;
  }
  if (id === "plan") {
    if (typeof renderPlan === "function") renderPlan();
    return;
  }
  if (id === "prep") {
    if (typeof renderPrep === "function") renderPrep();
    return;
  }
  if (id === "foods") {
    if (typeof renderFoods === "function") renderFoods();
    return;
  }
  if (id === "more") {
    if (typeof renderLogs === "function") renderLogs();
    if (typeof renderStatistics === "function") renderStatistics();
    if (typeof renderAllergenModule === "function") renderAllergenModule();
    if (typeof renderSettings === "function") renderSettings();
    if (typeof renderAudit === "function" && document.getElementById("auditList")) renderAudit();
    if (typeof renderStorageStatus === "function") renderStorageStatus();
  }
}

function interceptFirstGlobalFunction(name, wrapFirst) {
  if (typeof globalThis === "undefined" || typeof wrapFirst !== "function") return false;
  let descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  if (descriptor && descriptor.configurable === false) return false;
  let current = descriptor && typeof descriptor.value === "function" ? wrapFirst(descriptor.value) : undefined;
  let intercepted = typeof current === "function";
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get() {
      return current;
    },
    set(value) {
      if (!intercepted && typeof value === "function") {
        intercepted = true;
        current = wrapFirst(value);
        return;
      }
      current = value;
    },
  });
  return true;
}

function installStartupLazyRendering() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  startupLazyRenderActive = true;

  interceptFirstGlobalFunction("renderAll", (baseRenderAll) =>
    function startupAwareRenderAll(...args) {
      if (startupLazyRenderActive) return renderCurrentAppView();
      return baseRenderAll.apply(this, args);
    });

  interceptFirstGlobalFunction("renderPlan", (baseRenderPlan) =>
    function startupAwareRenderPlan(...args) {
      if (startupLazyRenderActive && currentAppViewId() !== "plan") return;
      return baseRenderPlan.apply(this, args);
    });

  interceptFirstGlobalFunction("showView", (baseShowView) =>
    function lazyNavigationShowView(id, ...args) {
      let result = baseShowView.call(this, id, ...args);
      renderCurrentAppView(id);
      return result;
    });

  interceptFirstGlobalFunction("bootstrapStorage", (baseBootstrapStorage) =>
    async function startupAwareBootstrapStorage(...args) {
      try {
        return await baseBootstrapStorage.apply(this, args);
      } finally {
        let finish = () => { startupLazyRenderActive = false; };
        if (typeof setTimeout === "function") setTimeout(finish, 0);
        else finish();
      }
    });

  return true;
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

  document.addEventListener("click", (event) => {
    let button = event.target?.closest?.('[data-catalog-mode="recipes"]');
    if (!button) return;
    let renderRecipes = () => {
      if (document.getElementById("foods")?.classList.contains("active") && typeof renderPrep === "function") renderPrep();
    };
    if (typeof queueMicrotask === "function") queueMicrotask(renderRecipes);
    else Promise.resolve().then(renderRecipes);
  }, true);

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
  installStartupLazyRendering();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installSaveUiLatencyFlows, { once: true });
  else installSaveUiLatencyFlows();
}
