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
