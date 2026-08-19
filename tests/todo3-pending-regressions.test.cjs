const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { applyFoodPolicyData } = require('../app.js');
const root = path.resolve(__dirname, '..');

/*
 * Diese Datei enthält nur noch tatsächlich offene TODO3-Regressionen plus die
 * früher übersprungenen Verträge, für die es keine gleichwertige eigene Regression gab.
 * Bereits anderweitig vollständig abgedeckte Alt-Platzhalter werden nicht dupliziert:
 * - MILK-01 -> tests/milk-01-planner.test.cjs (+ adversarial coverage)
 * - FOOD-01 / FOOD-Neuaufnahme -> tests/food-intake-10.1.25.test.cjs
 * - FOOD-COUNT -> tests/food-count-semantics.test.cjs
 * - SEASON-AUDIT -> tests/food-seasonmonths-at.test.cjs + tests/food-seasonmonths-runtime.test.cjs
 * - grundlegende Allergen-/Alias-Daten -> tests/food-intake-10.1.25.test.cjs
 * - UI-06 -> tests/ui06-completed-day-card-alignment.test.cjs
 */

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

function loadFoodMigrationRuntime() {
  const context = vm.createContext({ console, structuredClone });
  vm.runInContext(source('data/foods.js'), context);
  vm.runInContext(source('data/recipes.js'), context);
  vm.runInContext(`${source('js/state.js')}\nglobalThis.__foods=FOOD_DB;globalThis.__aliases=ID_ALIASES;`, context);
  vm.runInContext(source('js/utils.js'), context);
  vm.runInContext(`${source('js/migrations.js')}\nglobalThis.__mergeFoods=mergeFoods;globalThis.__foodByName=foodByName;globalThis.__migrateState=migrateState;`, context);
  vm.runInContext(source('js/model.js'), context);
  applyFoodPolicyData(context.__foods, context.__aliases);
  return context;
}

function loadPlanningDataHelpers(settings = {}) {
  const planningSource = source('js/planning.js');
  const context = {
    state: {
      settings: {
        seasonal: true,
        phMode: 'off',
        travelPrep: false,
        allergenDays: 7,
        ...settings,
      },
    },
    dateObj: (value) => new Date(`${value}T00:00:00Z`),
    rank: () => 2,
    lastDate: () => '2026-08-10',
    diffDays: (later, earlier) => Math.round((new Date(`${later}T00:00:00Z`) - new Date(`${earlier}T00:00:00Z`)) / 86400000),
  };
  vm.createContext(context);
  vm.runInContext(`${planningSource}\nthis.__isSeason = isSeason; this.__effectivePriority = effectivePriority; this.__dueAllergen = dueAllergen;`, context);
  return context;
}

test('TODO3 SEASON-STRUCT: vorhandene seasonMonths enthalten nur eindeutige Monate 1..12', () => {
  for (const food of loadFoods()) {
    const months = food.seasonMonths || [];
    assert.ok(Array.isArray(months), `${food.name}: seasonMonths muss Array sein`);
    assert.equal(new Set(months).size, months.length, `${food.name}: doppelte Saisonmonate`);
    for (const month of months) {
      assert.equal(Number.isInteger(month), true, `${food.name}: Saisonmonat muss Ganzzahl sein`);
      assert.ok(month >= 1 && month <= 12, `${food.name}: ungültiger Saisonmonat ${month}`);
    }
  }
});

test('TODO3 SEASON-CONSUMER: Planner-Priorisierung verwendet ausschließlich die vorhandenen seasonMonths', () => {
  const context = loadPlanningDataHelpers();
  const food = { id: 'season-test', priority: 100, seasonMonths: [8], ph: false };
  assert.equal(context.__isSeason(food, '2026-08-18'), true);
  assert.equal(context.__isSeason(food, '2026-09-01'), false);
  assert.equal(context.__effectivePriority(food, '2026-08-18'), 97, 'in Saison greift die bestehende saisonale Bevorzugung');
  assert.equal(context.__effectivePriority(food, '2026-09-01'), 106, 'außer Saison greift die bestehende saisonale Nachreihung');

  context.state.settings.seasonal = false;
  assert.equal(context.__effectivePriority(food, '2026-08-18'), 100, 'deaktivierte Saisonoption verändert die Priorität nicht');
});

