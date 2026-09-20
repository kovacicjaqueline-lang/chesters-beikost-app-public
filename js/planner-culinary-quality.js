"use strict";

/* Kulinarische Planner-Qualität.
 *
 * Die fachlichen Auto-Gates bleiben in den bestehenden Planner-Policies. Diese
 * Schicht beantwortet nur die zusätzliche Frage, ob die bereits zulässigen
 * Lebensmittel zusammen wie eine nachvollziehbare Babymahlzeit funktionieren.
 * Einzelne Kostproben bleiben ausdrücklich erlaubt, werden aber nicht zu einem
 * vollwertigen Gericht aufgewertet.
 */

const PLANNER_CULINARY_BASE_CATEGORIES = new Set([
  "Getreide/Stärke",
  "Wurzel/Knolle",
]);
const PLANNER_CULINARY_PRODUCE_CATEGORIES = new Set([
  "Gemüse",
  "Wurzel/Knolle",
  "Blattgemüse",
  "Obst",
]);
const PLANNER_CULINARY_PROTEIN_CATEGORIES = new Set([
  "Fleisch",
  "Fisch",
  "Meeresfrucht",
  "Hülsenfrucht",
  "Ei",
  "Soja/Tofu",
]);

const PLANNER_CULINARY_ACCENT_CATEGORIES = new Set([
  "Kraut/Gewürz",
]);

function plannerCulinaryRole(item) {
  if (!item) return "";
  const id = String(item.id || "");
  const category = String(item.category || "");
  if (category === "Fett" || id === "butter" || id === "rapsoel" || id === "olivenoel") return "fat";
  if (PLANNER_CULINARY_ACCENT_CATEGORIES.has(category) || [
    "zwiebel", "knoblauch", "oregano", "basilikum", "petersilie", "schnittlauch",
    "dill", "kurkuma", "kreuzkuemmel", "zitrone", "calamansi", "honig",
  ].includes(id)) return "accent";
  if (id === "avocado") return "savory-produce";
  if (category === "Obst") return "sweet-fruit";
  if (PLANNER_CULINARY_BASE_CATEGORIES.has(category)) return "base";
  if (PLANNER_CULINARY_PROTEIN_CATEGORIES.has(category)) return "protein";
  if (PLANNER_CULINARY_PRODUCE_CATEGORIES.has(category)) return "savory-produce";
  if (category === "Milchprodukt") return "creamy";
  return "other";
}

function plannerCulinaryCanonicalIds(ids = []) {
  return [...new Set((ids || []).filter(Boolean))];
}

function plannerCulinaryItems(ids, foods = []) {
  const byId = new Map((foods || []).map((item) => [item?.id, item]));
  return plannerCulinaryCanonicalIds(ids).map((id) => byId.get(id)).filter(Boolean);
}

function plannerCulinaryRecipeVariants(recipe) {
  if (!recipe) return [];
  const bases = [recipe.requires || [], ...(recipe.alternatives || [])]
    .filter((items, index) => items.length || index === 0)
    .map((items) => [...items]);
  let variants = bases.length ? bases : [[]];
  for (const group of [recipe.oneOf || [], recipe.milkChoices || []]) {
    if (!group.length) continue;
    variants = variants.flatMap((base) => group.map((choice) => [...base, choice]));
  }
  return variants.map((names) => [...new Set(names.filter(Boolean))]);
}

function plannerCulinaryRecipeHasPair(focus, candidate, meal, recipes = [], foods = [], suitableFn = null) {
  if (!focus || !candidate) return false;
  const suitable = typeof suitableFn === "function"
    ? suitableFn
    : (recipe, mealKey) => {
      if (mealKey === "breakfast") return ["porridge", "pancakes", "baking"].includes(recipe?.category);
      if (mealKey === "snack") return (recipe?.tags || []).some((tag) => String(tag).toLowerCase() === "snack");
      return true;
    };
  const byName = new Map((foods || []).map((item) => [String(item?.name || ""), item]));
  const target = [focus.id, candidate.id].sort();
  return (recipes || []).some((recipe) => {
    if (!recipe || !suitable(recipe, meal)) return false;
    return plannerCulinaryRecipeVariants(recipe).some((names) => {
      const ids = [...new Set(names.map((name) => byName.get(name)?.id).filter(Boolean))].sort();
      return ids.length === target.length && ids.every((id, index) => id === target[index]);
    });
  });
}

