"use strict";

/* PLAN-08: kulinarisch nachvollziehbare Darstellung automatischer FOOD-Mahlzeiten.
 *
 * Echte Rezepte bleiben über recipeName maßgeblich. Für FOOD-only-Mahlzeiten
 * werden keine Gerichte aus Freitext-Zubereitungshinweisen abgeleitet. Wo eine
 * fachlich bestätigte Darreichungsrolle nötig ist, kommt sie aus dem separaten
 * strukturierten FOOD_PRESENTATION_CONTRACT. Alle übrigen bestehenden
 * Planner-Titel bleiben unverändert.
 */

function plannerFoodPresentationRole(item) {
  if (!item) return "";
  if (item.plannerPresentationRole) return item.plannerPresentationRole;
  if (typeof FOOD_PRESENTATION_CONTRACT === "undefined") return "";
  return FOOD_PRESENTATION_CONTRACT[item.id]?.role || "";
}

function plannerNeutralBreakfastTitle(meal, items) {
  if (meal?.meal !== "breakfast" || items.length !== 2) return "";
  let categories = new Set(items.map((item) => item.category));

  // Ei + Obst ist als Kombination zulässig, aber ohne konkretes recipeName darf
  // der Planner daraus weder eine Eierspeise noch automatisch Pancakes erfinden.
  if (categories.has("Ei") && categories.has("Obst")) {
    return naturalFoodList(items.map((item) => item.name));
  }
  return "";
}

function plannerAutomaticComponentTitle(meal) {
  if (!meal || meal.recipeName || meal.manualAdded) return "";
  if ((meal.sampleFoodIds || []).length) return "";

  let ids = [...new Set(meal.foodIds || [])].filter(Boolean);
  let items = ids.map((id) => food(id)).filter(Boolean);
  if (items.length < 2) return "";

  let neutralBreakfastTitle = plannerNeutralBreakfastTitle(meal, items);
  if (neutralBreakfastTitle) return neutralBreakfastTitle;

  let roles = items.map(plannerFoodPresentationRole);
  let hasFreshSide = roles.includes("fresh-side");
  let hasOtherComponent = roles.some((role) => role !== "fresh-side");
  if (hasFreshSide && hasOtherComponent) {
    return `${naturalFoodList(items.map((item) => item.name))} · getrennte Komponenten`;
  }

  return "";
}

function plannerCompletedLogOnlyDayState(data, core, date) {
  if (!core?.logsForDate || !core?.openPlanInstances) {
    return { canCollapse: false, count: 0, completedCount: 0, grams: 0 };
  }
  let logs = core.logsForDate(data, date) || [];
  let completedLogs = logs.filter((log) =>
    typeof core.logQualifiesAsCompletion === "function"
      ? core.logQualifiesAsCompletion(log)
      : false,
  );
  let openPlans = core.openPlanInstances(
    data,
    (plan) => plan?.date === date,
  ) || [];
  return {
    canCollapse: completedLogs.length > 0 && openPlans.length === 0,
    count: logs.length,
    completedCount: completedLogs.length,
    grams: logs.reduce((sum, log) => sum + (Number(log?.amount) || 0), 0),
  };
}

function plannerInstallCompletedDayPresentationStyles() {
  if (typeof document === "undefined") return false;
  if (document.querySelector('style[data-completed-day-presentation="v1"]')) return true;
  let style = document.createElement("style");
  style.dataset.completedDayPresentation = "v1";
  style.textContent = `
#blockPlan .completed-edit-actions {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}
#blockPlan .completed-edit-actions .editCompletedLog {
  margin: 0 !important;
}
`;
  document.head.appendChild(style);
  return true;
}

