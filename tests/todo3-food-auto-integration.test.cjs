const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function makeFood(id, overrides = {}) {
  return {
    id,
    name: id,
    category: 'Gemüse',
    priority: 1,
    active: true,
    allergenGroup: '',
    meals: ['breakfast', 'lunch', 'dinner'],
    manualStatus: 'Verträgliche Basis',
    ...overrides,
  };
}

function runtimeHarness() {
  const foods = [
    makeFood('allowed', { name: 'Allowed' }),
    makeFood('blocked', { name: 'Blocked', autoPlan: false }),
    makeFood('age-phase', { name: 'Age Phase', minAgeMonths: 12, minPhase: 'familie' }),
    makeFood('mais-polenta', { name: 'Mais', alias: 'Mais/Polenta', category: 'Getreide/Stärke' }),
    makeFood('polenta', { name: 'Polenta', category: 'Getreide/Stärke' }),
    makeFood('sesam', { name: 'Sesam', category: 'Samen', allergenGroup: 'Sesam' }),
    makeFood('tahin', { name: 'Tahin', category: 'Samen', allergenGroup: 'Sesam' }),
    makeFood('hafer', { name: 'Hafer', category: 'Getreide/Stärke' }),
    makeFood('haferdrink', { name: 'Haferdrink', category: 'Getreide/Stärke' }),
  ];
  const state = {
    settings: {
      birthDate: '2026-01-24',
      phaseSelected: 'familie',
      preferInventoryInPlan: true,
    },
    foods,
    logs: [],
    inventory: [],
    planLocks: {},
    overrides: {},
    followUps: {},
  };
  const context = {
    console,
    FOOD_DB: foods,
    ID_ALIASES: {},
    state,
    PHASES: {
      kennenlernen: { label: 'Kennenlernen' },
      aufbau: { label: 'Mahlzeitenaufbau' },
      drei: { label: 'Drei Hauptmahlzeiten' },
      familie: { label: 'Familienkost' },
    },
    FOOD_ICON_PATHS: {},
    rank: () => 2,
    eatenExposureCount: () => 1,
    eligibleCore: (food, meal) => !!food?.active && (food.meals || []).includes(meal),
    eligible: (food, meal) => !!food?.active && (food.meals || []).includes(meal),
    isTrustedBase: () => true,
    chooseFocus: () => null,
    introductionCandidate: () => null,
    knownCandidate: () => null,
    knownBase: () => state.foods.find((food) => food.id === 'blocked') || state.foods.find((food) => food.id === 'allowed') || null,
    companionFor: () => state.foods.find((food) => food.id === 'blocked') || state.foods.find((food) => food.id === 'allowed') || null,
    breakfastReady: () => true,
    manualMealRoleInfo: () => ({ food: null, role: '' }),
    manualMealValidation: () => ({ ok: true, ids: [], bases: [], samples: [], messages: [] }),
    displayStatus: () => '',
    foodIllustrationPath: () => '',
    bootstrapStorage: async () => true,
    status: () => 'Verträgliche Basis',
    outcomeForFood: () => 'eaten',
    today: () => '2027-01-24',
    food: (id) => state.foods.find((food) => food.id === id),
    recipeSuitableForMeal: (recipe, meal) => meal === 'snack'
      ? (recipe.tags || []).some((tag) => String(tag).toLowerCase() === 'snack')
      : true,
    recipeContainsMeatOrFish: () => false,
    recipeInventoryPortions: () => 0,
    oldestRecipeBatch: () => null,
    planLockKey: (date, meal) => `${date}|${meal}`,
    save: () => {},
    renderAll: () => {},
  };

  context.__blockedRecipe = {
    name: 'Blocked snack',
    requires: ['Blocked'],
    requirementMissing: [],
    tags: ['Snack'],
    freezable: true,
  };
  context.__allowedRecipe = {
    name: 'Allowed snack',
    requires: ['Allowed'],
    requirementMissing: [],
    tags: ['Snack'],
    freezable: true,
  };
  context.recipeStates = () => [context.__blockedRecipe, context.__allowedRecipe];
  context.recipeFoodIds = (recipe) => (recipe.requires || [])
    .map((name) => state.foods.find((food) => food.name === name)?.id)
    .filter(Boolean);
  context.recipeStockCandidate = () => null;
  context.snackRecipeCandidate = () => null;
  context.applyFollowUpPlan = (record, requestedDate = '') => {
    const date = requestedDate || '2027-01-24';
    const key = `${date}|${record.meal || 'lunch'}`;
    state.planLocks[key] = {
      mode: 'auto',
      focusId: record.foodId,
      foodIds: [record.foodId],
      followUpFoodId: record.foodId,
    };
    state.overrides[key] = record.foodId;
    return { ok: true, date };
  };
  context.buildDay = (date, index) => {
    const blocked = state.foods.find((food) => food.id === 'blocked');
    const allowed = state.foods.find((food) => food.id === 'allowed');
    const snackCtx = { fullMilkDates: new Set(), recipeReserved: new Map(), recipePlannedUse: new Map() };
    return {
      date,
      index,
      capture: {
        blockedEligible: context.eligibleCore(blocked, 'lunch', date),
        baseId: context.knownBase('lunch')?.id || '',
        companionId: context.companionFor(allowed, 'lunch', date)?.id || '',
        blockedRecipeIds: context.recipeFoodIds(context.__blockedRecipe),
        snackName: context.snackRecipeCandidate(date, snackCtx)?.name || '',
      },
      meals: [{
        meal: 'lunch',
        active: true,
        focusId: 'allowed',
        foodIds: ['allowed'],
        baseFoodIds: [],
        sampleFoodIds: [],
        optionalAddons: ['blocked', 'allowed'],
      }],
    };
  };

  vm.createContext(context);
  vm.runInContext(`${appSource}\nthis.__installFoodPolicyRuntime = installFoodPolicyRuntime; this.__automaticFoodEligibility = automaticFoodEligibility; this.__pruneIneligibleAutomaticPlanState = pruneIneligibleAutomaticPlanState;`, context);
  context.__installFoodPolicyRuntime();
  return context;
}

