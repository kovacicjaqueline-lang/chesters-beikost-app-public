const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const foodsSource = fs.readFileSync(path.join(root, 'data', 'foods.js'), 'utf8');
const stateSource = fs.readFileSync(path.join(root, 'js', 'state.js'), 'utf8');

function loadAudit() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    `${foodsSource}\n${stateSource}\n` +
      `globalThis.__audit = { FOOD_SAFETY_AUDIT_GROUPS, FOOD_SAFE_FORM_AUDIT_OVERRIDES, applyFoodSafetyAudit };\n` +
      `globalThis.__foods = FOOD_DB;`,
    sandbox,
  );
  return { ...sandbox.__audit, foods: sandbox.__foods };
}

function byId(foods, id) {
  return foods.find((food) => food.id === id);
}

test('Tomate enthält Haut- und Viertel-Hinweis und bleibt frisch bei der Mahlzeit', () => {
  const { foods } = loadAudit();
  const tomate = byId(foods, 'tomate');

  assert.match(tomate.safeForm, /Haut möglichst entfernen/i);
  assert.match(tomate.safeForm, /längs vierteln/i);
  assert.match(tomate.safeForm, /nie ganz/i);
  assert.equal(tomate.prep, 'frisch bei der Mahlzeit');
  assert.equal(/Sehr weich garen|längliches Fingerfood/i.test(tomate.safeForm), false);
});

test('Gurke wird frisch mit Haut-Hinweis statt pauschal gegart geführt', () => {
  const { foods } = loadAudit();
  const gurke = byId(foods, 'gurke');

  assert.match(gurke.safeForm, /Haut möglichst entfernen/i);
  assert.match(gurke.safeForm, /längliche, gut greifbare Stücke/i);
  assert.match(gurke.safeForm, /nicht pauschal garen/i);
  assert.equal(gurke.prep, 'frisch bei der Mahlzeit');
});

test('runde und harte Lebensmittel enthalten konkrete Verschluckschutz-Hinweise', () => {
  const { foods } = loadAudit();

  assert.match(byId(foods, 'apfel').safeForm, /keine harten rohen Stücke/i);
  assert.match(byId(foods, 'traube').safeForm, /längs vierteln/i);
  assert.match(byId(foods, 'kirsche').safeForm, /Stein vollständig entfernen/i);
  assert.match(byId(foods, 'heidelbeere').safeForm, /nicht als ganze runde Beere/i);
  assert.match(byId(foods, 'rosenkohl').safeForm, /nicht als ganze runde Kugel/i);
  assert.match(byId(foods, 'maroni').safeForm, /nicht als ganze runde Maroni/i);
});

test('Mais und ganze Getreidekörner werden nicht mehr als ganze Körner empfohlen', () => {
  const { foods, FOOD_SAFETY_AUDIT_GROUPS } = loadAudit();
  const mais = byId(foods, 'mais-polenta');

  assert.match(mais.safeForm, /keine ganzen Maiskörner/i);
  for (const id of FOOD_SAFETY_AUDIT_GROUPS.wholeGrains) {
    const food = byId(foods, id);
    if (!food) continue;
    assert.match(food.safeForm, /keine festen ganzen Körner/i, id);
    assert.equal(/weiche Körner oder später/i.test(food.safeForm), false, id);
  }
});

test('Blattgemüse verwendet keine generische längliche Fingerfood-Anweisung mehr', () => {
  const { foods, FOOD_SAFETY_AUDIT_GROUPS } = loadAudit();

  for (const id of FOOD_SAFETY_AUDIT_GROUPS.leafVegetables) {
    const food = byId(foods, id);
    if (!food) continue;
    assert.match(food.safeForm, /fein zerkleinert|zerdrückt|püriert/i, id);
    assert.equal(/längliches Fingerfood/i.test(food.safeForm), false, id);
  }
});

