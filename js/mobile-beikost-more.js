"use strict";

/* Mobile-First Beikost + Mehr
 * Präsentationsschicht auf Basis der bestehenden Mobile-Foundation.
 * Fachlogik, Datenmodell, Food-/Recipe-Renderer und Persistenz bleiben unverändert.
 */
(function mobileBeikostMoreModule(root) {
  if (typeof document === "undefined") return;
  if (root.__mobileBeikostMoreInstalled) return;
  if (!root.MobileUiLifecycle?.onRender || !root.MobileUiLifecycle?.onViewChange) return;
  root.__mobileBeikostMoreInstalled = true;

  const FOOD_PRIMARY_FILTERS = new Set(["all", "open", "allergen"]);
  const FOOD_FILTER_LABELS = {
    all: "Alle",
    open: "Offen",
    allergen: "Allergene",
    ph: "Philippinen",
    iron: "Eisenreich",
    paused: "Pause",
    inactive: "Deaktiviert",
  };

  function syncGroupedFilterVisibility() {
    document.querySelectorAll(".mobile-filter-secondary").forEach((secondary) => {
      const list = secondary.querySelector(".mobile-filter-secondary-list");
      secondary.open = !!list?.querySelector("button.active");
    });
  }

  function groupFilters(container, primaryKeys, keyAttribute, label) {
    if (!container || container.dataset.mobileGrouped === "true") return;
    const buttons = [...container.querySelectorAll(":scope > button")];
    if (!buttons.length) return;

    container.dataset.mobileGrouped = "true";
    container.classList.add("mobile-filter-group");
    container.classList.remove("seg");

    const primary = document.createElement("div");
    primary.className = "seg mobile-filter-primary";
    const secondary = document.createElement("details");
    secondary.className = "mobile-filter-secondary";
    secondary.innerHTML = `<summary>${label}</summary><div class="seg mobile-filter-secondary-list"></div>`;
    const secondaryList = secondary.querySelector(".mobile-filter-secondary-list");

    buttons.forEach((button) => {
      const key = button.getAttribute(keyAttribute) || "";
      (primaryKeys.has(key) ? primary : secondaryList).appendChild(button);
    });

    container.replaceChildren(primary, secondary);

    syncGroupedFilterVisibility();
  }

  function updateFoodFilterSelectorLabels() {
    const filters = document.getElementById("foodFilters");
    if (!filters) return;

    const primary = filters.querySelector(".mobile-filter-primary");
    const secondary = filters.querySelector(".mobile-filter-secondary");
    const primarySummary = filters.querySelector("[data-food-primary-summary]");
    const secondarySummary = filters.querySelector("[data-food-secondary-summary]");
    const primaryActive = primary?.querySelector("button.active");
    const secondaryActive = secondary?.querySelector("button.active");

    if (primarySummary) {
      primarySummary.textContent = FOOD_FILTER_LABELS[primaryActive?.dataset.filter] || "Offen";
    }
    if (secondarySummary) {
      const count = secondary?.querySelectorAll("button.active").length || 0;
      secondarySummary.textContent = count ? `Filter (${count})` : "Filter";
    }
  }

  function installFoodFilterSelectors() {
    const filters = document.getElementById("foodFilters");
    if (!filters || filters.dataset.mobileCompactSelectors === "true") return;

    const primary = filters.querySelector(".mobile-filter-primary");
    const secondary = filters.querySelector(".mobile-filter-secondary");
    const secondaryList = secondary?.querySelector(".mobile-filter-secondary-list");
    if (!primary || !secondary || !secondaryList) return;

    filters.dataset.mobileCompactSelectors = "true";
    secondary.classList.add("mobile-filter-select", "food-secondary-select");

    const primarySelect = document.createElement("details");
    primarySelect.className = "mobile-filter-select food-primary-select";
    primarySelect.innerHTML = `<summary><span data-food-primary-summary>Offen</span><span aria-hidden="true">⌄</span></summary><div class="mobile-filter-select-menu"></div>`;
    primarySelect.querySelector(".mobile-filter-select-menu").appendChild(primary);

    const secondarySummary = secondary.querySelector("summary");
    if (secondarySummary) {
      secondarySummary.innerHTML = `<span data-food-secondary-summary>Filter</span><span aria-hidden="true">⌄</span>`;
    }
    secondaryList.classList.add("mobile-filter-select-menu");

    const toolbar = document.createElement("div");
    toolbar.className = "mobile-filter-toolbar food-filter-toolbar";
    toolbar.append(primarySelect, secondary);
    filters.replaceChildren(toolbar);
    filters.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => button.closest("details")?.removeAttribute("open"));
    });
    updateFoodFilterSelectorLabels();
  }

  function installRecipeFilterSelectors() {
    const section = document.getElementById("recipesSection");
    const categoryField = document.getElementById("recipeFilter")?.closest(".recipe-filter-field");
    const mealField = document.getElementById("recipeMealFilter")?.closest(".recipe-meal-filter-field");
    const more = document.getElementById("recipeMoreFilters");
    if (!section || !categoryField || !mealField || !more || section.dataset.mobileCompactSelectors === "true") return;

    section.dataset.mobileCompactSelectors = "true";

    const matchSelect = document.createElement("details");
    matchSelect.className = "mobile-filter-select recipe-match-select";
    matchSelect.innerHTML = `<summary><span data-recipe-match-summary>Fast passend</span><span aria-hidden="true">⌄</span></summary><div class="mobile-filter-select-menu"></div>`;
    matchSelect.querySelector(".mobile-filter-select-menu").appendChild(categoryField);

    const mealSelect = document.createElement("details");
    mealSelect.className = "mobile-filter-select recipe-meal-select";
    mealSelect.innerHTML = `<summary><span data-recipe-meal-summary>Mahlzeit</span><span aria-hidden="true">⌄</span></summary><div class="mobile-filter-select-menu"></div>`;
    mealSelect.querySelector(".mobile-filter-select-menu").appendChild(mealField);

    const toolbar = document.createElement("div");
    toolbar.className = "mobile-filter-toolbar recipe-filter-toolbar";
    toolbar.append(matchSelect, mealSelect, more);
    document.getElementById("recipeSearch")?.closest(".field")?.after(toolbar);
    section.querySelectorAll("#recipeFilter button, #recipeMealFilter button").forEach((button) => {
      button.addEventListener("click", () => button.closest("details")?.removeAttribute("open"));
    });
  }

  function installFoodCatalogStructure() {
    const section = document.getElementById("foodsCatalogSection");
    if (!section || section.dataset.mobileCatalog === "true") return;
    section.dataset.mobileCatalog = "true";
    section.classList.add("mobile-food-catalog");

    const search = document.getElementById("foodSearch")?.closest(".field");
    search?.classList.add("mobile-catalog-search");

    groupFilters(
      document.getElementById("foodFilters"),
      FOOD_PRIMARY_FILTERS,
      "data-filter",
      "Weitere Filter",
    );
    installFoodFilterSelectors();
  }

  function installRecipeCatalogStructure() {
    const section = document.getElementById("recipesSection");
    if (!section || section.dataset.mobileCatalog === "true") return;
    section.dataset.mobileCatalog = "true";
    section.classList.add("mobile-recipe-catalog");

    document.getElementById("recipeSearch")?.closest(".field")?.classList.add("mobile-catalog-search");
    installRecipeFilterSelectors();
  }

  function decorateFoodRows() {
    document.querySelectorAll("#foodList .foodcard").forEach((card) => {
      if (card.classList.contains("followup-food-card")) {
        card.classList.add("mobile-followup-food-card");
        return;
      }
      card.classList.add("mobile-food-row");
      const info = card.querySelector(".foodInfo");
      if (info) {
        const name = card.querySelector(".foodtitle")?.textContent?.trim() || "Lebensmittel";
        info.classList.add("food-row-chevron");
        info.textContent = "›";
        info.setAttribute("aria-label", `Details zu ${name}`);
      }
      if (card.dataset.mobileRowBound === "true") return;
      card.dataset.mobileRowBound = "true";
      card.addEventListener("click", (event) => {
        if (typeof foodReorderMode !== "undefined" && foodReorderMode) return;
        if (event.target.closest("button, input, select, textarea, a, summary")) return;
        card.querySelector(".foodInfo")?.click();
      });
    });
  }

  function installFoodRowDecorator() {
    decorateFoodRows();
  }

  function installFoodDetailScreen() {
    if (root.__mobileFoodDetailWrapped) return;
    if (typeof openGeneric !== "function" || typeof showFoodInfo !== "function") return;
    root.__mobileFoodDetailWrapped = true;

    const baseOpenGeneric = openGeneric;
    openGeneric = function mobileAwareOpenGeneric(...args) {
      document.getElementById("genericModal")?.classList.remove("mobile-food-detail-screen");
      return baseOpenGeneric.apply(this, args);
    };

    const baseShowFoodInfo = showFoodInfo;
    showFoodInfo = function mobileFoodInfoScreen(...args) {
      const result = baseShowFoodInfo.apply(this, args);
      const modal = document.getElementById("genericModal");
      if (modal) modal.classList.add("mobile-food-detail-screen");
      return result;
    };
  }

  function moreDestinationId(card, fallback) {
    if (!card) return "";
    if (!card.id) card.id = fallback;
    card.classList.add("mobile-more-destination");
    return card.id;
  }

  function installMoreNavigation() {
    const more = document.getElementById("more");
    if (!more || more.dataset.mobileMore === "true") return;

    more.dataset.mobileMore = "true";

    const log = document.getElementById("logSection");
    const statistics = document.getElementById("statisticsSection");
    const allergen = more.querySelector(".allergen-card");
    const settings = more.querySelector(".settings-card");
    const help = more.querySelector(".help-card");
    const data = more.querySelector(".data-card");

    const ids = {
      log: moreDestinationId(log, "logSection"),
      statistics: moreDestinationId(statistics, "statisticsSection"),
      allergen: moreDestinationId(allergen, "allergenSection"),
      settings: moreDestinationId(settings, "settingsSection"),
      help: moreDestinationId(help, "helpSection"),
      data: moreDestinationId(data, "dataSection"),
    };

    const destinations = [log, statistics, allergen, settings, help, data].filter(Boolean);
    if (!destinations.length) return;

    const navScreen = document.createElement("div");
    navScreen.className = "more-nav-screen";
    navScreen.id = "moreNavScreen";

    const groups = [
      {
        title: "Verlauf",
        items: [
          [ids.log, "Protokoll", "Essen und Beobachtungen", ""],
          [ids.statistics, "Statistik", "Fortschritt und Verlauf", ""],
        ],
      },
      {
        title: "Beikost",
        items: [
          [ids.allergen, "Allergene", "Einführen und wiederholen", ""],
          [ids.settings, "Baby & Beikostphase", "Start, Phase und Tagesablauf", "baby"],
          [ids.settings, "Konsistenz", "Mengenorientierung und Struktur", "texture"],
        ],
      },
      {
        title: "App",
        items: [
          [ids.settings, "Einstellungen", "Planung, Wiederholungen und Reise", "app"],
          [ids.data, "Datensicherung", "Backup und Wiederherstellung", ""],
          [ids.help, "Hilfe", "Begriffe und Sicherheitsgrundsätze", ""],
        ],
      },
    ];

    navScreen.innerHTML = groups.map((group, groupIndex) => {
      const headingId = `moreGroup${groupIndex}`;
      return `<section class="more-nav-group" aria-labelledby="${headingId}"><h2 id="${headingId}">${group.title}</h2><div class="more-nav-list">${group.items.map(([target, title, meta, focus]) => `<button class="more-nav-row" type="button" data-more-target="${target}" data-more-title="${title}" data-more-focus="${focus}"><span><b>${title}</b><small>${meta}</small></span><span class="more-nav-chevron" aria-hidden="true">›</span></button>`).join("")}</div></section>`;
    }).join("");

    const panelScreen = document.createElement("div");
    panelScreen.className = "more-panel-screen";
    panelScreen.id = "morePanelScreen";
    panelScreen.hidden = true;
    panelScreen.innerHTML = `<div class="more-panel-header"><button class="more-back-button" id="moreBack" type="button" aria-label="Zurück zu Mehr">‹</button><div><span class="today-section-kicker">Mehr</span><h2 id="morePanelTitle">Mehr</h2></div></div><div class="more-panel-host" id="morePanelHost"></div>`;
    const host = panelScreen.querySelector("#morePanelHost");

    destinations.forEach((card) => {
      card.hidden = true;
      host.appendChild(card);
    });
    more.append(navScreen, panelScreen);

    let activeDestination = null;

    function updateMoreAppBar(title = "Mehr") {
      const appBarTitle = document.getElementById("appBarTitle");
      if (appBarTitle && document.getElementById("more")?.classList.contains("active")) {
        appBarTitle.textContent = title;
      }
    }

    function configureSettingsFocus(focus) {
      if (!settings) return;
      const outer = settings.querySelector(":scope > details");
      if (outer) outer.open = true;
      const settingGroups = [...settings.querySelectorAll(".settings-group")];
      if (!focus) return;

      settingGroups.forEach((details) => { details.open = false; });
      if (focus === "baby") {
        [settingGroups[0], settingGroups[1]].filter(Boolean).forEach((details) => { details.open = true; });
      } else if (focus === "texture") {
        if (settingGroups[3]) settingGroups[3].open = true;
      } else if (focus === "app") {
        [settingGroups[2], settingGroups[4]].filter(Boolean).forEach((details) => { details.open = true; });
      }
    }

    function openDestination(targetId, title, focus = "") {
      const target = document.getElementById(targetId);
      if (!target || !host.contains(target)) return;
      activeDestination = targetId;
      destinations.forEach((card) => { card.hidden = card !== target; });
      navScreen.hidden = true;
      panelScreen.hidden = false;
      panelScreen.querySelector("#morePanelTitle").textContent = title || "Mehr";

      const outerDetails = target.querySelector(":scope > details.panel-details");
      if (outerDetails) outerDetails.open = true;
      if (target === settings) configureSettingsFocus(focus);

      updateMoreAppBar(title || "Mehr");
      document.querySelector("main")?.scrollTo({ top: 0, behavior: "auto" });
    }

    function showMenu() {
      activeDestination = null;
      destinations.forEach((card) => { card.hidden = true; });
      panelScreen.hidden = true;
      navScreen.hidden = false;
      updateMoreAppBar("Mehr");
      document.querySelector("main")?.scrollTo({ top: 0, behavior: "auto" });
    }

    navScreen.querySelectorAll(".more-nav-row").forEach((button) => {
      button.addEventListener("click", () => openDestination(
        button.dataset.moreTarget,
        button.dataset.moreTitle,
        button.dataset.moreFocus || "",
      ));
    });
    panelScreen.querySelector("#moreBack")?.addEventListener("click", showMenu);
    panelScreen.querySelector(".more-panel-header > div")?.addEventListener("click", showMenu);

    const directOpenDetails = [
      [log?.querySelector(":scope > details"), ids.log, "Protokoll"],
      [statistics?.querySelector(":scope > details"), ids.statistics, "Statistik"],
      [settings?.querySelector(":scope > details"), ids.settings, "Einstellungen"],
      [help?.querySelector(":scope > details"), ids.help, "Hilfe"],
      [data?.querySelector(":scope > details"), ids.data, "Datensicherung"],
    ];
    directOpenDetails.forEach(([details, target, title]) => {
      details?.addEventListener("toggle", () => {
        if (!details.open || navScreen.hidden || activeDestination) return;
        openDestination(target, title);
      });
    });

    root.__mobileMoreShowMenu = showMenu;
    showMenu();
    return true;
  }

  function installMobileBeikostMore() {
    installFoodCatalogStructure();
    installRecipeCatalogStructure();
    installFoodRowDecorator();
    installFoodDetailScreen();
    installMoreNavigation();
  }

  root.MobileUiLifecycle.onRender("foods", () => {
    decorateFoodRows();
    syncGroupedFilterVisibility();
    updateFoodFilterSelectorLabels();
  });
  root.MobileUiLifecycle.onRender("prep", syncGroupedFilterVisibility);
  root.MobileUiLifecycle.onRender("more", () => {
    installMoreNavigation();
    root.__mobileMoreShowMenu?.();
  });
  root.MobileUiLifecycle.onViewChange(({ viewId }) => {
    if (viewId !== "more") return;
    installMoreNavigation();
    root.__mobileMoreShowMenu?.();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(installMobileBeikostMore, 0);
    }, { once: true });
  } else {
    setTimeout(installMobileBeikostMore, 0);
  }
})(typeof globalThis !== "undefined" ? globalThis : window);