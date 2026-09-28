"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const recipesSource = fs.readFileSync(path.join(root, "data", "recipes.js"), "utf8");
const recipeRuntimeSource = fs.readFileSync(path.join(root, "js", "recipes.js"), "utf8");
const handlingContractSource = fs.readFileSync(path.join(root, "data", "food-handling.js"), "utf8");

function catalog() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(recipesSource, context);
  vm.runInContext(recipeRuntimeSource, context);
  const recipe = JSON.parse(vm.runInContext(
    'JSON.stringify(RECIPES.find((item) => item.name === "Bananen-Hirseschnitten") || null)',
    context,
  ));
  vm.runInContext(handlingContractSource, context);
  const contract = JSON.parse(vm.runInContext(
    'JSON.stringify(RECIPE_HANDLING_CONTRACT["Bananen-Hirseschnitten"] || null)',
    context,
  ));
  return { recipe, contract };
}

test("Bananen-Hirseschnitten: Laufzeitrezept enthält reproduzierbare Zutaten und sichere Zubereitung", () => {
  const { recipe } = catalog();
  assert.ok(recipe, "Rezept muss im Laufzeitkatalog vorhanden sein");
  assert.equal(recipe.category, "baking");
  assert.deepEqual(recipe.requires, ["Hirse", "Banane", "Mandel"]);
  assert.deepEqual(recipe.milkChoices, ["Haferdrink"]);
  assert.equal(recipe.stage, 2);
  assert.equal(recipe.freezable, true);
  assert.equal(recipe.minMonths, 7);
  assert.equal(recipe.quantityGuidanceRevision, "2026-08-22");
  assert.match(recipe.ingredients, /100 g Hirse/);
  assert.match(recipe.ingredients, /300 ml ungesüßter Haferdrink/);
  assert.match(recipe.ingredients, /15 g weißes Mandelmus/);
  assert.match(recipe.note, /vollständig auskühlen/i);
  assert.match(recipe.note, /sehr weich/i);
  assert.match(recipe.note, /keine ganzen oder gehackten Nüsse/i);
});

test("Bananen-Hirseschnitten: Handling ist weiches greifbares Fingerfood ohne zusätzliche Capability", () => {
  const { contract } = catalog();
  assert.ok(contract, "expliziter Handling-Contract fehlt");
  assert.deepEqual(contract.modes, ["finger-graspable"]);
  assert.equal(contract.biteSeparation, "easy-bite-separate");
  assert.equal(contract.oralProcessing, "soft-breakdown");
  assert.equal(contract.biteRequiredCapability, undefined);
  assert.equal(contract.oralRequiredCapability, undefined);
  assert.match(contract.servingRequirement, /zwischen zwei Fingern leicht zerdrückbar/i);
  assert.match(contract.servingRequirement, /keine ganzen oder gehackten Nüsse/i);
});
