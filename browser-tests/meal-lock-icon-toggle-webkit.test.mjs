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
    window.__beikostTest.getState()?.backupMeta?.storagePersisted !== "unknown",
  );
}

async function seedLockedLunch(page) {
  return page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const today = window.__beikostTest.today();
    state.settings.planFrom = today;

    const potato = state.foods.find((food) => food.id === "kartoffel");
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
      planId: "meal-lock-toggle-regression",
      createdAt: new Date().toISOString(),
    };

    window.__beikostTest.setState(state);
    return today;
  });
}

async function computedThemeColor(button, variableName) {
  return button.evaluate((node, cssVariable) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${cssVariable})`;
    document.body.appendChild(probe);
    const result = {
      actual: getComputedStyle(node).color,
      expected: getComputedStyle(probe).color,
    };
    probe.remove();
    return result;
  }, variableName);
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
  const today = await seedLockedLunch(page);

  const meal = page.locator("#todayCard .mealbox").filter({
    has: page.locator(`.meal-lock[data-lock-date="${today}"][data-lock-meal="lunch"]`),
  });
  await meal.waitFor();

  const lockedButton = meal.locator(".meal-lock.locked");
  await lockedButton.waitFor();
  assert.equal(await lockedButton.locator(".lock-svg-open").count(), 0, "Geschützter Slot zeigt das geschlossene Schloss");
  const lockedColors = await computedThemeColor(lockedButton, "--accent");
  assert.equal(lockedColors.actual, lockedColors.expected, "Der geschützte Zustand verwendet die Akzentfarbe");

  const lockedMarkup = await lockedButton.innerHTML();
  await lockedButton.click();

  const unlockedButton = meal.locator(".meal-lock.unlocked");
  await unlockedButton.waitFor();
  assert.equal(
    await unlockedButton.getAttribute("aria-label"),
    "Mahlzeit vor automatischer Änderung schützen",
    "Nach dem Tippen beschreibt die Aktion wieder das Sperren",
  );
  assert.equal(await unlockedButton.locator(".lock-svg-open").count(), 1, "Nach dem Tippen wird das offene Schloss gerendert");
  assert.notEqual(await unlockedButton.innerHTML(), lockedMarkup, "Das sichtbare Icon-Markup muss beim Entsperren wechseln");
  const unlockedColors = await computedThemeColor(unlockedButton, "--ochre");
  assert.equal(unlockedColors.actual, unlockedColors.expected, "Der offene Zustand erhält wieder die eindeutige Ocker-Farbe");

  const afterUnlock = await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    return !!state.planLocks?.[`${date}|lunch`];
  }, today);
  assert.equal(afterUnlock, false, "Der Tap hebt den Lock auch im Zustand auf");

  await unlockedButton.click();
  const relockedButton = meal.locator(".meal-lock.locked");
  await relockedButton.waitFor();
  assert.equal(await relockedButton.locator(".lock-svg-open").count(), 0, "Beim erneuten Tippen erscheint wieder das geschlossene Schloss");
  const relockedColors = await computedThemeColor(relockedButton, "--accent");
  assert.equal(relockedColors.actual, relockedColors.expected, "Beim erneuten Sperren wird wieder die Akzentfarbe verwendet");

  const afterRelock = await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    return state.planLocks?.[`${date}|lunch`]?.mode || "";
  }, today);
  assert.equal(afterRelock, "manual", "Erneutes Tippen schützt den Slot wieder manuell");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
