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

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b, "de"));
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
  await page.waitForFunction(() => typeof window.installRecipeV2ComponentOptions === "function");
  await page.waitForFunction(() => !!window.__beikostTest?.openManualMealSelector);
  await page.waitForFunction(() => window.__mealEditorRecipeVariantsInstalled === true);

  const runtime = await page.evaluate(() => {
    const ids = (names) => names.map((name) => foodByName(name, FOOD_DB)?.id || `missing:${name}`);
    return {
      fruit: ids(recipeByName("Obst-Reisbrei")?.oneOf || []),
      milkGrains: ids(recipeByName("Milch-Getreide-Brei")?.oneOf || []),
      milkChoices: ids(recipeByName("Milch-Getreide-Brei")?.milkChoices || []),
      bananaBreadGrains: ids(recipeByName("Baby-Bananenbrot")?.oneOf || []),
      pancakeVegetables: ids(recipeByName("Gemüse-Hafer-Pancakes")?.oneOf || []),
      muffinVegetables: ids(recipeByName("Gemüse-Hafer-Muffins")?.oneOf || []),
      yoghurtMuffinVegetables: ids(recipeByName("Gemüse-Joghurt-Mini-Muffins")?.oneOf || []),
      chickenMuffinVegetables: ids(recipeByName("Huhn-Gemüse-Muffins")?.oneOf || []),
      beans: ids(recipeByName("Bohnen-Kartoffel-Stampf")?.oneOf || []),
    };
  });

  assert.ok(runtime.fruit.includes("brombeere"), "Obst-Reisbrei muss Brombeere aus FOOD.category enthalten");
  assert.deepEqual(
    sorted(runtime.milkGrains),
    sorted(["hafer", "hirse", "polenta", "weizen", "dinkel", "buchweizen"]),
  );
  assert.equal(runtime.milkGrains.includes("reis"), false, "Reis darf nicht allein aufgrund der Getreide-Kategorie in den Milchbrei gelangen");
  assert.deepEqual(
    sorted(runtime.milkChoices),
    sorted(["kuhmilch", "naturjoghurt", "buttermilch", "haferdrink", "sojabohne", "mandel", "kokos"]),
  );
  assert.deepEqual(sorted(runtime.bananaBreadGrains), sorted(["hafer", "dinkel", "weizen"]));
  assert.deepEqual(sorted(runtime.pancakeVegetables), sorted(["kuerbis", "suesskartoffel"]));
  const muffinVegetables = sorted(["zucchini", "karotte", "brokkoli", "suesskartoffel"]);
  assert.deepEqual(sorted(runtime.muffinVegetables), muffinVegetables);
  assert.deepEqual(sorted(runtime.yoghurtMuffinVegetables), muffinVegetables);
  assert.deepEqual(sorted(runtime.chickenMuffinVegetables), muffinVegetables);
  assert.deepEqual(sorted(runtime.beans), sorted(["weisse-bohnen", "schwarze-bohnen"]));

  const today = await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    for (const id of ["reis", "brombeere"]) {
      const item = state.foods.find((food) => food.id === id);
      if (item) item.manualStatus = "Bekannt";
    }
    window.__beikostTest.setState(state);
    return window.__beikostTest.today();
  });

  await page.evaluate((date) => {
    window.__beikostTest.openManualMealSelector(date, "breakfast", {
      meal: "breakfast",
      active: true,
      recipeName: "Obst-Reisbrei",
      foodIds: ["reis", "brombeere"],
      baseFoodIds: ["reis", "brombeere"],
      sampleFoodIds: [],
      foodRoles: { reis: "base", brombeere: "base" },
      type: "bekannt",
    });
  }, today);

  const fruitSlot = page.locator('[data-recipe-component-slot="oneOf"]');
  await fruitSlot.waitFor();
  const blackberry = fruitSlot.locator('option[value="brombeere"]');
  assert.equal(await blackberry.count(), 1, "Brombeere muss im echten Obst-Reisbrei-Editor auswählbar sein");
  assert.equal(await blackberry.textContent(), "Brombeere");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
