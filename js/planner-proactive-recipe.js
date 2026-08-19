"use strict";

/* PLAN-08 proaktives Recipe-first.
 *
 * Dieser Pfad ist bewusst vom bestehenden exakten Promotion-Pfad getrennt:
 * - Die bereits vom Planner gewählte FOOD-Mahlzeit bleibt der fachliche Anker.
 * - Ein vorhandenes Rezept darf diese Mahlzeit um bekannte, automatisch geeignete
 *   Zutaten erweitern, wenn dadurch eine eindeutige Rezeptvariante entsteht.
 * - Ein Rezept darf genau EIN neues Lebensmittel enthalten. Dieses neue FOOD muss
 *   bereits als einzige Kostprobe / Einführung der Mahlzeit geplant sein; alle
 *   übrigen Rezeptzutaten müssen nach dem bestehenden Rezeptvertrag bekannt sein.
 * - Ein exakt passendes Rezept darf ebenfalls genau dieses eine neue FOOD enthalten.
 * - Ohne geplante Kostprobe werden keinerlei neue Lebensmittel über das Rezept
 *   eingeführt.
 * - Zwei oder mehr neue Lebensmittel in einem Rezept werden nie automatisch geplant.
 * - base/component/sample bleiben auch nach der Rezeptpromotion im selben kanonischen
 *   Rollenvertrag wie Planner, Persistenz und Bearbeiten-Dialog.
 */

const PLANNER_PROACTIVE_RECIPE_INTRO_TYPES = new Set([
  "neu",
  "gezielt wiederholen",
  "Allergen einführen",
  "Allergen wiederholen",
  "manuell",
]);

