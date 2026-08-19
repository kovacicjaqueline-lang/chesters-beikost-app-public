const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'migrations.js'), 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));

function defaultState() {
  return {
    settings: {
      birthDate: '2020-01-01',
      startDate: '2026-01-01',
      phaseSelected: 'aufbau',
      phaseModelVersion: 2,
      phaseMode: 'manual-v2',
      amountSelected: 'taste',
      textureStage: 1,
      phMode: 'off',
    },
    foods: [], logs: [], inventory: [], overrides: {}, deferred: {}, pantry: {},
    planLocks: {}, autoLockExcluded: {}, manualMeals: {}, inactivePlanKept: {},
    combinationPauses: {}, followUps: {}, shoppingHints: {},
    backupMeta: { chesterContextSeeded: true },
  };
}

function migrationContext() {
  const context = {
    FOOD_DB: [],
    ID_ALIASES: {},
    LEGACY_MILK_ID: '__legacy_milk__',
    DEFAULT: defaultState(),
    AMOUNT_LEVELS: { taste: { rank: 0 } },
    clone,
    suggestedAmountLevelFromLogs: () => 'taste',
    diffDays: () => 0,
    today: () => '2026-08-17',
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__migrateStateCore = migrateStateCore;`, context);
  return context;
}

test('TODO3 PLAN-07-MIG: Legacy-Custom-Fleisch wird bei stabiler ID auf lunch/dinner normalisiert und alle Referenzen bleiben migrationssicher', () => {
  const id = 'custom-pferdefleisch';
  const sourceState = defaultState();
  sourceState.foods = [{
    id,
    name: 'Pferdefleisch',
    category: 'Fleisch',
    meals: ['breakfast', 'lunch', 'dinner'],
    active: true,
    manualStatus: 'Verträgliche Basis',
  }];
  sourceState.logs = [{
    id: 'log-1', date: '2026-08-10', meal: 'lunch',
    foodIds: [id], focusId: id, baseFoodIds: [id], sampleFoodIds: [],
    foodRoles: { [id]: 'base' }, foodOutcomes: { [id]: 'eaten' }, outcome: 'eaten',
  }];
  sourceState.inventory = [{ id: 'inv-1', kind: 'food', foodId: id, portions: 3 }];
  sourceState.overrides = { '2026-08-20|lunch': id };
  sourceState.pantry = { [id]: true };
  sourceState.manualMeals = {
    '2026-08-21|dinner': {
      focusId: id, foodIds: [id], baseFoodIds: [id], sampleFoodIds: [],
      foodRoles: { [id]: 'base' }, inventoryFoodIds: [id], manualAdded: true,
    },
  };
  sourceState.planLocks = {
    '2026-08-22|dinner': {
      mode: 'manual', focusId: id, foodIds: [id], baseFoodIds: [id], sampleFoodIds: [],
      foodRoles: { [id]: 'base' }, optionalAddons: [], inventoryFoodIds: [id], followUpFoodId: '',
    },
  };

  const context = migrationContext();
  const migrated = clone(context.__migrateStateCore(sourceState));
  const food = migrated.foods.find((item) => item.id === id);

  assert.ok(food);
  assert.equal(food.id, id);
  assert.deepEqual(food.meals, ['lunch', 'dinner']);

  assert.deepEqual(migrated.logs[0].foodIds, [id]);
  assert.equal(migrated.logs[0].focusId, id);
  assert.deepEqual(migrated.logs[0].baseFoodIds, [id]);
  assert.equal(migrated.logs[0].foodOutcomes[id], 'eaten');
  assert.equal(migrated.inventory[0].foodId, id);
  assert.equal(migrated.inventory[0].portions, 3);
  assert.equal(migrated.overrides['2026-08-20|lunch'], id);
  assert.equal(migrated.pantry[id], true);

  const manual = migrated.manualMeals['2026-08-21|dinner'];
  assert.equal(manual.focusId, id);
  assert.deepEqual(manual.foodIds, [id]);
  assert.deepEqual(manual.inventoryFoodIds, [id]);

  const lock = migrated.planLocks['2026-08-22|dinner'];
  assert.ok(lock);
  assert.equal(lock.mode, 'manual');
  assert.equal(lock.focusId, id);
  assert.deepEqual(lock.foodIds, [id]);
});
