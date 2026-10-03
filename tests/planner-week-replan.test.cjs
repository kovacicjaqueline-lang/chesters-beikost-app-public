const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cascade = require(path.join(root, 'js', 'planner-log-rollover-cascade.js'));

test('WEEK-REPLAN-01: Mahlzeitenidentität erkennt gleiche FOOD-Kombinationen und unterschiedliche Rezepte', () => {
  assert.equal(
    cascade.plannerMealIdentity({ active: true, foodIds: ['kartoffel', 'gurke'] }),
    cascade.plannerMealIdentity({ active: true, foodIds: ['gurke', 'kartoffel', 'gurke'] }),
  );
  assert.notEqual(
    cascade.plannerMealIdentity({ active: true, recipeName: 'Kartoffel-Gurken-Taler', foodIds: ['kartoffel', 'gurke'] }),
    cascade.plannerMealIdentity({ active: true, recipeName: 'Kartoffel-Gurken-Brei', foodIds: ['kartoffel', 'gurke'] }),
  );
  assert.equal(cascade.plannerMealIdentity({ active: true, empty: true, foodIds: ['kartoffel'] }), '');
});

test('WEEK-REPLAN-02: Neuplanung variiert nur automatisch veränderbare zukünftige Slots', () => {
  const data = {
    planLocks: {
      '2026-09-23|lunch': { mode: 'auto', focusId: 'kartoffel' },
      '2026-09-24|lunch': { mode: 'manual', focusId: 'gurke' },
      '2026-09-25|lunch': { mode: 'auto', focusId: 'birne', followUpFoodId: 'birne' },
    },
    manualMeals: {
      '2026-09-26|lunch': { manualAdded: true, focusId: 'apfel' },
    },
  };
  const days = [
    { date: '2026-09-22', meals: [{ active: true, meal: 'lunch', foodIds: ['past'] }] },
    { date: '2026-09-23', meals: [{ active: true, meal: 'lunch', foodIds: ['kartoffel'] }] },
    { date: '2026-09-24', meals: [{ active: true, meal: 'lunch', foodIds: ['gurke'] }] },
    { date: '2026-09-25', meals: [{ active: true, meal: 'lunch', foodIds: ['birne'] }] },
    { date: '2026-09-26', meals: [{ active: true, meal: 'lunch', foodIds: ['apfel'] }] },
    { date: '2026-09-27', meals: [{ active: true, meal: 'lunch', foodIds: ['hafer'] }] },
  ];
  const completed = new Set(['2026-09-27|lunch']);
  const isCompleted = (date, meal) => completed.has(`${date}|${meal}`);

  const protectedTargets = cascade.collectWeekReplanTargets(
    data,
    days,
    isCompleted,
    false,
    '2026-09-23',
  );
  assert.deepEqual(
    protectedTargets.map(({ date, meal }) => `${date}|${meal}`),
    ['2026-09-23|lunch'],
  );

  const releasedTargets = cascade.collectWeekReplanTargets(
    data,
    days,
    isCompleted,
    true,
    '2026-09-23',
  );
  assert.deepEqual(
    releasedTargets.map(({ date, meal }) => `${date}|${meal}`),
    ['2026-09-23|lunch', '2026-09-24|lunch'],
  );
});

test('WEEK-REPLAN-03: Cleanup verändert keine Random-Swap-Pins außerhalb der sichtbaren Woche', () => {
  const swap = {
    PIN_FLAG: 'randomSwapPinned',
    PRESERVE_FLAG: 'randomSwapPreserved',
    TARGET_FLAG: 'randomSwapTarget',
  };
  const data = {
    planLocks: {
      '2026-09-23|lunch': {
        mode: 'auto',
        [swap.PIN_FLAG]: true,
        [swap.TARGET_FLAG]: true,
      },
      '2026-09-24|lunch': {
        mode: 'auto',
        [swap.PIN_FLAG]: true,
        [swap.PRESERVE_FLAG]: true,
      },
      '2026-10-05|lunch': {
        mode: 'auto',
        [swap.PIN_FLAG]: true,
        [swap.PRESERVE_FLAG]: true,
      },
    },
  };
  const addDays = (date, days) => {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  };

  const cleaned = cascade.cleanupWeekReplanPins(
    data,
    swap,
    new Set(['2026-09-23|lunch']),
    '2026-09-23',
    addDays,
  );

  assert.equal(cleaned, 2);
  assert.deepEqual(data.planLocks['2026-09-23|lunch'], { mode: 'auto' });
  assert.equal(data.planLocks['2026-09-24|lunch'], undefined);
  assert.equal(data.planLocks['2026-10-05|lunch'][swap.PIN_FLAG], true);
  assert.equal(data.planLocks['2026-10-05|lunch'][swap.PRESERVE_FLAG], true);
});
