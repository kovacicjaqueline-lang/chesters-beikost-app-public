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
    // Allergene werden deaktiviert. Brot bleibt für die erste Planerzeugung ebenfalls
    // deaktiviert, damit die später abgeschlossenen Plan-Slots garantiert brotfrei sind.
    for (const record of seed.foods) {
      if (record.allergenGroup) {
        record.active = false;
        record.manualStatus = "auto";
      } else if (record.active && record.category !== "Fett" && record.category !== "Kraut/Gewürz") {
        record.manualStatus = "Verträgliche Basis";
      }
    }

    const bread = seed.foods.find((record) => record.id === "brot");
    if (!bread) throw new Error("Brot-FOOD fehlt");
    bread.active = false;
    bread.manualStatus = "auto";

    const exposureDate = api.addDays(on, -1);
    seed.logs = [{
      id: "no-solution-bread",
      date: exposureDate,
      meal: "lunch",
      entryType: "meal",
      focusId: bread.id,
      foodIds: [bread.id],
      baseFoodIds: [bread.id],
      sampleFoodIds: [],
      outcome: "eaten",
      foodOutcomes: { [bread.id]: "eaten" },
      createdAt: `${exposureDate}T12:00:00.000Z`,
    }];

    // Stufe 1: einen echten brotfreien Wochenplan erzeugen. buildDays() liefert die
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
    if (plannedSlots.some((slot) => (slot.plan.foodIds || []).includes(bread.id))) {
      throw new Error("Der brotfreie Ausgangsplan darf Brot nicht enthalten");
    }

    // Stufe 2: alle sieben Tage als ausdrücklich manuelle Planinstanzen persistieren.
    // Anders als Auto-Locks dürfen diese auch jenseits der Drei-Tage-Fixierung bestehen.
    // Brot wird erst danach reaktiviert; Abschlusslogs referenzieren die realen planIds.
    const linked = api.getState();
    linked.settings.planCheckEvaluationRevision = 7002;
    linked.logs ||= [];
    linked.manualMeals ||= {};
    linked.planLocks ||= {};
    const linkedBread = linked.foods.find((record) => record.id === bread.id);
    if (!linkedBread) throw new Error("Brot-FOOD fehlt nach dem ersten State-Roundtrip");
    linkedBread.active = true;
    linkedBread.manualStatus = "auto";

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
      if (actualFoodIds.includes(bread.id)) throw new Error("Brot darf nicht in einem Abschlusslog vorkommen");
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
    "Die Testlage muss ein offenes Brot-Einführungsziel erzeugen",
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
  await page.locator("#leavePlanGoalDirect").click();
  await page.waitForFunction(() => !document.getElementById("planQuality")?.offsetParent);

  assert.deepEqual(pageErrors, [], `Keine Page-Errors erwartet: ${pageErrors.join(" | ")}`);
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
