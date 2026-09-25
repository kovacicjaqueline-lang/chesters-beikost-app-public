"use strict";

/* Zentrale Mahlzeiteneignung für automatische Planner-Pfade.
 * FOOD.meals ist für Frühstück, Mittag und Abend eine harte Eingangsvoraussetzung.
 * Snack bleibt bewusst rezeptgetrieben und erhält kein neues allgemeines FOOD-snack-Feld.
 * Die automatische Rezept-Mahlzeiteneignung wird hier ebenfalls zentral gehalten,
 * damit App- und Planner-Pfad dieselbe Regelquelle verwenden.
 */

const PLANNER_MEAL_ELIGIBILITY_MAIN_MEALS = new Set([
  "breakfast",
  "lunch",
  "dinner",
]);

function plannerFoodMealEligible(foodRecord, meal) {
  if (!foodRecord) return false;
  if (!PLANNER_MEAL_ELIGIBILITY_MAIN_MEALS.has(meal)) return true;
  return Array.isArray(foodRecord.meals) && foodRecord.meals.includes(meal);
}

function plannerAutomaticFoodMealEligible(
  foodRecord,
  meal,
  on,
  settings = {},
  automaticEligibilityFn = null,
) {
  if (!plannerFoodMealEligible(foodRecord, meal)) return false;
  return typeof automaticEligibilityFn === "function"
    ? automaticEligibilityFn(foodRecord, on, settings)
    : true;
}

function plannerRecipeBreakfastHasBaseCore(
  recipe,
  foods = [],
  canBeBaseFn = null,
) {
  if (recipe?.breakfastBase === false) return false;
  let names = [
    ...(recipe?.requires || []),
    ...(recipe?.alternatives || []).flat(),
    ...(recipe?.oneOf || []),
    ...(recipe?.milkChoices || []),
  ].filter(Boolean);

  if (Array.isArray(foods) && foods.length) {
    return names.some((name) => {
      let item = foods.find((food) => food?.name === name);
      return ["Getreide/Stärke", "Milchprodukt"].includes(item?.category) &&
        (typeof canBeBaseFn !== "function" || canBeBaseFn(item)) &&
        item.id !== "kuhmilch";
    });
  }

  return names.some((name) =>
    /hafer|hirse|polenta|reis|quinoa|buchweizen|weizen|dinkel|grieß|griess|naturjoghurt|joghurt|buttermilch|quark|skyr/i.test(String(name)),
  );
}

function plannerRecipeSuitableForMealCore(
  recipe,
  meal,
  foods = [],
  canBeBaseFn = null,
) {
  if (!recipe) return false;
  let excludedMeals = Array.isArray(recipe.excludeMeals) ? recipe.excludeMeals : [];
  if (excludedMeals.includes(meal)) return false;

  let category = String(recipe.category || "");
  if (meal === "snack") {
    return (recipe.tags || []).some(
      (tag) => String(tag || "").trim().toLowerCase() === "snack",
    );
  }
  if (meal === "breakfast") {
    return ["porridge", "pancakes", "baking"].includes(category) &&
      plannerRecipeBreakfastHasBaseCore(recipe, foods, canBeBaseFn);
  }
  if (meal === "dinner") {
    return category !== "philippines" || Number(recipe.stage || 1) <= 3;
  }
  return true;
}

function installPlannerRecipeMealEligibilityRuntime() {
  if (typeof globalThis === "undefined") return false;

  let runtimeRecipeSuitableForMeal = (recipe, meal) => {
    let foods = typeof state !== "undefined" && Array.isArray(state?.foods)
      ? state.foods
      : typeof FOOD_DB !== "undefined" && Array.isArray(FOOD_DB)
        ? FOOD_DB
        : [];
    let canBeBaseFn = typeof plannerFoodCanBeBase === "function"
      ? plannerFoodCanBeBase
      : null;
    return plannerRecipeSuitableForMealCore(recipe, meal, foods, canBeBaseFn);
  };

  let runtimeBreakfastHasBase = (recipe) => {
    let foods = typeof state !== "undefined" && Array.isArray(state?.foods)
      ? state.foods
      : typeof FOOD_DB !== "undefined" && Array.isArray(FOOD_DB)
        ? FOOD_DB
        : [];
    let canBeBaseFn = typeof plannerFoodCanBeBase === "function"
      ? plannerFoodCanBeBase
      : null;
    return plannerRecipeBreakfastHasBaseCore(recipe, foods, canBeBaseFn);
  };

  globalThis.recipeSuitableForMeal = runtimeRecipeSuitableForMeal;
  globalThis.plannerRecipeSuitableForMeal = runtimeRecipeSuitableForMeal;
  globalThis.plannerRecipeBreakfastHasBase = runtimeBreakfastHasBase;
  globalThis.__plannerRecipeMealEligibilityCoreInstalled = true;
  return true;
}

function pruneMealIneligibleAutomaticPlanState(currentState) {
  if (!currentState?.planLocks) return false;
  let changed = false;
  for (let [key, lock] of Object.entries(currentState.planLocks)) {
    if (lock?.mode !== "auto") continue;
    let meal = String(key || "").split("|")[1] || lock.meal || "";
    if (!PLANNER_MEAL_ELIGIBILITY_MAIN_MEALS.has(meal)) continue;
    let ids = [...new Set([...(lock.foodIds || []), ...(lock.optionalAddons || [])])];
    let blocked = ids.some((id) => {
      let f = currentState.foods?.find((item) => item.id === id);
      return !!f && !plannerFoodMealEligible(f, meal);
    });
    if (!blocked) continue;

    delete currentState.planLocks[key];
    if (
      currentState.overrides?.[key] &&
      !String(currentState.overrides[key]).startsWith("__")
    ) delete currentState.overrides[key];

    if (lock.followUpFoodId && currentState.followUps?.[lock.followUpFoodId]) {
      currentState.followUps[lock.followUpFoodId].status = "later";
      currentState.followUps[lock.followUpFoodId].dueDate = "";
    }
    changed = true;
  }
  return changed;
}

