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
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState &&
    typeof window.openLog === "function" &&
    typeof window.editLogEntry === "function",
  );
}

async function selectFood(page, name) {
  const search = page.locator("#logFoodSearch");
  await search.fill(name);
  const result = page.locator(".addLogFoodResult").filter({ hasText: name }).first();
  await result.waitFor();
  await result.click();
}

async function reset(page) {
  await page.evaluate(() => {
    const state = window.__beikostTest.reset();
    state.logs = [];
    state.followUps = {};
    state.shoppingHints = {};
    state.backupMeta.chesterContextSeeded = true;
    window.__beikostTest.setState(state);
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
  await waitForApp(page);

  // 1. Freier Eintrag: keine künstliche Mahlzeit, bewusste Textur, Rollenpersistenz.
  await reset(page);
  await page.evaluate(() => window.openLog(null));
  assert.equal(await page.locator("#logMeal").count(), 0, "Freier Eintrag darf keine Mahlzeitenauswahl anzeigen");
  assert.equal(await page.locator("#logTexture").inputValue(), "", "Neue Textur darf nicht vorausgewählt sein");
  await selectFood(page, "Karotte");
  await page.locator("#logTexture").selectOption("1");
  await page.locator("#logAmount").fill("5");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);

  let freeLog = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(freeLog.entryType, "food");
  assert.equal(freeLog.meal, "");
  assert.equal(freeLog.textureKnown, true);
  assert.equal(freeLog.textureStage, 1);
  assert.equal(freeLog.amount, "5");
  assert.deepEqual(freeLog.sampleFoodIds, ["karotte"]);
  assert.equal(freeLog.foodRoles.karotte, "sample");
  assert.equal(await page.evaluate(() => successfulMealSlotCount(today())), 0, "Freier Eintrag darf kein Phasen-Mahlzeitenslot sein");

  // Bearbeiten ersetzt denselben Log und behält Rollen; Reload behält echte Textur.
  const freeId = freeLog.id;
  await page.evaluate((id) => window.editLogEntry(id), freeId);
  await page.locator("#logTexture").selectOption("2");
  await page.locator("#logAmount").fill("8");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
  let edited = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(edited.id, freeId);
  assert.equal(edited.textureStage, 2);
  assert.equal(edited.amount, "8");
  assert.equal(edited.foodRoles.karotte, "sample");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  let reloaded = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(reloaded.id, freeId);
  assert.equal(reloaded.meal, "");
  assert.equal(reloaded.textureKnown, true);
  assert.equal(reloaded.textureStage, 2);
  assert.equal(reloaded.foodRoles.karotte, "sample");

  // 2. Rezept kann an einem vergangenen Datum frei protokolliert werden.
  await reset(page);
  await page.evaluate(() => window.openLog(null));
  assert.equal(await page.locator("#logRecipeSearch").count(), 1, "Freier Eintrag muss eine Rezeptauswahl anbieten");
  const retrospectiveDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await page.locator("#logDate").fill(retrospectiveDate);
  await page.locator("#logDate").dispatchEvent("change");
  await page.locator("#logRecipeSearch").fill("Birne-Hirse-Pancakes");
  const recipeResult = page.locator(".selectLogRecipeResult").filter({ hasText: "Birne-Hirse-Pancakes" }).first();
  await recipeResult.waitFor();
  const recipeResultLayout = await recipeResult.evaluate((element) => {
    const copy = element.querySelector(".log-result-copy");
    const add = element.querySelector(".log-result-add");
    const rect = element.getBoundingClientRect();
    const copyRect = copy?.getBoundingClientRect();
    const addRect = add?.getBoundingClientRect();
    return {
      width: rect.width,
      copyWidth: copyRect?.width || 0,
      addOffset: addRect ? addRect.left - rect.left : 0,
    };
  });
  assert.ok(recipeResultLayout.copyWidth >= recipeResultLayout.width * 0.7, "Rezeptname muss den Großteil der Trefferbreite nutzen");
  assert.ok(recipeResultLayout.addOffset >= recipeResultLayout.width * 0.75, "Plus-Aktion muss am rechten Rand des Rezepttreffers liegen");
  await recipeResult.click();
  assert.match(await page.locator("#logForm").innerText(), /Birne-Hirse-Pancakes/);
  await page.locator("#logTexture").selectOption("2");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
  const retrospectiveRecipe = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(retrospectiveRecipe.date, retrospectiveDate);
  assert.equal(retrospectiveRecipe.recipeName, "Birne-Hirse-Pancakes");
  assert.equal(retrospectiveRecipe.entryType, "food");
  assert.equal(retrospectiveRecipe.meal, "", "Nachträgliches Rezept darf keinen Mahlzeitenslot erfinden");
  assert.deepEqual([...retrospectiveRecipe.foodIds].sort(), ["birne", "ei", "hirse"]);
  assert.equal(retrospectiveRecipe.textureStage, 2);
  assert.equal(await page.evaluate(() => successfulMealSlotCount(today())), 0);

  // 3. Rezeptfamilien speichern nur die ausdrücklich bestätigten tatsächlichen Zutaten.
  await reset(page);
  await page.evaluate(() => window.openLog(null));
  await page.locator("#logRecipeSearch").fill("Obst-Hafer-Pancakes");
  const familyRecipeResult = page.locator(".selectLogRecipeResult").filter({ hasText: "Obst-Hafer-Pancakes" }).first();
  await familyRecipeResult.waitFor();
  await familyRecipeResult.click();
  assert.equal(await page.locator("[data-log-recipe-oneof]").count(), 1);
  assert.equal(await page.locator("[data-log-recipe-confirm]").count(), 1);
  await page.locator("[data-log-recipe-oneof]").selectOption("mango");
  await page.locator("#logTexture").selectOption("2");
  await page.locator("#saveLog").click();
  assert.equal(await page.evaluate(() => window.__beikostTest.getState().logs.length), 0, "Mehrdeutige Rezeptzutaten dürfen nicht unbestätigt gespeichert werden");
  assert.equal(await page.locator(".log-recipe-choice-error").isVisible(), true);
  await page.getByText("Diese Zutaten wurden tatsächlich verwendet", { exact: true }).click();
  assert.equal(await page.locator("[data-log-recipe-confirm]").isChecked(), true);
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
  const familyRecipe = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(familyRecipe.recipeName, "Obst-Hafer-Pancakes");
  assert.equal(familyRecipe.meal, "");
  assert.deepEqual([...familyRecipe.foodIds].sort(), ["ei", "hafer", "mango"]);
  assert.equal(familyRecipe.foodIds.includes("banane"), false);
  assert.equal(familyRecipe.foodIds.includes("apfel"), false);

  // 4. Legacy-Kostprobe: unbekannte historische Textur bleibt beim Bearbeiten unbekannt.
  await reset(page);
  await page.evaluate(() => {
    const state = window.__beikostTest.getState();
    state.logs = [{
      id: "legacy-sample",
      date: window.__beikostTest.today(),
      meal: "lunch",
      entryType: "sample",
      foodIds: ["karotte"],
      focusId: "karotte",
      baseFoodIds: [],
      sampleFoodIds: ["karotte"],
      foodRoles: { karotte: "sample" },
      foodOutcomes: { karotte: "tried" },
      outcome: "tried",
      textureStage: 4,
    }];
    window.__beikostTest.setState(state);
  });
  let migratedLegacy = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(migratedLegacy.textureKnown, false);
  assert.equal(Object.hasOwn(migratedLegacy, "textureStage"), false);
  await page.evaluate(() => window.editLogEntry("legacy-sample"));
  assert.equal(await page.locator("#logTexture").inputValue(), "");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => document.getElementById("logModal") && !document.getElementById("logModal").classList.contains("open"));
  let savedLegacy = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(savedLegacy.entryType, "sample");
  assert.equal(savedLegacy.meal, "lunch");
  assert.equal(savedLegacy.textureKnown, false);
  assert.equal(Object.hasOwn(savedLegacy, "textureStage"), false);

  // 5. Nicht angeboten: keine Konsistenzpflicht.
  await reset(page);
  await page.evaluate(() => window.openLog(null));
  await selectFood(page, "Karotte");
  await page.locator('[data-sample-result="karotte"]').selectOption("not_offered");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
  let notOffered = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(notOffered.foodOutcomes.karotte, "not_offered");
  assert.equal(notOffered.textureKnown, false);
  assert.equal(Object.hasOwn(notOffered, "textureStage"), false);

  // Wird ein solcher Eintrag später tatsächlich zu „Probiert“, ist eine Konsistenz neu erforderlich.
  await page.evaluate((id) => window.editLogEntry(id), notOffered.id);
  await page.locator('[data-sample-result="karotte"]').selectOption("tried");
  await page.locator("#saveLog").click();
  assert.equal(await page.locator("#logModal").evaluate((node) => node.classList.contains("open")), true);
  assert.equal(await page.locator(".unified-texture-error").count(), 1);
  let stillNotOffered = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(stillNotOffered.foodOutcomes.karotte, "not_offered");
  await page.locator("#logTexture").selectOption("2");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => document.getElementById("logModal") && !document.getElementById("logModal").classList.contains("open"));
  let changedToTried = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(changedToTried.foodOutcomes.karotte, "tried");
  assert.equal(changedToTried.textureKnown, true);
  assert.equal(changedToTried.textureStage, 2);

  // 6. Ablehnung und Reaktion: Konsistenz ist optional und zählt nicht als positive Texturerfahrung.
  for (const outcome of ["not_accepted", "reaction"]) {
    await reset(page);
    await page.evaluate(() => window.openLog(null));
    await selectFood(page, "Karotte");
    await page.locator('[data-sample-result="karotte"]').selectOption(outcome);
    await page.locator("#saveLog").click();
    await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
    const saved = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
    assert.equal(saved.foodOutcomes.karotte, outcome);
    assert.equal(saved.textureKnown, false);
    assert.equal(Object.hasOwn(saved, "textureStage"), false);
  }

  // 7. Geplanter Eintrag: kompakter Kontext, unveränderlicher Slot und Einzelbewertungen mit einer Aktion.
  await reset(page);
  const plannedDate = await page.evaluate(() => window.__beikostTest.today());
  const movedDate = new Date(`${plannedDate}T12:00:00`);
  movedDate.setDate(movedDate.getDate() + 1);
  const movedDateIso = movedDate.toISOString().slice(0, 10);
  await page.evaluate(() => window.openLog({
    date: window.__beikostTest.today(),
    meal: "lunch",
    focusId: "karotte",
    foodIds: ["karotte", "brokkoli"],
    baseFoodIds: ["karotte", "brokkoli"],
    sampleFoodIds: [],
    foodRoles: { karotte: "base", brokkoli: "base" },
    foodOutcomes: { karotte: "eaten", brokkoli: "eaten" },
    entryType: "meal",
  }));
  assert.equal(await page.locator("#logRecipeSearch").count(), 0, "Geplanter Slot darf keine freie Rezeptauswahl anzeigen");
  assert.equal(await page.locator("#logMeal").count(), 0, "Geplanter Slot bleibt übernommen und darf nicht neu gewählt werden");
  assert.equal(await page.locator("#logDate").isVisible(), false, "Datum bleibt im Plan-Kontext standardmäßig kompakt");
  assert.match(await page.locator("#logForm").innerText(), /Mittag[\s\S]*aus dem Plan/);
  assert.doesNotMatch(await page.locator("#logForm").innerText(), /Geplante Mahlzeit/);
  assert.equal(await page.locator("#individualRatings").count(), 0, "Einzelbewertungen dürfen keinen zweiten Toggle benötigen");
  assert.equal(await page.locator("#addCustomLogFood").textContent(), "+ Eigenes Lebensmittel");
  assert.equal(await page.locator("#addCustomLogFood").evaluate((element) => element.classList.contains("btn")), false, "Eigenes Lebensmittel bleibt eine tertiäre Aktion");
  assert.doesNotMatch(await page.locator("#logForm").innerText(), /Lebensmittelrollen und getrennte Bewertungen bleiben/);

  await page.getByRole("button", { name: "Datum ändern", exact: true }).click();
  assert.equal(await page.locator("#logMeal").count(), 0, "Auch beim Ändern des Datums bleibt die Mahlzeit unveränderlich");
  assert.equal(await page.locator("#logDate").isVisible(), true);
  await page.locator("#logDate").fill(movedDateIso);
  await page.locator("#logDate").dispatchEvent("change");
  await page.locator("#moveDraftDay").click();
  await page.waitForFunction(() => document.getElementById("logModal")?.classList.contains("open"));
  assert.doesNotMatch(await page.locator("#logForm").innerText(), /aus dem Plan/, "Nach einer Datumskorrektur ist die ursprüngliche Plan-Herkunft nicht mehr relevant");
  assert.match(await page.locator("#logForm").innerText(), /Mittag/);

  await page.getByRole("button", { name: "Zutaten einzeln bewerten ›", exact: true }).click();
  assert.equal(await page.locator("[data-individual-result]").count(), 2);
  await page.locator('[data-individual-result="karotte"]').selectOption("eaten");
  await page.locator('[data-individual-result="brokkoli"]').selectOption("not_accepted");
  await page.locator("#logTexture").selectOption("1");
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
  let planned = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(planned.date, movedDateIso);
  assert.equal(planned.meal, "lunch");
  assert.equal(planned.entryType, "food");
  assert.equal(planned.individualRatings, true);
  assert.equal(planned.foodOutcomes.karotte, "eaten");
  assert.equal(planned.foodOutcomes.brokkoli, "not_accepted");
  assert.equal(planned.foodRoles.karotte, "base");
  assert.equal(planned.foodRoles.brokkoli, "base");
  assert.equal(await page.evaluate((date) => successfulMealSlotCount(date), movedDateIso), 1);

  // Bearbeiten erhält den tatsächlichen Mahlzeitenslot und die getrennten Bewertungen.
  await page.evaluate((id) => window.editLogEntry(id), planned.id);
  assert.doesNotMatch(await page.locator("#logForm").innerText(), /aus dem Plan/);
  assert.equal(await page.locator("#logMeal").count(), 0);
  assert.equal(await page.locator("[data-individual-result]").count(), 2);
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => document.getElementById("logModal") && !document.getElementById("logModal").classList.contains("open"));
  planned = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(planned.meal, "lunch");
  assert.equal(planned.individualRatings, true);
  assert.equal(planned.foodOutcomes.brokkoli, "not_accepted");

  // 8. Familienstatus: zwei freie Gaben am selben Tag bleiben zwei Expositionen.
  await reset(page);
  await page.evaluate(() => {
    const state = window.__beikostTest.getState();
    const date = window.__beikostTest.today();
    state.logs = [
      { id: "free-1", date, meal: "", entryType: "food", foodIds: ["sesam"], focusId: "sesam", baseFoodIds: ["sesam"], sampleFoodIds: [], foodRoles: { sesam: "base" }, foodOutcomes: { sesam: "eaten" }, outcome: "eaten", textureKnown: true, textureStage: 1 },
      { id: "free-2", date, meal: "", entryType: "food", foodIds: ["sesam"], focusId: "sesam", baseFoodIds: ["sesam"], sampleFoodIds: [], foodRoles: { sesam: "base" }, foodOutcomes: { sesam: "eaten" }, outcome: "eaten", textureKnown: true, textureStage: 1 },
    ];
    window.__beikostTest.setState(state);
  });
  assert.equal(
    await page.evaluate(() => window.__beikostTest.familySuccessfulExposureCount("sesam")),
    2,
    "Freie Gaben dürfen im Familienstatus nicht über date|meal zusammenfallen",
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("WebKit unified food log integration regression passed.");