import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, configureBrowserTestPage, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
let context;

try {
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = configureBrowserTestPage(await context.newPage());
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);

  const stickySelectors = [
    ".app-header",
    "#foods .catalog-switch",
    "#foodsCatalogSection .mobile-catalog-search",
  ];
  for (const selector of stickySelectors) {
    const style = await page.locator(selector).evaluate((element) => {
      const computed = getComputedStyle(element);
      return { position: computed.position, backgroundColor: computed.backgroundColor, backdropFilter: computed.backdropFilter };
    });
    assert.notEqual(style.backgroundColor, "rgba(0, 0, 0, 0)", `${selector} must be opaque`);
    assert.equal(style.backdropFilter, "none");
  }

  await page.locator('nav button[data-view="plan"]').click();
  const order = await page.locator("#plan").evaluate((plan) => {
    const selectors = ["#planDefaults", "#planLockSummary", "#planQuality", ".plan-secondary-actions", ".plan-controls"];
    return selectors.map((selector) => [...plan.querySelectorAll("*")].indexOf(plan.querySelector(selector)));
  });
  assert.ok(order.every((index) => index >= 0), "all plan toolbar sections must exist");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "plan toolbar sections keep semantic DOM order");

  const surfaces = await page.evaluate(() => ({
    defaults: getComputedStyle(document.querySelector("#plan .plan-defaults-compact .plan-defaults-line")).backgroundColor,
    locks: getComputedStyle(document.querySelector("#plan .plan-lock-strip")).backgroundColor,
  }));
  assert.equal(surfaces.defaults, "rgba(0, 0, 0, 0)");
  assert.equal(surfaces.locks, "rgba(0, 0, 0, 0)");

  await page.locator('nav button[data-view="more"]').click();
  const moreCardPadding = await page.locator("#more .collapsible-card").first().evaluate((element) => getComputedStyle(element).padding);
  assert.equal(moreCardPadding, "0px", "Aufklappkarten unter Mehr nutzen das gemeinsame Kartenraster");

  await page.evaluate(() => window.openLog(null));
  await page.locator("#logModal.open").waitFor();
  const actionBackground = await page.locator("#logForm .sticky-form-actions").evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.notEqual(actionBackground, "rgba(0, 0, 0, 0)", "Die feste Formular-Aktionsleiste bleibt opak");
  await page.locator("#cancelLog").click();

  await page.locator('nav button[data-view="plan"]').click();
  const mealSummary = page.locator("#blockPlan .meal-summary-row:visible").first();
  if (await mealSummary.count()) {
    const summaryLayout = await mealSummary.evaluate((element) => {
      const style = getComputedStyle(element);
      const title = element.querySelector(".dish-title");
      const titleStyle = title ? getComputedStyle(title) : null;
      return {
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        titleWordBreak: titleStyle?.wordBreak,
        titleHyphens: titleStyle?.hyphens,
      };
    });
    assert.equal(summaryLayout.display, "grid", "Mahlzeitenkarten halten die Hauptinformation in einem eigenen Raster");
    assert.ok(summaryLayout.gridTemplateColumns.endsWith("40px"), "Die Aktionsspalte bleibt kompakt");
    assert.equal(summaryLayout.titleWordBreak, "normal");
    assert.equal(summaryLayout.titleHyphens, "none");
  }

  const addMeal = page.locator("#blockPlan .add-meal-row:visible .btn").first();
  if (await addMeal.count()) {
    const buttonStyle = await addMeal.evaluate((element) => ({
      justifyContent: getComputedStyle(element.parentElement).justifyContent,
      textAlign: getComputedStyle(element).textAlign,
    }));
    assert.equal(buttonStyle.justifyContent, "center");
    assert.equal(buttonStyle.textAlign, "center");
  }
} finally {
  await closeBrowserApp({ context, browser, server });
}
