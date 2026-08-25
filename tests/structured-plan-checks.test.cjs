const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'phase-readiness.js'), 'utf8');
const maintenance = require(path.join(root, 'js', 'planner-allergen-maintenance.js'));

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeContext({ foods = [], logs = [], settings = {}, recipes = [] } = {}) {
  const state = {
    foods,
    logs,
    settings: {
      phaseSelected: 'aufbau',
      allergenDays: 7,
      ...settings,
    },
  };
  const byId = new Map(foods.map((item) => [item.id, item]));
  const recipeMap = new Map(recipes.map((item) => [item.name, item]));
  const context = {
    state,
    currentPhase: () => state.settings.phaseSelected,
    food: (id) => byId.get(id) || null,
    rank: (record) => Number(record?.rank || 0),
    isTrustedBase: (record) => Number(record?.rank || 0) >= 2 && record?.plannerRole !== 'component',
    mealIsCompleted: () => false,
    isPlannedIntroductionSequence: () => false,
    mealContainsMilkProduct: (ids = []) => ids.some((id) => byId.get(id)?.category === 'Milchprodukt'),
    isMeatOrFish: (record) => ['Fleisch', 'Fisch'].includes(record?.category),
    mealMilkLevel: (meal) => meal.milkLevel || 'none',
    currentAmountLevel: () => 'normal',
    AMOUNT_LEVELS: { normal: { rank: 1 } },
    outcomeForFood: (log, id) => log.outcomes?.[id] || log.outcome || '',
    recipeByName: (name) => recipeMap.get(name) || null,
    recipeFoodIds: (recipe) => recipe?.foodIds || [],
    dishTitle: (meal) => meal.recipeName || (meal.foodIds || []).map((id) => byId.get(id)?.name || id).join(' + '),
    shortDate: (date) => date,
    today: () => '2026-08-10',
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

function meal(overrides = {}) {
  return {
    active: true,
    empty: false,
    meal: 'lunch',
    focusId: 'kartoffel',
    foodIds: ['kartoffel'],
    baseFoodIds: ['kartoffel'],
    sampleFoodIds: [],
    recipeName: '',
    type: 'bekannt',
    ...overrides,
  };
}

function day(date, meals = []) {
  return { date, meals };
}

test('PLAN-CHECK: strukturierter Vertrag trennt Blocker, notwendige Aktion und Empfehlung ohne Warntext als Logik', () => {
  const foods = [
    { id: 'kartoffel', name: 'Kartoffel', rank: 2, active: true },
    { id: 'reis', name: 'Reis', rank: 2, active: false },
    { id: 'banane', name: 'Banane', rank: 0, active: true },
  ];
  const context = makeContext({ foods });
  const report = plain(context.PlannerPlanChecks.report([
    day('2026-08-10', [
      meal({ focusId: 'banane', foodIds: ['banane'], baseFoodIds: [], type: 'neu' }),
      meal({ meal: 'dinner', focusId: 'reis', foodIds: ['reis'], baseFoodIds: ['reis'] }),
    ]),
  ]));

  const blocker = report.items.find((item) => item.code === 'NEW_FOOD_WITHOUT_TRUSTED_BASE');
  const action = report.items.find((item) => item.code === 'INACTIVE_FOOD_PLANNED');
  const recommendation = report.items.find((item) => item.code === 'IRON_RICH_MISSING');

  assert.equal(blocker.type, 'hard_blocker');
  assert.equal(action.type, 'required_action');
  assert.equal(recommendation.type, 'recommendation');
  assert.deepEqual(blocker.refs.foodIds, ['banane']);
  assert.equal(blocker.refs.meals[0].date, '2026-08-10');
  assert.ok(blocker.solutionPaths.some((solution) => solution.code === 'ADD_TRUSTED_BASE'));
  assert.ok(action.solutionPaths.some((solution) => solution.code === 'REACTIVATE_FOOD'));
  for (const item of report.items) {
    assert.equal(Object.hasOwn(item, 'message'), false);
    assert.equal(Object.hasOwn(item, 'text'), false);
  }
});

test('PLAN-CHECK: bestehende Milch-Hard-Gates bleiben eindeutig Blocker', () => {
  const foods = [
    { id: 'joghurt', name: 'Naturjoghurt', rank: 2, active: true, category: 'Milchprodukt' },
    { id: 'rind', name: 'Rind', rank: 2, active: true, category: 'Fleisch', ironRich: true },
    { id: 'kartoffel', name: 'Kartoffel', rank: 2, active: true },
  ];
  const context = makeContext({ foods });
  const report = plain(context.PlannerPlanChecks.report([
    day('2026-08-10', [
      meal({ focusId: 'joghurt', foodIds: ['joghurt', 'rind'], milkLevel: 'full' }),
      meal({ meal: 'dinner', focusId: 'kartoffel', foodIds: ['kartoffel'], milkLevel: 'full' }),
    ]),
  ]));

  assert.equal(report.items.find((item) => item.code === 'MILK_WITH_MEAT_OR_FISH').type, 'hard_blocker');
  const duplicate = report.items.find((item) => item.code === 'MULTIPLE_FULL_MILK_MEALS');
  assert.equal(duplicate.type, 'hard_blocker');
  assert.equal(duplicate.details.date, '2026-08-10');
  assert.equal(duplicate.refs.meals.length, 2);
});

test('PLAN-CHECK: fälliges Allergenpflegeziel bleibt offen, wenn keine sichtbare Planung es abdeckt', () => {
  const foods = [
    { id: 'hafer', name: 'Hafer', rank: 2, active: true, allergenFamily: 'hafer', allergenGroup: 'Glutenhaltiges Getreide' },
    { id: 'weizen', name: 'Weizen', rank: 2, active: true, allergenFamily: 'weizen', allergenGroup: 'Glutenhaltiges Getreide' },
    { id: 'kartoffel', name: 'Kartoffel', rank: 2, active: true },
  ];
  const context = makeContext({
    foods,
    logs: [{ date: '2026-08-01', foodIds: ['hafer'], outcome: 'eaten' }],
  });
  context.PlannerAllergenMaintenance = maintenance;

  const report = plain(context.PlannerPlanChecks.report([
    day('2026-08-10', [meal()]),
  ]));
  const open = report.items.find((item) => item.code === 'ALLERGEN_MAINTENANCE_DUE');

  assert.equal(open.type, 'open_goal');
  assert.equal(open.refs.allergenTargets[0].key, 'allergen:Glutenhaltiges Getreide');
  assert.deepEqual(new Set(open.refs.foodIds), new Set(['hafer', 'weizen']));
  assert.ok(open.solutionPaths.some((solution) => solution.code === 'COVER_WITH_KNOWN_ELIGIBLE_FOOD'));
  assert.deepEqual(report.domainStates.allergenMaintenance.openTargetKeys, ['allergen:Glutenhaltiges Getreide']);
});

test('PLAN-CHECK: sichtbare passende Mahlzeit markiert Allergenpflege als voraussichtlich abgedeckt und nicht als Warnung', () => {
  const foods = [
    { id: 'hafer', name: 'Hafer', rank: 2, active: true, allergenFamily: 'hafer', allergenGroup: 'Glutenhaltiges Getreide' },
    { id: 'weizen', name: 'Weizen', rank: 2, active: true, allergenFamily: 'weizen', allergenGroup: 'Glutenhaltiges Getreide' },
  ];
  const context = makeContext({
    foods,
    logs: [{ date: '2026-08-01', foodIds: ['hafer'], outcome: 'eaten' }],
  });
  context.PlannerAllergenMaintenance = maintenance;
  const days = [
    day('2026-08-10', [
      meal({ focusId: 'weizen', foodIds: ['weizen'], baseFoodIds: ['weizen'], recipeName: 'Weizenbrei' }),
    ]),
  ];

  const report = plain(context.PlannerPlanChecks.report(days));
  const covered = report.items.find((item) => item.code === 'ALLERGEN_MAINTENANCE_PROJECTED');

  assert.equal(covered.type, 'projected_covered_goal');
  assert.equal(covered.details.projectedCovered, true);
  assert.deepEqual(covered.refs.recipeNames, ['Weizenbrei']);
  assert.equal(report.items.some((item) => item.code === 'ALLERGEN_MAINTENANCE_DUE'), false);
  assert.deepEqual(report.domainStates.allergenMaintenance.coveredTargetKeys, ['allergen:Glutenhaltiges Getreide']);
  const warnings = plain(context.PlannerPlanChecks.compatibilityMessages(report, days));
  assert.equal(warnings.some((warning) => warning.includes('Allergen fällig')), false);
});

test('PLAN-CHECK: Readiness-State ist konsumierbar, ohne daraus eine neue Planwarnung abzuleiten', () => {
  const context = makeContext({
    foods: [{ id: 'kartoffel', name: 'Kartoffel', rank: 2, active: true, ironRich: true }],
  });
  const report = plain(context.PlannerPlanChecks.report(
    [day('2026-08-10', [meal()])],
    {
      phaseReadinessSignals: {
        currentPatternAccepted: true,
        additionalMealCue: true,
        routineCompatible: true,
      },
    },
  ));

  assert.equal(report.domainStates.phaseReadiness.recommendation, 'recommended');
  assert.equal(report.domainStates.phaseReadiness.nextPhase, 'drei');
  assert.equal(report.items.some((item) => String(item.code).includes('PHASE')), false);
});

test('PLAN-CHECK: Kompatibilitätsadapter lässt bestehende UI Strings konsumieren und begrenzt weiter auf zwei Hinweise', () => {
  const foods = [
    { id: 'kartoffel', name: 'Kartoffel', rank: 2, active: true },
    { id: 'reis', name: 'Reis', rank: 2, active: true },
  ];
  const context = makeContext({ foods });
  context.planQualityIssues = () => ['legacy'];
  assert.equal(context.PlannerPlanChecks.installCompatibilityAdapter(), true);

  const warnings = plain(context.planQualityIssues([
    day('2026-08-10', [
      meal({ focusId: 'kartoffel' }),
      meal({ meal: 'dinner', focusId: 'kartoffel' }),
    ]),
    day('2026-08-11', [meal({ focusId: 'kartoffel' })]),
    day('2026-08-12', [meal({ focusId: 'kartoffel' })]),
  ]));

  assert.ok(warnings.length <= 2);
  assert.ok(warnings.every((warning) => typeof warning === 'string'));
  assert.equal(typeof context.planCheckResults, 'function');
});
