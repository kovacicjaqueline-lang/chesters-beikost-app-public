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
  page.setDefaultTimeout(12000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState &&
    !!window.__plannerMissingIngredient &&
    !!window.__mobilePlanUiInstalled &&
    window.__beikostTest.getState()?.backupMeta?.storagePersisted !== "unknown",
  );

  const setup = await page.evaluate(() => {
    window.__beikostTest.reset();
    const current = window.__beikostTest.today();
    const key = `${current}|breakfast`;
    const state = window.__beikostTest.getState();

    state.settings.phaseSelected = "aufbau";
    state.settings.planFrom = current;
    state.settings.newFoodEvery = 1;
    state.settings.seasonal = false;
    state.settings.preferInventoryInPlan = false;
    state.logs = [
      {
        id: "missing-base-pfirsich-1",
        date: window.__beikostTest.addDays(current, -6),
        meal: "breakfast",
        foodIds: ["pfirsich"],
        foodOutcomes: { pfirsich: "eaten" },
        outcome: "eaten",
        createdAt: `${window.__beikostTest.addDays(current, -6)}T08:00:00.000Z`,
      },
      {
        id: "missing-base-pfirsich-2",
        date: window.__beikostTest.addDays(current, -5),
        meal: "breakfast",
        foodIds: ["pfirsich"],
        foodOutcomes: { pfirsich: "eaten" },
        outcome: "eaten",
        createdAt: `${window.__beikostTest.addDays(current, -5)}T08:00:00.000Z`,
      },
      {
        id: "missing-base-hirse-1",
        date: window.__beikostTest.addDays(current, -4),
        meal: "breakfast",
        foodIds: ["hirse"],
        foodOutcomes: { hirse: "eaten" },
        outcome: "eaten",
        createdAt: `${window.__beikostTest.addDays(current, -4)}T08:00:00.000Z`,
      },
      {
        id: "missing-base-hirse-2",
        date: window.__beikostTest.addDays(current, -3),
        meal: "breakfast",
        foodIds: ["hirse"],
        foodOutcomes: { hirse: "eaten" },
        outcome: "eaten",
        createdAt: `${window.__beikostTest.addDays(current, -3)}T08:00:00.000Z`,
      },
    ];
    state.shoppingHints = {};
    state.followUps = {};
    state.pantry = { pfirsich: true, hirse: true, nektarine: true };
    state.overrides = {};
    state.autoLockExcluded = {};
    state.planLocks = {};
    state.manualMeals = {};
    state.deferred = {};

    for (const item of state.foods) {
      item.active = ["pfirsich", "hirse", "nektarine"].includes(item.id);
      item.manualStatus = "auto";
      if (item.id === "pfirsich") item.priority = 1;
      if (item.id === "hirse") item.priority = 2;
      if (item.id === "nektarine") item.priority = 3;
    }

    state.planLocks[key] = {
      date: current,
      meal: "breakfast",
      active: true,
      empty: false,
      focusId: "nektarine",
      foodIds: ["pfirsich", "nektarine"],
      baseFoodIds: ["pfirsich"],
      sampleFoodIds: ["nektarine"],
      inventoryFoodIds: [],
      foodRoles: { pfirsich: "base", nektarine: "sample" },
      recipeName: "",
      recipeInventoryId: "",
      type: "neu",
      mode: "auto",
      manualAdded: false,
    };

    window.__beikostTest.setState(state);
    return { current, key };
  });

  await page.locator('nav [data-view="plan"]').click();
  await page.locator("#plan.view.active").waitFor();
  const dayButton = page.locator(`.plan-week-day[data-plan-date="${setup.current}"]`);
  await dayButton.waitFor();
  if ((await dayButton.getAttribute("aria-pressed")) !== "true") await dayButton.click();

  const actions = page.locator("#blockPlan details.meal-plan-actions").filter({
    has: page.locator(`.missingIngredient[data-missing-date="${setup.current}"][data-missing-meal="breakfast"]`),
  }).first();
  await actions.waitFor();
  if (!(await actions.evaluate((node) => node.open))) {
    await actions.locator(":scope > summary").click();
  }

  await actions.locator(".missingIngredient").click();
  await page.locator("#genericModal.open").waitFor();
  assert.equal(await page.locator('.missingIngredientChoice[data-food="pfirsich"]').count(), 1);
  await page.locator('.missingIngredientChoice[data-food="pfirsich"]').click();

  await page.waitForFunction(() => !document.getElementById("genericModal")?.classList.contains("open"));
  await page.waitForFunction(({ key }) => {
    const state = window.__beikostTest.getState();
    const lock = state.planLocks?.[key];
    return state.shoppingHints?.pfirsich?.status === "needed" &&
      !!lock &&
      !(lock.foodIds || []).includes("pfirsich");
  }, { key: setup.key });

  const after = await page.evaluate(({ key }) => {
    const state = window.__beikostTest.getState();
    return {
      lock: state.planLocks?.[key] || null,
      hint: state.shoppingHints?.pfirsich || null,
      modalOpen: document.getElementById("genericModal")?.classList.contains("open") || false,
    };
  }, { key: setup.key });

  assert.equal(after.hint?.status, "needed", "Pfirsich bleibt als fehlend markiert");
  assert.ok(after.lock, "der offene Slot wird nach dem Entfernen neu geplant");
  assert.equal(after.lock.foodIds.includes("pfirsich"), false, "fehlender Pfirsich darf nicht als Hauptbasis zurückkehren");
  assert.ok(after.lock.foodIds.includes("hirse"), "eine verfügbare bekannte Hauptbasis darf stattdessen verwendet werden");
  assert.equal(after.modalOpen, false, "der Fehlzutaten-Dialog muss vollständig schließen");

  // Bedienbarkeitsprobe: Kein schwarzes Overlay und kein blockierter Event-Loop nach dem Replan.
  await page.locator('nav [data-view="prep"]').click();
  await page.locator("#prep.view.active").waitFor();
  await page.locator('nav [data-view="plan"]').click();
  await page.locator("#plan.view.active").waitFor();

  assert.deepEqual(pageErrors, [], `keine Page-Errors erwartet: ${pageErrors.join(" | ")}`);
  console.log("planner missing trusted base regression: ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
