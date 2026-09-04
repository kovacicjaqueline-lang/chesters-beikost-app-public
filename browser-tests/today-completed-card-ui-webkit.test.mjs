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
    window.__mobileFoundationInstalled === true &&
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

    state.settings.phaseSelected = "drei";
    state.settings.textureStage = 2;
    state.settings.planFrom = today;
    state.planLocks ||= {};
    state.manualMeals ||= {};
    state.autoLockExcluded ||= {};

    for (const meal of ["breakfast", "lunch", "dinner"]) {
      state.planLocks[`${today}|${meal}`] = {
        date: today,
        meal,
        focusId: "hirse",
        foodIds: ids,
        baseFoodIds: ids,
        sampleFoodIds: [],
        optionalAddons: [],
        inventoryFoodIds: [],
        recipeName: meal === "breakfast" ? "Milch-Getreide-Brei" : "",
        recipeInventoryId: "",
        type: "bekannt kombinieren",
        note: "",
        manualAdded: false,
        active: true,
        mode: "manual",
        planId: `ui-mobile-today-${meal}`,
        createdAt: new Date().toISOString(),
      };
      delete state.autoLockExcluded[`${today}|${meal}`];
      delete state.manualMeals[`${today}|${meal}`];
    }

    state.logs = [{
      id: "ui-mobile-today-breakfast-log",
      date: today,
      meal: "breakfast",
      entryType: "meal",
      plannedMealId: "ui-mobile-today-breakfast",
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

  assert.equal(await page.locator("#appBarTitle").innerText(), "Heute");
  assert.equal(await page.locator(".app-header .brand-orb").count(), 0, "Der große Marken-Orb entfällt im App-Alltag");
  const headerHeight = await page.locator(".app-header").evaluate((node) => node.getBoundingClientRect().height);
  assert.ok(headerHeight < 90, "Die App-Bar bleibt mobil kompakt");

  const phaseCard = page.locator("#phaseCard");
  assert.equal(await phaseCard.evaluate((node) => node.classList.contains("card")), false, "Tageskontext ist keine eigene Dashboard-Card mehr");
  assert.match(
    (await phaseCard.locator("summary b").innerText()).replace(/\s+/g, " "),
    /Drei Hauptmahlzeiten · Konsistenz: fein zerdrückt/,
  );

  const todayCard = page.locator("#todayCard");
  assert.equal(await todayCard.locator(":scope > .row h2").innerText(), "Mittag");
  assert.equal(await todayCard.locator(".today-section-kicker").first().innerText(), "ALS NÄCHSTES");
  const primaryAction = todayCard.locator(".today-focus-meal .logMeal").first();
  await primaryAction.waitFor();
  assert.equal((await primaryAction.innerText()).trim(), "Essen eintragen");
  assert.ok(await primaryAction.evaluate((node) => node.getBoundingClientRect().height) >= 44, "Primäraktion bleibt gut antippbar");

  const focusMealStyle = await todayCard.locator(".today-focus-meal > .mealbox").evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      borderTopWidth: style.borderTopWidth,
      backgroundColor: style.backgroundColor,
      paddingTop: style.paddingTop,
    };
  });
  assert.equal(focusMealStyle.borderTopWidth, "0px", "Die aktuelle Mahlzeit bekommt keine innere Kartenkante");
  assert.equal(focusMealStyle.backgroundColor, "rgba(0, 0, 0, 0)", "Die aktuelle Mahlzeit bleibt auf derselben visuellen Ebene wie der Heute-Fokus");
  assert.equal(focusMealStyle.paddingTop, "0px", "Der Heute-Fokus erzeugt keine zusätzliche Card-in-Card-Innenfläche");

  const timeline = todayCard.locator(".today-timeline-row");
  assert.equal(await timeline.count(), 3, "Alle geplanten Mahlzeiten des Tages bleiben sichtbar");
  assert.match((await timeline.nth(0).innerText()).replace(/\s+/g, " "), /Frühstück .* Erledigt/);
  assert.match((await timeline.nth(1).innerText()).replace(/\s+/g, " "), /Mittag .* Als Nächstes/);
  assert.match((await timeline.nth(2).innerText()).replace(/\s+/g, " "), /Abendessen .* Später/);
  assert.equal(await timeline.nth(0).locator(".timeline-marker").innerText(), "✓");

  const edit = timeline.nth(0).locator(".timeline-edit");
  await edit.waitFor();
  assert.ok(await edit.evaluate((node) => node.getBoundingClientRect().height) >= 44, "Erledigte Mahlzeiten bleiben direkt bearbeitbar");

  assert.match(await page.locator("#progressCard").innerText(), /von 100 kennengelernt/);
  assert.equal(await page.locator("#textureCoachCard").isVisible(), false, "Ohne fällige Empfehlung bleibt der separate Konsistenz-Coach verborgen");
  assert.ok(await page.locator("#recipePreviewCard .today-recipe-row").count() <= 1, "Heute zeigt maximal eine kontextuelle Rezeptidee");

  const navLabels = await page.locator("nav button").evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
  assert.deepEqual(navLabels, ["Heute", "Plan", "Prep", "Beikost", "Mehr"]);
  await page.locator('nav button[data-view="plan"]').click();
  assert.equal(await page.locator("#appBarTitle").innerText(), "Plan");
  await page.locator('nav button[data-view="home"]').click();
  assert.equal(await page.locator("#appBarTitle").innerText(), "Heute");

  const mainOverflow = await page.locator("main").evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }));
  assert.ok(mainOverflow.scrollWidth <= mainOverflow.clientWidth + 1, "Heute darf mobil nicht horizontal überlaufen");

  assert.deepEqual(pageErrors, [], "Der Mobile-Foundation-/Heute-Fluss darf keine Page-Errors erzeugen");
  await context.close();
  console.log("today-completed-card-ui-webkit: ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}