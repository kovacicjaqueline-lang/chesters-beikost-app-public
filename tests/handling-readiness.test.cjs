"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const {
  HANDLING_MODES,
  BITE_SEPARATION_PROFILES,
  ORAL_PROCESSING_PROFILES,
  HANDLING_CAPABILITIES,
  FOOD_HANDLING_CONTRACT,
  RECIPE_CONTRACT_GROUPS,
  RECIPE_HANDLING_CONTRACT,
} = require(path.join(root, "data", "food-handling.js"));
const {
  normalizeFeedingApproach,
  handlingModeFamily,
  preferredHandlingModes,
  recipeHandlingEligibility,
  foodHandlingEligibility,
  legacyRecipeStageAllowed,
  normalizeHandlingCapabilities,
} = require(path.join(root, "js", "handling-readiness.js"));

const policySource = fs.readFileSync(
  path.join(root, "js", "handling-readiness.js"),
  "utf8",
);
const contractSource = fs.readFileSync(
  path.join(root, "data", "food-handling.js"),
  "utf8",
);
const recipeDataSource = fs.readFileSync(
  path.join(root, "data", "recipes.js"),
  "utf8",
);
const recipeRuntimeSource = fs.readFileSync(
  path.join(root, "js", "recipes.js"),
  "utf8",
);

function runtimeRecipeNames() {
  const context = vm.createContext({ console });
  vm.runInContext(recipeDataSource, context, { filename: "data/recipes.js" });
  vm.runInContext(recipeRuntimeSource, context, { filename: "js/recipes.js" });
  return JSON.parse(vm.runInContext("JSON.stringify(RECIPES.map((r) => r.name))", context));
}

function settings(overrides = {}) {
  return {
    textureStage: 1,
    feedingApproach: "mixed",
    handlingCapabilities: {
      smallSoftPieces: false,
      gradedBite: false,
      structuredChew: false,
    },
    ...overrides,
  };
}

test("HANDLING: Beikostform ist Präferenz mit migrationssicherem mixed-Fallback", () => {
  assert.equal(normalizeFeedingApproach("spoon"), "spoon");
  assert.equal(normalizeFeedingApproach("fingerfood"), "fingerfood");
  assert.equal(normalizeFeedingApproach("mixed"), "mixed");
  assert.equal(normalizeFeedingApproach(""), "mixed");
  assert.equal(normalizeFeedingApproach("unknown"), "mixed");
});

test("HANDLING: Löffel und Fingerfood sind parallele Modusfamilien, keine Stufen", () => {
  assert.equal(handlingModeFamily(HANDLING_MODES.SPOON_SMOOTH), "spoon");
  assert.equal(handlingModeFamily(HANDLING_MODES.SPOON_MASHED), "spoon");
  assert.equal(handlingModeFamily(HANDLING_MODES.FINGER_GRASPABLE), "fingerfood");
});

test("HANDLING: feedingApproach sortiert nur Präferenzen und entfernt keine sichere Form", () => {
  const modes = [
    HANDLING_MODES.SPOON_MASHED,
    HANDLING_MODES.FINGER_GRASPABLE,
  ];
  assert.deepEqual(preferredHandlingModes(modes, "mixed"), modes);
  assert.deepEqual(preferredHandlingModes(modes, "spoon"), modes);
  assert.deepEqual(preferredHandlingModes(modes, "fingerfood"), [
    HANDLING_MODES.FINGER_GRASPABLE,
    HANDLING_MODES.SPOON_MASHED,
  ]);
});

test("HANDLING: alle 103 Laufzeitrezepte sind explizit und genau einmal migriert", () => {
  const runtimeNames = runtimeRecipeNames();
  const contractNames = Object.keys(RECIPE_HANDLING_CONTRACT);
  const grouped = Object.values(RECIPE_CONTRACT_GROUPS).flat();
  assert.equal(runtimeNames.length, 103);
  assert.equal(contractNames.length, 103);
  assert.equal(new Set(grouped).size, 103, "Contract-Gruppen dürfen sich nicht überlappen");
  assert.deepEqual([...contractNames].sort(), [...runtimeNames].sort());
  assert.deepEqual([...grouped].sort(), [...runtimeNames].sort());
});

