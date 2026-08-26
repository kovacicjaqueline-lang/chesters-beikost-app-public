import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = process.env.BROWSER_TEST_ARTIFACT_DIR || path.join(root, "artifacts", "browser-tests", "plan-checks-ux-webkit");
fs.mkdirSync(artifactDir, { recursive: true });

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

async function assertSheetFitsMobile(page) {
  const metrics = await page.locator("#genericModal .sheet").evaluate((sheet) => {
    const rect = sheet.getBoundingClientRect();
    return {
      scrollWidth: sheet.scrollWidth,
      clientWidth: sheet.clientWidth,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, "Bottom-Sheet darf horizontal nicht überlaufen");
  assert.ok(metrics.left >= -1 && metrics.right <= metrics.viewportWidth + 1, "Bottom-Sheet muss im mobilen Viewport bleiben");
  assert.ok(metrics.bottom <= metrics.viewportHeight + 1, "Bottom-Sheet muss inklusive Safe-Area im Viewport bleiben");
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
  await page.waitForFunction(() => !!window.__beikostTest?.reset && window.__planChecksUiInstalled === true);
  await page.evaluate(() => window.__beikostTest.reset());
  await page.waitForFunction(() => document.getElementById("home")?.classList.contains("active"));

  await page.locator(".phase-details-trigger").click();
  await page.locator('[data-readiness-signal="currentPatternAccepted"][data-readiness-value="yes"]').click();
  await page.locator('[data-readiness-signal="additionalMealCue"][data-readiness-value="no"]').click();
  await page.locator('[data-readiness-signal="routineCompatible"][data-readiness-value="unknown"]').click();

  const yes = page.locator('[data-readiness-signal="currentPatternAccepted"][data-readiness-value="yes"]');
  const no = page.locator('[data-readiness-signal="additionalMealCue"][data-readiness-value="no"]');
  const unknown = page.locator('[data-readiness-signal="routineCompatible"][data-readiness-value="unknown"]');
  await yes.waitFor({ state: "visible" });
  assert.equal(await yes.evaluate((button) => button.classList.contains("secondary")), false);
  assert.equal(await no.evaluate((button) => button.classList.contains("secondary")), false);
  assert.equal(await unknown.evaluate((button) => button.classList.contains("secondary")), false);

  const reasonBlocks = page.locator(".readiness-reasons");
  assert.ok(await reasonBlocks.count() >= 1, "Readiness-Gründe bleiben im strukturierten DOM vorhanden");
  for (let index = 0; index < await reasonBlocks.count(); index++) {
    assert.equal(await reasonBlocks.nth(index).isVisible(), false, "Erfüllt-/Fehlt-noch-Erklärungen sollen visuell entfallen");
  }

  assert.match(await page.locator("#genericBody").textContent(), /Nächste Phase noch nicht empfohlen/);
  assert.match(await page.locator("#genericBody").textContent(), /zusätzlich ein Frühstück\. Mittagessen bleibt bestehen/);
  assert.equal(await page.locator("#toast").isVisible(), false, "Abnahmescreenshot darf keinen alten Toast enthalten");
  await assertSheetFitsMobile(page);
  await page.screenshot({ path: path.join(artifactDir, "phase-readiness-clean.png"), fullPage: false });

  assert.deepEqual(pageErrors, [], `Phase-Readiness darf keine JavaScript-Fehler auslösen: ${pageErrors.join(" | ")}`);
  await context.close();
  console.log("phase-readiness-clarity-webkit: ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
