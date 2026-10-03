import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";



function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.reset);
  await page.waitForFunction(() => window.__plannerPoliciesReady === true);
  await page.evaluate(() => window.__beikostTest.reset());

  async function settle() {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }

  async function measureFilter(buttonSelector, listSelector) {
    return page.evaluate(async ({ buttonSelector, listSelector }) => {
      const button = document.querySelector(buttonSelector);
      const list = document.querySelector(listSelector);
      if (!button || !list) throw new Error(`Missing filter controls: ${buttonSelector} / ${listSelector}`);
      const beforeFirst = list.firstElementChild;
      let records = 0;
      let addedNodes = 0;
      let removedNodes = 0;
      const observer = new MutationObserver((mutations) => {
        records += mutations.length;
        for (const mutation of mutations) {
          addedNodes += mutation.addedNodes.length;
          removedNodes += mutation.removedNodes.length;
        }
      });
      observer.observe(list, { childList: true, subtree: true });
      const startedAt = performance.now();
      button.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise((resolve) => setTimeout(resolve, 0));
      const elapsedMs = performance.now() - startedAt;
      observer.disconnect();
      return {
        elapsedMs,
        records,
        addedNodes,
        removedNodes,
        firstNodeReplaced: !!beforeFirst && !beforeFirst.isConnected,
        visibleCards: list.querySelectorAll(".foodcard:not([hidden]), .recipe-card-v2:not([hidden])").length,
      };
    }, { buttonSelector, listSelector });
  }

  await page.locator('nav button[data-view="foods"]').click();
  await settle();

  const foodSamples = [];
  for (const filter of ["all", "open", "allergen", "all", "open", "allergen", "all"]) {
    foodSamples.push(await measureFilter(`#foodFilters [data-filter="${filter}"]`, "#foodList"));
  }

  await page.locator('#catalogSwitch [data-catalog-mode="recipes"]').click();
  await settle();
  const recipeSamples = [];
  for (const filter of ["all", "available", "almost", "all", "available", "almost", "all"]) {
    recipeSamples.push(await measureFilter(`#recipeFilter [data-recipe-filter="${filter}"]`, "#recipeList"));
  }

  const report = {
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    foodFilters: {
      samples: foodSamples,
      medianElapsedMs: median(foodSamples.map((sample) => sample.elapsedMs)),
      replacements: foodSamples.filter((sample) => sample.firstNodeReplaced).length,
    },
    recipeFilters: {
      samples: recipeSamples,
      medianElapsedMs: median(recipeSamples.map((sample) => sample.elapsedMs)),
      replacements: recipeSamples.filter((sample) => sample.firstNodeReplaced).length,
    },
  };

  assert.ok(foodSamples.some((sample) => sample.records > 0), "Lebensmittelfilter müssen für die Baseline DOM-Arbeit erfassen");
  assert.ok(recipeSamples.some((sample) => sample.records > 0), "Rezeptfilter müssen für die Baseline DOM-Arbeit erfassen");
  assert.deepEqual(pageErrors, [], "Filter-Performance-Messung darf keine JavaScript-Fehler auslösen");

  console.log(`CATALOG_FILTER_PERF_BASELINE ${JSON.stringify(report)}`);
  await context.close();
  console.log("catalog-filter-rendering-performance-webkit: ok");
} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
