"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mealEditorRecipeComponentSlots,
  mealEditorRecipeSelectionFromFoodIds,
  mealEditorRecipeConfiguredFoodIds,
} = require("../js/meal-editor-recipe-variants.js");

const foods = [
  { id: "hafer", name: "Hafer", category: "Getreide/Stärke" },
  { id: "hirse", name: "Hirse", category: "Getreide/Stärke" },
  { id: "banane", name: "Banane", category: "Obst" },
  { id: "apfel", name: "Apfel", category: "Obst" },
  { id: "birne", name: "Birne", category: "Obst" },
  { id: "kuhmilch", name: "Kuhmilch", category: "Milchprodukt" },
  { id: "naturjoghurt", name: "Naturjoghurt", category: "Milchprodukt" },
  { id: "buttermilch", name: "Buttermilch", category: "Milchprodukt" },
  { id: "haferdrink", name: "Haferdrink", category: "Getreide/Stärke" },
];
const byId = new Map(foods.map((item) => [item.id, item]));
const byName = new Map(foods.map((item) => [item.name, item]));
const lookup = {
  byId: (id) => byId.get(id) || null,
  byName: (name) => byName.get(name) || null,
};

test("Obst-Haferbrei behandelt Hafer als fixe Basis und Obst als variablen Slot", () => {
  const recipe = { name: "Obst-Haferbrei", requires: ["Hafer"], oneOf: ["Banane", "Apfel", "Birne"] };
  const slots = mealEditorRecipeComponentSlots(recipe, lookup);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].field, "oneOf");
  assert.equal(slots[0].label, "Obst");
  assert.equal(slots[0].preparationSelectable, true);
  assert.deepEqual(slots[0].foodIds, ["banane", "apfel", "birne"]);

  assert.deepEqual(
    mealEditorRecipeConfiguredFoodIds(recipe, ["hafer", "banane"], { oneOf: "apfel" }, lookup),
    ["hafer", "apfel"],
  );
});

test("gespeicherte variable Rezeptkomponente wird aus foodIds wiederhergestellt", () => {
  const recipe = { name: "Obst-Haferbrei", requires: ["Hafer"], oneOf: ["Banane", "Apfel", "Birne"] };
  assert.deepEqual(
    mealEditorRecipeSelectionFromFoodIds(recipe, ["hafer", "birne"], lookup),
    { oneOf: "birne" },
  );
});

test("Milch-Getreide-Brei exponiert Getreide und Milch getrennt", () => {
  const recipe = {
    name: "Milch-Getreide-Brei",
    requires: [],
    oneOf: ["Hafer", "Hirse"],
    milkChoices: ["Kuhmilch", "Naturjoghurt", "Buttermilch"],
  };
  const slots = mealEditorRecipeComponentSlots(recipe, lookup);
  assert.deepEqual(slots.map((slot) => slot.field), ["oneOf", "milkChoices"]);
  assert.equal(slots[0].label, "Getreide");
  assert.equal(slots[0].preparationSelectable, false);
  assert.equal(slots[1].label, "Milch / Milchalternative");
  assert.equal(slots[1].preparationSelectable, false);
  assert.deepEqual(slots[1].foodIds, ["kuhmilch", "naturjoghurt", "buttermilch", "haferdrink"]);

  assert.deepEqual(
    mealEditorRecipeConfiguredFoodIds(recipe, ["hafer", "kuhmilch"], { oneOf: "hirse", milkChoices: "haferdrink" }, lookup),
    ["hirse", "haferdrink"],
  );
});

test("zusätzliche Milchalternative wird nur bei vorhandenem milkChoices-Slot ergänzt", () => {
  const recipe = { name: "Nur Getreide", requires: [], oneOf: ["Hafer", "Hirse"] };
  const slots = mealEditorRecipeComponentSlots(recipe, lookup);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].foodIds.includes("haferdrink"), false);
});
