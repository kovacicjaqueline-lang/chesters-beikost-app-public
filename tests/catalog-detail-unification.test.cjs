const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const foods = fs.readFileSync(path.join(root, "js/foods.js"), "utf8");
const recipes = fs.readFileSync(path.join(root, "js/recipes.js"), "utf8");
const catalog = fs.readFileSync(path.join(root, "js/catalog-navigation.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

test("Lebensmittelkarten bieten dieselben Katalogaktionen wie Rezeptkarten", () => {
  assert.match(foods, /catalogLogFood/);
  assert.match(foods, /id="foodCatalogLog"/);
  assert.match(recipes, /catalogLogRecipe/);
  assert.match(recipes, /catalogRecipeDetails/);
});

test("Rezeptdetails werden nicht mehr inline in der Katalogliste aufgeklappt", () => {
  assert.match(recipes, /function showRecipeInfo\(r\)/);
  assert.match(recipes, /<details class="recipe-card-v2" open/);
  assert.doesNotMatch(recipes, /recipe-body-v2/);
  assert.match(catalog, /showRecipeInfo\(recipe\)/);
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
