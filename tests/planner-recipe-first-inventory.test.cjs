"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const recipeFirst = require("../js/planner-recipe-first.js");

test("PLAN-08 recipe-first: frisches Rezept behält bereits reservierten FOOD-Vorrat", () => {
  const meal = {
    meal: "lunch",
    active: true,
    foodIds: ["huhn", "zucchini", "hafer"],
    inventoryFoodIds: ["huhn", "zucchini"],
    recipeName: "",
    recipeInventoryId: "",
    type: "bekannt",
  };
  const recipe = {
    name: "Geflügel-Gemüse-Hafer-Bällchen",
    requirementMissing: [],
  };
  const ctx = {
    inventoryReserved: new Map([["huhn", 1], ["zucchini", 1]]),
    recipeReserved: new Map(),
    recipePlannedUse: new Map(),
    fullMilkDates: new Set(),
  };

  recipeFirst.plannerPromoteMealToRecipe(
    meal,
    recipe,
    "2026-08-18",
    ctx,
    true,
    () => {
      throw new Error("Ohne Rezeptvorrat darf der Rezept-Reservierungspfad nicht laufen.");
    },
    () => 0,
  );

  assert.equal(meal.recipeName, recipe.name);
  assert.equal(meal.recipeInventoryId, "");
  assert.equal(meal.type, "Rezept");
  assert.deepEqual(meal.inventoryFoodIds, ["huhn", "zucchini"]);
  assert.equal(ctx.inventoryReserved.get("huhn"), 1);
  assert.equal(ctx.inventoryReserved.get("zucchini"), 1);
  assert.equal(ctx.recipeReserved.size, 0);
});

test("PLAN-08 recipe-first: echter Rezeptvorrat ersetzt die Einzel-FOOD-Reservierung", () => {
  const meal = {
    meal: "lunch",
    active: true,
    foodIds: ["huhn", "zucchini", "hafer"],
    inventoryFoodIds: ["huhn", "zucchini"],
    recipeName: "",
    recipeInventoryId: "",
    type: "bekannt",
  };
  const recipe = { name: "Geflügel-Gemüse-Hafer-Bällchen" };
  const ctx = {
    inventoryReserved: new Map([["huhn", 1], ["zucchini", 1]]),
    recipeReserved: new Map(),
    recipePlannedUse: new Map(),
  };

  recipeFirst.plannerPromoteMealToRecipe(
    meal,
    recipe,
    "2026-08-18",
    ctx,
    true,
    (plannedMeal, plannerContext) => {
      plannedMeal.recipeInventoryId = "recipe-batch-1";
      plannedMeal.inventoryFoodIds = [];
      plannerContext.recipeReserved.set(recipe.name, 1);
      return plannedMeal;
    },
    () => 1,
  );

  assert.equal(meal.recipeInventoryId, "recipe-batch-1");
  assert.equal(meal.type, "Rezeptvorrat");
  assert.deepEqual(meal.inventoryFoodIds, []);
  assert.equal(ctx.inventoryReserved.has("huhn"), false);
  assert.equal(ctx.inventoryReserved.has("zucchini"), false);
  assert.equal(ctx.recipeReserved.get(recipe.name), 1);
});

test("PLAN-08 recipe-first: frischer Rezept-Auto-Lock reserviert beim Neuaufbau wieder Einzelzutaten", () => {
  const meal = {
    meal: "lunch",
    active: true,
    foodIds: ["huhn", "zucchini", "hafer"],
    inventoryFoodIds: ["huhn"],
    recipeName: "Geflügel-Gemüse-Hafer-Bällchen",
    recipeInventoryId: "",
    type: "Rezept",
  };
  const ctx = { inventoryReserved: new Map() };
  let sawRecipeName = "not-called";

  const originalReserve = (plannedMeal, plannerContext) => {
    sawRecipeName = plannedMeal.recipeName;
    plannedMeal.inventoryFoodIds = ["huhn", "zucchini"];
    plannerContext.inventoryReserved.set("huhn", 1);
    plannerContext.inventoryReserved.set("zucchini", 1);
    return plannedMeal;
  };

  const result = recipeFirst.plannerReserveFreshRecipeIngredients(meal, ctx, originalReserve);

  assert.equal(sawRecipeName, "", "zentraler FOOD-Reservierungspfad muss statt Rezeptvorrat verwendet werden");
  assert.equal(result.recipeName, "Geflügel-Gemüse-Hafer-Bällchen");
  assert.deepEqual(result.inventoryFoodIds, ["huhn", "zucchini"]);
  assert.equal(ctx.inventoryReserved.get("huhn"), 1);
  assert.equal(ctx.inventoryReserved.get("zucchini"), 1);
});
