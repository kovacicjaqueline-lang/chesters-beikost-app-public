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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const seeded = await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const today = window.__beikostTest.today();
    const ids = ["hirse", "kuhmilch", "pfirsich"];
    if (!ids.every((id) => state.foods.some((food) => food.id === id))) return false;

    state.settings.phaseSelected = "aufbau";
    state.settings.planFrom = today;
    state.autoLockExcluded ||= {};
    state.planLocks ||= {};
    state.manualMeals ||= {};
    for (const meal of ["lunch", "snack", "dinner"]) {
      state.autoLockExcluded[`${today}|${meal}`] = "meal-removed";
      delete state.planLocks[`${today}|${meal}`];
      delete state.manualMeals[`${today}|${meal}`];
    }
    state.planLocks[`${today}|breakfast`] = {
      date: today,
      meal: "breakfast",
      focusId: "hirse",
      foodIds: ids,
      baseFoodIds: ids,
      sampleFoodIds: [],
      optionalAddons: [],
      inventoryFoodIds: [],
      recipeName: "Milch-Getreide-Brei",
      recipeInventoryId: "",
      type: "bekannt kombinieren",
      note: "",
      manualAdded: false,
      active: true,
      mode: "auto",
      planId: "ui-today-completed-breakfast",
      createdAt: new Date().toISOString(),
    };
    state.logs = [{
      id: "ui-today-completed-breakfast-log",
      date: today,
      meal: "breakfast",
      entryType: "meal",
      plannedMealId: "ui-today-completed-breakfast",
      focusId: "hirse",
      foodIds: ids,
      baseFoodIds: ids,
      sampleFoodIds: [],
      foodRoles: { hirse: "base", kuhmilch: "base", pfirsich: "base" },
      foodOutcomes: { hirse: "tried", kuhmilch: "eaten", pfirsich: "eaten" },
      outcome: "eaten",
      recipeName: "Milch-Getreide-Brei",
      textureKnown: true,
      textureStage: 2,
      amount: "",
      createdAt: new Date().toISOString(),
    }];

    window.__beikostTest.setState(state);
    window.renderAll();
    return true;
  });
  assert.equal(seeded, true, "Testzutaten müssen im aktuellen FOOD-Stamm vorhanden sein");

  const todayCard = page.locator("#todayCard");
  assert.equal(await todayCard.locator(":scope > .row h2").innerText(), "Heute erledigt");
  assert.equal(
    await todayCard.locator(":scope > .row > .pill.ok").count(),
    0,
    "Der Tagesabschluss braucht neben 'Heute erledigt' kein zusätzliches Vollständig-Badge",
  );

  const meal = todayCard.locator(".mealbox.completed").filter({ hasText: "Milch-Getreide-Brei" }).first();
  await meal.waitFor();
  const title = (await meal.locator(".completed-title").innerText()).replace(/\s+/g, " ").trim();
  assert.match(title, /^Frühstück · Milch-Getreide-Brei/);

  assert.deepEqual(
    await meal.locator(".log-outcome-item").evaluateAll((nodes) =>
      nodes.map((node) => node.innerText.replace(/\s+/g, " ").trim()),
    ),
    ["Hirse Probiert", "Kuhmilch, Pfirsich Gegessen"],
    "Gleiche Ergebnisse werden in der Heute-Karte kompakt zusammengefasst",
  );

  const completedColumns = await meal.locator(".completed-main").evaluate((node) =>
    getComputedStyle(node).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
  );
  assert.equal(completedColumns, 2, "Erledigte Heute-Karte reserviert keine leere Check-Spalte");

  const statusPresentation = await meal.locator(".completed-main").evaluate((node) => {
    const status = [...node.children].find((child) => child.matches("span.pill.ok"));
    return {
      text: status?.textContent?.trim() || "",
      opacity: status ? Number(getComputedStyle(status).opacity) : -1,
    };
  });
  assert.equal(statusPresentation.text, "Erledigt");
  assert.ok(
    statusPresentation.opacity >= 0 && statusPresentation.opacity < 1,
    "Der Mahlzeitenstatus bleibt sichtbar, wird aber visuell zurückgenommen",
  );

  const edit = meal.locator(".completed-body-direct .editCompletedLog");
  await edit.waitFor();
  const editStyle = await edit.evaluate((node) => {
    const style = getComputedStyle(node);
    return { height: node.getBoundingClientRect().height, backgroundColor: style.backgroundColor };
  });
  assert.ok(editStyle.height >= 38, "Essen bearbeiten bleibt direkt und ausreichend gut antippbar");
  assert.equal(editStyle.backgroundColor, "rgba(0, 0, 0, 0)", "Essen bearbeiten bleibt eine ruhige Sekundäraktion");

  const planMeal = page.locator("#blockPlan .mealbox.completed").filter({ hasText: "Milch-Getreide-Brei" }).first();
  assert.equal(await planMeal.count(), 1, "Die erledigte Mahlzeit bleibt im Wochenplan vorhanden");
  assert.equal(
    await planMeal.locator(".log-outcome-item").count(),
    3,
    "Die Outcome-Gruppierung bleibt auf die Heute-Karte begrenzt",
  );

  assert.deepEqual(pageErrors, [], "Der UI-Fluss darf keine Page-Errors erzeugen");
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
