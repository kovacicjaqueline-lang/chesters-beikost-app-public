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

test("erledigte Mahlzeit verlinkt nur das tatsächlich protokollierte Rezept", () => {
  const meal = { recipeName: "Geplantes Rezept" };

  assert.equal(feature.displayedRecipeName(meal, null), "Geplantes Rezept");
  assert.equal(
    feature.displayedRecipeName(meal, { recipeName: "Tatsächlich gegessenes Rezept" }),
    "Tatsächlich gegessenes Rezept",
  );
  assert.equal(
    feature.displayedRecipeName(meal, { recipeName: "", foodIds: ["banane", "ei"] }),
    "",
    "ein FOOD-Protokoll darf nicht auf das ursprünglich geplante Rezept zurückfallen",
  );
});

test("Mahlzeitenkontext liefert konkrete Alternativen-, oneOf- und Milchhinweise", () => {
  const alternativeRecipe = {
    name: "Familienrezept",
    requires: ["Huhn", "Zucchini"],
    alternatives: [["Pute", "Karotte"]],
    variantLabels: ["Huhn + Zucchini", "Pute + Karotte"],
    legacyNames: ["Huhn-Rezept", "Pute-Rezept"],
    oneOf: [],
    milkChoices: ["Joghurt", "Milch"],
  };
  const ids = {
    Huhn: "huhn",
    Zucchini: "zucchini",
    Pute: "pute",
    Karotte: "karotte",
    Banane: "banane",
    Apfel: "apfel",
    Joghurt: "joghurt",
    Milch: "milch",
    Hafer: "hafer",
    Ei: "ei",
  };

  assert.deepEqual(
    feature.recipeContextHints(
      alternativeRecipe,
      ["pute", "karotte", "joghurt"],
      (name) => ids[name] || "",
    ),
    ["Pute + Karotte", "Joghurt"],
  );

  const oneOfRecipe = {
    name: "Obst-Hafer-Pancakes",
    requires: ["Hafer", "Ei"],
    alternatives: [],
    variantLabels: ["Banane", "Apfel", "Mango"],
    legacyNames: ["Banane-Hafer-Pancakes", "Apfel-Hafer-Pancakes", "Mango-Hafer-Pancakes"],
    oneOf: ["Banane", "Apfel"],
    milkChoices: [],
  };
  assert.deepEqual(
    feature.recipeContextHints(
      oneOfRecipe,
      ["hafer", "ei", "apfel"],
      (name) => ids[name] || "",
    ),
    ["Apfel"],
    "oneOf-Familien dürfen nicht den ersten variantLabel zusätzlich auswählen",
  );
});

test("Rezepttitel wird zugängliches iPhone-Touchziel mit Mahlzeitenkontext", () => {
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

  feature.markRecipeTitle(node, "Bananen-Ei-Pancakes", ["banane", "ei"]);

  assert.equal(node.dataset.plannedRecipeName, "Bananen-Ei-Pancakes");
  assert.equal(node.dataset.plannedRecipeFoodIds, "banane,ei");
  assert.equal(attributes.role, "button");
  assert.equal(attributes.tabindex, "0");
  assert.equal(attributes["aria-label"], "Rezept Bananen-Ei-Pancakes öffnen");
  assert.equal(node.style.minHeight, "44px");
  assert.equal(node.style.touchAction, "manipulation");
  assert.ok(classes.has("planned-recipe-title"));
  assert.equal(children.length, 1);
  assert.equal(children[0].textContent, "›");

  feature.markRecipeTitle(node, "Bananen-Ei-Pancakes", ["banane", "ei"]);
  assert.equal(children.length, 1);
});

test("Feature nutzt zentrale Rezeptauflösung, wird korrekt geladen und offline vorgecached", () => {
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
  assert.match(featureSource, /recipeByName\(storedName\)/);
  assert.doesNotMatch(featureSource, /recipeAliasValuesLocal|storedRecipeRecord/);
  assert.match(featureSource, /renderRecipeCard\(recipe\)/);
  assert.match(featureSource, /renderHomeWithPlannedRecipeDetails/);
  assert.match(featureSource, /renderPlanWithPlannedRecipeDetails/);
  assert.match(featureSource, /\.dish-title, \.manual-meal-title/);
  assert.match(featureSource, /\.completed-title/);
});
