const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const source = require("fs").readFileSync("js/planner-week-cache.js", "utf8");

test("Planner-Wochen-Cache bleibt abgeleitet und versioniert", () => {
  assert.match(source, /const CACHE_VERSION = 2/);
  assert.match(source, /preservePlanCache/);
  assert.match(source, /when Workers are unavailable, the requested week is built on demand/i);
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
  assert.ok(sw.includes("./js/planner-week-cache.js?v=10.1.26&planner-cache=4"));
  assert.ok(html.includes("js/planner-week-cache.js?v=10.1.26&planner-cache=4"));
assert.ok(sw.includes("./js/planner-week-worker.js?v=10.1.26"));
});

test("Worker-Warmup bleibt revisionssicher und optional", () => {
  assert.ok(source.includes("inputRevision"));
  assert.ok(source.includes("postMessage"));
  assert.ok(source.includes("planner-week-worker.js"));
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

test("Planner-aware prepDemand verwendet denselben sichtbaren Wochen-Snapshot", () => {
  const source = require("fs").readFileSync("js/planner-log-rollover.js", "utf8");
  const start = source.indexOf("prepDemand = function plannerAwarePrepDemand()");
  assert.notEqual(start, -1);
  const body = source.slice(start, source.indexOf("\n  };", start));
  assert.match(body, /mergeCarriedIntoDays\([\s\S]*viewRenderPlanDays\(from, 7\)/);
  assert.doesNotMatch(body, /mergeCarriedIntoDays\(buildDays\(from, 7\)\)/);
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
