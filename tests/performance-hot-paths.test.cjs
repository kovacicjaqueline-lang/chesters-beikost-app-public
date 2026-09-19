"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("sichtbarkeitskritische Planner-Dateien werden ohne Änderung ihrer Installationsreihenfolge vorgeladen", () => {
  const html = read("index.html");
  const loader = read("js/utils.js");
  const version = "10.1.26";
  const criticalFiles = [
    "js/planner-meal-eligibility.js",
    "js/planner-milk-policy.js",
    "js/planner-iron-preference.js",
    "data/food-presentation.js",
    "js/planner-meal-presentation.js",
    "js/planner-recipe-first.js",
    "js/planner-proactive-recipe.js",
    "js/planner-food-role-stability.js",
    "js/planner-quality-rotation.js",
    "js/planner-introduction-policy.js",
    "js/planner-allergen-maintenance.js",
    "data/food-handling.js",
    "js/handling-readiness.js",
  ];

  for (const file of criticalFiles) {
    assert.ok(
      html.includes(`<link rel="preload" as="script" href="${file}?v=${version}">`),
      `${file} muss bereits während des HTML-Parsens geladen werden`,
    );
  }
  assert.ok(criticalFiles.every((file) => loader.includes(`${file}?v=${version}`)));
});

test("FOOD-Lookups bauen pro unverändertem Datenbestand nur einen Index", () => {
  let normalizeCalls = 0;
  const context = {
    console,
    normalizeName(value) {
      normalizeCalls += 1;
      return String(value || "").toLowerCase();
    },
    state: {
      foods: [
        { id: "a", name: "Apfel", alias: "Apple" },
        { id: "b", name: "Banane", alias: "Banana" },
      ],
    },
  };
  vm.createContext(context);
  vm.runInContext(read("js/utils.js"), context);

  assert.equal(context.food("b").name, "Banane");
  assert.equal(context.foodByName("Apple").id, "a");
  const afterFirstLookup = normalizeCalls;
  for (let index = 0; index < 20; index++) {
    assert.equal(context.food("a").id, "a");
    assert.equal(context.foodByName("Banana").id, "b");
  }
  assert.equal(normalizeCalls, afterFirstLookup + 20, "wiederholte Namenssuche darf nur noch den Suchbegriff normalisieren");

  context.state.foods.push({ id: "c", name: "Couscous", alias: "" });
  assert.equal(context.food("c").name, "Couscous", "Längenänderungen müssen den Index automatisch erneuern");
});

test("Log-Zuordnung wird einmal je Logbestand aufgebaut und nach Änderungen erneuert", () => {
  const logs = [
    { id: "2", date: "2026-02-02", createdAt: "b", foodIds: ["apfel"] },
    { id: "1", date: "2026-02-01", createdAt: "a", foodIds: ["apfel", "banane"] },
  ];
  const context = {
    console,
    state: { foods: [], logs, settings: { birthDate: "2026-01-01" } },
    FOOD_DB: [],
    STATUS_ORDER: {},
  };
  vm.createContext(context);
  vm.runInContext(read("js/model.js"), context);

  const first = context.logsFor("apfel");
  assert.deepEqual(Array.from(first, (entry) => entry.id), ["1", "2"]);
  assert.strictEqual(context.logsFor("apfel"), first, "unveränderte Logs dürfen nicht erneut gefiltert und sortiert werden");

  logs.push({ id: "3", date: "2026-02-03", createdAt: "c", foodIds: ["apfel"] });
  const updated = context.logsFor("apfel");
  assert.notStrictEqual(updated, first);
  assert.deepEqual(Array.from(updated, (entry) => entry.id), ["1", "2", "3"]);
});

test("Log-Index teilt Planner-Aggregate und Kombinationshistorien", () => {
  const logs = [
    {
      id: "eaten-1",
      date: "2026-02-01",
      meal: "lunch",
      foodIds: ["apfel", "hafer"],
      foodOutcomes: { apfel: "eaten", hafer: "eaten" },
      createdAt: "2026-02-01T10:00:00.000Z",
    },
    {
      id: "refused",
      date: "2026-02-02",
      meal: "lunch",
      foodIds: ["apfel", "hafer"],
      foodOutcomes: { apfel: "not_accepted", hafer: "eaten" },
      rejectionStrength: "refused",
      createdAt: "2026-02-02T10:00:00.000Z",
    },
  ];
  const context = {
    console,
    state: { foods: [], logs, settings: { birthDate: "2026-01-01" } },
    FOOD_DB: [],
    STATUS_ORDER: {},
    logExposureKey: (log) => `${log.date}|${log.meal}`,
  };
  vm.createContext(context);
  vm.runInContext(read("js/model.js"), context);
  vm.runInContext(read("js/planning.js"), context);

  assert.equal(context.usageCount("apfel"), 1);
  assert.equal(context.eatenExposureCount("apfel"), 1);
  assert.deepEqual(Array.from(context.combinationHistory(["hafer", "apfel"]), (log) => log.id), ["eaten-1", "refused"]);
  assert.deepEqual(Array.from(context.refusalHistory("apfel"), (log) => log.id), ["refused"]);
  assert.equal(context.latestLogForFood("apfel").id, "refused");

  logs[0].foodOutcomes.apfel = "not_accepted";
  context.invalidateLogsForCache();
  assert.equal(context.usageCount("apfel"), 0, "in-place Logänderungen müssen nach expliziter Invalidierung frisch ausgewertet werden");
});

