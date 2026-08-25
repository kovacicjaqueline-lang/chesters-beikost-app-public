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

async function showPlan(page) {
  await page.locator('nav button[data-view="plan"]').click();
  await page.waitForFunction(() => document.getElementById("plan")?.classList.contains("active"));
}

async function showHome(page) {
  await page.locator('nav button[data-view="home"]').click();
  await page.waitForFunction(() => document.getElementById("home")?.classList.contains("active"));
}

async function seedAllergenScenario(page, { targetIds, exposureCount, autoSlots = 1, leaveUnlocked = 0 }) {
  return page.evaluate(({ targetIds, exposureCount, autoSlots, leaveUnlocked }) => {
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

    const meals = baseDays.flatMap((day) => (day.meals || [])
      .filter((meal) => meal.active && !meal.empty && meal.focusId)
      .map((meal) => ({ day, meal })));
    let lockedIndex = 0;
    let skipped = 0;
    for (const entry of meals) {
      if (skipped < leaveUnlocked) {
        skipped += 1;
        continue;
      }
      const mode = lockedIndex < autoSlots ? "auto" : "manual";
      const snapshot = mealSnapshot(entry.day.date, entry.meal.meal, entry.meal, mode);
      if (!snapshot) continue;
      snapshot.mode = mode;
      current.planLocks[`${entry.day.date}|${entry.meal.meal}`] = snapshot;
      lockedIndex += 1;
    }

    const targetRecords = targetIds.map((id) => current.foods.find((record) => record.id === id));
    if (targetRecords.some((record) => !record)) throw new Error(`Target FOOD fehlt: ${targetIds.join(",")}`);
    targetRecords.forEach((record) => {
      record.active = true;
      record.manualStatus = "auto";
    });

    current.logs = targetIds.flatMap((id, targetIndex) => Array.from({ length: exposureCount }, (_, exposureIndex) => ({
      id: `plan-check-${id}-${exposureIndex}`,
      date: api.addDays(on, -(12 - exposureIndex - targetIndex)),
      meal: "lunch",
      entryType: "meal",
      focusId: id,
      foodIds: [id],
      baseFoodIds: [id],
      sampleFoodIds: [],
      outcome: "eaten",
      foodOutcomes: { [id]: "eaten" },
      createdAt: `${api.addDays(on, -(12 - exposureIndex - targetIndex))}T12:00:00.000Z`,
    })));

    api.setState(current);
    return { on, targetIds };
  }, { targetIds, exposureCount, autoSlots, leaveUnlocked });
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
      if (record.active && record.category !== "Fett" && record.category !== "Kraut/Gewürz") {
        record.manualStatus = "Verträgliche Basis";
      }
    }
    api.setState(current);
    const days = api.buildDays(on, 7);
    current = api.getState();
    current.planLocks = {};
    for (const day of days) {
      for (const meal of day.meals || []) {
        if (!meal.active || meal.empty || !meal.focusId) continue;
        const snapshot = mealSnapshot(day.date, meal.meal, meal, "manual");
        if (snapshot) {
          snapshot.mode = "manual";
          current.planLocks[`${day.date}|${meal.meal}`] = snapshot;
        }
      }
    }
    const milk = current.foods.find((record) => record.id === "naturjoghurt") || current.foods.find((record) => record.category === "Milchprodukt" && record.active);
    const meat = current.foods.find((record) => record.id === "rind") || current.foods.find((record) => record.category === "Fleisch" && record.active);
    if (!milk || !meat) throw new Error("Milk/Meat fixture FOOD fehlt");
    const badMeal = {
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
    const badSnapshot = mealSnapshot(on, "lunch", badMeal, "manual");
    badSnapshot.mode = "manual";
    current.planLocks[`${on}|lunch`] = badSnapshot;
    api.setState(current);
    return { on, milkId: milk.id, meatId: meat.id };
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
    const first = days.flatMap((day) => (day.meals || []).map((meal) => ({ day, meal })))
      .find((entry) => entry.meal.active && !entry.meal.empty && entry.meal.focusId);
    if (!first) throw new Error("Keine Planmahlzeit für required_action fixture");
    current = api.getState();
    current.planLocks = {};
    const snapshot = mealSnapshot(first.day.date, first.meal.meal, first.meal, "manual");
    snapshot.mode = "manual";
    current.planLocks[`${first.day.date}|${first.meal.meal}`] = snapshot;
    const target = current.foods.find((record) => record.id === first.meal.focusId);
    target.active = false;
    current.inactivePlanKept ||= {};
    current.inactivePlanKept[target.id] = true;
    api.setState(current);
    return { foodId: target.id, foodName: target.name };
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
  await page.waitForFunction(() => window.__planChecksContractExtensionInstalled === true);
  await page.waitForFunction(() => window.__planChecksUiInstalled === true);

  // 1. projected-covered: strukturierter Report kennt das Ziel, sichtbarer Hinweis bleibt aus.
  await seedAllergenScenario(page, { targetIds: ["ei"], exposureCount: 2, autoSlots: 0, leaveUnlocked: 1 });
  await showPlan(page);
  await page.waitForFunction(() => {
    const report = window.__beikostTest.planCheckReport();
    return report.items.some((item) => item.code === "ALLERGEN_MAINTENANCE_PROJECTED");
  });
  assert.equal(await page.locator("#planQuality").isVisible(), false, "Projected-covered darf keinen offenen Hinweis erzeugen");

  // 2. einzelnes offenes Allergen -> konkrete Lösung mit tatsächlicher Mahlzeit.
  await seedAllergenScenario(page, { targetIds: ["ei"], exposureCount: 2, autoSlots: 2 });
  await showPlan(page);
  await page.waitForFunction(() => window.__beikostTest.planCheckOpenGoals().length === 1);
  await page.locator("#openPlanGoalSolution").click();
  await page.locator("#applyPlanGoalSolution").waitFor({ state: "visible" });
  assert.match(await page.locator("#genericBody").textContent(), /(Frühstück|Mittagessen|Abendessen)/, "Lösung muss eine konkrete Mahlzeit nennen");
  await assertSheetFitsMobile(page);
  await page.screenshot({ path: path.join(artifactDir, "single-allergen-solution.png"), fullPage: false });
  await page.locator("#closeGeneric").click();

  // 3. mehrere offene Allergene -> Sammelhinweis und sequenziell neu berechneter Flow.
  await seedAllergenScenario(page, { targetIds: ["ei", "weizen"], exposureCount: 2, autoSlots: 3 });
  await showPlan(page);
  await page.waitForFunction(() => window.__beikostTest.planCheckOpenGoals().length === 2);
  assert.match(await page.locator("#planQuality").textContent(), /2 Allergene/, "Mehrere offene Ziele brauchen einen Sammelhinweis");
  await page.locator("#openPlanGoalSolution").click();
  const firstTitle = (await page.locator("#genericTitle").textContent()).trim();
  await page.locator("#applyPlanGoalSolution").click();
  await page.waitForFunction((previous) => {
    const title = document.getElementById("genericTitle")?.textContent?.trim();
    return document.getElementById("genericModal")?.classList.contains("open") && title && title !== previous;
  }, firstTitle);
  const secondTitle = (await page.locator("#genericTitle").textContent()).trim();
  assert.notEqual(secondTitle, firstTitle, "Nach der ersten Mutation muss der nächste offene Zielzustand neu bestimmt werden");
  await page.locator("#applyPlanGoalSolution").click();
  await page.waitForFunction(() => !document.getElementById("genericModal")?.classList.contains("open"));
  await page.waitForFunction(() => document.getElementById("toast")?.classList.contains("show") && document.getElementById("toastText")?.textContent === "Plan aktualisiert");
  assert.equal((await page.locator("#toastText").textContent()).trim(), "Plan aktualisiert");

  // 4. „Andere Lösung“: abgelehnte Solution-ID wird im selben Durchlauf nicht erneut angeboten.
  await seedAllergenScenario(page, { targetIds: ["ei"], exposureCount: 2, autoSlots: 3 });
  const solutionIds = await page.evaluate(() => {
    const days = planDisplayDays(visiblePlanStart(), 7);
    const report = PlannerPlanCheckSolutions.report(days);
    const item = PlannerPlanCheckSolutions.openGoalItems(report, days)[0];
    const first = PlannerPlanCheckSolutions.findSolution(item, days, {});
    const second = PlannerPlanCheckSolutions.findSolution(item, days, { rejectedSolutionIds: [first.id] });
    return { first: first?.id || "", second: second?.id || "" };
  });
  assert.ok(solutionIds.first && solutionIds.second, "Für den Alternativen-Test werden zwei Lösungen benötigt");
  assert.notEqual(solutionIds.first, solutionIds.second, "Abgelehnte Solution-ID darf nicht erneut angeboten werden");

  // 5. „Diese Woche so lassen“ verändert weder Logs noch Expositionsdaten.
  await seedAllergenScenario(page, { targetIds: ["ei"], exposureCount: 2, autoSlots: 2 });
  await showPlan(page);
  const exposureBefore = await page.evaluate(() => JSON.stringify(window.__beikostTest.getState().logs));
  await page.locator("#openPlanGoalSolution").click();
  await page.locator("#leavePlanGoal").click();
  await page.waitForFunction(() => !document.getElementById("genericModal")?.classList.contains("open"));
  const exposureAfter = await page.evaluate(() => JSON.stringify(window.__beikostTest.getState().logs));
  assert.equal(exposureAfter, exposureBefore, "Dismissal darf keine Expositionshistorie verändern");

  // 6. Letzte Alternative darf geschützte Mahlzeit erst nach Bestätigung ändern und behält manual mode.
  await seedAllergenScenario(page, { targetIds: ["ei"], exposureCount: 2, autoSlots: 0 });
  await showPlan(page);
  await page.locator("#openPlanGoalSolution").click();
  await page.locator(".plan-solution-protected").waitFor({ state: "visible" });
  const protectedKey = await page.evaluate(() => {
    const days = planDisplayDays(visiblePlanStart(), 7);
    const item = PlannerPlanCheckSolutions.openGoalItems(PlannerPlanCheckSolutions.report(days), days)[0];
    const solution = PlannerPlanCheckSolutions.findSolution(item, days, {});
    return `${solution.date}|${solution.meal}`;
  });
  assert.equal(await page.evaluate((key) => window.__beikostTest.getState().planLocks[key]?.mode, protectedKey), "manual");
  await page.locator("#applyPlanGoalSolution").click();
  await page.waitForFunction(() => !document.getElementById("genericModal")?.classList.contains("open"));
  assert.equal(await page.evaluate((key) => window.__beikostTest.getState().planLocks[key]?.mode, protectedKey), "manual", "Geschützter Status muss nach Mutation erhalten bleiben");

  // 7/8. Echter Hard Blocker -> erklärter Gesamtkorrekturvorschlag -> gemeinsame Übernahme + Toast.
  await seedHardBlocker(page);
  await showPlan(page);
  await page.waitForFunction(() => window.__beikostTest.planCheckReport().items.some((item) => item.type === "hard_blocker"));
  assert.match(await page.locator("#planQuality").textContent(), /Plan anpassen/);
  await page.locator("#openPlanCorrection").click();
  await page.locator("#applyHardCorrection").waitFor({ state: "visible" });
  assert.match(await page.locator("#genericBody").textContent(), /Vorher/);
  assert.match(await page.locator("#genericBody").textContent(), /Nachher/);
  await assertSheetFitsMobile(page);
  await page.screenshot({ path: path.join(artifactDir, "hard-correction.png"), fullPage: false });
  await page.locator("#applyHardCorrection").click();
  await page.waitForFunction(() => !window.__beikostTest.planCheckReport().items.some((item) => item.type === "hard_blocker"));
  await page.waitForFunction(() => document.getElementById("toast")?.classList.contains("show") && document.getElementById("toastText")?.textContent === "Plan aktualisiert");

  // Required Action wird zwischen Hard Blocker und Open Goal konkret konsumiert.
  const requiredFixture = await seedRequiredAction(page);
  await showPlan(page);
  await page.waitForFunction(() => window.__beikostTest.planCheckReport().items.some((item) => item.type === "required_action"));
  assert.match(await page.locator("#planQuality").textContent(), /Planentscheidung offen/);
  await page.locator("#openPlanRequiredAction").click();
  await page.locator("#reactivateRequiredFood").click();
  await page.waitForFunction((id) => window.__beikostTest.getState().foods.find((food) => food.id === id)?.active === true, requiredFixture.foodId);

  // 9. Phase antippbar -> erfüllte und fehlende Readiness-Kriterien aus domainStates.phaseReadiness.
  await page.evaluate(() => window.__beikostTest.reset());
  await showHome(page);
  await page.locator(".open-phase-details").click();
  await page.locator('[data-readiness-signal="currentPatternAccepted"][data-readiness-value="yes"]').click();
  await page.locator('[data-readiness-signal="additionalMealCue"][data-readiness-value="no"]').click();
  await page.locator('[data-readiness-signal="routineCompatible"][data-readiness-value="unknown"]').click();
  await page.waitForFunction(() => document.getElementById("genericBody")?.textContent?.includes("Erfüllt") && document.getElementById("genericBody")?.textContent?.includes("Fehlt noch"));
  assert.match(await page.locator("#genericBody").textContent(), /Das aktuelle Mahlzeitenmuster funktioniert im Alltag/);
  assert.match(await page.locator("#genericBody").textContent(), /Signale für eine zusätzliche Mahlzeit fehlen noch/);
  await assertSheetFitsMobile(page);
  await page.screenshot({ path: path.join(artifactDir, "phase-readiness-mixed.png"), fullPage: false });

  // 10. Empfehlung nennt den konkreten zusätzlichen Slot und wechselt erst nach bestehender Bestätigung.
  await page.locator('[data-readiness-signal="additionalMealCue"][data-readiness-value="yes"]').click();
  await page.locator('[data-readiness-signal="routineCompatible"][data-readiness-value="yes"]').click();
  await page.waitForFunction(() => document.getElementById("genericBody")?.textContent?.includes("Nächste Phase empfohlen"));
  assert.match(await page.locator("#genericBody").textContent(), /zusätzlich ein Frühstück\. Mittagessen bleibt bestehen/);
  const phaseBefore = await page.evaluate(() => window.__beikostTest.getState().settings.phaseSelected);
  await page.locator("#startRecommendedPhase").click();
  await page.waitForFunction(() => document.getElementById("genericTitle")?.textContent?.includes("wechseln?"));
  assert.equal(await page.evaluate(() => window.__beikostTest.getState().settings.phaseSelected), phaseBefore, "Mehr erfahren darf die Phase nicht direkt wechseln");
  await page.locator("#confirmPhaseChange").click();
  await page.waitForFunction((before) => window.__beikostTest.getState().settings.phaseSelected !== before, phaseBefore);

  assert.deepEqual(pageErrors, [], `Plan-Checks-Flows dürfen keine JavaScript-Fehler auslösen: ${pageErrors.join(" | ")}`);
  await context.close();
  console.log("plan-checks-ux-webkit: ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
