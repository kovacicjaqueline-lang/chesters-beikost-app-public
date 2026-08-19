const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FOOD_PHASE_ORDER,
  automaticFoodEligibility,
  automaticEligibilityStatus,
  applyFoodPolicyData,
  familySuccessfulExposureCount,
  familyPlanningRank,
  pruneIneligibleAutomaticPlanState,
} = require('../app.js');

function baseFoods() {
  return [
    { id: 'mais-polenta', name: 'Mais', alias: 'Mais/Polenta', category: 'Getreide/Stärke', priority: 1, active: true, allergenGroup: '', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'polenta', name: 'Polenta', category: 'Getreide/Stärke', priority: 2, active: true, allergenGroup: '', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'sesam', name: 'Sesam', category: 'Samen', priority: 3, active: true, allergenGroup: 'Sesam', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'tahin', name: 'Tahin', category: 'Samen', priority: 4, active: true, allergenGroup: 'Sesam', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'hafer', name: 'Hafer', category: 'Getreide/Stärke', priority: 5, active: true, allergenGroup: '', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'haferdrink', name: 'Haferdrink', category: 'Getreide/Stärke', priority: 6, active: true, allergenGroup: '', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'kuhmilch', name: 'Kuhmilch', category: 'Milchprodukt', priority: 7, active: true, allergenGroup: 'Milch', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'naturjoghurt', name: 'Naturjoghurt', category: 'Milchprodukt', priority: 8, active: true, allergenGroup: 'Milch', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'kefir', name: 'Kefir', category: 'Milchprodukt', priority: 9, active: true, allergenGroup: 'Milch', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'lachs', name: 'Lachs', category: 'Fisch', priority: 10, active: true, allergenGroup: 'Fisch', meals: ['lunch','dinner'], count100: true, manualStatus: 'auto' },
    { id: 'banane', name: 'Banane', category: 'Obst', priority: 11, active: true, allergenGroup: '', meals: ['breakfast','lunch','dinner'], count100: true, manualStatus: 'auto' },
  ];
}

function settings(phase='kennenlernen', birthDate='2026-01-24') {
  return { phaseSelected: phase, birthDate };
}

function outcome(log, id) { return log.foodOutcomes?.[id] || log.outcome || ''; }

test('Phasenreihenfolge bleibt Phasenmodell-v2', () => {
  assert.deepEqual([...FOOD_PHASE_ORDER], ['kennenlernen','aufbau','drei','familie']);
});

test('Lebensmittel ohne neue Felder behalten bisherige Auto-Eignung', () => {
  assert.equal(automaticFoodEligibility({ id:'banane' }, '2026-08-17', settings()), true);
});

test('autoPlan:false verhindert ausschließlich Auto-Eignung und deaktiviert den Datensatz nicht', () => {
  const f = { id:'x', active:true, autoPlan:false };
  assert.equal(automaticFoodEligibility(f, '2026-08-17', settings('familie')), false);
  assert.equal(f.active, true);
});

test('minPhase wird in bestehender Phasenreihenfolge ausgewertet', () => {
  const f = { minPhase:'drei' };
  assert.equal(automaticFoodEligibility(f, '2026-08-17', settings('aufbau')), false);
  assert.equal(automaticFoodEligibility(f, '2026-08-17', settings('drei')), true);
  assert.equal(automaticFoodEligibility(f, '2026-08-17', settings('familie')), true);
});

test('minAgeMonths verwendet volle Kalendermonate', () => {
  const f = { minAgeMonths:12 };
  assert.equal(automaticFoodEligibility(f, '2027-01-23', settings('familie')), false);
  assert.equal(automaticFoodEligibility(f, '2027-01-24', settings('familie')), true);
});

test('mehrere Einschränkungen müssen gemeinsam erfüllt sein', () => {
  const f = { minPhase:'familie', minAgeMonths:12 };
  assert.equal(automaticFoodEligibility(f, '2027-01-23', settings('familie')), false);
  assert.equal(automaticFoodEligibility(f, '2027-01-24', settings('drei')), false);
  assert.equal(automaticFoodEligibility(f, '2027-01-24', settings('familie')), true);
});

test('FOOD-Policy legt Honig mit beiden freigegebenen Grenzen an', () => {
  const foods = baseFoods(); applyFoodPolicyData(foods, {});
  const honig = foods.find(f => f.id === 'honig');
  assert.equal(honig.minAgeMonths, 12);
  assert.equal(honig.minPhase, 'familie');
  assert.equal(automaticFoodEligibility(honig, '2027-01-23', settings('familie')), false);
  assert.equal(automaticFoodEligibility(honig, '2027-01-24', settings('drei')), false);
  assert.equal(automaticFoodEligibility(honig, '2027-01-24', settings('familie')), true);
});

test('Honig zeigt den kompakten freigegebenen UI-Status', () => {
  assert.equal(automaticEligibilityStatus({ minAgeMonths:12, minPhase:'familie' }, { familie:'Familienkost' }), 'Ab 12 Monaten · Familienkost');
});

test('Thunfisch ist im FOOD-Stamm, bleibt aktiv/manuell erfassbar und nie auto-planbar', () => {
  const foods = baseFoods(); applyFoodPolicyData(foods, {});
  const f = foods.find(x => x.id === 'thunfisch');
  assert.ok(f);
  assert.equal(f.active, true);
  assert.equal(f.autoPlan, false);
  assert.equal(automaticFoodEligibility(f, '2028-01-24', settings('familie')), false);
  assert.equal(automaticEligibilityStatus(f, {}), 'Nicht für Beikost empfohlen');
});

