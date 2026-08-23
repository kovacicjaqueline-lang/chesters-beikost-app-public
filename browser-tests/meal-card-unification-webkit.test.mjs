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
    !!window.__beikostTest &&
    !!window.__mealCardUnification &&
    !!window.__plannerRolloverReviewFixes &&
    !!window.__plannerRandomSwap &&
    window.__plannerPoliciesReady === true &&
    window.__beikostTest.getState()?.backupMeta?.storagePersisted !== "unknown",
  );
}

async function seedTodayMeal(page) {
  return page.evaluate(() => {
    window.__beikostTest.reset();
    const state = window.__beikostTest.getState();
    const today = window.__beikostTest.today();
    state.settings.planFrom = today;
    state.settings.preferInventoryInPlan = true;

    const potato = state.foods.find((food) => food.id === "kartoffel");
    if (potato) potato.manualStatus = "Verträgliche Basis";

    state.inventory = [
      {
        id: "ui-stock-kartoffel",
        kind: "food",
        foodId: "kartoffel",
        portions: 1,
        size: "35 g",
        frozenDate: today,
        note: "",
      },
    ];

    state.planLocks[`${today}|lunch`] = {
      date: today,
      meal: "lunch",
      focusId: "kartoffel",
      foodIds: ["kartoffel"],
      baseFoodIds: ["kartoffel"],
      sampleFoodIds: [],
      optionalAddons: [],
      inventoryFoodIds: [],
      recipeName: "",
      recipeInventoryId: "",
      type: "bekannt kombinieren",
      note: "",
      manualAdded: false,
      active: true,
      mode: "auto",
      planId: "ui-unified-today",
      createdAt: new Date().toISOString(),
    };

    window.__beikostTest.setState(state);
    window.renderAll();
    return today;
  });
}

async function mealActionLabels(meal) {
  return meal
    .locator(".randomizeMeal, .replaceMeal, .moveMeal, .logMeal, .removePlannedMeal")
    .evaluateAll((buttons) => buttons.map((button) => button.textContent.trim()));
}

