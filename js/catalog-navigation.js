"use strict";

/* Gemeinsamer Katalog-Tab für Lebensmittel und Rezepte.
 * Verbindet die bestehende Rezeptoberfläche mit dem Lebensmittel-Tab,
 * ohne Rezeptdaten, Planner oder direkte Rezeptdetail-Dialoge zu duplizieren.
 */
(function catalogNavigationModule(root) {
  if (typeof document === "undefined") return;

  const MODE_FOODS = "foods";
  const MODE_RECIPES = "recipes";
  let catalogMode = MODE_FOODS;
  let openingRecipeCatalog = false;

  function catalogNodes() {
    return {
      view: document.getElementById("foods"),
      foodsSection: document.getElementById("foodsCatalogSection"),
      recipesSection: document.getElementById("recipesSection"),
      recipesDetails: document.getElementById("recipesDetails"),
      switcher: document.getElementById("catalogSwitch"),
    };
  }

  function setCatalogMode(mode, { scroll = false } = {}) {
    let next = mode === MODE_RECIPES ? MODE_RECIPES : MODE_FOODS;
    let { foodsSection, recipesSection, recipesDetails, switcher } = catalogNodes();
    if (!foodsSection || !recipesSection || !switcher) return false;

    catalogMode = next;
    foodsSection.hidden = next !== MODE_FOODS;
    recipesSection.hidden = next !== MODE_RECIPES;
    if (next === MODE_RECIPES && recipesDetails) recipesDetails.open = true;

    switcher.querySelectorAll("[data-catalog-mode]").forEach((button) => {
      let active = button.dataset.catalogMode === next;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }

  function setupCatalogDom() {
    let view = document.getElementById("foods");
    let recipesSection = document.getElementById("recipesSection");
    if (!view || !recipesSection) return false;

    let foodsSection = document.getElementById("foodsCatalogSection") ||
      [...view.children].find((node) => node.classList?.contains("card") && node.id !== "recipesSection");
    if (!foodsSection) return false;
    foodsSection.id = "foodsCatalogSection";

    if (recipesSection.parentElement !== view) view.appendChild(recipesSection);
    recipesSection.classList.remove("collapsible-card");
    recipesSection.classList.add("catalog-recipes-card");

    let switcher = document.getElementById("catalogSwitch");
    if (!switcher) {
      switcher = document.createElement("div");
      switcher.id = "catalogSwitch";
      switcher.className = "catalog-switch";
      switcher.setAttribute("role", "group");
      switcher.setAttribute("aria-label", "Lebensmittel oder Rezepte anzeigen");
      switcher.innerHTML = `
        <button type="button" class="active" data-catalog-mode="foods" aria-controls="foodsCatalogSection" aria-pressed="true">Lebensmittel</button>
        <button type="button" data-catalog-mode="recipes" aria-controls="recipesSection" aria-pressed="false">Rezepte</button>`;
      view.insertBefore(switcher, foodsSection);
    }
    switcher.querySelectorAll("[data-catalog-mode]").forEach((button) => {
      button.onclick = () => setCatalogMode(button.dataset.catalogMode);
    });

    let details = document.getElementById("recipesDetails");
    if (details) details.open = true;
    setCatalogMode(catalogMode);
    return true;
  }

  function fixPrepRecipeHint() {
    let empty = document.querySelector("#cookNow .empty");
    if (empty && /Unter „Mehr“/i.test(empty.textContent || "")) {
      empty.textContent = "Noch kein Rezept vollständig freigeschaltet. Unter „Rezepte“ siehst du fast passende Rezepte.";
    }
  }

  function openRecipeCatalog({ filter = "" } = {}) {
    if (filter && typeof recipeFilter !== "undefined") recipeFilter = filter;
    openingRecipeCatalog = true;
    try {
      if (typeof showView === "function") showView("foods");
    } finally {
      openingRecipeCatalog = false;
    }
    setCatalogMode(MODE_RECIPES);
    if (typeof renderPrep === "function") renderPrep();
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function bindRecipeEntryButtons() {
    let home = document.getElementById("openRecipes");
    if (home) home.onclick = () => openRecipeCatalog();

    let prep = document.getElementById("prepOpenRecipes");
    if (prep) prep.onclick = () => openRecipeCatalog();

    let freezer = document.getElementById("prepOpenFreezerRecipes");
    if (freezer) freezer.onclick = () => openRecipeCatalog({ filter: "freezer" });
  }

  function refreshAuditNavigationCheck() {
    let list = document.getElementById("auditList");
    if (!list) return;
    let row = [...list.querySelectorAll(".checkline")].find((node) =>
      /Protokoll und Rezepte liegen unter Mehr/.test(node.textContent || ""),
    );
    if (!row) return;

    let ok = !!document.querySelector("#more #logDetails") &&
      !!document.querySelector("#foods #recipesDetails") &&
      !document.querySelector("#more #recipesDetails");
    row.innerHTML = `<span class="statusdot ${ok ? "good" : "warn"}"></span><div><b>${ok ? "Geprüft" : "Prüfen"}:</b> Protokoll liegt unter Mehr; Rezepte liegen im gemeinsamen Lebensmittel-Tab</div>`;
  }

  setupCatalogDom();

  if (typeof showView === "function") {
    let originalShowView = showView;
    showView = function showViewWithCatalogDefault(id) {
      originalShowView(id);
      if (id === "foods" && !openingRecipeCatalog) setCatalogMode(MODE_FOODS);
    };
  }

  if (typeof renderHome === "function") {
    let originalRenderHome = renderHome;
    renderHome = function renderHomeWithCatalogNavigation() {
      originalRenderHome();
      bindRecipeEntryButtons();
    };
  }

  if (typeof renderPrep === "function") {
    let originalRenderPrep = renderPrep;
    renderPrep = function renderPrepWithCatalogNavigation() {
      originalRenderPrep();
      fixPrepRecipeHint();
      bindRecipeEntryButtons();
    };
  }

  if (typeof renderAuditCore === "function") {
    let originalRenderAuditCore = renderAuditCore;
    renderAuditCore = function renderAuditCoreWithCatalogNavigation() {
      originalRenderAuditCore();
      refreshAuditNavigationCheck();
    };
  }

  root.__catalogNavigation = {
    getMode: () => catalogMode,
    setMode: (mode) => setCatalogMode(mode),
    openRecipes: (options = {}) => openRecipeCatalog(options),
  };
})(typeof window !== "undefined" ? window : globalThis);
