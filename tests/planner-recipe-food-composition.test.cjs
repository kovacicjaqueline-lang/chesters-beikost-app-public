const test = require("node:test");
const assert = require("node:assert/strict");
const feature = require("../js/planner-recipe-food-composition.js");

const foods = [
  { id: "karotte", name: "Karotte", category: "Gemüse" },
  { id: "polenta", name: "Polenta", category: "Getreide/Stärke" },
  { id: "rind", name: "Rind", category: "Fleisch" },
  { id: "kartoffel", name: "Kartoffel", category: "Wurzel/Knolle" },
];

const recipes = [
  {
    name: "Karotten-Polenta-Brei",
    category: "porridge",
    requires: ["Karotte", "Polenta"],
  },
];

const pairings = [
  {
    key: "karotten-polenta-brei+rind",
    recipeName: "Karotten-Polenta-Brei",
    meals: ["lunch", "dinner"],
    additionalFoodIds: ["rind"],
    priority: 10,
  },
];

test("Recipe-plus-food: Rind kann mit Karotten-Polenta-Brei kombiniert werden", () => {
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "rind",
    foodIds: ["rind", "karotte"],
    baseFoodIds: ["karotte"],
    sampleFoodIds: [],
  };

  const candidates = feature.plannerRecipeFoodCompositionCandidates(
    meal,
    recipes,
    foods,
    pairings,
    {
      recipeSuitableFn: () => true,
      ingredientReadyFn: () => true,
      foodEligibleFn: () => true,
      milkCompatibleFn: () => true,
    },
  );

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].recipeIngredientFoodIds, ["karotte", "polenta"]);
  assert.equal(candidates[0].additionalFoodId, "rind");
});

test("Recipe-plus-food: ein zweites Stärke-Lebensmittel wird ausgeschlossen", () => {
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "rind",
    foodIds: ["rind"],
    baseFoodIds: [],
    sampleFoodIds: [],
  };
  const starchPairing = [{
    ...pairings[0],
    recipeName: "Karotten-Kartoffel-Brei",
  }];
  const starchRecipes = [{
    name: "Karotten-Kartoffel-Brei",
    requires: ["Polenta", "Kartoffel"],
  }];

  const candidates = feature.plannerRecipeFoodCompositionCandidates(
    meal,
    starchRecipes,
    foods,
    starchPairing,
    { recipeSuitableFn: () => true, ingredientReadyFn: () => true, foodEligibleFn: () => true },
  );

  assert.equal(candidates.length, 0);
});

test("Recipe-plus-food: Rollen und persistierbare Zusammensetzung bleiben getrennt", () => {
  const meal = {
    meal: "lunch",
    active: true,
    focusId: "rind",
    foodIds: ["rind", "karotte"],
    baseFoodIds: ["karotte"],
    sampleFoodIds: ["rind"],
    type: "neu",
  };
  const result = feature.plannerApplyRecipeFoodComposition(meal, {
    key: "karotten-polenta-brei+rind",
    recipe: recipes[0],
    recipeIngredientFoodIds: ["karotte", "polenta"],
    additionalFoodId: "rind",
  });

  assert.deepEqual(result.foodIds, ["rind", "karotte", "polenta"]);
  assert.deepEqual(result.recipeIngredientFoodIds, ["karotte", "polenta"]);
  assert.deepEqual(result.additionalFoodIds, ["rind"]);
  assert.deepEqual(result.sampleFoodIds, ["rind"]);
  assert.equal(result.compositionMode, "recipe-plus-food");
  assert.deepEqual(result.foodRoles, {
    karotte: "base",
    polenta: "base",
    rind: "sample",
  });
  assert.match(result.note, /Rind.*Karotten-Polenta-Brei/i);
});

test("Recipe-plus-food: automatische und manuelle Mahlzeiten bleiben unverändert", () => {
  for (const meal of [
    { meal: "lunch", active: true, empty: true, focusId: "rind" },
    { meal: "lunch", active: true, manualAdded: true, focusId: "rind" },
    { meal: "lunch", active: true, lockedMode: "manual", focusId: "rind" },
    { meal: "snack", active: true, focusId: "rind" },
  ]) {
    assert.deepEqual(
      feature.plannerRecipeFoodCompositionCandidates(meal, recipes, foods, pairings),
      [],
    );
  }
});
