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

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
