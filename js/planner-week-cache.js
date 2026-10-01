"use strict";

/*
 * Abgeleiteter Wochen-Cache für den Planner.
 *
 * Der Cache ist niemals Nutzerzustand: Er enthält nur eine Momentaufnahme der
 * dynamisch berechneten Vorschläge. Deshalb werden keine Locks erzeugt.
 * Fachliche Planänderungen invalidieren den Cache; Vorratsänderungen behalten
 * die Mahlzeitenauswahl und aktualisieren nur abgeleitete Reservierungen.
 */
(function installPlannerWeekCache(globalScope) {
  if (
    !globalScope ||
    globalScope.__plannerWeekCacheInstalled ||
    typeof globalScope.planDisplayDays !== "function" ||
    typeof globalScope.buildDays !== "function"
  ) return;

  const CACHE_VERSION = 3;
  const cache = new Map();
  let revision = 0;
  let warmupPending = false;
  let warmupHandle = null;
  let plannerWorker = null;
  let plannerWorkerDisabled = false;
  let plannerWorkerRequest = 0;
  let plannerWorkerPending = null;
  const workerStats = {
    supported: false,
    requests: 0,
    completed: 0,
    fallbacks: 0,
    lastError: "",
  };

  function currentState() {
    try {
      return typeof state !== "undefined" ? state : null;
    } catch (_) {
      return null;
    }
  }

  function cloneValue(value) {
    if (typeof globalScope.clone === "function") return globalScope.clone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function cacheKey(from, count) {
    const phase = String(currentState()?.settings?.phaseSelected || "");
    return `${CACHE_VERSION}|${revision}|${phase}|${String(from || "")}|${Number(count) || 0}`;
  }

  function invalidate(reason = "state-change") {
    revision += 1;
    cache.clear();
    warmupPending = false;
    // A response for an older revision is ignored. The worker itself stays
    // alive so a later idle warmup can reuse it.
    plannerWorkerPending = null;
    if (warmupHandle !== null && typeof globalScope.cancelIdleCallback === "function") {
      globalScope.cancelIdleCallback(warmupHandle);
    } else if (warmupHandle !== null && typeof globalScope.clearTimeout === "function") {
      globalScope.clearTimeout(warmupHandle);
    }
    warmupHandle = null;
    globalScope.__plannerWeekCacheLastInvalidation = reason;
  }

  function preserveForNavigation(options) {
    return !!options && typeof options === "object" && options.preservePlanCache === true;
  }

  function put(key, days) {
    const snapshot = cloneValue(days || []);
    cache.set(key, snapshot);
    return cloneValue(snapshot);
  }

  function refreshInventoryReservations(days) {
    if (typeof globalScope.reserveMealInventory !== "function") return days;
    const refreshedDays = (days || []).map((day) => ({
      ...day,
      meals: (day.meals || []).map((meal) => ({ ...meal })),
    }));
    const context = {
      inventoryReserved: new Map(),
      recipeReserved: new Map(),
    };
    for (const day of refreshedDays) {
      for (const meal of day.meals || []) {
        if (meal?.active && !meal.empty) {
          const recipeName = meal.recipeName;
          if (
            recipeName &&
            typeof globalScope.recipeInventoryPortions === "function"
          ) {
            const available = globalScope.recipeInventoryPortions(recipeName);
            const reserved = context.recipeReserved.get(recipeName) || 0;
            if (reserved >= available) {
              meal.recipeInventoryId = "";
              if (meal.compositionMode !== "recipe-plus-food") {
                meal.inventoryFoodIds = [];
                continue;
              }
            } else if (!meal.recipeInventoryId && typeof globalScope.oldestRecipeBatch === "function") {
              meal.recipeInventoryId = globalScope.oldestRecipeBatch(recipeName)?.id || "";
            }
          }
          globalScope.reserveMealInventory(meal, context);
        }
      }
    }
    return refreshedDays;
  }


  function recordWorkerFallback(error) {
    workerStats.fallbacks += 1;
    workerStats.lastError = String(error || "Planner-Worker fehlgeschlagen");
  }

  function missingWarmupWeeks(from) {
    return [
      from,
      globalScope.addDays(from, 7),
      globalScope.addDays(from, 14),
    ].filter((start) => !cache.has(cacheKey(start, 7)));
  }

  function disablePlannerWorker(error) {
    plannerWorkerDisabled = true;
    workerStats.supported = false;
    recordWorkerFallback(error);
    if (plannerWorker) {
      plannerWorker.onmessage = null;
      plannerWorker.onerror = null;
    }
    plannerWorker = null;
    plannerWorkerPending = null;
    warmupPending = false;
  }

  function ensurePlannerWorker() {
    if (plannerWorkerDisabled || plannerWorker) return plannerWorker;
    if (typeof globalScope.Worker !== "function") return null;

    const baseUrl = globalScope.document?.baseURI || globalScope.location?.href;
    if (!baseUrl || typeof globalScope.URL !== "function") return null;

    try {
      const workerUrl = new globalScope.URL(
        "js/planner-week-worker.js?v=10.1.26",
        baseUrl,
      );
      plannerWorker = new globalScope.Worker(workerUrl);
      workerStats.supported = true;
      plannerWorker.onmessage = (event) => {
        const data = event?.data || {};
        const pending = plannerWorkerPending;
        if (!pending || data.requestId !== pending.requestId) return;

        plannerWorkerPending = null;
        warmupPending = false;

        if (data.type === "error") {
          disablePlannerWorker(data.message);
          return;
        }
        if (data.type !== "result" || data.inputRevision !== revision) return;

        for (const week of data.weeks || []) {
          if (!week || !week.from) continue;
          put(cacheKey(week.from, week.count || 7), week.days);
        }
        workerStats.completed += 1;
        // The user may have moved while this request was running. Continue
        // warming from the currently visible week so that navigation does
        // not fall back to a synchronous plan build on the main thread.
        scheduleWarmup();
      };
      plannerWorker.onerror = (event) => {
        plannerWorkerPending = null;
        warmupPending = false;
        disablePlannerWorker(event?.message || "Planner-Worker konnte nicht geladen werden");
      };
      return plannerWorker;
    } catch (error) {
      disablePlannerWorker(error);
      return null;
    }
  }

  function dispatchPlannerWorkerWarmup(starts) {
    const worker = ensurePlannerWorker();
    if (!worker) return false;
    if (plannerWorkerPending) return true;

    const requestId = ++plannerWorkerRequest;
    plannerWorkerPending = { requestId, inputRevision: revision };
    workerStats.requests += 1;
    try {
      worker.postMessage({
        type: "build",
        requestId,
        inputRevision: revision,
        starts,
        state: currentState(),
      });
      return true;
    } catch (error) {
      plannerWorkerPending = null;
      disablePlannerWorker(error);
      return false;
    }
  }

  function scheduleWarmup() {
    if (warmupPending || typeof globalScope.visiblePlanStart !== "function") return;
    if (!currentState()?.settings) return;
    warmupPending = true;

    const run = (deadline) => {
      warmupHandle = null;
      if (deadline?.didTimeout !== true && deadline?.timeRemaining && deadline.timeRemaining() < 4) {
        warmupPending = false;
        scheduleWarmup();
        return;
      }
      if (globalScope.navigator?.scheduling?.isInputPending?.()) {
        warmupPending = false;
        scheduleWarmup();
        return;
      }

      try {
        // Warm the currently visible week first: the Plan tab is otherwise
        // empty on startup and its first render would synchronously build this
        // week after the tab has already become visible. Keep this work in the
        // Worker; when Workers are unavailable, the week is built on demand.
        const from = globalScope.visiblePlanStart();
        const starts = missingWarmupWeeks(from);
        if (!starts.length) return;
        dispatchPlannerWorkerWarmup(starts);
      } finally {
        if (!plannerWorkerPending) warmupPending = false;
      }
    };

    if (typeof globalScope.requestIdleCallback === "function") {
      warmupHandle = globalScope.requestIdleCallback(run, { timeout: 1800 });
    } else {
      warmupHandle = globalScope.setTimeout(() => run({}), 1200);
    }
  }

  const basePlanDisplayDays = globalScope.planDisplayDays;
  globalScope.planDisplayDays = function plannerCachedPlanDisplayDays(from, count = 7) {
    if (!currentState()?.settings) {
      return basePlanDisplayDays(from, count);
    }

    const key = cacheKey(from, count);
    if (cache.has(key)) {
      scheduleWarmup();
      return refreshInventoryReservations(cloneValue(cache.get(key)));
    }

    const days = basePlanDisplayDays(from, count);
    // buildDays() may create today's tracking snapshot and call save(), which
    // advances the revision while the plan is being calculated.
    put(cacheKey(from, count), days);
    scheduleWarmup();
    return refreshInventoryReservations(days);
  };

  const baseSave = typeof globalScope.save === "function" ? globalScope.save : null;
  if (baseSave) {
    globalScope.save = function plannerCacheAwareSave(options = {}) {
      if (!preserveForNavigation(options)) {
        invalidate("save");
        if (typeof globalScope.invalidateDayPlanRuntimeCache === "function") {
          globalScope.invalidateDayPlanRuntimeCache();
        }
      }
      const result = baseSave.apply(this, arguments);
      if (!preserveForNavigation(options)) scheduleWarmup();
      return result;
    };
  }

  globalScope.invalidatePlannerWeekCache = invalidate;
  globalScope.__plannerWeekCacheInstalled = true;
  function warmupNow() {
    scheduleWarmup();
  }

  globalScope.__plannerWeekCache = {
    get revision() { return revision; },
    get size() { return cache.size; },
    get workerAvailable() {
      return !!plannerWorker && !plannerWorkerDisabled;
    },
    workerStats() {
      return { ...workerStats };
    },
    has(from, count = 7) {
      return cache.has(cacheKey(from, count));
    },
    readOnly(from, count = 7) {
      const key = cacheKey(from, count);
      if (!cache.has(key)) return null;
      scheduleWarmup();
      // Prep needs current inventory reservations but must not mutate the
      // cached meal selection. Shallow-copy only days and meals for the overlay.
      return refreshInventoryReservations(cache.get(key));
    },
    clear: invalidate,
    warmup: warmupNow,
  };

  // App state is installed before planner policies finish loading. Once the
  // complete policy chain is ready, proactively build the current visible
  // week so a later tab tap can reuse it without a main-thread planner pass.
  const plannerReady = globalScope.PlannerReadiness?.whenReady?.();
  if (plannerReady && typeof plannerReady.then === "function") {
    plannerReady.then((result) => {
      if (!result || result.state === "ready") scheduleWarmup();
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      CACHE_VERSION,
      createCacheKey: (from, count, currentRevision = 0) =>
        `${CACHE_VERSION}|${currentRevision}|${String(from || "")}|${Number(count) || 0}`,
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
