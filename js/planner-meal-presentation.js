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

function plannerMealItems(meal) {
  return [...new Set(meal?.foodIds || [])]
    .map((id) => food(id))
    .filter(Boolean);
}

function plannerDescriptiveFoodTitle(items) {
  let all = (items || []).filter(Boolean);
  if (!all.length) return "Mahlzeit";
  if (all.length === 1) return all[0].name;
  return `${all[0].name} mit ${naturalFoodList(all.slice(1).map((item) => item.name))}`;
}

function plannerCompoundFoodName(item) {
  let replacements = {
    banane: "Bananen",
    birne: "Birnen",
    nektarine: "Nektarinen",
    pflaume: "Pflaumen",
    aprikose: "Aprikosen",
    kirsche: "Kirsch",
    erdbeere: "Erdbeer",
    heidelbeere: "Heidelbeer",
    himbeere: "Himbeer",
    brombeere: "Brombeer",
    orange: "Orangen",
    mandarine: "Mandarinen",
    melone: "Melonen",
    wassermelone: "Wassermelonen",
  };
  return replacements[item?.id] || item?.name || "";
}

function plannerRecipeConfiguredIds(recipe) {
  if (!recipe || typeof foodByName !== "function") return new Set();
  let names = [
    ...(recipe.requires || []),
    ...((recipe.alternatives || []).flat()),
    ...(recipe.oneOf || []),
    ...(recipe.milkChoices || []),
  ];
  return new Set(names.map((name) => foodByName(name, state.foods)?.id).filter(Boolean));
}

function plannerRecipeNameEncodesItem(recipeName, item) {
  if (!recipeName || !item?.name || typeof normalizeName !== "function") return false;
  let normalizedRecipeName = normalizeName(recipeName);
  let normalizedItemName = normalizeName(item.name);
  if (!normalizedRecipeName || !normalizedItemName) return false;
  return ` ${normalizedRecipeName} `.includes(` ${normalizedItemName} `);
}

function plannerAppendRecipeExtras(title, meal, excludedIds = new Set()) {
  let recipe = typeof recipeByName === "function" ? recipeByName(meal?.recipeName || "") : null;
  let configuredIds = plannerRecipeConfiguredIds(recipe);
  let extras = plannerMealItems(meal).filter((item) =>
    !excludedIds.has(item.id) &&
    !configuredIds.has(item.id) &&
    !plannerRecipeNameEncodesItem(title, item)
  );
  return extras.length
    ? `${title} mit ${naturalFoodList(extras.map((item) => item.name))}`
    : title;
}

function plannerConcreteRecipeTitle(meal) {
  let recipeName = String(meal?.recipeName || "");
  if (!recipeName) return "";
  let items = plannerMealItems(meal);

  if (recipeName === "Milch-Getreide-Brei") {
    let recipe = typeof recipeByName === "function" ? recipeByName(recipeName) : null;
    let cerealIds = new Set(
      (recipe?.oneOf || [])
        .map((name) => typeof foodByName === "function" ? foodByName(name, state.foods)?.id : "")
        .filter(Boolean),
    );
    let milkIds = new Set(
      (recipe?.milkChoices || [])
        .map((name) => typeof foodByName === "function" ? foodByName(name, state.foods)?.id : "")
        .filter(Boolean),
    );
    let milk = items.find((item) => milkIds.has(item.id)) || items.find((item) =>
      ["kuhmilch", "naturjoghurt", "buttermilch"].includes(item.id),
    );
    let cereal = items.find((item) => cerealIds.has(item.id)) || items.find((item) =>
      item.category === "Getreide/Stärke" && item.id !== "haferdrink",
    );
    if (milk && cereal) {
      let excluded = new Set([milk.id, cereal.id]);
      let title = `${milk.name}-${cereal.name}-Brei`;
      let extras = items.filter((item) => !excluded.has(item.id));
      return extras.length
        ? `${title} mit ${naturalFoodList(extras.map((item) => item.name))}`
        : title;
    }
    return plannerAppendRecipeExtras(recipeName, meal);
  }

  if (/^Obst-/i.test(recipeName)) {
    let fruits = items.filter((item) => String(item.category || "").startsWith("Obst"));
    if (fruits.length) {
      let fruitTitle = fruits.map(plannerCompoundFoodName).filter(Boolean).join("-");
      let title = recipeName.replace(/^Obst-/i, `${fruitTitle}-`);
      return plannerAppendRecipeExtras(title, meal, new Set(fruits.map((item) => item.id)));
    }
  }

  return plannerAppendRecipeExtras(recipeName, meal);
}