test('Fischtexte unterscheiden Fisch, problematische Arten und Schalentiere korrekt', () => {
  const { foods, FOOD_SAFETY_AUDIT_GROUPS } = loadAudit();

  for (const id of FOOD_SAFETY_AUDIT_GROUPS.standardFish) {
    const food = byId(foods, id);
    if (!food) continue;
    assert.match(food.safeForm, /vollständig durchgaren/i, id);
    assert.match(food.safeForm, /alle Gräten/i, id);
    assert.equal(/Schalen/i.test(food.safeForm), false, id);
  }

  const tuna = byId(foods, 'thunfisch');
  assert.match(tuna.safeForm, /Nicht als Beikost empfohlen/i);
  assert.equal(tuna.prep, 'nicht als Beikost planen');

  const shrimp = byId(foods, 'garnele');
  assert.match(shrimp.safeForm, /Schale und Schwanz vollständig entfernen/i);
  assert.equal(/Gräten/i.test(shrimp.safeForm), false);

  assert.match(byId(foods, 'bangus-milkfish').safeForm, /Vollständig durchgaren/i);
  assert.match(byId(foods, 'galunggong-round-scad').safeForm, /Vollständig durchgaren/i);
});

test('Brot, Trockenfrüchte und Granatapfel haben konkrete sichere Darreichungsdetails', () => {
  const { foods } = loadAudit();

  assert.match(byId(foods, 'brot').safeForm, /leicht toasten/i);
  assert.match(byId(foods, 'brot').safeForm, /teigigen Klumpen/i);
  assert.match(byId(foods, 'rosine').safeForm, /Unter 12 Monaten nie ganz/i);
  assert.match(byId(foods, 'dattel').safeForm, /Stein vollständig entfernen/i);
  assert.match(byId(foods, 'granatapfel').safeForm, /nicht als Getränk/i);
  assert.match(byId(foods, 'zitrone').safeForm, /Aromatisieren/i);
});

test('zur Laufzeit ergänzte Lebensmittel erhalten ebenfalls auditierte Hinweise', () => {
  const { applyFoodSafetyAudit } = loadAudit();
  const runtimeFoods = [
    { id: 'honig', safeForm: 'Alters- und phasengerecht anbieten.', prep: 'frisch', priority: 1, meals: ['breakfast'] },
    { id: 'huettenkaese', safeForm: 'Alters- und phasengerecht anbieten.', prep: 'frisch', priority: 2, meals: ['breakfast'] },
    { id: 'schwertfisch', safeForm: 'Vollständig garen.', prep: '20-g-Portionen', priority: 3, meals: ['lunch'] },
    { id: 'miesmuschel', safeForm: 'Vollständig garen.', prep: '20-g-Portionen', priority: 4, meals: ['lunch'] },
  ];

  const before = runtimeFoods.map(({ id, priority, meals }) => ({ id, priority, meals: [...meals] }));
  applyFoodSafetyAudit(runtimeFoods);

  assert.match(byId(runtimeFoods, 'honig').safeForm, /Erst ab 12 Monaten/i);
  assert.equal(byId(runtimeFoods, 'honig').prep, 'erst ab 12 Monaten');
  assert.match(byId(runtimeFoods, 'huettenkaese').safeForm, /pasteurisiert/i);
  assert.match(byId(runtimeFoods, 'schwertfisch').safeForm, /Nicht als Beikost empfohlen/i);
  assert.match(byId(runtimeFoods, 'miesmuschel').safeForm, /Schale vollständig entfernen/i);

  const after = runtimeFoods.map(({ id, priority, meals }) => ({ id, priority, meals: [...meals] }));
  assert.deepEqual(after, before);
});

test('erneute Anwendung nach einem späteren Policy-Patch stellt die auditierte Tomatenform wieder her', () => {
  const { applyFoodSafetyAudit } = loadAudit();
  const foods = [{
    id: 'tomate',
    safeForm: 'Sehr reif und weich: Fruchtfleisch zerdrücken oder eine große Tomate für Fingerfood in breite Viertel oder Spalten schneiden; kleine runde Tomaten nicht ganz anbieten.',
    prep: 'frisch bei der Mahlzeit',
    priority: 42,
    meals: ['lunch', 'dinner'],
  }];

  applyFoodSafetyAudit(foods);
  assert.match(foods[0].safeForm, /Haut möglichst entfernen/i);
  assert.match(foods[0].safeForm, /längs vierteln/i);
  assert.equal(foods[0].priority, 42);
  assert.deepEqual(foods[0].meals, ['lunch', 'dinner']);
});
