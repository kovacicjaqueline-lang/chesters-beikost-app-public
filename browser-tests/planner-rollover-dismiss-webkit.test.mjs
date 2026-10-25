import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
let context;

try {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);

  await page.evaluate(() => {
    const api = window.__beikostTest;
    const state = api.getState();
    const yesterday = api.addDays(api.today(), -1);
    state.settings.planFrom = yesterday;
    state.manualMeals = {};
    state.planLocks = {
      [`${yesterday}|lunch`]: {
        date: yesterday,
        meal: "lunch",
        focusId: "karotte",
        foodIds: ["karotte"],
        baseFoodIds: ["karotte"],
        sampleFoodIds: [],
        active: true,
        mode: "manual",
        planId: "rollover-dismiss-contract",
        type: "bekannt kombinieren",
      },
    };
    state.logs = [];
    state.backupMeta ||= {};
    state.backupMeta.plannerLinking = { version: 1, rolloverHandled: {}, carriedPlans: {} };
    api.setState(state);
  });

  await page.reload({ waitUntil: "load" });
  await page.locator("#genericModal.open").waitFor();
  assert.match(await page.locator("#genericBody").innerText(), /Gestern.*Mittag/);
  await page.locator("#keepOpenPlans").click();
  await page.locator("#genericModal").waitFor({ state: "hidden" });

  const after = await page.evaluate(() => {
    const state = window.__beikostTest.getState();
    const plan = state.planLocks[`${window.__beikostTest.addDays(window.__beikostTest.today(), -1)}|lunch`];
    return {
      planId: plan?.planId,
      handled: state.backupMeta.plannerLinking.rolloverHandled["rollover-dismiss-contract"],
      activeView: document.querySelector(".view.active")?.id,
    };
  });
  assert.equal(after.planId, "rollover-dismiss-contract", "Nicht verschieben erhält den bestehenden Mahlzeitenplan");
  assert.equal(after.handled?.action, "keep", "Die Entscheidung wird für genau diesen Plan gespeichert");
  assert.equal(after.activeView, "home", "Der Dialog lässt die aktuelle Ansicht unverändert");

  console.log("planner-rollover-dismiss-webkit: ok");
} finally {
  await closeBrowserApp({ context, browser, server });
}
