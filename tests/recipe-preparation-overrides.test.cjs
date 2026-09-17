"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function loadCatalog() {
  const context = vm.createContext({ console });
  for (const file of ["data/recipes.js", "data/recipe-preparation-overrides.js", "js/recipes.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  }
  vm.runInContext("installRecipePreparationOverrides(RECIPES)", context);
  return JSON.parse(vm.runInContext("JSON.stringify(RECIPES)", context));
}

test("recipe preparation overrides cover the audited 20 incomplete and 23 terse recipes", () => {
  const recipes = loadCatalog();
  assert.equal(recipes.length, 123);
  const auditedNames = [
    "Birne-Hirse-Pancakes", "Rind-Hafer-Bällchen", "Geflügel-Gemüse-Hafer-Bällchen", "Rote-Linsen-Gemüsebällchen",
    "Tofu-Brokkoli-Bällchen", "Zucchini-Hafer-Puffer", "Polenta-Zucchini-Sticks", "Zucchini-Omelett", "Kürbis-Hafer-Brei",
    "Gemüse-Nudel-Sauce", "Baby-Linsen-Bolognese", "Bangus-Kartoffel-Taler", "Obst-Hafer-Muffins", "Gemüse-Hafer-Muffins",
    "Kürbis-Hirse-Muffins", "Bananen-Haferbrei mit Erdnussmus", "Karotten-Hirse-Brei mit Tahin", "Apfel-Hirse-Brei mit Mandelmus",
    "Paprika-Omelettstreifen", "Ei-Champignon-Cups",
    "Zucchini-Hafer-Pancakes", "Ube-Bananen-Pancakes", "Lachs-Kartoffel-Bällchen", "Brokkoli-Kartoffel-Taler",
    "Kichererbsen-Kürbis-Taler", "Rote-Linsen-Bratlinge", "Süßkartoffel-Hirse-Sticks", "Omelettstreifen", "Obst-Hirsebrei",
    "Obst-Polentabrei", "Obst-Reisbrei", "Obst-Buchweizenbrei", "Obst-Grießbrei", "Lugaw-Basis", "Kürbis-Lugaw",
    "Tinola-inspiriert", "Arroz-caldo-inspiriert", "Kalabasa mit Kokos", "Tilapia-Reis-Brei", "Kürbis-Linsen-Suppe",
    "Mildes Rote-Linsen-Dhal", "Huhn-Karotte-Nudel-Topf", "Huhn-Lauch-Kartoffel-Topf",
  ];
  assert.equal(auditedNames.length, 43);
  for (const name of auditedNames) {
    const recipe = recipes.find((item) => item.name === name);
    assert.ok(recipe, `${name}: Rezept fehlt`);
    assert.ok(recipe.note.length >= 120, `${name}: Zubereitung bleibt zu knapp`);
  }
});

test("recipe preparation overrides remove the undeclared Malunggay suggestion from Monggo-Kalabasa-Brei", () => {
  const recipe = loadCatalog().find((item) => item.name === "Monggo-Kalabasa-Brei");
  assert.ok(recipe);
  assert.doesNotMatch(recipe.note, /Malunggay/i);
});
