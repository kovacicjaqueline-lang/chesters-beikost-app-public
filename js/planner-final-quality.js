"use strict";

/*
 * Letzter fachlicher Guard fuer automatisch erzeugte Hauptmahlzeiten.
 *
 * Alle vorgelagerten Planner-Schichten duerfen Kandidaten priorisieren und
 * dekorieren. Hier wird nur noch sichergestellt, dass das Endergebnis weiterhin
 * eine sinnvolle Mahlzeit ist. Bewusste Kostproben, Snacks und manuelle Plaene
 * bleiben unberuehrt.
 */
const PLANNER_FINAL_BREAKFAST_STYLE_CATEGORIES = new Set([
  "porridge",
  "pancakes",
  "baking",
]);
const PLANNER_FINAL_MAIN_MEALS = new Set(["breakfast", "lunch", "dinner"]);
const PLANNER_FINAL_LEARNING_TYPES = new Set([
  "neu",
  "gezielt wiederholen",
  "Allergen einführen",
  "Allergen wiederholen",
  "manuell",
]);

function plannerFinalCanonicalIds(ids = []) {
  return [...new Set((ids || []).filter(Boolean))];
}

function plannerFinalAutomaticRecipeSuitable(recipe, meal, baseSuitableFn = null) {
  if (!recipe) return false;
  if (Array.isArray(recipe.excludeMeals) && recipe.excludeMeals.includes(meal)) return false;
  if (typeof baseSuitableFn === "function" && !baseSuitableFn(recipe, meal)) return false;
  if (
    meal === "lunch" &&
    PLANNER_FINAL_BREAKFAST_STYLE_CATEGORIES.has(String(recipe.category || ""))
  ) return false;
  return true;
}

function plannerFinalProtectedMeal(meal) {
  return !!(
    meal?.manualAdded ||
    meal?.lockedMode === "manual" ||
    meal?.mode === "manual"
  );
}

function plannerFinalLearningOnly(meal) {
  let ids = plannerFinalCanonicalIds(meal?.foodIds || []);
  if (ids.length !== 1) return false;
  let samples = new Set(meal?.sampleFoodIds || []);
  return samples.has(ids[0]) && PLANNER_FINAL_LEARNING_TYPES.has(String(meal?.type || ""));
}

function plannerFinalRecipeForMeal(meal) {
  if (!meal?.recipeName || typeof recipeByName !== "function") return null;
  return recipeByName(meal.recipeName);
}

function plannerFinalMealAssessment(meal, foods = [], helpers = {}) {
  let ids = plannerFinalCanonicalIds(meal?.foodIds || []);
  let result = {
    allowed: true,
    ids,
    recipeBacked: false,
    learningOnly: false,
    reason: "",
  };
  if (!meal?.active || meal?.empty || !PLANNER_FINAL_MAIN_MEALS.has(String(meal?.meal || ""))) return result;
  if (plannerFinalProtectedMeal(meal)) return result;

  let recipe = typeof helpers.recipeForMeal === "function"
    ? helpers.recipeForMeal(meal)
    : null;
  let recipeSuitable = typeof helpers.recipeSuitable === "function"
    ? helpers.recipeSuitable(recipe, meal.meal)
    : true;
  if (meal.recipeName && (!recipe || !recipeSuitable)) {
    return { ...result, allowed: false, reason: "recipe-meal-mismatch" };
  }

  let learningOnly = plannerFinalLearningOnly(meal);
  let recipeBacked = !!recipe;
  if (typeof helpers.culinaryAssessment === "function") {
    let assessment = helpers.culinaryAssessment(ids, foods, meal.meal, {
      recipeBacked,
      learningOnly,
      sampleOnly: learningOnly,
    });
    return {
      ...result,
      allowed: !!assessment?.allowed,
      recipeBacked,
      learningOnly,
      reason: assessment?.allowed ? "" : (assessment?.issues || []).join("; ") || "culinary-invalid",
      assessment,
    };
  }

  if (!ids.length) return { ...result, allowed: false, reason: "empty" };
  if (ids.length === 1 && !learningOnly && !recipeBacked) {
    return { ...result, allowed: false, reason: "singleton" };
  }
  return { ...result, recipeBacked, learningOnly };
}

