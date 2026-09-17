"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "deferred-render.js"), "utf8");
const serviceWorkerSource = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");

assert.match(
  serviceWorkerSource,
  /"\.\/js\/deferred-render\.js\?v=10\.1\.26"/,
  "Die neue Deferred-Render-Runtime muss für den ersten Offline-Start precached sein",
);

function createHarness({ withAnimationFrame = true } = {}) {
  const events = [];
  const raf = [];
  const timers = [];
  const sandbox = {
    console,
    Promise,
    renderAll: () => events.push("render"),
    renderCurrentView: () => events.push("current"),
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
  };
  if (withAnimationFrame) sandbox.requestAnimationFrame = (callback) => { raf.push(callback); return raf.length; };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "js/deferred-render.js" });
  return { sandbox, events, raf, timers };
}

{
  const h = createHarness();
  const callbacks = [];
  h.sandbox.renderAllAfterNextPaint(() => callbacks.push("first"));
  h.sandbox.renderAllAfterNextPaint(() => callbacks.push("second"));

  assert.deepEqual(h.events, [], "Voll-Render darf im unmittelbaren Save-/Confirm-Task nicht laufen");
  assert.equal(h.raf.length, 1, "Mehrere Voll-Render-Anforderungen müssen koalesziert werden");

  h.raf.shift()();
  assert.deepEqual(h.events, [], "Voll-Render darf nicht noch vor der nächsten Paint-Gelegenheit laufen");
  assert.equal(h.timers.length, 1);

  h.timers.shift()();
  assert.deepEqual(h.events, ["render"], "Koaleszierte Anforderungen müssen genau einen Voll-Render auslösen");
  assert.deepEqual(callbacks, ["first", "second"], "After-Render-Callbacks müssen nach dem gemeinsamen Voll-Render laufen");
}

{
  const h = createHarness();
  const callbacks = [];
  h.sandbox.runWithDeferredFullRender(() => {
    h.events.push("action");
    h.sandbox.renderAll();
    h.sandbox.runWithDeferredFullRender(() => h.sandbox.renderAll());
    h.events.push("visible-ui");
  }, () => callbacks.push("after-render"));

  assert.deepEqual(h.events, ["action", "visible-ui"], "Der Save-/Confirm-Task muss ohne synchronen Voll-Render fertig werden");
  assert.equal(h.raf.length, 1, "Auch verschachtelte Render-Anforderungen müssen einen gemeinsamen Voll-Render planen");
  h.raf.shift()();
  h.timers.shift()();
  assert.deepEqual(h.events, ["action", "visible-ui", "render"]);
  assert.deepEqual(callbacks, ["after-render"]);
}

{
  const h = createHarness();
  const callbacks = [];
  h.sandbox.runWithDeferredCurrentViewRender(() => {
    h.events.push("save");
    h.sandbox.renderAll();
    h.events.push("toast-ready");
  }, () => callbacks.push("after-current-view"));

  assert.deepEqual(h.events, ["save", "toast-ready"], "Protokoll-Speichern darf keinen synchronen Render auslösen");
  assert.equal(h.raf.length, 1, "Der gezielte View-Render muss bis nach der nächsten Paint-Gelegenheit warten");
  h.raf.shift()();
  h.timers.shift()();
  assert.deepEqual(h.events, ["save", "toast-ready", "current"], "Ein angeforderter Voll-Render muss beim Protokoll auf die aktuelle Ansicht begrenzt werden");
  assert.deepEqual(callbacks, ["after-current-view"]);
}

{
  const h = createHarness({ withAnimationFrame: false });
  h.sandbox.renderAllAfterNextPaint();
  assert.deepEqual(h.events, []);
  assert.equal(h.timers.length, 1, "Ohne requestAnimationFrame muss der Helper auf den nächsten Task ausweichen");
  h.timers.shift()();
  assert.deepEqual(h.events, ["render"]);
}

{
  const h = createHarness();
  const renderedViews = [];
  h.sandbox.renderViewAfterNextPaint("plan", (id) => renderedViews.push(id));
  h.sandbox.renderViewAfterNextPaint("prep", (id) => renderedViews.push(id));

  assert.equal(h.raf.length, 1, "Schnelle Tabwechsel müssen in einer Paint-Gelegenheit gebündelt werden");
  h.raf.shift()();
  h.timers.shift()();
  assert.deepEqual(renderedViews, ["prep"], "Nur der zuletzt angeforderte Tab darf gerendert werden");
}

{
  const h = createHarness();
  const renderedViews = [];
  h.sandbox.renderViewAfterNextPaint("plan", (id) => renderedViews.push(id));
  h.sandbox.cancelDeferredViewRender();
  h.raf.shift()();
  h.timers.shift()();
  assert.deepEqual(renderedViews, [], "Ein synchron übernommener Render muss den geplanten View-Render verwerfen");
}

{
  const h = createHarness();
  let undo = null;
  const toasts = [];
  h.sandbox.document = {
    getElementById: () => null,
    querySelector: () => null,
  };
  h.sandbox.state = { logs: [] };
  h.sandbox.pendingLog = {};
  h.sandbox.showToast = (message, undoFn = null) => {
    toasts.push(message);
    if (typeof undoFn === "function") undo = undoFn;
  };
  h.sandbox.saveLog = () => {
    h.sandbox.state.logs.push({ id: "log-1" });
    h.sandbox.renderAll();
    h.sandbox.showToast("Eintrag gespeichert.", () => {
      h.sandbox.state.logs = [];
      h.sandbox.renderAll();
      h.sandbox.showToast("Eintrag rückgängig gemacht.");
    });
  };

  h.sandbox.installSaveUiLatencyFlows();
  h.sandbox.saveLog();

  assert.equal(h.sandbox.state.logs.length, 1, "State und Persistenzpfad müssen vor dem Render abgeschlossen sein");
  assert.deepEqual(h.events, [], "Der Log-Save-Wrapper darf den bisherigen renderAll-Aufruf nicht direkt ausführen");
  assert.deepEqual(toasts, ["Eintrag gespeichert."], "Der sichtbare Speicherhinweis muss ohne Render-Wartezeit erscheinen");
  assert.equal(typeof undo, "function", "Rückgängig muss erhalten bleiben");
  h.raf.shift()();
  h.timers.shift()();
  assert.deepEqual(h.events, ["current"], "Nach dem Speichern darf nur die aktuell sichtbare Ansicht neu gerendert werden");

  undo();
  assert.equal(h.sandbox.state.logs.length, 0, "Rückgängig muss den gespeicherten Zustand weiterhin wiederherstellen");
  assert.deepEqual(h.events, ["current"], "Auch Rückgängig darf keinen synchronen Voll-Render auslösen");
  assert.deepEqual(toasts, ["Eintrag gespeichert.", "Eintrag rückgängig gemacht."]);
  h.raf.shift()();
  h.timers.shift()();
  assert.deepEqual(h.events, ["current", "current"], "Rückgängig muss ebenfalls nur die aktuell sichtbare Ansicht aktualisieren");
}

console.log("Deferred full-render scheduling regression passed.");
