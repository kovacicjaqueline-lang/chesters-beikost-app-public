const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const core = require('../js/planner-log-rollover.js');
const fixes = require('../js/planner-log-rollover-review-fixes.js');

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

function log(id, date, meal = 'lunch', extra = {}) {
  const foodId = extra.focusId || `${id}-food`;
  return {
    id,
    date,
    meal,
    focusId: foodId,
    foodIds: [foodId],
    outcome: extra.outcome || 'eaten',
    foodOutcomes: { [foodId]: extra.outcome || 'eaten' },
    createdAt: `${date}T12:00:00.000Z`,
    ...extra,
  };
}

test('visible future auto plans are archived without creating a planLock', () => {
  const data = state();
  const days = [{ date: '2026-08-24', meals: [plan('visible-24', '2026-08-24')] }];
  const result = fixes.persistVisibleAutoPlans(
    data,
    core,
    days,
    '2026-08-20',
    (_date, _meal, generated) => ({ ...generated }),
    '2026-08-20T10:00:00.000Z',
  );
  assert.equal(result.changed, true);
  assert.equal(data.planLocks['2026-08-24|lunch'], undefined);
  assert.equal(data.backupMeta.plannerLinking.carriedPlans['visible-24'].visibleSnapshot, true);
});

test('an archived visible plan remains discoverable after its date passes', () => {
  const data = state();
  fixes.persistVisibleAutoPlans(
    data,
    core,
    [{ date: '2026-08-21', meals: [plan('missed-visible', '2026-08-21')] }],
    '2026-08-20',
    (_date, _meal, generated) => ({ ...generated }),
  );
  assert.deepEqual(core.outstandingPastPlans(data, '2026-08-22').map((item) => item.planId), ['missed-visible']);
});

test('a real primary lock replaces the temporary visible snapshot for the same slot', () => {
  const data = state();
  fixes.persistVisibleAutoPlans(
    data,
    core,
    [{ date: '2026-08-22', meals: [plan('visible', '2026-08-22')] }],
    '2026-08-20',
    (_date, _meal, generated) => ({ ...generated }),
  );
  data.planLocks['2026-08-22|lunch'] = plan('locked', '2026-08-22');
  fixes.persistVisibleAutoPlans(
    data,
    core,
    [{ date: '2026-08-22', meals: [plan('locked', '2026-08-22')] }],
    '2026-08-20',
    (_date, _meal, generated) => ({ ...generated }),
  );
  assert.equal(data.backupMeta.plannerLinking.carriedPlans.visible, undefined);
  assert.equal(data.planLocks['2026-08-22|lunch'].planId, 'locked');
});

test('normal Auf morgen still treats a free actual log as a target conflict', () => {
  const data = state({ logs: [log('free-target', '2026-08-21')] });
  assert.equal(
    fixes.normalMoveSlotOccupied(data, core, '2026-08-21', 'lunch', () => false),
    true,
  );
});

test('normal Auf morgen treats a carried open plan as a target conflict', () => {
  const carried = {
    ...plan('carried', '2026-08-21'),
    source: 'carried',
    carriedPlannerPlan: true,
    rolloverShifted: true,
  };
  const data = state({
    backupMeta: {
      plannerLinking: {
        version: 1,
        rolloverHandled: {},
        carriedPlans: { carried },
      },
    },
  });
  assert.equal(
    fixes.normalMoveSlotOccupied(data, core, '2026-08-21', 'lunch', () => false),
    true,
  );
});

test('normal next-free search preserves the historic rule: auto slots are replaceable, manual/log slots are not', () => {
  const data = state({
    manualMeals: { '2026-08-22|lunch': plan('manual', '2026-08-22', 'lunch', { mode: 'manual' }) },
  });
  const free = fixes.normalMoveNextFreeDate(data, core, '2026-08-21', 'lunch', addDays);
  assert.equal(free, '2026-08-23');
});

test('next-free skips protected carried plans but temporary visible snapshots remain replaceable like auto plans', () => {
  const protectedPlan = {
    ...plan('protected', '2026-08-22'),
    source: 'carried',
    carriedPlannerPlan: true,
    rolloverShifted: true,
  };
  const visible = {
    ...plan('visible', '2026-08-23'),
    source: 'carried',
    carriedPlannerPlan: true,
    visibleSnapshot: true,
  };
  const data = state({
    backupMeta: {
      plannerLinking: {
        version: 1,
        rolloverHandled: {},
        carriedPlans: { protected: protectedPlan, visible },
      },
    },
  });
  const free = fixes.normalMoveNextFreeDate(data, core, '2026-08-21', 'lunch', addDays);
  assert.equal(free, '2026-08-23');
});

test('normal move clears an earlier keep acknowledgement for the same concrete plan', () => {
  const data = state({
    backupMeta: {
      plannerLinking: {
        version: 1,
        rolloverHandled: { kept: { action: 'keep', at: '2026-08-20T08:00:00.000Z' } },
        carriedPlans: {},
      },
    },
  });
  assert.equal(fixes.clearRolloverAcknowledgement(data, core, 'kept'), true);
  assert.equal(data.backupMeta.plannerLinking.rolloverHandled.kept, undefined);
  assert.equal(fixes.clearRolloverAcknowledgement(data, core, 'kept'), false);
});

test('completed-day summary counts every actual log and every documented gram', () => {
  const summary = fixes.dayActualLogSummary([
    log('breakfast', '2026-08-20', 'breakfast', { amount: '20' }),
    log('lunch-a', '2026-08-20', 'lunch', { amount: '35' }),
    log('lunch-b', '2026-08-20', 'lunch', { amount: '' }),
  ]);
  assert.deepEqual(summary, { count: 3, grams: 55 });
});

test('normal move review layer restores conflict choices and never calls rollover cascade directly', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'planner-log-rollover-review-fixes.js'), 'utf8');
  assert.match(source, /Vorhandene Mahlzeit ersetzen/);
  assert.match(source, /Auf den nächsten freien Tag verschieben/);
  assert.match(source, /moveCancel/);
  assert.match(source, /clearRolloverAcknowledgement\(state, core, sourcePlanId\)/);
  assert.doesNotMatch(source, /shiftPlanOneDay|shiftOutstandingPlans/);
});

test('editing a free log is explicitly protected from accidental plan inference', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'planner-log-rollover-review-fixes.js'), 'utf8');
  assert.match(source, /plan\?\.editId && !plan\.plannedMealId/);
  assert.match(source, /FREE_EDIT_SENTINEL/);
  assert.match(source, /delete saved\.plannedMealId/);
});

test('review-fix runtime loads before app startup and all planner runtime files are offline precached', () => {
  const root = path.join(__dirname, '..');
  const cascade = fs.readFileSync(path.join(root, 'js', 'planner-log-rollover-cascade.js'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(cascade, /planner-log-rollover-review-fixes\.js\?v=\d+\.\d+\.\d+/);
  for (const file of [
    './js/planner-log-rollover.js',
    './js/planner-log-rollover-cascade.js',
    './js/planner-log-rollover-review-fixes.js',
  ]) assert.ok(sw.includes(file), `${file} muss offline precached werden`);
  const coreIndex = index.indexOf('js/planner-log-rollover.js');
  const cascadeIndex = index.indexOf('js/planner-log-rollover-cascade.js');
  const recipeIndex = index.indexOf('js/planned-recipe-details.js');
  const appIndex = index.indexOf('src="app.js?v=');
  assert.ok(coreIndex >= 0 && coreIndex < cascadeIndex);
  assert.ok(cascadeIndex < recipeIndex && recipeIndex < appIndex);
});
