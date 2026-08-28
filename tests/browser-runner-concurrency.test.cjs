const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const runnerModule = import(
  pathToFileURL(path.resolve(__dirname, '../scripts/run-browser-tests.mjs')).href
);
const sharedRuntimeModule = import(
  pathToFileURL(path.resolve(__dirname, '../scripts/browser-test-shared-runtime.mjs')).href
);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createFakeSharedRuntimeFactory(events = []) {
  return async () => {
    events.push('start');
    return {
      wsEndpoint: 'ws://shared-webkit.test/runtime',
      close: async () => events.push('close'),
    };
  };
}

test('browser runner defaults to concurrency two and accepts a serial override', async () => {
  const { DEFAULT_BROWSER_TEST_CONCURRENCY, resolveBrowserTestConcurrency } = await runnerModule;

  assert.equal(DEFAULT_BROWSER_TEST_CONCURRENCY, 2);
  assert.equal(resolveBrowserTestConcurrency(undefined), 2);
  assert.equal(resolveBrowserTestConcurrency('1'), 1);
  assert.equal(resolveBrowserTestConcurrency('3'), 3);
  assert.equal(resolveBrowserTestConcurrency('0'), 2);
  assert.equal(resolveBrowserTestConcurrency('invalid'), 2);
});

test('browser runner splits ordered tests deterministically across shards', async () => {
  const { resolveBrowserTestShard, selectBrowserTestShard } = await runnerModule;
  const files = ['a.mjs', 'b.mjs', 'c.mjs', 'd.mjs', 'e.mjs'];

  assert.equal(resolveBrowserTestShard(undefined), null);
  assert.deepEqual(resolveBrowserTestShard('1/2'), { index: 1, total: 2 });
  assert.deepEqual(resolveBrowserTestShard('2/2'), { index: 2, total: 2 });
  assert.deepEqual(selectBrowserTestShard(files, null), files);
  assert.deepEqual(selectBrowserTestShard(files, { index: 1, total: 2 }), ['a.mjs', 'c.mjs', 'e.mjs']);
  assert.deepEqual(selectBrowserTestShard(files, { index: 2, total: 2 }), ['b.mjs', 'd.mjs']);
  assert.throws(() => resolveBrowserTestShard('0/2'), /Invalid BROWSER_TEST_SHARD/);
  assert.throws(() => resolveBrowserTestShard('3/2'), /Invalid BROWSER_TEST_SHARD/);
  assert.throws(() => resolveBrowserTestShard('broken'), /Invalid BROWSER_TEST_SHARD/);
});

test('bounded worker pool never exceeds the configured concurrency and preserves result order', async () => {
  const { runWithConcurrency } = await runnerModule;
  let active = 0;
  let maxActive = 0;

  const results = await runWithConcurrency([30, 5, 20, 10], async (duration, index) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await delay(duration);
    active -= 1;
    return `result-${index}`;
  }, 2);

  assert.equal(maxActive, 2);
  assert.deepEqual(results, ['result-0', 'result-1', 'result-2', 'result-3']);
});

test('shared browser facade closes only contexts owned by one child connection', async () => {
  const { createSharedBrowserFacade } = await sharedRuntimeModule;
  let underlyingBrowserCloseCalls = 0;
  let contextCloseCalls = 0;
  const fakeBrowser = {
    async newContext() {
      return {
        async close() {
          contextCloseCalls += 1;
        },
      };
    },
    async close() {
      underlyingBrowserCloseCalls += 1;
    },
    marker() {
      return 'bound';
    },
  };

  const browser = createSharedBrowserFacade(fakeBrowser);
  await browser.newContext();
  assert.equal(browser.marker(), 'bound');
  await browser.close();

  assert.equal(contextCloseCalls, 1);
  assert.equal(underlyingBrowserCloseCalls, 0, 'ein Kindprozess darf den gemeinsamen WebKit-Prozess nicht schließen');
});

