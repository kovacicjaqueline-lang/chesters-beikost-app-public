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
    await page.waitForFunction(() => !!window.__beikostTest?.openManualMealSelector);
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

    // Näherung an den durch die iPhone-Tastatur verkleinerten Visual Viewport:
    // Ergebnis und Footer müssen über den nativen Sheet-Scroll erreichbar bleiben.
    await page.setViewportSize({ width, height: 500 });

    await carrot.scrollIntoViewIfNeeded();
    assertInsideViewport(await carrot.boundingBox(), width, 500, `Suchergebnis bei ${width}px`);

    const footer = page.locator("#confirmManualMeal");
    await footer.scrollIntoViewIfNeeded();
    assertInsideViewport(await footer.boundingBox(), width, 500, `Footer bei ${width}px`);

    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("WebKit meal editor regression passed for 320/375/390px.");
