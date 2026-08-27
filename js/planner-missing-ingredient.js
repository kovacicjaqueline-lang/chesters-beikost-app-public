"use strict";

/* Temporäre Zutaten-Verfügbarkeit im Planner.
 *
 * „Zutat fehlt“ ist kein Essensereignis und erzeugt deshalb keinen Log.
 * Die vorhandenen shoppingHints/followUps bleiben die einzige persistierte
 * Verfügbarkeitsquelle. Fehlende Zutaten werden bis zum Einkauf aus allen
 * automatischen FOOD-/Rezeptpfaden ausgeschlossen. Austauschbare Recipe-V2-
 * Komponenten (oneOf/milkChoices) dürfen im bestehenden Rezept ersetzt werden;
 * andernfalls wird der offene Slot zur normalen Neuplanung freigegeben.
 */
(function plannerMissingIngredientModule(globalScope) {
  const REPLACEABLE_RECIPE_FIELDS = Object.freeze(["oneOf", "milkChoices"]);

  function uniqueIds(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function mealContainsFood(meal, foodId) {
    return !!foodId && (meal?.foodIds || []).includes(foodId);
  }

  function mealRequiresIngredientAvailability(meal, foodId) {
    return mealContainsFood(meal, foodId) && !meal?.recipeInventoryId;
  }

  function canMarkMissingIngredient(day, meal, todayValue = "", isCompletedFn = null) {
    if (
      !day?.date ||
      !meal?.active ||
      meal.empty ||
      meal.recipeInventoryId ||
      !(meal.foodIds || []).length
    ) return false;
    if (todayValue && day.date < todayValue) return false;
    if (typeof isCompletedFn === "function" && isCompletedFn(day.date, meal.meal)) return false;
    return true;
  }

  function replaceIdList(values, missingId, replacementId) {
    return uniqueIds((values || []).map((id) => id === missingId ? replacementId : id));
  }

  function replaceFoodIdInMeal(meal, missingId, replacementId) {
    if (!meal || !missingId || !replacementId || missingId === replacementId) return null;
    if (!mealContainsFood(meal, missingId)) return { ...meal };

    const next = { ...meal };
    for (const field of ["foodIds", "baseFoodIds", "sampleFoodIds", "inventoryFoodIds"]) {
      if (Array.isArray(meal[field])) next[field] = replaceIdList(meal[field], missingId, replacementId);
    }
    if (meal.focusId === missingId) next.focusId = replacementId;

    if (meal.foodRoles && typeof meal.foodRoles === "object") {
      next.foodRoles = { ...meal.foodRoles };
      if (Object.prototype.hasOwnProperty.call(next.foodRoles, missingId)) {
        next.foodRoles[replacementId] = next.foodRoles[missingId];
        delete next.foodRoles[missingId];
      }
    }
    if (meal.ingredientAmounts && typeof meal.ingredientAmounts === "object") {
      next.ingredientAmounts = { ...meal.ingredientAmounts };
      if (Object.prototype.hasOwnProperty.call(next.ingredientAmounts, missingId)) {
        if (!Object.prototype.hasOwnProperty.call(next.ingredientAmounts, replacementId)) {
          next.ingredientAmounts[replacementId] = next.ingredientAmounts[missingId];
        }
        delete next.ingredientAmounts[missingId];
      }
    }
    return next;
  }

  function recipeComponentReplacementId(
    recipe,
    meal,
    missingId,
    lookupByName,
    readyFn = null,
    eligibleFn = null,
    compareFn = null,
  ) {
    if (!recipe || !meal || !missingId || typeof lookupByName !== "function") return "";
    if (meal.recipeInventoryId) return "";
    if (meal.focusId === missingId || (meal.sampleFoodIds || []).includes(missingId)) return "";

    for (const field of REPLACEABLE_RECIPE_FIELDS) {
      const choices = (recipe[field] || [])
        .map((name) => ({ name, food: lookupByName(name) }))
        .filter((entry) => entry.food?.id);
      if (!choices.some((entry) => entry.food.id === missingId)) continue;

      const candidates = choices.filter((entry) => {
        if (entry.food.id === missingId) return false;
        if (typeof readyFn === "function" && !readyFn(entry.name, entry.food)) return false;
        if (typeof eligibleFn === "function" && !eligibleFn(entry.food, entry.name)) return false;
        return true;
      });
      if (typeof compareFn === "function") candidates.sort((a, b) => compareFn(a.food, b.food));
      return candidates[0]?.food?.id || "";
    }
    return "";
  }

  function planShoppingHint(previousHint, foodId, planDate, meal, now) {
    const { sourceLogId: _sourceLogId, ...retained } = previousHint || {};
    return {
      ...retained,
      foodId,
      status: "needed",
      createdAt: retained.createdAt || now,
      updatedAt: now,
      source: "plan",
      planDate: planDate || retained.planDate || "",
      meal: meal || retained.meal || "",
    };
  }

  function followUpResumeRequest(record = {}, fallbackMeal = "lunch") {
    let reason = record.resumeReason || "";
    let detail = record.resumeDetail || "";
    if (!reason) {
      if (record.reason === "rejection") {
        reason = "rejection";
        detail = record.detail || "interest";
      } else if (record.reason === "not_offered" && record.detail && record.detail !== "unavailable") {
        reason = "not_offered";
        detail = record.detail;
      } else {
        reason = "not_offered";
        detail = "no_opportunity";
      }
    }
    if (!detail) detail = reason === "rejection" ? "interest" : "no_opportunity";
    return {
      reason,
      detail,
      meal: record.meal || fallbackMeal || "lunch",
    };
  }

  function awaitingStockFollowUp(
    previousFollowUp,
    foodId,
    meal,
    preparationText,
    previousBaseIds,
    now,
  ) {
    const previous = previousFollowUp || {};
    const resume = followUpResumeRequest(previous, meal);
    const preserveBase = !!(
      previous.id &&
      (
        previous.resumeReason ||
        previous.reason === "rejection" ||
        (previous.reason === "not_offered" && previous.detail && previous.detail !== "unavailable")
      )
    );
    return {
      ...previous,
      id: previous.id || `${foodId}-${Date.now()}`,
      foodId,
      reason: "not_offered",
      detail: "unavailable",
      status: "awaiting_stock",
      createdAt: previous.createdAt || now,
      updatedAt: now,
      dueDate: "",
      meal: meal || resume.meal,
      baseFoodId: preserveBase ? previous.baseFoodId || "" : "",
      baseMode: preserveBase ? previous.baseMode || "auto" : "none",
      alternativeBaseIds: preserveBase ? [...(previous.alternativeBaseIds || [])] : [],
      previousBaseIds: preserveBase
        ? [...(previous.previousBaseIds || previousBaseIds || [])]
        : [...(previousBaseIds || [])],
      preparationKey: previous.preparationKey || "standard",
      preparationText: preparationText || previous.preparationText || "",
      source: "plan",
      resumeReason: resume.reason,
      resumeDetail: resume.detail,
    };
  }

  function clearUnavailableFoodFromStoredPlans(
    data,
    foodId,
    todayValue,
    isCompletedFn = null,
    replacementFactory = null,
  ) {
    if (!data || !foodId || !todayValue) return { clearedKeys: [], adaptedKeys: [] };
    data.planLocks ||= {};
    data.manualMeals ||= {};
    data.overrides ||= {};
    data.autoLockExcluded ||= {};

    const clearedKeys = [];
    const adaptedKeys = [];
    const keys = new Set([
      ...Object.keys(data.planLocks || {}),
      ...Object.keys(data.manualMeals || {}),
      ...Object.keys(data.overrides || {}),
    ]);

    for (const key of keys) {
      const [date, meal] = String(key || "").split("|");
      if (!date || date < todayValue) continue;

      const lock = data.planLocks?.[key];
      const manual = data.manualMeals?.[key];
      const completionEntry = manual || lock || null;
      if (
        typeof isCompletedFn === "function" &&
        isCompletedFn(date, meal, completionEntry)
      ) continue;

      const affected = [lock, manual].filter((entry) => mealRequiresIngredientAvailability(entry, foodId));
      const overrideAffected = data.overrides?.[key] === foodId;
      if (!affected.length && !overrideAffected) continue;

      let canAdapt = affected.length > 0 && typeof replacementFactory === "function";
      const replacements = new Map();
      if (canAdapt) {
        for (const entry of affected) {
          const replacement = replacementFactory(entry, { key, date, meal, source: "primary" });
          if (!replacement || mealRequiresIngredientAvailability(replacement, foodId)) {
            canAdapt = false;
            break;
          }
          replacements.set(entry, replacement);
        }
      }

      if (canAdapt && !overrideAffected) {
        if (lock && replacements.has(lock)) data.planLocks[key] = replacements.get(lock);
        if (manual && replacements.has(manual)) data.manualMeals[key] = replacements.get(manual);
        adaptedKeys.push(key);
        continue;
      }

      delete data.planLocks[key];
      delete data.manualMeals[key];
      delete data.overrides[key];
      delete data.autoLockExcluded[key];
      clearedKeys.push(key);
    }

    const carriedPlans = data.backupMeta?.plannerLinking?.carriedPlans;
    if (carriedPlans && typeof carriedPlans === "object" && !Array.isArray(carriedPlans)) {
      for (const [planId, carried] of Object.entries(carriedPlans)) {
        const date = String(carried?.date || "");
        const meal = String(carried?.meal || "");
        if (!date || date < todayValue || !mealRequiresIngredientAvailability(carried, foodId)) continue;
        if (
          typeof isCompletedFn === "function" &&
          isCompletedFn(date, meal, carried)
        ) continue;

        const label = `carried:${planId}`;
        const replacement = typeof replacementFactory === "function"
          ? replacementFactory(carried, { key: label, date, meal, source: "carried", planId })
          : null;
        if (replacement && !mealRequiresIngredientAvailability(replacement, foodId)) {
          carriedPlans[planId] = {
            ...replacement,
            planId: carried.planId || planId,
            date,
            meal,
            source: carried.source || "carried",
            carriedPlannerPlan: carried.carriedPlannerPlan !== false,
          };
          adaptedKeys.push(label);
        } else {
          delete carriedPlans[planId];
          clearedKeys.push(label);
        }
      }
    }

    return { clearedKeys, adaptedKeys };
  }

  const API = {
    REPLACEABLE_RECIPE_FIELDS,
    mealContainsFood,
    mealRequiresIngredientAvailability,
    canMarkMissingIngredient,
    replaceFoodIdInMeal,
    recipeComponentReplacementId,
    planShoppingHint,
    followUpResumeRequest,
    awaitingStockFollowUp,
    clearUnavailableFoodFromStoredPlans,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Object.freeze({ ...API });
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (globalScope.__plannerMissingIngredientInstalled) return;
  globalScope.__plannerMissingIngredientInstalled = true;

  function unavailable(foodId) {
    return typeof isFoodUnavailable === "function" && isFoodUnavailable(foodId);
  }

  function runtimeFoodEligible(item, meal, date) {
    if (!item || item.active === false || unavailable(item.id)) return false;
    if (typeof status === "function" && status(item) === "Pausiert") return false;
    if (Array.isArray(item.meals) && meal && !item.meals.includes(meal)) return false;
    if (
      typeof automaticFoodEligibility === "function" &&
      !automaticFoodEligibility(item, date, state?.settings || {})
    ) return false;
    if (
      typeof plannerFoodMealEligible === "function" &&
      meal &&
      !plannerFoodMealEligible(item, meal)
    ) return false;
    return true;
  }

  function structuredRecipeNames(recipe) {
    return uniqueIds([
      ...(recipe?.requires || []),
      ...((recipe?.alternatives || []).flat()),
      ...(recipe?.oneOf || []),
      ...(recipe?.milkChoices || []),
    ]);
  }

  function availabilityAwareRecipeFoodIds(recipe, originalRecipeFoodIds) {
    if (!recipe || typeof originalRecipeFoodIds !== "function") return [];
    if (
      typeof recipeInventoryPortions === "function" &&
      Number(recipeInventoryPortions(recipe.name) || 0) > 0
    ) return originalRecipeFoodIds(recipe);

    const lookup = (name) => typeof foodByName === "function" ? foodByName(name, state?.foods || []) : null;
    const hasUnavailable = structuredRecipeNames(recipe).some((name) => {
      const item = lookup(name);
      return !!item && unavailable(item.id);
    });
    if (!hasUnavailable) return originalRecipeFoodIds(recipe);

    let sets = [recipe.requires || [], ...(recipe.alternatives || [])]
      .filter((set, index) => set.length || index === 0)
      .map((set) => ({
        set,
        items: set.map(lookup),
      }))
      .filter((entry) =>
        entry.items.every((item) => item && !unavailable(item.id)),
      );
    if (!sets.length) return [];

    sets.sort((a, b) => {
      const score = (entry) => entry.items.reduce((sum, item) =>
        sum + (typeof rank === "function" && rank(item) >= 2 ? 0 : 2), 0);
      return score(a) - score(b);
    });

    const ids = sets[0].items.map((item) => item.id);
    for (const choices of [recipe.oneOf || [], recipe.milkChoices || []]) {
      if (!choices.length) continue;
      const availableChoices = choices
        .map(lookup)
        .filter((item) => item && !unavailable(item.id))
        .sort((a, b) =>
          (typeof rank === "function" ? rank(b) - rank(a) : 0) ||
          (Number(a.priority) || 9999) - (Number(b.priority) || 9999),
        );
      const chosen = availableChoices[0];
      if (!chosen) return [];
      if (!ids.includes(chosen.id)) ids.push(chosen.id);
    }
    return uniqueIds(ids);
  }

  function installAvailabilityPolicies() {
    if (typeof recipeIngredientReady === "function" && !recipeIngredientReady.__missingIngredientAware) {
      const original = recipeIngredientReady;
      const wrapped = function missingIngredientAwareRecipeIngredientReady(name, ...args) {
        const item = typeof foodByName === "function" ? foodByName(name, state?.foods || []) : null;
        if (item && unavailable(item.id)) return false;
        return original(name, ...args);
      };
      wrapped.__missingIngredientAware = true;
      recipeIngredientReady = wrapped;
    }

    if (typeof recipeFoodIds === "function" && !recipeFoodIds.__missingIngredientAware) {
      const original = recipeFoodIds;
      const wrapped = function missingIngredientAwareRecipeFoodIds(recipe) {
        return availabilityAwareRecipeFoodIds(recipe, original);
      };
      wrapped.__missingIngredientAware = true;
      recipeFoodIds = wrapped;
    }

    if (
      typeof plannerProactiveRuntimeFoodEligible === "function" &&
      !plannerProactiveRuntimeFoodEligible.__missingIngredientAware
    ) {
      const original = plannerProactiveRuntimeFoodEligible;
      const wrapped = function missingIngredientAwareProactiveFoodEligible(item, ...args) {
        if (item && unavailable(item.id)) return false;
        return original(item, ...args);
      };
      wrapped.__missingIngredientAware = true;
      plannerProactiveRuntimeFoodEligible = wrapped;
    }
  }

  function recipeReplacementForStoredMeal(entry, context) {
    if (!entry?.recipeName || entry.recipeInventoryId || !mealContainsFood(entry, context.foodId)) return null;
    const recipe = typeof recipeByName === "function" ? recipeByName(entry.recipeName) : null;
    if (!recipe) return null;

    const replacementId = recipeComponentReplacementId(
      recipe,
      entry,
      context.foodId,
      (name) => typeof foodByName === "function" ? foodByName(name, state?.foods || []) : null,
      (name) => typeof recipeIngredientReady !== "function" || recipeIngredientReady(name),
      (item) => runtimeFoodEligible(item, context.meal, context.date),
      (a, b) =>
        (typeof rank === "function" ? rank(b) - rank(a) : 0) ||
        (Number(a.priority) || 9999) - (Number(b.priority) || 9999),
    );
    if (!replacementId) return null;

    const next = replaceFoodIdInMeal(entry, context.foodId, replacementId);
    if (!next) return null;
    if (typeof applyPlannedMealAmounts === "function") {
      try { applyPlannedMealAmounts(next); } catch (_error) {}
    }
    return next;
  }

  function followUpMeal(context = {}) {
    const candidate = String(context.meal || "");
    const valid = typeof plannerLogMealKeys === "function"
      ? plannerLogMealKeys()
      : ["breakfast", "snack", "lunch", "dinner"];
    return valid.includes(candidate) ? candidate : "lunch";
  }

  function requestFullRender() {
    if (typeof renderAllAfterNextPaint === "function") {
      renderAllAfterNextPaint();
      return;
    }
    if (typeof renderAll === "function") renderAll();
  }

  function markFoodUnavailable(foodId, context = {}) {
    const item = typeof food === "function" ? food(foodId) : null;
    if (!item) return { ok: false, reason: "food" };

    installAvailabilityPolicies();
    state.shoppingHints ||= {};
    state.followUps ||= {};
    state.pantry ||= {};
    const now = new Date().toISOString();
    const previousHint = state.shoppingHints[foodId] || {};
    const previousFollowUp = state.followUps[foodId] || {};
    const meal = followUpMeal(context);

    state.shoppingHints[foodId] = planShoppingHint(
      previousHint,
      foodId,
      context.date || "",
      meal,
      now,
    );
    state.pantry[foodId] = false;
    state.followUps[foodId] = awaitingStockFollowUp(
      previousFollowUp,
      foodId,
      meal,
      item.safeForm || "",
      typeof priorBaseIds === "function" ? priorBaseIds(foodId) : [],
      now,
    );

    const cleanup = clearUnavailableFoodFromStoredPlans(
      state,
      foodId,
      typeof today === "function" ? today() : String(context.date || ""),
      (date, concreteMeal, entry) => {
        const core = globalScope.__plannerLogRolloverCore;
        if (entry?.planId && core?.linkedCompletionLog) {
          return !!core.linkedCompletionLog(state, entry.planId, date, concreteMeal);
        }
        return typeof mealIsCompleted === "function" && mealIsCompleted(date, concreteMeal);
      },
      (entry, slot) => recipeReplacementForStoredMeal(entry, { ...slot, foodId }),
    );

    if (typeof save === "function") save();
    if (typeof showToast === "function") {
      showToast(`${item.name} fehlt und steht auf der Einkaufsliste. Der Plan wurde angepasst.`);
    }
    requestFullRender();
    return { ok: true, foodId, ...cleanup };
  }

  function markPlanMissingFoodAvailable(foodId) {
    const hint = state.shoppingHints?.[foodId];
    if (!hint || hint.source !== "plan") return false;
    state.pantry ||= {};
    const now = new Date().toISOString();
    state.shoppingHints[foodId] = { ...hint, status: "available", updatedAt: now };
    state.pantry[foodId] = true;

    const resume = followUpResumeRequest(state.followUps?.[foodId] || {}, hint.meal || "lunch");
    if (typeof scheduleFollowUp === "function") {
      scheduleFollowUp(
        foodId,
        typeof today === "function" ? today() : hint.planDate || "",
        resume.meal,
        resume.reason,
        resume.detail,
      );
    }
    if (typeof save === "function") save();
    if (typeof showToast === "function") {
      showToast(`${typeof food === "function" ? food(foodId)?.name || "Zutat" : "Zutat"} ist vorhanden und wird wieder eingeplant.`);
    }
    requestFullRender();
    return true;
  }

  function missingButtonHtml(day, meal) {
    const todayValue = typeof today === "function" ? today() : day?.date || "";
    if (!canMarkMissingIngredient(
      day,
      meal,
      todayValue,
      typeof mealIsCompleted === "function" ? mealIsCompleted : null,
    )) return "";
    const foods = encodeURIComponent(JSON.stringify(uniqueIds(meal.foodIds || [])));
    return `<button type="button" class="btn secondary missingIngredient" data-missing-date="${esc(day.date)}" data-missing-meal="${esc(meal.meal)}" data-missing-foods="${foods}">Zutat fehlt</button>`;
  }

  function decorateMealActionHtml(html, day, meal) {
    if (!html || html.includes("missingIngredient")) return html;
    const button = missingButtonHtml(day, meal);
    if (!button) return html;
    const randomButton = /(<button class="btn secondary randomizeMeal"[^>]*>↻ Tauschen<\/button>)/;
    if (randomButton.test(html)) return html.replace(randomButton, `$1${button}`);
    if (html.includes('<div class="actionbar">')) {
      return html.replace('<div class="actionbar">', `<div class="actionbar">${button}`);
    }
    return html;
  }

  function selectedFoodIds(button) {
    try {
      return uniqueIds(JSON.parse(decodeURIComponent(button?.dataset?.missingFoods || "[]")));
    } catch (_error) {
      return [];
    }
  }

  function chooseMissingIngredient(button) {
    const ids = selectedFoodIds(button).filter((id) => typeof food === "function" && food(id));
    if (!ids.length) return;
    const context = {
      date: button.dataset.missingDate || "",
      meal: button.dataset.missingMeal || "",
    };
    if (ids.length === 1) {
      markFoodUnavailable(ids[0], context);
      return;
    }

    const choices = ids.map((id) => {
      const item = food(id);
      return `<button type="button" class="btn secondary full missingIngredientChoice" data-food="${esc(id)}"><span>${esc(item?.name || id)}</span><small>fehlt</small></button>`;
    }).join("");
    openGeneric(
      "Welche Zutat fehlt?",
      `<div class="notice olive missing-ingredient-note"><b>Nur vorübergehend nicht verfügbar</b><div class="small">Die Zutat kommt auf die Einkaufsliste und wird aus offenen Planungen entfernt. Nach dem Einkauf wird sie wieder eingeplant.</div></div><div class="missing-ingredient-list">${choices}</div>`,
    );
    document.querySelectorAll(".missingIngredientChoice").forEach((choice) => {
      choice.onclick = () => {
        const foodId = choice.dataset.food;
        if (typeof closeGeneric === "function") closeGeneric();
        markFoodUnavailable(foodId, context);
      };
    });
  }

  installAvailabilityPolicies();

  if (typeof renderMealCore === "function") {
    const originalRenderMealCore = renderMealCore;
    renderMealCore = function missingIngredientRenderMealCore(day, meal) {
      return decorateMealActionHtml(originalRenderMealCore(day, meal), day, meal);
    };
  }

  if (typeof renderPrep === "function") {
    const originalRenderPrep = renderPrep;
    renderPrep = function missingIngredientRenderPrep(...args) {
      const result = originalRenderPrep(...args);
      const title = document.querySelector(".shopping-followups .shopping-followup-title");
      if (title) {
        const needed = Object.values(state.shoppingHints || {}).filter((hint) => hint?.status === "needed");
        const planCount = needed.filter((hint) => hint?.source === "plan").length;
        if (planCount && planCount === needed.length) title.textContent = "Fehlende Zutaten";
        else if (planCount) title.textContent = "Fehlende und nicht angebotene Lebensmittel";
      }
      document.querySelectorAll("[data-shopping-hint]").forEach((checkbox) => {
        const id = checkbox.dataset.shoppingHint || "";
        if (state.shoppingHints?.[id]?.source !== "plan") return;
        checkbox.onchange = () => {
          if (!checkbox.checked) return;
          markPlanMissingFoodAvailable(id);
        };
      });
      return result;
    };
  }

  const style = document.createElement("style");
  style.id = "planner-missing-ingredient-style";
  style.textContent = `
    .actionbar.random-swap-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    .actionbar.random-swap-actions .randomizeMeal{grid-column:auto!important}
    .missing-ingredient-list{display:grid;gap:8px;margin-top:12px}
    .missingIngredientChoice{display:flex!important;align-items:center;justify-content:space-between;text-align:left}
    .missingIngredientChoice small{font-weight:700;color:var(--muted)}
    .missing-ingredient-note{margin-bottom:0}
    @media(max-width:380px){
      .actionbar.random-swap-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .actionbar.random-swap-actions .randomizeMeal{grid-column:auto!important}
    }
  `;
  document.head.appendChild(style);

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.(".missingIngredient");
    if (!button) return;
    event.preventDefault();
    chooseMissingIngredient(button);
  });

  globalScope.__plannerMissingIngredient = Object.freeze({
    ...API,
    markFoodUnavailable,
    markPlanMissingFoodAvailable,
    installAvailabilityPolicies,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
