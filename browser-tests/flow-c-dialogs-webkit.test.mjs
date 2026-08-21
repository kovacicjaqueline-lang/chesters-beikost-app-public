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

function assertInsideViewport(box, width, height, label) {
  assert.ok(box, `${label} muss ein Layout-Rechteck besitzen`);
  assert.ok(box.x >= -1 && box.x + box.width <= width + 1, `${label} darf horizontal nicht abgeschnitten sein`);
  assert.ok(box.y >= -1 && box.y + box.height <= height + 1, `${label} muss vollständig sichtbar sein`);
}

const width = 390;
const height = 500;
const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState && window.__flowDialogUiInstalled === true);

  // Freier Essenseintrag: gleiche Shell, aber weiterhin ohne erzwungenen Mahlzeitenkontext.
  await page.evaluate(() => { window.__beikostTest.reset(); window.openLog(null); });
  await page.waitForFunction(() => document.getElementById("logForm")?.classList.contains("flow-dialog-body"));
  assert.equal(await page.locator("#logModal").evaluate((node) => node.classList.contains("flow-dialog")), true);
  assert.equal(await page.locator("#logTitle").textContent(), "Essen eintragen");
  assert.equal(await page.locator("#logMeal").count(), 0);
  assert.equal(await page.locator("#logForm .flow-dialog-actions").count(), 1);
  assert.equal(await page.locator("#logFoodSearch").evaluate((node) => getComputedStyle(node).fontSize), "16px");
  assert.equal(await page.locator(".log-food-results").evaluate((node) => getComputedStyle(node).overflowY), "visible");
  assertInsideViewport(await page.locator("#logForm .flow-dialog-actions").boundingBox(), width, height, "Log-Aktionsleiste");
  await page.locator("#cancelLog").click();
  assert.equal(await page.evaluate(() => window.__beikostTest.getState().logs.length), 0, "Abbrechen darf keinen Eintrag erzeugen");

  // Bestehenden Eintrag bearbeiten: gleicher Dialog, bestehender Datensatz bleibt derselbe Flow.
  await page.evaluate(() => {
    const state = window.__beikostTest.getState();
    const karotte = state.foods.find((item) => item.name === "Karotte");
    state.logs = [{
      id: "flow-c-edit",
      date: window.__beikostTest.today(),
      meal: "",
      entryType: "food",
      foodIds: [karotte.id],
      focusId: karotte.id,
      baseFoodIds: [],
      sampleFoodIds: [karotte.id],
      foodRoles: { [karotte.id]: "sample" },
      foodOutcomes: { [karotte.id]: "tried" },
      outcome: "tried",
      textureKnown: true,
      textureStage: 1,
    }];
    window.__beikostTest.setState(state);
    window.editLogEntry("flow-c-edit");
  });
  await page.waitForFunction(() => document.getElementById("logTitle")?.textContent === "Essen bearbeiten");
  assert.equal(await page.locator("#logModal .flow-dialog-header").count(), 1);
  assert.equal(await page.locator("#saveLog").textContent(), "Änderungen speichern");
  await page.locator("#cancelLog").click();
  assert.equal(await page.evaluate(() => window.__beikostTest.getState().logs[0].id), "flow-c-edit");

  // Mahlzeit hinzufügen: Aktionstitel und Kontext sind getrennt, Shell/Actionbar identisch.
  await page.evaluate(() => window.__beikostTest.openManualMealSelector(window.__beikostTest.today(), "lunch"));
  await page.waitForFunction(() => document.getElementById("genericTitle")?.textContent === "Mahlzeit hinzufügen");
  assert.equal(await page.locator("#genericModal").evaluate((node) => node.classList.contains("flow-dialog")), true);
  assert.match(await page.locator("#genericSubtitle").textContent(), /Mittag/);
  assert.equal(await page.locator("#genericBody.flow-dialog-body").count(), 1);
  assert.equal(await page.locator("#genericBody .flow-dialog-actions").count(), 1);
  assertInsideViewport(await page.locator("#genericBody .flow-dialog-actions").boundingBox(), width, height, "Plan-Aktionsleiste");

  await page.locator("#selectorFoods").click();
  await page.waitForFunction(() => document.getElementById("genericTitle")?.textContent === "Mahlzeit hinzufügen");
  assert.equal(await page.locator("#mealSelectorSearch").evaluate((node) => getComputedStyle(node).fontSize), "16px");
  assert.equal(await page.locator(".selector-results").evaluate((node) => getComputedStyle(node).overflowY), "visible");
  await page.locator("#cancelManualMeal").click();
  assert.equal(await page.locator("#genericModal").evaluate((node) => node.classList.contains("open")), false);

  // Geplante Mahlzeit bearbeiten nutzt dieselbe Header-Hierarchie, ohne Log-Semantik zu übernehmen.
  await page.evaluate(() => {
    const date = window.__beikostTest.today();
    const day = window.__beikostTest.buildDays(date, 1)[0];
    const meal = day.meals.find((item) => item.meal === "lunch" && item.active) || day.meals.find((item) => item.active);
    if (!meal) throw new Error("Test benötigt eine aktive geplante Mahlzeit");
    window.__beikostTest.openManualMealSelector(date, meal.meal, meal);
  });
  await page.waitForFunction(() => document.getElementById("genericTitle")?.textContent === "Mahlzeit bearbeiten");
  assert.equal(await page.locator("#genericModal .flow-dialog-header").count(), 1);
  assert.equal(await page.locator("#confirmManualMeal").textContent(), "Änderungen speichern");
  await page.locator("#cancelManualMeal").click();

  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    "FLOW-C darf auf iPhone-Breite keinen horizontalen Seitenüberlauf erzeugen",
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("WebKit FLOW-C dialog unification regression passed.");
