import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";



async function waitForApp(page) {
  await page.waitForFunction(() =>
    !!window.__beikostTest &&
    !!window.__mealCardUnification &&
    !!window.__plannerRolloverReviewFixes &&
    window.__plannerPoliciesReady === true &&
    window.__beikostTest.getState()?.backupMeta?.storagePersisted !== "unknown",
  );
}

async function seedOpenTodayMeal(page) {
  return page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const today = window.__beikostTest.today();
    state.settings.planFrom = today;

    const potato = state.foods.find((item) => item.id === "kartoffel");
    if (potato) potato.manualStatus = "Verträgliche Basis";

    state.planLocks[`${today}|lunch`] = {
      date: today,
      meal: "lunch",
      focusId: "kartoffel",
      foodIds: ["kartoffel"],
      baseFoodIds: ["kartoffel"],
      sampleFoodIds: [],
      optionalAddons: [],
      inventoryFoodIds: [],
      recipeName: "",
      recipeInventoryId: "",
      type: "bekannt kombinieren",
      note: "",
      manualAdded: false,
      active: true,
      mode: "auto",
      planId: "planner-today-label",
      createdAt: new Date().toISOString(),
    };

    window.__beikostTest.setState(state);
    window.renderAll();
    return today;
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
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const today = await seedOpenTodayMeal(page);

  await page.locator('nav button[data-view="plan"]').click();

  const dateHeadings = page.locator("#blockPlan .day-card .day-date");
  await dateHeadings.first().waitFor();
  const expectedDate = await page.evaluate((date) => window.nice(date, true), today);

  assert.equal(
    await dateHeadings.first().innerText(),
    `${expectedDate} · Heute`,
    "Der aktuelle offene Plantag zeigt Datum und Heute gemeinsam",
  );
  assert.equal(
    await page.locator("#blockPlan .day-card .day-date", { hasText: "Heute" }).count(),
    1,
    "Nur der aktuelle Kalendertag wird als Heute markiert",
  );
  assert.doesNotMatch(
    await dateHeadings.nth(1).innerText(),
    /Heute/,
    "Folgetage erhalten keine Heute-Markierung",
  );

} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
