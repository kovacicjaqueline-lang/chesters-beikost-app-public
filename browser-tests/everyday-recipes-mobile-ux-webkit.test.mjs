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
    !!window.__beikostTest?.getState &&
    !!window.__mealCardUnification &&
    window.__plannerPoliciesReady === true,
  );
}

async function seedEverydayPlan(page) {
  return page.evaluate(() => {
    const bridge = window.__beikostTest;
    bridge.reset();
    const state = bridge.getState();
    const date = bridge.today();
    const banana = bridge.foodId("Banane");
    const egg = bridge.foodId("Ei");
    const carrot = bridge.foodId("Karotte");
    state.settings.appFocusMode = "everyday-recipes";
    state.settings.planFrom = date;
    state.planLocks = {};
    state.manualMeals = {};
    state.overrides = {};
    state.planLocks[`${date}|breakfast`] = {
      date,
      meal: "breakfast",
      focusId: banana,
      foodIds: [banana, egg],
      baseFoodIds: [banana, egg],
      sampleFoodIds: [],
      optionalAddons: [],
      inventoryFoodIds: [],
      recipeName: "Bananen-Ei-Pancakes",
      recipeInventoryId: "",
      type: "bekannt kombinieren",
      note: "",
      manualAdded: false,
      active: true,
      mode: "manual",
      locked: true,
      planId: "everyday-recipe-plan",
    };
    state.planLocks[`${date}|lunch`] = {
      date,
      meal: "lunch",
      focusId: carrot,
      foodIds: [carrot],
      baseFoodIds: [],
      sampleFoodIds: [carrot],
      optionalAddons: [],
      inventoryFoodIds: [],
      recipeName: "",
      recipeInventoryId: "",
      type: "Allergen einführen",
      note: "",
      manualAdded: false,
      active: true,
      mode: "manual",
      locked: true,
      planId: "everyday-food-plan",
    };
    bridge.setState(state);
    return { date, identity: state.planLocks[`${date}|breakfast`] };
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
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const { identity } = await seedEverydayPlan(page);

  const todayCard = page.locator("#todayCard");
  await todayCard.locator(".today-everyday-meals").waitFor();
  assert.equal(await todayCard.locator(".today-everyday-meal").count(), 2, "Alltagsmodus zeigt alle geplanten Mahlzeiten");
  assert.match(await todayCard.innerText(), /Frühstück/);
  assert.match(await todayCard.innerText(), /Bananen-Ei-Pancakes/);
  assert.match(await todayCard.innerText(), /Neue Kostprobe|Allergen-Aufgabe/);
  assert.equal(await todayCard.locator(".everyday-recipe-visual .recipe-illustration").count(), 1, "Vorhandenes Recipe-V2-Bild wird an der geplanten Rezeptmahlzeit gezeigt");
  assert.equal(await todayCard.locator(".everyday-recipe-open").count(), 1, "Geplantes Rezept bleibt direkt öffnbar");

  const everydayLayout = await todayCard.locator(".today-everyday-meal").first().evaluate((meal) => {
    const row = meal.querySelector(".meal-summary-row");
    const visual = meal.querySelector(".everyday-recipe-visual");
    const main = meal.querySelector(".meal-summary-main");
    const actions = meal.querySelector(".meal-summary-actions");
    const rowRect = row?.getBoundingClientRect();
    const visualRect = visual?.getBoundingClientRect();
    const mainRect = main?.getBoundingClientRect();
    const actionsRect = actions?.getBoundingClientRect();
    return {
      hasRecipeClass: row?.classList.contains("has-recipe-visual"),
      rowClientWidth: row?.clientWidth || 0,
      rowScrollWidth: row?.scrollWidth || 0,
      rowRight: rowRect?.right || 0,
      visualRight: visualRect?.right || 0,
      mainLeft: mainRect?.left || 0,
      mainRight: mainRect?.right || 0,
      mainWidth: mainRect?.width || 0,
      actionsLeft: actionsRect?.left || 0,
      pageScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      imageLoading: visual?.querySelector("img")?.getAttribute("loading") || "",
    };
  });
  assert.equal(everydayLayout.hasRecipeClass, true, "Rezeptmahlzeit markiert ihre dreispaltige Kartenzeile");
  assert.ok(everydayLayout.rowScrollWidth <= everydayLayout.rowClientWidth + 1, "Alltags-Rezeptkarte darf horizontal nicht überlaufen");
  assert.ok(everydayLayout.mainWidth >= 120, "Rezeptname und Alltagshinweis müssen eine nutzbare Textspalte behalten");
  assert.ok(everydayLayout.mainLeft >= everydayLayout.visualRight - 1, "Text muss rechts neben dem Rezeptbild beginnen");
  assert.ok(everydayLayout.mainRight <= everydayLayout.rowRight + 1, "Text darf nicht aus der Kartenzeile laufen");
  assert.ok(everydayLayout.actionsLeft >= everydayLayout.mainRight - 1, "Schloss muss rechts neben der Textspalte bleiben");
  assert.ok(everydayLayout.pageScrollWidth <= everydayLayout.viewportWidth + 1, "Alltagsansicht darf keinen Seiten-Overflow erzeugen");
  assert.equal(everydayLayout.imageLoading, "eager", "Das sichtbare Alltags-Rezeptbild wird priorisiert geladen");
  assert.equal(await todayCard.locator(".today-everyday-meal .logMeal").count(), 2, "Essen eintragen bleibt für jede geplante Mahlzeit erreichbar");

  await todayCard.locator(".everyday-recipe-open").click();
  await page.locator("#genericModal.open").waitFor();
  assert.equal(await page.locator("#genericTitle").innerText(), "Rezept");
  assert.match(await page.locator("#genericBody").innerText(), /Bananen-Ei-Pancakes/);
  await page.locator("#closeGeneric").click();

  await page.locator('nav button[data-view="foods"]').click();
  await page.locator("#recipesSection").waitFor({ state: "visible" });
  await page.locator("#recipeList .recipe-card-v2").first().waitFor();

  const recipeImages = await page.locator("#recipeList .recipe-card-v2 img.illustration-icon__asset").evaluateAll((images) =>
    images.map((image) => ({
      loading: image.getAttribute("loading"),
      fetchPriority: image.getAttribute("fetchpriority"),
    })),
  );
  assert.ok(recipeImages.length >= 4, "Der Rezeptkatalog muss mehrere Rezeptbilder rendern");
  assert.ok(recipeImages.slice(0, 4).every((image) => image.loading === "eager" && image.fetchPriority === "high"), "Die ersten sichtbaren Rezeptbilder müssen priorisiert geladen werden");
  assert.ok(recipeImages.slice(4).some((image) => image.loading === "lazy"), "Weiter unten liegende Rezeptbilder bleiben Lazy-Loading");

  await page.waitForFunction(() => {
    const image = document.querySelector("#recipeList .recipe-card-v2 img.illustration-icon__asset");
    return !!image && image.complete && image.naturalWidth > 0;
  });
  for (const filter of ["available", "almost", "pantry", "freezer"]) {
    assert.equal(await page.locator(`#recipeFilter [data-recipe-filter="${filter}"]`).count(), 1, `${filter} bleibt schnell erreichbar`);
  }
  await page.locator('#recipeFilter [data-recipe-filter="freezer"]').click();
  assert.ok(await page.locator('#recipeFilter [data-recipe-filter="freezer"]').evaluate((button) => button.classList.contains("active")));
  await page.locator('#catalogSwitch [data-catalog-mode="foods"]').click();
  assert.equal(await page.locator("#foodsCatalogSection").isVisible(), true, "Lebensmittel bleiben über den bestehenden Umschalter erreichbar");

  const afterCatalog = await page.evaluate(() => {
    const meal = window.__beikostTest.getState().planLocks[`${window.__beikostTest.today()}|breakfast`];
    return { focusId: meal.focusId, foodIds: meal.foodIds, sampleFoodIds: meal.sampleFoodIds, recipeName: meal.recipeName };
  });
  assert.deepEqual(afterCatalog, {
    focusId: identity.focusId,
    foodIds: identity.foodIds,
    sampleFoodIds: identity.sampleFoodIds,
    recipeName: identity.recipeName,
  }, "Der Alltag-/Rezeptkatalog verändert keine Planner-Identität");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