test('TODO3 AUTO-01/02: autoPlan, minAgeMonths und minPhase sind gemeinsame harte Auto-Gates', () => {
  const context = runtimeHarness();
  const blocked = context.state.foods.find((food) => food.id === 'blocked');
  const agePhase = context.state.foods.find((food) => food.id === 'age-phase');

  assert.equal(context.__automaticFoodEligibility(blocked, '2028-01-24', { birthDate: '2026-01-24', phaseSelected: 'familie' }), false);
  assert.equal(context.__automaticFoodEligibility(agePhase, '2027-01-23', { birthDate: '2026-01-24', phaseSelected: 'familie' }), false);
  assert.equal(context.__automaticFoodEligibility(agePhase, '2027-01-24', { birthDate: '2026-01-24', phaseSelected: 'drei' }), false);
  assert.equal(context.__automaticFoodEligibility(agePhase, '2027-01-24', { birthDate: '2026-01-24', phaseSelected: 'familie' }), true);
});

test('TODO3 AUTO-ROLE: Auto-Eignung gilt für Fokusfilter, Basen, Begleiter, Rezeptzutaten, Snack-Rezepte und Add-ons', () => {
  const context = runtimeHarness();
  const day = context.buildDay('2027-01-24', 0, {});

  assert.equal(day.capture.blockedEligible, false, 'autoPlan:false darf nicht als Auto-Fokus geeignet sein');
  assert.equal(day.capture.baseId, 'allowed', 'ungeeignetes FOOD darf nicht sichere Auto-Basis werden');
  assert.equal(day.capture.companionId, 'allowed', 'ungeeignetes FOOD darf nicht Auto-Begleiter werden');
  assert.deepEqual([...day.capture.blockedRecipeIds], [], 'Rezept mit ungeeigneter Pflichtzutat fällt automatisch aus');
  assert.equal(day.capture.snackName, 'Allowed snack', 'Phase-4-Snackkandidat muss nur geeignete Rezeptzutaten verwenden');
  assert.deepEqual([...day.meals[0].optionalAddons], ['allowed'], 'ungeeignete optionale Add-ons werden entfernt');
});

test('TODO3 AUTO-MANUAL: autoPlan:false deaktiviert die manuelle Mahlzeiteneignung nicht', () => {
  const context = runtimeHarness();
  const blocked = context.state.foods.find((food) => food.id === 'blocked');
  assert.equal(blocked.active, true);
  assert.equal(context.eligibleCore(blocked, 'lunch', '2027-01-24'), true, 'außerhalb des Auto-Plan-Kontexts bleibt die bestehende manuelle meals-Eignung erhalten');
});

