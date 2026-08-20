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
    !!window.__plannedRecipeDetails &&
    window.__plannerPoliciesReady === true,
  );
}

async function seedRecipeMeal(page, recipeName, foodIds, textureStage = 3) {
  return page.evaluate(({ recipeName, foodIds, textureStage }) => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const date = window.__beikostTest.today();
    const exposureDate = window.__beikostTest.addDays(date, -1);
    state.settings.textureStage = textureStage;
    state.settings.planFrom = date;
    for (const id of foodIds) {
      const item = state.foods.find((food) => food.id === id);
      if (item) item.manualStatus = "Verträgliche Basis";
    }
    state.logs.push({
      id: `recipe-ready-${recipeName}`,
      date: exposureDate,
      meal: "lunch",
      focusId: foodIds[0],
      foodIds: [...foodIds],
      baseFoodIds: [...foodIds],
      sampleFoodIds: [],
      recipeName: "",
      outcome: "eaten",
      foodOutcomes: Object.fromEntries(foodIds.map((id) => [id, "eaten"])),
      entryType: "meal",
      textureStage,
      createdAt: `${exposureDate}T12:00:00.000Z`,
    });
    state.manualMeals[`${date}|lunch`] = {
      date,
      meal: "lunch",
      focusId: foodIds[0],
      foodIds: [...foodIds],
      baseFoodIds: [...foodIds],
      sampleFoodIds: [],
      optionalAddons: [],
      recipeName,
      recipeInventoryId: "",
      type: "manuell",
      note: "Browser-Regression Rezeptdetail",
      manualAdded: true,
      createdAt: new Date().toISOString(),
    };
    window.__beikostTest.setState(state);
    return date;
  }, { recipeName, foodIds, textureStage });
}

async function assertRecipeTitleLayout(page, locator, widths = [320, 375, 390]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    const box = await locator.boundingBox();
    assert.ok(box, `Rezepttitel muss bei ${width}px sichtbar sein`);
    assert.ok(box.height >= 44, `Rezepttitel muss bei ${width}px mindestens 44px hoch sein`);
    const viewport = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(
      viewport.scrollWidth <= viewport.innerWidth,
      `Rezepttitel darf bei ${width}px keinen horizontalen Seiten-Overflow erzeugen`,
    );
  }
}

