"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const handling = require("../js/handling-readiness.js");
const {
  FOOD_HANDLING_CONTRACT,
  RECIPE_HANDLING_CONTRACT,
} = require("../data/food-handling.js");

const root = path.resolve(__dirname, "..");
const migrationSource = fs.readFileSync(path.join(root, "js", "migrations.js"), "utf8");
const handlingSource = fs.readFileSync(path.join(root, "js", "handling-readiness.js"), "utf8");

function settings(feedingApproach = "mixed", textureStage = 1) {
  return { feedingApproach, textureStage };
}

function foodMeal(extra = {}) {
  return {
    meal: "lunch",
    active: true,
    focusId: "karotte",
    foodIds: ["karotte", "kartoffel"],
    baseFoodIds: ["kartoffel"],
    sampleFoodIds: [],
    recipeName: "",
    type: "bekannt",
    ...extra,
  };
}

test("presentationMode: mixed behält bei FOOD-only die Contract-Reihenfolge", () => {
  assert.equal(
    handling.presentationModeForMeal(
      foodMeal(),
      settings("mixed"),
      FOOD_HANDLING_CONTRACT,
      RECIPE_HANDLING_CONTRACT,
    ),
    "spoon-smooth",
  );
});

test("presentationMode: fingerfood rankt nur innerhalb gemeinsamer bereits geeigneter FOOD-Modi", () => {
  assert.equal(
    handling.presentationModeForMeal(
      foodMeal(),
      settings("fingerfood"),
      FOOD_HANDLING_CONTRACT,
      RECIPE_HANDLING_CONTRACT,
    ),
    "finger-graspable",
  );
  assert.deepEqual(
    handling.foodHandlingEligibility("karotte", settings("fingerfood"), FOOD_HANDLING_CONTRACT).eligibleModes,
    ["spoon-smooth", "spoon-mashed", "finger-graspable"],
    "Präferenz darf sichere Löffelwege nicht aus der Eligibility entfernen",
  );
});

test("presentationMode: explizites migriertes Rezept darf früh seine sichere Fingerfood-Form tragen", () => {
  assert.equal(
    handling.presentationModeForMeal(
      foodMeal({ recipeName: "Obst-Hafer-Pancakes", foodIds: ["banane"] }),
      settings("spoon", 1),
      FOOD_HANDLING_CONTRACT,
      RECIPE_HANDLING_CONTRACT,
    ),
    "finger-graspable",
    "spoon-Präferenz ist kein Safety-Override und darf die einzige sichere Rezeptform nicht sperren",
  );
});

test("presentationMode: unmigriertes Rezept und unvollständig migrierte FOOD-Mahlzeit bleiben ohne erfundene Form", () => {
  assert.equal(
    handling.presentationModeForMeal(
      foodMeal({ recipeName: "Legacy-Rezept" }),
      settings("mixed"),
      FOOD_HANDLING_CONTRACT,
      RECIPE_HANDLING_CONTRACT,
    ),
    "",
  );
  assert.equal(
    handling.presentationModeForMeal(
      foodMeal({ foodIds: ["karotte", "rind"] }),
      settings("mixed"),
      FOOD_HANDLING_CONTRACT,
      RECIPE_HANDLING_CONTRACT,
    ),
    "",
  );
});

test("presentationMode: Kostprobe/Einführung erhält nicht pauschal eine gemeinsame Darreichungsform", () => {
  assert.equal(
    handling.presentationModeForMeal(
      foodMeal({ sampleFoodIds: ["karotte"] }),
      settings("fingerfood"),
      FOOD_HANDLING_CONTRACT,
      RECIPE_HANDLING_CONTRACT,
    ),
    "",
  );
});

test("presentationMode: nur frische automatische Mahlzeiten werden ergänzt", () => {
  const fresh = handling.applyPresentationModeToAutomaticMeal(
    foodMeal(),
    settings("fingerfood"),
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  );
  assert.equal(fresh.presentationMode, "finger-graspable");

  const legacyAutoLock = handling.applyPresentationModeToAutomaticMeal(
    foodMeal({ lockedMode: "auto" }),
    settings("fingerfood"),
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  );
  assert.equal(Object.hasOwn(legacyAutoLock, "presentationMode"), false, "alter Auto-Lock darf nicht stillschweigend umgedeutet werden");

  const manual = handling.applyPresentationModeToAutomaticMeal(
    foodMeal({ manualAdded: true }),
    settings("fingerfood"),
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  );
  assert.equal(Object.hasOwn(manual, "presentationMode"), false);
});

