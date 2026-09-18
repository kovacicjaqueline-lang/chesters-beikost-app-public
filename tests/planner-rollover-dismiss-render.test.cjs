"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "planner-log-rollover.js"), "utf8");

function keepOpenPlansHandlerSource() {
  const start = source.indexOf('document.getElementById("keepOpenPlans").onclick');
  const end = source.indexOf('document.getElementById("backfillOpenPlans").onclick', start);
  assert.ok(start >= 0 && end > start, "Handler für Nicht verschieben muss auffindbar sein");
  return source.slice(start, end);
}

test("Nicht verschieben speichert nur den Keep-Status und löst keinen Voll-Render aus", () => {
  const handler = keepOpenPlansHandlerSource();

  assert.match(handler, /CORE\.markPlansKept\(state, outstandingNow\(\)\)/);
  assert.match(handler, /\bsave\(\)/, "Keep-Metadaten müssen persistiert werden");
  assert.match(handler, /\bcloseGeneric\(\)/, "Dialog muss direkt geschlossen werden");
  assert.doesNotMatch(handler, /\brenderAll\(\)/, "Unveränderte Planung darf keinen Voll-Render auslösen");
});