test('shared WebKit client reuses the endpoint only for default launches', async () => {
  const { installSharedWebKitClient } = await sharedRuntimeModule;
  let launchCalls = 0;
  let connectCalls = 0;
  const connectedBrowser = {
    async newContext() {
      return { close: async () => {} };
    },
    async close() {
      throw new Error('shared browser close must be intercepted');
    },
  };
  const dedicatedBrowser = { dedicated: true };
  const browserType = {
    async launch(options) {
      launchCalls += 1;
      assert.deepEqual(options, { headless: false });
      return dedicatedBrowser;
    },
    async connect(endpoint) {
      connectCalls += 1;
      assert.equal(endpoint, 'ws://shared-webkit.test/runtime');
      return connectedBrowser;
    },
  };

  assert.equal(installSharedWebKitClient(browserType, 'ws://shared-webkit.test/runtime'), true);
  const sharedBrowser = await browserType.launch();
  await sharedBrowser.newContext();
  await sharedBrowser.close();
  assert.equal(connectCalls, 1);
  assert.equal(launchCalls, 0);

  const dedicated = await browserType.launch({ headless: false });
  assert.equal(dedicated, dedicatedBrowser);
  assert.equal(launchCalls, 1, 'Sonderoptionen müssen weiterhin einen dedizierten Browser starten');
});

test('runBrowserTests writes deterministic summaries while two fake regressions run in parallel', async () => {
  const { runBrowserTests } = await runnerModule;
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beikost-browser-runner-'));
  const artifactDir = path.join(rootDir, 'artifacts', 'browser-tests');
  const testFiles = [
    'browser-tests/a-webkit.test.mjs',
    'browser-tests/b-webkit.test.mjs',
    'browser-tests/c-webkit.test.mjs',
  ];
  let active = 0;
  let maxActive = 0;
  const runtimeEvents = [];
  const endpoints = [];

  try {
    const summary = await runBrowserTests({
      rootDir,
      artifactDir,
      testFiles,
      childEnv: {},
      forwardOutput: false,
      concurrency: 2,
      sharedRuntimeFactory: createFakeSharedRuntimeFactory(runtimeEvents),
      runTest: async (testFile, options) => {
        const name = path.basename(testFile);
        endpoints.push(options.childEnv.BROWSER_TEST_SHARED_WS_ENDPOINT);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await delay(name.startsWith('a-') ? 30 : 5);
        active -= 1;
        return {
          test: name,
          status: 'passed',
          exitCode: 0,
          signal: null,
          durationMs: 1,
          log: `artifacts/browser-tests/${name}/output.log`,
        };
      },
    });

    assert.equal(maxActive, 2);
    assert.equal(summary.failed, 0);
    assert.deepEqual(summary.results.map((entry) => entry.test), [
      'a-webkit.test.mjs',
      'b-webkit.test.mjs',
      'c-webkit.test.mjs',
    ]);
    assert.deepEqual(runtimeEvents, ['start', 'close'], 'gemeinsame Runtime muss genau einmal pro Runner-Lauf leben');
    assert.deepEqual(new Set(endpoints), new Set(['ws://shared-webkit.test/runtime']));
    assert.equal(fs.existsSync(path.join(artifactDir, 'summary.json')), true);
    assert.equal(fs.existsSync(path.join(artifactDir, 'summary.md')), true);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('runBrowserTests executes only the selected shard', async () => {
  const { runBrowserTests } = await runnerModule;
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beikost-browser-shard-'));
  const artifactDir = path.join(rootDir, 'artifacts', 'browser-tests');
  const testFiles = [
    'browser-tests/a-webkit.test.mjs',
    'browser-tests/b-webkit.test.mjs',
    'browser-tests/c-webkit.test.mjs',
    'browser-tests/d-webkit.test.mjs',
  ];
  const executed = [];

  try {
    const summary = await runBrowserTests({
      rootDir,
      artifactDir,
      testFiles,
      childEnv: {},
      forwardOutput: false,
      concurrency: 2,
      shard: { index: 2, total: 2 },
      sharedRuntimeFactory: createFakeSharedRuntimeFactory(),
      runTest: async (testFile) => {
        const name = path.basename(testFile);
        executed.push(name);
        return {
          test: name,
          status: 'passed',
          exitCode: 0,
          signal: null,
          durationMs: 1,
          log: `artifacts/browser-tests/${name}/output.log`,
        };
      },
    });

    assert.deepEqual(executed.sort(), ['b-webkit.test.mjs', 'd-webkit.test.mjs']);
    assert.deepEqual(summary.results.map((entry) => entry.test), [
      'b-webkit.test.mjs',
      'd-webkit.test.mjs',
    ]);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
