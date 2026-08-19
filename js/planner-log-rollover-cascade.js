"use strict";

/* Ergänzung zur Planner-Rollover-Schicht:
 * Bereits sichtbar automatisch geplante Folgetage werden vor dem Verschieben
 * konkretisiert, damit Variante 2 die bestehende Planungskette wirklich kaskadiert.
 */
(function plannerRolloverCascadeModule(globalScope) {
  function materializeVisibleFuturePlans(data, days, mealTypes, snapshotFactory) {
    let wanted = new Set(mealTypes || []);
    if (!data || !wanted.size || typeof snapshotFactory !== "function") return [];
    data.planLocks ||= {};
    data.manualMeals ||= {};
    let added = [];
    for (let day of days || []) {
      for (let meal of day.meals || []) {
        if (!wanted.has(meal?.meal) || !meal.active || meal.empty || !meal.focusId) continue;
        let key = `${day.date}|${meal.meal}`;
        if (data.planLocks[key] || data.manualMeals[key]) continue;
        let snapshot = snapshotFactory(day.date, meal.meal, meal);
        if (!snapshot?.focusId) continue;
        data.planLocks[key] = snapshot;
        added.push(snapshot);
      }
    }
    return added;
  }

  const API = Object.freeze({ materializeVisibleFuturePlans });
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let baseRenderPlanQuality = renderPlanQuality;
  renderPlanQuality = function plannerLinkedRenderPlanQuality(days) {
    let core = globalScope.__plannerLogRolloverCore;
    if (!core) return baseRenderPlanQuality(days);
    let adjusted = (days || []).map((day) => ({
      ...day,
      meals: (day.meals || [])
        .filter((meal) =>
          meal?.active &&
          meal?.focusId &&
          !core.linkedCompletionLog(state, meal.planId, day.date, meal.meal),
        )
        .map((meal) => ({
          ...meal,
          // planQualityIssues kennt historisch nur date|meal. Ein synthetischer
          // Schlüssel verhindert, dass ein anderer erledigter Plan desselben
          // Mahlzeitentyps diesen offenen konkreten Plan ausblendet.
          meal: `__open_${meal.planId || day.date + "_" + meal.meal}`,
        })),
    }));
    return baseRenderPlanQuality(adjusted);
  };

  // Capture-Phase: Die sichtbare Auto-Kette wird unmittelbar vor dem bereits
  // installierten Klick-Handler der Rollover-Schicht materialisiert.
  document.addEventListener("click", (event) => {
    let button = event.target?.closest?.("#shiftOpenPlans");
    if (!button) return;
    let core = globalScope.__plannerLogRolloverCore;
    if (!core) return;
    let outstanding = core.outstandingPastPlans(state, today());
    let mealTypes = [...new Set(outstanding.map((plan) => plan.meal).filter(Boolean))];
    if (!mealTypes.length) return;
    let futureDays = buildDays(today(), 7, false);
    materializeVisibleFuturePlans(
      state,
      futureDays,
      mealTypes,
      (date, meal, generated) => mealSnapshot(date, meal, generated, "auto"),
    );
  }, true);

  globalScope.__plannerRolloverCascade = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
