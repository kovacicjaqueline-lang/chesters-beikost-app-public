import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";



async function waitForApp(page) {
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState && typeof window.openLog === "function",
  );
}

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate(() => {
    const state = window.__beikostTest.reset();
    state.logs = [];
    state.backupMeta.chesterContextSeeded = true;
    window.__beikostTest.setState(state);
    window.openLog(null);
  });

  const originalDate = await page.locator("#logDate").inputValue();
  const previousDate = await page.evaluate((date) => {
    const value = new Date(`${date}T12:00:00`);
    value.setDate(value.getDate() - 1);
    return value.toISOString().slice(0, 10);
  }, originalDate);

  await page.locator("#logAmount").fill("30");
  await page.locator("#logAmount").evaluate((element) => { element.dataset.contextRenderSentinel = "stable"; });
  await page.locator("#logDate").fill(previousDate);
  await page.locator("#logDate").dispatchEvent("change");

  assert.equal(
    await page.locator("#logModal").evaluate((node) => node.classList.contains("open")),
    true,
    "Datumswechsel darf die Eingabemaske nicht für eine Nachfrage schließen",
  );
  assert.equal(await page.locator("#logDate").inputValue(), previousDate, "Neues Datum muss sofort übernommen werden");
  assert.equal(await page.locator("#logAmount").inputValue(), "30", "Begonnener Entwurf muss beim Datumswechsel erhalten bleiben");
  assert.equal(await page.locator("#logAmount").getAttribute("data-context-render-sentinel"), "stable", "Datumswechsel darf das Formular nicht vollständig neu rendern");
  assert.equal(
    await page.getByText("Entwurf verschieben?", { exact: true }).count(),
    0,
    "Datumswechsel darf keine Bestätigungsnachfrage mehr öffnen",
  );
} finally {
  await closeBrowserApp({ context, browser, server });
}
