const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../js/planner-log-rollover.js');

function state(extra = {}) {
  return {
    logs: [],
    planLocks: {},
    manualMeals: {},
    overrides: {},
    autoLockExcluded: {},
    backupMeta: {},
    ...extra,
  };
}

function plan(id, date, meal) {
  return {
    planId: id,
    active: true,
    date,
    meal,
    focusId: `${id}-food`,
    foodIds: [`${id}-food`],
    baseFoodIds: [`${id}-food`],
    sampleFoodIds: [],
    type: 'bekannt',
    mode: 'auto',
  };
}

function log(id, date, meal, extra = {}) {
  const foodId = `${id}-food`;
  const outcome = extra.outcome || 'eaten';
  return {
    id,
    date,
    meal,
    focusId: foodId,
    foodIds: [foodId],
    baseFoodIds: [foodId],
    sampleFoodIds: [],
    outcome,
    foodOutcomes: { [foodId]: outcome },
    createdAt: extra.createdAt || `${date}T12:00:00.000Z`,
    ...extra,
  };
}

for (const meal of ['breakfast', 'lunch', 'dinner']) {
  test(`a free ${meal} log replaces the planned ${meal} entry`, () => {
    const date = '2026-09-24';
    const planned = plan(`${meal}-plan`, date, meal);
    const actual = log(`${meal}-log`, date, meal);
    const data = state({ logs: [actual] });

    const entries = core.dayPlannerEntries(data, date, [planned]);

    assert.equal(entries.filter((entry) => entry.kind === 'plan').length, 0);
    assert.equal(entries.filter((entry) => entry.kind === 'log').length, 1);
    assert.equal(entries[0].log.id, actual.id);
    assert.equal(entries[0].planId, planned.planId);
    assert.equal(entries[0].completedPlan, true);
    assert.equal(actual.plannedMealId, undefined, 'slot replacement must not rewrite the free log identity');
  });
}

test('a free snack log remains an additional log and does not replace the snack plan', () => {
  const date = '2026-09-24';
  const planned = plan('snack-plan', date, 'snack');
  const actual = log('snack-log', date, 'snack');
  const entries = core.dayPlannerEntries(state({ logs: [actual] }), date, [planned]);

  assert.equal(entries.filter((entry) => entry.kind === 'plan').length, 1);
  assert.equal(entries.filter((entry) => entry.kind === 'log').length, 1);
  assert.equal(entries.find((entry) => entry.kind === 'log').completedPlan, false);
});

test('not_offered does not replace a planned main meal', () => {
  const date = '2026-09-24';
  const planned = plan('lunch-plan', date, 'lunch');
  const actual = log('lunch-not-offered', date, 'lunch', { outcome: 'not_offered' });
  const entries = core.dayPlannerEntries(state({ logs: [actual] }), date, [planned]);

  assert.equal(entries.filter((entry) => entry.kind === 'plan').length, 1);
  assert.equal(entries.filter((entry) => entry.kind === 'log').length, 1);
});

test('explicit plan links win before free same-slot fallback matching', () => {
  const date = '2026-09-24';
  const a = plan('plan-a', date, 'lunch');
  const b = plan('plan-b', date, 'lunch');
  const linked = log('linked-a', date, 'lunch', { plannedMealId: 'plan-a', createdAt: `${date}T11:00:00.000Z` });
  const free = log('free-b', date, 'lunch', { createdAt: `${date}T12:00:00.000Z` });
  const entries = core.dayPlannerEntries(state({ logs: [linked, free] }), date, [a, b]);

  const completedByPlan = new Map(entries.filter((entry) => entry.completedPlan).map((entry) => [entry.planId, entry.log.id]));
  assert.equal(completedByPlan.get('plan-a'), 'linked-a');
  assert.equal(completedByPlan.get('plan-b'), 'free-b');
});

test('one free main-meal log replaces only one of multiple concrete same-slot plans', () => {
  const date = '2026-09-24';
  const a = plan('plan-a', date, 'lunch');
  const b = plan('plan-b', date, 'lunch');
  const entries = core.dayPlannerEntries(state({ logs: [log('free', date, 'lunch')] }), date, [a, b]);

  assert.equal(entries.filter((entry) => entry.completedPlan).length, 1);
  assert.equal(entries.filter((entry) => entry.kind === 'plan').length, 1);
});

test('a free main-meal log satisfies rollover for that slot without changing concrete open-plan identity', () => {
  const date = '2026-09-23';
  const data = state({
    logs: [log('free-lunch', date, 'lunch')],
    planLocks: { [`${date}|lunch`]: plan('lunch-plan', date, 'lunch') },
  });

  assert.equal(core.openPlanInstances(data).length, 1, 'free logs stay unlinked to a concrete plan id');
  assert.deepEqual(core.outstandingPastPlans(data, '2026-09-24'), [], 'the actual lunch must prevent a false rollover prompt');
});
