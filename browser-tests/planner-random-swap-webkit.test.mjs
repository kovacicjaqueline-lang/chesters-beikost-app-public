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

function canonical(ids = []) {
  return [...new Set(ids)].filter(Boolean).sort().join("+");
}

function normalizePlan(days) {
  const result = {};
  for (const day of days || []) {
    for (const meal of day.meals || []) {
      if (!meal?.active || meal.empty || !meal.focusId) continue;
      result[`${day.date}|${meal.meal}`] = {
        foods: canonical(meal.foodIds || []),
        recipe: meal.recipeName || "",
      };
    }
  }
  return result;
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
  await page.waitForFunction(() => !!window.__beikostTest?.buildDays && !!window.__plannerRandomSwap);

  const setup = await page.evaluate(() => {
    window.__beikostTest.reset();
    const today = window.__beikostTest.today();
    const state = window.__beikostTest.getState();
    state.settings.phaseSelected = "aufbau";
    state.settings.planFrom = today;
    state.settings.preferInventoryInPlan = false;
    state.settings.newFoodEvery = 99;
    state.deferred ||= {};
    state.deferred[today] = true;
    state.inventory = [];
    for (const food of state.foods) {
      if (food.active && food.autoPlan !== false && (food.meals || []).some((meal) => ["breakfast", "lunch"].includes(meal))) {
        food.manualStatus = "Regelmäßig";
      }
    }
    window.__beikostTest.setState(state);
    const days = window.__beikostTest.buildDays(today, 7);
    return { today, days };
  });

  const before = normalizePlan(setup.days);
  const targetKey = `${setup.today}|lunch`;
  assert.ok(before[targetKey]?.foods, "heutiges Mittagessen muss vor dem Tausch geplant sein");

  const todayButton = page.locator(`.today-randomize-meal[data-random-date="${setup.today}"][data-random-meal="lunch"]`);
  await todayButton.waitFor();
  assert.equal(await todayButton.innerText(), "↻ Tauschen", "Heute muss den expliziten Tausch-Button zeigen");

  const planButton = page.locator(`#blockPlan .randomizeMeal[data-random-date="${setup.today}"][data-random-meal="lunch"]`);
  assert.equal(await planButton.count(), 1, "derselbe Slot muss auch im Wochenplan einen Tausch-Button haben");

  await todayButton.click();
  await page.waitForFunction(({ key, previous }) => {
    const lock = window.__beikostTest.getState().planLocks?.[key];
    const current = [...new Set(lock?.foodIds || [])].filter(Boolean).sort().join("+");
    return !!current && current !== previous;
  }, { key: targetKey, previous: before[targetKey].foods });

  assert.match(await page.locator("#toastText").innerText(), /restliche Wochenplan bleibt unverändert/i);

  const afterDays = await page.evaluate((today) => window.__beikostTest.buildDays(today, 7), setup.today);
  const after = normalizePlan(afterDays);
  assert.notEqual(after[targetKey]?.foods, before[targetKey]?.foods, "gewählter Slot muss tatsächlich eine andere Kombination erhalten");

  for (const [key, value] of Object.entries(before)) {
    if (key === targetKey) continue;
    assert.deepEqual(after[key], value, `anderer sichtbarer Plan-Slot darf sich nicht ändern: ${key}`);
  }

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
