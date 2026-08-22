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
    window.__plannerPoliciesReady === true,
  );
}

async function seedUnifiedMeal(page) {
  return page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const date = window.__beikostTest.today();
    state.settings.planFrom = date;

    for (const id of ["kartoffel", "gurke"]) {
      const item = state.foods.find((food) => food.id === id);
      if (item) item.manualStatus = "Verträgliche Basis";
    }

    const key = `${date}|lunch`;
    const meal = {
      date,
      meal: "lunch",
      focusId: "kartoffel",
      foodIds: ["kartoffel", "gurke"],
      baseFoodIds: ["kartoffel", "gurke"],
      sampleFoodIds: [],
      optionalAddons: [],
      inventoryFoodIds: ["kartoffel"],
      recipeName: "",
      recipeInventoryId: "",
      type: "bekannt kombinieren",
      note: "",
      manualAdded: false,
      createdAt: new Date().toISOString(),
    };
    state.manualMeals[key] = meal;
    state.planLocks[key] = { ...meal, mode: "auto", active: true };
    window.__beikostTest.setState(state);
    return date;
  });
}

function assertMealActions(text) {
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
  await seedUnifiedMeal(page);

  const homeMeal = page.locator("#todayCard .mealbox", { hasText: "Kartoffel" }).first();
  await homeMeal.waitFor();
  assertMealActions(await homeMeal.innerText());
  await homeMeal.locator(".meal-lock.locked").waitFor();
  assert.equal(await homeMeal.locator(".lock-label").count(), 0, "Heute zeigt keine sichtbare Fest-eingeplant-Info");
  assert.equal(await homeMeal.locator(".stock-chip").innerText(), "❄️ Kartoffel");
  assert.equal(await homeMeal.locator(".stock-chip").getAttribute("aria-label"), "Aus Vorrat: Kartoffel");

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
  const planMeal = page.locator("#blockPlan .mealbox", { hasText: "Kartoffel" }).first();
  await planMeal.waitFor();
  assertMealActions(await planMeal.innerText());
  await planMeal.locator(".meal-lock.locked").waitFor();
  assert.equal(await planMeal.locator(".lock-label").count(), 0, "Plan zeigt keine sichtbare Fest-eingeplant-Info");
  assert.equal(await planMeal.locator(".stock-chip").innerText(), "❄️ Kartoffel");

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

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("meal-card-unification-webkit: ok");
