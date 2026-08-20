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

async function visiblePlan(page) {
  return page.locator("#blockPlan .logMeal[data-plan]").evaluateAll((buttons) => {
    const groups = {};
    for (const button of buttons) {
      const payload = JSON.parse(decodeURIComponent(button.dataset.plan || ""));
      const key = `${payload.date}|${payload.meal}`;
      const entry = {
        foods: [...new Set(payload.foodIds || [])].filter(Boolean).sort().join("+"),
        recipe: payload.recipeName || "",
        planId: payload.planId || payload.plannedMealId || "",
      };
      (groups[key] ||= []).push(entry);
    }
    for (const entries of Object.values(groups)) {
      entries.sort((a, b) => `${a.planId}|${a.foods}|${a.recipe}`.localeCompare(`${b.planId}|${b.foods}|${b.recipe}`));
    }
    return groups;
  });
}

async function configurePlanner(page, planOffsetDays) {
  return page.evaluate((offset) => {
    window.__beikostTest.reset();
    const current = window.__beikostTest.today();
    const state = window.__beikostTest.getState();
    state.settings.phaseSelected = "aufbau";
    state.settings.planFrom = window.__beikostTest.addDays(current, offset);
    state.settings.preferInventoryInPlan = false;
    state.settings.newFoodEvery = 99;
    state.deferred ||= {};
    state.deferred[current] = true;
    state.inventory = [];
    for (const food of state.foods) {
      if (food.active && food.autoPlan !== false && (food.meals || []).some((meal) => ["breakfast", "lunch"].includes(meal))) {
        food.manualStatus = "Regelmäßig";
      }
    }
    window.__beikostTest.setState(state);
    return current;
  }, planOffsetDays);
}

async function todayMealFoods(page, meal) {
  const button = page.locator(`#todayCard .homeLog[data-plan]`).filter({ has: undefined });
  const payloads = await button.evaluateAll((buttons) => buttons.map((entry) => JSON.parse(decodeURIComponent(entry.dataset.plan || ""))));
  const payload = payloads.find((entry) => entry.meal === meal);
  return canonical(payload?.foodIds || []);
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

  const today = await configurePlanner(page, 0);
  const targetKey = `${today}|lunch`;
  const todayButton = page.locator(`.today-randomize-meal[data-random-date="${today}"][data-random-meal="lunch"]`);
  await todayButton.waitFor();
  assert.equal(await todayButton.innerText(), "↻ Tauschen", "Heute muss den expliziten Tausch-Button zeigen");

  const planButton = page.locator(`#blockPlan .randomizeMeal[data-random-date="${today}"][data-random-meal="lunch"]`);
  assert.equal(await planButton.count(), 1, "derselbe Slot muss auch im Wochenplan einen Tausch-Button haben");

  const before = await visiblePlan(page);
  assert.equal(before[targetKey]?.length, 1, "heutiges Mittagessen muss im sichtbaren Wochenplan genau einmal offen geplant sein");
  const previousTarget = before[targetKey][0].foods;

  await todayButton.click();
  await page.waitForFunction(({ key, previous }) => {
    const lock = window.__beikostTest.getState().planLocks?.[key];
    const current = [...new Set(lock?.foodIds || [])].filter(Boolean).sort().join("+");
    return !!current && current !== previous;
  }, { key: targetKey, previous: previousTarget });

  assert.match(await page.locator("#toastText").innerText(), /restliche Wochenplan bleibt unverändert/i);

  const after = await visiblePlan(page);
  assert.equal(after[targetKey]?.length, 1, "getauschter Slot muss im sichtbaren Wochenplan genau einmal offen bleiben");
  assert.notEqual(after[targetKey][0].foods, previousTarget, "gewählter sichtbarer Slot muss tatsächlich eine andere Kombination erhalten");
  for (const [key, value] of Object.entries(before)) {
    if (key === targetKey) continue;
    assert.deepEqual(after[key], value, `anderer tatsächlich sichtbarer Plan-Slot darf sich nicht ändern: ${key}`);
  }
  for (const key of Object.keys(after)) {
    if (key === targetKey) continue;
    assert.ok(before[key], `Tausch darf keinen zusätzlichen sichtbaren Plan-Slot erzeugen: ${key}`);
  }

  const shiftedToday = await configurePlanner(page, 1);
  const shiftedTargetKey = `${shiftedToday}|lunch`;
  const visibleBeforeTodaySwap = await visiblePlan(page);
  const previousTodayFoods = await todayMealFoods(page, "lunch");
  assert.ok(previousTodayFoods, "Heute muss auch bei ab morgen sichtbarem Wochenplan ein Mittagessen enthalten");

  const shiftedTodayButton = page.locator(`.today-randomize-meal[data-random-date="${shiftedToday}"][data-random-meal="lunch"]`);
  await shiftedTodayButton.waitFor();
  await shiftedTodayButton.click();
  await page.waitForFunction(({ key, previous }) => {
    const lock = window.__beikostTest.getState().planLocks?.[key];
    const current = [...new Set(lock?.foodIds || [])].filter(Boolean).sort().join("+");
    return !!current && current !== previous;
  }, { key: shiftedTargetKey, previous: previousTodayFoods });

  const visibleAfterTodaySwap = await visiblePlan(page);
  assert.deepEqual(
    visibleAfterTodaySwap,
    visibleBeforeTodaySwap,
    "Tausch auf Heute darf einen separat ab morgen angezeigten Wochenplan nicht verändern",
  );

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
