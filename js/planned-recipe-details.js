"use strict";

/* Geplante Rezepte direkt aus Heute und Wochenplan öffnen.
 * Die vorhandene Recipe-V2-Darstellung und die zentrale recipeByName-Auflösung
 * bleiben die einzigen Quellen für Rezeptdetails und Rezeptnamen.
 */
(function plannedRecipeDetailsModule(root) {
  function displayedRecipeName(meal, completed = null) {
    if (completed) return String(completed.recipeName || "").trim();
    return String(meal?.recipeName || "").trim();
  }

  function recipeContextHints(recipe, foodIds = [], resolveFoodId = (name) => name) {
    if (!recipe) return [];
    let plannedIds = new Set((foodIds || []).filter(Boolean));
    if (!plannedIds.size) return [];
    let hints = [];
    let sets = [recipe.requires || [], ...(recipe.alternatives || [])];
    let variantIndex = sets.findIndex((requirements) =>
      requirements.length > 0 &&
      requirements.every((name) => {
        let id = resolveFoodId(name);
        return !!id && plannedIds.has(id);
      })
    );
    if (variantIndex >= 0) {
      let label = recipe.variantLabels?.[variantIndex] || recipe.legacyNames?.[variantIndex] || "";
      if (label) hints.push(label);
    }
    for (let option of [...(recipe.oneOf || []), ...(recipe.milkChoices || [])]) {
      let id = resolveFoodId(option);
      if (id && plannedIds.has(id)) hints.push(option);
    }
    return [...new Set(hints.filter(Boolean))];
  }

  function addRecipeChevron(node) {
    if (!node || node.querySelector?.(".planned-recipe-chevron")) return;
    let doc = node.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!doc?.createElement) return;
    let chevron = doc.createElement("span");
    chevron.className = "planned-recipe-chevron";
    chevron.textContent = "›";
    chevron.setAttribute?.("aria-hidden", "true");
    if (chevron.style) {
      chevron.style.color = "var(--accent)";
      chevron.style.fontSize = "20px";
      chevron.style.lineHeight = "1";
      chevron.style.flex = "0 0 auto";
    }
    node.appendChild?.(chevron);
  }

  function markRecipeTitle(node, recipeName, foodIds = []) {
    if (!node || !recipeName) return node;
    node.dataset.plannedRecipeName = String(recipeName);
    node.dataset.plannedRecipeFoodIds = (foodIds || []).filter(Boolean).join(",");
    node.classList?.add("planned-recipe-title");
    node.setAttribute?.("role", "button");
    node.setAttribute?.("tabindex", "0");
    node.setAttribute?.("aria-label", `Rezept ${recipeName} öffnen`);
    node.setAttribute?.("title", "Rezept öffnen");
    if (node.style) {
      node.style.cursor = "pointer";
      node.style.touchAction = "manipulation";
      node.style.color = "var(--accent)";
      node.style.display = "inline-flex";
      node.style.alignItems = "center";
      node.style.gap = "5px";
      node.style.minHeight = "44px";
      node.style.maxWidth = "100%";
      node.style.padding = "7px 0";
    }
    addRecipeChevron(node);
    return node;
  }

  function markCompletedRecipeTitle(node, recipeName, foodIds = []) {
    if (!node || !recipeName) return null;
    if (node.querySelector?.("[data-planned-recipe-name]"))
      return node.querySelector("[data-planned-recipe-name]");
    let text = String(node.textContent || "");
    let index = text.lastIndexOf(recipeName);
    if (index < 0) return markRecipeTitle(node, recipeName, foodIds);
    let prefix = text.slice(0, index);
    let doc = node.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!doc?.createElement) return markRecipeTitle(node, recipeName, foodIds);
    node.textContent = "";
    if (prefix && doc.createTextNode) node.appendChild(doc.createTextNode(prefix));
    let recipeTarget = doc.createElement("span");
    recipeTarget.textContent = recipeName;
    node.appendChild(recipeTarget);
    return markRecipeTitle(recipeTarget, recipeName, foodIds);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      displayedRecipeName,
      recipeContextHints,
      markRecipeTitle,
      markCompletedRecipeTitle,
    };
  }

  if (
    typeof document === "undefined" ||
    typeof renderHome !== "function" ||
    typeof renderPlan !== "function"
  ) return;

  function currentRecipeState(storedName, foodIds = []) {
    if (typeof recipeByName !== "function" || typeof recipeStates !== "function") return null;
    let recipeRecord = recipeByName(storedName);
    if (!recipeRecord) return null;
    let resolveFoodId = (name) => {
      let item = typeof foodByName === "function" ? foodByName(name) : null;
      return item?.id || "";
    };
    let hints = recipeContextHints(recipeRecord, foodIds, resolveFoodId);
    let previousQuery = typeof recipeQuery !== "undefined" ? recipeQuery : "";
    let states = [];
    try {
      if (typeof recipeQuery !== "undefined")
        recipeQuery = [storedName, recipeRecord.name, ...hints].filter(Boolean).join(" ");
      states = recipeStates();
    } finally {
      if (typeof recipeQuery !== "undefined") recipeQuery = previousQuery;
    }
    return states.find((recipe) => recipe?.name === recipeRecord.name) || null;
  }

  function openPlannedRecipeDetails(storedName, foodIds = []) {
    let recipe = currentRecipeState(storedName, foodIds);
    if (!recipe) {
      if (typeof showToast === "function") showToast("Rezeptbeschreibung nicht gefunden.");
      return false;
    }
    if (typeof openGeneric !== "function" || typeof renderRecipeCard !== "function") return false;

    openGeneric("Rezept", renderRecipeCard(recipe));
    let card = document.querySelector("#genericBody .recipe-card-v2");
    if (card) card.open = true;
    if (typeof bindRecipeStockButtons === "function") bindRecipeStockButtons();
    return true;
  }

  function decorateMealRecipeTitle(mealNode, recipeName, foodIds = []) {
    if (!mealNode || !recipeName) return;
    let completedTitle = mealNode.querySelector(".completed-title");
    if (completedTitle) {
      markCompletedRecipeTitle(completedTitle, recipeName, foodIds);
      return;
    }
    markRecipeTitle(
      mealNode.querySelector(".dish-title, .manual-meal-title"),
      recipeName,
      foodIds,
    );
  }

  function decorateHomeRecipeTitles() {
    let on = today();
    let day = buildDays(on, 1)[0];
    let activeMeals = (day?.meals || []).filter((meal) => meal.active && meal.focusId);
    let mealNodes = [...document.querySelectorAll("#todayCard .mealbox")];
    activeMeals.forEach((meal, index) => {
      let completed = typeof completedLog === "function" ? completedLog(on, meal.meal) : null;
      let recipeName = displayedRecipeName(meal, completed);
      let foodIds = completed ? completed.foodIds || [] : meal.foodIds || [];
      decorateMealRecipeTitle(mealNodes[index], recipeName, foodIds);
    });
  }

  function decoratePlanRecipeTitles() {
    let days = planDisplayDays(visiblePlanStart(), 7);
    let dayNodes = [
      ...document.querySelectorAll("#blockPlan > .day-card, #blockPlan > .completed-day"),
    ];
    days.forEach((day, dayIndex) => {
      let dayNode = dayNodes[dayIndex];
      if (!dayNode) return;
      let activeMeals = (day.meals || []).filter((meal) => meal.active);
      let mealNodes = [...dayNode.querySelectorAll(".mealbox, .manual-meal")];
      activeMeals.forEach((meal, mealIndex) => {
        let completed = typeof completedLog === "function"
          ? completedLog(day.date, meal.meal)
          : null;
        let recipeName = displayedRecipeName(meal, completed);
        let foodIds = completed ? completed.foodIds || [] : meal.foodIds || [];
        decorateMealRecipeTitle(mealNodes[mealIndex], recipeName, foodIds);
      });
    });
  }

  let originalRenderHome = renderHome;
  renderHome = function renderHomeWithPlannedRecipeDetails() {
    originalRenderHome();
    decorateHomeRecipeTitles();
  };

  let originalRenderPlan = renderPlan;
  renderPlan = function renderPlanWithPlannedRecipeDetails() {
    originalRenderPlan();
    decoratePlanRecipeTitles();
  };

  function recipeTarget(event) {
    return event.target?.closest?.("[data-planned-recipe-name]") || null;
  }

  function targetFoodIds(target) {
    return String(target?.dataset?.plannedRecipeFoodIds || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  document.addEventListener("click", (event) => {
    let target = recipeTarget(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    openPlannedRecipeDetails(target.dataset.plannedRecipeName, targetFoodIds(target));
  });

  document.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    let target = recipeTarget(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    openPlannedRecipeDetails(target.dataset.plannedRecipeName, targetFoodIds(target));
  });

  root.__plannedRecipeDetails = {
    openPlannedRecipeDetails,
    decorateHomeRecipeTitles,
    decoratePlanRecipeTitles,
  };
})(typeof window !== "undefined" ? window : globalThis);
