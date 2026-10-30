"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const quality = require("../js/planner-culinary-quality.js");

const foods = [
  { id: "hafer", name: "Hafer", category: "Getreide/Stärke" },
  { id: "polenta", name: "Polenta", category: "Getreide/Stärke" },
  { id: "bulgur", name: "Bulgur", category: "Getreide/Stärke" },
  { id: "mais", name: "Mais", category: "Getreide/Stärke" },
  { id: "birne", name: "Birne", category: "Obst" },
  { id: "zucchini", name: "Zucchini", category: "Gemüse" },
  { id: "ei", name: "Ei", category: "Ei" },
  { id: "oregano", name: "Oregano", category: "Kraut/Gewürz" },
  { id: "rapsoel", name: "Rapsöl", category: "Fett" },
];

function assessment(ids, meal = "lunch", options = {}) {
  return quality.plannerCulinaryAssessment(ids, foods, meal, options);
}

test("kulinarische Struktur verwirft freie Ei-Polenta-Kombinationen ohne Gemüse", () => {
  const result = assessment(["ei", "polenta"]);

  assert.equal(result.allowed, false);
  assert.match(result.issues.join(" "), /Gemüse|Obst/);
});

test("Würzung allein wird nicht als vollwertiges Frühstück ausgegeben", () => {
  const result = assessment(["mais", "oregano"], "breakfast");

  assert.equal(result.allowed, false);
});

test("klassische süße Frühstücksstruktur bleibt erlaubt", () => {
  const result = assessment(["hafer", "birne"], "breakfast");

  assert.equal(result.allowed, true);
  assert.equal(result.dishLike, true);
});

test("herzhafte Hauptmahlzeit kann Basis, Gemüse, Protein und Fett verbinden", () => {
  const result = assessment(["bulgur", "zucchini", "ei", "rapsoel"]);

  assert.equal(result.allowed, true);
  assert.equal(result.dishLike, true);
  assert.ok(result.score > 60);
});

test("Einzelzutat bleibt als bewusste Kostprobe möglich, aber nicht als Gericht", () => {
  const result = assessment(["ei"], "lunch", { sampleOnly: true });

  assert.equal(result.allowed, true);
  assert.equal(result.learningOnly, true);
  assert.equal(result.dishLike, false);
});

test("ein vorhandenes Rezept darf eine reduzierte Zutatenstruktur erklären", () => {
  const result = assessment(["ei", "polenta"], "lunch", { recipeBacked: true });

  assert.equal(result.allowed, true);
});

test("kuratiertes Chili mit Mais und Süßkartoffel bleibt Rezept, freie Doppelbasis nicht", () => {
  const chiliFoods = [...foods,
    { id: "suesskartoffel", name: "Süßkartoffel", category: "Wurzel/Knolle" },
    { id: "tomate", name: "Tomate", category: "Gemüse" },
    { id: "weisse-bohnen", name: "Weiße Bohnen", category: "Hülsenfrucht" },
  ];
  const ids = ["mais", "suesskartoffel", "tomate", "weisse-bohnen"];
  assert.equal(quality.plannerCulinaryAssessment(ids, chiliFoods, "lunch").allowed, false);
  assert.equal(quality.plannerCulinaryAssessment(ids, chiliFoods, "lunch", { recipeBacked: true }).allowed, true);
});

test("Bausteinprofil folgt den aktiven Phasen-Slots und lässt Snack-Semantik unberührt", () => {
  const phases = {
    kennenlernen: { meals: ["lunch"] },
    aufbau: { meals: ["lunch", "dinner"] },
    drei: { meals: ["breakfast", "lunch", "dinner"] },
    familie: { meals: ["breakfast", "lunch", "snack", "dinner"] },
  };

  assert.equal(quality.plannerMealComponentPlan("kennenlernen", "lunch", phases).count, 4);
  assert.equal(quality.plannerMealComponentPlan("aufbau", "dinner", phases).count, 3);
  assert.equal(quality.plannerMealComponentPlan("drei", "breakfast", phases).count, 3);
  assert.equal(quality.plannerMealComponentPlan("familie", "snack", phases), null);
  assert.equal(quality.plannerMealComponentPlan("kennenlernen", "dinner", phases), null);
});

test("Komponentenprüfung verlangt beim Mittagsbrei Stärke, Gemüse, Eiweiß und Fett", () => {
  const result = quality.plannerMealComponentAssessment(
    ["polenta", "zucchini", "ei"],
    foods,
    { cookingFat: "Rapsöl" },
    "kennenlernen",
    "lunch",
  );

  assert.equal(result.complete, true);
  assert.deepEqual(result.groups.sort(), ["base", "fat", "protein", "vegetable"]);
  const missingOil = quality.plannerMealComponentAssessment(
    ["polenta", "zucchini", "ei"], foods, null, "kennenlernen", "lunch",
  );
  assert.deepEqual(missingOil.missing, ["fat"]);
});

test("dreiteilige Frühstücke zählen die Zubereitungsfett-Option als eigenen Baustein", () => {
  const result = quality.plannerMealComponentAssessment(
    ["hafer", "birne", "ei"], foods, { cookingFat: "Rapsöl" }, "drei", "breakfast",
  );

  assert.equal(result.complete, true);
  assert.deepEqual(result.groups.sort(), ["base", "fat", "fruit", "protein"]);
});

test("fehlende Bausteine sperren ein vorhandenes Rezept nicht von Recipe-first aus", () => {
  const score = quality.plannerCulinaryRecipeScore(
    { category: "family" },
    ["polenta", "zucchini", "ei"],
    foods,
    "lunch",
  );

  assert.ok(score > -1000, "das Rezept bleibt auswählbar; die Planner-Ergänzung füllt erst danach verfügbare Bausteine auf");
});
