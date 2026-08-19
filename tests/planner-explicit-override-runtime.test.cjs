const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const planningSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'js', 'planning.js'),
  'utf8',
);
const appSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'app.js'),
  'utf8',
);

function makeFood(id, name, category, meals, extra = {}) {
  return {
    id,
    name,
    category,
    meals: [...meals],
    active: true,
    allergenGroup: '',
    priority: 10,
    ...extra,
  };
}

function buildInstalledRuntime({ foods, ranks, overrides, activeMeals, index = 1 }) {
  const date = '2026-08-18';
  const context = {};
  vm.createContext(context);
  vm.runInContext(planningSource, context);

  const state = {
    foods,
    logs: [],
    inventory: [],
    overrides: { ...overrides },
    deferred: {},
    planLocks: {},
    autoLockExcluded: {},
    manualMeals: {},
    shoppingHints: {},
    pantry: {},
    followUps: {},
    settings: {
      newFoodEvery: 2,
      preferInventoryInPlan: true,
      phaseSelected: 'aufbau',
      birthDate: '2026-01-24',
    },
  };

  context.state = state;
  context.FOOD_DB = foods;
  context.ID_ALIASES = {};
  context.rank = (food) => Number(ranks[food?.id] ?? 3);
  context.status = (food) => {
    const value = Number(ranks[food?.id] ?? 3);
    return value >= 3 ? 'Regelmäßig' : value >= 2 ? 'Verträgliche Basis' : 'Offen';
  };
  context.outcomeForFood = () => 'eaten';
  context.today = () => date;
  context.food = (id) => state.foods.find((item) => item.id === id) || null;
  context.isFoodUnavailable = () => false;
  context.activeMeal = (meal) => activeMeals.includes(meal);
  context.companionFor = (_focus, meal) =>
    state.foods.find((item) => item.id === 'karotte' && item.meals.includes(meal)) || null;
  context.foodIllustrationPath = () => '';
  context.bootstrapStorage = async () => {};

  vm.runInContext(appSource, context);
  context.installFoodPolicyRuntime();

  let recipeStateCalls = 0;
  context.recipeStates = () => {
    recipeStateCalls += 1;
    return [{
      name: 'Konkurrierender Vorrat',
      category: 'family',
      requires: ['Karotte'],
      alternatives: [],
      oneOf: [],
      milkChoices: [],
      requirementMissing: [],
      freezable: true,
      milkMeal: '',
    }];
  };
  context.recipeInventoryPortions = () => 1;
  context.oldestRecipeBatch = () => ({ id: 'batch-1', frozenDate: '2026-08-01' });
  context.mealContainsMilkProduct = () => false;
  context.combinationPaused = () => false;
  context.enforceSingleStarch = (_focus, companions) => companions;
  context.ironCompanion = () => null;
  context.AMOUNT_LEVELS = { taste: { rank: 0 } };
  context.currentAmountLevel = () => 'taste';
  context.applyPlannedMealAmounts = (meal) => meal;
  context.reserveMealInventory = () => {};
  context.isStarchyFood = () => false;

  const plannerContext = {
    reserved: new Set(),
    introduced: [],
    plannedUse: new Map(),
    lastFocus: new Map(),
    inventoryReserved: new Map(),
    recipeReserved: new Map(),
    recipePlannedUse: new Map(),
    fullMilkDates: new Set(),
  };

  return {
    date,
    state,
    context,
    recipeStateCalls: () => recipeStateCalls,
    buildDay: () => context.buildDay(date, index, plannerContext),
  };
}

function mealFrom(day, meal) {
  return day.meals.find((item) => item.meal === meal);
}

test('zwei explizite Komponenten-Overrides am selben Tag bleiben beide vor Rezeptvorrat erhalten', () => {
  const tahin = makeFood('tahin', 'Tahin', 'Samen', ['breakfast', 'lunch']);
  const haferdrink = makeFood('haferdrink', 'Haferdrink', 'Getreide/Stärke', ['breakfast', 'lunch']);
  const base = makeFood('karotte', 'Karotte', 'Gemüse', ['breakfast', 'lunch']);
  const runtime = buildInstalledRuntime({
    foods: [tahin, haferdrink, base],
    ranks: { tahin: 3, haferdrink: 3, karotte: 3 },
    overrides: {
      '2026-08-18|breakfast': 'tahin',
      '2026-08-18|lunch': 'haferdrink',
    },
    activeMeals: ['breakfast', 'lunch'],
  });

  const day = runtime.buildDay();
  const breakfast = mealFrom(day, 'breakfast');
  const lunch = mealFrom(day, 'lunch');

  assert.equal(breakfast.focusId, 'tahin');
  assert.equal(breakfast.type, 'manuell');
  assert.deepEqual(Array.from(breakfast.sampleFoodIds || []), ['tahin']);
  assert.equal(lunch.focusId, 'haferdrink');
  assert.equal(lunch.type, 'manuell');
  assert.deepEqual(Array.from(lunch.sampleFoodIds || []), ['haferdrink']);
  assert.equal(runtime.recipeStateCalls(), 0);
});

test('auch ein bekannter normaler Lebensmittel-Override hat im konkreten Slot Vorrang vor Rezeptvorrat', () => {
  const apfel = makeFood('apfel', 'Apfel', 'Obst', ['lunch']);
  const base = makeFood('karotte', 'Karotte', 'Gemüse', ['lunch']);
  const runtime = buildInstalledRuntime({
    foods: [apfel, base],
    ranks: { apfel: 3, karotte: 3 },
    overrides: { '2026-08-18|lunch': 'apfel' },
    activeMeals: ['lunch'],
  });

  const lunch = mealFrom(runtime.buildDay(), 'lunch');
  assert.equal(lunch.focusId, 'apfel');
  assert.equal(lunch.recipeName || '', '');
  assert.equal(runtime.recipeStateCalls(), 0);
});

test('ein für den konkreten Slot ungeeigneter stale Override reserviert keine Einführung und blockiert Rezeptvorrat nicht', () => {
  const tahin = makeFood('tahin', 'Tahin', 'Samen', ['breakfast']);
  const base = makeFood('karotte', 'Karotte', 'Gemüse', ['lunch']);
  const runtime = buildInstalledRuntime({
    foods: [tahin, base],
    ranks: { tahin: 3, karotte: 3 },
    overrides: { '2026-08-18|lunch': 'tahin' },
    activeMeals: ['lunch'],
  });

  const lunch = mealFrom(runtime.buildDay(), 'lunch');
  assert.equal(lunch.recipeName, 'Konkurrierender Vorrat');
  assert.equal(lunch.focusId, 'karotte');
  assert.ok(runtime.recipeStateCalls() > 0);
});
