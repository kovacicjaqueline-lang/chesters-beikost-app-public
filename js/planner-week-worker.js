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
    "./recipe-inventory-ingredients.js?v=10.1.26",
    "./recipe-v2-component-options.js?v=10.1.26",
    "./log.js?v=10.1.26",
    "./food-status-preferences.js?v=10.1.26",
    "./ui.js?v=10.1.26",
    "../app.js?v=10.1.26"
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

    // Diese Schicht muss vor den späteren Policy-Wrappern installiert werden,
    // damit der Worker dieselbe Plan-ID-/Rollover-Basis wie die App verwendet.
    importScripts("./planner-log-rollover.js?v=10.1.26");

    if (typeof installFoodStatusPreferencePolicy === "function") {
      installFoodStatusPreferencePolicy();
    }
    if (typeof installFoodPolicyRuntime === "function") {
      installFoodPolicyRuntime();
    }

    importScripts(
      "./planner-meal-eligibility.js?v=10.1.26",
      "./planner-milk-policy.js?v=10.1.26",
      "./planner-iron-preference.js?v=10.1.26",
      "./planner-culinary-quality.js?v=10.1.26",
      "./planner-meal-presentation.js?v=10.1.26",
      "./planner-recipe-first.js?v=10.1.26",
      "./planner-proactive-recipe.js?v=10.1.26",
      "./planner-food-role-stability.js?v=10.1.26",
      "./planner-quality-rotation.js?v=10.1.26",
      "./planner-introduction-policy.js?v=10.1.26",
      "./planner-allergen-maintenance.js?v=10.1.26",
      "./handling-readiness.js?v=10.1.26"
    );

    booted = true;
  }

  function cloneSnapshot(snapshot) {
    if (typeof globalScope.structuredClone === "function") return globalScope.structuredClone(snapshot);
    return JSON.parse(JSON.stringify(snapshot));
  }

  function buildWeek(snapshot, start) {
    state = cloneSnapshot(snapshot || {});
    state.settings = state.settings || {};
    if (typeof installHandlingReadinessRuntime === "function") {
      installHandlingReadinessRuntime();
    }
    return buildDays(start, 7, false);
  }

  globalScope.onmessage = (event) => {
    const message = event?.data || {};
    if (message.type !== "build") return;

    try {
      ensureBoot();
      const weeks = (message.starts || []).map((start) => ({
        from: String(start || ""),
        count: 7,
        days: buildWeek(message.state, String(start || "")),
      }));
      globalScope.postMessage({
        type: "result",
        requestId: message.requestId,
        inputRevision: message.inputRevision,
        weeks,
      });
    } catch (error) {
      globalScope.postMessage({
        type: "error",
        requestId: message.requestId,
        inputRevision: message.inputRevision,
        message: String(error?.stack || error?.message || error),
      });
    }
  };
})(self);
