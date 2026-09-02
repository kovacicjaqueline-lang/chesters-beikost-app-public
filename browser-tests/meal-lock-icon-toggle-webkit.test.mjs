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
    window.__plannerKeepTrackingInstalled === true &&
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

  const trackingState = await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    const tracking = state.planLocks?.[`${date}|lunch`] || null;
    const addIsoDays = (value, count) => {
      const d = new Date(`${value}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + count);
      return d.toISOString().slice(0, 10);
    };
    const until = addIsoDays(date, 2);
    const futureGenericLocks = Object.entries(state.planLocks || {}).filter(([key, lock]) => {
      const lockDate = key.split("|")[0];
      return lockDate > date && lockDate <= until && lock?.mode === "auto" && !lock?.followUpFoodId && !lock?.randomSwapPinned && !lock?.randomSwapPreserved && !lock?.randomSwapTarget;
    });
    return {
      mode: tracking?.mode || "",
      tracking: !!tracking?.plannerTrackingSnapshot,
      futureGenericLocks: futureGenericLocks.length,
    };
  }, today);
  assert.equal(trackingState.mode, "auto", "Der heutige Plan behält intern eine Plan-ID für Tageswechsel und Log-Verknüpfung");
  assert.equal(trackingState.tracking, true, "Der heutige Snapshot ist ausdrücklich nur Tracking und kein Schutz");
  assert.equal(trackingState.futureGenericLocks, 0, "Morgen und übermorgen werden nicht mehr pauschal automatisch fixiert");

  const meal = page.locator("#todayCard .mealbox").filter({
    has: page.locator(`.meal-lock[data-lock-date="${today}"][data-lock-meal="lunch"]`),
  });
  await meal.waitFor();

  const unlockedButton = meal.locator(".meal-lock.unlocked");
  await unlockedButton.waitFor();
  assert.equal(
    await unlockedButton.getAttribute("aria-label"),
    "Mahlzeit bei automatischer Neuplanung behalten",
    "Der interne Tracking-Snapshot erscheint für die Nutzerin als ungeschützt",
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
    const lock = state.planLocks?.[`${date}|lunch`];
    return { mode: lock?.mode || "", tracking: !!lock?.plannerTrackingSnapshot };
  }, today);
  assert.deepEqual(afterKeep, { mode: "manual", tracking: false }, "Behalten ersetzt das interne Tracking durch einen echten manuellen Schutz");

  await meal.locator(".meal-lock.locked").click();
  await meal.locator(".meal-lock.unlocked").waitFor();
  const afterRelease = await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    const lock = state.planLocks?.[`${date}|lunch`];
    return { mode: lock?.mode || "", tracking: !!lock?.plannerTrackingSnapshot };
  }, today);
  assert.deepEqual(afterRelease, { mode: "auto", tracking: true }, "Freigeben stellt nur den unsichtbaren Tageswechsel-Tracking-Snapshot wieder her");

  await page.locator('nav button[data-view="plan"]').click();
  assert.equal(await page.locator("#planLockSummary .plan-lock-text").textContent(), "Keine Mahlzeit bewusst behalten", "Tracking wird nicht als geschützte Mahlzeit zusammengezählt");
  const rebuildButton = page.locator("#planRecalculate");
  await rebuildButton.waitFor();
  assert.equal(await rebuildButton.textContent(), "Woche neu planen", "Es gibt eine eindeutige sichtbare Wochen-Neuplanung");
  assert.equal(await page.locator("#planRebuildAll").isHidden(), true, "Die alte zweite Neuplanungsaktion ist ausgeblendet");
  await rebuildButton.click();
  assert.equal(await page.locator("#genericTitle").textContent(), "Woche neu planen", "Die Wochen-Neuplanung öffnet den vereinfachten Dialog");
  assert.equal(await page.locator("#confirmPlanRebuild").count(), 1, "Der Dialog bietet genau eine Neuplanungsbestätigung");
  assert.equal(await page.locator("#rebuildKeepLocks").count(), 0, "Die alte Variante mit Schutz-Auswahl ist entfernt");
  assert.equal(await page.locator("#rebuildReleaseLocks").count(), 0, "Die alte Variante zum Lösen manueller Locks ist entfernt");
  await page.locator("#cancelPlanRebuild").click();

  const completedTracking = await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    const key = `${date}|lunch`;
    const lock = state.planLocks?.[key];
    if (!lock?.planId) return { before: "", after: "", tracking: false };
    state.logs.push({
      id: "meal-lock-tracking-completion",
      date,
      meal: "lunch",
      plannedMealId: lock.planId,
      focusId: lock.focusId,
      foodIds: [...(lock.foodIds || [])],
      baseFoodIds: [...(lock.baseFoodIds || [])],
      sampleFoodIds: [...(lock.sampleFoodIds || [])],
      outcome: "eaten",
      createdAt: new Date().toISOString(),
    });
    window.__beikostTest.setState(state);
    const next = window.__beikostTest.getState().planLocks?.[key];
    return {
      before: lock.planId,
      after: next?.planId || "",
      tracking: !!next?.plannerTrackingSnapshot,
    };
  }, today);
  assert.equal(completedTracking.after, completedTracking.before, "Protokollieren erhält die Tracking-Plan-ID für die Log-Verknüpfung");
  assert.equal(completedTracking.tracking, true, "Ein erledigter heutiger Slot behält seinen unsichtbaren Tracking-Snapshot");

  await page.locator("#planRecalculate").click();
  await page.locator("#confirmPlanRebuild").click();
  const afterCompletedReplan = await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    const lock = state.planLocks?.[`${date}|lunch`];
    return { planId: lock?.planId || "", tracking: !!lock?.plannerTrackingSnapshot };
  }, today);
  assert.deepEqual(
    afterCompletedReplan,
    { planId: completedTracking.before, tracking: true },
    "Woche neu planen erhält die Tracking-Identität eines protokollierten Slots",
  );

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
