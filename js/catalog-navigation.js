"use strict";

/* Gemeinsamer Katalog-Tab für Lebensmittel und Rezepte.
 * Rezeptdaten, Planner und direkte Rezeptdetail-Dialoge bleiben unverändert.
 */
(function catalogNavigationModule() {
  if (typeof document === "undefined") return;

  const MODE_FOODS = "foods";
  const MODE_RECIPES = "recipes";
  let catalogMode = MODE_FOODS;
  let openingRecipeCatalog = false;

  function setCatalogMode(mode) {
    let foodsSection = document.getElementById("foodsCatalogSection");
    let recipesSection = document.getElementById("recipesSection");
    let recipesDetails = document.getElementById("recipesDetails");
    let switcher = document.getElementById("catalogSwitch");
    if (!foodsSection || !recipesSection || !switcher) return;

    catalogMode = mode === MODE_RECIPES ? MODE_RECIPES : MODE_FOODS;
    foodsSection.hidden = catalogMode !== MODE_FOODS;
    recipesSection.hidden = catalogMode !== MODE_RECIPES;
    if (catalogMode === MODE_RECIPES && recipesDetails) recipesDetails.open = true;

    switcher.querySelectorAll("[data-catalog-mode]").forEach((button) => {
      let active = button.dataset.catalogMode === catalogMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function openRecipeCatalog(filter = "") {
    if (filter && typeof recipeFilter !== "undefined") recipeFilter = filter;
    openingRecipeCatalog = true;
    try {
      showView("foods");
    } finally {
      openingRecipeCatalog = false;
    }
    setCatalogMode(MODE_RECIPES);
    renderPrep();
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function bindRecipeEntryButtons() {
    let home = document.getElementById("openRecipes");
    if (home) home.onclick = () => openRecipeCatalog();

    let prep = document.getElementById("prepOpenRecipes");
    if (prep) prep.onclick = () => openRecipeCatalog();

    let freezer = document.getElementById("prepOpenFreezerRecipes");
    if (freezer) freezer.onclick = () => openRecipeCatalog("freezer");
  }

  function fixPrepRecipeHint() {
    let empty = document.querySelector("#cookNow .empty");
    if (empty && /Unter „Mehr“/i.test(empty.textContent || "")) {
      empty.textContent = "Noch kein Rezept vollständig freigeschaltet. Unter „Rezepte“ siehst du fast passende Rezepte.";
    }
  }

  function refreshAuditNavigationCheck() {
    let row = [...document.querySelectorAll("#auditList .checkline")].find((node) =>
      /Protokoll und Rezepte liegen unter Mehr/.test(node.textContent || ""),
    );
    if (!row) return;

    let ok = !!document.querySelector("#more #logDetails") &&
      !!document.querySelector("#foods #recipesDetails") &&
      !document.querySelector("#more #recipesDetails");
    row.innerHTML = `<span class="statusdot ${ok ? "good" : "warn"}"></span><div><b>${ok ? "Geprüft" : "Prüfen"}:</b> Protokoll liegt unter Mehr; Rezepte liegen im gemeinsamen Lebensmittel-Tab</div>`;
  }

  let switcher = document.getElementById("catalogSwitch");
  switcher?.querySelectorAll("[data-catalog-mode]").forEach((button) => {
    button.onclick = () => setCatalogMode(button.dataset.catalogMode);
  });

  let recipesDetails = document.getElementById("recipesDetails");
  if (recipesDetails) {
    recipesDetails.open = true;
    recipesDetails.addEventListener("toggle", () => {
      if (!recipesDetails.open) recipesDetails.open = true;
    });
    let heading = recipesDetails.querySelector(":scope > summary");
    if (heading) {
      heading.tabIndex = -1;
      heading.setAttribute("role", "heading");
      heading.setAttribute("aria-level", "2");
    }
  }
  setCatalogMode(MODE_FOODS);

  let originalShowView = showView;
  showView = function showViewWithCatalogDefault(id) {
    originalShowView(id);
    if (id === "foods" && !openingRecipeCatalog) setCatalogMode(MODE_FOODS);
  };

  let originalRenderHome = renderHome;
  renderHome = function renderHomeWithCatalogNavigation() {
    originalRenderHome();
    bindRecipeEntryButtons();
  };

  let originalRenderPrep = renderPrep;
  renderPrep = function renderPrepWithCatalogNavigation() {
    originalRenderPrep();
    fixPrepRecipeHint();
    bindRecipeEntryButtons();
  };

  let originalRenderAuditCore = renderAuditCore;
  renderAuditCore = function renderAuditCoreWithCatalogNavigation() {
    originalRenderAuditCore();
    refreshAuditNavigationCheck();
  };
})();
