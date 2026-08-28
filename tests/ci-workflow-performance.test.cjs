const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const appWorkflow = fs.readFileSync(path.join(root, '.github/workflows/app-tests.yml'), 'utf8');
const deployWorkflow = fs.readFileSync(path.join(root, '.github/workflows/wrangler-check.yml'), 'utf8');

function occurrences(text, needle) {
  return text.split(needle).length - 1;
}

test('CI cancels superseded runs per workflow and PR/branch', () => {
  for (const [name, workflow] of [
    ['app', appWorkflow],
    ['deploy', deployWorkflow],
  ]) {
    assert.match(
      workflow,
      /concurrency:\n  group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\n  cancel-in-progress: true/,
      `${name} workflow must cancel superseded runs`,
    );
  }
});

test('all dependency-installing setup-node steps use the npm cache', () => {
  const appSetupCount = occurrences(appWorkflow, 'uses: actions/setup-node@v4');
  const appCacheCount = occurrences(appWorkflow, "cache: 'npm'");
  const deploySetupCount = occurrences(deployWorkflow, 'uses: actions/setup-node@v4');
  const deployCacheCount = occurrences(deployWorkflow, "cache: 'npm'");

  assert.equal(appSetupCount, 3);
  assert.equal(appCacheCount, appSetupCount);
  assert.equal(deploySetupCount, 1);
  assert.equal(deployCacheCount, deploySetupCount);
  assert.equal(occurrences(appWorkflow, 'cache-dependency-path: package-lock.json'), appSetupCount);
  assert.equal(occurrences(deployWorkflow, 'cache-dependency-path: package-lock.json'), deploySetupCount);
});

test('app workflow classifies scope before choosing the gate', () => {
  assert.ok(appWorkflow.includes('scope:\n'));
  assert.ok(appWorkflow.includes('browser_required: ${{ steps.classify.outputs.browser_required }}'));
  assert.ok(appWorkflow.includes('node scripts/ci-app-scope.mjs'));
  assert.ok(
    appWorkflow.includes("test-fast:\n    needs: scope\n    if: ${{ needs.scope.outputs.browser_required == 'false' }}"),
  );
  assert.ok(appWorkflow.includes('run: npm run verify:fast'));
  assert.ok(
    appWorkflow.includes("test:\n    needs: scope\n    if: ${{ needs.scope.outputs.browser_required == 'true' }}"),
  );
  assert.ok(appWorkflow.includes('image: mcr.microsoft.com/playwright:v1.62.1-noble'));
  assert.ok(appWorkflow.includes('run: npm run verify:app'));
});

test('green app runs do not upload plan-check screenshots', () => {
  assert.match(
    appWorkflow,
    /- name: Upload plan checks UX screenshots\n        if: \$\{\{ failure\(\) \}\}/,
  );
});
