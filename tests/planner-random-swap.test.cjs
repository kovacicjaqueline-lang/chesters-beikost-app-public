const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const swap = require(path.join(root, 'js', 'planner-random-swap.js'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('RANDOM-SWAP-01: Kombinationsidentität ist reihenfolgeunabhängig', () => {
  assert.equal(swap.canonicalCombination(['gurke', 'kartoffel']), 'gurke+kartoffel');
  assert.equal(swap.canonicalCombination(['kartoffel', 'gurke', 'kartoffel']), 'gurke+kartoffel');
});

test('RANDOM-SWAP-02: jede spätere Verwendung einer heutigen Einführung wird als Abhängigkeit erkannt', () => {
  const current = { sampleFoodIds: ['gurke'], foodIds: ['hafer', 'gurke'] };
  const days = [
    { date: '2026-08-20', meals: [] },
    { date: '2026-08-21', meals: [{ active: true, meal: 'lunch', focusId: 'gurke', foodIds: ['gurke', 'kartoffel'], sampleFoodIds: [] }] },
  ];
  assert.equal(swap.hasFutureLearningDependency(days, '2026-08-20', current), true);
  days[1].meals[0].sampleFoodIds = ['gurke'];
  assert.equal(swap.hasFutureLearningDependency(days, '2026-08-20', current), true);
  days[1].meals[0].foodIds = ['kartoffel', 'apfel'];
  assert.equal(swap.hasFutureLearningDependency(days, '2026-08-20', current), false);
});

test('RANDOM-SWAP-03: zufällige Auswahl bevorzugt eine in der sichtbaren Woche noch nicht verwendete Kombination', () => {
  const alternatives = [
    { focusId: 'apfel', foodIds: ['apfel', 'hafer'] },
    { focusId: 'birne', foodIds: ['birne', 'dinkel'] },
  ];
  const otherMeals = [{ focusId: 'apfel', foodIds: ['hafer', 'apfel'] }];
  const chosen = swap.chooseAlternative(alternatives, otherMeals, () => 0);
  assert.equal(chosen.focusId, 'birne');
});

test('RANDOM-SWAP-04: sichtbare automatische Folgeslots werden eingefroren, Schutz- und Sonderfälle bleiben unangetastet', () => {
  const data = {
    planLocks: {
      '2026-08-21|breakfast': { mode: 'manual', focusId: 'manual', foodIds: ['manual'] },
      '2026-08-21|lunch': { mode: 'auto', focusId: 'follow', foodIds: ['follow'], followUpFoodId: 'follow' },
      '2026-08-22|breakfast': { mode: 'auto', focusId: 'already', foodIds: ['already'], [swap.PIN_FLAG]: true },
    },
    manualMeals: {
      '2026-08-22|lunch': { manualAdded: true, focusId: 'extra', foodIds: ['extra'] },
    },
    autoLockExcluded: {
      '2026-08-23|breakfast': true,
    },
  };
  const days = [
    {
      date: '2026-08-20',
      meals: [
        { active: true, meal: 'breakfast', focusId: 'target', foodIds: ['target'] },
        { active: true, meal: 'lunch', focusId: 'keep', foodIds: ['keep'] },
      ],
    },
    {
      date: '2026-08-21',
      meals: [
        { active: true, meal: 'breakfast', focusId: 'manual', foodIds: ['manual'] },
        { active: true, meal: 'lunch', focusId: 'follow', foodIds: ['follow'] },
      ],
    },
    {
      date: '2026-08-22',
      meals: [
        { active: true, meal: 'breakfast', focusId: 'already', foodIds: ['already'] },
        { active: true, meal: 'lunch', focusId: 'extra', foodIds: ['extra'], manualAdded: true },
      ],
    },
    {
      date: '2026-08-23',
      meals: [{ active: true, meal: 'breakfast', focusId: 'unlocked', foodIds: ['unlocked'] }],
    },
  ];
  const before = clone({
    manual: data.planLocks['2026-08-21|breakfast'],
    follow: data.planLocks['2026-08-21|lunch'],
    already: data.planLocks['2026-08-22|breakfast'],
  });
  const completed = new Set();
  const count = swap.pinVisibleAutomaticMeals(
    data,
    days,
    '2026-08-20|breakfast',
    (date, meal, generated, mode) => ({ ...clone(generated), date, meal, mode }),
    (date, meal) => completed.has(`${date}|${meal}`),
    '2026-08-20',
  );

  assert.equal(count, 2);
  for (const key of ['2026-08-20|lunch', '2026-08-23|breakfast']) {
    assert.equal(data.planLocks[key].mode, 'auto');
    assert.equal(data.planLocks[key][swap.PIN_FLAG], true);
    assert.equal(data.planLocks[key][swap.PRESERVE_FLAG], true);
  }
  assert.deepEqual(clone({
    manual: data.planLocks['2026-08-21|breakfast'],
    follow: data.planLocks['2026-08-21|lunch'],
    already: data.planLocks['2026-08-22|breakfast'],
  }), before);
  assert.equal(data.planLocks['2026-08-22|lunch'], undefined);
  assert.equal(data.autoLockExcluded['2026-08-23|breakfast'], undefined);
});

test('RANDOM-SWAP-05: Browser-Loader, Heute-Zugang und Offline-Precache enthalten das Tauschmodul', () => {
  const cascade = fs.readFileSync(path.join(root, 'js', 'planner-log-rollover-cascade.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const source = fs.readFileSync(path.join(root, 'js', 'planner-random-swap.js'), 'utf8');

  assert.match(cascade, /planner-random-swap\.js\?v=10\.1\.25/);
  assert.match(sw, /\.\/js\/planner-random-swap\.js/);
  assert.match(source, /class="btn secondary randomizeMeal"/);
  assert.match(source, /today-randomize-meal/);
  assert.match(source, /\.homeLog\[data-plan\]/);
  assert.match(source, /↻ Tauschen/);
  assert.match(source, /Der restliche Wochenplan bleibt unverändert/);
});

test('RANDOM-SWAP-06: automatische Fokus-Eignung respektiert Basis-, Auto- und Planner-Policy', () => {
  const food = { id: 'tahin' };
  assert.equal(swap.automaticFocusAllowed(food, 'lunch', '2026-08-20', () => true, () => true, () => true), true);
  assert.equal(swap.automaticFocusAllowed(food, 'lunch', '2026-08-20', () => false, () => true, () => true), false);
  assert.equal(swap.automaticFocusAllowed(food, 'lunch', '2026-08-20', () => true, () => false, () => true), false);
  assert.equal(swap.automaticFocusAllowed(food, 'lunch', '2026-08-20', () => true, () => true, () => false), false);
});

test('RANDOM-SWAP-07: bekannte Mahlzeiten werden nicht gegen neue Sample-Mahlzeiten getauscht', () => {
  const known = { sampleFoodIds: [] };
  const learning = { sampleFoodIds: ['gurke'] };
  const alternativeKnown = { sampleFoodIds: [] };
  assert.equal(swap.learningCandidateCompatible(known, learning, 'gurke'), false);
  assert.equal(swap.learningCandidateCompatible(known, alternativeKnown, 'apfel'), true);
  assert.equal(swap.learningCandidateCompatible(learning, { sampleFoodIds: ['birne'] }, 'birne'), true);
  assert.equal(swap.learningCandidateCompatible(learning, alternativeKnown, 'birne'), false);
});
