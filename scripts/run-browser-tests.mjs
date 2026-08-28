import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharedRuntime from "./browser-test-shared-runtime.cjs";

const { startSharedWebKitServer } = sharedRuntime;
const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), "..");
const browserTestPreloadPath = path.resolve(path.dirname(scriptPath), "browser-test-preload.cjs");

export const DEFAULT_BROWSER_TEST_CONCURRENCY = 2;

const preferredOrder = [
  "meal-editor-recipe-variants-webkit.test.mjs",
  "ui-meal-editor-webkit.test.mjs",
  "ui-meal-editor-sticky-footer-webkit.test.mjs",
  "flow-c-dialogs-webkit.test.mjs",
  "planned-recipe-details-webkit.test.mjs",
  "meal-card-unification-webkit.test.mjs",
  "completed-day-presentation-webkit.test.mjs",
  "ui-settings-tab-state-webkit.test.mjs",
  "icon-render-sizes-webkit.test.mjs",
  "bottom-navigation-anchor-webkit.test.mjs",
  "unified-food-log-webkit.test.mjs",
  "planner-random-swap-webkit.test.mjs",
];

export function discoverBrowserTests(rootDir = defaultRoot) {
  const browserTestDir = path.join(rootDir, "browser-tests");
  const discovered = fs.readdirSync(browserTestDir)
    .filter((name) => name.endsWith("-webkit.test.mjs"))
    .sort();
  const discoveredSet = new Set(discovered);
  const ordered = preferredOrder.filter((name) => discoveredSet.has(name));
  const orderedSet = new Set(ordered);
  return [...ordered, ...discovered.filter((name) => !orderedSet.has(name))]
    .map((name) => path.join(browserTestDir, name));
}

export function resolveBrowserTestConcurrency(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_BROWSER_TEST_CONCURRENCY;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_BROWSER_TEST_CONCURRENCY;
}

export function resolveBrowserTestShard(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const match = /^(\d+)\/(\d+)$/.exec(String(value).trim());
  if (!match) throw new Error(`Invalid BROWSER_TEST_SHARD: ${value}. Expected <index>/<total>.`);

  const index = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);
  if (total < 1 || index < 1 || index > total) {
    throw new Error(`Invalid BROWSER_TEST_SHARD: ${value}. Expected 1 <= index <= total.`);
  }
  return { index, total };
}

export function selectBrowserTestShard(items, shard) {
  const source = [...items];
  if (!shard) return source;
  return source.filter((_, index) => index % shard.total === shard.index - 1);
}

export async function runWithConcurrency(items, worker, concurrency = DEFAULT_BROWSER_TEST_CONCURRENCY) {
  const source = [...items];
  if (!source.length) return [];

  const limit = Math.min(source.length, resolveBrowserTestConcurrency(concurrency));
  const results = new Array(source.length);
  let nextIndex = 0;

  async function workLoop(workerIndex) {
    while (true) {
      const index = nextIndex;
      if (index >= source.length) return;
      nextIndex += 1;
      results[index] = await worker(source[index], index, workerIndex);
    }
  }

  await Promise.all(Array.from({ length: limit }, (_, workerIndex) => workLoop(workerIndex)));
  return results;
}

function safeName(filePath) {
  return path.basename(filePath).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function runOne(testFile, { rootDir, artifactDir, childEnv, forwardOutput }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const testName = path.basename(testFile);
    const perTestArtifactDir = path.join(artifactDir, safeName(testFile).replace(/\.test\.mjs$/, ""));
    fs.mkdirSync(perTestArtifactDir, { recursive: true });
    const logPath = path.join(perTestArtifactDir, "output.log");
    const logStream = fs.createWriteStream(logPath, { flags: "w" });

    const child = spawn(process.execPath, ["--require", browserTestPreloadPath, testFile], {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...childEnv,
        BROWSER_TEST_ARTIFACT_DIR: perTestArtifactDir,
      },
    });

    const write = (target, chunk) => {
      logStream.write(chunk);
      if (forwardOutput) target.write(chunk);
    };
    child.stdout.on("data", (chunk) => write(process.stdout, chunk));
    child.stderr.on("data", (chunk) => write(process.stderr, chunk));

    let spawnError = null;
    child.once("error", (error) => {
      spawnError = error;
      logStream.write(`\nRunner spawn error: ${error.stack || error.message}\n`);
    });
    child.once("close", (code, signal) => {
      logStream.end(() => {
        resolve({
          test: testName,
          status: !spawnError && code === 0 ? "passed" : "failed",
          exitCode: code,
          signal: signal || null,
          durationMs: Date.now() - startedAt,
          ...(spawnError ? { error: spawnError.message } : {}),
          log: path.relative(rootDir, logPath),
        });
      });
    });
  });
}

