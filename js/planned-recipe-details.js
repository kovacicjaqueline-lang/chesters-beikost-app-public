"use strict";

/* Geplante Rezepte direkt aus Heute und Wochenplan öffnen.
 * Die vorhandene Recipe-V2-Darstellung bleibt die einzige Quelle für Rezeptdetails.
 */
(function plannedRecipeDetailsModule(root) {
  function recipeAliasValuesLocal(recipe) {
    let legacy = Array.isArray(recipe?.legacyNames)
      ? recipe.legacyNames
      : recipe?.legacyNames
        ? [recipe.legacyNames]
        : [];
    let search = Array.isArray(recipe?.searchAliases)
      ? recipe.searchAliases
      : recipe?.searchAliases
        ? String(recipe.searchAliases).split(",")
        : [];
    return [...legacy, ...search].map((name) => String(name).trim()).filter(Boolean);
  }

  function storedRecipeRecord(name, recipes = []) {
    let stored = String(name || "").trim();
    if (!stored) return null;
    return (recipes || []).find((recipe) =>
      recipe?.name === stored || recipeAliasValuesLocal(recipe).includes(stored)
    ) || null;
  }

  function recipeStateForStoredName(name, recipes = [], states = []) {
    let stored = String(name || "").trim();
    if (!stored) return null;
    let canonical = storedRecipeRecord(stored, recipes)?.name || stored;
    return (states || []).find((recipe) => recipe?.name === canonical) ||
      (states || []).find((recipe) => recipeAliasValuesLocal(recipe).includes(stored)) ||
      null;
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

  function markRecipeTitle(node, recipeName) {
    if (!node || !recipeName) return node;
    node.dataset.plannedRecipeName = String(recipeName);
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

  function markCompletedRecipeTitle(node, recipeName) {
    if (!node || !recipeName) return null;
    if (node.querySelector?.("[data-planned-recipe-name]"))
      return node.querySelector("[data-planned-recipe-name]");
    let text = String(node.textContent || "");
    let index = text.lastIndexOf(recipeName);
    if (index < 0) return markRecipeTitle(node, recipeName);
    let prefix = text.slice(0, index);
    let doc = node.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!doc?.createElement) return markRecipeTitle(node, recipeName);
    node.textContent = "";
    if (prefix && doc.createTextNode) node.appendChild(doc.createTextNode(prefix));
    let recipeTarget = doc.createElement("span");
    recipeTarget.textContent = recipeName;
    node.appendChild(recipeTarget);
    return markRecipeTitle(recipeTarget, recipeName);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      recipeAliasValuesLocal,
      storedRecipeRecord,
      recipeStateForStoredName,
      markRecipeTitle,
      markCompletedRecipeTitle,
    };
  }

  if (
    typeof document === "undefined" ||
    typeof renderHome !== "function" ||
    typeof renderPlan !== "function"
  ) return;

  function currentRecipeState(storedName) {
    let recipes = typeof RECIPES !== "undefined" ? RECIPES : [];
    let previousQuery = typeof recipeQuery !== "undefined" ? recipeQuery : "";
    let states = [];
    try {
      if (typeof recipeQuery !== "undefined") recipeQuery = String(storedName || "");
      states = typeof recipeStates === "function" ? recipeStates() : [];
    } finally {
      if (typeof recipeQuery !== "undefined") recipeQuery = previousQuery;
    }
    return recipeStateForStoredName(storedName, recipes, states);
  }

  function openPlannedRecipeDetails(storedName) {
    let recipe = currentRecipeState(storedName);
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

  function decorateMealRecipeTitle(mealNode, recipeName) {
    if (!mealNode || !recipeName) return;
    let completedTitle = mealNode.querySelector(".completed-title");
    if (completedTitle) {
      markCompletedRecipeTitle(completedTitle, recipeName);
      return;
    }
    markRecipeTitle(
      mealNode.querySelector(".dish-title, .manual-meal-title"),
      recipeName,
    );
  }

  function decorateHomeRecipeTitles() {
    let on = today();
    let day = buildDays(on, 1)[0];
    let activeMeals = (day?.meals || []).filter((meal) => meal.active && meal.focusId);
    let mealNodes = [...document.querySelectorAll("#todayCard .mealbox")];
    activeMeals.forEach((meal, index) => {
      let log = typeof completedLog === "function" ? completedLog(on, meal.meal) : null;
      let storedRecipeName = log?.recipeName || meal.recipeName || "";
      decorateMealRecipeTitle(mealNodes[index], storedRecipeName);
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
        let log = typeof completedLog === "function"
          ? completedLog(day.date, meal.meal)
          : null;
        let storedRecipeName = log?.recipeName || meal.recipeName || "";
        decorateMealRecipeTitle(mealNodes[mealIndex], storedRecipeName);
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

  document.addEventListener("click", (event) => {
    let target = recipeTarget(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    openPlannedRecipeDetails(target.dataset.plannedRecipeName);
  });

  document.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    let target = recipeTarget(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    openPlannedRecipeDetails(target.dataset.plannedRecipeName);
  });

  root.__plannedRecipeDetails = {
    openPlannedRecipeDetails,
    decorateHomeRecipeTitles,
    decoratePlanRecipeTitles,
  };
})(typeof window !== "undefined" ? window : globalThis);
