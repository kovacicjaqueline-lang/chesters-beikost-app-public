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

async function openSettings(page) {
  await page.locator('nav button[data-view="more"]').click();
  await page.locator(".settings-card > details").evaluate((details) => { details.open = true; });
}

const expectedTextureLabels = [
  "1 – glatt / fein",
  "2 – dick / fein zerdrückt",
  "3 – mit kleinen weichen Stückchen",
  "4 – weiche Familienkost",
];

const widths = [320, 375, 390];
const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();

try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
    await waitForApp(page);

    assert.equal(await page.locator("#more #recipesSection").count(), 0, `Rezepte dürfen bei ${width}px nicht mehr unter Mehr liegen`);
    assert.equal(await page.locator("#foods #recipesSection").count(), 1, `Rezepte müssen bei ${width}px im gemeinsamen Lebensmittel-Tab liegen`);

    const bottomNav = await page.evaluate(() => {
      const nav = document.querySelector("nav").getBoundingClientRect();
      const buttons = [...document.querySelectorAll("nav button")].map((button) => button.getBoundingClientRect());
      const firstButtonStyle = getComputedStyle(document.querySelector("nav button"));
      const firstIcon = document.querySelector("nav button svg").getBoundingClientRect();
      return {
        height: nav.height,
        minButtonHeight: Math.min(...buttons.map((button) => button.height)),
        fontSize: Number.parseFloat(firstButtonStyle.fontSize),
        iconHeight: firstIcon.height,
      };
    });
    assert.ok(bottomNav.height <= 55, `Bottom-Navigation soll bei ${width}px kompakt bleiben`);
    assert.ok(bottomNav.minButtonHeight >= 44, `Bottom-Navigation muss bei ${width}px mindestens 44px hohe Touch-Ziele behalten`);
    assert.ok(bottomNav.fontSize >= 10, `Bottom-Navigation darf bei ${width}px nicht schlechter lesbar werden`);
    assert.ok(bottomNav.iconHeight >= 22, `Bottom-Navigation darf bei ${width}px keine kleineren Icons bekommen`);

    const textureCoach = page.locator("#textureCoachCard");
    await textureCoach.locator("details").evaluate((details) => { details.open = true; });
    const textureCoachText = await textureCoach.innerText();
    assert.match(textureCoachText, /Nächster kleiner Schritt:/, `Texture Coach muss bei ${width}px den nächsten kleinen Schritt zeigen`);
    assert.match(textureCoachText, /Geeignetes weiches Fingerfood kann unabhängig von dieser Konsistenzstufe parallel angeboten werden/, `Texture Coach muss bei ${width}px Fingerfood als parallelen Weg erklären`);
    assert.doesNotMatch(textureCoachText, /positive Texturerfahrung/, `Texture Coach darf bei ${width}px keinen FOOD-basierten Texturerfolgszähler zeigen`);
    assert.doesNotMatch(textureCoachText, /Test möglich/, `Texture Coach darf bei ${width}px keine unbegründete Bereitschaftsampel zeigen`);

    await openSettings(page);
    assert.deepEqual(
      await page.locator("#textureStage option").allTextContents(),
      expectedTextureLabels,
      `Konsistenzbezeichnungen müssen beim ersten sichtbaren Settings-Render bei ${width}px exakt dem freigegebenen Text entsprechen`,
    );
    assert.equal(await page.locator("#feedingApproach").count(), 1, `Beikostform muss bei ${width}px vorhanden sein`);
    assert.equal(await page.locator("#smallSoftPiecesCapability").count(), 1, `Small-Soft-Fähigkeit muss bei ${width}px vorhanden sein`);
    assert.equal(await page.locator("#structuredChewCapability").count(), 1, `Structured-Chew-Fähigkeit muss bei ${width}px vorhanden sein`);

    const actionbar = page.locator("#settingsActionbar");
    await actionbar.scrollIntoViewIfNeeded();

    assert.equal(
      await actionbar.evaluate((element) => getComputedStyle(element).position),
      "static",
      `Einstellungen-Aktionsleiste darf bei ${width}px keinen Sticky-Leerraum erzeugen`,
    );

    const layout = await page.evaluate(() => {
      const card = document.querySelector(".settings-card").getBoundingClientRect();
      const actions = document.getElementById("settingsActionbar").getBoundingClientRect();
      const discard = document.getElementById("discardSettings").getBoundingClientRect();
      const save = document.getElementById("saveSettings").getBoundingClientRect();
      const nav = document.querySelector("nav").getBoundingClientRect();
      return {
        gapBelowActions: card.bottom - actions.bottom,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        discardBottom: discard.bottom,
        saveBottom: save.bottom,
        navTop: nav.top,
      };
    });

    assert.ok(layout.gapBelowActions >= 0, `Aktionsleiste muss bei ${width}px innerhalb der Einstellungen-Karte liegen`);
    assert.ok(layout.gapBelowActions <= 28, `Unter den Einstellungsbuttons darf bei ${width}px kein großer Leerraum bleiben`);
    assert.ok(layout.pageOverflow <= 1, `Bei ${width}px darf kein horizontaler Seitenüberlauf entstehen`);
    assert.ok(layout.discardBottom <= layout.navTop + 1, `Verwerfen-Button darf bei ${width}px nicht von der Bottom-Navigation überlagert werden`);
    assert.ok(layout.saveBottom <= layout.navTop + 1, `Speichern-Button darf bei ${width}px nicht von der Bottom-Navigation überlagert werden`);

    await page.locator("#discardSettings").click();
    await page.locator("#saveSettings").click();

    await context.close();
  }

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await waitForApp(page);

  await openSettings(page);
  await page.locator("#smallSoftPiecesCapability").check();
  await page.locator("#structuredChewCapability").check();
  await page.locator("#saveSettings").click();

  assert.deepEqual(
    await page.evaluate(() => window.__beikostTest.getState().settings.handlingCapabilities),
    { smallSoftPieces: true, structuredChew: true },
    "beide beobachteten Fähigkeiten müssen separat im State gespeichert werden",
  );

  await page.reload({ waitUntil: "load" });
  await waitForApp(page);
  await openSettings(page);
  assert.equal(await page.locator("#smallSoftPiecesCapability").isChecked(), true, "Small-Soft-Fähigkeit muss Reload überleben");
  assert.equal(await page.locator("#structuredChewCapability").isChecked(), true, "Structured-Chew-Fähigkeit muss Reload überleben");

  await page.locator('nav button[data-view="foods"]').click();
  await page.locator('#foodFilters button[data-filter="allergen"]').click();
  await page.locator("#foodSearch").fill("Ei");
  await page.locator('nav button[data-view="plan"]').click();
  await page.locator('nav button[data-view="foods"]').click();
  assert.equal(await page.locator("#foodSearch").inputValue(), "Ei", "Lebensmittelsuche muss nach Tabwechsel erhalten bleiben");
  assert.ok(await page.locator('#foodFilters button[data-filter="allergen"]').evaluate((button) => button.classList.contains("active")), "Lebensmittelfilter muss nach Tabwechsel erhalten bleiben");

  await page.locator('#catalogSwitch button[data-catalog-mode="recipes"]').click();
  assert.equal(await page.locator("#foodsCatalogSection").isHidden(), true, "Lebensmittelliste muss im Rezeptmodus ausgeblendet sein");
  assert.equal(await page.locator("#recipesSection").isVisible(), true, "Rezeptansicht muss im gemeinsamen Tab sichtbar sein");
  await page.locator('#recipeFilter button[data-recipe-filter="all"]').click();
  await page.locator("#recipeSearch").fill("Banane");
  await page.locator('nav button[data-view="plan"]').click();
  await page.locator('nav button[data-view="foods"]').click();
  assert.equal(await page.locator("#foodsCatalogSection").isVisible(), true, "Bottom-Tab Lebensmittel muss wieder die Lebensmittelansicht öffnen");
  await page.locator('#catalogSwitch button[data-catalog-mode="recipes"]').click();
  assert.equal(await page.locator("#recipeSearch").inputValue(), "Banane", "Rezeptsuche muss nach Tabwechsel erhalten bleiben");
  assert.ok(await page.locator('#recipeFilter button[data-recipe-filter="all"]').evaluate((button) => button.classList.contains("active")), "Rezeptfilter muss nach Tabwechsel erhalten bleiben");
  assert.equal(await page.locator("#recipesDetails").evaluate((details) => details.open), true, "Rezeptbereich muss im Rezeptmodus geöffnet bleiben");

  await page.locator('nav button[data-view="more"]').click();
  await page.locator("#statisticsDetails").evaluate((details) => { details.open = true; });
  await page.locator('nav button[data-view="plan"]').click();
  await page.locator('nav button[data-view="more"]').click();
  assert.equal(await page.locator("#statisticsDetails").evaluate((details) => details.open), true, "Statistik-Accordion muss geöffnet bleiben");
  assert.equal(await page.locator("#more #recipesSection").count(), 0, "Unter Mehr darf keine redundante Rezeptansicht zurückbleiben");

  await page.locator('nav button[data-view="home"]').click();
  await page.locator("#openRecipes").click();
  assert.ok(await page.locator("#foods").evaluate((view) => view.classList.contains("active")), "Heute-Einstieg muss direkt den gemeinsamen Katalog öffnen");
  assert.equal(await page.locator("#recipesSection").isVisible(), true, "Heute-Einstieg muss direkt die Rezeptansicht öffnen");

  await page.locator('nav button[data-view="prep"]').click();
  await page.locator("#prepOpenRecipes").click();
  assert.ok(await page.locator("#foods").evaluate((view) => view.classList.contains("active")), "Prep-Einstieg muss direkt den gemeinsamen Katalog öffnen");
  assert.equal(await page.locator("#recipesSection").isVisible(), true, "Prep-Einstieg muss direkt die Rezeptansicht öffnen");

  await page.locator('nav button[data-view="prep"]').click();
  await page.locator("#prepOpenFreezerRecipes").click();
  assert.equal(await page.locator("#recipesSection").isVisible(), true, "Gefrierschrank-Einstieg muss direkt die Rezeptansicht öffnen");
  assert.ok(await page.locator('#recipeFilter button[data-recipe-filter="freezer"]').evaluate((button) => button.classList.contains("active")), "Gefrierschrank-Einstieg muss direkt den Einfrierbar-Filter öffnen");

  await page.reload({ waitUntil: "load" });
  await waitForApp(page);
  await page.locator('nav button[data-view="foods"]').click();
  assert.equal(await page.locator("#foodSearch").inputValue(), "", "Lebensmittelsuche darf Reload nicht überleben");
  assert.ok(await page.locator('#foodFilters button[data-filter="open"]').evaluate((button) => button.classList.contains("active")), "Lebensmittelfilter muss nach Reload wieder auf Offen stehen");
  await page.locator('#catalogSwitch button[data-catalog-mode="recipes"]').click();
  assert.equal(await page.locator("#recipeSearch").inputValue(), "", "Rezeptsuche darf Reload nicht überleben");
  assert.ok(await page.locator('#recipeFilter button[data-recipe-filter="available"]').evaluate((button) => button.classList.contains("active")), "Rezeptfilter muss nach Reload wieder auf Jetzt passend stehen");
  assert.equal(await page.locator("#smallSoftPiecesCapability").isChecked(), true, "gespeicherte Small-Soft-Fähigkeit darf durch UI-Tab-State-Reset nicht verloren gehen");
  assert.equal(await page.locator("#structuredChewCapability").isChecked(), true, "gespeicherte Structured-Chew-Fähigkeit darf durch UI-Tab-State-Reset nicht verloren gehen");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
