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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() =>
    !!window.__beikostTest?.setState &&
    window.__mobileFoundationInstalled === true &&
    window.__mobilePrepInstalled === true,
  );

  const seeded = await page.evaluate(() => {
    const api = window.__beikostTest;
    const state = api.getState();
    const today = api.today();
    const tomorrow = api.addDays(today, 1);
    const karotte = state.foods.find((item) => item.id === "karotte");
    const brokkoli = state.foods.find((item) => item.id === "brokkoli");
    if (!karotte || !brokkoli) return false;

    state.settings.phaseSelected = "drei";
    state.settings.planFrom = today;
    state.planLocks ||= {};
    state.autoLockExcluded ||= {};
    state.inventory = [{
      id: "mobile-prep-karotte-stock",
      kind: "food",
      foodId: "karotte",
      portions: 1,
      size: "20 g",
      gramsPerPortion: 20,
      frozenDate: today,
      note: "Testbestand",
    }];
    state.pantry = {};

    const makeLock = (date, foodId, planId) => ({
      date,
      meal: "lunch",
      focusId: foodId,
      foodIds: [foodId],
      baseFoodIds: [foodId],
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
      planId,
      createdAt: new Date().toISOString(),
    });
    state.planLocks[`${today}|lunch`] = makeLock(today, "karotte", "mobile-prep-today");
    state.planLocks[`${tomorrow}|lunch`] = makeLock(tomorrow, "brokkoli", "mobile-prep-tomorrow");
    delete state.autoLockExcluded[`${today}|lunch`];
    delete state.autoLockExcluded[`${tomorrow}|lunch`];
    api.setState(state);
    return true;
  });
  assert.equal(seeded, true, "Testlebensmittel müssen im aktuellen FOOD-Stamm vorhanden sein");

  await page.locator('nav button[data-view="prep"]').click();
  assert.equal(await page.locator("#appBarTitle").innerText(), "Prep");

  const segmentLabels = await page.locator("#prep .prep-segments button").allTextContents();
  assert.deepEqual(segmentLabels.map((text) => text.trim()), ["Vorbereiten", "Einkauf", "Vorrat"]);
  assert.equal(await page.locator('#prep [data-prep-panel="prepare"]').getAttribute("aria-selected"), "true");

  await page.evaluate(() => {
    const api = window.__beikostTest;
    const state = api.getState();
    state.shoppingHints = {
      brokkoli: {
        foodId: "brokkoli",
        status: "needed",
        sourceLogId: "mobile-prep-legacy-hint",
      },
    };
    api.setState(state);
  });
  await page.locator('nav button[data-view="home"]').click();
  await page.locator('nav button[data-view="prep"]').click();
  assert.equal(
    await page.locator('#prep [data-prep-panel="prepare"]').getAttribute("aria-selected"),
    "true",
    "Nicht-Plan-Einkaufshinweise dürfen Prep nicht vom primären Vorbereiten-Segment weglenken",
  );
  assert.equal(
    await page.locator("#prepPanelPrepare").evaluate((node) => node.hidden),
    false,
    "Vorbereiten bleibt bei einem normalen Einkaufshinweis sichtbar",
  );
  await page.evaluate(() => {
    const api = window.__beikostTest;
    const state = api.getState();
    state.shoppingHints = {};
    api.setState(state);
  });

  assert.ok(await page.locator("#prepToday .prep-task-mobile").count() >= 1, "Heute fällige Vorbereitung wird als kompakte Aufgabe gezeigt");
  assert.ok(await page.locator("#prepTomorrow .prep-task-mobile").count() >= 1, "Morgen fällige Vorbereitung wird getrennt gezeigt");
  assert.ok(await page.locator("#prepToday .prep-task-marker").count() >= 1, "Vorbereitung nutzt die mobile Checklisten-Darstellung");
  assert.equal(await page.locator("#prepCoveredGroup").evaluate((node) => node.open), false, "Gedeckter Vorrat ist standardmäßig verdichtet");
  assert.equal(await page.locator("#prepTools").evaluate((node) => node.open), false, "Werkzeuge bleiben sekundär und eingeklappt");

  await page.locator('#prep [data-prep-panel="shopping"]').click();
  assert.equal(await page.locator("#prepPanelShopping").evaluate((node) => node.hidden), false);
  assert.ok(await page.locator("#shoppingList .prep-shopping-category").count() >= 1, "Einkauf wird nach bestehenden Lebensmittelkategorien gruppiert");
  const shoppingRows = page.locator("#shoppingList .shopping-row");
  assert.ok(await shoppingRows.count() >= 1, "Einkauf bleibt eine kompakte Zeilenliste");
  assert.equal(await shoppingRows.first().locator(".shopping-toggle").count(), 1, "Jede Einkaufszeile behält eine Checkbox-Interaktion");
  assert.ok((await shoppingRows.first().locator(".prep-shopping-copy > .small").innerText()).trim().length > 0, "Benötigte Menge steht direkt in der Einkaufszeile");

  const firstPantryId = await shoppingRows.first().locator("[data-pantry]").getAttribute("data-pantry");
  await shoppingRows.first().click();
  await page.waitForFunction((foodId) => window.__beikostTest.getState().pantry?.[foodId] === true, firstPantryId);
  assert.equal(await page.locator("#prepPanelShopping").evaluate((node) => node.hidden), false, "Aktiver Segmentzustand bleibt nach Einkaufsänderung erhalten");

  await page.locator('#prep [data-prep-panel="stock"]').click();
  assert.equal(await page.locator("#prepPanelStock").evaluate((node) => node.hidden), false);
  const stockGroup = page.locator("#inventoryList .prep-stock-group").filter({ hasText: "Karotte" }).first();
  await stockGroup.waitFor();
  assert.match((await stockGroup.innerText()).replace(/\s+/g, " "), /1 Portion|1 ×/);
  assert.match((await stockGroup.innerText()).replace(/\s+/g, " "), /eingefroren/);
  assert.match((await stockGroup.locator(".prep-stock-status").innerText()).trim(), /gedeckt|knapp|frei|fehlt/);
  assert.match((await stockGroup.locator(".stockline .pill").first().innerText()).trim(), /Tag|Tage/);

  await page.locator('#prep [data-prep-panel="prepare"]').click();
  await page.locator("#prepOpenRecipes").click();
  await page.waitForFunction(() => document.getElementById("foods")?.classList.contains("active"));
  assert.equal(await page.locator("#appBarTitle").innerText(), "Beikost");
  assert.equal(await page.locator('#catalogSwitch [data-catalog-mode="recipes"]').getAttribute("aria-pressed"), "true", "Prep-Rezeptaktion führt weiterhin direkt in den Rezeptkatalog");

  await page.locator('nav button[data-view="prep"]').click();
  const stickyPosition = await page.evaluate(async () => {
    const main = document.querySelector("main");
    const segments = document.querySelector("#prep .prep-segments");
    if (!main || !segments) return null;
    main.scrollTop = 0;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const maxScroll = Math.max(0, main.scrollHeight - main.clientHeight);
    main.scrollTop = Math.min(500, maxScroll);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      scrollTop: main.scrollTop,
      mainTop: main.getBoundingClientRect().top,
      segmentTop: segments.getBoundingClientRect().top,
    };
  });
  assert.ok(stickyPosition?.scrollTop > 80, "Prep-Inhalt muss für den Sticky-Regressionscheck im main-Scrollcontainer scrollen");
  const stickyOffset = stickyPosition.segmentTop - stickyPosition.mainTop;
  assert.ok(stickyOffset >= -1 && stickyOffset <= 20, `Prep-Segmente müssen am oberen Rand des main-Scrollcontainers sticky bleiben (Offset ${stickyOffset}px)`);

  const overflow = await page.locator("main").evaluate((node) => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
  assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1, "Prep darf auf 390 px nicht horizontal überlaufen");
  assert.deepEqual(pageErrors, [], "Der Mobile-Prep-Fluss darf keine Page-Errors erzeugen");

  await context.close();
  console.log("mobile-prep-webkit: ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
