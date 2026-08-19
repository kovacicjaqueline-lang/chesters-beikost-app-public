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
    state.settings.textureStage = textureStage;
    state.settings.planFrom = date;
    for (const id of foodIds) {
      const item = state.foods.find((food) => food.id === id);
      if (item) item.manualStatus = "Verträgliche Basis";
    }
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

  // Heute: Rezeptname selbst ist das Touchziel und öffnet die konkrete Obst-Auswahl.
  let date = await seedRecipeMeal(
    page,
    "Obst-Hafer-Pancakes",
    ["hafer", "ei", "banane"],
    2,
  );
  let homeRecipe = page.locator('#todayCard [data-planned-recipe-name="Obst-Hafer-Pancakes"]');
  await homeRecipe.waitFor();
  assert.ok((await homeRecipe.boundingBox())?.height >= 44, "Rezepttitel muss auf iPhone mindestens 44px hoch sein");
  await homeRecipe.click();
  await page.locator("#genericModal.open .recipe-card-v2[open]").waitFor();
  assert.match(await page.locator("#genericBody").innerText(), /Vorausgewählt:\s*Banane/);
  await page.locator("#closeGeneric").click();

  // Wochenplan: derselbe direkte Einstieg funktioniert ohne Zusatzbutton.
  await page.locator('nav button[data-view="plan"]').click();
  const planRecipe = page.locator('#blockPlan [data-planned-recipe-name="Obst-Hafer-Pancakes"]').first();
  await planRecipe.waitFor();
  await planRecipe.click();
  await page.locator("#genericModal.open .recipe-card-v2[open]").waitFor();
  assert.match(await page.locator("#genericBody").innerText(), /Obst-Hafer-Pancakes/);
  await page.locator("#closeGeneric").click();

  // Familienrezept: tatsächliche foodIds bestimmen die geöffnete Variante.
  await page.locator('nav button[data-view="home"]').click();
  date = await seedRecipeMeal(
    page,
    "Geflügel-Gemüse-Hafer-Bällchen",
    ["pute", "karotte", "hafer"],
    3,
  );
  const familyRecipe = page.locator('#todayCard [data-planned-recipe-name="Geflügel-Gemüse-Hafer-Bällchen"]');
  await familyRecipe.waitFor();
  await familyRecipe.click();
  await page.locator("#genericModal.open .recipe-card-v2[open]").waitFor();
  assert.match(await page.locator("#genericBody").innerText(), /Variante:\s*Pute \+ Karotte/);
  await page.locator("#closeGeneric").click();

  // Erledigtes Rezept: der protokollierte Rezeptname bleibt direkt aufrufbar.
  await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    state.logs.push({
      id: "completed-recipe",
      date,
      meal: "lunch",
      focusId: "pute",
      foodIds: ["pute", "karotte", "hafer"],
      baseFoodIds: ["pute", "karotte", "hafer"],
      sampleFoodIds: [],
      recipeName: "Geflügel-Gemüse-Hafer-Bällchen",
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

  // Erledigter FOOD-Eintrag ohne recipeName darf NICHT auf das zuvor geplante Rezept zurückfallen.
  await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    state.logs = [{
      id: "completed-food-only",
      date,
      meal: "lunch",
      focusId: "banane",
      foodIds: ["banane", "ei"],
      baseFoodIds: ["banane", "ei"],
      sampleFoodIds: [],
      recipeName: "",
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