function plannerMealDisplayTitle(meal) {
  if (meal?.recipeName) return plannerConcreteRecipeTitle(meal);
  let items = plannerMealItems(meal);
  let title = plannerDescriptiveFoodTitle(items);
  let componentTitle = plannerAutomaticComponentTitle(meal);
  return componentTitle?.includes("· getrennte Komponenten")
    ? `${title} · getrennte Komponenten`
    : title;
}

function plannerLearningLabel(item, meal) {
  let type = String(meal?.type || "");
  if (type === "Allergen einführen") return "Allergen einführen";
  if (type === "Allergen wiederholen") return "Allergen wiederholen";
  if (["gezielt wiederholen", "nach Einführung"].includes(type)) return "Wiederholung";
  if (type === "neu") return item?.allergenGroup ? "Allergen einführen" : "Neu";

  let itemRank = typeof rank === "function" ? Number(rank(item)) : 0;
  let itemStatus = typeof status === "function" ? status(item) : "";
  if (itemStatus === "Pausiert") return "Pausiert";
  if (itemRank === 1) return "Wiederholung";
  if (itemRank <= 0) return item?.allergenGroup ? "Allergen einführen" : "Neu";
  let fallback = typeof plannerLearningRoleLabel === "function"
    ? plannerLearningRoleLabel(item, type)
    : "";
  return fallback === "Einführung" ? "Neu" : fallback;
}

function plannerLearningRoleGroups(meal) {
  let groups = new Map();
  let sampleIds = [...new Set(meal?.sampleFoodIds || [])].filter(Boolean);
  for (let id of sampleIds) {
    let item = food(id);
    if (!item) continue;
    let label = plannerLearningLabel(item, meal);
    if (!label) continue;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item.name);
  }

  let maintenanceIds = [...new Set(meal?.allergenMaintenanceFoodIds || [])]
    .filter((id) => !sampleIds.includes(id));
  for (let id of maintenanceIds) {
    let item = food(id);
    if (!item) continue;
    let label = "Allergen weiter anbieten";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item.name);
  }

  return [...groups.entries()].map(([label, names]) => ({
    label,
    names: [...new Set(names)],
  }));
}

