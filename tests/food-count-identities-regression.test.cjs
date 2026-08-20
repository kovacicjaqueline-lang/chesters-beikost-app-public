const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modelSource = fs.readFileSync(path.join(root, 'js', 'model.js'), 'utf8');
const statisticsSource = fs.readFileSync(path.join(root, 'js', 'statistics.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
const foodsSource = fs.readFileSync(path.join(root, 'data', 'foods.js'), 'utf8');

function addDays(value, days) {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function harness(foods, logs = [], aliases = {}) {
  const state = {
    foods,
    logs,
    inventory: [],
    settings: { startDate: '2026-07-14', targetFoods: 100, phaseSelected: 'kennenlernen' },
  };
  const context = {
    state,
    STATUS_ORDER: { Offen: 0, Probiert: 1, 'Verträgliche Basis': 2, Regelmäßig: 3, Pausiert: 0 },
    canonicalId: (id) => aliases[id] || id,
    food: (id) => state.foods.find((item) => item.id === id),
    today: () => '2026-08-17',
    addDays,
  };
  vm.createContext(context);
  vm.runInContext(`${modelSource}\nthis.__resolve = resolvedCount100Identities; this.__identity = count100Identity; this.__learnedIdentities = learnedCountIdentities; this.__learnedFoods = learnedFoods;`, context);
  vm.runInContext(`${statisticsSource}\nthis.__snapshot = statisticsSnapshot;`, context);
  return {
    state,
    resolve: (foodOrId) => JSON.parse(JSON.stringify(context.__resolve(foodOrId))),
    identity: (foodOrId) => context.__identity(foodOrId),
    learnedIdentities: () => JSON.parse(JSON.stringify(context.__learnedIdentities())),
    learnedFoods: () => JSON.parse(JSON.stringify(context.__learnedFoods())),
    snapshot: (range = 'all') => context.__snapshot(range),
  };
}

function tried(id, priority = 1, extra = {}) {
  return { id, name: id, priority, count100: true, manualStatus: 'Probiert', ...extra };
}

const SHARED_GROUPS = Object.freeze({
  sesam: ['sesam', 'tahin'],
  mais: ['mais', 'polenta'],
  hafer: ['hafer', 'haferdrink'],
  weizen: ['weizen', 'weizengriess', 'bulgur', 'couscous', 'nudeln-pasta', 'brot'],
  soja: ['sojabohne', 'soja-tofu', 'tempeh', 'sojajoghurt'],
  kuhmilch: ['kuhmilch', 'naturjoghurt', 'buttermilch', 'butter', 'frischkaese', 'kaese', 'kefir', 'mozzarella', 'quark', 'skyr', 'huettenkaese'],
  traube: ['traube', 'rosine'],
});

const EXCLUDED_IDS = ['rapsoel', 'saba-banane', 'kokosoel', 'olivenoel', 'walnussoel', 'sojaoel', 'weizenkeimoel'];
const RUNTIME_ADDITIONS = [
  ['huettenkaese', 'Hüttenkäse'],
  ['honig', 'Honig'],
  ['saibling', 'Saibling'],
  ['hering', 'Hering'],
  ['karpfen', 'Karpfen'],
  ['atlantische-makrele', 'Atlantische Makrele'],
  ['schwertfisch', 'Schwertfisch'],
  ['heilbutt', 'Heilbutt'],
  ['hecht', 'Hecht'],
  ['koenigsmakrele', 'Königsmakrele'],
  ['buttermakrele', 'Buttermakrele'],
  ['schlangenmakrele', 'Schlangenmakrele'],
];

test('FOOD-COUNT: freigegebene Verarbeitungsformen teilen exakt ihre Grundstoff-Identität', () => {
  const h = harness([]);
  for (const [identity, ids] of Object.entries(SHARED_GROUPS)) {
    for (const id of ids) assert.deepEqual(h.resolve(tried(id)), [identity], `${id} muss als ${identity} zählen`);
  }
  assert.deepEqual(h.resolve(tried('mais-polenta')), ['mais'], 'historische Mais-ID bleibt migrationssicher');
  assert.deepEqual(h.resolve(tried('dinkel')), ['dinkel']);
  assert.notEqual(h.identity(tried('dinkel')), h.identity(tried('weizen')));
});

test('FOOD-COUNT: count100=false ist die Ausschlussquelle; Custom-FOODs fallen auf die eigene ID zurück', () => {
  const h = harness([]);
  assert.deepEqual(h.resolve({ id: 'rapsoel', name: 'Rapsöl', count100: false }), []);
  assert.deepEqual(h.resolve({ id: 'custom-mango', name: 'Eigene Mango', count100: true }), ['custom-mango']);
});

test('FOOD-COUNT: ein explizites zusammengesetztes FOOD kann mehrere Grundstoff-Identitäten einführen', () => {
  const composite = tried('waffel-test', 1, { count100Identities: ['weizen', 'ei'] });
  const h = harness([composite]);
  assert.deepEqual(h.resolve(composite), ['weizen', 'ei']);
  assert.deepEqual(h.learnedIdentities(), ['weizen', 'ei']);
  assert.equal(h.learnedFoods().length, 1, 'ein technisches Composite erscheint in der Vorschau nur einmal');
});

test('FOOD-COUNT Home: Zählstand und technische Vorschau sind ausdrücklich getrennt', () => {
  assert.ok(
    uiSource.includes('tried = typeof learnedCountIdentities === "function" ? learnedCountIdentities().length : learned.length'),
    'Home muss den numerischen Fortschritt aus Zählidentitäten ableiten',
  );
});

test('FOOD-COUNT: Reihenfolge und mehrere technische Formen erzeugen keinen Doppelpunkt', () => {
  for (const foods of [
    [tried('sojabohne', 2), tried('soja-tofu', 1)],
    [tried('soja-tofu', 2), tried('sojabohne', 1)],
  ]) {
    const h = harness(foods);
    assert.deepEqual(h.learnedIdentities(), ['soja']);
    assert.equal(h.learnedFoods().length, 1);
  }
});

test('FOOD-COUNT Audit: aktueller effektiver Stamm bleibt 210 technische FOODs / 203 countable / 181 Identitäten', () => {
  const dataContext = {};
  vm.createContext(dataContext);
  vm.runInContext(`${foodsSource}\nthis.__foods = FOOD_DB;`, dataContext);
  const raw = JSON.parse(JSON.stringify(dataContext.__foods));
  assert.equal(raw.length, 198, 'zentraler FOOD-Stamm');

  const byId = new Map(raw.map((item) => [item.id === 'mais-polenta' ? 'mais' : item.id, { ...item, id: item.id === 'mais-polenta' ? 'mais' : item.id }]));
  for (const [id, name] of RUNTIME_ADDITIONS) {
    if (!byId.has(id)) byId.set(id, { id, name, priority: 1000 + byId.size, count100: true, manualStatus: 'auto' });
  }
  const effective = [...byId.values()];
  assert.equal(effective.length, 210);
  assert.deepEqual(effective.filter((item) => item.count100 === false).map((item) => item.id).sort(), [...EXCLUDED_IDS].sort());
  assert.equal(effective.filter((item) => item.count100 !== false).length, 203);

  const h = harness(effective);
  const identityMembers = new Map();
  for (const item of effective) {
    for (const identity of h.resolve(item)) {
      if (!identityMembers.has(identity)) identityMembers.set(identity, []);
      identityMembers.get(identity).push(item.id);
    }
  }
  assert.equal(identityMembers.size, 181);

  const actualShared = Object.fromEntries(
    [...identityMembers.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([identity, ids]) => [identity, ids.sort()]),
  );
  const expectedShared = Object.fromEntries(Object.entries(SHARED_GROUPS).map(([identity, ids]) => [identity, [...ids].sort()]));
  assert.deepEqual(actualShared, expectedShared, 'keine zusätzlichen oder fehlenden Zusammenfassungen im aktuellen FOOD-Stamm');
});

test('FOOD-COUNT Statistik: erste positive Gabe wird über die gesamte Identität bestimmt', () => {
  const foods = [tried('weizen', 1), tried('brot', 2)];
  const logs = [
    { date: '2026-07-20', meal: 'lunch', foodIds: ['weizen'], foodOutcomes: { weizen: 'eaten' } },
    { date: '2026-08-15', meal: 'breakfast', foodIds: ['brot'], foodOutcomes: { brot: 'tried' } },
  ];
  const h = harness(foods, logs);
  assert.equal(h.snapshot('all').varietyCount, 1);
  assert.equal(h.snapshot('all').introducedCount, 1);
  assert.equal(h.snapshot('all').totalLearned, 1);
  assert.equal(h.snapshot('7').varietyCount, 1);
  assert.equal(h.snapshot('7').introducedCount, 0, 'Brot darf Weizen im August nicht erneut als neu zählen');

  h.state.logs[0].foodOutcomes.weizen = 'not_offered';
  assert.equal(h.snapshot('7').introducedCount, 1, 'nach Entfernen der früheren positiven Gabe wird Brot zum Erstkontakt');
});

test('FOOD-COUNT Statistik: gleiche Identität im selben Log zählt einmal; Composite zählt seine zwei Grundstoffe', () => {
  const foods = [
    tried('weizen', 1),
    tried('brot', 2),
    tried('waffel-test', 3, { count100Identities: ['weizen', 'ei'] }),
    { ...tried('rapsoel', 4), count100: false },
  ];
  const h = harness(foods, [{
    date: '2026-08-17',
    meal: 'breakfast',
    foodIds: ['weizen', 'brot', 'waffel-test', 'rapsoel'],
    foodOutcomes: { weizen: 'eaten', brot: 'eaten', 'waffel-test': 'eaten', rapsoel: 'eaten' },
  }]);
  const result = h.snapshot('all');
  assert.equal(result.varietyCount, 2, 'Weizen plus Ei; Brot und Öl erzeugen keinen weiteren Punkt');
  assert.equal(result.introducedCount, 2);
});
