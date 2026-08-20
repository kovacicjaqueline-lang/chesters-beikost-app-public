"use strict";

/* PLAN-08-X1: Eisenorientierung und kulinarische Nachrangigkeit innerhalb der
 * normalen Begleiterauswahl.
 *
 * Die bestehende FOOD-Auswahl bleibt die Source of Truth für Mahlzeiteneignung,
 * Auto-Eignung, Kombinierbarkeit und MILK-01. Diese Schicht verändert keine
 * Allergen- oder Milchmengenregeln. Sie beschreibt nur kulinarische Rollen, die
 * nicht zuverlässig aus der Nährstoffkategorie abgeleitet werden können.
 *
 * Bestätigte Leitplanken:
 * - Obst + herzhaft wird außerhalb des Frühstücks nachrangig behandelt.
 * - Blattgemüse gehört dabei zur herzhaften Gemüsefamilie.
 * - Avocado ist kulinarisch eine herzhafte/cremige Frucht und wird nicht wie
 *   Banane oder Apfel behandelt.
 * - Gurke ist eine frische Beilage; Avocado, Naturjoghurt, Ei und Kichererbse
 *   sind bevorzugte FOOD-only-Begleiter. Andere Gurkenpaare bleiben ein weicher
 *   Fallback, wenn keine bessere bekannte Alternative verfügbar ist.
 * - Bereits bekannte/kombinierbare allergene Gurken-Begleiter dürfen als normale
 *   Begleiter berücksichtigt werden; eine beiläufige Allergen-Einführung bleibt
 *   ausgeschlossen und MILK-01 greift weiterhin davor.
 * - Zwiebel, Knoblauch, Kakao, Calamansi, Zitrone, Butter und Honig sind
 *   Zutaten/Akzente: keine automatische Hauptbasis oder normaler Fokus und kein
 *   generischer Begleiter. Bewusste Samples/Overrides und echte Rezepte bleiben
 *   über die bestehenden Verträge möglich.
 * - Milchprodukte und Sojajoghurt werden für die kulinarische Paarwahl nach ihrer
 *   Darreichungsrolle eingeordnet; MILK-01 bleibt davon ausdrücklich getrennt.
 *
 * PLAN-08-X1 hängt weiterhin keine dritte FOOD-Komponente an. Eisen wird nur
 * innerhalb der bereits zulässigen Zweierkombination optimiert.
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
  "Blattgemüse",
]);

const PLANNER_FRUIT_SAVORY_PROTEIN_CATEGORIES = new Set([
  "Fleisch",
  "Fisch",
  "Meeresfrucht",
  "Hülsenfrucht",
]);

const PLANNER_CULINARY_ROLE_BY_ID = Object.freeze({
  gurke: "fresh-side",
  avocado: "savory-fruit",

  zwiebel: "accent",
  knoblauch: "accent",
  kakao: "accent",
  calamansi: "accent",
  zitrone: "accent",
  butter: "accent",
  honig: "accent",

  kuhmilch: "milk-base",
  buttermilch: "milk-base",
  naturjoghurt: "cultured-creamy",
  kefir: "cultured-creamy",
  quark: "cultured-creamy",
  skyr: "cultured-creamy",
  sojajoghurt: "cultured-creamy",

  frischkaese: "soft-dairy",
  kaese: "soft-dairy",
  mozzarella: "soft-dairy",
  huettenkaese: "soft-dairy",
});

const PLANNER_FRESH_SIDE_PREFERRED_IDS = new Set([
  "avocado",
  "naturjoghurt",
  "ei",
  "kichererbse",
]);

const PLANNER_CREAMY_DAIRY_ROLES = new Set([
  "milk-base",
  "cultured-creamy",
]);

function plannerCulinaryRole(foodRecord) {
  if (!foodRecord) return "";
  let explicit = PLANNER_CULINARY_ROLE_BY_ID[String(foodRecord.id || "")];
  if (explicit) return explicit;

  let category = String(foodRecord.category || "");
  if (category === "Obst") return "fruit";
  if (PLANNER_FRUIT_SAVORY_VEGETABLE_CATEGORIES.has(category)) return "savory-vegetable";
  if (PLANNER_FRUIT_SAVORY_PROTEIN_CATEGORIES.has(category)) return "savory-protein";
  if (category === "Getreide/Stärke") return "starch";
  if (category === "Ei") return "egg";
  if (category === "Milchprodukt") return "soft-dairy";
  return "other";
}

function plannerCulinaryIsAccent(foodRecord) {
  return plannerCulinaryRole(foodRecord) === "accent";
}

function plannerFreshSidePairPreference(focus, candidate) {
  let focusFresh = plannerCulinaryRole(focus) === "fresh-side";
  let candidateFresh = plannerCulinaryRole(candidate) === "fresh-side";
  if (!focusFresh && !candidateFresh) return 0;

  let other = focusFresh ? candidate : focus;
  if (!other) return 0;
  return PLANNER_FRESH_SIDE_PREFERRED_IDS.has(String(other.id || "")) ? 0 : 2;
}

function plannerFreshSideKnownAllergenCompanion(focus, candidate, combineFn = null) {
  if (plannerCulinaryRole(focus) !== "fresh-side" || !candidate?.allergenGroup) return false;
  if (!PLANNER_FRESH_SIDE_PREFERRED_IDS.has(String(candidate.id || ""))) return false;
  return typeof combineFn === "function" && !!combineFn(candidate);
}

function plannerFreshSideCompanionPoolFood(focus, candidate, combineFn = null) {
  if (!plannerFreshSideKnownAllergenCompanion(focus, candidate, combineFn)) return candidate;
  return { ...candidate, allergenGroup: "" };
}

function plannerAutomaticPairPreferencePenalty(focus, candidate, meal) {
  if (!focus || !candidate || meal === "breakfast") return 0;

  let freshSidePenalty = plannerFreshSidePairPreference(focus, candidate);
  if (freshSidePenalty) return freshSidePenalty;

  let focusRole = plannerCulinaryRole(focus);
  let candidateRole = plannerCulinaryRole(candidate);

  // Zutaten-/Akzentformen werden im Runtime-Pool ohnehin nicht als generischer
  // Begleiter zugelassen. Als bewusst gewählter Sample-Fokus soll ihre Basiswahl
  // aber nicht künstlich verschlechtert werden.
  if (focusRole === "accent" || candidateRole === "accent") return 0;

  let focusSweetFruit = focusRole === "fruit";
  let candidateSweetFruit = candidateRole === "fruit";
  if (focusSweetFruit !== candidateSweetFruit) {
    let otherRole = focusSweetFruit ? candidateRole : focusRole;
    if (otherRole === "savory-protein") return 2;
    if (otherRole === "savory-vegetable") return 1;
  }

  // Milch-/Joghurtformen werden nur dann umsortiert, wenn sie selbst Fokus sind.
  // So bleibt z. B. Gemüse + Naturjoghurt als bereits gewählte Kombination stabil
  // und MILK-01 wird nicht indirekt durch eine neue Symmetrieregel verändert.
  if (PLANNER_CREAMY_DAIRY_ROLES.has(focusRole) && candidateRole === "savory-vegetable") return 1;

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

function plannerPairRequiresRecipe(focus, candidate, meal) {
  if (!focus || !candidate || meal === "breakfast") return false;
  let focusRole = plannerCulinaryRole(focus);
  let candidateRole = plannerCulinaryRole(candidate);
  let focusSweetFruit = focusRole === "fruit";
  let candidateSweetFruit = candidateRole === "fruit";
  if (focusSweetFruit === candidateSweetFruit) return false;
  let otherRole = focusSweetFruit ? candidateRole : focusRole;
  return ["savory-vegetable", "savory-protein"].includes(otherRole);
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
  // die X1-Auswahlmechanik. Im echten App-Stack darf nur der bereits bestehende
  // Obst-herzhaft-Vertrag FOOD-only nicht als letzten Fallback erzwungen werden.
  if (!plannerPairRecipeContractAvailable()) return alternative || normal;

  if (alternative) {
    let alternativePenalty = plannerAutomaticPairPreferencePenalty(focus, alternative, meal);
    if (alternativePenalty <= 0) return alternative;
    if (!plannerPairRequiresRecipe(focus, alternative, meal)) return alternative;
    if (plannerPairHasUniqueUnlockedRecipe(focus, alternative, meal)) return alternative;
  }
  if (!plannerPairRequiresRecipe(focus, normal, meal)) return normal;
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

  // Akzent-FOODs nutzen den bestehenden zentralen Planner-Rollenvertrag statt
  // paralleler Basis-/Fokus-Sondergates. Dadurch sehen automatische Planung,
  // manueller Editor und Lock-Validierung dieselbe "component"-Rolle.
  if (typeof plannerRole === "function") {
    let originalPlannerRole = plannerRole;
    plannerRole = function culinaryAccentPlannerRole(foodRecord) {
      if (plannerCulinaryIsAccent(foodRecord)) return "component";
      return originalPlannerRole(foodRecord);
    };
  }

  let originalCompanionFor = companionFor;

  companionFor = function ironPreferredCompanionFor(
    focus,
    meal,
    on,
    focusType = "",
  ) {
    let allFoods = state?.foods || null;
    let canonicalCompanion = (selected) =>
      allFoods?.find((item) => item?.id === selected?.id) || selected;

    if (allFoods) {
      let combineFn = typeof canCombine === "function" ? canCombine : null;
      state.foods = allFoods
        .filter((item) => item?.id === focus?.id || !plannerCulinaryIsAccent(item))
        .map((item) => plannerFreshSideCompanionPoolFood(focus, item, combineFn));
    }

    try {
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
      ) return canonicalCompanion(normal);

      let normalPenalty = normal
        ? plannerAutomaticPairPreferencePenalty(focus, normal, meal)
        : 0;
      let culinaryFoods = state.foods;
      state.foods = culinaryFoods.filter((item) => {
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
        state.foods = culinaryFoods;
      }

      if (!preferred?.ironRich) return canonicalCompanion(normal);
      if (
        plannerAutomaticPairPreferencePenalty(focus, preferred, meal) > normalPenalty
      ) return canonicalCompanion(normal);
      if (enforceSingleStarch(focus, [preferred]).length !== 1)
        return canonicalCompanion(normal);
      return canonicalCompanion(preferred);
    } finally {
      if (allFoods) state.foods = allFoods;
    }
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
    PLANNER_CULINARY_ROLE_BY_ID,
    PLANNER_FRESH_SIDE_PREFERRED_IDS,
    plannerCulinaryRole,
    plannerCulinaryIsAccent,
    plannerFreshSidePairPreference,
    plannerFreshSideKnownAllergenCompanion,
    plannerFreshSideCompanionPoolFood,
    plannerAutomaticPairPreferencePenalty,
    plannerPairRecipeNameVariants,
    plannerPairRecipeContractAvailable,
    plannerPairHasUniqueUnlockedRecipe,
    plannerPairRequiresRecipe,
    plannerFocusIsIntroduction,
    plannerIronPreferenceApplies,
    plannerPreferredNormalCompanion,
    installPlannerIronPreferenceRuntime,
  };
}
