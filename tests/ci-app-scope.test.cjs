const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const scopeModule = import(
  pathToFileURL(path.resolve(__dirname, '../scripts/ci-app-scope.mjs')).href
);

test('pure data, planner, persistence, utility and node-test changes stay on fast gate', async () => {
  const { classifyAppScope } = await scopeModule;

  assert.equal(classifyAppScope(['data/food-handling.js']), 'fast');
  assert.equal(
    classifyAppScope([
      'js/planner-random-swap.js',
      'tests/planner-random-swap.test.cjs',
    ]),
    'fast',
  );
  assert.equal(
    classifyAppScope(['js/model.js', 'js/storage.js', 'js/utils.js']),
    'fast',
  );
  assert.equal(
    classifyAppScope([
      'docs/AI_WORKFLOW.md',
      'js/planner-meal-eligibility.js',
      'tests/planner-meal-eligibility.test.cjs',
    ]),
    'fast',
  );
});

test('UI, browser, workflow, package and mixed runtime changes keep full app gate', async () => {
  const { classifyAppScope } = await scopeModule;

  for (const file of [
    'index.html',
    'app.js',
    'js/ui.js',
    'js/planning.js',
    'browser-tests/plan-checks-ux-webkit.test.mjs',
    'scripts/run-browser-tests.mjs',
    'package.json',
    'package-lock.json',
    '.github/workflows/app-tests.yml',
  ]) {
    assert.equal(classifyAppScope([file]), 'app', `${file} must keep browser coverage`);
  }

  assert.equal(
    classifyAppScope(['js/planner-random-swap.js', 'js/ui.js']),
    'app',
  );
});

test('classifier fails closed for new planner-like files and empty input', async () => {
  const { classifyAppScope, browserRequiredForFiles } = await scopeModule;

  assert.equal(classifyAppScope(['js/planner-new-ui.js']), 'app');
  assert.equal(classifyAppScope([]), 'app');
  assert.equal(browserRequiredForFiles([]), true);
});
