const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  applyFoodPolicyData,
  automaticFoodEligibility,
  automaticEligibilityStatus,
} = require('../app.js');

const ROOT = path.join(__dirname, '..');
const NEW_IDS = [
  'nektarine','brombeere','ribisel','feige','mangold','spargel','petersilienwurzel',
  'weizengriess','bulgur','kidneybohne','braune-gruene-linse','schnittlauch','pecannuss',
  'paranuss','macadamia','lupine','miesmuschel','mohn','tempeh','kaeferbohne','rhabarber',
  'chinakohl','rucola','radicchio','endivie','rettich','blattsalat','holunder','preiselbeere',
  'quitte','kren','walnussoel','sojaoel','weizenkeimoel',
];
const SECOND_PRIORITY_IDS = [
  'stachelbeere','passionsfrucht','zuckerschote','zuckererbse','gruenkohl','ricotta','pinienkerne',
  'sonnenblumenoel','grapefruit','limette','cranberry','chicoree','vogerlsalat','radieschen',
  'artischocke','edamame','ackerbohne','kalb','ente','zander','sauerrahm','ziegenfrischkaese',
  'kuerbiskernoel','leinoel','minze','salbei','kuemmel','kresse',
];

function source(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function byId(foods, id) {
  return foods.find((food) => food.id === id);
}
function aliasTerms(food) {
  return String(food?.alias || '').split(/[,;/|]+/).map((term) => term.trim()).filter(Boolean);
}
function json(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadRuntime({ policy = true, model = false, planning = false } = {}) {
  const context = vm.createContext({ console, structuredClone });
  vm.runInContext(source('data/foods.js'), context);
  vm.runInContext(source('data/recipes.js'), context);
  vm.runInContext(`${source('js/state.js')}\nglobalThis.__foods=FOOD_DB;globalThis.__aliases=ID_ALIASES;globalThis.__default=DEFAULT;globalThis.__version=APP_VERSION;`, context);
  vm.runInContext(source('js/utils.js'), context);
  vm.runInContext(`${source('js/migrations.js')}\nglobalThis.__canonicalId=canonicalId;globalThis.__mergeFoods=mergeFoods;globalThis.__foodSearchMatches=foodSearchMatches;globalThis.__foodByName=foodByName;`, context);
  if (policy) applyFoodPolicyData(context.__foods, context.__aliases);
  if (model) {
    vm.runInContext(source('js/model.js'), context);
    vm.runInContext('globalThis.__logsFor=logsFor;globalThis.__inventoryName=inventoryName;globalThis.__oldestFoodBatch=oldestFoodBatch;', context);
  }
  if (planning) {
    vm.runInContext(source('js/planning.js'), context);
    vm.runInContext('globalThis.__eligibleCore=eligibleCore;globalThis.__recipeFoodIds=recipeFoodIds;', context);
  }
  return context;
}

function setMinimalState(context, { logs = [], inventory = [] } = {}) {
  context.__stateSeed = { logs, inventory };
  vm.runInContext(`state = {
    settings: { birthDate:'2026-01-24', startDate:'2026-07-14', phaseSelected:'kennenlernen', seasonal:false, travelDate:'2027-01-29', travelPrep:false, phMode:'off', allergenDays:7 },
    foods: FOOD_DB,
    logs: __stateSeed.logs,
    inventory: __stateSeed.inventory,
    overrides: {}, planLocks: {}, manualMeals: {}, combinationPauses: {}, followUps: {}, inactivePlanKept: {}
  };`, context);
}

test('zentraler FOOD-Stamm enthält 198 Datensätze und exakt die 34 freigegebenen neuen IDs', () => {
  const context = loadRuntime({ policy: false });
  const foods = json(context.__foods);
  assert.equal(foods.length, 198);
  assert.equal(new Set(foods.map((food) => food.id)).size, 198);
  for (const id of NEW_IDS) assert.equal(foods.filter((food) => food.id === id).length, 1, id);
  for (const id of SECOND_PRIORITY_IDS) assert.equal(foods.some((food) => food.id === id), false, id);
  assert.doesNotMatch(source('js/state.js'), /FOOD_INTAKE_10_1_25|FOOD_INTAKE_ICON_PATHS|FOOD_INTAKE_PRESETS/);
});

test('bestehende FOOD-Policy bleibt dedupliziert und ergibt 210 effektive Lebensmittel', () => {
  const context = loadRuntime();
  const foods = json(context.__foods);
  assert.equal(foods.length, 210);
  assert.equal(new Set(foods.map((food) => food.id)).size, 210);
  for (const id of ['forelle','saibling','hering','karpfen','atlantische-makrele','huettenkaese','thunfisch']) {
    assert.equal(foods.filter((food) => food.id === id).length, 1, id);
  }
});

test('sichtbare FOOD-Namen enthalten keine Slash-Kombinationen; Alternativnamen liegen in alias', () => {
  const context = loadRuntime();
  const foods = json(context.__foods);
  assert.deepEqual(foods.filter((food) => food.name.includes('/')).map((food) => food.name), []);

  const expected = {
    'huettenkaese': ['Hüttenkäse', 'Cottage Cheese'],
    'braune-gruene-linse': ['Braune Linse', 'Grüne Linse'],
    'nudeln-pasta': ['Nudeln', 'Pasta'],
    'gabi-taro': ['Gabi', 'Taro'],
    'cassava-kamoting-kahoy': ['Cassava', 'Kamoting kahoy'],
    'jackfruit-langka': ['Jackfruit', 'Langka'],
    'holunder': ['Holunderbeere', 'Holunder'],
  };
  for (const [id, [name, alias]] of Object.entries(expected)) {
    const food = byId(foods, id);
    assert.equal(food.name, name, id);
    assert.ok(aliasTerms(food).includes(alias), `${id}:${alias}`);
  }
});

test('alle 34 neuen Datensätze besitzen Pflichtfelder ohne erfundene Alters- oder Phasenregeln', () => {
  const context = loadRuntime({ policy: false });
  const foods = json(context.__foods);
  const required = ['id','name','category','priority','active','allergenGroup','ironRich','ph','alias','meals','safeForm','prep','seasonMonths','count100','manualStatus','notes','autoPlan'];
  for (const id of NEW_IDS) {
    const food = byId(foods, id);
    assert.ok(food, id);
    for (const key of required) assert.ok(Object.hasOwn(food, key), `${id}:${key}`);
    assert.equal(food.active, true, id);
    assert.equal(food.autoPlan, true, id);
    assert.equal(food.manualStatus, 'auto', id);
    assert.ok(Array.isArray(food.meals) && food.meals.length > 0, `${id}:meals`);
    assert.equal(Object.hasOwn(food, 'minPhase'), false, `${id}:minPhase`);
    assert.equal(Object.hasOwn(food, 'minAgeMonths'), false, `${id}:minAgeMonths`);
  }
});

test('verbindliche Allergenzuordnungen einschließlich Haferkorrektur sind wirksam', () => {
  const foods = json(loadRuntime().__foods);
  for (const id of ['pecannuss','paranuss','macadamia']) assert.equal(byId(foods, id).allergenGroup, 'Schalenfrüchte', id);
  assert.equal(byId(foods, 'lupine').allergenGroup, 'Lupine');
  assert.equal(byId(foods, 'miesmuschel').allergenGroup, 'Weichtiere');
  assert.notEqual(byId(foods, 'miesmuschel').allergenGroup, 'Krebstiere');
  assert.equal(byId(foods, 'hafer').allergenGroup, 'Glutenhaltiges Getreide');
  assert.equal(byId(foods, 'haferdrink').allergenGroup, 'Glutenhaltiges Getreide');
});

test('österreichische und alternative Namen werden durch die echte Suche gefunden', () => {
  const context = loadRuntime();
  const checks = {
    aprikose: 'Marille', aubergine: 'Melanzani', kartoffel: 'Erdäpfel', quark: 'Topfen',
    tomate: 'Paradeiser', karfiol: 'Blumenkohl', pflaume: 'Zwetschke', ribisel: 'Johannisbeere',
    kaeferbohne: 'Feuerbohne', kren: 'Meerrettich', holunder: 'Holunder',
    'braune-gruene-linse': 'Grüne Linse', 'huettenkaese': 'Cottage Cheese', 'nudeln-pasta': 'Pasta',
  };
  for (const [id, query] of Object.entries(checks)) {
    const food = byId(context.__foods, id);
    assert.equal(context.__foodSearchMatches(food, query), true, `${id}:${query}`);
    assert.equal(context.__foodByName(query, context.__foods)?.id, id, `${id}:foodByName:${query}`);
  }
  assert.ok(aliasTerms(byId(context.__foods, 'aubergine')).includes('Talong'));
});

test('Alias-Migration kanonisiert einzelne Aliasbegriffe migrationssicher ohne Dubletten', () => {
  const context = loadRuntime();
  const expected = {
    Melanzani: 'aubergine', Pasta: 'nudeln-pasta', 'Grüne Linse': 'braune-gruene-linse',
    'Cottage Cheese': 'huettenkaese', Holunder: 'holunder', Feuerbohne: 'kaeferbohne',
  };
  for (const [name, id] of Object.entries(expected)) assert.equal(context.__canonicalId(`custom-${id}`, name), id, name);

  const saved = Object.entries(expected).map(([name, id]) => ({ id: `custom-${id}`, name, category: 'Sonstiges', manualStatus: 'Probiert', notes: `alt:${name}` }));
  const merged = json(context.__mergeFoods(saved));
  for (const id of Object.values(expected)) {
    assert.equal(merged.filter((food) => food.id === id).length, 1, id);
    assert.equal(merged.some((food) => food.id === `custom-${id}`), false, `custom removed:${id}`);
    assert.equal(byId(merged, id).manualStatus, 'Probiert', `status:${id}`);
  }
});

test('FOOD-01 Nektarine durchläuft Übersicht/Suche, Protokoll, Vorrat, Planner und Persistenz', () => {
  const context = loadRuntime({ model: true, planning: true });
  const nektarine = byId(context.__foods, 'nektarine');
  assert.ok(nektarine && nektarine.active, 'Übersichtsstamm enthält aktive Nektarine');
  assert.equal(context.__foodSearchMatches(nektarine, 'Nektarine'), true, 'Suche');

  setMinimalState(context, {
    logs: [{ id:'log-n', date:'2026-08-17', createdAt:'2026-08-17T12:00:00Z', meal:'lunch', foodIds:['nektarine'], foodOutcomes:{ nektarine:'eaten' } }],
    inventory: [{ id:'inv-n', kind:'food', foodId:'nektarine', portions:2, frozenDate:'2026-08-16' }],
  });
  assert.equal(json(context.__logsFor('nektarine')).length, 1, 'Protokoll');
  assert.equal(context.__inventoryName({ kind:'food', foodId:'nektarine' }), 'Nektarine', 'Vorrat-Anzeigename');
  assert.equal(context.__oldestFoodBatch('nektarine')?.id, 'inv-n', 'Vorrat-Batch');
  assert.equal(context.__eligibleCore(nektarine, 'lunch', '2026-08-18'), true, 'Planner meal eligibility');
  assert.equal(automaticFoodEligibility(nektarine, '2026-08-18', { phaseSelected:'kennenlernen', birthDate:'2026-01-24' }), true, 'Auto-Eignung');

  const merged = json(context.__mergeFoods([{ ...json(nektarine), manualStatus:'Probiert', notes:'persistiert' }]));
  assert.equal(merged.filter((food) => food.id === 'nektarine').length, 1, 'Persistenz-ID');
  assert.equal(byId(merged, 'nektarine').manualStatus, 'Probiert');
});

test('Rezeptauflösung verwendet Alternativnamen als Alias statt Anzeigenamen zu koppeln', () => {
  const context = loadRuntime({ model: true, planning: true });
  setMinimalState(context);
  assert.deepEqual(json(context.__recipeFoodIds({ requires:['Pasta'] })), ['nudeln-pasta']);
  assert.deepEqual(json(context.__recipeFoodIds({ requires:['Nudeln/Pasta'] })), ['nudeln-pasta']);
  assert.deepEqual(json(context.__recipeFoodIds({ requires:['Cottage Cheese'] })), ['huettenkaese']);
  assert.deepEqual(json(context.__recipeFoodIds({ requires:['Grüne Linse'] })), ['braune-gruene-linse']);
});

test('Nektarine und alle 34 neuen Foods sind zentral auf eigene vorhandene Food-V2-Assets gemappt', () => {
  const iconSource = source('js/icons.js');
  const stateSource = source('js/state.js');
  assert.doesNotMatch(stateSource, /FOOD_INTAKE_ICON_PATHS/);
  for (const id of NEW_IDS) {
    const asset = `assets/illustrations-v2/foods/${id}.svg`;
    assert.match(iconSource, new RegExp(`"${id}"\\s*:\\s*"${asset.replaceAll('/', '\\/')}"`), `${id}:central mapping`);
    assert.ok(fs.existsSync(path.join(ROOT, asset)), `${id}:asset`);
    assert.match(source(asset), /^<svg\b/, `${id}:svg`);
    assert.match(source(asset), /data:image\/png;base64,iVBOR/, `${id}:embedded Food-V2 raster`);
  }
  assert.notEqual(source('assets/illustrations-v2/foods/nektarine.svg'), source('assets/illustrations-v2/foods/pfirsich.svg'));
});

test('Service Worker precacht alle neuen Food-V2-Assets und verwendet die aktuelle Cache-Version', () => {
  const sw = `${source('sw.js')}\n${source('sw-core.js')}`;
  const cacheVersion = JSON.parse(source('VERSION.json')).version.replaceAll('.', '-');
  assert.match(sw, new RegExp(`chester-beikost-v${cacheVersion}`));
  for (const id of NEW_IDS) assert.ok(sw.includes(`./assets/illustrations-v2/foods/${id}.svg`), id);
});

test('aktuelle App-Version ist in Runtime, Paket, Metadaten und Asset-Querystrings konsistent', () => {
  const context = loadRuntime({ policy: false });
  const metadataVersion = JSON.parse(source('VERSION.json')).version;
  const packageVersion = JSON.parse(source('package.json')).version;
  const escapedVersion = metadataVersion.replaceAll('.', '\\.');
  const index = source('index.html');
  assert.equal(packageVersion, metadataVersion);
  assert.equal(context.__version, metadataVersion);
  assert.match(index, new RegExp(`app\\.js\\?v=${escapedVersion}`));
  assert.match(index, new RegExp(`data\\/foods\\.js\\?v=${escapedVersion}`));
});

test('Holunderbeere trägt weiterhin den freigegebenen Sicherheitshinweis', () => {
  const holunder = byId(loadRuntime({ policy: false }).__foods, 'holunder');
  assert.equal(holunder.name, 'Holunderbeere');
  assert.ok(aliasTerms(holunder).includes('Holunder'));
  assert.match(holunder.safeForm, /Nicht roh/i);
  assert.match(holunder.safeForm, /vollständig erhitzen/i);
  assert.match(holunder.notes, /Nicht roh/i);
});

test('bestehende manuelle Fisch-Sperren und kompakter UI-Status bleiben unverändert', () => {
  const foods = json(loadRuntime().__foods);
  for (const id of ['schwertfisch','heilbutt','hecht','koenigsmakrele','buttermakrele','schlangenmakrele']) {
    const food = byId(foods, id);
    assert.equal(food.autoPlan, false, id);
    assert.equal(automaticEligibilityStatus(food, {}), 'Nicht für Beikost empfohlen', id);
  }
  for (const id of ['forelle','saibling','hering','karpfen','atlantische-makrele']) assert.notEqual(byId(foods, id).autoPlan, false, id);
});


test('Hüttenkäse verwendet das freigegebene eigene Food-V2-Asset', () => {
  const asset = 'assets/illustrations-v2/foods/huettenkaese.svg';
  assert.ok(fs.existsSync(path.join(ROOT, asset)), 'Hüttenkäse-Asset vorhanden');
  assert.match(source(asset), /data:image\/png;base64,iVBOR/, 'Food-V2-Raster eingebettet');
  assert.match(source('js/icons.js'), /"huettenkaese"\s*:\s*"assets\/illustrations-v2\/foods\/huettenkaese\.svg"/, 'zentrale Zuordnung');
  assert.match(source('js/icons.js'), /ILLUSTRATION_ASSET_REVISION = "10\.1\.25"/, 'Asset-Revision');
  assert.ok(`${source('sw.js')}\n${source('sw-core.js')}`.includes('./assets/illustrations-v2/foods/huettenkaese.svg'), 'Offline-Precache');
});