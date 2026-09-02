const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../js/plan-checks-solution-preservation.js');

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
