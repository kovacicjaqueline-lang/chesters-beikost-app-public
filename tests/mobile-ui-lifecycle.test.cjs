"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

delete globalThis.MobileUiLifecycle;
require("../js/mobile-ui-lifecycle.js");

test("MobileUiLifecycle dispatcht Render- und View-Hooks explizit und abmeldbar", () => {
  const calls = [];
  const offPlan = globalThis.MobileUiLifecycle.onRender("plan", (event) => calls.push(["render", event.viewId, event.source]));
  const offView = globalThis.MobileUiLifecycle.onViewChange((event) => calls.push(["view", event.viewId, event.previousViewId]));

  globalThis.MobileUiLifecycle.afterRender("plan", { source: "test" });
  globalThis.MobileUiLifecycle.afterRender("prep");
  globalThis.MobileUiLifecycle.afterViewChange("more", "foods");

  assert.deepEqual(calls, [
    ["render", "plan", "test"],
    ["view", "more", "foods"],
  ]);

  offPlan();
  offView();
  globalThis.MobileUiLifecycle.afterRender("plan", { source: "ignored" });
  globalThis.MobileUiLifecycle.afterViewChange("home", "more");
  assert.equal(calls.length, 2);
});

test("Mobile-Integrationen verwenden gemeinsame Lifecycle-Hooks statt Render-/View-Monkey-Patches", () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const index = read("index.html");
  const sw = read("sw.js");
  const ui = read("js/ui.js");
  const prep = read("js/prep.js");
  const foods = read("js/foods.js");
  const catalog = read("js/catalog-navigation.js");
  const planMobile = read("js/plan-mobile-ui.js");
  const prepMobile = read("js/prep-mobile.js");
  const beikostMore = read("js/mobile-beikost-more.js");

  assert.ok(index.indexOf("js/mobile-ui-lifecycle.js") < index.indexOf("js/deferred-render.js"));
  assert.match(sw, /\.\/js\/mobile-ui-lifecycle\.js\?v=10\.1\.26/);
  assert.match(ui, /renderPlanCore\(\);\s*globalThis\.MobileUiLifecycle\?\.afterRender\("plan"\)/);
  assert.match(ui, /MobileUiLifecycle\?\.afterRender\("home"\)/);
  assert.match(ui, /MobileUiLifecycle\?\.afterViewChange\(id, previous\)/);
  assert.match(prep, /MobileUiLifecycle\?\.afterRender\("prep"\)/);
  assert.match(foods, /MobileUiLifecycle\?\.afterRender\("foods"\)/);

  assert.match(planMobile, /MobileUiLifecycle\.onRender\("plan", enhanceMobilePlan\)/);
  assert.doesNotMatch(planMobile, /baseRenderPlanCore|renderPlanCore\s*=/);
  assert.match(prepMobile, /MobileUiLifecycle\.onRender\("prep", enhanceMobilePrep\)/);
  assert.doesNotMatch(prepMobile, /baseRenderPrep|renderPrep\s*=/);
  assert.match(catalog, /MobileUiLifecycle\.onRender\("home", renderMobileToday\)/);
  assert.match(catalog, /MobileUiLifecycle\.onViewChange/);
  assert.doesNotMatch(catalog, /mobileFoundationShowView|mobileFoundationRenderHome/);
  assert.match(beikostMore, /MobileUiLifecycle\.onRender\("foods"/);
  assert.match(beikostMore, /MobileUiLifecycle\.onViewChange/);
  assert.doesNotMatch(beikostMore, /new MutationObserver|baseRenderFoods|renderFoods\s*=|baseShowView|showView\s*=/);
});
