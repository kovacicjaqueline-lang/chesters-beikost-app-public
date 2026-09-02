"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const runtime = fs.readFileSync(path.join(root, "js", "flow-dialog-ui.js"), "utf8");
const css = fs.readFileSync(path.join(root, "flow-dialog-ui.css"), "utf8");
const logSource = fs.readFileSync(path.join(root, "js", "log.js"), "utf8");

test("Essensprotokoll nutzt die gemeinsame sichtbare Selector-Struktur", () => {
  assert.match(runtime, /flow-log-selector/);
  assert.match(runtime, /meal-selector-tabs flow-log-selector-tabs/);
  assert.match(runtime, /data-flow-log-selector="recipes"/);
  assert.match(runtime, /data-flow-log-selector="foods"/);
  assert.match(runtime, /row\.classList\.add\("selector-row", kindClass\)/);
  assert.match(runtime, /recipeResults\?\.classList\.add\("selector-results"\)/);
  assert.match(runtime, /foodResults\?\.classList\.add\("selector-results"\)/);
});

test("Log-Selector bleibt presentation-only und nutzt die bestehenden Log-Controller", () => {
  const controllerAssignment = /^\s*(?:renderLogForm|saveLog|openLog|addLogFoodFromResult|renderLogRecipeResults)\s*=/m;
  assert.doesNotMatch(runtime, controllerAssignment);
  assert.doesNotMatch(runtime, /\bstate\.logs\b/);
  assert.doesNotMatch(runtime, /\bpendingLog\b/);
  assert.match(runtime, /\.log-recipe-picker/);
  assert.match(runtime, /\.log-food-picker/);
});

test("freie Rezeptwahl bleibt auf neue freie Einträge begrenzt", () => {
  assert.match(
    logSource,
    /let freeRecipePicker = !p\.editId && !p\.__mealContext \? `<div class="field log-recipe-picker">/,
  );
  assert.match(runtime, /if \(recipePicker\)/);
  assert.match(runtime, /else \{\s*tabs\?\.remove\(\);[\s\S]*logSelectorMode = "foods";/);
});

test("leerer Rezept-Hinweis wird nicht doppelt unter dem Suchfeld angezeigt", () => {
  assert.match(runtime, /setHidden\(recipeResultsLabel, !hasRecipeQuery\)/);
  assert.match(runtime, /setText\(recipeLabel, "Suchen"\)/);
  assert.match(runtime, /recipeInput\.placeholder = "Rezept suchen"/);
});

test("FOOD-Validierung sperrt den Rezept-Tab nicht dauerhaft", () => {
  assert.match(runtime, /const nextMode = button\.dataset\.flowLogSelector === "recipes" \? "recipes" : "foods"/);
  assert.match(runtime, /foodPicker\?\.classList\.remove\("field-error"\)/);
  assert.match(runtime, /foodError\.style\.display = "none"/);
});

test("ausgewählte Log-Lebensmittel bleiben im Selector sichtbar und sind abwählbar", () => {
  assert.match(logSource, /let selected = \[\.\.\.selectedLogFoods\]\.map\(food\)/);
  assert.match(logSource, /selectedLogFoods\.has\(f\.id\)/);
  assert.match(logSource, /selected \? "✓" : "＋"/);
  assert.match(logSource, /function removeLogFoodSelection\(id\)/);
  assert.match(logSource, /if \(selectedLogFoods\.has\(id\)\) \{\s*removeLogFoodSelection\(id\);/s);
});

test("Speichern eines Protokolleintrags bleibt in der aktuellen Ansicht", () => {
  const saveStart = logSource.indexOf("function saveLog()");
  assert.ok(saveStart >= 0, "saveLog muss vorhanden sein");
  const saveSource = logSource.slice(saveStart);

  assert.match(saveSource, /save\(\); closeLog\(\); renderAll\(\);/);
  assert.doesNotMatch(saveSource, /showView\(["']more["']\)/);
  assert.doesNotMatch(saveSource, /getElementById\(["']logDetails["']\)/);
  assert.doesNotMatch(saveSource, /scrollIntoView\(/);
});

test("Log-Selector bleibt mobil einspaltig und blendet inaktive Panels aus", () => {
  assert.match(css, /#logModal\.flow-dialog \.flow-log-selector-panel\[hidden\]\s*\{\s*display:\s*none;/s);
  assert.match(css, /#logModal\.flow-dialog \.flow-log-selector \.flow-log-selector-panel\s*\{\s*margin:\s*0;/s);
});
