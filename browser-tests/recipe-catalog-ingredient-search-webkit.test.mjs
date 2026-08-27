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
  await page.waitForFunction(() => !!window.__beikostTest?.reset);
  await page.waitForFunction(() => window.__plannerPoliciesReady === true);
  await page.evaluate(() => window.__beikostTest.reset());

  await page.locator('nav button[data-view="foods"]').click();
  await page.locator('#catalogSwitch [data-catalog-mode="recipes"]').click();
  await page.locator('[data-recipe-filter="all"]').click();

  const recipeNames = () => page.locator("#recipeList .recipe-card-v2 summary b").allTextContents();
  const beforeSearch = await recipeNames();
  assert.ok(beforeSearch.includes("Obst-Hafer-Pancakes"), "Ei-Rezept muss vor der Suche im Alle-Filter vorhanden sein");
  assert.ok(beforeSearch.includes("Milch-Getreide-Brei"), "Kontrollrezept muss vor der Suche im Alle-Filter vorhanden sein");

  await page.locator("#recipeSearch").fill("Ei");
  const afterSearch = await recipeNames();

  assert.ok(
    afterSearch.includes("Obst-Hafer-Pancakes"),
    "Die Suche nach Ei muss Rezepte finden, die Ei als strukturierte Zutat enthalten",
  );
  assert.equal(
    afterSearch.includes("Milch-Getreide-Brei"),
    false,
    "Die Suche nach Ei darf nicht nur wegen der Buchstabenfolge in „Brei“ treffen",
  );
  assert.deepEqual(pageErrors, [], "Die Rezeptsuche darf keine JavaScript-Fehler auslösen");

  await context.close();
  console.log("recipe-catalog-ingredient-search-webkit: ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
