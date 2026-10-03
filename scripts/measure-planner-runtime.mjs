import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

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

async function main() {
  const server = await startStaticServer();
  const { port } = server.address();
  const browserType = process.env.BROWSER_ENGINE === "chromium" ? chromium : webkit;
  let browser = null;
  try {
    browser = await browserType.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.__beikostTest?.setState);
    await page.waitForFunction(() => window.__plannerPoliciesReady === true);
    await page.waitForFunction(() => window.__planCheckSolutionPrecomputeInstalled === true);

    const result = await page.evaluate(async () => {
      const api = window.__beikostTest;
      const solutions = window.PlannerPlanCheckSolutions;
      const on = api.today();
      const summarizeValues = (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
        return {
          samples: values.length,
          minMs: Number(sorted[0].toFixed(2)),
          medianMs: Number(percentile(0.5).toFixed(2)),
          p95Ms: Number(percentile(0.95).toFixed(2)),
          maxMs: Number(sorted.at(-1).toFixed(2)),
        };
      };

      api.reset();
      const seed = api.getState();
      seed.settings.phaseSelected = "drei";
      seed.settings.planFrom = on;
      seed.settings.planCheckEvaluationRevision = 7001;
      seed.logs = [];
      seed.manualMeals = {};
      seed.planLocks = {};
      seed.overrides = {};
      seed.autoLockExcluded = {};
      seed.inactivePlanKept = {};

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
        id: "runtime-benchmark-bread",
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

      api.setState(seed);
      const plannedSlots = api.buildDays(on, 7)
        .flatMap((day) => (day.meals || [])
          .filter((meal) => meal.active && meal.focusId && ["breakfast", "lunch", "dinner"].includes(meal.meal))
          .map((meal) => ({
            date: day.date,
            meal: meal.meal,
            planId: meal.planId || "",
            plan: meal,
          })));
      if (plannedSlots.length !== 21) {
        throw new Error(`Benchmark-Szenario erwartet 21 Hauptmahlzeiten, erhalten: ${plannedSlots.length}`);
      }

      const linked = api.getState();
      linked.settings.planCheckEvaluationRevision = 7002;
      linked.manualMeals ||= {};
      linked.planLocks ||= {};
      const linkedBread = linked.foods.find((record) => record.id === bread.id);
      linkedBread.active = true;
      linkedBread.manualStatus = "auto";

      plannedSlots.forEach((slot, index) => {
        const snapshot = mealSnapshot(slot.date, slot.meal, slot.plan, "manual");
        if (!snapshot) throw new Error(`Kein Plan-Snapshot für ${slot.date}|${slot.meal}`);
        const key = `${slot.date}|${slot.meal}`;
        const manualSnapshot = { ...snapshot, planId: slot.planId, manualAdded: true };
        delete manualSnapshot.mode;
        linked.manualMeals[key] = manualSnapshot;
        linked.planLocks[key] = {
          ...snapshot,
          planId: slot.planId,
          manualAdded: true,
          mode: "manual",
        };

        const actualFoodIds = [...new Set(slot.plan.foodIds || [])].filter(Boolean);
        linked.logs.push({
          id: `runtime-benchmark-completed-${index}`,
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

      api.setState(linked);
      renderAll();

      const measureVisiblePlan = () => {
        window.invalidateDayPlanRuntimeCache?.();
        window.__plannerWeekCache?.clear("runtime-benchmark");
        const start = performance.now();
        const days = window.planDisplayDays(on, 7);
        return { duration: performance.now() - start, days };
      };

      // First run is intentionally cold. Subsequent runs show the cost of a
      // fresh visible calculation after the runtime caches were invalidated.
      const visibleCold = [];
      let visibleDays = null;
      for (let index = 0; index < 7; index += 1) {
        const measurement = measureVisiblePlan();
        visibleCold.push(measurement.duration);
        visibleDays = measurement.days;
      }

      const visibleWarmStart = performance.now();
      window.planDisplayDays(on, 7);
      const visibleWarmMs = performance.now() - visibleWarmStart;

      const report = solutions.report(visibleDays);
      const goals = solutions.openGoalItems(report, visibleDays);
      const goal = goals[0];
      if (!goal) throw new Error("Benchmark-Szenario erzeugt kein offenes Plan-Check-Ziel");

      // Warm up once, then measure the synchronous and current cooperative
      // implementations against the same immutable visible-day snapshot.
      solutions.findSolution(goal, visibleDays);
      await solutions.findSolutionAsync(goal, visibleDays, { yieldControl: () => Promise.resolve() });

      const syncTimes = [];
      const asyncTimes = [];
      for (let index = 0; index < 5; index += 1) {
        let start = performance.now();
        const syncSolution = solutions.findSolution(goal, visibleDays);
        syncTimes.push(performance.now() - start);
        if (!syncSolution) throw new Error("Synchroner Plan-Check-Solver lieferte keine Lösung");

        start = performance.now();
        const asyncSolution = await solutions.findSolutionAsync(goal, visibleDays, {
          yieldControl: () => Promise.resolve(),
        });
        asyncTimes.push(performance.now() - start);
        if (!asyncSolution) throw new Error("Kooperativer Plan-Check-Solver lieferte keine Lösung");
      }

      return {
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        visiblePlan: {
          date: on,
          days: visibleDays.length,
          cold: summarizeValues(visibleCold),
          warmHitMs: Number(visibleWarmMs.toFixed(2)),
        },
        planCheck: {
          goalCode: goal.code,
          goalKey: solutions.goalKey(goal),
          candidateCount: (visibleDays || []).flatMap((day) => day.meals || [])
            .filter((meal) => meal?.active && !meal.empty && meal.focusId).length,
          synchronous: summarizeValues(syncTimes),
          cooperative: summarizeValues(asyncTimes),
        },
      };
    });

    console.log(JSON.stringify(result, null, 2));
    await context.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
