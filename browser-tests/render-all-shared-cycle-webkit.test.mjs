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
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState &&
    typeof window.renderAll === "function" &&
    typeof window.viewRenderBuildDays === "function",
  );
  await page.waitForFunction(() => window.__plannerPoliciesReady === true);

  const measurement = await page.evaluate(() => {
    state.settings.planFrom = today();
    const baseBuildDays = buildDays;
    let matchingBuilds = 0;
    buildDays = function countedBuildDays(from, n = 7, applyAutoLocks = true) {
      if (String(from) === today() && Number(n) === 7 && applyAutoLocks !== false) matchingBuilds += 1;
      return baseBuildDays.apply(this, arguments);
    };

    try {
      renderAll();
      const duringFullRender = matchingBuilds;
      viewRenderBuildDays(today(), 7);
      viewRenderBuildDays(today(), 7);
      return {
        duringFullRender,
        outsideCycleAdditionalBuilds: matchingBuilds - duringFullRender,
      };
    } finally {
      buildDays = baseBuildDays;
    }
  });

  assert.equal(
    measurement.duringFullRender,
    1,
    "Plan und Prep müssen im selben renderAll()-Zyklus denselben 7-Tage-buildDays-Aufruf teilen",
  );
  assert.equal(
    measurement.outsideCycleAdditionalBuilds,
    2,
    "Der gemeinsame Full-Render-Cache darf nach renderAll() nicht außerhalb des Render-Zyklus weiterleben",
  );
  assert.deepEqual(pageErrors, [], `Der Full-Render darf keine JavaScript-Fehler erzeugen: ${pageErrors.join(" | ")}`);

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
