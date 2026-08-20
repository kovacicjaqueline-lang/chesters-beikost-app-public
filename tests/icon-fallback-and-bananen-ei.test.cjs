"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ICONS_SOURCE = fs.readFileSync(path.join(__dirname, "..", "js", "icons.js"), "utf8");

function iconRuntime() {
  const foods = [
    { id: "banane", name: "Banane", category: "Obst" },
    { id: "ohne-icon", name: "Ohne Icon", category: "Obst" },
  ];
  const recipes = [
    { name: "Bananen-Ei-Pancakes" },
    { name: "Rezept ohne Icon" },
  ];
  const listeners = {};
  const context = {
    FOOD_DB: foods,
    RECIPES: recipes,
    console: { error() {} },
    document: {
      addEventListener(type, listener) { listeners[type] = listener; },
    },
    esc: (value) => String(value ?? ""),
    food: (id) => foods.find((item) => item.id === id) || null,
  };
  vm.createContext(context);
  vm.runInContext(ICONS_SOURCE, context, { filename: "js/icons.js" });
  return { context, listeners };
}

test("Bananen-Ei-Pancakes nutzt ein passendes vorhandenes Pancake-V2-Motiv", () => {
  const { context } = iconRuntime();
  const markup = vm.runInContext('recipeIconSvg("Bananen-Ei-Pancakes")', context);

  assert.match(markup, /assets\/illustrations-v2\/recipes\/buchweizen-bananen-pancakes\.svg\?v=10\.1\.25/);
  assert.doesNotMatch(markup, /illustration-missing/);
  assert.deepEqual(Array.from(vm.runInContext("auditIllustrationCoverage().recipesMissing", context)), ["Rezept ohne Icon"]);
});

test("fehlende FOOD- und Recipe-Illustrationen rendern gar kein Bild", () => {
  const { context } = iconRuntime();

  assert.equal(vm.runInContext('foodIllustrationPath(FOOD_DB.find((item) => item.id === "ohne-icon"))', context), "");
  assert.equal(vm.runInContext('foodIconSvg("ohne-icon")', context), "");
  assert.equal(vm.runInContext('recipeIconSvg("Rezept ohne Icon")', context), "");
  assert.equal(vm.runInContext('illustrationMissingMarkup("Fehlt", "recipe")', context), "");
});

test("ungültige illustrationId fällt nur auf ein echtes id-Mapping zurück", () => {
  const { context } = iconRuntime();

  assert.match(
    vm.runInContext('foodIllustrationPath({ ...FOOD_DB[0], illustrationId: "__missing__" })', context),
    /assets\/illustrations-v2\/foods\/banane\.svg$/,
  );
  assert.equal(
    vm.runInContext('foodIllustrationPath({ ...FOOD_DB[1], illustrationId: "__missing__" })', context),
    "",
  );
});
