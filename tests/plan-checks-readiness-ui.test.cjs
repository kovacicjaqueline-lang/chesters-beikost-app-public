"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { classifyPhaseReadinessReasons } = require("../js/plan-checks-ui-core.js");

test("NotConfirmed-Readiness bleibt im sichtbaren Fehlt-noch-Ergebnis", () => {
  const result = classifyPhaseReadinessReasons([
    { code: "currentPatternAcceptedConfirmed", text: "Muster klappt." },
    { code: "additionalMealCueNotConfirmed", text: "Signal fehlt." },
    { code: "routineCompatibleUnknown", text: "Alltag noch offen." },
  ]);

  assert.deepEqual(result.fulfilled.map((item) => item.code), ["currentPatternAcceptedConfirmed"]);
  assert.deepEqual(result.missing.map((item) => item.code), [
    "additionalMealCueNotConfirmed",
    "routineCompatibleUnknown",
  ]);
});

test("fehlende Readiness-Voraussetzungen werden als offene UI-Gründe ergänzt", () => {
  const result = classifyPhaseReadinessReasons([], ["additionalMealCue"]);
  assert.deepEqual(result.fulfilled, []);
  assert.deepEqual(result.missing, [{
    code: "additionalMealCueUnknown",
    text: "additionalMealCue ist noch nicht angegeben.",
  }]);
});
