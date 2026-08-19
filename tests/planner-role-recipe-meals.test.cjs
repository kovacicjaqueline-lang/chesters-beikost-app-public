const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  applyFoodPolicyData,
  plannerRole,
  plannerFoodCanBeBase,
  plannerFoodCanBeAutomaticFocus,
  plannerManualRole,
  plannerFoodOverrideMode,
  plannerExplicitOverrideForFood,
  plannerPlanningRank,
  plannerFoodIsTrustedBase,
  plannerAutomaticLockRoleViolation,
  plannerRecipeSuitableForMeal,
  plannerRecipeByStoredName,
  plannerAutomaticRecipeLockMealViolation,
  plannerManualComponentBaseViolation,
  pruneIneligibleAutomaticPlanState,
} = require('../app.js');

function baseFoods() {
  return [
    { id: 'mais-polenta', name: 'Mais', alias: 'Mais/Polenta', category: 'Getreide/Stärke', priority: 1, active: true, allergenGroup: '', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'polenta', name: 'Polenta', category: 'Getreide/Stärke', priority: 2, active: true, allergenGroup: '', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'sesam', name: 'Sesam', category: 'Samen', priority: 3, active: true, allergenGroup: 'Sesam', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'tahin', name: 'Tahin', category: 'Samen', priority: 4, active: true, allergenGroup: 'Sesam', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'hafer', name: 'Hafer', category: 'Getreide/Stärke', priority: 5, active: true, allergenGroup: '', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'haferdrink', name: 'Haferdrink', category: 'Getreide/Stärke', priority: 6, active: true, allergenGroup: '', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
  ];
}

function loadRecipes() {
  const recipesSource = fs.readFileSync(path.resolve(__dirname, '..', 'data', 'recipes.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${recipesSource}\nthis.__recipes = RECIPES;`, context);
  return context.__recipes;
}

test('Planner-Rolle wird nur den bestätigten Komponentenformen zugewiesen', () => {
  const foods = baseFoods();
  applyFoodPolicyData(foods, {});

  assert.equal(plannerRole(foods.find((food) => food.id === 'haferdrink')), 'component');
  assert.equal(plannerRole(foods.find((food) => food.id === 'tahin')), 'component');

  assert.equal(plannerRole(foods.find((food) => food.id === 'hafer')), '');
  assert.equal(plannerRole(foods.find((food) => food.id === 'sesam')), '');
  assert.equal(plannerRole(foods.find((food) => food.id === 'mais')), '');
  assert.equal(plannerRole(foods.find((food) => food.id === 'polenta')), '');
});

test('gemeinsame Lebensmittel-/Allergenfamilien vererben keine Planner-Rolle', () => {
  const foods = baseFoods();
  applyFoodPolicyData(foods, {});

  const hafer = foods.find((food) => food.id === 'hafer');
  const haferdrink = foods.find((food) => food.id === 'haferdrink');
  const sesam = foods.find((food) => food.id === 'sesam');
  const tahin = foods.find((food) => food.id === 'tahin');

  assert.equal(hafer.foodFamily, haferdrink.foodFamily);
  assert.equal(sesam.foodFamily, tahin.foodFamily);
  assert.equal(plannerFoodCanBeBase(hafer), true);
  assert.equal(plannerFoodCanBeBase(haferdrink), false);
  assert.equal(plannerFoodCanBeBase(sesam), true);
  assert.equal(plannerFoodCanBeBase(tahin), false);
});

test('Komponentenformen sind keine automatische Basis oder normaler Auto-Focus', () => {
  const component = { id: 'x', plannerRole: 'component' };
  const normal = { id: 'y' };

  assert.equal(plannerFoodCanBeBase(component), false);
  assert.equal(plannerFoodCanBeAutomaticFocus(component), false);
  assert.equal(plannerFoodCanBeBase(normal), true);
  assert.equal(plannerFoodCanBeAutomaticFocus(normal), true);
});

test('Expliziter Override einer Komponentenform bleibt unabhängig vom Rang eine Kostprobe', () => {
  const component = { id: 'haferdrink', plannerRole: 'component' };
  const normal = { id: 'hafer' };
  const overrides = { '2026-08-18|lunch': 'haferdrink' };

  assert.equal(plannerFoodOverrideMode(normal, 3), 'focus');
  assert.equal(plannerFoodOverrideMode(component, 0), 'sample');
  assert.equal(plannerFoodOverrideMode(component, 1), 'sample');
  assert.equal(plannerFoodOverrideMode(component, 2), 'sample');
  assert.equal(plannerFoodOverrideMode(component, 3), 'sample');

  assert.equal(plannerExplicitOverrideForFood(overrides, '2026-08-18', 'haferdrink'), true);
  assert.equal(plannerExplicitOverrideForFood(overrides, '2026-08-19', 'haferdrink'), false);
  assert.equal(plannerPlanningRank(component, 0, 3, true), 0);
  assert.equal(plannerPlanningRank(component, 3, 3, true), 1);
  assert.equal(plannerPlanningRank(component, 3, 3, false), 3);
  assert.equal(plannerPlanningRank(normal, 3, 3, true), 3);
  assert.equal(plannerFoodIsTrustedBase(component, true), false);
  assert.equal(plannerFoodIsTrustedBase(normal, true), true);
});

test('manuelle verträgliche Komponentenform wird nicht zur Hauptbasis hochgestuft', () => {
  const component = { id: 'haferdrink', plannerRole: 'component' };
  assert.equal(plannerManualRole(component, 'base'), 'component');
  assert.equal(plannerManualRole(component, 'sample'), 'sample');
  assert.equal(plannerManualRole({ id: 'hafer' }, 'base'), 'base');
});

test('manuelle Komponentenform braucht nur als mahlzeitentragende Komponente eine echte Hauptbasis', () => {
  const foods = baseFoods();
  applyFoodPolicyData(foods, {});

  const componentOnly = {
    ok: true,
    ids: ['haferdrink'],
    bases: [],
    samples: [],
    components: ['haferdrink'],
    messages: [],
    message: '',
  };
  const blocked = plannerManualComponentBaseViolation(componentOnly, foods, '');
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.plannerComponentWithoutBaseIds, ['haferdrink']);
  assert.match(blocked.message, /Hauptbasis/);

  const sampleOnly = {
    ok: true,
    ids: ['haferdrink'],
    bases: [],
    samples: ['haferdrink'],
    components: [],
    messages: [],
    message: '',
  };
  const allowedSample = plannerManualComponentBaseViolation(sampleOnly, foods, '');
  assert.equal(allowedSample.ok, true);
  assert.equal(allowedSample.plannerComponentWithoutBaseIds, undefined);

  const withBase = {
    ok: true,
    ids: ['hafer', 'haferdrink'],
    bases: ['hafer'],
    samples: [],
    components: ['haferdrink'],
    messages: [],
    message: '',
  };
  assert.equal(plannerManualComponentBaseViolation(withBase, foods, '').ok, true);

  const recipeContext = {
    ok: true,
    ids: ['haferdrink'],
    bases: ['haferdrink'],
    samples: [],
    components: [],
    messages: [],
    message: '',
  };
  assert.equal(plannerManualComponentBaseViolation(recipeContext, foods, 'Testrezept').ok, true);
});

test('Planner-Rolle wird nicht aus safeForm oder prep-Freitext abgeleitet', () => {
  const freeTextOnly = {
    id: 'freitext-zutat',
    safeForm: 'Nur als Zutat verwenden.',
    prep: 'frisch als Zutat',
  };
  assert.equal(plannerRole(freeTextOnly), '');
  assert.equal(plannerFoodCanBeBase(freeTextOnly), true);
});

test('alte automatische Komponenten-Locks werden bereinigt, legitime Sample-, Rezept- und manuelle Locks bleiben', () => {
  const foods = [
    { id: 'hafer', plannerRole: '' },
    { id: 'haferdrink', plannerRole: 'component' },
    { id: 'tahin', plannerRole: 'component' },
  ];
  const invalidFocusKey = '2026-08-18|breakfast';
  const invalidBaseKey = '2026-08-18|lunch';
  const validSampleKey = '2026-08-19|breakfast';
  const validRecipeKey = '2026-08-19|lunch';
  const manualKey = '2026-08-19|dinner';
  const validPureSampleKey = '2026-08-20|breakfast';
  const invalidFollowUpKey = '2026-08-20|lunch';
  const state = {
    foods,
    settings: {},
    overrides: {
      [invalidFocusKey]: 'haferdrink',
      [validSampleKey]: 'haferdrink',
      [validPureSampleKey]: 'haferdrink',
      [invalidFollowUpKey]: 'tahin',
    },
    followUps: {
      tahin: { status: 'scheduled', dueDate: '2026-08-20' },
    },
    planLocks: {
      [invalidFocusKey]: {
        mode: 'auto', focusId: 'haferdrink', foodIds: ['haferdrink'],
        baseFoodIds: [], sampleFoodIds: [], type: 'bekannt', recipeName: '',
      },
      [invalidBaseKey]: {
        mode: 'auto', focusId: 'hafer', foodIds: ['hafer', 'haferdrink'],
        baseFoodIds: ['haferdrink'], sampleFoodIds: [], type: 'bekannt', recipeName: '',
      },
      [validSampleKey]: {
        mode: 'auto', focusId: 'haferdrink', foodIds: ['hafer', 'haferdrink'],
        baseFoodIds: ['hafer'], sampleFoodIds: ['haferdrink'], type: 'manuell', recipeName: '',
      },
      [validRecipeKey]: {
        mode: 'auto', focusId: 'haferdrink', foodIds: ['haferdrink'],
        baseFoodIds: ['haferdrink'], sampleFoodIds: [], type: 'Rezeptvorrat', recipeName: 'Unbekanntes Legacy-Rezept',
      },
      [manualKey]: {
        mode: 'manual', focusId: 'haferdrink', foodIds: ['haferdrink'],
        baseFoodIds: ['haferdrink'], sampleFoodIds: [], type: 'bekannt', recipeName: '',
      },
      [validPureSampleKey]: {
        mode: 'auto', focusId: 'haferdrink', foodIds: ['haferdrink'],
        baseFoodIds: [], sampleFoodIds: ['haferdrink'], type: 'manuell', recipeName: '',
      },
      [invalidFollowUpKey]: {
        mode: 'auto', focusId: 'tahin', foodIds: ['tahin'],
        baseFoodIds: [], sampleFoodIds: ['tahin'], type: 'gezielt wiederholen', recipeName: '',
        followUpFoodId: 'tahin',
      },
    },
  };

  assert.equal(plannerAutomaticLockRoleViolation(state.planLocks[invalidFocusKey], foods), true);
  assert.equal(plannerAutomaticLockRoleViolation(state.planLocks[invalidBaseKey], foods), true);
  assert.equal(plannerAutomaticLockRoleViolation(state.planLocks[validSampleKey], foods), false);
  assert.equal(plannerAutomaticLockRoleViolation(state.planLocks[validPureSampleKey], foods), false);
  assert.equal(plannerAutomaticLockRoleViolation(state.planLocks[validRecipeKey], foods), false);
  assert.equal(plannerAutomaticLockRoleViolation(state.planLocks[manualKey], foods), false);

  assert.equal(pruneIneligibleAutomaticPlanState(state, []), true);
  assert.equal(state.planLocks[invalidFocusKey], undefined);
  assert.equal(state.planLocks[invalidBaseKey], undefined);
  assert.ok(state.planLocks[validSampleKey]);
  assert.ok(state.planLocks[validPureSampleKey]);
  assert.ok(state.planLocks[validRecipeKey]);
  assert.ok(state.planLocks[manualKey]);
  assert.equal(state.overrides[invalidFocusKey], undefined);
  assert.equal(state.overrides[validSampleKey], 'haferdrink');
  assert.equal(state.overrides[validPureSampleKey], 'haferdrink');
  assert.equal(state.overrides[invalidFollowUpKey], 'tahin');
  assert.equal(state.followUps.tahin.status, 'scheduled');
  assert.equal(state.followUps.tahin.dueDate, '2026-08-20');
});

test('alte automatische Rezept-Locks werden gegen die aktuelle Mahlzeiteneignung bereinigt', () => {
  const recipes = loadRecipes();
  const chickenMuffins = plannerRecipeByStoredName('Huhn-Gemüse-Muffins', recipes);
  assert.ok(chickenMuffins);
  assert.deepEqual(Array.from(chickenMuffins.excludeMeals || []), ['breakfast']);

  const invalidBreakfastKey = '2026-08-18|breakfast';
  const validSnackKey = '2026-08-18|snack';
  const manualBreakfastKey = '2026-08-19|breakfast';
  const state = {
    foods: [],
    settings: {},
    overrides: {},
    followUps: {},
    planLocks: {
      [invalidBreakfastKey]: {
        mode: 'auto', focusId: 'huhn', foodIds: [], baseFoodIds: [], sampleFoodIds: [],
        type: 'Rezeptvorrat', recipeName: 'Huhn-Gemüse-Muffins',
      },
      [validSnackKey]: {
        mode: 'auto', focusId: 'huhn', foodIds: [], baseFoodIds: [], sampleFoodIds: [],
        type: 'Rezeptvorrat', recipeName: 'Huhn-Gemüse-Muffins',
      },
      [manualBreakfastKey]: {
        mode: 'manual', focusId: 'huhn', foodIds: [], baseFoodIds: [], sampleFoodIds: [],
        type: 'Rezeptvorrat', recipeName: 'Huhn-Gemüse-Muffins',
      },
    },
  };

  assert.equal(plannerAutomaticRecipeLockMealViolation(invalidBreakfastKey, state.planLocks[invalidBreakfastKey], recipes), true);
  assert.equal(plannerAutomaticRecipeLockMealViolation(validSnackKey, state.planLocks[validSnackKey], recipes), false);
  assert.equal(plannerAutomaticRecipeLockMealViolation(manualBreakfastKey, state.planLocks[manualBreakfastKey], recipes), false);

  assert.equal(pruneIneligibleAutomaticPlanState(state, recipes), true);
  assert.equal(state.planLocks[invalidBreakfastKey], undefined);
  assert.ok(state.planLocks[validSnackKey]);
  assert.ok(state.planLocks[manualBreakfastKey]);
});

test('Huhn-Gemüse-Muffins bleiben Snack, sind aber gezielt nicht mehr Frühstück', () => {
  const recipe = loadRecipes().find((item) => item.name === 'Huhn-Gemüse-Muffins');
  assert.ok(recipe);
  assert.equal(fs.existsSync(path.resolve(__dirname, '..', 'data', 'recipe-planner.js')), false);
  assert.equal(recipe.category, 'baking');
  assert.ok(recipe.tags.some((tag) => String(tag).toLowerCase() === 'snack'));
  assert.deepEqual(Array.from(recipe.excludeMeals || []), ['breakfast']);
  assert.equal(plannerRecipeSuitableForMeal(recipe, 'snack'), true);
  assert.equal(plannerRecipeSuitableForMeal(recipe, 'breakfast'), false);
  assert.equal(plannerRecipeSuitableForMeal(recipe, 'lunch'), true);
});

test('Snack-Tag sperrt andere Backrezepte nicht pauschal vom Frühstück aus', () => {
  const recipes = loadRecipes();
  const waffles = recipes.find((item) => item.name === 'Joghurt-Hafer-Waffeln');
  const fruitMuffins = recipes.find((item) => item.name === 'Obst-Hafer-Muffins');

  assert.ok(waffles);
  assert.equal(waffles.category, 'baking');
  assert.ok((waffles.tags || []).some((tag) => String(tag).toLowerCase() === 'snack'));
  assert.equal(plannerRecipeSuitableForMeal(waffles, 'breakfast'), true);
  assert.equal(plannerRecipeSuitableForMeal(waffles, 'snack'), true);

  assert.ok(fruitMuffins);
  assert.equal(fruitMuffins.category, 'baking');
  assert.ok((fruitMuffins.tags || []).some((tag) => String(tag).toLowerCase() === 'snack'));
  assert.equal(plannerRecipeSuitableForMeal(fruitMuffins, 'breakfast'), true);
});

test('bestehende Rezept-Mahlzeitenlogik bleibt außerhalb des bestätigten Konflikts erhalten', () => {
  const recipes = loadRecipes();
  const pancakes = recipes.find((item) => item.name === 'Obst-Hafer-Pancakes');
  const bakingWithoutSnack = recipes.find((item) => item.name === 'Zucchini-Joghurt-Hafer-Bites');

  assert.ok(pancakes);
  assert.equal(plannerRecipeSuitableForMeal(pancakes, 'breakfast'), true);

  assert.ok(bakingWithoutSnack);
  assert.equal(bakingWithoutSnack.category, 'baking');
  assert.equal((bakingWithoutSnack.tags || []).some((tag) => String(tag).toLowerCase() === 'snack'), false);
  assert.equal(plannerRecipeSuitableForMeal(bakingWithoutSnack, 'breakfast'), true);
});
