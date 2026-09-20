"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "recipe-inventory-ingredients.js"), "utf8");

function run(extra = {}) {
  const context = { console, Set, Map, Object, Array, Number, String, Math, Date, JSON, ...extra };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

test("tatsächliche Variante und oneOf-Zutat werden unabhängig von Sulfiten ermittelt", () => {
  const foods = [
    { id: "hafer", name: "Hafer" },
    { id: "hirse", name: "Hirse" },
    { id: "ei", name: "Ei" },
    { id: "banane", name: "Banane" },
    { id: "mango", name: "Mango" },
  ];
  const context = run({
    state: { foods },
    foodByName: (name, list) => list.find((item) => item.name === name),
    recipeFoodIds: () => ["hafer", "ei", "banane"],
  });
  const recipe = { requires: ["Hafer", "Ei"], alternatives: [["Hirse", "Ei"]], oneOf: ["Banane", "Mango"] };
  const choice = context.recipeInventoryChoiceState(recipe, ["hirse", "ei", "mango"]);
  assert.equal(choice.variantIndex, 1);
  assert.equal(choice.oneOfId, "mango");
  assert.deepEqual(Array.from(context.recipeInventoryActualFoodIds(recipe, choice)), ["hirse", "ei", "mango"]);
});

test("mehrdeutige Rezeptvorräte brauchen eine tatsächliche Bestätigung", () => {
  const context = run();
  assert.equal(context.recipeInventoryNeedsExplicitChoice({ requires: ["Hafer"] }), false);
  assert.equal(context.recipeInventoryNeedsExplicitChoice({ requires: ["Hafer"], alternatives: [["Hirse"]] }), true);
  assert.equal(context.recipeInventoryNeedsExplicitChoice({ requires: ["Hafer"], oneOf: ["Banane", "Mango"] }), true);
  assert.equal(context.recipeInventoryNeedsExplicitChoice({ requires: ["Hafer"], milkChoices: ["Milch", "Joghurt"] }), true);
});

test("der App-Ladepfad enthält keine aktive Produktallergen- oder Sulfitlogik", () => {
  assert.match(source, /actualRecipeIngredientsConfirmed/);
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.doesNotMatch(index, /product-allergens|productAllergen/i);
  assert.doesNotMatch(sw, /product-allergens|productAllergen/i);
});
