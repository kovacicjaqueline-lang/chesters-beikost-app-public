"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("Einstellung für den Mindestabstand neuer Lebensmittel bleibt sichtbar und speicherbar", () => {
  const html = read("index.html");
  const ui = read("js/ui.js");
  const plannerPolicy = read("js/planner-introduction-policy.js");
  const mobileMore = read("js/mobile-beikost-more.js");

  assert.match(html, /<select id="newFoodEvery">[\s\S]*?<\/select>/);
  assert.match(html, /<label>Neues Lebensmittel frühestens alle<\/label>/);
  assert.match(ui, /"newFoodEvery"/);
  assert.doesNotMatch(plannerPolicy, /cadenceField[\s\S]{0,160}hidden\s*=\s*true/);
  assert.match(mobileMore, /app:\s*\[settingsGroupFor\("allergenDays"\),\s*settingsGroupFor\("phMode"\)\]/);
});