function plannerCollapseFinishedLogOnlyDays() {
  if (typeof document === "undefined") return 0;
  let container = document.getElementById("blockPlan");
  let core = globalThis.__plannerLogRolloverCore;
  if (!container || !core || typeof visiblePlanStart !== "function") return 0;

  let from = visiblePlanStart();
  let current = today();
  let changed = 0;
  [...container.children].forEach((dayNode, index) => {
    if (!dayNode.classList?.contains("day-card")) return;
    let date = addDays(from, index);
    if (date >= current) return;
    let summary = plannerCompletedLogOnlyDayState(state, core, date);
    if (!summary.canCollapse) return;

    let details = document.createElement("details");
    details.className = "card block completed-day";
    let label = nice(date, true);
    details.innerHTML = `<summary><span><span class="completed-day-title">${esc(label)} erledigt</span><span class="small">${summary.count} ${summary.count === 1 ? "Protokolleintrag" : "Protokolleinträge"}${summary.grams ? ` · ${summary.grams} g protokolliert` : ""}</span></span><span class="completed-day-chevron">▼</span></summary>`;

    let body = document.createElement("div");
    body.className = "completed-day-body";
    [...dayNode.children].forEach((child) => {
      if (!child.classList?.contains("day-head")) body.appendChild(child);
    });
    details.appendChild(body);
    dayNode.replaceWith(details);
    changed += 1;
  });
  return changed;
}

function plannerCenterCompletedEditActions() {
  if (typeof document === "undefined") return 0;
  let container = document.getElementById("blockPlan");
  if (!container?.querySelectorAll) return 0;
  let changed = 0;
  container
    .querySelectorAll(".mealbox.completed .completed-body-direct .editCompletedLog")
    .forEach((button) => {
      let mealBox = button.closest(".mealbox.completed");
      if (!mealBox || button.closest(".completed-edit-actions")) return;
      let actions = document.createElement("div");
      actions.className = "completed-edit-actions";
      actions.appendChild(button);
      mealBox.appendChild(actions);
      changed += 1;
    });
  return changed;
}

function installPlannerMealPresentationRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__plannerMealPresentationRuntimeInstalled) return false;
  if (
    typeof dishTitle !== "function" ||
    typeof food !== "function" ||
    typeof naturalFoodList !== "function"
  ) return false;

  globalThis.__plannerMealPresentationRuntimeInstalled = true;
  let originalDishTitle = dishTitle;

  dishTitle = function plan08DishTitle(meal) {
    let componentTitle = plannerAutomaticComponentTitle(meal);
    return componentTitle || originalDishTitle(meal);
  };

  if (typeof renderPlanCore === "function") {
    plannerInstallCompletedDayPresentationStyles();
    let originalRenderPlanCore = renderPlanCore;
    renderPlanCore = function plan08CompletedDayPresentationRenderPlanCore() {
      let result = originalRenderPlanCore();
      plannerCollapseFinishedLogOnlyDays();
      plannerCenterCompletedEditActions();
      return result;
    };
  }

  return true;
}

function loadManualMealFlowRuntime() {
  if (typeof document === "undefined") return false;
  if (globalThis.__manualMealFlowRuntimeInstalled) return true;
  let existing = document.querySelector('script[data-manual-meal-flow="v1"]');
  if (existing) return true;
  let script = document.createElement("script");
  script.src = "js/manual-meal-flow.js?v=10.1.25";
  script.dataset.manualMealFlow = "v1";
  script.addEventListener("error", (event) => {
    console.error("Manueller Mahlzeiten-Flow konnte nicht geladen werden.", event);
  }, { once: true });
  document.head.appendChild(script);
  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerMealPresentationRuntime();
  loadManualMealFlowRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    plannerFoodPresentationRole,
    plannerNeutralBreakfastTitle,
    plannerAutomaticComponentTitle,
    plannerCompletedLogOnlyDayState,
    plannerInstallCompletedDayPresentationStyles,
    plannerCollapseFinishedLogOnlyDays,
    plannerCenterCompletedEditActions,
    installPlannerMealPresentationRuntime,
    loadManualMealFlowRuntime,
  };
}