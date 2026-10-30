"use strict";

(function installPlannerWeekWorker(globalScope) {
  let booted = false;

  const workerDocument = {
    baseURI: "",
    readyState: "complete",
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() {
      return {
        dataset: {},
        style: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        addEventListener() {},
        removeEventListener() {},
        appendChild() {},
        setAttribute() {},
        removeAttribute() {},
      };
    },
    head: { appendChild() {} },
    body: { appendChild() {} },
    documentElement: { classList: { add() {}, remove() {} } },
    activeElement: null,
  };

  // Einige wiederverwendete Planner-Dateien lesen document bereits beim Laden.
  // Der Stub kommt deshalb vor den Imports; window bleibt bis nach app.js leer,
  // damit startBeikostApp() im Worker nicht automatisch startet.
  globalScope.document = workerDocument;

  importScripts(
    "../data/foods.js?v=10.1.26",
    "../data/recipes.js?v=10.1.26",
    "../data/recipe-food-pairings.js?v=10.1.26",
    "../data/food-presentation.js?v=10.1.26",
    "../data/food-handling.js?v=10.1.26",
    "./icons.js?v=10.1.26",
    "./state.js?v=10.1.26",
    "./utils.js?v=10.1.26",
    "./log-core.js?v=10.1.26",
    "./migrations.js?v=10.1.26",
    "./storage.js?v=10.1.26",
    "./model.js?v=10.1.26",
    "./phase-readiness.js?v=10.1.26",
    "./planning.js?v=10.1.26",
    "./planner-recipe-food-composition.js?v=10.1.26",
    "./recipes.js?v=10.1.26",
    "./prep.js?v=10.1.26",
    "./recipe-frozen-ingredient-stock.js?v=10.1.26",
    "./log.js?v=10.1.26",
    "./food-status-preferences.js?v=10.1.26",
    "./planner-culinary-quality.js?v=10.1.26",
    "./ui.js?v=10.1.26"
  );

  function installNoopUi() {
    globalScope.window = globalScope;
    globalScope.renderAll = () => {};
    globalScope.renderCurrentView = () => {};
    globalScope.showToast = () => {};
    globalScope.closeGeneric = () => {};
  }

  function ensureBoot() {
    if (booted) return;
    installNoopUi();

    // Match the app's static planner setup order before FoodPolicy and the
    // DOMContentLoaded policies are installed.
    if (typeof installFoodStatusPreferencePolicy === "function") {
      installFoodStatusPreferencePolicy();
    }
    if (typeof installPlannerCulinaryQualityRuntime === "function") {
      installPlannerCulinaryQualityRuntime();
    }

    // The app's week cache also wraps save() to invalidate the day-plan cache.
    // This worker builds weeks directly and must not schedule nested warmups.
    globalScope.__plannerWeekWorkerRuntime = true;
    importScripts("./planner-week-cache.js?v=10.1.26&planner-cache=5");

    // The browser's rollover cascade inserts these layers synchronously
    // before app.js. The worker DOM stub cannot load inserted scripts, so import
    // the same stack explicitly and in the same order.
    importScripts(
      "./planner-log-rollover.js?v=10.1.26",
      "./planner-log-rollover-cascade.js?v=10.1.26",
      "./meal-card-unification.js?v=10.1.26",
      "./planner-log-rollover-review-fixes.js?v=10.1.26",
      "./planner-random-swap.js?v=10.1.26",
      "./planner-task-alternatives.js?v=10.1.26",
      "./planner-missing-ingredient.js?v=10.1.26",
      "./plan-checks.js?v=10.1.26",
      "./planned-recipe-details.js?v=10.1.26",
      "./recipe-inventory-ingredients.js?v=10.1.26",
      "./catalog-navigation.js?v=10.1.26",
      "./catalog-performance.js?v=10.1.26",
      "./app-focus-mode.js?v=10.1.26",
      "./mobile-beikost-more.js?v=10.1.26",
      "./flow-dialog-ui.js?v=10.1.26",
      "./recipe-v2-component-options.js?v=10.1.26"
    );

    // The app evaluates app.js after its static planner wrappers. Hide window
    // during import so startBeikostApp() stays disabled in this worker.
    const workerWindow = globalScope.window;
    globalScope.window = undefined;
    importScripts("../app.js?v=10.1.26");
    globalScope.window = workerWindow;

    if (typeof installFoodPolicyRuntime === "function") {
      installFoodPolicyRuntime();
    }

    // The app loads allergen maintenance statically after app.js, before
    // the Planner-Policies that utils.js adds on DOMContentLoaded.
    importScripts("./planner-allergen-maintenance.js?v=10.1.26");

    importScripts(
      "./planner-meal-eligibility.js?v=10.1.26",
      "./planner-milk-policy.js?v=10.1.26",
      "./planner-iron-preference.js?v=10.1.26",
      "./planner-meal-presentation.js?v=10.1.26",
      "./planner-recipe-first.js?v=10.1.26",
      "./planner-proactive-recipe.js?v=10.1.26",
      "./planner-food-role-stability.js?v=10.1.26",
      "./planner-quality-rotation.js?v=10.1.26",
      "./planner-introduction-policy.js?v=10.1.26",
      "./planner-final-quality.js?v=10.1.26",
      "./handling-readiness.js?v=10.1.26"
    );

    globalScope.__plannerPoliciesReady = true;
    booted = true;
  }

  function buildWeek(snapshot, start) {
    state = snapshot;
    state.settings = state.settings || {};
    if (typeof installHandlingReadinessRuntime === "function") {
      installHandlingReadinessRuntime();
    }
    const current = typeof today === "function" ? today() : start;
    let days = [];
    let firstFutureIndex = -1;
    for (let index = 0; index < 7; index++) {
      const date = addDays(start, index);
      if (date < current && typeof historicalPlanDay === "function") {
        days.push(historicalPlanDay(date, index));
      } else {
        firstFutureIndex = index;
        break;
      }
    }
    if (firstFutureIndex >= 0) {
      const futureFrom = addDays(start, firstFutureIndex);
      const futureDays = buildDays(futureFrom, 7 - firstFutureIndex, false);
      futureDays.forEach((day, offset) => { day.index = firstFutureIndex + offset; });
      days.push(...futureDays);
    }
    return days;
  }

  globalScope.onmessage = (event) => {
    const message = event?.data || {};
    if (message.type !== "build") return;

    const originalToday = globalScope.today;
    const referenceDate = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(message.today || ""))
      ? String(message.today)
      : "";
    if (referenceDate && typeof originalToday === "function") {
      globalScope.today = () => referenceDate;
    }

    try {
      ensureBoot();
      state = message.state;
      const inputLockChecks = message.diagnostics === true
        ? Object.entries(state?.planLocks || {}).map(([key, lock]) => ({
            key,
            valid: typeof validPlanLock === "function" ? validPlanLock(lock) : null,
            recipeName: lock?.recipeName || "",
          }))
        : null;
      const weeks = (message.starts || []).map((start) => ({
        from: String(start || ""),
        count: 7,
        days: buildWeek(message.state, String(start || "")),
      }));
      const diagnostics = message.diagnostics === true
        ? {
            referenceDate,
            resolvedToday: typeof globalScope.today === "function" ? globalScope.today() : "",
            inputLocks: inputLockChecks,
            remainingLockKeys: Object.keys(state?.planLocks || {}),
          }
        : undefined;
      globalScope.postMessage({
        type: "result",
        requestId: message.requestId,
        inputRevision: message.inputRevision,
        weeks,
        ...(diagnostics ? { diagnostics } : {}),
      });
    } catch (error) {
      globalScope.postMessage({
        type: "error",
        requestId: message.requestId,
        inputRevision: message.inputRevision,
        message: String(error?.stack || error?.message || error),
      });
    } finally {
      if (typeof originalToday === "function") globalScope.today = originalToday;
    }
  };
})(self);
