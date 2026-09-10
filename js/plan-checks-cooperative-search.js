"use strict";

/*
 * Kooperative Lösungssuche für Plan-Check-Ziele.
 *
 * Der bestehende synchrone Solver bleibt die fachliche Source of Truth. Diese Schicht
 * begrenzt einen Suchschritt auf genau einen sichtbaren Zielslot, friert alle übrigen
 * sichtbaren Mahlzeiten in einer isolierten State-Kopie ein und gibt zwischen den
 * Suchschritten an den Browser zurück. Dadurch können mehrere Zielprüfungen gemeinsam
 * fortschreiten, ohne einen langen vollständigen Solver-Lauf am Stück auf dem Main-Thread
 * auszuführen. Das ist kooperative Nebenläufigkeit, keine Worker-/CPU-Parallelität.
 */
(function installPlanCheckCooperativeSearch(globalScope) {
  const base = globalScope.PlannerPlanCheckSolutions;
  if (!base || globalScope.__planCheckCooperativeSearchInstalled) return;
  globalScope.__planCheckCooperativeSearchInstalled = true;

  const MEAL_ORDER = Object.freeze({ breakfast: 0, lunch: 1, snack: 2, dinner: 3 });
  const PROJECTED = "projected_covered_goal";
  const PRESERVED_CODES = new Set([
    "ALLERGEN_MAINTENANCE_PROJECTED",
    base.INTRO_PROJECTED_CODE || "ALLERGEN_INTRODUCTION_PROJECTED",
  ]);

  function cloneValue(value) {
    if (typeof clone === "function") return clone(value);
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function slotKey(date, meal) {
    return `${date}|${meal}`;
  }

  function slotProtected(date, meal, shownMeal = null) {
    const key = slotKey(date, meal);
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

  function goalFoodCanUseSlot(item, slot) {
    const goalIds = new Set(item?.refs?.foodIds || []);
    if (!goalIds.size) return true;
    const records = (state.foods || []).filter((record) =>
      record?.active && goalIds.has(record.id));
    if (!records.length) return false;

    return records.some((record) => {
      if (typeof plannerAutomaticFoodMealEligible === "function") {
        return plannerAutomaticFoodMealEligible(
          record,
          slot.meal,
          slot.date,
          state.settings || {},
          typeof automaticFoodEligibility === "function"
            ? automaticFoodEligibility
            : null,
        );
      }
      if (typeof plannerFoodMealEligible === "function") {
        return plannerFoodMealEligible(record, slot.meal);
      }
      return true;
    });
  }

  function scopedDaysForSlot(days, target) {
    return cloneValue(days).map((day) => ({
      ...day,
      meals: (day.meals || []).map((meal) => {
        if (day.date === target.date && meal.meal === target.meal) return meal;
        return { ...meal, active: false };
      }),
    }));
  }

  function freezeOtherVisibleMeals(days, targetKey) {
    const current = typeof today === "function" ? today() : "";
    state.planLocks ||= {};
    state.manualMeals ||= {};
    state.overrides ||= {};
    state.autoLockExcluded ||= {};

    for (const day of days || []) {
      if (day.date < current) continue;
      for (const meal of day.meals || []) {
        if (!meal?.active || meal.empty || !meal.focusId) continue;
        if (typeof mealIsCompleted === "function" && mealIsCompleted(day.date, meal.meal)) continue;
        const key = slotKey(day.date, meal.meal);
        if (key === targetKey || state.manualMeals[key] || state.planLocks[key]) continue;
        if (typeof mealSnapshot !== "function") continue;
        const frozen = mealSnapshot(day.date, meal.meal, meal, "auto");
        if (frozen) state.planLocks[key] = frozen;
      }
    }
  }

  function rebuiltVisibleDays(originalDays = []) {
    if (!originalDays.length) return [];
    const current = typeof today === "function" ? today() : originalDays[0].date;
    const historical = originalDays.filter((day) => day.date < current).map(cloneValue);
    const future = originalDays.filter((day) => day.date >= current);
    if (!future.length) return historical;
    const generated = typeof buildDays === "function"
      ? buildDays(future[0].date, future.length, false)
      : [];
    return [...historical, ...generated];
  }

  function projectedKeys(report) {
    return new Set((report?.items || [])
      .filter((item) => item.type === PROJECTED && PRESERVED_CODES.has(item.code))
      .map((item) => base.goalKey(item))
      .filter(Boolean));
  }

  function goalCovered(report, item) {
    const key = base.goalKey(item);
    const related = (report?.items || []).filter((candidate) => base.goalKey(candidate) === key);
    return related.some((candidate) => candidate.type === PROJECTED) ||
      !related.some((candidate) => candidate.type === "open_goal");
  }

  function withIsolatedState(callback) {
    const original = state;
    state = cloneValue(state);
    try {
      return callback();
    } finally {
      state = original;
    }
  }

  function candidateRemainsValid(candidate, item, days, baselineProjectedKeys) {
    if (!candidate) return false;
    return withIsolatedState(() => {
      if (!base.applySolution(candidate)) return false;
      const proposedDays = rebuiltVisibleDays(days);
      const proposedReport = base.report(proposedDays);
      if ((proposedReport.items || []).some((entry) => entry.type === "hard_blocker")) return false;
      if (!goalCovered(proposedReport, item)) return false;
      const afterProjected = projectedKeys(proposedReport);
      return [...baselineProjectedKeys].every((key) => afterProjected.has(key));
    });
  }

  function defaultYieldControl() {
    if (typeof globalScope.scheduler?.yield === "function") return globalScope.scheduler.yield();
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function findSolutionAsync(item, days = [], options = {}) {
    const rejected = new Set(options.rejectedSolutionIds || []);
    const shouldContinue = typeof options.shouldContinue === "function"
      ? options.shouldContinue
      : () => true;
    const yieldControl = typeof options.yieldControl === "function"
      ? options.yieldControl
      : defaultYieldControl;
    const baselineProjectedKeys = projectedKeys(base.report(days));

    for (const slot of candidateSlots(days)) {
      if (!shouldContinue()) return null;
      if (!goalFoodCanUseSlot(item, slot)) continue;
      await yieldControl();
      if (!shouldContinue()) return null;

      const targetKey = slotKey(slot.date, slot.meal);
      const scopedDays = scopedDaysForSlot(days, slot);
      while (shouldContinue()) {
        const candidate = withIsolatedState(() => {
          freezeOtherVisibleMeals(days, targetKey);
          return base.findSolution(item, scopedDays, {
            rejectedSolutionIds: [...rejected],
          });
        });
        if (!candidate) break;
        if (candidateRemainsValid(candidate, item, days, baselineProjectedKeys)) return candidate;
        rejected.add(candidate.id);
        await yieldControl();
      }
    }
    return null;
  }

  globalScope.PlannerPlanCheckSolutions = Object.freeze({
    ...base,
    findSolutionAsync,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
