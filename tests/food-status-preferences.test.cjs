const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const stateSource = fs.readFileSync(path.join(root, 'js', 'state.js'), 'utf8');
const modelSource = fs.readFileSync(path.join(root, 'js', 'model.js'), 'utf8');
const migrationsSource = fs.readFileSync(path.join(root, 'js', 'migrations.js'), 'utf8');
const policySource = fs.readFileSync(path.join(root, 'js', 'food-status-preferences.js'), 'utf8');
const statisticsSource = fs.readFileSync(path.join(root, 'js', 'statistics.js'), 'utf8');
const foodsSource = fs.readFileSync(path.join(root, 'js', 'foods.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function log(id, date, meal, outcome, foodId = 'karotte') {
  return { id, date, meal, foodIds: [foodId], foodOutcomes: { [foodId]: outcome }, createdAt: id };
}

function loadModel(logs = [], foodRecord = { id: 'karotte', manualStatus: 'auto', priority: 1 }) {
  const context = {
    FOOD_DB: [],
    RECIPES: [],
    __state: { settings: { amountSelected: 'taste', phaseSelected: 'kennenlernen', targetFoods: 100 }, foods: [foodRecord], logs, inventory: [] },
    save: () => {},
    renderAll: () => {},
    normalizeName: (value) => String(value || '').toLowerCase(),
    foodByName: () => null,
    foodAliasTerms: () => [],
    canonicalId: (id) => id,
  };
  vm.createContext(context);
  vm.runInContext(`${stateSource}\nstate = this.__state;`, context);
  vm.runInContext(`${modelSource}\nthis.__model = { autoStatus, status, rank, statusSource, modelExposureKey };`, context);
  return context.__model;
}

function loadMigration() {
  const context = {
    FOOD_DB: [],
    RECIPES: [],
    clone: (value) => JSON.parse(JSON.stringify(value)),
    today: () => '2026-09-02',
    diffDays: () => 0,
    suggestedAmountLevelFromLogs: () => 'taste',
    __state: { settings: {}, foods: [], logs: [], inventory: [] },
  };
  vm.createContext(context);
  vm.runInContext(`${stateSource}\nstate = this.__state;`, context);
  vm.runInContext(`${migrationsSource}\nthis.__migration = { normalizeStatus, statusStrength, mergeFoodRecord };`, context);
  return context.__migration;
}

function loadPlannerPolicy() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${policySource}\nthis.__policy = { foodStatusPreferenceLiked, foodStatusPreferenceMergeLiked, foodStatusPreferenceCanCombine, foodStatusPreferenceShouldRetry, foodStatusPreferenceLikedTie };`, context);
  return context.__policy;
}

test('FOOD-STATUS: Offen → Probiert → Bekannt basiert auf getrennten Expositionen', () => {
  assert.equal(loadModel([]).autoStatus({ id: 'karotte' }), 'Offen');
  assert.equal(loadModel([log('t1', '2026-07-14', 'lunch', 'tried')]).autoStatus({ id: 'karotte' }), 'Probiert');
  assert.equal(loadModel([
    log('t1', '2026-07-14', 'lunch', 'tried'),
    log('t2', '2026-07-16', 'lunch', 'tried'),
    log('t3', '2026-07-20', 'dinner', 'tried'),
  ]).autoStatus({ id: 'karotte' }), 'Probiert', 'mehrfach Probiert darf nicht automatisch Bekannt ergeben');
  assert.equal(loadModel([log('e1', '2026-07-14', 'lunch', 'eaten')]).autoStatus({ id: 'karotte' }), 'Probiert');
  assert.equal(loadModel([
    log('e1', '2026-07-14', 'lunch', 'eaten'),
    log('e2', '2026-07-15', 'dinner', 'eaten'),
  ]).autoStatus({ id: 'karotte' }), 'Bekannt');
  assert.equal(loadModel([
    log('e1', '2026-07-14', 'lunch', 'eaten'),
    log('e2', '2026-07-15', 'dinner', 'eaten'),
    log('e3', '2026-07-16', 'lunch', 'eaten'),
  ]).autoStatus({ id: 'karotte' }), 'Bekannt', '3+ gegessen erzeugt keinen weiteren Status');
});

test('FOOD-STATUS: doppelte Einträge derselben Mahlzeitenexposition zählen nur einmal', () => {
  const model = loadModel([
    log('e1', '2026-07-14', 'lunch', 'eaten'),
    log('e2', '2026-07-14', 'lunch', 'eaten'),
  ]);
  assert.equal(model.autoStatus({ id: 'karotte' }), 'Probiert');
});

test('FOOD-STATUS: kein Recency-Kriterium; weit getrennte Gegessen-Expositionen ergeben Bekannt', () => {
  const model = loadModel([
    log('e1', '2026-07-14', 'lunch', 'eaten'),
    log('e2', '2026-09-01', 'dinner', 'eaten'),
  ]);
  assert.equal(model.autoStatus({ id: 'karotte' }), 'Bekannt');
  assert.equal(model.rank({ id: 'karotte', manualStatus: 'auto' }), 2);
});

test('FOOD-STATUS: Reaktion führt zum Sonderstatus Pausiert', () => {
  const reaction = { id: 'r1', date: '2026-08-01', meal: 'lunch', foodIds: ['ei'], foodOutcomes: { ei: 'reaction' }, reactionFoodId: 'ei', createdAt: 'r1' };
  assert.equal(loadModel([reaction]).autoStatus({ id: 'ei' }), 'Pausiert');
});

test('FOOD-STATUS-MIGRATION: alte aktive Statuswerte werden kompatibel auf Bekannt normalisiert', () => {
  const migration = loadMigration();
  for (const legacy of ['Vertragen', 'Verträgliche Basis', 'Regelmäßig', 'Bekannt']) {
    assert.equal(migration.normalizeStatus(legacy), 'Bekannt', legacy);
  }
  assert.equal(migration.normalizeStatus('Probiert'), 'Probiert');
  assert.equal(migration.normalizeStatus('Pausiert'), 'Pausiert');
  assert.ok(migration.statusStrength('Pausiert') > migration.statusStrength('Bekannt'));

  const target = { manualStatus: 'auto', liked: false };
  migration.mergeFoodRecord(target, { manualStatus: 'Regelmäßig', liked: true });
  assert.equal(target.manualStatus, 'Bekannt');
  assert.equal(target.liked, true);
});

test('FOOD-PREFERENCE: unmarkiert ist neutral; nur liked=true ist positiv markiert', () => {
  const policy = loadPlannerPolicy();
  assert.equal(policy.foodStatusPreferenceLiked({}), false);
  assert.equal(policy.foodStatusPreferenceLiked({ liked: false }), false);
  assert.equal(policy.foodStatusPreferenceLiked({ liked: true }), true);
});

test('FOOD-PREFERENCE-MIGRATION: positive Markierung bleibt bei neutralem Alias-Merge erhalten', () => {
  const policy = loadPlannerPolicy();
  assert.equal(policy.foodStatusPreferenceMergeLiked(true, false), true);
  assert.equal(policy.foodStatusPreferenceMergeLiked(true, undefined), true);
  assert.equal(policy.foodStatusPreferenceMergeLiked(false, true), true);
  assert.equal(policy.foodStatusPreferenceMergeLiked(false, false), false);
});

test('PLANNER: ab 1× Gegessen kombinierbar, Pausiert bleibt ausgeschlossen', () => {
  const policy = loadPlannerPolicy();
  const eaten = [log('e1', '2026-07-14', 'lunch', 'eaten')];
  assert.equal(policy.foodStatusPreferenceCanCombine({ id: 'karotte', manualStatus: 'auto' }, eaten), true);
  assert.equal(policy.foodStatusPreferenceCanCombine({ id: 'karotte', manualStatus: 'Pausiert' }, eaten), false);
});

test('PLANNER: bloß Probiert erzwingt bei Nicht-Allergenen keine Wiederholung; Allergenpfad bleibt getrennt', () => {
  const policy = loadPlannerPolicy();
  assert.equal(policy.foodStatusPreferenceShouldRetry({ id: 'zucchini', allergenGroup: '' }, 1, 'tried'), false);
  assert.equal(policy.foodStatusPreferenceShouldRetry({ id: 'zucchini', allergenGroup: '' }, 1, 'not_accepted'), true);
  assert.equal(policy.foodStatusPreferenceShouldRetry({ id: 'ei', allergenGroup: 'Ei' }, 1, 'tried'), true);
});

test('PLANNER-PREFERENCE: gern gegessen ist nur ein Tie-Breaker', () => {
  const policy = loadPlannerPolicy();
  const liked = { id: 'banane', liked: true };
  const neutral = { id: 'birne' };
  assert.ok(policy.foodStatusPreferenceLikedTie(liked, neutral) < 0);
  assert.ok(policy.foodStatusPreferenceLikedTie(neutral, liked) > 0);
  assert.equal(policy.foodStatusPreferenceLikedTie(liked, { id: 'apfel', liked: true }), 0);
});

test('FOOD-STATUS-UI: Bekannt hat eigene aktive Darstellung und Policy ist kein Statistik-Seiteneffekt', () => {
  assert.match(foodsSource, /raw === "Bekannt" \? "status-tolerated"/);
  assert.doesNotMatch(foodsSource, /raw === "Regelmäßig"/);
  assert.match(indexSource, /js\/food-status-preferences\.js/);
  assert.match(policySource, /status\(foodRecord\) === "Bekannt"/);
  assert.match(policySource, /progress-facts/);
  assert.doesNotMatch(statisticsSource, /installFoodStatusPreferencePolicy/);
});
