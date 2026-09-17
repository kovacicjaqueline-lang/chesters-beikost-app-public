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

async function waitForApp(page) {
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState &&
    typeof window.openLog === "function" &&
    typeof window.closeLog === "function",
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

async function exposeSearch(page, kind) {
  const id = kind === "foods" ? "#logFoodSearch" : "#logRecipeSearch";
  const search = page.locator(id);
  if (!(await search.isVisible())) {
    const tab = page.locator(`[data-flow-log-selector="${kind}"]`);
    if (await tab.count()) await tab.click();
  }
  if (!(await search.isVisible())) {
    const toggle = page.locator(`[data-flow-log-search-toggle="${kind}"]`);
    if (await toggle.count()) await toggle.click();
  }
  return search;
}

async function settleBrowserTurn(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function visibilitySnapshot(page, label) {
  const snapshot = await page.evaluate((labelValue) => {
    const texture = document.getElementById("logTexture");
    const modal = document.getElementById("logModal");
    const ancestors = [];
    for (let node = texture; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      ancestors.push({
        tag: node.tagName,
        id: node.id || "",
        className: node.className || "",
        hidden: !!node.hidden,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: rect.width,
        height: rect.height,
      });
      if (node === document.body) break;
    }
    return {
      label: labelValue,
      modalClass: modal?.className || "",
      modalDisplay: modal ? getComputedStyle(modal).display : "missing",
      modalRect: modal ? {
        width: modal.getBoundingClientRect().width,
        height: modal.getBoundingClientRect().height,
      } : null,
      closeCalls: globalThis.__logVisibilityCloseCalls || [],
      textureExists: !!texture,
      textureVisible: !!texture && texture.getBoundingClientRect().width > 0 && texture.getBoundingClientRect().height > 0 && getComputedStyle(texture).visibility !== "hidden" && getComputedStyle(texture).display !== "none",
      ancestors,
    };
  }, label);
  console.log(`[log-form-visibility] ${JSON.stringify(snapshot)}`);
  return snapshot;
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
    const baseCloseLog = window.closeLog;
    globalThis.__logVisibilityCloseCalls = [];
    window.closeLog = function diagnosedCloseLog(...args) {
      globalThis.__logVisibilityCloseCalls.push(new Error("closeLog called").stack || "closeLog called");
      return baseCloseLog.apply(this, args);
    };
  });

  await reset(page);
  await page.evaluate(() => window.openLog(null));
  let search = await exposeSearch(page, "foods");
  await search.fill("Karotte");
  const foodResult = page.locator(".addLogFoodResult").filter({ hasText: "Karotte" }).first();
  await foodResult.waitFor({ state: "visible" });
  await foodResult.click();
  await settleBrowserTurn(page);
  const foodSnapshot = await visibilitySnapshot(page, "after-food-selection");
  assert.equal(foodSnapshot.textureExists, true);

  await page.evaluate(() => window.closeLog());
  await reset(page);
  await page.evaluate(() => window.openLog(null));
  search = await exposeSearch(page, "recipes");
  await search.fill("Birne-Hirse-Pancakes");
  const recipeResult = page.locator(".selectLogRecipeResult").filter({ hasText: "Birne-Hirse-Pancakes" }).first();
  await recipeResult.waitFor({ state: "visible" });
  await recipeResult.click();
  await settleBrowserTurn(page);
  const recipeSnapshot = await visibilitySnapshot(page, "after-recipe-selection");
  assert.equal(recipeSnapshot.textureExists, true);
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("Log form visibility diagnostics completed.");
