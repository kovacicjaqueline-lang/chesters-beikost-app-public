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
    !!window.__beikostTest?.getState && typeof window.openLog === "function",
  );
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
  await page.evaluate(() => {
    const state = window.__beikostTest.reset();
    state.logs = [];
    state.backupMeta.chesterContextSeeded = true;
    window.__beikostTest.setState(state);
    window.openLog(null);
  });

  const originalDate = await page.locator("#logDate").inputValue();
  const previousDate = await page.evaluate((date) => {
    const value = new Date(`${date}T12:00:00`);
    value.setDate(value.getDate() - 1);
    return value.toISOString().slice(0, 10);
  }, originalDate);

  await page.locator("#logAmount").fill("30");
  await page.locator("#logAmount").evaluate((element) => { element.dataset.contextRenderSentinel = "stable"; });
  await page.locator("#logDate").fill(previousDate);
  await page.locator("#logDate").dispatchEvent("change");

  assert.equal(
    await page.locator("#logModal").evaluate((node) => node.classList.contains("open")),
    true,
    "Datumswechsel darf die Eingabemaske nicht für eine Nachfrage schließen",
  );
  assert.equal(await page.locator("#logDate").inputValue(), previousDate, "Neues Datum muss sofort übernommen werden");
  assert.equal(await page.locator("#logAmount").inputValue(), "30", "Begonnener Entwurf muss beim Datumswechsel erhalten bleiben");
  assert.equal(await page.locator("#logAmount").getAttribute("data-context-render-sentinel"), "stable", "Datumswechsel darf das Formular nicht vollständig neu rendern");
  assert.equal(
    await page.getByText("Entwurf verschieben?", { exact: true }).count(),
    0,
    "Datumswechsel darf keine Bestätigungsnachfrage mehr öffnen",
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
