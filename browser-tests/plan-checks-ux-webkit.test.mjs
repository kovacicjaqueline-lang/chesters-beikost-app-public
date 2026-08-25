import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = process.env.BROWSER_TEST_ARTIFACT_DIR || path.join(root, "artifacts", "browser-tests", "plan-checks-ux-webkit");
fs.mkdirSync(artifactDir, { recursive: true });

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

async function showView(page, view) {
  await page.locator(`nav button[data-view="${view}"]`).click();
  await page.waitForFunction((id) => document.getElementById(id)?.classList.contains("active"), view);
}

async function seedAllergens(page, { targetIds, exposureCount = 2, autoLockCount = 2, projectedTargetId = "" }) {
  return page.evaluate(({ targetIds, exposureCount, autoLockCount, projectedTargetId }) => {
    const api = window.__beikostTest;
    api.reset();
    let current = api.getState();
    const on = api.today();
    current.settings.phaseSelected = "drei";
    current.settings.planFrom = on;
    current.logs = [];
    current.manualMeals = {};
    current.planLocks = {};
    current.overrides = {};
    current.autoLockExcluded = {};
    current.inactivePlanKept = {};

    for (const record of current.foods) {
      if (record.allergenGroup) {
        record.active = false;
        record.manualStatus = "auto";
      } else if (record.active && record.category !== "Fett" && record.category !== "Kraut/Gewürz") {
        record.manualStatus = "Verträgliche Basis";
      }
    }
    api.setState(current);

    const baseDays = api.buildDays(on, 7);
    current = api.getState();
    current.planLocks = {};
    current.manualMeals = {};
    current.overrides = {};
    current.autoLockExcluded = {};

    const planned = baseDays.flatMap((day) => (day.meals || [])
      .filter((meal) => meal.active && !meal.empty && meal.focusId)
      .map((meal) => ({ date: day.date, meal })));

    let index = 0;
    for (const entry of planned) {
      const mode = index < autoLockCount ? "auto" : "manual";
      const snapshot = mealSnapshot(entry.date, entry.meal.meal, entry.meal, mode);
      if (snapshot) {
        snapshot.mode = mode;
        current.planLocks[`${entry.date}|${entry.meal.meal}`] = snapshot;
        index += 1;
      }
    }

    const targets = targetIds.map((id) => current.foods.find((record) => record.id === id));
    if (targets.some((record) => !record)) throw new Error(`Target FOOD fehlt: ${targetIds.join(",")}`);
    for (const record of targets) {
      record.active = true;
      record.manualStatus = "auto";
    }

    current.logs = targetIds.flatMap((id, targetIndex) => Array.from({ length: exposureCount }, (_, exposureIndex) => {
      const date = api.addDays(on, -(12 - exposureIndex - targetIndex));
      return {
        id: `plan-check-${id}-${exposureIndex}`,
        date,
        meal: "lunch",
        entryType: "meal",
        focusId: id,
        foodIds: [id],
        baseFoodIds: [id],
        sampleFoodIds: [],
        outcome: "eaten",
        foodOutcomes: { [id]: "eaten" },
        createdAt: `${date}T12:00:00.000Z`,
      };
    }));

    if (projectedTargetId) {
      const target = current.foods.find((record) => record.id === projectedTargetId);
      const compatible = planned.find((entry) => (target.meals || []).includes(entry.meal.meal));
      if (!compatible) throw new Error(`Kein kompatibler Planplatz für ${projectedTargetId}`);
      const projected = {
        meal: compatible.meal.meal,
        active: true,
        focusId: target.id,
        foodIds: [target.id],
        baseFoodIds: [target.id],
        sampleFoodIds: [],
        foodRoles: { [target.id]: "base" },
        optionalAddons: [],
        inventoryFoodIds: [],
        recipeName: "",
        recipeInventoryId: "",
        milkMeal: "",
        type: "bekannt",
        note: "",
        manualAdded: false,
      };
      const snapshot = mealSnapshot(compatible.date, compatible.meal.meal, projected, "manual");
      snapshot.mode = "manual";
      current.planLocks[`${compatible.date}|${compatible.meal.meal}`] = snapshot;
    }

    api.setState(current);
    return { on };
  }, { targetIds, exposureCount, autoLockCount, projectedTargetId });
}

