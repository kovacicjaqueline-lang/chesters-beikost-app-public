"use strict";

/*
 * Entkoppelt interne Planner-Snapshots von der sichtbaren Schutzwirkung.
 * Tracking-Snapshots halten nur Plan-ID/Tageswechsel stabil. Random-Swap-Pins
 * stabilisieren den aktuellen Tauschkontext. Beide sind kein bewusstes „Behalten“
 * und erscheinen deshalb mit offenem Schloss; nur Tracking darf zusätzlich die
 * eigentliche Planner-Auswahl nicht einfrieren.
 */
(function installPlannerKeepTracking(globalScope) {
  const TRACKING_FLAG = "plannerTrackingSnapshot";
  const INTERNAL_PIN_FLAGS = Object.freeze([
    "randomSwapPinned",
    "randomSwapPreserved",
    "randomSwapTarget",
  ]);

  function isTrackingOnly(lock) {
    return !!lock?.[TRACKING_FLAG] && !lock?.rolloverShifted;
  }

  function isInternalPlannerPin(lock) {
    return !!lock &&
      lock.mode === "auto" &&
      !lock.followUpFoodId &&
      !lock.rolloverShifted &&
      INTERNAL_PIN_FLAGS.some((flag) => !!lock[flag]);
  }

  function isInvisibleKeepState(lock) {
    return isTrackingOnly(lock) || isInternalPlannerPin(lock);
  }

  function comparable(record) {
    if (!record) return "";
    const copy = JSON.parse(JSON.stringify(record));
    delete copy.mode;
    delete copy.createdAt;
    delete copy.planId;
    delete copy[TRACKING_FLAG];
    return JSON.stringify(copy);
  }

  function sameTrackingPlan(a, b) {
    return comparable(a) === comparable(b);
  }

  const API = Object.freeze({
    TRACKING_FLAG,
    INTERNAL_PIN_FLAGS,
    isTrackingOnly,
    isInternalPlannerPin,
    isInvisibleKeepState,
    sameTrackingPlan,
  });
  globalScope.PlannerKeepTracking = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof state === "undefined" ||
    !state ||
    globalScope.__plannerKeepTrackingInstalled
  ) return;
  globalScope.__plannerKeepTrackingInstalled = true;

  const baseLockedMeal = typeof lockedMeal === "function" ? lockedMeal : null;
  const baseToggleMealLock = typeof toggleMealLock === "function" ? toggleMealLock : null;
  const baseRenderPlan = typeof renderPlan === "function" ? renderPlan : null;
  const baseRenderHome = typeof renderHome === "function" ? renderHome : null;

  function trackingCompletionExists(date, meal) {
    return typeof mealIsCompleted === "function" && !!mealIsCompleted(date, meal);
  }

  if (baseLockedMeal) {
    globalScope.lockedMeal = function plannerTrackingAwareLockedMeal(date, meal) {
      const lock = state.planLocks?.[`${date}|${meal}`];
      if (isTrackingOnly(lock)) return null;
      return baseLockedMeal(date, meal);
    };
  }

  globalScope.ensureAutoLocks = function syncTodayTrackingSnapshots(days) {
    state.planLocks ||= {};
    state.autoLockExcluded ||= {};
    const current = typeof today === "function" ? today() : "";
    if (!current || typeof mealSnapshot !== "function") return false;

    const desired = new Map();
    for (const day of days || []) {
      if (day?.date !== current) continue;
      for (const meal of day.meals || []) {
        if (
          !meal?.active ||
          meal.empty ||
          !meal.focusId ||
          meal.manualAdded ||
          trackingCompletionExists(day.date, meal.meal)
        ) continue;
        desired.set(`${day.date}|${meal.meal}`, { day, meal });
      }
    }

    let changed = false;
    for (const [key, lock] of Object.entries(state.planLocks)) {
      const [date, meal] = String(key || "").split("|");
      if (!isTrackingOnly(lock) || date < current) continue;
      if (date > current || (!desired.has(key) && !trackingCompletionExists(date, meal))) {
        delete state.planLocks[key];
        delete state.autoLockExcluded[key];
        changed = true;
      }
    }

    for (const [key, { day, meal }] of desired) {
      const existing = state.planLocks[key];
      if (existing && !isTrackingOnly(existing)) continue;
      const snapshot = mealSnapshot(day.date, meal.meal, meal, "auto");
      if (!snapshot) continue;
      snapshot[TRACKING_FLAG] = true;
      if (existing && sameTrackingPlan(existing, snapshot)) continue;
      state.planLocks[key] = snapshot;
      delete state.autoLockExcluded[key];
      changed = true;
    }

    if (changed && typeof save === "function") save();
    return changed;
  };

  if (baseToggleMealLock) {
    globalScope.toggleMealLock = function toggleExplicitMealKeep(date, meal, shownMeal = null) {
      const key = `${date}|${meal}`;
      if (isInvisibleKeepState(state.planLocks?.[key])) {
        delete state.planLocks[key];
        delete state.autoLockExcluded?.[key];
      }
      return baseToggleMealLock(date, meal, shownMeal);
    };
  }

  function visibleProtectionSummary() {
    const from = typeof visiblePlanStart === "function"
      ? visiblePlanStart()
      : (state.settings?.planFrom || (typeof today === "function" ? today() : ""));
    const until = from && typeof addDays === "function" ? addDays(from, 6) : from;
    let manualCount = 0;
    let reservedCount = 0;
    for (const [key, lock] of Object.entries(state.planLocks || {})) {
      const [date, meal] = String(key || "").split("|");
      if (!date || date < from || date > until || isInvisibleKeepState(lock)) continue;
      if (trackingCompletionExists(date, meal)) continue;
      if (lock?.mode === "manual") manualCount += 1;
      else if (lock?.mode === "auto") reservedCount += 1;
    }
    const parts = [];
    if (reservedCount) parts.push(`<b>${reservedCount}</b> planerisch fest`);
    if (manualCount) parts.push(`<b>${manualCount}</b> behalten`);
    return parts.join(" · ") || "Keine Mahlzeit bewusst behalten";
  }

  function patchKeepUi() {
    document.querySelectorAll?.(".meal-lock").forEach((button) => {
      const date = button.dataset?.lockDate || "";
      const meal = button.dataset?.lockMeal || "";
      const lock = date && meal ? state.planLocks?.[`${date}|${meal}`] : null;
      if (!isInvisibleKeepState(lock)) return;

      button.classList.remove("locked");
      button.classList.add("unlocked");
      if (typeof mealLockIcon === "function") button.innerHTML = mealLockIcon(false);
      button.setAttribute("aria-label", "Mahlzeit bei automatischer Neuplanung behalten");
      button.setAttribute("title", "Behalten");
      button.closest?.(".mealbox")?.querySelector?.(".lock-label")?.remove();
    });

    const summary = document.querySelector("#planLockSummary .plan-lock-text");
    if (summary) summary.innerHTML = visibleProtectionSummary();
  }

  if (baseRenderPlan) {
    globalScope.renderPlan = function renderPlanWithTrackingUi() {
      const result = baseRenderPlan.apply(this, arguments);
      patchKeepUi();
      return result;
    };
  }

  if (baseRenderHome) {
    globalScope.renderHome = function renderHomeWithTrackingUi() {
      const result = baseRenderHome.apply(this, arguments);
      patchKeepUi();
      return result;
    };
  }

  if (typeof renderAll === "function") renderAll();
  else patchKeepUi();
})(typeof globalThis !== "undefined" ? globalThis : this);
