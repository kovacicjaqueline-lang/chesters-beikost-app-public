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
  assert.ok(box.y >= -1, `${label} muss oben im sichtbaren Bereich liegen`);
  assert.ok(box.y + box.height <= height + 1, `${label} muss vollständig sichtbar sein`);
}

const width = 390;
const height = 500;
const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();

try {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.openManualMealSelector);
  await page.waitForFunction(() => window.__manualMealFlowRuntimeInstalled === true);
  await page.evaluate(() => {
    window.__beikostTest.reset();
    window.__beikostTest.openManualMealSelector(window.__beikostTest.today(), "lunch");
  });

  await page.locator("#selectorFoods").click();
  await page.waitForFunction(() => document.querySelectorAll(".selectFood").length >= 8);

  const sheet = page.locator("#genericModal .sheet");
  const actions = page.locator("#genericModal .sticky-form-actions");
  const cancel = page.locator("#cancelManualMeal");
  const confirm = page.locator("#confirmManualMeal");
  const results = page.locator(".selectFood");

  const scrollMetrics = await sheet.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  assert.ok(
    scrollMetrics.scrollHeight > scrollMetrics.clientHeight + 100,
    "Testaufbau muss eine tatsächlich lange, scrollbar überlaufende Auswahlliste erzeugen",
  );

  // Kernaussage des Bugs: Die Aktionen müssen sichtbar sein, ohne sie zuvor selbst
  // mit scrollIntoView() ans Ende der langen Liste zu holen.
  assertInsideViewport(await actions.boundingBox(), width, height, "Aktionsleiste vor manuellem Scrollen");
  assertInsideViewport(await cancel.boundingBox(), width, height, "Abbrechen vor manuellem Scrollen");
  assertInsideViewport(await confirm.boundingBox(), width, height, "Speichern vor manuellem Scrollen");

  await sheet.evaluate((element) => {
    element.scrollTop = Math.floor((element.scrollHeight - element.clientHeight) / 2);
  });
  await page.waitForFunction(() => {
    const element = document.querySelector("#genericModal .sheet");
    return !!element && element.scrollTop > 50;
  });

  assertInsideViewport(await actions.boundingBox(), width, height, "Aktionsleiste in der Listenmitte");
  assertInsideViewport(await cancel.boundingBox(), width, height, "Abbrechen in der Listenmitte");
  assertInsideViewport(await confirm.boundingBox(), width, height, "Speichern in der Listenmitte");

  await sheet.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.waitForFunction(() => {
    const element = document.querySelector("#genericModal .sheet");
    return !!element && element.scrollTop >= element.scrollHeight - element.clientHeight - 2;
  });

  const actionBox = await actions.boundingBox();
  const lastResultBox = await results.last().boundingBox();
  assertInsideViewport(actionBox, width, height, "Aktionsleiste am Listenende");
  assertInsideViewport(await cancel.boundingBox(), width, height, "Abbrechen am Listenende");
  assertInsideViewport(await confirm.boundingBox(), width, height, "Speichern am Listenende");
  assert.ok(lastResultBox && actionBox, "Listenende und Aktionsleiste müssen messbar sein");
  assert.ok(
    lastResultBox.y + lastResultBox.height <= actionBox.y + 1,
    "Der letzte Listeneintrag darf am Scrollende nicht unter der sticky Aktionsleiste verdeckt sein",
  );

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
