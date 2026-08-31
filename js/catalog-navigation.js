"use strict";

/* Gemeinsamer Katalog-Tab für Lebensmittel und Rezepte.
 * Rezeptdaten, Planner und direkte Rezeptdetail-Dialoge bleiben unverändert.
 */
(function catalogNavigationModule() {
  if (typeof document === "undefined") return;

  const MODE_FOODS = "foods";
  const MODE_RECIPES = "recipes";

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

  function recipeCatalogSearchTerms(recipe) {
    const aliases = typeof recipeAliasValues === "function" ? recipeAliasValues(recipe) : [];
    const structuredTerms = recipeCatalogStructuredLabels(recipe).flatMap((label) => {
      if (
        typeof recipeFoodFromStructuredLabel !== "function" ||
        typeof FOOD_DB === "undefined" ||
        typeof foodAliasTerms !== "function"
      ) return [label];
      const item = recipeFoodFromStructuredLabel(label, FOOD_DB);
      return item ? [item.name, ...foodAliasTerms(item)] : [label];
    });
    return [
      recipe?.name || "",
      ...aliases,
      ...(recipe?.variantLabels || []),
      ...structuredTerms,
    ].filter(Boolean);
  }

  function recipeCatalogSearchMatches(recipe, query, fullSearchText = "") {
    const normalizedQuery = normalizeName(query || "");
    if (!normalizedQuery) return true;

    // Ist die Eingabe exakt ein bekanntes Lebensmittel (z. B. „Ei“), zählt
    // ausschließlich die strukturierte Rezept-Zutatenbeziehung. So kann ein
    // zufälliger Titeltext niemals einen Zutaten-Treffer vortäuschen.
    const exactFood = recipeCatalogExactFood(query);
    if (exactFood) return recipeCatalogContainsFood(recipe, exactFood);

    const exactOrPrefixMatch = recipeCatalogSearchTerms(recipe).some((term) => {
      const normalizedTerm = normalizeName(term || "");
      if (!normalizedTerm) return false;
      if (normalizedTerm === normalizedQuery || normalizedTerm.startsWith(normalizedQuery)) return true;
      return normalizedTerm
        .split(" ")
        .filter(Boolean)
        .some((word) => word === normalizedQuery || word.startsWith(normalizedQuery));
    });
    if (exactOrPrefixMatch) return true;

    // Sehr kurze Suchbegriffe dürfen nicht irgendwo mitten in einem Wort treffen.
    // Ab drei Zeichen bleibt die bisherige flexible Volltextsuche inklusive
    // Zutatenbeschreibung erhalten.
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
      try {
        return baseRenderPrep.apply(this, args);
      } finally {
        recipeSearchText = baseRecipeSearchText;
      }
    };
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

  function openRecipeCatalog(filter = "") {
    if (filter && typeof recipeFilter !== "undefined") recipeFilter = filter;
    showView("foods");
    setCatalogMode(MODE_RECIPES);
    renderPrep();
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

  installIngredientAwareRecipeSearch();

  const switcher = document.getElementById("catalogSwitch");
  switcher?.querySelectorAll("[data-catalog-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.catalogMode;
      setCatalogMode(mode);
      if (mode === MODE_RECIPES && typeof renderPrep === "function") renderPrep();
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
      queueMicrotask(() => setCatalogMode(MODE_FOODS));
    }
  }, true);

  const observer = new MutationObserver(() => fixLegacyNavigationCopy());
  observer.observe(document.body, { childList: true, subtree: true });

  setCatalogMode(MODE_FOODS);
  fixLegacyNavigationCopy();
})();
