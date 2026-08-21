"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const handling = require("../js/handling-readiness.js");
const {
  FOOD_HANDLING_CONTRACT,
  RECIPE_HANDLING_CONTRACT,
} = require("../data/food-handling.js");

function settings(feedingApproach, extra = {}) {
  return {
    feedingApproach,
    textureStage: 1,
    handlingCapabilities: {
      smallSoftPieces: false,
      structuredChew: false,
    },
    ...extra,
  };
}

function autoDay() {
  return {
    date: "2026-08-18",
    meals: [
      {
        meal: "lunch",
        active: true,
        focusId: "karotte",
        foodIds: ["karotte", "kartoffel"],
        baseFoodIds: ["kartoffel"],
        sampleFoodIds: [],
        recipeName: "",
        type: "bekannt",
      },
    ],
  };
}

function withoutPresentationMode(value) {
  return JSON.parse(JSON.stringify(value, (key, item) =>
    key === "presentationMode" ? undefined : item,
  ));
}

test("feedingApproach: neue Auto-Planung behält bei spoon/fingerfood exakt dieselben Kandidaten", () => {
  const spoonDay = autoDay();
  const fingerDay = autoDay();

  handling.applyPresentationModesToDay(
    spoonDay,
    settings("spoon"),
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  );
  handling.applyPresentationModesToDay(
    fingerDay,
    settings("fingerfood"),
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  );

  assert.deepEqual(
    withoutPresentationMode(spoonDay),
    withoutPresentationMode(fingerDay),
    "feedingApproach darf Fokus, Komponenten, Rollen oder Rezeptidentität nicht verändern",
  );
  assert.equal(spoonDay.meals[0].presentationMode, "spoon-smooth");
  assert.equal(fingerDay.meals[0].presentationMode, "finger-graspable");
});

test("feedingApproach: Preference entfernt keine bereits sichere Darreichungsform", () => {
  const mixed = handling.foodHandlingEligibility(
    "karotte",
    settings("mixed"),
    FOOD_HANDLING_CONTRACT,
  );
  const spoon = handling.foodHandlingEligibility(
    "karotte",
    settings("spoon"),
    FOOD_HANDLING_CONTRACT,
  );
  const finger = handling.foodHandlingEligibility(
    "karotte",
    settings("fingerfood"),
    FOOD_HANDLING_CONTRACT,
  );

  assert.deepEqual(spoon.eligibleModes, mixed.eligibleModes);
  assert.deepEqual(finger.eligibleModes, mixed.eligibleModes);
  assert.deepEqual(spoon.preferredModes, [
    "spoon-smooth",
    "spoon-mashed",
    "finger-graspable",
  ]);
  assert.deepEqual(finger.preferredModes, [
    "finger-graspable",
    "spoon-smooth",
    "spoon-mashed",
  ]);
});

test("textureStage: sortiert nur bereits geeignete Löffelmodi, Fingerfood bleibt parallel", () => {
  const mixed = handling.foodHandlingEligibility(
    "karotte",
    settings("mixed", { textureStage: 2 }),
    FOOD_HANDLING_CONTRACT,
  );
  const spoon = handling.foodHandlingEligibility(
    "karotte",
    settings("spoon", { textureStage: 2 }),
    FOOD_HANDLING_CONTRACT,
  );
  const finger = handling.foodHandlingEligibility(
    "karotte",
    settings("fingerfood", { textureStage: 2 }),
    FOOD_HANDLING_CONTRACT,
  );

  assert.deepEqual(mixed.eligibleModes, [
    "spoon-smooth",
    "spoon-mashed",
    "finger-graspable",
  ]);
  assert.deepEqual(spoon.eligibleModes, mixed.eligibleModes);
  assert.deepEqual(finger.eligibleModes, mixed.eligibleModes);
  assert.deepEqual(mixed.preferredModes, [
    "spoon-mashed",
    "spoon-smooth",
    "finger-graspable",
  ]);
  assert.deepEqual(spoon.preferredModes, [
    "spoon-mashed",
    "spoon-smooth",
    "finger-graspable",
  ]);
  assert.deepEqual(finger.preferredModes, [
    "finger-graspable",
    "spoon-mashed",
    "spoon-smooth",
  ]);

  const spoonDay = autoDay();
  handling.applyPresentationModesToDay(
    spoonDay,
    settings("spoon", { textureStage: 2 }),
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  );
  assert.equal(
    spoonDay.meals[0].presentationMode,
    "spoon-mashed",
    "neue Auto-Mahlzeiten müssen die zur Texturstufe passende bereits geeignete Löffelform verwenden",
  );

  assert.deepEqual(
    handling.preferredHandlingModes(
      ["spoon-smooth", "finger-graspable", "spoon-soft-lumpy", "spoon-mashed"],
      "mixed",
      3,
    ),
    ["spoon-soft-lumpy", "finger-graspable", "spoon-mashed", "spoon-smooth"],
    "mixed darf Fingerfood nicht zur späteren Familie machen und soll nur die Löffelplätze umsortieren",
  );
});

