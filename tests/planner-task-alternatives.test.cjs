"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const task = require(path.join(root, "js", "planner-task-alternatives.js"));

function activeMeal(overrides = {}) {
  return {
    active: true,
    empty: false,
    meal: "lunch",
    focusId: "gurke",
    foodIds: ["kartoffel", "gurke"],
    baseFoodIds: ["kartoffel"],
    sampleFoodIds: ["gurke"],
    type: "neu",
    ...overrides,
  };
}

test("TASK-ALT-01: Lernvertrag hält Fokus, Sample und Lernart exakt fest", () => {
  const contract = task.deriveTaskContract(activeMeal());
  assert.equal(contract.kind, "learning");
  assert.equal(contract.focusId, "gurke");
  assert.deepEqual([...contract.sampleFoodIds], ["gurke"]);
  assert.equal(contract.type, "neu");

  assert.equal(task.candidatePreservesTask(contract, activeMeal({
    foodIds: ["reis", "gurke"],
    baseFoodIds: ["reis"],
    recipeName: "Gurke-Reis",
  })), true);
  assert.equal(task.candidatePreservesTask(contract, activeMeal({ focusId: "birne", sampleFoodIds: ["birne"] })), false);
  assert.equal(task.candidatePreservesTask(contract, activeMeal({ type: "gezielt wiederholen" })), false);
  assert.equal(task.candidatePreservesTask(contract, activeMeal({ sampleFoodIds: ["gurke", "birne"] })), false);
});

test("TASK-ALT-02: alle fachlichen Lernarten bleiben dieselbe konkrete Aufgabe", () => {
  for (const type of ["neu", "gezielt wiederholen", "Allergen einführen", "Allergen wiederholen"]) {
    const current = activeMeal({ type, focusId: "ei", sampleFoodIds: ["ei"], foodIds: ["kartoffel", "ei"] });
    const contract = task.deriveTaskContract(current);
    assert.equal(task.candidatePreservesTask(contract, {
      ...current,
      foodIds: ["hafer", "ei"],
      baseFoodIds: ["hafer"],
      recipeName: "Alternative mit Ei",
    }), true, type);
    assert.equal(task.candidatePreservesTask(contract, {
      ...current,
      focusId: "fisch",
      sampleFoodIds: ["fisch"],
      foodIds: ["kartoffel", "fisch"],
    }), false, `${type}: anderes FOOD darf die Aufgabe nicht ersetzen`);
  }
});

test("TASK-ALT-03: bekannte Mahlzeit bleibt sample-frei, darf aber FOOD oder Rezept wechseln", () => {
  const contract = task.deriveTaskContract(activeMeal({
    focusId: "apfel",
    foodIds: ["apfel", "hafer"],
    baseFoodIds: ["hafer"],
    sampleFoodIds: [],
    type: "bekannt kombinieren",
  }));
  assert.equal(contract.kind, "known");
  assert.equal(task.candidatePreservesTask(contract, activeMeal({
    focusId: "banane",
    foodIds: ["banane", "hirse"],
    baseFoodIds: ["hirse"],
    sampleFoodIds: [],
    type: "Rezept",
    recipeName: "Bananen-Hirse-Brei",
  })), true);
  assert.equal(task.candidatePreservesTask(contract, activeMeal({ sampleFoodIds: ["birne"] })), false);
});

test("TASK-ALT-04: etablierte Allergenpflege darf Quelle wechseln, aber nicht das Maintenance-Ziel verlieren", () => {
  const current = activeMeal({
    focusId: "hafer",
    foodIds: ["hafer", "apfel"],
    baseFoodIds: ["apfel"],
    sampleFoodIds: [],
    type: "bekannt kombinieren",
  });
  const contract = task.deriveTaskContract(current, ["allergen:Glutenhaltiges Getreide"]);
  assert.equal(contract.kind, "maintenance");

  const alternativeSource = activeMeal({
    focusId: "weizen",
    foodIds: ["weizen", "apfel"],
    baseFoodIds: ["apfel"],
    sampleFoodIds: [],
    type: "Rezept",
    recipeName: "Apfel-Weizen-Brei",
  });
  assert.equal(task.candidatePreservesTask(
    contract,
    alternativeSource,
    ["allergen:Glutenhaltiges Getreide"],
  ), true);
  assert.equal(task.candidatePreservesTask(contract, alternativeSource, ["family:sesam"]), false);
  assert.equal(task.candidatePreservesTask(contract, { ...alternativeSource, sampleFoodIds: ["sesam"] }, ["allergen:Glutenhaltiges Getreide"]), false);
});

test("TASK-ALT-05: Rezept und FOOD-only bleiben unterschiedliche Ideen bei identischen FOOD-IDs", () => {
  const foodOnly = activeMeal({ sampleFoodIds: [], type: "bekannt" });
  const recipe = { ...foodOnly, recipeName: "Kartoffel-Gurke", type: "Rezept" };
  assert.notEqual(task.candidateIdentity(foodOnly), task.candidateIdentity(recipe));
  assert.equal(task.candidateIdentity({ ...recipe, foodIds: ["gurke", "kartoffel"] }), task.candidateIdentity(recipe));
});

