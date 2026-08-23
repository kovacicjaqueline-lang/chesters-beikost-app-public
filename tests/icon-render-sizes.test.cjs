"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("Icon-Rendergrößen: Katalog vergrößert FOOD gezielt, kompakte Kontexte bleiben unverändert", () => {
  const styles = read("styles.css");
  const catalog = read("catalog-navigation.css");
  const foods = read("js/foods.js");
  const index = read("index.html");

  assert.match(styles, /--icon-food\s*:\s*25px\s*;/, "kompakter FOOD-Basistoken bleibt 25px");
  assert.match(styles, /--icon-feature\s*:\s*27px\s*;/, "kompakter Recipe-/Feature-Basistoken bleibt 27px");
  assert.match(
    catalog,
    /#foodsCatalogSection\s+\.foodcard\s+\.food-emoji\s*\{[^}]*--icon-food\s*:\s*32px\s*;/s,
    "FOOD-Katalog rendert FOOD-V2 mit 32px",
  );
  assert.match(foods, /--icon-food\s*:\s*96px/, "FOOD-Detailhero bleibt 96px");
  assert.match(index, /catalog-navigation\.css\?v=/, "Katalog-Stylesheet ist in der App geladen");
});

test("Icon-Rendergrößen: Recipe-Karten behalten 44px beziehungsweise 40px auf sehr schmalen Displays", () => {
  const styles = read("styles.css");

  assert.match(
    styles,
    /\.recipe-card-v2\s+\.recipe-heading-with-icon>\.recipe-illustration\{width:44px;height:44px;flex:0 0 44px\}/,
    "Recipe-Karten bleiben bei 44px",
  );
  assert.match(
    styles,
    /@media\(max-width:380px\)\{\.recipe-card-v2\s+\.recipe-heading-with-icon>\.recipe-illustration\{width:40px;height:40px;flex-basis:40px\}\}/,
    "Recipe-Karten bleiben auf sehr schmalen Displays bei 40px",
  );
});
