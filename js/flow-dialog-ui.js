"use strict";

/* FLOW-C: gemeinsame UI-Schicht für fachlich getrennte Eingabe-/Bearbeitungsdialoge.
 * Der Log-Dialog wird hier ausschließlich für die mobile Interaktion strukturiert.
 * Fachliche FOOD-/Planner-Regeln bleiben in ihren bestehenden Controllern.
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
      try { name = decodeURIComponent(name); } catch {}
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
      setText(empty, document.getElementById("selectorRecipes")?.classList.contains("active")
        ? "Kein passendes Rezept gefunden."
        : "Kein Lebensmittel gefunden.");
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
    const heading = genericModal.querySelector(".sheethead .grow");
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

  function recentLogs() {
    return (state?.logs || []).slice().sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || "")) ||
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );
  }

  function recentFoodItems(limit = 4) {
    const seen = new Set();
    const items = [];
    for (const log of recentLogs()) {
      for (const id of log.foodIds || []) {
        if (seen.has(id)) continue;
        seen.add(id);
        const item = typeof food === "function" ? food(id) : null;
        if (!item || item.active === false) continue;
        items.push(item);
        if (items.length >= limit) return items;
      }
    }
    return items;
  }

  function recentRecipeItems(limit = 4) {
    const seen = new Set();
    const items = [];
    for (const log of recentLogs()) {
      const name = String(log.recipeName || "").trim();
      const key = normalizeSearch(name);
      if (!name || seen.has(key)) continue;
      const recipe = typeof recipeByName === "function" ? recipeByName(name) : null;
      if (!recipe) continue;
      seen.add(key);
      items.push(recipe);
      if (items.length >= limit) return items;
    }
    return items;
  }

  function selectedRecipeNeedsChoice() {
    const recipe = pendingLog?.recipeName && typeof recipeByName === "function"
      ? recipeByName(pendingLog.recipeName)
      : null;
    return !!(recipe && typeof logRecipeNeedsExplicitChoice === "function" && logRecipeNeedsExplicitChoice(recipe));
  }

  function recipeChoiceRequirements(recipe) {
    return {
      variant: (typeof logRecipeBaseSets === "function" ? logRecipeBaseSets(recipe) : []).length > 1,
      oneOf: (recipe?.oneOf || []).length > 1,
      milk: (recipe?.milkChoices || []).length > 1,
    };
  }

  function recipeChoiceComplete(recipe, choice) {
    if (!recipe || !logRecipeNeedsExplicitChoice(recipe)) return true;
    const required = recipeChoiceRequirements(recipe);
    const explicit = choice?.__explicit || {};
    return (!required.variant || explicit.variant) &&
      (!required.oneOf || explicit.oneOf) &&
      (!required.milk || explicit.milk);
  }

  function focusFirstRequiredRecipeChoice() {
    const select = Array.from(logBody.querySelectorAll("[data-log-recipe-required]")).find((node) => !node.value);
    if (!select) return;
    select.scrollIntoView({ block: "center", inline: "nearest" });
    try { select.focus({ preventScroll: true }); } catch { select.focus(); }
  }

  logFoodCandidates = function logFoodCandidatesMobile(query) {
    const q = normalizeSearch(query);
    const pool = state.foods.filter((item) => item.active);
    if (!q) return recentFoodItems(4);
    return pool
      .filter((item) => foodSearchMatches(item, q))
      .sort((a, b) =>
        Number(selectedLogFoods.has(b.id)) - Number(selectedLogFoods.has(a.id)) ||
        foodSearchScore(a, q) - foodSearchScore(b, q) ||
        a.name.localeCompare(b.name, "de"),
      )
      .slice(0, 10);
  };

  logFoodResultsHtml = function logFoodResultsHtmlMobile() {
    const query = normalizeSearch(logFoodQuery);
    const candidates = logFoodCandidates(logFoodQuery);
    if (query && !candidates.length) return '<div class="small log-search-empty">Kein Lebensmittel gefunden</div>';
    return candidates.map((item) => {
      const selected = selectedLogFoods.has(item.id);
      if (!query) {
        return `<button type="button" class="live-result addLogFoodResult log-food-result ${selected ? "selected" : ""}" data-food="${item.id}" aria-label="${esc(item.name)} ${selected ? "entfernen" : "hinzufügen"}"><span class="grow log-result-copy"><b class="log-result-name">${esc(item.name)}</b></span><span class="log-result-add" aria-hidden="true">${selected ? "✓" : "＋"}</span></button>`;
      }
      const stock = inventoryPortions(item.id);
      const meta = `${foodCategoryLabel(item.category)} · ${displayStatus(item)}${stock ? ` · ${stock} im Vorrat` : ""}`;
      return `<button type="button" class="live-result addLogFoodResult log-food-result ${selected ? "selected" : ""}" data-food="${item.id}" aria-label="${esc(item.name)} ${selected ? "entfernen" : "hinzufügen"}, ${esc(meta)}"><span class="log-result-emoji" aria-hidden="true">${foodEmoji(item)}</span><span class="grow log-result-copy"><b class="log-result-name">${esc(item.name)}</b><span class="small log-result-meta">${esc(meta)}</span></span><span class="log-result-add" aria-hidden="true">${selected ? "✓" : "＋"}</span></button>`;
    }).join("");
  };

  logRecipeResultsHtml = function logRecipeResultsHtmlMobile(query = pendingLog?.__recipeQuery || "") {
    const q = normalizeSearch(query);
    const recipes = q ? logRecipeCandidates(query) : recentRecipeItems(4);
    if (q && !recipes.length) return '<div class="small log-search-empty">Kein Rezept gefunden</div>';
    return recipes.map((recipe) => `<button type="button" class="live-result selectLogRecipeResult" data-recipe="${esc(recipe.name)}" aria-label="${esc(recipe.name)} auswählen"><span class="grow log-result-copy"><b class="log-result-name">${esc(recipe.name)}</b>${q ? '<span class="small log-result-meta">Rezept auswählen</span>' : ""}</span><span class="log-result-add" aria-hidden="true">＋</span></button>`).join("");
  };

  logRecipeChoiceHtml = function logRecipeChoiceHtmlMobile(recipe, choice) {
    if (!recipe || !choice || !logRecipeNeedsExplicitChoice(recipe)) return "";
    const parts = [];
    const explicit = choice.__explicit || {};
    const sets = logRecipeBaseSets(recipe);
    if (sets.length > 1) {
      parts.push(`<div class="field"><label>Rezeptvariante</label><select data-log-recipe-variant data-log-recipe-required><option value="" ${explicit.variant ? "" : "selected"}>Bitte auswählen</option>${sets.map((set, index) => `<option value="${index}" ${explicit.variant && index === Number(choice.variantIndex) ? "selected" : ""}>${esc(recipe.variantLabels?.[index] || set.join(" + ") || `Variante ${index + 1}`)}</option>`).join("")}</select></div>`);
    }
    const choiceSelect = (label, names, value, key, attr) => {
      const options = (names || []).map((name) => ({ name, id: logRecipeFoodIdByName(name) })).filter((item) => item.id);
      if (options.length <= 1) return "";
      return `<div class="field"><label>${esc(label)}</label><select ${attr} data-log-recipe-required><option value="" ${explicit[key] ? "" : "selected"}>Bitte auswählen</option>${options.map((item) => `<option value="${esc(item.id)}" ${explicit[key] && item.id === value ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></div>`;
    };
    parts.push(choiceSelect("Tatsächlich verwendete Auswahl", recipe.oneOf, choice.oneOfId, "oneOf", "data-log-recipe-oneof"));
    parts.push(choiceSelect("Tatsächlich verwendetes Milchprodukt", recipe.milkChoices, choice.milkChoiceId, "milk", "data-log-recipe-milk"));
    return `<div class="log-recipe-choice">${parts.filter(Boolean).join("")}<div class="field-error-message log-recipe-choice-error" style="display:none"></div></div>`;
  };

  selectLogRecipeFromResult = function selectLogRecipeFromResultMobile(name) {
    captureLogDraft();
    const recipe = recipeByName(name);
    if (!recipe) return;
    const choice = logRecipeChoiceState(recipe);
    choice.__explicit = {};
    choice.confirmed = !logRecipeNeedsExplicitChoice(recipe);
    pendingLog.__recipeQuery = "";
    applyLogRecipeChoice(recipe, choice);
    document.activeElement?.blur?.();
    renderLogForm();
    if (logRecipeNeedsExplicitChoice(recipe)) queueMicrotask(focusFirstRequiredRecipeChoice);
  };

  updateLogRecipeChoice = function updateLogRecipeChoiceMobile(patch) {
    captureLogDraft();
    const recipe = recipeByName(pendingLog?.recipeName || "");
    if (!recipe) return;
    const current = pendingLog.__recipeChoice || logRecipeChoiceState(recipe);
    const explicit = { ...(current.__explicit || {}) };
    if (Object.prototype.hasOwnProperty.call(patch, "variantIndex")) explicit.variant = true;
    if (Object.prototype.hasOwnProperty.call(patch, "oneOfId")) explicit.oneOf = true;
    if (Object.prototype.hasOwnProperty.call(patch, "milkChoiceId")) explicit.milk = true;
    const choice = { ...current, ...patch, __explicit: explicit };
    choice.confirmed = recipeChoiceComplete(recipe, choice);
    applyLogRecipeChoice(recipe, choice);
    renderLogForm();
    if (!choice.confirmed) queueMicrotask(focusFirstRequiredRecipeChoice);
  };

  bindLogRecipeChoiceActions = function bindLogRecipeChoiceActionsMobile(root = document) {
    root.querySelector("[data-log-recipe-variant]")?.addEventListener("change", (event) => updateLogRecipeChoice({ variantIndex: Number(event.target.value) || 0 }));
    root.querySelector("[data-log-recipe-oneof]")?.addEventListener("change", (event) => updateLogRecipeChoice({ oneOfId: event.target.value }));
    root.querySelector("[data-log-recipe-milk]")?.addEventListener("change", (event) => updateLogRecipeChoice({ milkChoiceId: event.target.value }));
  };

  function syncCustomFoodAction() {
    const button = document.getElementById("addCustomLogFood");
    if (!button) return;
    const rawQuery = String(logFoodQuery || "").trim();
    const hasMatches = rawQuery ? logFoodCandidates(rawQuery).length > 0 : true;
    button.hidden = !rawQuery || hasMatches;
    const results = logBody.querySelector(".log-food-results");
    if (results && button.previousElementSibling !== results) results.after(button);
    if (button.hidden) return;
    button.textContent = `+ „${rawQuery}“ als eigenes Lebensmittel anlegen`;
    button.onclick = () => {
      captureLogDraft();
      const initialName = rawQuery;
      addCustomFoodForm({
        returnToLog: true,
        initialName,
        onSaved: (item) => {
          selectedLogFoods.add(item.id);
          pendingLog.foodOutcomes[item.id] = "tried";
          pendingLog.sampleFoodIds = [...new Set([...(pendingLog.sampleFoodIds || []), item.id])];
          pendingLog.baseFoodIds = (pendingLog.baseFoodIds || []).filter((id) => id !== item.id);
          if (!pendingLog.focusId) pendingLog.focusId = item.id;
          logFoodQuery = "";
          renderLogForm();
          logSelectorMode = "foods";
          queueMicrotask(() => document.getElementById("logFoodSearch")?.focus());
        },
      });
    };
  }

  renderLogFoodResults = function renderLogFoodResultsMobile() {
    const label = logBody.querySelector(".log-food-results-label");
    const results = logBody.querySelector(".log-food-results");
    if (!results) return;
    if (label) {
      label.textContent = logFoodQuery ? "Suchergebnisse" : "";
      label.hidden = !logFoodQuery;
    }
    results.innerHTML = logFoodResultsHtml();
    bindLogFoodResultActions(results);
    syncCustomFoodAction();
  };

  renderLogRecipeResults = function renderLogRecipeResultsMobile() {
    const input = document.getElementById("logRecipeSearch");
    const label = logBody.querySelector(".log-recipe-results-label");
    const results = logBody.querySelector(".log-recipe-results");
    if (!input || !results) return;
    pendingLog.__recipeQuery = input.value;
    if (label) {
      label.textContent = pendingLog.__recipeQuery ? "Suchergebnisse" : "";
      label.hidden = !pendingLog.__recipeQuery;
    }
    results.innerHTML = logRecipeResultsHtml(pendingLog.__recipeQuery);
    bindLogRecipeResultActions(results);
  };

  captureLogDraft = function captureLogDraftMobile(options = {}) {
    if (!pendingLog) return;
    const value = (id) => document.getElementById(id)?.value;
    if (!options.skipDate && value("logDate")) pendingLog.date = value("logDate");
    if (pendingLog.__mealContext && value("logMeal")) pendingLog.meal = value("logMeal");
    pendingLog.amount = value("logAmount") || "";
    pendingLog.__textureValue = value("logTexture") ?? pendingLog.__textureValue ?? "";
    if (pendingLog.__textureValue) {
      pendingLog.textureStage = Number(pendingLog.__textureValue);
      pendingLog.textureKnown = true;
    } else {
      delete pendingLog.textureStage;
      pendingLog.textureKnown = false;
    }
    if (document.getElementById("mainOutcome")) {
      const sampleIds = new Set(pendingLog.sampleFoodIds || []);
      for (const id of [...selectedLogFoods].filter((item) => !sampleIds.has(item))) {
        pendingLog.foodOutcomes[id] = document.getElementById("mainOutcome").value;
      }
    }
    document.querySelectorAll("[data-individual-result]").forEach((select) => {
      pendingLog.foodOutcomes[select.dataset.individualResult] = select.value;
    });
    document.querySelectorAll("[data-sample-result]").forEach((select) => {
      pendingLog.foodOutcomes[select.dataset.sampleResult] = select.value;
    });
  };

  saveLog = function saveLogMobile() {
    captureLogDraft();
    const freeRecipe = !pendingLog.editId && !pendingLog.__mealContext && pendingLog.recipeName
      ? recipeByName(pendingLog.recipeName)
      : null;
    const recipeChoiceError = logBody.querySelector(".log-recipe-choice-error");
    if (recipeChoiceError) {
      recipeChoiceError.textContent = "";
      recipeChoiceError.style.display = "none";
    }
    if (freeRecipe && logRecipeNeedsExplicitChoice(freeRecipe) && !pendingLog.__recipeChoice?.confirmed) {
      if (recipeChoiceError) {
        recipeChoiceError.textContent = "Bitte alle erforderlichen Rezeptangaben auswählen.";
        recipeChoiceError.style.display = "block";
      }
      focusFirstRequiredRecipeChoice();
      return;
    }

    const ids = [...selectedLogFoods];
    const foodPicker = logBody.querySelector(".log-food-picker");
    const foodError = document.getElementById("logFoodError");
    foodPicker?.classList.remove("field-error");
    if (foodError) {
      foodError.textContent = "";
      foodError.style.display = "none";
    }
    if (!ids.length) {
      foodPicker?.classList.add("field-error");
      if (foodError) {
        foodError.textContent = "Bitte mindestens ein tatsächlich enthaltenes Lebensmittel wählen.";
        foodError.style.display = "block";
      }
      logSelectorMode = "foods";
      ensureLogSelector();
      document.getElementById("logFoodSearch")?.focus();
      return;
    }

    const sampleIds = [...new Set((pendingLog.sampleFoodIds || []).filter((id) => ids.includes(id)))];
    const mainIds = ids.filter((id) => !sampleIds.includes(id));
    const mainOutcome = document.getElementById("mainOutcome")?.value || "eaten";
    const individual = !!pendingLog.individualRatings;
    const foodOutcomes = {};
    for (const id of mainIds) {
      foodOutcomes[id] = individual
        ? (document.querySelector(`[data-individual-result="${id}"]`)?.value || mainOutcome)
        : mainOutcome;
    }
    for (const id of sampleIds) {
      foodOutcomes[id] = document.querySelector(`[data-sample-result="${id}"]`)?.value || pendingLog.foodOutcomes?.[id] || "tried";
    }
    const focus = pendingLog.focusId && ids.includes(pendingLog.focusId)
      ? pendingLog.focusId
      : (sampleIds[0] || mainIds[0] || ids[0]);
    const reactionFoodId = ids.find((id) => foodOutcomes[id] === "reaction") || "";
    const overall = foodOutcomes[focus] || Object.values(foodOutcomes)[0] || "tried";
    const outcomes = Object.values(foodOutcomes);
    const offered = outcomes.some((outcome) => outcome !== "not_offered");
    const positiveTextureOutcome = outcomes.some((outcome) => ["eaten", "tried"].includes(outcome));
    const textureValue = document.getElementById("logTexture")?.value || "";
    const textureRequired = logTextureSelectionRequired({
      positiveOutcome: positiveTextureOutcome,
      isEdit: !!pendingLog.editId,
      legacyUnknown: !!pendingLog.__legacyTextureUnknown,
      textureValue,
    });
    const textureField = document.getElementById("logTexture")?.closest(".field");
    textureField?.classList.remove("field-error");
    textureField?.querySelector(".unified-texture-error")?.remove();
    if (textureRequired) {
      textureField?.classList.add("field-error");
      textureField?.insertAdjacentHTML("beforeend", '<div class="field-error-message unified-texture-error">Bitte die tatsächlich angebotene Konsistenz auswählen.</div>');
      requestLogTextureSelection();
      return;
    }

    const selectedTexture = validLogTextureStage(textureValue);
    const isEdit = !!pendingLog.editId;
    const oldLog = isEdit ? clone(state.logs.find((log) => log.id === pendingLog.editId)) : null;
    const newLog = {
      ...(oldLog || {}),
      id: pendingLog.editId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: document.getElementById("logDate").value,
      meal: pendingLog.editId && pendingLog.__legacyEntryType === "sample"
        ? String(pendingLog.__originalMeal ?? pendingLog.meal ?? "")
        : (pendingLog.__mealContext ? String(pendingLog.meal || "") : ""),
      foodIds: ids,
      focusId: focus,
      recipeName: pendingLog.recipeName || "",
      outcome: overall,
      foodOutcomes,
      entryType: pendingLog.editId ? (pendingLog.__legacyEntryType || "food") : "food",
      baseFoodIds: mainIds,
      sampleFoodIds: sampleIds,
      foodRoles: foodRolesFor(ids, mainIds, sampleIds),
      individualRatings: individual,
      amount: document.getElementById("logAmount")?.value || "",
      textureKnown: selectedTexture !== null,
      reactionFoodId,
      createdAt: pendingLog.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (selectedTexture !== null) newLog.textureStage = selectedTexture;
    else delete newLog.textureStage;
    if (Object.prototype.hasOwnProperty.call(pendingLog, "presentationMode")) newLog.presentationMode = pendingLog.presentationMode;
    if (!isEdit) {
      delete newLog.note;
      delete newLog.rejectionStrength;
      delete newLog.notOfferedReason;
    } else if (oldLog) {
      if (oldLog.outcome === "not_accepted" && overall !== "not_accepted") delete newLog.rejectionStrength;
      if (oldLog.outcome === "not_offered" && overall !== "not_offered") delete newLog.notOfferedReason;
    }

    const stateBefore = clone(state);
    const consumedNames = [];
    if (oldLog) {
      for (const foodId of oldLog.foodIds || []) {
        const item = food(foodId);
        if (outcomeForFood(oldLog, foodId) === "reaction" && item?.manualStatus === "Pausiert" && !item.reactionPauseSourceLogId) {
          item.reactionPausePreviousStatus = "auto";
          item.reactionPauseSourceLogId = oldLog.id;
        }
      }
    }
    if (!isEdit && offered) {
      const useRecipe = document.getElementById("useRecipeInventory")?.checked;
      if (useRecipe && selectedRecipeInventoryId) {
        const item = state.inventory.find((entry) => entry.id === selectedRecipeInventoryId);
        if (consumeInventoryItem(selectedRecipeInventoryId)) consumedNames.push(item?.recipeName || "Rezeptportion");
      } else {
        [...selectedInventoryFoods]
          .filter((id) => ids.includes(id) && foodOutcomes[id] !== "not_offered")
          .forEach((id) => {
            if (consumeInventoryPortion(id)) consumedNames.push(food(id)?.name || id);
          });
      }
    }
    if (isEdit) state.logs = state.logs.map((log) => log.id === pendingLog.editId ? newLog : log);
    else state.logs.push(newLog);
    const affectedFoodIds = new Set([...(oldLog?.foodIds || []), ...ids]);
    for (const foodId of affectedFoodIds) rebuildFoodConsequences(foodId);
    save();
    closeLog();
    renderAll();
    const inventoryMessage = consumedNames.length
      ? ` · ${consumedNames.length} Vorratsportion${consumedNames.length === 1 ? "" : "en"} abgezogen`
      : "";
    showToast(`${isEdit ? "Eintrag geändert" : "Eintrag gespeichert"}${inventoryMessage}.`, () => {
      state = stateBefore;
      save();
      renderAll();
      showToast("Eintrag und Folgeänderungen rückgängig gemacht.");
    });
  };

  function logContextNode() {
    return logBody.querySelector(".log-date-grid") || logBody.querySelector("#editLogContext")?.closest(".field") || null;
  }

  function decorateLogSelectorRows(container, kind) {
    if (!container) return;
    const selector = kind === "recipes" ? ".selectLogRecipeResult" : ".addLogFoodResult";
    const kindClass = kind === "recipes" ? "selectRecipe" : "selectFood";
    container.querySelectorAll(selector).forEach((row) => row.classList.add("selector-row", kindClass));
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
    recipePicker?.querySelector(".flow-log-search-toggle")?.remove();
    foodPicker.querySelector(".flow-log-search-toggle")?.remove();
    const recipeLabel = recipePicker?.querySelector(":scope > label") || null;
    const foodLabel = foodPicker.querySelector(":scope > label");
    setText(recipeLabel, "Suchen");
    setText(foodLabel, "Suchen");
    if (recipeInput) recipeInput.placeholder = "Rezept suchen";
    if (foodInput) foodInput.placeholder = "Lebensmittel suchen";
    const recipeResultsLabel = recipePicker?.querySelector(".log-recipe-results-label");
    const foodResultsLabel = foodPicker.querySelector(".log-food-results-label");
    if (recipeResultsLabel) setHidden(recipeResultsLabel, !String(recipeInput?.value || "").trim());
    if (foodResultsLabel) setHidden(foodResultsLabel, !String(foodInput?.value || "").trim());

    let tabs = selector.querySelector(".flow-log-selector-tabs");
    if (recipePicker) {
      if (!tabs) {
        tabs = document.createElement("div");
        tabs.className = "meal-selector-tabs flow-log-selector-tabs";
        tabs.setAttribute("role", "group");
        tabs.setAttribute("aria-label", "Rezepte oder Lebensmittel auswählen");
        tabs.innerHTML = '<button type="button" data-flow-log-selector="recipes" aria-controls="flowLogRecipePanel">Rezepte</button><button type="button" data-flow-log-selector="foods" aria-controls="flowLogFoodPanel">Lebensmittel</button>';
        selector.prepend(tabs);
      }
    } else {
      tabs?.remove();
      tabs = null;
      logSelectorMode = "foods";
    }
    if (foodPicker.classList.contains("field-error")) logSelectorMode = "foods";
    const mode = recipePicker && logSelectorMode === "recipes" ? "recipes" : "foods";
    logSelectorMode = mode;
    tabs?.querySelectorAll("[data-flow-log-selector]").forEach((button) => {
      const active = button.dataset.flowLogSelector === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    setHidden(recipePicker, mode !== "recipes");
    setHidden(foodPicker, mode !== "foods");
    selector.hidden = !!(recipePicker && pendingLog?.recipeName && mode === "recipes");
    syncCustomFoodAction();
  }

  function clearLogSelectorSearch(nextMode) {
    pendingLog.__recipeQuery = "";
    logFoodQuery = "";
    const recipeInput = document.getElementById("logRecipeSearch");
    const foodInput = document.getElementById("logFoodSearch");
    if (recipeInput) recipeInput.value = "";
    if (foodInput) foodInput.value = "";
    renderLogRecipeResults();
    renderLogFoodResults();
    logSelectorMode = nextMode;
    ensureLogSelector();
    queueMicrotask(() => {
      const input = nextMode === "recipes" ? document.getElementById("logRecipeSearch") : document.getElementById("logFoodSearch");
      input?.focus();
    });
  }

  function removeDeprecatedLogFields() {
    logBody.querySelector("#conditionalLogQuestions")?.remove();
    const note = logBody.querySelector("#logNote");
    note?.closest("details")?.remove();
    const selectedTarget = logBody.querySelector(".selected-target");
    selectedTarget?.querySelector(":scope > .small")?.remove();
  }

  function reorderLogFields() {
    const consistency = document.getElementById("logTexture")?.closest(".field");
    const amount = document.getElementById("logAmount")?.closest(".field");
    const ratingFields = Array.from(logBody.querySelectorAll(".field")).filter((field) =>
      field.querySelector("#mainOutcome, [data-individual-result], [data-sample-result]"),
    );
    const actions = logBody.querySelector(".sticky-form-actions");
    if (consistency && ratingFields[0]) ratingFields[0].before(consistency);
    if (amount && ratingFields.length) ratingFields[ratingFields.length - 1].after(amount);
    const stockFields = Array.from(logBody.querySelectorAll(".field")).filter((field) =>
      field.querySelector("#useRecipeInventory, [data-inventory-food]"),
    );
    if (actions) stockFields.forEach((field) => actions.before(field));
  }

  function syncSaveAvailability() {
    const button = document.getElementById("saveLog");
    if (!button) return;
    button.disabled = selectedRecipeNeedsChoice() && !pendingLog?.__recipeChoice?.confirmed;
  }

  function markSections(body) {
    body.querySelectorAll(".log-date-grid, .manual-meal-target-date").forEach((node) => node.classList.add("flow-dialog-context"));
    body.querySelectorAll(".meal-selector-tabs, .flow-log-selector").forEach((node) => node.classList.add("flow-dialog-selection"));
    body.querySelectorAll(".manual-role-overview, .selected-target, .log-recipe-choice").forEach((node) => node.classList.add("flow-dialog-selected"));
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
    genericContentObserver?.disconnect();
    genericContentObserver = null;
  }

  function stopLogContentObservation() {
    logContentObserver?.disconnect();
    logContentObserver = null;
  }

  function resetGeneric() {
    genericModal.classList.remove("flow-dialog");
    delete genericModal.dataset.flowDialogContext;
    mealSelectorQuery = "";
    const subtitle = document.getElementById("genericSubtitle");
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
    const match = rawTitle.match(/^(Mahlzeit hinzufügen|Mahlzeit bearbeiten)\s*·\s*(.+)$/);
    if (match) {
      genericModal.dataset.flowDialogContext = match[2];
      setText(genericTitle, match[1]);
      rawTitle = match[1];
    }
    const isMealEditor = /^(Mahlzeit hinzufügen|Mahlzeit bearbeiten)$/.test(rawTitle) && !!genericModal.dataset.flowDialogContext;
    if (!isMealEditor) {
      stopGenericContentObservation();
      resetGeneric();
      return;
    }
    const subtitle = ensureGenericSubtitle();
    const date = document.getElementById("manualMealTargetDate")?.value || "";
    setText(subtitle, [visibleDate(date), genericModal.dataset.flowDialogContext].filter(Boolean).join(" · "));
    decorate(genericModal, genericBody, subtitle);
    syncMealSelectorSearch();
    if (!genericContentObserver) {
      genericContentObserver = new MutationObserver(syncGeneric);
      genericContentObserver.observe(genericBody, { childList: true, subtree: true, characterData: true });
    }
  }

  function syncLog() {
    if (!logModal.classList.contains("open")) {
      stopLogContentObservation();
      return;
    }
    const subtitle = document.getElementById("logSubtitle");
    removeDeprecatedLogFields();
    ensureLogSelector();
    reorderLogFields();
    syncSaveAvailability();
    decorate(logModal, logBody, subtitle);
    if (!logContentObserver) {
      logContentObserver = new MutationObserver(syncLog);
      logContentObserver.observe(logBody, { childList: true, subtree: true, characterData: true });
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
  genericStateObserver.observe(genericModal, { attributes: true, attributeFilter: ["class"] });

  const logStateObserver = new MutationObserver(() => {
    const open = logModal.classList.contains("open");
    if (open === logOpen) return;
    logOpen = open;
    if (open) logSelectorMode = "recipes";
    syncLog();
    if (open) {
      queueMicrotask(() => {
        const input = logSelectorMode === "recipes" ? document.getElementById("logRecipeSearch") : document.getElementById("logFoodSearch");
        if (input && !logBody.querySelector(".flow-log-selector")?.hidden) input.focus();
      });
    }
  });
  logStateObserver.observe(logModal, { attributes: true, attributeFilter: ["class"] });

  genericModal.addEventListener("input", (event) => {
    if (event.target?.id !== "mealSelectorSearch") return;
    mealSelectorQuery = event.target.value;
    event.stopImmediatePropagation();
    filterMealSelectorResults();
  }, true);

  genericModal.addEventListener("change", (event) => {
    if (event.target?.id === "manualMealTargetDate") syncGeneric();
  });

  logModal.addEventListener("input", (event) => {
    if (event.target?.id === "logFoodSearch") queueMicrotask(syncCustomFoodAction);
  });

  logModal.addEventListener("click", (event) => {
    const tab = event.target.closest?.("[data-flow-log-selector]");
    if (tab && logBody.contains(tab)) {
      const nextMode = tab.dataset.flowLogSelector === "recipes" ? "recipes" : "foods";
      if (nextMode === "recipes") {
        const foodPicker = logBody.querySelector(".log-food-picker");
        const foodError = document.getElementById("logFoodError");
        foodPicker?.classList.remove("field-error");
        if (foodError) {
          foodError.textContent = "";
          foodError.style.display = "none";
        }
      }
      clearLogSelectorSearch(nextMode);
      return;
    }
    if (event.target.closest?.(".selectLogRecipeResult")) {
      logSelectorMode = "recipes";
      queueMicrotask(() => {
        syncLog();
        if (selectedRecipeNeedsChoice()) focusFirstRequiredRecipeChoice();
      });
      return;
    }
    if (event.target.closest?.("#clearLogRecipe")) {
      logSelectorMode = "recipes";
      queueMicrotask(() => {
        syncLog();
        document.getElementById("logRecipeSearch")?.focus();
      });
      return;
    }
    if (event.target.closest?.(".addLogFoodResult")) {
      logSelectorMode = "foods";
      queueMicrotask(() => {
        syncLog();
        document.getElementById("logFoodSearch")?.focus();
      });
    }
  });

  syncGeneric();
  syncLog();
  globalThis.__flowDialogUiInstalled = true;
})();