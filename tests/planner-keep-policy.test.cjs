const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../js/planner-keep-policy.js');
const tracking = require('../js/planner-keep-tracking.js');
const rollover = require('../js/planner-log-rollover.js');

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test('historische Drei-Tage-Auto-Locks werden entfernt, echte Schutz- und Persistenzgründe bleiben', () => {
  const state = {
    planLocks: {
      '2026-09-02|lunch': { mode: 'auto', focusId: 'legacy' },
      '2026-09-02|breakfast': { mode: 'auto', focusId: 'tracking', plannerTrackingSnapshot: true, planId: 'plan-tracking' },
      '2026-09-02|dinner': { mode: 'auto', focusId: 'linked-legacy', planId: 'plan-linked-legacy' },
      '2026-09-03|lunch': { mode: 'auto', focusId: 'follow', followUpFoodId: 'follow' },
      '2026-09-03|dinner': { mode: 'auto', focusId: 'rollover', rolloverShifted: true, planId: 'plan-rollover' },
      '2026-09-04|lunch': { mode: 'manual', focusId: 'manual' },
      '2026-09-04|dinner': { mode: 'auto', focusId: 'random', randomSwapTarget: true },
      '2026-09-05|lunch': { mode: 'auto', focusId: 'outside' },
    },
    overrides: {
      '2026-09-02|lunch': 'legacy',
      '2026-09-03|lunch': 'follow',
    },
    autoLockExcluded: {
      '2026-09-02|lunch': true,
      '2026-09-03|breakfast': true,
      '2026-09-04|snack': 'meal-removed',
    },
    logs: [{
      id: 'linked-log',
      date: '2026-09-02',
      meal: 'dinner',
      plannedMealId: 'plan-linked-legacy',
      outcome: 'eaten',
    }],
  };

  const changed = policy.cleanupLegacyThreeDayAutoLocks(state, '2026-09-02', addDays);
  assert.equal(changed, 3, 'Auto-Lock, verknüpfter Alt-Lock und alte boolesche Ausnahme werden migriert');
  assert.equal(state.planLocks['2026-09-02|lunch'], undefined);
  assert.equal(state.overrides['2026-09-02|lunch'], undefined);
  assert.equal(state.autoLockExcluded['2026-09-02|lunch'], undefined);
  assert.equal(state.autoLockExcluded['2026-09-03|breakfast'], undefined, 'alte boolesche Auto-Lock-Ausnahme wird bereinigt');
  assert.equal(state.autoLockExcluded['2026-09-04|snack'], 'meal-removed', 'bewusst gelöschte Mahlzeit bleibt über Reload entfernt');
  assert.ok(state.planLocks['2026-09-02|breakfast']);
  assert.equal(state.planLocks['2026-09-02|breakfast'].planId, 'plan-tracking', 'Tracking-Plan-ID bleibt für Log-Verknüpfung erhalten');
  assert.equal(state.planLocks['2026-09-02|dinner'].planId, 'plan-linked-legacy');
  assert.equal(state.planLocks['2026-09-02|dinner'].plannerTrackingSnapshot, true, 'verknüpfter alter Tages-Lock wird zu unsichtbarem Tracking statt gelöscht');
  assert.ok(state.planLocks['2026-09-03|lunch']);
  assert.ok(state.planLocks['2026-09-03|dinner']);
  assert.ok(state.planLocks['2026-09-04|lunch']);
  assert.ok(state.planLocks['2026-09-04|dinner']);
  assert.ok(state.planLocks['2026-09-05|lunch']);
});

test('nur generische Auto-Snapshots gelten als alte Drei-Tage-Fixierung', () => {
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto' }), true);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'manual' }), false);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto', followUpFoodId: 'x' }), false);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto', plannerTrackingSnapshot: true }), false);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto', rolloverShifted: true }), false);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto', randomSwapPinned: true }), false);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto', randomSwapPreserved: true }), false);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto', randomSwapTarget: true }), false);
});

