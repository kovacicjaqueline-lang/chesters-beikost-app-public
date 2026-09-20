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
  await page.waitForFunction(() => !!window.__beikostTest?.getState);
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
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await waitForApp(page);

  await page.locator('nav button[data-view="foods"]').click();

  assert.equal(
    await page.locator("#foodFilters > .food-filter-toolbar > .food-primary-select .mobile-filter-primary > button").count(),
    3,
    "Lebensmittel sollen nur drei häufige Primärfilter direkt zeigen",
  );
  assert.equal(
    await page.locator("#foodFilters > .food-filter-toolbar > .food-secondary-select .mobile-filter-secondary-list > button").count(),
    4,
    "weitere Lebensmittelfilter sollen in der sekundären Filteroberfläche liegen",
  );
  assert.equal(
    await page.locator("#foodFilters > .food-filter-toolbar > .food-secondary-select").evaluate((details) => details.open),
    false,
    "sekundäre Lebensmittelfilter sollen standardmäßig geschlossen sein",
  );
  assert.equal(await page.locator("#foodFilters > .food-filter-toolbar > .food-primary-select").count(), 1, "Primärfilter sollen als Auswahlfeld kompakt zusammengefasst sein");

  const firstFoodRow = page.locator("#foodList .mobile-food-row").first();
  await firstFoodRow.waitFor({ state: "visible" });
  const foodRowPresentation = await firstFoodRow.evaluate((row) => ({
    radius: getComputedStyle(row).borderRadius,
    shadow: getComputedStyle(row).boxShadow,
    chevron: row.querySelector(".food-row-chevron")?.textContent?.trim(),
  }));
  assert.equal(foodRowPresentation.radius, "0px", "Lebensmittel sollen als Rows statt als große Einzelkarten erscheinen");
  assert.equal(foodRowPresentation.shadow, "none", "Lebensmittel-Rows sollen keinen Card-Schatten tragen");
  assert.equal(foodRowPresentation.chevron, "›", "Lebensmittel-Rows brauchen eine eindeutige Detailnavigation");

  await firstFoodRow.locator(".food-row-chevron").click();
  const foodDetailModal = page.locator("#genericModal.mobile-food-detail-screen");
  await foodDetailModal.waitFor({ state: "visible" });
  const detailLayout = await foodDetailModal.locator(".sheet").evaluate((sheet) => ({
    height: sheet.getBoundingClientRect().height,
    radius: getComputedStyle(sheet).borderRadius,
  }));
  assert.ok(detailLayout.height >= 800, "komplexe Lebensmittelinfos sollen als Vollbild-Detail-Screen erscheinen");
  assert.equal(detailLayout.radius, "0px", "Lebensmittel-Details sollen kein Bottom-Sheet-Radiusmuster verwenden");
  await page.locator("#closeGeneric").click();

  await page.locator('#catalogSwitch button[data-catalog-mode="recipes"]').click();
  assert.equal(await page.locator('[data-recipe-filter="almost"]').evaluate((button) => button.classList.contains("active")), true, "Fast passend soll im Rezeptkatalog standardmäßig aktiv sein");
  assert.equal(await page.locator(".recipe-filter-toolbar").count(), 1, "Rezeptfilter sollen in einer kompakten Toolbar liegen");
  await page.locator(".recipe-meal-select > summary").click();
  assert.equal(await page.locator("#recipeMealFilter").isVisible(), true, "Mahlzeitenfilter müssen im Auswahlfeld erreichbar bleiben");
  assert.equal(await page.locator('[data-recipe-filter="pantry"]').count(), 1, "Mit Vorrat ist als schneller Rezeptfilter erreichbar");
  assert.equal(await page.locator('[data-recipe-filter="philippines"]').count(), 0, "Philippinen gehört nicht mehr in die normale Rezeptfilterung");

  await page.locator("#recipeMoreFilters").click();
  assert.equal(await page.locator("#recipeFilterSheet").isVisible(), true, "Weitere Rezeptfilter sollen als Bottom Sheet öffnen");
  await page.locator('[data-recipe-extra-filter="freezer"]').click();
  assert.equal(await page.locator("#recipeMoreFilters").textContent(), "Filter (1)", "Aktive Zusatzfilter sollen nur als Anzahl auf der Hauptansicht erscheinen");
  await page.locator("#recipeFilterApply").click();
  assert.equal(await page.locator("#recipeFilterSheet").isHidden(), true, "Rezepte anzeigen soll das Filter-Sheet schließen");

  await page.locator(".recipe-match-select > summary").click();
  await page.locator('[data-recipe-filter="all"]').click();
  const firstRecipe = page.locator("#recipeList .recipe-card-v2").first();
  await firstRecipe.waitFor({ state: "visible" });
  const recipePresentation = await firstRecipe.evaluate((card) => {
    const icon = card.querySelector(".recipe-heading-with-icon .recipe-icon, .recipe-heading-with-icon img, .recipe-heading-with-icon svg");
    const box = icon?.getBoundingClientRect();
    const type = card.querySelector(".recipe-type-text");
    const badge = card.querySelector(".recipe-summary-end .pill");
    return {
      borderRadius: getComputedStyle(card).borderRadius,
      iconWidth: box?.width || 0,
      typeVisible: !!type && getComputedStyle(type).display !== "none",
      badgeVisible: !!badge && getComputedStyle(badge).display !== "none",
    };
  });
  assert.equal(recipePresentation.borderRadius, "0px", "Rezeptübersicht soll als ruhige Liste statt Kartenstapel erscheinen");
  assert.ok(recipePresentation.iconWidth <= 60, "Rezeptbilder sollen kompakt bleiben");
  assert.equal(recipePresentation.typeVisible, false, "Rezeptart gehört nicht auf die schlichte Übersichtskarte");
  assert.equal(recipePresentation.badgeVisible, false, "Einfrierbar- und Status-Badges gehören in die Details");

  await page.locator('nav button[data-view="more"]').click();
  await page.waitForFunction(() =>
    document.querySelectorAll("#moreNavScreen .more-nav-group > h2").length === 3 &&
    !document.getElementById("more")?.hasAttribute("aria-busy"),
  );
  const groupLabels = await page.locator("#moreNavScreen .more-nav-group > h2").allTextContents();
  assert.deepEqual(groupLabels, ["Verlauf", "Beikost", "App"], "Mehr soll als gruppierte Navigationsliste aufgebaut sein");
  assert.equal(await page.locator("#moreNavScreen .more-nav-row").count(), 8, "Mehr soll die verbleibenden Ziele als kompakte Rows anbieten");
  assert.equal(await page.locator("#morePanelScreen").isHidden(), true, "Mehr soll zunächst die Navigationsliste zeigen");
  assert.equal(await page.locator("#productAllergenCard").count(), 0, "Konkrete Produkte dürfen im Mehr-Menü nicht mehr vorhanden sein");

  const rowHeight = await page.locator("#moreNavScreen .more-nav-row").first().evaluate((row) => row.getBoundingClientRect().height);
  assert.ok(rowHeight >= 44, "Mehr-Navigationsrows müssen mobile Touch-Ziele behalten");

  await page.locator('#moreNavScreen .more-nav-row[data-more-title="Protokoll"]').click();
  assert.equal(await page.locator("#morePanelScreen").isVisible(), true, "Protokoll soll als eigene Mehr-Unterseite öffnen");
  assert.equal(await page.locator("#logSection").isVisible(), true, "bestehendes Protokoll muss auf der Unterseite weiterverwendet werden");
  assert.equal(await page.locator("#appBarTitle").textContent(), "Protokoll", "App-Bar soll das geöffnete Mehr-Ziel benennen");

  await page.locator("#moreBack").click();
  assert.equal(await page.locator("#moreNavScreen").isVisible(), true, "Zurück soll wieder in die gruppierte Mehr-Navigation führen");

  await page.locator('#moreNavScreen .more-nav-row[data-more-title="Konsistenz"]').click();
  assert.equal(await page.locator("#settingsSection").isVisible(), true, "Konsistenz soll die bestehende Einstellungs-Unterseite nutzen");
  const settingsGroups = await page.locator("#settingsSection .settings-group").evaluateAll((groups) => groups.map((details) => details.open));
  assert.deepEqual(settingsGroups, [false, false, false, true, false], "Konsistenz soll direkt den relevanten Einstellungsbereich fokussieren");

  const overflow = await page.locator("main").evaluate((main) => main.scrollWidth - main.clientWidth);
  assert.ok(overflow <= 1, "Beikost und Mehr dürfen bei 390px keinen horizontalen App-Overflow erzeugen");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
