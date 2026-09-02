const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  return {
    planId: id,
    active: true,
    date,
    meal,
    focusId: extra.focusId || `${id}-food`,
    foodIds: extra.foodIds || [extra.focusId || `${id}-food`],
    baseFoodIds: extra.baseFoodIds || [extra.focusId || `${id}-food`],
    sampleFoodIds: [],
    type: extra.type || 'bekannt',
    mode: extra.mode || 'auto',
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
    baseFoodIds: [foodId],
    sampleFoodIds: [],
    outcome: extra.outcome || 'eaten',
    foodOutcomes: { [foodId]: extra.outcome || 'eaten' },
    createdAt: extra.createdAt || `${date}T12:00:00.000Z`,
    ...extra,
  };
}

test('Phase-1 extra breakfast log remains a Planner day entry without a breakfast plan', () => {
  const data = state({ logs: [log('breakfast-log', '2026-08-19', 'breakfast')] });
  const entries = core.dayPlannerEntries(data, '2026-08-19', [plan('lunch-plan', '2026-08-19')]);
  assert.equal(entries.filter((entry) => entry.kind === 'log' && entry.meal === 'breakfast').length, 1);
  assert.equal(entries.filter((entry) => entry.kind === 'plan' && entry.meal === 'breakfast').length, 0);
});

test('two logged lunches on the same date are both kept as separate Planner entries', () => {
  const data = state({
    logs: [
      log('lunch-a', '2026-08-19', 'lunch', { createdAt: '2026-08-19T11:00:00.000Z' }),
      log('lunch-b', '2026-08-19', 'lunch', { createdAt: '2026-08-19T14:00:00.000Z' }),
    ],
  });
  const entries = core.dayPlannerEntries(data, '2026-08-19', []);
  assert.deepEqual(entries.filter((entry) => entry.kind === 'log').map((entry) => entry.log.id), ['lunch-a', 'lunch-b']);
});

test('a linked log completes only its concrete plan; another same-type plan stays open', () => {
  const data = state();
  const a = plan('plan-a', '2026-08-19');
  const b = plan('plan-b', '2026-08-19');
  data.logs.push(log('linked', '2026-08-19', 'lunch', { plannedMealId: 'plan-a' }));
  assert.ok(core.linkedCompletionLog(data, 'plan-a', '2026-08-19', 'lunch'));
  assert.equal(core.linkedCompletionLog(data, 'plan-b', '2026-08-19', 'lunch'), null);
  const entries = core.dayPlannerEntries(data, '2026-08-19', [a, b]);
  assert.equal(entries.filter((entry) => entry.kind === 'plan' && entry.planId === 'plan-b').length, 1);
});

test('a free log of the same date and meal type completes no plan', () => {
  const data = state({ logs: [log('free', '2026-08-19')] });
  assert.equal(core.linkedCompletionLog(data, 'plan-a', '2026-08-19', 'lunch'), null);
  assert.equal(core.openPlanInstances({ ...data, planLocks: { '2026-08-19|lunch': plan('plan-a', '2026-08-19') } }).length, 1);
});

test('legacy migration links exactly the log old completedLog would have selected', () => {
  const data = state({
    logs: [
      log('old', '2026-08-18', 'lunch', { createdAt: '2026-08-18T11:00:00.000Z' }),
      log('new', '2026-08-18', 'lunch', { createdAt: '2026-08-18T13:00:00.000Z' }),
    ],
    planLocks: {
      '2026-08-18|lunch': { date: '2026-08-18', meal: 'lunch', focusId: 'x', foodIds: ['x'], mode: 'auto' },
    },
  });
  core.upgradePlannerLinking(data);
  const id = data.planLocks['2026-08-18|lunch'].planId;
  assert.ok(id);
  assert.equal(data.logs.find((entry) => entry.id === 'new').plannedMealId, id);
  assert.equal(data.logs.find((entry) => entry.id === 'old').plannedMealId, undefined);
  assert.equal(data.backupMeta.plannerLinking.version, core.FEATURE_VERSION);
});

