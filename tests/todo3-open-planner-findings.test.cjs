const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  applyFoodPolicyData,
  plannerFoodCanBeBase,
  plannerFoodCanBeAutomaticFocus,
  plannerRecipeSuitableForMeal,
} = require('../app.js');

const root = path.resolve(__dirname, '..');

function loadRecipes() {
  const source = fs.readFileSync(path.join(root, 'data', 'recipes.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__RECIPES = RECIPES;`, context);
  return context.__RECIPES;
}

function loadFoods() {
  const source = fs.readFileSync(path.join(root, 'data', 'foods.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__FOODS = FOOD_DB;`, context);
  return context.__FOODS;
}

function loadRecipeSuitability() {
  const source = fs.readFileSync(path.join(root, 'js', 'planning.js'), 'utf8');
  const context = {
    status: () => 'Offen',
    normalizeName: (value) => String(value || '').toLowerCase(),
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__recipeSuitableForMeal = recipeSuitableForMeal;`, context);
  return context.__recipeSuitableForMeal;
}

test('TODO3 SNACK-CHAR: Snack-Eignung kommt aus dem Rezept-Tag, nicht aus einem allgemeinen FOOD-snack-Feld', () => {
  const suitable = loadRecipeSuitability();
  assert.equal(suitable({ category: 'baking', tags: [] }, 'snack'), false);
  assert.equal(suitable({ category: 'baking', tags: ['Snack'] }, 'snack'), true);
  assert.equal(suitable({ category: 'balls', tags: ['SNACK'] }, 'snack'), true);
});

test('TODO3 FOOD-ROLE-CHAR: Referenzfall Haferdrink hat technisch dieselbe grobe Kategorie und Hauptmahlzeiten-Eignung wie Getreide', () => {
  const foods = loadFoods();
  const drink = foods.find((food) => food.id === 'haferdrink');
  assert.ok(drink);
  assert.equal(drink.category, 'Getreide/Stärke');
  assert.ok((drink.meals || []).includes('breakfast'));
  assert.ok((drink.meals || []).includes('lunch'));
  assert.ok((drink.meals || []).includes('dinner'));
});

test('TODO3 FOOD-ROLE-01: Haferdrink darf trotz meals/Kategorie/Vertrauen nicht zur normalen automatischen Mahlzeitenbasis oder zum normalen Basis-Fokus werden', () => {
  const foods = loadFoods();
  applyFoodPolicyData(foods, {});
  const drink = foods.find((food) => food.id === 'haferdrink');
  assert.ok(drink);
  assert.equal(drink.plannerRole, 'component');
  assert.equal(plannerFoodCanBeBase(drink), false);
  assert.equal(plannerFoodCanBeAutomaticFocus(drink), false);
});

test('TODO3 RECIPE-MEAL-CHAR: Huhn-Gemüse-Muffins liegt im aktuellen Datenmodell in der groben Kategorie baking', () => {
  const recipes = loadRecipes();
  const muffins = recipes.find((recipe) => recipe.name === 'Huhn-Gemüse-Muffins');
  assert.ok(muffins);
  assert.equal(muffins.category, 'baking');
});

test('TODO3 RECIPE-MEAL-01: grobe Kategorie baking darf Huhn-Gemüse-Muffins nicht allein automatisch frühstückstauglich machen', () => {
  const recipes = loadRecipes();
  const muffins = recipes.find((recipe) => recipe.name === 'Huhn-Gemüse-Muffins');
  assert.ok(muffins);
  assert.equal(plannerRecipeSuitableForMeal(muffins, 'breakfast'), false);
  assert.equal(plannerRecipeSuitableForMeal(muffins, 'snack'), true);
});
