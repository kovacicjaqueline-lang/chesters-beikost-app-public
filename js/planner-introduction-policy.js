"use strict";

/* Planner-Einführungsfrequenz und Snack-Obst.
 *
 * Fachlicher Vertrag:
 * - geeignete offene Nicht-Allergene dürfen täglich und in jeder aktiven
 *   Hauptmahlzeit (Frühstück/Mittag/Abend) jeweils einmal eingeführt werden;
 * - ein bloß erfolgreich probiertes FOOD blockiert keine weitere Einführung;
 * - eine echte Ablehnung darf weiterhin als gezielte Wiederholung priorisiert werden;
 * - sobald eine Allergen-Einführung oder Allergen-Wiederholung geplant ist, bleibt
 *   sie die einzige automatische Lernaufgabe des Tages;
 * - Snacks führen keine neuen FOODs ein, dürfen aber aus einem geeigneten
 *   Snack-Rezept oder aus bereits bekanntem Obst bestehen.
 *
 * Bestehende Auto-, Safety-, Rollen-, Milch-, Recipe-first-, Lock- und
 * Mahlzeiteneignungs-Gates bleiben vorgeschaltet und werden nicht gelockert.
 * Zusätzliche Nicht-Allergen-Einführungen werden deshalb nicht frei konstruiert,
 * sondern erneut durch den vollständigen bestehenden buildDay-Stack erzeugt.
 */

const PLANNER_INTRODUCTION_MAIN_MEALS = Object.freeze([
  "breakfast",
  "lunch",
  "dinner",
]);

const PLANNER_INTRODUCTION_LEARNING_TYPES = new Set([
  "neu",
  "gezielt wiederholen",
  "Allergen einführen",
  "Allergen wiederholen",
  "manuell",
]);

const PLANNER_INTRODUCTION_ALLERGEN_TYPES = new Set([
  "Allergen einführen",
  "Allergen wiederholen",
]);

function plannerIntroductionMealIsLearning(meal) {
  if (!meal?.active || meal.empty) return false;
  if ((meal.sampleFoodIds || []).length) return true;
  if (meal.type === "manuell" && !(meal.sampleFoodIds || []).length) return false;
  return PLANNER_INTRODUCTION_LEARNING_TYPES.has(String(meal.type || ""));
}

function plannerIntroductionMealIsAllergenLearning(meal, resolveFood = () => null) {
  if (!plannerIntroductionMealIsLearning(meal)) return false;
  if (PLANNER_INTRODUCTION_ALLERGEN_TYPES.has(String(meal.type || ""))) return true;
  return (meal.sampleFoodIds || []).some((id) => !!resolveFood(id)?.allergenGroup);
}

function plannerIntroductionCandidateShouldSkip(
  result,
  rankFn = () => 0,
  lastOutcomeFn = () => "",
  allowAllergen = true,
) {
  let item = result?.f;
  if (!item) return true;
  if (item.allergenGroup && !allowAllergen) return true;
  let concreteRank = Number(rankFn(item)) || 0;
  return result.type === "bekannt kombinieren" &&
    concreteRank === 1 &&
    lastOutcomeFn(item.id) !== "not_accepted";
}

function plannerIntroductionNormalizeCandidate(
  result,
  on,
  dueFn = null,
  lastOutcomeFn = () => "",
) {
  if (!result?.f) return result;
  if (
    result.f.allergenGroup &&
    typeof dueFn === "function" &&
    dueFn(result.f, on) &&
    result.type !== "Allergen einführen"
  ) return { ...result, type: "Allergen wiederholen" };
  if (
    result.type === "bekannt kombinieren" &&
    lastOutcomeFn(result.f.id) === "not_accepted"
  ) return { ...result, type: "gezielt wiederholen" };
  return result;
}

function plannerIntroductionKnownSnackFruitEligible(item, on, options = {}) {
  if (!item || !item.active || item.category !== "Obst") return false;
  if (item.allergenGroup) return false;
  if (typeof options.statusFn === "function" && options.statusFn(item) === "Pausiert") return false;
  if (typeof options.unavailableFn === "function" && options.unavailableFn(item.id)) return false;
  if (typeof options.canCombineFn === "function" && !options.canCombineFn(item)) return false;
  if (typeof options.baseAllowedFn === "function" && !options.baseAllowedFn(item)) return false;
  if (
    typeof options.automaticEligibilityFn === "function" &&
    !options.automaticEligibilityFn(item, on, options.settings || {})
  ) return false;
  if (
    typeof options.focusAllowedFn === "function" &&
    !options.focusAllowedFn(item)
  ) return false;
  return true;
}

