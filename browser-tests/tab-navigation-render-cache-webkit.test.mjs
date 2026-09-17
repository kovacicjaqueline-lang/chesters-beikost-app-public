import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
};

function startStaticServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filePath = path.resolve(root, `.${pathname}`);
    if (filePath !== path.join(root, "index.html") && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.stat(filePath, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      fs.createReadStream(filePath).pipe(response);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

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

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