test('Woche neu planen entfernt nur neu berechenbaren Auto-Zustand', () => {
  const state = {
    planLocks: {
      '2026-09-02|breakfast': { mode: 'auto', focusId: 'tracking', plannerTrackingSnapshot: true, planId: 'plan-tracking' },
      '2026-09-02|lunch': { mode: 'auto', focusId: 'automatic' },
      '2026-09-03|lunch': { mode: 'manual', focusId: 'kept' },
      '2026-09-04|lunch': { mode: 'auto', focusId: 'follow', followUpFoodId: 'follow' },
      '2026-09-10|lunch': { mode: 'auto', focusId: 'outside' },
    },
    overrides: {
      '2026-09-02|lunch': 'automatic',
      '2026-09-03|lunch': 'kept',
      '2026-09-04|lunch': 'follow',
      '2026-09-10|lunch': 'outside',
    },
    autoLockExcluded: {
      '2026-09-02|lunch': true,
      '2026-09-03|snack': 'meal-removed',
      '2026-09-10|lunch': true,
    },
  };

  policy.clearReplannablePlanState(state, '2026-09-02', 7, addDays);

  assert.equal(state.planLocks['2026-09-02|lunch'], undefined, 'normaler Auto-Zustand wird neu berechenbar');
  assert.equal(state.overrides['2026-09-02|lunch'], undefined);
  assert.ok(state.planLocks['2026-09-02|breakfast'], 'Tracking-Plan-ID bleibt bestehen');
  assert.ok(state.planLocks['2026-09-03|lunch'], 'Behalten bleibt bestehen');
  assert.equal(state.overrides['2026-09-03|lunch'], 'kept');
  assert.ok(state.planLocks['2026-09-04|lunch'], 'Wiedervorlage bleibt bestehen');
  assert.equal(state.overrides['2026-09-04|lunch'], 'follow');
  assert.equal(state.autoLockExcluded['2026-09-02|lunch'], undefined, 'alte boolesche Auto-Ausnahme wird gelöst');
  assert.equal(state.autoLockExcluded['2026-09-03|snack'], 'meal-removed', 'bewusst gelöschte Mahlzeit bleibt gelöscht');
  assert.ok(state.planLocks['2026-09-10|lunch'], 'außerhalb der Woche bleibt Zustand unverändert');
  assert.equal(state.autoLockExcluded['2026-09-10|lunch'], true);
});

test('heutiger Tracking-Snapshot hat keine Schutzwirkung und bleibt bei gleicher Mahlzeit stabil', () => {
  const first = {
    mode: 'auto',
    plannerTrackingSnapshot: true,
    planId: 'plan-a',
    createdAt: '2026-09-02T08:00:00.000Z',
    focusId: 'kartoffel',
    foodIds: ['kartoffel'],
  };
  const sameMeal = {
    ...first,
    planId: 'plan-b',
    createdAt: '2026-09-02T09:00:00.000Z',
  };

  assert.equal(tracking.isTrackingOnly(first), true);
  assert.equal(tracking.sameTrackingPlan(first, sameMeal), true);
  assert.equal(tracking.isTrackingOnly({ ...first, rolloverShifted: true }), false);
  assert.equal(tracking.sameTrackingPlan(first, { ...sameMeal, focusId: 'karotte', foodIds: ['karotte'] }), false);
});

test('Tracking-Snapshot bleibt fuer den Tageswechsel sichtbar und wird beim Verschieben echte feste Planung', () => {
  const state = {
    backupMeta: {
      plannerLinking: {
        version: 1,
        rolloverHandled: {},
        carriedPlans: {},
      },
    },
    planLocks: {
      '2026-09-01|lunch': {
        date: '2026-09-01',
        meal: 'lunch',
        mode: 'auto',
        plannerTrackingSnapshot: true,
        planId: 'plan-tracking',
        focusId: 'kartoffel',
        foodIds: ['kartoffel'],
        baseFoodIds: ['kartoffel'],
        sampleFoodIds: [],
      },
    },
    manualMeals: {},
    overrides: {},
    autoLockExcluded: {},
    logs: [],
  };

  const outstanding = rollover.outstandingPastPlans(state, '2026-09-02');
  assert.equal(outstanding.length, 1);
  assert.equal(outstanding[0].planId, 'plan-tracking');

  const shifted = rollover.shiftOutstandingPlans(state, outstanding, addDays);
  assert.equal(shifted.length, 1);
  assert.equal(shifted[0].date, '2026-09-02');
  const movedLock = state.planLocks['2026-09-02|lunch'];
  assert.ok(movedLock);
  assert.equal(movedLock.rolloverShifted, true);
  assert.equal(tracking.isTrackingOnly(movedLock), false, 'Verschobene offene Planung darf nicht als unsichtbares Tracking behandelt werden');
});
