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

/*
 * Mahlzeiten bleiben nur dann bewusst fest, wenn die Nutzerin sie manuell hinzugefügt,
 * bearbeitet oder mit dem Schloss behalten hat. Die historische pauschale Drei-Tage-
 * Fixierung wird nicht mehr neu erzeugt. Follow-ups und explizite Random-Swap-Snapshots
 * behalten ihre bestehende Sondersemantik.
 */
(function installExplicitMealKeepPolicy(globalScope) {
  const RANDOM_SWAP_FLAGS = Object.freeze([
    "randomSwapPinned",
    "randomSwapPreserved",
    "randomSwapTarget",
  ]);

  function isLegacyThreeDayAutoLock(lock) {
    return !!lock &&
      lock.mode === "auto" &&
      !lock.followUpFoodId &&
      !RANDOM_SWAP_FLAGS.some((flag) => !!lock[flag]);
  }

  function cleanupLegacyThreeDayAutoLocks(currentState, currentDate, addDaysFn) {
    if (!currentState?.planLocks || !currentDate || typeof addDaysFn !== "function") return 0;
    const until = addDaysFn(currentDate, 2);
    let removed = 0;
    for (const [key, lock] of Object.entries(currentState.planLocks)) {
      const date = String(key || "").split("|")[0];
      if (date < currentDate || date > until || !isLegacyThreeDayAutoLock(lock)) continue;
      delete currentState.planLocks[key];
      if (currentState.overrides?.[key] === lock.focusId) delete currentState.overrides[key];
      delete currentState.autoLockExcluded?.[key];
      removed += 1;
    }
    return removed;
  }

  const policy = Object.freeze({
    RANDOM_SWAP_FLAGS,
    isLegacyThreeDayAutoLock,
    cleanupLegacyThreeDayAutoLocks,
  });
  globalScope.PlannerKeepPolicy = policy;
  if (typeof module !== "undefined" && module.exports) module.exports = policy;

  if (typeof document === "undefined" || typeof state === "undefined" || !state || globalScope.__plannerKeepPolicyInstalled) return;
  globalScope.__plannerKeepPolicyInstalled = true;

  const originalRebuildVisiblePlan = typeof rebuildVisiblePlan === "function" ? rebuildVisiblePlan : null;
  const originalRenderPlan = typeof renderPlan === "function" ? renderPlan : null;

  globalScope.isAutoLockDate = () => false;
  globalScope.ensureAutoLocks = () => false;

  if (originalRebuildVisiblePlan) {
    globalScope.rebuildVisiblePlan = function rebuildVisiblePlanKeepingUserChoices() {
      return originalRebuildVisiblePlan(false);
    };
  }

  globalScope.openFullPlanRebuild = function openSimplifiedPlanRebuild() {
    if (typeof openGeneric !== "function") return;
    const from = state.settings?.planFrom || (typeof today === "function" ? today() : "");
    const until = from && typeof addDays === "function" ? addDays(from, 6) : "";
    const range = from && until && typeof nice === "function"
      ? `<p>Neu erstellt wird der Zeitraum <b>${nice(from, true)} bis ${nice(until, true)}</b>.</p>`
      : "";
    openGeneric(
      "Woche neu planen",
      `${range}<div class="notice olive"><b>Bleibt erhalten:</b> protokollierte Mahlzeiten, manuell hinzugefügte oder bearbeitete Mahlzeiten, bewusst behaltene Mahlzeiten und Wiedervorlagen.</div><div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelPlanRebuild" type="button">Abbrechen</button><button class="btn" id="confirmPlanRebuild" type="button">Woche neu planen</button></div>`,
    );
    const cancel = document.getElementById("cancelPlanRebuild");
    const confirm = document.getElementById("confirmPlanRebuild");
    if (cancel) cancel.onclick = typeof closeGeneric === "function" ? closeGeneric : null;
    if (confirm) confirm.onclick = () => {
      if (typeof closeGeneric === "function") closeGeneric();
      if (typeof rebuildVisiblePlan === "function") rebuildVisiblePlan();
      if (typeof showToast === "function") showToast("Woche neu geplant; deine bewusst festgelegten Mahlzeiten bleiben erhalten.");
    };
  };

  function enhanceKeepLabels() {
    document.querySelectorAll?.(".meal-lock").forEach((button) => {
      const date = button.dataset?.lockDate || "";
      const meal = button.dataset?.lockMeal || "";
      const key = date && meal ? `${date}|${meal}` : "";
      const lock = key ? state.planLocks?.[key] : null;
      const label = button.closest?.(".mealbox")?.querySelector?.(".lock-label");
      if (lock?.mode === "manual") {
        button.setAttribute("aria-label", "Mahlzeit bei automatischer Neuplanung wieder freigeben");
        button.setAttribute("title", "Behalten");
        if (label) label.textContent = "Behalten";
      } else if (!lock) {
        button.setAttribute("aria-label", "Mahlzeit bei automatischer Neuplanung behalten");
        button.setAttribute("title", "Behalten");
      }
    });
    const rebuild = document.getElementById("planRebuildAll");
    if (rebuild) rebuild.textContent = "Woche neu planen";
  }

  if (originalRenderPlan) {
    globalScope.renderPlan = function renderPlanWithKeepLabels() {
      const result = originalRenderPlan.apply(this, arguments);
      enhanceKeepLabels();
      return result;
    };
  }

  const removed = cleanupLegacyThreeDayAutoLocks(
    state,
    typeof today === "function" ? today() : "",
    typeof addDays === "function" ? addDays : null,
  );
  if (state.autoLockExcluded && Object.keys(state.autoLockExcluded).length) state.autoLockExcluded = {};

  if (removed > 0) {
    if (typeof save === "function") save();
    if (typeof renderAll === "function") renderAll();
  } else {
    enhanceKeepLabels();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
