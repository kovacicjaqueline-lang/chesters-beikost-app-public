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
    fs.stat(filePath, (statError, stat) => {
      if (statError || !stat.isFile()) {
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
    !!window.__beikostTest?.getState &&
    typeof window.openLog === "function" &&
    typeof window.editLogEntry === "function",
  );
}

async function selectFood(page, name) {
  const search = page.locator("#logFoodSearch");
  await search.fill(name);
  const result = page.locator(".addLogFoodResult").filter({ hasText: name }).first();
  await result.waitFor();
  await result.click();
}

async function reset(page) {
  await page.evaluate(() => {
    const state = window.__beikostTest.reset();
    state.logs = [];
    state.followUps = {};
    state.shoppingHints = {};
    state.backupMeta.chesterContextSeeded = true;
    window.__beikostTest.setState(state);
  });
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
const page = await context.newPage();

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // 1. Freier Eintrag: keine künstliche Mahlzeit, bewusste Textur, Rollenpersistenz.
  await reset(page);
  await page.evaluate(() => window.openLog(null));
  assert.equal(await page.locator("#logMeal").count(), 0, "Freier Eintrag darf keine Mahlzeitenauswahl anzeigen");
  assert.equal(await page.locator("#logTexture").inputValue(), "", "Neue Textur darf nicht vorausgewählt sein");
  await selectFood(page, "Karotte");
  await page.locator("#logTexture").selectOption("1");
  await page.locator("#logAmount").fill("5");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);

  let freeLog = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(freeLog.entryType, "food");
  assert.equal(freeLog.meal, "");
  assert.equal(freeLog.textureKnown, true);
  assert.equal(freeLog.textureStage, 1);
  assert.equal(freeLog.amount, "5");
  assert.deepEqual(freeLog.sampleFoodIds, ["karotte"]);
  assert.equal(freeLog.foodRoles.karotte, "sample");
  assert.equal(await page.evaluate(() => successfulMealSlotCount(today())), 0, "Freier Eintrag darf kein Phasen-Mahlzeitenslot sein");

  // Bearbeiten ersetzt denselben Log und behält Rollen; Reload behält echte Textur.
  const freeId = freeLog.id;
  await page.evaluate((id) => window.editLogEntry(id), freeId);
  await page.locator("#logTexture").selectOption("2");
  await page.locator("#logAmount").fill("8");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
  let edited = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(edited.id, freeId);
  assert.equal(edited.textureStage, 2);
  assert.equal(edited.amount, "8");
  assert.equal(edited.foodRoles.karotte, "sample");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  let reloaded = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(reloaded.id, freeId);
  assert.equal(reloaded.meal, "");
  assert.equal(reloaded.textureKnown, true);
  assert.equal(reloaded.textureStage, 2);
  assert.equal(reloaded.foodRoles.karotte, "sample");

  // 2. Legacy-Kostprobe: unbekannte historische Textur bleibt beim Bearbeiten unbekannt.
  await reset(page);
  await page.evaluate(() => {
    const state = window.__beikostTest.getState();
    state.logs = [{
      id: "legacy-sample",
      date: window.__beikostTest.today(),
      meal: "lunch",
      entryType: "sample",
      foodIds: ["karotte"],
      focusId: "karotte",
      baseFoodIds: [],
      sampleFoodIds: ["karotte"],
      foodRoles: { karotte: "sample" },
      foodOutcomes: { karotte: "tried" },
      outcome: "tried",
      textureStage: 4,
    }];
    window.__beikostTest.setState(state);
  });
  let migratedLegacy = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(migratedLegacy.textureKnown, false);
  assert.equal(Object.hasOwn(migratedLegacy, "textureStage"), false);
  await page.evaluate(() => window.editLogEntry("legacy-sample"));
  assert.equal(await page.locator("#logTexture").inputValue(), "");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => document.getElementById("logModal") && !document.getElementById("logModal").classList.contains("open"));
  let savedLegacy = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(savedLegacy.entryType, "food");
  assert.equal(savedLegacy.meal, "");
  assert.equal(savedLegacy.textureKnown, false);
  assert.equal(Object.hasOwn(savedLegacy, "textureStage"), false);

  // 3. Nicht angeboten: keine Konsistenzpflicht.
  await reset(page);
  await page.evaluate(() => window.openLog(null));
  await selectFood(page, "Karotte");
  await page.locator('[data-sample-result="karotte"]').selectOption("not_offered");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
  let notOffered = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(notOffered.foodOutcomes.karotte, "not_offered");
  assert.equal(notOffered.textureKnown, false);
  assert.equal(Object.hasOwn(notOffered, "textureStage"), false);

  // 4. Geplanter Eintrag: Slot wird übernommen und nicht erneut gewählt.
  await reset(page);
  await page.evaluate(() => window.openLog({
    date: window.__beikostTest.today(),
    meal: "lunch",
    focusId: "karotte",
    foodIds: ["karotte"],
    baseFoodIds: ["karotte"],
    sampleFoodIds: [],
    foodRoles: { karotte: "base" },
    foodOutcomes: { karotte: "eaten" },
    entryType: "meal",
  }));
  assert.equal(await page.locator("#logMeal").count(), 0);
  assert.match(await page.locator("#logForm").innerText(), /Geplante Mahlzeit[\s\S]*Mittagessen/);
  await page.locator("#logTexture").selectOption("1");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
  let planned = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(planned.meal, "lunch");
  assert.equal(planned.entryType, "food");
  assert.equal(planned.foodRoles.karotte, "base");
  assert.equal(await page.evaluate(() => successfulMealSlotCount(today())), 1);

  // 5. Familienstatus: zwei freie Gaben am selben Tag bleiben zwei Expositionen.
  await reset(page);
  await page.evaluate(() => {
    const state = window.__beikostTest.getState();
    const date = window.__beikostTest.today();
    state.logs = [
      { id: "free-1", date, meal: "", entryType: "food", foodIds: ["sesam"], focusId: "sesam", baseFoodIds: ["sesam"], sampleFoodIds: [], foodRoles: { sesam: "base" }, foodOutcomes: { sesam: "eaten" }, outcome: "eaten", textureKnown: true, textureStage: 1 },
      { id: "free-2", date, meal: "", entryType: "food", foodIds: ["sesam"], focusId: "sesam", baseFoodIds: ["sesam"], sampleFoodIds: [], foodRoles: { sesam: "base" }, foodOutcomes: { sesam: "eaten" }, outcome: "eaten", textureKnown: true, textureStage: 1 },
    ];
    window.__beikostTest.setState(state);
  });
  assert.equal(
    await page.evaluate(() => window.__beikostTest.familySuccessfulExposureCount("sesam")),
    2,
    "Freie Gaben dürfen im Familienstatus nicht über date|meal zusammenfallen",
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("WebKit unified food log integration regression passed.");