async function seedHardBlocker(page) {
  return page.evaluate(() => {
    const api = window.__beikostTest;
    api.reset();
    let current = api.getState();
    const on = api.today();
    current.settings.phaseSelected = "drei";
    current.settings.planFrom = on;
    current.logs = [];
    current.manualMeals = {};
    current.planLocks = {};
    current.overrides = {};
    current.autoLockExcluded = {};
    current.inactivePlanKept = {};
    for (const record of current.foods) {
      if (record.active && record.category !== "Fett" && record.category !== "Kraut/Gewürz") record.manualStatus = "Verträgliche Basis";
    }
    api.setState(current);
    const days = api.buildDays(on, 7);
    current = api.getState();
    current.planLocks = {};
    for (const day of days) {
      for (const meal of day.meals || []) {
        if (!meal.active || meal.empty || !meal.focusId) continue;
        const snapshot = mealSnapshot(day.date, meal.meal, meal, "manual");
        if (!snapshot) continue;
        snapshot.mode = "manual";
        current.planLocks[`${day.date}|${meal.meal}`] = snapshot;
      }
    }
    const milk = current.foods.find((record) => record.id === "naturjoghurt") || current.foods.find((record) => record.category === "Milchprodukt" && record.active);
    const meat = current.foods.find((record) => record.id === "rind") || current.foods.find((record) => record.category === "Fleisch" && record.active);
    if (!milk || !meat) throw new Error("Milk/Meat fixture FOOD fehlt");
    const invalid = {
      meal: "lunch",
      active: true,
      focusId: milk.id,
      foodIds: [milk.id, meat.id],
      baseFoodIds: [milk.id, meat.id],
      sampleFoodIds: [],
      foodRoles: { [milk.id]: "base", [meat.id]: "component" },
      optionalAddons: [],
      inventoryFoodIds: [],
      recipeName: "",
      recipeInventoryId: "",
      milkMeal: "full",
      type: "bekannt",
      note: "",
      manualAdded: false,
    };
    const snapshot = mealSnapshot(on, "lunch", invalid, "manual");
    snapshot.mode = "manual";
    current.planLocks[`${on}|lunch`] = snapshot;
    api.setState(current);
    return { on };
  });
}

async function seedRequiredAction(page) {
  return page.evaluate(() => {
    const api = window.__beikostTest;
    api.reset();
    let current = api.getState();
    const on = api.today();
    current.settings.phaseSelected = "drei";
    current.settings.planFrom = on;
    for (const record of current.foods) {
      if (record.active && record.category !== "Fett" && record.category !== "Kraut/Gewürz") record.manualStatus = "Verträgliche Basis";
    }
    api.setState(current);
    const days = api.buildDays(on, 7);
    const first = days.flatMap((day) => (day.meals || []).map((meal) => ({ date: day.date, meal })))
      .find((entry) => entry.meal.active && !entry.meal.empty && entry.meal.focusId);
    if (!first) throw new Error("Keine Planmahlzeit für required_action fixture");
    current = api.getState();
    current.planLocks = {};
    const snapshot = mealSnapshot(first.date, first.meal.meal, first.meal, "manual");
    snapshot.mode = "manual";
    current.planLocks[`${first.date}|${first.meal.meal}`] = snapshot;
    const target = current.foods.find((record) => record.id === first.meal.focusId);
    target.active = false;
    current.inactivePlanKept ||= {};
    current.inactivePlanKept[target.id] = true;
    api.setState(current);
    return { foodId: target.id };
  });
}

