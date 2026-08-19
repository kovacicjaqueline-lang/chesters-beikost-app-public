const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const prepSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'prep.js'), 'utf8');
const prepCoreEnd = prepSource.indexOf('function prepItems() {');
assert.notEqual(prepCoreEnd, -1);

function loadPrepCore() {
  const sandbox = {
    state: { inventory: [] },
    rank: () => 2,
    food: () => null,
    normalizeName: (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${prepSource.slice(0, prepCoreEnd)}\nthis.__prepTest = { freshAtMealFood, freshMealText, prepAdvice };`,
    sandbox,
  );
  return sandbox.__prepTest;
}

const demand = { uses: 2, requiredGrams: 70, availableGrams: 0, reserved: 0 };

test('Gurke und Tomate landen trotz alter generischer FOOD-Daten bei der Mahlzeit', () => {
  const { freshAtMealFood, prepAdvice } = loadPrepCore();
  for (const [id, name] of [['gurke', 'Gurke'], ['tomate', 'Tomate']]) {
    const foodRecord = {
      id,
      name,
      category: 'Gemüse',
      allergenGroup: '',
      prep: 'ca. 35-g-Basisportionen',
      safeForm: 'Sehr weich garen; pürieren, zerdrücken oder als weiches längliches Fingerfood anbieten.',
    };
    assert.equal(freshAtMealFood(foodRecord), true, id);
    const advice = prepAdvice(foodRecord, demand);
    assert.equal(advice.mode, 'Frisch', id);
    assert.equal(advice.inventorySize, undefined, id);
    assert.doesNotMatch(
      `${advice.headline} ${advice.recommendation} ${advice.form}`,
      /handelsübliche Einheit vollständig garen|gesamten unberührten Rest pur einfrieren/i,
      id,
    );
  }
});

test('Normales Kochgemüse bleibt vorbereitbar, erhält aber keinen pauschalen Ganzes-Lebensmittel-Fallback', () => {
  const { freshAtMealFood, prepAdvice } = loadPrepCore();
  const karfiol = {
    id: 'karfiol',
    name: 'Karfiol',
    category: 'Gemüse',
    allergenGroup: '',
    prep: 'ca. 35-g-Basisportionen',
    safeForm: 'Sehr weich garen; pürieren oder zerdrücken.',
  };
  assert.equal(freshAtMealFood(karfiol), false);
  const advice = prepAdvice(karfiol, demand);
  assert.equal(advice.mode, 'Nach Bedarf');
  assert.equal(advice.headline, 'Nach Planbedarf vorbereiten');
  assert.equal(advice.recommendation, karfiol.safeForm);
  assert.doesNotMatch(
    `${advice.headline} ${advice.recommendation} ${advice.form}`,
    /Eine handelsübliche Einheit vollständig garen|gesamten unberührten Rest pur einfrieren/i,
  );
});

test('Frisch-Hinweise übernehmen food-spezifische sichere Form statt generischem Roh-Hinweis', () => {
  const { freshAtMealFood, freshMealText } = loadPrepCore();
  const cookedFruit = {
    id: 'holunder',
    name: 'Holunderbeere',
    category: 'Obst',
    allergenGroup: '',
    prep: 'meist frisch',
    safeForm: 'Nicht roh anbieten; vollständig erhitzen und danach altersgerecht zerdrücken oder passieren.',
  };
  assert.equal(freshAtMealFood(cookedFruit), true);
  assert.equal(freshMealText(cookedFruit), cookedFruit.safeForm);
});

test('alter generischer Gemüse-Batchtext ist entfernt', () => {
  assert.doesNotMatch(prepSource, /Eine handelsübliche Einheit vollständig garen/);
  assert.doesNotMatch(prepSource, /Sehr weich dämpfen, eine Portion anbieten und den gesamten unberührten Rest pur einfrieren/);
});
