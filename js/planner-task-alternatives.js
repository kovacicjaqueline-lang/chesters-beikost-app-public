"use strict";

/* Technische Grundlage für „Andere Idee“.
 *
 * Der bestehende „Tauschen“-Pfad darf die fachliche Planner-Aufgabe wechseln.
 * Dieser Pfad sucht dagegen ausschließlich alternative Darstellungen derselben
 * Aufgabe und verändert weder State noch UI. Eine spätere UI kann aus den hier
 * gelieferten Kandidaten auswählen und die vorhandene Snapshot-/Pin-Infrastruktur
 * zum Persistieren verwenden.
 */
(function plannerTaskAlternativesModule(globalScope) {
  const LEARNING_TYPES = new Set([
    "neu",
    "gezielt wiederholen",
    "Allergen einführen",
    "Allergen wiederholen",
    "manuell",
  ]);
  const MAX_ALTERNATIVES = 6;
  const MAX_FOCUS_CANDIDATES = 8;
  const MAX_VARIANTS_PER_FOCUS = 3;
  const READ_ONLY_STATE_KEYS = Object.freeze([
    "planLocks",
    "manualMeals",
    "overrides",
    "autoLockExcluded",
    "followUps",
    "backupMeta",
  ]);

  function canonicalIds(ids) {
    return [...new Set(ids || [])].filter(Boolean).sort();
  }

  function sameIds(left, right) {
    const a = canonicalIds(left);
    const b = canonicalIds(right);
    return a.length === b.length && a.every((id, index) => id === b[index]);
  }

  function candidateIdentity(meal) {
    if (!meal) return "";
    const foods = canonicalIds(meal.foodIds).join("+");
    if (meal.recipeName) return `recipe:${meal.recipeName}|foods:${foods}`;
    return foods ? `food:${foods}` : "";
  }

  function deriveTaskContract(meal, maintenanceTargetKeys = []) {
    if (!meal?.active || meal.empty || !meal.focusId) return null;
    const samples = canonicalIds(meal.sampleFoodIds);
    const maintenance = canonicalIds(maintenanceTargetKeys);
    if (samples.length) {
      return Object.freeze({
        kind: "learning",
        focusId: meal.focusId,
        sampleFoodIds: samples,
        type: String(meal.type || ""),
        maintenanceTargetKeys: Object.freeze([]),
      });
    }
    if (maintenance.length) {
      return Object.freeze({
        kind: "maintenance",
        focusId: "",
        sampleFoodIds: Object.freeze([]),
        type: "",
        maintenanceTargetKeys: Object.freeze(maintenance),
      });
    }
    return Object.freeze({
      kind: "known",
      focusId: "",
      sampleFoodIds: Object.freeze([]),
      type: "",
      maintenanceTargetKeys: Object.freeze([]),
    });
  }

  function candidatePreservesTask(contract, candidate, candidateMaintenanceTargetKeys = []) {
    if (!contract || !candidate?.active || candidate.empty || !candidate.focusId) return false;
    const samples = canonicalIds(candidate.sampleFoodIds);
    if (contract.kind === "learning") {
      return candidate.focusId === contract.focusId &&
        sameIds(samples, contract.sampleFoodIds) &&
        String(candidate.type || "") === contract.type;
    }
    if (samples.length) return false;
    if (contract.kind !== "maintenance") return true;
    const covered = new Set(canonicalIds(candidateMaintenanceTargetKeys));
    return contract.maintenanceTargetKeys.every((key) => covered.has(key));
  }

  const CORE = Object.freeze({
    LEARNING_TYPES,
    canonicalIds,
    sameIds,
    candidateIdentity,
    deriveTaskContract,
    candidatePreservesTask,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = CORE;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const swap = globalScope.__plannerRandomSwap;
  if (!swap) return;

  function visibleStart() {
    return typeof visiblePlanStart === "function"
      ? visiblePlanStart()
      : state.settings?.planFrom || today();
  }

  function currentVisiblePlan() {
    const from = visibleStart();
    // planDisplayDays persistiert Rollover-Snapshots und darf deshalb während der
    // read-only Alternativensuche nicht aufgerufen werden.
    return buildDays(from, 7, false);
  }

  function captureReadOnlyState() {
    const snapshot = {};
    for (const key of READ_ONLY_STATE_KEYS) {
      const exists = Object.prototype.hasOwnProperty.call(state, key);
      snapshot[key] = {
        exists,
        value: exists ? clone(state[key]) : undefined,
      };
    }
    return snapshot;
  }

  function restoreReadOnlyState(snapshot) {
    for (const key of READ_ONLY_STATE_KEYS) {
      const saved = snapshot?.[key];
      if (!saved?.exists) delete state[key];
      else state[key] = clone(saved.value);
    }
  }

  function targetMealFrom(days, date, meal) {
    return (days || [])
      .find((day) => day?.date === date)
      ?.meals?.find((entry) => entry?.meal === meal) || null;
  }

  function targetPlanWindow(date, visibleDays) {
    if ((visibleDays || []).some((day) => day?.date === date)) return visibleDays;
    return buildDays(date, 7, false);
  }

  function seedVisiblePlannerContext(days, targetKey) {
    state.planLocks ||= {};
    for (const day of days || []) {
      for (const planned of day.meals || []) {
        if (!planned?.active || planned.empty || !planned.focusId) continue;
        const key = swap.slotKey(day.date, planned.meal);
        if (key === targetKey || state.manualMeals?.[key]) continue;
        const existing = state.planLocks[key];
        if (existing?.mode === "manual" || existing?.followUpFoodId) continue;
        const snapshot = mealSnapshot(day.date, planned.meal, planned, "auto");
        if (snapshot?.focusId) state.planLocks[key] = snapshot;
      }
    }
  }

  function maintenanceKeysForMeal(meal) {
    const maintenance = globalScope.PlannerAllergenMaintenance;
    if (!maintenance?.targetKeysForFoodIds) return [];
    const keys = new Set();
    for (const key of meal?.allergenMaintenanceTarget ? [meal.allergenMaintenanceTarget] : []) {
      if (key) keys.add(key);
    }
    const ids = meal?.allergenMaintenanceFoodIds || [];
    for (const key of maintenance.targetKeysForFoodIds(ids, state.foods || [])) keys.add(key);
    return [...keys].sort();
  }

  function maintenanceKeysCoveredByCandidate(candidate) {
    const maintenance = globalScope.PlannerAllergenMaintenance;
    if (!maintenance?.targetKeysForFoodIds) return [];
    const keys = new Set();
    for (const key of candidate?.allergenMaintenanceTarget ? [candidate.allergenMaintenanceTarget] : []) {
      if (key) keys.add(key);
    }
    for (const key of maintenance.targetKeysForFoodIds(candidate?.foodIds || [], state.foods || [])) {
      keys.add(key);
    }
    return [...keys].sort();
  }

  function automaticFoodReady(item, meal, date) {
    return swap.automaticFocusAllowed(
      item,
      meal,
      date,
      (foodRecord, concreteMeal, on) => eligible(foodRecord, concreteMeal, on),
      typeof automaticFoodEligibility === "function"
        ? (foodRecord, on) => automaticFoodEligibility(foodRecord, on, state.settings || {})
        : null,
      typeof plannerFoodCanBeAutomaticFocus === "function"
        ? plannerFoodCanBeAutomaticFocus
        : null,
    );
  }

  function focusCandidatesForTask(contract, current, date, meal) {
    if (meal === "snack") return [null];
    if (contract.kind === "learning") {
      const exact = food(contract.focusId);
      return exact && automaticFoodReady(exact, meal, date) ? [exact] : [];
    }
    const pool = (state.foods || [])
      .filter((item) => automaticFoodReady(item, meal, date))
      .filter((item) => canCombine(item));
    pool.sort((a, b) => {
      if (a.id === current.focusId) return -1;
      if (b.id === current.focusId) return 1;
      return String(a.id).localeCompare(String(b.id));
    });
    return pool.slice(0, MAX_FOCUS_CANDIDATES);
  }

  function buildTaskCandidateWithPlanner(
    focus,
    date,
    meal,
    targetDays,
    contextDays,
    contract,
    excludedRecipeNames = new Set(),
    excludedCompanionIds = new Set(),
  ) {
    const key = swap.slotKey(date, meal);
    const previousLocks = clone(state.planLocks || {});
    const previousOverrides = clone(state.overrides || {});
    const previousExcluded = clone(state.autoLockExcluded || {});
    const previousFollowUps = clone(state.followUps || {});
    const liveIntroductionCandidate = typeof introductionCandidate === "function" ? introductionCandidate : null;
    const liveRecipeStates = typeof recipeStates === "function" ? recipeStates : null;
    const liveCompanionFor = typeof companionFor === "function" ? companionFor : null;
    try {
      state.planLocks ||= {};
      state.overrides ||= {};
      state.autoLockExcluded ||= {};
      seedVisiblePlannerContext(contextDays, key);
      delete state.planLocks[key];
      delete state.autoLockExcluded[key];
      if (focus?.id) state.overrides[key] = focus.id;
      else delete state.overrides[key];

      if (liveIntroductionCandidate && contract.kind === "learning" && focus?.id) {
        introductionCandidate = function taskPreservingIntroductionCandidate(
          concreteMeal,
          on,
          ctx,
          exclude = [],
        ) {
          const result = liveIntroductionCandidate(concreteMeal, on, ctx, exclude);
          if (
            concreteMeal === meal &&
            on === date &&
            result?.f?.id === focus.id
          ) return { ...result, type: contract.type };
          return result;
        };
      }

      if (liveRecipeStates && excludedRecipeNames.size) {
        recipeStates = function taskAlternativeRecipeStates(...args) {
          return (liveRecipeStates(...args) || []).filter(
            (recipe) => !excludedRecipeNames.has(recipe?.name),
          );
        };
      }

      if (liveCompanionFor && excludedCompanionIds.size && focus?.id) {
        companionFor = function taskAlternativeCompanionFor(
          concreteFocus,
          concreteMeal,
          on,
          focusType,
        ) {
          if (concreteFocus?.id !== focus.id || concreteMeal !== meal || on !== date) {
            return liveCompanionFor(concreteFocus, concreteMeal, on, focusType);
          }
          const liveFoods = state.foods;
          state.foods = (liveFoods || []).filter(
            (item) => item?.id === focus.id || !excludedCompanionIds.has(item?.id),
          );
          try {
            return liveCompanionFor(concreteFocus, concreteMeal, on, focusType);
          } finally {
            state.foods = liveFoods;
          }
        };
      }

      const from = targetDays?.[0]?.date || date;
      const days = buildDays(from, 7, false);
      const generated = targetMealFrom(days, date, meal);
      if (!generated?.active || generated.empty || !generated.focusId) return null;
      if (focus?.id && generated.focusId !== focus.id) return null;
      return clone(generated);
    } finally {
      state.planLocks = previousLocks;
      state.overrides = previousOverrides;
      state.autoLockExcluded = previousExcluded;
      state.followUps = previousFollowUps;
      if (liveIntroductionCandidate) introductionCandidate = liveIntroductionCandidate;
      if (liveRecipeStates) recipeStates = liveRecipeStates;
      if (liveCompanionFor) companionFor = liveCompanionFor;
    }
  }

  function nextCompanionToExclude(candidate, excludedCompanionIds) {
    const samples = new Set(candidate?.sampleFoodIds || []);
    return canonicalIds(candidate?.foodIds)
      .filter((id) => id !== candidate?.focusId && !samples.has(id))
      .find((id) => !excludedCompanionIds.has(id)) || "";
  }

  function alternativesForFocus(
    focus,
    date,
    meal,
    targetDays,
    contextDays,
    current,
    contract,
  ) {
    const alternatives = [];
    const seen = new Set();
    const excludedRecipes = new Set();
    const excludedCompanions = new Set();
    const currentIdentity = candidateIdentity(current);

    if (current.recipeName && (!focus || focus.id === current.focusId)) {
      excludedRecipes.add(current.recipeName);
    }

    for (let attempt = 0; attempt < MAX_VARIANTS_PER_FOCUS; attempt++) {
      const generated = buildTaskCandidateWithPlanner(
        focus,
        date,
        meal,
        targetDays,
        contextDays,
        contract,
        excludedRecipes,
        excludedCompanions,
      );
      if (!generated) break;

      const identity = candidateIdentity(generated);
      const maintenanceKeys = maintenanceKeysCoveredByCandidate(generated);
      if (
        identity &&
        identity !== currentIdentity &&
        !seen.has(identity) &&
        candidatePreservesTask(contract, generated, maintenanceKeys)
      ) {
        seen.add(identity);
        alternatives.push(generated);
      }

      if (generated.recipeName && !excludedRecipes.has(generated.recipeName)) {
        excludedRecipes.add(generated.recipeName);
        continue;
      }
      const companionId = nextCompanionToExclude(generated, excludedCompanions);
      if (!companionId) break;
      excludedCompanions.add(companionId);
    }
    return alternatives;
  }

  function taskPreservingAlternativesCore(date, meal) {
    if (!date || !meal || date < today()) return { ok: false, reason: "past", alternatives: [] };
    const key = swap.slotKey(date, meal);
    if (state.manualMeals?.[key]) {
      return { ok: false, reason: "manual", alternatives: [] };
    }
    if (mealIsCompleted(date, meal)) {
      return { ok: false, reason: "completed", alternatives: [] };
    }
    if (state.planLocks?.[key]?.followUpFoodId) {
      return { ok: false, reason: "follow-up", alternatives: [] };
    }

    const visibleDays = currentVisiblePlan();
    const targetDays = targetPlanWindow(date, visibleDays);
    const contextDays = swap.mergePlanDays(visibleDays, targetDays);
    const current = targetMealFrom(targetDays, date, meal);
    if (!current?.active || current.empty || !current.focusId) {
      return { ok: false, reason: "empty", alternatives: [] };
    }

    const contract = deriveTaskContract(current, maintenanceKeysForMeal(current));
    if (!contract) return { ok: false, reason: "contract", alternatives: [] };

    const alternatives = [];
    const seen = new Set();
    for (const focus of focusCandidatesForTask(contract, current, date, meal)) {
      for (const candidate of alternativesForFocus(
        focus,
        date,
        meal,
        targetDays,
        contextDays,
        current,
        contract,
      )) {
        const identity = candidateIdentity(candidate);
        if (!identity || seen.has(identity)) continue;
        seen.add(identity);
        alternatives.push(candidate);
        if (alternatives.length >= MAX_ALTERNATIVES) {
          return { ok: true, current: clone(current), contract, alternatives };
        }
      }
    }

    return {
      ok: alternatives.length > 0,
      reason: alternatives.length ? "" : "no-alternative",
      current: clone(current),
      contract,
      alternatives,
    };
  }

  function taskPreservingAlternatives(date, meal) {
    const snapshot = captureReadOnlyState();
    try {
      return taskPreservingAlternativesCore(date, meal);
    } finally {
      restoreReadOnlyState(snapshot);
    }
  }

  globalScope.__plannerTaskAlternatives = Object.freeze({
    ...CORE,
    taskPreservingAlternatives,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
