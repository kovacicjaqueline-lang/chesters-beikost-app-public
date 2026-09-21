import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";



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
  await page.waitForFunction(() => !!window.__beikostTest?.openManualMealSelector);
  await page.waitForFunction(() => window.__manualMealFlowRuntimeInstalled === true);
  await page.waitForFunction(() => window.__flowDialogUiInstalled === true);

  await page.evaluate(() => {
    window.__beikostTest.reset();
    const next = window.__beikostTest.getState();
    const statuses = new Map([
      ["hafer", "Regelmäßig"],
      ["hirse", "Probiert"],
      ["reis", "Offen"],
    ]);
    next.foods.forEach((item) => {
      if (statuses.has(item.id)) item.manualStatus = statuses.get(item.id);
    });
    window.__beikostTest.setState(next);
    window.__beikostTest.openManualMealSelector(window.__beikostTest.today(), "lunch");
  });

  const recipeVisuals = page.locator('.selector-row.selectRecipe .meal-selector-visual');
  assert.ok(await recipeVisuals.count() > 0, "Rezepttreffer müssen eine eigene Bildspalte haben");
  assert.equal(await recipeVisuals.first().isVisible(), true, "Rezeptbild muss in der Auswahl sichtbar sein");
  assert.match(
    await recipeVisuals.first().locator("img").getAttribute("src"),
    /illustrations-v2\/recipes\//,
    "Rezepttreffer müssen das bestehende Rezeptbild verwenden",
  );
  await page.locator("#selectorFoods").click();

  const foodVisuals = page.locator('.selector-row.selectFood .meal-selector-visual');
  assert.ok(await foodVisuals.count() > 0, "Lebensmitteltreffer müssen eine eigene Bildspalte haben");
  assert.equal(await foodVisuals.first().isVisible(), true, "Lebensmittelbild muss in der Auswahl sichtbar sein");
  assert.match(
    await foodVisuals.first().locator("img").getAttribute("src"),
    /illustrations-v2\/foods\//,
    "Lebensmitteltreffer müssen das bestehende Lebensmittelbild verwenden",
  );

  const firstFoodRow = page.locator(".selector-row.selectFood").first();
  const rowLayout = await firstFoodRow.evaluate((row) => {
    const rect = (selector) => {
      const box = row.querySelector(selector)?.getBoundingClientRect();
      return box ? { left: box.left, right: box.right, width: box.width } : null;
    };
    const rowBox = row.getBoundingClientRect();
    const rowStyle = getComputedStyle(row);
    const contentRight = rowBox.right - Number.parseFloat(rowStyle.paddingRight) - Number.parseFloat(rowStyle.borderRightWidth);
    return {
      row: { left: rowBox.left, right: contentRight, width: rowBox.width },
      visual: rect(".meal-selector-visual"),
      copy: rect(".grow"),
      role: rect(".manual-role-type"),
      check: rect(".selector-check"),
    };
  });
  assert.ok(rowLayout.visual?.width >= 40, "Die Lebensmittelkarte muss eine stabile Bildspalte besitzen");
  assert.ok(rowLayout.copy?.width >= 80, "Die Lebensmittelkarte muss dem Namen eine nutzbare Textbreite geben");
  assert.ok(rowLayout.check && rowLayout.row && rowLayout.check.right >= rowLayout.row.right - 2, "Das Häkchen muss am rechten Kartenrand stehen");
  assert.ok(rowLayout.copy && rowLayout.check && rowLayout.copy.right < rowLayout.check.left, "Text und Häkchen dürfen nicht in derselben schmalen Spalte kollabieren");

  const search = page.locator("#mealSelectorSearch");
  await search.click();
  const originalInput = await search.elementHandle();
  assert.ok(originalInput, "Suchfeld muss vor der Eingabe existieren");

  await page.keyboard.type("Re", { delay: 25 });
  assert.equal(
    await page.locator('.selector-results .selectFood:not([hidden])').first().locator("b").textContent(),
    "Reis",
    "Bei kurzer Präfixsuche muss Reis der erste sichtbare Treffer sein",
  );

  await page.keyboard.type("i", { delay: 25 });
  assert.equal(await search.inputValue(), "Rei", "Die Suche muss das dritte Zeichen übernehmen");
  assert.equal(
    await page.locator('.selector-results .selectFood:not([hidden])').first().locator("b").textContent(),
    "Reis",
    "Zusätzliche Metadaten-Treffer dürfen einen direkten Namenspräfix nicht überholen",
  );
  assert.equal(
    await page.locator('.selectFood[data-food="hafer"]').isVisible(),
    true,
    "Metadaten-Treffer dürfen bei längerer Suche weiterhin sichtbar bleiben",
  );

  await search.evaluate((element) => element.setSelectionRange(0, element.value.length));
  await page.keyboard.type("Karo", { delay: 25 });

  assert.equal(await search.inputValue(), "Karo", "Zeichenweise Eingabe muss vollständig erhalten bleiben");
  assert.equal(
    await originalInput.evaluate((element) => element.isConnected),
    true,
    "Das fokussierte Suchfeld darf beim Tippen nicht aus dem DOM ersetzt werden",
  );
  assert.equal(
    await search.evaluate((element) => document.activeElement === element),
    true,
    "Das Suchfeld muss nach zeichenweiser Eingabe fokussiert bleiben",
  );

  const carrot = page.locator('.selectFood[data-food="karotte"]');
  const potato = page.locator('.selectFood[data-food="kartoffel"]');
  assert.equal(await carrot.isVisible(), true, "Karotte muss als Suchtreffer sichtbar bleiben");
  assert.equal(await potato.isVisible(), false, "Nicht passende Lebensmittel müssen während der Suche ausgeblendet werden");

  await carrot.click();
  await page.waitForFunction(() => document.getElementById("mealSelectorSearch")?.value === "Karo");
  const carrotClasses = (await page.locator('.selectFood[data-food="karotte"]').getAttribute("class")) || "";
  assert.equal(
    carrotClasses.split(/\s+/).includes("selected"),
    true,
    "Ein sichtbarer Suchtreffer muss weiterhin auswählbar sein",
  );

  const currentSearch = page.locator("#mealSelectorSearch");
  await currentSearch.click();
  await currentSearch.evaluate((element) => element.setSelectionRange(0, element.value.length));
  await page.keyboard.type("kein-treffer", { delay: 10 });
  assert.equal(
    await page.locator(".flow-meal-selector-empty").textContent(),
    "Kein Lebensmittel gefunden.",
    "Eine leere Suche muss den passenden Hinweis zeigen",
  );
  assert.deepEqual(pageErrors, [], "Der Suchfluss darf keine JavaScript-Fehler auslösen");

  await context.close();
  console.log("ui-meal-editor-search-webkit: ok");
} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
