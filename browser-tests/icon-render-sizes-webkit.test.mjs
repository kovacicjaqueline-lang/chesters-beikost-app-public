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
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);

  await page.locator('nav button[data-view="foods"]').click();
  const catalogIcon = page.locator("#foodsCatalogSection .foodcard .food-emoji").first();
  await catalogIcon.waitFor({ state: "visible" });

  const catalogSize = await catalogIcon.evaluate((wrapper) => {
    const asset = wrapper.querySelector(".food-illustration");
    const wrapperRect = wrapper.getBoundingClientRect();
    const assetRect = asset?.getBoundingClientRect();
    return {
      wrapperWidth: wrapperRect.width,
      wrapperHeight: wrapperRect.height,
      assetWidth: assetRect?.width ?? 0,
      assetHeight: assetRect?.height ?? 0,
      token: getComputedStyle(wrapper).getPropertyValue("--icon-food").trim(),
    };
  });

  assert.equal(catalogSize.token, "42px", "FOOD-Katalog muss den mobilen 42px-Token tatsächlich erben");
  assert.equal(catalogSize.wrapperWidth, 42, "FOOD-Katalog-Wrapper muss tatsächlich 42px breit rendern");
  assert.equal(catalogSize.wrapperHeight, 42, "FOOD-Katalog-Wrapper muss tatsächlich 42px hoch rendern");
  assert.equal(catalogSize.assetWidth, 42, "FOOD-Katalog-Asset muss tatsächlich 42px breit rendern");
  assert.equal(catalogSize.assetHeight, 42, "FOOD-Katalog-Asset muss tatsächlich 42px hoch rendern");

  const compactSize = await catalogIcon.evaluate((source) => {
    const host = document.createElement("div");
    host.id = "iconRenderCompactProbe";
    host.style.position = "fixed";
    host.style.left = "0";
    host.style.top = "0";
    const probe = source.cloneNode(true);
    host.appendChild(probe);
    document.body.appendChild(host);

    const asset = probe.querySelector(".food-illustration");
    const wrapperRect = probe.getBoundingClientRect();
    const assetRect = asset?.getBoundingClientRect();
    const result = {
      wrapperWidth: wrapperRect.width,
      wrapperHeight: wrapperRect.height,
      assetWidth: assetRect?.width ?? 0,
      assetHeight: assetRect?.height ?? 0,
      token: getComputedStyle(probe).getPropertyValue("--icon-food").trim(),
    };
    host.remove();
    return result;
  });

  assert.equal(compactSize.token, "25px", "außerhalb des FOOD-Katalogs muss der globale 25px-Token gelten");
  assert.equal(compactSize.wrapperWidth, 25, "kompakter FOOD-Wrapper muss tatsächlich 25px breit rendern");
  assert.equal(compactSize.wrapperHeight, 25, "kompakter FOOD-Wrapper muss tatsächlich 25px hoch rendern");
  assert.equal(compactSize.assetWidth, 25, "kompaktes FOOD-Asset muss tatsächlich 25px breit rendern");
  assert.equal(compactSize.assetHeight, 25, "kompaktes FOOD-Asset muss tatsächlich 25px hoch rendern");

  await page.locator("#foodsCatalogSection .foodcard .foodInfo").first().click();
  const detailIcon = page.locator(".food-detail-hero-icon");
  await detailIcon.waitFor({ state: "visible" });

  const detailSize = await detailIcon.evaluate((wrapper) => {
    const asset = wrapper.querySelector(".food-illustration");
    const wrapperRect = wrapper.getBoundingClientRect();
    const assetRect = asset?.getBoundingClientRect();
    return {
      wrapperWidth: wrapperRect.width,
      wrapperHeight: wrapperRect.height,
      assetWidth: assetRect?.width ?? 0,
      assetHeight: assetRect?.height ?? 0,
      token: getComputedStyle(wrapper).getPropertyValue("--icon-food").trim(),
      deviceScaleFactor: window.devicePixelRatio,
    };
  });

  assert.equal(detailSize.token, "96px", "FOOD-Detail muss die verbindliche 96px-Darstellung behalten");
  assert.equal(detailSize.wrapperWidth, 96, "FOOD-Detail-Wrapper muss tatsächlich 96px breit rendern");
  assert.equal(detailSize.wrapperHeight, 96, "FOOD-Detail-Wrapper muss tatsächlich 96px hoch rendern");
  assert.equal(detailSize.assetWidth, 96, "FOOD-Detail-Asset muss tatsächlich 96px breit rendern");
  assert.equal(detailSize.assetHeight, 96, "FOOD-Detail-Asset muss tatsächlich 96px hoch rendern");
  assert.equal(detailSize.deviceScaleFactor, 3, "FOOD-Detail-Regression muss auch einen 3×-Viewport prüfen");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}