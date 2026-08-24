"use strict";

/* Langfristige Allergenpflege
 * Trennt etablierte Maintenance-Expositionen von Einführungs-/Lernaufgaben.
 * Gleichwertige Expositionen werden ausschließlich über das bereits strukturierte
 * allergenFamily-Modell zusammengeführt; ohne Familie bleibt die FOOD-Identität erhalten.
 */
(function plannerAllergenMaintenanceModule(globalScope) {
  const FEATURE_VERSION = 1;
  const CONTEXT_KEY = "allergenMaintenanceProjectedTargets";

  function text(value) {
    return String(value || "").trim();
  }

  function targetForFood(foodRecord) {
    if (!foodRecord) return null;
    let family = text(foodRecord.allergenFamily);
    let group = text(foodRecord.allergenGroup);
    if (family) {
      return {
        key: `family:${family}`,
        kind: "family",
        value: family,
        allergenGroup: group,
      };
    }
    if (!group || !text(foodRecord.id)) return null;
    return {
      key: `food:${foodRecord.id}`,
      kind: "food",
      value: foodRecord.id,
      allergenGroup: group,
    };
  }

  function targetMatchesFood(target, foodRecord) {
    if (!target || !foodRecord) return false;
    return targetForFood(foodRecord)?.key === target.key;
  }

  function targetFoodIds(target, foods = []) {
    return (foods || [])
      .filter((foodRecord) => targetMatchesFood(target, foodRecord))
      .map((foodRecord) => foodRecord.id);
  }

  function foodById(foods, id) {
    return (foods || []).find((foodRecord) => foodRecord?.id === id) || null;
  }

  function targetKeysForFoodIds(foodIds = [], foods = []) {
    return [...new Set(
      (foodIds || [])
        .map((id) => targetForFood(foodById(foods, id))?.key || "")
        .filter(Boolean),
    )];
  }

  function foodIdsForPlannedRecord(record, helpers = {}) {
    if (!record) return [];
    let direct = [...new Set(record.foodIds || [])].filter(Boolean);
    if (direct.length) return direct;
    if (record.focusId) direct.push(record.focusId);
    if (direct.length || !record.recipeName) return direct;
    let recipe = typeof helpers.recipeByNameFn === "function"
      ? helpers.recipeByNameFn(record.recipeName)
      : null;
    return recipe && typeof helpers.recipeFoodIdsFn === "function"
      ? [...new Set(helpers.recipeFoodIdsFn(recipe) || [])].filter(Boolean)
      : [];
  }

  function projectedTargetKeysForRecord(record, foods = [], helpers = {}) {
    return targetKeysForFoodIds(foodIdsForPlannedRecord(record, helpers), foods);
  }

  function ensureProjectedTargetSet(ctx) {
    if (!ctx || typeof ctx !== "object") return new Set();
    if (!(ctx[CONTEXT_KEY] instanceof Set)) ctx[CONTEXT_KEY] = new Set(ctx[CONTEXT_KEY] || []);
    return ctx[CONTEXT_KEY];
  }

  function markProjectedRecord(ctx, record, foods = [], helpers = {}) {
    let projected = ensureProjectedTargetSet(ctx);
    for (let key of projectedTargetKeysForRecord(record, foods, helpers)) projected.add(key);
    return projected;
  }

  function isoDayNumber(value) {
    let parts = text(value).split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return NaN;
    return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
  }

  function dayDistance(later, earlier) {
    let a = isoDayNumber(later);
    let b = isoDayNumber(earlier);
    return Number.isFinite(a) && Number.isFinite(b) ? a - b : NaN;
  }

  function latestSuccessfulExposureDate(target, foods = [], logs = [], outcomeForFoodFn = () => "", on = "") {
    let ids = new Set(targetFoodIds(target, foods));
    if (!ids.size) return "";
    let latest = "";
    for (let log of logs || []) {
      let date = text(log?.date);
      if (!date || (on && date > on)) continue;
      for (let id of log?.foodIds || []) {
        if (!ids.has(id) || outcomeForFoodFn(log, id) !== "eaten") continue;
        if (!latest || date > latest) latest = date;
      }
    }
    return latest;
  }

  function establishedTargets(foods = [], rankFn = () => 0) {
    let byKey = new Map();
    for (let foodRecord of foods || []) {
      let target = targetForFood(foodRecord);
      if (!target || Number(rankFn(foodRecord)) < 2) continue;
      let current = byKey.get(target.key);
      if (!current) {
        byKey.set(target.key, {
          ...target,
          representativeFoodId: foodRecord.id,
          representativeFoodName: foodRecord.name || foodRecord.id,
        });
      }
    }
    return [...byKey.values()];
  }

  function dueTargets({
    foods = [],
    logs = [],
    on = "",
    intervalDays = 7,
    rankFn = () => 0,
    outcomeForFoodFn = () => "",
    projectedTargetKeys = new Set(),
  } = {}) {
    let interval = Math.max(1, Number(intervalDays) || 7);
    let projected = projectedTargetKeys instanceof Set
      ? projectedTargetKeys
      : new Set(projectedTargetKeys || []);
    return establishedTargets(foods, rankFn)
      .map((target) => ({
        ...target,
        lastEatenDate: latestSuccessfulExposureDate(target, foods, logs, outcomeForFoodFn, on),
      }))
      .filter((target) =>
        target.lastEatenDate &&
        !projected.has(target.key) &&
        dayDistance(on, target.lastEatenDate) >= interval,
      )
      .sort((a, b) =>
        a.lastEatenDate.localeCompare(b.lastEatenDate) ||
        a.key.localeCompare(b.key),
      );
  }

  function candidateForTarget(target, {
    meal,
    on,
    ctx,
    exclude = [],
    candidateFn,
    maxCandidates = 500,
  } = {}) {
    if (!target || typeof candidateFn !== "function") return null;
    let blocked = [...new Set(exclude || [])].filter(Boolean);
    for (let index = 0; index < maxCandidates; index++) {
      let result = candidateFn(meal, on, ctx, blocked);
      if (!result?.f?.id) return null;
      if (targetMatchesFood(target, result.f)) return result;
      if (blocked.includes(result.f.id)) return null;
      blocked.push(result.f.id);
    }
    return null;
  }

  const CORE = Object.freeze({
    FEATURE_VERSION,
    CONTEXT_KEY,
    targetForFood,
    targetMatchesFood,
    targetFoodIds,
    targetKeysForFoodIds,
    foodIdsForPlannedRecord,
    projectedTargetKeysForRecord,
    ensureProjectedTargetSet,
    markProjectedRecord,
    latestSuccessfulExposureDate,
    establishedTargets,
    dueTargets,
    candidateForTarget,
    dayDistance,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = CORE;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let baseLockedMeal = lockedMeal;
  let baseBuildDay = buildDay;

  function runtimeHelpers() {
    return {
      recipeByNameFn: (name) => recipeByName(name),
      recipeFoodIdsFn: (recipe) => recipeFoodIds(recipe),
    };
  }

  function runtimeDueTargets(on, ctx) {
    return CORE.dueTargets({
      foods: state.foods,
      logs: state.logs,
      on,
      intervalDays: Number(state.settings.allergenDays) || 7,
      rankFn: (foodRecord) => rank(foodRecord),
      outcomeForFoodFn: (log, id) => outcomeForFood(log, id),
      projectedTargetKeys: CORE.ensureProjectedTargetSet(ctx),
    });
  }

  function markRuntimeRecord(ctx, record) {
    return CORE.markProjectedRecord(ctx, record, state.foods, runtimeHelpers());
  }

  function markPresetRange(ctx, from, count) {
    let end = addDays(from, Math.max(0, Number(count || 0) - 1));
    for (let [key, record] of Object.entries(state.manualMeals || {})) {
      let date = key.split("|")[0];
      if (date >= from && date <= end) markRuntimeRecord(ctx, record);
    }
    for (let [key, record] of Object.entries(state.planLocks || {})) {
      let date = key.split("|")[0];
      if (date >= from && date <= end) markRuntimeRecord(ctx, record);
    }
  }

  function maintenanceKnownCandidate(liveKnownCandidate, meal, on, ctx, exclude = []) {
    let projected = CORE.ensureProjectedTargetSet(ctx);
    for (let target of runtimeDueTargets(on, ctx)) {
      let result = CORE.candidateForTarget(target, {
        meal,
        on,
        ctx,
        exclude,
        candidateFn: liveKnownCandidate,
        maxCandidates: (state.foods?.length || 0) + 1,
      });
      if (!result?.f) continue;
      projected.add(target.key);
      return {
        ...result,
        type: result.type === "manuell" ? result.type : "bekannt kombinieren",
        allergenMaintenanceTarget: target.key,
      };
    }
    return liveKnownCandidate(meal, on, ctx, exclude);
  }

  function maintenanceFoodIsDue(foodRecord, on) {
    let target = CORE.targetForFood(foodRecord);
    if (!target) return false;
    let established = (state.foods || []).filter((item) =>
      CORE.targetMatchesFood(target, item) && Number(rank(item)) >= 2
    );
    if (!established.length || established[0].id !== foodRecord.id) return false;
    let lastEatenDate = CORE.latestSuccessfulExposureDate(
      target,
      state.foods,
      state.logs,
      (log, id) => outcomeForFood(log, id),
      on,
    );
    return !!lastEatenDate &&
      CORE.dayDistance(on, lastEatenDate) >= Math.max(1, Number(state.settings.allergenDays) || 7);
  }

  // Kompatibilitätsabfrage für bestehende Status-/Planprüfungen: genau ein
  // Vertreter pro Maintenance-Ziel wird als fällig gemeldet. Die Lernkandidaten
  // blenden diese Langzeitpflege innerhalb von buildDay separat aus.
  dueAllergen = function maintenanceAwareDueAllergen(foodRecord, on) {
    return maintenanceFoodIsDue(foodRecord, on);
  };

  lockedMeal = function maintenanceAwareLockedMeal(date, meal) {
    let result = baseLockedMeal(date, meal);
    if (
      !result ||
      result.type !== "Allergen wiederholen" ||
      (result.sampleFoodIds || []).length
    ) return result;
    let focus = food(result.focusId);
    let target = CORE.targetForFood(focus);
    if (!target) return result;
    let established = CORE.establishedTargets(state.foods, (item) => rank(item))
      .some((item) => item.key === target.key);
    return established ? { ...result, type: "bekannt kombinieren" } : result;
  };

  buildDay = function maintenanceAwareBuildDay(date, index, ctx) {
    let projected = CORE.ensureProjectedTargetSet(ctx);
    let projectedBeforeDay = new Set(projected);
    let provisionalTargets = new Set();
    for (let meal of ["breakfast", "lunch", "snack", "dinner"]) {
      let preset = manualMealFor(date, meal) || lockedMeal(date, meal);
      if (preset) markRuntimeRecord(ctx, preset);
    }

    let liveDueAllergen = dueAllergen;
    let liveKnownCandidate = knownCandidate;
    let liveRecipeStockCandidate = recipeStockCandidate;
    let liveSnackRecipeCandidate = snackRecipeCandidate;

    knownCandidate = function maintenancePriorityKnownCandidate(meal, on, innerCtx, exclude = []) {
      let result = maintenanceKnownCandidate(liveKnownCandidate, meal, on, innerCtx, exclude);
      if (result?.allergenMaintenanceTarget) provisionalTargets.add(result.allergenMaintenanceTarget);
      return result;
    };
    recipeStockCandidate = function maintenanceAwareRecipeStockCandidate(meal, on, innerCtx) {
      let result = liveRecipeStockCandidate(meal, on, innerCtx);
      if (result) {
        let ids = recipeFoodIds(result);
        let innerProjected = CORE.ensureProjectedTargetSet(innerCtx);
        for (let key of CORE.targetKeysForFoodIds(ids, state.foods)) innerProjected.add(key);
      }
      return result;
    };
    snackRecipeCandidate = function maintenanceAwareSnackRecipeCandidate(on, innerCtx) {
      let result = liveSnackRecipeCandidate(on, innerCtx);
      if (result) {
        let ids = recipeFoodIds(result);
        let innerProjected = CORE.ensureProjectedTargetSet(innerCtx);
        for (let key of CORE.targetKeysForFoodIds(ids, state.foods)) innerProjected.add(key);
      }
      return result;
    };

    try {
      // Langzeitpflege ist keine Lernaufgabe. Nur der bestehende Lernpfad sieht
      // deshalb während der Basiserzeugung keine Maintenance-Fälligkeiten.
      dueAllergen = () => false;
      let day = baseBuildDay(date, index, ctx);
      let actualTargetKeys = new Set();
      for (let meal of day?.meals || []) {
        markRuntimeRecord(ctx, meal);
        for (let key of CORE.projectedTargetKeysForRecord(meal, state.foods, runtimeHelpers())) actualTargetKeys.add(key);
      }
      for (let key of provisionalTargets) {
        if (!actualTargetKeys.has(key) && !projectedBeforeDay.has(key)) projected.delete(key);
      }
      return day;
    } finally {
      dueAllergen = liveDueAllergen;
      knownCandidate = liveKnownCandidate;
      recipeStockCandidate = liveRecipeStockCandidate;
      snackRecipeCandidate = liveSnackRecipeCandidate;
    }
  };

  if (typeof planIssues === "function") {
    let basePlanIssues = planIssues;
    planIssues = function maintenanceAwarePlanIssues(days = []) {
      let projected = new Set();
      for (let day of days || []) {
        for (let meal of day?.meals || []) {
          for (let key of CORE.projectedTargetKeysForRecord(meal, state.foods, runtimeHelpers())) projected.add(key);
        }
      }
      let liveDueAllergen = dueAllergen;
      dueAllergen = function maintenanceDueNotAlreadyCovered(foodRecord, on) {
        let target = CORE.targetForFood(foodRecord);
        return !!target && !projected.has(target.key) && liveDueAllergen(foodRecord, on);
      };
      try {
        return basePlanIssues(days);
      } finally {
        dueAllergen = liveDueAllergen;
      }
    };
  }

  buildDays = function maintenanceAwareBuildDays(from, n = 7, applyAutoLocks = true) {
    let ctx = freshPlanContext();
    CORE.ensureProjectedTargetSet(ctx);
    markPresetRange(ctx, from, n);
    let arr = [];
    for (let index = 0; index < n; index++) arr.push(buildDay(addDays(from, index), index, ctx));
    if (applyAutoLocks && ensureAutoLocks(arr)) return buildDays(from, n, false);
    return arr;
  };

  globalScope.PlannerAllergenMaintenance = CORE;
})(typeof globalThis !== "undefined" ? globalThis : this);
