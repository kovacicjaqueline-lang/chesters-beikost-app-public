import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function startStaticServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filePath = path.resolve(root, `.${pathname}`);
    if (filePath !== path.join(root, "index.html") && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.stat(filePath, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      fs.createReadStream(filePath).pipe(response);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function waitForApp(page) {
  await page.waitForFunction(() =>
    !!window.__beikostTest &&
    !!window.__mealCardUnification &&
    !!window.__plannerRolloverReviewFixes &&
    window.__plannerPoliciesReady === true &&
    window.__mobilePlanUiInstalled === true &&
    window.__beikostTest.getState()?.backupMeta?.storagePersisted !== "unknown",
  );
}

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const date = await page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const current = window.__beikostTest.today();
    state.settings.phaseSelected = "aufbau";
    state.planLocks[`${current}|lunch`] = {
      planId: "manual-day-close-plan",
      date: current,
      meal: "lunch",
      focusId: "karotte",
      foodIds: ["karotte"],
      baseFoodIds: [],
      sampleFoodIds: ["karotte"],
      foodRoles: { karotte: "sample" },
      mode: "manual",
      active: true,
      type: "neu",
    };
    window.__beikostTest.setState(state);
    return current;
  });

  await page.locator('nav button[data-view="plan"]').click();
  const openDay = page.locator(`#blockPlan > .day-card[data-plan-date="${date}"], #blockPlan > .day-card`).first();
  await openDay.waitFor();
  await page.locator(".closeDay").click();
  await page.waitForFunction((current) => !!window.__beikostTest.getState().dayClosures?.[current], date);

  const closedDay = page.locator("#blockPlan > details.manual-day-closure");
  await closedDay.waitFor();
  assert.match(await closedDay.innerText(), /abgeschlossen/i);
  assert.match(await closedDay.innerText(), /nicht dokumentiert/i);
  assert.equal(
    await page.evaluate((current) => window.__plannerLogRolloverCore.openPlanInstances(window.__beikostTest.getState(), (plan) => plan.date === current && plan.meal === "lunch").length, date),
    1,
    "Tagesabschluss darf offene Planmahlzeiten nicht als gegessen markieren",
  );

  await closedDay.locator(".reopenDay").click();
  await page.waitForFunction((current) => !window.__beikostTest.getState().dayClosures?.[current], date);
  await page.locator(".closeDay").waitFor();

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("manual-day-closure-webkit: ok");
