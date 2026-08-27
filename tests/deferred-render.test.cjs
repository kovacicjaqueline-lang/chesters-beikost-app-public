"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "deferred-render.js"), "utf8");

function createHarness({ withAnimationFrame = true } = {}) {
  const events = [];
  const raf = [];
  const timers = [];
  const sandbox = {
    console,
    renderAll: () => events.push("render"),
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
  const h = createHarness({ withAnimationFrame: false });
  h.sandbox.renderAllAfterNextPaint();
  assert.deepEqual(h.events, []);
  assert.equal(h.timers.length, 1, "Ohne requestAnimationFrame muss der Helper auf den nächsten Task ausweichen");
  h.timers.shift()();
  assert.deepEqual(h.events, ["render"]);
}

console.log("Deferred full-render scheduling regression passed.");
