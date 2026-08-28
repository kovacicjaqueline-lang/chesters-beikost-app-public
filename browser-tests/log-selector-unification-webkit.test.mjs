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
    const state = window.__beikostTest.reset();
    state.logs = [];
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
  await page.waitForFunction(() => !!window.__beikostTest?.getState && window.__flowDialogUiInstalled === true);

  // Freier Eintrag: dieselbe sichtbare Auswahlstruktur wie im Mahlzeiteneditor.
  await reset(page);
  await page.evaluate(() => window.openLog(null));
  const selector = page.locator("#logForm .flow-log-selector");
  await selector.waitFor();

  const tabs = selector.locator(".flow-log-selector-tabs [data-flow-log-selector]");
  assert.equal(await tabs.count(), 2, "Freier Eintrag muss Rezept-/Lebensmittel-Umschalter anbieten");
  assert.deepEqual(await tabs.allTextContents(), ["Rezepte", "Lebensmittel"]);
  assert.equal(await selector.locator('[data-flow-log-selector="recipes"]').getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#logRecipeSearch").isVisible(), true);
  assert.equal(await page.locator("#logFoodSearch").isVisible(), false);
  assert.equal(await page.locator("#logRecipeSearch").getAttribute("placeholder"), "Rezept suchen");
  assert.equal(await page.locator(".log-recipe-picker > label").textContent(), "Suchen");
  assert.equal(await page.locator(".log-recipe-results-label").isVisible(), false, "Doppelter leerer Rezept-Hinweis darf nicht sichtbar sein");

  await page.locator("#logRecipeSearch").fill("Birne-Hirse-Pancakes");
  const recipeResult = page.locator(".selectLogRecipeResult.selector-row.selectRecipe").filter({ hasText: "Birne-Hirse-Pancakes" }).first();
  await recipeResult.waitFor();
  assert.equal(await page.locator(".log-recipe-results-label").textContent(), "Suchergebnisse");

  await selector.locator('[data-flow-log-selector="foods"]').click();
  assert.equal(await selector.locator('[data-flow-log-selector="foods"]').getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#logRecipeSearch").isVisible(), false);
  assert.equal(await page.locator("#logFoodSearch").isVisible(), true);
  assert.equal(await page.locator("#logFoodSearch").getAttribute("placeholder"), "Lebensmittel suchen");
  assert.equal(await page.locator(".log-food-picker > label").textContent(), "Suchen");
  assert.equal(await page.locator("#addCustomLogFood").isVisible(), true, "Eigenes Lebensmittel gehört nur in den Lebensmittel-Tab");
  assert.equal(await page.locator(".log-food-results-label").textContent(), "Vorschläge aus Plan und Verlauf");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "logFoodSearch");

  await page.locator("#logFoodSearch").fill("Karotte");
  const foodResult = page.locator(".addLogFoodResult.selector-row.selectFood").filter({ hasText: "Karotte" }).first();
  await foodResult.waitFor();
  await foodResult.click();
  await page.waitForFunction(() => document.querySelector("#logForm .flow-log-selector"));
  assert.equal(await page.locator('[data-flow-log-selector="foods"]').getAttribute("aria-pressed"), "true", "Tabwahl muss nach Log-Neurendering erhalten bleiben");
  assert.equal(await page.locator("#logFoodSearch").isVisible(), true);
  const selectedFoodResult = page.locator('.addLogFoodResult.selector-row.selectFood.selected[data-food="karotte"]');
  await selectedFoodResult.waitFor();
  assert.equal(await selectedFoodResult.locator(".log-result-add").textContent(), "✓");
  assert.match(await selectedFoodResult.getAttribute("aria-label"), /entfernen/);
  assert.equal(
    await page.evaluate(() => {
      const selectorNode = document.querySelector("#logForm .flow-log-selector");
      const evaluation = [...document.querySelectorAll("#logForm .field")].find((node) =>
        /Lebensmittel bewerten|Einführung und Wiederholung/.test(node.querySelector(":scope > label")?.textContent || ""),
      );
      return !!selectorNode && !!evaluation && !!(selectorNode.compareDocumentPosition(evaluation) & Node.DOCUMENT_POSITION_FOLLOWING);
    }),
    true,
    "Auswahl muss vor den protokollspezifischen Bewertungsfeldern stehen",
  );

  // Ausgewählte FOODs bleiben wie im Mahlzeiteneditor sichtbar und lassen sich wieder abwählen.
  await selectedFoodResult.click();
  await page.waitForFunction(() => !document.querySelector('.addLogFoodResult.selected[data-food="karotte"]'));
  await page.locator('[data-flow-log-selector="recipes"]').click();
  assert.equal(await page.locator("#logRecipeSearch").isVisible(), true);

  // Validierung aus dem Rezept-Tab muss zu FOOD führen, darf den Rezept-Tab danach aber nicht sperren.
  await page.locator("#saveLog").click();
  await page.locator(".log-food-picker.field-error").waitFor();
  await page.waitForFunction(() => document.querySelector('[data-flow-log-selector="foods"]')?.getAttribute("aria-pressed") === "true");
  assert.equal(await page.locator("#logFoodSearch").isVisible(), true);
  assert.equal(await page.locator("#logFoodError").isVisible(), true);
  assert.match(await page.locator("#logFoodError").textContent(), /mindestens ein tatsächlich enthaltenes Lebensmittel/);

  await page.locator('[data-flow-log-selector="recipes"]').click();
  await page.waitForFunction(() => document.querySelector('[data-flow-log-selector="recipes"]')?.getAttribute("aria-pressed") === "true");
  assert.equal(await page.locator("#logRecipeSearch").isVisible(), true, "Nach FOOD-Validierung muss Rezeptwahl wieder erreichbar sein");
  assert.equal(await page.locator("#logFoodError").isVisible(), false, "Der erledigte FOOD-Fehler darf den Rezept-Tab nicht blockieren");
  assert.equal(await page.locator(".log-food-picker.field-error").count(), 0);
  await page.evaluate(() => window.closeLog());

  // Geplanter Kontext bleibt fachlich enger: keine freie Rezeptumschaltung ergänzen.
  await reset(page);
  await page.evaluate(() => window.openLog({
    date: window.__beikostTest.today(),
    meal: "lunch",
    focusId: "karotte",
    foodIds: ["karotte"],
    baseFoodIds: [],
    sampleFoodIds: ["karotte"],
    recipeName: "",
    entryType: "meal",
  }));
  await page.locator("#logForm .flow-log-selector").waitFor();
  assert.equal(await page.locator("#logForm .flow-log-selector-tabs").count(), 0, "Geplanter Log darf keine freie Rezeptwahl erfinden");
  assert.equal(await page.locator("#logFoodSearch").isVisible(), true);
  assert.equal(await page.locator("#logRecipeSearch").count(), 0);
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    "Gemeinsamer Log-Selector darf auf iPhone-Breite keinen horizontalen Überlauf erzeugen",
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("WebKit log selector unification regression passed.");
