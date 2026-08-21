"use strict";

/* Planner-Qualität: Allergen-Wiederholungen und weiche Wochenrotation.
 *
 * Diese Policy läuft nach den bestehenden Eligibility-, MILK-01-, PLAN-08- und
 * Rollen-Policies. Sie ersetzt keine harten Gates. Stattdessen:
 * - zählt ein vorhandener manueller/fester Lernslot vor der Auto-Planung des Tages;
 * - macht eine fällige Allergen-Wiederholung unabhängig vom normalen newFoodEvery-
 *   Takt zu einer möglichen Tagesaufgabe, ohne explizite Verschiebungen/Overrides
 *   oder geschützte Mahlzeiten zu überschreiben;
 * - erfasst alle tatsächlich geplanten FOODs (nicht nur focusId) als
 *   Rotationshistorie für Folgetage;
 * - bevorzugt bei gleich zulässigen bekannten Kandidaten weniger kürzlich
 *   verwendete FOODs und noch nicht wiederholte Paare;
 * - wertet eine manuelle Mahlzeit ohne sampleFoodIds nicht als automatische
 *   Einführung und vermeidet dadurch falsche Basis-Warnungen.
 */

const PLANNER_QUALITY_LEARNING_TYPES = new Set([
  "neu",
  "gezielt wiederholen",
  "bekannt kombinieren",
  "Allergen einführen",
  "Allergen wiederholen",
]);

function plannerQualityMealConsumesLearningSlot(meal) {
  if (!meal?.active || meal.empty) return false;
  if ((meal.sampleFoodIds || []).length) return true;
  return PLANNER_QUALITY_LEARNING_TYPES.has(String(meal.type || ""));
}

function plannerQualityPairKey(a, b) {
  return [a, b].filter(Boolean).sort().join("+");
}

function plannerQualityRelatedIds(foodRecord, foods = [], relatedFn = null) {
  if (!foodRecord) return new Set();
  if (typeof relatedFn === "function") {
    let related = relatedFn(foodRecord, foods);
    if (Array.isArray(related) && related.length) return new Set(related);
  }
  let ids = new Set([foodRecord.id]);
  let foodFamily = String(foodRecord.foodFamily || "");
  let allergenFamily = String(foodRecord.allergenFamily || "");
  if (!foodFamily && !allergenFamily) return ids;
  for (let candidate of foods || []) {
    if (!candidate) continue;
    if (
      (foodFamily && candidate.foodFamily === foodFamily) ||
      (allergenFamily && candidate.allergenFamily === allergenFamily)
    ) ids.add(candidate.id);
  }
  return ids;
}

function plannerQualityEnsureContext(ctx) {
  if (!ctx) return ctx;
  ctx.qualityFoodUse ||= new Map();
  ctx.qualityLastFoodUse ||= new Map();
  ctx.qualityPairUse ||= new Map();
  ctx.qualityDuePlanned ||= new Set();
  return ctx;
}

function plannerQualityRecordMeal(
  meal,
  date,
  ctx,
  foods = [],
  dueFn = null,
  relatedFn = null,
) {
  if (!meal?.active || meal.empty || !ctx) return ctx;
  plannerQualityEnsureContext(ctx);
  let ids = [...new Set(meal.foodIds || [])].filter(Boolean);
  for (let id of ids) {
    ctx.qualityFoodUse.set(id, (ctx.qualityFoodUse.get(id) || 0) + 1);
    ctx.qualityLastFoodUse.set(id, date);
  }
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      let key = plannerQualityPairKey(ids[i], ids[j]);
      ctx.qualityPairUse.set(key, (ctx.qualityPairUse.get(key) || 0) + 1);
    }
  }

  if (typeof dueFn === "function" && ids.length) {
    let present = new Set(ids);
    for (let candidate of foods || []) {
      if (!candidate || !dueFn(candidate, date)) continue;
      let related = plannerQualityRelatedIds(candidate, foods, relatedFn);
      if ([...related].some((id) => present.has(id))) ctx.qualityDuePlanned.add(candidate.id);
    }
  }
  return ctx;
}

