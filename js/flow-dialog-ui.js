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

  function filterMealSelectorResults() {
    const input = document.getElementById("mealSelectorSearch");
    const results = genericBody.querySelector(".selector-results");
    if (!input || !results) return;

    const query = mealSelectorQuery.trim();
    const rows = Array.from(results.querySelectorAll(".selector-row.selectFood, .selector-row.selectRecipe"));
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
      empty.textContent = document.getElementById("selectorRecipes")?.classList.contains("active")
        ? "Kein passendes Rezept gefunden."
        : "Kein Lebensmittel gefunden.";
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

  function markSections(body) {
    body.querySelectorAll(".log-date-grid, .manual-meal-target-date").forEach((node) =>
      node.classList.add("flow-dialog-context"),
    );
    body.querySelectorAll(".meal-selector-tabs, .log-recipe-picker, .log-food-picker").forEach((node) =>
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
  });
  genericStateObserver.observe(genericModal, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const logStateObserver = new MutationObserver(() => {
    const open = logModal.classList.contains("open");
    if (open === logOpen) return;
    logOpen = open;
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

  syncGeneric();
  syncLog();
  globalThis.__flowDialogUiInstalled = true;
})();
