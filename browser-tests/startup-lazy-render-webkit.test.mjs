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
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);
  await page.waitForFunction(() => {
    const persisted = window.__beikostTest?.getState?.()?.backupMeta?.storagePersisted;
    return persisted && persisted !== "unknown";
  });

  const startup = await page.evaluate(() => ({
    homeText: document.getElementById("todayCard")?.textContent?.trim() || "",
    foodsChildren: document.getElementById("foodList")?.childElementCount || 0,
    prepChildren: document.getElementById("prepNow")?.childElementCount || 0,
    logChildren: document.getElementById("logList")?.childElementCount || 0,
  }));

  assert.ok(startup.homeText.length > 0, "Die sichtbare Heute-Ansicht muss beim ersten Start sofort gerendert werden");
  assert.equal(startup.foodsChildren, 0, "Der unsichtbare Lebensmittel-Tab darf beim Start noch nicht vollständig gerendert werden");
  assert.equal(startup.prepChildren, 0, "Der unsichtbare Prep-Tab darf beim Start noch nicht vollständig gerendert werden");
  assert.equal(startup.logChildren, 0, "Der unsichtbare Mehr-/Protokoll-Tab darf beim Start noch nicht vollständig gerendert werden");

  await page.locator('nav button[data-view="foods"]').click();
  await page.waitForFunction(() => (document.getElementById("foodList")?.childElementCount || 0) > 0);
  assert.ok(await page.locator("#foods.view.active").count(), "Lebensmittel muss nach Navigation aktiv sein");
  assert.equal(await page.locator("#prepNow > *").count(), 0, "Lebensmittel-Navigation darf den versteckten Prep-Bereich nicht mitrendern");

  await page.locator('[data-catalog-mode="recipes"]').click();
  await page.waitForFunction(() => (document.getElementById("recipeList")?.childElementCount || 0) > 0);
  assert.ok(await page.locator("#recipesSection:not([hidden])").count(), "Der Rezeptkatalog muss nach dem Umschalten vollständig gerendert werden");
  assert.equal(await page.locator("#prepNow > *").count(), 0, "Rezept-Navigation darf den versteckten Prep-Bereich nicht mitrendern");

  await page.evaluate(() => {
    const list = document.getElementById("recipeList");
    if (list) list.innerHTML = '<div id="staleRecipeMarker">veraltet</div>';
    renderCurrentView();
  });
  await page.waitForFunction(() =>
    !document.getElementById("staleRecipeMarker") &&
    (document.getElementById("recipeList")?.childElementCount || 0) > 0,
  );
  assert.equal(
    await page.locator("#prepNow > *").count(),
    0,
    "Ein späterer Current-View-Render muss nur den sichtbaren Rezeptkatalog aktualisieren",
  );

  await page.locator('nav button[data-view="more"]').click();
  await page.waitForFunction(() => (document.getElementById("statisticsBody")?.childElementCount || 0) > 0);
  assert.ok(await page.locator("#more.view.active").count(), "Mehr muss nach Navigation aktiv und gerendert sein");
  assert.ok(await page.locator("#productAllergenCard").count(), "Mehr muss die Produktkennzeichnung beim ersten Lazy-Render mit aufbauen");

  assert.deepEqual(pageErrors, [], `Beim Start und Lazy-Render dürfen keine JavaScript-Fehler auftreten: ${pageErrors.join(" | ")}`);

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
