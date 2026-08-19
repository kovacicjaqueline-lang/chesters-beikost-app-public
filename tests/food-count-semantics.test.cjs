const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modelSource = fs.readFileSync(path.join(root, 'js', 'model.js'), 'utf8');

function loadModel(foods, aliases = {}) {
  const state = { foods, logs: [], settings: {} };
  const context = {
    state,
    STATUS_ORDER: { Offen: 0, Probiert: 1, 'Verträgliche Basis': 2, Regelmäßig: 3, Pausiert: 0 },
    canonicalId: (id) => aliases[id] || id,
  };
  vm.createContext(context);
  vm.runInContext(`${modelSource}\nthis.__identity = count100Identity; this.__learnedFoods = learnedFoods;`, context);
  return {
    identity: (id) => context.__identity(id),
    learnedFoods: () => JSON.parse(JSON.stringify(context.__learnedFoods())),
  };
}

function tried(id, priority) {
  return {
    id,
    name: id,
    priority,
    count100: true,
    manualStatus: 'Probiert',
  };
}

test('TODO3 FOOD-COUNT: nur die fachlich freigegebenen Verarbeitungsformen teilen eine 100-FOOD-Identität', () => {
  const model = loadModel([]);

  assert.equal(model.identity('sesam'), 'sesam');
  assert.equal(model.identity('tahin'), 'sesam');
  assert.equal(model.identity('mais'), 'mais');
  assert.equal(model.identity('mais-polenta'), 'mais');
  assert.equal(model.identity('polenta'), 'mais');
  assert.equal(model.identity('hafer'), 'hafer');
  assert.equal(model.identity('haferdrink'), 'hafer');
  assert.equal(model.identity('weizen'), 'weizen');
  for (const id of ['weizengriess', 'bulgur', 'couscous', 'nudeln-pasta', 'brot']) {
    assert.equal(model.identity(id), 'weizen', `${id} muss zur Weizen-Grundstoffidentität zählen`);
  }
});

test('TODO3 FOOD-COUNT: Dinkel und verschiedene Fischarten bleiben eigenständige Lebensmittel', () => {
  const model = loadModel([]);
  assert.equal(model.identity('dinkel'), 'dinkel');
  assert.equal(model.identity('lachs'), 'lachs');
  assert.equal(model.identity('forelle'), 'forelle');
  assert.notEqual(model.identity('dinkel'), model.identity('weizen'));
  assert.notEqual(model.identity('lachs'), model.identity('forelle'));
});

test('TODO3 FOOD-COUNT: kennengelernte Verarbeitungsformen werden im 100-FOOD-Fortschritt genau einmal gezählt', () => {
  const ids = [
    'sesam', 'tahin',
    'mais-polenta', 'polenta',
    'hafer', 'haferdrink',
    'weizen', 'weizengriess', 'bulgur', 'couscous', 'nudeln-pasta', 'brot',
    'dinkel', 'lachs', 'forelle',
  ];
  const model = loadModel(ids.map((id, index) => tried(id, index + 1)));
  const learned = model.learnedFoods();

  assert.equal(learned.length, 7, 'Sesam, Mais, Hafer, Weizen plus Dinkel, Lachs und Forelle');
  assert.deepEqual(
    learned.map((food) => model.identity(food.id)),
    ['sesam', 'mais', 'hafer', 'weizen', 'dinkel', 'lachs', 'forelle'],
  );
});

test('TODO3 FOOD-COUNT: kanonische Aliasauflösung erzeugt keinen zusätzlichen 100-FOOD-Punkt', () => {
  const model = loadModel(
    [tried('mais-polenta', 1), tried('polenta', 2)],
    { 'mais-polenta': 'mais' },
  );

  assert.equal(model.identity('mais-polenta'), 'mais');
  assert.equal(model.identity('polenta'), 'mais');
  assert.equal(model.learnedFoods().length, 1);
});

test('TODO3 FOOD-COUNT: count100=false bleibt unabhängig von der Gruppenlogik ausgeschlossen', () => {
  const foods = [
    tried('sesam', 1),
    { ...tried('tahin', 2), count100: false },
    { ...tried('dinkel', 3), count100: false },
  ];
  const model = loadModel(foods);
  assert.deepEqual(model.learnedFoods().map((food) => food.id), ['sesam']);
});
