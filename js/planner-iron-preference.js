"use strict";

/* PLAN-08-X1: Eisenorientierung innerhalb der normalen Begleiterauswahl.
 *
 * Die bestehende FOOD-Auswahl bleibt die Source of Truth für Mahlzeiteneignung,
 * Auto-Eignung, Kombinierbarkeit und MILK-01. PLAN-08-X1 darf die normale
 * Zweierkombination nicht durch einen kulinarisch deutlich schrägeren Eisenpartner
 * ersetzen und hängt keine dritte FOOD-Komponente mehr an.
 *
 * Zusätzlich werden bestätigte herzhafte Obst-Mischungen außerhalb des Frühstücks
 * nicht als generischer FOOD-only-Fallback erzwungen: Obst + Gemüse/Wurzel bzw.
 * Obst + herzhafte Proteinquelle braucht entweder eine neutralere Begleiteralternative
 * oder genau ein aktuell freigeschaltetes passendes Rezept. Das ist keine globale
 * Rezept-Blacklist; echte Rezepte bleiben über ihren Rezeptvertrag zulässig.
 */

const PLANNER_IRON_INTRODUCTION_TYPES = new Set([
  "neu",
  "gezielt wiederholen",
  "Allergen einführen",
  "Allergen wiederholen",
  "manuell",
]);

const PLANNER_FRUIT_SAVORY_VEGETABLE_CATEGORIES = new Set([
  "Gemüse",
  "Wurzel/Knolle",
]);

const PLANNER_FRUIT_SAVORY_PROTEIN_CATEGORIES = new Set([
  "Fleisch",
  "Fisch",
  "Meeresfrucht",
  "Hülsenfrucht",
]);

function plannerAutomaticPairPreferencePenalty(focus, candidate, meal) {
  if (!focus || !candidate || meal === "breakfast") return 0;
  let categories = [focus.category || "", candidate.category || ""];
  if (!categories.includes("Obst")) return 0;
  let other = categories[0] === "Obst" ? categories[1] : categories[0];
  if (PLANNER_FRUIT_SAVORY_PROTEIN_CATEGORIES.has(other)) return 2;
  if (PLANNER_FRUIT_SAVORY_VEGETABLE_CATEGORIES.has(other)) return 1;
  return 0;
}

function plannerPairRecipeNameVariants(recipe) {
  if (!recipe) return [];
  let bases = [recipe.requires || [], ...(recipe.alternatives || [])]
    .filter((items, index) => items.length || index === 0)
    .map((items) => [...items]);
  if (!bases.length) bases = [[]];

  let optionGroups = [];
  if (Array.isArray(recipe.oneOf) && recipe.oneOf.length) optionGroups.push(recipe.oneOf);
  if (Array.isArray(recipe.milkChoices) && recipe.milkChoices.length) optionGroups.push(recipe.milkChoices);

  let variants = bases;
  for (let group of optionGroups) {
    variants = variants.flatMap((base) => group.map((choice) => [...base, choice]));
  }
  return variants.map((names) => [...new Set(names.filter(Boolean))]);
}

function plannerPairRecipeContractAvailable() {
  return typeof recipeStates === "function" && typeof plannerRecipeSuitableForMeal === "function";
}

function plannerPairHasUniqueUnlockedRecipe(focus, candidate, meal) {
  if (!focus?.name || !candidate?.name || !plannerPairRecipeContractAvailable()) return false;

  let target = [focus.name, candidate.name].sort((a, b) => a.localeCompare(b, "de"));
  let matches = recipeStates().filter((recipe) => {
    if (!recipe?.unlocked || !plannerRecipeSuitableForMeal(recipe, meal)) return false;
    if (Array.isArray(recipe.requirementMissing) && recipe.requirementMissing.length) return false;
    return plannerPairRecipeNameVariants(recipe).some((names) => {
      let variant = [...new Set(names)].sort((a, b) => a.localeCompare(b, "de"));
      return variant.length === target.length && variant.every((name, index) => name === target[index]);
    });
  });
  return matches.length === 1;
}

function plannerFocusIsIntroduction(focus, focusType = "", trustedBaseFn = null) {
  return !!(
    PLANNER_IRON_INTRODUCTION_TYPES.has(focusType) &&
    typeof trustedBaseFn === "function" &&
    !trustedBaseFn(focus)
  );
}

function plannerIronPreferenceApplies(
  focus,
  meal,
  focusType = "",
  amountRank = 0,
  trustedBaseFn = null,
  milkProductFn = null,
) {
  if (!focus || meal === "breakfast" || Number(amountRank) < 1 || focus.ironRich) return false;
  if (typeof milkProductFn === "function" && milkProductFn(focus)) return false;
  return !plannerFocusIsIntroduction(focus, focusType, trustedBaseFn);
}