function plannerIntroductionCloneContext(ctx) {
  let copy = {};
  for (let [key, value] of Object.entries(ctx || {})) {
    if (value instanceof Map) copy[key] = new Map(value);
    else if (value instanceof Set) copy[key] = new Set(value);
    else if (Array.isArray(value)) copy[key] = [...value];
    else if (value && typeof value === "object") copy[key] = { ...value };
    else copy[key] = value;
  }
  return copy;
}

function plannerIntroductionRestoreContext(ctx, snapshot) {
  if (!ctx) return ctx;
  for (let key of Object.keys(ctx)) delete ctx[key];
  Object.assign(ctx, plannerIntroductionCloneContext(snapshot));
  return ctx;
}

function plannerIntroductionPlainClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function installPlannerIntroductionPolicyRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__plannerIntroductionPolicyRuntimeInstalled) return false;
  if (
    typeof buildDay !== "function" ||
    typeof introductionCandidate !== "function" ||
    typeof reserveMealInventory !== "function" ||
    typeof applyPlannedMealAmounts !== "function" ||
    typeof canCombine !== "function" ||
    typeof food !== "function" ||
    typeof rank !== "function" ||
    typeof lastOutcome !== "function" ||
    typeof manualMealRoleInfo !== "function"
  ) return false;

  globalThis.__plannerIntroductionPolicyRuntimeInstalled = true;

  // „Bekannt kombinieren“ ist keine Lernaufgabe. Die Quality-Policy ist bereits
  // installiert, verwendet aber dieses mutierbare Set auch in ihren BuildDay-Wrappers.
  // Die neue Einführungs-Policy korrigiert damit auch bestehende feste Kombinationen.
  if (typeof PLANNER_QUALITY_LEARNING_TYPES !== "undefined") {
    PLANNER_QUALITY_LEARNING_TYPES.delete("bekannt kombinieren");
  }

  let originalBuildDay = buildDay;
  let originalIntroductionCandidate = introductionCandidate;
  let originalManualMealRoleInfo = manualMealRoleInfo;
  let supplementalNonAllergenOnly = false;
  let baselineBlocksAllergens = false;

  let slotProtected = (date, meal) => {
    let key = `${date}|${meal}`;
    return !!state?.manualMeals?.[key] ||
      !!state?.planLocks?.[key] ||
      !!state?.overrides?.[key] ||
      (typeof mealIsCompleted === "function" && mealIsCompleted(date, meal));
  };

  let candidateFor = (meal, on, ctx, exclude = [], allowAllergen = true) => {
    let blocked = [...new Set(exclude || [])];
    let max = (state?.foods?.length || 0) + 1;
    for (let i = 0; i < max; i++) {
      let result = originalIntroductionCandidate(meal, on, ctx, blocked);
      if (!result?.f) return null;
      result = plannerIntroductionNormalizeCandidate(
        result,
        on,
        typeof dueAllergen === "function" ? dueAllergen : null,
        lastOutcome,
      );
      let id = result.f.id;
      if (blocked.includes(id)) return null;
      if (
        plannerIntroductionCandidateShouldSkip(
          result,
          rank,
          lastOutcome,
          allowAllergen,
        )
      ) {
        blocked.push(id);
        continue;
      }
      return result;
    }
    return null;
  };

  introductionCandidate = function plannerDailyIntroductionCandidate(meal, on, ctx, exclude = []) {
    let allowAllergen = !supplementalNonAllergenOnly && !baselineBlocksAllergens;
    return candidateFor(meal, on, ctx, exclude, allowAllergen);
  };

  let normalizePresetRecords = (date) => {
    let restores = [];
    let displays = new Map();
    let hasNonAllergenLearning = false;
    let hasAllergenLearning = false;

    for (let meal of ["breakfast", "lunch", "snack", "dinner"]) {
      let key = `${date}|${meal}`;
      let display = typeof manualMealFor === "function"
        ? manualMealFor(date, meal) || (typeof lockedMeal === "function" ? lockedMeal(date, meal) : null)
        : null;
      if (!display && typeof lockedMeal === "function") display = lockedMeal(date, meal);
      if (display && slotProtected(date, meal)) {
        if (plannerIntroductionMealIsAllergenLearning(display, food)) hasAllergenLearning = true;
        else if (plannerIntroductionMealIsLearning(display)) hasNonAllergenLearning = true;
      }

      let records = [state?.manualMeals?.[key], state?.planLocks?.[key]].filter(Boolean);
      for (let record of records) {
        let allergenLearning = plannerIntroductionMealIsAllergenLearning(
          { ...record, active: true },
          food,
        );
        let nonAllergenLearning = plannerIntroductionMealIsLearning({ ...record, active: true }) &&
          !allergenLearning;
        let falseKnownLearning =
          record.type === "bekannt kombinieren" && !(record.sampleFoodIds || []).length;
        if (!nonAllergenLearning && !falseKnownLearning) continue;
        if (!displays.has(key) && display) displays.set(key, plannerIntroductionPlainClone(display));
        restores.push({
          record,
          type: record.type,
          sampleFoodIds: plannerIntroductionPlainClone(record.sampleFoodIds || []),
        });
        record.type = "bekannt";
        record.sampleFoodIds = [];
      }
    }

    return {
      displays,
      hasNonAllergenLearning,
      hasAllergenLearning,
      restore() {
        for (let saved of restores) {
          saved.record.type = saved.type;
          saved.record.sampleFoodIds = [...saved.sampleFoodIds];
        }
      },
    };
  };

  let restoreDisplayedPresets = (day, date, displays) => {
    if (!day?.meals || !displays?.size) return day;
    day.meals = day.meals.map((meal) => {
      let saved = displays.get(`${date}|${meal?.meal}`);
      return saved ? saved : meal;
    });
    return day;
  };

  let suppressDueAllergensInWorkingContext = (ctx, date) => {
    if (!ctx || typeof dueAllergen !== "function") return;
    ctx.qualityDuePlanned ||= new Set();
    for (let item of state?.foods || []) {
      if (item && dueAllergen(item, date)) ctx.qualityDuePlanned.add(item.id);
    }
  };

  let snackBaseAllowed = (item) => {
    if (typeof plannerFoodCanBeBase === "function") return plannerFoodCanBeBase(item);
    if (typeof isTrustedBase === "function") return isTrustedBase(item);
    return true;
  };

  let knownSnackFruit = (on, ctx) => {
    let options = {
      settings: state?.settings || {},
      statusFn: typeof status === "function" ? status : null,
      unavailableFn: typeof isFoodUnavailable === "function" ? isFoodUnavailable : null,
      canCombineFn: canCombine,
      baseAllowedFn: snackBaseAllowed,
      automaticEligibilityFn: typeof automaticFoodEligibility === "function"
        ? automaticFoodEligibility
        : null,
      focusAllowedFn: typeof plannerFoodCanBeAutomaticFocus === "function"
        ? plannerFoodCanBeAutomaticFocus
        : null,
    };
    let candidates = (state?.foods || [])
      .filter((item) => plannerIntroductionKnownSnackFruitEligible(item, on, options));
    candidates.sort((a, b) => {
      let aReserved = ctx?.inventoryReserved?.get(a.id) || 0;
      let bReserved = ctx?.inventoryReserved?.get(b.id) || 0;
      let aStock = state?.settings?.preferInventoryInPlan &&
        typeof inventoryPortions === "function" && inventoryPortions(a.id) > aReserved ? 0 : 1;
      let bStock = state?.settings?.preferInventoryInPlan &&
        typeof inventoryPortions === "function" && inventoryPortions(b.id) > bReserved ? 0 : 1;
      let aToday = ctx?.qualityLastFoodUse?.get(a.id) === on ? 1 : 0;
      let bToday = ctx?.qualityLastFoodUse?.get(b.id) === on ? 1 : 0;
      return aToday - bToday ||
        aStock - bStock ||
        Number(ctx?.qualityFoodUse?.get(a.id) || 0) - Number(ctx?.qualityFoodUse?.get(b.id) || 0) ||
        (typeof usageCount === "function" ? usageCount(a.id) - usageCount(b.id) : 0) ||
        (Number(a.priority) || 9999) - (Number(b.priority) || 9999);
    });
    return candidates[0] || null;
  };

  let buildFruitSnack = (item, ctx) => {
    if (!item) return null;
    let hasStock = state?.settings?.preferInventoryInPlan &&
      typeof inventoryPortions === "function" &&
      inventoryPortions(item.id) > (ctx?.inventoryReserved?.get(item.id) || 0);
    let meal = {
      meal: "snack",
      active: true,
      focusId: item.id,
      foodIds: [item.id],
      baseFoodIds: [item.id],
      sampleFoodIds: [],
      foodRoles: { [item.id]: "base" },
      optionalAddons: [],
      inventoryFoodIds: [],
      recipeName: "",
      recipeInventoryId: "",
      milkMeal: "",
      type: hasStock ? "bekannt / Vorrat" : "bekannt",
      note: "Bekanntes Obst als Snack anbieten.",
    };
    applyPlannedMealAmounts(meal);
    return meal;
  };

  let normalizedSyntheticLock = (date, meal) => {
    let snapshot = typeof mealSnapshot === "function"
      ? mealSnapshot(date, meal.meal, meal, "auto")
      : plannerIntroductionPlainClone(meal);
    if (!snapshot) return null;
    snapshot.mode = "auto";
    snapshot.type = "bekannt";
    snapshot.sampleFoodIds = [];
    return snapshot;
  };

  let supplementalMeal = (date, index, mealKey, dayStartContext, priorMeals, used) => {
    supplementalNonAllergenOnly = true;
    let candidate;
    try {
      candidate = candidateFor(mealKey, date, dayStartContext, used, false);
    } finally {
      supplementalNonAllergenOnly = false;
    }
    if (!candidate?.f) return null;

    let oldPlanLocks = state.planLocks;
    let oldOverrides = state.overrides;
    let oldEvery = state.settings?.newFoodEvery;
    state.planLocks = { ...(state.planLocks || {}) };
    state.overrides = { ...(state.overrides || {}) };

    for (let prior of priorMeals || []) {
      if (!prior?.active || prior.empty || !prior.meal || slotProtected(date, prior.meal)) continue;
      let key = `${date}|${prior.meal}`;
      let lock = normalizedSyntheticLock(date, prior);
      if (lock) state.planLocks[key] = lock;
    }

    let targetKey = `${date}|${mealKey}`;
    delete state.planLocks[targetKey];
    state.overrides[targetKey] = candidate.f.id;
    if (state.settings) state.settings.newFoodEvery = 1;

    let normalization = normalizePresetRecords(date);
    let tempContext = plannerIntroductionCloneContext(dayStartContext);
    let previousSupplemental = supplementalNonAllergenOnly;
    let previousBlock = baselineBlocksAllergens;
    supplementalNonAllergenOnly = true;
    baselineBlocksAllergens = true;
    let generatedDay;
    try {
      generatedDay = originalBuildDay(date, index, tempContext);
    } finally {
      normalization.restore();
      supplementalNonAllergenOnly = previousSupplemental;
      baselineBlocksAllergens = previousBlock;
      state.planLocks = oldPlanLocks;
      state.overrides = oldOverrides;
      if (state.settings) state.settings.newFoodEvery = oldEvery;
    }

    let generated = generatedDay?.meals?.find((meal) => meal?.meal === mealKey);
    if (!generated?.active || generated.empty || !(generated.sampleFoodIds || []).length) return null;
    if ((generated.sampleFoodIds || []).some((id) => food(id)?.allergenGroup)) return null;

    let previousType = generated.type;
    generated = plannerIntroductionPlainClone(generated);
    generated.type = candidate.type;
    generated.manualAdded = false;
    if (previousType === "manuell") {
      let replacement = candidate.type === "gezielt wiederholen"
        ? "Wiederholung nach Pause erneut klein und getrennt bewerten."
        : "Neue Einführung separat oder in kleiner Menge mit der sicheren Basis anbieten.";
      generated.note = String(generated.note || "").replace(
        "Bekannte Lebensmittel sinnvoll rotieren; Vorrat bevorzugt nutzen.",
        replacement,
      );
    }
    return generated;
  };

  let recordFinalMeal = (meal, date, ctx) => {
    if (!meal?.active || meal.empty || !ctx) return;
    reserveMealInventory(meal, ctx);
    if (typeof mealMilkLevel === "function" && mealMilkLevel(meal) === "full") {
      ctx.fullMilkDates?.add(date);
    }
    if (meal.focusId && !meal.manualAdded) {
      ctx.plannedUse?.set(
        meal.focusId,
        (ctx.plannedUse?.get(meal.focusId) || 0) + 1,
      );
      ctx.lastFocus?.set(meal.focusId, date);
    }
    if (meal.recipeName) {
      ctx.recipePlannedUse?.set(
        meal.recipeName,
        (ctx.recipePlannedUse?.get(meal.recipeName) || 0) + 1,
      );
    }
    for (let id of meal.sampleFoodIds || []) {
      ctx.reserved?.add(id);
      if (ctx.introduced && !ctx.introduced.includes(id)) ctx.introduced.push(id);
    }
    if (typeof plannerQualityRecordMeal === "function") {
      plannerQualityRecordMeal(
        meal,
        date,
        ctx,
        state?.foods || [],
        typeof dueAllergen === "function" ? dueAllergen : null,
        typeof relatedFamilyFoodIds === "function" ? relatedFamilyFoodIds : null,
      );
    }
  };

  buildDay = function plannerDailyIntroductionBuildDay(date, index, ctx) {
    let dayStartContext = plannerIntroductionCloneContext(ctx);
    let oldEvery = state?.settings?.newFoodEvery;
    let wasDeferred = !!state?.deferred?.[date];
    let normalization = normalizePresetRecords(date);
    if (normalization.hasNonAllergenLearning) suppressDueAllergensInWorkingContext(ctx, date);
    if (!wasDeferred && state?.settings) state.settings.newFoodEvery = 1;

    let previousBlock = baselineBlocksAllergens;
    baselineBlocksAllergens = normalization.hasNonAllergenLearning;
    let day;
    try {
      day = originalBuildDay(date, index, ctx);
    } finally {
      baselineBlocksAllergens = previousBlock;
      normalization.restore();
      if (state?.settings) state.settings.newFoodEvery = oldEvery;
    }
    if (!day?.meals) return day;

    restoreDisplayedPresets(day, date, normalization.displays);
    plannerIntroductionRestoreContext(ctx, dayStartContext);

    let allergenDay = normalization.hasAllergenLearning || day.meals.some((meal) =>
      plannerIntroductionMealIsAllergenLearning(meal, food),
    );
    let used = [];
    let finalMeals = [];

    for (let baseline of day.meals) {
      let meal = baseline;
      let protectedSlot = meal?.meal ? slotProtected(date, meal.meal) : false;

      if (
        meal?.meal === "snack" &&
        meal?.active &&
        meal.empty &&
        !protectedSlot
      ) {
        let fruit = knownSnackFruit(date, ctx);
        meal = buildFruitSnack(fruit, ctx) || meal;
      }

      if (!meal?.active || meal.empty) {
        finalMeals.push(meal);
        continue;
      }

      let currentIsLearning = plannerIntroductionMealIsLearning(meal);
      if (
        !wasDeferred &&
        !allergenDay &&
        PLANNER_INTRODUCTION_MAIN_MEALS.includes(meal.meal) &&
        !protectedSlot &&
        !currentIsLearning
      ) {
        let generated = supplementalMeal(
          date,
          index,
          meal.meal,
          dayStartContext,
          finalMeals,
          used,
        );
        if (generated) {
          meal = generated;
          currentIsLearning = true;
        }
      }

      if (meal.focusId) used.push(meal.focusId);
      recordFinalMeal(meal, date, ctx);
      finalMeals.push(meal);
    }

    day.meals = finalMeals;
    day.introDue = !wasDeferred && PLANNER_INTRODUCTION_MAIN_MEALS.some((meal) =>
      typeof activeMeal !== "function" || activeMeal(meal, date),
    );
    day.introAssigned = finalMeals.some(plannerIntroductionMealIsLearning);
    return day;
  };

  manualMealRoleInfo = function plannerSnackFruitManualRoleInfo(
    foodOrId,
    meal,
    on = typeof today === "function" ? today() : "",
    context = {},
  ) {
    let item = typeof foodOrId === "string" ? food(foodOrId) : foodOrId;
    if (
      meal === "snack" &&
      !context?.recipeName &&
      item?.active &&
      item.category === "Obst" &&
      !item.allergenGroup &&
      (typeof status !== "function" || status(item) !== "Pausiert") &&
      (typeof isFoodUnavailable !== "function" || !isFoodUnavailable(item.id)) &&
      canCombine(item) &&
      snackBaseAllowed(item)
    ) {
      return { role: "base", reason: "known_snack_fruit", food: item };
    }
    return originalManualMealRoleInfo(foodOrId, meal, on, context);
  };

  let cadenceField = typeof document !== "undefined"
    ? document.getElementById("newFoodEvery")?.closest?.(".field")
    : null;
  if (cadenceField) cadenceField.hidden = true;

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerIntroductionPolicyRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PLANNER_INTRODUCTION_MAIN_MEALS,
    PLANNER_INTRODUCTION_LEARNING_TYPES,
    PLANNER_INTRODUCTION_ALLERGEN_TYPES,
    plannerIntroductionMealIsLearning,
    plannerIntroductionMealIsAllergenLearning,
    plannerIntroductionCandidateShouldSkip,
    plannerIntroductionNormalizeCandidate,
    plannerIntroductionKnownSnackFruitEligible,
    plannerIntroductionCloneContext,
    plannerIntroductionRestoreContext,
    installPlannerIntroductionPolicyRuntime,
  };
}