test('normal geeignete Fischarten bleiben automatisch planbar für Mittag und Abend', () => {
  const foods = baseFoods(); applyFoodPolicyData(foods, {});
  for (const id of ['lachs','forelle','saibling','hering','karpfen','atlantische-makrele']) {
    const f = foods.find(x => x.id === id);
    assert.ok(f, id);
    assert.deepEqual(f.meals, ['lunch','dinner']);
    assert.equal(automaticFoodEligibility(f, '2026-08-17', settings()), true);
  }
});

test('alle freigegebenen nicht-auto-planbaren Fischarten sind datengetrieben gesperrt', () => {
  const foods = baseFoods(); applyFoodPolicyData(foods, {});
  for (const id of ['thunfisch','schwertfisch','heilbutt','hecht','koenigsmakrele','buttermakrele','schlangenmakrele']) {
    assert.equal(foods.find(x => x.id === id)?.autoPlan, false, id);
  }
});

test('Mais/Polenta-Misch-ID wird migrationsfähig auf Mais bereinigt und Stamm geteilt', () => {
  const foods = baseFoods(); const aliases = {}; applyFoodPolicyData(foods, aliases);
  assert.equal(foods.some(f => f.id === 'mais-polenta'), false);
  assert.equal(aliases['mais-polenta'], 'mais');
  assert.equal(foods.find(f => f.id === 'mais').foodFamily, 'mais');
  assert.equal(foods.find(f => f.id === 'polenta').foodFamily, 'mais');
});

test('Mais-Einführung gilt im Planner für Polenta, konkrete Lebensmittel bleiben getrennt', () => {
  const foods = baseFoods(); applyFoodPolicyData(foods, {});
  const logs = [{ date:'2026-08-10', meal:'lunch', foodIds:['mais'], foodOutcomes:{mais:'eaten'} }];
  const polenta = foods.find(f => f.id === 'polenta');
  assert.equal(familySuccessfulExposureCount(polenta, foods, logs, outcome), 1);
  assert.equal(familyPlanningRank(polenta, foods, logs, outcome, 0), 1);
  assert.equal(logs[0].foodIds.includes('polenta'), false);
});

test('Sesam und Tahin teilen Lebensmittel- und Allergenstamm', () => {
  const foods = baseFoods(); applyFoodPolicyData(foods, {});
  const sesam = foods.find(f => f.id === 'sesam');
  const tahin = foods.find(f => f.id === 'tahin');
  assert.equal(sesam.foodFamily, 'sesam');
  assert.equal(tahin.foodFamily, 'sesam');
  assert.equal(sesam.allergenFamily, 'sesam');
  assert.equal(tahin.allergenFamily, 'sesam');
  assert.equal(sesam.allergenGroup, 'Sesam');
  assert.equal(tahin.allergenGroup, 'Sesam');
});

test('erfolgreiche Sesam-Einführung verhindert strikte Tahin-Neueinführung im Familienstatus', () => {
  const foods = baseFoods(); applyFoodPolicyData(foods, {});
  const logs = [{ date:'2026-08-10', meal:'lunch', foodIds:['sesam'], foodOutcomes:{sesam:'eaten'} }];
  const tahin = foods.find(f => f.id === 'tahin');
  assert.equal(familySuccessfulExposureCount(tahin, foods, logs, outcome), 1);
  assert.equal(familyPlanningRank(tahin, foods, logs, outcome, 0), 1);
});

test('Milchprodukte teilen den freigegebenen Allergenstamm, konkrete Produkte bleiben separat', () => {
  const foods = baseFoods(); applyFoodPolicyData(foods, {});
  const milk = foods.find(f => f.id === 'kuhmilch');
  const yogurt = foods.find(f => f.id === 'naturjoghurt');
  const kefir = foods.find(f => f.id === 'kefir');
  const cottage = foods.find(f => f.id === 'huettenkaese');
  assert.equal(milk.allergenFamily, 'milch');
  assert.equal(yogurt.allergenFamily, 'milch');
  assert.equal(kefir.allergenFamily, 'milch');
  assert.equal(cottage.allergenFamily, 'milch');
  const logs = [{ date:'2026-08-10', meal:'breakfast', foodIds:['kuhmilch'], foodOutcomes:{kuhmilch:'eaten'} }];
  assert.equal(familyPlanningRank(yogurt, foods, logs, outcome, 0), 1);
  assert.equal(logs[0].foodIds.includes('naturjoghurt'), false);
});

test('Hafer und Haferdrink haben korrekte Gluten-Allergenzuordnung und gemeinsamen Haferstamm', () => {
  const foods = baseFoods(); applyFoodPolicyData(foods, {});
  for (const id of ['hafer','haferdrink']) {
    const f = foods.find(x => x.id === id);
    assert.equal(f.allergenGroup, 'Glutenhaltiges Getreide');
    assert.equal(f.foodFamily, 'hafer');
    assert.equal(f.allergenFamily, 'hafer');
  }
});

test('bestehende automatische Locks mit neuer Eligibility werden migrationssicher entfernt, manuelle bleiben', () => {
  const foods = baseFoods(); applyFoodPolicyData(foods, {});
  const tuna = foods.find(f => f.id === 'thunfisch');
  const s = {
    settings: settings('familie'), foods,
    overrides: {'2026-08-20|lunch':'thunfisch','2026-08-21|lunch':'thunfisch'},
    planLocks: {
      '2026-08-20|lunch': { mode:'auto', foodIds:[tuna.id] },
      '2026-08-21|lunch': { mode:'manual', foodIds:[tuna.id] },
    },
    followUps: {},
  };
  assert.equal(pruneIneligibleAutomaticPlanState(s), true);
  assert.equal(s.planLocks['2026-08-20|lunch'], undefined);
  assert.ok(s.planLocks['2026-08-21|lunch']);
  assert.equal(s.overrides['2026-08-20|lunch'], undefined);
});
