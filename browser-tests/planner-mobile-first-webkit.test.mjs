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
    window.__plannerPoliciesReady === true &&
    window.__beikostTest.getState()?.backupMeta?.storagePersisted !== "unknown",
  );
  await page.waitForFunction(() => window.__mobilePlanUiInstalled === true);
}

async function seedPlan(page) {
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
      mode: "manual",
      planId: "planner-mobile-first",
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
  const today = await seedPlan(page);

  await page.locator('nav button[data-view="plan"]').click();

  const days = page.locator("#planWeekOverview .plan-week-day");
  assert.equal(await days.count(), 7, "Die Wochenübersicht zeigt genau sieben direkt auswählbare Tage");
  assert.equal(await days.first().getAttribute("aria-pressed"), "true", "Heute ist in der sichtbaren Woche initial ausgewählt");

  const visibleDayCards = page.locator("#blockPlan > .day-card:not([hidden]), #blockPlan > .completed-day:not([hidden])");
  assert.equal(await visibleDayCards.count(), 1, "Nur der ausgewählte Tag wird vollständig dargestellt");
  assert.equal(await visibleDayCards.first().getAttribute("data-plan-date"), today);
  assert.equal(await page.locator("#blockPlan .replaceMeal:visible").count() > 0, true, "Die ausgewählte Mahlzeit bleibt bearbeitbar");
  assert.equal(await page.locator("#blockPlan .meal-lock:visible").count() > 0, true, "Meal-Locks bleiben im Tagesdetail bedienbar");

  const secondary = page.locator("#plan .plan-secondary-actions");
  assert.equal(await secondary.getAttribute("open"), null, "Sekundäre Planaktionen sind standardmäßig geschlossen");
  assert.equal(await secondary.locator(".plan-controls").count(), 1, "Datum und Neuplanung sind in den sekundären Aktionsbereich verdichtet");

  const secondDate = await days.nth(1).getAttribute("data-plan-date");
  await days.nth(1).click();
  assert.equal(await days.nth(1).getAttribute("aria-pressed"), "true");
  assert.equal(await visibleDayCards.count(), 1);
  assert.equal(await visibleDayCards.first().getAttribute("data-plan-date"), secondDate, "Direkte Tagesauswahl wechselt das Tagesdetail");

  const fromBefore = await page.evaluate(() => window.__beikostTest.getState().settings.planFrom);
  await page.locator("#plan .plan-week-step[data-week-step='7']").click();
  await page.waitForFunction((previous) => window.__beikostTest.getState().settings.planFrom !== previous, fromBefore);
  const fromAfter = await page.evaluate(() => window.__beikostTest.getState().settings.planFrom);
  const expected = await page.evaluate((date) => window.__beikostTest.addDays(date, 7), fromBefore);
  assert.equal(fromAfter, expected, "Nächste Woche verschiebt den sichtbaren Plan um sieben Tage");
  assert.equal(await page.locator("#planWeekOverview .plan-week-day").count(), 7);

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
