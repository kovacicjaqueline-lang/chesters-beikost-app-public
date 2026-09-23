import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, configureBrowserTestPage, startStaticServer } from "./helpers/app-harness.mjs";

async function waitForView(page, id) {
  await page.waitForFunction(
    (viewId) => document.getElementById(viewId)?.classList.contains("active"),
    id,
    { timeout: 30_000 },
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
const page = configureBrowserTestPage(await context.newPage());

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState && typeof window.renderCurrentView === "function");
  await page.evaluate(() => window.__beikostTest.reset());

  await page.evaluate(() => {
    const baseRenderAll = window.renderAll;
    const baseRenderCurrentView = window.renderCurrentView;
    const baseRenderPlan = window.renderPlan;
    window.__targetedActionRenderProbe = { full: 0, current: 0, plan: 0 };
    window.renderAll = function profiledRenderAll(...args) {
      window.__targetedActionRenderProbe.full += 1;
      return baseRenderAll.apply(this, args);
    };
    window.renderCurrentView = function profiledRenderCurrentView(...args) {
      window.__targetedActionRenderProbe.current += 1;
      return baseRenderCurrentView.apply(this, args);
    };
    window.renderPlan = function profiledRenderPlan(...args) {
      window.__targetedActionRenderProbe.plan += 1;
      return baseRenderPlan.apply(this, args);
    };
  });

  await page.evaluate(() => window.showView("plan"));
  await waitForView(page, "plan");
  const planProfile = await page.evaluate(() => {
    window.__targetedActionRenderProbe.full = 0;
    window.__targetedActionRenderProbe.current = 0;
    window.__targetedActionRenderProbe.plan = 0;
    const timings = {};
    const next = window.addDays(window.__beikostTest.today(), 1);
    const input = document.getElementById("planFrom");
    input.value = next;
    let start = performance.now();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    timings.changeDateMs = performance.now() - start;
    const afterDateChange = window.__beikostTest.getState().settings.planFrom;

    start = performance.now();
    document.getElementById("planToday").click();
    timings.todayMs = performance.now() - start;
    return {
      timings,
      probe: { ...window.__targetedActionRenderProbe },
      afterDateChange,
      finalPlanFrom: window.__beikostTest.getState().settings.planFrom,
      today: window.__beikostTest.today(),
    };
  });
  assert.equal(planProfile.probe.full, 0, "Plan-Datumswechsel und Heute dürfen keinen Voll-Render auslösen");
  assert.ok(planProfile.probe.plan >= 2, "Plan-Datumswechsel und Heute müssen gezielt den Plan rendern");
  assert.notEqual(planProfile.afterDateChange, planProfile.today, "Plan-Datumswechsel muss den gewählten Folgetag speichern");
  assert.equal(planProfile.finalPlanFrom, planProfile.today, "Heute muss planFrom wieder auf den aktuellen Tag setzen");

  const mealDeleteSetup = await page.evaluate(() => {
    const bridge = window.__beikostTest;
    const snapshot = bridge.getState();
    const foodId = snapshot.foods.find((item) => item.active)?.id;
    if (!foodId) throw new Error("Mahlzeiten-Löschtest braucht ein aktives Lebensmittel");
    const date = bridge.today();
    const key = `${date}|lunch`;
    const meal = {
      date,
      meal: "lunch",
      focusId: foodId,
      foodIds: [foodId],
      baseFoodIds: [foodId],
      sampleFoodIds: [],
      foodRoles: { [foodId]: "base" },
      recipeName: "",
      manualAdded: true,
      type: "manuell",
      note: "targeted-render-delete-meal",
      createdAt: new Date().toISOString(),
    };
    snapshot.manualMeals ||= {};
    snapshot.planLocks ||= {};
    snapshot.manualMeals[key] = { ...meal };
    snapshot.planLocks[key] = { ...meal, mode: "manual" };
    bridge.setState(snapshot);
    window.showView("plan");
    window.renderCurrentView();
    return { date, key };
  });
  await waitForView(page, "plan");
  await page.waitForFunction(({ date }) =>
    !!document.querySelector(`.removeManualMeal[data-date="${date}"][data-meal="lunch"]`),
  mealDeleteSetup);
  await page.evaluate(() => {
    window.__targetedActionRenderProbe.full = 0;
    window.__targetedActionRenderProbe.current = 0;
    window.__targetedActionRenderProbe.plan = 0;
  });
  const removeManualMealSelector = `.removeManualMeal[data-date="${mealDeleteSetup.date}"][data-meal="lunch"]`;
  const manualMealDetails = page.locator("#plan details.manual-meal")
    .filter({ has: page.locator(removeManualMealSelector) })
    .filter({ has: page.locator("summary:visible") });
  let visibleRemoveManualMeal = null;
  for (let index = 0; index < await manualMealDetails.count(); index += 1) {
    const candidate = manualMealDetails.nth(index);
    const summary = candidate.locator("summary:visible");
    if (!(await candidate.evaluate((details) => details.open))) {
      await summary.click({ timeout: 10_000 });
    }
    const removeButton = candidate.locator(removeManualMealSelector);
    if (await removeButton.isVisible()) {
      visibleRemoveManualMeal = removeButton;
      break;
    }
  }
  assert.ok(visibleRemoveManualMeal, "Manuelle Mahlzeit muss in einem sichtbaren geöffneten Plan-Details-Element erscheinen");
  await visibleRemoveManualMeal.click();
  await page.locator("#confirmMealDelete").waitFor({ state: "visible" });
  const deleteMealMs = await page.evaluate(() => {
    const start = performance.now();
    document.getElementById("confirmMealDelete").click();
    return performance.now() - start;
  });
  await page.waitForFunction((key) => !window.__beikostTest.getState().manualMeals?.[key], mealDeleteSetup.key);
  const afterMealDelete = await page.evaluate(() => ({
    probe: { ...window.__targetedActionRenderProbe },
    modalOpen: document.getElementById("genericModal").classList.contains("open"),
    undoVisible: getComputedStyle(document.getElementById("toastUndo")).display !== "none",
  }));
  assert.equal(afterMealDelete.probe.full, 0, "Mahlzeit-Löschen darf keinen Voll-Render auslösen");
  assert.ok(afterMealDelete.probe.current >= 1, "Mahlzeit-Löschen muss nur die aktuelle Ansicht rendern");
  assert.equal(afterMealDelete.modalOpen, false, "Löschdialog muss nach dem Bestätigen geschlossen bleiben");
  assert.equal(afterMealDelete.undoVisible, true, "Rückgängig muss nach dem Mahlzeit-Löschen verfügbar bleiben");

  const undoMealMs = await page.evaluate(() => {
    const start = performance.now();
    document.getElementById("toastUndo").click();
    return performance.now() - start;
  });
  await page.waitForFunction((key) => !!window.__beikostTest.getState().manualMeals?.[key], mealDeleteSetup.key);
  const afterMealUndo = await page.evaluate((key) => ({
    probe: { ...window.__targetedActionRenderProbe },
    note: window.__beikostTest.getState().manualMeals?.[key]?.note || "",
  }), mealDeleteSetup.key);
  assert.equal(afterMealUndo.probe.full, 0, "Mahlzeit-Rückgängig darf keinen Voll-Render auslösen");
  assert.ok(afterMealUndo.probe.current >= 2, "Mahlzeit-Rückgängig muss die aktuelle Ansicht erneut gezielt rendern");
  assert.equal(afterMealUndo.note, "targeted-render-delete-meal", "Rückgängig muss dieselbe Mahlzeit wiederherstellen");

  await page.evaluate(() => {
    window.__targetedActionRenderProbe.full = 0;
    window.__targetedActionRenderProbe.current = 0;
    window.__targetedActionRenderProbe.plan = 0;
    window.showView("foods");
  });
  await waitForView(page, "foods");
  await page.waitForFunction(() => !!document.querySelector("#foodList .foodcard[data-food]"));
  const foodId = await page.locator("#foodList .foodcard[data-food]").first().getAttribute("data-food");
  assert.ok(foodId, "Lebensmittel-Test braucht eine sichtbare Food-ID");
  await page.evaluate((id) => window.showFoodInfo(window.food(id)), foodId);

  const foodProfile = await page.evaluate((id) => {
    const measure = (action) => {
      const start = performance.now();
      action();
      return performance.now() - start;
    };
    const timings = {};
    const originalPriority = Number(window.food(id).priority) || 1;

    let priority = document.getElementById("foodDetailsPriority");
    priority.value = String(originalPriority + 7);
    timings.priorityMs = measure(() => priority.dispatchEvent(new Event("change", { bubbles: true })));

    let status = document.getElementById("foodDetailsStatus");
    status.value = "Bekannt";
    timings.statusMs = measure(() => status.dispatchEvent(new Event("change", { bubbles: true })));

    let liked = document.getElementById("foodDetailsLiked");
    liked.checked = true;
    timings.likedMs = measure(() => liked.dispatchEvent(new Event("change", { bubbles: true })));

    timings.topMs = measure(() => document.getElementById("foodDetailsTop").click());
    timings.bottomMs = measure(() => document.getElementById("foodDetailsBottom").click());

    return {
      timings,
      probe: { ...window.__targetedActionRenderProbe },
      priority: window.food(id).priority,
      manualStatus: window.food(id).manualStatus,
      liked: window.food(id).liked,
      modalOpen: document.getElementById("genericModal").classList.contains("open"),
    };
  }, foodId);

  assert.equal(foodProfile.probe.full, 0, "Food-Detailänderungen dürfen keinen Voll-Render auslösen");
  assert.ok(foodProfile.probe.current >= 5, "Food-Detailänderungen müssen die aktuelle Ansicht gezielt rendern");
  assert.equal(foodProfile.manualStatus, "Bekannt", "Manueller Lebensmittelstatus muss unverändert gespeichert werden");
  assert.equal(foodProfile.liked, true, "Vorliebe muss unverändert gespeichert werden");
  assert.equal(foodProfile.modalOpen, true, "Food-Detaildialog muss nach lokaler Änderung offen bleiben");

  await page.evaluate((id) => {
    const state = window.__beikostTest.getState();
    const now = new Date().toISOString();
    state.logs = [{
      id: "targeted-render-delete-log",
      date: window.__beikostTest.today(),
      meal: "",
      entryType: "food",
      foodIds: [id],
      focusId: id,
      baseFoodIds: [],
      sampleFoodIds: [id],
      foodRoles: { [id]: "sample" },
      foodOutcomes: { [id]: "tried" },
      outcome: "tried",
      textureKnown: true,
      textureStage: 2,
      createdAt: now,
      updatedAt: now,
    }];
    window.__beikostTest.setState(state);
    window.__targetedActionRenderProbe.full = 0;
    window.__targetedActionRenderProbe.current = 0;
    window.__targetedActionRenderProbe.plan = 0;
  }, foodId);

  await page.evaluate(() => window.showView("more"));
  await waitForView(page, "more");
  await page.waitForFunction(() => !!document.querySelector('.deleteLog[data-log], .deleteLog'));

  const deleteMs = await page.evaluate(() => {
    const start = performance.now();
    document.querySelector(".deleteLog").click();
    return performance.now() - start;
  });
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 0);
  let afterDelete = await page.evaluate(() => ({
    probe: { ...window.__targetedActionRenderProbe },
    listCount: document.querySelectorAll("#logList [data-log]").length,
    toast: document.getElementById("toastText").textContent,
    undoVisible: getComputedStyle(document.getElementById("toastUndo")).display !== "none",
  }));
  assert.equal(afterDelete.probe.full, 0, "Protokoll-Löschen darf keinen Voll-Render auslösen");
  assert.ok(afterDelete.probe.current >= 1, "Protokoll-Löschen muss die aktuelle Ansicht gezielt rendern");
  assert.equal(afterDelete.listCount, 0, "Gelöschter Eintrag muss sofort aus dem sichtbaren Protokoll verschwinden");
  assert.equal(afterDelete.toast, "Eintrag gelöscht.");
  assert.equal(afterDelete.undoVisible, true, "Rückgängig muss nach dem Löschen verfügbar bleiben");

  const undoMs = await page.evaluate(() => {
    const start = performance.now();
    document.getElementById("toastUndo").click();
    return performance.now() - start;
  });
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
  const afterUndo = await page.evaluate(() => ({
    probe: { ...window.__targetedActionRenderProbe },
    listCount: document.querySelectorAll("#logList [data-log]").length,
    restoredId: window.__beikostTest.getState().logs[0]?.id || "",
  }));
  assert.equal(afterUndo.probe.full, 0, "Protokoll-Rückgängig darf keinen Voll-Render auslösen");
  assert.ok(afterUndo.probe.current >= 2, "Protokoll-Rückgängig muss die aktuelle Ansicht erneut gezielt rendern");
  assert.equal(afterUndo.listCount, 1, "Wiederhergestellter Eintrag muss sofort wieder sichtbar sein");
  assert.equal(afterUndo.restoredId, "targeted-render-delete-log", "Rückgängig muss denselben Protokolleintrag wiederherstellen");

  console.log(`[targeted-action-profile] ${JSON.stringify({
    plan: planProfile.timings,
    mealDelete: { deleteMealMs, undoMealMs },
    food: foodProfile.timings,
    deleteMs,
    undoMs,
  })}`);
} finally {
  await closeBrowserApp({ context, browser, server });
}

console.log("WebKit targeted action rendering regression passed.");
