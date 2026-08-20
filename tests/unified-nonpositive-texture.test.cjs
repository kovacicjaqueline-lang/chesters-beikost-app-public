"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const logSource = fs.readFileSync(path.join(root, "js", "log.js"), "utf8");
const core = require("../js/log-core.js");

function saveLogSource() {
  const start = logSource.indexOf("function saveLog() {");
  assert.notEqual(start, -1, "saveLog must exist");
  return logSource.slice(start);
}

test("Unified Log: explicit texture is preserved for non-positive outcomes", () => {
  const source = saveLogSource();
  assert.match(source, /let selectedTexture = validLogTextureStage\(textureValue\);/);
  assert.doesNotMatch(source, /let selectedTexture = offered\s*\?/);
});

test("Unified Log: texture guidance names not-offered as optional", () => {
  assert.match(logSource, /Bei Ablehnung, Reaktion oder „Nicht angeboten“ optional/);
});

test("Unified Log: documented non-positive texture does not count as positive texture progress", () => {
  const logs = [{
    id: "not-offered-with-texture",
    foodIds: ["karotte"],
    foodOutcomes: { karotte: "not_offered" },
    textureKnown: true,
    textureStage: 3,
  }];
  const outcomeForFood = (log, id) => log.foodOutcomes[id];
  assert.deepEqual(core.logTextureCounts(logs, outcomeForFood), [0, 0, 0, 0]);
});
