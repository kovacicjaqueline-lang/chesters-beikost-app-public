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
  ".webmanifest": "application/manifest+json",
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
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState && !!window.__plannerMissingIngredient);

  const current = await page.evaluate(() => {
    window.__beikostTest.reset();
    const current = window.__beikostTest.today();
    const state = window.__beikostTest.getState();
    state.settings.phaseSelected = "aufbau";
    state.settings.planFrom = current;
    state.settings.preferInventoryInPlan = true;
    state.settings.textureStage = 3;
    state.shoppingHints ||= {};
    state.pantry ||= {};
    state.shoppingHints.banane = {
      foodId: "banane",
      status: "needed",
      source: "plan",
      planDate: current,
      meal: "lunch",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.pantry.banane = false;
    let exposureIndex = 0;
    for (const name of ["Ube (violette Yamswurzel)", "Ei", "Hafer", "Banane"]) {
      const item = window.foodByName(name, state.foods);
      if (!item) continue;
      item.manualStatus = "Regelmäßig";
      if (!state.logs.some((log) => (log.foodIds || []).includes(item.id) && log.foodOutcomes?.[item.id] === "eaten")) {
        state.logs.push({
          id: `missing-diagnostic-history-${item.id}`,
          date: current,
          meal: "breakfast",
          foodIds: [item.id],
          foodOutcomes: { [item.id]: "eaten" },
          outcome: "eaten",
          createdAt: `${current}T06:${String(exposureIndex++).padStart(2, "0")}:00.000Z`,
        });
      }
    }
    state.inventory = [
      ...(state.inventory || []).filter((item) => item.id !== "missing-diagnostic-recipe-stock"),
      {
        id: "missing-diagnostic-recipe-stock",
        kind: "recipe",
        recipeName: "Ube-Bananen-Pancakes",
        portions: 1,
        size: "Stück",
        frozenDate: current,
        note: "Reload-Diagnose",
      },
    ];
    window.__beikostTest.setState(state);
    window.__plannerMissingIngredient.installAvailabilityPolicies();
    const candidate = window.recipeStockCandidate("lunch", current, window.freshPlanContext());
    if (candidate?.name !== "Ube-Bananen-Pancakes") throw new Error("Diagnose-Vorbedingung: Vorrat vor Reload nicht planbar");
    return current;
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState && !!window.__plannerMissingIngredient);

  const diagnostic = await page.evaluate((on) => {
    const state = window.__beikostTest.getState();
    const inventory = (state.inventory || []).find((item) => item.id === "missing-diagnostic-recipe-stock") || null;
    const before = window.recipeStockCandidate("lunch", on, window.freshPlanContext());
    const beforeMarker = !!window.recipeStockCandidate?.__missingIngredientAware;
    const foodIdsMarker = !!window.recipeFoodIds?.__missingIngredientAware;
    const loadMarker = !!window.load?.__missingIngredientAware;
    window.__plannerMissingIngredient.installAvailabilityPolicies();
    const after = window.recipeStockCandidate("lunch", on, window.freshPlanContext());
    return {
      inventory,
      hint: state.shoppingHints?.banane || null,
      pantry: state.pantry?.banane ?? null,
      unavailable: typeof window.isFoodUnavailable === "function" ? window.isFoodUnavailable("banane") : null,
      beforeName: before?.name || "",
      afterName: after?.name || "",
      beforeMarker,
      afterMarker: !!window.recipeStockCandidate?.__missingIngredientAware,
      foodIdsMarker,
      loadMarker,
    };
  }, current);

  console.log(`MISSING_INGREDIENT_RELOAD_DIAGNOSTIC ${JSON.stringify(diagnostic)}`);
  assert.equal(
    diagnostic.beforeName,
    "Ube-Bananen-Pancakes",
    `Reload-Diagnose: ${JSON.stringify(diagnostic)}`,
  );

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
