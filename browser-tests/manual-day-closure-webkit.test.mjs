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
    window.__mobilePlanUiInstalled === true &&
    window.__beikostTest.getState()?.backupMeta?.storagePersisted !== "unknown",
  );
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

  const date = await page.evaluate(() => {
    const state = window.__beikostTest.reset();
    state.logs = [];
    state.planLocks = {};
    state.manualMeals = {};
    state.dayClosures = {};
    const current = window.__beikostTest.today();
    state.settings.phaseSelected = "aufbau";
    state.planLocks[`${current}|lunch`] = {
      planId: "manual-day-close-plan",
      date: current,
      meal: "lunch",
      focusId: "karotte",
      foodIds: ["karotte"],
      baseFoodIds: [],
      sampleFoodIds: ["karotte"],
      foodRoles: { karotte: "sample" },
      mode: "manual",
      active: true,
      type: "neu",
    };
    window.__beikostTest.setState(state);
    return current;
  });

  await page.locator('nav button[data-view="plan"]').click();
  const openDay = page.locator(`#blockPlan > .day-card[data-plan-date="${date}"], #blockPlan > .day-card`).first();
  await openDay.waitFor();
  await page.locator(".closeDay").click();
  await page.waitForFunction((current) => !!window.__beikostTest.getState().dayClosures?.[current], date);

  const closedDay = page.locator("#blockPlan > details.manual-day-closure");
  await closedDay.waitFor();
  assert.match(await closedDay.innerText(), /abgeschlossen/i);
  assert.match(await closedDay.innerText(), /Tag wieder öffnen/i);
  assert.equal(
    await page.evaluate((current) => window.__plannerLogRolloverCore.openPlanInstances(window.__beikostTest.getState(), (plan) => plan.date === current && plan.meal === "lunch").length, date),
    1,
    "Tagesabschluss darf offene Planmahlzeiten nicht als gegessen markieren",
  );

  await closedDay.locator(".reopenDay").click();
  await page.waitForFunction((current) => !window.__beikostTest.getState().dayClosures?.[current], date);
  await page.locator(".closeDay").waitFor();

} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}

console.log("manual-day-closure-webkit: ok");
