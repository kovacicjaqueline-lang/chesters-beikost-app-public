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

/* MOBILE-A/B: gemeinsame Mobile-First-Shell und fokussierte Heute-Ansicht.
 * Fachliche Planung, Vorrat, Rezepte und Persistenz bleiben in den bestehenden Modulen.
 */
(function mobileFoundationModule(root) {
  if (typeof document === "undefined") return;
  if (root.__mobileFoundationInstalled) return;
  if (typeof renderHome !== "function" || typeof showView !== "function") return;

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
body.mobile-foundation #todayCard .today-focus-meal > .mealbox {
  border: 1px solid var(--line) !important;
  border-radius: 15px !important;
  background: var(--surface-soft, #fffaf3) !important;
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
body.mobile-foundation .today-recommendation.today-texture-coach {
  display: block !important;
}
body.mobile-foundation .today-recommendation.today-texture-coach > details {
  width: 100%;
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
    let releaseTimer = 0;

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
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => {
        restoreSnapshot();
        snapshot = null;
      }, 120);
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
      clearTimeout(releaseTimer);
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

  const baseShowView = showView;
  showView = function mobileFoundationShowView(id) {
    const result = baseShowView.apply(this, arguments);
    updateAppBar(id);
    return result;
  };

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

  function renderTodayFocus() {
    const card = document.getElementById("todayCard");
    if (!card) return { focusMeal: null, active: [] };

    const on = today();
    const age = monthsOld(on);
    const day = buildDays(on, 1)[0];
    const active = day.meals.filter((meal) => meal.active && meal.focusId);
    const openMeals = active.filter((meal) => !mealIsCompleted(on, meal.meal));
    const focusMeal = openMeals[0] || null;
    let nextPlanned = null;

    if (!active.length) {
      for (let offset = 1; offset <= 45; offset++) {
        const candidateDate = addDays(on, offset);
        const candidateDay = buildDays(candidateDate, 1, false)[0];
        if (candidateDay.meals.some((meal) => meal.active && meal.focusId)) {
          nextPlanned = candidateDate;
          break;
        }
      }
    }

    card.className = "card today-card today-focus-card";
    if (!active.length) {
      card.innerHTML = `<div class="row"><div class="grow"><span class="today-section-kicker">Heute</span><h2>Nichts geplant</h2><div class="small">${nice(on, true)} · ${age} Monate</div></div></div><div class="today-focus-empty"><p>Für heute ist keine Mahlzeit geplant.</p>${nextPlanned ? `<div class="small">Nächster geplanter Tag: ${nice(nextPlanned, true)}</div>` : ""}</div><button class="btn full" id="homeFreeLog">Essen eintragen</button>`;
      document.getElementById("homeFreeLog")?.addEventListener("click", () => openLog(null));
      return { focusMeal, active };
    }

    const heading = focusMeal ? "Als Nächstes" : "Heute erledigt";
    const mealHeading = focusMeal ? mealName(focusMeal.meal) : "Alles eingetragen";
    const focusHtml = focusMeal
      ? `<div class="today-focus-meal">${renderMeal(day, focusMeal)}</div>`
      : '<div class="today-done-summary"><b>Alle geplanten Mahlzeiten sind eingetragen.</b><span class="small">Der Tagesüberblick bleibt unten sichtbar.</span></div>';
    const timeline = active.map((meal) => timelineRow(day, meal, focusMeal)).join("");

    card.innerHTML = `<div class="row today-focus-head"><div class="grow"><span class="today-section-kicker">${heading}</span><h2>${esc(mealHeading)}</h2><div class="small">${nice(on, true)} · ${age} Monate</div></div></div>${focusHtml}<div class="today-timeline" aria-label="Tages-Timeline"><div class="today-timeline-heading"><b>Heute</b><span class="small">${active.length} ${active.length === 1 ? "Mahlzeit" : "Mahlzeiten"}</span></div>${timeline}</div><div class="add-meal-row"><button class="btn secondary smallbtn" id="homeAddEntry">Weiteres Essen eintragen</button></div>`;

    bindRenderedMealActions(card);
    ensureRenderedRandomSwapAction(card.querySelector(".today-focus-meal"), on, focusMeal);
    root.__plannedRecipeDetails?.decorateHomeRecipeTitles?.();
    card.querySelectorAll(".today-timeline-row.completed .editCompletedLog").forEach((button) => {
      button.classList.add("timeline-edit");
      button.onclick = () => editLogEntry(button.dataset.log);
    });
    document.getElementById("homeAddEntry")?.addEventListener("click", () => openLog(null));
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
    card.style.display = "block";

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

    card.classList.add("today-texture-coach");
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
    const all = recipeStates();
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
    [phase, today, recommendation, progress, recipe].forEach((node) => home.appendChild(node));
  }

  function renderMobileToday() {
    renderDayContext();
    const { focusMeal } = renderTodayFocus();
    renderContextRecommendation();
    renderCompactProgress();
    renderContextRecipe(focusMeal);
    arrangeTodaySections();
  }

  const baseRenderHome = renderHome;
  renderHome = function mobileFoundationRenderHome() {
    const result = baseRenderHome.apply(this, arguments);
    renderMobileToday();
    return result;
  };

})(typeof globalThis !== "undefined" ? globalThis : window);
