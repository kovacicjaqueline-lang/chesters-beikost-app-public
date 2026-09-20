"use strict";

function plannerRecipeFoodCanonicalIds(ids) {
  return [...new Set((ids || []).filter(Boolean))].sort();
}

function plannerRecipeFoodNameVariants(recipe) {
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

function plannerRecipeFoodVariantIdSets(recipe, foods, ingredientReadyFn = null, meal = "", on = "") {
  let byName = new Map((foods || []).map((item) => [item.name, item]));
  let ready = typeof ingredientReadyFn === "function" ? ingredientReadyFn : () => true;
  let result = [];

  for (let names of plannerRecipeFoodNameVariants(recipe)) {
    if (!names.length || names.some((name) => !ready(name, byName.get(name), meal, on))) continue;
    let items = names.map((name) => byName.get(name));
    if (items.some((item) => !item)) continue;
    let ids = plannerRecipeFoodCanonicalIds(items.map((item) => item.id));
    if (ids.length && !result.some((existing) => plannerRecipeFoodCanonicalIds(existing).join("+") === ids.join("+"))) {
      result.push(ids);
    }
  }
  return result;
}

function plannerRecipeFoodHasSingleStarch(ids, foods) {
  let byId = new Map((foods || []).map((item) => [item.id, item]));
  return (ids || []).filter((id) => ["Getreide/Stärke", "Wurzel/Knolle"].includes(byId.get(id)?.category)).length <= 1;
}

function plannerRecipeFoodCompositionCandidates(
  meal,
  recipes,
  foods,
  pairings,
  {
    recipeSuitableFn = null,
    ingredientReadyFn = null,
    foodEligibleFn = null,
    milkCompatibleFn = null,
    singleStarchFn = null,
    on = "",
  } = {},
) {
  if (!meal?.active || meal.empty || meal.recipeName || meal.manualAdded || meal.lockedMode) return [];
  if (!["lunch", "dinner"].includes(meal.meal)) return [];

  let suitable = typeof recipeSuitableFn === "function" ? recipeSuitableFn : () => true;
  let eligible = typeof foodEligibleFn === "function" ? foodEligibleFn : () => true;
  let milkCompatible = typeof milkCompatibleFn === "function" ? milkCompatibleFn : () => true;
  let singleStarch = typeof singleStarchFn === "function"
    ? singleStarchFn
    : (ids) => plannerRecipeFoodHasSingleStarch(ids, foods);
  let byRecipe = new Map((recipes || []).map((recipe) => [recipe.name, recipe]));
  let result = [];

  for (let pairing of pairings || []) {
    if (!pairing?.recipeName || !(pairing.meals || []).includes(meal.meal)) continue;
    let additionalFoodId = meal.focusId;
    if (!(pairing.additionalFoodIds || []).includes(additionalFoodId)) continue;

    let additionalFood = (foods || []).find((item) => item.id === additionalFoodId);
    if (!additionalFood || !eligible(additionalFood, meal.meal, on)) continue;

    let recipe = byRecipe.get(pairing.recipeName);
    if (!recipe || !suitable(recipe, meal.meal) || !milkCompatible(meal, recipe)) continue;

    let sampleIds = plannerRecipeFoodCanonicalIds(meal.sampleFoodIds);
    if (sampleIds.length > 1) continue;

    for (let ids of plannerRecipeFoodVariantIdSets(recipe, foods, ingredientReadyFn, meal.meal, on)) {
      if (ids.includes(additionalFoodId)) continue;
      let combinedIds = plannerRecipeFoodCanonicalIds([...ids, additionalFoodId]);
      if (sampleIds.some((id) => !combinedIds.includes(id))) continue;
      if (!singleStarch(combinedIds, foods)) continue;

      result.push({
        key: pairing.key || `${recipe.name}+${additionalFoodId}`,
        recipe,
        recipeIngredientFoodIds: ids,
        additionalFoodId,
        priority: Number(pairing.priority) || 0,
      });
    }
  }

  return result.sort(
    (a, b) => b.priority - a.priority ||
      a.recipe.name.localeCompare(b.recipe.name, "de") ||
      a.additionalFoodId.localeCompare(b.additionalFoodId, "de"),
  );
}

function plannerSelectRecipeFoodComposition(candidates) {
  return (candidates || [])[0] || null;
}

function plannerApplyRecipeFoodComposition(meal, candidate) {
  if (!meal || !candidate?.recipe || !candidate.additionalFoodId) return meal;

  let recipeIngredientFoodIds = plannerRecipeFoodCanonicalIds(candidate.recipeIngredientFoodIds);
  let additionalFoodIds = [candidate.additionalFoodId];
  let combinedIds = plannerRecipeFoodCanonicalIds([...recipeIngredientFoodIds, ...additionalFoodIds]);
  let sampleFoodIds = plannerRecipeFoodCanonicalIds(meal.sampleFoodIds)
    .filter((id) => combinedIds.includes(id));
  let sampleSet = new Set(sampleFoodIds);
  let baseFoodIds = recipeIngredientFoodIds.filter((id) => !sampleSet.has(id));
  let foodRoles = Object.fromEntries(combinedIds.map((id) => [
    id,
    sampleSet.has(id) ? "sample" : baseFoodIds.includes(id) ? "base" : "component",
  ]));

  meal.foodIds = [candidate.additionalFoodId, ...recipeIngredientFoodIds];
  meal.baseFoodIds = baseFoodIds;
  meal.sampleFoodIds = sampleFoodIds;
  meal.foodRoles = foodRoles;
  meal.recipeName = candidate.recipe.name;
  meal.recipeInventoryId = "";
  meal.recipeIngredientFoodIds = recipeIngredientFoodIds;
  meal.additionalFoodIds = additionalFoodIds;
  meal.compositionMode = "recipe-plus-food";
  meal.recipePairingKey = candidate.key;

  if (typeof applyPlannedMealAmounts === "function") applyPlannedMealAmounts(meal);

  let additionalName = typeof food === "function"
    ? food(candidate.additionalFoodId)?.name || candidate.additionalFoodId
    : candidate.additionalFoodId;
  let message = `${additionalName} wird mit dem Rezept ${candidate.recipe.name} kombiniert; das zusätzliche Lebensmittel bleibt separat protokollierbar.`;
  meal.note = meal.note ? `${meal.note} ${message}` : message;
  return meal;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    plannerRecipeFoodCanonicalIds,
    plannerRecipeFoodNameVariants,
    plannerRecipeFoodVariantIdSets,
    plannerRecipeFoodHasSingleStarch,
    plannerRecipeFoodCompositionCandidates,
    plannerSelectRecipeFoodComposition,
    plannerApplyRecipeFoodComposition,
  };
}
