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
    const today = window.__beikostTest.today();
    const state = window.__beikostTest.getState();
    state.settings.phaseSelected = "aufbau";
    state.settings.planFrom = today;
    state.settings.preferInventoryInPlan = false;
    state.settings.newFoodEvery = 99;
    state.planLocks = {};
    state.manualMeals = {};
    state.overrides = {};
    state.autoLockExcluded = {};
    state.followUps = {};
    state.deferred = { [today]: true };
    state.inventory = [];
    state.backupMeta ||= {};
    state.backupMeta.plannerLinking = {
      version: 1,
      rolloverHandled: {},
      carriedPlans: {},
    };
    for (const food of state.foods) {
      if (food.active && food.autoPlan !== false && (food.meals || []).some((meal) => ["breakfast", "lunch"].includes(meal))) {
        food.manualStatus = "Regelmäßig";
      }
    }
    window.__beikostTest.setState(state);
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

  const secondary = page.locator("#plan .plan-secondary-actions");
  const secondaryToggle = secondary.locator(":scope > .plan-secondary-toggle");
  assert.equal(await secondary.getAttribute("open"), null, "Sekundäre Planaktionen sind standardmäßig geschlossen");
  assert.equal(await secondary.locator(".plan-controls").count(), 1, "Datum und Neuplanung sind in den sekundären Aktionsbereich verdichtet");
  assert.equal(await secondaryToggle.isVisible(), true, "Der Einstieg zu den sekundären Planaktionen bleibt sichtbar");
  assert.equal(await secondaryToggle.getAttribute("aria-expanded"), "false", "Der Toggle weist den geschlossenen Zustand zugänglich aus");
  assert.equal(await secondary.locator(".plan-controls").isVisible(), false, "Plan ab und Neu planen bleiben im geschlossenen Zustand wirklich verborgen");
  assert.equal(await secondary.locator("#planRebuildAll").isVisible(), false, "Vollständige Neuplanung bleibt im geschlossenen Zustand wirklich verborgen");
  await secondaryToggle.click();
  assert.equal(await secondary.getAttribute("open"), "", "Sekundäre Planaktionen lassen sich öffnen");
  assert.equal(await secondaryToggle.getAttribute("aria-expanded"), "true", "Der Toggle weist den offenen Zustand zugänglich aus");
  assert.equal(await secondary.locator(".plan-controls").isVisible(), true, "Plan ab und Neu planen werden erst nach dem Öffnen sichtbar");
  assert.equal(await secondary.locator("#planRebuildAll").isVisible(), false, "Die alte vollständige Neuplanung bleibt auch nach dem Öffnen dauerhaft verborgen");
  await secondaryToggle.click();
  assert.equal(await secondary.getAttribute("open"), null, "Sekundäre Planaktionen lassen sich wieder schließen");
  assert.equal(await secondaryToggle.getAttribute("aria-expanded"), "false", "Der Toggle weist den erneut geschlossenen Zustand zugänglich aus");
  assert.equal(await secondary.locator(".plan-controls").isVisible(), false, "Plan ab und Neu planen sind nach dem Schließen wieder verborgen");

  const secondDate = await days.nth(1).getAttribute("data-plan-date");
  await days.nth(1).click();
  assert.equal(await days.nth(1).getAttribute("aria-pressed"), "true");
  assert.equal(await visibleDayCards.count(), 1);
  assert.equal(await visibleDayCards.first().getAttribute("data-plan-date"), secondDate, "Direkte Tagesauswahl wechselt das Tagesdetail");

  await page.locator("#planToday").click();
  await page.waitForFunction((date) =>
    document.querySelector(`#planWeekOverview .plan-week-day[data-plan-date="${date}"]`)?.getAttribute("aria-pressed") === "true",
  today);
  assert.equal(
    await visibleDayCards.first().getAttribute("data-plan-date"),
    today,
    "Heute setzt nach einer anderen Tagesauswahl das Tagesdetail wieder auf heute",
  );

  await days.nth(1).click();
  assert.equal(await days.nth(1).getAttribute("aria-pressed"), "true", "Nach dem Heute-Sprung bleibt direkte Tagesauswahl möglich");

  await page.evaluate(() => {
    window.__mobilePlanRenderAllCalls = 0;
    window.__mobilePlanOriginalRenderAll = window.renderAll;
    window.renderAll = function mobilePlanRenderAllProbe(...args) {
      window.__mobilePlanRenderAllCalls += 1;
      return window.__mobilePlanOriginalRenderAll.apply(this, args);
    };
  });
  const fromBefore = await page.evaluate(() => window.__beikostTest.getState().settings.planFrom);
  await page.locator("#plan .plan-week-step[data-week-step='7']").click();
  await page.waitForFunction((previous) => window.__beikostTest.getState().settings.planFrom !== previous, fromBefore);
  const fromAfter = await page.evaluate(() => window.__beikostTest.getState().settings.planFrom);
  const expected = await page.evaluate((date) => window.__beikostTest.addDays(date, 7), fromBefore);
  assert.equal(fromAfter, expected, "Nächste Woche verschiebt den sichtbaren Plan um sieben Tage");
  assert.equal(await page.locator("#planWeekOverview .plan-week-day").count(), 7);
  assert.equal(
    await page.evaluate(() => window.__mobilePlanRenderAllCalls),
    0,
    "Wochenwechsel rendert nur den Plan statt alle versteckten App-Bereiche",
  );
  await page.evaluate(() => {
    window.renderAll = window.__mobilePlanOriginalRenderAll;
    delete window.__mobilePlanOriginalRenderAll;
    delete window.__mobilePlanRenderAllCalls;
  });

  await page.setViewportSize({ width: 320, height: 844 });
  const narrowTargets = await page.locator("#planWeekOverview .plan-week-day").evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().width),
  );
  assert.ok(
    narrowTargets.every((width) => width >= 44),
    `Auch bei 320 px bleiben alle Tagesziele mindestens 44 px breit: ${narrowTargets.join(", ")}`,
  );
  const narrowStrip = await page.locator("#planWeekOverview .plan-week-days").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  assert.ok(narrowStrip.scrollWidth > narrowStrip.clientWidth, "Auf sehr schmalen Geräten darf die Tagesleiste horizontal scrollen");
  assert.equal(narrowStrip.overflowX, "auto", "Die schmale Tagesleiste nutzt explizites horizontales Scrolling");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
