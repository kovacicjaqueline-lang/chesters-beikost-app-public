const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'phase-readiness.js'), 'utf8');

function loadCore(extra = {}) {
  const context = {
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__recommend = phaseReadinessRecommendation; this.__current = currentPhaseReadiness;`, context);
  return context;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('PHASE-TRANSITION: nächste Phase und neuer Slot folgen exakt dem Phasenmodell', () => {
  const { __recommend } = loadCore();
  const expected = {
    kennenlernen: ['aufbau', 'breakfast'],
    aufbau: ['drei', 'dinner'],
    drei: ['familie', 'snack'],
    familie: [null, null],
  };
  for (const [phase, [nextPhase, nextMeal]] of Object.entries(expected)) {
    const result = __recommend({ phase, ageMonths: 8 });
    assert.equal(result.nextPhase, nextPhase, phase);
    assert.equal(result.nextMeal, nextMeal, phase);
  }
});

test('PHASE-TRANSITION: Kennenlernen nutzt Alter nur als Orientierung, nie allein als Empfehlung', () => {
  const { __recommend } = loadCore();

  assert.equal(__recommend({ phase: 'kennenlernen', ageMonths: 5, currentPattern: 'unknown' }).recommendation, 'notYet');
  assert.equal(__recommend({ phase: 'kennenlernen', ageMonths: 7, currentPattern: 'unknown' }).recommendation, 'consider');
  assert.equal(__recommend({ phase: 'kennenlernen', ageMonths: 9, currentPattern: 'unknown' }).recommendation, 'consider');
  assert.equal(__recommend({ phase: 'kennenlernen', ageMonths: 5, currentPattern: 'established' }).recommendation, 'consider');
  assert.equal(__recommend({ phase: 'kennenlernen', ageMonths: 7, currentPattern: 'established' }).recommendation, 'recommended');
  assert.equal(__recommend({ phase: 'kennenlernen', ageMonths: 9, currentPattern: 'established' }).recommendation, 'recommended');
  assert.equal(__recommend({ phase: 'kennenlernen', ageMonths: 12, currentPattern: 'notEstablished' }).recommendation, 'notYet');
});

test('PHASE-TRANSITION: fehlendes Alter bleibt unbekannt statt als 0 Monate zu gelten', () => {
  const { __recommend } = loadCore();
  const result = plain(__recommend({
    phase: 'kennenlernen',
    ageMonths: null,
    currentPattern: 'unknown',
  }));

  assert.equal(result.ageGuidance.status, 'unknown');
  assert.equal(result.ageGuidance.ageMonths, null);
  assert.equal(result.recommendation, 'notYet');
});

test('PHASE-TRANSITION: Mahlzeitenaufbau empfiehlt drei Hauptmahlzeiten im freigegebenen Altersfenster', () => {
  const { __recommend } = loadCore();

  assert.equal(__recommend({ phase: 'aufbau', ageMonths: 6, currentPattern: 'established' }).recommendation, 'consider');
  assert.equal(__recommend({ phase: 'aufbau', ageMonths: 7, currentPattern: 'established' }).recommendation, 'recommended');
  assert.equal(__recommend({ phase: 'aufbau', ageMonths: 9, currentPattern: 'established' }).recommendation, 'recommended');

  const behindTarget = plain(__recommend({ phase: 'aufbau', ageMonths: 10, currentPattern: 'notEstablished' }));
  assert.equal(behindTarget.recommendation, 'notYet');
  assert.equal(behindTarget.ageGuidance.status, 'targetPassed');
  assert.ok(behindTarget.reasons.includes('currentPatternNotEstablished'));
  assert.ok(behindTarget.reasons.includes('mealFrequencyBelowAgeGuidance'));
});

test('PHASE-TRANSITION: unbekannt bleibt von nicht etabliert unterscheidbar', () => {
  const { __recommend } = loadCore();
  const unknown = plain(__recommend({ phase: 'aufbau', ageMonths: 8 }));
  const notEstablished = plain(__recommend({ phase: 'aufbau', ageMonths: 8, currentPattern: 'notEstablished' }));

  assert.equal(unknown.development.currentPattern, 'unknown');
  assert.deepEqual(unknown.missingPrerequisites, ['currentPattern']);
  assert.equal(unknown.recommendation, 'consider');
  assert.equal(notEstablished.development.currentPattern, 'notEstablished');
  assert.deepEqual(notEstablished.missingPrerequisites, []);
  assert.equal(notEstablished.recommendation, 'notYet');
});

test('PHASE-TRANSITION: Drei Hauptmahlzeiten -> Familienkost hängt vom Snackbedarf ab, nicht vom Alter', () => {
  const { __recommend } = loadCore();

  const cases = [
    [8, 'yes', 'recommended'],
    [14, 'yes', 'recommended'],
    [8, 'no', 'notYet'],
    [14, 'no', 'notYet'],
    [8, 'unknown', 'consider'],
    [14, 'unknown', 'consider'],
  ];
  for (const [ageMonths, snackNeed, expected] of cases) {
    const result = __recommend({ phase: 'drei', ageMonths, currentPattern: 'established', snackNeed });
    assert.equal(result.recommendation, expected, `${ageMonths} Monate / ${snackNeed}`);
    assert.equal(result.ageGuidance.status, 'none');
    assert.equal(result.ageGuidance.targetMeals, null);
  }

  const notEstablished = plain(__recommend({
    phase: 'drei',
    ageMonths: 14,
    currentPattern: 'notEstablished',
    snackNeed: 'unknown',
  }));
  assert.equal(notEstablished.recommendation, 'notYet');
  assert.deepEqual(notEstablished.missingPrerequisites, []);
  assert.ok(!notEstablished.reasons.includes('snackNeedUnknown'));
});

test('PHASE-TRANSITION: Familienkost ist terminal und erzeugt keine weitere Empfehlung', () => {
  const { __recommend } = loadCore();
  const result = plain(__recommend({ phase: 'familie', ageMonths: 18, currentPattern: 'established', snackNeed: 'yes' }));

  assert.equal(result.nextPhase, null);
  assert.equal(result.recommendable, false);
  assert.equal(result.recommendation, 'notYet');
  assert.deepEqual(result.reasons, ['finalPhaseReached']);
});

test('PHASE-TRANSITION: Readiness ist read-only und ignoriert technische Planner-/Mengen-/Texturwerte', () => {
  const state = {
    settings: { phaseSelected: 'aufbau', birthDate: '2026-01-24', textureStage: 99, amountSelected: 'established' },
    logs: [{ amountG: 999, outcome: 'eaten' }],
    inventory: [{ foodId: 'x', portions: 99 }],
    manualMeals: { '2026-08-25|dinner': { focusId: 'x' } },
    planLocks: { '2026-08-25|dinner': { mode: 'manual' } },
  };
  const before = JSON.parse(JSON.stringify(state));
  let saveCalls = 0;
  let renderCalls = 0;
  const context = loadCore({
    state,
    currentPhase: () => state.settings.phaseSelected,
    today: () => '2026-08-25',
    monthsOld: () => 7,
    save: () => { saveCalls += 1; },
    renderAll: () => { renderCalls += 1; },
  });

  const result = context.__current({ currentPattern: 'established' });
  assert.equal(result.recommendation, 'recommended');
  assert.equal(state.settings.phaseSelected, 'aufbau');
  assert.deepEqual(state, before);
  assert.equal(saveCalls, 0);
  assert.equal(renderCalls, 0);
});

test('PHASE-TRANSITION: ungültige qualitative Signale werden als unbekannt behandelt', () => {
  const { __recommend } = loadCore();
  const result = plain(__recommend({ phase: 'drei', ageMonths: 20, currentPattern: 'yes', snackNeed: true }));

  assert.equal(result.development.currentPattern, 'unknown');
  assert.equal(result.development.snackNeed, 'unknown');
  assert.deepEqual(result.missingPrerequisites, ['currentPattern']);
  assert.ok(!result.reasons.includes('snackNeedUnknown'));
  assert.equal(result.recommendation, 'notYet');
});

test('PHASE-TRANSITION: Runtime lädt Readiness nach Model und vor Planning', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const modelPos = html.indexOf('js/model.js?v=10.1.26');
  const readinessPos = html.indexOf('js/phase-readiness.js?v=10.1.26');
  const planningPos = html.indexOf('js/planning.js?v=10.1.26');

  assert.ok(modelPos >= 0, 'model.js fehlt');
  assert.ok(readinessPos > modelPos, 'Readiness muss nach model.js geladen werden');
  assert.ok(planningPos > readinessPos, 'Readiness muss vor planning.js verfügbar sein');
});

test('PHASE-TRANSITION: Readiness-Core ist für den ersten Offline-Start vorgecached', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /\.\/js\/phase-readiness\.js\?v=10\.1\.26/);
  assert.match(sw, /\.\.\.PHASE_READINESS_PRECACHE/);
});
