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

const INCOMPLETE_PREPARATIONS = Object.freeze([
  "Birne-Hirse-Pancakes",
  "Rind-Hafer-Bällchen",
  "Geflügel-Gemüse-Hafer-Bällchen",
  "Rote-Linsen-Gemüsebällchen",
  "Tofu-Brokkoli-Bällchen",
  "Zucchini-Hafer-Puffer",
  "Polenta-Zucchini-Sticks",
  "Zucchini-Omelett",
  "Kürbis-Hafer-Brei",
  "Gemüse-Nudel-Sauce",
  "Baby-Linsen-Bolognese",
  "Bangus-Kartoffel-Taler",
  "Obst-Hafer-Muffins",
  "Gemüse-Hafer-Muffins",
  "Kürbis-Hirse-Muffins",
  "Bananen-Haferbrei mit Erdnussmus",
  "Karotten-Hirse-Brei mit Tahin",
  "Apfel-Hirse-Brei mit Mandelmus",
  "Paprika-Omelettstreifen",
  "Ei-Champignon-Cups",
]);

const TERSE_PREPARATIONS = Object.freeze([
  "Zucchini-Hafer-Pancakes",
  "Ube-Bananen-Pancakes",
  "Rote-Linsen-Bratlinge",
  "Omelettstreifen",
  "Obst-Hirsebrei",
  "Obst-Polentabrei",
  "Obst-Reisbrei",
  "Obst-Buchweizenbrei",
  "Obst-Grießbrei",
  "Lugaw-Basis",
  "Kürbis-Lugaw",
  "Tinola-inspiriert",
  "Arroz-caldo-inspiriert",
  "Kalabasa mit Kokos",
  "Tilapia-Reis-Brei",
  "Bananen-Joghurt-Hafer-Pancakes",
  "Obst-Joghurt-Hafer-Ofenbites",
  "Zucchini-Joghurt-Hafer-Bites",
  "Joghurt-Hafer-Waffeln",
  "Weiche Joghurt-Fladen",
  "Gemüse-Joghurt-Mini-Muffins",
  "Huhn-Gemüse-Muffins",
  "Süßkartoffel-Linsen-Muffins",
]);

const REQUIRED_NOTE_FRAGMENTS = Object.freeze({
  "Birne-Hirse-Pancakes": [/Birne/i, /Hirse/i, /Ei/i, /verrühr/i],
  "Rind-Hafer-Bällchen": [/Hafer/i, /Ei/i, /vermeng/i],
  "Geflügel-Gemüse-Hafer-Bällchen": [/Gemüse/i, /Hafer/i, /vermeng/i],
  "Rote-Linsen-Gemüsebällchen": [/Linsen/i, /Karotte/i, /Hafer/i, /vermeng/i],
  "Tofu-Brokkoli-Bällchen": [/Tofu/i, /Brokkoli/i, /Hafer/i, /vermeng/i],
  "Zucchini-Hafer-Puffer": [/Zucchini/i, /Hafer/i, /Ei/i, /verrühr/i],
  "Polenta-Zucchini-Sticks": [/Polenta/i, /Zucchini/i, /unterrühr/i, /auskühl|fest/i],
  "Zucchini-Omelett": [/Zucchini/i, /Ei/i, /verrühr/i],
  "Kürbis-Hafer-Brei": [/Kürbis/i, /Hafer/i, /verrühr/i],
  "Gemüse-Nudel-Sauce": [/Zucchini/i, /Tomate/i, /Nudeln/i, /Sauce/i],
  "Baby-Linsen-Bolognese": [/Linsen/i, /Tomate/i, /Nudeln/i, /Sauce/i],
  "Bangus-Kartoffel-Taler": [/Bangus/i, /Kartoffel/i, /vermeng/i, /Taler/i],
  "Obst-Hafer-Muffins": [/Obst/i, /Hafer/i, /Ei/i, /verrühr/i],
  "Gemüse-Hafer-Muffins": [/Gemüse/i, /Hafer/i, /Ei/i, /verrühr/i],
  "Kürbis-Hirse-Muffins": [/Kürbis/i, /Hirse/i, /Ei/i, /verrühr/i],
  "Bananen-Haferbrei mit Erdnussmus": [/Hafer/i, /Banane/i, /Erdnuss/i],
  "Karotten-Hirse-Brei mit Tahin": [/Hirse/i, /Karotte/i, /Tahin/i],
  "Apfel-Hirse-Brei mit Mandelmus": [/Hirse/i, /Apfel/i, /Mandel/i],
  "Paprika-Omelettstreifen": [/Paprika/i, /Ei/i, /verrühr/i],
  "Ei-Champignon-Cups": [/Champignon/i, /Ei/i, /verrühr/i],
  "Bananen-Joghurt-Hafer-Pancakes": [/Banane/i, /Naturjoghurt/i, /Hafer/i, /Ei/i, /verrühr/i],
  "Obst-Joghurt-Hafer-Ofenbites": [/Obst/i, /Naturjoghurt/i, /Hafer/i, /Ei/i, /verrühr/i],
  "Zucchini-Joghurt-Hafer-Bites": [/Zucchini/i, /Naturjoghurt/i, /Hafer/i, /Ei/i, /verrühr/i],
  "Joghurt-Hafer-Waffeln": [/Naturjoghurt/i, /Hafer/i, /Ei/i, /verrühr/i],
  "Weiche Joghurt-Fladen": [/Naturjoghurt/i, /Weizen|Grieß/i, /Ei/i, /verrühr/i],
  "Gemüse-Joghurt-Mini-Muffins": [/Gemüse/i, /Naturjoghurt/i, /Hafer/i, /Ei/i, /verrühr/i],
  "Huhn-Gemüse-Muffins": [/Huhn/i, /Gemüse/i, /Hafer/i, /Ei/i, /verrühr/i],
  "Süßkartoffel-Linsen-Muffins": [/Süßkartoffel/i, /Linsen/i, /Hafer/i, /vermeng/i],
});