test("HANDLING: Auditmatrix bleibt 87 ohne Extra-Gate und 16 bewusst später", () => {
  const entries = Object.values(RECIPE_HANDLING_CONTRACT);
  assert.equal(entries.filter((entry) => !entry.laterKind).length, 87);
  assert.equal(entries.filter((entry) => entry.laterKind === "bite-and-oral-capability").length, 4);
  assert.equal(entries.filter((entry) => entry.laterKind === "handling-capability").length, 3);
  assert.equal(entries.filter((entry) => entry.laterKind === "soft-orientation").length, 9);
});

test("BITE: 41 greifbare Fingerfoods sind einzeln 13 low-resistance, 24 easy-bite und 4 graded-bite zugeordnet", () => {
  const fingerEntries = Object.entries(RECIPE_HANDLING_CONTRACT)
    .filter(([, entry]) => entry.modes.includes(HANDLING_MODES.FINGER_GRASPABLE));
  assert.equal(fingerEntries.length, 41);
  assert.equal(
    fingerEntries.filter(([, entry]) => entry.biteSeparation === BITE_SEPARATION_PROFILES.LOW_RESISTANCE_SEPARATE).length,
    13,
  );
  assert.equal(
    fingerEntries.filter(([, entry]) => entry.biteSeparation === BITE_SEPARATION_PROFILES.EASY_BITE_SEPARATE).length,
    24,
  );
  assert.equal(
    fingerEntries.filter(([, entry]) => entry.biteSeparation === BITE_SEPARATION_PROFILES.GRADED_BITE_REQUIRED).length,
    4,
  );
  for (const [name, entry] of fingerEntries) {
    assert.ok(Object.values(BITE_SEPARATION_PROFILES).includes(entry.biteSeparation), name);
  }
});

test("ORAL: easy-chew ist post-separation und die alte Mischsemantik ist kein Oral-Profil mehr", () => {
  assert.equal(ORAL_PROCESSING_PROFILES.EASY_CHEW, "easy-chew");
  assert.equal(ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE, undefined);
  assert.equal(RECIPE_HANDLING_CONTRACT["Obst-Hafer-Pancakes"].oralProcessing, ORAL_PROCESSING_PROFILES.EASY_CHEW);
  assert.equal(RECIPE_HANDLING_CONTRACT["Omelettstreifen"].biteSeparation, BITE_SEPARATION_PROFILES.LOW_RESISTANCE_SEPARATE);
});

test("BITE/ORAL: vier Rezepte verlangen nach Einzelprüfung graded-bite und structured-chew", () => {
  const expected = [
    "Rind-Hafer-Bällchen",
    "Baby-Bananenbrot",
    "Weiche Joghurt-Fladen",
    "Huhn-Gemüse-Muffins",
  ].sort();
  const actual = Object.entries(RECIPE_HANDLING_CONTRACT)
    .filter(([, entry]) => entry.oralRequiredCapability === HANDLING_CAPABILITIES.STRUCTURED_CHEW)
    .map(([name]) => name)
    .sort();
  assert.deepEqual(actual, expected);
  for (const name of expected) {
    const entry = RECIPE_HANDLING_CONTRACT[name];
    assert.equal(entry.biteSeparation, BITE_SEPARATION_PROFILES.GRADED_BITE_REQUIRED, name);
    assert.equal(entry.biteRequiredCapability, HANDLING_CAPABILITIES.GRADED_BITE, name);
    assert.equal(entry.oralProcessing, ORAL_PROCESSING_PROFILES.STRUCTURED_CHEW_REQUIRED, name);
    assert.equal(entry.oralRequiredCapability, HANDLING_CAPABILITIES.STRUCTURED_CHEW, name);
    assert.deepEqual([...entry.modes], [HANDLING_MODES.FINGER_GRASPABLE], name);
  }
});

