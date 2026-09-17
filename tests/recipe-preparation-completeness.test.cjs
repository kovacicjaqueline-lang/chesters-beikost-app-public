"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const dataSource = fs.readFileSync(path.join(ROOT, "data/recipes.js"), "utf8");
const runtimeSource = fs.readFileSync(path.join(ROOT, "js/recipes.js"), "utf8");

function loadCatalog() {
  const context = vm.createContext({ console });
  vm.runInContext(dataSource, context, { filename: "data/recipes.js" });
  vm.runInContext(runtimeSource, context, { filename: "js/recipes.js" });
  return JSON.parse(vm.runInContext("JSON.stringify(RECIPES)", context));
}

const REQUIRED_NOTE_FRAGMENTS = {
  "Birne-Hirse-Pancakes": [/Birne/i, /Hirse/i, /Ei/i, /misch|verrühr/i],
  "Rind-Hafer-Bällchen": [/Rind/i, /Hafer/i, /Ei/i, /misch|verarbeit/i],
  "Geflügel-Gemüse-Hafer-Bällchen": [/Geflügel|Huhn|Pute/i, /Gemüse|Zucchini|Karotte/i, /Hafer/i, /misch|vermeng/i],
  "Rote-Linsen-Gemüsebällchen": [/Linsen/i, /Karotte/i, /Hafer/i, /misch|vermeng/i],
  "Tofu-Brokkoli-Bällchen": [/Tofu/i, /Brokkoli/i, /Hafer/i, /misch|vermeng/i],
  "Zucchini-Hafer-Puffer": [/Zucchini/i, /Hafer/i, /Ei/i, /misch|verrühr/i],
  "Polenta-Zucchini-Sticks": [/Polenta/i, /Zucchini/i, /misch|unterrühr|unterheb/i, /auskühl|fest/i],
  "Zucchini-Omelett": [/Zucchini/i, /Ei/i, /verrühr|misch/i],
  "Kürbis-Hafer-Brei": [/Kürbis/i, /Hafer/i, /weich/i, /misch|pürier|zerdrück/i],
  "Gemüse-Nudel-Sauce": [/Zucchini/i, /Tomate/i, /Nudeln/i, /Sauce/i],
  "Baby-Linsen-Bolognese": [/Linsen/i, /Tomate/i, /Nudeln/i, /Sauce/i],
  "Bangus-Kartoffel-Taler": [/Bangus/i, /Kartoffel/i, /zerdrück|vermeng|misch/i, /Taler|flach/i],
  "Obst-Hafer-Muffins": [/Obst/i, /Hafer/i, /Ei/i, /misch|verrühr/i],
  "Gemüse-Hafer-Muffins": [/Gemüse/i, /Hafer/i, /Ei/i, /misch|verrühr/i],
  "Kürbis-Hirse-Muffins": [/Kürbis/i, /Hirse/i, /Ei/i, /misch|verrühr/i],
  "Bananen-Haferbrei mit Erdnussmus": [/Hafer/i, /Banane/i, /Erdnuss/i],
  "Karotten-Hirse-Brei mit Tahin": [/Hirse/i, /Karotte/i, /Tahin/i],
  "Apfel-Hirse-Brei mit Mandelmus": [/Hirse/i, /Apfel/i, /Mandel/i],
  "Paprika-Omelettstreifen": [/Paprika/i, /Ei/i, /verrühr|misch/i],
  "Ei-Champignon-Cups": [/Champignon/i, /Ei/i, /verrühr|misch/i],
};

test("recipe preparation completeness: audited recipes explain how their named ingredients become the dish", () => {
  const recipes = loadCatalog();
  assert.equal(recipes.length, 123);

  for (const [name, fragments] of Object.entries(REQUIRED_NOTE_FRAGMENTS)) {
    const recipe = recipes.find((item) => item.name === name);
    assert.ok(recipe, `${name}: Rezept fehlt`);
    for (const fragment of fragments) {
      assert.match(recipe.note, fragment, `${name}: Zubereitung ist weiter unvollständig (${fragment})`);
    }
  }
});

test("recipe preparation consistency: no optional ingredient is suggested outside the recipe contract", () => {
  const recipes = loadCatalog();
  const monggo = recipes.find((item) => item.name === "Monggo-Kalabasa-Brei");
  assert.ok(monggo);
  assert.doesNotMatch(monggo.note, /Malunggay/i, "Monggo-Kalabasa-Brei darf keine nicht deklarierte Malunggay-Freigabe enthalten");
});
