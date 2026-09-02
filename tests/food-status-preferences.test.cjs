const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'statistics.js'), 'utf8');

function loadPolicy() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__policy = { normalizeFoodStatusPreferenceStatus, foodStatusPreferenceMigrationStrength, foodStatusPreferenceCounts, deriveFoodStatusPreferenceStatus, foodStatusPreferenceLiked, foodStatusPreferenceCanCombine, foodStatusPreferenceShouldRetry, foodStatusPreferenceLikedTie };`, context);
  return context.__policy;
}

function log(id, date, meal, outcome, foodId = 'karotte') {
  return { id, date, meal, foodIds: [foodId], foodOutcomes: { [foodId]: outcome }, createdAt: id };
}

test('FOOD-STATUS: Offen → Probiert → Bekannt basiert nur auf getrennten positiven Expositionen', () => {
  const policy = loadPolicy();
  const food = { id: 'karotte', manualStatus: 'auto' };

  assert.equal(policy.deriveFoodStatusPreferenceStatus(food, []), 'Offen');
  assert.equal(policy.deriveFoodStatusPreferenceStatus(food, [log('t1', '2026-07-14', 'lunch', 'tried')]), 'Probiert');
  assert.equal(policy.deriveFoodStatusPreferenceStatus(food, [
    log('t1', '2026-07-14', 'lunch', 'tried'),
    log('t2', '2026-07-16', 'lunch', 'tried'),
    log('t3', '2026-07-20', 'dinner', 'tried'),
  ]), 'Probiert', 'mehrfach Probiert darf nicht automatisch Bekannt ergeben');
  assert.equal(policy.deriveFoodStatusPreferenceStatus(food, [log('e1', '2026-07-14', 'lunch', 'eaten')]), 'Probiert');
  assert.equal(policy.deriveFoodStatusPreferenceStatus(food, [
    log('e1', '2026-07-14', 'lunch', 'eaten'),
    log('e2', '2026-07-15', 'lunch', 'eaten'),
  ]), 'Bekannt');
  assert.equal(policy.deriveFoodStatusPreferenceStatus(food, [
    log('e1', '2026-07-14', 'lunch', 'eaten'),
    log('e2', '2026-07-15', 'lunch', 'eaten'),
    log('e3', '2026-07-16', 'dinner', 'eaten'),
  ]), 'Bekannt', '3+ gegessen erzeugt keinen weiteren Status');
});

test('FOOD-STATUS: doppelte Einträge derselben Mahlzeitenexposition zählen nicht als zwei Gegessen-Expositionen', () => {
  const policy = loadPolicy();
  const food = { id: 'karotte' };
  const logs = [
    log('e1', '2026-07-14', 'lunch', 'eaten'),
    log('e2', '2026-07-14', 'lunch', 'eaten'),
  ];
  assert.equal(policy.foodStatusPreferenceCounts('karotte', logs).eaten, 1);
  assert.equal(policy.deriveFoodStatusPreferenceStatus(food, logs), 'Probiert');
});

test('FOOD-STATUS: kein Recency-Kriterium; weit auseinanderliegende Gegessen-Expositionen ergeben Bekannt', () => {
  const policy = loadPolicy();
  const food = { id: 'karotte' };
  assert.equal(policy.deriveFoodStatusPreferenceStatus(food, [
    log('e1', '2026-07-14', 'lunch', 'eaten'),
    log('e2', '2026-09-01', 'dinner', 'eaten'),
  ]), 'Bekannt');
});

test('FOOD-STATUS: Reaktion führt zum Sonderstatus Pausiert', () => {
  const policy = loadPolicy();
  const food = { id: 'ei' };
  const reaction = { id: 'r1', date: '2026-08-01', meal: 'lunch', foodIds: ['ei'], foodOutcomes: { ei: 'reaction' }, reactionFoodId: 'ei' };
  assert.equal(policy.deriveFoodStatusPreferenceStatus(food, [reaction]), 'Pausiert');
});

test('FOOD-STATUS-MIGRATION: alte Basis-/Regelmäßig-Werte werden kompatibel auf Bekannt normalisiert', () => {
  const policy = loadPolicy();
  for (const legacy of ['Vertragen', 'Verträgliche Basis', 'Regelmäßig', 'Bekannt']) {
    assert.equal(policy.normalizeFoodStatusPreferenceStatus(legacy), 'Bekannt', legacy);
  }
  assert.equal(policy.normalizeFoodStatusPreferenceStatus('Probiert'), 'Probiert');
  assert.equal(policy.normalizeFoodStatusPreferenceStatus('Pausiert'), 'Pausiert');
  assert.ok(
    policy.foodStatusPreferenceMigrationStrength('Pausiert') > policy.foodStatusPreferenceMigrationStrength('Bekannt'),
    'manuelle Pause muss beim Zusammenführen alter Daten Vorrang behalten',
  );
});

test('FOOD-PREFERENCE: unmarkiert ist neutral; nur liked=true ist positiv markiert', () => {
  const policy = loadPolicy();
  assert.equal(policy.foodStatusPreferenceLiked({}), false);
  assert.equal(policy.foodStatusPreferenceLiked({ liked: false }), false);
  assert.equal(policy.foodStatusPreferenceLiked({ liked: true }), true);
});

test('PLANNER: ab 1× Gegessen kombinierbar, aber erst Bekannt ist eine Hauptbasis', () => {
  const policy = loadPolicy();
  const food = { id: 'karotte', manualStatus: 'auto' };
  assert.equal(policy.foodStatusPreferenceCanCombine(food, [log('e1', '2026-07-14', 'lunch', 'eaten')]), true);
  assert.equal(policy.deriveFoodStatusPreferenceStatus(food, [log('e1', '2026-07-14', 'lunch', 'eaten')]), 'Probiert');
  assert.equal(policy.deriveFoodStatusPreferenceStatus(food, [
    log('e1', '2026-07-14', 'lunch', 'eaten'),
    log('e2', '2026-07-15', 'dinner', 'eaten'),
  ]), 'Bekannt');
});

test('PLANNER: Pausiert bleibt auch nach früherem Gegessen aus der Kombination ausgeschlossen', () => {
  const policy = loadPolicy();
  const paused = { id: 'ei', manualStatus: 'Pausiert' };
  assert.equal(policy.foodStatusPreferenceCanCombine(paused, [log('e1', '2026-07-14', 'lunch', 'eaten', 'ei')]), false);
});

test('PLANNER: bloß Probiert erzwingt bei Nicht-Allergenen keine Wiederholung; Ablehnung und bestehender Allergenpfad bleiben getrennt', () => {
  const policy = loadPolicy();
  assert.equal(policy.foodStatusPreferenceShouldRetry({ id: 'zucchini', allergenGroup: '' }, 1, 'tried'), false);
  assert.equal(policy.foodStatusPreferenceShouldRetry({ id: 'zucchini', allergenGroup: '' }, 1, 'not_accepted'), true);
  assert.equal(policy.foodStatusPreferenceShouldRetry({ id: 'ei', allergenGroup: 'Ei' }, 1, 'tried'), true);
});

test('PLANNER-PREFERENCE: gern gegessen ist nur ein Tie-Breaker', () => {
  const policy = loadPolicy();
  const liked = { id: 'banane', liked: true };
  const neutral = { id: 'birne' };
  assert.ok(policy.foodStatusPreferenceLikedTie(liked, neutral) < 0);
  assert.ok(policy.foodStatusPreferenceLikedTie(neutral, liked) > 0);
  assert.equal(policy.foodStatusPreferenceLikedTie(liked, { id: 'apfel', liked: true }), 0);
});
