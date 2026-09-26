import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !!window.__beikostTest?.getState && window.__plannerPoliciesReady === true,
    null,
    { timeout: 60000 },
  );

  const result = await page.evaluate(() => {
    const porridge = window.recipeByName("Obst-Polentabrei");
    const pancakes = window.recipeByName("Ube-Bananen-Pancakes");
    return {
      coreGateAvailable: typeof window.recipeSuitableForMeal === "function",
      appPorridgeLunch: window.__beikostTest.recipeSuitableForMeal("Obst-Polentabrei", "lunch"),
      corePorridgeLunch: window.recipeSuitableForMeal(porridge, "lunch"),
      corePorridgeDinner: window.recipeSuitableForMeal(porridge, "dinner"),
      appPancakesLunch: window.__beikostTest.recipeSuitableForMeal("Ube-Bananen-Pancakes", "lunch"),
      corePancakesLunch: window.recipeSuitableForMeal(pancakes, "lunch"),
    };
  });

  assert.equal(result.coreGateAvailable, true, "Der produktive Core-Planner muss seinen Rezept-Gate exponieren");
  assert.equal(result.appPorridgeLunch, false, "App-Gate sperrt Porridge beim automatischen Lunch");
  assert.equal(result.corePorridgeLunch, false, "Der tatsächlich planende Core-Gate muss Porridge beim Lunch ebenfalls sperren");
  assert.equal(result.corePorridgeDinner, true, "Porridge bleibt beim Dinner zulässig");
  assert.equal(result.appPancakesLunch, true, "Der bestehende App-Pfad lässt Pancakes beim Lunch zu");
  assert.equal(result.corePancakesLunch, true, "Core- und App-Gate müssen für Pancakes übereinstimmen");
} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
