const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('test manifest keeps unit and integration groups complete', async () => {
  const manifest = await import(path.join(root, 'scripts/test-manifest.mjs'));
  const unit = new Set(manifest.listNodeTests('unit'));
  const integration = new Set(manifest.listNodeTests('integration'));
  const fast = new Set(manifest.listNodeTests('fast'));

  assert.equal(new Set([...unit, ...integration]).size, fast.size);
  assert.deepEqual([...unit].filter((file) => integration.has(file)), []);
});

test('unknown changed paths fail closed to the full relevant test set', async () => {
  const manifest = await import(path.join(root, 'scripts/test-manifest.mjs'));
  const result = manifest.selectRelevantTests(['new-runtime-area/module.js']);

  assert.equal(result.full, true);
  assert.equal(result.node.length, manifest.listNodeTests('fast').length);
  assert.equal(result.browser.length, manifest.TEST_GROUPS.browser().length);
});

test('known planner changes select planner tests without changing the full fallback', async () => {
  const manifest = await import(path.join(root, 'scripts/test-manifest.mjs'));
  const result = manifest.selectRelevantTests(['js/planner-random-swap.js']);

  assert.equal(result.full, false);
  assert.ok(result.areas.includes('planner'));
  assert.ok(result.node.some((file) => file.endsWith('planner-random-swap.test.cjs')));
  assert.ok(result.browser.some((file) => file.endsWith('planner-random-swap-webkit.test.mjs')));
  assert.ok(result.node.length < manifest.listNodeTests('fast').length);
});

test('standard browser gate and performance gate are complete and disjoint', async () => {
  const manifest = await import(path.join(root, 'scripts/test-manifest.mjs'));
  const all = new Set(manifest.TEST_GROUPS.browser());
  const standard = new Set(manifest.TEST_GROUPS.browserStandard());
  const performance = new Set(manifest.TEST_GROUPS.browserPerformance());

  assert.equal(new Set([...standard, ...performance]).size, all.size);
  assert.deepEqual([...standard].filter((file) => performance.has(file)), []);
  assert.deepEqual(
    [...performance].map((file) => path.basename(file)).sort(),
    [
      'app-resume-lifecycle-webkit.test.mjs',
      'save-ui-latency-webkit.test.mjs',
      'targeted-action-rendering-webkit.test.mjs',
    ],
  );
});

test('food data changes include custom-meal tests that load the shared FOOD_DB', async () => {
  const manifest = await import(path.join(root, 'scripts/test-manifest.mjs'));
  const result = manifest.selectRelevantTests(['data/foods.js']);

  assert.equal(result.full, false);
  assert.ok(result.areas.includes('food'));
  assert.ok(result.node.some((file) => file.endsWith('plan-07-custom-meals.test.js')));
});
