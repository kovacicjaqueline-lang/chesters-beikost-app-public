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

  function companionCandidatesForFocus(focus, meal, date, ctx) {
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

  function companionCandidates(meal, date, ctx) {
    let focus = typeof food === "function" ? food(meal.focusId) : null;
    return companionCandidatesForFocus(focus, meal, date, ctx);
  }

  function clearRecipeIdentity(meal) {
    meal.recipeName = "";
    meal.recipeInventoryId = "";
    delete meal.compositionMode;
    delete meal.recipeIngredientFoodIds;
    delete meal.additionalFoodIds;
    delete meal.recipePairingKey;
  }

  function releaseInventory(meal, ctx) {
    if (typeof plannerReleaseFoodInventoryReservations === "function") {
      plannerReleaseFoodInventoryReservations(meal, ctx);
    }
  }

  function reserveInventory(meal, ctx) {
    if (typeof reserveMealInventory === "function") {
      reserveMealInventory(meal, ctx);
      return;
    }
    if (!state.settings?.preferInventoryInPlan || typeof inventoryPortions !== "function") return;
    for (let id of meal?.foodIds || []) {
      let reserved = Number(ctx?.inventoryReserved?.get(id) || 0);
      if (Number(inventoryPortions(id) || 0) <= reserved) continue;
      meal.inventoryFoodIds = plannerFinalCanonicalIds([...(meal.inventoryFoodIds || []), id]);
      ctx?.inventoryReserved?.set(id, reserved + 1);
    }
  }

  function applyAutomaticRoles(meal, date) {
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
      if (roles) {
        plannerApplyAutomaticFoodRoleState(meal, roles);
        return;
      }
    }
    let samples = new Set(meal.sampleFoodIds || []);
    meal.baseFoodIds = (meal.foodIds || []).filter((id) => id !== meal.focusId && !samples.has(id));
  }

  function updateFocusContext(previousFocusId, nextFocusId, date, day, meal, ctx) {
    if (!previousFocusId || previousFocusId === nextFocusId) {
      if (nextFocusId && ctx?.lastFocus?.set) ctx.lastFocus.set(nextFocusId, date);
      return;
    }

    if (ctx?.plannedUse?.get && ctx?.plannedUse?.set) {
      let previousCount = Number(ctx.plannedUse.get(previousFocusId) || 0);
      if (previousCount <= 1) ctx.plannedUse.delete?.(previousFocusId);
      else ctx.plannedUse.set(previousFocusId, previousCount - 1);
      if (nextFocusId) {
        ctx.plannedUse.set(nextFocusId, Number(ctx.plannedUse.get(nextFocusId) || 0) + 1);
      }
    }

    if (ctx?.lastFocus?.get && ctx?.lastFocus?.set) {
      let previousStillUsed = (day?.meals || []).some(
        (candidate) => candidate !== meal && candidate?.active && !candidate.empty && candidate.focusId === previousFocusId,
      );
      if (!previousStillUsed && ctx.lastFocus.get(previousFocusId) === date) {
        ctx.lastFocus.delete?.(previousFocusId);
      }
      if (nextFocusId) ctx.lastFocus.set(nextFocusId, date);
    }
  }

  function applyCompanion(meal, companion, date, ctx) {
    if (!meal || !companion) return meal;
    releaseInventory(meal, ctx);
    let focusId = meal.focusId;
    let sampleIds = plannerFinalCanonicalIds(meal.sampleFoodIds || []);
    meal.foodIds = plannerFinalCanonicalIds([focusId, companion.id, ...sampleIds]);
    meal.inventoryFoodIds = [];
    clearRecipeIdentity(meal);
    applyAutomaticRoles(meal, date);
    if (typeof applyPlannedMealAmounts === "function") applyPlannedMealAmounts(meal);
    reserveInventory(meal, ctx);
    return meal;
  }

  function replacementKnownPair(meal, date, ctx, day) {
    if (typeof knownCandidate !== "function") return null;
    let excluded = plannerFinalCanonicalIds([
      meal.focusId,
      ...(day?.meals || [])
        .filter((candidate) => candidate !== meal && candidate?.active && !candidate.empty)
        .map((candidate) => candidate.focusId),
    ]);
    let limit = Math.max(1, (state?.foods || []).length);

    for (let attempt = 0; attempt < limit; attempt++) {
      let selected = knownCandidate(meal.meal, date, ctx, excluded);
      let focus = selected?.f || null;
      if (!availableFood(focus) || excluded.includes(focus.id)) return null;

      let probe = {
        ...meal,
        empty: false,
        focusId: focus.id,
        foodIds: [focus.id],
        baseFoodIds: [],
        sampleFoodIds: [],
        recipeName: "",
        recipeInventoryId: "",
        type: selected.type || "bekannt",
      };
      let best = companionCandidatesForFocus(focus, probe, date, ctx)[0]?.candidate || null;
      if (best) return { focus, companion: best, type: probe.type };
      excluded.push(focus.id);
    }
    return null;
  }

  function applyReplacementPair(meal, replacement, date, ctx, day) {
    if (!meal || !replacement?.focus || !replacement?.companion) return meal;
    let previousFocusId = meal.focusId;
    releaseInventory(meal, ctx);
    meal.empty = false;
    meal.focusId = replacement.focus.id;
    meal.foodIds = plannerFinalCanonicalIds([replacement.focus.id, replacement.companion.id]);
    meal.baseFoodIds = [];
    meal.sampleFoodIds = [];
    meal.optionalAddons = [];
    meal.inventoryFoodIds = [];
    meal.foodRoles = {};
    meal.ingredientAmounts = {};
    meal.type = replacement.type || "bekannt";
    clearRecipeIdentity(meal);
    applyAutomaticRoles(meal, date);
    if (typeof applyPlannedMealAmounts === "function") applyPlannedMealAmounts(meal);
    reserveInventory(meal, ctx);
    updateFocusContext(previousFocusId, meal.focusId, date, day, meal, ctx);
    return meal;
  }

  function makeEmpty(meal, date, ctx, day) {
    let previousFocusId = meal.focusId;
    releaseInventory(meal, ctx);
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
    updateFocusContext(previousFocusId, "", date, day, meal, ctx);
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
        plannerFinalProtectedMeal(meal) ||
        state?.overrides?.[`${date}|${meal.meal}`]
      ) continue;

      let assessment = assessmentFor(meal);
      if (assessment.allowed) continue;
      let initialReason = assessment.reason;

      if (assessment.reason !== "recipe-meal-mismatch") {
        let best = companionCandidates(meal, date, ctx)[0]?.candidate || null;
        if (best) {
          applyCompanion(meal, best, date, ctx);
          assessment = assessmentFor(meal);
        }
      }

      if (!assessment.allowed) {
        let replacement = replacementKnownPair(meal, date, ctx, day);
        if (replacement) {
          applyReplacementPair(meal, replacement, date, ctx, day);
          assessment = assessmentFor(meal);
        }
      }

      if (!assessment.allowed && initialReason === "recipe-meal-mismatch") {
        makeEmpty(meal, date, ctx, day);
      }
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
