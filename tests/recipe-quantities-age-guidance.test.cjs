"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const dataSource = fs.readFileSync(path.join(ROOT, "data/recipes.js"), "utf8");
const runtimeSource = fs.readFileSync(path.join(ROOT, "js/recipes.js"), "utf8");

function hostJson(context, expression) {
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
}

function loadCatalog() {
  const context = vm.createContext({ console });
  vm.runInContext(dataSource, context, { filename: "data/recipes.js" });
  const before = hostJson(context, "RECIPES");
  vm.runInContext(runtimeSource, context, { filename: "js/recipes.js" });
  const after = hostJson(context, "RECIPES");
  const guidance = hostJson(context, "RECIPE_RESEARCH_GUIDANCE");
  return { before, after, guidance };
}

test("recipe quantities: runtime catalog has 105 unique recipes after Nockerl split and wrap additions", () => {
  const { after } = loadCatalog();
  assert.equal(after.length, 105);
  const names = after.map((recipe) => recipe.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(names.includes("Gemüse-Fleisch-Nockerl"), false);
  for (const name of [
    "Huhn-Zucchini-Nockerl",
    "Rind-Karotten-Nockerl",
    "Linsen-Süßkartoffel-Nockerl",
    "Pizza Wrap",
    "Chicken Fajita Wrap",
  ]) assert.equal(names.includes(name), true, `${name} fehlt`);
});

test("recipe quantities: every runtime recipe has explicit researched quantity guidance", () => {
  const { after, guidance } = loadCatalog();
  assert.equal(Object.keys(guidance).length, after.length);
  assert.deepEqual(
    [...Object.keys(guidance)].sort(),
    after.map((recipe) => recipe.name).sort(),
  );
  for (const recipe of after) {
    assert.equal(recipe.ingredients, guidance[recipe.name][0], `${recipe.name}: ingredients mismatch`);
    assert.match(recipe.ingredients, /\d/, `${recipe.name}: keine numerische Mengenangabe`);
    assert.equal(recipe.quantityGuidanceRevision, "2026-08-22", `${recipe.name}: Revision fehlt`);
  }
});

test("recipe age guidance: Altersangaben bleiben Orientierung und werden nicht zu hardMinMonths", () => {
  const { after } = loadCatalog();
  for (const recipe of after) {
    assert.ok(Number(recipe.minMonths) >= Number(recipe.hardMinMonths || 0), `${recipe.name}: Orientierung unter hardMinMonths`);
    assert.equal(recipe.ageGuidanceKind, "orientation", `${recipe.name}: keine Orientierungssemantik`);
  }
  assert.equal(after.find((r) => r.name === "Bananen-Ei-Pancakes").minMonths, 6);
  assert.equal(after.find((r) => r.name === "Obst-Hafer-Muffins").minMonths, 7);
  assert.equal(after.find((r) => r.name === "Joghurt-Hafer-Waffeln").minMonths, 7);
  assert.equal(after.find((r) => r.name === "Fleisch-Gemüse-Bällchen").minMonths, 7);

  const pizza = after.find((r) => r.name === "Pizza Wrap");
  assert.equal(pizza.minMonths, 9, "Pizza Wrap nutzt die 9–12-Monats-Entwicklungsorientierung für graded bite");
  assert.equal(pizza.hardMinMonths, undefined);

  const chicken = after.find((r) => r.name === "Chicken Fajita Wrap");
  assert.equal(chicken.minMonths, 12, "Chicken Fajita Wrap übernimmt die NHS-Altersorientierung");
  assert.equal(chicken.hardMinMonths, undefined);
});

test("recipe age guidance: existing hardMinMonths are never lowered or rewritten", () => {
  const { before, after } = loadCatalog();
  const beforeHard = new Map(before.map((recipe) => [recipe.name, recipe.hardMinMonths]));
  for (const recipe of after) {
    if (!beforeHard.has(recipe.name)) continue;
    assert.equal(
      recipe.hardMinMonths,
      beforeHard.get(recipe.name),
      `${recipe.name}: hardMinMonths wurde verändert`,
    );
  }
});

test("graded-bite wraps: Pizza nutzt keine erfundene Butterbohnen-Identität und Chicken bleibt echte Wrap-Form", () => {
  const { after } = loadCatalog();
  const pizza = after.find((r) => r.name === "Pizza Wrap");
  assert.deepEqual(pizza.requires, ["Weizen", "Tomate", "Käse"]);
  assert.deepEqual(pizza.oneOf, ["Champignon", "Paprika", "Zucchini"]);
  assert.equal(pizza.requires.includes("Weiße Bohnen"), false);
  assert.doesNotMatch(pizza.ingredients, /Butterbohn/i);
  assert.match(pizza.note, /nicht knusprig oder hart toasten/i);

  const chicken = after.find((r) => r.name === "Chicken Fajita Wrap");
  assert.deepEqual(chicken.requires, ["Huhn", "Paprika", "Zwiebel", "Knoblauch", "Weizen", "Naturjoghurt"]);
  assert.match(chicken.note, /eng aufrollen/i);
  assert.match(chicken.note, /vollständig durchgegart/i);
});

test("Nockerl split: ambiguous aggregate legacy names are not assigned to a concrete recipe", () => {
  const { after } = loadCatalog();
  for (const ambiguousName of [
    "Gemüse-Fleisch-Nockerl",
    "Gemüse-Fleisch-Spätzle",
    "Baby-Spätzle",
  ]) {
    const owners = after.filter((recipe) =>
      (recipe.legacyNames || []).includes(ambiguousName) ||
      (recipe.searchAliases || []).includes(ambiguousName)
    );
    assert.deepEqual(owners.map((recipe) => recipe.name), [], `${ambiguousName} darf keiner konkreten Variante zugeordnet sein`);
  }
  assert.deepEqual(
    after.find((r) => r.name === "Huhn-Zucchini-Nockerl").requires,
    ["Huhn", "Zucchini", "Weizen", "Ei", "Rapsöl"],
  );
  assert.deepEqual(
    after.find((r) => r.name === "Rind-Karotten-Nockerl").requires,
    ["Rind", "Karotte", "Weizen", "Ei", "Rapsöl"],
  );
  assert.deepEqual(
    after.find((r) => r.name === "Linsen-Süßkartoffel-Nockerl").requires,
    ["Rote Linsen", "Süßkartoffel", "Weizen", "Ei", "Rapsöl"],
  );
});

test("Nockerl split: all three recipes define reproducible soft non-rubbery preparation", () => {
  const { after } = loadCatalog();
  for (const name of [
    "Huhn-Zucchini-Nockerl",
    "Rind-Karotten-Nockerl",
    "Linsen-Süßkartoffel-Nockerl",
  ]) {
    const recipe = after.find((item) => item.name === name);
    assert.ok(recipe);
    assert.match(recipe.note, /aufschneiden/i);
    assert.match(recipe.note, /weich/i);
    assert.match(recipe.note, /gummiartig/i);
    assert.equal(recipe.stage, 3);
    assert.equal(recipe.minMonths, 7);
  }
});
