"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  PLANNER_FOOD_PHASE_ORDER,
  plannerFoodMonthsOld,
  plannerAutomaticFoodEligibilityCore,
  plannerAutomaticFoodMealEligible,
} = require("../js/planner-meal-eligibility.js");
const {
  FOOD_PHASE_ORDER,
  foodPolicyMonthsOld,
  automaticFoodEligibility,
} = require("../app.js");

const SETTINGS = Object.freeze({
  birthDate: "2026-01-24",
  phaseSelected: "familie",
});

test("zentrale FOOD-Autoeignung übernimmt unverändert Phase, Alter und autoPlan", () => {
  assert.deepEqual(Array.from(PLANNER_FOOD_PHASE_ORDER), Array.from(FOOD_PHASE_ORDER));

  const cases = [
    [{ id: "allowed" }, "2026-08-24", SETTINGS],
    [{ id: "manual-only", autoPlan: false }, "2028-01-24", SETTINGS],
    [{ id: "age", minAgeMonths: 12 }, "2027-01-23", SETTINGS],
    [{ id: "age", minAgeMonths: 12 }, "2027-01-24", SETTINGS],
    [{ id: "phase", minPhase: "familie" }, "2027-01-24", { ...SETTINGS, phaseSelected: "drei" }],
    [{ id: "phase", minPhase: "familie" }, "2027-01-24", SETTINGS],
    [{ id: "invalid-phase", minPhase: "unknown" }, "2027-01-24", SETTINGS],
  ];

  for (const [food, on, settings] of cases) {
    assert.equal(
      plannerAutomaticFoodEligibilityCore(food, on, settings),
      automaticFoodEligibility(food, on, settings),
      `${food.id} / ${on} / ${settings.phaseSelected}`,
    );
  }

  for (const on of ["2026-01-24", "2026-02-23", "2026-02-24", "2027-01-23", "2027-01-24"]) {
    assert.equal(
      plannerFoodMonthsOld(on, SETTINGS.birthDate),
      foodPolicyMonthsOld(on, SETTINGS.birthDate),
      on,
    );
  }
});

test("Verfügbarkeit ist Teil des zentralen harten FOOD-Gates", () => {
  const unavailable = (id) => id === "missing";
  assert.equal(
    plannerAutomaticFoodEligibilityCore({ id: "missing" }, "2027-01-24", SETTINGS, unavailable),
    false,
  );
  assert.equal(
    plannerAutomaticFoodEligibilityCore({ id: "available" }, "2027-01-24", SETTINGS, unavailable),
    true,
  );
});

test("Mahlzeitenwrapper kann zentrale FOOD-Gates nicht durch Callback umgehen", () => {
  const alwaysEligible = () => true;
  assert.equal(
    plannerAutomaticFoodMealEligible(
      { id: "manual-only", meals: ["lunch"], autoPlan: false },
      "lunch",
      "2027-01-24",
      SETTINGS,
      alwaysEligible,
    ),
    false,
  );
  assert.equal(
    plannerAutomaticFoodMealEligible(
      { id: "age", meals: ["lunch"], minAgeMonths: 12 },
      "lunch",
      "2027-01-23",
      SETTINGS,
      alwaysEligible,
    ),
    false,
  );
  assert.equal(
    plannerAutomaticFoodMealEligible(
      { id: "allowed", meals: ["lunch"] },
      "breakfast",
      "2027-01-24",
      SETTINGS,
      alwaysEligible,
    ),
    false,
  );
});

test("Runtime ersetzt den alten App-Einstieg durch die zentrale FOOD-Funktion", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "js", "planner-meal-eligibility.js"),
    "utf8",
  );
  const legacy = () => "legacy";
  const context = {
    console,
    automaticFoodEligibility: legacy,
    isFoodUnavailable: (id) => id === "missing",
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  assert.equal(context.installPlannerAutomaticFoodEligibilityRuntime(), true);
  assert.notEqual(context.automaticFoodEligibility, legacy);
  assert.equal(
    context.automaticFoodEligibility(
      { id: "phase", minPhase: "familie" },
      "2027-01-24",
      { ...SETTINGS, phaseSelected: "drei" },
    ),
    false,
  );
  assert.equal(
    context.automaticFoodEligibility({ id: "missing" }, "2027-01-24", SETTINGS),
    false,
  );
  assert.equal(
    context.automaticFoodEligibility({ id: "allowed" }, "2027-01-24", SETTINGS),
    true,
  );
  assert.equal(context.__plannerAutomaticFoodEligibilityCoreInstalled, true);
});
