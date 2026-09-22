const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const foods = fs.readFileSync(path.join(root, "js/foods.js"), "utf8");
const recipes = fs.readFileSync(path.join(root, "js/recipes.js"), "utf8");
const catalog = fs.readFileSync(path.join(root, "js/catalog-navigation.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

test("Lebensmittel- und Rezeptkarten öffnen Details; Protokollieren liegt im Detail", () => {
  assert.match(foods, /catalogLogFood/);
  assert.match(foods, /id="foodCatalogLog"/);
  assert.match(recipes, /id="recipeCatalogLog"/);
  assert.doesNotMatch(recipes, /catalogRecipeDetails/);
  assert.match(recipes, /recipe-row-chevron/);
  assert.doesNotMatch(recipes, /class="btn catalogLogRecipe"/);
});

test("Rezeptdetails werden nicht mehr inline in der Katalogliste aufgeklappt", () => {
  assert.match(recipes, /function showRecipeInfo\(r\)/);
  assert.match(recipes, /<details class="recipe-card-v2" open/);
  assert.doesNotMatch(recipes, /recipe-body-v2/);
  assert.match(catalog, /showRecipeInfo\(recipe\)/);
  assert.match(recipes, /globalThis\.showRecipeInfo = showRecipeInfo/);
});

test("Beide Katalogtypen verwenden den gemeinsamen Protokoll-Einstieg", () => {
  assert.match(catalog, /function openCatalogFoodLog\(foodId\)/);
  assert.match(catalog, /function openCatalogRecipeLog\(recipeName\)/);
  assert.match(catalog, /globalThis\.openCatalogFoodLog/);
  assert.match(catalog, /globalThis\.openCatalogRecipeLog/);
});

test("Katalogkarten und Detailansichten haben gemeinsame Aktions- und Layoutklassen", () => {
  assert.match(css, /\.catalog-card-actions\s*\{/);
  assert.match(css, /\.catalog-detail-primary-actions\s*\{/);
  assert.match(css, /\.catalog-detail-hero\s*\{/);
});

test("Rezeptdetail stellt die vorhandenen Rezept- und Handlingdaten strukturiert dar", () => {
  assert.match(recipes, /function recipeDetailIngredientItems\(r\)/);
  assert.match(recipes, /Zutaten mit Mengen/);
  assert.match(recipes, /Konsistenz &amp; Servierform/);
  assert.match(recipes, /Fingerfood &amp; Handling/);
  assert.match(recipes, /Allergene &amp; Sicherheit/);
  assert.match(recipes, /recipeDetailStructuredFoods/);
  assert.match(recipes, /preferredHandlingModes/);
  assert.match(recipes, /recipeDetailVariantBody/);
  assert.match(css, /\.recipe-detail-facts\s*\{/);
  assert.match(css, /\.recipe-detail-list\s*\{/);
  assert.match(css, /\.recipe-detail-choice\s*\{/);
});
