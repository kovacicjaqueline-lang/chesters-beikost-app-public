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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const diagnosticSnapshot = async (label) => {
    const snapshot = await page.evaluate((snapshotLabel) => {
      const api = window.__beikostTest;
      return {
        label: snapshotLabel,
        goals: api.planCheckOpenGoals().map((item) => ({
          code: item.code,
          goalKey: window.PlannerPlanCheckSolutions?.goalKey?.(item) || "",
          foodIds: item.refs?.foodIds || [],
        })),
        states: api.planCheckSolutionPrecompute(),
        ctaCount: document.querySelectorAll("#openPlanGoalSolution").length,
        copy: document.getElementById("planQuality")?.textContent || "",
      };
    }, label);
    console.log(`[plan-check-precompute] ${JSON.stringify(snapshot)}`);
    return snapshot;
  };

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.setState);
  await page.waitForFunction(() => window.__planCheckSolutionPrecomputeInstalled === true);

  const pendingSnapshot = await page.evaluate(() => {
    const api = window.__beikostTest;
    api.reset();
    const seed = api.getState();
    const on = api.today();
    seed.settings.phaseSelected = "drei";
    seed.settings.planFrom = on;
    seed.settings.planCheckEvaluationRevision = 7001;
    seed.logs = [];
    seed.manualMeals = {};
    seed.planLocks = {};
    seed.overrides = {};
    seed.autoLockExcluded = {};
    seed.inactivePlanKept = {};

    // Bekannte Nicht-Allergene bleiben als echte Planbasis aktiv; konkurrierende
    // Allergene werden deaktiviert. Ei bleibt für die erste Planerzeugung ebenfalls
    // deaktiviert, damit die später abgeschlossenen Plan-Slots garantiert eifrei sind.
    for (const record of seed.foods) {
      if (record.allergenGroup) {
        record.active = false;
        record.manualStatus = "auto";
      } else if (record.active && record.category !== "Fett" && record.category !== "Kraut/Gewürz") {
        record.manualStatus = "Verträgliche Basis";
      }
    }

    const egg = seed.foods.find((record) => record.id === "ei");
    if (!egg) throw new Error("Ei-FOOD fehlt");
    egg.active = false;
    egg.manualStatus = "auto";

    const exposureDate = api.addDays(on, -1);
    seed.logs = [{
      id: "no-solution-egg",
      date: exposureDate,
      meal: "lunch",
      entryType: "meal",
      focusId: egg.id,
      foodIds: [egg.id],
      baseFoodIds: [egg.id],
      sampleFoodIds: [],
      outcome: "eaten",
      foodOutcomes: { [egg.id]: "eaten" },
      createdAt: `${exposureDate}T12:00:00.000Z`,
    }];

    // Stufe 1: einen echten eifreien Wochenplan erzeugen. buildDays() liefert die
    // vollständigen Mahlzeitenobjekte samt den von der Produktionslogik vergebenen IDs.
    api.setState(seed);
    const plannedSlots = api.buildDays(on, 7)
      .flatMap((day) => (day.meals || [])
        .filter((meal) =>
          meal.active &&
          meal.focusId &&
          ["breakfast", "lunch", "dinner"].includes(meal.meal)
        )
        .map((meal) => ({
          date: day.date,
          meal: meal.meal,
          planId: meal.planId || "",
          plan: meal,
        })));
    if (plannedSlots.length !== 21) {
      throw new Error(`Die Testlage muss 21 sichtbare Hauptmahlzeiten erzeugen, erhalten: ${plannedSlots.length}`);
    }
    if (plannedSlots.some((slot) => !slot.planId)) throw new Error("Jeder sichtbare Test-Slot braucht eine echte planId");
    if (plannedSlots.some((slot) => (slot.plan.foodIds || []).includes(egg.id))) {
      throw new Error("Der eifreie Ausgangsplan darf Ei nicht enthalten");
    }

    // Stufe 2: alle sieben Tage als ausdrücklich manuelle Planinstanzen persistieren.
    // Anders als Auto-Locks dürfen diese auch jenseits der Drei-Tage-Fixierung bestehen.
    // Ei wird erst danach reaktiviert; Abschlusslogs referenzieren die realen planIds.
    const linked = api.getState();
    linked.settings.planCheckEvaluationRevision = 7002;
    linked.logs ||= [];
    linked.manualMeals ||= {};
    linked.planLocks ||= {};
    const linkedEgg = linked.foods.find((record) => record.id === egg.id);
    if (!linkedEgg) throw new Error("Ei-FOOD fehlt nach dem ersten State-Roundtrip");
    linkedEgg.active = true;
    linkedEgg.manualStatus = "auto";

    plannedSlots.forEach((slot, index) => {
      if (typeof mealSnapshot !== "function") throw new Error("mealSnapshot fehlt");
      const snapshot = mealSnapshot(slot.date, slot.meal, slot.plan, "manual");
      if (!snapshot) throw new Error(`Kein Plan-Snapshot für ${slot.date}|${slot.meal}`);
      const key = `${slot.date}|${slot.meal}`;
      const manualSnapshot = {
        ...snapshot,
        planId: slot.planId,
        manualAdded: true,
      };
      delete manualSnapshot.mode;
      linked.manualMeals[key] = manualSnapshot;
      linked.planLocks[key] = {
        ...snapshot,
        planId: slot.planId,
        manualAdded: true,
        mode: "manual",
      };

      const actualFoodIds = [...new Set(slot.plan.foodIds || [])].filter(Boolean);
      if (!actualFoodIds.length) throw new Error(`Plan-Slot ohne FOODs: ${slot.date}|${slot.meal}`);
      if (actualFoodIds.includes(egg.id)) throw new Error("Ei darf nicht in einem Abschlusslog vorkommen");
      linked.logs.push({
        id: `completed-${index}`,
        date: slot.date,
        meal: slot.meal,
        entryType: "meal",
        plannedMealId: slot.planId,
        focusId: slot.plan.focusId,
        foodIds: actualFoodIds,
        baseFoodIds: [...(slot.plan.baseFoodIds || [])],
        sampleFoodIds: [...(slot.plan.sampleFoodIds || [])],
        recipeName: slot.plan.recipeName || "",
        recipeInventoryId: slot.plan.recipeInventoryId || "",
        outcome: "eaten",
        foodOutcomes: Object.fromEntries(actualFoodIds.map((id) => [id, "eaten"])),
        createdAt: `${slot.date}T12:${String(index % 60).padStart(2, "0")}:00.000Z`,
      });
    });

    window.__planCheckHeartbeat = 0;
    window.__planCheckHeartbeatTimer = setInterval(() => {
      window.__planCheckHeartbeat += 1;
    }, 50);

    api.setState(linked);
    const openEggGoal = api.planCheckOpenGoals().find((item) => item.code === "ALLERGEN_INTRODUCTION_CONTINUE");
    if (!openEggGoal) throw new Error("Das offene Ei-Einführungsziel fehlt für die Cache-Migration");
    const currentDays = typeof planDisplayDays === "function"
      ? planDisplayDays(visiblePlanStart(), 7)
      : buildDays(visiblePlanStart(), 7);
    const legacyGoalSnapshot = {
      code: openEggGoal.code || "",
      refs: openEggGoal.refs || {},
      details: openEggGoal.details || {},
    };
    const legacyEvaluationKey = window.PlannerPlanCheckSolutions.evaluationKey(currentDays);
    const legacyEntryKey = `v1|${legacyEvaluationKey}|${window.PlannerPlanCheckSolutions.goalKey(openEggGoal)}|${window.PlannerPlanCheckSolutions.hashText(window.PlannerPlanCheckSolutions.stableStringify(legacyGoalSnapshot))}`;
    const currentCacheKey = `beikost-plan-check-none-v2-f${window.PlannerPlanCheckSolutions.FEATURE_VERSION}`;
    const now = Date.now();
    localStorage.setItem("beikost-plan-check-none-v1", JSON.stringify([{
      key: legacyEntryKey,
      savedAt: now,
    }]));
    // Ein passender, aber abgelaufener Treffer darf nicht sofort "none" vortäuschen.
    // 32 frische, nicht passende Treffer prüfen zugleich das Limit nach dem neuen Ergebnis.
    localStorage.setItem(currentCacheKey, JSON.stringify([
      ...Array.from({ length: 32 }, (_, index) => ({
        key: `seeded-none-${index}`,
        savedAt: now,
      })),
      {
        key: legacyEntryKey,
        savedAt: now - 15 * 24 * 60 * 60 * 1000,
      },
    ]));
    renderAll();
    const completedSlots = plannedSlots.map((slot) => ({
      date: slot.date,
      meal: slot.meal,
      planId: slot.planId,
      completed: typeof mealIsCompleted === "function" && mealIsCompleted(slot.date, slot.meal),
    }));
    return {
      goals: api.planCheckOpenGoals(),
      states: api.planCheckSolutionPrecompute(),
      completedSlots,
      ctaCount: document.querySelectorAll("#openPlanGoalSolution").length,
      copy: document.getElementById("planQuality")?.textContent || "",
    };
  });

  assert.ok(
    pendingSnapshot.completedSlots.every((slot) => slot.completed),
    `Alle sichtbaren Hauptmahlzeiten müssen nach Produktionslogik erledigt sein: ${JSON.stringify(pendingSnapshot.completedSlots)}`,
  );
  assert.ok(
    pendingSnapshot.goals.some((item) => item.code === "ALLERGEN_INTRODUCTION_CONTINUE"),
    "Die Testlage muss ein offenes Ei-Einführungsziel erzeugen",
  );
  assert.ok(
    pendingSnapshot.states.some((entry) => entry.status === "pending"),
    `Direkt nach dem Rendern wird ein Pending-Status erwartet: ${JSON.stringify(pendingSnapshot.states)}`,
  );
  assert.equal(
    pendingSnapshot.ctaCount,
    0,
    `Während der Prüfung darf kein irreführender CTA erscheinen: ${pendingSnapshot.copy}`,
  );

  await page.waitForFunction(() => window.__planCheckHeartbeat >= 3, null, { timeout: 5000 });
  await page.evaluate(() => {
    clearInterval(window.__planCheckHeartbeatTimer);
    delete window.__planCheckHeartbeatTimer;
  });

  await page.locator('nav button[data-view="plan"]').click();
  await page.waitForFunction(() => document.getElementById("plan")?.classList.contains("active"));

  let settledSnapshot = null;
  let previousCheckpoint = 0;
  for (const checkpointMs of [1000, 5000, 20000]) {
    await new Promise((resolve) => setTimeout(resolve, checkpointMs - previousCheckpoint));
    previousCheckpoint = checkpointMs;
    const snapshot = await diagnosticSnapshot(`after-${checkpointMs}ms`);
    if (snapshot.states.some((entry) => entry.status === "none")) {
      settledSnapshot = snapshot;
      break;
    }
  }
  assert.ok(
    settledSnapshot,
    "Die Vorprüfung muss in den none-Zustand wechseln; Diagnose-Snapshots stehen im CI-Log",
  );

  const planQuality = page.locator("#planQuality");
  assert.match(await planQuality.textContent(), /keine passende Möglichkeit/i);
  assert.equal(await page.locator("#openPlanGoalSolution").count(), 0, "Ohne Lösung darf Lösung ansehen nicht gerendert werden");
  const versionedCache = await page.evaluate(() => {
    const key = `beikost-plan-check-none-v2-f${window.PlannerPlanCheckSolutions.FEATURE_VERSION}`;
    return { key, rows: JSON.parse(localStorage.getItem(key) || "[]") };
  });
  assert.equal(
    versionedCache.rows.length,
    32,
    `Der persistierte None-Cache muss auf 32 Einträge begrenzt bleiben (${versionedCache.key})`,
  );
  assert.equal(
    versionedCache.rows.some((row) => row.key === "seeded-none-0"),
    false,
    "Beim Einfügen des neuen Ergebnisses muss der älteste Cache-Eintrag entfernt werden",
  );
  assert.ok(
    versionedCache.rows.some((row) => row.key.startsWith("v1|")),
    "Das aktuelle abgeschlossene Ergebnis muss trotz Cache-Limit gespeichert sein",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.setState);
  await page.waitForFunction(() => window.__planCheckSolutionPrecomputeInstalled === true);
  await page.locator('nav button[data-view="plan"]').click();
  await page.waitForFunction(() => window.__beikostTest.planCheckSolutionPrecompute()
    .some((entry) => entry.status === "none"), null, { timeout: 3000 });
  const resumedCopy = await page.locator("#planQuality").textContent();
  assert.match(resumedCopy, /keine passende Möglichkeit/i);
  assert.doesNotMatch(resumedCopy, /wird geprüft/i, "Ein gespeichertes Ergebnis darf beim App-Neustart nicht erneut auf pending springen");
  assert.equal(await page.locator("#openPlanGoalSolution").count(), 0, "Ohne Lösung darf nach dem Neustart kein CTA erscheinen");

  // Browser Storage kann abgewiesen werden (z.B. Privacy-Modus). Der eigentliche
  // Plan-Check muss dann weiterhin bis zum fachlichen Ergebnis durchlaufen.
  await page.addInitScript(() => {
    const isNoneCacheKey = (key) => /^beikost-plan-check-none-/.test(String(key));
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (isNoneCacheKey(key)) throw new DOMException("Storage denied", "SecurityError");
      return originalGetItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (isNoneCacheKey(key)) throw new DOMException("Storage denied", "SecurityError");
      return originalSetItem.call(this, key, value);
    };
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.setState);
  await page.waitForFunction(() => window.__planCheckSolutionPrecomputeInstalled === true);
  await page.locator('nav button[data-view="plan"]').click();
  await page.waitForFunction(() => window.__beikostTest.planCheckSolutionPrecompute()
    .some((entry) => entry.status === "none"), null, { timeout: 30000 });
  const storageFallback = await page.evaluate(() => {
    const key = `beikost-plan-check-none-v2-f${window.PlannerPlanCheckSolutions.FEATURE_VERSION}`;
    let readBlocked = false;
    let writeBlocked = false;
    try { localStorage.getItem(key); } catch { readBlocked = true; }
    try { localStorage.setItem(key, "[]"); } catch { writeBlocked = true; }
    return { readBlocked, writeBlocked, copy: document.getElementById("planQuality")?.textContent || "" };
  });
  assert.deepEqual(
    { readBlocked: storageFallback.readBlocked, writeBlocked: storageFallback.writeBlocked },
    { readBlocked: true, writeBlocked: true },
    "Der Test muss sowohl abgewiesene Cache-Lese- als auch Schreibzugriffe simulieren",
  );
  assert.match(storageFallback.copy, /keine passende Möglichkeit/i, "Ohne Storage muss der Plan-Check fachlich weiterarbeiten");

  await page.locator("#leavePlanGoalDirect").click();
  await page.waitForFunction(() => !document.getElementById("planQuality")?.offsetParent);

  const glutenReport = await page.evaluate(() => {
    const api = window.__beikostTest;
    api.reset();
    const snapshot = api.getState();
    snapshot.settings.planFrom = api.today();
    snapshot.logs = [
      ...[
        "2026-07-17", "2026-07-19", "2026-07-20", "2026-07-22",
        "2026-07-27", "2026-08-01", "2026-08-14", "2026-08-27",
        "2026-09-16",
      ].map((date, index) => ({
        id: `known-oat-${index}`,
        date,
        meal: index % 2 ? "lunch" : "breakfast",
        entryType: "meal",
        foodIds: ["hafer"],
        outcome: "eaten",
        foodOutcomes: { hafer: "eaten" },
        createdAt: `${date}T12:00:00.000Z`,
      })),
      {
        id: "known-bread",
        date: "2026-08-16",
        meal: "breakfast",
        entryType: "food",
        foodIds: ["brot"],
        outcome: "eaten",
        foodOutcomes: { brot: "eaten" },
        createdAt: "2026-08-16T12:00:00.000Z",
      },
      {
        id: "single-wheat-semolina",
        date: "2026-09-18",
        meal: "breakfast",
        entryType: "food",
        foodIds: ["weizengriess"],
        outcome: "eaten",
        foodOutcomes: { weizengriess: "eaten" },
        createdAt: "2026-09-18T12:00:00.000Z",
      },
    ];
    snapshot.manualMeals = {};
    snapshot.planLocks = {};
    snapshot.overrides = {};
    api.setState(snapshot);
    return api.planCheckReport().items
      .filter((item) => item.code === "ALLERGEN_INTRODUCTION_CONTINUE")
      .map((item) => item.details?.representativeFoodId || "");
  });
  assert.equal(
    glutenReport.includes("weizengriess"),
    false,
    `Bei etablierter Glutenpflege darf keine Weizengrieß-Einführung fortgesetzt werden: ${glutenReport.join(", ")}`,
  );

  assert.deepEqual(pageErrors, [], `Keine Page-Errors erwartet: ${pageErrors.join(" | ")}`);
} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