test('TODO3 ALLERGEN-CONSUMER: neue Allergengruppen werden datengetrieben über allergenGroup berücksichtigt', () => {
  const context = loadPlanningDataHelpers();
  const lupine = { id: 'lupine-test', allergenGroup: 'Lupine' };
  const mollusc = { id: 'mollusc-test', allergenGroup: 'Weichtiere' };
  const none = { id: 'none-test', allergenGroup: '' };

  assert.equal(context.__dueAllergen(lupine, '2026-08-18'), true);
  assert.equal(context.__dueAllergen(mollusc, '2026-08-18'), true);
  assert.equal(context.__dueAllergen(none, '2026-08-18'), false);
});

test('TODO3 FOOD-ALLERGEN-PERSIST: kanonische und Custom-Allergengruppen bleiben beim Laden/Migrieren erhalten', () => {
  const context = loadFoodMigrationRuntime();
  const canonicalLupine = context.__foods.find((food) => food.id === 'lupine');
  assert.equal(canonicalLupine?.allergenGroup, 'Lupine');

  const merged = json(context.__mergeFoods([
    {
      ...json(canonicalLupine),
      allergenGroup: 'veraltete-falsche-gruppe',
      manualStatus: 'Probiert',
    },
    {
      id: 'custom-allergen-test',
      name: 'Custom Allergentest',
      category: 'Samen',
      priority: 999,
      active: true,
      allergenGroup: 'Sesam',
      manualStatus: 'Probiert',
      meals: ['breakfast', 'lunch', 'dinner'],
    },
  ]));

  assert.equal(
    merged.find((food) => food.id === 'lupine')?.allergenGroup,
    'Lupine',
    'kanonische FOOD-Allergengruppe kommt beim Reload aus dem aktuellen FOOD-Stamm',
  );
  assert.equal(
    merged.find((food) => food.id === 'custom-allergen-test')?.allergenGroup,
    'Sesam',
    'Custom-FOOD behält seine gespeicherte Allergengruppe',
  );
});

test('TODO3 FOOD-ALLERGEN-UI: FOOD-Detail und Planner lesen dieselbe kanonische allergenGroup', () => {
  const foodUiSource = source('js/foods.js');
  const planningSource = source('js/planning.js');
  assert.match(
    foodUiSource,
    /f\.allergenGroup\s*\?\s*` · Allergen: \$\{esc\(f\.allergenGroup\)\}`/,
    'FOOD-Detail muss direkt allergenGroup rendern',
  );

  const dueStart = planningSource.indexOf('function dueAllergen');
  assert.ok(dueStart >= 0, 'Planner muss dueAllergen definieren');
  const nextFunction = planningSource.indexOf('\nfunction ', dueStart + 1);
  const dueBody = planningSource.slice(dueStart, nextFunction >= 0 ? nextFunction : undefined);
  assert.match(
    dueBody,
    /f\.allergenGroup/,
    'Planner-Allergenlogik muss dasselbe allergenGroup-Feld verwenden',
  );
});

test('TODO3 FOOD-ALIASES-INTEGRATION: Alias-Migration kanonisiert Protokoll und Vorrat auf dieselbe FOOD-ID', () => {
  const context = loadFoodMigrationRuntime();
  const migrated = json(context.__migrateState({
    settings: {},
    foods: [
      {
        id: 'legacy-marille',
        name: 'Marille',
        category: 'Obst',
        priority: 10,
        active: true,
        allergenGroup: '',
        manualStatus: 'Probiert',
        meals: ['breakfast', 'lunch', 'dinner'],
      },
    ],
    logs: [
      {
        id: 'log-alias',
        date: '2026-08-18',
        meal: 'breakfast',
        foodIds: ['legacy-marille'],
        foodOutcomes: { 'legacy-marille': 'eaten' },
      },
    ],
    inventory: [
      {
        id: 'inv-alias',
        kind: 'food',
        foodId: 'legacy-marille',
        portions: 2,
        frozenDate: '2026-08-18',
      },
    ],
  }));

  const canonical = context.__foodByName('Marille', context.__foods)?.id;
  assert.equal(canonical, 'aprikose');
  assert.deepEqual(migrated.logs[0].foodIds, ['aprikose']);
  assert.equal(migrated.logs[0].foodOutcomes.aprikose, 'eaten');
  assert.equal(migrated.inventory[0].foodId, 'aprikose');
  assert.equal(migrated.foods.some((food) => food.id === 'legacy-marille'), false);
});
