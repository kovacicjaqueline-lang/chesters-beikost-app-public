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
    window.__beikostTest.openManualMealSelector(window.__beikostTest.today(), "lunch");
  });
  await page.locator("#selectorFoods").click();

  const search = page.locator("#mealSelectorSearch");
  await search.click();
  const originalInput = await search.elementHandle();
  assert.ok(originalInput, "Suchfeld muss vor der Eingabe existieren");

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
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
