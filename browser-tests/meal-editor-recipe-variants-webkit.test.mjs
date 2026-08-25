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
  await page.waitForFunction(() => window.__manualMealFlowRuntimeInstalled === true);
  await page.waitForFunction(() => window.__mealEditorRecipeVariantsInstalled === true);

  const today = await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    for (const id of [
      "hafer", "hirse", "banane", "apfel", "birne", "kuhmilch", "naturjoghurt",
      "buttermilch", "haferdrink", "sojabohne", "mandel", "kokos", "kuerbis", "karotte",
    ]) {
      const item = state.foods.find((food) => food.id === id);
      if (item) item.manualStatus = "Verträgliche Basis";
    }
    window.__beikostTest.setState(state);
    return window.__beikostTest.today();
  });

  // Rezept-Tab verwendet Rezepttexte statt Lebensmitteltexte.
  await page.evaluate((date) => window.__beikostTest.openManualMealSelector(date, "breakfast"), today);
  assert.match(await page.locator("#genericBody").innerText(), /Noch kein Rezept ausgewählt\./);
  assert.match(await page.locator("#genericBody").innerText(), /Bitte ein Rezept auswählen\./);

  // Obst-Haferbrei: Hafer bleibt fix, Obst ist austauschbar.
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

  const fruitSlot = page.locator('[data-recipe-component-slot="oneOf"]');
  await fruitSlot.waitFor();
  assert.equal(await fruitSlot.locator('option[value="banane"]').count(), 1);
  assert.equal(await fruitSlot.locator('option[value="apfel"]').count(), 1);
  assert.equal(await fruitSlot.locator('option[value="birne"]').count(), 1);

  const oatItem = page.locator('.manual-role-item[data-recipe-component="fixed"]').filter({ has: page.locator('[data-food="hafer"]') });
  await oatItem.waitFor();
  const oatPreparation = oatItem.locator(".manual-preparation-field");
  if (await oatPreparation.count()) {
    assert.equal(await oatPreparation.isVisible(), false, "Hafer-Darreichung muss bei rezeptdefinierter Zubereitung verborgen sein");
  }

  // Suche filtert nur die Ergebnisliste: identischer Input, Fokus und Scroll bleiben bestehen.
  const search = page.locator("#mealSelectorSearch");
  await search.focus();
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.__mealEditorStableSearchNode = document.getElementById("mealSelectorSearch");
    const sheet = window.__mealEditorStableSearchNode.closest(".sheet");
    if (sheet) sheet.scrollTop = Math.min(120, Math.max(0, sheet.scrollHeight - sheet.clientHeight));
    window.__mealEditorStableScrollTop = sheet?.scrollTop || 0;
  });
  await search.type("Obst", { delay: 10 });
  const stable = await page.evaluate(() => {
    const input = document.getElementById("mealSelectorSearch");
    const sheet = input.closest(".sheet");
    return {
      sameNode: input === window.__mealEditorStableSearchNode,
      focused: document.activeElement === input,
      scrollTop: sheet?.scrollTop || 0,
      initialScrollTop: window.__mealEditorStableScrollTop,
      value: input.value,
    };
  });
  assert.equal(stable.sameNode, true, "Suchfeld darf beim Tippen nicht neu gemountet werden");
  assert.equal(stable.focused, true, "Suchfeld muss fokussiert bleiben");
  assert.equal(stable.scrollTop, stable.initialScrollTop, "Sheet-Scrollposition muss stabil bleiben");
  assert.equal(stable.value, "Obst");

  await fruitSlot.selectOption("apfel");
  await page.locator('[data-recipe-component-slot="oneOf"]').waitFor();
  assert.equal(await page.locator('[data-recipe-component-slot="oneOf"]').inputValue(), "apfel");
  await page.locator("#confirmManualMeal").click();
  await page.waitForFunction((date) => !!window.__beikostTest.getState().planLocks?.[`${date}|breakfast`], today);
  let saved = await page.evaluate(() => window.__beikostTest.getState());
  assert.ok(saved.planLocks[`${today}|breakfast`].foodIds.includes("hafer"));
  assert.ok(saved.planLocks[`${today}|breakfast`].foodIds.includes("apfel"));
  assert.equal(saved.planLocks[`${today}|breakfast`].foodIds.includes("banane"), false);

  await page.evaluate((date) => {
    const lock = window.__beikostTest.getState().planLocks[`${date}|breakfast`];
    window.__beikostTest.openManualMealSelector(date, "breakfast", lock);
  }, today);
  await page.locator('[data-recipe-component-slot="oneOf"]').waitFor();
  assert.equal(await page.locator('[data-recipe-component-slot="oneOf"]').inputValue(), "apfel", "gespeicherte Obstauswahl muss beim Wiederöffnen vorausgefüllt sein");

  // Milch-Getreide-Brei: alle vorgesehenen Milch-/Milchalternativen stammen aus vorhandenen FOOD-Identitäten.
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
  const grainSlot = page.locator('[data-recipe-component-slot="oneOf"]');
  const milkSlot = page.locator('[data-recipe-component-slot="milkChoices"]');
  await grainSlot.waitFor();
  await milkSlot.waitFor();
  assert.equal(await grainSlot.evaluate((select) => select.previousElementSibling?.textContent), "Getreide");
  assert.equal(await milkSlot.evaluate((select) => select.previousElementSibling?.textContent), "Milch / Milchalternative");
  for (const [value, label] of [
    ["haferdrink", "Haferdrink"],
    ["sojabohne", "Sojamilch"],
    ["mandel", "Mandelmilch"],
    ["kokos", "Kokosmilch"],
  ]) {
    const option = milkSlot.locator(`option[value="${value}"]`);
    assert.equal(await option.count(), 1, `${label} muss bei erfüllten Regeln auswählbar sein`);
    assert.equal(await option.textContent(), label);
  }

  await grainSlot.selectOption("hirse");
  await page.locator('[data-recipe-component-slot="oneOf"]').waitFor();
  await page.locator('[data-recipe-component-slot="milkChoices"]').selectOption("mandel");
  await page.locator("#confirmManualMeal").click();
  await page.waitForFunction((date) => {
    const ids = window.__beikostTest.getState().planLocks?.[`${date}|breakfast`]?.foodIds || [];
    return ids.includes("hirse") && ids.includes("mandel");
  }, today);
  saved = await page.evaluate(() => window.__beikostTest.getState());
  assert.ok(saved.planLocks[`${today}|breakfast`].foodIds.includes("hirse"));
  assert.ok(saved.planLocks[`${today}|breakfast`].foodIds.includes("mandel"));
  assert.equal(saved.planLocks[`${today}|breakfast`].recipeName, "Milch-Getreide-Brei");

  // Nicht-variable Rezepte funktionieren weiter und zeigen keine Slot-Auswahl.
  await page.evaluate((date) => {
    window.__beikostTest.openManualMealSelector(date, "breakfast", {
      meal: "breakfast",
      active: true,
      recipeName: "Kürbis-Hafer-Brei",
      foodIds: ["kuerbis", "hafer"],
      baseFoodIds: ["kuerbis", "hafer"],
      sampleFoodIds: [],
      foodRoles: { kuerbis: "base", hafer: "base" },
      type: "bekannt",
    });
  }, today);
  await page.locator('.selectRecipe.selected[data-recipe]').waitFor();
  assert.equal(await page.locator(".recipe-component-controls").count(), 0);
  await page.locator("#confirmManualMeal").click();
  await page.waitForFunction((date) => window.__beikostTest.getState().planLocks?.[`${date}|breakfast`]?.recipeName === "Kürbis-Hafer-Brei", today);

  // Lebensmittelmodus bleibt unabhängig vom Rezeptmodus speicher- und wiederöffnungsfähig.
  await page.evaluate((date) => window.__beikostTest.openManualMealSelector(date, "lunch"), today);
  await page.locator("#selectorFoods").click();
  assert.match(await page.locator("#genericBody").innerText(), /Noch keine Lebensmittel ausgewählt\./);
  const carrotRow = page.locator('.selectFood[data-food="karotte"]');
  await carrotRow.waitFor();
  await carrotRow.click();
  await page.locator("#confirmManualMeal").click();
  await page.waitForFunction((date) => {
    const lock = window.__beikostTest.getState().planLocks?.[`${date}|lunch`];
    return !!lock && !lock.recipeName && lock.foodIds?.includes("karotte");
  }, today);
  saved = await page.evaluate(() => window.__beikostTest.getState());
  assert.equal(saved.planLocks[`${today}|lunch`].recipeName || "", "");
  assert.ok(saved.planLocks[`${today}|lunch`].foodIds.includes("karotte"));

  await page.evaluate((date) => {
    const lock = window.__beikostTest.getState().planLocks[`${date}|lunch`];
    window.__beikostTest.openManualMealSelector(date, "lunch", lock);
  }, today);
  await page.locator("#selectorFoods").click();
  assert.equal(await page.locator('.selectFood.selected[data-food="karotte"]').count(), 1);

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
