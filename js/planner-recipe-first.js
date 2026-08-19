"use strict";

/* PLAN-08 Recipe-first für bekannte FOOD-Kombinationen.
 *
 * Grundsatz:
 * - Einführungen/Kostproben bleiben FOOD-first.
 * - Eine bekannte FOOD-only-Mahlzeit darf zu einem vorhandenen Rezept werden,
 *   wenn eine aktuell geeignete Rezeptvariante EXAKT dieselben FOOD-IDs enthält.
 * - Es werden keine zusätzlichen Zutaten erfunden, nur um ein Rezept passend zu machen.
 * - Mahlzeiteneignung, Phasen-/Altersanforderungen und bestehende Rezeptregeln
 *   bleiben harte Voraussetzungen.
 * - Eine Promotion wird in dieselbe Rezept-Rotations-/Vorratslogik eingebunden und
 *   im Prep als Rezept statt als lose Einzelkomponenten behandelt.
 * - Wenn mehrere Rezeptformen technisch gleichrangig exakt passen, wird keine
 *   Darreichungsform geraten; die FOOD-Mahlzeit bleibt dann unverändert.
 */

function plannerRecipeCanonicalIds(ids) {
  return [...new Set(ids || [])].filter(Boolean).sort();
}

function plannerRecipeIdsEqual(a, b) {
  let left = plannerRecipeCanonicalIds(a);
  let right = plannerRecipeCanonicalIds(b);
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function plannerRecipeNameVariants(recipe) {
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

function plannerRecipeVariantIdSets(recipe, foods, ingredientReadyFn = null) {
  let byName = new Map((foods || []).map((item) => [item.name, item]));
  let ready = typeof ingredientReadyFn === "function" ? ingredientReadyFn : () => true;
  let result = [];
  for (let names of plannerRecipeNameVariants(recipe)) {
    if (!names.length || names.some((name) => !ready(name))) continue;
    let items = names.map((name) => byName.get(name));
    if (items.some((item) => !item)) continue;
    let ids = plannerRecipeCanonicalIds(items.map((item) => item.id));
    if (!ids.length) continue;
    if (!result.some((existing) => plannerRecipeIdsEqual(existing, ids))) result.push(ids);
  }
  return result;
}

function plannerRecipeMilkContextCompatible(meal, recipe) {
  if (!meal || !recipe) return false;
  let plannedLevel = String(meal.milkMeal || "");
  let recipeLevel = String(recipe.milkMeal || plannedLevel);
  return plannedLevel === recipeLevel;
}

function plannerExactRecipeCandidates(
  ids,
  meal,
  recipes,
  foods,
  recipeSuitableFn,
  ingredientReadyFn = null,
  recipeAllowedFn = null,
) {
  let target = plannerRecipeCanonicalIds(ids);
  if (target.length < 2) return [];
  let suitable = typeof recipeSuitableFn === "function" ? recipeSuitableFn : () => true;
  let allowed = typeof recipeAllowedFn === "function" ? recipeAllowedFn : () => true;

  return (recipes || []).filter((recipe) => {
    if (!recipe || !suitable(recipe, meal) || !allowed(recipe)) return false;
    if (Array.isArray(recipe.requirementMissing) && recipe.requirementMissing.length) return false;
    let variants = plannerRecipeVariantIdSets(recipe, foods, ingredientReadyFn);
    return variants.some((variantIds) => plannerRecipeIdsEqual(variantIds, target));
  });
}

function plannerSelectExactRecipe(
  candidates,
  ctx = {},
  preferInventory = false,
  inventoryPortionsFn = null,
) {
  let inventoryPortions = typeof inventoryPortionsFn === "function" ? inventoryPortionsFn : () => 0;
  let ranked = (candidates || [])
    .map((recipe) => {
      let available = inventoryPortions(recipe.name) > (ctx.recipeReserved?.get(recipe.name) || 0);
      return {
        recipe,
        stockRank: preferInventory && available ? 0 : 1,
        used: ctx.recipePlannedUse?.get(recipe.name) || 0,
      };
    })
    .sort((a, b) =>
      a.stockRank - b.stockRank ||
      a.used - b.used ||
      String(a.recipe.name).localeCompare(String(b.recipe.name), "de"),
    );
  if (!ranked.length) return null;
  if (
    ranked.length > 1 &&
    ranked[0].stockRank === ranked[1].stockRank &&
    ranked[0].used === ranked[1].used
  ) return null;
  return ranked[0].recipe;
}

function plannerExactRecipeCandidate(
  ids,
  meal,
  recipes,
  foods,
  recipeSuitableFn,
  ingredientReadyFn = null,
  recipeAllowedFn = null,
) {
  return plannerSelectExactRecipe(
    plannerExactRecipeCandidates(
      ids,
      meal,
      recipes,
      foods,
      recipeSuitableFn,
      ingredientReadyFn,
      recipeAllowedFn,
    ),
  );
}

function plannerReleaseFoodInventoryReservations(meal, ctx) {
  if (!meal || !ctx?.inventoryReserved) return;
  for (let id of meal.inventoryFoodIds || []) {
    let current = Number(ctx.inventoryReserved.get(id) || 0);
    if (current <= 1) ctx.inventoryReserved.delete(id);
    else ctx.inventoryReserved.set(id, current - 1);
  }
  meal.inventoryFoodIds = [];
}

function plannerRecipeInventoryAvailable(recipe, ctx, inventoryPortionsFn = null) {
  if (!recipe || typeof inventoryPortionsFn !== "function") return false;
  return Number(inventoryPortionsFn(recipe.name) || 0) > Number(ctx?.recipeReserved?.get(recipe.name) || 0);
}

function plannerPromoteMealToRecipe(
  meal,
  recipe,
  date,
  ctx,
  preferInventory = false,
  reserveMealInventoryFn = null,
  recipeInventoryPortionsFn = null,
) {
  if (!meal || !recipe || !plannerRecipeMilkContextCompatible(meal, recipe)) return meal;
  let useRecipeInventory =
    !!preferInventory &&
    plannerRecipeInventoryAvailable(recipe, ctx, recipeInventoryPortionsFn);

  // Eine bereits reservierte Einzelzutat wird nur freigegeben, wenn eine fertige
  // Rezeptportion sie tatsächlich ersetzt. Ein frisch zuzubereitendes Rezept
  // behält seine FOOD-Reservierungen, damit derselbe Vorrat nicht doppelt verplant wird.
  if (useRecipeInventory) plannerReleaseFoodInventoryReservations(meal, ctx);

  meal.recipeName = recipe.name;
  meal.recipeInventoryId = "";
  meal.milkMeal = recipe.milkMeal || meal.milkMeal || "";
  meal.type = "Rezept";

  if (useRecipeInventory && typeof reserveMealInventoryFn === "function") {
    reserveMealInventoryFn(meal, ctx);
    if (meal.recipeInventoryId) meal.type = "Rezeptvorrat";
  }

  if (ctx?.recipePlannedUse) {
    ctx.recipePlannedUse.set(
      recipe.name,
      (ctx.recipePlannedUse.get(recipe.name) || 0) + 1,
    );
  }
  if (meal.milkMeal === "full") ctx?.fullMilkDates?.add(date);

  let recipeNote = `Passendes vorhandenes Rezept: ${recipe.name}.`;
  meal.note = meal.note ? `${meal.note} ${recipeNote}` : recipeNote;
  return meal;
}

function plannerRecipeFirstFreshMeal(meal) {
  return !!(
    meal?.active &&
    !meal.empty &&
    meal.recipeName &&
    !meal.recipeInventoryId &&
    meal.type === "Rezept"
  );
}

function plannerReserveFreshRecipeIngredients(meal, ctx, originalReserveFn) {
  if (!plannerRecipeFirstFreshMeal(meal) || typeof originalReserveFn !== "function") {
    return typeof originalReserveFn === "function" ? originalReserveFn(meal, ctx) : meal;
  }
  let recipeName = meal.recipeName;
  meal.recipeName = "";
  try {
    return originalReserveFn(meal, ctx);
  } finally {
    meal.recipeName = recipeName;
  }
}

function plannerRecipeFirstFreshMeals(days, completedFn = null) {
  let completed = typeof completedFn === "function" ? completedFn : () => false;
  return (days || []).flatMap((day) =>
    (day.meals || [])
      .filter((meal) => plannerRecipeFirstFreshMeal(meal) && !completed(day.date, meal.meal))
      .map((meal) => ({ day, meal })),
  );
}

function plannerRecipeFirstPrepTaskHtml(entry) {
  let recipe = typeof recipeByName === "function" ? recipeByName(entry.meal.recipeName) : null;
  let ingredients = recipe?.ingredients || (entry.meal.foodIds || [])
    .map((id) => (typeof food === "function" ? food(id)?.name : id) || id)
    .join(", ");
  let preparation = recipe?.note || "Nach dem hinterlegten Rezept zubereiten.";
  let batch = recipe?.batch ? `<p class="small"><b>Menge/Form:</b> ${esc(recipe.batch)}</p>` : "";
  return `<div class="prep-task recipe-first-prep"><div class="row"><div class="grow"><b>${esc(entry.meal.recipeName)}</b><div class="small">${shortDate(entry.day.date)} · ${mealName(entry.meal.meal)}</div></div><span class="pill recipe-stock-chip">Rezept</span></div><div class="prep-main"><b>Als geplantes Rezept zubereiten</b><div class="small">${esc(ingredients)}</div></div><details class="prep-details"><summary>Zubereitung</summary><p class="small">${esc(preparation)}</p>${batch}</details></div>`;
}

function installPlannerRecipeFirstPrepRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__plannerRecipeFirstPrepRuntimeInstalled) return false;
  if (
    typeof renderPrepCore !== "function" ||
    typeof prepDemand !== "function" ||
    typeof shoppingItems !== "function" ||
    typeof buildDays !== "function"
  ) return false;

  globalThis.__plannerRecipeFirstPrepRuntimeInstalled = true;
  let originalRenderPrepCore = renderPrepCore;
  let originalPrepDemand = prepDemand;
  let originalShoppingItems = shoppingItems;

  renderPrepCore = function recipeFirstRenderPrepCore(...args) {
    let livePrepDemand = prepDemand;
    let liveShoppingItems = shoppingItems;

    prepDemand = function recipeFirstFilteredPrepDemand(...prepArgs) {
      let liveBuildDays = buildDays;
      buildDays = function recipeFirstFilteredBuildDays(...buildArgs) {
        let days = liveBuildDays(...buildArgs);
        return (days || []).map((day) => ({
          ...day,
          meals: (day.meals || []).filter((meal) => !plannerRecipeFirstFreshMeal(meal)),
        }));
      };
      try {
        return originalPrepDemand(...prepArgs);
      } finally {
        buildDays = liveBuildDays;
      }
    };

    shoppingItems = function recipeFirstShoppingItems(...shoppingArgs) {
      let filteredPrepDemand = prepDemand;
      prepDemand = originalPrepDemand;
      try {
        return originalShoppingItems(...shoppingArgs);
      } finally {
        prepDemand = filteredPrepDemand;
      }
    };

    try {
      originalRenderPrepCore(...args);
    } finally {
      prepDemand = livePrepDemand;
      shoppingItems = liveShoppingItems;
    }

    if (typeof document === "undefined") return;
    let from = state?.settings?.planFrom || today();
    if (from < today()) from = today();
    let entries = plannerRecipeFirstFreshMeals(
      buildDays(from, 7),
      typeof mealIsCompleted === "function" ? mealIsCompleted : null,
    );
    if (!entries.length) return;

    let prepNow = document.getElementById("prepNow");
    if (!prepNow) return;
    let urgentLimit = addDays(today(), 1);
    let urgent = entries.filter((entry) => entry.day.date <= urgentLimit);
    let later = entries.filter((entry) => entry.day.date > urgentLimit);
    let recipeHtml = urgent.map(plannerRecipeFirstPrepTaskHtml).join("");
    if (later.length) {
      recipeHtml += `<details class="prep-group later-prep recipe-first-later"><summary><span><b>Geplante Rezepte später diese Woche</b><small>${later.length} ${later.length === 1 ? "Rezept" : "Rezepte"}</small></span></summary><div class="panel-body">${later.map(plannerRecipeFirstPrepTaskHtml).join("")}</div></details>`;
    }

    if (typeof prepNow.insertAdjacentHTML === "function") {
      if (entries.length && typeof prepNow.querySelectorAll === "function") {
        [...prepNow.querySelectorAll(".empty")].forEach((node) => {
          let text = String(node.textContent || "").trim();
          if (
            text === "Aktuell ist nichts vorab zuzubereiten." ||
            (urgent.length && text === "Für heute oder morgen ist nichts vorab zuzubereiten.")
          ) node.remove();
        });
      }
      // Wichtig: vorhandene Prep-Knoten nicht per innerHTML neu erzeugen. Die dort
      // bereits gebundenen Aktionen (u. a. „Als Vorrat eintragen“) müssen erhalten bleiben.
      prepNow.insertAdjacentHTML("afterbegin", recipeHtml);
    } else {
      // Test-/Minimal-DOM-Fallback ohne insertAdjacentHTML.
      let existing = prepNow.innerHTML;
      if (entries.length) {
        existing = existing.replace('<div class="empty">Aktuell ist nichts vorab zuzubereiten.</div>', "");
        if (urgent.length) {
          existing = existing.replace('<div class="empty">Für heute oder morgen ist nichts vorab zuzubereiten.</div>', "");
        }
      }
      prepNow.innerHTML = recipeHtml + existing;
    }

    let firstMetric = document.querySelector("#prepSummary .prep-metric b");
    if (firstMetric) {
      let current = Number(String(firstMetric.textContent || "0").replace(",", ".")) || 0;
      firstMetric.textContent = String(current + entries.length);
    }
  };

  return true;
}

function installPlannerRecipeFirstRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__plannerRecipeFirstRuntimeInstalled) return false;
  if (
    typeof buildDay !== "function" ||
    typeof recipeStates !== "function" ||
    typeof plannerRecipeSuitableForMeal !== "function" ||
    typeof recipeIngredientReady !== "function" ||
    typeof reserveMealInventory !== "function"
  ) return false;

  globalThis.__plannerRecipeFirstRuntimeInstalled = true;
  let originalBuildDay = buildDay;
  let originalReserveMealInventory = reserveMealInventory;

  // Auto-Locks einer frischen Recipe-first-Mahlzeit tragen recipeName, aber keine
  // fertige Rezeptportion. Beim nächsten Aufbau müssen deshalb weiterhin die
  // einzelnen Zutaten reserviert werden statt in den Rezeptvorratspfad zu fallen.
  reserveMealInventory = function recipeFirstReserveMealInventory(meal, ctx) {
    return plannerReserveFreshRecipeIngredients(meal, ctx, originalReserveMealInventory);
  };

  buildDay = function recipeFirstBuildDay(date, index, ctx) {
    let day = originalBuildDay(date, index, ctx);
    for (let meal of day?.meals || []) {
      if (!meal?.active || meal.empty || meal.recipeName || meal.manualAdded || meal.lockedMode) continue;
      if ((meal.sampleFoodIds || []).length) continue;
      let ids = plannerRecipeCanonicalIds(meal.foodIds);
      if (ids.length < 2) continue;

      let candidates = plannerExactRecipeCandidates(
        ids,
        meal.meal,
        recipeStates(),
        state?.foods || [],
        plannerRecipeSuitableForMeal,
        recipeIngredientReady,
        (candidate) =>
          plannerRecipeMilkContextCompatible(meal, candidate) &&
          !(candidate?.milkMeal === "full" &&
            typeof recipeContainsMeatOrFish === "function" &&
            recipeContainsMeatOrFish(candidate)),
      );
      let recipe = plannerSelectExactRecipe(
        candidates,
        ctx,
        !!state?.settings?.preferInventoryInPlan,
        typeof recipeInventoryPortions === "function" ? recipeInventoryPortions : null,
      );
      if (!recipe) continue;

      plannerPromoteMealToRecipe(
        meal,
        recipe,
        date,
        ctx,
        !!state?.settings?.preferInventoryInPlan,
        originalReserveMealInventory,
        typeof recipeInventoryPortions === "function" ? recipeInventoryPortions : null,
      );
    }
    return day;
  };

  installPlannerRecipeFirstPrepRuntime();
  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerRecipeFirstRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    plannerRecipeCanonicalIds,
    plannerRecipeIdsEqual,
    plannerRecipeNameVariants,
    plannerRecipeVariantIdSets,
    plannerRecipeMilkContextCompatible,
    plannerExactRecipeCandidates,
    plannerSelectExactRecipe,
    plannerExactRecipeCandidate,
    plannerReleaseFoodInventoryReservations,
    plannerRecipeInventoryAvailable,
    plannerPromoteMealToRecipe,
    plannerRecipeFirstFreshMeal,
    plannerReserveFreshRecipeIngredients,
    plannerRecipeFirstFreshMeals,
    installPlannerRecipeFirstPrepRuntime,
    installPlannerRecipeFirstRuntime,
  };
}