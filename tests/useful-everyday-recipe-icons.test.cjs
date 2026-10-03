"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const RECIPE_SOURCE = fs.readFileSync(path.join(ROOT, "data", "recipes.js"), "utf8");
const RUNTIME_SOURCE = fs.readFileSync(path.join(ROOT, "js", "recipes.js"), "utf8");
const ICON_SOURCE = fs.readFileSync(path.join(ROOT, "js", "icons.js"), "utf8");
const SW_SOURCE = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

const EXPECTED = Object.freeze({
  "Apfel-Pflaumen-Kompott": "assets/illustrations-v2/recipes/apfel-pflaumen-kompott.svg",
  "Birne-Pfirsich-Kompott": "assets/illustrations-v2/recipes/birne-pfirsich-kompott.svg",
  "Mango-Bananen-Creme": "assets/illustrations-v2/recipes/mango-bananen-creme.svg",
  "Kartoffel-Karotten-Stampf": "assets/illustrations-v2/recipes/kartoffel-karotten-stampf.svg",
  "Gemüse-Reis-Brei": "assets/illustrations-v2/recipes/gemuese-reis-brei.svg",
});

function loadCatalog() {
  const context = vm.createContext({ console });
  vm.runInContext(RECIPE_SOURCE, context, { filename: "data/recipes.js" });
  vm.runInContext(RUNTIME_SOURCE, context, { filename: "js/recipes.js" });
  return JSON.parse(vm.runInContext("JSON.stringify(RECIPES)", context));
}

test("Alltags-Grundset enthält reproduzierbare, weiche Zubereitungen", () => {
  const recipes = loadCatalog();
  for (const [name, asset] of Object.entries(EXPECTED)) {
    const recipe = recipes.find((item) => item.name === name);
    assert.ok(recipe, name + ": Rezept fehlt");
    assert.equal(recipe.stage, 1, name + ": falsche Konsistenzstufe");
    assert.match(recipe.ingredients, /\d/, name + ": Mengenangabe fehlt");
    assert.ok(recipe.note.length >= 120, name + ": Zubereitung bleibt zu knapp");
    assert.equal(recipe.quantityGuidanceRevision, "2026-08-22", name + ": Mengenrevision fehlt");
    assert.ok(asset.endsWith(".svg"));
  }
});

test("Alltags-Grundset ist über Recipe-V2 und Offline-Precache vollständig angeschlossen", () => {
  for (const [name, asset] of Object.entries(EXPECTED)) {
    assert.ok(fs.existsSync(path.join(ROOT, asset)), name + ": eigenes Recipe-V2-Asset fehlt");
    assert.ok(ICON_SOURCE.includes('"' + name + '": "' + asset + '"'), name + ": Icon-Mapping fehlt");
    assert.ok(SW_SOURCE.includes('"./' + asset + '"'), name + ": Offline-Precache fehlt");
    const svg = fs.readFileSync(path.join(ROOT, asset), "utf8");
    assert.match(svg, /<svg[^>]+width="128"[^>]+height="128"/, name + ": falsche Assetgröße");
    assert.match(svg, /viewBox="0 0 128 128"/, name + ": falsche ViewBox");
    assert.match(svg, /data:image\/png;base64,[A-Za-z0-9+/=]+/, name + ": PNG-Wrapper fehlt");
  }
});
