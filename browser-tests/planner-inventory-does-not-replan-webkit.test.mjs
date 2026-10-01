import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, configureBrowserTestPage, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
let context;

try {
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = configureBrowserTestPage(await context.newPage());
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState &&
    !!window.__plannerWeekCache &&
    window.__beikostTest.getState()?.backupMeta?.storagePersisted !== "unknown",
  );

  const tomorrow = await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const date = window.__beikostTest.addDays(window.__beikostTest.today(), 1);
    state.settings.planFrom = date;
    state.settings.phaseSelected = "familie";
    state.inventory = [];
    state.planLocks = {};
    state.manualMeals = {};
    window.__beikostTest.setState(state);

    // Keep the normal render/cache/action path real while making the planner's
    // inventory-sensitive candidate change deterministic for this regression.
    const chooseMeal = (on, index = 0) => {
      const hasBologneseStock = window.__beikostTest.getState().inventory.some(
        (item) => item.kind === "recipe" && item.recipeName === "Rind-Gemüse-Bolognese" && item.portions > 0,
      );
      const recipeName = hasBologneseStock ? "Baby-Linsen-Bolognese" : "Rind-Gemüse-Bolognese";
      const recipe = window.recipeByName(recipeName);
      const foodIds = window.recipeFoodIds(recipe);
      return {
        date: on,
        index,
        introDue: false,
        introAssigned: false,
        meals: [
          { meal: "lunch", active: true, focusId: foodIds[0], foodIds, baseFoodIds: foodIds, sampleFoodIds: [], foodRoles: Object.fromEntries(foodIds.map((id) => [id, "component"])), recipeName, recipeInventoryId: "", inventoryFoodIds: [], type: "Rezept", note: "" },
        ],
      };
    };
    window.buildDays = (from, count = 7) => Array.from({ length: count }, (_, index) => {
      const on = window.__beikostTest.addDays(from, index);
      return on === date
        ? chooseMeal(on, index)
        : { date: on, index, introDue: false, introAssigned: false, meals: [] };
    });
    window.__plannerWeekCache.clear();
    window.renderPlan();
    return date;
  });

  await page.locator('nav button[data-view="plan"]').click();
  await page.waitForFunction(() => document.getElementById("plan")?.classList.contains("active"));
  const lunchCard = page.locator(`#blockPlan .day-card`).filter({ hasText: "Rind-Gemüse-Bolognese" }).first();
  await lunchCard.waitFor();
  assert.match(await lunchCard.innerText(), /Rind-Gemüse-Bolognese/);
  assert.equal(await page.locator("#blockPlan .recipe-stock-chip").count(), 0);

  async function addBologneseStock(portions = 1) {
    await page.evaluate((count) => window.addInventoryForm({ kind: "recipe", recipeName: "Rind-Gemüse-Bolognese", portions: count, size: "Portion" }), portions);
    await page.locator("#saveInv").click();
  }

  await addBologneseStock();
  assert.match(await page.locator("#blockPlan").innerText(), /Rind-Gemüse-Bolognese/);
  const stockDebug = await page.evaluate((date) => ({
    inventory: window.__beikostTest.getState().inventory,
    planned: window.__plannerWeekCache.readOnly(date, 7).find((day) => day.date === date)?.meals,
    hasReservationFunction: typeof window.reserveMealInventory === "function",
  }), tomorrow);
  assert.equal(await page.locator("#blockPlan .recipe-stock-chip").count(), 1, `neue Rezeptportion wird der bestehenden Mahlzeit zugeordnet: ${JSON.stringify(stockDebug)}`);
  assert.match(await page.locator("#prepCovered").innerText(), /Rind-Gemüse-Bolognese/);
  assert.match(await page.locator("#prepCovered").innerText(), /1\s*vorhanden/);

  await page.locator(".editInv").click();
  await page.locator("#invPortions").fill("2");
  await page.locator("#saveInv").click();
  assert.match(await page.locator("#blockPlan").innerText(), /Rind-Gemüse-Bolognese/);
  assert.equal(await page.locator("#blockPlan .recipe-stock-chip").count(), 1);

  await page.locator(".useInv").click();
  assert.match(await page.locator("#blockPlan").innerText(), /Rind-Gemüse-Bolognese/);
  assert.equal(await page.locator("#blockPlan .recipe-stock-chip").count(), 1, "nach Verbrauch der ersten Portion bleibt die Mahlzeit gedeckt");

  await page.locator(".deleteInv").click();
  assert.match(await page.locator("#blockPlan").innerText(), /Rind-Gemüse-Bolognese/);
  assert.equal(await page.locator("#blockPlan .recipe-stock-chip").count(), 0, "nach Löschen bleibt die Mahlzeit geplant und die Deckung entfällt");

  await addBologneseStock();
  assert.match(await page.locator("#blockPlan").innerText(), /Rind-Gemüse-Bolognese/);
  await page.locator("#planRecalculate").click();
  await page.waitForFunction(() => document.querySelector("#blockPlan")?.innerText.includes("Baby-Linsen-Bolognese"));
  assert.match(await page.locator("#blockPlan").innerText(), /Baby-Linsen-Bolognese/, "erst die ausdrückliche Neuplanung wählt anhand des neuen Vorrats einen anderen Slot");

  console.log(`Planner-Vorratsregression bestanden für morgen ${tomorrow}.`);
} finally {
  await closeBrowserApp({ context, browser, server });
}
