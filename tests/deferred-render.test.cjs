"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "deferred-render.js"), "utf8");

function createHarness() {
  const events = [];
  const raf = [];
  const timers = [];
  const microtasks = [];
  let clickCapture = null;
  const originalRenderAll = () => events.push("render");
  const sandbox = {
    console,
    Promise,
    renderAll: originalRenderAll,
    requestAnimationFrame: (callback) => { raf.push(callback); return raf.length; },
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
    queueMicrotask: (callback) => microtasks.push(callback),
    document: {
      addEventListener(type, callback, capture) {
        if (type === "click" && capture === true) clickCapture = callback;
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "js/deferred-render.js" });
  assert.equal(typeof clickCapture, "function", "Capture-Hook für Save-/Confirm-Aktionen muss installiert sein");
  return { sandbox, events, raf, timers, microtasks, clickCapture, originalRenderAll };
}

function actionEvent(id) {
  return {
    target: {
      closest(selector) {
        assert.equal(selector, "button");
        return { id };
      },
    },
  };
}

{
  const h = createHarness();
  h.clickCapture(actionEvent("saveSettings"));
  h.sandbox.renderAll();
  h.sandbox.renderAll();

  assert.deepEqual(h.events, [], "Voll-Render darf im unmittelbaren Save-Task nicht laufen");
  assert.equal(h.raf.length, 1, "Mehrere renderAll()-Anforderungen müssen koalesziert werden");
  assert.equal(h.microtasks.length, 1, "renderAll muss nach dem Benutzer-Event wiederhergestellt werden");

  h.microtasks.shift()();
  assert.equal(h.sandbox.renderAll, h.originalRenderAll, "Original-renderAll muss nach dem Event wieder aktiv sein");

  h.raf.shift()();
  assert.deepEqual(h.events, [], "Der Voll-Render darf nicht noch vor der nächsten Paint-Gelegenheit laufen");
  assert.equal(h.timers.length, 1);
  h.timers.shift()();
  assert.deepEqual(h.events, ["render"], "Koaleszierte Anforderungen müssen genau einen Voll-Render auslösen");
}

{
  const h = createHarness();
  h.clickCapture(actionEvent("notASaveAction"));
  h.sandbox.renderAll();
  assert.deepEqual(h.events, ["render"], "Nicht beauftragte Aktionen dürfen nicht global verzögert werden");
  assert.equal(h.raf.length, 0);
  assert.equal(h.microtasks.length, 0);
}

{
  const h = createHarness();
  const callbacks = [];
  h.sandbox.renderAllAfterNextPaint(() => callbacks.push("first"));
  h.sandbox.renderAllAfterNextPaint(() => callbacks.push("second"));
  assert.equal(h.raf.length, 1);
  h.raf.shift()();
  h.timers.shift()();
  assert.deepEqual(h.events, ["render"]);
  assert.deepEqual(callbacks, ["first", "second"], "After-Render-Callbacks müssen nach dem gemeinsamen Voll-Render laufen");
}

console.log("Deferred full-render scheduling regression passed.");