function plannerCulinaryRecipeIngredientReady(name, meal = null, on = "") {
  const item = typeof foodByName === "function"
    ? foodByName(name, state?.foods || [])
    : (state?.foods || []).find((candidate) => candidate?.name === name);
  if (!item || item.active === false || (typeof status === "function" && status(item) === "Pausiert")) return false;
  if (meal && typeof plannerAutomaticFoodMealEligible === "function" &&
      !plannerAutomaticFoodMealEligible(
        item,
        meal.meal,
        on,
        state?.settings || {},
        typeof automaticFoodEligibility === "function" ? automaticFoodEligibility : null,
      )) return false;
  if (!item.allergenGroup) return true;
  const planned = new Set([...(meal?.foodIds || []), ...(meal?.sampleFoodIds || [])]);
  return planned.has(item.id);
}

function plannerCulinaryAssessment(ids, foods = [], meal = "lunch", options = {}) {
  const items = plannerCulinaryItems(ids, foods);
  const roles = items.map(plannerCulinaryRole);
  const substantive = roles.filter((role) => !["accent", "fat"].includes(role));
  const has = (role) => roles.includes(role);
  const assessment = {
    ids: items.map((item) => item.id),
    roles,
    score: 0,
    allowed: true,
    dishLike: false,
    learningOnly: false,
    issues: [],
  };

  if (!items.length) {
    assessment.allowed = false;
    assessment.issues.push("keine Zutaten");
    return assessment;
  }

  const isLearningOnly = !!options.learningOnly || !!options.sampleOnly;
  if (items.length === 1 && isLearningOnly) {
    assessment.learningOnly = true;
    assessment.score = 0;
    assessment.issues.push("bewusste Einzelzutat");
    return assessment;
  }

  if (substantive.length === 0) {
    assessment.allowed = false;
    assessment.issues.push("nur Würzung oder Fett");
    return assessment;
  }
  if (substantive.length === 1 && !options.recipeBacked) {
    assessment.allowed = false;
    assessment.issues.push("Einzelzutat ist kein vollständiges Gericht");
    return assessment;
  }

  const baseCount = roles.filter((role) => role === "base").length;
  if (baseCount > 1) {
    assessment.allowed = false;
    assessment.issues.push("mehr als eine sättigende Basis");
  }

  const hasProduce = has("savory-produce") || has("sweet-fruit");
  const hasSavoryProduce = has("savory-produce");
  const hasSweetFruit = has("sweet-fruit");
  const hasProtein = has("protein");
  const hasBase = has("base");
  const hasCreamy = has("creamy");

  if (meal !== "breakfast" && hasSweetFruit && (hasProtein || hasSavoryProduce) && !options.recipeBacked) {
    assessment.allowed = false;
    assessment.issues.push("süßes Obst passt außerhalb des Frühstücks nicht zur herzhaften Kombination");
  }
  if (meal === "breakfast" && hasSweetFruit && !hasBase && !hasCreamy && !hasProtein) {
    assessment.allowed = false;
    assessment.issues.push("Obst braucht zum Frühstück eine passende Mahlzeitenbasis");
  }
  if (!hasBase && hasProtein && !hasSavoryProduce && !hasCreamy && !options.recipeBacked) {
    assessment.allowed = false;
    assessment.issues.push("Proteinquelle ohne passende Mahlzeitenbasis oder Gemüse");
  }
  if (hasBase && hasProtein && !hasProduce && !hasCreamy && !options.recipeBacked) {
    assessment.allowed = false;
    assessment.issues.push("Basis und Protein brauchen als freie Mahlzeit noch Gemüse oder Obst");
  }
  if (has("accent") && substantive.length === 1) {
    assessment.allowed = false;
    assessment.issues.push("Würzung wird als eigenes Gericht verwendet");
  }

  if (hasBase) assessment.score += 24;
  if (hasProduce) assessment.score += 18;
  if (hasProtein) assessment.score += 18;
  if (hasSavoryProduce && hasProtein) assessment.score += 18;
  if (hasBase && hasSavoryProduce) assessment.score += 18;
  if (hasBase && hasSweetFruit && meal === "breakfast") assessment.score += 24;
  if (hasCreamy && (hasBase || hasSweetFruit)) assessment.score += 14;
  if (has("fat")) assessment.score += 6;
  if (has("accent") && substantive.length > 1) assessment.score += 3;
  if (options.recipeBacked) assessment.score += 12;

  assessment.dishLike = assessment.allowed && (
    !!options.recipeBacked ||
    (substantive.length >= 2 && (
      (hasBase && (hasProduce || hasProtein || hasCreamy)) ||
      (hasProtein && hasSavoryProduce) ||
      (meal === "breakfast" && hasSweetFruit && (hasBase || hasCreamy || hasProtein))
    ))
  );
  if (!assessment.dishLike && !isLearningOnly) {
    assessment.allowed = false;
    assessment.issues.push("keine nachvollziehbare Mahlzeitenstruktur");
  }
  return assessment;
}