test("BITE: graded-bite ist eine eigenständige beobachtete Capability", () => {
  const synthetic = {
    "Formstabiler Test-Bite": {
      modes: [HANDLING_MODES.FINGER_GRASPABLE],
      biteSeparation: BITE_SEPARATION_PROFILES.GRADED_BITE_REQUIRED,
      biteRequiredCapability: HANDLING_CAPABILITIES.GRADED_BITE,
      oralProcessing: ORAL_PROCESSING_PROFILES.EASY_CHEW,
    },
  };
  const recipe = { name: "Formstabiler Test-Bite" };
  const blocked = recipeHandlingEligibility(recipe, settings(), synthetic);
  assert.deepEqual(blocked.eligibleModes, []);
  assert.deepEqual(blocked.blockedReasons, ["bite-separation-requirement"]);
  assert.equal(blocked.biteCapabilitySatisfied, false);

  const ready = recipeHandlingEligibility(
    recipe,
    settings({ handlingCapabilities: { smallSoftPieces: false, gradedBite: true, structuredChew: false } }),
    synthetic,
  );
  assert.deepEqual(ready.eligibleModes, [HANDLING_MODES.FINGER_GRASPABLE]);
  assert.equal(ready.biteCapabilitySatisfied, true);
});

test("BITE/ORAL: graded-bite und structured-chew entsperren sich nicht gegenseitig", () => {
  const synthetic = {
    "Zwei Capabilities": {
      modes: [HANDLING_MODES.FINGER_GRASPABLE],
      biteSeparation: BITE_SEPARATION_PROFILES.GRADED_BITE_REQUIRED,
      biteRequiredCapability: HANDLING_CAPABILITIES.GRADED_BITE,
      oralProcessing: ORAL_PROCESSING_PROFILES.STRUCTURED_CHEW_REQUIRED,
      oralRequiredCapability: HANDLING_CAPABILITIES.STRUCTURED_CHEW,
    },
  };
  const recipe = { name: "Zwei Capabilities" };
  assert.deepEqual(
    recipeHandlingEligibility(recipe, settings(), synthetic).blockedReasons,
    ["bite-separation-requirement", "oral-processing-requirement"],
  );
  assert.deepEqual(
    recipeHandlingEligibility(
      recipe,
      settings({ handlingCapabilities: { smallSoftPieces: false, gradedBite: true, structuredChew: false } }),
      synthetic,
    ).blockedReasons,
    ["oral-processing-requirement"],
  );
  assert.deepEqual(
    recipeHandlingEligibility(
      recipe,
      settings({ handlingCapabilities: { smallSoftPieces: false, gradedBite: false, structuredChew: true } }),
      synthetic,
    ).blockedReasons,
    ["bite-separation-requirement"],
  );
});

test("BITE/ORAL: Baby-Bananenbrot verlangt beide unabhängigen Fähigkeiten", () => {
  const recipe = { name: "Baby-Bananenbrot", stage: 3 };
  const blocked = recipeHandlingEligibility(recipe, settings(), RECIPE_HANDLING_CONTRACT);
  assert.deepEqual(blocked.eligibleModes, []);
  assert.deepEqual(blocked.blockedReasons, ["bite-separation-requirement", "oral-processing-requirement"]);

  const onlyBite = recipeHandlingEligibility(
    recipe,
    settings({ handlingCapabilities: { smallSoftPieces: false, gradedBite: true, structuredChew: false } }),
    RECIPE_HANDLING_CONTRACT,
  );
  assert.deepEqual(onlyBite.eligibleModes, []);
  assert.deepEqual(onlyBite.blockedReasons, ["oral-processing-requirement"]);

  const onlyChew = recipeHandlingEligibility(
    recipe,
    settings({ handlingCapabilities: { smallSoftPieces: false, gradedBite: false, structuredChew: true } }),
    RECIPE_HANDLING_CONTRACT,
  );
  assert.deepEqual(onlyChew.eligibleModes, []);
  assert.deepEqual(onlyChew.blockedReasons, ["bite-separation-requirement"]);

  const ready = recipeHandlingEligibility(
    recipe,
    settings({ handlingCapabilities: { smallSoftPieces: false, gradedBite: true, structuredChew: true } }),
    RECIPE_HANDLING_CONTRACT,
  );
  assert.deepEqual(ready.eligibleModes, [HANDLING_MODES.FINGER_GRASPABLE]);
  assert.deepEqual(ready.blockedReasons, []);
});

