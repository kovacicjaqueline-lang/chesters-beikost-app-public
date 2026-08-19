"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const handlingSource = fs.readFileSync(path.join(root, "js", "handling-readiness.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const planningSource = fs.readFileSync(path.join(root, "js", "planning.js"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");

test("Unified Log: sichtbare Darreichungslabels verwenden keine Slash-Doppelbezeichnungen", () => {
  assert.equal(handlingSource.includes('label: "Fein / glatt vom Löffel"'), false);
  assert.equal(handlingSource.includes('>Löffel / Brei<'), false);
  assert.equal(handlingSource.includes('>Fingerfood / BLW<'), false);
  assert.ok(handlingSource.includes('label: "Fein und glatt vom Löffel"'));
  assert.ok(handlingSource.includes('>Löffelkost<'));
  assert.ok(handlingSource.includes('>Fingerfood<'));
});

test("Unified Log: Konsistenzstufen und Hilfe verwenden die neuen eindeutigen Begriffe", () => {
  assert.equal(indexSource.includes("glatt / fein zerdrückt"), false);
  assert.equal(indexSource.includes("dick püriert / weich zerdrückt"), false);
  assert.equal(indexSource.includes("weich-stückig / Fingerfood"), false);
  assert.ok(indexSource.includes("Neue Lebensmittel protokollieren"));
  assert.ok(indexSource.includes("Bei freien Einträgen ist keine Mahlzeitenauswahl nötig."));
});

test("Unified Log: Terminologie ist direkt in Planner und UI integriert", () => {
  assert.equal(uiSource.includes("toggleEntryChooser("), false);
  assert.equal(uiSource.includes("Mahlzeit oder Kostprobe"), false);
  assert.equal(uiSource.includes('role === "sample" ? "Kostprobe"'), false);
  assert.equal(uiSource.includes("Einführung / Wiederholung"), false);
  assert.equal(uiSource.includes("Sichere Form / Notiz"), false);
  assert.equal(planningSource.includes("Schon gegessen / Kombination"), false);
  assert.ok(uiSource.includes("Hauptbasis und Lernrolle werden getrennt gespeichert."));
  assert.ok(uiSource.includes("Einführung und Wiederholung"));
  assert.ok(uiSource.includes("Sichere Form oder Notiz"));
  assert.ok(planningSource.includes("Neue Einführung separat"));
});