function plannerCulinaryPairScore(focus, candidate, meal, options = {}) {
  if (!focus || !candidate) return -1000;
  const assessment = plannerCulinaryAssessment(
    [focus.id, candidate.id],
    options.foods || [focus, candidate],
    meal,
    {
      recipeBacked: !!options.recipeBacked,
      learningOnly: !!options.learningOnly,
    },
  );
  return assessment.allowed ? assessment.score : -1000;
}

function plannerCulinaryPairAllowed(focus, candidate, meal, options = {}) {
  return plannerCulinaryPairScore(focus, candidate, meal, options) > -1000;
}

function plannerCulinaryRecipeScore(recipe, ids, foods = [], meal = "lunch") {
  const assessment = plannerCulinaryAssessment(ids, foods, meal, { recipeBacked: true });
  if (!assessment.allowed) return -1000;
  const categoryBonus = {
    porridge: 8,
    pancakes: 8,
    baking: 8,
    balls: 6,
    family: 10,
    philippines: 8,
  }[String(recipe?.category || "")] || 0;
  return assessment.score + categoryBonus;
}

function plannerCulinaryBestCandidate(candidates, scoreFn, fallback = null) {
  if (!Array.isArray(candidates) || !candidates.length) return fallback;
  let best = null;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = Number(scoreFn(candidate));
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best || fallback;
}

function installPlannerCulinaryQualityRuntime() {
  if (typeof globalThis === "undefined" || globalThis.__plannerCulinaryQualityRuntimeInstalled) return false;
  if (typeof companionFor !== "function") return false;
  globalThis.__plannerCulinaryQualityRuntimeInstalled = true;

  const originalCompanionFor = companionFor;
  companionFor = function culinaryQualityCompanionFor(focus, meal, on, focusType = "") {
    const allFoods = state?.foods || [];
    const recipes = typeof recipeStates === "function"
      ? recipeStates()
      : (typeof RECIPES !== "undefined" ? RECIPES : []);
    const isLearning = ["neu", "gezielt wiederholen", "Allergen einführen", "Allergen wiederholen", "manuell"].includes(String(focusType || ""));
    const candidates = [];
    const blocked = new Set();
    const max = Math.min(32, allFoods.length + 1);
    for (let index = 0; index < max; index++) {
      const previous = state.foods;
      state.foods = allFoods.filter((item) => item?.id === focus?.id || !blocked.has(item?.id));
      let result;
      try {
        result = originalCompanionFor(focus, meal, on, focusType);
      } finally {
        state.foods = previous;
      }
      if (!result?.id || blocked.has(result.id)) break;
      blocked.add(result.id);
      const canonical = allFoods.find((item) => item.id === result.id) || result;
      const recipeBacked = plannerCulinaryRecipeHasPair(
        focus,
        canonical,
        meal,
        recipes,
        allFoods,
        typeof plannerRecipeSuitableForMeal === "function" ? plannerRecipeSuitableForMeal : null,
      );
      const score = plannerCulinaryPairScore(focus, canonical, meal, {
        foods: allFoods,
        recipeBacked,
        learningOnly: isLearning,
      });
      if (score > -1000) candidates.push({ food: canonical, score, index });
    }
    if (!candidates.length) return isLearning ? originalCompanionFor(focus, meal, on, focusType) : null;
    candidates.sort((a, b) => b.score - a.score || a.index - b.index);
    return candidates[0].food;
  };

  if (typeof culinaryCompatibilityScore === "function") {
    const originalScore = culinaryCompatibilityScore;
    culinaryCompatibilityScore = function plannerCulinaryCompatibilityScore(focus, candidate, meal) {
      const score = plannerCulinaryPairScore(focus, candidate, meal, { foods: state?.foods || [focus, candidate] });
      return score > -1000 ? -score : 1000;
    };
    culinaryCompatibilityScore.__previous = originalScore;
  }

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerCulinaryQualityRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PLANNER_CULINARY_BASE_CATEGORIES,
    PLANNER_CULINARY_PRODUCE_CATEGORIES,
    PLANNER_CULINARY_PROTEIN_CATEGORIES,
    plannerCulinaryRole,
    plannerCulinaryCanonicalIds,
    plannerCulinaryItems,
    plannerCulinaryRecipeVariants,
    plannerCulinaryRecipeHasPair,
    plannerCulinaryRecipeIngredientReady,
    plannerCulinaryAssessment,
    plannerCulinaryPairScore,
    plannerCulinaryPairAllowed,
    plannerCulinaryRecipeScore,
    plannerCulinaryBestCandidate,
    installPlannerCulinaryQualityRuntime,
  };
}
