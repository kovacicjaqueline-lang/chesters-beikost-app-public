"use strict";

/* FLOW-C: gemeinsame UI-Schicht für fachlich getrennte Eingabe-/Bearbeitungsdialoge.
 *
 * Die Runtime dekoriert ausschließlich die bereits gerenderten Dialoge und hält die
 * Suchinteraktion im Mahlzeiteneditor DOM-stabil. Planner- und Protokoll-Controller,
 * Persistenz, Rollen, Safety sowie Mahlzeiteneignung bleiben unverändert und werden
 * weder gewrappt noch ersetzt.
 */
(function installFlowDialogUi() {
  if (typeof document === "undefined" || typeof globalThis === "undefined") return;
  if (globalThis.__flowDialogUiInstalled) return;

  const genericModal = document.getElementById("genericModal");
  const logModal = document.getElementById("logModal");
  const genericTitle = document.getElementById("genericTitle");
  const genericBody = document.getElementById("genericBody");
  const logBody = document.getElementById("logForm");
  if (!genericModal || !logModal || !genericTitle || !genericBody || !logBody) return;

  let genericContentObserver = null;
  let logContentObserver = null;
  let genericOpen = genericModal.classList.contains("open");
  let logOpen = logModal.classList.contains("open");
  let mealSelectorQuery = "";
  let logSelectorMode = "recipes";
  let logSearchActive = false;

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function setHidden(node, hidden) {
    if (node && node.hidden !== hidden) node.hidden = hidden;
  }

  function visibleDate(date) {
    return date && typeof nice === "function" ? nice(date, true) : String(date || "");
  }

  function normalizeSearch(value) {
    if (typeof normalizeName === "function") return normalizeName(value || "");
    return String(value || "").trim().toLocaleLowerCase("de");
  }

  function selectorRowMatches(row, query) {
    if (!query) return true;

    if (row.classList.contains("selectFood")) {
      const item = typeof food === "function" ? food(row.dataset.food) : null;
      if (item && typeof foodSearchMatches === "function") return foodSearchMatches(item, query);
    }

    if (row.classList.contains("selectRecipe")) {
      let name = row.dataset.recipe || "";
      try {
        name = decodeURIComponent(name);
      } catch {}
      const recipe = typeof recipeByName === "function" ? recipeByName(name) : null;
      const searchText = recipe && typeof recipeSearchText === "function" ? recipeSearchText(recipe) : name;
      return normalizeSearch(searchText).includes(normalizeSearch(query));
    }

    return normalizeSearch(row.textContent).includes(normalizeSearch(query));
  }

  function compareFoodSelectorRows(a, b, query) {
    const selectedOrder = Number(b.classList.contains("selected")) - Number(a.classList.contains("selected"));
    if (selectedOrder) return selectedOrder;

    const aFood = typeof food === "function" ? food(a.dataset.food) : null;
    const bFood = typeof food === "function" ? food(b.dataset.food) : null;
    if (query && aFood && bFood && typeof foodSearchScore === "function") {
      const aScore = foodSearchScore(aFood, query);
      const bScore = foodSearchScore(bFood, query);
      if (aScore !== bScore) return aScore - bScore;
    }

    if (aFood && bFood && typeof rank === "function") {
      const rankOrder = rank(bFood) - rank(aFood);
      if (rankOrder) return rankOrder;
    }
    if (aFood && bFood && typeof inventoryPortions === "function") {
      const inventoryOrder = Number(inventoryPortions(bFood.id) > 0) - Number(inventoryPortions(aFood.id) > 0);
      if (inventoryOrder) return inventoryOrder;
    }
    return Number(aFood?.priority || 0) - Number(bFood?.priority || 0);
  }

  function filterMealSelectorResults() {
    const input = document.getElementById("mealSelectorSearch");
    const results = genericBody.querySelector(".selector-results");
    if (!input || !results) return;

    const query = mealSelectorQuery.trim();
    const rows = Array.from(results.querySelectorAll(".selector-row.selectFood, .selector-row.selectRecipe"));
    const currentFoodRows = rows.filter((row) => row.classList.contains("selectFood"));
    const sortedFoodRows = [...currentFoodRows].sort((a, b) => compareFoodSelectorRows(a, b, query));
    const foodOrderChanged = sortedFoodRows.some((row, index) => row !== currentFoodRows[index]);
    if (foodOrderChanged) {
      const currentEmpty = results.querySelector(".flow-meal-selector-empty");
      sortedFoodRows.forEach((row) => results.insertBefore(row, currentEmpty || null));
    }

    let visibleRows = 0;
    rows.forEach((row) => {
      const matches = selectorRowMatches(row, query);
      row.hidden = !matches;
      row.style.display = matches ? "" : "none";
      if (matches) visibleRows += 1;
    });

    let empty = results.querySelector(".flow-meal-selector-empty");
    if (query && rows.length && visibleRows === 0) {
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "empty flow-meal-selector-empty";
        results.appendChild(empty);
      }
      setText(
        empty,
        document.getElementById("selectorRecipes")?.classList.contains("active")
          ? "Kein passendes Rezept gefunden."
          : "Kein Lebensmittel gefunden.",
      );
    } else {
      empty?.remove();
    }
  }

  function syncMealSelectorSearch() {
    const input = document.getElementById("mealSelectorSearch");
    if (!input || !genericBody.contains(input)) return;
    if (input.value !== mealSelectorQuery) input.value = mealSelectorQuery;
    filterMealSelectorResults();
  }

  function ensureGenericSubtitle() {
    let heading = genericModal.querySelector(".sheethead .grow");
    if (!heading) return null;
    let subtitle = document.getElementById("genericSubtitle");
    if (!subtitle) {
      subtitle = document.createElement("div");
      subtitle.id = "genericSubtitle";
      subtitle.className = "small flow-dialog-subtitle";
      heading.appendChild(subtitle);
    }
    return subtitle;
  }
  function logContextNode() {
    return logBody.querySelector(".log-date-grid") ||
      logBody.querySelector("#editLogContext")?.closest(".field") ||
      null;
  }

  function decorateLogSelectorRows(container, kind) {
    if (!container) return;
    const selector = kind === "recipes" ? ".selectLogRecipeResult" : ".addLogFoodResult";
    const kindClass = kind === "recipes" ? "selectRecipe" : "selectFood";
    container.querySelectorAll(selector).forEach((row) =>
      row.classList.add("selector-row", kindClass),
    );
  }

  function ensureLogSearchToggle(panel, kind, input) {
    if (!panel || !input) return null;
    let toggle = panel.querySelector(":scope > .flow-log-search-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "btn secondary smallbtn flow-log-search-toggle";
      toggle.dataset.flowLogSearchToggle = kind;
      toggle.setAttribute("aria-controls", input.id);
      const label = panel.querySelector(":scope > label");
      panel.insertBefore(toggle, label || panel.firstChild);
    }
    return toggle;
  }

  function syncLogSearchPanel(panel, kind, input, results, mode) {
    if (!panel || !input) return;
    const label = panel.querySelector(":scope > label");
    const resultsLabel = panel.querySelector(kind === "recipes" ? ".log-recipe-results-label" : ".log-food-results-label");
    const toggle = ensureLogSearchToggle(panel, kind, input);
    const active = mode === kind && logSearchActive;
    const hasQuery = !!String(input.value || "").trim();

    setText(toggle, active ? "Suche schließen" : (kind === "recipes" ? "Rezept suchen" : "Lebensmittel suchen"));
    toggle?.setAttribute("aria-expanded", active ? "true" : "false");
    setHidden(label, !active);
    setHidden(results, !active);
    setHidden(resultsLabel, !active || (kind === "recipes" && !hasQuery));
  }

  function ensureLogSelector() {
    const foodPicker = logBody.querySelector(".log-food-picker");
    const recipePicker = logBody.querySelector(".log-recipe-picker");
    if (!foodPicker) return;

    let selector = logBody.querySelector(".flow-log-selector");
    if (!selector) {
      selector = document.createElement("div");
      selector.className = "flow-log-selector flow-dialog-selection";
      const context = logContextNode();
      if (context) context.insertAdjacentElement("afterend", selector);
      else logBody.prepend(selector);
    }

    if (recipePicker && !selector.contains(recipePicker)) selector.appendChild(recipePicker);
    if (!selector.contains(foodPicker)) selector.appendChild(foodPicker);

    recipePicker?.classList.add("flow-log-selector-panel");
    foodPicker.classList.add("flow-log-selector-panel");
    if (recipePicker) recipePicker.id = "flowLogRecipePanel";
    foodPicker.id = "flowLogFoodPanel";

    const recipeInput = recipePicker?.querySelector("#logRecipeSearch") || null;
    const foodInput = foodPicker.querySelector("#logFoodSearch");
    const recipeResults = recipePicker?.querySelector(".log-recipe-results") || null;
    const foodResults = foodPicker.querySelector(".log-food-results");
    recipeResults?.classList.add("selector-results");
    foodResults?.classList.add("selector-results");
    decorateLogSelectorRows(recipeResults, "recipes");
    decorateLogSelectorRows(foodResults, "foods");

    const recipeLabel = recipePicker?.querySelector(":scope > label") || null;
    const foodLabel = foodPicker.querySelector(":scope > label");
    setText(recipeLabel, "Suchen");
    setText(foodLabel, "Suchen");
    if (recipeInput) recipeInput.placeholder = "Rezept suchen";
    if (foodInput) foodInput.placeholder = "Lebensmittel suchen";

    const recipeResultsLabel = recipePicker?.querySelector(".log-recipe-results-label") || null;
    if (recipeResultsLabel) {
      const hasRecipeQuery = !!String(recipeInput?.value || "").trim();
      setHidden(recipeResultsLabel, !hasRecipeQuery);
      if (hasRecipeQuery) setText(recipeResultsLabel, "Suchergebnisse");
    }

    let tabs = selector.querySelector(".flow-log-selector-tabs");
    if (recipePicker) {
      if (!tabs) {
        tabs = document.createElement("div");
        tabs.className = "meal-selector-tabs flow-log-selector-tabs";
        tabs.setAttribute("role", "group");
        tabs.setAttribute("aria-label", "Rezepte oder Lebensmittel auswählen");
        tabs.innerHTML = `<button type="button" data-flow-log-selector="recipes" aria-controls="flowLogRecipePanel">Rezepte</button><button type="button" data-flow-log-selector="foods" aria-controls="flowLogFoodPanel">Lebensmittel</button>`;
        selector.prepend(tabs);
      }
    } else {
      tabs?.remove();
      tabs = null;
      logSelectorMode = "foods";
    }

    if (foodPicker.classList.contains("field-error")) {
      logSelectorMode = "foods";
      logSearchActive = true;
    }
    const mode = recipePicker && logSelectorMode === "recipes" ? "recipes" : "foods";
    logSelectorMode = mode;

    if (tabs) {
      tabs.querySelectorAll("[data-flow-log-selector]").forEach((button) => {
        const active = button.dataset.flowLogSelector === mode;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    setHidden(recipePicker, mode !== "recipes");
    setHidden(foodPicker, mode !== "foods");
    syncLogSearchPanel(recipePicker, "recipes", recipeInput, recipeResults, mode);
    syncLogSearchPanel(foodPicker, "foods", foodInput, foodResults, mode);

    if (foodPicker.classList.contains("field-error") && foodInput) {
      queueMicrotask(() => {
        if (!foodPicker.hidden) foodInput.focus();
      });
    }
  }

  function markSections(body) {
    body.querySelectorAll(".log-date-grid, .manual-meal-target-date").forEach((node) =>
      node.classList.add("flow-dialog-context"),
    );
    body.querySelectorAll(".meal-selector-tabs, .flow-log-selector").forEach((node) =>
      node.classList.add("flow-dialog-selection"),
    );
    body.querySelectorAll(".manual-role-overview, .selected-target, .log-recipe-choice").forEach((node) =>
      node.classList.add("flow-dialog-selected"),
    );
    body.querySelector(".sticky-form-actions")?.classList.add("flow-dialog-actions");
  }
  function decorate(modal, body, subtitle) {
    modal.classList.add("flow-dialog");
    modal.querySelector(".sheet")?.classList.add("flow-dialog-sheet");
    modal.querySelector(".sheethead")?.classList.add("flow-dialog-header");
    modal.querySelector(".sheethead .grow")?.classList.add("flow-dialog-heading");
    modal.querySelector(".sheethead h2")?.classList.add("flow-dialog-title");
    modal.querySelector(".sheethead .iconbtn")?.classList.add("flow-dialog-close");
    body.classList.add("flow-dialog-body");
    if (subtitle) {
      subtitle.classList.add("flow-dialog-subtitle");
      setHidden(subtitle, !String(subtitle.textContent || "").trim());
    }
    markSections(body);
  }

  function stopGenericContentObservation() {
    if (!genericContentObserver) return;
    genericContentObserver.disconnect();
    genericContentObserver = null;
  }

  function stopLogContentObservation() {
    if (!logContentObserver) return;
    logContentObserver.disconnect();
    logContentObserver = null;
  }

  function resetGeneric() {
    genericModal.classList.remove("flow-dialog");
    delete genericModal.dataset.flowDialogContext;
    mealSelectorQuery = "";
    let subtitle = document.getElementById("genericSubtitle");
    if (subtitle) {
      setText(subtitle, "");
      setHidden(subtitle, true);
    }
  }

  function syncGeneric() {
    if (!genericModal.classList.contains("open")) {
      stopGenericContentObservation();
      resetGeneric();
      return;
    }

    let rawTitle = String(genericTitle.textContent || "").trim();
    let match = rawTitle.match(/^(Mahlzeit hinzufügen|Mahlzeit bearbeiten)\s*·\s*(.+)$/);
    if (match) {
      genericModal.dataset.flowDialogContext = match[2];
      setText(genericTitle, match[1]);
      rawTitle = match[1];
    }

    let isMealEditor = /^(Mahlzeit hinzufügen|Mahlzeit bearbeiten)$/.test(rawTitle) &&
      !!genericModal.dataset.flowDialogContext;
    if (!isMealEditor) {
      stopGenericContentObservation();
      resetGeneric();
      return;
    }

    let subtitle = ensureGenericSubtitle();
    let date = document.getElementById("manualMealTargetDate")?.value || "";
    setText(subtitle, [visibleDate(date), genericModal.dataset.flowDialogContext].filter(Boolean).join(" · "));
    decorate(genericModal, genericBody, subtitle);
    syncMealSelectorSearch();

    if (!genericContentObserver) {
      genericContentObserver = new MutationObserver(syncGeneric);
      genericContentObserver.observe(genericBody, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  function syncLog() {
    if (!logModal.classList.contains("open")) {
      stopLogContentObservation();
      return;
    }

    let subtitle = document.getElementById("logSubtitle");
    ensureLogSelector();
    decorate(logModal, logBody, subtitle);

    if (!logContentObserver) {
      logContentObserver = new MutationObserver(syncLog);
      logContentObserver.observe(logBody, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  const genericStateObserver = new MutationObserver(() => {
    const open = genericModal.classList.contains("open");
    if (open === genericOpen) return;
    genericOpen = open;
    if (open) mealSelectorQuery = "";
    syncGeneric();
    if (open && genericModal.dataset.flowDialogContext) {
      const sheet = genericModal.querySelector(".sheet");
      if (sheet) sheet.scrollTop = 0;
    }
  });
  genericStateObserver.observe(genericModal, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const logStateObserver = new MutationObserver(() => {
    const open = logModal.classList.contains("open");
    if (open === logOpen) return;
    logOpen = open;
    if (open) {
      logSelectorMode = "recipes";
      logSearchActive = false;
    }
    syncLog();
  });
  logStateObserver.observe(logModal, {
    attributes: true,
    attributeFilter: ["class"],
  });

  genericModal.addEventListener("input", (event) => {
    if (event.target?.id !== "mealSelectorSearch") return;
    mealSelectorQuery = event.target.value;
    event.stopImmediatePropagation();
    filterMealSelectorResults();
  }, true);

  genericModal.addEventListener("change", (event) => {
    if (event.target?.id === "manualMealTargetDate") syncGeneric();
  });

  logModal.addEventListener("click", (event) => {
    const searchToggle = event.target.closest?.("[data-flow-log-search-toggle]");
    if (searchToggle && logBody.contains(searchToggle)) {
      logSelectorMode = searchToggle.dataset.flowLogSearchToggle === "recipes" ? "recipes" : "foods";
      logSearchActive = !logSearchActive;
      ensureLogSelector();
      const input = logSelectorMode === "recipes"
        ? logBody.querySelector("#logRecipeSearch")
        : logBody.querySelector("#logFoodSearch");
      if (logSearchActive) input?.focus();
      else input?.blur();
      return;
    }

    const button = event.target.closest?.("[data-flow-log-selector]");
    if (button && logBody.contains(button)) {
      const nextMode = button.dataset.flowLogSelector === "recipes" ? "recipes" : "foods";
      if (nextMode === "recipes") {
        const foodPicker = logBody.querySelector(".log-food-picker");
        const foodError = logBody.querySelector("#logFoodError");
        foodPicker?.classList.remove("field-error");
        if (foodError) {
          foodError.textContent = "";
          foodError.style.display = "none";
        }
      }
      logSelectorMode = nextMode;
      logSearchActive = false;
      ensureLogSelector();
      return;
    }

    if (event.target.closest?.(".selectLogRecipeResult")) {
      logSearchActive = false;
      queueMicrotask(syncLog);
      return;
    }
  });

  syncGeneric();
  syncLog();
  globalThis.__flowDialogUiInstalled = true;
})();
