const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

const EXPECTED_AT_SEASON_MONTHS = Object.freeze({
  karotte: [1,2,3,4,5,6,7,8,9,10,11,12],
  kartoffel: [1,2,3,4,5,6,7,8,9,10,11,12],
  brokkoli: [6,7,8,9,10],
  zucchini: [7,8,9,10],
  gurke: [5,6,7,8,9,10],
  karfiol: [6,7,8,9,10],
  'erbsen-tk-moeglich': [6,7,8],
  'gruene-bohnen': [6,7,8,9],
  fenchel: [6,7,8,9,10],
  kohlrabi: [4,5,6,7,8,9,10,11,12],
  wirsing: [1,2,3,6,7,8,9,10,11,12],
  rosenkohl: [1,2,3,4,9,10,11,12],
  weisskraut: [1,2,3,4,5,6,7,8,9,10,11,12],
  rotkraut: [1,2,3,4,5,6,7,8,9,10,11,12],
  kuerbis: [1,2,3,4,9,10,11,12],
  paprika: [6,7,8,9,10],
  tomate: [6,7,8,9,10],
  pastinake: [1,2,3,4,9,10,11,12],
  lauch: [7,8,9,10,11],
  rettich: [1,2,3,4,8,9,10,11,12],
  rhabarber: [4,5,6],
  'rote-ruebe': [1,2,3,4,9,10,11,12],
  schwarzwurzel: [1,2,10,11,12],
  sellerie: [9,10,11],
  spargel: [4,5,6],
  spinat: [3,4,5,9,10],
  zwiebel: [1,2,3,4,5,6,7,8,9,10,11,12],
  aubergine: [7,8,9,10],
  stangensellerie: [6,7,8,9,10],
  mangold: [5,6,7,8,9,10,11],
  chinakohl: [1,2,8,9,10,11,12],
  rucola: [2,3,4,5,6,7,8,9,10,11],
  radicchio: [9,10],
  endivie: [7,8,9,10,11,12],
  petersilienwurzel: [9,10],
  topinambur: [1,2,3,10,11,12],
  knoblauch: [1,2,3,4,5,6,7,8,9,10,11,12],
  apfel: [1,2,3,4,5,6,7,8,9,10,11,12],
  birne: [1,2,8,9,10,11,12],
  brombeere: [6,7],
  erdbeere: [5,6,7,8],
  haselnuss: [1,2,3,4,5,6,7,8,9,10,11,12],
  himbeere: [6,7,8],
  holunder: [9,10],
  kirsche: [6,7,8],
  heidelbeere: [6,7,8,9],
  aprikose: [7,8],
  pfirsich: [8,9],
  preiselbeere: [8,9,10],
  ribisel: [7,8],
  walnuss: [1,2,3,4,5,6,7,8,9,10,11,12],
  traube: [9,10],
  pflaume: [8,9],
  quitte: [10],
});

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadFoods() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source('data/foods.js')}\nthis.__FOODS = FOOD_DB;`, context);
  return json(context.__FOODS);
}

function loadPlanning(settings = {}) {
  const context = {
    state: {
      settings: {
        seasonal: true,
        phMode: 'off',
        travelPrep: false,
        ...settings,
      },
    },
    dateObj: (value) => new Date(`${value}T00:00:00Z`),
  };
  vm.createContext(context);
  vm.runInContext(`${source('js/planning.js')}\nthis.__isSeason=isSeason;this.__effectivePriority=effectivePriority;`, context);
  return context;
}

test('FOOD-SEASON-AT: kompletter FOOD-Stamm entspricht exakt der freigegebenen Österreich-Matrix', () => {
  const foods = loadFoods();
  const foodIds = new Set(foods.map((food) => food.id));

  for (const id of Object.keys(EXPECTED_AT_SEASON_MONTHS)) {
    assert.equal(foodIds.has(id), true, `${id}: freigegebene Saison-ID muss im kanonischen FOOD-Stamm existieren`);
  }

  for (const food of foods) {
    const months = food.seasonMonths || [];
    assert.ok(Array.isArray(months), `${food.name}: seasonMonths muss Array sein`);
    assert.equal(new Set(months).size, months.length, `${food.name}: doppelte Saisonmonate`);
    for (const month of months) {
      assert.equal(Number.isInteger(month), true, `${food.name}: Saisonmonat muss Ganzzahl sein`);
      assert.ok(month >= 1 && month <= 12, `${food.name}: ungültiger Saisonmonat ${month}`);
    }
    assert.deepEqual(
      months,
      EXPECTED_AT_SEASON_MONTHS[food.id] || [],
      `${food.name}: seasonMonths weicht von der freigegebenen Österreich-Matrix ab`,
    );
  }
});

test('FOOD-SEASON-AT: Planner bevorzugt nur explizite Saison, neutral bleibt neutral und travel ignoriert Österreich', () => {
  const context = loadPlanning();
  const seasonal = { id: 'season-test', priority: 100, seasonMonths: [8], ph: false };
  const neutral = { id: 'neutral-test', priority: 100, seasonMonths: [], ph: false };

  assert.equal(context.__isSeason(seasonal, '2026-08-18'), true);
  assert.equal(context.__isSeason(seasonal, '2026-09-01'), false);
  assert.equal(context.__effectivePriority(seasonal, '2026-08-18'), 97);
  assert.equal(context.__effectivePriority(seasonal, '2026-09-01'), 106);
  assert.equal(context.__effectivePriority(neutral, '2026-08-18'), 100);
  assert.equal(context.__effectivePriority(neutral, '2026-09-01'), 100);

  context.state.settings.seasonal = false;
  assert.equal(context.__effectivePriority(seasonal, '2026-08-18'), 100);

  context.state.settings.seasonal = true;
  context.state.settings.phMode = 'travel';
  assert.equal(context.__effectivePriority(seasonal, '2026-08-18'), 105);
  assert.equal(context.__effectivePriority(seasonal, '2026-09-01'), 105);
});
