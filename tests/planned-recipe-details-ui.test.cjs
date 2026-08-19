"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const feature = require("../js/planned-recipe-details.js");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const featureSource = fs.readFileSync(
  path.join(root, "js", "planned-recipe-details.js"),
  "utf8",
);

test("geplanter Rezeptname löst aktuelle, Legacy- und Suchalias-Namen auf", () => {
  let canonical = { name: "Aktuelles Rezept" };
  let recipes = [{
    name: "Aktuelles Rezept",
    legacyNames: ["Altes Rezept"],
    searchAliases: ["Rezept Alias"],
  }];
  let states = [canonical];

  assert.equal(
    feature.recipeStateForStoredName("Aktuelles Rezept", recipes, states),
    canonical,
  );
  assert.equal(
    feature.recipeStateForStoredName("Altes Rezept", recipes, states),
    canonical,
  );
  assert.equal(
    feature.recipeStateForStoredName("Rezept Alias", recipes, states),
    canonical,
  );
  assert.equal(
    feature.recipeStateForStoredName("Unbekannt", recipes, states),
    null,
  );
});

test("Rezepttitel wird zugängliches iPhone-Touchziel mit Chevron", () => {
  let attributes = {};
  let children = [];
  let classes = new Set();
  let ownerDocument = {
    createElement() {
      return {
        className: "",
        textContent: "",
        style: {},
        attrs: {},
        setAttribute(name, value) {
          this.attrs[name] = String(value);
        },
      };
    },
  };
  let node = {
    dataset: {},
    style: {},
    ownerDocument,
    classList: { add(name) { classes.add(name); } },
    setAttribute(name, value) { attributes[name] = String(value); },
    querySelector(selector) {
      return selector === ".planned-recipe-chevron"
        ? children.find((child) => child.className === "planned-recipe-chevron") || null
        : null;
    },
    appendChild(child) { children.push(child); },
  };

  feature.markRecipeTitle(node, "Bananen-Ei-Pancakes");

  assert.equal(node.dataset.plannedRecipeName, "Bananen-Ei-Pancakes");
  assert.equal(attributes.role, "button");
  assert.equal(attributes.tabindex, "0");
  assert.equal(attributes["aria-label"], "Rezept Bananen-Ei-Pancakes öffnen");
  assert.equal(node.style.minHeight, "44px");
  assert.equal(node.style.touchAction, "manipulation");
  assert.ok(classes.has("planned-recipe-title"));
  assert.equal(children.length, 1);
  assert.equal(children[0].textContent, "›");

  feature.markRecipeTitle(node, "Bananen-Ei-Pancakes");
  assert.equal(children.length, 1);
});

test("Feature wird nach UI und vor App geladen und offline vorgecached", () => {
  let uiIndex = indexSource.indexOf('js/ui.js?v=10.1.25');
  let featureIndex = indexSource.indexOf('js/planned-recipe-details.js?v=10.1.25');
  let appIndex = indexSource.indexOf('app.js?v=10.1.25');

  assert.ok(uiIndex >= 0);
  assert.ok(featureIndex > uiIndex);
  assert.ok(appIndex > featureIndex);
  assert.match(
    swSource,
    /const UI_PRECACHE\s*=\s*\[[\s\S]*\.\/js\/planned-recipe-details\.js[\s\S]*\]/,
  );
  assert.match(featureSource, /renderRecipeCard\(recipe\)/);
  assert.match(featureSource, /renderHomeWithPlannedRecipeDetails/);
  assert.match(featureSource, /renderPlanWithPlannedRecipeDetails/);
  assert.match(
    featureSource,
    /\.dish-title, \.manual-meal-title/,
  );
  assert.match(featureSource, /\.completed-title/);
});
