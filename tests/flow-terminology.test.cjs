"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
const logSource = fs.readFileSync(path.join(root, "js", "log.js"), "utf8");
const migrationSource = fs.readFileSync(path.join(root, "js", "migrations.js"), "utf8");

test("Flow-Terminologie trennt Planung und tatsächliches Essen", () => {
  assert.ok(indexSource.includes('id="freeLog">+ Essen eintragen</button>'));
  assert.ok(indexSource.includes('id="logTitle">Essen eintragen</h2>'));

  assert.ok(uiSource.includes('class="btn full homeLog" data-plan="${payload}">Essen eintragen</button>'));
  assert.ok(uiSource.includes('id="homeFreeLog">Essen eintragen</button>'));
  assert.ok(uiSource.includes('id="homeAddEntry">＋ Essen eintragen</button>'));
  assert.ok(uiSource.includes('class="btn full logMeal" data-plan="${planPayload}">Essen eintragen</button>'));
  assert.ok(uiSource.includes('class="btn secondary replaceMeal" data-date="${day.date}" data-meal="${m.meal}" data-focus="${m.focusId}">Mahlzeit bearbeiten</button>'));
  assert.ok(uiSource.includes('class="btn secondary smallbtn addExtraMeal" data-date="${d.date}">+ Mahlzeit hinzufügen</button>'));
  assert.ok(uiSource.includes('${isNewManualSlot ? "Mahlzeit hinzufügen" : "Änderungen speichern"}</button>'));
  assert.ok(uiSource.includes('openGeneric(isNewManualSlot ? `Mahlzeit hinzufügen · ${mealName(meal)}` : `Mahlzeit bearbeiten · ${mealName(meal)}`, body)'));

  assert.ok(logSource.includes('document.getElementById("logTitle").textContent = p.editId ? "Essen bearbeiten" : "Essen eintragen";'));
  assert.ok(logSource.includes('id="saveLog">${p.editId ? "Änderungen speichern" : "Speichern"}</button>'));
  assert.ok(logSource.includes('class="iconbtn editLog" aria-label="Essen bearbeiten"'));
  assert.equal(logSource.includes('class="iconbtn editLog" aria-label="Bearbeiten"'), false);
  assert.equal(logSource.includes('button.textContent = "+ Essen eintragen";'), false);
  assert.equal(indexSource.includes("Neue Lebensmittel protokollieren"), false);
  assert.equal(indexSource.includes("beim Protokollieren"), false);
});

test("Kostprobe existiert nicht mehr als eigener UX- oder Erstellflow", () => {
  assert.equal(indexSource.includes("Kostprobe"), false);
  assert.equal(uiSource.includes("Kostprobe"), false);
  assert.equal(logSource.includes("Kostprobe"), false);
  assert.equal(logSource.includes('entryType: "sample"'), false);
  assert.ok(indexSource.includes("Bei freien Einträgen ist keine Mahlzeitenauswahl nötig."));
  assert.ok(logSource.includes('recipeName: "", recipeInventoryId: "", entryType: "food", foodOutcomes: {}'));
  assert.match(
    logSource,
    /pendingLog\.entryType\s*=\s*pendingLog\.editId\s*\?\s*\(legacyEntryType\s*\|\|\s*"food"\)\s*:\s*"food"/,
  );
  assert.match(
    logSource,
    /entryType:\s*pendingLog\.editId\s*\?\s*\(pendingLog\.__legacyEntryType\s*\|\|\s*"food"\)\s*:\s*"food"/,
  );
});

test("Legacy-sample-Daten bleiben migrationskompatibel", () => {
  assert.ok(migrationSource.includes('if (!sampleFoodIds.length && log.entryType === "sample") sampleFoodIds = [...(log.foodIds || [])];'));
  assert.ok(migrationSource.includes('let entryType = log.entryType || (sampleFoodIds.length && baseFoodIds.length === 0 ? "sample" : "meal");'));
  assert.ok(migrationSource.includes('amount: entryType === "sample" ? "" : (log.amount || "")'));
});
