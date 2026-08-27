"use strict";

/* Sichtbare UI-Reaktion vor teuren Voll-Rendern
 * State-Mutation und Persistenz bleiben synchron im auslösenden Event-Pfad.
 * Nur renderAll() wird hinter die nächste Render-Gelegenheit verschoben.
 */

let deferredRenderAllPending = false;
let deferredRenderAllCallbacks = [];
let immediateRenderDeferralDepth = 0;
let immediateRenderAll = null;

const DEFERRED_FULL_RENDER_ACTION_IDS = new Set([
  "saveLog",
  "saveConcreteProduct",
  "deleteConcreteProduct",
  "foodToggleActive",
  "deactivateReplace",
  "deactivateKeep",
  "saveInv",
  "saveSettings",
  "confirmTextureStage",
  "textureBack",
  "saveCustom",
  "useExistingCustom",
]);

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

function beginImmediateRenderDeferral() {
  if (typeof renderAll !== "function") return false;
  immediateRenderDeferralDepth++;
  if (immediateRenderDeferralDepth > 1) return true;
  immediateRenderAll = renderAll;
  renderAll = function deferImmediateRenderAll() {
    renderAllAfterNextPaint();
  };
  return true;
}

function endImmediateRenderDeferral() {
  if (!immediateRenderDeferralDepth) return;
  immediateRenderDeferralDepth--;
  if (immediateRenderDeferralDepth) return;
  if (typeof immediateRenderAll === "function") renderAll = immediateRenderAll;
  immediateRenderAll = null;
}

function queueRenderDeferralEnd() {
  let finish = () => endImmediateRenderDeferral();
  if (typeof queueMicrotask === "function") queueMicrotask(finish);
  else Promise.resolve().then(finish);
}

function installDeferredFullRenderActions() {
  if (typeof document === "undefined") return;
  document.addEventListener("click", (event) => {
    let action = event.target?.closest?.("button");
    if (!action || !DEFERRED_FULL_RENDER_ACTION_IDS.has(action.id)) return;
    if (!beginImmediateRenderDeferral()) return;
    queueRenderDeferralEnd();
  }, true);
}

installDeferredFullRenderActions();
