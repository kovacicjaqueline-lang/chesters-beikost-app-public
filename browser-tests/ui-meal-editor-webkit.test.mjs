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

function assertInsideViewport(box, width, height, label) {
  assert.ok(box, `${label} muss ein messbares Layout-Rechteck besitzen`);
  assert.ok(box.x >= -1, `${label} darf links nicht abgeschnitten sein`);
  assert.ok(box.x + box.width <= width + 1, `${label} darf rechts nicht abgeschnitten sein`);
  assert.ok(box.y + box.height >= 0, `${label} muss den sichtbaren Bereich erreichen`);
  assert.ok(box.y <= height + 1, `${label} muss den sichtbaren Bereich erreichen`);
}

async function waitForApp(page) {
  await page.waitForFunction(() => !!window.__beikostTest?.openManualMealSelector);
  await page.waitForFunction(() => window.__manualMealFlowRuntimeInstalled === true);
}

const widths = [320, 375, 390];
const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();

try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.evaluate(() => {
      window.__beikostTest.reset();
      window.__beikostTest.openManualMealSelector(window.__beikostTest.today(), "lunch");
    });

    await page.locator("#selectorFoods").click();
    const search = page.locator("#mealSelectorSearch");
    await search.focus();

    assertInsideViewport(await search.boundingBox(), width, 844, `Suchfeld bei ${width}px vor Eingabe`);
    assert.equal(
      await search.evaluate((element) => getComputedStyle(element).fontSize),
      "16px",
      `Suchfeld muss bei ${width}px den iOS-Zoom mit 16px Schrift vermeiden`,
    );

    await search.fill("Karo");
    const carrot = page.locator(".selectFood").filter({ hasText: "Karotte" });
    await carrot.waitFor();

    const renderedSearch = page.locator("#mealSelectorSearch");
    assert.equal(await renderedSearch.inputValue(), "Karo", `Suchtext muss bei ${width}px erhalten bleiben`);
    assertInsideViewport(await renderedSearch.boundingBox(), width, 844, `Suchfeld bei ${width}px nach Eingabe`);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      `Bei ${width}px darf kein horizontaler Seitenüberlauf entstehen`,
    );

    await page.setViewportSize({ width, height: 500 });

    await carrot.scrollIntoViewIfNeeded();
    assertInsideViewport(await carrot.boundingBox(), width, 500, `Suchergebnis bei ${width}px`);

    const footer = page.locator("#confirmManualMeal");
    await footer.scrollIntoViewIfNeeded();
    assertInsideViewport(await footer.boundingBox(), width, 500, `Footer bei ${width}px`);

    await context.close();
  }

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const dates = await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const banana = state.foods.find((food) => food.id === "banane");
    const peach = state.foods.find((food) => food.id === "pfirsich");
    banana.manualStatus = "Verträgliche Basis";
    peach.manualStatus = "auto";
    window.__beikostTest.setState(state);
    return {
      today: window.__beikostTest.today(),
      future: window.__beikostTest.addDays(window.__beikostTest.today(), 2),
      past: window.__beikostTest.addDays(window.__beikostTest.today(), -1),
    };
  });

  // P0 explizit: Neu aufgerufene manuelle Mahlzeit für heute muss auf heute landen.
  await page.evaluate((today) => {
    window.__beikostTest.openManualMealSelector(today, "lunch");
  }, dates.today);
  assert.equal(await page.locator("#manualMealTargetDate").inputValue(), dates.today, "heute muss beim Anlegen Zieltag bleiben");
  await page.locator("#selectorFoods").click();
  let search = page.locator("#mealSelectorSearch");
  await search.fill("Banane");
  await page.locator(".selectFood").filter({ hasText: "Banane" }).click();
  await page.locator("#confirmManualMeal").click();
  await page.locator(`.removeManualMeal[data-date="${dates.today}"][data-meal="lunch"]`).waitFor();
  let savedState = await page.evaluate(() => window.__beikostTest.getState());
  assert.ok(savedState.manualMeals[`${dates.today}|lunch`], "neu für heute angelegte Mahlzeit muss unter dem heutigen Schlüssel gespeichert sein");

  // Für die weiteren Rekey-Regressionen wieder einen definierten, freien Ausgangszustand herstellen.
  await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    state.foods.find((food) => food.id === "banane").manualStatus = "Verträgliche Basis";
    state.foods.find((food) => food.id === "pfirsich").manualStatus = "auto";
    window.__beikostTest.setState(state);
  });

  await page.evaluate((future) => {
    window.__beikostTest.openManualMealSelector(future, "breakfast");
  }, dates.future);
  assert.equal(await page.locator("#manualMealTargetDate").inputValue(), dates.future, "aufgerufener Zukunftstag muss Zieltag sein");

  await page.locator("#selectorFoods").click();
  search = page.locator("#mealSelectorSearch");
  await search.fill("Banane");
  await page.locator(".selectFood").filter({ hasText: "Banane" }).click();
  search = page.locator("#mealSelectorSearch");
  await search.fill("Pfirsich");
  await page.locator(".selectFood").filter({ hasText: "Pfirsich" }).click();

  assert.match(await page.locator(".manual-role-group.base").innerText(), /Banane/, "Banane muss Hauptbasis bleiben");
  assert.match(await page.locator(".manual-role-group.sample").innerText(), /Pfirsich/, "Pfirsich muss als Kostprobe geführt werden");

  const bananaPreparation = page.locator('[data-manual-preparation="banane"]');
  await bananaPreparation.waitFor();
  const preparationKey = await bananaPreparation.evaluate((select) =>
    Array.from(select.options).find((option) => option.value)?.value || "",
  );
  assert.ok(preparationKey, "Banane muss vorhandene Darreichungsoptionen anbieten");
  await bananaPreparation.selectOption(preparationKey);

  await page.locator("#confirmManualMeal").click();
  await page.locator(`.removeManualMeal[data-date="${dates.future}"][data-meal="breakfast"]`).waitFor();
  assert.equal(await page.locator("#genericModal").evaluate((element) => element.classList.contains("open")), false, "Editor muss nach Save geschlossen sein");
  assert.notEqual(await page.locator("main").evaluate((element) => getComputedStyle(element).visibility), "hidden", "Plan darf nach Save nicht leer/unsichtbar bleiben");

  let manualCard = page.locator(".manual-meal").filter({
    has: page.locator(`.removeManualMeal[data-date="${dates.future}"][data-meal="breakfast"]`),
  });
  assert.match(await manualCard.locator(".manual-meal-title").innerText(), /Banane.*Pfirsich.*Kostprobe/, "Kartentitel muss Hauptbasis und Kostprobe repräsentieren");
  assert.equal(await manualCard.locator("summary").evaluate((element) => getComputedStyle(element).listStyleType), "none", "nativer Details-Marker darf nicht einrücken");
  assert.equal(await manualCard.locator(".manual-meal-actions").evaluate((element) => getComputedStyle(element).gap), "12px", "Aktionsbuttons müssen den 12px-Gruppenabstand des Designsystems verwenden");

  savedState = await page.evaluate(() => window.__beikostTest.getState());
  assert.equal(savedState.manualMeals[`${dates.future}|breakfast`].foodPreparationKeys.banane, preparationKey);
  assert.equal(savedState.planLocks[`${dates.future}|breakfast`].mode, "manual", "manueller Eintrag bleibt fest eingeplant");

  await manualCard.locator(".replaceMeal").click();
  await page.locator("#manualMealTargetDate").waitFor();
  assert.equal(await page.locator('[data-manual-preparation="banane"]').inputValue(), preparationKey, "Darreichung muss beim erneuten Öffnen erhalten bleiben");
  await page.locator("#manualMealTargetDate").fill(dates.today);
  await page.locator("#manualMealTargetDate").dispatchEvent("change");
  await page.locator("#confirmManualMeal").click();
  await page.locator(`.removeManualMeal[data-date="${dates.today}"][data-meal="breakfast"]`).waitFor();

  savedState = await page.evaluate(() => window.__beikostTest.getState());
  assert.equal(savedState.manualMeals[`${dates.future}|breakfast`], undefined, "alter Zukunftsschlüssel muss entfernt werden");
  assert.equal(savedState.manualMeals[`${dates.today}|breakfast`].foodPreparationKeys.banane, preparationKey, "Darreichung muss beim Verschieben auf heute erhalten bleiben");

  manualCard = page.locator(".manual-meal").filter({
    has: page.locator(`.removeManualMeal[data-date="${dates.today}"][data-meal="breakfast"]`),
  });
  await manualCard.locator(".replaceMeal").click();
  await page.locator("#manualMealTargetDate").fill(dates.past);
  await page.locator("#manualMealTargetDate").dispatchEvent("change");
  await page.locator("#confirmManualMeal").click();
  await page.locator(`.removeManualMeal[data-date="${dates.past}"][data-meal="breakfast"]`).waitFor();

  savedState = await page.evaluate(() => window.__beikostTest.getState());
  assert.equal(savedState.settings.planFrom, dates.past, "vergangener Zieltag muss nach Save sichtbar gemacht werden");
  assert.equal(savedState.manualMeals[`${dates.today}|breakfast`], undefined, "heutiger Quellschlüssel muss nach Rückdatierung entfernt sein");

  manualCard = page.locator(".manual-meal").filter({
    has: page.locator(`.removeManualMeal[data-date="${dates.past}"][data-meal="breakfast"]`),
  });
  await manualCard.locator(".moveMeal").click();
  await page.locator(`.removeManualMeal[data-date="${dates.today}"][data-meal="breakfast"]`).waitFor();
  savedState = await page.evaluate(() => window.__beikostTest.getState());
  assert.equal(savedState.manualMeals[`${dates.today}|breakfast`].foodPreparationKeys.banane, preparationKey, "Auf morgen darf die explizite Darreichung nicht verlieren");
  assert.equal(savedState.planLocks[`${dates.today}|breakfast`].mode, "manual", "Auf morgen darf den manuellen Lock nicht verlieren");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("WebKit meal editor regression passed for 320/375/390px plus manual meal flow.");