function plannerProactiveRecipeNameVariants(recipe) {
  if (typeof plannerRecipeNameVariants === "function") {
    return plannerRecipeNameVariants(recipe);
  }
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

function plannerProactiveCanonicalIds(ids) {
  if (typeof plannerRecipeCanonicalIds === "function") {
    return plannerRecipeCanonicalIds(ids);
  }
  return [...new Set(ids || [])].filter(Boolean).sort();
}

function plannerProactiveRecipeCandidates(
  meal,
  recipes,
  foods,
  recipeSuitableFn,
  ingredientReadyFn,
  foodEligibleFn = null,
  recipeAllowedFn = null,
  on = "",
) {
  if (!meal?.active || meal.empty || meal.recipeName || meal.manualAdded || meal.lockedMode) return [];
  if (meal.meal === "snack") return [];

  let plannedIds = plannerProactiveCanonicalIds(meal.foodIds);
  let sampleIds = plannerProactiveCanonicalIds(meal.sampleFoodIds);
  if (plannedIds.length < 2 || sampleIds.length > 1) return [];

  let planned = new Set(plannedIds);
  let samples = new Set(sampleIds);
  let byName = new Map((foods || []).map((item) => [item.name, item]));
  let suitable = typeof recipeSuitableFn === "function" ? recipeSuitableFn : () => true;
  let ready = typeof ingredientReadyFn === "function" ? ingredientReadyFn : () => true;
  let foodEligible = typeof foodEligibleFn === "function" ? foodEligibleFn : () => true;
  let recipeAllowed = typeof recipeAllowedFn === "function" ? recipeAllowedFn : () => true;
  let raw = [];

  for (let recipe of recipes || []) {
    if (!recipe || !suitable(recipe, meal.meal) || !recipeAllowed(recipe)) continue;
    if (Array.isArray(recipe.requirementMissing) && recipe.requirementMissing.length) continue;

    for (let names of plannerProactiveRecipeNameVariants(recipe)) {
      if (!names.length) continue;
      let items = names.map((name) => byName.get(name));
      if (items.some((item) => !item)) continue;
      let ids = plannerProactiveCanonicalIds(items.map((item) => item.id));
      if (ids.length < plannedIds.length) continue;
      if (!sampleIds.length && ids.length === plannedIds.length) continue;
      if (!plannedIds.every((id) => ids.includes(id))) continue;

      let invalidReadiness = items.some((item) => {
        if (samples.has(item.id)) return false;
        return !ready(item.name);
      });
      if (invalidReadiness) continue;

      let addedItems = items.filter((item) => !planned.has(item.id));
      if (!addedItems.length && !sampleIds.length) continue;
      if (addedItems.some((item) => !foodEligible(item, meal.meal, on))) continue;
      if (!sampleIds.length && items.some((item) => !ready(item.name))) continue;

      raw.push({
        recipe,
        ids,
        addedIds: plannerProactiveCanonicalIds(addedItems.map((item) => item.id)),
        sampleFoodId: sampleIds[0] || "",
      });
    }
  }

  let byRecipe = new Map();
  for (let candidate of raw) {
    let key = candidate.recipe.name;
    if (!byRecipe.has(key)) byRecipe.set(key, []);
    byRecipe.get(key).push(candidate);
  }

  let result = [];
  for (let variants of byRecipe.values()) {
    let minAdded = Math.min(...variants.map((candidate) => candidate.addedIds.length));
    let minimal = variants.filter((candidate) => candidate.addedIds.length === minAdded);
    let unique = [];
    for (let candidate of minimal) {
      let key = candidate.ids.join("+");
      if (!unique.some((entry) => entry.key === key)) unique.push({ key, candidate });
    }
    if (unique.length === 1) result.push(unique[0].candidate);
  }
  return result;
}

function plannerProactiveRecipeRoleState(meal, candidate, on = "", roleInfoFn = null) {
  if (!meal || !candidate?.recipe || !candidate?.ids?.length) return null;
  let ids = plannerProactiveCanonicalIds(candidate.ids);
  let samples = plannerProactiveCanonicalIds(meal.sampleFoodIds).filter((id) => ids.includes(id));
  if (samples.length > 1) return null;
  let sampleSet = new Set(samples);
  let bases = [];
  let components = [];

  for (let id of ids) {
    if (sampleSet.has(id)) continue;
    if (typeof roleInfoFn !== "function") {
      if ((meal.baseFoodIds || []).includes(id)) bases.push(id);
      else components.push(id);
      continue;
    }
    let info = roleInfoFn(id, meal.meal, on, { recipeName: candidate.recipe.name });
    if (info?.role === "base") bases.push(id);
    else if (info?.role === "component") components.push(id);
    else return null;
  }

  return {
    ids,
    bases,
    samples,
    components,
    foodRoles: Object.fromEntries(ids.map((id) => [
      id,
      sampleSet.has(id) ? "sample" : bases.includes(id) ? "base" : "component",
    ])),
  };
}

function plannerSelectProactiveRecipe(candidates, ctx = {}) {
  let ranked = (candidates || [])
    .map((candidate) => ({
      candidate,
      added: candidate.addedIds?.length || 0,
      used: ctx.recipePlannedUse?.get(candidate.recipe?.name) || 0,
    }))
    .sort((a, b) =>
      a.added - b.added ||
      a.used - b.used ||
      String(a.candidate.recipe?.name || "").localeCompare(String(b.candidate.recipe?.name || ""), "de"),
    );
  if (!ranked.length) return null;
  if (
    ranked.length > 1 &&
    ranked[0].added === ranked[1].added &&
    ranked[0].used === ranked[1].used
  ) return null;
  return ranked[0].candidate;
}

function plannerProactiveRuntimeFoodEligible(item, meal, on) {
  if (!item) return false;
  if (typeof status === "function" && status(item) === "Pausiert") return false;
  if (typeof plannerAutomaticFoodMealEligible === "function") {
    return plannerAutomaticFoodMealEligible(
      item,
      meal,
      on,
      state?.settings || {},
      typeof automaticFoodEligibility === "function" ? automaticFoodEligibility : null,
    );
  }
  if (typeof plannerFoodMealEligible === "function" && !plannerFoodMealEligible(item, meal)) return false;
  if (typeof automaticFoodEligibility === "function") {
    return automaticFoodEligibility(item, on, state?.settings || {});
  }
  return true;
}

function plannerApplyProactiveRecipeMeal(meal, candidate, date, ctx, reserveFn, roleState = null) {
  if (!meal || !candidate?.recipe || !candidate.ids?.length) return meal;
  let sampleIds = plannerProactiveCanonicalIds(meal.sampleFoodIds);
  let originalType = meal.type;
  let roles = roleState || plannerProactiveRecipeRoleState(meal, candidate, date, null);
  if (!roles) return meal;

  if (typeof plannerReleaseFoodInventoryReservations === "function") {
    plannerReleaseFoodInventoryReservations(meal, ctx);
  }

  meal.foodIds = [...roles.ids];
  meal.recipeName = candidate.recipe.name;
  meal.recipeInventoryId = "";
  meal.milkMeal = candidate.recipe.milkMeal || meal.milkMeal || "";
  meal.baseFoodIds = [...roles.bases];
  meal.sampleFoodIds = [...roles.samples];
  meal.foodRoles = { ...roles.foodRoles };
  meal.type = sampleIds.length ? originalType : "Rezept";

  if (typeof applyPlannedMealAmounts === "function") applyPlannedMealAmounts(meal);

  if (ctx?.recipePlannedUse) {
    ctx.recipePlannedUse.set(
      candidate.recipe.name,
      (ctx.recipePlannedUse.get(candidate.recipe.name) || 0) + 1,
    );
  }

  let addition = sampleIds.length
    ? `Rezept mit genau einem neuen Lebensmittel; ${typeof food === "function" ? food(sampleIds[0])?.name || sampleIds[0] : sampleIds[0]} bleibt die einzige Kostprobe.`
    : "Passendes vorhandenes Rezept statt einer künstlichen freien FOOD-Kombination.";
  meal.note = meal.note ? `${meal.note} ${addition}` : addition;

  if (typeof reserveFn === "function") reserveFn(meal, ctx);
  return meal;
}

function installPlannerProactiveRecipeRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__plannerProactiveRecipeRuntimeInstalled) return false;
  if (
    typeof buildDay !== "function" ||
    typeof recipeStates !== "function" ||
    typeof plannerRecipeSuitableForMeal !== "function" ||
    typeof recipeIngredientReady !== "function" ||
    typeof reserveMealInventory !== "function" ||
    typeof plannerRecipeFirstFreshMeal !== "function" ||
    typeof manualMealRoleInfo !== "function"
  ) return false;

  globalThis.__plannerProactiveRecipeRuntimeInstalled = true;
  let originalBuildDay = buildDay;
  let originalFreshMealCheck = plannerRecipeFirstFreshMeal;

  plannerRecipeFirstFreshMeal = function proactiveRecipeFirstFreshMeal(meal) {
    if (originalFreshMealCheck(meal)) return true;
    return !!(
      meal?.active &&
      !meal.empty &&
      meal.recipeName &&
      !meal.recipeInventoryId &&
      (meal.sampleFoodIds || []).length === 1 &&
      PLANNER_PROACTIVE_RECIPE_INTRO_TYPES.has(meal.type)
    );
  };

  buildDay = function proactiveRecipeFirstBuildDay(date, index, ctx) {
    let day = originalBuildDay(date, index, ctx);
    for (let meal of day?.meals || []) {
      if (!meal?.active || meal.empty || meal.recipeName || meal.manualAdded || meal.lockedMode) continue;
      if (meal.meal === "snack" || (meal.sampleFoodIds || []).length > 1) continue;

      let candidates = plannerProactiveRecipeCandidates(
        meal,
        recipeStates(),
        state?.foods || [],
        plannerRecipeSuitableForMeal,
        recipeIngredientReady,
        plannerProactiveRuntimeFoodEligible,
        (recipe) =>
          (typeof plannerRecipeMilkContextCompatible !== "function" || plannerRecipeMilkContextCompatible(meal, recipe)) &&
          !(recipe?.milkMeal === "full" &&
            typeof recipeContainsMeatOrFish === "function" &&
            recipeContainsMeatOrFish(recipe)),
        date,
      )
        .map((candidate) => ({
          ...candidate,
          roleState: plannerProactiveRecipeRoleState(meal, candidate, date, manualMealRoleInfo),
        }))
        .filter((candidate) => !!candidate.roleState);
      let selected = plannerSelectProactiveRecipe(candidates, ctx);
      if (!selected) continue;
      plannerApplyProactiveRecipeMeal(meal, selected, date, ctx, reserveMealInventory, selected.roleState);
    }
    return day;
  };

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerProactiveRecipeRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PLANNER_PROACTIVE_RECIPE_INTRO_TYPES,
    plannerProactiveRecipeNameVariants,
    plannerProactiveCanonicalIds,
    plannerProactiveRecipeCandidates,
    plannerProactiveRecipeRoleState,
    plannerSelectProactiveRecipe,
    plannerProactiveRuntimeFoodEligible,
    plannerApplyProactiveRecipeMeal,
    installPlannerProactiveRecipeRuntime,
  };
}
