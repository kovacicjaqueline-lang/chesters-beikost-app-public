"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  RECIPE_FROZEN_INGREDIENT_GUIDANCE,
  canonicalFoodDisplayName,
  applyCanonicalFoodLabels,
  recipeFrozenIngredientCompatible,
  recipeIngredientStockSource,
  recipeStockResolution,
  recipeMatchesIngredientStock,
  recipeUsesFrozenIngredientStock,
  pantryRecipeStates,
} = require("../js/recipe-frozen-ingredient-stock.js");

const ROOT = path.resolve(__dirname, "..");
const foods = [
  { id: "kurbis", name: "Kürbis" },
  { id: "hafer", name: "Hafer" },
  { id: "zucchini", name: "Zucchini" },
  { id: "karotte", name: "Karotte" },
  { id: "suesskartoffel", name: "Süßkartoffel" },
  { id: "ei", name: "Ei" },
  { id: "pute", name: "Pute" },
];

const portions = (stock) => (id) => Number(stock[id] || 0);

test("Erbsen behalten ihre stabile ID, werden aber ohne TK-Zusatz angezeigt", () => {
  const peaFoods = [{ id: "erbsen-tk-moeglich", name: "Erbsen (TK möglich)" }];
  const peaRecipes = [
    { name: "Erbsen-Kartoffel-Stampf", requires: ["Erbsen (TK möglich)", "Kartoffel"] },
    { name: "Lachs-Reis-Erbsen", requires: ["Lachs", "Reis", "Erbsen (TK möglich)"] },
  ];

  applyCanonicalFoodLabels(peaFoods, peaRecipes);

  assert.equal(peaFoods[0].id, "erbsen-tk-moeglich");
  assert.equal(peaFoods[0].name, "Erbsen");
  assert.equal(canonicalFoodDisplayName("Erbsen (TK möglich)"), "Erbsen");
  assert.deepEqual(peaRecipes[0].requires, ["Erbsen", "Kartoffel"]);
  assert.deepEqual(peaRecipes[1].requires, ["Lachs", "Reis", "Erbsen"]);
  assert.equal(recipeFrozenIngredientCompatible(peaRecipes[0], peaFoods[0]), true);
});

test("Gefriervorrat erfüllt eine Rezeptzutat nur bei expliziter Rezeptfreigabe", () => {
  const compatible = { name: "Kürbis-Hafer-Brei", requires: ["Kürbis", "Hafer"] };
  const incompatible = { name: "Zucchini-Hafer-Pancakes", requires: ["Zucchini", "Hafer"] };
  const pantry = { hafer: true };

  assert.equal(
    recipeMatchesIngredientStock(compatible, foods, pantry, portions({ kurbis: 2 })),
    true,
  );
  assert.equal(
    recipeUsesFrozenIngredientStock(compatible, foods, pantry, portions({ kurbis: 2 })),
    true,
  );
  assert.equal(
    recipeMatchesIngredientStock(incompatible, foods, pantry, portions({ zucchini: 2 })),
    false,
  );
});

test("normale vorhandene Zutaten bleiben vom Gefrier-Gate unberührt", () => {
  const recipe = { name: "Zucchini-Hafer-Pancakes", requires: ["Zucchini", "Hafer"] };
  const pantry = { zucchini: true, hafer: true };

  assert.equal(recipeMatchesIngredientStock(recipe, foods, pantry, portions({ zucchini: 4 })), true);
  assert.equal(recipeUsesFrozenIngredientStock(recipe, foods, pantry, portions({ zucchini: 4 })), false);
  assert.equal(recipeIngredientStockSource(recipe, foods[2], pantry, 4), "pantry");
});

test("unbekannte Rezept-Zutat-Kombinationen sind konservativ nicht freigegeben", () => {
  const recipe = { name: "Nicht geprüftes Rezept", requires: ["Karotte"] };
  assert.equal(recipeFrozenIngredientCompatible(recipe, foods[3]), false);
  assert.equal(recipeIngredientStockSource(recipe, foods[3], {}, 3), "");
});

test("mehrere aufgetaute Zutaten funktionieren nur, wenn jede davon freigegeben ist", () => {
  const recipe = { name: "Karotte-Süßkartoffel-Brei", requires: ["Karotte", "Süßkartoffel"] };

  assert.equal(
    recipeMatchesIngredientStock(recipe, foods, {}, portions({ karotte: 2, suesskartoffel: 2 })),
    true,
  );
  assert.equal(
    recipeUsesFrozenIngredientStock(recipe, foods, {}, portions({ karotte: 2, suesskartoffel: 2 })),
    true,
  );
  assert.equal(
    recipeMatchesIngredientStock(recipe, foods, {}, portions({ karotte: 2 })),
    false,
  );
});

