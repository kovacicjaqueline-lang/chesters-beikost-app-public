"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const core = require("../js/log-core.js");
const uiSource = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("Unified manual roles: tried samples are visibly repetitions", () => {
  assert.equal(core.learningRoleLabel(0, "Offen"), "Einführung");
  assert.equal(core.learningRoleLabel(1, "Probiert"), "Wiederholung");
  assert.match(uiSource, /function manualLearningRoleText\(/);
  assert.match(uiSource, /learningRoleLabel\(rank\(item\), status\(item\), type\)/);
  assert.match(uiSource, /group\("Einführung und Wiederholung", validation\.samples, "sample"\)/);
  assert.match(uiSource, /role === "sample" \? learningLabel/);
  assert.match(uiSource, /roleInfo\.role === "sample" \? `wird \$\{learningLabel\}`/);
  assert.doesNotMatch(uiSource, /role === "sample" \? "Einführung"/);
  assert.doesNotMatch(uiSource, /roleInfo\.role === "sample" \? "wird Einführung"/);
});

test("Unified manual roles: visible validation copy covers introduction and repetition", () => {
  assert.match(uiSource, /function manualLearningValidationText\(/);
  assert.match(uiSource, /Einführung beziehungsweise Wiederholung/);
  assert.match(uiSource, /validation\.messages\.map\(\(message\) => esc\(manualLearningValidationText\(message\)\)\)/);
  assert.match(uiSource, /showToast\(manualLearningValidationText\(result\.message\)/);
});

test("Unified help: texture rules distinguish positive from non-positive outcomes", () => {
  assert.match(indexSource, /Bei „Probiert“ oder „Gegessen“ wird die tatsächlich angebotene Konsistenz dokumentiert/);
  assert.match(indexSource, /Bei Ablehnung, Reaktion oder „Nicht angeboten“ ist sie optional/);
  assert.doesNotMatch(indexSource, /Sobald tatsächlich Essen angeboten wurde, wird die Konsistenz dokumentiert/);
});
