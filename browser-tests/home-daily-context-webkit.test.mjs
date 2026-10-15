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
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState &&
    document.querySelector("#phaseCard")?.innerText.includes("Mahlzeiten") &&
    document.querySelector("#textureCoachCard")?.innerText.includes("Konsistenz"),
  );

  const card = page.locator("#dailyContextCard");
  assert.equal(await card.locator("details").count(), 0, "Der Essenskontext muss ohne Aufklappen sichtbar sein.");
  assert.match(await card.innerText(), /Mahlzeiten[\s\S]*Konsistenz/, "Beide Angaben müssen klar beschriftet sein.");
  assert.doesNotMatch(await card.innerText(), /Tageskontext/, "Die technische Überschrift darf nicht mehr erscheinen.");
  await page.setViewportSize({ width: 320, height: 844 });
  assert.equal(
    await card.evaluate((element) => element.scrollWidth <= element.clientWidth),
    true,
    "Die Karte darf auf schmalen Mobilbildschirmen nicht horizontal überlaufen.",
  );

  const currentStage = await page.evaluate(() => Number(window.__beikostTest.getState().settings.textureStage) || 1);
  const nextStage = currentStage === 4 ? 3 : 4;
  await page.getByRole("button", { name: "Konsistenz ändern" }).click();
  await page.locator("#homeTextureStage").selectOption(String(nextStage));
  await page.getByRole("button", { name: "Konsistenz übernehmen" }).click();
  await page.waitForFunction((stage) =>
    Number(window.__beikostTest.getState().settings.textureStage) === stage,
  nextStage);
  await page.waitForFunction((stage) =>
    document.querySelector("#textureCoachCard")?.innerText.includes(`Stufe ${stage} von 4`),
  nextStage);
  assert.equal(await page.locator("#genericModal").evaluate((element) => element.classList.contains("open")), false);
  assert.match(await card.innerText(), new RegExp(`Stufe ${nextStage} von 4`));
} finally {
  await closeBrowserApp({ context, browser, server });
}

console.log("WebKit home daily context regression passed.");
