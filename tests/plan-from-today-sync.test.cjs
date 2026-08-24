const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const storage = fs.readFileSync(path.join(root, 'js/storage.js'), 'utf8');
const helperBlock = storage.match(
  /\/\* PLAN-FROM-TODAY START \*\/([\s\S]*?)\/\* PLAN-FROM-TODAY END \*\//,
);

assert.ok(helperBlock, 'Plan-ab-Heute-Helferblock muss vorhanden sein');

function loadHelpers(overrides = {}) {
  const context = {
    state: { settings: { planFrom: '' } },
    today: () => '2026-08-24',
    save: async () => {},
    renderAll: () => {},
    ...overrides,
  };
  vm.runInNewContext(
    `${helperBlock[1]}; this.api = { syncPlanFromToToday, syncPlanFromOnAppOpen };`,
    context,
  );
  return { context, ...context.api };
}

test('vergangenes Plan-ab-Datum wird beim Öffnen auf heute nachgezogen', () => {
  const { syncPlanFromToToday } = loadHelpers();
  const data = { settings: { planFrom: '2026-08-22' } };

  assert.equal(syncPlanFromToToday(data, '2026-08-24'), true);
  assert.equal(data.settings.planFrom, '2026-08-24');
});

test('leeres oder ungültiges Plan-ab-Datum wird auf heute gesetzt', () => {
  const { syncPlanFromToToday } = loadHelpers();
  const empty = { settings: { planFrom: '' } };
  const invalid = { settings: { planFrom: 'kein-datum' } };

  assert.equal(syncPlanFromToToday(empty, '2026-08-24'), true);
  assert.equal(empty.settings.planFrom, '2026-08-24');
  assert.equal(syncPlanFromToToday(invalid, '2026-08-24'), true);
  assert.equal(invalid.settings.planFrom, '2026-08-24');
});

test('heutiges und bewusst zukünftiges Plan-ab-Datum bleiben erhalten', () => {
  const { syncPlanFromToToday } = loadHelpers();
  const current = { settings: { planFrom: '2026-08-24' } };
  const future = { settings: { planFrom: '2026-08-27' } };

  assert.equal(syncPlanFromToToday(current, '2026-08-24'), false);
  assert.equal(current.settings.planFrom, '2026-08-24');
  assert.equal(syncPlanFromToToday(future, '2026-08-24'), false);
  assert.equal(future.settings.planFrom, '2026-08-27');
});

test('erneutes Öffnen speichert und rendert nur wenn das Datum nachgezogen wurde', async () => {
  let saves = 0;
  let renders = 0;
  const { context, syncPlanFromOnAppOpen } = loadHelpers({
    state: { settings: { planFrom: '2026-08-22' } },
    save: async () => { saves += 1; },
    renderAll: () => { renders += 1; },
  });

  assert.equal(await syncPlanFromOnAppOpen(), true);
  assert.equal(context.state.settings.planFrom, '2026-08-24');
  assert.equal(saves, 1);
  assert.equal(renders, 1);

  assert.equal(await syncPlanFromOnAppOpen(), false);
  assert.equal(saves, 1);
  assert.equal(renders, 1);
});

test('Bootstrap und Rückkehr in die sichtbare App prüfen Plan ab erneut', () => {
  assert.match(
    storage,
    /async function bootstrapStorage\(\)[\s\S]*?syncPlanFromToToday\(\);[\s\S]*?await save\(\);/,
  );
  assert.match(
    storage,
    /document\.addEventListener\("visibilitychange",[\s\S]*?document\.visibilityState === "visible"[\s\S]*?syncPlanFromOnAppOpen\(\)/,
  );
});
