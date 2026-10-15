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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.reset && window.__planChecksUiInstalled === true);
  await page.evaluate(() => window.__beikostTest.reset());
  await page.waitForFunction(() =>
    document.querySelector("#dailyContextCard")?.isConnected &&
    document.querySelector("#phaseForward") &&
    document.querySelector("#textureChange"),
  );

  const contextCard = page.locator("#dailyContextCard");
  assert.equal(await contextCard.isVisible(), true, "Der Tagesbereich muss direkt sichtbar sein.");
  assert.equal(await contextCard.locator("details").count(), 0, "Der Tagesbereich darf keine Aufklappsteuerung enthalten.");
  assert.match(await page.locator("#phaseCard").textContent(), /Mahlzeiten/);
  assert.match(await page.locator("#textureCoachCard").textContent(), /Konsistenz/);

  await page.locator("#phaseForward").click();
  assert.match(await page.locator("#genericTitle").textContent(), /Phase wechseln/);
  assert.match(await page.locator("#genericBody").textContent(), /Vorgesehene Mahlzeiten/);
  await page.getByRole("button", { name: "Abbrechen" }).click();
  assert.equal(await page.locator("#genericModal").evaluate((element) => element.classList.contains("open")), false);

  const currentStage = await page.evaluate(() => Number(window.__beikostTest.getState().settings.textureStage) || 1);
  const nextStage = currentStage === 4 ? 3 : 4;
  await page.getByRole("button", { name: "Konsistenz ändern" }).click();
  await page.locator("#homeTextureStage").selectOption(String(nextStage));
  await page.getByRole("button", { name: "Konsistenz übernehmen" }).click();
  await page.waitForFunction((stage) =>
    Number(window.__beikostTest.getState().settings.textureStage) === stage,
  nextStage);
  await page.waitForFunction((stage) =>
    document.querySelector("#textureCoachCard")?.textContent.includes(`Stufe ${stage} von 4`),
  nextStage);
  assert.equal(await page.locator("#genericModal").evaluate((element) => element.classList.contains("open")), false);
  assert.deepEqual(pageErrors, [], `Heute-Kontext darf keine JavaScript-Fehler auslösen: ${pageErrors.join(" | ")}`);
} finally {
  await closeBrowserApp({ context, browser, server });
}

console.log("home daily context and phase controls: ok");
