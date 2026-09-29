const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const source = require("fs").readFileSync("js/planner-week-cache.js", "utf8");

test("Planner-Wochen-Cache bleibt abgeleitet und versioniert", () => {
  assert.match(source, /const CACHE_VERSION = 2/);
  assert.match(source, /preservePlanCache/);
  assert.match(source, /buildDays\(start, 7, false\)/);
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
  assert.match(sw, /const UI_PRECACHE = \[[\s\S]*\.\/js\/planner-week-cache\.js\?v=10\.1\.26/);
assert.ok(sw.includes("./js/planner-week-worker.js?v=10.1.26"));
});

test("Worker-Warmup bleibt revisionssicher und optional", () => {
  assert.ok(source.includes("inputRevision"));
  assert.ok(source.includes("postMessage"));
  assert.ok(source.includes("planner-week-worker.js"));
});

test("gültige Wochen werden wiederverwendet und fachliche Saves verwerfen den Cache", () => {
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
  assert.equal(buildCalls, 3, "zwei weitere Wochen werden im Warmup vorbereitet");

  const revisionBeforeNavigationSave = context.__plannerWeekCache.revision;
  context.save({ preservePlanCache: true });
  assert.equal(context.__plannerWeekCache.revision, revisionBeforeNavigationSave);
  assert.equal(saveCalls, 1);

  context.save();
  assert.equal(context.__plannerWeekCache.revision, revisionBeforeNavigationSave + 1);
  assert.equal(context.__plannerWeekCache.size, 0);
});

test("Worker-Warmup setzt nach Navigation mit der aktuell sichtbaren Woche fort", () => {
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

  context.planDisplayDays(visibleFrom, 7);
  idleCallback?.({ didTimeout: true });
  assert.deepEqual([...requests[0].starts], ["2026-09-27", "2026-10-04"]);

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