function plannerPreferredNormalCompanion(
  originalCompanionFor,
  focus,
  meal,
  on,
  focusType,
  trustedBaseFn,
) {
  let normal = originalCompanionFor(focus, meal, on, focusType);
  if (
    !normal ||
    !state?.foods ||
    plannerFocusIsIntroduction(focus, focusType, trustedBaseFn)
  ) return normal;

  let normalPenalty = plannerAutomaticPairPreferencePenalty(focus, normal, meal);
  if (normalPenalty <= 0) return normal;

  let originalFoods = state.foods;
  state.foods = originalFoods.filter((item) => {
    if (item?.id === focus?.id) return true;
    if (
      typeof combinationPaused === "function" &&
      combinationPaused([focus?.id, item?.id].filter(Boolean), on)
    ) return false;
    return plannerAutomaticPairPreferencePenalty(focus, item, meal) < normalPenalty;
  });
  let alternative = null;
  try {
    alternative = originalCompanionFor(focus, meal, on, focusType);
  } finally {
    state.foods = originalFoods;
  }

  // Isolierte Unit-Harnesses ohne geladenen Rezeptvertrag prüfen weiterhin nur
  // die X1-Eisenmechanik. Im echten App-Stack ist der Rezeptvertrag vorhanden und
  // herzhafte Obstpaare dürfen FOOD-only nicht als letzter Fallback erzwungen werden.
  if (!plannerPairRecipeContractAvailable()) return alternative || normal;

  if (alternative) {
    let alternativePenalty = plannerAutomaticPairPreferencePenalty(focus, alternative, meal);
    if (alternativePenalty <= 0) return alternative;
    if (plannerPairHasUniqueUnlockedRecipe(focus, alternative, meal)) return alternative;
  }
  if (plannerPairHasUniqueUnlockedRecipe(focus, normal, meal)) return normal;
  return null;
}

function installPlannerIronPreferenceRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__plannerIronPreferenceRuntimeInstalled) return false;
  if (
    typeof companionFor !== "function" ||
    typeof ironCompanion !== "function" ||
    typeof currentAmountLevel !== "function" ||
    typeof isTrustedBase !== "function" ||
    typeof isMilkProductFood !== "function" ||
    typeof rank !== "function" ||
    typeof enforceSingleStarch !== "function"
  ) return false;

  globalThis.__plannerIronPreferenceRuntimeInstalled = true;

  let originalCompanionFor = companionFor;

  companionFor = function ironPreferredCompanionFor(
    focus,
    meal,
    on,
    focusType = "",
  ) {
    let normal = plannerPreferredNormalCompanion(
      originalCompanionFor,
      focus,
      meal,
      on,
      focusType,
      isTrustedBase,
    );
    let amountRank = Number(
      typeof AMOUNT_LEVELS !== "undefined"
        ? AMOUNT_LEVELS[currentAmountLevel()]?.rank || 0
        : 0,
    );

    if (
      !plannerIronPreferenceApplies(
        focus,
        meal,
        focusType,
        amountRank,
        isTrustedBase,
        isMilkProductFood,
      ) ||
      normal?.ironRich ||
      isMilkProductFood(normal) ||
      !state?.foods
    ) return normal;

    let normalPenalty = normal
      ? plannerAutomaticPairPreferencePenalty(focus, normal, meal)
      : 0;
    let originalFoods = state.foods;
    state.foods = originalFoods.filter((item) => {
      if (item?.id === focus?.id) return true;
      if (!item?.ironRich || rank(item) < 2) return false;
      if (plannerAutomaticPairPreferencePenalty(focus, item, meal) > normalPenalty) return false;
      if (
        typeof combinationPaused === "function" &&
        combinationPaused([focus?.id, item.id].filter(Boolean), on)
      ) return false;
      return true;
    });

    let preferred = null;
    try {
      preferred = originalCompanionFor(focus, meal, on, focusType);
    } finally {
      state.foods = originalFoods;
    }

    if (!preferred?.ironRich) return normal;
    if (
      plannerAutomaticPairPreferencePenalty(focus, preferred, meal) > normalPenalty
    ) return normal;
    if (enforceSingleStarch(focus, [preferred]).length !== 1) return normal;
    return preferred;
  };

  // buildDay() ruft diese Legacy-Funktion weiterhin auf. PLAN-08-X1 macht den
  // Aufruf absichtlich wirkungslos: Eisen wird nur noch über companionFor gewählt.
  ironCompanion = function centralizedIronCompanion() {
    return null;
  };

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerIronPreferenceRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PLANNER_IRON_INTRODUCTION_TYPES,
    PLANNER_FRUIT_SAVORY_VEGETABLE_CATEGORIES,
    PLANNER_FRUIT_SAVORY_PROTEIN_CATEGORIES,
    plannerAutomaticPairPreferencePenalty,
    plannerPairRecipeNameVariants,
    plannerPairRecipeContractAvailable,
    plannerPairHasUniqueUnlockedRecipe,
    plannerFocusIsIntroduction,
    plannerIronPreferenceApplies,
    plannerPreferredNormalCompanion,
    installPlannerIronPreferenceRuntime,
  };
}