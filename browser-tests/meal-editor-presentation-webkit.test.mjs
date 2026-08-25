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
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.openManualMealSelector);
  await page.waitForFunction(() => window.__handlingReadinessReady === true);
  await page.waitForFunction(() => window.__manualMealFlowRuntimeInstalled === true);
  await page.waitForFunction(() => window.__mealEditorRecipeVariantsInstalled === true);

  const today = await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    for (const id of ["hafer", "banane", "kuhmilch", "pfirsich", "karotte"]) {
      const item = state.foods.find((food) => food.id === id);
      if (item) item.manualStatus = "Verträgliche Basis";
    }
    window.__beikostTest.setState(state);
    return window.__beikostTest.today();
  });

  await page.evaluate((date) => {
    window.__beikostTest.openManualMealSelector(date, "breakfast", {
      meal: "breakfast",
      active: true,
      recipeName: "Obst-Haferbrei",
      foodIds: ["hafer", "banane"],
      baseFoodIds: ["hafer", "banane"],
      sampleFoodIds: [],
      foodRoles: { hafer: "base", banane: "base" },
      type: "bekannt",
    });
  }, today);

  const recipePresentation = page.locator("#genericBody .recipe-presentation-summary");
  await recipePresentation.waitFor();
  assert.match(await recipePresentation.innerText(), /^Darreichung/im);
  assert.match(
    await recipePresentation.innerText(),
    /Fein und glatt vom Löffel|Weich zerdrückt|Weich stückig|Weiches Fingerfood|Kleine weiche Stücke/,
  );
  assert.match(
    await recipePresentation.innerText(),
    /einzelne Zutaten haben hier keine eigene Konsistenzauswahl/,
  );
  assert.equal(
    await page.locator("#genericBody .manual-preparation-field:visible").count(),
    0,
    "bei einem Rezept darf keine Zutat eine eigene Darreichungsauswahl zeigen",
  );

  // Ein Tabwechsel ist noch keine fachliche Umwandlung des Rezepts in eine freie FOOD-Mahlzeit.
  // Erst die tatsächliche Auswahl eines FOODs darf die Rezeptidentität aufheben.
  await page.locator("#selectorFoods").click();
  await page.waitForFunction(() => document.getElementById("selectorFoods")?.classList.contains("active"));
  assert.equal(
    await page.locator("#genericBody .manual-preparation-field:visible").count(),
    0,
    "bloßes Öffnen des Lebensmittel-Tabs darf Rezeptzutaten nicht wieder einzeln editierbar machen",
  );
  await page.locator("#selectorRecipes").click();
  await page.locator('.selectRecipe.selected[data-recipe]').waitFor();
  await recipePresentation.waitFor();
  assert.equal(await page.locator("#genericBody .manual-preparation-field:visible").count(), 0);

  await page.evaluate((date) => {
    window.__beikostTest.openManualMealSelector(date, "breakfast", {
      meal: "breakfast",
      active: true,
      recipeName: "Milch-Getreide-Brei",
      foodIds: ["hafer", "kuhmilch"],
      baseFoodIds: ["hafer", "kuhmilch"],
      sampleFoodIds: [],
      foodRoles: { hafer: "base", kuhmilch: "base" },
      type: "bekannt",
    });
  }, today);
  await page.locator("#genericBody .recipe-presentation-summary").waitFor();
  assert.doesNotMatch(
    await page.locator("#genericBody").innerText(),
    /Komponentenformen brauchen außerhalb eines Rezepts/,
    "echte Rezepte dürfen nicht durch die freie Komponentenregel blockiert werden",
  );
  assert.equal(await page.locator("#genericBody .manual-preparation-field:visible").count(), 0);

  await page.evaluate((date) => window.__beikostTest.openManualMealSelector(date, "lunch"), today);
  await page.locator("#selectorFoods").click();

  const peach = page.locator('.selectFood[data-food="pfirsich"]');
  await peach.waitFor();
  await peach.click();
  const peachItem = page.locator('.manual-role-item').filter({ has: page.locator('[data-food="pfirsich"]') });
  await peachItem.waitFor();
  assert.equal(
    await peachItem.locator(".manual-preparation-field:visible").count(),
    0,
    "FOOD ohne expliziten Handling-Contract darf keine generische Fake-Auswahl zeigen",
  );
  await page.locator('.selectFood.selected[data-food="pfirsich"]').click();

  const carrot = page.locator('.selectFood[data-food="karotte"]');
  await carrot.waitFor();
  await carrot.click();
  const carrotItem = page.locator('.manual-role-item').filter({ has: page.locator('[data-food="karotte"]') });
  const carrotPreparation = carrotItem.locator(".manual-preparation-field:visible");
  await carrotPreparation.waitFor();
  assert.equal(await carrotPreparation.locator("label").textContent(), "Darreichung");
  const carrotSelect = carrotPreparation.locator("select[data-manual-preparation]");
  assert.equal(await carrotSelect.locator('option[value="pureed"]').count(), 1);
  assert.equal(await carrotSelect.locator('option[value="mashed"]').count(), 1);
  assert.equal(await carrotSelect.locator('option[value="fingerfood"]').count(), 1);
  assert.equal(
    await carrotSelect.locator('option[value="standard"]').count(),
    0,
    "generische Standardform darf im freien FOOD-Editor nicht als auswählbare Fake-Option bleiben",
  );

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
