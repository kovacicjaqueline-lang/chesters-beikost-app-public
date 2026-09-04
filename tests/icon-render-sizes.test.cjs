"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const styles = read("styles.css");
const catalogNavigation = read("catalog-navigation.css");
const foodsJs = read("js/foods.js");
const indexHtml = read("index.html");

test("Icon-Rendergrößen: kompakte FOOD- und Feature-Tokens bleiben stabil", () => {
  assert.match(styles, /--icon-food\s*:\s*25px\s*;/, "globales FOOD-Token muss 25px bleiben");
  assert.match(styles, /--icon-feature\s*:\s*27px\s*;/, "globales Feature-/Recipe-Token muss 27px bleiben");
});

test("Icon-Rendergrößen: FOOD-Katalog verwendet nur dort 32px", () => {
  assert.match(
    catalogNavigation,
    /#foodsCatalogSection\s+\.foodcard\s+\.food-emoji\s*\{[^}]*--icon-food\s*:\s*32px\s*;[^}]*\}/s,
    "FOOD-Katalog braucht den lokalen 32px-Override",
  );
  assert.match(
    indexHtml,
    /<link\s+rel="stylesheet"\s+href="catalog-navigation\.css\?v=[^"]+">/,
    "catalog-navigation.css muss im App-Dokument geladen werden",
  );
});

test("Icon-Rendergrößen: FOOD-Detail behält 96px ohne konkurrierende Inline-Größe", () => {
  assert.match(
    catalogNavigation,
    /\.food-detail-hero\s*\{[^}]*--food-detail-icon-size\s*:\s*96px\s*;[^}]*grid-template-columns\s*:\s*minmax\(0,\s*1fr\)\s*var\(--food-detail-icon-size\)\s*;[^}]*min-height\s*:\s*var\(--food-detail-icon-size\)\s*;[^}]*\}/s,
    "FOOD-Detailhero muss den zentralen 96px-Detailtoken verwenden",
  );
  assert.match(
    catalogNavigation,
    /\.food-detail-hero-icon\s*\{[^}]*--icon-food\s*:\s*var\(--food-detail-icon-size\)\s*;[^}]*width\s*:\s*var\(--food-detail-icon-size\)\s*;[^}]*height\s*:\s*var\(--food-detail-icon-size\)\s*;[^}]*\}/s,
    "FOOD-Detailicon muss seine Größe ausschließlich vom Detailtoken beziehen",
  );
  assert.doesNotMatch(
    foodsJs,
    /food-detail-hero[^>]*style=/,
    "FOOD-Detailhero darf keine konkurrierende Inline-Größe mehr tragen",
  );
  assert.doesNotMatch(
    foodsJs,
    /food-detail-hero-icon[^>]*style=/,
    "FOOD-Detailicon darf keine konkurrierende Inline-Größe mehr tragen",
  );
});

test("Icon-Rendergrößen: Recipe-Karten bleiben 44px bzw. 40px schmal", () => {
  assert.match(
    styles,
    /\.recipe-card-v2 \.recipe-heading-with-icon>\.recipe-illustration\{width:44px;height:44px;flex:0 0 44px\}/,
    "Recipe-Karten müssen 44px verwenden",
  );
  assert.match(
    styles,
    /@media\(max-width:380px\)\{\.recipe-card-v2 \.recipe-heading-with-icon>\.recipe-illustration\{width:40px;height:40px;flex-basis:40px\}\}/,
    "Recipe-Karten müssen unter 380px auf 40px wechseln",
  );
});
