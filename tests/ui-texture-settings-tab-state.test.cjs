"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("entfernter Session-State-Override bleibt ein verbotener Legacy-Build-Bestandteil", () => {
  assert.equal(fs.existsSync(path.join(root, "js/ui-session-state.js")), false);
});
