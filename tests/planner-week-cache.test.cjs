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