test("TASK-ALT-06: Runtime findet Recipe-first-/Basis-Alternativen ohne die Lernaufgabe oder State zu verändern", () => {
  const source = fs.readFileSync(path.join(root, "js", "planner-task-alternatives.js"), "utf8");
  const current = activeMeal({ recipeName: "Aktuelles Rezept" });
  const foods = [
    { id: "gurke", active: true },
    { id: "kartoffel", active: true },
    { id: "reis", active: true },
  ];
  const context = vm.createContext({
    console,
    Set,
    Map,
    Object,
    Array,
    Number,
    String,
    Math,
    Date,
    JSON,
    window: {},
    document: {},
    state: {
      settings: { planFrom: "2026-09-20" },
      foods,
      planLocks: {},
      manualMeals: {},
      overrides: {},
      autoLockExcluded: {},
      followUps: {},
    },
    __plannerRandomSwap: {
      slotKey: (date, meal) => `${date}|${meal}`,
      mergePlanDays: (left, right) => {
        const byDate = new Map();
        for (const day of [...left, ...right]) if (!byDate.has(day.date)) byDate.set(day.date, day);
        return [...byDate.values()];
      },
      automaticFocusAllowed: (item, meal, on, base, automatic, policy) =>
        !!item && base(item, meal, on) && automatic(item, on) && policy(item),
    },
    today: () => "2026-09-20",
    visiblePlanStart: () => "2026-09-20",
    planDisplayDays: () => [{ date: "2026-09-20", meals: [JSON.parse(JSON.stringify(current))] }],
    clone: (value) => JSON.parse(JSON.stringify(value)),
    mealSnapshot: (_date, _meal, meal) => JSON.parse(JSON.stringify(meal)),
    mealIsCompleted: () => false,
    food: (id) => foods.find((item) => item.id === id) || null,
    eligible: () => true,
    automaticFoodEligibility: () => true,
    plannerFoodCanBeAutomaticFocus: () => true,
    canCombine: () => true,
    introductionCandidate: () => ({ f: foods[0], type: "manuell" }),
    recipeStates: () => [{ name: "Aktuelles Rezept" }, { name: "Alternatives Rezept" }],
    companionFor: (focus) => context.state.foods.find((item) => item.id !== focus.id) || null,
    PlannerAllergenMaintenance: {
      targetKeysForFoodIds: () => [],
    },
  });
  context.buildDays = (from) => {
    const chosen = context.introductionCandidate("lunch", from, {}, []);
    const base = context.companionFor(chosen.f, "lunch", from, chosen.type);
    const recipe = context.recipeStates()[0] || null;
    const meal = {
      active: true,
      empty: false,
      meal: "lunch",
      focusId: chosen.f.id,
      foodIds: [...(base ? [base.id] : []), chosen.f.id],
      baseFoodIds: base ? [base.id] : [],
      sampleFoodIds: [chosen.f.id],
      type: chosen.type,
      recipeName: recipe?.name || "",
    };
    return [{ date: from, meals: [meal] }];
  };

  vm.runInContext(source, context);
  const before = JSON.stringify({
    planLocks: context.state.planLocks,
    overrides: context.state.overrides,
    excluded: context.state.autoLockExcluded,
    followUps: context.state.followUps,
  });
  const result = context.__plannerTaskAlternatives.taskPreservingAlternatives("2026-09-20", "lunch");

  assert.equal(result.ok, true);
  assert.equal(result.contract.kind, "learning");
  assert.ok(result.alternatives.length >= 2);
  assert.ok(result.alternatives.some((meal) => meal.recipeName === "Alternatives Rezept"));
  assert.ok(result.alternatives.some((meal) => meal.recipeName === ""));
  for (const meal of result.alternatives) {
    assert.equal(meal.focusId, "gurke");
    assert.deepEqual([...meal.sampleFoodIds], ["gurke"]);
    assert.equal(meal.type, "neu");
  }
  assert.equal(JSON.stringify({
    planLocks: context.state.planLocks,
    overrides: context.state.overrides,
    excluded: context.state.autoLockExcluded,
    followUps: context.state.followUps,
  }), before);

  context.state.manualMeals["2026-09-20|lunch"] = { manualAdded: false };
  assert.equal(
    context.__plannerTaskAlternatives.taskPreservingAlternatives("2026-09-20", "lunch").reason,
    "manual",
  );
  delete context.state.manualMeals["2026-09-20|lunch"];
  context.state.planLocks["2026-09-20|lunch"] = { followUpFoodId: "gurke" };
  assert.equal(
    context.__plannerTaskAlternatives.taskPreservingAlternatives("2026-09-20", "lunch").reason,
    "follow-up",
  );
});

test("TASK-ALT-07: Modul bleibt unsichtbare Grundlage und ist Loader-/Offline-seitig eingebunden", () => {
  const source = fs.readFileSync(path.join(root, "js", "planner-task-alternatives.js"), "utf8");
  const cascade = fs.readFileSync(path.join(root, "js", "planner-log-rollover-cascade.js"), "utf8");
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

  assert.match(source, /taskPreservingAlternatives/);
  assert.match(source, /buildDays\(/);
  assert.match(source, /automaticFoodEligibility/);
  assert.match(source, /plannerFoodCanBeAutomaticFocus/);
  assert.match(source, /PlannerAllergenMaintenance/);
  assert.doesNotMatch(source, /addEventListener\(["']click["']/);
  assert.doesNotMatch(source, /<button/);
  assert.match(cascade, /planner-task-alternatives\.js\?v=10\.1\.26/);
  assert.match(sw, /\.\/js\/planner-task-alternatives\.js/);
});