async function openRecipeVariants(page) {
  const summary = page.locator("#genericBody .recipe-subsection > summary", {
    hasText: "Varianten",
  });
  await summary.waitFor();
  await summary.click();
  await page.locator("#genericBody .recipe-option-list").waitFor();
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

  // Reine UI-Dekoration darf keinen zweiten Planner-Durchlauf auslösen.
  const plannerCalls = await page.evaluate(() => {
    let buildCalls = 0;
    let displayCalls = 0;
    const originalBuildDays = buildDays;
    const originalPlanDisplayDays = planDisplayDays;
    buildDays = function countedBuildDays(...args) {
      buildCalls += 1;
      return originalBuildDays(...args);
    };
    planDisplayDays = function countedPlanDisplayDays(...args) {
      displayCalls += 1;
      return originalPlanDisplayDays(...args);
    };
    try {
      window.__plannedRecipeDetails.decorateHomeRecipeTitles();
      window.__plannedRecipeDetails.decoratePlanRecipeTitles();
    } finally {
      buildDays = originalBuildDays;
      planDisplayDays = originalPlanDisplayDays;
    }
    return { buildCalls, displayCalls };
  });
  assert.deepEqual(
    plannerCalls,
    { buildCalls: 0, displayCalls: 0 },
    "Rezepttitel-Dekoration darf Planner und sichtbare Woche nicht erneut aufbauen",
  );

  // Heute: Rezeptname selbst ist das Touchziel und öffnet auch eine nicht-erste oneOf-Auswahl korrekt.
  let date = await seedRecipeMeal(
    page,
    "Obst-Hafer-Pancakes",
    ["hafer", "ei", "apfel"],
    2,
  );
  let homeRecipe = page.locator('#todayCard [data-planned-recipe-name="Obst-Hafer-Pancakes"]');
  await homeRecipe.waitFor();
  await assertRecipeTitleLayout(page, homeRecipe);
  await homeRecipe.click();
  await page.locator("#genericModal.open .recipe-card-v2[open]").waitFor();
  await openRecipeVariants(page);
  const fruitVariantText = await page.locator("#genericBody .recipe-option-list").innerText();
  assert.match(fruitVariantText, /Vorausgewählt:\s*Apfel/);
  assert.doesNotMatch(fruitVariantText, /Vorausgewählt:\s*Banane/);
  await page.locator("#closeGeneric").click();

  // Wochenplan: derselbe direkte Einstieg funktioniert ohne Zusatzbutton.
  await page.locator('nav button[data-view="plan"]').click();
  const planRecipe = page.locator('#blockPlan [data-planned-recipe-name="Obst-Hafer-Pancakes"]').first();
  await planRecipe.waitFor();
  await planRecipe.click();
  await page.locator("#genericModal.open .recipe-card-v2[open]").waitFor();
  assert.match(await page.locator("#genericBody").innerText(), /Obst-Hafer-Pancakes/);
  await page.locator("#closeGeneric").click();

  // Familienrezept: tatsächliche foodIds bestimmen die geöffnete alternatives-Variante.
  await page.locator('nav button[data-view="home"]').click();
  date = await seedRecipeMeal(
    page,
    "Geflügel-Gemüse-Hafer-Bällchen",
    ["pute", "karotte", "hafer"],
    3,
  );
  const familyRecipe = page.locator('#todayCard [data-planned-recipe-name="Geflügel-Gemüse-Hafer-Bällchen"]');
  await familyRecipe.waitFor();
  await assertRecipeTitleLayout(page, familyRecipe);
  await familyRecipe.click();
  await page.locator("#genericModal.open .recipe-card-v2[open]").waitFor();
  await openRecipeVariants(page);
  assert.match(
    await page.locator("#genericBody .recipe-option-list").innerText(),
    /Variante:\s*Pute \+ Karotte/,
  );
  await page.locator("#closeGeneric").click();

  // Erledigtes Rezept: der explizit mit dem Plan verknüpfte Rezeptname bleibt direkt aufrufbar.
  await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    const plannedMealId = state.manualMeals[`${date}|lunch`]?.planId;
    if (!plannedMealId) throw new Error("Plan-ID für erledigtes Rezept fehlt");
    state.logs.push({
      id: "completed-recipe",
      date,
      meal: "lunch",
      focusId: "pute",
      foodIds: ["pute", "karotte", "hafer"],
      baseFoodIds: ["pute", "karotte", "hafer"],
      sampleFoodIds: [],
      recipeName: "Geflügel-Gemüse-Hafer-Bällchen",
      plannedMealId,
      outcome: "eaten",
      foodOutcomes: { pute: "eaten", karotte: "eaten", hafer: "eaten" },
      entryType: "meal",
      textureStage: 3,
      createdAt: new Date().toISOString(),
    });
    window.__beikostTest.setState(state);
  }, date);
  const completedRecipe = page.locator('#todayCard .completed-title [data-planned-recipe-name="Geflügel-Gemüse-Hafer-Bällchen"]');
  await completedRecipe.waitFor();
  await completedRecipe.click();
  await page.locator("#genericModal.open .recipe-card-v2[open]").waitFor();
  await page.locator("#closeGeneric").click();

  // Explizit verknüpfter FOOD-Eintrag ohne recipeName darf NICHT auf das zuvor geplante Rezept zurückfallen.
  await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    const plannedMealId = state.manualMeals[`${date}|lunch`]?.planId;
    if (!plannedMealId) throw new Error("Plan-ID für erledigten FOOD-Eintrag fehlt");
    state.logs = [{
      id: "completed-food-only",
      date,
      meal: "lunch",
      focusId: "banane",
      foodIds: ["banane", "ei"],
      baseFoodIds: ["banane", "ei"],
      sampleFoodIds: [],
      recipeName: "",
      plannedMealId,
      outcome: "eaten",
      foodOutcomes: { banane: "eaten", ei: "eaten" },
      entryType: "meal",
      textureStage: 2,
      createdAt: new Date().toISOString(),
    }];
    window.__beikostTest.setState(state);
  }, date);
  assert.equal(
    await page.locator("#todayCard [data-planned-recipe-name]").count(),
    0,
    "FOOD-Protokoll ohne recipeName darf keinen Rezeptlink erhalten",
  );
  assert.match(await page.locator("#todayCard .completed-title").innerText(), /Banane \+ Ei/);

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("Planned recipe details WebKit regressions passed.");