function installPlannerFinalQualityRuntime(globalScope = typeof globalThis !== "undefined" ? globalThis : this) {
  if (!globalScope || globalScope.__plannerFinalQualityRuntimeInstalled) return false;
  if (typeof buildDay !== "function") return false;
  globalScope.__plannerFinalQualityRuntimeInstalled = true;

  if (typeof plannerRecipeSuitableForMeal === "function") {
    const basePlannerRecipeSuitableForMeal = plannerRecipeSuitableForMeal;
    plannerRecipeSuitableForMeal = function finalQualityRecipeSuitableForMeal(recipe, meal) {
      return plannerFinalAutomaticRecipeSuitable(recipe, meal, basePlannerRecipeSuitableForMeal);
    };
    plannerRecipeSuitableForMeal.__previous = basePlannerRecipeSuitableForMeal;
  }

  const recipeSuitable = (recipe, meal) => {
    if (!recipe) return false;
    if (typeof plannerRecipeSuitableForMeal === "function") {
      return plannerRecipeSuitableForMeal(recipe, meal);
    }
    if (typeof recipeSuitableForMeal === "function") return recipeSuitableForMeal(recipe, meal);
    return plannerFinalAutomaticRecipeSuitable(recipe, meal);
  };

  const assessmentFor = (meal) => plannerFinalMealAssessment(
    meal,
    state?.foods || [],
    {
      recipeForMeal: plannerFinalRecipeForMeal,
      recipeSuitable,
      culinaryAssessment: typeof plannerCulinaryAssessment === "function"
        ? plannerCulinaryAssessment
        : null,
    },
  );

  function availableFood(foodRecord) {
    return !!foodRecord &&
      foodRecord.active !== false &&
      (typeof isFoodUnavailable !== "function" || !isFoodUnavailable(foodRecord.id));
  }

  function companionCandidates(meal, date, ctx) {
    let focus = typeof food === "function" ? food(meal.focusId) : null;
    if (!availableFood(focus) || typeof companionFor !== "function") return [];
    let allFoods = state?.foods || [];
    let candidates = [];

    for (let candidate of allFoods) {
      if (!availableFood(candidate) || candidate.id === focus.id) continue;
      let selected = null;
      let previousFoods = state.foods;
      try {
        // companionFor hat keinen exclude-Parameter. Die isolierte Zweiermenge
        // laesst deshalb den kompletten aktuellen Wrapper-Stack genau diesen
        // Kandidaten pruefen, statt dessen Regeln hier ein zweites Mal zu bauen.
        state.foods = allFoods.filter((item) => item.id === focus.id || item.id === candidate.id);
        selected = companionFor(focus, meal.meal, date, meal.type || "");
      } finally {
        state.foods = previousFoods;
      }
      if (!selected || selected.id !== candidate.id) continue;

      let score = typeof plannerCulinaryPairScore === "function"
        ? plannerCulinaryPairScore(focus, candidate, meal.meal, { foods: allFoods })
        : 0;
      if (score <= -1000) continue;
      let reserved = Number(ctx?.inventoryReserved?.get(candidate.id) || 0);
      let stock = state.settings?.preferInventoryInPlan && typeof inventoryPortions === "function"
        ? Number(inventoryPortions(candidate.id) || 0) > reserved
        : false;
      let plannedUse = Number(ctx?.plannedUse?.get(candidate.id) || 0);
      let historicalUse = typeof usageCount === "function" ? usageCount(candidate.id) : 0;
      candidates.push({ candidate, score, stock, plannedUse, historicalUse });
    }

    return candidates.sort((a, b) =>
      Number(b.stock) - Number(a.stock) ||
      b.score - a.score ||
      a.plannedUse - b.plannedUse ||
      a.historicalUse - b.historicalUse ||
      (Number(a.candidate.priority) || 9999) - (Number(b.candidate.priority) || 9999)
    );
  }

  function clearRecipeIdentity(meal) {
    meal.recipeName = "";
    meal.recipeInventoryId = "";
    delete meal.compositionMode;
    delete meal.recipeIngredientFoodIds;
    delete meal.additionalFoodIds;
    delete meal.recipePairingKey;
  }

  function applyCompanion(meal, companion, date, ctx) {
    if (!meal || !companion) return meal;
    let focusId = meal.focusId;
    let sampleIds = plannerFinalCanonicalIds(meal.sampleFoodIds || []);
    meal.foodIds = plannerFinalCanonicalIds([focusId, companion.id, ...sampleIds]);
    clearRecipeIdentity(meal);

    if (
      typeof plannerAutomaticFoodRoleState === "function" &&
      typeof plannerApplyAutomaticFoodRoleState === "function" &&
      typeof manualMealRoleInfo === "function"
    ) {
      let roles = plannerAutomaticFoodRoleState(
        meal,
        (id, mealKey, on, context) => manualMealRoleInfo(id, mealKey, on, context),
        date,
      );
      if (roles) plannerApplyAutomaticFoodRoleState(meal, roles);
    } else {
      meal.baseFoodIds = meal.foodIds.filter((id) => id !== focusId && !sampleIds.includes(id));
    }

    if (state.settings?.preferInventoryInPlan && typeof inventoryPortions === "function") {
      let reserved = Number(ctx?.inventoryReserved?.get(companion.id) || 0);
      if (Number(inventoryPortions(companion.id) || 0) > reserved) {
        meal.inventoryFoodIds = plannerFinalCanonicalIds([...(meal.inventoryFoodIds || []), companion.id]);
        ctx?.inventoryReserved?.set(companion.id, reserved + 1);
      }
    }
    if (typeof applyPlannedMealAmounts === "function") applyPlannedMealAmounts(meal);
    return meal;
  }

  function makeEmpty(meal) {
    meal.empty = true;
    meal.focusId = "";
    meal.foodIds = [];
    meal.baseFoodIds = [];
    meal.sampleFoodIds = [];
    meal.optionalAddons = [];
    meal.inventoryFoodIds = [];
    meal.foodRoles = {};
    meal.ingredientAmounts = {};
    clearRecipeIdentity(meal);
    meal.note = "Noch keine fachlich passende automatische Kombination verfügbar.";
    return meal;
  }

  const baseBuildDay = buildDay;
  buildDay = function finalQualityBuildDay(date, index, ctx) {
    let day = baseBuildDay(date, index, ctx);
    for (let meal of day?.meals || []) {
      if (
        !meal?.active ||
        meal.empty ||
        !PLANNER_FINAL_MAIN_MEALS.has(String(meal.meal || "")) ||
        plannerFinalProtectedMeal(meal)
      ) continue;

      let assessment = assessmentFor(meal);
      if (assessment.allowed) continue;

      // Ein automatisches Rezept im falschen Slot wird nicht stillschweigend in
      // dieselben Zutaten ohne Rezeptlabel umgedeutet. Der Slot wird durch den
      // normalen Planner beim naechsten Lauf neu aufgebaut.
      if (assessment.reason === "recipe-meal-mismatch") {
        makeEmpty(meal);
        continue;
      }

      let best = companionCandidates(meal, date, ctx)[0]?.candidate || null;
      if (best) {
        applyCompanion(meal, best, date, ctx);
        assessment = assessmentFor(meal);
      }
      if (!assessment.allowed) makeEmpty(meal);
    }
    return day;
  };
  buildDay.__previous = baseBuildDay;

  globalScope.PlannerFinalQuality = Object.freeze({
    recipeSuitable: plannerFinalAutomaticRecipeSuitable,
    mealAssessment: plannerFinalMealAssessment,
  });
  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerFinalQualityRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PLANNER_FINAL_BREAKFAST_STYLE_CATEGORIES,
    PLANNER_FINAL_MAIN_MEALS,
    plannerFinalAutomaticRecipeSuitable,
    plannerFinalMealAssessment,
  };
}
