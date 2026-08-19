"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  applyFoodPolicyData,
  automaticFoodEligibility,
  plannerFoodCanBeAutomaticFocus,
  plannerFoodCanBeBase,
} = require("../app.js");

const root = path.resolve(__dirname, "..");
const ON = "2026-08-18";
const SETTINGS = { phaseSelected: "familie", birthDate: "2024-08-18" };
const MAIN_MEALS = ["breakfast", "lunch", "dinner"];
const MILK_PRODUCT_IDS = new Set(["kuhmilch", "naturjoghurt", "buttermilch"]);
const STARCH_CATEGORIES = new Set(["Getreide/Stärke", "Wurzel/Knolle"]);
const MEAT_FISH_CATEGORIES = new Set(["Fleisch", "Fisch", "Meeresfrucht"]);

function sourceFile(...parts) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

function loadFoods() {
  const source = sourceFile("data", "foods.js");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__FOODS = FOOD_DB;`, context);
  const foods = JSON.parse(JSON.stringify(context.__FOODS));
  applyFoodPolicyData(foods, {});
  return foods;
}

function loadPresentationContract() {
  const source = sourceFile("data", "food-presentation.js");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__CONTRACT = FOOD_PRESENTATION_CONTRACT;`, context);
  return JSON.parse(JSON.stringify(context.__CONTRACT));
}

function mealEligible(food, meal) {
  return !!food &&
    food.active !== false &&
    Array.isArray(food.meals) &&
    food.meals.includes(meal) &&
    food.category !== "Fett" &&
    automaticFoodEligibility(food, ON, SETTINGS);
}

function focusEligible(food, meal) {
  return mealEligible(food, meal) && plannerFoodCanBeAutomaticFocus(food);
}

function baseEligible(food, meal) {
  return mealEligible(food, meal) &&
    !food.allergenGroup &&
    food.category !== "Kraut/Gewürz" &&
    plannerFoodCanBeBase(food);
}

function normalCompanionEligible(focus, candidate, meal) {
  if (!mealEligible(candidate, meal) || candidate.id === focus.id) return false;
  if (candidate.allergenGroup) return false;
  if (["Kraut/Gewürz", "Fett"].includes(candidate.category)) return false;
  if (MILK_PRODUCT_IDS.has(focus.id) && MEAT_FISH_CATEGORIES.has(candidate.category)) return false;
  if (MEAT_FISH_CATEGORIES.has(focus.category) && MILK_PRODUCT_IDS.has(candidate.id)) return false;
  if (STARCH_CATEGORIES.has(focus.category) && STARCH_CATEGORIES.has(candidate.category)) return false;
  return true;
}

function pairKey(meal, a, b, path) {
  return `${meal}|${path}|${a.id}+${b.id}`;
}

function enumeratePairs(foods) {
  const pairs = [];
  for (const meal of MAIN_MEALS) {
    for (const focus of foods.filter((food) => focusEligible(food, meal))) {
      if (focus.allergenGroup) {
        for (const base of foods.filter((food) => baseEligible(food, meal) && food.id !== focus.id)) {
          if (STARCH_CATEGORIES.has(focus.category) && STARCH_CATEGORIES.has(base.category)) continue;
          pairs.push({ meal, path: "allergen-knownBase", focus, companion: base });
        }
        continue;
      }
      for (const candidate of foods) {
        if (!normalCompanionEligible(focus, candidate, meal)) continue;
        pairs.push({ meal, path: "companionFor", focus, companion: candidate });
      }
    }
  }
  return pairs;
}

// Dieser Enumerator bildet bewusst nur den alten Core-Pfad ab. PLAN-08-X1
// neutralisiert ihn zur Laufzeit; die Zahl bleibt als Radar dafür erhalten,
// wie groß der wieder erreichbare Fehlerraum bei einer Loader-/Policy-Regression wäre.
function enumerateLegacyIronTriples(foods, pairs) {
  const triples = [];
  for (const pair of pairs) {
    if (pair.path !== "companionFor" || pair.meal === "breakfast") continue;
    const { focus, companion, meal } = pair;
    if (focus.ironRich || MILK_PRODUCT_IDS.has(focus.id) || MILK_PRODUCT_IDS.has(companion.id)) continue;
    for (const iron of foods) {
      if (!mealEligible(iron, meal) || !iron.ironRich || iron.allergenGroup) continue;
      if ([focus.id, companion.id].includes(iron.id)) continue;
      const existingHasStarch = [focus, companion].some((food) => STARCH_CATEGORIES.has(food.category));
      if (existingHasStarch && STARCH_CATEGORIES.has(iron.category)) continue;
      triples.push({ meal, focus, companion, iron });
    }
  }
  return triples;
}

function compactPair(pair) {
  return `${pair.meal}: ${pair.focus.name} + ${pair.companion.name} [${pair.path}]`;
}

function compactTriple(triple) {
  return `${triple.meal}: ${triple.focus.name} + ${triple.companion.name} + ${triple.iron.name}`;
}

