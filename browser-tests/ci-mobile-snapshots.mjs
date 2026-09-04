import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.resolve(process.env.CI_SCREENSHOT_DIR || path.join(root, "artifacts", "ci-mobile-screenshots"));
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

async function settleViewport(page) {
  await page.evaluate(async () => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function openView(page, viewId) {
  const button = page.locator(`nav button[data-view="${viewId}"]`);
  await button.click();
  await page.locator(`#${viewId}.view.active`).waitFor({ state: "visible" });
  await settleViewport(page);
}

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
const screenshots = [];

try {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);

  async function capture(fileName) {
    const target = path.join(outputDir, fileName);
    await page.screenshot({ path: target, fullPage: false });
    screenshots.push(fileName);
    console.log(`CI screenshot: ${fileName}`);
  }

  await openView(page, "home");
  await capture("01-heute.png");
  await page.locator("main").evaluate(async (node) => {
    node.scrollTop = node.scrollHeight;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await capture("01b-heute-unten.png");
  await settleViewport(page);

  await openView(page, "plan");
  await capture("02-plan.png");

  await openView(page, "prep");
  await capture("03-prep.png");

  await openView(page, "foods");
  await page.locator('button[data-catalog-mode="foods"]').click();
  await page.locator("#foodsCatalogSection").waitFor({ state: "visible" });
  await settleViewport(page);
  await capture("04-beikost-lebensmittel.png");

  await page.locator('button[data-catalog-mode="recipes"]').click();
  await page.locator("#recipesSection").waitFor({ state: "visible" });
  await settleViewport(page);
  await capture("05-beikost-rezepte.png");

  await openView(page, "more");
  await capture("06-mehr.png");

  await page.setViewportSize({ width: 430, height: 932 });
  await openView(page, "home");
  await capture("07-heute-430x932.png");

  fs.writeFileSync(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
      additionalViewports: [
        { width: 430, height: 932, deviceScaleFactor: 2, screenshots: ["07-heute-430x932.png"] },
      ],
      screenshots,
    }, null, 2)}\n`,
  );

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
