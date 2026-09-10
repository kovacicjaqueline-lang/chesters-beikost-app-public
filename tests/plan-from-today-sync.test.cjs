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
    `${helperBlock[1]}; this.api = { isIsoCalendarDate, syncPlanFromToToday, syncPlanFromOnAppOpen, installPlanFromVisibilitySync };`,
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

test('leeres, formal ungültiges oder unmögliches Plan-ab-Datum wird auf heute gesetzt', () => {
  const { syncPlanFromToToday } = loadHelpers();
  const cases = ['', 'kein-datum', '2026-13-40', '2026-02-29', '2026-04-31'];

  for (const planFrom of cases) {
    const data = { settings: { planFrom } };
    assert.equal(syncPlanFromToToday(data, '2026-08-24'), true, planFrom || 'leer');
    assert.equal(data.settings.planFrom, '2026-08-24');
  }
});

test('Kalenderprüfung akzeptiert echte Schaltjahre und lehnt ungültigen heutigen Wert ab', () => {
  const { isIsoCalendarDate, syncPlanFromToToday } = loadHelpers();
  const data = { settings: { planFrom: '2026-08-22' } };

  assert.equal(isIsoCalendarDate('2028-02-29'), true);
  assert.equal(isIsoCalendarDate('2100-02-29'), false);
  assert.equal(isIsoCalendarDate('2000-02-29'), true);
  assert.equal(syncPlanFromToToday(data, '2026-02-30'), false);
  assert.equal(data.settings.planFrom, '2026-08-22');
});

test('heutiges und bewusst zukünftiges Plan-ab-Datum bleiben erhalten', () => {
  const { syncPlanFromToToday } = loadHelpers();
  const current = { settings: { planFrom: '2026-08-24' } };
  const future = { settings: { planFrom: '2026-08-27' } };
  const leapFuture = { settings: { planFrom: '2028-02-29' } };

  assert.equal(syncPlanFromToToday(current, '2026-08-24'), false);
  assert.equal(current.settings.planFrom, '2026-08-24');
  assert.equal(syncPlanFromToToday(future, '2026-08-24'), false);
  assert.equal(future.settings.planFrom, '2026-08-27');
  assert.equal(syncPlanFromToToday(leapFuture, '2026-08-24'), false);
  assert.equal(leapFuture.settings.planFrom, '2028-02-29');
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

test('visibilitychange synchronisiert erst beim tatsächlichen Sichtbarwerden', async () => {
  let saves = 0;
  let renders = 0;
  const listeners = new Map();
  const fakeDocument = {
    visibilityState: 'hidden',
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    dispatchEvent(event) {
      const handler = listeners.get(event.type);
      if (handler) handler(event);
    },
  };
  const { context, installPlanFromVisibilitySync } = loadHelpers({
    state: { settings: { planFrom: '2026-08-22' } },
    save: async () => { saves += 1; },
    renderAll: () => { renders += 1; },
  });

  assert.equal(installPlanFromVisibilitySync(fakeDocument), true);
  assert.equal(typeof listeners.get('visibilitychange'), 'function');

  fakeDocument.dispatchEvent({ type: 'visibilitychange' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(context.state.settings.planFrom, '2026-08-22');
  assert.equal(saves, 0);
  assert.equal(renders, 0);

  fakeDocument.visibilityState = 'visible';
  fakeDocument.dispatchEvent({ type: 'visibilitychange' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(context.state.settings.planFrom, '2026-08-24');
  assert.equal(saves, 1);
  assert.equal(renders, 1);
});

test('Bootstrap und Browser-Boot installieren die Plan-ab-Prüfung', () => {
  assert.match(
    storage,
    /async function bootstrapStorage\(\)[\s\S]*?syncPlanFromToToday\(\);[\s\S]*?await save\(\);/,
  );
  assert.match(
    storage,
    /if \(typeof document !== "undefined"\) installPlanFromVisibilitySync\(document\);/,
  );
});
