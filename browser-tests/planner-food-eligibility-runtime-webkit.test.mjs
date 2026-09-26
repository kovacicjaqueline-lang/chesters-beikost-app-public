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
    const settings = { birthDate: "2026-01-24", phaseSelected: "familie" };
    const ageRestricted = { id: "age", minAgeMonths: 12 };
    const phaseRestricted = { id: "phase", minPhase: "familie" };
    const manualOnly = { id: "manual-only", autoPlan: false };

    return {
      installed: window.__plannerAutomaticFoodEligibilityCoreInstalled === true,
      sameFunction:
        window.automaticFoodEligibility === window.plannerAutomaticFoodEligibilityRuntime,
      manualOnly: window.automaticFoodEligibility(manualOnly, "2028-01-24", settings),
      ageBefore: window.automaticFoodEligibility(ageRestricted, "2027-01-23", settings),
      ageAt: window.automaticFoodEligibility(ageRestricted, "2027-01-24", settings),
      phaseBefore: window.automaticFoodEligibility(
        phaseRestricted,
        "2027-01-24",
        { ...settings, phaseSelected: "drei" },
      ),
      phaseAt: window.automaticFoodEligibility(phaseRestricted, "2027-01-24", settings),
    };
  });

  assert.deepEqual(pageErrors, [], "App-Boot darf keine JavaScript-Fehler auslösen");
  assert.equal(runtime.installed, true, "zentrale FOOD-Autoeignung muss im Browser installiert sein");
  assert.equal(runtime.sameFunction, true, "App-Einstieg muss nach echtem Boot dieselbe zentrale FOOD-Runtime verwenden");
  assert.equal(runtime.manualOnly, false, "autoPlan:false muss zentral gesperrt bleiben");
  assert.equal(runtime.ageBefore, false, "Mindestalter muss vor dem Stichtag zentral sperren");
  assert.equal(runtime.ageAt, true, "Mindestalter muss am Stichtag zentral freigeben");
  assert.equal(runtime.phaseBefore, false, "Mindestphase muss vor Familienkost zentral sperren");
  assert.equal(runtime.phaseAt, true, "Mindestphase muss in Familienkost zentral freigeben");

  console.log("planner-food-eligibility-runtime-webkit: ok");
} finally {
  await closeBrowserApp({ context, browser, server });
}
