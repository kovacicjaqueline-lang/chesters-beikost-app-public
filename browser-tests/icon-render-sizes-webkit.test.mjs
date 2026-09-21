import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";



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
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);

  await page.locator('nav button[data-view="foods"]').click();
  const catalogIcon = page.locator("#foodsCatalogSection .foodcard .food-emoji").first();
  await catalogIcon.waitFor({ state: "visible" });

  const catalogSize = await catalogIcon.evaluate((wrapper) => {
    const asset = wrapper.querySelector(".food-illustration");
    const wrapperRect = wrapper.getBoundingClientRect();
    const assetRect = asset?.getBoundingClientRect();
    return {
      wrapperWidth: wrapperRect.width,
      wrapperHeight: wrapperRect.height,
      assetWidth: assetRect?.width ?? 0,
      assetHeight: assetRect?.height ?? 0,
      token: getComputedStyle(wrapper).getPropertyValue("--icon-food").trim(),
    };
  });

  assert.equal(catalogSize.token, "42px", "FOOD-Katalog muss den mobilen 42px-Token tatsächlich erben");
  assert.equal(catalogSize.wrapperWidth, 42, "FOOD-Katalog-Wrapper muss tatsächlich 42px breit rendern");
  assert.equal(catalogSize.wrapperHeight, 42, "FOOD-Katalog-Wrapper muss tatsächlich 42px hoch rendern");
  assert.equal(catalogSize.assetWidth, 42, "FOOD-Katalog-Asset muss tatsächlich 42px breit rendern");
  assert.equal(catalogSize.assetHeight, 42, "FOOD-Katalog-Asset muss tatsächlich 42px hoch rendern");

  const compactSize = await catalogIcon.evaluate((source) => {
    const host = document.createElement("div");
    host.id = "iconRenderCompactProbe";
    host.style.position = "fixed";
    host.style.left = "0";
    host.style.top = "0";
    const probe = source.cloneNode(true);
    host.appendChild(probe);
    document.body.appendChild(host);

    const asset = probe.querySelector(".food-illustration");
    const wrapperRect = probe.getBoundingClientRect();
    const assetRect = asset?.getBoundingClientRect();
    const result = {
      wrapperWidth: wrapperRect.width,
      wrapperHeight: wrapperRect.height,
      assetWidth: assetRect?.width ?? 0,
      assetHeight: assetRect?.height ?? 0,
      token: getComputedStyle(probe).getPropertyValue("--icon-food").trim(),
    };
    host.remove();
    return result;
  });

  assert.equal(compactSize.token, "25px", "außerhalb des FOOD-Katalogs muss der globale 25px-Token gelten");
  assert.equal(compactSize.wrapperWidth, 25, "kompakter FOOD-Wrapper muss tatsächlich 25px breit rendern");
  assert.equal(compactSize.wrapperHeight, 25, "kompakter FOOD-Wrapper muss tatsächlich 25px hoch rendern");
  assert.equal(compactSize.assetWidth, 25, "kompaktes FOOD-Asset muss tatsächlich 25px breit rendern");
  assert.equal(compactSize.assetHeight, 25, "kompaktes FOOD-Asset muss tatsächlich 25px hoch rendern");

  const recipeSize = await page.locator("#foods").evaluate((foods) => {
    const host = document.createElement("div");
    host.className = "recipe-heading-with-icon";
    host.innerHTML = '<span class="illustration-icon illustration-icon--recipe item-illustration recipe-illustration"><img class="illustration-icon__asset" alt=""></span><b>Rezept</b>';
    foods.appendChild(host);

    const wrapper = host.querySelector(".illustration-icon--recipe");
    const asset = host.querySelector(".illustration-icon__asset");
    const wrapperRect = wrapper?.getBoundingClientRect();
    const assetRect = asset?.getBoundingClientRect();
    const result = {
      wrapperWidth: wrapperRect?.width ?? 0,
      wrapperHeight: wrapperRect?.height ?? 0,
      assetWidth: assetRect?.width ?? 0,
      assetHeight: assetRect?.height ?? 0,
      sizeToken: wrapper ? getComputedStyle(wrapper).getPropertyValue("--illustration-size").trim() : "",
    };
    host.remove();
    return result;
  });

  assert.equal(recipeSize.sizeToken, "52px", "mobiler Recipe-Wrapper muss den sichtbaren 52px-Override erben");
  assert.equal(recipeSize.wrapperWidth, 52, "mobiler Recipe-Wrapper darf das 52px-Asset nicht auf das kompakte Token beschneiden");
  assert.equal(recipeSize.wrapperHeight, 52, "mobiler Recipe-Wrapper muss 52px hoch rendern");
  assert.equal(recipeSize.assetWidth, 52, "mobiles Recipe-Asset muss tatsächlich 52px breit rendern");
  assert.equal(recipeSize.assetHeight, 52, "mobiles Recipe-Asset muss tatsächlich 52px hoch rendern");

} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
