const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const feature = require(path.join(root, 'js', 'planner-missing-ingredient.js'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('MISSING-INGREDIENT-01: echte Recipe-V2-Auswahl ersetzt nur die fehlende Nebenkomponente', () => {
  const foods = {
    banane: { id: 'banane', name: 'Banane', priority: 1 },
    apfel: { id: 'apfel', name: 'Apfel', priority: 2 },
    hafer: { id: 'hafer', name: 'Hafer', priority: 1 },
  };
  const recipe = { name: 'Obst-Haferbrei', oneOf: ['Banane', 'Apfel'] };
  const meal = {
    focusId: 'hafer',
    foodIds: ['hafer', 'banane'],
    baseFoodIds: ['hafer'],
    sampleFoodIds: [],
    foodRoles: { hafer: 'base', banane: 'component' },
  };
  const byName = (name) => Object.values(foods).find((item) => item.name === name) || null;
  const replacement = feature.recipeComponentReplacementId(
    recipe,
    meal,
    'banane',
    byName,
    () => true,
    (item) => item.id !== 'banane',
  );
  assert.equal(replacement, 'apfel');

  const next = feature.replaceFoodIdInMeal(meal, 'banane', replacement);
  assert.deepEqual(next.foodIds, ['hafer', 'apfel']);
  assert.deepEqual(next.baseFoodIds, ['hafer']);
  assert.equal(next.foodRoles.apfel, 'component');
  assert.equal(next.foodRoles.banane, undefined);
});

test('MISSING-INGREDIENT-02: Fokus oder Kostprobe werden nicht still durch eine Rezeptalternative ausgetauscht', () => {
  const recipe = { oneOf: ['Banane', 'Apfel'] };
  const byName = (name) => ({ Banane: { id: 'banane' }, Apfel: { id: 'apfel' } })[name] || null;
  assert.equal(
    feature.recipeComponentReplacementId(
      recipe,
      { focusId: 'banane', foodIds: ['banane'], sampleFoodIds: [] },
      'banane',
      byName,
      () => true,
      () => true,
    ),
    '',
  );
  assert.equal(
    feature.recipeComponentReplacementId(
      recipe,
      { focusId: 'hafer', foodIds: ['hafer', 'banane'], sampleFoodIds: ['banane'] },
      'banane',
      byName,
      () => true,
      () => true,
    ),
    '',
  );
});

test('MISSING-INGREDIENT-03: alle zukünftigen offenen gespeicherten Vorkommen werden angepasst oder zur Neuplanung freigegeben', () => {
  const state = {
    planLocks: {
      '2026-08-27|breakfast': { focusId: 'hafer', foodIds: ['hafer', 'banane'], recipeName: 'Obst-Haferbrei' },
      '2026-08-28|lunch': { focusId: 'banane', foodIds: ['banane'] },
      '2026-08-29|lunch': { focusId: 'banane', foodIds: ['banane'] },
      '2026-08-26|breakfast': { focusId: 'banane', foodIds: ['banane'] },
    },
    manualMeals: {
      '2026-08-28|lunch': { focusId: 'banane', foodIds: ['banane'], manualAdded: true },
    },
    overrides: {
      '2026-08-28|lunch': 'banane',
      '2026-08-30|breakfast': 'banane',
    },
    autoLockExcluded: {
      '2026-08-28|lunch': true,
      '2026-08-30|breakfast': true,
    },
    backupMeta: {
      plannerLinking: {
        carriedPlans: {
          'carry-open': { planId: 'carry-open', date: '2026-08-31', meal: 'lunch', focusId: 'banane', foodIds: ['banane'] },
          'carry-done': { planId: 'carry-done', date: '2026-09-01', meal: 'lunch', focusId: 'banane', foodIds: ['banane'] },
        },
      },
    },
  };
  const completed = new Set(['2026-08-29|lunch', 'carry-done']);
  const result = feature.clearUnavailableFoodFromStoredPlans(
    state,
    'banane',
    '2026-08-27',
    (date, meal, entry) => completed.has(entry?.planId || `${date}|${meal}`),
    (entry, slot) => slot.key === '2026-08-27|breakfast'
      ? { ...clone(entry), foodIds: ['hafer', 'apfel'] }
      : null,
  );

  assert.deepEqual(result.adaptedKeys, ['2026-08-27|breakfast']);
  assert.ok(result.clearedKeys.includes('2026-08-28|lunch'));
  assert.ok(result.clearedKeys.includes('2026-08-30|breakfast'));
  assert.ok(result.clearedKeys.includes('carried:carry-open'));
  assert.deepEqual(state.planLocks['2026-08-27|breakfast'].foodIds, ['hafer', 'apfel']);
  assert.equal(state.planLocks['2026-08-28|lunch'], undefined);
  assert.equal(state.manualMeals['2026-08-28|lunch'], undefined);
  assert.equal(state.overrides['2026-08-28|lunch'], undefined);
  assert.equal(state.autoLockExcluded['2026-08-28|lunch'], undefined);
  assert.ok(state.planLocks['2026-08-29|lunch'], 'bereits protokollierter Slot bleibt geschützt');
  assert.ok(state.planLocks['2026-08-26|breakfast'], 'Vergangenheit bleibt unverändert');
  assert.equal(state.backupMeta.plannerLinking.carriedPlans['carry-open'], undefined);
  assert.ok(state.backupMeta.plannerLinking.carriedPlans['carry-done'], 'erledigter carried Plan bleibt geschützt');
});

test('MISSING-INGREDIENT-04: Loader und Offline-Precache enthalten die neue Verfügbarkeitsschicht', () => {
  const cascade = fs.readFileSync(path.join(root, 'js', 'planner-log-rollover-cascade.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const source = fs.readFileSync(path.join(root, 'js', 'planner-missing-ingredient.js'), 'utf8');
  assert.match(cascade, /planner-missing-ingredient\.js\?v=10\.1\.26/);
  assert.match(sw, /\.\/js\/planner-missing-ingredient\.js/);
  assert.match(source, /Welche Zutat fehlt\?/);
  assert.match(source, /steht auf der Einkaufsliste/);
  assert.doesNotMatch(source, /state\.logs\.push/);
});
