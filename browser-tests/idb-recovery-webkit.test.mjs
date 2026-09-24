import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, configureBrowserTestPage, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = configureBrowserTestPage(await context.newPage());
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);

  const baseline = await page.evaluate(() => window.idbGet(STATE_RECORD));
  assert.ok(baseline, "IndexedDB must contain the bootstrapped state before failure injection");

  await page.evaluate(async () => {
    const next = window.__beikostTest.getState();
    next.settings.appFocusMode = "everyday-recipes";
    next.logs = [...next.logs, {
      id: "idb-recovery-browser-log",
      date: "2026-09-23",
      meal: "lunch",
      foodIds: ["karotte"],
      outcome: "eaten",
    }];
    window.__beikostTest.setState(next);

    window.idbPut = async () => {
      throw new Error("deterministic IndexedDB write failure");
    };
    await window.save();
  });

  const failedWriteState = await page.evaluate(() => ({
    pending: localStorage.getItem(IDB_RECOVERY_PENDING_KEY),
    local: JSON.parse(localStorage.getItem(KEY)),
  }));
  assert.equal(failedWriteState.pending, "1");
  assert.equal(failedWriteState.local.settings.appFocusMode, "everyday-recipes");
  assert.ok(failedWriteState.local.logs.some((entry) => entry.id === "idb-recovery-browser-log"));

  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);
  await page.waitForFunction(() => localStorage.getItem(IDB_RECOVERY_PENDING_KEY) === null);

  const healed = await page.evaluate(async () => ({
    state: window.__beikostTest.getState(),
    idb: await window.idbGet(STATE_RECORD),
    pending: localStorage.getItem(IDB_RECOVERY_PENDING_KEY),
  }));

  assert.equal(healed.pending, null);
  assert.equal(healed.state.settings.appFocusMode, "everyday-recipes");
  assert.ok(healed.state.logs.some((entry) => entry.id === "idb-recovery-browser-log"));
  assert.equal(healed.idb.settings.appFocusMode, "everyday-recipes");
  assert.ok(healed.idb.logs.some((entry) => entry.id === "idb-recovery-browser-log"));
} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
