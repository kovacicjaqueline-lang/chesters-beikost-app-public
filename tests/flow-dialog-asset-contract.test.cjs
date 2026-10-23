"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("FLOW-C Stylesheet und Runtime bleiben vor dem App-Binding geladen und offline verfügbar", () => {
  const mainStyles = index.indexOf("ui-meal-editor-footer.css?v=");
  const flowStyles = index.indexOf("flow-dialog-ui.css?v=");
  const flowRuntime = index.indexOf("js/flow-dialog-ui.js?v=");
  const app = index.indexOf("app.js?v=");

  assert.ok(mainStyles >= 0 && flowStyles > mainStyles, "Flow-C Stylesheet folgt den Basisstilen");
  assert.ok(flowRuntime >= 0 && app > flowRuntime, "Flow-C Runtime wird vor dem App-Binding geladen");
  assert.ok(serviceWorker.includes("./flow-dialog-ui.css?v="), "Flow-C Stylesheet ist im Offline-Precache");
  assert.ok(serviceWorker.includes("./js/flow-dialog-ui.js"), "Flow-C Runtime ist im Offline-Precache");
});
