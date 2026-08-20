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
  const before = vm.runInContext("JSON.parse(JSON.stringify(RECIPES))", context);
  vm.runInContext(runtimeSource, context, { filename: "js/recipes.js" });
  const after = vm.runInContext("JSON.parse(JSON.stringify(RECIPES))", context);
  const guidance = vm.runInContext("JSON.parse(JSON.stringify(RECIPE_RESEARCH_GUIDANCE))", context);
  return { before, after, guidance };
}

test("recipe quantities: runtime catalog has 103 unique recipes after Nockerl split", () => {
  const { after } = loadCatalog();
  assert.equal(after.length, 103);
  const names = after.map((recipe) => recipe.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(names.includes("Gemüse-Fleisch-Nockerl"), false);
  for (const name of [
    "Huhn-Zucchini-Nockerl",
    "Rind-Karotten-Nockerl",
    "Linsen-Süßkartoffel-Nockerl",
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
    assert.equal(recipe.quantityGuidanceRevision, "2026-08-20", `${recipe.name}: Revision fehlt`);
  }
});

test("recipe age guidance: recommendations are soft 6/7-month orientation only", () => {
  const { after } = loadCatalog();
  for (const recipe of after) {
    assert.ok([6, 7].includes(recipe.minMonths), `${recipe.name}: unerwartete minMonths ${recipe.minMonths}`);
    assert.equal(recipe.ageGuidanceKind, "orientation", `${recipe.name}: keine Orientierungssemantik`);
  }
  assert.equal(after.find((r) => r.name === "Bananen-Ei-Pancakes").minMonths, 6);
  assert.equal(after.find((r) => r.name === "Obst-Hafer-Muffins").minMonths, 7);
  assert.equal(after.find((r) => r.name === "Joghurt-Hafer-Waffeln").minMonths, 7);
  assert.equal(after.find((r) => r.name === "Fleisch-Gemüse-Bällchen").minMonths, 7);
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

test("Nockerl split: legacy aggregate resolves only to Huhn-Zucchini default", () => {
  const { after } = loadCatalog();
  const split = after.filter((recipe) => recipe.name.endsWith("-Nockerl"));
  const owners = split.filter((recipe) =>
    (recipe.legacyNames || []).includes("Gemüse-Fleisch-Nockerl") ||
    (recipe.searchAliases || []).includes("Gemüse-Fleisch-Nockerl")
  );
  assert.deepEqual(owners.map((recipe) => recipe.name), ["Huhn-Zucchini-Nockerl"]);
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
