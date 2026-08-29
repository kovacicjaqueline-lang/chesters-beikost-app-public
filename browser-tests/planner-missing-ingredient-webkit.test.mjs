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
  await page.waitForFunction(() => !!window.__beikostTest?.getState && !!window.__plannerMissingIngredient);

  const setup = await page.evaluate(() => {
    window.__beikostTest.reset();
    const current = window.__beikostTest.today();
    const future = window.__beikostTest.addDays(current, 2);
    const carriedDate = window.__beikostTest.addDays(current, 3);
    const state = window.__beikostTest.getState();
    state.logs = [
      {
        id: "missing-ingredient-apfel-history",
        date: window.__beikostTest.addDays(current, -2),
        meal: "breakfast",
        foodIds: ["apfel"],
        foodOutcomes: { apfel: "eaten" },
        outcome: "eaten",
        createdAt: `${window.__beikostTest.addDays(current, -2)}T08:00:00.000Z`,
      },
      {
        id: "missing-ingredient-birne-history",
        date: window.__beikostTest.addDays(current, -1),
        meal: "breakfast",
        foodIds: ["birne"],
        foodOutcomes: { birne: "eaten" },
        outcome: "eaten",
        createdAt: `${window.__beikostTest.addDays(current, -1)}T08:00:00.000Z`,
      },
    ];
    state.settings.phaseSelected = "aufbau";
    state.settings.planFrom = current;
    state.shoppingHints = {};
    state.followUps = {};
    state.pantry = {};
    state.overrides = {};
    state.autoLockExcluded = {};
    state.planLocks = {};
    state.manualMeals = {};
    state.backupMeta ||= {};
    state.backupMeta.plannerLinking = {
      version: 1,
      rolloverHandled: {},
      carriedPlans: {},
    };
    for (const id of ["hafer", "banane", "apfel", "birne"]) {
      const item = state.foods.find((food) => food.id === id);
      if (item) item.manualStatus = "Regelmäßig";
    }

    const currentKey = `${current}|breakfast`;
    const currentMeal = {
      date: current,
      meal: "breakfast",
      active: true,
      focusId: "hafer",
      foodIds: ["hafer", "banane"],
      baseFoodIds: ["hafer"],
      sampleFoodIds: [],
      foodRoles: { hafer: "base", banane: "component" },
      recipeName: "Obst-Haferbrei",
      recipeInventoryId: "",
      type: "Rezept",
      manualAdded: false,
    };
    state.manualMeals[currentKey] = { ...currentMeal };
    state.planLocks[currentKey] = { ...currentMeal, mode: "manual" };

    const futureKey = `${future}|lunch`;
    const futureMeal = {
      date: future,
      meal: "lunch",
      active: true,
      focusId: "banane",
      foodIds: ["banane"],
      baseFoodIds: [],
      sampleFoodIds: ["banane"],
      foodRoles: { banane: "sample" },
      recipeName: "",
      type: "neu",
      manualAdded: true,
    };
    state.manualMeals[futureKey] = { ...futureMeal };
    state.planLocks[futureKey] = { ...futureMeal, mode: "manual" };
    state.overrides[futureKey] = "banane";

    const carriedPlanId = "missing-ingredient-carried";
    state.backupMeta.plannerLinking.carriedPlans[carriedPlanId] = {
      planId: carriedPlanId,
      date: carriedDate,
      meal: "lunch",
      active: true,
      focusId: "banane",
      foodIds: ["banane"],
      baseFoodIds: [],
      sampleFoodIds: ["banane"],
      foodRoles: { banane: "sample" },
      type: "neu",
      source: "carried",
      carriedPlannerPlan: true,
    };

    window.__beikostTest.setState(state);
    return { current, future, currentKey, futureKey, carriedPlanId, initialLogCount: state.logs.length };
  });

  const actions = page.locator("#todayCard details.meal-plan-actions").filter({
    has: page.locator(`.missingIngredient[data-missing-date="${setup.current}"][data-missing-meal="breakfast"]`),
  }).first();
  await actions.locator(":scope > summary").click();
  const missingButton = actions.locator(".missingIngredient");
  await missingButton.waitFor();
  assert.equal(await missingButton.innerText(), "Zutat fehlt");
  assert.equal(await actions.locator(".randomizeMeal").count(), 1, "Tauschen bleibt als bestehende Nachbaraktion erhalten");

  await missingButton.click();
  await page.locator("#genericModal.open").waitFor();
  assert.equal(await page.locator("#genericTitle").innerText(), "Welche Zutat fehlt?");
  assert.equal(await page.locator('.missingIngredientChoice[data-food="banane"]').count(), 1);
  assert.equal(await page.locator('.missingIngredientChoice[data-food="hafer"]').count(), 1);

  const screenshotDir = path.join(root, "artifacts", "browser-tests", "plan-checks-ux-webkit");
  fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, "missing-ingredient-flow.png"),
    fullPage: false,
  });

  await page.locator('.missingIngredientChoice[data-food="banane"]').click();
  await page.waitForFunction(() => !document.getElementById("genericModal")?.classList.contains("open"));

  const after = await page.evaluate(({ currentKey, futureKey, carriedPlanId }) => {
    const state = window.__beikostTest.getState();
    return {
      logs: state.logs,
      hint: state.shoppingHints?.banane,
      pantry: state.pantry?.banane,
      followUp: state.followUps?.banane,
      currentMeal: state.manualMeals?.[currentKey] || state.planLocks?.[currentKey] || null,
      futureManual: state.manualMeals?.[futureKey] || null,
      futureLock: state.planLocks?.[futureKey] || null,
      futureOverride: state.overrides?.[futureKey] || null,
      carried: state.backupMeta?.plannerLinking?.carriedPlans?.[carriedPlanId] || null,
      unavailable: typeof window.isFoodUnavailable === "function" ? window.isFoodUnavailable("banane") : null,
    };
  }, setup);

  assert.equal(after.logs.length, setup.initialLogCount, "Plan-Aktion darf keinen Essens-Log erzeugen");
  assert.equal(after.hint?.status, "needed");
  assert.equal(after.hint?.source, "plan");
  assert.equal(after.pantry, false);
  assert.equal(after.followUp?.status, "awaiting_stock");
  assert.equal(after.followUp?.meal, "breakfast");
  assert.equal(after.unavailable, true);
  assert.ok(after.currentMeal, "aktueller Rezeptslot bleibt bei austauschbarer Nebenkomponente bestehen");
  assert.equal(after.currentMeal.recipeName, "Obst-Haferbrei");
  assert.equal(after.currentMeal.foodIds.includes("banane"), false);
  assert.ok(after.currentMeal.foodIds.some((id) => ["apfel", "birne"].includes(id)), "fehlendes Obst wird innerhalb der Recipe-V2-Auswahl ersetzt");
  assert.equal(after.futureManual, null, "zukünftiger offener manueller Banane-Slot wird freigegeben");
  assert.ok(after.futureLock, "freigegebener Zukunftsslot darf direkt ohne Banane neu geplant werden");
  assert.equal(after.futureLock.foodIds.includes("banane"), false, "neu geplanter Zukunftsslot enthält die fehlende Zutat nicht");
  assert.equal(after.futureOverride, null, "zukünftiger Banane-Override wird entfernt");
  assert.equal(after.carried, null, "auch ein verschobener offener Rollover-Plan mit Banane wird entfernt");
  assert.match(await page.locator("#toastText").innerText(), /Einkaufsliste.*Plan wurde angepasst/i);

  const stockProbe = await page.evaluate((current) => {
    const state = window.__beikostTest.getState();
    state.settings.preferInventoryInPlan = true;
    state.settings.textureStage = 3;
    let exposureIndex = 0;
    for (const name of ["Ube (violette Yamswurzel)", "Ei", "Hafer", "Banane"]) {
      const item = window.foodByName(name, state.foods);
      if (!item) continue;
      item.manualStatus = "Regelmäßig";
      if (!state.logs.some((log) => (log.foodIds || []).includes(item.id) && log.foodOutcomes?.[item.id] === "eaten")) {
        state.logs.push({
          id: `missing-stock-history-${item.id}`,
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
      ...(state.inventory || []).filter((item) => item.id !== "missing-ingredient-recipe-stock"),
      {
        id: "missing-ingredient-recipe-stock",
        kind: "recipe",
        recipeName: "Ube-Bananen-Pancakes",
        portions: 1,
        size: "Stück",
        frozenDate: current,
        note: "Browser-Regression",
      },
    ];
    window.__beikostTest.setState(state);
    window.__plannerMissingIngredient.installAvailabilityPolicies();
    const ctx = window.freshPlanContext();
    const candidate = window.recipeStockCandidate("lunch", current, ctx);
    const preparedIds = candidate ? window.recipeFoodIds(candidate) : [];
    const freshRecipe = window.recipeByName("Ube-Bananen-Pancakes");
    const freshIds = freshRecipe ? window.recipeFoodIds(freshRecipe) : [];
    const freshState = window.recipeStates().find((recipe) => recipe.name === "Ube-Bananen-Pancakes") || null;
    return {
      candidateName: candidate?.name || "",
      preparedStock: !!candidate?.__missingIngredientPreparedStock,
      preparedIds,
      freshIds,
      freshUnlocked: freshState?.unlocked ?? null,
    };
  }, setup.current);
  assert.equal(stockProbe.candidateName, "Ube-Bananen-Pancakes", "fertiger Rezeptvorrat bleibt als Planner-Kandidat erhalten");
  assert.equal(stockProbe.preparedStock, true, "nur der echte Rezeptvorrat erhält den Availability-Bypass");
  assert.ok(stockProbe.preparedIds.includes("banane"), "fertige Portion behält ihre tatsächlich enthaltene Banane");
  assert.equal(stockProbe.freshIds.length, 0, "frisch zuzubereitendes Rezept bleibt bei fehlender Banane gesperrt");
  assert.equal(stockProbe.freshUnlocked, false, "Rezeptkatalog darf die frische Variante nicht freischalten");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState && !!window.__plannerMissingIngredient);
  const reloadStockProbe = await page.evaluate((current) => {
    const ctx = window.freshPlanContext();
    const candidate = window.recipeStockCandidate("lunch", current, ctx);
    const preparedIds = candidate ? window.recipeFoodIds(candidate) : [];
    const freshRecipe = window.recipeByName("Ube-Bananen-Pancakes");
    const freshIds = freshRecipe ? window.recipeFoodIds(freshRecipe) : [];
    return {
      wrapped: !!window.recipeStockCandidate?.__missingIngredientAware,
      candidateName: candidate?.name || "",
      preparedStock: !!candidate?.__missingIngredientPreparedStock,
      preparedIds,
      freshIds,
    };
  }, setup.current);
  assert.equal(reloadStockProbe.wrapped, true, "Availability-Wrapper wird nach app.js beim Reload erneut installiert");
  assert.equal(reloadStockProbe.candidateName, "Ube-Bananen-Pancakes", "fertiger Rezeptvorrat bleibt auch nach Reload planbar");
  assert.equal(reloadStockProbe.preparedStock, true);
  assert.ok(reloadStockProbe.preparedIds.includes("banane"));
  assert.equal(reloadStockProbe.freshIds.length, 0, "frische Rezeptvariante bleibt auch nach Reload gesperrt");

  await page.locator('nav button[data-view="prep"]').click();
  const shoppingRow = page.locator('.shopping-row[data-shopping-hint], .shopping-row').filter({ hasText: "Banane" }).first();
  await shoppingRow.waitFor();
  assert.match(await shoppingRow.innerText(), /Zutat nicht verfügbar.*nach Kauf wieder einplanen/i);
  assert.equal(await page.locator(".shopping-followup-title").innerText(), "Fehlende Zutaten");

  await shoppingRow.click();
  await page.waitForFunction(() => window.__beikostTest.getState().shoppingHints?.banane?.status === "available");
  const purchased = await page.evaluate(() => {
    const state = window.__beikostTest.getState();
    return {
      pantry: state.pantry?.banane,
      hint: state.shoppingHints?.banane?.status,
      followUp: state.followUps?.banane?.status,
      unavailable: typeof window.isFoodUnavailable === "function" ? window.isFoodUnavailable("banane") : null,
    };
  });
  assert.equal(purchased.pantry, true);
  assert.equal(purchased.hint, "available");
  assert.equal(purchased.unavailable, false);
  assert.equal(purchased.followUp, "scheduled", "nach Einkauf wird die Zutat gezielt wieder eingeplant");

  const logUnavailableStockProbe = await page.evaluate((current) => {
    const state = window.__beikostTest.getState();
    state.pantry ||= {};
    state.pantry.banane = false;
    state.logs = [
      ...(state.logs || []).filter((log) => log.id !== "missing-ingredient-log-unavailable"),
      {
        id: "missing-ingredient-log-unavailable",
        date: current,
        meal: "lunch",
        focusId: "banane",
        foodIds: ["banane"],
        baseFoodIds: [],
        sampleFoodIds: ["banane"],
        foodRoles: { banane: "sample" },
        foodOutcomes: { banane: "not_offered" },
        outcome: "not_offered",
        notOfferedReason: "unavailable",
        createdAt: `${current}T23:59:00.000Z`,
      },
    ];
    window.__beikostTest.setState(state);
    window.rebuildFoodConsequences("banane");
    const currentState = window.__beikostTest.getState();
    const ctx = window.freshPlanContext();
    const candidate = window.recipeStockCandidate("lunch", current, ctx);
    const preparedIds = candidate ? window.recipeFoodIds(candidate) : [];
    const freshRecipe = window.recipeByName("Ube-Bananen-Pancakes");
    const freshIds = freshRecipe ? window.recipeFoodIds(freshRecipe) : [];
    return {
      sourceLogId: currentState.shoppingHints?.banane?.sourceLogId || "",
      source: currentState.shoppingHints?.banane?.source || "",
      unavailable: typeof window.isFoodUnavailable === "function" ? window.isFoodUnavailable("banane") : null,
      candidateName: candidate?.name || "",
      preparedStock: !!candidate?.__missingIngredientPreparedStock,
      preparedIds,
      freshIds,
    };
  }, setup.current);
  assert.equal(logUnavailableStockProbe.sourceLogId, "missing-ingredient-log-unavailable", "bestehender Log-Pfad erzeugt den Availability-Hinweis");
  assert.equal(logUnavailableStockProbe.source, "", "Log-Hinweis ist kein planbasierter Missing-Ingredient-Hinweis");
  assert.equal(logUnavailableStockProbe.unavailable, true);
  assert.equal(logUnavailableStockProbe.candidateName, "Ube-Bananen-Pancakes", "fertiger Rezeptvorrat bleibt auch bei Log-basierter Nichtverfügbarkeit planbar");
  assert.equal(logUnavailableStockProbe.preparedStock, true);
  assert.ok(logUnavailableStockProbe.preparedIds.includes("banane"));
  assert.equal(logUnavailableStockProbe.freshIds.length, 0, "frisch zuzubereitendes Rezept bleibt auch beim Log-Pfad gesperrt");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
