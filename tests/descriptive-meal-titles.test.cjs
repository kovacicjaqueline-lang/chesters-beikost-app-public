"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "planner-meal-presentation.js"), "utf8");

const foods = [
  { id: "banane", name: "Banane", category: "Obst", allergenGroup: "", _rank: 3, _status: "Regelmäßig" },
  { id: "nektarine", name: "Nektarine", category: "Obst", allergenGroup: "", _rank: 1, _status: "Probiert" },
  { id: "pfirsich", name: "Pfirsich", category: "Obst", allergenGroup: "", _rank: 2, _status: "Verträgliche Basis" },
  { id: "kartoffel", name: "Kartoffel", category: "Wurzel/Knolle", allergenGroup: "", _rank: 3, _status: "Regelmäßig" },
  { id: "tomate", name: "Tomate", category: "Gemüse", allergenGroup: "", _rank: 2, _status: "Verträgliche Basis" },
  { id: "huhn", name: "Huhn", category: "Fleisch", allergenGroup: "", _rank: 2, _status: "Verträgliche Basis" },
  { id: "polenta", name: "Polenta", category: "Getreide/Stärke", allergenGroup: "", _rank: 2, _status: "Verträgliche Basis" },
  { id: "brot", name: "Brot", category: "Getreide/Stärke", allergenGroup: "Glutenhaltiges Getreide", _rank: 2, _status: "Verträgliche Basis" },
  { id: "hafer", name: "Hafer", category: "Getreide/Stärke", allergenGroup: "Glutenhaltiges Getreide", _rank: 2, _status: "Verträgliche Basis" },
  { id: "hirse", name: "Hirse", category: "Getreide/Stärke", allergenGroup: "", _rank: 2, _status: "Verträgliche Basis" },
  { id: "kuhmilch", name: "Kuhmilch", category: "Milchprodukt", allergenGroup: "Milch", _rank: 2, _status: "Verträgliche Basis" },
  { id: "naturjoghurt", name: "Naturjoghurt", category: "Milchprodukt", allergenGroup: "Milch", _rank: 2, _status: "Verträgliche Basis" },
  { id: "buttermilch", name: "Buttermilch", category: "Milchprodukt", allergenGroup: "Milch", _rank: 2, _status: "Verträgliche Basis" },
  { id: "ei", name: "Ei", category: "Ei", allergenGroup: "Ei", _rank: 3, _status: "Regelmäßig" },
  { id: "erdnuss", name: "Erdnuss", category: "Nuss", allergenGroup: "Erdnuss", _rank: 3, _status: "Regelmäßig" },
  { id: "gurke", name: "Gurke", category: "Gemüse", allergenGroup: "", plannerPresentationRole: "fresh-side", _rank: 2, _status: "Verträgliche Basis" },
  { id: "suesskartoffel", name: "Süßkartoffel", category: "Wurzel/Knolle", allergenGroup: "", _rank: 2, _status: "Verträgliche Basis" },
];

const recipes = [
  {
    name: "Obst-Polentabrei",
    requires: ["Polenta"],
    oneOf: ["Pfirsich", "Banane", "Nektarine"],
  },
  {
    name: "Milch-Getreide-Brei",
    requires: [],
    oneOf: ["Hafer", "Hirse"],
    milkChoices: ["Kuhmilch", "Naturjoghurt", "Buttermilch"],
  },
];

