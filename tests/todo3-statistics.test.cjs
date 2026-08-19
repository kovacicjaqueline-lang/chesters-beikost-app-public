const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'statistics.js'), 'utf8');

function addDays(value, days) {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function harness(logs = []) {
  const foods = [
    { id: 'a', name: 'A', count100: true },
    { id: 'b', name: 'B', count100: true },
  ];
  const state = {
    settings: { startDate: '2026-07-14', textureStage: 1, targetFoods: 100 },
    foods,
    logs,
    planLocks: { '2026-08-17|lunch': { mode: 'auto', foodIds: ['a'] } },
  };
  const context = {
    state,
    today: () => '2026-08-17',
    addDays,
    food: (id) => foods.find((food) => food.id === id),
    canonicalId: (id) => id,
    outcomeForFood: (log, id) => log.foodOutcomes?.[id] || log.outcome || '',
    inferEntryType: (log) => log.entryType || 'meal',
    uniqueTriedCount: () => new Set(state.logs.flatMap((log) => (log.foodIds || []).filter((id) => ['eaten', 'tried'].includes(log.foodOutcomes?.[id] || log.outcome)))).size,
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__snapshot = statisticsSnapshot;`, context);
  return { state, snapshot: (range = 'all') => context.__snapshot(range) };
}

test('TODO3 STAT-01: Planung allein zählt nicht als tatsächliche Gabe', () => {
  const { snapshot } = harness([]);
  const result = snapshot('all');
  assert.equal(result.logs.length, 0);
  assert.equal(result.varietyCount, 0);
  assert.equal(result.introducedCount, 0);
  assert.equal(result.outcomeCounts.eaten, 0);
});

test('TODO3 STAT-01: eaten/tried zählen positiv; not_offered/reaction nicht als kennengelernt', () => {
  const logs = [
    { date: '2026-08-14', meal: 'lunch', foodIds: ['a'], foodOutcomes: { a: 'eaten' }, amount: 20 },
    { date: '2026-08-15', meal: 'lunch', foodIds: ['b'], foodOutcomes: { b: 'tried' } },
    { date: '2026-08-16', meal: 'lunch', foodIds: ['a'], foodOutcomes: { a: 'not_offered' } },
    { date: '2026-08-17', meal: 'lunch', foodIds: ['b'], foodOutcomes: { b: 'reaction' } },
  ];
  const result = harness(logs).snapshot('all');
  assert.equal(result.varietyCount, 2);
  assert.equal(result.outcomeCounts.eaten, 1);
  assert.equal(result.outcomeCounts.tried, 1);
  assert.equal(result.outcomeCounts.not_offered, 1);
  assert.equal(result.outcomeCounts.reaction, 1);
});

test('TODO3 STAT-02: Änderung eines Logs wird vollständig aus dem aktuellen Logbestand neu abgeleitet', () => {
  const logs = [{ date: '2026-08-17', meal: 'lunch', foodIds: ['a'], foodOutcomes: { a: 'eaten' }, amount: 30 }];
  const { state, snapshot } = harness(logs);
  assert.equal(snapshot('all').varietyCount, 1);
  assert.equal(snapshot('all').outcomeCounts.eaten, 1);

  state.logs[0].foodOutcomes.a = 'not_offered';
  const changed = snapshot('all');
  assert.equal(changed.varietyCount, 0);
  assert.equal(changed.introducedCount, 0);
  assert.equal(changed.outcomeCounts.eaten, 0);
  assert.equal(changed.outcomeCounts.not_offered, 1);
});

test('TODO3 STAT-02: Löschen des einzigen positiven Logs entfernt dessen abgeleitete Statistik', () => {
  const { state, snapshot } = harness([{ date: '2026-08-17', meal: 'lunch', foodIds: ['a'], foodOutcomes: { a: 'eaten' } }]);
  assert.equal(snapshot('all').varietyCount, 1);
  state.logs.length = 0;
  assert.equal(snapshot('all').varietyCount, 0);
  assert.equal(snapshot('all').introducedCount, 0);
});

test('TODO3 STAT-02: mehrere Lebensmittel in einem Log werden nach ihrem eigenen foodOutcome gezählt', () => {
  const result = harness([{
    date: '2026-08-17',
    meal: 'lunch',
    foodIds: ['a', 'b'],
    foodOutcomes: { a: 'eaten', b: 'not_accepted' },
  }]).snapshot('all');
  assert.equal(result.varietyCount, 1);
  assert.equal(result.outcomeCounts.eaten, 1);
  assert.equal(result.outcomeCounts.not_accepted, 1);
});
