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

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.reset);
  await page.waitForFunction(() => window.__plannerPoliciesReady === true);
  await page.waitForFunction(() => window.__mealEditorRecipeVariantsInstalled === true);

  const runtime = await page.evaluate(() => {
    const scripts = [...document.scripts].filter((script) => {
      if (!script.src) return false;
      return new URL(script.src, location.href).pathname.endsWith(
        "/js/recipe-v2-component-options.js",
      );
    });
    return {
      count: scripts.length,
      componentApiReady: typeof window.installRecipeV2ComponentOptions === "function",
      manualFlowReady: window.__manualMealFlowRuntimeInstalled === true,
      variantsReady: window.__mealEditorRecipeVariantsInstalled === true,
      fruitOptionsReady: recipeByName("Obst-Reisbrei")?.oneOf?.includes("Brombeere") === true,
    };
  });

  assert.deepEqual(pageErrors, [], "App-Boot darf keine JavaScript-Fehler auslösen");
  assert.equal(runtime.componentApiReady, true, "Recipe-V2-Komponenten-API muss vor dem Planner-Fortsetzungsflow verfügbar sein");
  assert.equal(runtime.manualFlowReady, true, "manueller Mahlzeiten-Flow muss trotz bereits geladenem Recipe-V2-Script weiter starten");
  assert.equal(runtime.variantsReady, true, "Mahlzeiten-Editor-Varianten müssen nach dem Recipe-V2-Loader weiter starten");
  assert.equal(runtime.fruitOptionsReady, true, "Recipe-V2-Komponenten müssen weiterhin vor der Nutzung installiert sein");
  assert.equal(runtime.count, 1, "recipe-v2-component-options.js darf beim App-Boot nur einmal eingebunden sein");

  console.log("recipe-v2-component-options-single-load-webkit: ok");
} finally {
  await closeBrowserApp({ context, browser, server });
}
