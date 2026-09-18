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

  const NON_PLANNER_SETTING_KEYS = new Set([
    "phaseReadinessSignalsByPhase",
    "planCheckEvaluationRevision",
    "targetFoods",
    "textureStageSince",
  ]);

  function dayPlanRuntimePlannerInput(data) {
    let settings = Object.fromEntries(
      Object.entries(data?.settings || {}).filter(([key]) => !NON_PLANNER_SETTING_KEYS.has(key)),
    );
    return {
      settings,
      foods: data?.foods || [],
      logs: data?.logs || [],
      inventory: data?.inventory || [],
      overrides: data?.overrides || {},
      deferred: data?.deferred || {},
      pantry: data?.pantry || {},
      planLocks: data?.planLocks || {},
      autoLockExcluded: data?.autoLockExcluded || {},
      manualMeals: data?.manualMeals || {},
      combinationPauses: data?.combinationPauses || {},
      followUps: data?.followUps || {},
      shoppingHints: data?.shoppingHints || {},
      plannerLinking: data?.backupMeta?.plannerLinking || null,
    };
  }

  function createDayPlanRuntimeCache(
    buildDaysFn,
    plannerInputFn = () => null,
    currentDayFn = () => "",
    maxEntries = 64,
  ) {
    if (typeof buildDaysFn !== "function" || typeof plannerInputFn !== "function") return null;
    let cache = new Map();
    let generation = 0;
    let hits = 0;
    let misses = 0;
    let limit = Math.max(1, Number(maxEntries) || 64);

    let keyFor = (from, n = 7, applyAutoLocks = true) =>
      `${generation}|${String(currentDayFn() || "")}|${String(from)}|${Number(n)}|${applyAutoLocks !== false}`;
    let inputSignature = () => JSON.stringify(plannerInputFn());

    let remember = (key, signature, value) => {
      cache.delete(key);
      cache.set(key, { signature, value });
      while (cache.size > limit) cache.delete(cache.keys().next().value);
      return value;
    };

    let invalidate = () => {
      generation += 1;
      cache.clear();
    };

    let cachedBuildDays = function cachedBuildDays(from, n = 7, applyAutoLocks = true) {
      let key = keyFor(from, n, applyAutoLocks);
      let signature = inputSignature();
      let cached = cache.get(key);
      if (cached?.signature === signature) {
        hits += 1;
        // Als einfache LRU halten wir häufige Planbereiche am Ende der Map.
        cache.delete(key);
        cache.set(key, cached);
        return cached.value;
      }
      misses += 1;
      let result = buildDaysFn.call(this, from, n, applyAutoLocks);
      // ensureAutoLocks() kann den Planner-State während der Berechnung verändern.
      // Das finale Ergebnis gehört dann zum finalen Input-Snapshot, nicht zum
      // Zustand vor dem Build. Temporäre Simulationen erhalten dadurch zugleich
      // einen eigenen Input-Snapshot, ohne dass sie save() aufrufen müssen.
      return remember(keyFor(from, n, applyAutoLocks), inputSignature(), result);
    };

    return Object.freeze({
      buildDays: cachedBuildDays,
      invalidate,
      stats: () => ({ generation, hits, misses, entries: cache.size, maxEntries: limit }),
    });
  }

  const API = Object.freeze({
    materializeVisibleFuturePlans,
    primarySlotCompletion,
    dayPlanRuntimePlannerInput,
    createDayPlanRuntimeCache,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  if (!globalScope.__dayPlanRuntimeCache && typeof buildDays === "function") {
    let runtimeCache = createDayPlanRuntimeCache(
      buildDays,
      () => dayPlanRuntimePlannerInput(state),
      () => today(),
    );
    if (runtimeCache) {
      buildDays = runtimeCache.buildDays;
      globalScope.invalidateDayPlanRuntimeCache = runtimeCache.invalidate;
      globalScope.__dayPlanRuntimeCache = runtimeCache;

      let baseClearAutomaticLocks = clearAutomaticLocks;
      clearAutomaticLocks = function cacheAwareClearAutomaticLocks(...args) {
        runtimeCache.invalidate();
        return baseClearAutomaticLocks.apply(this, args);
      };
      let baseRebuildVisiblePlan = rebuildVisiblePlan;
      rebuildVisiblePlan = function cacheAwareRebuildVisiblePlan(...args) {
        runtimeCache.invalidate();
        return baseRebuildVisiblePlan.apply(this, args);
      };
    }
  }

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

  // Die technische „Andere Idee“-Grundlage baut auf den reinen Tauschen-Helfern auf,
  // verändert aber noch keine UI und persistiert selbst keine Alternative.
  const taskAlternativesSrc = "js/planner-task-alternatives.js?v=10.1.26";
  if (document.readyState === "loading") {
    document.write(`<script src="${taskAlternativesSrc}"></scr` + `ipt>`);
  } else {
    let script = document.createElement("script");
    script.src = taskAlternativesSrc;
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

  // app.js und nachgelagerte Planner-Schichten ersetzen einzelne Planner-Funktionen
  // noch während des Parserlaufs. Nach Abschluss aller synchronen Skripte werden
  // deshalb die Availability-Wrapper genau einmal auf die endgültige Runtime gelegt.
  const finalizeMissingIngredientPolicies = () =>
    globalScope.__plannerMissingIngredient?.installAvailabilityPolicies?.();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", finalizeMissingIngredientPolicies, { once: true });
  } else {
    setTimeout(finalizeMissingIngredientPolicies, 0);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
