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

  const runtime = await page.evaluate(() => {
    const recipe = RECIPES.find((item) => item?.name === "Huhn-Gemüse-Muffins");
    return {
      installed: window.__plannerRecipeMealEligibilityCoreInstalled === true,
      sameFunction: window.recipeSuitableForMeal === window.plannerRecipeSuitableForMeal,
      breakfast: window.recipeSuitableForMeal(recipe, "breakfast"),
      snack: window.recipeSuitableForMeal(recipe, "snack"),
      appBreakfast: window.plannerRecipeSuitableForMeal(recipe, "breakfast"),
    };
  });

  assert.deepEqual(pageErrors, [], "App-Boot darf keine JavaScript-Fehler auslösen");
  assert.equal(runtime.installed, true, "zentrale Rezept-Eignung muss im Browser installiert sein");
  assert.equal(runtime.sameFunction, true, "Planner- und App-Pfad müssen nach echtem Boot dieselbe Runtime-Funktion verwenden");
  assert.equal(runtime.breakfast, false, "excludeMeals muss Frühstück im echten Planner-Pfad sperren");
  assert.equal(runtime.appBreakfast, false, "excludeMeals muss Frühstück im App-Pfad sperren");
  assert.equal(runtime.snack, true, "Snack-Eignung muss erhalten bleiben");

  console.log("planner-recipe-meal-eligibility-runtime-webkit: ok");
} finally {
  await closeBrowserApp({ context, browser, server });
}
