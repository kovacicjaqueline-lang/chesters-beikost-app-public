const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const source = require("fs").readFileSync("js/planner-week-cache.js", "utf8");

test("Planner-Wochen-Cache bleibt abgeleitet und versioniert", () => {
  assert.match(source, /const CACHE_VERSION = 3/);
  assert.match(source, /preservePlanCache/);
  assert.match(source, /when Workers are unavailable, the week is built on demand/i);
  assert.doesNotMatch(source, /function runMainThreadWarmup/);
  assert.match(source, /invalidate\("save"\)/);
  assert.doesNotMatch(source, /state\.planLocks\s*\[/);
});

test("Wochenwechsel erhält den Cache, fachliche Saves invalidieren ihn", () => {
  const mobilePlan = require("fs").readFileSync("js/plan-mobile-ui.js", "utf8");
  assert.match(source, /if \(!preserveForNavigation\(options\)\) \{[\s\S]*invalidate\("save"\)/);
  assert.match(mobilePlan, /save\(\{ preservePlanCache: true \}\)/);
});

test("Service Worker nimmt den Planner-Cache in den Offline-Precache auf", () => {
  const sw = require("fs").readFileSync("sw.js", "utf8");
  const html = require("fs").readFileSync("index.html", "utf8");
  assert.match(sw, /const UI_PRECACHE = \[[\s\S]*\.\/js\/planner-week-cache\.js\?v=10\.1\.26/);
  assert.ok(sw.includes("./js/planner-week-cache.js?v=10.1.26&planner-cache=5"));
  assert.ok(html.includes("js/planner-week-cache.js?v=10.1.26&planner-cache=5"));
assert.ok(sw.includes("./js/planner-week-worker.js?v=10.1.26"));
});

test("Worker-Warmup bleibt revisionssicher und optional", () => {
  assert.ok(source.includes("inputRevision"));
  assert.ok(source.includes("postMessage"));
  assert.ok(source.includes("planner-week-worker.js"));
});

test("sichtbare Auto-Snapshots bewahren den soeben berechneten Wochen-Cache", () => {
  const source = require("fs").readFileSync("js/planner-log-rollover-review-fixes.js", "utf8");
  assert.match(source, /if \(result\.changed\) \{\s*if \(storageReady\) save\(\{ preservePlanCache: true \}\)/);
});

test("gültige Wochen werden wiederverwendet und Warmup blockiert ohne Worker nicht den Hauptthread", () => {
  let buildCalls = 0;
  let saveCalls = 0;
  let idleCallback = null;
  const context = {
    console,
    state: { settings: {} },
    visiblePlanStart: () => "2026-09-20",
    addDays: (date, offset) => `${date}+${offset}`,
    buildDays: (from, count) => {
      buildCalls += 1;
      return [{ date: from, meals: [{ meal: "lunch", active: true, focusId: `f-${buildCalls}` }] }];
    },
    planDisplayDays: (from, count) => context.buildDays(from, count),
    save: () => { saveCalls += 1; },
    requestIdleCallback: (callback) => { idleCallback = callback; return 1; },
    cancelIdleCallback: () => {},
    clone: (value) => JSON.parse(JSON.stringify(value)),
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const first = context.planDisplayDays("2026-09-20", 7);
  const second = context.planDisplayDays("2026-09-20", 7);
  assert.equal(buildCalls, 1);
  assert.deepEqual(second, first);
  assert.notStrictEqual(second, first);

  context.__plannerWeekCache.warmup();
  idleCallback?.({ didTimeout: true });
  assert.equal(buildCalls, 1, "ohne Worker wird keine Zukunftswoche synchron im UI-Thread berechnet");

  const revisionBeforeNavigationSave = context.__plannerWeekCache.revision;
  context.save({ preservePlanCache: true });
  assert.equal(context.__plannerWeekCache.revision, revisionBeforeNavigationSave);
  assert.equal(saveCalls, 1);

  context.save();
  assert.equal(context.__plannerWeekCache.revision, revisionBeforeNavigationSave + 1);
  assert.equal(context.__plannerWeekCache.size, 0);
});

test("Prep bekommt aktuelle Vorratsreservierungen ohne Deep Clone des Wochenplans", () => {
  let cloneCalls = 0;
  const context = {
    state: { settings: {} },
    visiblePlanStart: () => "2026-09-20",
    addDays: (date, offset) => `${date}+${offset}`,
    buildDays: (from) => [{ date: from, meals: [{ meal: "lunch", foodIds: ["karotte"] }] }],
    planDisplayDays: (from, count) => context.buildDays(from, count),
    reserveMealInventory: () => {},
    clone: (value) => {
      cloneCalls += 1;
      return JSON.parse(JSON.stringify(value));
    },
    requestIdleCallback: () => 1,
    cancelIdleCallback: () => {},
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const first = context.planDisplayDays("2026-09-20", 7);
  const readOnly = context.__plannerWeekCache.readOnly("2026-09-20", 7);
  const readOnlyAgain = context.__plannerWeekCache.readOnly("2026-09-20", 7);
  const second = context.planDisplayDays("2026-09-20", 7);
  second[0].meals[0].foodIds.push("brokkoli");
  const afterPublicMutation = context.__plannerWeekCache.readOnly("2026-09-20", 7);

  assert.deepEqual([...afterPublicMutation[0].meals[0].foodIds], ["karotte"]);
  assert.equal(cloneCalls, 3, "Read-only Prep-Lookup benötigt keinen zusätzlichen Deep Clone");
  assert.notStrictEqual(readOnly, readOnlyAgain, "Vorratsreservierungen werden in isolierten Overlay-Kopien aktualisiert");
  assert.notStrictEqual(readOnly, afterPublicMutation, "Overlay-Rückgaben verändern den internen Snapshot nicht");
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(second, readOnly);
});

test("Planner-aware prepDemand verwendet denselben sichtbaren Wochen-Snapshot", () => {
  const source = require("fs").readFileSync("js/planner-log-rollover.js", "utf8");
  const start = source.indexOf("prepDemand = function plannerAwarePrepDemand()");
  assert.notEqual(start, -1);
  const body = source.slice(start, source.indexOf("\n  };", start));
  assert.match(body, /mergeCarriedIntoDays\([\s\S]*viewRenderPlanDays\(from, 7\)/);
  assert.doesNotMatch(body, /mergeCarriedIntoDays\(buildDays\(from, 7\)\)/);
});

test("Worker-Warmup umfasst die sichtbare Woche und setzt nach Navigation fort", () => {
  let visibleFrom = "2026-09-20";
  let idleCallback = null;
  let worker = null;
  const requests = [];
  const addDays = (date, offset) => {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const context = {
    URL,
    document: { baseURI: "https://app.example/" },
    state: { settings: { phaseSelected: "kennenlernen" } },
    visiblePlanStart: () => visibleFrom,
    addDays,
    buildDays: (from) => [{ date: from, meals: [] }],
    planDisplayDays: (from, count) => context.buildDays(from, count),
    requestIdleCallback: (callback) => { idleCallback = callback; return 1; },
    cancelIdleCallback: () => {},
    clone: (value) => JSON.parse(JSON.stringify(value)),
    Worker: class {
      constructor() { worker = this; }
      postMessage(message) { requests.push(message); }
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  context.__plannerWeekCache.warmup();
  idleCallback?.({ didTimeout: true });
  assert.deepEqual([...requests[0].starts], ["2026-09-20", "2026-09-27", "2026-10-04"]);

  // The user navigates while the first background request is still running.
  visibleFrom = "2026-09-27";
  worker.onmessage({ data: {
    type: "result",
    requestId: requests[0].requestId,
    inputRevision: requests[0].inputRevision,
    weeks: requests[0].starts.map((from) => ({
      from,
      count: 7,
      days: [{ date: from, meals: [] }],
    })),
  } });

  assert.equal(typeof idleCallback, "function", "nach dem Worker-Ergebnis wird der nächste Warmup-Zyklus geplant");
  idleCallback?.({ didTimeout: true });
  assert.equal(requests.length, 2);
  assert.deepEqual([...requests[1].starts], ["2026-10-11"], "bereits vorbereitete Wochen werden nicht erneut angefordert");
});

test("aktuelle sichtbare Woche startet nach Planner-Readiness automatisch im Worker-Warmup", async () => {
  let resolveReadiness;
  let idleCallback = null;
  let worker = null;
  const requests = [];
  const addDays = (date, offset) => {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const context = {
    URL,
    document: { baseURI: "https://app.example/" },
    state: { settings: { phaseSelected: "kennenlernen" } },
    visiblePlanStart: () => "2026-09-30",
    addDays,
    buildDays: (from) => [{ date: from, meals: [] }],
    planDisplayDays: (from, count) => context.buildDays(from, count),
    requestIdleCallback: (callback) => { idleCallback = callback; return 1; },
    cancelIdleCallback: () => {},
    clone: (value) => JSON.parse(JSON.stringify(value)),
    PlannerReadiness: {
      whenReady: () => new Promise((resolve) => { resolveReadiness = resolve; }),
    },
    Worker: class {
      constructor() { worker = this; }
      postMessage(message) { requests.push(message); }
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  resolveReadiness({ state: "ready" });
  await Promise.resolve();
  assert.equal(typeof idleCallback, "function", "Readiness muss das Hintergrund-Warmup anstoßen");
  idleCallback({ didTimeout: true });
  assert.deepEqual([...requests[0].starts], ["2026-09-30", "2026-10-07", "2026-10-14"]);

  worker.onmessage({ data: {
    type: "result",
    requestId: requests[0].requestId,
    inputRevision: requests[0].inputRevision,
    weeks: requests[0].starts.map((from) => ({ from, count: 7, days: [{ date: from, meals: [] }] })),
  } });
  assert.equal(context.__plannerWeekCache.has("2026-09-30", 7), true, "erste sichtbare Woche muss danach direkt aus dem Cache kommen");
});


test("ein Phasenwechsel kann keinen Wochenplan aus der vorherigen Phase zurückgeben", () => {
  let buildCalls = 0;
  const context = {
    state: { settings: { phaseSelected: "drei" } },
    visiblePlanStart: () => "2026-09-26",
    addDays: (date, offset) => `${date}+${offset}`,
    buildDays: (from) => {
      buildCalls += 1;
      const meals = context.state.settings.phaseSelected === "aufbau"
        ? ["lunch", "dinner"]
        : ["breakfast", "lunch", "dinner"];
      return [{ date: from, meals: meals.map((meal) => ({ meal, active: true })) }];
    },
    planDisplayDays: (from, count) => context.buildDays(from, count),
    clone: (value) => JSON.parse(JSON.stringify(value)),
    requestIdleCallback: () => 1,
    cancelIdleCallback: () => {},
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const threeMeals = context.planDisplayDays("2026-09-26", 7);
  context.state.settings.phaseSelected = "aufbau";
  const twoMeals = context.planDisplayDays("2026-09-26", 7);

  assert.deepEqual(threeMeals[0].meals.map((meal) => meal.meal), ["breakfast", "lunch", "dinner"]);
  assert.deepEqual(twoMeals[0].meals.map((meal) => meal.meal), ["lunch", "dinner"]);
  assert.equal(buildCalls, 2);
});

test("Vorratsänderungen behalten Mahlzeiten und aktualisieren nur die Reservierung", () => {
  let builds = 0;
  const context = {
    state: { settings: {}, inventory: [] },
    visiblePlanStart: () => "2026-09-20",
    addDays: (date, offset) => `${date}+${offset}`,
    buildDays: (from) => {
      builds += 1;
      const stocked = context.state.inventory.some((item) => item.recipeName === "Rezept A" && item.portions > 0);
      return [{ date: from, meals: ["lunch", "dinner"].map((meal) => ({ meal, active: true, recipeName: stocked ? "Rezept B" : "Rezept A", recipeInventoryId: "", inventoryFoodIds: [] })) }];
    },
    planDisplayDays: (from, count) => context.buildDays(from, count),
    recipeInventoryPortions: (name) => context.state.inventory
      .filter((item) => item.kind === "recipe" && item.recipeName === name && item.portions > 0)
      .reduce((sum, item) => sum + item.portions, 0),
    oldestRecipeBatch: (name) => context.state.inventory
      .filter((item) => item.kind === "recipe" && item.recipeName === name && item.portions > 0)
      .sort((a, b) => String(a.frozenDate || "").localeCompare(String(b.frozenDate || "")))[0] || null,
    reserveMealInventory: (meal, reservationContext) => {
      if (meal.recipeInventoryId) {
        reservationContext.recipeReserved.set(
          meal.recipeName,
          (reservationContext.recipeReserved.get(meal.recipeName) || 0) + 1,
        );
      }
      return meal;
    },
    save: () => {},
    requestIdleCallback: () => 1,
    cancelIdleCallback: () => {},
    clearTimeout: () => {},
    clone: (value) => JSON.parse(JSON.stringify(value)),
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const initial = context.planDisplayDays("2026-09-20", 1)[0].meals;
  assert.deepEqual(initial.map((meal) => meal.recipeName), ["Rezept A", "Rezept A"]);
  assert.equal(builds, 1);

  context.state.inventory.push({ id: "batch-a", kind: "recipe", recipeName: "Rezept A", portions: 2 });
  context.save({ preservePlanCache: true });
  const stocked = context.planDisplayDays("2026-09-20", 1)[0].meals;
  assert.deepEqual(stocked.map((meal) => meal.recipeName), ["Rezept A", "Rezept A"]);
  assert.deepEqual(stocked.map((meal) => meal.recipeInventoryId), ["batch-a", "batch-a"]);
  assert.equal(context.__plannerWeekCache.readOnly("2026-09-20", 1)[0].meals[0].recipeInventoryId, "batch-a");
  assert.equal(builds, 1, "Vorrat hinzufügen rechnet keine Mahlzeit neu aus");

  context.state.inventory[0].portions = 1;
  context.save({ preservePlanCache: true });
  const edited = context.planDisplayDays("2026-09-20", 1)[0].meals;
  assert.deepEqual(edited.map((meal) => meal.recipeName), ["Rezept A", "Rezept A"]);
  assert.deepEqual(edited.map((meal) => meal.recipeInventoryId), ["batch-a", ""], "Bearbeiten aktualisiert die Deckung ohne die Rezeptauswahl oder verfügbare Portionen zu überbuchen");

  context.state.inventory = [];
  context.save({ preservePlanCache: true });
  const deleted = context.planDisplayDays("2026-09-20", 1)[0].meals;
  assert.deepEqual(deleted.map((meal) => meal.recipeName), ["Rezept A", "Rezept A"]);
  assert.deepEqual(deleted.map((meal) => meal.recipeInventoryId), ["", ""], "Löschen entfernt nur die Vorratsdeckung");
  assert.equal(context.__plannerWeekCache.readOnly("2026-09-20", 1)[0].meals[0].recipeInventoryId, "");
  assert.equal(builds, 1);

  context.state.inventory.push({ id: "batch-a-again", kind: "recipe", recipeName: "Rezept A", portions: 1 });
  context.save({ preservePlanCache: true });
  context.state.inventory[0].portions -= 1;
  context.save({ preservePlanCache: true });
  const consumed = context.planDisplayDays("2026-09-20", 1)[0].meals;
  assert.deepEqual(consumed.map((meal) => meal.recipeName), ["Rezept A", "Rezept A"]);
  assert.deepEqual(consumed.map((meal) => meal.recipeInventoryId), ["", ""]);
  assert.equal(builds, 1, "−1 aktualisiert die Deckung ohne Neuberechnung");

  context.state.inventory.push({ id: "batch-a-replan", kind: "recipe", recipeName: "Rezept A", portions: 1 });
  context.save();
  const replanned = context.planDisplayDays("2026-09-20", 1)[0].meals;
  assert.deepEqual(replanned.map((meal) => meal.recipeName), ["Rezept B", "Rezept B"], "ein normaler Planner-Save darf die Auswahl neu berechnen");
  assert.equal(builds, 2);
});
