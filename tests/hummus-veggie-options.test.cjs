"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const recipeSource = fs.readFileSync(path.join(root, "data", "recipes.js"), "utf8");

function loadRecipes() {
  const context = vm.createContext({ console });
  vm.runInContext(recipeSource, context, { filename: "data/recipes.js" });
  return JSON.parse(vm.runInContext("JSON.stringify(RECIPES)", context));
}

test("Hummus: Kichererbse ist Pflicht, der weiche Gemüsestick ist eine echte Auswahl", () => {
  const recipe = loadRecipes().find((item) => item.name === "Hummus mit weichen Gemüsesticks");
  assert.ok(recipe, "Hummus-Rezept muss vorhanden sein");
  assert.deepEqual(recipe.requires, ["Kichererbse"]);
  assert.deepEqual(recipe.oneOf, ["Gurke", "Karotte", "Zucchini", "Süßkartoffel"]);
  assert.equal(Object.hasOwn(recipe, "alternatives"), false);
});

test("Hummus: Tahin bleibt optional und die Stick-Anforderung ist mechanisch formuliert", () => {
  const recipe = loadRecipes().find((item) => item.name === "Hummus mit weichen Gemüsesticks");
  assert.match(recipe.ingredients, /optional Tahin/i);
  assert.match(recipe.note, /mechanisch weichen/i);
  assert.match(recipe.note, /ohne harte, zähe oder spröde Bissen/i);
  assert.match(recipe.note, /Tahin nur nach eingeführtem Sesam/i);
});