test("Inventory-Aggregate werden gemeinsam aufgebaut und nach Mengenänderung invalidiert", () => {
  const inventory = [
    { id: "a", kind: "food", foodId: "apfel", portions: 2, gramsPerPortion: 35, frozenDate: "2026-02-01" },
    { id: "b", kind: "food", foodId: "apfel", portions: 1, gramsPerPortion: 20, frozenDate: "2026-02-02" },
    { id: "recipe", kind: "recipe", recipeName: "Obst-Haferbrei", portions: 2 },
  ];
  const context = {
    console,
    state: { foods: [], inventory },
    food: () => null,
    RECIPES: [],
    normalizeName: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
  };
  vm.createContext(context);
  vm.runInContext(read("js/prep.js"), context);

  assert.equal(context.inventoryPortions("apfel"), 3);
  assert.equal(context.inventoryGrams("apfel"), 90);
  assert.equal(context.inventoryRecipePortions("Obst-Haferbrei"), 2);
  inventory.push({ id: "legacy-recipe", kind: "recipe", recipeName: "Legacy-Rezept", portions: 2 });
  context.invalidateInventoryAggregateCache();
  assert.equal(context.inventoryRecipePortions("legacy rezept"), 2, "Rezeptnamen müssen wie der bestehende Matcher normalisiert werden");
  assert.strictEqual(context.inventoryAggregateIndex(), context.inventoryAggregateIndex());

  inventory[0].portions = 1;
  context.invalidateInventoryAggregateCache();
  assert.equal(context.inventoryPortions("apfel"), 2);
  assert.equal(context.inventoryGrams("apfel"), 55);
});

test("Legacy-Plan-Migration invalidiert den Log-Index nach der Zuordnung", () => {
  const core = require("../js/planner-log-rollover.js");
  const logs = [{
    id: "legacy-log",
    date: "2026-02-01",
    meal: "lunch",
    foodIds: ["apfel"],
    outcome: "eaten",
    createdAt: "2026-02-01T10:00:00.000Z",
  }];
  const context = {
    console,
    state: { foods: [], logs, settings: {} },
    FOOD_DB: [],
    STATUS_ORDER: {},
  };
  vm.createContext(context);
  vm.runInContext(read("js/model.js"), context);
  const previousIndex = global.logIndexFor;
  const previousInvalidate = global.invalidateLogsForCache;
  global.logIndexFor = context.logIndexFor;
  global.invalidateLogsForCache = context.invalidateLogsForCache;
  try {
    const data = {
      logs,
      planLocks: { "2026-02-01|lunch": { focusId: "apfel", foodIds: ["apfel"] } },
      manualMeals: {},
      backupMeta: { plannerLinking: { version: 0 } },
    };
    core.upgradePlannerLinking(data);
    const planId = data.planLocks["2026-02-01|lunch"].planId;
    assert.equal(logs[0].plannedMealId, planId);
    assert.equal(core.linkedCompletionLog(data, planId, "2026-02-01", "lunch").id, "legacy-log");
  } finally {
    if (previousIndex === undefined) delete global.logIndexFor;
    else global.logIndexFor = previousIndex;
    if (previousInvalidate === undefined) delete global.invalidateLogsForCache;
    else global.invalidateLogsForCache = previousInvalidate;
  }
});

test("Planner-Log-Index beschleunigt Completion- und Tageslogzugriff ohne Auswahländerung", () => {
  const core = require("../js/planner-log-rollover.js");
  const logs = [
    { id: "older", date: "2026-02-01", meal: "lunch", plannedMealId: "plan-1", outcome: "tried", createdAt: "2026-02-01T10:00:00.000Z" },
    { id: "newer", date: "2026-02-01", meal: "lunch", plannedMealId: "plan-1", outcome: "not_offered", createdAt: "2026-02-01T11:00:00.000Z" },
    { id: "free", date: "2026-02-01", meal: "breakfast", outcome: "tried", createdAt: "2026-02-01T09:00:00.000Z" },
  ];
  const context = {
    console,
    state: { foods: [], logs, settings: {} },
    FOOD_DB: [],
    STATUS_ORDER: {},
  };
  vm.createContext(context);
  vm.runInContext(read("js/model.js"), context);
  const previous = global.logIndexFor;
  global.logIndexFor = context.logIndexFor;
  try {
    assert.equal(core.linkedCompletionLog({ logs }, "plan-1", "2026-02-01", "lunch").id, "older");
    assert.deepEqual(Array.from(core.logsForDate({ logs }, "2026-02-01"), (log) => log.id), ["free", "older", "newer"]);
  } finally {
    if (previous === undefined) delete global.logIndexFor;
    else global.logIndexFor = previous;
  }
});