test('not_offered remains logged but does not complete its linked plan', () => {
  const data = state({
    logs: [log('missed', '2026-08-18', 'lunch', { plannedMealId: 'plan-a', outcome: 'not_offered' })],
    planLocks: { '2026-08-18|lunch': plan('plan-a', '2026-08-18') },
  });
  assert.equal(core.linkedCompletionLog(data, 'plan-a', '2026-08-18', 'lunch'), null);
  assert.equal(core.outstandingPastPlans(data, '2026-08-19').length, 1);
  assert.equal(core.dayPlannerEntries(data, '2026-08-18', core.allPlanInstances(data)).filter((entry) => entry.kind === 'log').length, 1);
});

test('previous-day calculation crosses month and year boundaries safely', () => {
  assert.equal(core.previousIsoDate('2026-09-01'), '2026-08-31');
  assert.equal(core.previousIsoDate('2026-01-01'), '2025-12-31');
  assert.equal(core.previousIsoDate('invalid'), '');
});

test('shifting open plans moves manual and automatic plans but creates and moves no logs', () => {
  const data = state({
    logs: [log('historical', '2026-08-18', 'breakfast')],
    manualMeals: {
      '2026-08-18|breakfast': plan('manual-a', '2026-08-18', 'breakfast', { manualAdded: true, mode: 'manual' }),
    },
    planLocks: {
      '2026-08-18|breakfast': plan('manual-a', '2026-08-18', 'breakfast', { manualAdded: true, mode: 'manual' }),
      '2026-08-18|lunch': plan('auto-a', '2026-08-18', 'lunch'),
    },
  });
  const beforeLogs = JSON.stringify(data.logs);
  const open = core.outstandingPastPlans(data, '2026-08-19');
  core.shiftOutstandingPlans(data, open, addDays);
  assert.ok(core.allPlanInstances(data).some((entry) => entry.planId === 'manual-a' && entry.date === '2026-08-19'));
  assert.ok(core.allPlanInstances(data).some((entry) => entry.planId === 'auto-a' && entry.date === '2026-08-19'));
  assert.equal(JSON.stringify(data.logs), beforeLogs);
  assert.equal(data.logs[0].date, '2026-08-18');
});

test('a same-type free log on the target date is not a collision', () => {
  const data = state({
    logs: [log('free-target', '2026-08-19', 'lunch')],
    planLocks: { '2026-08-18|lunch': plan('open-a', '2026-08-18') },
  });
  core.shiftPlanOneDay(data, 'open-a', addDays);
  const moved = core.allPlanInstances(data).find((entry) => entry.planId === 'open-a');
  assert.equal(moved.date, '2026-08-19');
  assert.equal(data.logs[0].date, '2026-08-19');
});

test('an open same-type target plan cascades forward instead of being overwritten', () => {
  const data = state({
    planLocks: {
      '2026-08-18|lunch': plan('source', '2026-08-18'),
      '2026-08-19|lunch': plan('target', '2026-08-19'),
      '2026-08-20|lunch': plan('next', '2026-08-20'),
    },
  });
  core.shiftPlanOneDay(data, 'source', addDays);
  const byId = Object.fromEntries(core.allPlanInstances(data).map((entry) => [entry.planId, entry]));
  assert.equal(byId.source.date, '2026-08-19');
  assert.equal(byId.target.date, '2026-08-20');
  assert.equal(byId.next.date, '2026-08-21');
});

test('a completed target plan stays fixed and shifted open plan coexists on that date', () => {
  const data = state({
    planLocks: {
      '2026-08-18|lunch': plan('source', '2026-08-18'),
      '2026-08-19|lunch': plan('completed-target', '2026-08-19'),
    },
    logs: [log('target-log', '2026-08-19', 'lunch', { plannedMealId: 'completed-target' })],
  });
  core.shiftPlanOneDay(data, 'source', addDays);
  const onTarget = core.allPlanInstances(data).filter((entry) => entry.date === '2026-08-19' && entry.meal === 'lunch');
  assert.deepEqual(new Set(onTarget.map((entry) => entry.planId)), new Set(['completed-target', 'source']));
  assert.equal(data.logs[0].date, '2026-08-19');
});

