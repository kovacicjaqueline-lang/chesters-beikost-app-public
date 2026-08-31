"use strict";

/*
 * Sequenzielle Plan-Checks-Lösungen dürfen kein bereits projected-covered Ziel
 * wieder aufreißen. Die Prüfung bleibt in der Domain-/Planner-Schicht: Kandidaten
 * werden auf einer temporären State-Kopie angewendet, der sichtbare Zukunftsplan
 * wird mit dem echten Planner neu gebaut und erneut über den strukturierten Report
 * geprüft. Die UI kennt diese Ausschlusslogik nicht.
 */
(function preserveCoveredPlanCheckGoals(globalScope) {
  const base = globalScope.PlannerPlanCheckSolutions;
  if (!base || globalScope.__planChecksSolutionPreservationInstalled) return;
  globalScope.__planChecksSolutionPreservationInstalled = true;

  const PROJECTED = "projected_covered_goal";
  const PRESERVED_CODES = new Set([
    "ALLERGEN_MAINTENANCE_PROJECTED",
    base.INTRO_PROJECTED_CODE || "ALLERGEN_INTRODUCTION_PROJECTED",
  ]);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function projectedKeys(report) {
    return new Set((report?.items || [])
      .filter((item) => item.type === PROJECTED && PRESERVED_CODES.has(item.code))
      .map((item) => base.goalKey(item))
      .filter(Boolean));
  }

  function rebuiltVisibleDays(originalDays = []) {
    if (!originalDays.length) return [];
    const current = typeof today === "function" ? today() : originalDays[0].date;
    const historical = originalDays.filter((day) => day.date < current).map(clone);
    const future = originalDays.filter((day) => day.date >= current);
    if (!future.length) return historical;
    const generated = typeof buildDays === "function"
      ? buildDays(future[0].date, future.length, false)
      : [];
    return [...historical, ...generated];
  }

  function candidatePreservesCoveredGoals(candidate, days, baselineKeys) {
    if (!candidate || !baselineKeys.size) return true;
    const originalState = state;
    state = clone(state);
    try {
      if (!base.applySolution(candidate)) return false;
      const proposedDays = rebuiltVisibleDays(days);
      const proposed = base.report(proposedDays);
      const afterKeys = projectedKeys(proposed);
      return [...baselineKeys].every((key) => afterKeys.has(key));
    } finally {
      state = originalState;
    }
  }

  function findSolution(item, days = [], options = {}) {
    const baselineKeys = projectedKeys(base.report(days));
    const rejected = new Set(options.rejectedSolutionIds || []);
    const maxAttempts = Math.max(20, (days || []).length * 32);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = base.findSolution(item, days, {
        ...options,
        rejectedSolutionIds: [...rejected],
      });
      if (!candidate) return null;
      if (candidatePreservesCoveredGoals(candidate, days, baselineKeys)) return candidate;
      rejected.add(candidate.id);
    }
    return null;
  }

  globalScope.PlannerPlanCheckSolutions = Object.freeze({
    ...base,
    findSolution,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
