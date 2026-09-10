"use strict";

/*
 * Zentrale Lösungsschicht für strukturierte Plan-Checks.
 *
 * Der sichtbare UI-Code entscheidet hier ausdrücklich nicht selbst über FOOD-Eignung,
 * Rollen, Safety, Rezepte oder Allergenlogik. Vorschläge werden durch den bestehenden
 * Planner erzeugt, anschließend erneut über PlannerPlanChecks validiert und erst dann
 * als anwendbare, strukturierte Mutation zurückgegeben.
 */
(function plannerPlanCheckSolutionsModule(globalScope) {
  const FEATURE_VERSION = 1;
  const INTRO_OPEN_CODE = "ALLERGEN_INTRODUCTION_CONTINUE";
  const INTRO_PROJECTED_CODE = "ALLERGEN_INTRODUCTION_PROJECTED";
  const MEAL_ORDER = Object.freeze({ breakfast: 0, lunch: 1, snack: 2, dinner: 3 });
  const OPEN_GOAL = "open_goal";
  const PROJECTED_GOAL = "projected_covered_goal";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function unique(values = []) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }

  function stableStringify(value) {
    return JSON.stringify(stableValue(value));
  }

  function hashText(value) {
    let hash = 2166136261;
    for (const char of String(value || "")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function allergenIntroductionTarget(record = {}) {
    const group = text(record?.allergenGroup);
    if (!group) return null;
    const family = text(record?.allergenFamily);
    if (family) {
      return {
        key: `family:${family}`,
        kind: "family",
        value: record.name || group || family,
        allergenGroup: group,
      };
    }
    const id = text(record?.id);
    if (!id) return null;
    return {
      key: `food:${id}`,
      kind: "food",
      value: record.name || group || id,
      allergenGroup: group,
    };
  }

  function foodSpecificIntroductionCoveredByEstablishedMaintenance(
    record = {},
    establishedTargets = [],
    groupLevelTargets = [],
    targetForFoodFn = null,
  ) {
    const group = text(record?.allergenGroup);
    if (!group || text(record?.allergenFamily)) return false;
    const groupLevel = new Set((groupLevelTargets || []).map(text));
    if (!groupLevel.has(group) || typeof targetForFoodFn !== "function") return false;
    const maintenanceTarget = targetForFoodFn(record);
    if (!maintenanceTarget?.key) return false;
    return (establishedTargets || []).some((target) => target?.key === maintenanceTarget.key);
  }

  function allergenIntroductionNeedsContinuation(
    record = {},
    successfulExposureCount = 0,
    establishedTargets = [],
    groupLevelTargets = [],
    targetForFoodFn = null,
  ) {
    if (Number(successfulExposureCount) !== 1) return false;
    return !foodSpecificIntroductionCoveredByEstablishedMaintenance(
      record,
      establishedTargets,
      groupLevelTargets,
      targetForFoodFn,
    );
  }

  function goalKey(item = {}) {
    return text(item.details?.allergenIntroductionKey) ||
      text(item.details?.allergenTargetKey) ||
      `${text(item.code)}:${hashText(stableStringify(item.refs || {}))}`;
  }

  function introductionMutationKeepsMealContext(item = {}, before = {}, after = {}) {
    const goalIds = new Set(unique(item?.refs?.foodIds || []));
    if (!goalIds.size) return false;

    const beforeIds = new Set(unique(before?.foodIds || []));
    const afterIds = new Set(unique(after?.foodIds || []));
    if (![...goalIds].some((id) => afterIds.has(id))) return false;

    const unrelatedSamples = unique(before?.sampleFoodIds || [])
      .filter((id) => !goalIds.has(id));
    if (unrelatedSamples.length) return false;

    const addedUnrelated = [...afterIds]
      .filter((id) => !beforeIds.has(id) && !goalIds.has(id));
    if (addedUnrelated.length) return false;

    const beforeBases = unique(before?.baseFoodIds || []);
    if (beforeBases.length && !beforeBases.some((id) => afterIds.has(id))) return false;

    return true;
  }

  function planSignature(days = []) {
    return (days || []).flatMap((day) => (day.meals || [])
      .filter((meal) => meal?.active && !meal.empty && meal.focusId)
      .map((meal) => ({
        date: day.date || "",
        meal: meal.meal || "",
        planId: meal.planId || "",
        focusId: meal.focusId || "",
        foodIds: unique(meal.foodIds || []),
        baseFoodIds: unique(meal.baseFoodIds || []),
        sampleFoodIds: unique(meal.sampleFoodIds || []),
        recipeName: meal.recipeName || "",
        source: meal.source || "",
      })));
  }

  function solutionId(payload = {}) {
    return `pcs-${hashText(stableStringify(payload))}`;
  }

  function sortGoalItems(items = []) {
    return [...(items || [])].sort((a, b) => {
      const aIntro = a.code === INTRO_OPEN_CODE ? 0 : 1;
      const bIntro = b.code === INTRO_OPEN_CODE ? 0 : 1;
      if (aIntro !== bIntro) return aIntro - bIntro;
      const aDate = text(a.details?.lastEatenDate || a.details?.lastExposureDate || "9999-99-99");
      const bDate = text(b.details?.lastEatenDate || b.details?.lastExposureDate || "9999-99-99");
      return aDate.localeCompare(bDate) || goalKey(a).localeCompare(goalKey(b), "de");
    });
  }

  const CORE = Object.freeze({
    FEATURE_VERSION,
    INTRO_OPEN_CODE,
    INTRO_PROJECTED_CODE,
    allergenIntroductionTarget,
    foodSpecificIntroductionCoveredByEstablishedMaintenance,
    allergenIntroductionNeedsContinuation,
    goalKey,
    introductionMutationKeepsMealContext,
    planSignature,
    solutionId,
    sortGoalItems,
    stableStringify,
    hashText,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = CORE;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const dismissals = new Map();
  let logSuppression = null;

  function cloneValue(value) {
    if (typeof clone === "function") return clone(value);
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function phaseSignals(phase = typeof currentPhase === "function" ? currentPhase() : "kennenlernen") {
    const stored = state?.settings?.phaseReadinessSignalsByPhase?.[phase];
    return stored && typeof stored === "object" ? { ...stored } : {};
  }

  function setPhaseSignal(signal, value) {
    if (!["currentPatternAccepted", "additionalMealCue", "routineCompatible"].includes(signal)) return false;
    if (!["yes", "no", "unknown"].includes(value)) return false;
    const phase = currentPhase();
    state.settings ||= {};
    state.settings.phaseReadinessSignalsByPhase ||= {};
    state.settings.phaseReadinessSignalsByPhase[phase] ||= {};
    if (value === "unknown") delete state.settings.phaseReadinessSignalsByPhase[phase][signal];
    else state.settings.phaseReadinessSignalsByPhase[phase][signal] = value;
    return true;
  }

  function familyKey(record) {
    return CORE.allergenIntroductionTarget(record)?.key || "";
  }

  function familyFoodIds(record) {
    const key = familyKey(record);
    if (!key) return [];
    return (state.foods || [])
      .filter((candidate) => candidate?.allergenGroup && familyKey(candidate) === key)
      .map((candidate) => candidate.id);
  }

  function successfulFamilyExposureCount(record) {
    if (!record) return 0;
    if (typeof familySuccessfulExposureCount === "function") {
      return Number(familySuccessfulExposureCount(record, state.foods, state.logs, outcomeForFood)) || 0;
    }
    const ids = new Set(familyFoodIds(record));
    const exposures = new Set();
    for (const log of state.logs || []) {
      for (const id of log.foodIds || []) {
        if (!ids.has(id) || outcomeForFood(log, id) !== "eaten") continue;
        exposures.add(typeof plannerLogExposureKey === "function"
          ? plannerLogExposureKey(log)
          : `${log.date}|${log.meal || log.id || "entry"}`);
      }
    }
    return exposures.size;
  }

  function latestFamilyExposure(record) {
    const ids = new Set(familyFoodIds(record));
    let latest = "";
    for (const log of state.logs || []) {
      if (!log?.date) continue;
      if ((log.foodIds || []).some((id) => ids.has(id) && outcomeForFood(log, id) === "eaten")) {
        if (!latest || log.date > latest) latest = log.date;
      }
    }
    return latest;
  }

  function establishedMaintenanceTargets() {
    const maintenance = globalScope.PlannerAllergenMaintenance;
    if (!maintenance || typeof maintenance.establishedTargets !== "function") return [];
    return maintenance.establishedTargets(
      state.foods || [],
      (record) => typeof rank === "function" ? rank(record) : 0,
    );
  }

  function visibleOpenMeals(days = []) {
    return (days || []).flatMap((day) => (day.meals || [])
      .filter((meal) =>
        meal?.active &&
        !meal.empty &&
        meal.focusId &&
        !(typeof mealIsCompleted === "function" && mealIsCompleted(day.date, meal.meal))
      )
      .map((meal) => ({ ...meal, date: day.date })));
  }

  function introductionItems(days = []) {
    const meals = visibleOpenMeals(days);
    const groups = new Map();
    const maintenance = globalScope.PlannerAllergenMaintenance;
    const establishedTargets = establishedMaintenanceTargets();
    const groupLevelTargets = maintenance?.GROUP_LEVEL_MAINTENANCE_TARGETS || [];
    const targetForFoodFn = typeof maintenance?.targetForFood === "function"
      ? maintenance.targetForFood
      : null;
    for (const record of state.foods || []) {
      if (!record?.active || !record.allergenGroup) continue;
      if (typeof status === "function" && status(record) === "Pausiert") continue;
      const count = successfulFamilyExposureCount(record);
      if (!CORE.allergenIntroductionNeedsContinuation(
        record,
        count,
        establishedTargets,
        groupLevelTargets,
        targetForFoodFn,
      )) continue;
      const target = CORE.allergenIntroductionTarget(record);
      const key = target?.key || "";
      if (!key || groups.has(key)) continue;
      const ids = familyFoodIds(record);
      const latest = latestFamilyExposure(record);
      const representativeFoodId = record.id;
      const coveringMeals = meals.filter((meal) => (meal.foodIds || []).some((id) => ids.includes(id)));
      const projected = coveringMeals.length > 0;
      groups.set(key, {
        code: projected ? INTRO_PROJECTED_CODE : INTRO_OPEN_CODE,
        type: projected ? PROJECTED_GOAL : OPEN_GOAL,
        scope: "allergen_introduction",
        refs: {
          foodIds: ids,
          allergenTargets: [{
            key,
            kind: target.kind,
            value: target.value,
            allergenGroup: record.allergenGroup || "",
            representativeFoodId,
            lastEatenDate: latest,
          }],
          recipeNames: unique(coveringMeals.map((meal) => meal.recipeName)),
          meals: coveringMeals.map((meal) => ({
            planId: meal.planId || "",
            date: meal.date || "",
            meal: meal.meal || "",
            focusId: meal.focusId || "",
            foodIds: unique(meal.foodIds || []),
            baseFoodIds: unique(meal.baseFoodIds || []),
            sampleFoodIds: unique(meal.sampleFoodIds || []),
            recipeName: meal.recipeName || "",
            source: meal.source || "",
          })),
        },
        solutionPaths: projected ? [] : [{
          code: "CONTINUE_ALLERGEN_INTRODUCTION",
          kind: "planning",
          allergenIntroductionKey: key,
        }],
        details: {
          allergenIntroductionKey: key,
          representativeFoodId,
          lastExposureDate: latest,
          successfulExposureCount: count,
          projectedCovered: projected,
        },
      });
    }
    return [...groups.values()];
  }

  function report(days = [], options = {}) {
    const base = globalScope.PlannerPlanChecks?.report
      ? globalScope.PlannerPlanChecks.report(days, {
          ...options,
          phaseReadinessSignals: options.phaseReadinessSignals || phaseSignals(),
        })
      : { schemaVersion: 0, items: [], domainStates: {} };
    const introductions = introductionItems(days);
    return {
      ...base,
      items: [...(base.items || []), ...introductions],
      domainStates: {
        ...(base.domainStates || {}),
        allergenIntroduction: {
          items: introductions,
          openKeys: introductions.filter((item) => item.type === OPEN_GOAL).map(goalKey),
          projectedKeys: introductions.filter((item) => item.type === PROJECTED_GOAL).map(goalKey),
        },
      },
    };
  }

  function currentRevision() {
    return Number(state?.settings?.planCheckEvaluationRevision) || 0;
  }

  function bumpEvaluationRevision() {
    state.settings ||= {};
    state.settings.planCheckEvaluationRevision = currentRevision() + 1;
    logSuppression = null;
    return state.settings.planCheckEvaluationRevision;
  }

  function protectionSignature(days = []) {
    const keys = new Set();
    for (const day of days || []) {
      for (const meal of day.meals || []) {
        if (!meal?.active || meal.empty || !meal.focusId) continue;
        keys.add(`${day.date}|${meal.meal}`);
      }
    }
    return [...keys].sort().map((key) => ({
      key,
      lockMode: state.planLocks?.[key]?.mode || "",
      manual: !!state.manualMeals?.[key],
      manualAdded: !!state.manualMeals?.[key]?.manualAdded,
    }));
  }

  function evaluationKey(days = []) {
    return `pce-${CORE.hashText(CORE.stableStringify({
      day: typeof today === "function" ? today() : "",
      revision: currentRevision(),
      plan: CORE.planSignature(days),
      protection: protectionSignature(days),
    }))}`;
  }

  function dismissGoal(item, days = []) {
    dismissals.set(goalKey(item), evaluationKey(days));
  }

  function isDismissed(item, days = []) {
    return dismissals.get(goalKey(item)) === evaluationKey(days);
  }

  function openGoalItems(checkReport, days = [], options = {}) {
    const ignored = new Set(options.ignoreGoalKeys || []);
    return CORE.sortGoalItems((checkReport?.items || []).filter((item) =>
      item.type === OPEN_GOAL &&
      [INTRO_OPEN_CODE, "ALLERGEN_MAINTENANCE_DUE"].includes(item.code) &&
      !ignored.has(goalKey(item)) &&
      !isDismissed(item, days) &&
      !isGoalSuppressedAfterLog(item, days)
    ));
  }

  function beginLogSuppression(days = []) {
    const preReport = report(days);
    logSuppression = {
      day: typeof today === "function" ? today() : "",
      revision: currentRevision(),
      evaluationKey: "",
      preexistingGoalKeys: new Set(
        (preReport.items || [])
          .filter((item) => item.type === OPEN_GOAL)
          .map(goalKey),
      ),
    };
  }

  function cancelLogSuppression() {
    logSuppression = null;
  }

  function isGoalSuppressedAfterLog(item, days = []) {
    if (!logSuppression) return false;
    if (logSuppression.day !== (typeof today === "function" ? today() : "") ||
        logSuppression.revision !== currentRevision()) {
      logSuppression = null;
      return false;
    }
    if (logSuppression.preexistingGoalKeys.has(goalKey(item))) return false;
    const key = evaluationKey(days);
    if (!logSuppression.evaluationKey) logSuppression.evaluationKey = key;
    return logSuppression.evaluationKey === key;
  }

  function goalFoodIds(item) {
    return unique(item?.refs?.foodIds || []);
  }

  function maintenanceTarget(item) {
    return item?.refs?.allergenTargets?.[0] || null;
  }

  function mealCoversGoal(item, meal) {
    if (!meal?.active || meal.empty) return false;
    const ids = unique(meal.foodIds || []);
    if (item.code === INTRO_OPEN_CODE || item.code === INTRO_PROJECTED_CODE) {
      return ids.some((id) => goalFoodIds(item).includes(id));
    }
    const targetKey = text(item.details?.allergenTargetKey);
    if (!targetKey || !globalScope.PlannerAllergenMaintenance) return false;
    return globalScope.PlannerAllergenMaintenance
      .targetKeysForFoodIds(ids, state.foods)
      .includes(targetKey);
  }

  function goalIsCovered(checkReport, item) {
    const key = goalKey(item);
    const related = (checkReport?.items || []).filter((candidate) => goalKey(candidate) === key);
    return related.some((candidate) => candidate.type === PROJECTED_GOAL) ||
      !related.some((candidate) => candidate.type === OPEN_GOAL);
  }

  function slotProtected(date, meal, shownMeal = null) {
    const key = `${date}|${meal}`;
    return !!state.manualMeals?.[key] ||
      state.planLocks?.[key]?.mode === "manual" ||
      shownMeal?.manualAdded ||
      shownMeal?.lockedMode === "manual";
  }

  function candidateSlots(days = []) {
    const current = typeof today === "function" ? today() : "";
    return (days || []).flatMap((day) => (day.meals || [])
      .filter((meal) =>
        day.date >= current &&
        meal?.active &&
        !meal.empty &&
        meal.focusId &&
        !(typeof mealIsCompleted === "function" && mealIsCompleted(day.date, meal.meal))
      )
      .map((meal) => ({
        date: day.date,
        meal: meal.meal,
        shownMeal: meal,
        protected: slotProtected(day.date, meal.meal, meal),
      })))
      .sort((a, b) =>
        Number(a.protected) - Number(b.protected) ||
        a.date.localeCompare(b.date) ||
        (MEAL_ORDER[a.meal] ?? 9) - (MEAL_ORDER[b.meal] ?? 9));
  }

  function planMealMap(days = []) {
    const map = new Map();
    for (const day of days || []) {
      for (const meal of day.meals || []) {
        if (meal?.active && !meal.empty && meal.focusId) map.set(`${day.date}|${meal.meal}`, meal);
      }
    }
    return map;
  }

  function freezeVisiblePlan(days, releaseKeys = new Set()) {
    state.planLocks ||= {};
    state.manualMeals ||= {};
    state.overrides ||= {};
    state.autoLockExcluded ||= {};
    for (const day of days || []) {
      for (const meal of day.meals || []) {
        if (!meal?.active || meal.empty || !meal.focusId) continue;
        if (typeof mealIsCompleted === "function" && mealIsCompleted(day.date, meal.meal)) continue;
        const key = `${day.date}|${meal.meal}`;
        if (releaseKeys.has(key)) {
          delete state.planLocks[key];
          delete state.manualMeals[key];
          delete state.overrides[key];
          delete state.autoLockExcluded[key];
          continue;
        }
        if (state.manualMeals[key]) continue;
        if (!state.planLocks[key] && typeof mealSnapshot === "function") {
          const frozen = mealSnapshot(day.date, meal.meal, meal, "auto");
          if (frozen) state.planLocks[key] = frozen;
        }
      }
    }
  }

  function buildSimulatedVisibleDays(originalDays = []) {
    if (!originalDays.length) return [];
    const current = typeof today === "function" ? today() : originalDays[0].date;
    const historical = originalDays.filter((day) => day.date < current).map(cloneValue);
    const firstFuture = originalDays.find((day) => day.date >= current);
    if (!firstFuture) return historical;
    const count = originalDays.filter((day) => day.date >= current).length;
    const generated = typeof buildDays === "function" ? buildDays(firstFuture.date, count, false) : [];
    return [...historical, ...generated];
  }

  function withTemporaryState(callback) {
    const original = state;
    state = cloneValue(state);
    try {
      return callback();
    } finally {
      state = original;
    }
  }

  function preferredGoalFoodIds(item, slot) {
    const ids = goalFoodIds(item);
    if (!ids.length) return [];
    if (item.code === "ALLERGEN_MAINTENANCE_DUE" && globalScope.PlannerAllergenMaintenance &&
        typeof knownCandidate === "function" && typeof freshPlanContext === "function") {
      const target = maintenanceTarget(item);
      const result = globalScope.PlannerAllergenMaintenance.candidateForTarget(target, {
        meal: slot.meal,
        on: slot.date,
        ctx: freshPlanContext(),
        candidateFn: knownCandidate,
        maxCandidates: (state.foods?.length || 0) + 1,
      });
      if (result?.f?.id && ids.includes(result.f.id)) {
        return [result.f.id, ...ids.filter((id) => id !== result.f.id)];
      }
    }
    if (item.code === INTRO_OPEN_CODE) {
      const representative = text(item.details?.representativeFoodId);
      if (representative && ids.includes(representative)) {
        return [representative, ...ids.filter((id) => id !== representative)];
      }
    }
    return ids;
  }

  function snapshotMeta(date, meal, shownMeal) {
    const key = `${date}|${meal}`;
    const manual = state.manualMeals?.[key] ? cloneValue(state.manualMeals[key]) : null;
    const lock = state.planLocks?.[key] ? cloneValue(state.planLocks[key]) : null;
    return {
      key,
      hadManual: !!manual,
      manualAdded: manual ? manual.manualAdded !== false : !!shownMeal?.manualAdded,
      originalCreatedAt: manual?.createdAt || lock?.createdAt || shownMeal?.createdAt || "",
      originalLockMode: lock?.mode || "",
      protected: !!manual || lock?.mode === "manual" || shownMeal?.manualAdded || shownMeal?.lockedMode === "manual",
    };
  }

  function sameMealPlan(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return stableStringify({
      focusId: a.focusId || "",
      foodIds: unique(a.foodIds || []),
      baseFoodIds: unique(a.baseFoodIds || []),
      sampleFoodIds: unique(a.sampleFoodIds || []),
      foodRoles: a.foodRoles || {},
      optionalAddons: unique(a.optionalAddons || []),
      recipeName: a.recipeName || "",
      recipeInventoryId: a.recipeInventoryId || "",
      milkMeal: a.milkMeal || "",
      type: a.type || "",
      ingredientAmounts: a.ingredientAmounts || {},
    }) === stableStringify({
      focusId: b.focusId || "",
      foodIds: unique(b.foodIds || []),
      baseFoodIds: unique(b.baseFoodIds || []),
      sampleFoodIds: unique(b.sampleFoodIds || []),
      foodRoles: b.foodRoles || {},
      optionalAddons: unique(b.optionalAddons || []),
      recipeName: b.recipeName || "",
      recipeInventoryId: b.recipeInventoryId || "",
      milkMeal: b.milkMeal || "",
      type: b.type || "",
      ingredientAmounts: b.ingredientAmounts || {},
    });
  }

  function simulateGoalSlot(item, days, slot, forcedFoodId = "") {
    const before = slot.shownMeal;
    const meta = snapshotMeta(slot.date, slot.meal, before);
    return withTemporaryState(() => {
      const release = new Set([meta.key]);
      freezeVisiblePlan(days, release);
      if (forcedFoodId) state.overrides[meta.key] = forcedFoodId;
      const proposedDays = buildSimulatedVisibleDays(days);
      const proposedMap = planMealMap(proposedDays);
      const after = proposedMap.get(meta.key) || null;
      if (!after || sameMealPlan(before, after) || !mealCoversGoal(item, after)) return null;
      if (item.code === INTRO_OPEN_CODE && !CORE.introductionMutationKeepsMealContext(item, before, after)) return null;
      const proposedReport = report(proposedDays);
      if ((proposedReport.items || []).some((entry) => entry.type === "hard_blocker")) return null;
      if (!goalIsCovered(proposedReport, item)) return null;
      const snapshot = typeof mealSnapshot === "function"
        ? mealSnapshot(slot.date, slot.meal, after, meta.originalLockMode || (meta.protected ? "manual" : "auto"))
        : cloneValue(after);
      if (!snapshot) return null;
      const payload = {
        goalKey: goalKey(item),
        date: slot.date,
        meal: slot.meal,
        forcedFoodId,
        after: {
          focusId: snapshot.focusId,
          foodIds: snapshot.foodIds,
          baseFoodIds: snapshot.baseFoodIds,
          sampleFoodIds: snapshot.sampleFoodIds,
          recipeName: snapshot.recipeName,
          type: snapshot.type,
        },
        protected: meta.protected,
      };
      return {
        id: CORE.solutionId(payload),
        kind: "meal_mutation",
        goalKey: goalKey(item),
        goalCode: item.code,
        date: slot.date,
        meal: slot.meal,
        before: cloneValue(before),
        after: cloneValue(after),
        afterSnapshot: cloneValue(snapshot),
        requiresProtectedConfirmation: meta.protected,
        storage: meta,
      };
    });
  }

  function findSolution(item, days = [], options = {}) {
    const rejected = new Set(options.rejectedSolutionIds || []);
    for (const slot of candidateSlots(days)) {
      const natural = simulateGoalSlot(item, days, slot, "");
      if (natural && !rejected.has(natural.id)) return natural;
      for (const foodId of preferredGoalFoodIds(item, slot)) {
        const candidate = simulateGoalSlot(item, days, slot, foodId);
        if (candidate && !rejected.has(candidate.id)) return candidate;
      }
    }
    return null;
  }

  function writeSnapshotToSlot(solution) {
    if (!solution?.afterSnapshot || !solution.storage?.key) return false;
    const key = solution.storage.key;
    const snapshot = cloneValue(solution.afterSnapshot);
    state.planLocks ||= {};
    state.manualMeals ||= {};
    state.overrides ||= {};
    state.autoLockExcluded ||= {};
    delete state.overrides[key];
    delete state.autoLockExcluded[key];

    if (solution.storage.hadManual) {
      const manual = {
        ...snapshot,
        mode: undefined,
        manualAdded: solution.storage.manualAdded,
        createdAt: solution.storage.originalCreatedAt || snapshot.createdAt,
      };
      delete manual.mode;
      state.manualMeals[key] = manual;
      if (solution.storage.originalLockMode) {
        state.planLocks[key] = {
          ...snapshot,
          mode: solution.storage.originalLockMode,
          createdAt: solution.storage.originalCreatedAt || snapshot.createdAt,
        };
      } else {
        delete state.planLocks[key];
      }
      return true;
    }

    const mode = solution.storage.originalLockMode || (solution.storage.protected ? "manual" : "auto");
    state.planLocks[key] = {
      ...snapshot,
      mode,
      createdAt: solution.storage.originalCreatedAt || snapshot.createdAt,
    };
    return true;
  }

  function applySolution(solution) {
    return writeSnapshotToSlot(solution);
  }

  function blockerKeys(blockers = []) {
    return new Set((blockers || []).flatMap((item) => (item.refs?.meals || [])
      .map((meal) => meal?.date && meal?.meal ? `${meal.date}|${meal.meal}` : "")
      .filter(Boolean)));
  }

  function hardBlockerSignature(item) {
    return `${item.code}:${(item.refs?.meals || []).map((meal) => `${meal.date}|${meal.meal}|${meal.planId || ""}`).sort().join(",")}`;
  }

  function proposeHardCorrection(days = [], initialBlockers = []) {
    if (!initialBlockers.length) return null;
    const originalMap = planMealMap(days);
    const originalMeta = new Map();
    for (const [key, meal] of originalMap) {
      const [date, mealKey] = key.split("|");
      originalMeta.set(key, snapshotMeta(date, mealKey, meal));
    }
    const encountered = new Map(initialBlockers.map((item) => [hardBlockerSignature(item), cloneValue(item)]));
    let release = blockerKeys(initialBlockers);
    if (!release.size) return null;

    return withTemporaryState(() => {
      let proposedDays = [];
      let proposedReport = null;
      for (let pass = 0; pass < 8; pass++) {
        freezeVisiblePlan(days, release);
        proposedDays = buildSimulatedVisibleDays(days);
        proposedReport = report(proposedDays);
        const blockers = (proposedReport.items || []).filter((item) => item.type === "hard_blocker");
        if (!blockers.length) break;
        blockers.forEach((item) => encountered.set(hardBlockerSignature(item), cloneValue(item)));
        const more = blockerKeys(blockers);
        const beforeSize = release.size;
        more.forEach((key) => release.add(key));
        if (release.size === beforeSize) return null;
      }
      if (!proposedReport || (proposedReport.items || []).some((item) => item.type === "hard_blocker")) return null;

      const proposedMap = planMealMap(proposedDays);
      const changes = [];
      for (const key of release) {
        const before = originalMap.get(key) || null;
        const after = proposedMap.get(key) || null;
        if (!before || !after || sameMealPlan(before, after)) continue;
        const [date, meal] = key.split("|");
        const meta = originalMeta.get(key) || snapshotMeta(date, meal, before);
        const snapshot = typeof mealSnapshot === "function"
          ? mealSnapshot(date, meal, after, meta.originalLockMode || (meta.protected ? "manual" : "auto"))
          : cloneValue(after);
        if (!snapshot) continue;
        const reasonCodes = unique([...encountered.values()]
          .filter((blocker) => (blocker.refs?.meals || []).some((ref) => `${ref.date}|${ref.meal}` === key))
          .map((blocker) => blocker.code));
        changes.push({
          id: CORE.solutionId({ key, snapshot, reasonCodes }),
          key,
          date,
          meal,
          before: cloneValue(before),
          after: cloneValue(after),
          afterSnapshot: cloneValue(snapshot),
          reasonCodes,
          requiresProtectedConfirmation: meta.protected,
          storage: meta,
        });
      }
      if (!changes.length) return null;
      return {
        id: CORE.solutionId({
          kind: "hard_correction",
          changes: changes.map((change) => change.id),
          blockers: [...encountered.keys()].sort(),
        }),
        kind: "hard_correction",
        changes,
        blockerCodes: unique([...encountered.values()].map((item) => item.code)),
        resultingReport: cloneValue(proposedReport),
      };
    });
  }

  function applyHardCorrection(proposal) {
    if (!proposal?.changes?.length) return false;
    for (const change of proposal.changes) {
      if (!writeSnapshotToSlot(change)) return false;
    }
    return true;
  }

  globalScope.PlannerPlanCheckSolutions = Object.freeze({
    ...CORE,
    report,
    phaseSignals,
    setPhaseSignal,
    evaluationKey,
    bumpEvaluationRevision,
    dismissGoal,
    isDismissed,
    openGoalItems,
    beginLogSuppression,
    cancelLogSuppression,
    isGoalSuppressedAfterLog,
    findSolution,
    applySolution,
    proposeHardCorrection,
    applyHardCorrection,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