test("oneOf-Varianten brauchen ebenfalls eine tatsächlich vorhandene passende Zutat", () => {
  const recipe = {
    name: "Gemüse-Hafer-Pancakes",
    requires: ["Hafer", "Ei"],
    oneOf: ["Kürbis", "Süßkartoffel"],
  };
  const pantry = { hafer: true, ei: true };

  assert.equal(recipeMatchesIngredientStock(recipe, foods, pantry, portions({})), false);
  assert.equal(recipeMatchesIngredientStock(recipe, foods, pantry, portions({ kurbis: 1 })), true);
  assert.equal(recipeUsesFrozenIngredientStock(recipe, foods, pantry, portions({ kurbis: 1 })), true);
});

test("alternative Zutaten-Sets bleiben für normalen vorhandenen Vorrat nutzbar", () => {
  const recipe = {
    name: "Synthetisches Variantenrezept",
    requires: ["Zucchini", "Hafer"],
    alternatives: [["Pute", "Karotte", "Hafer"]],
  };
  const resolution = recipeStockResolution(
    recipe,
    foods,
    { pute: true, karotte: true, hafer: true },
    portions({}),
  );

  assert.equal(resolution.matches, true);
  assert.deepEqual(resolution.sources.map((entry) => entry.name), ["Pute", "Karotte", "Hafer"]);
  assert.equal(resolution.sources.some((entry) => entry.source === "frozen"), false);
});

test("Mit-Vorrat-Filter entfernt Rezepte mit ungeprüften Tiefkühlzutaten", () => {
  const recipes = [
    { name: "Kürbis-Hafer-Brei", requires: ["Kürbis", "Hafer"] },
    { name: "Zucchini-Hafer-Pancakes", requires: ["Zucchini", "Hafer"] },
  ];
  const result = pantryRecipeStates(
    recipes,
    foods,
    { hafer: true },
    portions({ kurbis: 2, zucchini: 2 }),
    "",
  );

  assert.deepEqual(result.map((recipe) => recipe.name), ["Kürbis-Hafer-Brei"]);
});

test("explizit rohe oder frisch geriebene Rezeptformen bleiben für FOOD-Gefriervorrat gesperrt", () => {
  for (const name of [
    "Zucchini-Hafer-Pancakes",
    "Zucchini-Hafer-Puffer",
    "Rind-Hafer-Bällchen",
    "Geflügel-Gemüse-Hafer-Bällchen",
  ]) {
    assert.equal(RECIPE_FROZEN_INGREDIENT_GUIDANCE[name], undefined, `${name} darf nicht freigegeben sein`);
  }
});

test("jede freigegebene Gefrierzutat existiert im kanonisierten echten Rezept und trägt einen Re-Freeze-Hinweis", () => {
  const foodSource = fs.readFileSync(path.join(ROOT, "data", "foods.js"), "utf8");
  const recipeSource = fs.readFileSync(path.join(ROOT, "data", "recipes.js"), "utf8");
  const sandbox = {};
  vm.runInNewContext(
    `${foodSource}\n${recipeSource}\n;globalThis.__foods = FOOD_DB; globalThis.__recipes = RECIPES;`,
    sandbox,
  );
  applyCanonicalFoodLabels(sandbox.__foods, sandbox.__recipes);
  const catalog = sandbox.__recipes;
  const peas = sandbox.__foods.find((item) => item.id === "erbsen-tk-moeglich");

  assert.equal(peas?.name, "Erbsen");
  assert.equal(
    catalog.some((recipe) => [
      ...(recipe.requires || []),
      ...(recipe.oneOf || []),
      ...(recipe.milkChoices || []),
      ...(recipe.alternatives || []).flat(),
    ].includes("Erbsen (TK möglich)")),
    false,
  );

  const entries = Object.entries(RECIPE_FROZEN_INGREDIENT_GUIDANCE);
  assert.ok(entries.length > 0);
  for (const [name, guidance] of entries) {
    const recipe = catalog.find((item) => item.name === name);
    assert.ok(recipe, `${name}: Rezept fehlt im Katalog`);
    const ingredientNames = new Set([
      ...(recipe.requires || []),
      ...(recipe.oneOf || []),
      ...(recipe.milkChoices || []),
      ...(recipe.alternatives || []).flat(),
    ]);
    assert.ok(guidance.ingredients.length > 0, `${name}: keine freigegebene Zutat`);
    for (const ingredient of guidance.ingredients)
      assert.ok(ingredientNames.has(ingredient), `${name}: ${ingredient} ist keine Rezeptzutat`);
    assert.match(guidance.note, /nicht erneut einfrier/i, `${name}: Re-Freeze-Hinweis fehlt`);
  }
});

test("Runtime wird nach prep.js geladen und für Offline-Starts vorgecached", () => {
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const prepPos = index.indexOf('src="js/prep.js?v=10.1.26"');
  const runtimePos = index.indexOf('src="js/recipe-frozen-ingredient-stock.js?v=10.1.26"');
  const statisticsPos = index.indexOf('src="js/statistics.js?v=10.1.26"');

  assert.ok(prepPos >= 0 && runtimePos > prepPos, "Runtime muss nach prep.js geladen werden");
  assert.ok(statisticsPos > runtimePos, "Runtime soll vor den nachfolgenden UI-Runtimes installiert sein");
  assert.match(sw, /\.\/js\/recipe-frozen-ingredient-stock\.js/);
});
