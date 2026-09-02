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
    !!window.__plannerRandomSwap &&
    window.__plannerPoliciesReady === true &&
    window.__plannerKeepPolicyInstalled === true &&
    window.__beikostTest.getState()?.backupMeta?.storagePersisted !== "unknown",
  );
}

async function resetPlan(page) {
  return page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const today = window.__beikostTest.today();
    state.settings.planFrom = today;

    const potato = state.foods.find((food) => food.id === "kartoffel");
    if (potato) potato.manualStatus = "Verträgliche Basis";

    window.__beikostTest.setState(state);
    window.renderAll();
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
  const today = await resetPlan(page);

  const automaticLock = await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    return state.planLocks?.[`${date}|lunch`] || null;
  }, today);
  assert.equal(automaticLock, null, "Der Planner erzeugt für heute keinen pauschalen Auto-Lock mehr");

  const meal = page.locator("#todayCard .mealbox").filter({
    has: page.locator(`.meal-lock[data-lock-date="${today}"][data-lock-meal="lunch"]`),
  });
  await meal.waitFor();

  const unlockedButton = meal.locator(".meal-lock.unlocked");
  await unlockedButton.waitFor();
  assert.equal(
    await unlockedButton.getAttribute("aria-label"),
    "Mahlzeit bei automatischer Neuplanung behalten",
    "Das offene Schloss beschreibt den bewussten Behalten-Zustand",
  );
  assert.equal(await unlockedButton.locator(".lock-svg-open").count(), 1, "Ungeschützter Slot zeigt das offene Schloss");
  const unlockedColors = await computedThemeColor(unlockedButton, "--ochre");
  assert.equal(unlockedColors.actual, unlockedColors.expected, "Der offene Zustand verwendet die Ocker-Farbe");

  const unlockedMarkup = await unlockedButton.innerHTML();
  await unlockedButton.click();

  const lockedButton = meal.locator(".meal-lock.locked");
  await lockedButton.waitFor();
  assert.equal(await lockedButton.locator(".lock-svg-open").count(), 0, "Behalten zeigt das geschlossene Schloss");
  assert.notEqual(await lockedButton.innerHTML(), unlockedMarkup, "Das sichtbare Icon-Markup wechselt beim Behalten");
  assert.equal(
    await lockedButton.getAttribute("aria-label"),
    "Mahlzeit bei automatischer Neuplanung wieder freigeben",
    "Der geschützte Zustand beschreibt das Freigeben",
  );
  assert.equal(await meal.locator(".lock-label").textContent(), "Behalten", "Die sichtbare Beschriftung heißt Behalten");
  const lockedColors = await computedThemeColor(lockedButton, "--accent");
  assert.equal(lockedColors.actual, lockedColors.expected, "Der Behalten-Zustand verwendet die Akzentfarbe");

  const afterKeep = await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    window.renderAll();
    return state.planLocks?.[`${date}|lunch`]?.mode || "";
  }, today);
  assert.equal(afterKeep, "manual", "Behalten speichert einen manuellen Lock und überlebt erneutes Rendern");

  await meal.locator(".meal-lock.locked").click();
  await meal.locator(".meal-lock.unlocked").waitFor();
  const afterRelease = await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    return !!state.planLocks?.[`${date}|lunch`];
  }, today);
  assert.equal(afterRelease, false, "Freigeben entfernt den manuellen Lock wieder");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
