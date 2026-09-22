"use strict";

/* Gemeinsamer Katalog-Tab für Lebensmittel und Rezepte.
 * Rezeptdaten und Planner bleiben unverändert; Katalogdetails nutzen den gemeinsamen Dialog.
 */
(function catalogNavigationModule() {
  if (typeof document === "undefined") return;

  const MODE_FOODS = "foods";
  const MODE_RECIPES = "recipes";

  function decodeCatalogValue(value) {
    try { return decodeURIComponent(value || ""); } catch { return value || ""; }
  }

  function openCatalogFoodLog(foodId) {
    let item = typeof food === "function" ? food(foodId) : null;
    if (!item || typeof openLog !== "function") return;
    let itemRank = typeof rank === "function" ? rank(item) : 0;
    let learning = itemRank < 2;
    let outcome = learning ? (itemRank >= 1 ? "eaten" : "tried") : "eaten";
    openLog({
      date: today(),
      meal: "",
      focusId: item.id,
      foodIds: [item.id],
      baseFoodIds: learning ? [] : [item.id],
      sampleFoodIds: learning ? [item.id] : [],
      recipeName: "",
      recipeInventoryId: "",
      entryType: "food",
      foodOutcomes: { [item.id]: outcome },
    });
  }

  function openCatalogRecipeLog(recipeName) {
    let recipe = typeof recipeByName === "function" ? recipeByName(recipeName) : null;
    if (!recipe || typeof openLog !== "function") return;
    openLog({
      date: today(),
      meal: "",
      focusId: "",
      foodIds: [],
      baseFoodIds: [],
      sampleFoodIds: [],
      recipeName: recipe.name,
      recipeInventoryId: "",
      entryType: "food",
      foodOutcomes: {},
    });
    let choice = typeof logRecipeChoiceState === "function"
      ? logRecipeChoiceState(recipe)
      : { variantIndex: 0, oneOfId: "", milkChoiceId: "" };
    choice.__explicit = {};
    choice.confirmed = typeof logRecipeNeedsExplicitChoice === "function"
      ? !logRecipeNeedsExplicitChoice(recipe)
      : true;
    pendingLog.__recipeChoice = choice;
    if (typeof applyLogRecipeChoice === "function") applyLogRecipeChoice(recipe, choice);
    if (typeof renderLogForm === "function") renderLogForm();
    if (!choice.confirmed && typeof focusFirstRequiredRecipeChoice === "function") {
      queueMicrotask(focusFirstRequiredRecipeChoice);
    }
  }

  globalThis.openCatalogFoodLog = openCatalogFoodLog;
  globalThis.openCatalogRecipeLog = openCatalogRecipeLog;

  function recipeCatalogStructuredLabels(recipe) {
    return [
      ...(recipe?.requires || []),
      ...((recipe?.alternatives || []).flat()),
      ...(recipe?.oneOf || []),
      ...(recipe?.milkChoices || []),
    ];
  }

  function recipeCatalogExactFood(query) {
    if (typeof FOOD_DB === "undefined" || typeof foodByName !== "function") return null;
    return foodByName(query, FOOD_DB);
  }

  function recipeCatalogContainsFood(recipe, targetFood) {
    if (!targetFood || typeof FOOD_DB === "undefined" || typeof recipeFoodFromStructuredLabel !== "function") return false;
    return recipeCatalogStructuredLabels(recipe).some((label) =>
      recipeFoodFromStructuredLabel(label, FOOD_DB)?.id === targetFood.id,
    );
  }

  function recipeCatalogFoodMealEligible(label, meal) {
    if (typeof FOOD_DB === "undefined" || typeof recipeFoodFromStructuredLabel !== "function") return false;
    const item = recipeFoodFromStructuredLabel(label, FOOD_DB);
    return !!item && Array.isArray(item.meals) && item.meals.includes(meal);
  }

  function recipeCatalogChoiceEligible(labels, meal) {
    return !labels?.length || labels.some((label) => recipeCatalogFoodMealEligible(label, meal));
  }

  function recipeCatalogRequirementSetEligible(labels, meal) {
    return (labels || []).every((label) => recipeCatalogFoodMealEligible(label, meal));
  }

  function recipeCatalogMealEligible(recipe, meal) {
    const requirementSets = [
      recipe?.requires || [],
      ...(recipe?.alternatives || []),
    ];
    if (!requirementSets.some((labels) => recipeCatalogRequirementSetEligible(labels, meal))) return false;
    if (!recipeCatalogChoiceEligible(recipe?.oneOf || [], meal)) return false;
    if (!recipeCatalogChoiceEligible(recipe?.milkChoices || [], meal)) return false;
    return true;
  }

  function recipeCatalogMainMealEligible(recipe) {
    return recipeCatalogMealEligible(recipe, "lunch") || recipeCatalogMealEligible(recipe, "dinner");
  }

  function recipeCatalogPantryMatches(recipe) {
    const stock = globalThis.__recipeFrozenIngredientStock;
    if (stock?.recipeMatchesIngredientStock && typeof inventoryPortions === "function") {
      return stock.recipeMatchesIngredientStock(
        recipe,
        state?.foods || [],
        state?.pantry || {},
        inventoryPortions,
      );
    }
    return (recipe?.requires || []).every((name) => {
      const item = state?.foods?.find((foodItem) => foodItem.name === name);
      if (!item) return false;
      const portions = typeof inventoryPortions === "function" ? inventoryPortions(item?.id) : 0;
      return portions > 0 || state?.pantry?.[item.id];
    });
  }

  const RECIPE_TYPE_FILTERS = new Set(["porridge", "pancakes", "balls", "family", "baking"]);

  function installRecipeMealFilters() {
    const categoryField = document.getElementById("recipeFilter")?.closest(".recipe-filter-field");
    if (!categoryField || document.getElementById("recipeMealFilter")) return;
    const mealField = document.createElement("div");
    mealField.className = "field recipe-meal-filter-field";
    mealField.innerHTML = `<label>Mahlzeit</label><div class="seg recipe-meal-filters" id="recipeMealFilter" role="group" aria-label="Rezeptmahlzeit"><button type="button" data-recipe-meal="breakfast">Frühstück</button><button type="button" data-recipe-meal="main">Hauptmahlzeit</button><button type="button" data-recipe-meal="snack">Snack</button></div>`;
    categoryField.after(mealField);
  }

  function recipeCatalogSearchTerms(recipe) {
    const aliases = typeof recipeAliasValues === "function" ? recipeAliasValues(recipe) : [];
    const structuredTerms = recipeCatalogStructuredLabels(recipe).flatMap((label) => {
      if (typeof recipeFoodFromStructuredLabel !== "function" || typeof FOOD_DB === "undefined" || typeof foodAliasTerms !== "function") return [label];
      const item = recipeFoodFromStructuredLabel(label, FOOD_DB);
      return item ? [item.name, ...foodAliasTerms(item)] : [label];
    });
    return [recipe?.name || "", ...aliases, ...(recipe?.variantLabels || []), ...structuredTerms].filter(Boolean);
  }

  function recipeCatalogSearchMatches(recipe, query, fullSearchText = "") {
    const normalizedQuery = normalizeName(query || "");
    if (!normalizedQuery) return true;
    const exactFood = recipeCatalogExactFood(query);
    if (exactFood) return recipeCatalogContainsFood(recipe, exactFood);
    const exactOrPrefixMatch = recipeCatalogSearchTerms(recipe).some((term) => {
      const normalizedTerm = normalizeName(term || "");
      if (!normalizedTerm) return false;
      if (normalizedTerm === normalizedQuery || normalizedTerm.startsWith(normalizedQuery)) return true;
      return normalizedTerm.split(" ").filter(Boolean).some((word) => word === normalizedQuery || word.startsWith(normalizedQuery));
    });
    if (exactOrPrefixMatch) return true;
    if (normalizedQuery.length < 3) return false;
    return normalizeName(fullSearchText).includes(normalizedQuery);
  }

  function installIngredientAwareRecipeSearch() {
    if (typeof renderPrep !== "function" || typeof recipeSearchText !== "function") return;
    const baseRenderPrep = renderPrep;
    renderPrep = function renderPrepWithIngredientAwareRecipeSearch(...args) {
      const currentQuery = typeof recipeQuery !== "undefined" ? recipeQuery : "";
      if (!normalizeName(currentQuery)) return baseRenderPrep.apply(this, args);
      const baseRecipeSearchText = recipeSearchText;
      recipeSearchText = (recipe) => {
        const fullSearchText = baseRecipeSearchText(recipe);
        return recipeCatalogSearchMatches(recipe, currentQuery, fullSearchText) ? fullSearchText : "";
      };
      try { return baseRenderPrep.apply(this, args); }
      finally { recipeSearchText = baseRecipeSearchText; }
    };
  }

  function recipeCatalogAvailabilityMatches(recipe) {
    if (recipeFilter === "available") return !!recipe.unlocked;
    if (recipeFilter === "pantry") return recipeCatalogPantryMatches(recipe);
    if (recipeFilter === "freezer") return !!recipe.freezable;
    if (recipeFilter === "all") return true;
    return !!recipe.unlocked || !!recipe.almost;
  }

  function recipeCatalogMealMatches(recipe) {
    if (!recipeMealFilter) return true;
    if (recipeMealFilter === "breakfast") return recipeCatalogMealEligible(recipe, "breakfast");
    if (recipeMealFilter === "main") return recipeCatalogMainMealEligible(recipe);
    return (recipe.tags || []).some((tag) => normalizeName(tag) === "snack");
  }

  function recipeCatalogExtraMatches(recipe) {
    if (recipeExtraFilters.has("freezer") && !recipe.freezable) return false;
    const types = [...recipeExtraFilters].filter((key) => RECIPE_TYPE_FILTERS.has(key));
    return !types.length || types.includes(recipe.category);
  }

  function recipeCatalogMatches(recipe) {
    return recipeCatalogAvailabilityMatches(recipe) && recipeCatalogMealMatches(recipe) && recipeCatalogExtraMatches(recipe);
  }

  function syncRecipeFilterUi(resultCount = null) {
    document.querySelectorAll("#recipeFilter [data-recipe-filter]").forEach((button) =>
      button.classList.toggle("active", button.dataset.recipeFilter === recipeFilter));
    document.querySelectorAll("#recipeMealFilter [data-recipe-meal]").forEach((button) =>
      button.classList.toggle("active", button.dataset.recipeMeal === recipeMealFilter));
    document.querySelectorAll("[data-recipe-extra-filter]").forEach((button) =>
      button.classList.toggle("active", recipeExtraFilters.has(button.dataset.recipeExtraFilter)));
    const matchSummary = document.querySelector("[data-recipe-match-summary]");
    if (matchSummary) {
      const labels = {
        available: "Jetzt passend",
        almost: "Fast passend",
        pantry: "Mit Vorrat",
        freezer: "Einfrierbar",
        all: "Alle",
      };
      matchSummary.textContent = labels[recipeFilter] || "Fast passend";
    }
    const mealSummary = document.querySelector("[data-recipe-meal-summary]");
    if (mealSummary) {
      const labels = { breakfast: "Frühstück", main: "Hauptmahlzeit", snack: "Snack" };
      mealSummary.textContent = labels[recipeMealFilter] || "Mahlzeit";
    }
    const more = document.getElementById("recipeMoreFilters");
    if (more) more.textContent = recipeExtraFilters.size ? `Filter (${recipeExtraFilters.size})` : "Filter";
    const apply = document.getElementById("recipeFilterApply");
    if (apply && Number.isFinite(resultCount)) apply.textContent = `${resultCount} Rezept${resultCount === 1 ? "" : "e"} anzeigen`;
  }

  function closeRecipeFilterSheet() {
    const sheet = document.getElementById("recipeFilterSheet");
    if (sheet) sheet.hidden = true;
  }

  function bindRecipeFilterControls() {
    document.querySelectorAll("#recipeFilter [data-recipe-filter]").forEach((button) => {
      button.onclick = () => {
        recipeFilter = button.dataset.recipeFilter;
        button.closest("details")?.removeAttribute("open");
        renderRecipeCatalog();
      };
    });
    document.querySelectorAll("#recipeMealFilter [data-recipe-meal]").forEach((button) => {
      button.onclick = () => {
        recipeMealFilter = recipeMealFilter === button.dataset.recipeMeal ? "" : button.dataset.recipeMeal;
        button.closest("details")?.removeAttribute("open");
        renderRecipeCatalog();
      };
    });
    document.getElementById("recipeMoreFilters")?.addEventListener("click", () => {
      document.getElementById("recipeFilterSheet").hidden = false;
      syncRecipeFilterUi();
    });
    document.querySelectorAll("[data-recipe-filter-close]").forEach((button) => button.onclick = closeRecipeFilterSheet);
    document.getElementById("recipeFilterApply")?.addEventListener("click", closeRecipeFilterSheet);
    document.getElementById("recipeFilterReset")?.addEventListener("click", () => {
      recipeExtraFilters.clear();
      renderRecipeCatalog();
    });
    document.querySelectorAll("[data-recipe-extra-filter]").forEach((button) => {
      button.onclick = () => {
        const key = button.dataset.recipeExtraFilter;
        if (recipeExtraFilters.has(key)) recipeExtraFilters.delete(key);
        else recipeExtraFilters.add(key);
        renderRecipeCatalog();
      };
    });
  }

  function renderRecipeCatalog() {
    const search = document.getElementById("recipeSearch");
    if (!document.getElementById("recipeList")) return;
    if (search) search.value = recipeQuery;
    const query = normalizeName(recipeQuery);
    const allRecipeStates = typeof viewRenderRecipeStates === "function" ? viewRenderRecipeStates() : recipeStates();
    const recipes = allRecipeStates.filter((recipe) => {
      if (!recipeCatalogMatches(recipe)) return false;
      if (!query) return true;
      const fullSearchText = typeof recipeSearchText === "function" ? recipeSearchText(recipe) : "";
      return recipeCatalogSearchMatches(recipe, recipeQuery, fullSearchText);
    });
    const countBox = document.getElementById("recipeCount");
    if (countBox) countBox.textContent = `${recipes.length} Rezept${recipes.length === 1 ? "" : "e"}`;
    syncRecipeFilterUi(recipes.length);
    document.getElementById("recipeList").innerHTML = recipes.length
      ? recipes.map((recipe, index) => renderRecipeCard(recipe, { priorityImage: index < 4, showDetails: false })).join("")
      : '<div class="empty ds-empty"><div>Keine Rezepte für diese Auswahl gefunden.</div><button class="btn" id="recipeEmptyAction" type="button">Filter zurücksetzen</button></div>';
    document.getElementById("recipeEmptyAction")?.addEventListener("click", () => {
      recipeQuery = "";
      recipeFilter = "almost";
      recipeMealFilter = "";
      recipeExtraFilters.clear();
      renderRecipeCatalog();
    });
    if (search) search.oninput = (event) => { recipeQuery = event.target.value; renderRecipeCatalog(); };
    if (typeof bindRecipeStockButtons === "function") bindRecipeStockButtons();
    const recipeByCatalogName = new Map(recipes.map((recipe) => [recipe.name, recipe]));
    document.querySelectorAll(".recipe-card-v2 > summary").forEach((summary) => {
      summary.onclick = (event) => {
        event.preventDefault();
        const recipe = recipeByCatalogName.get(decodeCatalogValue(summary.closest(".recipe-card-v2")?.dataset.recipe));
        if (recipe && typeof showRecipeInfo === "function") showRecipeInfo(recipe);
      };
    });
    globalThis.MobileUiLifecycle?.afterRender("foods", { source: "recipe-catalog" });
  }

  function setCatalogMode(mode) {
    const foodsSection = document.getElementById("foodsCatalogSection");
    const recipesSection = document.getElementById("recipesSection");
    const recipesDetails = document.getElementById("recipesDetails");
    const switcher = document.getElementById("catalogSwitch");
    if (!foodsSection || !recipesSection || !switcher) return;

    const nextMode = mode === MODE_RECIPES ? MODE_RECIPES : MODE_FOODS;
    foodsSection.hidden = nextMode !== MODE_FOODS;
    recipesSection.hidden = nextMode !== MODE_RECIPES;
    if (nextMode === MODE_RECIPES && recipesDetails) recipesDetails.open = true;

    switcher.querySelectorAll("[data-catalog-mode]").forEach((button) => {
      const active = button.dataset.catalogMode === nextMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function installCatalogAwareViewRenderer() {
    if (typeof renderView !== "function") return;
    const baseRenderView = renderView;
    renderView = function catalogAwareRenderView(id) {
      if (id === "foods" && document.getElementById("recipesSection")?.hidden === false) {
        return renderRecipeCatalog();
      }
      return baseRenderView.apply(this, arguments);
    };
  }

  function openRecipeCatalog(filter = "") {
    if (filter === "freezer") {
      recipeExtraFilters.clear();
      recipeExtraFilters.add("freezer");
      recipeFilter = "all";
      recipeMealFilter = "";
    } else if (filter && typeof recipeFilter !== "undefined") {
      recipeFilter = filter;
    }
    setCatalogMode(MODE_RECIPES);
    showView("foods");
    renderRecipeCatalog();
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function fixLegacyNavigationCopy() {
    const prepEmpty = document.querySelector("#cookNow .empty");
    if (prepEmpty && /Unter „Mehr“/i.test(prepEmpty.textContent || "")) {
      prepEmpty.textContent = "Noch kein Rezept vollständig freigeschaltet. Unter „Rezepte“ siehst du fast passende Rezepte.";
    }

    const auditRow = [...document.querySelectorAll("#auditList .checkline")].find((node) =>
      /Protokoll und Rezepte liegen unter Mehr/.test(node.textContent || ""),
    );
    if (!auditRow) return;

    const ok = !!document.querySelector("#more #logDetails") &&
      !!document.querySelector("#foods #recipesDetails") &&
      !document.querySelector("#more #recipesDetails");
    auditRow.innerHTML = `<span class="statusdot ${ok ? "good" : "warn"}"></span><div><b>${ok ? "Geprüft" : "Prüfen"}:</b> Protokoll liegt unter Mehr; Rezepte liegen im gemeinsamen Lebensmittel-Tab</div>`;
  }

  installRecipeMealFilters();
  bindRecipeFilterControls();
  installIngredientAwareRecipeSearch();
  installCatalogAwareViewRenderer();

  const switcher = document.getElementById("catalogSwitch");
  switcher?.querySelectorAll("[data-catalog-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.catalogMode;
      setCatalogMode(mode);
      if (mode === MODE_RECIPES) renderRecipeCatalog();
      else if (typeof renderFoods === "function") renderFoods();
    });
  });

  const recipesDetails = document.getElementById("recipesDetails");
  if (recipesDetails) {
    recipesDetails.open = true;
    recipesDetails.addEventListener("toggle", () => {
      if (!recipesDetails.open) recipesDetails.open = true;
    });
    const heading = recipesDetails.querySelector(":scope > summary");
    if (heading) {
      heading.tabIndex = -1;
      heading.setAttribute("role", "heading");
      heading.setAttribute("aria-level", "2");
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("button");
    if (!button) return;

    if (button.id === "openRecipes" || button.id === "prepOpenRecipes" || button.id === "prepOpenFreezerRecipes") {
      event.preventDefault();
      event.stopImmediatePropagation();
      openRecipeCatalog(button.id === "prepOpenFreezerRecipes" ? "freezer" : "");
      return;
    }

    if (button.matches('nav button[data-view="foods"]')) {
      setCatalogMode(MODE_FOODS);
    }
  }, true);

  // Die Korrekturen betreffen ausschließlich Inhalte, die nach einem Prep- oder
  // Mehr-Render entstehen. Ein globaler body/subtree-Observer lief dagegen bei
  // jeder Katalog-Mutation mit und machte Suche und Filter unnötig teuer.
  globalThis.MobileUiLifecycle?.onRender?.("prep", fixLegacyNavigationCopy);
  globalThis.MobileUiLifecycle?.onRender?.("more", fixLegacyNavigationCopy);

  setCatalogMode(MODE_FOODS);
  fixLegacyNavigationCopy();
})();

/* MOBILE-A/B: gemeinsame Mobile-First-Shell und fokussierte Heute-Ansicht.
 * Fachliche Planung, Vorrat, Rezepte und Persistenz bleiben in den bestehenden Modulen.
 */
(function mobileFoundationModule(root) {
  if (typeof document === "undefined") return;
  if (root.__mobileFoundationInstalled) return;
  if (typeof renderHome !== "function" || typeof showView !== "function" || !root.MobileUiLifecycle?.onRender || !root.MobileUiLifecycle?.onViewChange) return;

  root.__mobileFoundationInstalled = true;
  document.body.classList.add("mobile-foundation");

  const VIEW_TITLES = Object.freeze({
    home: "Heute",
    plan: "Plan",
    prep: "Prep",
    foods: "Beikost",
    more: "Mehr",
  });

  function friendlyTextureLabel(stage) {
    return ({
      1: "glatt oder fein",
      2: "fein zerdrückt",
      3: "weich mit kleinen Stückchen",
      4: "weiche Familienkost",
    })[Number(stage)] || "glatt oder fein";
  }

  function installCompactAppBar() {
    const header = document.querySelector(".app-header");
    if (!header || header.dataset.mobileFoundation === "true") return;
    header.dataset.mobileFoundation = "true";
    header.innerHTML = `<div class="app-bar-copy"><span class="app-bar-brand">Beikost</span><h1 id="appBarTitle">Heute</h1></div>`;
  }

  function installMobileCompatibilityStyles() {
    if (document.querySelector('style[data-mobile-foundation-compat="v4"]')) return;
    document.querySelector('style[data-mobile-foundation-compat="v1"]')?.remove();
    document.querySelector('style[data-mobile-foundation-compat="v2"]')?.remove();
    document.querySelector('style[data-mobile-foundation-compat="v3"]')?.remove();
    const style = document.createElement("style");
    style.dataset.mobileFoundationCompat = "v4";
    style.textContent = `
body.mobile-foundation nav button {
  min-height: 44px;
}
body.mobile-foundation #todayCard {
  touch-action: pan-y;
  overscroll-behavior-x: contain;
}
body.mobile-foundation #todayCard .today-focus-meal > .mealbox {
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
body.mobile-foundation #todayCard .today-timeline-completed {
  min-width: 0;
}
body.mobile-foundation #todayCard .today-timeline-completed > .mealbox.completed {
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
body.mobile-foundation #todayCard .today-timeline-completed .completed-body-direct {
  margin: 4px 0 0 !important;
}
body.mobile-foundation #todayCard .today-timeline-row.completed .editCompletedLog.timeline-edit {
  min-height: 44px !important;
}
body.mobile-foundation #todayCard .today-timeline-actions {
  grid-column: 2 / -1;
  min-width: 0;
  width: 100%;
}
body.mobile-foundation #todayCard .today-timeline-actions .meal-plan-actions {
  margin-top: 0;
}
body.mobile-foundation #genericModal .sheet {
  overflow-anchor: none;
}
`;
    document.head.appendChild(style);
  }

  function installMealEditorSearchScrollGuard() {
    if (document.documentElement.dataset.mobileMealEditorScrollGuard === "true") return;
    document.documentElement.dataset.mobileMealEditorScrollGuard = "true";
    let snapshot = null;

    function captureSnapshot(field) {
      if (field?.id !== "mealSelectorSearch") return null;
      const sheet = field.closest(".sheet");
      if (!sheet) return null;
      if (!snapshot || snapshot.field !== field || snapshot.sheet !== sheet) {
        snapshot = { field, sheet, scrollTop: sheet.scrollTop };
      }
      return snapshot;
    }

    function restoreSnapshot() {
      if (!snapshot) return;
      const { field, sheet, scrollTop } = snapshot;
      if (!field.isConnected || !sheet.isConnected || field.closest(".sheet") !== sheet) {
        snapshot = null;
        return;
      }
      if (sheet.scrollTop !== scrollTop) sheet.scrollTop = scrollTop;
    }

    function holdSnapshot(field) {
      if (!captureSnapshot(field)) return;
      restoreSnapshot();
      queueMicrotask(restoreSnapshot);
      setTimeout(restoreSnapshot, 0);
      requestAnimationFrame(restoreSnapshot);
    }

    document.addEventListener("keydown", (event) => {
      captureSnapshot(event.target);
    }, true);

    document.addEventListener("beforeinput", (event) => {
      captureSnapshot(event.target);
    }, true);

    document.addEventListener("input", (event) => {
      holdSnapshot(event.target);
    }, true);

    document.addEventListener("keyup", (event) => {
      if (event.target?.id === "mealSelectorSearch") holdSnapshot(event.target);
    }, true);

    document.addEventListener("scroll", (event) => {
      if (!snapshot || event.target !== snapshot.sheet || document.activeElement !== snapshot.field) return;
      restoreSnapshot();
    }, true);

    document.addEventListener("focusout", (event) => {
      if (event.target?.id !== "mealSelectorSearch" || snapshot?.field !== event.target) return;
      restoreSnapshot();
      snapshot = null;
    }, true);
  }

  function updateAppBar(viewId = "") {
    const title = document.getElementById("appBarTitle");
    if (!title) return;
    const active = viewId || document.querySelector(".view.active")?.id || "home";
    title.textContent = VIEW_TITLES[active] || "Beikost";
  }

  installCompactAppBar();
  installMobileCompatibilityStyles();
  installMealEditorSearchScrollGuard();
  updateAppBar("home");

  root.MobileUiLifecycle.onViewChange(({ viewId }) => {
    updateAppBar(viewId);
    if (viewId === "home") root.__mobileTodaySelectedDate = today();
  });

  function bindRenderedMealActions(container) {
    if (!container?.querySelectorAll) return;
    container.querySelectorAll(".logMeal").forEach((button) => {
      button.onclick = () => openLog(JSON.parse(decodeURIComponent(button.dataset.plan)));
    });
    container.querySelectorAll(".replaceMeal").forEach((button) => {
      button.onclick = () => chooseReplacement(button.dataset.date, button.dataset.meal, button.dataset.focus);
    });
    container.querySelectorAll(".moveMeal").forEach((button) => {
      button.onclick = () => moveMealTomorrow(JSON.parse(decodeURIComponent(button.dataset.movePayload)));
    });
    container.querySelectorAll(".editCompletedLog").forEach((button) => {
      button.onclick = () => editLogEntry(button.dataset.log);
    });
    container.querySelectorAll(".meal-lock").forEach((button) => {
      button.onclick = () => toggleMealLock(
        button.dataset.lockDate,
        button.dataset.lockMeal,
        JSON.parse(decodeURIComponent(button.dataset.lockPayload)),
      );
    });
    if (typeof bindInactiveMealActions === "function") bindInactiveMealActions();
    root.__mealCardUnification?.simplifyMealCards?.(container);
  }

  function ensureRenderedRandomSwapAction(container, date, meal) {
    if (!root.__plannerRandomSwap?.randomizePlannedMeal || !container || !date || !meal) return;
    if (meal.manualAdded || mealIsCompleted(date, meal.meal)) return;
    if (state.planLocks?.[`${date}|${meal.meal}`]?.followUpFoodId) return;
    const box = container.matches?.(".mealbox") ? container : container.querySelector?.(".mealbox");
    if (!box || box.querySelector(".randomizeMeal")) return;
    const actions = box.querySelector("details.meal-plan-actions .meal-plan-secondary-actions .actionbar") ||
      box.querySelector("details.meal-plan-actions .actionbar");
    if (!actions) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn secondary randomizeMeal";
    button.dataset.randomDate = date;
    button.dataset.randomMeal = meal.meal;
    button.textContent = "↻ Tauschen";
    actions.prepend(button);
  }

  function timelineMealCompatibility(day, meal) {
    const host = document.createElement("div");
    host.innerHTML = renderMeal(day, meal);
    ensureRenderedRandomSwapAction(host, day.date, meal);

    const details = host.querySelector("details.meal-plan-actions");
    const logButton = host.querySelector(".logMeal[data-plan]");
    if (logButton) {
      logButton.hidden = true;
      logButton.tabIndex = -1;
      logButton.setAttribute("aria-hidden", "true");
      logButton.style.display = "none";
    }
    return {
      actionsHtml: details?.outerHTML || "",
      logAnchorHtml: logButton?.outerHTML || "",
    };
  }

  function openTextureSettings() {
    const stage = Number(state.settings.textureStage) || 1;
    const successes = textureSuccessCount(stage);
    const previous = stage > 1
      ? `<button class="btn secondary" id="todayTextureBack" type="button">Zurück zu Stufe ${stage - 1}</button>`
      : "";
    const next = stage < 4
      ? `<button class="btn" id="todayTextureNext" type="button">Stufe ${stage + 1} testen</button>`
      : "";
    openGeneric(
      "Konsistenz anpassen",
      `<div class="notice olive"><b>${esc(friendlyTextureLabel(stage))}</b><div class="small">Aktuelle Stufe ${stage} von 4 · ${successes} positive Texturerfahrung${successes === 1 ? "" : "en"}</div></div><p class="small">Die Konsistenz bleibt unabhängig von Beikostphase und gegessener Menge.</p><div class="sticky-form-actions ds-actionbar">${previous}${next}</div>`,
    );
    document.getElementById("todayTextureBack")?.addEventListener("click", () => setTextureStage(stage - 1));
    document.getElementById("todayTextureNext")?.addEventListener("click", () => openTextureAdvance(stage + 1));
  }

  function renderDayContext() {
    const card = document.getElementById("phaseCard");
    const details = card?.querySelector("details.home-control-details");
    const summary = details?.querySelector(":scope > summary");
    const label = summary?.querySelector("b");
    const eyebrow = summary?.querySelector("small");
    const body = details?.querySelector(".home-control-body");
    if (!card || !details || !summary || !label || !body) return;

    const phase = currentPhase();
    const stage = Number(state.settings.textureStage) || 1;
    card.className = "today-context";
    details.classList.add("today-context-details");
    eyebrow.textContent = "Tageskontext";
    label.textContent = `${PHASES[phase].label} · Konsistenz: ${friendlyTextureLabel(stage)}`;
    summary.querySelector(".pill")?.remove();

    body.querySelector(".today-texture-control")?.remove();
    const textureControl = document.createElement("div");
    textureControl.className = "today-texture-control";
    textureControl.innerHTML = `<div><span class="small">Konsistenz</span><b>${esc(friendlyTextureLabel(stage))}</b></div><button class="btn secondary smallbtn" id="todayTextureSettings" type="button">Ändern</button>`;
    body.appendChild(textureControl);
    textureControl.querySelector("#todayTextureSettings")?.addEventListener("click", openTextureSettings);
  }

  function timelineRow(day, meal, focusMeal) {
    const done = completedLog(day.date, meal.meal);
    const isNext = !done && focusMeal?.meal === meal.meal;
    if (done) {
      return `<div class="today-timeline-row completed"><span class="timeline-marker" aria-hidden="true">✓</span><div class="today-timeline-completed">${renderMeal(day, meal)}</div><div class="today-timeline-state"><span>Erledigt</span></div></div>`;
    }
    const stateClass = isNext ? "next" : "later";
    const marker = isNext ? "●" : "○";
    const statusText = isNext ? "Als Nächstes" : "Später";
    const title = mealDisplayTitle(meal);
    const compatibility = isNext ? { actionsHtml: "", logAnchorHtml: "" } : timelineMealCompatibility(day, meal);
    const actions = compatibility.actionsHtml
      ? `<div class="today-timeline-actions">${compatibility.actionsHtml}</div>`
      : "";
    return `<div class="today-timeline-row ${stateClass}"><span class="timeline-marker" aria-hidden="true">${marker}</span><div class="today-timeline-copy"><b>${esc(mealName(meal.meal))}</b><span>${esc(title)}</span></div><div class="today-timeline-state"><span>${statusText}</span></div>${compatibility.logAnchorHtml}${actions}</div>`;
  }

  function isEverydayRecipesMode() {
    return root.AppFocusMode?.current?.() === root.AppFocusMode?.MODE_EVERYDAY;
  }

  function everydayMealTaskHtml(meal) {
    const type = String(meal?.type || "");
    const taskIds = [...(meal?.sampleFoodIds || [])];
    if (!taskIds.length && meal?.focusId && /neu|allergen/i.test(type)) taskIds.push(meal.focusId);
    const samples = taskIds.map((id) => food(id)).filter(Boolean);
    if (!samples.length) return "";

    const allergen = /allergen/i.test(type) || samples.some((item) => item.allergenGroup);
    const repeat = /wiederholen|repeat/i.test(type);
    const action = repeat ? "wiederholen" : "einführen";
    return `<div class="everyday-task-hint ${allergen ? "allergen" : "new-food"}"><span>${allergen ? "Allergen-Aufgabe" : "Neue Kostprobe"}</span><b>${esc(samples.map((item) => item.name).join(" · "))}</b><small>${allergen ? `Heute ${action}` : "Neu"}</small></div>`;
  }

  function decorateEverydayMeal(mealBox, meal) {
    if (!mealBox) return;
    const title = mealBox.querySelector(".meal-summary-main, .manual-meal-title")?.closest?.(".grow") ||
      mealBox.querySelector(".meal-summary-main, .manual-meal-title")?.parentElement;
    if (!title) return;

    const row = title.closest(".meal-summary-row, summary .row");
    const recipe = meal?.recipeName && typeof recipeByName === "function"
      ? recipeByName(meal.recipeName)
      : null;
    if (recipe && row && !row.querySelector(".everyday-recipe-visual")) {
      const visual = document.createElement("span");
      visual.className = "everyday-recipe-visual";
      visual.innerHTML = recipeIconSvg(recipe, { loading: "eager", fetchPriority: "high" });
      row.classList.add("has-recipe-visual");
      row.insertBefore(visual, title);
      mealBox.classList.add("has-planned-recipe");
      visual.setAttribute("role", "button");
      visual.setAttribute("tabindex", "0");
      visual.setAttribute("aria-label", `Rezept ${recipe.name} öffnen`);
      const openRecipe = (event) => {
        event.preventDefault();
        event.stopPropagation();
        root.__plannedRecipeDetails?.openPlannedRecipeDetails?.(meal.recipeName, meal.foodIds || []);
      };
      visual.addEventListener("click", openRecipe);
      visual.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        openRecipe(event);
      });
    }

    if (!title.querySelector(".everyday-task-hint")) {
      const task = everydayMealTaskHtml(meal);
      if (task) title.insertAdjacentHTML("beforeend", task);
    }

  }

  function mobileTodaySwipeDirection(startX, startY, endX, endY, threshold = 48) {
    const deltaX = Number(endX) - Number(startX);
    const deltaY = Number(endY) - Number(startY);
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return 0;
    if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY) + 10) return 0;
    return deltaX < 0 ? 1 : -1;
  }

  function todayResetButtonHtml(viewingToday) {
    return viewingToday ? "" : '<button class="btn secondary smallbtn" id="homeToday" type="button">Heute</button>';
  }

  function bindTodayReset(card) {
    const button = card?.querySelector("#homeToday");
    if (!button) return;
    button.onclick = () => {
      root.__mobileTodaySelectedDate = today();
      renderHome();
    };
  }

  function bindTodayCardSwipe(card) {
    if (!card || card.dataset.mobileTodaySwipeBound === "true") return;

    let gesture = null;
    const interactiveSelector = "button, a, input, select, textarea, summary, [contenteditable=\"true\"]";

    card.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || event.button !== 0) return;
      if (event.target.closest(interactiveSelector)) return;
      gesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
    }, { passive: true });

    card.addEventListener("pointerup", (event) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const direction = mobileTodaySwipeDirection(
        gesture.startX,
        gesture.startY,
        event.clientX,
        event.clientY,
      );
      gesture = null;
      if (!direction) return;

      const current = root.__mobileTodaySelectedDate || today();
      root.__mobileTodaySelectedDate = addDays(current, direction);
      renderHome();
    }, { passive: true });

    card.addEventListener("pointercancel", () => {
      gesture = null;
    }, { passive: true });
    card.dataset.mobileTodaySwipeBound = "true";
  }

  function renderTodayFocus() {
    const card = document.getElementById("todayCard");
    if (!card) return { focusMeal: null, active: [] };

    const on = root.__mobileTodaySelectedDate || today();
    const viewingToday = on === today();
    const dateLabel = viewingToday ? "Heute" : nice(on, true);
    const resetButton = todayResetButtonHtml(viewingToday);
    const age = monthsOld(on);
    const day = (typeof viewRenderBuildDays === "function" ? viewRenderBuildDays : buildDays)(on, 1)[0];
    card.dataset.todayDate = on;
    const active = day.meals.filter((meal) => meal.active && meal.focusId);
    const openMeals = active.filter((meal) => !mealIsCompleted(on, meal.meal));
    const focusMeal = openMeals[0] || null;
    let nextPlanned = null;

    if (!active.length) {
      for (let offset = 1; offset <= 45; offset++) {
        const candidateDate = addDays(on, offset);
        const candidateDay = (typeof viewRenderBuildDays === "function" ? viewRenderBuildDays : buildDays)(candidateDate, 1, false)[0];
        if (candidateDay.meals.some((meal) => meal.active && meal.focusId)) {
          nextPlanned = candidateDate;
          break;
        }
      }
    }

    const everydayMode = isEverydayRecipesMode();
    card.className = `card today-card today-focus-card${everydayMode ? " today-everyday-card" : ""}`;
    if (!active.length) {
      card.innerHTML = `<div class="row"><div class="grow"><span class="today-section-kicker">${esc(dateLabel)}</span><h2>Nichts geplant</h2><div class="small">${nice(on, true)} · ${age} Monate</div></div>${resetButton}</div><div class="today-focus-empty"><p>Für ${viewingToday ? "heute" : "diesen Tag"} ist keine Mahlzeit geplant.</p>${nextPlanned ? `<div class="small">Nächster geplanter Tag: ${nice(nextPlanned, true)}</div>` : ""}</div><button class="btn full" id="homeFreeLog">Essen eintragen</button>`;
      document.getElementById("homeFreeLog")?.addEventListener("click", () => openLog(null));
      bindTodayReset(card);
      return { focusMeal, active };
    }

    if (everydayMode) {
      const heading = viewingToday ? (openMeals.length ? "Heute geplant" : "Heute erledigt") : (openMeals.length ? "Geplant" : "Erledigt");
      const everydayMeals = active.map((meal) => `<div class="today-everyday-meal" data-meal="${esc(meal.meal)}">${renderMeal(day, meal)}</div>`).join("");
      card.innerHTML = `<div class="row today-focus-head"><div class="grow"><span class="today-section-kicker">${heading}</span><h2>Geplante Mahlzeiten</h2><div class="small">${nice(on, true)} · ${active.length} ${active.length === 1 ? "Mahlzeit" : "Mahlzeiten"}</div></div>${resetButton}</div><div class="today-everyday-meals">${everydayMeals}</div><div class="add-meal-row"><button class="btn secondary smallbtn" id="homeAddEntry">Weiteres Essen eintragen</button></div>`;
      bindRenderedMealActions(card);
      card.querySelectorAll(".today-everyday-meal").forEach((mealNode, index) => {
        const meal = active[index];
        decorateEverydayMeal(mealNode, meal);
        ensureRenderedRandomSwapAction(mealNode, on, meal);
      });
      root.__plannedRecipeDetails?.decorateHomeRecipeTitles?.();
      document.getElementById("homeAddEntry")?.addEventListener("click", () => openLog(null));
      bindTodayReset(card);
      return { focusMeal, active };
    }

    const heading = viewingToday ? (focusMeal ? "Als Nächstes" : "Heute erledigt") : (focusMeal ? "Geplant" : "Tagesübersicht");
    const mealHeading = focusMeal ? mealName(focusMeal.meal) : "Alles eingetragen";
    const focusHtml = focusMeal
      ? `<div class="today-focus-meal">${renderMeal(day, focusMeal)}</div>`
      : '<div class="today-done-summary"><b>Alle geplanten Mahlzeiten sind eingetragen.</b><span class="small">Der Tagesüberblick bleibt unten sichtbar.</span></div>';
    const timeline = active.map((meal) => timelineRow(day, meal, focusMeal)).join("");

    card.innerHTML = `<div class="row today-focus-head"><div class="grow"><span class="today-section-kicker">${heading}</span><h2>${esc(mealHeading)}</h2><div class="small">${nice(on, true)} · ${age} Monate</div></div>${resetButton}</div>${focusHtml}<div class="today-timeline" aria-label="Tages-Timeline"><div class="today-timeline-heading"><b>${esc(dateLabel)}</b><span class="small">${active.length} ${active.length === 1 ? "Mahlzeit" : "Mahlzeiten"}</span></div>${timeline}</div><div class="add-meal-row"><button class="btn secondary smallbtn" id="homeAddEntry">Weiteres Essen eintragen</button></div>`;

    bindRenderedMealActions(card);
    ensureRenderedRandomSwapAction(card.querySelector(".today-focus-meal"), on, focusMeal);
    root.__plannedRecipeDetails?.decorateHomeRecipeTitles?.();
    card.querySelectorAll(".today-timeline-row.completed .editCompletedLog").forEach((button) => {
      button.classList.add("timeline-edit");
      button.onclick = () => editLogEntry(button.dataset.log);
    });
    document.getElementById("homeAddEntry")?.addEventListener("click", () => openLog(null));
    bindTodayReset(card);
    return { focusMeal, active };
  }

  function renderContextRecommendation() {
    const card = document.getElementById("textureCoachCard");
    if (!card) return;
    const on = today();
    const due = state.foods.filter((item) => dueAllergen(item, on));
    const stage = Number(state.settings.textureStage) || 1;
    const textureReady = stage < 4 && textureSuccessCount(stage) >= 4;

    card.className = "today-recommendation";
    card.style.display = "none";

    if (due.length) {
      const target = due[0];
      card.innerHTML = `<div class="today-recommendation-copy"><span class="today-section-kicker">Empfehlung</span><h3>${esc(target.name)} wiederholen</h3><p class="small">Dieses Allergen ist wieder fällig. Im Plan kannst du die nächste passende Mahlzeit prüfen.</p></div><button class="btn secondary smallbtn" id="todayRecommendationPlan" type="button">Im Plan ansehen</button>`;
      card.style.display = "flex";
      document.getElementById("todayRecommendationPlan")?.addEventListener("click", () => showView("plan"));
      return;
    }

    if (textureReady) {
      card.innerHTML = `<div class="today-recommendation-copy"><span class="today-section-kicker">Empfehlung</span><h3>Konsistenz weiterentwickeln</h3><p class="small">Die aktuelle Struktur wurde mehrfach positiv dokumentiert. Die nächste Stufe kann vorsichtig getestet werden.</p></div><button class="btn secondary smallbtn" id="todayRecommendationTexture" type="button">Stufe ${stage + 1} ansehen</button>`;
      card.style.display = "flex";
      document.getElementById("todayRecommendationTexture")?.addEventListener("click", () => openTextureAdvance(stage + 1));
      return;
    }

  }

  function renderCompactProgress() {
    const card = document.getElementById("progressCard");
    if (!card) return;
    const tried = typeof learnedCountIdentities === "function" ? learnedCountIdentities().length : learnedFoods().length;
    const target = Number(state.settings.targetFoods) || 100;
    const pct = Math.min(100, tried / target * 100);
    const tolerated = state.foods.filter((item) => status(item) === "Verträgliche Basis").length;
    const regular = state.foods.filter((item) => status(item) === "Regelmäßig").length;
    const due = state.foods.filter((item) => dueAllergen(item, today())).length;
    const facts = [];
    if (regular) facts.push(`${regular} regelmäßig`);
    else if (tolerated) facts.push(`${tolerated} sichere Basis`);
    if (due) facts.push(`${due} Allergene fällig`);

    card.className = "compact-progress today-progress";
    card.innerHTML = `<div class="today-progress-head"><div><span class="today-section-kicker">Fortschritt</span><h3>${tried} von ${target} kennengelernt</h3></div><b class="progress-percent">${Math.round(pct)} %</b></div><div class="progress"><span style="width:${pct}%"></span></div>${facts.length ? `<div class="small progress-facts">${facts.slice(0, 2).join(" · ")}</div>` : ""}`;
  }

  function recipeMatchesFocus(recipe, focusMeal) {
    if (!recipe || !focusMeal?.foodIds?.length || typeof recipeFoodIds !== "function") return false;
    if (typeof recipeSuitableForMeal === "function" && !recipeSuitableForMeal(recipe, focusMeal.meal)) return false;
    const focusIds = new Set(focusMeal.foodIds);
    try {
      return recipeFoodIds(recipe).some((id) => focusIds.has(id));
    } catch (_) {
      return false;
    }
  }

  function renderContextRecipe(focusMeal) {
    const card = document.getElementById("recipePreviewCard");
    if (!card) return;
    const all = typeof viewRenderRecipeStates === "function" ? viewRenderRecipeStates() : recipeStates();
    const recipe = focusMeal ? all.find((item) => item.unlocked && recipeMatchesFocus(item, focusMeal)) : null;
    card.className = `today-recipe-card${recipe ? "" : " today-recipe-empty"}`;
    card.style.display = "block";
    if (!recipe) {
      card.innerHTML = '<div class="today-recipe-head"><div><span class="today-section-kicker">Rezepte</span><h3>Rezeptideen</h3></div><button class="btn secondary smallbtn" id="openRecipes" type="button">Rezepte</button></div><div id="recipePreview"></div>';
      return;
    }

    card.innerHTML = `<div class="today-recipe-head"><div><span class="today-section-kicker">Rezeptidee</span><h3>Passt zu eurem Plan</h3></div><button class="btn secondary smallbtn" id="openRecipes" type="button">Rezepte</button></div><div id="recipePreview"><div class="today-recipe-row">${recipeIconSvg(recipe)}<div><b>${esc(recipe.name)}</b><div class="small">Passt zu Zutaten aus der nächsten Mahlzeit.</div></div></div></div>`;
  }

  function arrangeTodaySections() {
    const home = document.getElementById("home");
    const phase = document.getElementById("phaseCard");
    const today = document.getElementById("todayCard");
    const recommendation = document.getElementById("textureCoachCard");
    const progress = document.getElementById("progressCard");
    const recipe = document.getElementById("recipePreviewCard");
    if (!home || !phase || !today || !recommendation || !progress || !recipe) return;
    home.classList.toggle("everyday-recipes-home", isEverydayRecipesMode());
    const order = isEverydayRecipesMode()
      ? [today, recommendation, phase, progress, recipe]
      : [phase, today, recommendation, progress, recipe];
    order.forEach((node) => home.appendChild(node));
  }

  function renderMobileToday() {
    renderDayContext();
    const { focusMeal } = renderTodayFocus();
    bindTodayCardSwipe(document.getElementById("todayCard"));
    renderContextRecommendation();
    renderCompactProgress();
    renderContextRecipe(focusMeal);
    arrangeTodaySections();
  }

  root.MobileUiLifecycle.onRender("home", renderMobileToday);

})(typeof globalThis !== "undefined" ? globalThis : window);
