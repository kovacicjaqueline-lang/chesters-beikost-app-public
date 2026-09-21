import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";



async function waitForApp(page) {
  await page.waitForFunction(() => !!window.__beikostTest?.openManualMealSelector);
  await page.waitForFunction(() => window.__manualMealFlowRuntimeInstalled === true);
}

async function selectFood(page, searchText, foodId) {
  await page.locator("#selectorFoods").click();
  const search = page.locator("#mealSelectorSearch");
  await search.fill(searchText);
  const option = page.locator(`.selectFood[data-food="${foodId}"]`);
  await option.waitFor();
  await option.click();
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

  const today = await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const bangus = state.foods.find((food) => food.id === "bangus-milkfish");
    const rice = state.foods.find((food) => food.id === "reis");
    if (!bangus || !rice) throw new Error("Bangus und Reis müssen im FOOD-Stamm vorhanden sein");
    bangus.manualStatus = "Offen";
    rice.manualStatus = "Probiert";
    window.__beikostTest.setState(state);
    const date = window.__beikostTest.today();
    window.__beikostTest.openManualMealSelector(date, "lunch");
    return date;
  });

  await selectFood(page, "Bangus", "bangus-milkfish");
  await selectFood(page, "Reis", "reis");

  await page.waitForFunction(() => {
    const ids = [...document.querySelectorAll(".removeManualSelected[data-food]")]
      .map((button) => button.dataset.food);
    return ids.includes("bangus-milkfish") && ids.includes("reis");
  });

  assert.equal(
    await page.locator(".manual-role-advisory").count(),
    0,
    "Bangus Offen + Reis Probiert darf keinen Mehrfach-Einführungshinweis erzeugen",
  );

  const confirm = page.locator("#confirmManualMeal");
  await confirm.waitFor();
  assert.equal(
    await confirm.isDisabled(),
    false,
    "Bangus Offen + Reis Probiert muss im manuellen Mahlzeiten-Editor speicherbar bleiben",
  );

  await confirm.click();
  await page.waitForFunction(
    ({ date, meal }) => !!window.__beikostTest.getState().manualMeals?.[`${date}|${meal}`],
    { date: today, meal: "lunch" },
  );

  const saved = await page.evaluate(({ date, meal }) => {
    const state = window.__beikostTest.getState();
    return state.manualMeals?.[`${date}|${meal}`] || null;
  }, { date: today, meal: "lunch" });

  assert.ok(saved, "die Mahlzeit muss tatsächlich gespeichert werden");
  assert.deepEqual(
    [...new Set(saved.foodIds || [])].sort(),
    ["bangus-milkfish", "reis"].sort(),
    "die gespeicherte Mahlzeit muss Bangus und Reis enthalten",
  );
  assert.equal(
    await page.locator("#genericModal").evaluate((element) => element.classList.contains("open")),
    false,
    "der Editor muss nach erfolgreichem Speichern geschlossen sein",
  );

} finally {
  await closeBrowserApp({ context, browser, server });
}