test("PLAN-08 audit: enumerate structurally possible automatic FOOD combinations", () => {
  const foods = loadFoods();
  const contract = loadPresentationContract();
  const pairs = enumeratePairs(foods);
  const legacyTriples = enumerateLegacyIronTriples(foods, pairs);
  const unique = new Set(pairs.map((pair) => pairKey(pair.meal, pair.focus, pair.companion, pair.path)));
  assert.equal(unique.size, pairs.length, "Audit darf keine doppelten strukturellen Pfade erzeugen");

  const counts = Object.fromEntries(MAIN_MEALS.map((meal) => [meal, pairs.filter((pair) => pair.meal === meal).length]));
  const presentationSensitive = pairs.filter((pair) =>
    contract[pair.focus.id]?.role || contract[pair.companion.id]?.role,
  );
  const milkMeatAllergenBypass = pairs.filter((pair) =>
    pair.path === "allergen-knownBase" &&
    MILK_PRODUCT_IDS.has(pair.focus.id) &&
    pair.companion.category === "Fleisch",
  );
  const fruitMeatPairs = pairs.filter((pair) =>
    pair.path === "companionFor" &&
    pair.meal !== "breakfast" &&
    [pair.focus.category, pair.companion.category].includes("Obst") &&
    [pair.focus.category, pair.companion.category].includes("Fleisch"),
  );
  const ironPreferredPairCandidates = pairs.filter((pair) =>
    pair.path === "companionFor" &&
    pair.meal !== "breakfast" &&
    !pair.focus.ironRich &&
    pair.companion.ironRich,
  );
  const legacyFruitProteinIronTriples = legacyTriples.filter((triple) =>
    [triple.focus.category, triple.companion.category].includes("Obst") &&
    ["Fleisch", "Hülsenfrucht"].includes(triple.iron.category),
  );
  const fullAllergenFocusCandidates = foods.filter((food) =>
    MAIN_MEALS.some((meal) => focusEligible(food, meal)) &&
    food.allergenGroup &&
    ["Nuss", "Samen"].includes(food.category) &&
    plannerFoodCanBeAutomaticFocus(food),
  );

  const ironPolicy = sourceFile("js", "planner-iron-preference.js");
  const utils = sourceFile("js", "utils.js");
  const planning = sourceFile("js", "planning.js");

  // Der Core enthält aus Migrationsgründen noch den alten Aufruf. Er darf nur
  // hinter der X1-Policy laufen, die den Kandidaten in companionFor zentral wählt
  // und den späteren ironCompanion()-Rückgabewert zwingend auf null setzt.
  assert.match(planning, /let iron = introduction \? null : ironCompanion\(f, meal, date, ids\)/);
  assert.match(ironPolicy, /companionFor = function ironPreferredCompanionFor/);
  assert.match(ironPolicy, /preferred = originalCompanionFor\(focus, meal, on, focusType\)/);
  assert.match(ironPolicy, /combinationPaused\(\[focus\?\.id, item\.id\]/);
  assert.match(ironPolicy, /enforceSingleStarch\(focus, \[preferred\]\)\.length !== 1/);
  assert.match(ironPolicy, /ironCompanion = function centralizedIronCompanion\(\) \{\s*return null;\s*\}/);
  assert.doesNotMatch(ironPolicy, /ids\.push\(/);
  assert.match(utils, /planner-iron-preference\.js\?v=10\.1\.25/);
  assert.match(utils, /ironScript\.addEventListener\("load", loadPresentationStack/);

  console.log("PLAN08_AUDIT_COUNTS", JSON.stringify({
    foods: foods.length,
    pairs: pairs.length,
    reachableIronTriplesAfterX1: 0,
    legacyIronTriplesNeutralized: legacyTriples.length,
    ironPreferredPairCandidates: ironPreferredPairCandidates.length,
    byMeal: counts,
    flagged: {
      presentationSensitive: presentationSensitive.length,
      milkMeatAllergenCoreBypassCandidates: milkMeatAllergenBypass.length,
      fruitMeatPairs: fruitMeatPairs.length,
      legacyFruitProteinIronTriplesNeutralized: legacyFruitProteinIronTriples.length,
      fullAllergenFocusCandidates: fullAllergenFocusCandidates.length,
    },
  }));
  console.log("PLAN08_AUDIT_PRESENTATION_SENSITIVE", JSON.stringify(presentationSensitive.slice(0, 40).map(compactPair)));
  console.log("PLAN08_AUDIT_MILK_MEAT_CORE_BYPASS_CANDIDATES", JSON.stringify(milkMeatAllergenBypass.map(compactPair)));
  console.log("PLAN08_AUDIT_FRUIT_MEAT_PAIRS", JSON.stringify(fruitMeatPairs.slice(0, 60).map(compactPair)));
  console.log("PLAN08_AUDIT_LEGACY_FRUIT_PROTEIN_IRON_TRIPLES_NEUTRALIZED", JSON.stringify(legacyFruitProteinIronTriples.slice(0, 80).map(compactTriple)));
  console.log("PLAN08_AUDIT_FULL_ALLERGEN_FOCUS", JSON.stringify(fullAllergenFocusCandidates.map((food) => `${food.name} (${food.category}; ${food.allergenGroup})`)));

  assert.ok(pairs.length > 0);
  assert.ok(legacyTriples.length > 0, "Radar muss den durch X1 neutralisierten alten Fehlerraum weiterhin erkennen");
  assert.ok(ironPreferredPairCandidates.length > 0, "Eisenreiche Kandidaten müssen innerhalb normaler Paarpfade sichtbar sein");
  assert.ok(presentationSensitive.length > 0, "bestätigter Gurkenfall muss im strukturellen Audit sichtbar sein");
});