async function mealVisualStyle(meal) {
  return meal.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      borderStyle: style.borderStyle,
      borderWidth: style.borderWidth,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
    };
  });
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
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const today = await seedTodayMeal(page);

  assert.equal(await page.locator("details.plan-secondary-actions").count(), 0, "Eine einzelne weitere Planaktion braucht kein Accordion");
  assert.equal(await page.locator(".plan-secondary-actions-direct #planRebuildAll").count(), 1, "Vollständiges Neuplanen bleibt direkt erreichbar");

  const homeMeal = page.locator("#todayCard .mealbox").filter({
    has: page.locator(`.replaceMeal[data-date="${today}"][data-meal="lunch"]`),
  });
  await homeMeal.waitFor();

  assert.equal(await homeMeal.locator(".homeLog").count(), 0, "Heute verwendet keinen separaten Home-Kartenpfad mehr");
  assert.equal(await homeMeal.locator(".logMeal").count(), 1, "Heute verwendet denselben Log-Button wie der Plan");
  await homeMeal.locator(".meal-lock.locked").waitFor();
  assert.equal(await homeMeal.locator(".lock-label").count(), 0, "Auto-Lock zeigt keine redundante Fest-eingeplant-Zeile");
  assert.doesNotMatch(await homeMeal.innerText(), /Fest eingeplant/);
  assert.equal(await homeMeal.locator(".stock-chip").innerText(), "❄️ Vorrat");
  assert.equal(await homeMeal.locator(".stock-chip").getAttribute("aria-label"), "Aus Vorrat: Kartoffel");
  assert.equal(await homeMeal.locator(".stock-chip").getAttribute("title"), "Aus Vorrat: Kartoffel");

  const manualLabelHtml = await page.evaluate(() =>
    window.__mealCardUnification.stripVisibleLockLabel('<div class="tiny lock-label">Manuell geschützt</div>'),
  );
  assert.match(manualLabelHtml, /Manuell geschützt/, "manueller Schutz wird nicht zusammen mit dem Auto-Label entfernt");

  const homeActions = await mealActionLabels(homeMeal);
  assert.ok(homeActions.includes("Mahlzeit bearbeiten"));
  assert.ok(homeActions.includes("Auf morgen"));
  assert.ok(homeActions.includes("Essen eintragen"));
  assert.ok(homeActions.includes("Mahlzeit löschen"));
  assert.ok(homeActions.some((label) => label.includes("Tauschen")));
  const homeStyle = await mealVisualStyle(homeMeal);

  await homeMeal.locator(".replaceMeal").click();
  await page.locator("#genericModal.open").waitFor();
  await page.locator("#closeGeneric").click();

  await page.locator('nav button[data-view="plan"]').click();

  assert.equal(await page.locator("#blockPlan details.day-details").count(), 0, "Mahlzeitenkarten-Vereinheitlichung verändert nicht die Wochen-Tageskarten");
  assert.equal(await page.locator("#blockPlan .day-card").first().evaluate((node) => node.tagName), "DIV");

  const planMeal = page.locator("#blockPlan .mealbox").filter({
    has: page.locator(`.replaceMeal[data-date="${today}"][data-meal="lunch"]`),
  });
  await planMeal.waitFor();
  await planMeal.locator(".meal-lock.locked").waitFor();
  assert.equal(await planMeal.locator(".lock-label").count(), 0);
  assert.equal(await planMeal.locator(".stock-chip").innerText(), "❄️ Vorrat");
  assert.equal(await planMeal.locator(".stock-chip").getAttribute("aria-label"), "Aus Vorrat: Kartoffel");

  assert.deepEqual(await mealActionLabels(planMeal), homeActions, "Heute und Plan bieten dieselben Kartenaktionen an");
  assert.deepEqual(await mealVisualStyle(planMeal), homeStyle, "Heute und Plan verwenden dieselbe Kartenoptik");

  // Ein regulärer Planner-Slot wird bewusst entfernt und darf beim nächsten Render nicht neu entstehen.
  await planMeal.locator(".removePlannedMeal").click();
  await page.locator("#genericModal.open").waitFor();
  assert.match(await page.locator("#genericBody").innerText(), /nur aus dem Plan entfernt/i);
  await page.locator("#confirmMealDelete").click();
  await page.waitForFunction((date) => {
    const state = window.__beikostTest.getState();
    return state.autoLockExcluded?.[`${date}|lunch`] === "meal-removed" && !state.planLocks?.[`${date}|lunch`];
  }, today);
  assert.equal(await page.locator(`#blockPlan .removePlannedMeal[data-date="${today}"][data-meal="lunch"]`).count(), 0, "Gelöschter Slot darf nicht sofort neu gerendert werden");
  const removedSlot = await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    const lunch = window.buildDays(date, 1, false)[0].meals.find((meal) => meal.meal === "lunch");
    return {
      marker: state.autoLockExcluded?.[`${date}|lunch`],
      active: lunch?.active,
      hasLock: !!state.planLocks?.[`${date}|lunch`],
    };
  }, today);
  assert.deepEqual(removedSlot, { marker: "meal-removed", active: false, hasLock: false });

  // Ein erledigter Ein-Lebensmittel-Eintrag zeigt das tatsächliche Essen nur einmal und ohne Detail-Accordion.
  await seedTodayMeal(page);
  await page.evaluate((date) => {
    const state = window.__beikostTest.getState();
    state.logs = [{
      id: "ui-completed-potato",
      date,
      meal: "lunch",
      entryType: "meal",
      plannedMealId: "ui-unified-today",
      focusId: "kartoffel",
      foodIds: ["kartoffel"],
      baseFoodIds: ["kartoffel"],
      sampleFoodIds: [],
      foodRoles: { kartoffel: "base" },
      foodOutcomes: { kartoffel: "eaten" },
      outcome: "eaten",
      textureKnown: true,
      textureStage: 3,
      amount: "20",
      createdAt: new Date().toISOString(),
    }];
    window.__beikostTest.setState(state);
    window.renderAll();
  }, today);

  await page.locator('nav button[data-view="home"]').click();
  const completedMeal = page.locator("#todayCard .mealbox.completed").filter({ hasText: "Mittag" }).first();
  await completedMeal.waitFor();
  assert.equal(await completedMeal.locator(".completed-title").innerText(), "Mittag · Kartoffel");
  assert.equal(await completedMeal.locator("details.completed-details").count(), 0, "Essen bearbeiten braucht kein eigenes Accordion");
  assert.doesNotMatch(await completedMeal.innerText(), /Tatsächlich enthalten/i);
  assert.equal(await completedMeal.locator(".completed-body-direct .editCompletedLog").count(), 1, "Essen bearbeiten bleibt direkt erreichbar");
  assert.equal(await completedMeal.locator(".log-outcome-item").count(), 1);
  assert.equal(await completedMeal.locator(".log-outcome-item b").count(), 0, "Ein bereits im Titel genanntes Einzel-FOOD wird nicht wiederholt");
  assert.match(await completedMeal.locator(".log-outcome-item").innerText(), /Gegessen/);
  assert.match(await completedMeal.locator(".log-entry-meta").innerText(), /Stufe 3 · mit kleinen weichen Stückchen/);

  const multiFoodResult = await page.evaluate(() => {
    const host = document.createElement("div");
    host.innerHTML = `<div class="mealbox completed"><div class="completed-title">Mittag · Kartoffel + Tomate</div><div class="log-outcome-grid"><div class="log-outcome-item"><b>Kartoffel</b><span>Gegessen</span></div><div class="log-outcome-item"><b>Tomate</b><span>Probiert</span></div></div><details class="completed-details"><summary>Details oder Essen bearbeiten</summary><div class="completed-body"><div class="small"><b>Tatsächlich enthalten:</b> Kartoffel + Tomate</div><button class="editCompletedLog">Essen bearbeiten</button></div></details></div>`;
    document.body.appendChild(host);
    window.__mealCardUnification.flattenCompletedDetails(host);
    const result = {
      ingredientNames: host.querySelectorAll(".log-outcome-item b").length,
      details: host.querySelectorAll("details.completed-details").length,
      actualContained: /Tatsächlich enthalten/i.test(host.innerText),
    };
    host.remove();
    return result;
  });
  assert.deepEqual(multiFoodResult, { ingredientNames: 2, details: 0, actualContained: false }, "Mehrere Lebensmittel behalten ihre aussagekräftigen Einzelzeilen");

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("meal-card-unification-webkit: ok");
