import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");



async function waitForApp(page) {
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState && !!document.getElementById("appFocusModeSetting"),
  );
}

async function waitForPersistedFocus(page, expectedMode) {
  await page.waitForFunction(async (mode) => {
    if (typeof idbGet !== "function" || typeof STATE_RECORD === "undefined") return false;
    const persisted = await idbGet(STATE_RECORD).catch(() => null);
    return persisted?.settings?.appFocusMode === mode;
  }, expectedMode);
}

async function navLabels(page) {
  return page.locator("nav button[data-view]").evaluateAll((buttons) =>
    buttons.map((button) => button.textContent.trim()),
  );
}

async function openSettings(page) {
  await page.locator('nav button[data-view="more"]').click();
  const settingsRow = page.locator('#moreNavScreen .more-nav-row[data-more-title="Einstellungen"]');
  if (await settingsRow.count()) {
    await settingsRow.waitFor({ state: "visible" });
    await settingsRow.click();
  } else {
    await page.locator(".settings-card > details").evaluate((details) => { details.open = true; });
  }
  await page.locator(".settings-card .settings-group").last().evaluate((details) => { details.open = true; });
  await page.locator("#appFocusModeSetting").scrollIntoViewIfNeeded();
}

async function assertCompactFocusOptions(page) {
  const cards = page.locator("#appFocusModeSetting .app-focus-option");
  assert.equal(await cards.count(), 2, "App-Schwerpunkt muss genau zwei Auswahlkarten zeigen");
  const metrics = await cards.evaluateAll((elements) => elements.map((element) => ({
    height: element.getBoundingClientRect().height,
    hasToggleState: !!element.querySelector(".toggle-state"),
    radioOpacity: getComputedStyle(element.querySelector('input[type="radio"]')).opacity,
  })));
  assert.ok(metrics.every((item) => item.height < 90), "App-Schwerpunkt-Karten müssen kompakt bleiben");
  assert.ok(metrics.every((item) => !item.hasToggleState), "App-Schwerpunkt darf keine alten Toggle-Reste enthalten");
  assert.ok(metrics.every((item) => item.radioOpacity === "0"), "Native Radio-Controls dürfen nicht sichtbar sein");
}

async function plannerMealSnapshot(page, key) {
  return page.evaluate((plannerKey) => {
    const state = window.__beikostTest.getState();
    return {
      manualMeal: state.manualMeals?.[plannerKey] || null,
      planLock: state.planLocks?.[plannerKey] || null,
      override: state.overrides?.[plannerKey] || null,
    };
  }, key);
}

const defaultNav = ["Heute", "Plan", "Prep", "Beikost", "Mehr"];
const everydayNav = ["Heute", "Rezepte", "Plan", "Prep", "Mehr"];
const focusScriptMatch = fs.readFileSync(path.join(root, "index.html"), "utf8")
  .match(/<script src="(js\/app-focus-mode\.js\?v=[^"]+)"><\/script>/);