function plannerQualityRecencyBucket(lastDateValue, on, diffFn) {
  if (!lastDateValue || typeof diffFn !== "function") return 0;
  let distance = Number(diffFn(on, lastDateValue));
  if (!Number.isFinite(distance)) return 0;
  if (distance <= 0) return 3;
  if (distance === 1) return 2;
  if (distance === 2) return 1;
  return 0;
}

function plannerQualityCandidateTuple(result, index, ctx, on, diffFn, focusId = "") {
  let id = result?.f?.id || "";
  let pairUse = focusId ? Number(ctx?.qualityPairUse?.get(plannerQualityPairKey(focusId, id)) || 0) : 0;
  let recency = plannerQualityRecencyBucket(ctx?.qualityLastFoodUse?.get(id), on, diffFn);
  let use = Number(ctx?.qualityFoodUse?.get(id) || 0);
  return [pairUse, recency, use, index];
}

function plannerQualityCompareTuple(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    let delta = Number(a[i] || 0) - Number(b[i] || 0);
    if (delta) return delta;
  }
  return 0;
}

function plannerQualityChooseResult(results, ctx, on, diffFn, focusId = "") {
  if (!Array.isArray(results) || !results.length) return null;
  return results
    .map((result, index) => ({ result, tuple: plannerQualityCandidateTuple(result, index, ctx, on, diffFn, focusId) }))
    .sort((a, b) => plannerQualityCompareTuple(a.tuple, b.tuple))[0]?.result || null;
}

function plannerQualityKnownCandidatePriorityTuple(
  result,
  on,
  ctx,
  options = {},
) {
  let item = result?.f || result;
  if (!item) return null;

  let settings = options.settings || (typeof state !== "undefined" ? state?.settings : null) || {};
  let diffFn = options.diffFn || (typeof diffDays === "function" ? diffDays : null);
  let inventoryPortionsFn = options.inventoryPortionsFn ||
    (typeof inventoryPortions === "function" ? inventoryPortions : null);
  let usageCountFn = options.usageCountFn || (typeof usageCount === "function" ? usageCount : null);
  let effectivePriorityFn = options.effectivePriorityFn ||
    (typeof effectivePriority === "function" ? effectivePriority : null);
  if (typeof usageCountFn !== "function" || typeof effectivePriorityFn !== "function") return null;

  let recentFocusPenalty = 0;
  let last = ctx?.lastFocus?.get(item.id);
  if (last) {
    if (typeof diffFn !== "function") return null;
    let distance = diffFn(on, last);
    if (distance <= 0) recentFocusPenalty = 500;
    else if (distance === 1) recentFocusPenalty = 250;
    else if (distance === 2) recentFocusPenalty = 80;
  }

  let inventoryPreference = 0;
  if (settings.preferInventoryInPlan) {
    if (typeof inventoryPortionsFn !== "function") return null;
    let reserved = ctx?.inventoryReserved?.get(item.id) || 0;
    if (inventoryPortionsFn(item.id) > reserved) inventoryPreference = -160;
  }

  return [
    recentFocusPenalty,
    inventoryPreference,
    Number(ctx?.plannedUse?.get(item.id) || 0),
    Number(usageCountFn(item.id) || 0),
    Number(effectivePriorityFn(item, on) || 0),
  ];
}

function plannerQualityChooseKnownResult(results, ctx, on, diffFn, priorityOptions = {}) {
  if (!Array.isArray(results) || !results.length) return null;
  if (results.length < 2) return results[0] || null;

  let baseline = plannerQualityKnownCandidatePriorityTuple(results[0], on, ctx, priorityOptions);
  if (!baseline) return results[0] || null;
  let samePriority = results.filter((result) => {
    let tuple = plannerQualityKnownCandidatePriorityTuple(result, on, ctx, priorityOptions);
    return tuple && plannerQualityCompareTuple(tuple, baseline) === 0;
  });
  if (!samePriority.length) return results[0] || null;
  return plannerQualityChooseResult(samePriority, ctx, on, diffFn) || results[0] || null;
}

