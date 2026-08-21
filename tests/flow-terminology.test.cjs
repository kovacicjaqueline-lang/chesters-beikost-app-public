"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
const logSource = fs.readFileSync(path.join(root, "js", "log.js"), "utf8");

test("Flow-Terminologie: sichtbare Aktionen trennen Planung und tatsächliches Essen", () => {
  assert.ok(indexSource.includes('id="freeLog">+ Essen eintragen</button>'));
  assert.ok(indexSource.includes('id="logTitle">Essen eintragen</h2>'));
  assert.ok(indexSource.includes('setText(".homeLog", "Essen eintragen")'));
  assert.ok(indexSource.includes('setText("#homeAddEntry", "＋ Essen eintragen")'));
  assert.ok(indexSource.includes('setText("#blockPlan .logMeal", "Essen eintragen")'));
  assert.ok(indexSource.includes('setText("#blockPlan .replaceMeal", "Mahlzeit bearbeiten")'));
  assert.ok(indexSource.includes('setText("#blockPlan .addExtraMeal", "+ Mahlzeit hinzufügen")'));
  assert.ok(indexSource.includes('editing ? "Essen bearbeiten" : "Essen eintragen"'));
  assert.ok(indexSource.includes('`Mahlzeit ${editing ? "bearbeiten" : "hinzufügen"} · ${match[1]}`'));
  assert.ok(indexSource.includes('.replace("Mahlzeit übernehmen", "Mahlzeit hinzufügen")'));
  assert.ok(indexSource.includes('.replace("Gesamte Mahlzeit speichern", "Änderungen speichern")'));
  assert.equal(indexSource.includes("Neue Lebensmittel protokollieren"), false);
  assert.equal(indexSource.includes("beim Protokollieren"), false);
});

test("Flow-Terminologie: Kostprobe bleibt ohne eigenen UX-Flow", () => {
  assert.equal(indexSource.includes("Kostprobe"), false);
  assert.equal(uiSource.includes("Mahlzeit oder Kostprobe"), false);
  assert.equal(uiSource.includes('role === "sample" ? "Kostprobe"'), false);
  assert.ok(indexSource.includes("Bei freien Einträgen ist keine Mahlzeitenauswahl nötig."));
});

test("Flow-Terminologie: Legacy-entryType bleibt beim Bearbeiten erhalten", () => {
  assert.match(
    logSource,
    /pendingLog\.entryType\s*=\s*pendingLog\.editId\s*\?\s*\(legacyEntryType\s*\|\|\s*"food"\)\s*:\s*"food"/,
  );
  assert.match(
    logSource,
    /entryType:\s*pendingLog\.editId\s*\?\s*\(pendingLog\.__legacyEntryType\s*\|\|\s*"food"\)\s*:\s*"food"/,
  );
});
