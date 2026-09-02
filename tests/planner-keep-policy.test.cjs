const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../js/plan-checks-solution-preservation.js');
const tracking = require('../js/planner-keep-tracking.js');
const rollover = require('../js/planner-log-rollover.js');

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test('historische Drei-Tage-Auto-Locks werden entfernt, echte Schutzgründe bleiben', () => {
  const state = {
    planLocks: {
      '2026-09-02|lunch': { mode: 'auto', focusId: 'legacy' },
      '2026-09-03|lunch': { mode: 'auto', focusId: 'follow', followUpFoodId: 'follow' },
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
    },
  };

  const removed = policy.cleanupLegacyThreeDayAutoLocks(state, '2026-09-02', addDays);
  assert.equal(removed, 1);
  assert.equal(state.planLocks['2026-09-02|lunch'], undefined);
  assert.equal(state.overrides['2026-09-02|lunch'], undefined);
  assert.equal(state.autoLockExcluded['2026-09-02|lunch'], undefined);
  assert.ok(state.planLocks['2026-09-03|lunch']);
  assert.ok(state.planLocks['2026-09-04|lunch']);
  assert.ok(state.planLocks['2026-09-04|dinner']);
  assert.ok(state.planLocks['2026-09-05|lunch']);
});

test('nur generische Auto-Snapshots gelten als alte Drei-Tage-Fixierung', () => {
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto' }), true);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'manual' }), false);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto', followUpFoodId: 'x' }), false);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto', randomSwapPinned: true }), false);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto', randomSwapPreserved: true }), false);
  assert.equal(policy.isLegacyThreeDayAutoLock({ mode: 'auto', randomSwapTarget: true }), false);
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
