import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
let context;
const releasePolicies = deferred();
const releaseApp = deferred();

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

try {
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const policyRequest = deferred();
  const appRequest = deferred();

  await page.route("**/js/planner-meal-eligibility.js*", async (route) => {
    const response = await route.fetch();
    policyRequest.resolve();
    await releasePolicies.promise;
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body: await response.body(),
    });
  });
  await page.route("**/app.js*", async (route) => {
    const response = await route.fetch();
    appRequest.resolve();
    await releaseApp.promise;
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body: await response.body(),
    });
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "commit" });
  await Promise.all([appRequest.promise, policyRequest.promise]);
  releaseApp.resolve();

  await page.waitForFunction(() => !!window.__beikostTest?.getState);
  await page.waitForFunction(() => window.AppReadiness?.ready === true);
  await page.waitForFunction(() => window.PlannerReadiness?.state === "loading");
  await page.evaluate(() => {
    const calls = { buildDay: 0, buildDays: 0, planDisplayDays: 0 };
    for (const name of Object.keys(calls)) {
      const original = window[name];
      window[name] = function countedPlannerBuild(...args) {
        calls[name] += 1;
        return original.apply(this, args);
      };
    }
    window.__plannerBuildCalls = calls;
  });

  const coldStart = await page.evaluate(() => ({
    appReady: window.AppReadiness.ready,
    plannerState: window.PlannerReadiness.state,
    bodyVisibility: getComputedStyle(document.body).visibility,
    appCover: document.documentElement.classList.contains("app-resume-cover"),
    initialPlannerMessage: document.querySelector("#todayCard .planner-readiness-message")?.textContent || "",
    calls: { ...window.__plannerBuildCalls },
  }));
  assert.deepEqual(coldStart, {
    appReady: true,
    plannerState: "loading",
    bodyVisibility: "visible",
    appCover: false,
    initialPlannerMessage: "Planungsregeln werden geladen …",
    calls: { buildDay: 0, buildDays: 0, planDisplayDays: 0 },
  }, "Cold Start muss die App-Shell nach Daten-Readiness zeigen und Planner-Aufrufe bis zur Regel-Readiness sperren");

  await page.locator('nav button[data-view="more"]').click();
  await page.locator("#more .settings-card > details").evaluate((details) => { details.open = true; });
  await page.waitForFunction(() => document.getElementById("newFoodEvery")?.value !== "");
  assert.ok(await page.locator("#newFoodEvery:visible").count(), "Einstellungen müssen vor Planner-Readiness benutzbar sein");
  await page.locator('nav button[data-view="foods"]').click();
  await page.waitForFunction(() => (document.getElementById("foodList")?.childElementCount || 0) > 0);
  assert.ok(await page.locator("#foodList .foodInfo").count(), "Der Lebensmittelkatalog muss vor Planner-Readiness benutzbar sein");
  await page.locator("#foodList .foodInfo").first().click();
  assert.ok(await page.locator("#genericBody .food-detail-hero-icon").count(), "Lebensmitteldetails müssen vor Planner-Readiness öffnen");
  const foodPlannerPreview = page.locator(".history[data-food-planner-preview]");
  assert.match(await foodPlannerPreview.textContent(), /Planungsregeln werden geladen/);
  await page.locator("#closeGeneric").click();
  await page.locator('nav button[data-view="plan"]').click();
  await page.waitForFunction(() => !!document.querySelector("#plan .planner-readiness-message"));
  assert.ok(await page.locator("#plan .planner-readiness-message").count(), "Der Plan muss lokal warten, solange die Runtime-Regeln fehlen");
  assert.equal(await page.locator("#plan .plan-toolbar").evaluate((toolbar) => toolbar.inert), true, "Planänderungen müssen während des Planner-Boots gesperrt bleiben");
  assert.deepEqual(
    await page.evaluate(() => window.__plannerBuildCalls),
    { buildDay: 0, buildDays: 0, planDisplayDays: 0 },
    "Navigation und Details dürfen vor Planner-Readiness keine Planner-Berechnung auslösen",
  );

  const resume = await page.evaluate(async () => {
    let visibility = "hidden";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    const coveredInBackground = document.documentElement.classList.contains("app-resume-cover");
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    const coveredOnResume = document.documentElement.classList.contains("app-resume-cover");
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 0));
    delete document.visibilityState;
    return {
      coveredInBackground,
      coveredOnResume,
      coverAfterPaint: document.documentElement.classList.contains("app-resume-cover"),
      plannerState: window.PlannerReadiness.state,
      bodyVisibility: getComputedStyle(document.body).visibility,
      calls: { ...window.__plannerBuildCalls },
    };
  });
  assert.deepEqual(resume, {
    coveredInBackground: true,
    coveredOnResume: true,
    coverAfterPaint: false,
    plannerState: "loading",
    bodyVisibility: "visible",
    calls: { buildDay: 0, buildDays: 0, planDisplayDays: 0 },
  }, "Resume-Cover muss unabhängig von ausstehenden Planner-Regeln nach zwei Paints verschwinden");

  await page.locator('nav button[data-view="prep"]').click();
  await page.waitForFunction(() =>
    !!document.querySelector("#prepNow .planner-readiness-message") &&
    document.querySelector("#prep > .prep-render-loading")?.textContent === "Planungsregeln werden geladen …",
  );
  assert.deepEqual(
    await page.evaluate(() => ({
      busy: document.getElementById("prep")?.getAttribute("aria-busy"),
      loading: document.querySelector("#prep > .prep-render-loading")?.textContent || "",
      prepShellDisplay: getComputedStyle(document.querySelector("#prep > .prep-mobile-head")).display,
    })),
    { busy: "true", loading: "Planungsregeln werden geladen …", prepShellDisplay: "none" },
    "Prep muss bis zur Planner-Readiness den Ladehinweis halten und alte Inhalte verbergen",
  );
  await page.locator('nav button[data-view="prep"]').click();
  assert.deepEqual(
    await page.evaluate(() => ({
      busy: document.getElementById("prep")?.getAttribute("aria-busy"),
      loading: document.querySelector("#prep > .prep-render-loading")?.textContent || "",
      prepShellDisplay: getComputedStyle(document.querySelector("#prep > .prep-mobile-head")).display,
    })),
    { busy: "true", loading: "Planungsregeln werden geladen …", prepShellDisplay: "none" },
    "Ein erneuter Tap auf Prep darf den Readiness-Ladezustand nicht entfernen",
  );

  releasePolicies.resolve();
  await page.waitForFunction(() => window.PlannerReadiness?.state === "ready");
  await page.waitForFunction(() =>
    document.querySelectorAll("#prepSummary > span").length === 3 &&
    !document.getElementById("prep")?.hasAttribute("aria-busy") &&
    !document.querySelector("#prep > .prep-render-loading"),
  );
  await page.locator('nav button[data-view="plan"]').click();
  await page.waitForFunction(() =>
    document.querySelectorAll("#planWeekOverview .plan-week-day").length === 7 &&
    document.querySelector("#plan .plan-toolbar")?.inert === false,
  );
  assert.equal(await page.locator("#plan .plan-toolbar").evaluate((toolbar) => toolbar.inert), false, "Planänderungen werden nach vollständiger Regelinstallation freigegeben");
  assert.ok(
    await page.evaluate(() => Object.values(window.__plannerBuildCalls).some((count) => count > 0)),
    "Planner-Berechnung darf nach erfolgreicher Regelinstallation wieder laufen",
  );
  await page.waitForFunction(() => !document.querySelector(".history[data-food-planner-preview] .planner-readiness-message"));
} finally {
  releasePolicies.resolve();
  releaseApp.resolve();
  await closeBrowserApp({ context, browser, server });
}