assert.ok(focusScriptMatch, "index.html muss das Fokusmodus-Runtime-Skript versioniert laden");
assert.equal(
  fs.readFileSync(path.join(root, "sw.js"), "utf8").includes(JSON.stringify(`./${focusScriptMatch[1]}`)),
  true,
  "der Fokusmodus muss unter exakt derselben Runtime-URL für den ersten Offline-/PWA-Start precached sein",
);

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
  await waitForApp(page);

  const migratedDefault = await page.evaluate(() => {
    const legacy = window.__beikostTest.getState();
    delete legacy.settings.appFocusMode;
    return window.__beikostTest.setState(legacy).settings.appFocusMode;
  });
  assert.equal(migratedDefault, "planning-documentation", "bestehende States müssen den bisherigen Fokus migrationssicher als Default erhalten");
  assert.deepEqual(await navLabels(page), defaultNav, "Default-Navigation muss unverändert bleiben");

  const plannerKey = await page.evaluate(() => {
    const bridge = window.__beikostTest;
    const next = bridge.getState();
    const focusId = bridge.foodId("Banane");
    const componentId = bridge.foodId("Ei");
    const date = bridge.addDays(bridge.today(), 20);
    const key = `${date}|dinner`;
    const meal = {
      date,
      meal: "dinner",
      focusId,
      foodIds: [focusId, componentId],
      baseFoodIds: [focusId, componentId],
      sampleFoodIds: [],
      foodRoles: { [focusId]: "base", [componentId]: "base" },
      recipeName: "Bananen-Ei-Pancakes",
      note: "app-focus-regression",
      manualAdded: true,
    };
    next.manualMeals[key] = { ...meal };
    next.planLocks[key] = { ...meal, mode: "manual", locked: true };
    next.overrides[key] = focusId;
    bridge.setState(next);
    return key;
  });
  const plannerBefore = await plannerMealSnapshot(page, plannerKey);
  assert.equal(plannerBefore.manualMeal?.note, "app-focus-regression", "Planner-Testdaten müssen vor dem Fokuswechsel gesetzt sein");

  await openSettings(page);
  await assertCompactFocusOptions(page);
  await page.locator('input[name="appFocusMode"][value="everyday-recipes"]').check();
  await page.locator("#saveSettings").click();
  await page.waitForFunction(() => window.__beikostTest.getState().settings.appFocusMode === "everyday-recipes");

  assert.deepEqual(await navLabels(page), everydayNav, "Alltag-&-Rezepte-Navigation muss exakt in der freigegebenen Reihenfolge erscheinen");
  assert.deepEqual(await plannerMealSnapshot(page, plannerKey), plannerBefore, "Fokuswechsel darf Planner-Mahlzeitendaten nicht verändern");

  await waitForPersistedFocus(page, "everyday-recipes");
  await page.reload({ waitUntil: "load" });
  await waitForApp(page);
  await page.waitForFunction(() => window.__beikostTest.getState().settings.appFocusMode === "everyday-recipes");
  assert.deepEqual(await navLabels(page), everydayNav, "Alltag-&-Rezepte-Modus muss einen Reload überstehen");
  assert.deepEqual(await plannerMealSnapshot(page, plannerKey), plannerBefore, "Reload im Fokusmodus darf Planner-Mahlzeitendaten nicht verändern");

  await page.locator('nav button[data-view="foods"]').click();
  assert.equal(await page.locator("#recipesSection").isVisible(), true, "Bottom-Navigation Rezepte muss den bestehenden Rezeptkatalog öffnen");
  assert.equal(await page.locator("#foodsCatalogSection").isHidden(), true, "Rezept-Einstieg darf keinen zweiten Katalog erzeugen");

  await page.locator('#catalogSwitch button[data-catalog-mode="foods"]').click();
  assert.equal(await page.locator("#foodsCatalogSection").isVisible(), true, "Lebensmittel müssen im Alltag-&-Rezepte-Modus weiterhin erreichbar bleiben");
  assert.equal(await page.locator("#recipesSection").isHidden(), true, "bestehender Katalogumschalter muss weiterhin zwischen beiden Modi wechseln");

  await page.locator('nav button[data-view="plan"]').click();
  await page.locator('nav button[data-view="foods"]').click();
  assert.equal(await page.locator("#recipesSection").isVisible(), true, "erneuter Bottom-Tab-Einstieg muss wieder direkt Rezepte öffnen");

  await openSettings(page);
  await page.locator('input[name="appFocusMode"][value="planning-documentation"]').check();
  await page.locator("#saveSettings").click();
  await page.waitForFunction(() => window.__beikostTest.getState().settings.appFocusMode === "planning-documentation");

  assert.deepEqual(await navLabels(page), defaultNav, "Zurückschalten muss die bisherige Bottom-Navigation wiederherstellen");
  assert.deepEqual(await plannerMealSnapshot(page, plannerKey), plannerBefore, "Zurückschalten darf Planner-Mahlzeitendaten nicht verändern");

  await page.locator('nav button[data-view="foods"]').click();
  assert.equal(await page.locator("#foodsCatalogSection").isVisible(), true, "Planen-&-Dokumentieren muss den bisherigen Lebensmittel-Standardmodus wiederherstellen");
  assert.equal(await page.locator("#recipesSection").isHidden(), true, "Planen-&-Dokumentieren darf nicht im Rezeptmodus hängen bleiben");

  await waitForPersistedFocus(page, "planning-documentation");
  await page.reload({ waitUntil: "load" });
  await waitForApp(page);
  assert.equal(
    await page.evaluate(() => window.__beikostTest.getState().settings.appFocusMode),
    "planning-documentation",
    "zurückgespeicherter Standardfokus muss ebenfalls Reload überstehen",
  );
  assert.deepEqual(await navLabels(page), defaultNav, "Default-Navigation muss nach erneutem Reload unverändert bleiben");
  assert.deepEqual(await plannerMealSnapshot(page, plannerKey), plannerBefore, "Planner-Mahlzeitendaten müssen über beide Moduswechsel erhalten bleiben");

} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
