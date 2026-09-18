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
  const microtasks = [];
  const sandbox = {
    console,
    Promise,
    renderAll: () => events.push("render"),
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
    queueMicrotask: (callback) => { microtasks.push(callback); },
  };
  if (withAnimationFrame) sandbox.requestAnimationFrame = (callback) => { raf.push(callback); return raf.length; };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "js/deferred-render.js" });
  return { sandbox, events, raf, timers, microtasks };
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
  let genericClick = null;
  const genericBody = {
    addEventListener: (type, callback) => {
      if (type === "click") genericClick = callback;
    },
  };
  h.sandbox.document = {
    getElementById: (id) => id === "genericBody" ? genericBody : null,
    querySelectorAll: () => [],
  };
  h.sandbox.installSaveUiLatencyFlows();
  assert.equal(typeof genericClick, "function", "Die generische Save-Latenzbehandlung muss installiert werden");

  genericClick({ target: { closest: () => ({ id: "keepOpenPlans" }) } });
  h.sandbox.renderAll();

  assert.deepEqual(h.events, [], "Nicht verschieben darf den Voll-Render nicht im Tap-Task ausführen");
  assert.equal(h.microtasks.length, 1, "Der Deferred-Scope muss nach dem Event beendet werden");
  h.microtasks.shift()();
  assert.equal(h.raf.length, 1, "Der Voll-Render muss bis nach der nächsten Paint-Gelegenheit warten");
  h.raf.shift()();
  assert.equal(h.timers.length, 1);
  h.timers.shift()();
  assert.deepEqual(h.events, ["render"], "Der bestehende Voll-Render muss anschließend weiterhin genau einmal laufen");
}

console.log("Deferred full-render scheduling regression passed.");
