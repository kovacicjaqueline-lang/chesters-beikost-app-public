const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const stateSource = fs.readFileSync(path.join(root, 'js', 'state.js'), 'utf8');
const modelSource = fs.readFileSync(path.join(root, 'js', 'model.js'), 'utf8');

function loadModel(initialState) {
  const context = {
    FOOD_DB: [],
    __state: initialState,
    save: () => { context.saved = true; },
    renderAll: () => { context.rendered = true; },
    normalizeName: (value) => String(value || '').toLowerCase(),
  };
  vm.createContext(context);
  vm.runInContext(`${stateSource}\nstate = this.__state; this.__PHASES = PHASES;`, context);
  vm.runInContext(`${modelSource}\nthis.__phaseMealKeys = phaseMealKeys; this.__setPhase = setPhase; this.__currentPhase = currentPhase;`, context);
  return context;
}

function baseState(phase = 'kennenlernen') {
  return {
    settings: { phaseSelected: phase, phaseModelVersion: 2, phaseMode: 'manual-v2', amountSelected: 'taste', targetFoods: 100 },
    foods: [],
    logs: [{ id: 'log-1', date: '2026-08-10', meal: 'lunch', foodIds: ['x'], outcome: 'eaten', createdAt: '' }],
    inventory: [{ id: 'inv-1', foodId: 'x', portions: 1 }],
    manualMeals: { '2026-08-18|dinner': { focusId: 'x', foodIds: ['x'], manualAdded: true } },
    planLocks: { '2026-08-18|dinner': { mode: 'manual', focusId: 'x', foodIds: ['x'] } },
  };
}

test('TODO3 PHASE-01..04: Phasenmodell-v2 hat exakt die freigegebenen automatischen Mahlzeitenslots', () => {
  const state = baseState();
  const context = loadModel(state);
  const expected = {
    kennenlernen: ['lunch'],
    aufbau: ['breakfast', 'lunch'],
    drei: ['breakfast', 'lunch', 'dinner'],
    familie: ['breakfast', 'lunch', 'snack', 'dinner'],
  };
  for (const [phase, meals] of Object.entries(expected)) {
    state.settings.phaseSelected = phase;
    assert.deepEqual([...context.__phaseMealKeys()], meals, phase);
  }
});

test('TODO3 PHASE-03/04: Snack ist erst in Familienkost automatischer Phasenslot', () => {
  const state = baseState('drei');
  const context = loadModel(state);
  assert.equal(context.__phaseMealKeys().includes('snack'), false);
  state.settings.phaseSelected = 'familie';
  assert.equal(context.__phaseMealKeys().includes('snack'), true);
});

test('TODO3 PHASE-03-MANUAL-SNACK: manueller Snack bleibt in Phase 3 erlaubt und wird durch Phasenwechsel nicht gelöscht', () => {
  const state = baseState('drei');
  const key = '2026-08-18|snack';
  state.manualMeals[key] = { focusId: 'x', foodIds: ['x'], manualAdded: true };
  state.planLocks[key] = { mode: 'manual', focusId: 'x', foodIds: ['x'] };
  const before = JSON.parse(JSON.stringify({ meal: state.manualMeals[key], lock: state.planLocks[key] }));
  const context = loadModel(state);

  assert.equal(context.__phaseMealKeys().includes('snack'), false, 'Phase 3 darf keinen automatischen Snackslot erzeugen');
  assert.deepEqual(JSON.parse(JSON.stringify({ meal: state.manualMeals[key], lock: state.planLocks[key] })), before);

  assert.equal(context.__setPhase('familie'), true);
  assert.deepEqual(JSON.parse(JSON.stringify({ meal: state.manualMeals[key], lock: state.planLocks[key] })), before);
  assert.equal(context.__setPhase('drei'), true);
  assert.deepEqual(JSON.parse(JSON.stringify({ meal: state.manualMeals[key], lock: state.planLocks[key] })), before);
});

test('TODO3 PHASE-05: bestätigter Phasenwechsel ändert nur die Phaseneinstellung, nicht Logs, Vorrat, manuelle Mahlzeiten oder Locks', () => {
  const state = baseState('aufbau');
  const before = JSON.parse(JSON.stringify({ logs: state.logs, inventory: state.inventory, manualMeals: state.manualMeals, planLocks: state.planLocks }));
  const context = loadModel(state);

  assert.equal(context.__setPhase('drei'), true);
  assert.equal(state.settings.phaseSelected, 'drei');
  assert.equal(state.settings.phaseModelVersion, 2);
  assert.equal(state.settings.phaseMode, 'manual-v2');
  assert.deepEqual(JSON.parse(JSON.stringify({ logs: state.logs, inventory: state.inventory, manualMeals: state.manualMeals, planLocks: state.planLocks })), before);
  assert.equal(context.saved, true);
  assert.equal(context.rendered, true);
});