test("Prep berechnet den vollständigen Rezeptstatus nur einmal pro Render", () => {
  const source = read("js/prep.js");
  const start = source.indexOf("function renderPrepCore()");
  const end = source.indexOf("\nfunction recipeIngredientReady", start);
  const body = source.slice(start, end);
  assert.equal((body.match(/recipeStates\(\)/g) || []).length, 1);
  assert.match(body, /viewRenderRecipeStates\(\)/);
});

test("ein View-Renderzyklus teilt identische Planner-, Rezept- und Prep-Berechnungen", () => {
  let buildCalls = 0;
  let recipeCalls = 0;
  let prepCalls = 0;
  const context = {
    console,
    buildDays: (...args) => { buildCalls += 1; return args; },
    recipeStates: () => { recipeCalls += 1; return []; },
    prepDemand: () => { prepCalls += 1; return []; },
  };
  vm.createContext(context);
  vm.runInContext(read("js/ui.js"), context);

  context.withViewRenderCycle("prep", () => {
    assert.strictEqual(context.viewRenderBuildDays("2026-02-01", 7), context.viewRenderBuildDays("2026-02-01", 7));
    assert.strictEqual(context.viewRenderRecipeStates(), context.viewRenderRecipeStates());
    assert.strictEqual(context.viewRenderPrepDemand(), context.viewRenderPrepDemand());
  });

  assert.equal(buildCalls, 1);
  assert.equal(recipeCalls, 1);
  assert.equal(prepCalls, 1);
  context.viewRenderBuildDays("2026-02-01", 7);
  context.viewRenderRecipeStates();
  context.viewRenderPrepDemand();
  assert.equal(buildCalls, 2, "der Cache darf nicht über den Renderzyklus hinaus leben");
  assert.equal(recipeCalls, 2, "Rezeptstatus muss nach dem Renderzyklus wieder frisch berechnet werden");
  assert.equal(prepCalls, 2, "Prep-Bedarf muss nach dem Renderzyklus wieder frisch berechnet werden");
});

test("Rezeptstatus und Prep-Bedarf nutzen den zentralen View-Rendercache", () => {
  const recipes = read("js/recipes.js");
  const prep = read("js/prep.js");
  assert.match(recipes, /memoizeViewRenderValue\("recipeStates", computeRecipeStates\)/);
  assert.match(prep, /memoizeViewRenderValue\("prepDemand", computePrepDemand\)/);
});

test("Planner-Boot wiederholt den bereits in migrateState erfolgten Save und Render nicht", () => {
  const source = read("js/planner-log-rollover.js");
  const block = source.match(/bootstrapStorage = async function plannerAwareBootstrapStorage\(\) \{([\s\S]*?)\n  \};/);
  assert.ok(block);
  assert.doesNotMatch(block[1], /CORE\.upgradePlannerLinking|await save\(|renderCurrentView\(/);
  assert.match(block[1], /plannerStorageReady = true/);
});

test("IndexedDB-Verbindung wird zwischen Reads und Writes wiederverwendet", async () => {
  let openCalls = 0;
  const records = new Map([["state", { revision: 1 }]]);
  const database = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction() {
      const transaction = {
        objectStore() {
          return {
            get(key) {
              const request = {};
              queueMicrotask(() => {
                request.result = records.get(key);
                request.onsuccess?.();
                queueMicrotask(() => transaction.oncomplete?.());
              });
              return request;
            },
            put(value, key) {
              queueMicrotask(() => {
                records.set(key, value);
                transaction.oncomplete?.();
              });
            },
          };
        },
      };
      return transaction;
    },
  };
  const indexedDB = {
    open() {
      openCalls += 1;
      const request = {};
      queueMicrotask(() => {
        request.result = database;
        request.onsuccess?.();
      });
      return request;
    },
  };
  const context = {
    console,
    queueMicrotask,
    indexedDB,
    window: { indexedDB },
    document: { addEventListener() {} },
    navigator: {},
    today: () => "2026-09-18",
    DB_NAME: "test",
    DB_VERSION: 1,
    DB_STORE: "app",
    KEY: "test-state",
  };
  vm.createContext(context);
  vm.runInContext(`${read("js/storage.js")}\nthis.__idb = { idbGet, idbPut };`, context);

  assert.deepEqual({ ...(await context.__idb.idbGet("state")) }, { revision: 1 });
  await context.__idb.idbPut("state", { revision: 2 });
  assert.deepEqual({ ...(await context.__idb.idbGet("state")) }, { revision: 2 });
  assert.equal(openCalls, 1);
});
