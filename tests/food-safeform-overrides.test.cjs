const test = require('node:test');
const assert = require('node:assert/strict');

const { applyFoodPolicyData } = require('../app.js');

function records() {
  return [
    {
      id: 'gurke',
      name: 'Gurke',
      category: 'Gemüse',
      priority: 38,
      active: true,
      allergenGroup: '',
      ironRich: false,
      ph: false,
      alias: '',
      meals: ['lunch', 'dinner'],
      safeForm: 'Sehr weich garen; pürieren, zerdrücken oder als weiches längliches Fingerfood anbieten.',
      prep: 'ca. 35-g-Basisportionen',
      seasonMonths: [],
      count100: true,
      manualStatus: 'auto',
      notes: '',
    },
    {
      id: 'tomate',
      name: 'Tomate',
      category: 'Gemüse',
      priority: 42,
      active: true,
      allergenGroup: '',
      ironRich: false,
      ph: false,
      alias: '',
      meals: ['lunch', 'dinner'],
      safeForm: 'Sehr weich garen; pürieren, zerdrücken oder als weiches längliches Fingerfood anbieten.',
      prep: 'ca. 35-g-Basisportionen',
      seasonMonths: [],
      count100: true,
      manualStatus: 'auto',
      notes: '',
    },
  ];
}

test('Tomate verwendet keine generische Gemüse-Stick- oder Garform mehr', () => {
  const foods = records();
  applyFoodPolicyData(foods, {});
  const tomate = foods.find((food) => food.id === 'tomate');

  assert.ok(tomate.safeForm.includes('breite Viertel oder Spalten'));
  assert.ok(tomate.safeForm.includes('kleine runde Tomaten nicht ganz anbieten'));
  assert.equal(/länglich|Sehr weich garen/i.test(tomate.safeForm), false);
  assert.equal(tomate.prep, 'frisch bei der Mahlzeit');
});

test('Gurke bleibt roh/frisch vorbereitbar und wird nicht pauschal gegart', () => {
  const foods = records();
  applyFoodPolicyData(foods, {});
  const gurke = foods.find((food) => food.id === 'gurke');

  assert.ok(gurke.safeForm.includes('längs halbierte Stücke'));
  assert.ok(gurke.safeForm.includes('nicht pauschal garen'));
  assert.equal(gurke.prep, 'frisch bei der Mahlzeit');
});

test('Safe-Form-Korrektur verändert stabile IDs, Prioritäten und Mahlzeiteneignung nicht', () => {
  const foods = records();
  applyFoodPolicyData(foods, {});

  const gurke = foods.find((food) => food.id === 'gurke');
  const tomate = foods.find((food) => food.id === 'tomate');
  assert.equal(gurke.priority, 38);
  assert.equal(tomate.priority, 42);
  assert.deepEqual(gurke.meals, ['lunch', 'dinner']);
  assert.deepEqual(tomate.meals, ['lunch', 'dinner']);
});
