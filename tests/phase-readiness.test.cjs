const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'phase-readiness.js'), 'utf8');

function loadCore(extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__recommend = phaseReadinessRecommendation; this.__current = currentPhaseReadiness;`, context);
  return context;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const READY = {
  currentPatternAccepted: true,
  additionalMealCue: true,
  routineCompatible: true,
};

test('PHASE-TRANSITION: nächste Phase und neuer Slot folgen exakt dem Phasenmodell', () => {
  const { __recommend } = loadCore();
  const expected = {
    kennenlernen: ['aufbau', 'breakfast'],
    aufbau: ['drei', 'dinner'],
    drei: ['familie', 'snack'],
    familie: [null, null],
  };

  for (const [phase, [nextPhase, nextMeal]] of Object.entries(expected)) {
    const result = __recommend({ phase, ...READY });
    assert.equal(result.nextPhase, nextPhase, phase);
    assert.equal(result.nextMeal, nextMeal, phase);
  }
});

test('PHASE-TRANSITION: Empfehlung braucht alle drei qualitativen Voraussetzungen', () => {
  const { __recommend } = loadCore();

  for (const phase of ['kennenlernen', 'aufbau', 'drei']) {
    const result = plain(__recommend({ phase, ...READY }));
    assert.equal(result.recommendation, 'recommended', phase);
    assert.equal(result.recommendable, true, phase);
    assert.deepEqual(result.missingPrerequisites, [], phase);
  }
});

test('PHASE-TRANSITION: jede ausdrücklich fehlende Voraussetzung blockiert die Empfehlung', () => {
  const { __recommend } = loadCore();

  for (const signal of Object.keys(READY)) {
    const input = { phase: 'aufbau', ...READY, [signal]: false };
    const result = plain(__recommend(input));
    assert.equal(result.recommendation, 'notYet', signal);
    assert.equal(result.recommendable, false, signal);
    assert.equal(result.signals[signal], 'no', signal);
  }
});

test('PHASE-TRANSITION: unbekannte Voraussetzungen bleiben explizit offen', () => {
  const { __recommend } = loadCore();
  const result = plain(__recommend({ phase: 'kennenlernen', currentPatternAccepted: true }));

  assert.equal(result.recommendation, 'notYet');
  assert.equal(result.recommendable, false);
  assert.deepEqual(result.missingPrerequisites, ['additionalMealCue', 'routineCompatible']);
  assert.equal(result.signals.currentPatternAccepted, 'yes');
  assert.equal(result.signals.additionalMealCue, 'unknown');
  assert.equal(result.signals.routineCompatible, 'unknown');
});

test('PHASE-TRANSITION: Alter, Grammwerte, Logs und Textur beeinflussen die Empfehlung nicht', () => {
  const { __recommend } = loadCore();
  const blockedYoung = plain(__recommend({
    phase: 'aufbau',
    ageMonths: 4,
    amountG: 999,
    logCount: 1000,
    textureStage: 99,
    currentPatternAccepted: true,
    additionalMealCue: false,
    routineCompatible: true,
  }));
  const blockedOld = plain(__recommend({
    phase: 'aufbau',
    ageMonths: 24,
    amountG: 1,
    logCount: 0,
    textureStage: 0,
    currentPatternAccepted: true,
    additionalMealCue: false,
    routineCompatible: true,
  }));

  assert.deepEqual(blockedYoung, blockedOld);
  assert.equal(blockedYoung.recommendation, 'notYet');

  const readyYoung = plain(__recommend({ phase: 'aufbau', ageMonths: 4, ...READY }));
  const readyOld = plain(__recommend({ phase: 'aufbau', ageMonths: 24, ...READY }));
  assert.deepEqual(readyYoung, readyOld);
  assert.equal(readyYoung.recommendation, 'recommended');
});

test('PHASE-TRANSITION: Drei Hauptmahlzeiten -> Familienkost braucht tatsächlichen Zusatzbedarf und Tagespassung', () => {
  const { __recommend } = loadCore();

  assert.equal(__recommend({ phase: 'drei', ...READY }).recommendation, 'recommended');
  assert.equal(__recommend({ phase: 'drei', ...READY, additionalMealCue: false }).recommendation, 'notYet');
  assert.equal(__recommend({ phase: 'drei', ...READY, routineCompatible: false }).recommendation, 'notYet');
});

test('PHASE-TRANSITION: Familienkost ist terminal und erzeugt keine weitere Empfehlung', () => {
  const { __recommend } = loadCore();
  const result = plain(__recommend({ phase: 'familie', ...READY }));

  assert.equal(result.nextPhase, null);
  assert.equal(result.nextMeal, null);
  assert.equal(result.recommendable, false);
  assert.equal(result.recommendation, 'notYet');
  assert.deepEqual(result.reasons, ['finalPhaseReached']);
});

test('PHASE-TRANSITION: Readiness ist read-only und verändert keinen bestehenden App-Zustand', () => {
  const state = {
    settings: { phaseSelected: 'aufbau', birthDate: '2026-01-24', textureStage: 99, amountSelected: 'full' },
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
    save: () => { saveCalls += 1; },
    renderAll: () => { renderCalls += 1; },
  });

  const result = context.__current(READY);
  assert.equal(result.recommendation, 'recommended');
  assert.equal(state.settings.phaseSelected, 'aufbau');
  assert.deepEqual(state, before);
  assert.equal(saveCalls, 0);
  assert.equal(renderCalls, 0);
});

test('PHASE-TRANSITION: ungültige qualitative Signale werden als unbekannt behandelt', () => {
  const { __recommend } = loadCore();
  const result = plain(__recommend({
    phase: 'drei',
    currentPatternAccepted: 'established',
    additionalMealCue: 1,
    routineCompatible: 'sometimes',
  }));

  assert.deepEqual(result.signals, {
    currentPatternAccepted: 'unknown',
    additionalMealCue: 'unknown',
    routineCompatible: 'unknown',
  });
  assert.deepEqual(result.missingPrerequisites, [
    'currentPatternAccepted',
    'additionalMealCue',
    'routineCompatible',
  ]);
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