test("presentationMode: vorhandenes explizites Feld wird nie von feedingApproach überschrieben", () => {
  const meal = foodMeal({ presentationMode: "spoon-mashed" });
  assert.equal(
    handling.applyPresentationModeToAutomaticMeal(
      meal,
      settings("fingerfood"),
      FOOD_HANDLING_CONTRACT,
      RECIPE_HANDLING_CONTRACT,
    ).presentationMode,
    "spoon-mashed",
  );
});

test("feedingApproach: fehlender Altwert fällt rückwärtskompatibel auf mixed zurück", () => {
  assert.equal(handling.normalizeFeedingApproach(undefined), "mixed");
  assert.equal(handling.normalizeFeedingApproach("legacy-value"), "mixed");
  assert.match(migrationSource, /d\.settings\s*=\s*\{\s*\.\.\.d\.settings,\s*\.\.\.\(source\.settings\s*\|\|\s*\{\}\)\s*\}/);
});

test("Persistenzvertrag: Runtime trägt neue presentationMode additiv durch Plan, Lock und Log", () => {
  const keys = [
    "state",
    "FOOD_HANDLING_CONTRACT",
    "RECIPE_HANDLING_CONTRACT",
    "buildDay",
    "mealSnapshot",
    "lockedMeal",
    "planLockKey",
    "pendingLog",
    "saveLog",
    "save",
  ];
  const previous = new Map(keys.map((key) => [
    key,
    {
      hadOwn: Object.prototype.hasOwnProperty.call(globalThis, key),
      value: globalThis[key],
    },
  ]));

  try {
    globalThis.state = {
      settings: settings("fingerfood"),
      planLocks: {},
      logs: [],
    };
    globalThis.FOOD_HANDLING_CONTRACT = FOOD_HANDLING_CONTRACT;
    globalThis.RECIPE_HANDLING_CONTRACT = RECIPE_HANDLING_CONTRACT;
    globalThis.buildDay = () => ({ date: "2026-08-18", meals: [foodMeal()] });
    globalThis.mealSnapshot = (_date, _meal, generated, mode) => ({
      focusId: generated.focusId,
      foodIds: [...generated.foodIds],
      mode,
    });
    globalThis.planLockKey = (date, meal) => `${date}|${meal}`;
    globalThis.lockedMeal = (_date, meal) => ({ meal, active: true, lockedMode: "auto" });
    let saves = 0;
    globalThis.save = () => { saves += 1; };
    globalThis.pendingLog = null;
    globalThis.saveLog = () => {
      if (globalThis.pendingLog?.editId) {
        globalThis.state.logs = globalThis.state.logs.map((log) =>
          log.id === globalThis.pendingLog.editId ? { id: log.id, updatedAt: "now" } : log,
        );
      } else {
        globalThis.state.logs.push({ id: "new-log", updatedAt: "now" });
      }
    };

    handling.installPresentationModeRuntime();

    const day = globalThis.buildDay("2026-08-18", 0, {});
    assert.equal(day.meals[0].presentationMode, "finger-graspable");

    const snapshot = globalThis.mealSnapshot(
      "2026-08-18",
      "lunch",
      day.meals[0],
      "auto",
    );
    assert.equal(snapshot.presentationMode, "finger-graspable");

    globalThis.state.planLocks["2026-08-18|lunch"] = {
      mode: "auto",
      presentationMode: "finger-graspable",
    };
    assert.equal(
      globalThis.lockedMeal("2026-08-18", "lunch").presentationMode,
      "finger-graspable",
    );

    globalThis.state.planLocks["2026-08-19|lunch"] = { mode: "auto" };
    const historicalLock = globalThis.lockedMeal("2026-08-19", "lunch");
    assert.equal(
      Object.hasOwn(historicalLock, "presentationMode"),
      false,
      "historischer Lock ohne Feld bleibt ohne Feld",
    );

    globalThis.pendingLog = { presentationMode: "finger-graspable" };
    globalThis.saveLog();
    assert.equal(globalThis.state.logs[0].presentationMode, "finger-graspable");
    assert.equal(saves, 1, "additives presentationMode wird nach erfolgreichem Log-Save persistiert");
  } finally {
    for (const [key, entry] of previous) {
      if (entry.hadOwn) globalThis[key] = entry.value;
      else delete globalThis[key];
    }
  }
});

test("Persistenzvertrag: alte Datensätze bekommen keinen presentationMode-Fallback aus textureStage", () => {
  assert.doesNotMatch(migrationSource, /presentationMode\s*:\s*[^,\n]*textureStage/);
  assert.doesNotMatch(handlingSource, /presentationMode\s*=\s*[^;\n]*textureStage/);
});

test("PLAN-08-Trennung: presentationMode wird nicht aus dem FOOD-Anzeigevertrag abgeleitet", () => {
  assert.doesNotMatch(handlingSource, /FOOD_PRESENTATION_CONTRACT/);
});
