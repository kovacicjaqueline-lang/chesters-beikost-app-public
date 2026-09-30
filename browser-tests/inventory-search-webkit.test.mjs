import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    typeof window.addInventoryForm === "function" &&
    window.__inventoryLiveSearchUiInstalled === true,
  );

  await page.evaluate(() => window.addInventoryForm());
  const search = page.locator("#inventoryLiveSearch");
  await search.waitFor();
  await search.focus();
  await page.evaluate(() => {
    window.__inventorySearchNode = document.getElementById("inventoryLiveSearch");
  });

  await search.pressSequentially("R");
  await page.waitForFunction(() => {
    const firstName = document.querySelector(".chooseInventoryTarget b")?.textContent || "";
    return /^r/i.test(firstName);
  });

  assert.equal(
    await page.evaluate(() => document.getElementById("inventoryLiveSearch") === window.__inventorySearchNode),
    true,
    "Beim Tippen darf das aktive Suchfeld nicht ersetzt werden",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement === document.getElementById("inventoryLiveSearch")),
    true,
    "Die Vorratssuche muss während der Eingabe fokussiert bleiben",
  );

  const firstName = (await page.locator(".chooseInventoryTarget b").first().textContent())?.trim() || "";
  assert.match(firstName, /^r/i, "Namensanfänge mit R müssen vor bloßen Teiltreffern wie Amaranth stehen");
  assert.notEqual(firstName, "Amaranth");

  await search.pressSequentially("e");
  assert.equal(
    await page.evaluate(() => document.getElementById("inventoryLiveSearch") === window.__inventorySearchNode),
    true,
    "Auch weitere Zeichen müssen dasselbe Input-Element behalten",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement === document.getElementById("inventoryLiveSearch")),
    true,
    "Der Fokus muss auch nach mehreren Zeichen erhalten bleiben",
  );

  const chosenName = (await page.locator(".chooseInventoryTarget b").first().textContent())?.trim() || "";
  await page.locator(".chooseInventoryTarget").first().click();
  await page.waitForFunction((name) =>
    document.querySelector(".selected-target b")?.textContent?.includes(name),
  chosenName);
  assert.equal(await page.locator("#inventoryLiveSearch").inputValue(), "");
} finally {
  await closeBrowserApp({ context, browser, server });
}

console.log("WebKit inventory live-search regression passed.");
