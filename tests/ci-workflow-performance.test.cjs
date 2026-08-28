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

test('all setup-node steps use the npm cache', () => {
  const appSetupCount = occurrences(appWorkflow, 'uses: actions/setup-node@v4');
  const appCacheCount = occurrences(appWorkflow, "cache: 'npm'");
  const deploySetupCount = occurrences(deployWorkflow, 'uses: actions/setup-node@v4');
  const deployCacheCount = occurrences(deployWorkflow, "cache: 'npm'");

  assert.equal(appSetupCount, 2);
  assert.equal(appCacheCount, appSetupCount);
  assert.equal(deploySetupCount, 1);
  assert.equal(deployCacheCount, deploySetupCount);
  assert.equal(occurrences(appWorkflow, 'cache-dependency-path: package-lock.json'), appSetupCount);
  assert.equal(occurrences(deployWorkflow, 'cache-dependency-path: package-lock.json'), deploySetupCount);
});

test('green app runs do not upload plan-check screenshots', () => {
  assert.match(
    appWorkflow,
    /- name: Upload plan checks UX screenshots\n        if: \$\{\{ failure\(\) \}\}/,
  );
});
