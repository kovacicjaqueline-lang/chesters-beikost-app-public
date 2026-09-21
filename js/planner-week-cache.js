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

  const CACHE_VERSION = 1;
  const cache = new Map();
  let revision = 0;
  let warmupPending = false;
  let warmupHandle = null;

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
      } finally {
        warmupPending = false;
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
      if (!preserveForNavigation(options)) invalidate("save");
      return baseSave.apply(this, arguments);
    };
  }

  globalScope.invalidatePlannerWeekCache = invalidate;
  globalScope.__plannerWeekCacheInstalled = true;
  globalScope.__plannerWeekCache = {
    get revision() { return revision; },
    get size() { return cache.size; },
    clear: invalidate,
    warmup: scheduleWarmup,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      CACHE_VERSION,
      createCacheKey: (from, count, currentRevision = 0) =>
        `${CACHE_VERSION}|${currentRevision}|${String(from || "")}|${Number(count) || 0}`,
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
