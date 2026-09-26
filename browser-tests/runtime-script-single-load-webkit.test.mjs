import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
let context = null;

try {
  context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.reset);
  await page.waitForFunction(() => window.__plannerPoliciesReady === true);
  await page.waitForFunction(() => window.__manualMealFlowRuntimeInstalled === true);
  await page.waitForFunction(() => window.__mealEditorRecipeVariantsInstalled === true);
  await page.waitForLoadState("networkidle");

  const duplicateScripts = await page.evaluate(() => {
    const normalize = (value) => {
      const url = new URL(String(value || ""), document.baseURI);
      return url.pathname.replace(/^\/+/, "");
    };

    const counts = new Map();
    for (const script of document.scripts) {
      if (!script.src) continue;
      const file = normalize(script.src);
      if (file !== "app.js" && !file.startsWith("js/") && !file.startsWith("data/")) continue;
      counts.set(file, (counts.get(file) || 0) + 1);
    }

    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => a.file.localeCompare(b.file));
  });

  assert.deepEqual(pageErrors, [], "App-Boot darf keine JavaScript-Fehler auslösen");
  assert.deepEqual(
    duplicateScripts,
    [],
    `Produktive Runtime-Scripts dürfen nur einmal eingebunden sein: ${JSON.stringify(duplicateScripts)}`,
  );

  console.log("runtime-script-single-load-webkit: ok");
} finally {
  await closeBrowserApp({ context, browser, server });
}
