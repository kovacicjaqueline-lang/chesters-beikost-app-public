const test = require('node:test');
const assert = require('node:assert/strict');

const cascade = require('../js/planner-log-rollover-cascade.js');
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

function addDays(date, delta) {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(Date.UTC(y, m - 1, d + delta));
  return value.toISOString().slice(0, 10);
}

function plan(id, date, meal = 'lunch', extra = {}) {
  const focusId = extra.focusId || `${id}-food`;
  return {
    planId: id,
    date,
    meal,
    active: true,
    focusId,
    foodIds: [focusId],
    baseFoodIds: [focusId],
    sampleFoodIds: [],
    type: 'bekannt',
    mode: 'auto',
    ...extra,
  };
}

test('visible generated future auto plans are materialized before the approved cascade', () => {
  const data = state({
    planLocks: { '2026-08-18|lunch': plan('missed', '2026-08-18') },
  });
  const generatedDays = [
    { date: '2026-08-19', meals: [plan('generated-19', '2026-08-19')] },
    { date: '2026-08-20', meals: [plan('generated-20', '2026-08-20')] },
    { date: '2026-08-21', meals: [plan('generated-21', '2026-08-21')] },
  ];

  cascade.materializeVisibleFuturePlans(
    data,
    generatedDays,
    ['lunch'],
    (date, meal, generated) => ({ ...generated, date, meal, mode: 'auto' }),
  );
  core.shiftOutstandingPlans(data, core.outstandingPastPlans(data, '2026-08-19'), addDays);

  const byId = Object.fromEntries(core.allPlanInstances(data).map((entry) => [entry.planId, entry.date]));
  assert.equal(byId.missed, '2026-08-19');
  assert.equal(byId['generated-19'], '2026-08-20');
  assert.equal(byId['generated-20'], '2026-08-21');
  assert.equal(byId['generated-21'], '2026-08-22');
});

test('materialization is limited to affected meal types and never replaces stored plans', () => {
  const existing = plan('existing', '2026-08-19');
  const data = state({ planLocks: { '2026-08-19|lunch': existing } });
  const days = [{
    date: '2026-08-19',
    meals: [plan('generated-lunch', '2026-08-19'), plan('generated-breakfast', '2026-08-19', 'breakfast')],
  }];

  const added = cascade.materializeVisibleFuturePlans(
    data,
    days,
    ['lunch'],
    (date, meal, generated) => ({ ...generated, date, meal }),
  );

  assert.equal(added.length, 0);
  assert.equal(data.planLocks['2026-08-19|lunch'].planId, 'existing');
  assert.equal(data.planLocks['2026-08-19|breakfast'], undefined);
});

test('slot completion follows the primary concrete plan, not another same-type carried plan', () => {
  const data = state({
    planLocks: { '2026-08-19|lunch': plan('primary', '2026-08-19') },
    logs: [{
      id: 'carried-log',
      date: '2026-08-19',
      meal: 'lunch',
      focusId: 'x',
      foodIds: ['x'],
      outcome: 'eaten',
      foodOutcomes: { x: 'eaten' },
      plannedMealId: 'carried',
    }],
    backupMeta: {
      plannerLinking: {
        version: 1,
        rolloverHandled: {},
        carriedPlans: { carried: plan('carried', '2026-08-19') },
      },
    },
  });

  assert.equal(cascade.primarySlotCompletion(data, core, '2026-08-19', 'lunch'), null);
  data.logs.push({
    id: 'primary-log',
    date: '2026-08-19',
    meal: 'lunch',
    focusId: 'y',
    foodIds: ['y'],
    outcome: 'eaten',
    foodOutcomes: { y: 'eaten' },
    plannedMealId: 'primary',
  });
  assert.equal(cascade.primarySlotCompletion(data, core, '2026-08-19', 'lunch').id, 'primary-log');
});
