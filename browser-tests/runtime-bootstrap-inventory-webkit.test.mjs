import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexSource = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");

function normalizeRepoPath(value = "") {
  const clean = String(value || "").split("#")[0].split("?")[0];
  return clean.replace(/^https?:\/\/[^/]+\//, "").replace(/^\.\//, "").replace(/^\//, "");
}

function htmlAssetRefs(pattern) {
  return [...indexSource.matchAll(pattern)]
    .map((match) => normalizeRepoPath(match[1]))
    .filter(Boolean);
}

const directScripts = htmlAssetRefs(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi);
const preloadedScripts = htmlAssetRefs(/<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bas=["']script["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi);

function listProductJs() {
  const files = ["app.js"];
  for (const directory of ["js", "data"]) {
    const base = path.join(repoRoot, directory);
    for (const name of fs.readdirSync(base).filter((item) => item.endsWith(".js")).sort()) {
      files.push(`${directory}/${name}`);
    }
  }
  return files;
}

const productJsFiles = listProductJs();
const loaderSignal = /(?:createElement\s*\(\s*["']script["']|document\.write\s*\(|importScripts\s*\(|new\s+(?:[\w$.]+\.)?Worker\s*\(|\.src\s*=|\bsrc\s*=\s*new\s+URL|\bfiles\s*=\s*\[)/;
const productSources = new Map(
  productJsFiles.map((file) => [file, fs.readFileSync(path.join(repoRoot, file), "utf8")]),
);

function staticLoaderCallers(target) {
  const basename = path.posix.basename(target);
  return productJsFiles.filter((sourceFile) => {
    if (sourceFile === target) return false;
    const source = productSources.get(sourceFile) || "";
    return source.includes(basename) && loaderSignal.test(source);
  });
}

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

  const runtime = await page.evaluate(() => {
    const normalize = (value = "") => {
      try {
        const url = new URL(String(value), document.baseURI);
        return url.pathname.replace(/^\//, "");
      } catch {
        return String(value || "").split("?")[0].replace(/^\.\//, "").replace(/^\//, "");
      }
    };
    const executedScripts = [...document.scripts]
      .map((script) => script.src && normalize(script.src))
      .filter(Boolean);
    const resources = performance.getEntriesByType("resource")
      .map((entry) => normalize(entry.name))
      .filter(Boolean);
    const runtimeMarkers = Object.getOwnPropertyNames(window)
      .filter((name) => /^__(?:planner|manualMeal|mealEditor|planChecks|flow|food|recipe).*(?:Installed|Ready)$/i.test(name))
      .filter((name) => window[name] === true)
      .sort();

    return {
      executedScripts,
      resources,
      runtimeMarkers,
      plannerPoliciesReady: window.__plannerPoliciesReady === true,
      plannerMealEligibilityInstalled: window.__plannerMealEligibilityRuntimeInstalled === true,
      plannerRecipeEligibilityInstalled: window.__plannerRecipeMealEligibilityCoreInstalled === true,
      manualMealFlowInstalled: window.__manualMealFlowRuntimeInstalled === true,
      mealEditorRecipeVariantsInstalled: window.__mealEditorRecipeVariantsInstalled === true,
    };
  });

  const executedCounts = new Map();
  for (const file of runtime.executedScripts) {
    executedCounts.set(file, (executedCounts.get(file) || 0) + 1);
  }

  const inventory = productJsFiles.map((file) => {
    const callers = staticLoaderCallers(file);
    const direct = directScripts.includes(file);
    const preloaded = preloadedScripts.includes(file);
    const executedCount = executedCounts.get(file) || 0;
    let status = "no-productive-caller";
    if (direct) status = "direct";
    else if (executedCount > 0 || callers.length) status = "indirect";
    else if (preloaded) status = "preload-only";
    return { file, status, direct, preloaded, executedCount, callers };
  });

  const preloadOnly = inventory.filter((item) => item.status === "preload-only");
  const noProductiveCaller = inventory.filter((item) => item.status === "no-productive-caller");
  const indirect = inventory.filter((item) => item.status === "indirect");
  const duplicateExecutions = inventory.filter((item) => item.executedCount > 1);

  assert.deepEqual(pageErrors, [], "App-Boot darf keine JavaScript-Fehler auslösen");
  assert.equal(runtime.plannerPoliciesReady, true, "Planner-Policy-Kette muss vollständig gebootet sein");
  assert.equal(runtime.plannerMealEligibilityInstalled, true, "FOOD-Mahlzeiteneignung muss installiert sein");
  assert.equal(runtime.plannerRecipeEligibilityInstalled, true, "Rezept-Mahlzeiteneignung muss installiert sein");
  assert.equal(runtime.manualMealFlowInstalled, true, "Manual-Meal-Flow muss im echten App-Boot installiert sein");
  assert.equal(runtime.mealEditorRecipeVariantsInstalled, true, "Recipe-V2-Mahlzeiteneditor muss im echten App-Boot installiert sein");

  for (const file of directScripts) {
    assert.ok(
      (executedCounts.get(file) || 0) >= 1,
      `${file} muss als direktes Produktivscript ausgeführt werden`,
    );
  }
  for (const file of preloadedScripts) {
    assert.ok(
      (executedCounts.get(file) || 0) >= 1,
      `${file} darf nicht nur preloaded sein, sondern muss als Script ausgeführt werden`,
    );
  }

  assert.deepEqual(
    preloadOnly,
    [],
    `Preload-only-Scripts gefunden: ${preloadOnly.map((item) => item.file).join(", ")}`,
  );

  console.log("runtime-bootstrap-inventory:");
  console.log(JSON.stringify({
    direct: inventory.filter((item) => item.status === "direct").map((item) => item.file),
    indirect: indirect.map((item) => ({ file: item.file, callers: item.callers })),
    duplicateExecutions: duplicateExecutions.map((item) => ({
      file: item.file,
      executedCount: item.executedCount,
      direct: item.direct,
      callers: item.callers,
    })),
    preloadOnly: preloadOnly.map((item) => item.file),
    noProductiveCaller: noProductiveCaller.map((item) => item.file),
    runtimeMarkers: runtime.runtimeMarkers,
  }, null, 2));
  console.log("runtime-bootstrap-inventory-webkit: ok");
} finally {
  await closeBrowserApp({ context, browser, server });
}
