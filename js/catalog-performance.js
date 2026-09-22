"use strict";

/* Katalog-Performance
 * Optimiert ausschließlich Lebensmittel-/Rezeptsuche und Filter-Rendering.
 * Fachliche Zustands-, Planner-, Persistenz- und Protokollsemantik bleiben unverändert.
 */
(function catalogPerformanceModule() {
  if (typeof document === "undefined") return;

  const keyedNodeCache = new Map();
  const foodNodePrefix = "food:";
  const recipeNodePrefix = "recipe:";
  let recipeStatesCache = null;
  let recipeSearchIndexCache = new Map();
  let recipeCardHtmlCache = new Map();

  function nodeFromHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "").trim();
    return template.content.firstElementChild;
  }

  function keyedNode(key, html) {
    const cached = keyedNodeCache.get(key);
    if (cached?.html === html && cached.node) return cached.node;
    const node = nodeFromHtml(html);
    if (!node) return null;
    keyedNodeCache.set(key, { html, node });
    return node;
  }

  function reconcileKeyedHtml(container, entries) {
    const desired = entries
      .map((entry) => keyedNode(entry.key, entry.html))
      .filter(Boolean);
    const desiredSet = new Set(desired);

    [...container.children].forEach((child) => {
      if (!desiredSet.has(child)) child.remove();
    });

    let cursor = container.firstElementChild;
    for (const node of desired) {
      if (node === cursor) {
        cursor = cursor.nextElementSibling;
        continue;
      }
      container.insertBefore(node, cursor);
    }
  }

  function foodEmptyHtml(action) {
    return `<div class="empty ds-empty"><div>Keine passenden Lebensmittel.</div><button class="btn" id="foodEmptyAction" data-food-empty-mode="${action.mode}" type="button">${action.label}</button></div>`;
  }

  function ensureFoodListDelegation(list) {
    if (!list || list.dataset.catalogPerformanceBound === "true") return;
    list.dataset.catalogPerformanceBound = "true";
    list.addEventListener("click", (event) => {
      const button = event.target?.closest?.("button");
      if (!button || !list.contains(button)) return;

      if (button.id === "foodEmptyAction") {
        const mode = button.dataset.foodEmptyMode;
        if (mode === "search") {
          const search = document.getElementById("foodSearch");
          if (search) search.value = "";
        } else if (mode === "all") {
          foodFilter = "all";
        } else if (mode === "add") {
          addCustomFoodForm();
          return;
        }
        renderFoods();
        return;
      }

      if (button.classList.contains("jumpTop")) {
        jumpFoodInVisibleOrder(button.closest("[data-food]")?.dataset.food, "top");
        return;
      }
      if (button.classList.contains("jumpBottom")) {
        jumpFoodInVisibleOrder(button.closest("[data-food]")?.dataset.food, "bottom");
        return;
      }
      if (button.classList.contains("foodInfo")) {
        const item = food(button.closest(".foodcard")?.dataset.food);
        if (item) showFoodInfo(item);
        return;
      }
      if (button.classList.contains("followupEdit")) {
        openFollowUpEditor(button.dataset.food);
        return;
      }
      if (button.classList.contains("followupYes")) {
        const record = state.followUps?.[button.dataset.food];
        if (!record) return;
        record.status = "scheduled";
        let target = record.dueDate && record.dueDate >= today() ? record.dueDate : "";
        if (!target) {
          for (let index = 0; index <= 45; index += 1) {
            const date = addDays(today(), index);
            if (!planSlotProtected(date, record.meal || "lunch")) {
              target = date;
              break;
            }
          }
        }
        const result = applyFollowUpPlan(record, target);
        if (!result.ok) {
          const error = button.closest(".followup-food-card")?.querySelector(".followup-card-error");
          if (error) {
            error.textContent = result.message;
            error.style.display = "block";
          }
          return;
        }
        save();
        renderAll();
        return;
      }
      if (button.classList.contains("followupLater")) {
        const record = state.followUps?.[button.dataset.food];
        if (!record) return;
        removeFollowUpPlan(record.foodId);
        record.dueDate = addDays(today(), 7);
        record.status = "later";
        record.updatedAt = new Date().toISOString();
        save();
        renderAll();
      }
    });
  }

  function installOptimizedFoodRenderer() {
    if (typeof renderFoods !== "function") return;

    renderFoods = function renderFoodsWithKeyedCatalogDom() {
      document.querySelectorAll("#foodFilters button").forEach((button) =>
        button.classList.toggle("active", button.dataset.filter === foodFilter),
      );
      const search = document.getElementById("foodSearch");
      const list = document.getElementById("foodList");
      if (!search || !list) return;
      ensureFoodListDelegation(list);

      const q = normalizeName(search.value || "");
      const inactiveCount = state.foods.filter((item) => !item.active).length;
      const inactiveButton = document.getElementById("inactiveFoodFilter");
      if (inactiveButton) inactiveButton.textContent = `Deaktiviert${inactiveCount ? ` (${inactiveCount})` : ""}`;
      const reorderButton = document.getElementById("toggleFoodOrder");
      if (reorderButton) {
        reorderButton.textContent = foodReorderMode ? "Reihenfolge fertig" : "Reihenfolge ändern";
        reorderButton.classList.toggle("ochre", foodReorderMode);
      }
      const hint = document.getElementById("foodReorderHint");
      if (hint) hint.style.display = foodReorderMode ? "block" : "none";
      list.classList.toggle("reorder-mode", foodReorderMode);

      const followups = foodFilter === "open" && !q && !foodReorderMode ? followUpEntries() : [];
      const followupIds = new Set(followups.map((record) => record.foodId));
      const foods = state.foods
        .filter((item) => {
          if (q && !foodSearchMatches(item, q)) return false;
          if (foodFilter === "inactive") return !item.active;
          if (foodFilter === "open") return item.active && rank(item) < 2 && status(item) !== "Pausiert" && !followupIds.has(item.id);
          if (foodFilter === "allergen") return item.active && !!item.allergenGroup;
          if (foodFilter === "ph") return item.active && item.ph;
          if (foodFilter === "iron") return item.active && item.ironRich;
          if (foodFilter === "paused") return item.active && status(item) === "Pausiert";
          return true;
        })
        .sort((left, right) => {
          if (q) {
            const bySearch = foodSearchScore(left, q) - foodSearchScore(right, q);
            if (bySearch) return bySearch;
          }
          return Number(left.active) === Number(right.active)
            ? Number(left.priority) - Number(right.priority)
            : Number(right.active) - Number(left.active);
        });

      const activeCount = state.foods.length - inactiveCount;
      const count = document.getElementById("foodCountText");
      if (count) count.textContent = `${foods.length + followups.length} angezeigt · ${activeCount} aktiv · ${inactiveCount} deaktiviert`;

      const renderFoodCard = (item) => {
        const raw = status(item);
        const statusClass = raw === "Offen"
          ? "status-open"
          : raw === "Probiert"
            ? "status-tried"
            : raw === "Bekannt"
              ? "status-tolerated"
              : "status-paused";
        return `<div class="foodcard ${statusClass} ${item.active ? "" : "inactive"} ${foodReorderMode && item.active ? "reorderable" : ""}" data-food="${item.id}"><div class="row">${foodReorderMode && item.active ? `<div class="food-sort-actions"><button class="food-jump jumpTop" aria-label="Ganz nach oben">⇧</button><button class="drag-handle" aria-label="Lebensmittel verschieben">⠿</button><button class="food-jump jumpBottom" aria-label="Ganz nach unten">⇩</button></div>` : ""}<div class="grow"><div class="foodtitle"><span class="food-emoji">${foodEmoji(item)}</span>${esc(item.name)} ${!item.active ? '<span class="pill inactive-pill">Deaktiviert</span>' : ""}</div><div class="foodmeta">${esc(item.alias || item.category)} · <span class="food-status-text">${esc(displayStatus(item))}</span></div>${!item.active ? '<div class="inactive-note">Nicht in neuen Planungen, Rezeptvorschlägen oder Prep.</div>' : ""}</div><button class="btn secondary smallbtn foodInfo">Details</button></div></div>`;
      };

      const entries = [];
      if (followups.length) {
        entries.push({
          key: `${foodNodePrefix}followups`,
          html: `<section class="followup-section"><div class="followup-section-head"><h3>Wieder anbieten</h3><div class="small">Planbare Lebensmittel zuerst, danach nach Fälligkeit.</div></div>${followups.map(followUpCard).join("")}</section>`,
        });
      }
      for (const item of foods) {
        entries.push({ key: `${foodNodePrefix}${item.id}`, html: renderFoodCard(item) });
      }
      if (!entries.length) {
        const emptyAction = q
          ? { label: "Suche zurücksetzen", mode: "search" }
          : foodFilter !== "all"
            ? { label: "Alle Lebensmittel anzeigen", mode: "all" }
            : { label: "Lebensmittel hinzufügen", mode: "add" };
        entries.push({ key: `${foodNodePrefix}empty`, html: foodEmptyHtml(emptyAction) });
      }

      reconcileKeyedHtml(list, entries);
      if (foodReorderMode) {
        list.querySelectorAll(".drag-handle").forEach((handle) => {
          handle.onpointerdown = beginFoodDrag;
        });
      }
      globalThis.MobileUiLifecycle?.afterRender("foods");
    };
  }

  function recipeStructuredLabels(recipe) {
    return [
      ...(recipe?.requires || []),
      ...((recipe?.alternatives || []).flat()),
      ...(recipe?.oneOf || []),
      ...(recipe?.milkChoices || []),
    ];
  }

  function recipeFoodMealEligible(label, meal) {
    if (typeof FOOD_DB === "undefined" || typeof recipeFoodFromStructuredLabel !== "function") return false;
    const item = recipeFoodFromStructuredLabel(label, FOOD_DB);
    return !!item && Array.isArray(item.meals) && item.meals.includes(meal);
  }

  function recipeChoiceEligible(labels, meal) {
    return !labels?.length || labels.some((label) => recipeFoodMealEligible(label, meal));
  }

  function recipeRequirementSetEligible(labels, meal) {
    return (labels || []).every((label) => recipeFoodMealEligible(label, meal));
  }

  function recipeMealEligible(recipe, meal) {
    const requirementSets = [
      recipe?.requires || [],
      ...(recipe?.alternatives || []),
    ];
    if (!requirementSets.some((labels) => recipeRequirementSetEligible(labels, meal))) return false;
    if (!recipeChoiceEligible(recipe?.oneOf || [], meal)) return false;
    if (!recipeChoiceEligible(recipe?.milkChoices || [], meal)) return false;
    return true;
  }

  function recipeMainMealEligible(recipe) {
    return recipeMealEligible(recipe, "lunch") || recipeMealEligible(recipe, "dinner");
  }

  function recipeFilterBars() {
    return [
      document.getElementById("recipeMealFilter"),
      document.getElementById("recipeFilter"),
    ].filter(Boolean);
  }

  function recipeSearchEntry(recipe) {
    const key = recipe?.name || "";
    if (recipeSearchIndexCache.has(key)) return recipeSearchIndexCache.get(key);

    const aliases = typeof recipeAliasValues === "function" ? recipeAliasValues(recipe) : [];
    const foodIds = new Set();
    const structuredTerms = recipeStructuredLabels(recipe).flatMap((label) => {
      if (
        typeof recipeFoodFromStructuredLabel !== "function" ||
        typeof FOOD_DB === "undefined" ||
        typeof foodAliasTerms !== "function"
      ) return [label];
      const item = recipeFoodFromStructuredLabel(label, FOOD_DB);
      if (!item) return [label];
      foodIds.add(item.id);
      return [item.name, ...foodAliasTerms(item)];
    });
    const normalizedTerms = [
      recipe?.name || "",
      ...aliases,
      ...(recipe?.variantLabels || []),
      ...structuredTerms,
    ]
      .filter(Boolean)
      .map((term) => normalizeName(term || ""))
      .filter(Boolean);
    const fullSearchText = typeof recipeSearchText === "function" ? recipeSearchText(recipe) : "";
    const entry = {
      foodIds,
      normalizedTerms,
      normalizedFullText: normalizeName(fullSearchText),
    };
    recipeSearchIndexCache.set(key, entry);
    return entry;
  }

  function recipeMatchesSearch(recipe, query) {
    const normalizedQuery = normalizeName(query || "");
    if (!normalizedQuery) return true;
    const entry = recipeSearchEntry(recipe);
    const exactFood = typeof FOOD_DB !== "undefined" && typeof foodByName === "function"
      ? foodByName(query, FOOD_DB)
      : null;
    if (exactFood) return entry.foodIds.has(exactFood.id);

    const prefixMatch = entry.normalizedTerms.some((term) => {
      if (term === normalizedQuery || term.startsWith(normalizedQuery)) return true;
      return term
        .split(" ")
        .filter(Boolean)
        .some((word) => word === normalizedQuery || word.startsWith(normalizedQuery));
    });
    if (prefixMatch) return true;
    if (normalizedQuery.length < 3) return false;
    return entry.normalizedFullText.includes(normalizedQuery);
  }

  function recipePantryMatches(recipe) {
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

  function recipeCategoryMatches(recipe) {
    return recipeFilter === "available"
      ? recipe.unlocked
      : recipeFilter === "almost"
        ? recipe.almost
        : recipeFilter === "all"
          ? true
        : recipeFilter === "pantry"
            ? recipePantryMatches(recipe)
            : recipeFilter === "freezer"
              ? !!recipe.freezable
              : recipeFilter === "philippines"
                ? recipe.ph || recipe.category === "philippines"
                : recipeFilter === "breakfast"
                  ? recipeMealEligible(recipe, "breakfast")
                  : recipeFilter === "main"
                    ? recipeMainMealEligible(recipe)
                    : recipeFilter === "snack"
                      ? (recipe.tags || []).some((tag) => normalizeName(tag) === "snack")
                      : recipe.category === recipeFilter;
  }

  function refreshRecipeStateCache() {
    recipeStatesCache = typeof viewRenderRecipeStates === "function" ? viewRenderRecipeStates() : recipeStates();
    recipeSearchIndexCache = new Map();
    recipeCardHtmlCache = new Map();
  }

  function recipeCardHtml(recipe, { priorityImage = false } = {}) {
    const name = recipe?.name || "";
    const key = `${name}|${priorityImage ? "priority" : "deferred"}`;
    if (!recipeCardHtmlCache.has(key)) {
      recipeCardHtmlCache.set(key, renderRecipeCard(recipe, { priorityImage, showDetails: false }));
    }
    return recipeCardHtmlCache.get(key);
  }

  function ensureRecipeListDelegation(list) {
    if (!list || list.dataset.catalogPerformanceBound === "true") return;
    list.dataset.catalogPerformanceBound = "true";
    list.addEventListener("click", (event) => {
      const button = event.target?.closest?.("button");
      const card = event.target?.closest?.(".recipe-card-v2");
      if ((!button && !card) || (button && !list.contains(button)) || (card && !list.contains(card))) return;

      const recipeForCard = () => {
        if (!card || typeof recipeByName !== "function") return null;
        let encodedName = card.dataset.recipe || "";
        let name = encodedName;
        try { name = decodeURIComponent(encodedName); } catch {}
        return recipeByName(name);
      };

      if (button?.matches(".catalogRecipeDetails") || event.target?.closest?.("summary")) {
        event.preventDefault();
        const recipe = recipeForCard();
        if (recipe && typeof globalThis.showRecipeInfo === "function") globalThis.showRecipeInfo(recipe);
        return;
      }

      if (!button) return;

      if (button.id === "recipeEmptyAction") {
        recipeQuery = "";
        const mode = button.dataset.recipeEmptyMode;
        if (mode === "almost") recipeFilter = "almost";
        else if (mode === "all") recipeFilter = "all";
        else recipeFilter = "available";
        renderOptimizedRecipeCatalog({ reuseStates: true });
        return;
      }

      if (button.hasAttribute("data-add-recipe-stock")) {
        addInventoryForm({
          kind: "recipe",
          recipeName: decodeURIComponent(button.dataset.addRecipeStock),
          portions: 6,
          size: "Stück",
          note: "einzeln vorgefroren",
        });
      }
    });
  }

  function setCatalogMode(mode) {
    const foodsSection = document.getElementById("foodsCatalogSection");
    const recipesSection = document.getElementById("recipesSection");
    const recipesDetails = document.getElementById("recipesDetails");
    const switcher = document.getElementById("catalogSwitch");
    if (!foodsSection || !recipesSection || !switcher) return;
    const nextMode = mode === "recipes" ? "recipes" : "foods";
    foodsSection.hidden = nextMode !== "foods";
    recipesSection.hidden = nextMode !== "recipes";
    if (nextMode === "recipes" && recipesDetails) recipesDetails.open = true;
    switcher.querySelectorAll("[data-catalog-mode]").forEach((button) => {
      const active = button.dataset.catalogMode === nextMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderOptimizedRecipeCatalog({ reuseStates = false } = {}) {
    const filterBars = recipeFilterBars();
    const search = document.getElementById("recipeSearch");
    const list = document.getElementById("recipeList");
    if (!list) return;
    ensureRecipeListDelegation(list);

    if (!reuseStates || !recipeStatesCache) refreshRecipeStateCache();
    const allRecipeStates = recipeStatesCache || [];

    filterBars.forEach((filterBar) => {
      filterBar.querySelectorAll("[data-recipe-filter]").forEach((button) =>
        button.classList.toggle("active", button.dataset.recipeFilter === recipeFilter),
      );
    });
    if (search && search.value !== recipeQuery) search.value = recipeQuery;

    const query = normalizeName(recipeQuery);
    const recipes = allRecipeStates.filter((recipe) =>
      recipeCategoryMatches(recipe) && (!query || recipeMatchesSearch(recipe, recipeQuery)),
    );
    const countBox = document.getElementById("recipeCount");
    if (countBox) {
      const context = recipeFilter === "almost"
        ? "es fehlen höchstens zwei Schritte"
        : recipeFilter === "pantry"
          ? "mit vorhandenen Zutaten"
          : recipeFilter === "freezer"
            ? "einfrierbar"
        : recipeFilter === "breakfast"
          ? "Frühstück"
          : recipeFilter === "main"
            ? "Hauptmahlzeit"
            : recipeFilter === "snack"
              ? "Snack"
              : "passend zu Filter und Suche";
      countBox.textContent = `${recipes.length} Rezept${recipes.length === 1 ? "" : "e"} · ${context}`;
    }

    const emptyMode = query || recipeFilter !== "available"
      ? "reset"
      : allRecipeStates.some((item) => item.almost)
        ? "almost"
        : "all";
    const emptyLabel = emptyMode === "reset"
      ? "Filter zurücksetzen"
      : emptyMode === "almost"
        ? "Fast passende Rezepte anzeigen"
        : "Alle Rezepte anzeigen";

    const entries = recipes.length
      ? recipes.map((recipe, index) => ({
          key: `${recipeNodePrefix}${recipe.name}`,
          html: recipeCardHtml(recipe, { priorityImage: index < 4 }),
        }))
      : [{
          key: `${recipeNodePrefix}empty`,
          html: `<div class="empty ds-empty"><div>Keine Rezepte für diesen Filter gefunden.</div><button class="btn" id="recipeEmptyAction" data-recipe-empty-mode="${emptyMode}" type="button">${emptyLabel}</button></div>`,
        }];
    reconcileKeyedHtml(list, entries);

    filterBars.forEach((filterBar) => {
      filterBar.querySelectorAll("[data-recipe-filter]").forEach((button) => {
        button.onclick = () => {
          recipeFilter = button.dataset.recipeFilter;
          renderOptimizedRecipeCatalog({ reuseStates: true });
        };
      });
    });
    if (search) {
      search.oninput = (event) => {
        recipeQuery = event.target.value;
        renderOptimizedRecipeCatalog({ reuseStates: true });
      };
    }
    globalThis.MobileUiLifecycle?.afterRender("foods", { source: "recipe-catalog" });
  }

  installOptimizedFoodRenderer();

  if (typeof renderView === "function") {
    const baseRenderView = renderView;
    renderView = function performanceAwareCatalogView(id) {
      if (id === "foods" && document.getElementById("recipesSection")?.hidden === false) {
        return renderOptimizedRecipeCatalog({ reuseStates: false });
      }
      return baseRenderView.apply(this, arguments);
    };
  }

  const switcher = document.getElementById("catalogSwitch");
  switcher?.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-catalog-mode]");
    if (!button || !switcher.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const mode = button.dataset.catalogMode;
    setCatalogMode(mode);
    if (mode === "recipes") renderOptimizedRecipeCatalog({ reuseStates: false });
    else renderFoods();
  }, true);
})();