test("feedingApproach: Präferenz umgeht weder structured-chew noch small-soft-pieces", () => {
  for (const feedingApproach of ["mixed", "spoon", "fingerfood"]) {
    const chew = handling.recipeHandlingEligibility(
      { name: "Baby-Bananenbrot" },
      settings(feedingApproach),
      RECIPE_HANDLING_CONTRACT,
    );
    assert.deepEqual(chew.eligibleModes, [], feedingApproach);
    assert.deepEqual(chew.blockedReasons, ["oral-processing-requirement"], feedingApproach);

    const small = handling.recipeHandlingEligibility(
      { name: "Huhn-Zucchini-Nockerl" },
      settings(feedingApproach),
      RECIPE_HANDLING_CONTRACT,
    );
    assert.deepEqual(small.eligibleModes, [], feedingApproach);
    assert.deepEqual(small.blockedReasons, ["handling-requirement"], feedingApproach);
  }
});

test("feedingApproach: bestätigte Fähigkeiten ändern nur Eligibility, nicht Rezeptidentität", () => {
  const chewMeal = {
    meal: "snack",
    active: true,
    focusId: "banane",
    foodIds: ["banane", "hafer", "ei"],
    baseFoodIds: ["banane"],
    sampleFoodIds: [],
    recipeName: "Baby-Bananenbrot",
    type: "bekannt",
  };
  const blocked = structuredClone(chewMeal);
  handling.applyPresentationModeToAutomaticMeal(
    blocked,
    settings("fingerfood"),
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  );
  assert.equal(Object.hasOwn(blocked, "presentationMode"), false);
  assert.equal(blocked.recipeName, "Baby-Bananenbrot");

  const ready = structuredClone(chewMeal);
  handling.applyPresentationModeToAutomaticMeal(
    ready,
    settings("fingerfood", {
      handlingCapabilities: { smallSoftPieces: false, structuredChew: true },
    }),
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  );
  assert.equal(ready.presentationMode, "finger-graspable");
  assert.equal(ready.recipeName, "Baby-Bananenbrot");
});

test("feedingApproach: PLAN-08-Rezeptidentität bleibt unverändert", () => {
  const recipeMeal = {
    meal: "breakfast",
    active: true,
    focusId: "banane",
    foodIds: ["banane", "hafer", "ei"],
    baseFoodIds: ["hafer", "ei"],
    sampleFoodIds: [],
    recipeName: "Obst-Hafer-Pancakes",
    type: "bekannt",
  };
  const mixedMeal = structuredClone(recipeMeal);
  const fingerMeal = structuredClone(recipeMeal);

  handling.applyPresentationModeToAutomaticMeal(
    mixedMeal,
    settings("mixed"),
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  );
  handling.applyPresentationModeToAutomaticMeal(
    fingerMeal,
    settings("fingerfood"),
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  );

  assert.equal(mixedMeal.recipeName, "Obst-Hafer-Pancakes");
  assert.equal(fingerMeal.recipeName, "Obst-Hafer-Pancakes");
  assert.deepEqual(mixedMeal.foodIds, recipeMeal.foodIds);
  assert.deepEqual(fingerMeal.foodIds, recipeMeal.foodIds);
  assert.equal(mixedMeal.presentationMode, "finger-graspable");
  assert.equal(fingerMeal.presentationMode, "finger-graspable");
});
