const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'planning.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');

function addDays(value, days) {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadPlanner(state, completed = new Set()) {
  const context = {
    state,
    addDays,
    today: () => '2026-08-17',
    completedLog: (date, meal) => completed.has(`${date}|${meal}`) ? { id: `log-${date}-${meal}` } : null,
    save: () => { context.saved = true; },
    renderAll: () => { context.rendered = true; },
    showToast: () => {},
    status: () => 'Offen',
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

function loadSingleMealEditor(state) {
  const context = {
    state,
    clone,
    planLockKey: (date, meal) => `${date}|${meal}`,
    prepareManualMealData: (data) => ({ ok: true, data: clone(data), validation: { ok: true } }),
    mealSnapshot: (date, meal, entry, mode) => ({ ...clone(entry), date, meal, mode }),
  };
  vm.createContext(context);
  vm.runInContext(`${uiSource}\nthis.__storeEditedPlanMeal = storeEditedPlanMeal;`, context);
  return context;
}

function fixture() {
  return {
    settings: { planFrom: '2026-08-17' },
    planLocks: {
      '2026-08-17|breakfast': { mode: 'auto', focusId: 'auto', foodIds: ['auto'] },
      '2026-08-18|lunch': { mode: 'auto', focusId: 'follow', foodIds: ['follow'], followUpFoodId: 'follow' },
      '2026-08-19|dinner': { mode: 'manual', focusId: 'manual', foodIds: ['manual'] },
      '2026-08-20|lunch': { mode: 'manual', focusId: 'completed', foodIds: ['completed'] },
      '2026-08-21|dinner': { mode: 'manual', focusId: 'added', foodIds: ['added'] },
      '2026-08-25|lunch': { mode: 'auto', focusId: 'outside', foodIds: ['outside'] },
    },
    manualMeals: {
      '2026-08-21|dinner': { manualAdded: true, focusId: 'added', foodIds: ['added'] },
    },
    overrides: {
      '2026-08-17|breakfast': 'auto',
      '2026-08-18|lunch': 'follow',
      '2026-08-19|dinner': 'manual',
      '2026-08-20|lunch': 'completed',
      '2026-08-21|dinner': 'added',
      '2026-08-25|lunch': 'outside',
    },
    autoLockExcluded: {
      '2026-08-17|breakfast': true,
      '2026-08-25|lunch': true,
    },
  };
}

test('TODO3 REPLAN-01: Neu planen bereinigt nur normalen Auto-Zustand der sichtbaren 7 Tage', () => {
  const state = fixture();
  const context = loadPlanner(state);
  context.clearAutomaticLocks();

  assert.equal(state.planLocks['2026-08-17|breakfast'], undefined);
  assert.ok(state.planLocks['2026-08-18|lunch'], 'Wiedervorlage muss erhalten bleiben');
  assert.ok(state.planLocks['2026-08-19|dinner'], 'manueller Schutz muss erhalten bleiben');
  assert.ok(state.planLocks['2026-08-25|lunch'], 'außerhalb der sichtbaren Woche unverändert');

  assert.equal(state.overrides['2026-08-17|breakfast'], undefined);
  assert.equal(state.overrides['2026-08-18|lunch'], 'follow');
  assert.equal(state.autoLockExcluded['2026-08-17|breakfast'], undefined);
  assert.equal(state.autoLockExcluded['2026-08-25|lunch'], true);
  assert.equal(context.saved, true);
  assert.equal(context.rendered, true);
});

test('TODO3 REPLAN-SINGLE: Bearbeiten ersetzt nur den gewählten Slot und schützt ihn danach manuell', () => {
  const state = fixture();
  const targetKey = '2026-08-17|breakfast';
  const untouched = clone({
    followUp: state.planLocks['2026-08-18|lunch'],
    manual: state.planLocks['2026-08-19|dinner'],
    outside: state.planLocks['2026-08-25|lunch'],
    manualMeals: state.manualMeals,
  });
  const context = loadSingleMealEditor(state);

  const result = context.__storeEditedPlanMeal('2026-08-17', 'breakfast', {
    focusId: 'replacement',
    foodIds: ['replacement'],
    baseFoodIds: ['replacement'],
    sampleFoodIds: [],
    manualAdded: true,
  });

  assert.equal(result.ok, true);
  assert.equal(state.planLocks[targetKey].mode, 'manual');
  assert.equal(state.planLocks[targetKey].focusId, 'replacement');
  assert.equal(state.planLocks[targetKey].manualAdded, false, 'bearbeiteter bestehender Slot ist kein zusätzlich angelegter manueller Slot');
  assert.equal(state.overrides[targetKey], undefined);
  assert.equal(state.autoLockExcluded[targetKey], undefined);
  assert.deepEqual(clone({
    followUp: state.planLocks['2026-08-18|lunch'],
    manual: state.planLocks['2026-08-19|dinner'],
    outside: state.planLocks['2026-08-25|lunch'],
    manualMeals: state.manualMeals,
  }), untouched, 'andere Slots und manuell hinzugefügte Mahlzeiten bleiben unverändert');
});

test('TODO3 REPLAN-02: vollständige Woche mit Schutz entspricht der normalen automatischen Bereinigung', () => {
  const state = fixture();
  const context = loadPlanner(state);
  context.rebuildVisiblePlan(false);

  assert.equal(state.planLocks['2026-08-17|breakfast'], undefined);
  assert.ok(state.planLocks['2026-08-18|lunch']);
  assert.ok(state.planLocks['2026-08-19|dinner']);
  assert.ok(state.planLocks['2026-08-21|dinner']);
  assert.ok(state.planLocks['2026-08-25|lunch']);
});

test('TODO3 REPLAN-03: vollständige Woche kann lösbare manuelle Locks aufheben, schützt Logs, Follow-ups und manuell hinzugefügte Mahlzeiten', () => {
  const state = fixture();
  const completed = new Set(['2026-08-20|lunch']);
  const context = loadPlanner(state, completed);
  context.rebuildVisiblePlan(true);

  assert.equal(state.planLocks['2026-08-17|breakfast'], undefined, 'normaler Auto-Lock wird entfernt');
  assert.equal(state.planLocks['2026-08-19|dinner'], undefined, 'lösbarer manueller Lock wird freigegeben');
  assert.ok(state.planLocks['2026-08-18|lunch'], 'Follow-up-Lock bleibt');
  assert.ok(state.planLocks['2026-08-20|lunch'], 'protokollierter Slot bleibt');
  assert.ok(state.planLocks['2026-08-21|dinner'], 'manualAdded bleibt');
  assert.ok(state.planLocks['2026-08-25|lunch'], 'außerhalb der Woche bleibt');

  assert.equal(state.overrides['2026-08-19|dinner'], undefined);
  assert.equal(state.overrides['2026-08-20|lunch'], 'completed');
  assert.equal(state.overrides['2026-08-21|dinner'], 'added');
});