function plannerQualityNormalizeQualityDays(days) {
  return (days || []).map((day) => ({
    ...day,
    meals: (day.meals || []).map((meal) => {
      let copy = {
        ...meal,
        foodIds: [...(meal.foodIds || [])],
        baseFoodIds: [...(meal.baseFoodIds || [])],
        sampleFoodIds: [...(meal.sampleFoodIds || [])],
      };
      if (copy.sampleFoodIds.length) copy.type = "neu";
      else if (copy.type === "manuell") copy.type = "bekannt";
      return copy;
    }),
  }));
}

function plannerQualityRewriteIssue(issue, foods = []) {
  let text = String(issue || "");
  let match = text.match(/^(.+) ist als Allergen fällig, aber noch nicht eingeplant\.$/);
  if (!match) return text;
  let item = (foods || []).find((candidate) => candidate?.name === match[1]);
  let name = item?.name || match[1];
  return `${name} sollte als Allergen wieder angeboten werden; in der sichtbaren Planung ist dafür aktuell kein geeigneter freier Slot.`;
}

function installPlannerQualityRotationRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__plannerQualityRotationRuntimeInstalled) return false;
  if (
    typeof buildDay !== "function" ||
    typeof freshPlanContext !== "function" ||
    typeof introductionCandidate !== "function" ||
    typeof knownCandidate !== "function" ||
    typeof companionFor !== "function" ||
    typeof planQualityIssues !== "function" ||
    typeof manualMealFor !== "function" ||
    typeof lockedMeal !== "function" ||
    typeof dueAllergen !== "function" ||
    typeof knownBase !== "function" ||
    typeof food !== "function" ||
    typeof isTrustedBase !== "function" ||
    typeof diffDays !== "function" ||
    typeof lastDate !== "function"
  ) return false;

  globalThis.__plannerQualityRotationRuntimeInstalled = true;

  let originalBuildDay = buildDay;
  let originalFreshPlanContext = freshPlanContext;
  let originalIntroductionCandidate = introductionCandidate;
  let originalKnownCandidate = knownCandidate;
  let originalCompanionFor = companionFor;
  let originalPlanQualityIssues = planQualityIssues;
  let activeQualityContext = null;
  let activeDueFood = null;

  let relatedIdsFor = (item) => plannerQualityRelatedIds(
    item,
    state?.foods || [],
    typeof relatedFamilyFoodIds === "function" ? relatedFamilyFoodIds : null,
  );

  let resultMatchesDue = (result, target) => {
    if (!result?.f || !target) return false;
    return relatedIdsFor(target).has(result.f.id);
  };

  let dueResultForMeal = (target, meal, on, ctx, exclude = []) => {
    if (!target || !meal || !ctx) return null;
    let key = `${on}|${meal}`;
    let override = state?.overrides?.[key] || "";
    let related = relatedIdsFor(target);
    if (override && !related.has(override)) return null;
    if (exclude.includes(target.id) || ctx.reserved?.has(target.id)) return null;
    if (!knownBase(meal, exclude)) return null;

    let allFoods = state?.foods || [];
    let filtered = allFoods.filter((candidate) =>
      candidate?.id === target.id ||
      related.has(candidate?.id) ||
      (typeof isTrustedBase === "function" && isTrustedBase(candidate) && !candidate?.allergenGroup),
    );
    state.foods = filtered;
    let result = null;
    try {
      result = originalIntroductionCandidate(meal, on, ctx, exclude);
    } finally {
      state.foods = allFoods;
    }
    return resultMatchesDue(result, target) ? result : null;
  };

  introductionCandidate = function plannerQualityIntroductionCandidate(meal, on, ctx, exclude = []) {
    if (!activeDueFood) return originalIntroductionCandidate(meal, on, ctx, exclude);
    return dueResultForMeal(activeDueFood, meal, on, ctx, exclude);
  };

  let collectKnownResults = (meal, on, ctx, exclude = []) => {
    if (state?.overrides?.[`${on}|${meal}`]) return [originalKnownCandidate(meal, on, ctx, exclude)].filter(Boolean);
    let results = [];
    let blocked = [...exclude];
    let seen = new Set();
    let max = Math.min(12, (state?.foods?.length || 0) + 1);
    for (let i = 0; i < max; i++) {
      let result = originalKnownCandidate(meal, on, ctx, blocked);
      if (!result?.f || seen.has(result.f.id)) break;
      if (result.type === "nach Einführung" && results.length) break;
      results.push(result);
      seen.add(result.f.id);
      blocked.push(result.f.id);
    }
    return results;
  };

  knownCandidate = function plannerQualityKnownCandidate(meal, on, ctx, exclude = []) {
    let results = collectKnownResults(meal, on, ctx, exclude);
    if (!activeQualityContext || results.length < 2) return results[0] || null;
    return plannerQualityChooseKnownResult(results, activeQualityContext, on, diffDays) || results[0] || null;
  };

  let collectCompanionResults = (focus, meal, on, focusType) => {
    let allFoods = state?.foods || [];
    let blocked = new Set();
    let results = [];
    let max = Math.min(10, allFoods.length + 1);
    try {
      for (let i = 0; i < max; i++) {
        state.foods = allFoods.filter((item) => item?.id === focus?.id || !blocked.has(item?.id));
        let result = originalCompanionFor(focus, meal, on, focusType);
        if (!result?.id || blocked.has(result.id)) break;
        let canonical = allFoods.find((item) => item?.id === result.id) || result;
        results.push({ f: canonical });
        blocked.add(result.id);
      }
    } finally {
      state.foods = allFoods;
    }
    return results;
  };

  companionFor = function plannerQualityCompanionFor(focus, meal, on, focusType = "") {
    if (
      !activeQualityContext ||
      !focus ||
      focus.allergenGroup ||
      PLANNER_QUALITY_LEARNING_TYPES.has(String(focusType || "")) ||
      focusType === "manuell"
    ) return originalCompanionFor(focus, meal, on, focusType);

    let results = collectCompanionResults(focus, meal, on, focusType);
    if (results.length < 2) return results[0]?.f || null;

    if (typeof plannerAutomaticPairPreferencePenalty === "function") {
      let baseline = plannerAutomaticPairPreferencePenalty(focus, results[0].f, meal);
      let sameTier = results.filter((entry) => plannerAutomaticPairPreferencePenalty(focus, entry.f, meal) <= baseline);
      if (sameTier.length) results = sameTier;
    }

    let selected = plannerQualityChooseResult(results, activeQualityContext, on, diffDays, focus.id);
    return selected?.f || results[0]?.f || null;
  };

  freshPlanContext = function plannerQualityFreshPlanContext() {
    return plannerQualityEnsureContext(originalFreshPlanContext());
  };

  let presetMealsFor = (date) => ["breakfast", "lunch", "snack", "dinner"]
    .map((meal) => manualMealFor(date, meal) || lockedMeal(date, meal))
    .filter(Boolean);

  let presetContainsDue = (presetMeals, target) => {
    let related = relatedIdsFor(target);
    return (presetMeals || []).some((meal) => (meal.foodIds || []).some((id) => related.has(id)));
  };

  let activeAutomaticMeals = (date) => ["breakfast", "lunch", "dinner"].filter((meal) =>
    typeof activeMeal !== "function" || activeMeal(meal, date),
  );

  let forcedLearningOverride = (date) => activeAutomaticMeals(date).some((meal) => {
    let id = state?.overrides?.[`${date}|${meal}`];
    if (!id) return false;
    let item = food(id);
    return !!item && typeof rank === "function" && rank(item) < 2;
  });

  let selectDueForDay = (date, ctx, presetMeals) => {
    let foods = state?.foods || [];
    let candidates = foods
      .filter((item) => item && dueAllergen(item, date) && !ctx.qualityDuePlanned.has(item.id))
      .filter((item) => !presetContainsDue(presetMeals, item))
      .sort((a, b) =>
        String(lastDate(a.id, true) || "").localeCompare(String(lastDate(b.id, true) || "")) ||
        (Number(a.priority) || 9999) - (Number(b.priority) || 9999),
      );

    for (let candidate of candidates) {
      for (let meal of activeAutomaticMeals(date)) {
        if (dueResultForMeal(candidate, meal, date, ctx, [])) return candidate;
      }
    }
    return null;
  };

  buildDay = function plannerQualityBuildDay(date, index, ctx) {
    plannerQualityEnsureContext(ctx);
    let presetMeals = presetMealsFor(date);
    let presetLearning = presetMeals.some(plannerQualityMealConsumesLearningSlot);
    let forcedOverride = forcedLearningOverride(date);
    let hadDeferredObject = !!state.deferred;
    state.deferred ||= {};
    let hadDeferredKey = Object.prototype.hasOwnProperty.call(state.deferred, date);
    let oldDeferred = state.deferred[date];
    let oldEvery = state.settings?.newFoodEvery;
    let normalizedLocks = new Map();

    for (let meal of ["breakfast", "lunch", "snack", "dinner"]) {
      let key = `${date}|${meal}`;
      let lock = state.planLocks?.[key];
      if (lock?.type === "manuell" && !(lock.sampleFoodIds || []).length) {
        normalizedLocks.set(key, lock.type);
        lock.type = "bekannt";
      }
    }

    let due = null;
    if (presetLearning) {
      state.deferred[date] = true;
    } else if (!forcedOverride && !state.deferred[date]) {
      due = selectDueForDay(date, ctx, presetMeals);
      if (due && state.settings) state.settings.newFoodEvery = 1;
    }

    let previousContext = activeQualityContext;
    let previousDue = activeDueFood;
    activeQualityContext = ctx;
    activeDueFood = due;
    let day;
    try {
      day = originalBuildDay(date, index, ctx);
    } finally {
      activeQualityContext = previousContext;
      activeDueFood = previousDue;
      if (state.settings) state.settings.newFoodEvery = oldEvery;
      if (hadDeferredKey) state.deferred[date] = oldDeferred;
      else delete state.deferred[date];
      if (!hadDeferredObject && Object.keys(state.deferred).length === 0) delete state.deferred;
      for (let [key, type] of normalizedLocks) {
        if (state.planLocks?.[key]) state.planLocks[key].type = type;
      }
    }

    for (let meal of day?.meals || []) {
      let key = `${date}|${meal.meal}`;
      if (normalizedLocks.has(key)) meal.type = normalizedLocks.get(key);
      plannerQualityRecordMeal(
        meal,
        date,
        ctx,
        state?.foods || [],
        dueAllergen,
        typeof relatedFamilyFoodIds === "function" ? relatedFamilyFoodIds : null,
      );
    }
    return day;
  };

  planQualityIssues = function plannerQualityIssuesWithRoles(days) {
    let normalized = plannerQualityNormalizeQualityDays(days);
    return originalPlanQualityIssues(normalized)
      .map((issue) => plannerQualityRewriteIssue(issue, state?.foods || []));
  };

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerQualityRotationRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PLANNER_QUALITY_LEARNING_TYPES,
    plannerQualityMealConsumesLearningSlot,
    plannerQualityPairKey,
    plannerQualityRelatedIds,
    plannerQualityEnsureContext,
    plannerQualityRecordMeal,
    plannerQualityRecencyBucket,
    plannerQualityCandidateTuple,
    plannerQualityCompareTuple,
    plannerQualityChooseResult,
    plannerQualityKnownCandidatePriorityTuple,
    plannerQualityChooseKnownResult,
    plannerQualityNormalizeQualityDays,
    plannerQualityRewriteIssue,
    installPlannerQualityRotationRuntime,
  };
}
