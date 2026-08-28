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
    typeof window.openLog === "function",
  );
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

async function selectFood(page, name) {
  const search = page.locator("#logFoodSearch");
  if (!(await search.isVisible())) {
    const foodTab = page.locator('[data-flow-log-selector="foods"]');
    if (await foodTab.count()) await foodTab.click();
  }
  await search.fill(name);
  const result = page.locator(".addLogFoodResult").filter({ hasText: name }).first();
  await result.waitFor();
  await result.click();
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

  // Bei einem direkten Save-Tap soll die Validierung den nativen Picker noch innerhalb
  // derselben User-Aktivierung anfordern, statt das <select> nur programmgesteuert zu fokussieren.
  await reset(page);
  await page.evaluate(() => window.openLog(null));
  await selectFood(page, "Karotte");
  assert.equal(await page.locator("#logTexture").inputValue(), "");
  await page.locator("#logTexture").evaluate((select) => {
    Object.defineProperty(select, "showPicker", {
      configurable: true,
      value() {
        select.dataset.pickerRequested = String((Number(select.dataset.pickerRequested) || 0) + 1);
      },
    });
  });

  await page.locator("#saveLog").click();
  assert.equal(await page.locator(".unified-texture-error").count(), 1);
  assert.equal(
    await page.locator("#logTexture").getAttribute("data-picker-requested"),
    "1",
    "Speichern muss den Konsistenz-Picker direkt anfordern",
  );

  await page.locator("#logTexture").selectOption("2");
  assert.equal(
    await page.locator(".unified-texture-error").count(),
    0,
    "Die Fehlermeldung muss nach einer echten Auswahl sofort verschwinden",
  );
  await page.locator("#saveLog").click();
  await page.waitForFunction(() => window.__beikostTest.getState().logs.length === 1);
  const saved = await page.evaluate(() => window.__beikostTest.getState().logs[0]);
  assert.equal(saved.textureKnown, true);
  assert.equal(saved.textureStage, 2);

  // Falls WebKit showPicker nicht unterstützt oder blockiert, darf ein Touch-Gerät nicht
  // in einem programmgesteuerten Select-Fokus hängen bleiben. Der nächste echte Tap bleibt
  // dadurch eine normale native Picker-Interaktion.
  await reset(page);
  await page.evaluate(() => window.openLog(null));
  await selectFood(page, "Karotte");
  await page.locator("#logTexture").evaluate((select) => {
    Object.defineProperty(select, "showPicker", {
      configurable: true,
      value() {
        throw new DOMException("Picker blocked", "NotAllowedError");
      },
    });
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => query === "(pointer: coarse)"
      ? { matches: true }
      : originalMatchMedia(query);
  });

  await page.locator("#saveLog").click();
  assert.equal(await page.locator(".unified-texture-error").count(), 1);
  assert.notEqual(
    await page.evaluate(() => document.activeElement?.id || ""),
    "logTexture",
    "Touch-Fallback darf das native Select nicht programmgesteuert fokussiert festhalten",
  );
  assert.equal(await page.locator("#logModal").evaluate((node) => node.classList.contains("open")), true);
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
