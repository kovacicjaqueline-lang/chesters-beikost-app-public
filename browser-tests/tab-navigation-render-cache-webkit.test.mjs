import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";



async function activateView(page, viewId) {
  await page.locator(`nav button[data-view="${viewId}"]`).click();
  await page.waitForFunction((id) => {
    const view = document.getElementById(id);
    return !!view?.classList.contains("active") && !view.hasAttribute("aria-busy");
  }, viewId);
}

async function waitForStorageBootstrap(page) {
  await page.waitForFunction(() => {
    const current = window.__beikostTest?.getState?.();
    return !!current && current.backupMeta?.storagePersisted !== "unknown";
  });
  await page.evaluate(async () => {
    if (typeof saveQueue !== "undefined") await saveQueue;
  });
}

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState && typeof window.renderFoods === "function");
  await waitForStorageBootstrap(page);

  await page.evaluate(() => {
    window.__tabRenderCounts = { foods: 0 };
    const baseRenderFoods = window.renderFoods;
    window.renderFoods = function countedRenderFoods(...args) {
      window.__tabRenderCounts.foods += 1;
      return baseRenderFoods.apply(this, args);
    };
  });

  await activateView(page, "foods");
  const afterFirstOpen = await page.evaluate(() => window.__tabRenderCounts.foods);
  assert.equal(afterFirstOpen, 1, "Der erste Aufruf des Lebensmittel-Tabs muss die Ansicht rendern");

  await activateView(page, "more");
  await activateView(page, "foods");
  const afterUnchangedRevisit = await page.evaluate(() => window.__tabRenderCounts.foods);
  assert.equal(
    afterUnchangedRevisit,
    afterFirstOpen,
    "Ein unveränderter bereits gerenderter Tab darf beim Zurückwechseln nicht erneut vollständig rendern",
  );

  await activateView(page, "foods");
  const afterActiveRetap = await page.evaluate(() => window.__tabRenderCounts.foods);
  assert.equal(
    afterActiveRetap,
    afterFirstOpen,
    "Auch ein erneuter Tap auf den bereits aktiven Tab darf keinen unnötigen Voll-Render auslösen",
  );

  await page.evaluate(async () => {
    state.settings.seasonal = !state.settings.seasonal;
    await save();
  });
  await activateView(page, "more");
  await activateView(page, "foods");
  const afterSavedStateChange = await page.evaluate(() => window.__tabRenderCounts.foods);
  assert.equal(
    afterSavedStateChange,
    afterFirstOpen + 1,
    "Nach einer gespeicherten Datenänderung muss der Tab beim nächsten Öffnen neu rendern",
  );

} finally {
  await closeBrowserApp({ context, browser, server });
}
