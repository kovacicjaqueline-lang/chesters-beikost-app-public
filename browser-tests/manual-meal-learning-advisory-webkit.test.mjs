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

async function waitForApp(page) {
  await page.waitForFunction(() => !!window.__beikostTest?.openManualMealSelector);
  await page.waitForFunction(() => window.__manualMealFlowRuntimeInstalled === true);
}

async function selectFood(page, searchText, foodId) {
  await page.locator("#selectorFoods").click();
  const search = page.locator("#mealSelectorSearch");
  await search.fill(searchText);
  const option = page.locator(`.selectFood[data-food="${foodId}"]`);
  await option.waitFor();
  await option.click();
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

  const today = await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const bangus = state.foods.find((food) => food.id === "bangus-milkfish");
    const rice = state.foods.find((food) => food.id === "reis");
    if (!bangus || !rice) throw new Error("Bangus und Reis müssen im FOOD-Stamm vorhanden sein");
    bangus.manualStatus = "Offen";
    rice.manualStatus = "Probiert";
    window.__beikostTest.setState(state);
    const date = window.__beikostTest.today();
    window.__beikostTest.openManualMealSelector(date, "lunch");
    return date;
  });

  await selectFood(page, "Bangus", "bangus-milkfish");
  await selectFood(page, "Reis", "reis");

  await page.waitForFunction(() => {
    const ids = [...document.querySelectorAll(".removeManualSelected[data-food]")]
      .map((button) => button.dataset.food);
    return ids.includes("bangus-milkfish") && ids.includes("reis");
  });

  assert.equal(
    await page.locator(".manual-role-advisory").count(),
    0,
    "Bangus Offen + Reis Probiert darf keinen Mehrfach-Einführungshinweis erzeugen",
  );

  const confirm = page.locator("#confirmManualMeal");
  await confirm.waitFor();
  assert.equal(
    await confirm.isDisabled(),
    false,
    "Bangus Offen + Reis Probiert muss im manuellen Mahlzeiten-Editor speicherbar bleiben",
  );

  await confirm.click();
  await page.waitForFunction(
    ({ date, meal }) => !!window.__beikostTest.getState().manualMeals?.[`${date}|${meal}`],
    { date: today, meal: "lunch" },
  );

  const saved = await page.evaluate(({ date, meal }) => {
    const state = window.__beikostTest.getState();
    return state.manualMeals?.[`${date}|${meal}`] || null;
  }, { date: today, meal: "lunch" });

  assert.ok(saved, "die Mahlzeit muss tatsächlich gespeichert werden");
  assert.deepEqual(
    [...new Set(saved.foodIds || [])].sort(),
    ["bangus-milkfish", "reis"].sort(),
    "die gespeicherte Mahlzeit muss Bangus und Reis enthalten",
  );
  assert.equal(
    await page.locator("#genericModal").evaluate((element) => element.classList.contains("open")),
    false,
    "der Editor muss nach erfolgreichem Speichern geschlossen sein",
  );

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
