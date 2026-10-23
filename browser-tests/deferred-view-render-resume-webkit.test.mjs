import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
let context;

try {
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);
  await page.waitForFunction(() => window.PlannerReadiness?.state === "ready");
  await page.waitForFunction(() => {
    const persisted = window.__beikostTest?.getState?.()?.backupMeta?.storagePersisted;
    return persisted && persisted !== "unknown";
  });

  const beforeResume = await page.evaluate(() => {
    document.querySelector("#blockPlan").replaceChildren();
    document.getElementById("planFrom").value = "";

    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    window.__restoreRequestAnimationFrame = () => {
      window.requestAnimationFrame = nativeRequestAnimationFrame;
    };
    window.requestAnimationFrame = () => 1;

    document.querySelector('nav button[data-view="plan"]').click();
    return {
      active: document.getElementById("plan").classList.contains("active"),
      busy: document.getElementById("plan").getAttribute("aria-busy"),
      children: document.getElementById("blockPlan").childElementCount,
      pending: deferredViewRenderPending,
    };
  });

  assert.deepEqual(beforeResume, {
    active: true,
    busy: "true",
    children: 0,
    pending: true,
  }, "Der Planwechsel muss bis zur nächsten Render-Gelegenheit aufgeschoben sein");

  const afterResume = await page.evaluate(async () => {
    window.__restoreRequestAnimationFrame();
    let visibility = "hidden";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    delete document.visibilityState;
    return {
      active: document.querySelector(".view.active")?.id,
      date: document.getElementById("planFrom")?.value || "",
      children: document.getElementById("blockPlan")?.childElementCount || 0,
      weekDays: document.querySelectorAll("#planWeekOverview .plan-week-day").length,
      pending: deferredViewRenderPending,
      cover: document.documentElement.classList.contains("app-resume-cover"),
    };
  });

  assert.equal(afterResume.active, "plan");
  assert.ok(afterResume.date, "Der Plan muss nach Resume sein Planungsdatum setzen");
  assert.ok(afterResume.children > 0, "Der Wocheninhalt muss nach Resume gerendert sein");
  assert.equal(afterResume.weekDays, 7, "Die vollständige Planwoche muss sichtbar aufgebaut sein");
  assert.equal(afterResume.pending, false, "Ein verlorener Frame darf den Render-Scheduler nicht blockieren");
  assert.equal(afterResume.cover, false, "Der Resume-Cover muss nach dem Render verschwinden");
} finally {
  await closeBrowserApp({ context, browser, server });
}
