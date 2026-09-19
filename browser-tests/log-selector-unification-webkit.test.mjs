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

async function reset(page) {
  await page.evaluate(() => {
    const next = window.__beikostTest.reset();
    next.logs = [];
    next.backupMeta.chesterContextSeeded = true;
    window.__beikostTest.setState(next);
  });
}

async function seedRecents(page) {
  return page.evaluate(() => {
    const next = window.__beikostTest.getState();
    const foods = next.foods.filter((item) => item.active).slice(0, 6);
    const recipes = RECIPES.slice(0, 5);
    assertForSeed(foods.length >= 5 && recipes.length >= 5);
    const row = (id, date, recipe, foodIds) => ({
      id,
      date,
      meal: "",
      foodIds,
      focusId: foodIds[0],
      recipeName: recipe,
      outcome: "eaten",
      foodOutcomes: Object.fromEntries(foodIds.map((foodId) => [foodId, "eaten"])),
      entryType: "food",
      baseFoodIds: foodIds,
      sampleFoodIds: [],
      individualRatings: false,
      amount: "",
      textureKnown: true,
      textureStage: 1,
      createdAt: `${date}T12:00:00.000Z`,
      updatedAt: `${date}T12:00:00.000Z`,
    });
    next.logs = [
      row("recent-1", "2026-09-05", recipes[0].name, [foods[0].id, foods[1].id]),
      row("recent-2", "2026-09-04", recipes[1].name, [foods[1].id, foods[2].id]),
      row("recent-3", "2026-09-03", recipes[0].name, [foods[3].id]),
      row("recent-4", "2026-09-02", recipes[2].name, [foods[4].id]),
      row("recent-5", "2026-09-01", recipes[3].name, [foods[0].id]),
      row("recent-6", "2026-08-31", recipes[4].name, [foods[5].id]),
    ];
    window.__beikostTest.setState(next);
    return {
      recipes: [recipes[0].name, recipes[1].name, recipes[2].name, recipes[3].name],
      foods: [foods[0], foods[1], foods[2], foods[3]].map(({ id, name }) => ({ id, name })),
    };

    function assertForSeed(condition) {
      if (!condition) throw new Error("Testdaten für Recents fehlen");
    }
  });
}

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState && window.__flowDialogUiInstalled === true);

  await reset(page);
  const expected = await seedRecents(page);
  await page.evaluate(() => {
    window.__prepDemandCalls = 0;
    const original = prepDemand;
    prepDemand = (...args) => {
      window.__prepDemandCalls += 1;
      return original(...args);
    };
    openLog(null);
  });
  const selector = page.locator("#logForm .flow-log-selector");
  const logSheet = page.locator("#logModal .sheet");
  await selector.waitFor();
  assert.notEqual(
    await page.evaluate(() => document.activeElement?.id),
    "logRecipeSearch",
    "Beim Öffnen darf das Suchfeld nicht automatisch fokussiert werden",
  );
  assert.equal(
    await logSheet.evaluate((element) => element.scrollTop),
    0,
    "Der Dialog muss beim Öffnen am oberen Anfang starten",
  );
  const initialSheetMetrics = await logSheet.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  if (initialSheetMetrics.scrollHeight > initialSheetMetrics.clientHeight) {
    await logSheet.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.waitForFunction(() => document.querySelector("#logModal .sheet")?.scrollTop > 0);
  }
  await page.locator("#cancelLog").click();
  await page.waitForFunction(() => !document.getElementById("logModal")?.classList.contains("open"));
  await page.evaluate(() => openLog(null));
  await selector.waitFor();
  assert.equal(
    await logSheet.evaluate((element) => element.scrollTop),
    0,
    "Auch nach einem vorherigen Scrollen muss der Dialog beim erneuten Öffnen oben starten",
  );
  assert.equal(await page.evaluate(() => window.__prepDemandCalls), 0, "Leerer FOOD-Zustand darf prepDemand() nicht aufrufen");
  assert.equal(await page.locator("#logDate").isVisible(), true);
  assert.equal(await page.evaluate(() => {
    const date = document.getElementById("logDate")?.closest(".field, .log-date-grid");
    const selection = document.querySelector("#logForm .flow-log-selector");
    return !!date && !!selection && !!(date.compareDocumentPosition(selection) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), true, "Datum muss vor dem Auswahlbereich stehen");

  const tabs = selector.locator(".flow-log-selector-tabs [data-flow-log-selector]");
  assert.deepEqual(await tabs.allTextContents(), ["Rezepte", "Lebensmittel"]);
  assert.equal(await selector.locator('[data-flow-log-selector="recipes"]').getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#logRecipeSearch").isVisible(), true);
  assert.equal(await page.locator("#logRecipeSearch").getAttribute("placeholder"), "Rezept suchen");
  assert.equal(await page.locator('[data-flow-log-search-toggle]').count(), 0, "Zusätzliche Suchbuttons dürfen nicht mehr existieren");

  const recipeRows = page.locator(".log-recipe-results .selectLogRecipeResult");
  assert.equal(await recipeRows.count(), 4);
  assert.deepEqual(await recipeRows.locator(".log-result-name").allTextContents(), expected.recipes);
  assert.equal(await recipeRows.locator(".log-result-meta").count(), 0);
  assert.equal(await page.locator("#logForm").getByText("Zuletzt eingetragen", { exact: true }).count(), 0);
  assert.equal(await page.locator(".log-recipe-results-label").isVisible(), false);

  await page.locator("#logRecipeSearch").fill("unauffindbar-rezept-xyz");
  assert.equal(await page.locator(".log-recipe-results").textContent(), "Kein Rezept gefunden");
  assert.equal(await recipeRows.count(), 0);

  await selector.locator('[data-flow-log-selector="foods"]').click();
  await page.waitForFunction(() => document.activeElement?.id === "logFoodSearch");
  assert.equal(await page.locator("#logRecipeSearch").inputValue(), "");
  assert.equal(await page.locator("#logFoodSearch").inputValue(), "");
  assert.equal(await selector.locator('[data-flow-log-selector="foods"]').getAttribute("aria-pressed"), "true");

  const foodRows = page.locator(".log-food-results .addLogFoodResult");
  assert.equal(await foodRows.count(), 4);
  assert.deepEqual(await foodRows.locator(".log-result-name").allTextContents(), expected.foods.map((item) => item.name));
  assert.equal(await foodRows.locator(".log-result-meta").count(), 0);
  assert.equal(await page.locator(".log-food-results-label").isVisible(), false);
  assert.equal(await page.locator("#addCustomLogFood").isVisible(), false, "Custom-Food darf im leeren Zustand nicht sichtbar sein");

  await page.locator("#logFoodSearch").fill(expected.foods[0].name);
  await page.locator(`.addLogFoodResult[data-food="${expected.foods[0].id}"]`).waitFor();
  assert.equal(await page.locator("#addCustomLogFood").isVisible(), false);
  await page.locator("#logFoodSearch").fill("eigenes-testfood-xyz");
  assert.equal(await page.locator(".log-food-results").textContent(), "Kein Lebensmittel gefunden");
  assert.equal(await page.locator("#addCustomLogFood").isVisible(), true);
  assert.match(await page.locator("#addCustomLogFood").textContent(), /eigenes-testfood-xyz/);
  assert.equal(await page.evaluate(() => {
    const results = document.querySelector(".log-food-results");
    const custom = document.getElementById("addCustomLogFood");
    return !!results && !!custom && !!(results.compareDocumentPosition(custom) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), true, "Custom-Food-Aktion muss unter dem 0-Treffer-Hinweis stehen");

  await page.locator("#logFoodSearch").fill("");
  const recentFood = page.locator(`.addLogFoodResult[data-food="${expected.foods[0].id}"]`);
  await recentFood.click();
  await page.waitForFunction(() => document.activeElement?.id === "logFoodSearch");
  assert.equal(await page.locator("#logFoodSearch").inputValue(), "");
  const selectedRecent = page.locator(`.addLogFoodResult.selected[data-food="${expected.foods[0].id}"]`);
  await selectedRecent.waitFor();
  assert.equal(await selectedRecent.locator(".log-result-add").textContent(), "✓");

  await page.locator('[data-flow-log-selector="recipes"]').click();
  await page.waitForFunction(() => document.activeElement?.id === "logRecipeSearch");
  assert.equal(await page.locator("#logFoodSearch").inputValue(), "");
  assert.equal(await page.locator("#logRecipeSearch").inputValue(), "");

  await page.locator("#logRecipeSearch").fill(expected.recipes[0]);
  await page.locator(".selectLogRecipeResult").filter({ hasText: expected.recipes[0] }).first().click();
  await page.waitForFunction(() => document.querySelector("#logForm .flow-log-selector")?.hidden === false);
  assert.equal(await selector.isVisible(), true);
  assert.deepEqual(await tabs.allTextContents(), ["Rezepte", "Lebensmittel"]);
  assert.equal(await selector.locator('[data-flow-log-selector="recipes"]').getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".selected-target .small").count(), 0);
  assert.equal((await page.locator(".selected-target b").textContent()).trim(), expected.recipes[0]);
  assert.equal(await page.locator("#clearLogRecipe").isVisible(), true);
  await selector.locator('[data-flow-log-selector="foods"]').click();
  await page.waitForFunction(() => document.activeElement?.id === "logFoodSearch");
  const extraFoodId = await page.evaluate(() => state.foods.find((item) => item.active && item.name === "Rind")?.id || "");
  assert.ok(extraFoodId, "Ein zusätzliches Lebensmittel für den Rezept-Regressionstest muss vorhanden sein");
  await page.locator("#logFoodSearch").fill("Rind");
  const foodNameStyle = await page.locator(`.addLogFoodResult[data-food="${extraFoodId}"] .log-result-name`).evaluate((node) => ({ whiteSpace: getComputedStyle(node).whiteSpace, textOverflow: getComputedStyle(node).textOverflow }));
  assert.equal(foodNameStyle.whiteSpace, "normal", "Lebensmittelnamen dürfen nicht einzeilig abgeschnitten werden");
  assert.equal(foodNameStyle.textOverflow, "clip", "Lebensmittelnamen dürfen nicht mit Ellipsis abgeschnitten werden");
  await page.locator(`.addLogFoodResult[data-food="${extraFoodId}"]`).click();
  await page.waitForFunction((id) => !!document.querySelector(`.addLogFoodResult.selected[data-food="${id}"]`), extraFoodId);

  await selector.locator('[data-flow-log-selector="recipes"]').click();
  await page.waitForFunction(() => document.activeElement?.id === "logRecipeSearch");
  await page.locator("#logRecipeSearch").fill("linsen");
  assert.equal(
    await page.locator(".selectLogRecipeResult").filter({ hasText: "Tomaten-Linsen-Sauce" }).count(),
    1,
    "Die Linsensuche muss Tomaten-Linsen-Sauce im Essen-eintragen-Dialog anzeigen",
  );
  assert.equal(await page.locator(".log-recipe-results .log-result-meta").count(), 0, "Rezeptkarten dürfen keinen Auswahl-Hinweis pro Karte anzeigen");
  await page.locator("#clearLogRecipe").click();
  await page.waitForFunction(() => document.activeElement?.id === "logRecipeSearch");
  assert.equal(await page.locator("#logRecipeSearch").inputValue(), "");
  assert.equal(await selector.isVisible(), true);

  const variantRecipe = await page.evaluate(() => RECIPES.find((recipe) => logRecipeNeedsExplicitChoice(recipe))?.name || "");
  assert.ok(variantRecipe, "Mindestens ein Rezept mit expliziter Variantenwahl wird für die Regression benötigt");
  await page.locator("#logRecipeSearch").fill(variantRecipe);
  await page.locator(".selectLogRecipeResult").filter({ hasText: variantRecipe }).first().click();
  const requiredChoices = page.locator("[data-log-recipe-required]");
  await requiredChoices.first().waitFor();
  assert.equal(await page.locator("[data-log-recipe-confirm]").count(), 0);
  assert.equal(await requiredChoices.first().inputValue(), "");
  assert.equal(await page.locator("#saveLog").isDisabled(), true);
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-log-recipe-required")), true);
  while (true) {
    const values = await page.locator("[data-log-recipe-required]").evaluateAll((nodes) => nodes.map((node) => node.value));
    const emptyIndex = values.findIndex((value) => !value);
    if (emptyIndex < 0) break;
    await page.locator("[data-log-recipe-required]").nth(emptyIndex).selectOption({ index: 1 });
    await page.waitForTimeout(0);
  }
  assert.equal(await page.locator("#saveLog").isDisabled(), false);

  assert.equal(await page.evaluate(() => {
    const consistency = document.getElementById("logTexture")?.closest(".field");
    const rating = [...document.querySelectorAll("#logForm .field")].filter((field) => field.querySelector("#mainOutcome, [data-individual-result], [data-sample-result]"));
    const amount = document.getElementById("logAmount")?.closest(".field");
    const stock = [...document.querySelectorAll("#logForm .field")].filter((field) => field.querySelector("#useRecipeInventory, [data-inventory-food]"));
    const save = document.querySelector("#logForm .sticky-form-actions");
    const nodes = [consistency, ...rating, amount, ...stock, save].filter(Boolean);
    return nodes.length >= 4 && nodes.every((node, index) => index === 0 || !!(nodes[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
  }), true);
  assert.equal(await page.locator("#logNote").count(), 0);
  assert.equal(await page.locator("#conditionalLogQuestions").count(), 0);
  const logText = await page.locator("#logForm").textContent();
  for (const removedText of ["Notiz ergänzen", "Notiz oder Reaktion", "Nur wenig Interesse", "Klar verweigert", "Keine Gelegenheit", "Zutat nicht verfügbar", "Diese Zutaten wurden tatsächlich verwendet"]) {
    assert.equal(logText.includes(removedText), false, `${removedText} darf nicht mehr in der Maske stehen`);
  }
  await page.evaluate(() => closeLog());

  await reset(page);
  const legacy = await page.evaluate(() => {
    const next = window.__beikostTest.getState();
    const item = next.foods.find((food) => food.active);
    const id = "legacy-hidden-fields";
    next.logs = [{
      id,
      date: window.__beikostTest.today(),
      meal: "",
      foodIds: [item.id],
      focusId: item.id,
      recipeName: "",
      outcome: "not_accepted",
      foodOutcomes: { [item.id]: "not_accepted" },
      entryType: "food",
      baseFoodIds: [item.id],
      sampleFoodIds: [],
      individualRatings: false,
      amount: "",
      textureKnown: false,
      note: "Historische Notiz behalten",
      rejectionStrength: "refused",
      notOfferedReason: "unavailable",
      legacyMarker: "keep-me",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
    window.__beikostTest.setState(next);
    editLogEntry(id);
    return { id };
  });
  await page.locator("#logModal.open").waitFor();
  assert.equal(await page.locator("#logNote").count(), 0);
  assert.equal(await page.locator("#conditionalLogQuestions").count(), 0);
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => !document.getElementById("logModal")?.classList.contains("open"));
  const savedLegacy = await page.evaluate((id) => window.__beikostTest.getState().logs.find((log) => log.id === id), legacy.id);
  assert.equal(savedLegacy.note, "Historische Notiz behalten");
  assert.equal(savedLegacy.rejectionStrength, "refused");
  assert.equal(savedLegacy.notOfferedReason, "unavailable");
  assert.equal(savedLegacy.legacyMarker, "keep-me");

  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    "Log-Flow darf auf iPhone-Breite keinen horizontalen Überlauf erzeugen",
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("WebKit mobile log entry regression passed.");