async function assertSheetFitsMobile(page) {
  const metrics = await page.locator("#genericModal .sheet").evaluate((sheet) => {
    const rect = sheet.getBoundingClientRect();
    return {
      scrollWidth: sheet.scrollWidth,
      clientWidth: sheet.clientWidth,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, "Bottom-Sheet darf horizontal nicht überlaufen");
  assert.ok(metrics.left >= -1 && metrics.right <= metrics.viewportWidth + 1, "Bottom-Sheet muss im mobilen Viewport bleiben");
  assert.ok(metrics.top >= -1 && metrics.bottom <= metrics.viewportHeight + 1, "Bottom-Sheet muss inklusive Safe-Area im Viewport bleiben");
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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.setState);
  await page.waitForFunction(() => window.__planChecksContractExtensionInstalled === true && window.__planChecksUiInstalled === true);

  // 1. Projected-covered erzeugt keinen offenen Hinweis.
  await seedAllergens(page, { targetIds: ["ei"], exposureCount: 2, autoLockCount: 0, projectedTargetId: "ei" });
  await showView(page, "plan");
  await page.waitForFunction(() => window.__beikostTest.planCheckReport().items.some((item) => item.code === "ALLERGEN_MAINTENANCE_PROJECTED"));
  assert.equal(await page.locator("#planQuality").isVisible(), false, "Projected-covered darf keinen offenen Hinweis erzeugen");

  // Laufende Einführung ist ein eigener strukturierter, priorisierter Zustand.
  await seedAllergens(page, { targetIds: ["erdnuss"], exposureCount: 1, autoLockCount: 2 });
  await showView(page, "plan");
  await page.waitForFunction(() => window.__beikostTest.planCheckOpenGoals().some((item) => item.code === "ALLERGEN_INTRODUCTION_CONTINUE"));
  assert.match(await page.locator("#planQuality").textContent(), /Erdnuss-Einführung fortsetzen/);

  // 2. Einzelnes offenes Allergen zeigt eine konkrete Mahlzeit.
  await seedAllergens(page, { targetIds: ["ei"], exposureCount: 2, autoLockCount: 2 });
  await showView(page, "plan");
  await page.waitForFunction(() => window.__beikostTest.planCheckOpenGoals().length === 1);
  await page.locator("#openPlanGoalSolution").click();
  await page.locator("#applyPlanGoalSolution").waitFor({ state: "visible" });
  assert.match(await page.locator("#genericBody").textContent(), /(Frühstück|Mittagessen|Abendessen)/, "Lösung muss eine konkrete Mahlzeit nennen");
  await assertSheetFitsMobile(page);
  await page.screenshot({ path: path.join(artifactDir, "single-allergen-solution.png"), fullPage: false });
  await page.locator("#closeGeneric").click();

  // 3. Mehrere offene Allergene: Sammelhinweis und sequenzieller, neu bewerteter Flow.
  await seedAllergens(page, { targetIds: ["ei", "weizen"], exposureCount: 2, autoLockCount: 3 });
  await showView(page, "plan");
  await page.waitForFunction(() => window.__beikostTest.planCheckOpenGoals().length === 2);
  assert.match(await page.locator("#planQuality").textContent(), /2 Allergene/);
  await page.locator("#openPlanGoalSolution").click();
  const firstTitle = (await page.locator("#genericTitle").textContent()).trim();
  await page.locator("#applyPlanGoalSolution").click();
  await page.waitForFunction((before) => {
    const title = document.getElementById("genericTitle")?.textContent?.trim();
    return document.getElementById("genericModal")?.classList.contains("open") && title && title !== before;
  }, firstTitle);
  await page.locator("#applyPlanGoalSolution").click();
  await page.waitForFunction(() => !document.getElementById("genericModal")?.classList.contains("open"));
  await page.waitForFunction(() => document.getElementById("toast")?.classList.contains("show") && document.getElementById("toastText")?.textContent === "Plan aktualisiert");

  // 4. „Andere Lösung“ bietet nicht erneut dieselbe strukturierte Solution an.
  await seedAllergens(page, { targetIds: ["ei"], exposureCount: 2, autoLockCount: 3 });
  await showView(page, "plan");
  await page.locator("#openPlanGoalSolution").click();
  const firstSolutionText = (await page.locator("#genericBody .plan-solution-card").textContent()).trim();
  await page.locator("#otherPlanGoalSolution").click();
  await page.waitForFunction((before) => {
    const card = document.querySelector("#genericBody .plan-solution-card");
    return card && card.textContent.trim() !== before;
  }, firstSolutionText);
  const secondSolutionText = (await page.locator("#genericBody .plan-solution-card").textContent()).trim();
  assert.notEqual(secondSolutionText, firstSolutionText);
  await page.locator("#closeGeneric").click();

  // 5. Dismissal verändert keine Expositionsdaten.
  await seedAllergens(page, { targetIds: ["ei"], exposureCount: 2, autoLockCount: 2 });
  await showView(page, "plan");
  const logsBefore = await page.evaluate(() => JSON.stringify(window.__beikostTest.getState().logs));
  await page.locator("#openPlanGoalSolution").click();
  await page.locator("#leavePlanGoal").click();
  await page.waitForFunction(() => !document.getElementById("genericModal")?.classList.contains("open"));
  const logsAfter = await page.evaluate(() => JSON.stringify(window.__beikostTest.getState().logs));
  assert.equal(logsAfter, logsBefore);

  // 6. Geschützte Mahlzeit wird erst nach Bestätigung geändert und bleibt manual geschützt.
  await seedAllergens(page, { targetIds: ["ei"], exposureCount: 2, autoLockCount: 0 });
  await showView(page, "plan");
  await page.locator("#openPlanGoalSolution").click();
  await page.locator(".plan-solution-protected").waitFor({ state: "visible" });
  const protectedMeta = await page.evaluate(() => {
    const days = planDisplayDays(visiblePlanStart(), 7);
    const item = PlannerPlanCheckSolutions.openGoalItems(PlannerPlanCheckSolutions.report(days), days)[0];
    const solution = PlannerPlanCheckSolutions.findSolution(item, days, {});
    const key = `${solution.date}|${solution.meal}`;
    return { key, before: JSON.stringify(window.__beikostTest.getState().planLocks[key]) };
  });
  assert.equal(await page.evaluate((key) => window.__beikostTest.getState().planLocks[key]?.mode, protectedMeta.key), "manual");
  assert.equal(await page.evaluate((meta) => JSON.stringify(window.__beikostTest.getState().planLocks[meta.key]), protectedMeta), protectedMeta.before, "Öffnen des Vorschlags darf geschützte Mahlzeit nicht verändern");
  await page.locator("#applyPlanGoalSolution").click();
  await page.waitForFunction(() => !document.getElementById("genericModal")?.classList.contains("open"));
  assert.equal(await page.evaluate((key) => window.__beikostTest.getState().planLocks[key]?.mode, protectedMeta.key), "manual");

  // 7/8. Hard Blocker -> erklärter Gesamtkorrekturvorschlag -> gemeinsame Übernahme + Toast.
  await seedHardBlocker(page);
  await showView(page, "plan");
  await page.waitForFunction(() => window.__beikostTest.planCheckReport().items.some((item) => item.type === "hard_blocker"));
  await page.locator("#openPlanCorrection").click();
  await page.locator("#applyHardCorrection").waitFor({ state: "visible" });
  assert.match(await page.locator("#genericBody").textContent(), /Vorher/);
  assert.match(await page.locator("#genericBody").textContent(), /Nachher/);
  await assertSheetFitsMobile(page);
  await page.screenshot({ path: path.join(artifactDir, "hard-correction.png"), fullPage: false });
  await page.locator("#applyHardCorrection").click();
  await page.waitForFunction(() => !window.__beikostTest.planCheckReport().items.some((item) => item.type === "hard_blocker"));
  await page.waitForFunction(() => document.getElementById("toast")?.classList.contains("show") && document.getElementById("toastText")?.textContent === "Plan aktualisiert");

  // Required Action wird strukturiert zwischen Blocker und Ziel konsumiert.
  const required = await seedRequiredAction(page);
  await showView(page, "plan");
  await page.waitForFunction(() => window.__beikostTest.planCheckReport().items.some((item) => item.type === "required_action"));
  assert.match(await page.locator("#planQuality").textContent(), /Planentscheidung offen/);
  await page.locator("#openPlanRequiredAction").click();
  await page.locator("#reactivateRequiredFood").click();
  await page.waitForFunction((id) => window.__beikostTest.getState().foods.find((record) => record.id === id)?.active === true, required.foodId);

  // 9. Phase-Details zeigen tatsächliche erfüllte und fehlende Kriterien.
  await page.evaluate(() => window.__beikostTest.reset());
  await showView(page, "home");
  await page.locator(".open-phase-details").click();
  await page.locator('[data-readiness-signal="currentPatternAccepted"][data-readiness-value="yes"]').click();
  await page.locator('[data-readiness-signal="additionalMealCue"][data-readiness-value="no"]').click();
  await page.locator('[data-readiness-signal="routineCompatible"][data-readiness-value="unknown"]').click();
  await page.waitForFunction(() => document.getElementById("genericBody")?.textContent?.includes("Erfüllt") && document.getElementById("genericBody")?.textContent?.includes("Fehlt noch"));
  assert.match(await page.locator("#genericBody").textContent(), /Das aktuelle Mahlzeitenmuster funktioniert im Alltag/);
  assert.match(await page.locator("#genericBody").textContent(), /Signale für eine zusätzliche Mahlzeit fehlen noch/);
  await assertSheetFitsMobile(page);
  await page.screenshot({ path: path.join(artifactDir, "phase-readiness-mixed.png"), fullPage: false });

  // 10. Empfehlung nennt den zusätzlichen Slot; Phasenwechsel erfolgt erst nach bestehender Bestätigung.
  await page.locator('[data-readiness-signal="additionalMealCue"][data-readiness-value="yes"]').click();
  await page.locator('[data-readiness-signal="routineCompatible"][data-readiness-value="yes"]').click();
  await page.waitForFunction(() => document.getElementById("genericBody")?.textContent?.includes("Nächste Phase empfohlen"));
  assert.match(await page.locator("#genericBody").textContent(), /zusätzlich ein Frühstück\. Mittagessen bleibt bestehen/);
  const phaseBefore = await page.evaluate(() => window.__beikostTest.getState().settings.phaseSelected);
  await page.locator("#startRecommendedPhase").click();
  await page.waitForFunction(() => document.getElementById("genericTitle")?.textContent?.includes("wechseln?"));
  assert.equal(await page.evaluate(() => window.__beikostTest.getState().settings.phaseSelected), phaseBefore);
  await page.locator("#confirmPhaseChange").click();
  await page.waitForFunction((before) => window.__beikostTest.getState().settings.phaseSelected !== before, phaseBefore);

  assert.deepEqual(pageErrors, [], `Plan-Checks-Flows dürfen keine JavaScript-Fehler auslösen: ${pageErrors.join(" | ")}`);
  await context.close();
  console.log("plan-checks-ux-webkit: ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
