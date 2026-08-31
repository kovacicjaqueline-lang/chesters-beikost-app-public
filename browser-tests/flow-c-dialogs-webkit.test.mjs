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
  const freeLogBaseline = await page.evaluate(() => {
    window.__beikostTest.reset();
    return window.__beikostTest.getState().logs;
  });
  await page.evaluate(() => window.openLog(null));
  await page.waitForFunction(() => document.getElementById("logForm")?.classList.contains("flow-dialog-body"));
  assert.equal(await page.locator("#logModal").evaluate((node) => node.classList.contains("flow-dialog")), true);
  assert.equal(await page.locator("#logTitle").textContent(), "Essen eintragen");
  assert.equal(await page.locator("#logMeal").count(), 0);
  assert.equal(await page.locator("#logForm .flow-dialog-actions").count(), 1);
  assert.equal(await page.locator("#logFoodSearch").evaluate((node) => getComputedStyle(node).fontSize), "16px");
  assert.equal(await page.locator(".log-food-results").evaluate((node) => getComputedStyle(node).overflowY), "visible");
  assertInsideViewport(await page.locator("#logForm .flow-dialog-actions").boundingBox(), width, height, "Log-Aktionsleiste");
  await page.locator("#cancelLog").click();
  assert.deepEqual(
    await page.evaluate(() => window.__beikostTest.getState().logs),
    freeLogBaseline,
    "Abbrechen darf den bestehenden Protokollzustand nicht verändern",
  );

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
  assert.equal(await page.locator("#genericBody .selector-results").evaluate((node) => getComputedStyle(node).overflowY), "visible");
  await page.locator("#cancelManualMeal").click();
  assert.equal(await page.locator("#genericModal").evaluate((node) => node.classList.contains("open")), false);

  // Geplante Karotten-Mahlzeit bearbeiten: Header bleibt im gemeinsamen Flow und die
  // explizit strukturierte FOOD-Darreichung muss unter Name/Entfernen statt daneben liegen.
  await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const karotte = state.foods.find((item) => item.id === "karotte");
    if (!karotte) throw new Error("Test benötigt das Lebensmittel Karotte");
    karotte.manualStatus = "Verträgliche Basis";
    window.__beikostTest.setState(state);
    window.__beikostTest.openManualMealSelector(window.__beikostTest.today(), "lunch", {
      meal: "lunch",
      active: true,
      focusId: "karotte",
      foodIds: ["karotte"],
      baseFoodIds: ["karotte"],
      sampleFoodIds: [],
      foodRoles: { karotte: "base" },
      type: "known",
    });
  });
  await page.waitForFunction(() => document.getElementById("genericTitle")?.textContent === "Mahlzeit bearbeiten");
  assert.equal(await page.locator("#genericModal .flow-dialog-header").count(), 1);
  assert.equal(await page.locator("#confirmManualMeal").textContent(), "Änderungen speichern");

  const carrotPreparation = page.locator('[data-manual-preparation="karotte"]');
  await carrotPreparation.waitFor();
  const carrotItem = page.locator(".manual-role-item").filter({ has: carrotPreparation });
  assert.equal(await carrotItem.count(), 1, "Karotte muss genau eine Rollen-/Darreichungszeile besitzen");
  assert.equal(
    await carrotItem.evaluate((node) => getComputedStyle(node).display),
    "grid",
    "Rollenzeile mit Darreichung muss als zweizeiliges Grid gerendert werden",
  );

  const itemBox = await carrotItem.boundingBox();
  const foodBox = await carrotItem.locator(":scope > .grow").boundingBox();
  const actionBox = await carrotItem.locator(":scope > .manual-role-actions").boundingBox();
  const preparationBox = await carrotItem.locator(":scope > .manual-preparation-field").boundingBox();
  assert.ok(itemBox && foodBox && actionBox && preparationBox, "Karotten-Editor muss vollständig messbar sein");
  assert.ok(
    preparationBox.y >= Math.max(foodBox.y + foodBox.height, actionBox.y + actionBox.height) - 1,
    "Darreichung darf Karotte oder den Entfernen-Button nicht überlagern",
  );
  assert.ok(
    preparationBox.x >= itemBox.x - 1 && preparationBox.x + preparationBox.width <= itemBox.x + itemBox.width + 1,
    "Darreichungsfeld muss innerhalb der Rollenkarte die volle verfügbare Zeile nutzen",
  );
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