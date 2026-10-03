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

  await page.evaluate(async () => {
    const next = window.__beikostTest.getState();
    next.settings.appFocusMode = "everyday-recipes";
    next.logs = [{
      id: "backup-browser-log",
      date: "2026-09-23",
      meal: "lunch",
      foodIds: ["karotte"],
      outcome: "eaten",
    }];
    window.__beikostTest.setState(next);
    await window.save();
  });

  const backup = await page.evaluate(() => window.buildBackupPackage());

  await page.evaluate(async () => {
    const changed = window.__beikostTest.getState();
    changed.settings.appFocusMode = "planning-documentation";
    changed.logs = [];
    window.__beikostTest.setState(changed);
    await window.save();
  });

  await page.locator('nav button[data-view="more"]').click();
  await page.locator("#importData").setInputFiles({
    name: "chester-browser-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });

  await page.getByRole("heading", { name: "Backup prüfen" }).waitFor();
  await page.getByRole("button", { name: "Backup wiederherstellen" }).click();
  await page.waitForFunction(() => {
    const current = window.__beikostTest.getState();
    return current.settings.appFocusMode === "everyday-recipes"
      && current.logs.some((entry) => entry.id === "backup-browser-log");
  });

  const restored = await page.evaluate(() => window.__beikostTest.getState());
  assert.equal(restored.settings.appFocusMode, "everyday-recipes");
  assert.ok(restored.logs.some((entry) => entry.id === "backup-browser-log"));
  await page.getByText("Backup wiederhergestellt.").waitFor();
} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
