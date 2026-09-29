import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
let context;
let releasePolicyRequest;

try {
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  let policyRequestReached;
  const policyRequestStarted = new Promise((resolve) => {
    policyRequestReached = resolve;
  });
  await page.route("**/js/planner-meal-eligibility.js*", async (route) => {
    policyRequestReached();
    await new Promise((resolve) => { releasePolicyRequest = resolve; });
    await route.continue();
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await policyRequestStarted;
  await page.waitForFunction(() =>
    !!window.__plannerPoliciesReadyPromise?.then && document.getElementById("appMain")?.inert,
  );

  const whilePolicyIsBlocked = await page.evaluate(() => ({
    bodyVisibility: document.body.style.visibility,
    bootPending: document.documentElement.classList.contains("app-boot-pending"),
    bootStatusDisplay: getComputedStyle(document.getElementById("appBootStatus")).display,
    bootStatusIsInert: !!document.getElementById("appBootStatus").closest("[inert]"),
    mainInert: document.getElementById("appMain").inert,
    navInert: document.querySelector("nav").inert,
    plannerReady: window.__plannerPoliciesReady,
    testApiAvailable: !!window.__beikostTest?.getState,
    homeRendered: document.getElementById("todayCard").textContent.trim().length > 0,
  }));

  assert.equal(whilePolicyIsBlocked.bodyVisibility, "");
  assert.equal(whilePolicyIsBlocked.bootPending, true);
  assert.equal(whilePolicyIsBlocked.bootStatusDisplay, "grid");
  assert.equal(whilePolicyIsBlocked.bootStatusIsInert, false);
  assert.equal(whilePolicyIsBlocked.mainInert, true);
  assert.equal(whilePolicyIsBlocked.navInert, true);
  assert.equal(whilePolicyIsBlocked.plannerReady, false);
  assert.equal(whilePolicyIsBlocked.testApiAvailable, false);
  assert.equal(whilePolicyIsBlocked.homeRendered, false);

  releasePolicyRequest();
  await page.waitForFunction(() => window.__plannerPoliciesReady === true);

  const afterPolicyReady = await page.evaluate(() => ({
    bootPending: document.documentElement.classList.contains("app-boot-pending"),
    bootStatusDisplay: getComputedStyle(document.getElementById("appBootStatus")).display,
    mainInert: document.getElementById("appMain").inert,
    navInert: document.querySelector("nav").inert,
    testApiAvailable: !!window.__beikostTest?.getState,
    homeRendered: document.getElementById("todayCard").textContent.trim().length > 0,
  }));

  assert.equal(afterPolicyReady.bootPending, false);
  assert.equal(afterPolicyReady.bootStatusDisplay, "none");
  assert.equal(afterPolicyReady.mainInert, false);
  assert.equal(afterPolicyReady.navInert, false);
  assert.equal(afterPolicyReady.testApiAvailable, true);
  assert.equal(afterPolicyReady.homeRendered, true);
} finally {
  releasePolicyRequest?.();
  await closeBrowserApp({ context, browser, server });
}
