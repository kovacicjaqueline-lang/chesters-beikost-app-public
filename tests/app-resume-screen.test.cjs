"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "app-resume-screen.js"), "utf8");

function createHarness({ standalone = false } = {}) {
  const listeners = new Map();
  const frames = [];
  const classes = new Set(standalone ? ["app-standalone"] : []);
  const attributes = new Map();
  const documentElement = {
    classList: {
      contains: (name) => classes.has(name),
      add: (name) => classes.add(name),
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
    },
  };
  const screen = { setAttribute: (name, value) => attributes.set(name, value) };
  const document = {
    documentElement,
    visibilityState: "visible",
    getElementById: (id) => id === "appResumeScreen" ? screen : null,
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
  };
  const window = {
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    requestAnimationFrame: (callback) => frames.push(callback),
  };
  vm.runInNewContext(source, { window, document });

  return {
    classes,
    attributes,
    listeners,
    window,
    document,
    flushFrame() { frames.splice(0).forEach((callback) => callback()); },
  };
}

test("Resume-Abdeckung bleibt beim Wechsel in den Hintergrund stehen und verschwindet nach zwei sichtbaren Frames", () => {
  const harness = createHarness();
  assert.equal(harness.classes.has("app-resume-cover"), false, "initial sichtbar soll keinen Loader einblenden");

  harness.document.visibilityState = "hidden";
  harness.listeners.get("visibilitychange")[0]();
  assert.equal(harness.classes.has("app-resume-cover"), true);
  assert.equal(harness.attributes.get("aria-hidden"), "false");

  harness.document.visibilityState = "visible";
  harness.listeners.get("visibilitychange")[0]();
  assert.equal(harness.classes.has("app-resume-cover"), true, "der Cover bleibt bis zum Paint sichtbar");
  harness.flushFrame();
  assert.equal(harness.classes.has("app-resume-cover"), true, "ein Frame reicht nicht zum Ausblenden");
  harness.flushFrame();
  assert.equal(harness.classes.has("app-resume-cover"), false);
  assert.equal(harness.attributes.get("aria-hidden"), "true");
});

test("Standalone-Kaltstart zeigt den Ladebildschirm bis zum Abschluss des App-Boots", () => {
  const harness = createHarness({ standalone: true });
  assert.equal(harness.classes.has("app-ready"), false);
  harness.window.AppResumeScreen.markReady();
  assert.equal(harness.classes.has("app-ready"), true);
  assert.equal(harness.attributes.get("aria-hidden"), "true");
});
