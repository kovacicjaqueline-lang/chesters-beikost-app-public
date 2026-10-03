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
  const documentListeners = {};
  const sandbox = {
    console,
    Promise,
    document: {
      readyState: "loading",
      addEventListener(type, callback) { documentListeners[type] = callback; },
      querySelector: () => ({ id: "home" }),
      getElementById: () => null,
    },
    renderAll: () => events.push("render"),
    renderCurrentView: () => events.push("current"),
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
  };
  if (withAnimationFrame) sandbox.requestAnimationFrame = (callback) => { raf.push(callback); return raf.length; };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "js/deferred-render.js" });
  return { sandbox, events, raf, timers, documentListeners };
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
  const activeView = { id: "home" };
  h.sandbox.document = { querySelector: () => activeView };
  const callbacks = [];
  h.sandbox.runWithDeferredCurrentViewRender(() => {
    h.events.push("save");
    h.sandbox.renderAll();
  }, () => callbacks.push("after-current-view"));

  assert.deepEqual(h.events, ["save"], "Speichern darf die Navigation nicht durch einen synchronen Render blockieren");
  h.raf.shift()();
  assert.deepEqual(h.events, ["save"], "Der gezielte Render muss nach der Paint-Gelegenheit liegen");
  h.timers.shift()();
  assert.deepEqual(h.events, ["save", "current"]);
  assert.deepEqual(callbacks, ["after-current-view"]);
}

{
  const h = createHarness();
  const activeView = { id: "home" };
  h.sandbox.document = { querySelector: () => activeView };
  const callbacks = [];
  h.sandbox.runWithDeferredCurrentViewRender(() => {
    h.sandbox.renderAll();
  }, () => callbacks.push("stale-view-callback"));

  activeView.id = "foods";
  h.events.push("tab:foods");
  h.raf.shift()();
  h.timers.shift()();
  assert.deepEqual(h.events, ["tab:foods"], "Ein inzwischen geöffneter Haupttab darf keinen veralteten Save-Render erhalten");
  assert.deepEqual(callbacks, [], "Save-Nacharbeit darf nach einem Tabwechsel nicht in die neue Ansicht scrollen");
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

  assert.equal(h.raf.length, 1, "Schnelle Tabwechsel müssen in einer Render-Gelegenheit gebündelt werden");
  h.raf.shift()();
  assert.deepEqual(renderedViews, [], "Der Prep-Render darf den ersten Paint nicht im Animationsframe blockieren");
  assert.equal(h.timers.length, 1, "Der vollständige Prep-Render folgt nach der sichtbaren Ladeansicht");
  h.timers.shift()();
  assert.deepEqual(renderedViews, ["prep"]);
}

{
  const h = createHarness();
  const renderedViews = [];
  h.sandbox.renderViewAfterNextPaint("plan", (id) => renderedViews.push(id));

  h.raf.shift()();
  assert.deepEqual(renderedViews, [], "Andere Tabs behalten die sichtbare Paint-Gelegenheit vor der teuren Renderarbeit");
  assert.equal(h.timers.length, 1);
  h.timers.shift()();
  assert.deepEqual(renderedViews, ["plan"]);
}

{
  const h = createHarness();
  const renderedViews = [];
  h.sandbox.renderViewAfterNextPaint("prep", (id) => renderedViews.push(id));

  h.raf.shift()();
  assert.deepEqual(renderedViews, [], "Bei schneller Weiternavigation darf Prep den finalen Zieltab nicht vorziehen");
  assert.equal(h.timers.length, 1);
  h.sandbox.renderViewAfterNextPaint("foods", (id) => renderedViews.push(id));
  h.timers.shift()();
  assert.deepEqual(renderedViews, ["foods"], "Nur der zuletzt angeforderte Tab darf gerendert werden");
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
  const renderedViews = [];
  h.sandbox.renderViewAfterNextPaint("prep", (id) => renderedViews.push(id));
  h.raf.shift()();
  assert.equal(h.timers.length, 1, "Nach der ersten Paint-Gelegenheit wartet der Prep-Render auf den Task");
  h.sandbox.cancelDeferredViewRender();
  h.timers.shift()();
  assert.deepEqual(renderedViews, [], "Abbruch nach dem Frame muss auch den bereits geplanten Prep-Render verwerfen");
}

{
  const h = createHarness();
  const renderedViews = [];
  h.sandbox.renderView = (id) => renderedViews.push(id);
  h.sandbox.save = () => {};
  h.sandbox.installViewRenderCache();

  // First render establishes the cached signature. A real nav click marks the
  // following deferred render as navigation-only, so an unchanged view can be
  // skipped without losing the final tab selection.
  h.sandbox.renderView("prep");
  h.documentListeners.click({ target: { closest: () => true } });
  h.sandbox.renderViewAfterNextPaint("prep", (id) => h.sandbox.renderView(id));
  h.raf.shift()();
  h.timers.shift()(); // end the click-scoped navigation marker
  h.timers.shift()(); // execute the deferred Prep render
  assert.deepEqual(renderedViews, ["prep"], "Unverändertes Prep darf bei Tabnavigation aus dem View-Render-Cache kommen");

  // Saves invalidate the signature. The same deferred navigation must render
  // again after state changes instead of incorrectly reusing stale content.
  h.sandbox.save();
  h.documentListeners.click({ target: { closest: () => true } });
  h.sandbox.renderViewAfterNextPaint("prep", (id) => h.sandbox.renderView(id));
  h.raf.shift()();
  h.timers.shift()();
  h.timers.shift()();
  assert.deepEqual(renderedViews, ["prep", "prep"], "Ein Save muss den View-Cache vor dem nächsten Prep-Render invalidieren");
}

console.log("Deferred full-render scheduling regression passed.");
