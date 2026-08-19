const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { applyFoodPolicyData } = require('../app.js');
const root = path.resolve(__dirname, '..');

function loadFoods() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${fs.readFileSync(path.join(root, 'data/foods.js'), 'utf8')}\nthis.__FOODS = FOOD_DB;`, context);
  return JSON.parse(JSON.stringify(context.__FOODS));
}

test('SEASON-AUDIT: Runtime-Policy überschreibt keine Saisonmatrix und ergänzt neue FOODs neutral', () => {
  const foods = loadFoods();
  const before = new Map(foods.map((food) => [food.id, [...(food.seasonMonths || [])]]));
  const aliases = {};

  applyFoodPolicyData(foods, aliases);

  for (const food of foods) {
    if (before.has(food.id)) {
      assert.deepEqual(
        food.seasonMonths || [],
        before.get(food.id),
        `${food.name}: applyFoodPolicyData darf bestehende seasonMonths nicht überschreiben`,
      );
      continue;
    }

    if (food.id === 'mais' && before.has('mais-polenta')) {
      assert.deepEqual(
        food.seasonMonths || [],
        before.get('mais-polenta'),
        'Mais-Migration muss die neutrale Saisonsemantik des historischen Mais/Polenta-Datensatzes behalten',
      );
      continue;
    }

    assert.deepEqual(
      food.seasonMonths || [],
      [],
      `${food.name}: zur Laufzeit ergänzte FOODs ohne freigegebene Österreich-Matrix bleiben neutral`,
    );
  }
});