test("HANDLING: genau drei Nockerl verlangen small-soft-pieces und bleiben oral soft-breakdown", () => {
  const expected = [
    "Huhn-Zucchini-Nockerl",
    "Rind-Karotten-Nockerl",
    "Linsen-Süßkartoffel-Nockerl",
  ].sort();
  const actual = Object.entries(RECIPE_HANDLING_CONTRACT)
    .filter(([, entry]) =>
      entry.requiredCapabilities?.[HANDLING_MODES.FINGER_SMALL_SOFT] === HANDLING_CAPABILITIES.SMALL_SOFT_PIECES
    )
    .map(([name]) => name)
    .sort();
  assert.deepEqual(actual, expected);
  for (const name of expected) {
    const entry = RECIPE_HANDLING_CONTRACT[name];
    assert.equal(entry.biteSeparation, undefined, name);
    assert.equal(entry.oralProcessing, ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN, name);
    assert.deepEqual([...entry.modes], [HANDLING_MODES.FINGER_SMALL_SOFT], name);
  }
});

test("HANDLING: Nockerl werden nur durch small-soft-pieces freigeschaltet", () => {
  const recipe = { name: "Huhn-Zucchini-Nockerl", stage: 3 };
  assert.deepEqual(recipeHandlingEligibility(recipe, settings(), RECIPE_HANDLING_CONTRACT).eligibleModes, []);
  assert.deepEqual(
    recipeHandlingEligibility(
      recipe,
      settings({ handlingCapabilities: { smallSoftPieces: false, gradedBite: true, structuredChew: true } }),
      RECIPE_HANDLING_CONTRACT,
    ).eligibleModes,
    [],
  );
  assert.deepEqual(
    recipeHandlingEligibility(
      recipe,
      settings({ handlingCapabilities: { smallSoftPieces: true, gradedBite: false, structuredChew: false } }),
      RECIPE_HANDLING_CONTRACT,
    ).eligibleModes,
    [HANDLING_MODES.FINGER_SMALL_SOFT],
  );
});

test("HANDLING: neun Formfälle bleiben soft-orientation statt künstlicher Capability", () => {
  const expected = [
    "Gemüse-Nudel-Sauce",
    "Baby-Linsen-Bolognese",
    "Huhn-Karotte-Nudel-Topf",
    "Huhn-Lauch-Kartoffel-Topf",
    "Brokkoli-Linsen-Pasta",
    "Gemüse-Pasta mit Zucchini und Tomate",
    "Ei-Champignon-Cups",
    "Tinola-inspiriert",
    "Sayote-Huhn-Reis",
  ].sort();
  const actual = Object.entries(RECIPE_HANDLING_CONTRACT)
    .filter(([, entry]) => entry.laterKind === "soft-orientation")
    .map(([name]) => name)
    .sort();
  assert.deepEqual(actual, expected);
  for (const name of expected) {
    const entry = RECIPE_HANDLING_CONTRACT[name];
    assert.equal(entry.biteRequiredCapability, undefined, name);
    assert.equal(entry.oralRequiredCapability, undefined, name);
  }
});

test("HANDLING: weich-stückige kanonische Löffelformen hängen an Textur, nicht Alter", () => {
  const recipe = { name: "Gemüse-Nudel-Sauce", stage: 3 };
  const early = recipeHandlingEligibility(recipe, settings({ textureStage: 1 }), RECIPE_HANDLING_CONTRACT);
  assert.deepEqual(early.eligibleModes, []);
  assert.deepEqual(early.blockedReasons, ["handling-requirement"]);
  const ready = recipeHandlingEligibility(recipe, settings({ textureStage: 3 }), RECIPE_HANDLING_CONTRACT);
  assert.deepEqual(ready.eligibleModes, [HANDLING_MODES.SPOON_SOFT_LUMPY]);
});

