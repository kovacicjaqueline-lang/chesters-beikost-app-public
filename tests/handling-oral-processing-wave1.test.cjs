"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  HANDLING_MODES,
  ORAL_PROCESSING_PROFILES,
  RECIPE_HANDLING_CONTRACT,
  RECIPE_ORAL_PROCESSING_CONTRACT,
} = require("../data/food-handling.js");

const EASY = [
  "Obst-Hafer-Pancakes",
  "Birne-Hirse-Pancakes",
  "Gemüse-Hafer-Pancakes",
  "Zucchini-Hafer-Pancakes",
  "Ube-Bananen-Pancakes",
  "Rind-Hafer-Bällchen",
  "Geflügel-Gemüse-Hafer-Bällchen",
  "Zucchini-Hafer-Puffer",
  "Omelettstreifen",
  "Zucchini-Omelett",
  "Kichererbsenmehl-Zucchini-Taler",
  "Eier-Finger",
  "Paprika-Omelettstreifen",
  "Ei-Champignon-Cups",
  "Buchweizen-Bananen-Pancakes",
  "Bananen-Joghurt-Hafer-Pancakes",
  "Obst-Joghurt-Hafer-Ofenbites",
  "Zucchini-Joghurt-Hafer-Bites",
  "Joghurt-Hafer-Waffeln",
  "Weiche Joghurt-Fladen",
];

const SOFT = [
  "Lachs-Kartoffel-Bällchen",
  "Rote-Linsen-Gemüsebällchen",
  "Tofu-Brokkoli-Bällchen",
  "Brokkoli-Kartoffel-Taler",
  "Kichererbsen-Kürbis-Taler",
  "Rote-Linsen-Bratlinge",
  "Polenta-Zucchini-Sticks",
  "Bangus-Kartoffel-Taler",
  "Süßkartoffel-Linsen-Taler",
  "Gebackene Saba-Banane",
];

const OPEN = [
  "Süßkartoffel-Hirse-Sticks",
  "Baby-Bananenbrot",
  "Obst-Hafer-Muffins",
  "Gemüse-Hafer-Muffins",
  "Kürbis-Hirse-Muffins",
  "Gemüse-Joghurt-Mini-Muffins",
  "Huhn-Gemüse-Muffins",
  "Süßkartoffel-Linsen-Muffins",
  "Fleisch-Gemüse-Bällchen",
  "Gemüse-Fleisch-Nockerl",
];

test("ORAL: drei fachlich definierte Profile sind strukturiert verfügbar", () => {
  assert.deepEqual(ORAL_PROCESSING_PROFILES, {
    SOFT_BREAKDOWN: "soft-breakdown",
    EASY_BITE_SEPARATE: "easy-bite-separate",
    STRUCTURED_CHEW_REQUIRED: "structured-chew-required",
  });
  assert.equal(Object.isFrozen(ORAL_PROCESSING_PROFILES), true);
});

test("ORAL: Wave 1 enthält exakt 30 einzeln freigegebene Rezeptfälle", () => {
  assert.equal(Object.keys(RECIPE_ORAL_PROCESSING_CONTRACT).length, 30);
  assert.deepEqual(
    Object.keys(RECIPE_ORAL_PROCESSING_CONTRACT).sort(),
    [...EASY, ...SOFT].sort(),
  );
});

test("ORAL: 20 easy-bite-separate und 10 soft-breakdown sind exakt abgebildet", () => {
  for (const name of EASY) {
    assert.equal(
      RECIPE_ORAL_PROCESSING_CONTRACT[name]?.oralProcessing,
      ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
      name,
    );
  }
  for (const name of SOFT) {
    assert.equal(
      RECIPE_ORAL_PROCESSING_CONTRACT[name]?.oralProcessing,
      ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
      name,
    );
  }
});

test("ORAL: keine aktuelle Einzelentscheidung verwendet structured-chew-required", () => {
  const profiles = Object.values(RECIPE_ORAL_PROCESSING_CONTRACT)
    .map((entry) => entry.oralProcessing);
  assert.equal(
    profiles.includes(ORAL_PROCESSING_PROFILES.STRUCTURED_CHEW_REQUIRED),
    false,
  );
});

test("ORAL: jede freigegebene Einstufung trägt eine explizite Servierbedingung", () => {
  for (const [name, entry] of Object.entries(RECIPE_ORAL_PROCESSING_CONTRACT)) {
    assert.equal(Object.isFrozen(entry), true, name);
    assert.equal(typeof entry.servingRequirement, "string", name);
    assert.ok(entry.servingRequirement.trim().length >= 20, name);
  }
});

test("ORAL: offene Grenzfälle bleiben ohne Einstufung", () => {
  for (const name of OPEN) {
    assert.equal(RECIPE_ORAL_PROCESSING_CONTRACT[name], undefined, name);
  }
  assert.equal(RECIPE_ORAL_PROCESSING_CONTRACT["Hummus mit weichen Gemüsesticks"], undefined);
  assert.equal(RECIPE_ORAL_PROCESSING_CONTRACT["Bananen-Ei-Pancakes"], undefined);
});

test("ORAL: orale Klassifikation migriert Safety-Fälle nicht automatisch aus dem Stage-Fallback", () => {
  for (const name of ["Lachs-Kartoffel-Bällchen", "Bangus-Kartoffel-Taler"]) {
    assert.ok(RECIPE_ORAL_PROCESSING_CONTRACT[name], name);
    assert.equal(RECIPE_HANDLING_CONTRACT[name], undefined, name);
  }
});

test("ORAL: Omelettstreifen bleibt der bereits migrierte frühe Referenzfall", () => {
  assert.deepEqual(
    [...RECIPE_HANDLING_CONTRACT.Omelettstreifen.modes],
    [HANDLING_MODES.FINGER_GRASPABLE],
  );
  assert.equal(
    RECIPE_ORAL_PROCESSING_CONTRACT.Omelettstreifen.oralProcessing,
    ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
  );
});

test("ORAL: die orale Map führt keine versteckte Capability ein", () => {
  for (const [name, entry] of Object.entries(RECIPE_ORAL_PROCESSING_CONTRACT)) {
    assert.equal(Object.prototype.hasOwnProperty.call(entry, "requiredCapability"), false, name);
    assert.equal(Object.prototype.hasOwnProperty.call(entry, "requiredCapabilities"), false, name);
  }
});