test("recipe preparation audit covers the full 123-recipe runtime catalog", () => {
  const recipes = loadCatalog();
  assert.equal(recipes.length, 123);
  assert.equal(INCOMPLETE_PREPARATIONS.length, 20);
  assert.equal(TERSE_PREPARATIONS.length, 23);
  assert.equal(new Set([...INCOMPLETE_PREPARATIONS, ...TERSE_PREPARATIONS]).size, 43);
});

test("recipe preparation completeness: the 20 incomplete recipes now explain their missing preparation steps", () => {
  const recipes = loadCatalog();
  for (const name of INCOMPLETE_PREPARATIONS) {
    const recipe = recipes.find((item) => item.name === name);
    assert.ok(recipe, `${name}: Rezept fehlt`);
    assert.ok(recipe.note.length >= 120, `${name}: Zubereitung bleibt zu knapp`);
    for (const fragment of REQUIRED_NOTE_FRAGMENTS[name] || []) {
      assert.match(recipe.note, fragment, `${name}: Zubereitung ist weiter unvollständig (${fragment})`);
    }
  }
});

test("recipe preparation completeness: the 23 terse recipes now contain reproducible multi-step guidance", () => {
  const recipes = loadCatalog();
  for (const name of TERSE_PREPARATIONS) {
    const recipe = recipes.find((item) => item.name === name);
    assert.ok(recipe, `${name}: Rezept fehlt`);
    assert.ok(recipe.note.length >= 120, `${name}: Zubereitung bleibt zu knapp`);
    assert.ok((recipe.note.match(/[.!?](?:\s|$)/g) || []).length >= 2, `${name}: Zubereitung bleibt einschrittig`);
    for (const fragment of REQUIRED_NOTE_FRAGMENTS[name] || []) {
      assert.match(recipe.note, fragment, `${name}: Zubereitung ist weiter unvollständig (${fragment})`);
    }
  }
});

test("recipe preparation consistency: Monggo-Kalabasa does not suggest undeclared Malunggay", () => {
  const recipes = loadCatalog();
  const monggo = recipes.find((item) => item.name === "Monggo-Kalabasa-Brei");
  assert.ok(monggo);
  assert.doesNotMatch(monggo.note, /Malunggay/i, "Monggo-Kalabasa-Brei darf keine nicht deklarierte Malunggay-Freigabe enthalten");
});
