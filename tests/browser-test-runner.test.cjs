const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const runnerPath = path.resolve(__dirname, "../scripts/run-browser-tests.mjs");

test("browser runner executes every selected script and aggregates failures", async () => {
  const { runBrowserTests } = await import(pathToFileURL(runnerPath).href);
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "beikost-browser-runner-"));
  const artifactDir = path.join(rootDir, "artifacts");
  const marker = path.join(rootDir, "last-script-ran.txt");
  const scripts = [
    ["first.mjs", ""],
    ["failing.mjs", "process.exitCode = 1;"],
    ["last.mjs", `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'yes');`],
  ];
  const testFiles = [];
  for (const [name, source] of scripts) {
    const file = path.join(rootDir, name);
    fs.writeFileSync(file, source);
    testFiles.push(file);
  }

  const summary = await runBrowserTests({
    rootDir,
    testFiles,
    artifactDir,
    childEnv: {},
    forwardOutput: false,
  });

  assert.equal(summary.total, 3);
  assert.equal(summary.passed, 2);
  assert.equal(summary.failed, 1);
  assert.equal(fs.readFileSync(marker, "utf8"), "yes", "runner must continue after a failed browser script");
  assert.ok(fs.existsSync(path.join(artifactDir, "summary.json")));
  assert.ok(fs.existsSync(path.join(artifactDir, "summary.md")));
});