function normalizeName(value) {
  return String(value || "")
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function naturalFoodList(names) {
  let clean = (names || []).filter(Boolean);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} und ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} und ${clean.at(-1)}`;
}

function createRuntime() {
  let runtimeFoods = JSON.parse(JSON.stringify(foods));
  let runtimeRecipes = JSON.parse(JSON.stringify(recipes));
  let byId = new Map(runtimeFoods.map((item) => [item.id, item]));
  let context = {
    console,
    state: { foods: runtimeFoods },
    food: (id) => byId.get(id) || null,
    foodByName: (name) => runtimeFoods.find((item) => normalizeName(item.name) === normalizeName(name)) || null,
    recipeByName: (name) => runtimeRecipes.find((recipe) => recipe.name === name) || null,
    normalizeName,
    naturalFoodList,
    rank: (item) => item?._rank || 0,
    status: (item) => item?._status || "Offen",
    plannerLearningRoleLabel: (item) => item?._rank === 1 ? "Wiederholung" : "Einführung",
    esc: (value) => String(value ?? ""),
    dishTitle: (meal) => meal?.recipeName || "Alt",
    mealDisplayTitle: () => "Alt",
    compactMealRolesHtml: () => "Alt",
    mealStatusText: (meal) => meal?.type || "",
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

test("FOOD-Mahlzeiten nennen die tatsächliche Zwei- und Dreierkombination", () => {
  let runtime = createRuntime();
  assert.equal(
    runtime.plannerMealDisplayTitle({ foodIds: ["banane", "nektarine"] }),
    "Banane mit Nektarine",
  );
  assert.equal(
    runtime.plannerMealDisplayTitle({ foodIds: ["kartoffel", "tomate", "huhn"] }),
    "Kartoffel mit Tomate und Huhn",
  );
});

test("bekannte FOOD-Kombinationen erhalten keine redundante Rollenliste", () => {
  let runtime = createRuntime();
  assert.equal(
    runtime.plannerCompactLearningRolesHtml({
      type: "bekannt kombinieren",
      foodIds: ["kartoffel", "tomate"],
      baseFoodIds: ["kartoffel", "tomate"],
      sampleFoodIds: [],
    }),
    "",
  );
});

test("gezielte Wiederholung zeigt nur die Lernzutat und unterdrückt den losgelösten Status", () => {
  let runtime = createRuntime();
  let meal = {
    type: "gezielt wiederholen",
    foodIds: ["banane", "nektarine"],
    baseFoodIds: ["banane"],
    sampleFoodIds: ["nektarine"],
  };
  let html = runtime.plannerCompactLearningRolesHtml(meal);
  assert.match(html, /<b>Nektarine<\/b><span>Wiederholung<\/span>/);
  assert.doesNotMatch(html, /Banane|Hauptmahlzeit/);

  assert.equal(runtime.installPlannerMealPresentationRuntime(), true);
  assert.equal(runtime.mealDisplayTitle(meal), "Banane mit Nektarine");
  assert.equal(runtime.mealStatusText(meal), "");
});

test("mehrere etablierte Allergene werden in einer Pflegezeile gruppiert", () => {
  let runtime = createRuntime();
  let html = runtime.plannerCompactLearningRolesHtml({
    type: "bekannt kombinieren",
    foodIds: ["banane", "ei", "erdnuss"],
    sampleFoodIds: [],
    allergenMaintenanceFoodIds: ["ei", "erdnuss"],
  });
  assert.match(html, /<b>Ei, Erdnuss<\/b><span>Allergen weiter anbieten<\/span>/);
  assert.equal((html.match(/compact-role-row/g) || []).length, 1);
});

test("generische Obst-Breie ersetzen Obst durch die konkreten Sorten", () => {
  let runtime = createRuntime();
  assert.equal(
    runtime.plannerMealDisplayTitle({
      recipeName: "Obst-Polentabrei",
      foodIds: ["polenta", "pfirsich"],
    }),
    "Pfirsich-Polentabrei",
  );
  assert.equal(
    runtime.plannerMealDisplayTitle({
      recipeName: "Obst-Polentabrei",
      foodIds: ["polenta", "pfirsich", "banane"],
    }),
    "Pfirsich-Bananen-Polentabrei",
  );
});

test("tatsächliche Rezept-Ergänzungen bleiben im Titel sichtbar", () => {
  let runtime = createRuntime();
  assert.equal(
    runtime.plannerMealDisplayTitle({
      recipeName: "Obst-Polentabrei",
      foodIds: ["polenta", "pfirsich", "brot"],
    }),
    "Pfirsich-Polentabrei mit Brot",
  );
  assert.equal(
    runtime.plannerMealDisplayTitle({
      recipeName: "Obst-Polentabrei",
      foodIds: ["polenta", "pfirsich", "ei"],
    }),
    "Pfirsich-Polentabrei mit Ei",
  );
});

test("Milch-Getreide-Brei nennt konkrete Milchquelle, Getreideart und Ergänzung", () => {
  let runtime = createRuntime();
  for (let [milkId, expected] of [
    ["kuhmilch", "Kuhmilch-Hafer-Brei mit Banane"],
    ["naturjoghurt", "Naturjoghurt-Hafer-Brei mit Banane"],
    ["buttermilch", "Buttermilch-Hafer-Brei mit Banane"],
  ]) {
    assert.equal(
      runtime.plannerMealDisplayTitle({
        recipeName: "Milch-Getreide-Brei",
        foodIds: [milkId, "hafer", "banane"],
      }),
      expected,
    );
  }
});

test("bestehende Kennzeichnung getrennter Komponenten bleibt erhalten", () => {
  let runtime = createRuntime();
  assert.equal(
    runtime.plannerMealDisplayTitle({
      meal: "lunch",
      foodIds: ["suesskartoffel", "gurke"],
      sampleFoodIds: [],
    }),
    "Süßkartoffel mit Gurke · getrennte Komponenten",
  );
});
