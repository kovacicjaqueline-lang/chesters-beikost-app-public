const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  plannerExplicitOverrideForFood,
  plannerPlanningRank,
  plannerFoodIsTrustedBase,
} = require('../app.js');

const planningSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'js', 'planning.js'),
  'utf8',
);
const recipesSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'js', 'recipes.js'),
  'utf8',
);

function buildHarness(component, concreteRank, { scheduleAllergen = false } = {}) {
  const date = '2026-08-18';
  const key = `${date}|lunch`;
  const base = {
    id: 'karotte',
    name: 'Karotte',
    category: 'Gemüse',
    meals: ['lunch'],
    active: true,
  };
  const context = {};
  vm.createContext(context);
  vm.runInContext(planningSource, context);
  if (scheduleAllergen) vm.runInContext(recipesSource, context);

  const state = {
    foods: [component, base],
    logs: [],
    inventory: [],
    overrides: scheduleAllergen ? {} : { [key]: component.id },
    deferred: {},
    planLocks: {},
    autoLockExcluded: {},
    manualMeals: {},
    settings: {
      newFoodEvery: 2,
      preferInventoryInPlan: true,
    },
  };
  context.state = state;

  const concreteRankFor = (food) => food?.id === component.id ? concreteRank : 3;
  context.food = (id) => state.foods.find((food) => food.id === id) || null;
  context.rank = (food) => plannerPlanningRank(
    food,
    concreteRankFor(food),
    food?.id === component.id ? 3 : concreteRankFor(food),
    plannerExplicitOverrideForFood(state.overrides, date, food?.id),
  );
  context.isTrustedBase = (food) => plannerFoodIsTrustedBase(
    food,
    concreteRankFor(food) >= 2,
  );
  context.activeMeal = (meal) => meal === 'lunch';
  context.manualMealFor = () => null;
  context.lockedMeal = () => null;
  context.mealMilkLevel = () => '';
  context.eligible = () => true;
  context.knownBase = () => base;
  context.companionFor = () => base;
  context.enforceSingleStarch = (_focus, companions) => companions;
  context.ironCompanion = () => null;
  context.combinationPaused = () => false;
  context.AMOUNT_LEVELS = { taste: { rank: 0 } };
  context.currentAmountLevel = () => 'taste';
  context.mealContainsMilkProduct = () => false;
  context.applyPlannedMealAmounts = (meal) => meal;
  context.reserveMealInventory = () => {};
  context.isStarchyFood = () => false;

  let recipeCalls = 0;
  context.recipeStockCandidate = () => {
    recipeCalls += 1;
    return { name: 'Konkurrierender Vorrat' };
  };
  context.knownCandidate = () => {
    throw new Error('Der explizite Komponenten-Override darf nicht in die normale Rotation fallen.');
  };

  if (scheduleAllergen) {
    context.findPlannedFood = () => null;
    context.planSlotProtected = () => false;
    context.save = () => {};
    context.closeGeneric = () => {};
    context.renderAll = () => {};
    context.showToast = () => {};
    context.shortDate = (value) => value;
    context.today = () => date;
    context.addDays = (value) => value;
    context.mealName = (meal) => meal;
  }

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
    key,
    base,
    state,
    context,
    buildDay: () => context.buildDay(date, 1, plannerContext),
    recipeCalls: () => recipeCalls,
  };
}

function lunchFrom(day) {
  return day.meals.find((meal) => meal.meal === 'lunch');
}

test('bekanntes Tahin bleibt nach echter Allergen-Einplanung die gewählte Kostprobe', () => {
  const tahin = {
    id: 'tahin',
    name: 'Tahin',
    category: 'Samen',
    meals: ['breakfast', 'lunch', 'dinner'],
    active: true,
    allergenGroup: 'Sesam',
    plannerRole: 'component',
  };
  const harness = buildHarness(tahin, 3, { scheduleAllergen: true });

  assert.equal(harness.context.scheduleAllergen('tahin', harness.date, 'lunch'), true);
  assert.equal(harness.state.overrides[harness.key], 'tahin');

  const lunch = lunchFrom(harness.buildDay());
  assert.ok(lunch);
  assert.equal(lunch.focusId, 'tahin');
  assert.equal(lunch.type, 'manuell');
  assert.deepEqual(Array.from(lunch.sampleFoodIds || []), ['tahin']);
  assert.deepEqual(Array.from(lunch.baseFoodIds || []), ['karotte']);
  assert.equal(harness.recipeCalls(), 0);
});

test('neuer Haferdrink wird trotz bekanntem Hafer-Familienrang vor Rezeptvorrat als Kostprobe geplant', () => {
  const haferdrink = {
    id: 'haferdrink',
    name: 'Haferdrink',
    category: 'Getreide/Stärke',
    meals: ['breakfast', 'lunch', 'dinner'],
    active: true,
    allergenGroup: 'Glutenhaltiges Getreide',
    plannerRole: 'component',
  };
  const harness = buildHarness(haferdrink, 0);

  assert.equal(
    plannerExplicitOverrideForFood(harness.state.overrides, harness.date, 'haferdrink'),
    true,
  );

  const lunch = lunchFrom(harness.buildDay());
  assert.ok(lunch);
  assert.equal(lunch.focusId, 'haferdrink');
  assert.equal(lunch.type, 'manuell');
  assert.deepEqual(Array.from(lunch.sampleFoodIds || []), ['haferdrink']);
  assert.deepEqual(Array.from(lunch.baseFoodIds || []), ['karotte']);
  assert.equal(harness.recipeCalls(), 0);
});