function writeSummary(artifactDir, results) {
  const failed = results.filter((result) => result.status === "failed");
  const summary = {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  fs.writeFileSync(path.join(artifactDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

  const rows = results.map((result) => {
    const resultLabel = result.status === "passed" ? "PASS" : "FAIL";
    const exit = result.signal ? `signal ${result.signal}` : `exit ${result.exitCode ?? "n/a"}`;
    return `| \`${result.test}\` | ${resultLabel} | ${exit} | ${result.durationMs} ms | \`${result.log}\` |`;
  });
  const markdown = [
    "# Browser regression summary",
    "",
    `Passed: ${summary.passed}/${summary.total} · Failed: ${summary.failed}`,
    "",
    "| Test | Result | Process | Duration | Log |",
    "| --- | --- | --- | ---: | --- |",
    ...rows,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(artifactDir, "summary.md"), markdown);
  return summary;
}

export async function startSharedBrowserRuntime() {
  const { webkit } = await import("playwright");
  return startSharedWebKitServer(webkit);
}

export async function startSharedBrowserRuntimes(count, runtimeFactory = startSharedBrowserRuntime) {
  const runtimes = [];
  try {
    for (let workerIndex = 0; workerIndex < count; workerIndex += 1) {
      runtimes.push(await runtimeFactory(workerIndex));
    }
    return runtimes;
  } catch (error) {
    await Promise.allSettled(runtimes.map((runtime) => runtime.close()));
    throw error;
  }
}

export async function runBrowserTests({
  rootDir = defaultRoot,
  testFiles = discoverBrowserTests(rootDir),
  artifactDir = path.join(rootDir, "artifacts", "browser-tests"),
  childEnv = process.env,
  forwardOutput = true,
  concurrency = resolveBrowserTestConcurrency(childEnv.BROWSER_TEST_CONCURRENCY),
  shard = resolveBrowserTestShard(childEnv.BROWSER_TEST_SHARD),
  runTest = runOne,
  sharedRuntimeFactory = startSharedBrowserRuntime,
} = {}) {
  const selectedTestFiles = selectBrowserTestShard(testFiles, shard);
  if (selectedTestFiles.length === 0) {
    const suffix = shard ? ` for shard ${shard.index}/${shard.total}` : "";
    throw new Error(`No browser regression scripts found${suffix}.`);
  }
  fs.rmSync(artifactDir, { recursive: true, force: true });
  fs.mkdirSync(artifactDir, { recursive: true });

  if (shard) {
    console.log(`Browser regression shard: ${shard.index}/${shard.total} (${selectedTestFiles.length}/${testFiles.length} tests)`);
  }
  const resolvedConcurrency = Math.min(selectedTestFiles.length, resolveBrowserTestConcurrency(concurrency));
  console.log(`Browser regression concurrency: ${resolvedConcurrency}`);

  const sharedRuntimes = await startSharedBrowserRuntimes(resolvedConcurrency, sharedRuntimeFactory);
  console.log(`Browser regression WebKit runtimes: ${sharedRuntimes.length} shared worker-local`);

  let results;
  try {
    results = await runWithConcurrency(
      selectedTestFiles,
      async (testFile, _index, workerIndex) => {
        const resolvedTestFile = path.isAbsolute(testFile) ? testFile : path.resolve(rootDir, testFile);
        const name = path.basename(resolvedTestFile);
        const useGroup = childEnv.GITHUB_ACTIONS && resolvedConcurrency === 1;
        if (useGroup) console.log(`::group::Browser regression: ${name}`);
        else console.log(`\n=== Browser regression start: ${name} ===`);

        const result = await runTest(resolvedTestFile, {
          rootDir,
          artifactDir,
          childEnv: {
            ...childEnv,
            BROWSER_TEST_SHARED_WS_ENDPOINT: sharedRuntimes[workerIndex].wsEndpoint,
          },
          forwardOutput,
        });

        if (useGroup) console.log("::endgroup::");
        else console.log(`=== Browser regression ${result.status}: ${name} ===`);
        if (result.status === "failed") {
          console.error(`Browser regression failed: ${name} (${result.signal || `exit ${result.exitCode ?? "n/a"}`})`);
        }
        return result;
      },
      resolvedConcurrency,
    );
  } finally {
    await Promise.all(sharedRuntimes.map((runtime) => runtime.close()));
  }

  const summary = writeSummary(artifactDir, results);
  if (summary.failed > 0) {
    console.error(`\n${summary.failed} of ${summary.total} browser regressions failed:`);
    for (const result of results.filter((entry) => entry.status === "failed")) {
      console.error(`- ${result.test} -> ${result.log}`);
    }
  } else {
    console.log(`\nAll ${summary.total} browser regressions passed.`);
  }
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const summary = await runBrowserTests();
  if (summary.failed > 0) process.exitCode = 1;
}
