"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const utilsSource = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");
const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const appVersion = JSON.parse(fs.readFileSync(path.join(root, "VERSION.json"), "utf8")).version;

test("HANDLING offline: dynamisch geladener Contract, Runtime und Unified Log sind beim ersten Offline-Start vorgecached", () => {
  assert.ok(utilsSource.includes(`data/food-handling.js?v=${appVersion}`));
  assert.ok(utilsSource.includes(`js/handling-readiness.js?v=${appVersion}`));

  assert.match(swSource, /const HANDLING_PRECACHE\s*=\s*\[[\s\S]*\.\/data\/food-handling\.js[\s\S]*\.\/js\/handling-readiness\.js[\s\S]*\]/);
  assert.match(swSource, /const UNIFIED_LOG_PRECACHE\s*=\s*\[[\s\S]*\.\/js\/log-core\.js[\s\S]*\]/);
  assert.doesNotMatch(swSource, /unified-food-log-policy\.js/);
  assert.match(
    swSource,
    /\.\.\.PLAN08_PRECACHE\s*,\s*\.\.\.HANDLING_PRECACHE\s*,\s*\.\.\.UNIFIED_LOG_PRECACHE\s*,\s*\.\.\.UI_PRECACHE/,
  );
});
