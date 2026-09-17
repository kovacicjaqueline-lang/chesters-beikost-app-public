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
  ".webp": "image/webp",
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
    !!window.__beikostTest?.getState && !!document.getElementById("appFocusModeSetting"),
  );
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
    const focusId = bridge.foodId("Karotte");
    const date = bridge.addDays(bridge.today(), 20);
    const key = `${date}|dinner`;
    const meal = {
      date,
      meal: "dinner",
      focusId,
      foodIds: [focusId],
      baseFoodIds: [focusId],
      sampleFoodIds: [],
      foodRoles: { [focusId]: "base" },
      recipeName: "",
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
  await page.locator('input[name="appFocusMode"][value="everyday-recipes"]').check();
  await page.locator("#saveSettings").click();
  await page.waitForFunction(() => window.__beikostTest.getState().settings.appFocusMode === "everyday-recipes");

  assert.deepEqual(await navLabels(page), everydayNav, "Alltag-&-Rezepte-Navigation muss exakt in der freigegebenen Reihenfolge erscheinen");
  assert.deepEqual(await plannerMealSnapshot(page, plannerKey), plannerBefore, "Fokuswechsel darf Planner-Mahlzeitendaten nicht verändern");

  await page.waitForTimeout(150);
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

  await page.waitForTimeout(150);
  await page.reload({ waitUntil: "load" });
  await waitForApp(page);
  assert.equal(
    await page.evaluate(() => window.__beikostTest.getState().settings.appFocusMode),
    "planning-documentation",
    "zurückgespeicherter Standardfokus muss ebenfalls Reload überstehen",
  );
  assert.deepEqual(await navLabels(page), defaultNav, "Default-Navigation muss nach erneutem Reload unverändert bleiben");
  assert.deepEqual(await plannerMealSnapshot(page, plannerKey), plannerBefore, "Planner-Mahlzeitendaten müssen über beide Moduswechsel erhalten bleiben");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
