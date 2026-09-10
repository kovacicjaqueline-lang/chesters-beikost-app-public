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
    window.__plannerPoliciesReady === true &&
    window.__mobilePlanUiInstalled === true &&
    window.__beikostTest.getState()?.backupMeta?.storagePersisted !== "unknown",
  );
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

  const pastDate = await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const current = window.__beikostTest.today();
    const past = window.addDays(current, -1);

    state.settings.planFrom = past;
    state.planLocks = {};
    state.manualMeals = {};
    state.overrides = {};
    state.autoLockExcluded = {};
    state.backupMeta ||= {};
    state.backupMeta.plannerLinking = {
      version: 1,
      rolloverHandled: {},
      carriedPlans: {},
    };
    state.logs = [
      {
        id: "ui-past-lunch",
        date: past,
        meal: "lunch",
        entryType: "meal",
        focusId: "kartoffel",
        foodIds: ["kartoffel"],
        baseFoodIds: ["kartoffel"],
        sampleFoodIds: [],
        foodRoles: { kartoffel: "base" },
        foodOutcomes: { kartoffel: "eaten" },
        outcome: "eaten",
        textureKnown: true,
        textureStage: 2,
        amount: "20",
        createdAt: `${past}T12:00:00.000Z`,
      },
      {
        id: "ui-past-tomato",
        date: past,
        meal: "snack",
        entryType: "meal",
        focusId: "tomate",
        foodIds: ["tomate"],
        baseFoodIds: ["tomate"],
        sampleFoodIds: [],
        foodRoles: { tomate: "base" },
        foodOutcomes: { tomate: "eaten" },
        outcome: "eaten",
        textureKnown: true,
        textureStage: 3,
        amount: "",
        createdAt: `${past}T15:00:00.000Z`,
      },
    ];

    window.__beikostTest.setState(state);
    window.renderAll();
    return past;
  });

  await page.locator('nav button[data-view="plan"]').click();
  await page.locator(`#planWeekOverview .plan-week-day[data-plan-date="${pastDate}"]`).click();

  const completedDay = page.locator(`#blockPlan > details.completed-day[data-plan-date="${pastDate}"]`);
  await completedDay.waitFor();
  assert.equal(
    await completedDay.evaluate((node) => node.open),
    true,
    "Der ausgewählte abgeschlossene Tag wird im Mobile-First-Plan vollständig dargestellt",
  );
  assert.match(await completedDay.locator(":scope > summary").innerText(), /erledigt/i);
  assert.match(await completedDay.locator(":scope > summary").innerText(), /2 Protokolleinträge/);
  assert.match(await completedDay.locator(":scope > summary").innerText(), /20 g protokolliert/);
  const pastLabel = await page.evaluate((date) => window.nice(date, true), pastDate);
  const openDayLabels = await page.locator("#blockPlan > .day-card .day-date").allTextContents();
  assert.equal(
    openDayLabels.includes(pastLabel),
    false,
    "Der vergangene abgeschlossene Tag bleibt keine offene Tageskarte",
  );

  assert.equal(await completedDay.locator(".mealbox.completed").count(), 2);
  assert.equal(
    await completedDay.locator(".completed-edit-actions .editCompletedLog").count(),
    2,
    "Jede abgeschlossene Mahlzeit behält die Bearbeiten-Aktion",
  );
  assert.equal(
    await completedDay.locator(".completed-body-direct .editCompletedLog").count(),
    0,
    "Die Bearbeiten-Aktion bleibt nicht im links eingerückten Detailkörper",
  );

  const alignment = await completedDay.locator(".completed-edit-actions").first().evaluate((actions) => {
    const button = actions.querySelector(".editCompletedLog");
    const actionRect = actions.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    return {
      justifyContent: getComputedStyle(actions).justifyContent,
      centerDelta: Math.abs(
        (actionRect.left + actionRect.right) / 2 -
        (buttonRect.left + buttonRect.right) / 2,
      ),
    };
  });
  assert.equal(alignment.justifyContent, "center");
  assert.ok(alignment.centerDelta <= 1, `Bearbeiten-Button ist um ${alignment.centerDelta}px aus der Mitte versetzt`);

  await completedDay.locator(":scope > summary").click();
  assert.equal(await completedDay.evaluate((node) => node.open), false, "Der ausgewählte Tag lässt sich weiterhin einklappen");
  await completedDay.locator(":scope > summary").click();
  assert.equal(await completedDay.evaluate((node) => node.open), true, "Der ausgewählte Tag lässt sich wieder aufklappen");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("completed-day-presentation-webkit: ok");
