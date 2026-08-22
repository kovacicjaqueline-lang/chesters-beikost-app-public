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
    !!window.__beikostTest &&
    !!window.__mealCardUnification &&
    !!window.__plannerRolloverReviewFixes &&
    !!window.__plannerRandomSwap &&
    window.__plannerPoliciesReady === true,
  );
}

async function seedUnifiedWeek(page) {
  return page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const today = window.__beikostTest.today();
    const tomorrow = window.__beikostTest.addDays(today, 1);
    const manualDay = window.__beikostTest.addDays(today, 2);
    const followUpDay = window.__beikostTest.addDays(today, 3);
    const warningDay = window.__beikostTest.addDays(today, 4);
    state.settings.planFrom = today;

    for (const id of ["kartoffel", "gurke", "karotte", "banane", "apfel"]) {
      const item = state.foods.find((food) => food.id === id);
      if (item) item.manualStatus = "Verträgliche Basis";
    }

    const makeMeal = (date, meal, patch = {}) => ({
      date,
      meal,
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
      createdAt: new Date().toISOString(),
      ...patch,
    });

    const todayMeal = makeMeal(today, "lunch", {
      inventoryFoodIds: ["kartoffel"],
      planId: "ui-unified-today",
    });
    state.planLocks[`${today}|lunch`] = { ...todayMeal, mode: "auto" };

    const tomorrowMeal = makeMeal(tomorrow, "lunch", {
      foodIds: ["kartoffel", "gurke"],
      baseFoodIds: ["kartoffel"],
      foodRoles: { kartoffel: "base", gurke: "component" },
      inventoryFoodIds: ["gurke"],
      planId: "ui-unified-tomorrow",
    });
    state.planLocks[`${tomorrow}|lunch`] = { ...tomorrowMeal, mode: "auto" };

    const manualMeal = makeMeal(manualDay, "lunch", {
      focusId: "karotte",
      foodIds: ["karotte"],
      baseFoodIds: ["karotte"],
      inventoryFoodIds: ["karotte"],
      type: "manuell",
      note: "Mahlzeit bewusst manuell bearbeitet.",
      planId: "ui-unified-manual",
    });
    state.planLocks[`${manualDay}|lunch`] = { ...manualMeal, mode: "manual" };

    const extraMeal = makeMeal(manualDay, "breakfast", {
      focusId: "banane",
      foodIds: ["banane"],
      baseFoodIds: ["banane"],
      inventoryFoodIds: ["banane"],
      type: "manuell",
      manualAdded: true,
      planId: "ui-unified-extra",
    });
    state.manualMeals[`${manualDay}|breakfast`] = { ...extraMeal };
    state.planLocks[`${manualDay}|breakfast`] = { ...extraMeal, mode: "manual" };

    const followUpMeal = makeMeal(followUpDay, "lunch", {
      focusId: "apfel",
      foodIds: ["apfel"],
      baseFoodIds: ["apfel"],
      note: "Erneut anbieten – diesmal ohne zusätzliche Kostprobe.",
      planId: "ui-unified-follow-up",
    });
    state.planLocks[`${followUpDay}|lunch`] = { ...followUpMeal, mode: "auto" };

    const warningMeal = makeMeal(warningDay, "lunch", {
      focusId: "zucchini",
      foodIds: ["zucchini"],
      baseFoodIds: ["zucchini"],
      planId: "ui-unified-warning",
    });
    state.planLocks[`${warningDay}|lunch`] = { ...warningMeal, mode: "manual" };
    const zucchini = state.foods.find((food) => food.id === "zucchini");
    if (zucchini) zucchini.active = false;

    window.__beikostTest.setState(state);
    return { today, tomorrow, manualDay, followUpDay, warningDay };
  });
}