test('partially logged previous day prompts only for the uncompleted concrete plan', () => {
  const data = state({
    planLocks: {
      '2026-08-18|breakfast': plan('breakfast', '2026-08-18', 'breakfast'),
      '2026-08-18|lunch': plan('lunch', '2026-08-18', 'lunch'),
    },
    logs: [log('breakfast-log', '2026-08-18', 'breakfast', { plannedMealId: 'breakfast' })],
  });
  assert.deepEqual(core.outstandingPastPlans(data, '2026-08-19').map((entry) => entry.planId), ['lunch']);
});

test('Nicht verschieben persists an acknowledgement and suppresses the same prompt', () => {
  const data = state({ planLocks: { '2026-08-18|lunch': plan('open', '2026-08-18') } });
  const outstanding = core.outstandingPastPlans(data, '2026-08-19');
  core.markPlansKept(data, outstanding, '2026-08-19T20:00:00.000Z');
  assert.equal(core.outstandingPastPlans(data, '2026-08-19').length, 0);
  assert.equal(data.backupMeta.plannerLinking.rolloverHandled.open.action, 'keep');
});

test('Gestern nachtragen does not require a persisted acknowledgement: unhandled plan remains outstanding', () => {
  const data = state({ planLocks: { '2026-08-18|lunch': plan('open', '2026-08-18') } });
  // The backfill action intentionally does not call markPlansKept.
  assert.equal(core.outstandingPastPlans(data, '2026-08-19').length, 1);
  assert.equal(core.outstandingPastPlans(JSON.parse(JSON.stringify(data)), '2026-08-19').length, 1);
});

test('only open plans from the immediately previous day are rollover candidates', () => {
  const data = state({
    planLocks: {
      '2026-08-16|lunch': plan('p16', '2026-08-16'),
      '2026-08-17|lunch': plan('p17', '2026-08-17'),
      '2026-08-18|lunch': plan('p18', '2026-08-18'),
    },
  });
  const outstanding = core.outstandingPastPlans(data, '2026-08-19');
  assert.deepEqual(outstanding.map((entry) => entry.planId), ['p18']);
  core.shiftOutstandingPlans(data, outstanding, addDays);
  const byId = Object.fromEntries(core.allPlanInstances(data).map((entry) => [entry.planId, entry.date]));
  assert.equal(byId.p16, '2026-08-16');
  assert.equal(byId.p17, '2026-08-17');
  assert.equal(byId.p18, '2026-08-19');
});

test('rollover dialog uses compact concrete-plan copy and the approved actions', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'planner-log-rollover.js'), 'utf8');
  assert.match(source, /Gestern ·/);
  assert.match(source, /Plan um 1 Tag verschieben/);
  assert.match(source, /Gestern nachtragen/);
  assert.match(source, />Nicht verschieben</);
  assert.doesNotMatch(source, /Gestern wurde nicht vollständig protokolliert/);
  assert.doesNotMatch(source, /Plan beibehalten/);
});

test('plan identity and rollover metadata survive a JSON persistence round trip', () => {
  const data = state({ planLocks: { '2026-08-18|lunch': plan('persist-me', '2026-08-18') } });
  core.ensurePlannerMeta(data).rolloverHandled['persist-me'] = { action: 'keep', at: 'x' };
  const restored = JSON.parse(JSON.stringify(data));
  assert.equal(restored.planLocks['2026-08-18|lunch'].planId, 'persist-me');
  assert.equal(restored.backupMeta.plannerLinking.rolloverHandled['persist-me'].action, 'keep');
});

test('shift logic does not touch exposure logs or invent additional successful exposures', () => {
  const data = state({
    logs: [log('one', '2026-08-17', 'lunch')],
    planLocks: { '2026-08-18|lunch': plan('open', '2026-08-18') },
  });
  const exposureSlotsBefore = new Set(data.logs.map((entry) => `${entry.date}|${entry.meal}`)).size;
  core.shiftOutstandingPlans(data, core.outstandingPastPlans(data, '2026-08-19'), addDays);
  const exposureSlotsAfter = new Set(data.logs.map((entry) => `${entry.date}|${entry.meal}`)).size;
  assert.equal(exposureSlotsAfter, exposureSlotsBefore);
  assert.equal(data.logs.length, 1);
});

test('rollover feature never reuses the planner deferred flag', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'planner-log-rollover.js'), 'utf8');
  assert.equal(/state\.deferred|\.deferred\?/.test(source), false);
});
