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

  function primarySlotCompletion(data, core, date, meal) {
    if (!core) return null;
    let primary = core.primaryPlanInstances(data).find((plan) => plan.date === date && plan.meal === meal) || null;
    return primary ? core.linkedCompletionLog(data, primary.planId, date, meal) : null;
  }

  const API = Object.freeze({ materializeVisibleFuturePlans, primarySlotCompletion });
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let coreForSlot = () => globalScope.__plannerLogRolloverCore;
  completedLog = function concretePrimaryCompletedLog(date, meal) {
    return primarySlotCompletion(state, coreForSlot(), date, meal);
  };
  mealIsCompleted = function concretePrimaryMealIsCompleted(date, meal) {
    return !!primarySlotCompletion(state, coreForSlot(), date, meal);
  };

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

  // Die gemeinsame Kartenpräsentation wird zuerst installiert. Die nachfolgende
  // Rollover-Review-Schicht bindet dadurch ihre bestehende „Auf morgen“-Semantik
  // an die bereits vereinheitlichten Today-/Plan-Buttons statt an veraltetes DOM.
  const mealCardSrc = "js/meal-card-unification.js?v=10.1.26";
  if (document.readyState === "loading") {
    document.write(`<script src="${mealCardSrc}"></scr` + `ipt>`);
  } else {
    let script = document.createElement("script");
    script.src = mealCardSrc;
    script.async = false;
    document.head.appendChild(script);
  }

  // Die Review-Fixes müssen weiterhin vor app.js und vor dem Tauschen-Dekorator
  // laufen, damit bestehende Planner-/Rollover-Semantik unverändert bleibt.
  const reviewFixSrc = "js/planner-log-rollover-review-fixes.js?v=10.1.26";
  if (document.readyState === "loading") {
    document.write(`<script src="${reviewFixSrc}"></scr` + `ipt>`);
  } else {
    let script = document.createElement("script");
    script.src = reviewFixSrc;
    script.async = false;
    document.head.appendChild(script);
  }

  // Tauschen kommt zuletzt: Es erweitert denselben renderMealCore-Pfad, den
  // sowohl der Wochenplan als auch „Heute“ bereits gemeinsam verwenden.
  const randomSwapSrc = "js/planner-random-swap.js?v=10.1.26";
  if (document.readyState === "loading") {
    document.write(`<script src="${randomSwapSrc}"></scr` + `ipt>`);
  } else {
    let script = document.createElement("script");
    script.src = randomSwapSrc;
    script.async = false;
    document.head.appendChild(script);
  }

  // „Zutat fehlt“ baut bewusst auf dem bereits installierten Tauschen-/Kartenpfad
  // auf und kommt deshalb unmittelbar danach. So bleibt die bestehende Planner-
  // Semantik unangetastet und die neue Aktion ergänzt nur die Verfügbarkeit.
  const missingIngredientSrc = "js/planner-missing-ingredient.js?v=10.1.26";
  if (document.readyState === "loading") {
    document.write(`<script src="${missingIngredientSrc}"></scr` + `ipt>`);
  } else {
    let script = document.createElement("script");
    script.src = missingIngredientSrc;
    script.async = false;
    document.head.appendChild(script);
  }

  // Der Core-Fokuspfad kennt fehlende Lebensmittel bereits. knownBase ist jedoch
  // ein eigener Hauptbasis-Picker und muss dieselbe Verfügbarkeit explizit erben,
  // damit eine eben als fehlend markierte Zutat nicht sofort wieder eingeplant wird.
  function installUnavailableKnownBaseGuard() {
    if (typeof knownBase !== "function" || knownBase.__missingIngredientAvailabilityAware) return;
    const originalKnownBase = knownBase;
    const wrappedKnownBase = function missingIngredientAwareKnownBase(meal, exclude = []) {
      const blocked = new Set(exclude || []);
      if (typeof isFoodUnavailable === "function") {
        const foods = typeof state !== "undefined" ? state?.foods || [] : [];
        for (const item of foods) {
          if (item?.id && isFoodUnavailable(item.id)) blocked.add(item.id);
        }
      }
      return originalKnownBase(meal, [...blocked]);
    };
    wrappedKnownBase.__missingIngredientAvailabilityAware = true;
    knownBase = wrappedKnownBase;
  }

  // app.js und nachgelagerte Planner-Schichten ersetzen einzelne Planner-Funktionen
  // noch während des Parserlaufs. Nach Abschluss aller synchronen Skripte werden
  // deshalb die Availability-Wrapper genau einmal auf die endgültige Runtime gelegt.
  const finalizeMissingIngredientPolicies = () => {
    globalScope.__plannerMissingIngredient?.installAvailabilityPolicies?.();
    installUnavailableKnownBaseGuard();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", finalizeMissingIngredientPolicies, { once: true });
  } else {
    setTimeout(finalizeMissingIngredientPolicies, 0);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