test("HANDLING: frühe Referenzfälle verlieren die historische Stage-Sperre", () => {
  for (const name of [
    "Obst-Hafer-Pancakes",
    "Omelettstreifen",
    "Zucchini-Omelett",
    "Obst-Hafer-Muffins",
    "Joghurt-Hafer-Waffeln",
    "Fleisch-Gemüse-Bällchen",
  ]) {
    const result = recipeHandlingEligibility(
      { name, stage: 4 },
      settings({ textureStage: 1 }),
      RECIPE_HANDLING_CONTRACT,
    );
    assert.equal(result.migrated, true, name);
    assert.notEqual(result.eligibleModes.length, 0, name);
    assert.equal(result.blockedReasons.length, 0, name);
  }
});

test("HANDLING: synthetisches unmigriertes Rezept behält explizit den Legacy-Stage-Fallback", () => {
  const recipe = { name: "Nicht migriert", stage: 3 };
  const result = recipeHandlingEligibility(recipe, settings(), RECIPE_HANDLING_CONTRACT);
  assert.equal(result.migrated, false);
  assert.deepEqual(result.blockedReasons, ["legacy-stage-fallback"]);
  assert.equal(legacyRecipeStageAllowed(recipe, 1), false);
  assert.equal(legacyRecipeStageAllowed(recipe, 3), true);
});

test("HANDLING: Karotte kann früh parallel Löffel- und greifbare Form anbieten", () => {
  const result = foodHandlingEligibility("karotte", settings(), FOOD_HANDLING_CONTRACT);
  assert.equal(result.migrated, true);
  assert.ok(result.eligibleModes.includes(HANDLING_MODES.SPOON_SMOOTH));
  assert.ok(result.eligibleModes.includes(HANDLING_MODES.SPOON_MASHED));
  assert.ok(result.eligibleModes.includes(HANDLING_MODES.FINGER_GRASPABLE));
});

test("HANDLING: Capability-Fallback ist migrationssicher false/false/false", () => {
  const target = {};
  assert.deepEqual(normalizeHandlingCapabilities(target), {
    smallSoftPieces: false,
    gradedBite: false,
    structuredChew: false,
  });
  assert.deepEqual(target.handlingCapabilities, {
    smallSoftPieces: false,
    gradedBite: false,
    structuredChew: false,
  });
});

test("SAFETY: Bananenbrot bleibt trotz Capability bei klebrig-teigiger Krume ausgeschlossen", () => {
  const contract = RECIPE_HANDLING_CONTRACT["Baby-Bananenbrot"];
  assert.match(contract.servingRequirement, /nicht klebrig, teigig oder ballend/i);
  assert.match(contract.servingRequirement, /nicht anbieten/i);
  assert.match(contract.noteOverride, /vollständig auskühlen/i);
});

test("FORM: Zucchini-Omelett hat eine eindeutige kanonische breite Streifenform", () => {
  const contract = RECIPE_HANDLING_CONTRACT["Zucchini-Omelett"];
  assert.match(contract.noteOverride, /breite, gut greifbare Streifen/i);
  assert.match(contract.noteOverride, /Kleine Stücke sind eine separate/i);
});

test("FORM: Hummus-Sticks definieren weich mechanisch statt als Kochmethode", () => {
  const contract = RECIPE_HANDLING_CONTRACT["Hummus mit weichen Gemüsesticks"];
  assert.match(contract.servingRequirement, /mechanisch weich/i);
  assert.match(contract.servingRequirement, /roh oder gegart/i);
  assert.doesNotMatch(contract.servingRequirement, /Gemüsesticks müssen gegart/i);
});

test("HANDLING: Steuerlogik parst keine safeForm-/note-Freitexte", () => {
  assert.doesNotMatch(policySource, /\.safeForm\b/);
  assert.doesNotMatch(policySource, /text\.includes\(/);
  assert.doesNotMatch(contractSource, /safeForm\s*:/);
});
