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

async function waitForApp(page) {
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState &&
    window.__plannerPoliciesReady === true,
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
    state.backupMeta.chesterContextSeeded = true;
    window.__beikostTest.setState(state);
    window.renderAll();
  });

  const immediate = await page.evaluate(() => {
    const baseLogFoodResultsHtml = window.logFoodResultsHtml;
    const baseInventoryPortions = window.inventoryPortions;
    window.__logFirstPaintProbe = {
      painted: false,
      suggestionCalls: 0,
      suggestionBeforePaint: 0,
      inventoryCalls: 0,
      inventoryBeforePaint: 0,
      baseLogFoodResultsHtml,
      baseInventoryPortions,
    };
    window.logFoodResultsHtml = function probedLogFoodResultsHtml(...args) {
      window.__logFirstPaintProbe.suggestionCalls += 1;
      if (!window.__logFirstPaintProbe.painted) window.__logFirstPaintProbe.suggestionBeforePaint += 1;
      return baseLogFoodResultsHtml.apply(this, args);
    };
    window.inventoryPortions = function probedInventoryPortions(...args) {
      window.__logFirstPaintProbe.inventoryCalls += 1;
      if (!window.__logFirstPaintProbe.painted) window.__logFirstPaintProbe.inventoryBeforePaint += 1;
      return baseInventoryPortions.apply(this, args);
    };
    requestAnimationFrame(() => { window.__logFirstPaintProbe.painted = true; });

    const startedAt = performance.now();
    window.openLog(null);
    const openMs = performance.now() - startedAt;
    return {
      openMs,
      modalOpen: document.getElementById("logModal")?.classList.contains("open"),
      title: document.getElementById("logTitle")?.textContent,
      dateReady: !!document.getElementById("logDate"),
      searchReady: !!document.getElementById("logFoodSearch"),
      loadingSuggestions: !!document.querySelector("#logForm .log-food-results-loading"),
      suggestionCalls: window.__logFirstPaintProbe.suggestionCalls,
      inventoryCalls: window.__logFirstPaintProbe.inventoryCalls,
    };
  });

  assert.equal(immediate.modalOpen, true, "Essen-eintragen-Dialog muss im Klicktask geöffnet werden");
  assert.equal(immediate.title, "Essen eintragen");
  assert.equal(immediate.dateReady, true, "Datum muss bereits im ersten Dialog-Render verfügbar sein");
  assert.equal(immediate.searchReady, true, "Lebensmittelsuche muss bereits im ersten Dialog-Render verfügbar sein");
  assert.equal(immediate.loadingSuggestions, true, "Vorschlagsbereich soll bis nach dem ersten Paint einen leichten Ladezustand zeigen");
  assert.equal(immediate.suggestionCalls, 0, "Lebensmittelvorschläge dürfen den ersten Paint nicht blockieren");
  assert.equal(immediate.inventoryCalls, 0, "Vorratsranking der Vorschläge darf den ersten Paint nicht blockieren");

  await page.waitForFunction(() =>
    window.__logFirstPaintProbe?.suggestionCalls > 0 &&
    !document.querySelector("#logForm .log-food-results-loading"),
  );

  const deferred = await page.evaluate(() => ({
    painted: window.__logFirstPaintProbe.painted,
    suggestionBeforePaint: window.__logFirstPaintProbe.suggestionBeforePaint,
    inventoryBeforePaint: window.__logFirstPaintProbe.inventoryBeforePaint,
    suggestionCalls: window.__logFirstPaintProbe.suggestionCalls,
    inventoryCalls: window.__logFirstPaintProbe.inventoryCalls,
    resultCount: document.querySelectorAll("#logForm .addLogFoodResult").length,
  }));

  assert.equal(deferred.painted, true, "Vorschläge müssen erst nach einem sichtbaren Frame ergänzt werden");
  assert.equal(deferred.suggestionBeforePaint, 0, "Vorschlagsberechnung muss vollständig hinter dem ersten Paint liegen");
  assert.equal(deferred.inventoryBeforePaint, 0, "Vorratsranking muss vollständig hinter dem ersten Paint liegen");
  assert.ok(deferred.suggestionCalls >= 1, "Vorschläge müssen nach dem Paint tatsächlich berechnet werden");
  assert.ok(deferred.resultCount > 0, "Nachgeladenen Vorschläge müssen sichtbar sein");

  console.log(`Essen-eintragen First-Paint: synchroner Öffnungspfad ${immediate.openMs.toFixed(2)} ms; Vorschläge danach ${deferred.suggestionCalls}x berechnet, ${deferred.inventoryCalls} Vorratsabfragen.`);

  await page.evaluate(() => {
    window.logFoodResultsHtml = window.__logFirstPaintProbe.baseLogFoodResultsHtml;
    window.inventoryPortions = window.__logFirstPaintProbe.baseInventoryPortions;
    window.closeLog();
  });
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("Log open first-paint WebKit regression passed.");
