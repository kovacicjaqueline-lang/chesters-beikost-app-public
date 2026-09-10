"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.resolve(__dirname, "..", "js", "plan-checks-ui-core.js"), "utf8");

test("NotConfirmed-Readiness wird nicht als erfüllt einsortiert", () => {
  assert.match(
    source,
    /item\.code\.endsWith\("Confirmed"\)\s*&&\s*!item\.code\.endsWith\("NotConfirmed"\)/,
    "NotConfirmed darf wegen des Suffixes 'Confirmed' nicht in der Erfüllt-Gruppe landen",
  );
  assert.match(
    source,
    /item\.code\.endsWith\("NotConfirmed"\)\s*\|\|\s*item\.code\.endsWith\("Unknown"\)/,
    "Negative und unbekannte Readiness-Gründe müssen in der Fehlt-noch-Gruppe bleiben",
  );
});