function assertMealActions(text) {
  assert.match(text, /Tauschen/);
  assert.match(text, /Mahlzeit bearbeiten/);
  assert.match(text, /Auf morgen/);
  assert.match(text, /Essen eintragen/);
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
  const dates = await seedUnifiedWeek(page);

  const homeMeal = page.locator("#todayCard .mealbox", { hasText: "Kartoffel" }).first();
  await homeMeal.waitFor();
  assertMealActions(await homeMeal.innerText());
  assert.equal(await homeMeal.locator(".homeLog").count(), 0, "Heute nutzt keinen separaten Home-Log-Button mehr");
  assert.equal(await homeMeal.locator(".logMeal").count(), 1, "Heute nutzt denselben Log-Button wie der Plan");
  await homeMeal.locator(".meal-lock.locked").waitFor();
  assert.equal(await homeMeal.locator(".lock-label").count(), 0, "Auto-Lock zeigt keine redundante Fest-eingeplant-Zeile");
  assert.equal(await homeMeal.locator(".stock-chip").innerText(), "❄️ Vorrat");
  assert.equal(await homeMeal.locator(".stock-chip").getAttribute("aria-label"), "Aus Vorrat: Kartoffel");

  const lockMetrics = await homeMeal.locator(".meal-lock").evaluate((button) => {
    const buttonRect = button.getBoundingClientRect();
    const iconRect = button.querySelector(".lock-svg")?.getBoundingClientRect();
    return {
      width: buttonRect.width,
      height: buttonRect.height,
      iconWidth: iconRect?.width || 0,
      iconHeight: iconRect?.height || 0,
    };
  });
  assert.ok(lockMetrics.width >= 44 && lockMetrics.height >= 44, "Schloss behält mindestens 44×44 px Touchfläche");
  assert.ok(lockMetrics.iconWidth < lockMetrics.width && lockMetrics.iconHeight < lockMetrics.height, "sichtbares Schloss bleibt kleiner als seine Touchfläche");

  const homeStyle = await homeMeal.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      borderWidth: style.borderWidth,
    };
  });

  await homeMeal.locator(".replaceMeal").click();
  await page.locator("#genericModal.open").waitFor();
  await page.locator("#closeGeneric").click();

  await page.locator('nav button[data-view="plan"]').click();

  const todayDay = page.locator(`#blockPlan details.day-details[data-day-date="${dates.today}"]`);
  await todayDay.waitFor();
  assert.equal(await todayDay.evaluate((node) => node.open), true, "Heute ist im Wochenplan standardmäßig geöffnet");

  const planMeal = todayDay.locator(".mealbox", { hasText: "Kartoffel" }).first();
  await planMeal.waitFor();
  assertMealActions(await planMeal.innerText());
  await planMeal.locator(".meal-lock.locked").waitFor();
  assert.equal(await planMeal.locator(".lock-label").count(), 0, "Plan zeigt beim Auto-Lock keine Fest-eingeplant-Zeile");
  assert.equal(await planMeal.locator(".stock-chip").innerText(), "❄️ Vorrat");

  const planStyle = await planMeal.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      borderWidth: style.borderWidth,
    };
  });
  assert.deepEqual(homeStyle, planStyle, "Heute und Plan verwenden dieselbe Kartenoptik");

  const tomorrowDay = page.locator(`#blockPlan details.day-details[data-day-date="${dates.tomorrow}"]`);
  await tomorrowDay.waitFor();
  assert.equal(await tomorrowDay.evaluate((node) => node.open), false, "normaler Zukunftstag ist kompakt eingeklappt");
  const tomorrowSummary = tomorrowDay.locator("summary.day-details-summary");
  assert.match(await tomorrowSummary.innerText(), /Kartoffel/);
  assert.doesNotMatch(await tomorrowSummary.innerText(), /Bekannter Tag/);
  assert.equal(await tomorrowSummary.locator(".day-summary-slot").first().innerText(), "Mittag");
  assert.equal(await tomorrowSummary.locator(".day-summary-stock").count(), 1, "Vorrat bleibt im kompakten Tagesüberblick sichtbar");

  await tomorrowSummary.click();
  assert.equal(await tomorrowDay.evaluate((node) => node.open), true, "Zukunftstag lässt sich über bestehendes Details-Muster öffnen");
  const tomorrowMeal = tomorrowDay.locator(".mealbox", { hasText: "Kartoffel" }).first();
  assert.equal(await tomorrowMeal.locator(".stock-chip").innerText(), "❄️ Gurke", "Teilvorrat nennt die konkrete Komponente");
  assert.equal(await tomorrowMeal.locator(".stock-chip").getAttribute("aria-label"), "Aus Vorrat: Gurke");

  const manualDay = page.locator(`#blockPlan details.day-details[data-day-date="${dates.manualDay}"]`);
  await manualDay.waitFor();
  assert.equal(await manualDay.evaluate((node) => node.open), false, "manuell geschützter Zukunftstag bleibt grundsätzlich kompakt");
  const manualSummaryText = await manualDay.locator("summary.day-details-summary").innerText();
  assert.match(manualSummaryText, /Manuell geschützt/, "manueller Schutz bleibt bereits in der kompakten Tagesübersicht sichtbar");
  await manualDay.locator("summary.day-details-summary").click();
  const manualEditedMeal = manualDay.locator(".mealbox", { hasText: "Karotte" }).first();
  assert.match(await manualEditedMeal.innerText(), /Manuell geschützt/, "manuell bearbeitete Mahlzeit behält sichtbaren Schutzstatus");
  assert.doesNotMatch(await manualEditedMeal.innerText(), /Fest eingeplant/);
  const extraMeal = manualDay.locator("details.manual-meal", { hasText: "Banane" }).first();
  await extraMeal.waitFor();
  assert.match(await extraMeal.locator("summary").innerText(), /Manuell geschützt/, "Zusatzmahlzeit erklärt den manuellen Schutz im Summary");
  assert.equal(await extraMeal.locator("summary .stock-chip").innerText(), "❄️ Vorrat", "Zusatzmahlzeit nutzt dieselbe kompakte Vorratsdarstellung");

  const followUpDay = page.locator(`#blockPlan details.day-details[data-day-date="${dates.followUpDay}"]`);
  await followUpDay.waitFor();
  assert.equal(await followUpDay.evaluate((node) => node.open), false);
  assert.match(
    await followUpDay.locator("summary.day-details-summary").innerText(),
    /Erneut anbieten/,
    "Nachhol-/erneut-anbieten-Hinweis bleibt auch im geschlossenen Tag sichtbar",
  );

  const warningDay = page.locator(`#blockPlan details.day-details[data-day-date="${dates.warningDay}"]`);
  await warningDay.waitFor();
  assert.equal(await warningDay.evaluate((node) => node.open), true, "Tag mit deaktiviertem Lebensmittel öffnet sich automatisch");
  assert.match(await warningDay.innerText(), /deaktiviert/);

  const pageOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(
    pageOverflow.scrollWidth <= pageOverflow.clientWidth + 1,
    `Wochenplan darf auf 390 px nicht horizontal überlaufen (${pageOverflow.scrollWidth} > ${pageOverflow.clientWidth})`,
  );

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("meal-card-unification-webkit: ok");
