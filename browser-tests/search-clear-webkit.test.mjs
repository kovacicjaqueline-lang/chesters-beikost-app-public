import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, configureBrowserTestPage, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
let context;

try {
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = configureBrowserTestPage(await context.newPage());
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);

  await page.locator('nav button[data-view="foods"]').click();
  const foodSearch = page.locator("#foodSearch");
  const foodList = page.locator("#foodList");
  await foodList.locator(".food-card").first().waitFor();
  const foodsBefore = await foodList.innerText();
  await foodSearch.fill("unauffindbar-testwert");
  await foodSearch.dispatchEvent("input");
  assert.notEqual(await foodList.innerText(), foodsBefore);
  await foodSearch.fill("");
  await foodSearch.dispatchEvent("input");
  assert.equal(await foodList.innerText(), foodsBefore);

  await page.locator('[data-catalog-mode="recipes"]').click();
  const recipeSearch = page.locator("#recipeSearch");
  const recipeList = page.locator("#recipeList");
  await recipeList.locator(".recipe-card").first().waitFor();
  const recipesBefore = await recipeList.innerText();
  await recipeSearch.fill("unauffindbar-testwert");
  await recipeSearch.dispatchEvent("input");
  assert.notEqual(await recipeList.innerText(), recipesBefore);
  await recipeSearch.fill("");
  await recipeSearch.dispatchEvent("input");
  assert.equal(await recipeList.innerText(), recipesBefore);
} finally {
  await closeBrowserApp({ context, browser, server });
}
