const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const planningSource = fs.readFileSync(
  path.resolve(__dirname, "..", "js", "planning.js"),
  "utf8",
);
const milkPolicySource = fs.readFileSync(
  path.resolve(__dirname, "..", "js", "planner-milk-policy.js"),
  "utf8",
);

function food(id, name, category, {
  priority = 10,
  rank = 3,
  allergenGroup = "",
} = {}) {
  return {
    id,
    name,
    category,
    priority,
    plannerRank: rank,
    active: true,
    meals: ["breakfast", "lunch", "dinner"],
    allergenGroup,
    seasonMonths: [],
  };
}

function installAppRoleGates(context) {
  context.plannerRole = (record) => String(record?.plannerRole || "");
  context.plannerFoodCanBeBase = (record) =>
    context.plannerRole(record) !== "component";
  context.plannerFoodCanBeAutomaticFocus = (record) =>
    context.plannerRole(record) !== "component";

  let coreTrustedBase = context.isTrustedBase;
  context.isTrustedBase = (record) =>
    context.plannerFoodCanBeBase(record) && coreTrustedBase(record);

  let gateCandidate = (producer, exclude = []) => {
    let blocked = [...exclude];
    let max = (context.state?.foods?.length || 0) + 1;
    for (let i = 0; i < max; i++) {
      let result = producer(blocked);
      if (!result?.f) return result;
      if (context.plannerFoodCanBeAutomaticFocus(result.f)) return result;
      if (blocked.includes(result.f.id)) return null;
      blocked.push(result.f.id);
    }
    return null;
  };

  let coreIntroductionCandidate = context.introductionCandidate;
  context.introductionCandidate = (meal, on, ctx, exclude = []) =>
    gateCandidate(
      (blocked) => coreIntroductionCandidate(meal, on, ctx, blocked),
      exclude,
    );

  let coreKnownCandidate = context.knownCandidate;
  context.knownCandidate = (meal, on, ctx, exclude = []) =>
    gateCandidate(
      (blocked) => coreKnownCandidate(meal, on, ctx, blocked),
      exclude,
    );
}

function runtime(foods) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(planningSource, context);

  const date = "2026-08-23";
  context.state = {
    foods,
    logs: [],
    inventory: [],
    overrides: {},
    deferred: {},
    planLocks: {},
    autoLockExcluded: {},
    manualMeals: {},
    followUps: {},
    settings: {
      allergenDays: 7,
      newFoodEvery: 2,
      seasonal: false,
      phMode: "off",
      preferInventoryInPlan: false,
      startDate: "2026-08-01",
    },
  };
  context.rank = (record) => Number(record?.plannerRank || 0);
  context.status = (record) => {
    let value = context.rank(record);
    return value >= 3
      ? "Regelmäßig"
      : value >= 2
        ? "Verträgliche Basis"
        : value >= 1
          ? "Probiert"
          : "Offen";
  };
  context.outcomeForFood = () => "eaten";
  context.lastOutcome = () => "";
  context.lastDate = () => "";
  context.food = (id) => context.state.foods.find((item) => item.id === id) || null;
  context.eligible = (record, meal) =>
    !!record?.active && record.meals.includes(meal);
  context.inventoryPortions = () => 0;

  installAppRoleGates(context);

  vm.runInContext(
    `${milkPolicySource}\nthis.__installPlannerMilkPolicyRuntime = installPlannerMilkPolicyRuntime;`,
    context,
  );
  assert.equal(context.__installPlannerMilkPolicyRuntime(), true);

  return {
    context,
    date,
    plannerContext: {
      reserved: new Set(),
      introduced: [],
      plannedUse: new Map(),
      lastFocus: new Map(),
      inventoryReserved: new Map(),
      recipeReserved: new Map(),
      recipePlannedUse: new Map(),
      fullMilkDates: new Set(),
    },
  };
}

test("MILK-01: Kuhmilch nutzt den zentralen component-Rollenvertrag", () => {
  const cowMilk = food("kuhmilch", "Kuhmilch", "Milchprodukt", {
    priority: 1,
    rank: 3,
    allergenGroup: "Milch",
  });
  const banana = food("banane", "Banane", "Obst", { priority: 2, rank: 3 });
  const rt = runtime([cowMilk, banana]);

  assert.equal(rt.context.plannerRole(cowMilk), "component");
  assert.equal(rt.context.plannerFoodCanBeBase(cowMilk), false);
  assert.equal(rt.context.plannerFoodCanBeAutomaticFocus(cowMilk), false);

  const known = rt.context.knownCandidate(
    "breakfast",
    rt.date,
    rt.plannerContext,
    [],
  );
  assert.notEqual(known?.f?.id, "kuhmilch");
});

test("MILK-01: automatische Kuhmilch-Einführung nimmt Getreide statt Banane als Basis", () => {
  const cowMilk = food("kuhmilch", "Kuhmilch", "Milchprodukt", {
    priority: 1,
    rank: 0,
    allergenGroup: "Milch",
  });
  const banana = food("banane", "Banane", "Obst", { priority: 2, rank: 3 });
  const millet = food("hirse", "Hirse", "Getreide/Stärke", {
    priority: 20,
    rank: 3,
  });
  const rt = runtime([cowMilk, banana, millet]);

  const intro = rt.context.introductionCandidate(
    "breakfast",
    rt.date,
    rt.plannerContext,
    [],
  );
  assert.equal(intro?.f?.id, "kuhmilch");
  assert.equal(intro?.type, "Allergen einführen");
  assert.equal(
    rt.context.plannerFoodCanBeAutomaticFocus(cowMilk),
    false,
    "Kuhmilch darf nur während der Candidate-Ermittlung temporär Auto-Fokus sein",
  );

  const companion = rt.context.companionFor(
    cowMilk,
    "breakfast",
    rt.date,
    intro.type,
  );
  assert.equal(companion?.id, "hirse");
  assert.notEqual(companion?.id, "banane");
});

test("MILK-01: ohne bekannte Getreidebasis wird Kuhmilch nicht frei mit Banane eingeplant", () => {
  const cowMilk = food("kuhmilch", "Kuhmilch", "Milchprodukt", {
    priority: 1,
    rank: 0,
    allergenGroup: "Milch",
  });
  const banana = food("banane", "Banane", "Obst", { priority: 2, rank: 3 });
  const rt = runtime([cowMilk, banana]);

  const intro = rt.context.introductionCandidate(
    "breakfast",
    rt.date,
    rt.plannerContext,
    [],
  );
  assert.notEqual(intro?.f?.id, "kuhmilch");
  assert.equal(
    rt.context.companionFor(cowMilk, "breakfast", rt.date, "Allergen einführen"),
    null,
  );
});

test("MILK-01: die Getreidepflicht gilt nur für Kuhmilch, nicht pauschal für Milchprodukte", () => {
  const yoghurt = food("naturjoghurt", "Naturjoghurt", "Milchprodukt", {
    priority: 1,
    rank: 0,
    allergenGroup: "Milch",
  });
  const banana = food("banane", "Banane", "Obst", { priority: 2, rank: 3 });
  const rt = runtime([yoghurt, banana]);

  assert.equal(rt.context.plannerRole(yoghurt), "");
  const companion = rt.context.companionFor(
    yoghurt,
    "breakfast",
    rt.date,
    "Allergen einführen",
  );
  assert.equal(companion?.id, "banane");
});
