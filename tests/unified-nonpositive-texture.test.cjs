"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../js/log-core.js");

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
