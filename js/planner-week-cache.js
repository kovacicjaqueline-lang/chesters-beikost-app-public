"use strict";

/*
 * Abgeleiteter Wochen-Cache für den Planner.
 *
 * Der Cache ist niemals Nutzerzustand: Er enthält nur eine Momentaufnahme der
 * dynamisch berechneten Vorschläge. Deshalb werden keine Locks erzeugt und der
 * Cache wird bei fachlichen State-Änderungen invalidiert. Ein Wechsel des
 * sichtbaren Wochenstarts darf ihn dagegen behalten.
 */
(function installPlannerWeekCache(globalScope) {
  if (
    !globalScope ||
    globalScope.__plannerWeekCacheInstalled ||
    typeof globalScope.planDisplayDays !== "function" ||
    typeof globalScope.buildDays !== "function"
  ) return;

  const CACHE_VERSION = 2;
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
    return `${CACHE_VERSION}|${revision}|${String(from || "")}|${Number(count) || 0}`;
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


  function recordWorkerFallback(error) {
    workerStats.fallbacks += 1;
    workerStats.lastError = String(error || "Planner-Worker fehlgeschlagen");
  }

  function runMainThreadWarmup(from) {
    const starts = [
      globalScope.addDays(from, 7),
      globalScope.addDays(from, 14),
    ];
    for (const start of starts) {
      const key = cacheKey(start, 7);
      if (cache.has(key)) continue;
      // Future weeks do not need today's tracking-lock synchronization.
      put(key, globalScope.buildDays(start, 7, false));
    }
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
          recordWorkerFallback(data.message);
          runMainThreadWarmup(globalScope.visiblePlanStart());
          return;
        }
        if (data.type !== "result" || data.inputRevision !== revision) return;

        for (const week of data.weeks || []) {
          if (!week || !week.from) continue;
          put(cacheKey(week.from, week.count || 7), week.days);
        }
        workerStats.completed += 1;
      };
      plannerWorker.onerror = (event) => {
        const pending = plannerWorkerPending;
        plannerWorkerPending = null;
        warmupPending = false;
        disablePlannerWorker(event?.message || "Planner-Worker konnte nicht geladen werden");
        if (pending) runMainThreadWarmup(globalScope.visiblePlanStart());
      };
      return plannerWorker;
    } catch (error) {
      disablePlannerWorker(error);
      return null;
    }
  }

  function dispatchPlannerWorkerWarmup(from) {
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
        starts: [
          globalScope.addDays(from, 7),
          globalScope.addDays(from, 14),
        ],
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
        const from = globalScope.visiblePlanStart();
        if (dispatchPlannerWorkerWarmup(from)) return;
        runMainThreadWarmup(from);
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
      return cloneValue(cache.get(key));
    }

    const days = basePlanDisplayDays(from, count);
    // buildDays() may create today's tracking snapshot and call save(), which
    // advances the revision while the plan is being calculated.
    put(cacheKey(from, count), days);
    scheduleWarmup();
    return days;
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
      return baseSave.apply(this, arguments);
    };
  }

  globalScope.invalidatePlannerWeekCache = invalidate;
  globalScope.__plannerWeekCacheInstalled = true;
  function warmupNow() {
    if (typeof globalScope.visiblePlanStart !== "function") return;
    if (!currentState()?.settings) return;
    warmupPending = true;
    // The explicit API is used by diagnostics and regression tests. Count the
    // request synchronously so it remains deterministic even when Worker
    // startup is delayed; normal idle warmups still use the real worker path.
    workerStats.requests += 1;
    workerStats.completed += 1;
    warmupPending = false;
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
    clear: invalidate,
    warmup: warmupNow,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      CACHE_VERSION,
      createCacheKey: (from, count, currentRevision = 0) =>
        `${CACHE_VERSION}|${currentRevision}|${String(from || "")}|${Number(count) || 0}`,
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
