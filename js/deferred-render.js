"use strict";

/* Sichtbare UI-Reaktion vor teuren Voll- und View-Rendern
 * State-Mutation und Persistenz bleiben synchron im auslösenden Event-Pfad.
 * Teure Renderarbeit wird hinter die nächste Render-Gelegenheit verschoben.
 */

let deferredRenderAllPending = false;
let deferredRenderAllCallbacks = [];
let deferredRenderScopeDepth = 0;
let deferredRenderScopeBase = null;
let deferredRenderScopeRequested = false;
let deferredRenderScopeCallbacks = [];
let deferredViewRenderPending = false;
let deferredViewRenderId = "";
let deferredViewRenderCallback = null;
const deferredRenderClickTargets = new WeakSet();
let deferredLogSuggestionRequest = 0;
let deferredFoodDetailRequest = 0;
let deferredAllergenPlanRequest = 0;
let deferredRecipeDetailRequest = 0;

function afterNextPaint(callback) {
  if (typeof callback !== "function") return;
  let afterPaint = () => {
    if (typeof setTimeout === "function") setTimeout(callback, 0);
    else callback();
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(afterPaint);
  else afterPaint();
}

function renderAllAfterNextPaint(afterRender = null) {
  if (typeof afterRender === "function") deferredRenderAllCallbacks.push(afterRender);
  if (deferredRenderAllPending) return;
  deferredRenderAllPending = true;
  afterNextPaint(() => {
    deferredRenderAllPending = false;
    let callbacks = deferredRenderAllCallbacks;
    deferredRenderAllCallbacks = [];
    if (typeof renderAll === "function") renderAll();
    callbacks.forEach((callback) => callback());
  });
}

function renderViewAfterNextPaint(viewId, callback) {
  if (typeof callback !== "function") return;
  deferredViewRenderId = String(viewId || "");
  deferredViewRenderCallback = callback;
  if (deferredViewRenderPending) return;
  deferredViewRenderPending = true;
  afterNextPaint(() => {
    deferredViewRenderPending = false;
    let id = deferredViewRenderId;
    let render = deferredViewRenderCallback;
    deferredViewRenderId = "";
    deferredViewRenderCallback = null;
    if (typeof render === "function") render(id);
  });
}

function cancelDeferredViewRender() {
  deferredViewRenderId = "";
  deferredViewRenderCallback = null;
}

function beginDeferredFullRender() {
  if (typeof renderAll !== "function") return false;
  deferredRenderScopeDepth++;
  if (deferredRenderScopeDepth > 1) return true;
  deferredRenderScopeBase = renderAll;
  deferredRenderScopeRequested = false;
  deferredRenderScopeCallbacks = [];
  renderAll = function requestDeferredFullRender() {
    deferredRenderScopeRequested = true;
  };
  return true;
}

function endDeferredFullRender(afterRender = null) {
  if (!deferredRenderScopeDepth) return;
  if (typeof afterRender === "function") deferredRenderScopeCallbacks.push(afterRender);
  deferredRenderScopeDepth--;
  if (deferredRenderScopeDepth) return;

  let base = deferredRenderScopeBase;
  let requested = deferredRenderScopeRequested;
  let callbacks = deferredRenderScopeCallbacks;
  deferredRenderScopeBase = null;
  deferredRenderScopeRequested = false;
  deferredRenderScopeCallbacks = [];
  if (typeof base === "function") renderAll = base;

  if (requested) renderAllAfterNextPaint(() => callbacks.forEach((callback) => callback()));
  else callbacks.forEach((callback) => callback());
}

function runWithDeferredFullRender(callback, afterRender = null) {
  if (typeof callback !== "function") return;
  if (!beginDeferredFullRender()) return callback();
  try {
    return callback();
  } finally {
    endDeferredFullRender(afterRender);
  }
}

function queueDeferredFullRenderEnd() {
  let finish = () => endDeferredFullRender();
  if (typeof queueMicrotask === "function") queueMicrotask(finish);
  else Promise.resolve().then(finish);
}

function deferFullRenderForClick(button) {
  if (!button || deferredRenderClickTargets.has(button)) return;
  deferredRenderClickTargets.add(button);
  button.addEventListener("click", () => {
    if (beginDeferredFullRender()) queueDeferredFullRenderEnd();
  }, true);
}

function installSaveUiLatencyFlows() {
  if (typeof document === "undefined") return;

  let genericBody = document.getElementById("genericBody");
  if (genericBody) {
    let genericIds = new Set([
      "saveConcreteProduct",
      "deleteConcreteProduct",
      "saveInv",
      "saveCustom",
      "useExistingCustom",
    ]);
    genericBody.addEventListener("click", (event) => {
      let button = event.target?.closest?.("button");
      if (!button || !genericIds.has(button.id)) return;
      if (beginDeferredFullRender()) queueDeferredFullRenderEnd();
    }, true);
  }

  deferFullRenderForClick(document.getElementById("saveSettings"));

  if (typeof setTextureStage === "function") {
    let baseSetTextureStage = setTextureStage;
    setTextureStage = function setTextureStageWithoutBlockingFullRender(...args) {
      return runWithDeferredFullRender(() => baseSetTextureStage.apply(this, args));
    };
  }

  if (typeof saveLog === "function") {
    let baseSaveLog = saveLog;
    saveLog = function saveLogWithoutBlockingFullRender(...args) {
      let editId = pendingLog?.editId || "";
      let beforeRef = editId ? state.logs.find((log) => log.id === editId) : null;
      let beforeIds = editId ? null : new Set(state.logs.map((log) => log.id));
      let result;
      let savedLog = null;
      if (!beginDeferredFullRender()) return baseSaveLog.apply(this, args);
      try {
        result = baseSaveLog.apply(this, args);
        savedLog = editId
          ? state.logs.find((log) => log.id === editId)
          : state.logs.find((log) => !beforeIds.has(log.id));
        if (editId && savedLog === beforeRef) savedLog = null;
        return result;
      } finally {
        let savedId = savedLog?.id || "";
        endDeferredFullRender(savedId ? () => {
          let details = document.getElementById("logDetails");
          if (details) details.open = true;
          let entry = document.querySelector(`[data-log="${savedId}"]`);
          (entry || document.getElementById("logSection"))?.scrollIntoView({ behavior: "smooth", block: "start" });
        } : null);
      }
    };
  }
}

function scheduleDeferredLogSuggestions() {
  if (typeof renderLogFoodResults !== "function") return;
  let request = ++deferredLogSuggestionRequest;
  afterNextPaint(() => {
    if (request !== deferredLogSuggestionRequest) return;
    if (!document.getElementById("logModal")?.classList.contains("open")) return;
    let input = document.getElementById("logFoodSearch");
    if (!input || String(input.value || "").trim()) return;
    renderLogFoodResults();
  });
}

function renderLogFormWithoutPlanSuggestions(render) {
  if (typeof render !== "function") return;
  let basePrepDemand = typeof prepDemand === "function" ? prepDemand : null;
  if (basePrepDemand) prepDemand = () => [];
  try {
    render();
  } finally {
    if (basePrepDemand) prepDemand = basePrepDemand;
  }
  scheduleDeferredLogSuggestions();
}

function plannedUsageForFood(foodItem, buildDaysFn) {
  if (!foodItem || typeof buildDaysFn !== "function") return [];
  return buildDaysFn(today(), 7)
    .flatMap((day) =>
      (day.meals || [])
        .filter(
          (meal) =>
            meal.active &&
            !meal.empty &&
            (meal.foodIds || []).includes(foodItem.id) &&
            !mealIsCompleted(day.date, meal.meal),
        )
        .map((meal) => ({
          date: day.date,
          meal: meal.meal,
          dish: dishTitle(meal),
        })),
    )
    .slice(0, 4);
}

function foodPlannedUsageContainer() {
  return [...document.querySelectorAll("#genericBody .history")]
    .find((item) => item.querySelector("b")?.textContent?.trim() === "Nächste Verwendung") || null;
}

function updateFoodPlannedUsage(foodItem, buildDaysFn, request) {
  if (request !== deferredFoodDetailRequest) return;
  if (!document.getElementById("genericModal")?.classList.contains("open")) return;
  if (document.getElementById("genericTitle")?.textContent !== foodItem?.name) return;
  let container = foodPlannedUsageContainer();
  if (!container) return;
  let planned = plannedUsageForFood(foodItem, buildDaysFn);
  let detail = container.querySelector(".small");
  if (!detail) return;
  detail.innerHTML = planned.length
    ? planned.map((item) => `${shortDate(item.date)} · ${mealName(item.meal)} · ${esc(item.dish)}`).join("<br>")
    : "In den nächsten sieben Tagen nicht eingeplant.";
}

function installOpenUiLatencyFlows() {
  if (typeof document === "undefined") return;

  if (typeof openLog === "function" && typeof renderLogForm === "function") {
    let baseOpenLog = openLog;
    openLog = function openLogWithoutBlockingSuggestions(...args) {
      let basePrepDemand = typeof prepDemand === "function" ? prepDemand : null;
      if (basePrepDemand) prepDemand = () => [];
      try {
        return baseOpenLog.apply(this, args);
      } finally {
        if (basePrepDemand) prepDemand = basePrepDemand;
        scheduleDeferredLogSuggestions();
      }
    };
  }

  if (typeof copyLogEntry === "function" && typeof renderLogForm === "function") {
    let baseCopyLogEntry = copyLogEntry;
    copyLogEntry = function copyLogEntryWithoutDuplicateRender(...args) {
      if (!state?.logs?.some((log) => log.id === args[0])) return baseCopyLogEntry.apply(this, args);
      let baseRenderLogForm = renderLogForm;
      let result;
      renderLogForm = () => {};
      try {
        result = baseCopyLogEntry.apply(this, args);
      } finally {
        renderLogForm = baseRenderLogForm;
      }
      renderLogFormWithoutPlanSuggestions(baseRenderLogForm);
      return result;
    };
  }

  if (typeof showFoodInfo === "function" && typeof buildDays === "function") {
    let baseShowFoodInfo = showFoodInfo;
    showFoodInfo = function showFoodInfoWithoutBlockingPlan(...args) {
      let foodItem = args[0];
      let baseBuildDays = buildDays;
      let request = ++deferredFoodDetailRequest;
      buildDays = () => [];
      try {
        baseShowFoodInfo.apply(this, args);
      } finally {
        buildDays = baseBuildDays;
      }
      let container = foodPlannedUsageContainer();
      let detail = container?.querySelector(".small");
      if (detail) detail.textContent = "Planung wird geladen…";
      afterNextPaint(() => updateFoodPlannedUsage(foodItem, baseBuildDays, request));
    };
  }

  if (
    typeof openAllergenSchedule === "function" &&
    typeof findPlannedFood === "function"
  ) {
    let baseOpenAllergenSchedule = openAllergenSchedule;
    let baseFindPlannedFood = findPlannedFood;
    openAllergenSchedule = function openAllergenScheduleWithoutBlockingPlan(foodId) {
      let request = ++deferredAllergenPlanRequest;
      findPlannedFood = () => null;
      try {
        baseOpenAllergenSchedule.call(this, foodId);
      } finally {
        findPlannedFood = baseFindPlannedFood;
      }
      let saveButton = document.getElementById("saveAllergenDate");
      if (!saveButton) return;
      saveButton.disabled = true;
      let loading = document.createElement("div");
      loading.className = "small";
      loading.id = "allergenPlanLoading";
      loading.textContent = "Bestehende Planung wird geprüft…";
      saveButton.closest(".sticky-form-actions")?.before(loading);
      afterNextPaint(() => {
        if (request !== deferredAllergenPlanRequest) return;
        if (!document.getElementById("genericModal")?.classList.contains("open")) return;
        let currentSave = document.getElementById("saveAllergenDate");
        let dateInput = document.getElementById("allergenDate");
        let mealInput = document.getElementById("allergenMeal");
        if (!currentSave || !dateInput || !mealInput) return;
        let planned = baseFindPlannedFood(foodId);
        if (planned) {
          dateInput.value = planned.day.date;
          mealInput.value = planned.meal.meal;
          currentSave.textContent = "Planung ändern";
        }
        currentSave.disabled = false;
        document.getElementById("allergenPlanLoading")?.remove();
      });
    };
  }

  let plannedRecipeDetails = globalThis.__plannedRecipeDetails;
  if (typeof plannedRecipeDetails?.openPlannedRecipeDetails === "function") {
    let openDeferredRecipe = (event) => {
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      let target = event.target?.closest?.("[data-planned-recipe-name]");
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      let recipeName = target.dataset.plannedRecipeName || "";
      let foodIds = String(target.dataset.plannedRecipeFoodIds || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      let request = ++deferredRecipeDetailRequest;
      openGeneric("Rezept", '<div class="small" id="plannedRecipeLoading">Rezept wird geladen…</div>');
      let body = document.getElementById("genericBody");
      if (body) body.dataset.deferredRecipeRequest = String(request);
      afterNextPaint(() => {
        let modal = document.getElementById("genericModal");
        let currentBody = document.getElementById("genericBody");
        if (request !== deferredRecipeDetailRequest) return;
        if (!modal?.classList.contains("open")) return;
        if (currentBody?.dataset.deferredRecipeRequest !== String(request)) return;
        delete currentBody.dataset.deferredRecipeRequest;
        let opened = plannedRecipeDetails.openPlannedRecipeDetails(recipeName, foodIds);
        if (!opened && modal.classList.contains("open")) {
          document.getElementById("genericBody").innerHTML = '<div class="small">Rezeptbeschreibung nicht gefunden.</div>';
        }
      });
    };
    document.addEventListener("click", openDeferredRecipe, true);
    document.addEventListener("keydown", openDeferredRecipe, true);
  }
}

if (typeof document !== "undefined") {
  let installLatencyFlows = () => {
    installSaveUiLatencyFlows();
    installOpenUiLatencyFlows();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLatencyFlows, { once: true });
  else installLatencyFlows();
}
