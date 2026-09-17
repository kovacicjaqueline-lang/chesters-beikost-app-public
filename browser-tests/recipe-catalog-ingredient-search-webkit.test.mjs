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

    fs.stat(filePath, (statError, stat) => {
      if (statError || !stat.isFile()) {
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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.reset);
  await page.waitForFunction(() => window.__plannerPoliciesReady === true);
  await page.evaluate(() => window.__beikostTest.reset());

  await page.locator('nav button[data-view="foods"]').click();
  await page.locator('#catalogSwitch [data-catalog-mode="recipes"]').click();
  await page.locator('[data-recipe-filter="all"]').click();

  const search = page.locator("#recipeSearch");
  const recipeNames = () => page.locator("#recipeList .recipe-card-v2 summary b").allTextContents();
  const beforeSearch = await recipeNames();
  assert.ok(beforeSearch.includes("Obst-Hafer-Pancakes"), "Ei-Rezept muss vor der Suche im Alle-Filter vorhanden sein");
  assert.ok(beforeSearch.includes("Milch-Getreide-Brei"), "Kontrollrezept muss vor der Suche im Alle-Filter vorhanden sein");

  assert.equal(
    await page.locator(".recipe-filter-field > label").textContent(),
    "Mahlzeit & Kategorie",
    "Der Rezeptfilter muss Mahlzeiten und Kategorien gemeinsam benennen",
  );

  await page.locator('[data-recipe-filter="breakfast"]').click();
  const breakfastRecipes = await recipeNames();
  assert.ok(
    breakfastRecipes.includes("Obst-Hafer-Pancakes"),
    "Frühstück muss Rezepte mit frühstückstauglichen FOOD-Zutaten enthalten",
  );
  assert.ok(
    breakfastRecipes.includes("Milch-Getreide-Brei"),
    "Frühstück muss auch variable Rezepte mit mindestens einer frühstückstauglichen Auswahl enthalten",
  );
  assert.equal(
    breakfastRecipes.includes("Rind-Hafer-Bällchen"),
    false,
    "Frühstück darf Rezepte mit nicht frühstückstauglicher Pflichtzutat nicht enthalten",
  );
  assert.match(await page.locator("#recipeCount").textContent(), /Frühstück/);

  await page.locator('[data-recipe-filter="main"]').click();
  const mainMealRecipes = await recipeNames();
  assert.ok(
    mainMealRecipes.includes("Rind-Hafer-Bällchen"),
    "Hauptmahlzeit muss Rezepte enthalten, deren Zutaten für Mittag oder Abend geeignet sind",
  );
  assert.ok(
    mainMealRecipes.includes("Obst-Hafer-Pancakes"),
    "Hauptmahlzeit bleibt absichtlich nicht exklusiv, wenn die FOOD-Zutaten auch dafür geeignet sind",
  );
  assert.match(await page.locator("#recipeCount").textContent(), /Hauptmahlzeit/);

  await page.locator('[data-recipe-filter="snack"]').click();
  const snackRecipes = await recipeNames();
  assert.ok(
    snackRecipes.includes("Weiche Apfel-Hafer-Riegel"),
    "Snack bleibt rezeptgetrieben über den bestehenden Snack-Tag",
  );
  assert.equal(
    snackRecipes.includes("Rind-Hafer-Bällchen"),
    false,
    "Snack darf nicht aus FOOD-Mahlzeiteneignung abgeleitet werden",
  );
  assert.match(await page.locator("#recipeCount").textContent(), /Snack/);

  await page.locator('[data-recipe-filter="all"]').click();
  await search.fill("Ei");
  const afterEggSearch = await recipeNames();

  assert.ok(
    afterEggSearch.includes("Obst-Hafer-Pancakes"),
    "Die Suche nach Ei muss Rezepte finden, die Ei als strukturierte Zutat enthalten",
  );
  assert.equal(
    afterEggSearch.includes("Milch-Getreide-Brei"),
    false,
    "Die Suche nach Ei darf nicht nur wegen der Buchstabenfolge in „Brei“ treffen",
  );
  const nonEggIngredientResults = await page.evaluate((names) => {
    const egg = foodByName("Ei", FOOD_DB);
    return names.filter((name) => {
      const recipe = recipeByName(name);
      const labels = [
        ...(recipe?.requires || []),
        ...((recipe?.alternatives || []).flat()),
        ...(recipe?.oneOf || []),
        ...(recipe?.milkChoices || []),
      ];
      return !egg || !labels.some((label) => recipeFoodFromStructuredLabel(label, FOOD_DB)?.id === egg.id);
    });
  }, afterEggSearch);
  assert.deepEqual(
    nonEggIngredientResults,
    [],
    "Jeder Treffer für die exakte Lebensmittelsuche Ei muss Ei als strukturierte Rezeptzutat enthalten",
  );

  await search.fill("flocken");
  const afterLongSearch = await recipeNames();
  assert.ok(
    afterLongSearch.includes("Obst-Hafer-Pancakes"),
    "Längere Suchbegriffe müssen weiterhin in der Zutatenbeschreibung gefunden werden",
  );

  await search.fill("Pecannuss");
  const afterPecanSearch = await recipeNames();
  assert.ok(
    afterPecanSearch.includes("Joghurt-Nussmus-Miniportion"),
    "Eine neuere geeignete Nuss aus FOOD muss automatisch das generische Nussmus-Rezept erreichen",
  );
  const nutButterRuntime = await page.evaluate(() => {
    const pecan = FOOD_DB.find((item) => item.id === "pecannuss");
    const tahin = FOOD_DB.find((item) => item.id === "tahin");
    const maroni = FOOD_DB.find((item) => item.id === "maroni");
    const recipe = recipeByName("Joghurt-Nussmus-Miniportion");
    return {
      pecanEligible: foodHasRecipeComponentKind(pecan, "smooth-paste"),
      pecanForm: foodRecipeComponentForm(pecan, "smooth-paste"),
      tahinForm: foodRecipeComponentForm(tahin, "smooth-paste"),
      maroniEligible: foodHasRecipeComponentKind(maroni, "smooth-paste"),
      choices: [...(recipe?.oneOf || [])],
    };
  });
  assert.equal(nutButterRuntime.pecanEligible, true);
  assert.equal(nutButterRuntime.pecanForm, "canonical");
  assert.equal(nutButterRuntime.tahinForm, "prepared");
  assert.equal(nutButterRuntime.maroniEligible, false);
  assert.ok(nutButterRuntime.choices.includes("Pecannuss"));
  assert.equal(nutButterRuntime.choices.includes("Maroni"), false);
  assert.equal(nutButterRuntime.choices.includes("Tahin"), false);

  assert.deepEqual(pageErrors, [], "Die Rezeptsuche darf keine JavaScript-Fehler auslösen");

  await context.close();
  console.log("recipe-catalog-ingredient-search-webkit: ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
