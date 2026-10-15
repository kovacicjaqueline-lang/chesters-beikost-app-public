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

  const card = page.locator("#dailyContextCard");
  assert.equal(await card.isVisible(), true, "Der Heute-Kontext muss direkt sichtbar sein.");
  assert.equal(await card.locator("details").count(), 0, "Der Heute-Kontext darf keine Aufklappsteuerung enthalten.");
  assert.equal(await card.locator("#phaseCard").count(), 1);
  assert.equal(await card.locator("#textureCoachCard").count(), 1);
  assert.equal(await page.getByText("Tageskontext", { exact: true }).count(), 0);

  await page.setViewportSize({ width: 320, height: 844 });
  assert.equal(
    await card.evaluate((element) => element.scrollWidth <= element.clientWidth),
    true,
    "Der Heute-Kontext darf auf schmalen Displays nicht horizontal überlaufen.",
  );
} finally {
  await closeBrowserApp({ context, browser, server });
}

console.log("home daily context layout: ok");
