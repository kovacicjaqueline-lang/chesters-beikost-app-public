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
    const scripts = [...document.scripts].filter((script) => {
      if (!script.src) return false;
      return new URL(script.src, location.href).pathname.endsWith(
        "/js/planner-allergen-maintenance.js",
      );
    });
    return {
      count: scripts.length,
      loaderMarker: scripts[0]?.dataset.plannerAllergenMaintenance || "",
      maintenanceReady: !!window.PlannerAllergenMaintenance,
    };
  });

  assert.deepEqual(pageErrors, [], "App-Boot darf keine JavaScript-Fehler auslösen");
  assert.equal(runtime.maintenanceReady, true, "Allergen-Maintenance muss nach dem Planner-Boot verfügbar sein");
  assert.equal(runtime.count, 1, "planner-allergen-maintenance.js darf beim App-Boot nur einmal als Script eingebunden sein");
  assert.equal(runtime.loaderMarker, "maintenance-v2", "der vorhandene Script-Tag muss vom Policy-Loader wiedererkannt werden");

  console.log("planner-allergen-maintenance-single-load-webkit: ok");
} finally {
  await closeBrowserApp({ context, browser, server });
}
