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
    fs.stat(filePath, (statError, stat) => {
      if (statError || !stat.isFile()) {
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

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
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

  await context.addInitScript(() => {
    const NativeMutationObserver = window.MutationObserver;
    const bodyObservers = [];
    const observerStats = { callbacks: 0, records: 0, callbackMs: 0 };
    const listenerStats = { total: 0 };
    const nativeAddEventListener = EventTarget.prototype.addEventListener;

    EventTarget.prototype.addEventListener = function catalogPerfAddEventListener(...args) {
      listenerStats.total += 1;
      return nativeAddEventListener.apply(this, args);
    };

    window.MutationObserver = class CatalogPerfMutationObserver extends NativeMutationObserver {
      constructor(callback) {
        let instance = null;
        super((records, observer) => {
          if (!instance?._catalogPerfBodyObserver) return callback(records, observer);
          const startedAt = performance.now();
          try {
            return callback(records, observer);
          } finally {
            observerStats.callbacks += 1;
            observerStats.records += records.length;
            observerStats.callbackMs += performance.now() - startedAt;
          }
        });
        instance = this;
      }

      observe(target, options) {
        if (target === document.body && options?.childList === true && options?.subtree === true) {
          if (!this._catalogPerfBodyObserver) {
            this._catalogPerfBodyObserver = {
              target,
              options: { ...options },
              enabled: true,
            };
            bodyObservers.push(this);
          } else {
            this._catalogPerfBodyObserver.target = target;
            this._catalogPerfBodyObserver.options = { ...options };
            this._catalogPerfBodyObserver.enabled = true;
          }
        }
        return super.observe(target, options);
      }
    };

    window.__catalogPerfProbe = {
      reset() {
        observerStats.callbacks = 0;
        observerStats.records = 0;
        observerStats.callbackMs = 0;
        listenerStats.total = 0;
      },
      snapshot() {
        return {
          globalObserverCount: bodyObservers.length,
          observerCallbacks: observerStats.callbacks,
          observerRecords: observerStats.records,
          observerCallbackMs: observerStats.callbackMs,
          addEventListenerCalls: listenerStats.total,
        };
      },
      setBodyObserversEnabled(enabled) {
        for (const observer of bodyObservers) {
          const tracked = observer._catalogPerfBodyObserver;
          if (!tracked) continue;
          if (!enabled && tracked.enabled) {
            observer.disconnect();
            tracked.enabled = false;
          } else if (enabled && !tracked.enabled) {
            observer.observe(tracked.target, tracked.options);
            tracked.enabled = true;
          }
        }
      },
    };
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.reset);
  await page.waitForFunction(() => window.__plannerPoliciesReady === true);
  await page.evaluate(() => window.__beikostTest.reset());

  async function settle() {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }

  async function measureInput(inputSelector, listSelector, value, bodyObserverEnabled = true) {
    return page.evaluate(async ({ inputSelector, listSelector, value, bodyObserverEnabled }) => {
      const input = document.querySelector(inputSelector);
      const list = document.querySelector(listSelector);
      if (!input || !list) throw new Error(`Missing catalog controls: ${inputSelector} / ${listSelector}`);

      window.__catalogPerfProbe.setBodyObserversEnabled(bodyObserverEnabled);
      window.__catalogPerfProbe.reset();
      const beforeFirst = list.firstElementChild;
      let mutationRecords = 0;
      let addedNodes = 0;
      let removedNodes = 0;
      const listObserver = new MutationObserver((records) => {
        mutationRecords += records.length;
        for (const record of records) {
          addedNodes += record.addedNodes.length;
          removedNodes += record.removedNodes.length;
        }
      });
      listObserver.observe(list, { childList: true, subtree: true });

      const startedAt = performance.now();
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise((resolve) => setTimeout(resolve, 0));
      const elapsedMs = performance.now() - startedAt;
      listObserver.disconnect();

      return {
        elapsedMs,
        mutationRecords,
        addedNodes,
        removedNodes,
        firstNodeReplaced: !!beforeFirst && !beforeFirst.isConnected,
        visibleCards: list.querySelectorAll(".foodcard:not([hidden]), .recipe-card-v2:not([hidden])").length,
        ...window.__catalogPerfProbe.snapshot(),
      };
    }, { inputSelector, listSelector, value, bodyObserverEnabled });
  }

  async function repeatedInput(inputSelector, listSelector, value, bodyObserverEnabled) {
    const samples = [];
    for (let index = 0; index < 7; index += 1) {
      samples.push(await measureInput(inputSelector, listSelector, value, bodyObserverEnabled));
    }
    return {
      samples,
      medianElapsedMs: median(samples.map((sample) => sample.elapsedMs)),
      medianObserverCallbackMs: median(samples.map((sample) => sample.observerCallbackMs)),
      totalObserverCallbacks: samples.reduce((sum, sample) => sum + sample.observerCallbacks, 0),
      totalAddedNodes: samples.reduce((sum, sample) => sum + sample.addedNodes, 0),
      totalRemovedNodes: samples.reduce((sum, sample) => sum + sample.removedNodes, 0),
      replacementSamples: samples.filter((sample) => sample.firstNodeReplaced).length,
    };
  }

  await page.locator('nav button[data-view="foods"]').click();
  await settle();

  const foodSearch = await repeatedInput("#foodSearch", "#foodList", "ha", true);

  await page.locator('#catalogSwitch [data-catalog-mode="recipes"]').click();
  await page.locator('[data-recipe-filter="all"]').click();
  await settle();

  const recipeSearch = await repeatedInput("#recipeSearch", "#recipeList", "flocken", true);

  const report = {
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    foodSearch,
    recipeSearch,
  };

  assert.equal(foodSearch.samples[0].globalObserverCount, 0, "Der Katalog darf keinen globalen body/subtree MutationObserver registrieren");
  assert.ok(foodSearch.samples.some((sample) => sample.mutationRecords > 0), "Lebensmittelsuche muss DOM-Mutationen messbar machen");
  assert.ok(recipeSearch.samples.some((sample) => sample.mutationRecords > 0), "Rezeptsuche muss DOM-Mutationen messbar machen");
  assert.deepEqual(pageErrors, [], "Performance-Messung darf keine JavaScript-Fehler auslösen");

  console.log(`CATALOG_PERF_BASELINE ${JSON.stringify(report)}`);
  await context.close();
  console.log("catalog-search-rendering-performance-webkit: ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