function installPlannerMealEligibilityRuntime() {
  if (typeof globalThis === "undefined") return false;
  installPlannerRecipeMealEligibilityRuntime();
  if (globalThis.__plannerMealEligibilityRuntimeInstalled) return false;
  if (
    typeof companionFor !== "function" ||
    typeof recipeStockCandidate !== "function" ||
    typeof snackRecipeCandidate !== "function" ||
    typeof recipeFoodIds !== "function" ||
    typeof applyFollowUpPlan !== "function" ||
    typeof pruneIneligibleAutomaticPlanState !== "function"
  ) return false;

  globalThis.__plannerMealEligibilityRuntimeInstalled = true;

  let originalCompanionFor = companionFor;
  let originalRecipeStockCandidate = recipeStockCandidate;
  let originalSnackRecipeCandidate = snackRecipeCandidate;
  let originalRecipeFoodIds = recipeFoodIds;
  let originalApplyFollowUpPlan = applyFollowUpPlan;
  let originalPruneIneligibleAutomaticPlanState = pruneIneligibleAutomaticPlanState;
  let pendingRecipeMeal = new WeakMap();

  let withMealEligibleFoods = (meal, on, includeIds, callback) => {
    if (!state?.foods) return callback();
    let originalFoods = state.foods;
    let keep = new Set(includeIds || []);
    state.foods = originalFoods.filter(
      (item) =>
        keep.has(item.id) ||
        plannerAutomaticFoodMealEligible(
          item,
          meal,
          on,
          state.settings || {},
          typeof automaticFoodEligibility === "function"
            ? automaticFoodEligibility
            : null,
        ),
    );
    try {
      return callback();
    } finally {
      state.foods = originalFoods;
    }
  };

  companionFor = function mealEligibleCompanionFor(
    focus,
    meal,
    on,
    focusType = "",
  ) {
    return withMealEligibleFoods(meal, on, [focus?.id], () =>
      originalCompanionFor(focus, meal, on, focusType),
    );
  };

  recipeStockCandidate = function mealEligibleRecipeStockCandidate(meal, on, ctx) {
    return withMealEligibleFoods(meal, on, [], () => {
      let recipe = originalRecipeStockCandidate(meal, on, ctx);
      if (recipe && typeof recipe === "object") {
        pendingRecipeMeal.set(recipe, { meal, on });
      }
      return recipe;
    });
  };

  snackRecipeCandidate = function mealEligibleSnackRecipeCandidate(on, ctx) {
    return withMealEligibleFoods("snack", on, [], () => {
      let recipe = originalSnackRecipeCandidate(on, ctx);
      if (recipe && typeof recipe === "object") {
        pendingRecipeMeal.set(recipe, { meal: "snack", on });
      }
      return recipe;
    });
  };

  recipeFoodIds = function mealEligibleRecipeFoodIds(recipe, ...rest) {
    let context = recipe && typeof recipe === "object"
      ? pendingRecipeMeal.get(recipe)
      : null;
    if (!context) return originalRecipeFoodIds(recipe, ...rest);
    pendingRecipeMeal.delete(recipe);
    return withMealEligibleFoods(context.meal, context.on, [], () =>
      originalRecipeFoodIds(recipe, ...rest),
    );
  };

  applyFollowUpPlan = function mealEligibleApplyFollowUpPlan(
    record,
    requestedDate = "",
  ) {
    let meal = record?.meal || "lunch";
    let focus = typeof food === "function" ? food(record?.foodId) : null;
    if (focus && !plannerFoodMealEligible(focus, meal)) {
      if (typeof removeFollowUpPlan === "function") removeFollowUpPlan(record.foodId);
      record.status = "later";
      record.dueDate = "";
      record.updatedAt = new Date().toISOString();
      return { ok: true, date: "" };
    }

    let result = originalApplyFollowUpPlan(record, requestedDate);
    if (!result?.ok || !result.date || !state) return result;
    let key = `${result.date}|${meal}`;
    let changed = pruneMealIneligibleAutomaticPlanState(state);
    if (!changed || state.planLocks?.[key]) return result;
    if (record) {
      record.status = "later";
      record.dueDate = "";
      record.updatedAt = new Date().toISOString();
    }
    return { ok: true, date: "" };
  };

  pruneIneligibleAutomaticPlanState = function mealEligiblePruneAutomaticPlanState(
    currentState,
    ...rest
  ) {
    let changed = originalPruneIneligibleAutomaticPlanState(currentState, ...rest);
    if (pruneMealIneligibleAutomaticPlanState(currentState)) changed = true;
    return changed;
  };

  if (typeof state !== "undefined" && state) {
    let changed = pruneIneligibleAutomaticPlanState(state);
    if (changed) {
      if (typeof save === "function") save();
      if (typeof renderAll === "function") renderAll();
    }
  }

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerRecipeMealEligibilityRuntime();
  installPlannerMealEligibilityRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PLANNER_MEAL_ELIGIBILITY_MAIN_MEALS,
    plannerFoodMealEligible,
    plannerAutomaticFoodMealEligible,
    plannerRecipeBreakfastHasBaseCore,
    plannerRecipeSuitableForMealCore,
    installPlannerRecipeMealEligibilityRuntime,
    pruneMealIneligibleAutomaticPlanState,
    installPlannerMealEligibilityRuntime,
  };
}