test('TODO3 FOLLOW-UP: ungeeignet gewordene FOODs dürfen keinen automatischen Follow-up-Lock behalten', () => {
  const context = runtimeHarness();
  const record = { foodId: 'blocked', meal: 'lunch', status: 'scheduled', dueDate: '2027-01-24' };
  const result = context.applyFollowUpPlan(record, '2027-01-24');
  const key = '2027-01-24|lunch';

  assert.deepEqual({ ok: result.ok, date: result.date }, { ok: true, date: '' });
  assert.equal(context.state.planLocks[key], undefined);
  assert.equal(context.state.overrides[key], undefined);
  assert.equal(record.status, 'later');
  assert.equal(record.dueDate, '');
});

test('TODO3 AUTO-LOCK: ungeeignete automatische Locks werden bereinigt, manuelle Referenzen bleiben erhalten', () => {
  const context = runtimeHarness();
  context.state.planLocks = {
    '2027-01-24|lunch': { mode: 'auto', focusId: 'allowed', foodIds: ['allowed'], optionalAddons: ['blocked'] },
    '2027-01-24|dinner': { mode: 'manual', focusId: 'blocked', foodIds: ['blocked'] },
  };
  context.state.overrides = { '2027-01-24|lunch': 'allowed', '2027-01-24|dinner': 'blocked' };

  assert.equal(context.__pruneIneligibleAutomaticPlanState(context.state), true);
  assert.equal(context.state.planLocks['2027-01-24|lunch'], undefined);
  assert.equal(context.state.overrides['2027-01-24|lunch'], undefined);
  assert.ok(context.state.planLocks['2027-01-24|dinner']);
  assert.equal(context.state.overrides['2027-01-24|dinner'], 'blocked');
});

test('TODO3 HONEY/TUNA: Honig verlangt 12 Monate plus Familienkost; Thunfisch bleibt aktiv, aber immer autoPlan:false', () => {
  const context = runtimeHarness();
  const honey = context.state.foods.find((food) => food.id === 'honig');
  const tuna = context.state.foods.find((food) => food.id === 'thunfisch');

  assert.ok(honey);
  assert.equal(honey.minAgeMonths, 12);
  assert.equal(honey.minPhase, 'familie');
  assert.equal(context.__automaticFoodEligibility(honey, '2027-01-23', { birthDate: '2026-01-24', phaseSelected: 'familie' }), false);
  assert.equal(context.__automaticFoodEligibility(honey, '2027-01-24', { birthDate: '2026-01-24', phaseSelected: 'drei' }), false);
  assert.equal(context.__automaticFoodEligibility(honey, '2027-01-24', { birthDate: '2026-01-24', phaseSelected: 'familie' }), true);

  assert.ok(tuna);
  assert.equal(tuna.active, true);
  assert.equal(tuna.autoPlan, false);
  assert.equal(context.__automaticFoodEligibility(tuna, '2030-01-24', { birthDate: '2026-01-24', phaseSelected: 'familie' }), false);
});

test('TODO3 FOOD-FAMILIES: Mais/Polenta, Sesam/Tahin und Hafer/Haferdrink bleiben konkrete FOODs, teilen aber den vorgesehenen Familienstatus', () => {
  const context = runtimeHarness();
  const pairs = [
    ['mais', 'polenta', 'mais'],
    ['sesam', 'tahin', 'sesam'],
    ['hafer', 'haferdrink', 'hafer'],
  ];
  for (const [leftId, rightId, family] of pairs) {
    const left = context.state.foods.find((food) => food.id === leftId);
    const right = context.state.foods.find((food) => food.id === rightId);
    assert.ok(left, leftId);
    assert.ok(right, rightId);
    assert.notEqual(left.id, right.id);
    assert.equal(left.foodFamily, family);
    assert.equal(right.foodFamily, family);
  }
  for (const id of ['sesam', 'tahin']) assert.equal(context.state.foods.find((food) => food.id === id).allergenFamily, 'sesam');
  for (const id of ['hafer', 'haferdrink']) {
    const food = context.state.foods.find((item) => item.id === id);
    assert.equal(food.allergenFamily, 'hafer');
    assert.equal(food.allergenGroup, 'Glutenhaltiges Getreide');
  }
});