function plannerCompactLearningRolesHtml(meal) {
  let groups = plannerLearningRoleGroups(meal);
  if (!groups.length) return "";
  let rows = groups.map((group) =>
    `<div class="compact-role-row sample"><b>${esc(group.names.join(", "))}</b><span>${esc(group.label)}</span></div>`,
  ).join("");
  return `<div class="compact-role-list">${rows}</div>`;
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
  let openPlans = core.openPlanInstances(data, (plan) => plan?.date === date) || [];
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
/* Log-only summaries render the title and count as adjacent spans. */
#blockPlan .completed-day-title + .small {
  margin-left: 8px;
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

function plannerMarkTodayDayHeading() {
  if (typeof document === "undefined") return 0;
  let container = document.getElementById("blockPlan");
  if (
    !container ||
    typeof visiblePlanStart !== "function" ||
    typeof today !== "function" ||
    typeof addDays !== "function" ||
    typeof nice !== "function"
  ) return 0;
  let from = visiblePlanStart();
  let current = today();
  let changed = 0;
  [...container.children].forEach((dayNode, index) => {
    if (!dayNode.classList?.contains("day-card")) return;
    let date = addDays(from, index);
    if (date !== current) return;
    let heading = dayNode.querySelector?.(".day-date");
    if (!heading) return;
    let label = `${nice(date, true)} · Heute`;
    if (heading.textContent === label) return;
    heading.textContent = label;
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
  if (typeof mealDisplayTitle === "function") {
    mealDisplayTitle = function descriptiveMealDisplayTitle(meal) {
      return plannerMealDisplayTitle(meal);
    };
  }
  if (typeof compactMealRolesHtml === "function") {
    compactMealRolesHtml = function learningOnlyMealRolesHtml(meal) {
      return plannerCompactLearningRolesHtml(meal);
    };
  }
  if (typeof mealStatusText === "function") {
    let originalMealStatusText = mealStatusText;
    mealStatusText = function learningAwareMealStatusText(meal) {
      return plannerLearningRoleGroups(meal).length ? "" : originalMealStatusText(meal);
    };
  }
  if (typeof renderPlanCore === "function") {
    plannerInstallCompletedDayPresentationStyles();
    let originalRenderPlanCore = renderPlanCore;
    renderPlanCore = function plan08CompletedDayPresentationRenderPlanCore() {
      let result = originalRenderPlanCore();
      plannerCollapseFinishedLogOnlyDays();
      plannerMarkTodayDayHeading();
      plannerCenterCompletedEditActions();
      return result;
    };
  }
  return true;
}

function loadMealEditorRecipeVariantsRuntime() {
  if (typeof document === "undefined") return false;
  if (globalThis.__mealEditorRecipeVariantsInstalled) return true;
  let existing = document.querySelector('script[data-meal-editor-recipe-variants="v1"]');
  if (existing) return true;
  let script = document.createElement("script");
  script.src = "js/meal-editor-recipe-variants.js?v=10.1.26";
  script.dataset.mealEditorRecipeVariants = "v1";
  script.addEventListener("error", (event) => {
    console.error("Rezeptvarianten im Mahlzeit-Editor konnten nicht geladen werden.", event);
  }, { once: true });
  document.head.appendChild(script);
  return true;
}

function loadManualMealFlowRuntime() {
  if (typeof document === "undefined") return false;
  if (globalThis.__manualMealFlowRuntimeInstalled) {
    loadMealEditorRecipeVariantsRuntime();
    return true;
  }
  let existing = document.querySelector('script[data-manual-meal-flow="v1"]');
  if (existing) {
    existing.addEventListener("load", loadMealEditorRecipeVariantsRuntime, { once: true });
    return true;
  }
  let script = document.createElement("script");
  script.src = "js/manual-meal-flow.js?v=10.1.25";
  script.dataset.manualMealFlow = "v1";
  script.addEventListener("load", loadMealEditorRecipeVariantsRuntime, { once: true });
  script.addEventListener("error", (event) => {
    console.error("Manueller Mahlzeiten-Flow konnte nicht geladen werden.", event);
  }, { once: true });
  document.head.appendChild(script);
  return true;
}

function loadRecipeV2ComponentOptionsRuntime() {
  if (typeof document === "undefined") return false;
  let existing = document.querySelector('script[data-recipe-v2-component-options="v1"]');
  if (existing) {
    existing.addEventListener("load", loadManualMealFlowRuntime, { once: true });
    return true;
  }
  let script = document.createElement("script");
  script.src = "js/recipe-v2-component-options.js?v=10.1.26";
  script.dataset.recipeV2ComponentOptions = "v1";
  script.addEventListener("load", loadManualMealFlowRuntime, { once: true });
  script.addEventListener("error", (event) => {
    console.error("Recipe-V2-Komponentenoptionen konnten nicht geladen werden.", event);
  }, { once: true });
  document.head.appendChild(script);
  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerMealPresentationRuntime();
  loadRecipeV2ComponentOptionsRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    plannerFoodPresentationRole,
    plannerNeutralBreakfastTitle,
    plannerAutomaticComponentTitle,
    plannerMealItems,
    plannerDescriptiveFoodTitle,
    plannerCompoundFoodName,
    plannerRecipeConfiguredIds,
    plannerRecipeNameEncodesItem,
    plannerAppendRecipeExtras,
    plannerConcreteRecipeTitle,
    plannerMealDisplayTitle,
    plannerLearningLabel,
    plannerLearningRoleGroups,
    plannerCompactLearningRolesHtml,
    plannerCompletedLogOnlyDayState,
    plannerInstallCompletedDayPresentationStyles,
    plannerCollapseFinishedLogOnlyDays,
    plannerMarkTodayDayHeading,
    plannerCenterCompletedEditActions,
    installPlannerMealPresentationRuntime,
    loadMealEditorRecipeVariantsRuntime,
    loadManualMealFlowRuntime,
    loadRecipeV2ComponentOptionsRuntime,
  };
}