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

  assert.equal(appSetupCount, 4);
  assert.equal(appCacheCount, appSetupCount);
  assert.equal(deploySetupCount, 1);
  assert.equal(deployCacheCount, deploySetupCount);
  assert.equal(occurrences(appWorkflow, 'cache-dependency-path: package-lock.json'), appSetupCount);
  assert.equal(occurrences(deployWorkflow, 'cache-dependency-path: package-lock.json'), deploySetupCount);
});

test('app workflow trigger lets unknown app paths reach the fail-closed classifier', () => {
  assert.equal(occurrences(appWorkflow, '    paths:\n'), 0);
  assert.equal(occurrences(appWorkflow, '    paths-ignore:\n'), 2);

  for (const ignoredPath of [
    'docs/**',
    'README*',
    'AGENTS.md',
    'VERSION.json',
    'wrangler.jsonc',
    'js/wrangler.jsonc',
    '.gitignore',
  ]) {
    assert.equal(
      occurrences(appWorkflow, `      - '${ignoredPath}'`),
      2,
      `${ignoredPath} must stay neutral for push and pull_request triggers`,
    );
  }

  assert.equal(appWorkflow.includes("      - 'playwright.config.mjs'"), false);
});

test('app workflow classifies scope before choosing the gate', () => {
  assert.ok(appWorkflow.includes('scope:\n'));
  assert.ok(appWorkflow.includes('browser_required: ${{ steps.classify.outputs.browser_required }}'));
  assert.ok(appWorkflow.includes('node scripts/ci-app-scope.mjs'));
  assert.ok(
    appWorkflow.includes("test-fast:\n    needs: scope\n    if: ${{ needs.scope.outputs.browser_required == 'false' }}"),
  );
  assert.ok(
    appWorkflow.includes("test:\n    needs: scope\n    if: ${{ needs.scope.outputs.browser_required == 'true' }}"),
  );
  assert.ok(appWorkflow.includes('image: mcr.microsoft.com/playwright:v1.62.1-noble'));
  assert.equal(
    occurrences(appWorkflow, 'npm run verify:fast 2>&1 | tee artifacts/ci-logs/test-output.log'),
    2,
  );
  assert.equal(
    occurrences(appWorkflow, 'npm run test:browser:standard 2>&1 | tee -a artifacts/ci-logs/test-output.log'),
    1,
  );
  assert.equal(occurrences(appWorkflow, 'run: npm run verify:app'), 0);
});

test('full app workflow runs the fast gate in exactly one browser shard', () => {
  assert.match(
    appWorkflow,
    /strategy:\n      fail-fast: false\n      matrix:\n        include:\n          - shard: 1\n            run_fast: false\n          - shard: 2\n            run_fast: true/,
  );
  assert.equal(occurrences(appWorkflow, 'run_fast: true'), 1);
  assert.equal(occurrences(appWorkflow, 'run_fast: false'), 1);
  assert.ok(appWorkflow.includes('BROWSER_TEST_SHARD: ${{ matrix.shard }}/2'));
  assert.ok(
    appWorkflow.includes('- name: Run fast verification gate\n        if: ${{ matrix.run_fast }}\n        shell: bash\n        run: |\n          mkdir -p artifacts/ci-logs\n          set -o pipefail\n          npm run verify:fast 2>&1 | tee artifacts/ci-logs/test-output.log'),
  );
  assert.ok(
    appWorkflow.includes('- name: Run browser regression shard\n        if: ${{ !cancelled() }}\n        shell: bash\n        run: |\n          mkdir -p artifacts/ci-logs\n          set -o pipefail\n          npm run test:browser:standard 2>&1 | tee -a artifacts/ci-logs/test-output.log'),
  );
  assert.ok(appWorkflow.includes('browser-regression-diagnostics-${{ github.run_id }}-shard-${{ matrix.shard }}'));
  assert.ok(appWorkflow.includes('browser-performance:'));
  assert.ok(
    appWorkflow.includes('npm run test:browser:performance 2>&1 | tee artifacts/ci-logs/test-output.log'),
  );
  assert.ok(appWorkflow.includes('browser-performance-diagnostics-${{ github.run_id }}'));
  assert.ok(appWorkflow.includes('plan-checks-ux-screenshots-${{ github.run_id }}-shard-${{ matrix.shard }}'));
});

test('test jobs always preserve command output as downloadable artifacts', () => {
  assert.equal(occurrences(appWorkflow, 'set -o pipefail'), 5);
  assert.equal(occurrences(appWorkflow, 'shell: bash'), 6);
  assert.equal(occurrences(appWorkflow, 'path: artifacts/ci-logs/test-output.log'), 4);
  assert.equal(
    occurrences(appWorkflow, '- name: Upload test output\n        if: ${{ always() }}\n        uses: actions/upload-artifact@v4'),
    4,
  );

  for (const artifactName of [
    'test-output-${{ github.run_id }}-icons',
    'test-output-${{ github.run_id }}-fast',
    'test-output-${{ github.run_id }}-shard-${{ matrix.shard }}',
    'test-output-${{ github.run_id }}-performance',
  ]) {
    assert.ok(appWorkflow.includes(`name: ${artifactName}`));
  }

  assert.equal(occurrences(appWorkflow, 'if-no-files-found: warn'), 4);
});

test('green app runs do not upload plan-check screenshots', () => {
  assert.match(
    appWorkflow,
    /- name: Upload plan checks UX screenshots\n        if: \$\{\{ failure\(\) \}\}/,
  );
});

test('browser CI captures downloadable mobile screenshots on shard 1', () => {
  assert.ok(
    appWorkflow.includes('- name: Capture mobile CI screenshots\n        if: ${{ !cancelled() && matrix.shard == 1 }}\n        run: node browser-tests/ci-mobile-snapshots.mjs'),
  );
  assert.ok(
    appWorkflow.includes('- name: Upload mobile CI screenshots\n        if: ${{ !cancelled() && matrix.shard == 1 }}\n        uses: actions/upload-artifact@v4'),
  );
  assert.ok(appWorkflow.includes('name: mobile-ui-screenshots-${{ github.run_id }}'));
  assert.ok(appWorkflow.includes('path: artifacts/ci-mobile-screenshots/'));
  assert.ok(appWorkflow.includes('if-no-files-found: error'));
});
