"use strict";

/* Protokoll
 * Ein gemeinsamer Essenseintrag mit internen FOOD-Rollen, getrennten Bewertungen,
 * optionaler Menge und ausdrücklich dokumentierter Konsistenz.
 */

function logMealSortRank(meal) {
  return ({ dinner: 4, lunch: 3, snack: 2, breakfast: 1 })[meal] || 0;
}
function logOutcomeGridHtml(log) {
  let items = (log.foodIds || []).map((id) => {
    let name = food(id)?.name || id;
    return `<div class="log-outcome-item"><b>${esc(name)}</b><span>${esc(outcomeLabel(outcomeForFood(log, id)))}</span></div>`;
  }).join("");
  let meta = [];
  if (log.amount) meta.push(`${esc(log.amount)} g`);
  let stage = logTextureStage(log);
  meta.push(stage ? `Stufe ${stage} · ${esc(textureName(stage))}` : "Konsistenz nicht dokumentiert");
  return `<div class="log-outcome-grid">${items}</div><div class="small log-entry-meta">${meta.join(" · ")}</div>`;
}
function renderLogsCore() {
  let all = state.logs
    .slice()
    .sort((a, b) => {
      let dateOrder = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateOrder) return dateOrder;
      let mealOrder = logMealSortRank(b.meal) - logMealSortRank(a.meal);
      if (mealOrder) return mealOrder;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  let months = [...new Set(all.map((l) => l.date.slice(0, 7)))].sort().reverse();
  let filter = document.getElementById("logMonthFilter");
  if (filter) {
    filter.innerHTML =
      '<option value="all">Alle Monate</option>' +
      months
        .map((month) => {
          let [year, mon] = month.split("-");
          let label = new Intl.DateTimeFormat("de-AT", {
            month: "long",
            year: "numeric",
          }).format(new Date(Number(year), Number(mon) - 1, 1));
          return `<option value="${month}">${esc(label)}</option>`;
        })
        .join("");
    filter.value = months.includes(logMonthFilter) ? logMonthFilter : "all";
    logMonthFilter = filter.value;
    filter.onchange = (e) => {
      logMonthFilter = e.target.value;
      logVisibleCount = 8;
      renderLogs();
    };
  }
  let filtered = logMonthFilter === "all" ? all : all.filter((l) => l.date.startsWith(logMonthFilter));
  let shown = filtered.slice(0, logVisibleCount);
  let summaryTitle = document.getElementById("logSummaryTitle");
  if (summaryTitle)
    summaryTitle.textContent = `Protokoll · ${all.length} ${all.length === 1 ? "Eintrag" : "Einträge"}`;
  let count = document.getElementById("logCountSummary");
  if (count)
    count.textContent = filtered.length === all.length
      ? "Monatsweise filtern; ältere Einträge bleiben gespeichert."
      : `${filtered.length} im gewählten Monat`;
  document.getElementById("logList").innerHTML = shown.length
    ? shown.map((l) => {
        let title = dishTitle(l);
        return `<div class="log-entry" data-log="${l.id}">
          <div class="log-entry-main">
            <div>
              <div class="log-date">${nice(l.date, true)}${logHasMealContext(l) ? ` · ${mealName(l.meal)}` : ""}</div>
              <div class="log-foods">${esc(title)}</div>
              ${logOutcomeGridHtml(l)}
              ${l.note ? `<details class="log-note-details"><summary>Notiz</summary><div class="small">${esc(l.note)}</div></details>` : ""}
            </div>
            <div class="log-entry-actions">
              <button type="button" class="iconbtn copyLog" aria-label="Essen kopieren" title="Kopieren">⧉</button>
              <button class="iconbtn editLog" aria-label="Essen bearbeiten">✎</button>
              <button class="iconbtn deleteLog" aria-label="Löschen">×</button>
            </div>
          </div>
        </div>`;
      }).join("")
    : '<div class="empty">Noch kein tatsächlicher Eintrag in diesem Zeitraum.</div>';
  let more = document.getElementById("logMore");
  if (more) {
    more.style.display = filtered.length > shown.length ? "block" : "none";
    more.textContent = `Weitere anzeigen (${filtered.length - shown.length})`;
    more.onclick = () => { logVisibleCount += 10; renderLogs(); };
  }

  document.querySelectorAll(".copyLog").forEach((b) =>
    b.onclick = () => copyLogEntry(b.closest("[data-log]").dataset.log),
  );
  document.querySelectorAll(".editLog").forEach((b) =>
    b.onclick = () => editLogEntry(b.closest("[data-log]").dataset.log),
  );
  document.querySelectorAll(".deleteLog").forEach((b) =>
    b.onclick = () => {
      let id = b.closest("[data-log]").dataset.log;
      let removed = state.logs.find((log) => log.id === id);
      if (!removed) return;
      let stateBefore = clone(state);
      for (let foodId of removed.foodIds || []) {
        let item = food(foodId);
        if (outcomeForFood(removed, foodId) === "reaction" && item?.manualStatus === "Pausiert" && !item.reactionPauseSourceLogId) {
          item.reactionPausePreviousStatus = "auto";
          item.reactionPauseSourceLogId = removed.id;
        }
      }
      state.logs = state.logs.filter((log) => log.id !== id);
      if (typeof invalidateLogsForCache === "function") invalidateLogsForCache();
      for (let foodId of new Set(removed.foodIds || [])) rebuildFoodConsequences(foodId);
      save(); renderAll();
      showToast("Eintrag gelöscht.", () => {
        state = stateBefore; save(); renderAll();
        showToast("Gelöschter Eintrag wiederhergestellt.");
      });
    },
  );
}

function copyLogEntry(id) {
  let source = state.logs.find((log) => log.id === id);
  if (!source) return;
  let copied = clone(source);
  delete copied.id;
  delete copied.createdAt;
  delete copied.updatedAt;
  delete copied.reactionFoodId;
  delete copied.editId;
  copied.__copySource = true;
  copied.date = today();
  openLog(copied);
  pendingLog.__copySource = true;
  pendingLog.__fromPlan = false;
  renderLogForm();
  const deferPrepDemand = () => {
    if (!pendingLog?.__copySource || typeof prepDemand !== "function") return;
    prepDemand();
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(deferPrepDemand);
  else setTimeout(deferPrepDemand, 0);
}

function editLogEntry(id) {
  let l = state.logs.find((x) => x.id === id);
  if (!l) return;
  openLog({ ...l, editId: id });
}

function logFoodCandidates(query) {
  let q = normalizeName(query);
  let pool = state.foods.filter((f) => f.active);
  if (q)
    return pool
      .filter((f) => foodSearchMatches(f, q))
      .sort((a, b) =>
        Number(selectedLogFoods.has(b.id)) - Number(selectedLogFoods.has(a.id)) ||
        foodSearchScore(a, q) - foodSearchScore(b, q) ||
        a.name.localeCompare(b.name, "de"),
      )
      .slice(0, 10);
  let selected = [...selectedLogFoods].map(food).filter((f) => f && f.active);
  let recentIds = state.logs
    .slice()
    .sort((a, b) => `${b.date}${b.createdAt || ""}`.localeCompare(`${a.date}${a.createdAt || ""}`))
    .flatMap((log) => log.foodIds || []);
  let recent = [...new Set(recentIds)]
    .map(food)
    .filter((f) => f && f.active && !selectedLogFoods.has(f.id));
  return [...selected, ...recent].slice(0, Math.max(4, selected.length));
}

function logRecipeSearchScore(recipe, query) {
  let q = normalizeName(query);
  if (!q || !recipe) return Number.POSITIVE_INFINITY;
  let name = normalizeName(recipe.name || "");
  let aliases = recipeAliasValues(recipe).map((alias) => normalizeName(alias));
  if (name === q) return 0;
  if (aliases.some((alias) => alias === q)) return 1;
  if (name.startsWith(q)) return 2;
  if (aliases.some((alias) => alias.startsWith(q))) return 3;
  return normalizeName(recipeSearchText(recipe)).includes(q) ? 4 : Number.POSITIVE_INFINITY;
}
function logRecipeCandidates(query) {
  let q = normalizeName(query);
  if (!q) return [];
  return RECIPES
    .map((recipe) => ({ recipe, score: logRecipeSearchScore(recipe, q) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score || a.recipe.name.localeCompare(b.recipe.name, "de"))
    .slice(0, 8)
    .map((item) => item.recipe);
}
function logRecipeBaseSets(recipe) {
  return [recipe?.requires || [], ...(recipe?.alternatives || [])].filter((set, index) => set.length || index === 0);
}
function logRecipeNeedsExplicitChoice(recipe) {
  return logRecipeBaseSets(recipe).length > 1 || (recipe?.oneOf || []).length > 1 || (recipe?.milkChoices || []).length > 1;
}
function logRecipeFoodIdByName(name) {
  if (typeof foodByName === "function") return foodByName(name, state?.foods || [])?.id || "";
  let normalized = normalizeName(name);
  return (state?.foods || []).find((item) => normalizeName(item?.name) === normalized)?.id || "";
}
function logRecipeChoiceState(recipe, presetFoodIds = []) {
  let preset = new Set(Array.isArray(presetFoodIds) ? presetFoodIds : []);
  let baseSets = logRecipeBaseSets(recipe);
  let baseIds = baseSets.map((set) => set.map(logRecipeFoodIdByName).filter(Boolean));
  let variantIndex = 0;
  let bestScore = -1;
  baseIds.forEach((ids, index) => {
    let score = ids.filter((id) => preset.has(id)).length + (ids.length && ids.every((id) => preset.has(id)) ? 1000 : 0);
    if (score > bestScore) { bestScore = score; variantIndex = index; }
  });
  let defaultIds = typeof recipeFoodIds === "function" ? recipeFoodIds(recipe) : [];
  if (!preset.size && defaultIds.length) {
    let defaults = new Set(defaultIds);
    let found = baseIds.findIndex((ids) => ids.length && ids.every((id) => defaults.has(id)));
    if (found >= 0) variantIndex = found;
  }
  let chooseFrom = (names) => {
    let ids = (names || []).map(logRecipeFoodIdByName).filter(Boolean);
    return ids.find((id) => preset.has(id)) || ids.find((id) => defaultIds.includes(id)) || ids[0] || "";
  };
  return { variantIndex, oneOfId: chooseFrom(recipe?.oneOf), milkChoiceId: chooseFrom(recipe?.milkChoices) };
}
function logRecipeChoiceRequirements(recipe) {
  return {
    variant: logRecipeBaseSets(recipe).length > 1,
    oneOf: (recipe?.oneOf || []).length > 1,
    milk: (recipe?.milkChoices || []).length > 1,
  };
}
function logRecipeChoiceComplete(recipe, choice) {
  if (!recipe || !logRecipeNeedsExplicitChoice(recipe)) return true;
  let required = logRecipeChoiceRequirements(recipe);
  let explicit = choice?.__explicit || {};
  return (!required.variant || explicit.variant) &&
    (!required.oneOf || explicit.oneOf) &&
    (!required.milk || explicit.milk);
}
function logRecipeActualFoodIds(recipe, choice) {
  if (!recipe) return [];
  let sets = logRecipeBaseSets(recipe);
  let selectedSet = sets[Math.max(0, Math.min(sets.length - 1, Number(choice?.variantIndex) || 0))] || [];
  let ids = selectedSet.map(logRecipeFoodIdByName).filter(Boolean);
  for (let id of [choice?.oneOfId, choice?.milkChoiceId]) if (id && !ids.includes(id)) ids.push(id);
  return [...new Set(ids)];
}
function logRecipeChoiceHtml(recipe, choice) {
  if (!recipe || !choice || !logRecipeNeedsExplicitChoice(recipe)) return "";
  let parts = [];
  let explicit = choice.__explicit || {};
  let sets = logRecipeBaseSets(recipe);
  if (sets.length > 1) {
    parts.push(`<div class="field"><label>Rezeptvariante</label><select data-log-recipe-variant data-log-recipe-required><option value="" ${explicit.variant ? "" : "selected"}>Bitte auswählen</option>${sets.map((set, index) => `<option value="${index}" ${explicit.variant && index === Number(choice.variantIndex) ? "selected" : ""}>${esc(recipe.variantLabels?.[index] || set.join(" + ") || `Variante ${index + 1}`)}</option>`).join("")}</select></div>`);
  }
  let choiceSelect = (label, names, value, key, attr) => {
    let options = (names || []).map((name) => ({ name, id: logRecipeFoodIdByName(name) })).filter((item) => item.id);
    if (options.length <= 1) return "";
    return `<div class="field"><label>${esc(label)}</label><select ${attr} data-log-recipe-required><option value="" ${explicit[key] ? "" : "selected"}>Bitte auswählen</option>${options.map((item) => `<option value="${esc(item.id)}" ${explicit[key] && item.id === value ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></div>`;
  };
  parts.push(choiceSelect("Tatsächlich verwendete Auswahl", recipe.oneOf, choice.oneOfId, "oneOf", "data-log-recipe-oneof"));
  parts.push(choiceSelect("Tatsächlich verwendetes Milchprodukt", recipe.milkChoices, choice.milkChoiceId, "milk", "data-log-recipe-milk"));
  return `<div class="log-recipe-choice">${parts.filter(Boolean).join("")}<div class="field-error-message log-recipe-choice-error" style="display:none"></div></div>`;
}

function closeLog() {
  document.getElementById("logModal").classList.remove("open");
}
function preserveLogSheetScrollAfterRender(sheet, scrollTop) {
  if (!sheet) return;
  const restore = () => {
    if (document.getElementById("logModal")?.classList.contains("open")) sheet.scrollTop = scrollTop;
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
  else queueMicrotask(restore);
}
function logContextHasChanged(p = pendingLog) {
  return !!p && (p.date !== p.__originalDate || p.meal !== p.__originalMeal);
}
function syncLogContextUi() {
  let p = pendingLog;
  if (!p) return;
  let summary = document.getElementById("logContextSummary");
  if (summary) summary.textContent = `${nice(p.date, true)} · ${mealName(p.meal)}`;
  let hint = document.getElementById("logContextPlanHint");
  if (hint) {
    hint.hidden = !(p.__fromPlan && !logContextHasChanged(p));
    hint.textContent = hint.hidden ? "" : "aus dem Plan";
  }
  let fields = document.getElementById("logContextFields");
  if (fields) fields.style.display = p.__contextEditing ? "block" : "none";
  let button = document.getElementById("editLogContext");
  if (button) {
    button.textContent = p.__contextEditing ? "Fertig" : "Ändern";
    button.setAttribute("aria-expanded", p.__contextEditing ? "true" : "false");
  }
}
function requestLogDateChange(nextDate, previousDate) {
  if (!pendingLog || !nextDate || nextDate === previousDate) return;
  captureLogDraft({ skipDate: true });
  pendingLog.date = nextDate;
  syncLogContextUi();
}

function renderLogs() {
  renderLogsCore();
  let button = document.getElementById("freeLog");
  if (button) button.onclick = (event) => { event.preventDefault(); openLog(null); };
}

function plannedLogContext(input) {
  if (!input || input.entryType === "sample") return false;
  if (!LOG_MEAL_KEYS.includes(String(input.meal || ""))) return false;
  if (input.editId) return logHasMealContext(input);
  return !!(input.focusId || input.recipeName || (input.foodIds || []).length || input.entryType === "meal");
}

function openLog(plan) {
  let input = plan ? { ...plan } : {
    date: today(), meal: "", focusId: "", foodIds: [], baseFoodIds: [], sampleFoodIds: [],
    recipeName: "", recipeInventoryId: "", entryType: "food", foodOutcomes: {},
  };
  let legacyEntryType = String(input.entryType || "");
  let originalDate = String(input.date || today());
  let originalMeal = String(input.meal || "");
  let mealContext = plannedLogContext(input);
  if (!mealContext && !input.editId) input.meal = "";
  pendingLog = input;
  let roles = roleIdsFromPlan(pendingLog);
  pendingLog.foodIds = roles.ids;
  pendingLog.baseFoodIds = roles.bases;
  pendingLog.sampleFoodIds = roles.samples;
  pendingLog.entryType = pendingLog.editId ? (legacyEntryType || "food") : "food";
  pendingLog.__mealContext = mealContext;
  pendingLog.__legacyEntryType = legacyEntryType;
  pendingLog.__originalDate = originalDate;
  pendingLog.__originalMeal = originalMeal;
  pendingLog.__fromPlan = !!plan && !input.editId && mealContext;
  pendingLog.__contextEditing = false;
  pendingLog.__legacyTextureUnknown = !!pendingLog.editId && logTextureStage(plan) === null && logPositiveOutcome(plan, outcomeForFood);
  pendingLog.__recipeQuery = "";
  pendingLog.__recipeChoice = pendingLog.__recipeChoice || null;
  pendingLog.__deferLogSuggestions = !!pendingLog.__copySource;
  pendingLog.foodRoles = { ...foodRolesFor(roles.ids, roles.bases, roles.samples), ...(pendingLog.foodRoles || {}) };
  pendingLog.foodOutcomes = { ...(pendingLog.foodOutcomes || {}) };
  pendingLog.individualRatings = !!pendingLog.individualRatings;
  logFoodQuery = "";
  selectedLogFoods = new Set(pendingLog.foodIds || []);
  selectedRecipeInventoryId = !pendingLog.editId && pendingLog.recipeInventoryId && state.inventory.some((item) => item.id === pendingLog.recipeInventoryId && item.kind === "recipe" && Number(item.portions) > 0) ? pendingLog.recipeInventoryId : "";
  selectedInventoryFoods = new Set(pendingLog.editId || selectedRecipeInventoryId ? [] : [...selectedLogFoods].filter((id) => inventoryPortions(id) > 0));
  const logModal = document.getElementById("logModal");
  const logSheet = logModal?.querySelector(".sheet");
  if (logSheet) logSheet.scrollTop = 0;
  logModal.classList.add("open");
  renderLogForm();
  if (logSheet) logSheet.scrollTop = 0;
}

function conditionalQuestionsHtml(focusOutcome) {
  let rejection = focusOutcome === "not_accepted";
  let missed = focusOutcome === "not_offered";
  return `<div class="conditional-log-questions" id="conditionalLogQuestions" style="display:${rejection || missed ? "block" : "none"}">
    <div class="field rejection-question" style="display:${rejection ? "block" : "none"}"><label>Wie war die Ablehnung?</label><div class="choice-pills"><label><input type="radio" name="rejectionStrength" value="interest" ${pendingLog.rejectionStrength !== "refused" ? "checked" : ""}><span>Nur wenig Interesse</span></label><label><input type="radio" name="rejectionStrength" value="refused" ${pendingLog.rejectionStrength === "refused" ? "checked" : ""}><span>Klar verweigert</span></label></div></div>
    <div class="field missed-question" style="display:${missed ? "block" : "none"}"><label>Warum nicht angeboten?</label><div class="choice-pills"><label><input type="radio" name="notOfferedReason" value="no_opportunity" ${pendingLog.notOfferedReason !== "unavailable" ? "checked" : ""}><span>Keine Gelegenheit</span></label><label><input type="radio" name="notOfferedReason" value="unavailable" ${pendingLog.notOfferedReason === "unavailable" ? "checked" : ""}><span>Zutat nicht verfügbar</span></label></div></div>
  </div>`;
}
function updateConditionalQuestions() {
  let focusId = pendingLog.focusId && selectedLogFoods.has(pendingLog.focusId) ? pendingLog.focusId : [...selectedLogFoods][0];
  let focusSelect = document.querySelector(`[data-sample-result="${focusId}"]`) || document.querySelector(`[data-individual-result="${focusId}"]`) || document.getElementById("mainOutcome");
  let value = focusSelect?.value || "tried";
  let box = document.getElementById("conditionalLogQuestions");
  if (!box) return;
  box.style.display = ["not_accepted", "not_offered"].includes(value) ? "block" : "none";
  box.querySelector(".rejection-question").style.display = value === "not_accepted" ? "block" : "none";
  box.querySelector(".missed-question").style.display = value === "not_offered" ? "block" : "none";
}
function logFoodResultsHtml() {
  let query = normalizeName(logFoodQuery);
  let candidates = logFoodCandidates(logFoodQuery);
  if (query && !candidates.length) return '<div class="small log-search-empty">Kein Lebensmittel gefunden</div>';
  return candidates.map((f) => {
    let stock = inventoryPortions(f.id);
    let selected = selectedLogFoods.has(f.id);
    if (!query) return `<button type="button" class="live-result addLogFoodResult log-food-result ${selected ? "selected" : ""}" data-food="${f.id}" aria-label="${esc(f.name)} ${selected ? "entfernen" : "hinzufügen"}"><span class="grow log-result-copy"><b class="log-result-name">${esc(f.name)}</b></span><span class="log-result-add" aria-hidden="true">${selected ? "✓" : "＋"}</span></button>`;
    let meta = `${foodCategoryLabel(f.category)} · ${displayStatus(f)}${stock ? ` · ${stock} im Vorrat` : ""}`;
    return `<button class="live-result addLogFoodResult log-food-result ${selected ? "selected" : ""}" data-food="${f.id}" aria-label="${esc(f.name)} ${selected ? "entfernen" : "hinzufügen"}, ${esc(meta)}"><span class="log-result-emoji" aria-hidden="true">${foodEmoji(f)}</span><span class="grow log-result-copy"><b class="log-result-name">${esc(f.name)}</b><span class="small log-result-meta">${esc(meta)}</span></span><span class="log-result-add" aria-hidden="true">${selected ? "✓" : "＋"}</span></button>`;
  }).join("");
}
function recentRecipeItems(limit = 4) {
  let seen = new Set();
  let items = [];
  let logs = state.logs.slice().sort((a, b) =>
    `${b.date}${b.createdAt || ""}`.localeCompare(`${a.date}${a.createdAt || ""}`),
  );
  for (let log of logs) {
    let name = String(log.recipeName || "").trim();
    let key = normalizeName(name);
    if (!name || seen.has(key)) continue;
    let recipe = recipeByName(name);
    if (!recipe) continue;
    seen.add(key);
    items.push(recipe);
    if (items.length >= limit) break;
  }
  return items;
}
function logRecipeResultsHtml(query = pendingLog?.__recipeQuery || "") {
  let q = normalizeName(query);
  let recipes = q ? logRecipeCandidates(query) : recentRecipeItems(4);
  if (q && !recipes.length) return '<div class="small log-search-empty">Kein Rezept gefunden</div>';
  return recipes.map((recipe) => `<button type="button" class="live-result selectLogRecipeResult" data-recipe="${esc(recipe.name)}" aria-label="${esc(recipe.name)} auswählen"><span class="grow log-result-copy"><b class="log-result-name">${esc(recipe.name)}</b>${q ? '<span class="small log-result-meta">Rezept auswählen</span>' : ""}</span><span class="log-result-add" aria-hidden="true">＋</span></button>`).join("");
}

function removeLogFoodSelection(id) {
  let p = pendingLog;
  selectedLogFoods.delete(id);
  selectedInventoryFoods.delete(id);
  p.sampleFoodIds = (p.sampleFoodIds || []).filter((foodId) => foodId !== id);
  p.baseFoodIds = (p.baseFoodIds || []).filter((foodId) => foodId !== id);
  delete p.foodOutcomes[id];
  if (p.focusId === id) p.focusId = [...selectedLogFoods][0] || "";
}
function addLogFoodFromResult(id) {
  captureLogDraft();
  let p = pendingLog;
  let sheet = document.querySelector("#logModal .sheet");
  let scrollTop = sheet?.scrollTop || 0;
  if (selectedLogFoods.has(id)) {
    removeLogFoodSelection(id);
    renderLogForm();
    preserveLogSheetScrollAfterRender(sheet, scrollTop);
    return;
  }
  let item = food(id);
  selectedLogFoods.add(id);
  let learning = !item || rank(item) < 2;
  if (learning) {
    p.sampleFoodIds = [...new Set([...(p.sampleFoodIds || []), id])];
    p.baseFoodIds = (p.baseFoodIds || []).filter((foodId) => foodId !== id);
    p.foodOutcomes[id] = item && rank(item) >= 1 ? "eaten" : "tried";
  } else {
    p.baseFoodIds = [...new Set([...(p.baseFoodIds || []), id])];
    p.sampleFoodIds = (p.sampleFoodIds || []).filter((foodId) => foodId !== id);
    p.foodOutcomes[id] = "eaten";
  }
  if (!p.focusId) p.focusId = id;
  if (!selectedRecipeInventoryId && inventoryPortions(id) > 0) selectedInventoryFoods.add(id);
  logFoodQuery = "";
  renderLogForm();
  preserveLogSheetScrollAfterRender(sheet, scrollTop);
}

function applyLogRecipeChoice(recipe, choice) {
  if (!recipe || !pendingLog) return;
  let p = pendingLog;
  let previousOutcomes = { ...(p.foodOutcomes || {}) };
  let ids = logRecipeActualFoodIds(recipe, choice).filter((id) => !!food(id));
  let samples = ids.filter((id) => rank(food(id)) < 2);
  let bases = ids.filter((id) => !samples.includes(id));
  p.recipeName = recipe.name;
  p.foodIds = [...ids];
  p.sampleFoodIds = [...samples];
  p.baseFoodIds = [...bases];
  p.foodRoles = foodRolesFor(ids, bases, samples);
  p.foodOutcomes = Object.fromEntries(ids.map((id) => [id, previousOutcomes[id] || (rank(food(id)) >= 1 ? "eaten" : "tried")]));
  p.focusId = samples.includes(p.focusId) || bases.includes(p.focusId) ? p.focusId : (samples[0] || bases[0] || ids[0] || "");
  p.individualRatings = false;
  p.__recipeChoice = choice;
  selectedLogFoods = new Set(ids);
  selectedRecipeInventoryId = "";
  selectedInventoryFoods = new Set(ids.filter((id) => inventoryPortions(id) > 0));
  logFoodQuery = "";
}
function selectLogRecipeFromResult(name) {
  captureLogDraft();
  let recipe = recipeByName(name);
  if (!recipe) return;
  let sheet = document.querySelector("#logModal .sheet");
  let scrollTop = sheet?.scrollTop || 0;
  let choice = logRecipeChoiceState(recipe);
  choice.__explicit = {};
  choice.confirmed = !logRecipeNeedsExplicitChoice(recipe);
  pendingLog.__recipeQuery = "";
  applyLogRecipeChoice(recipe, choice);
  document.activeElement?.blur?.();
  renderLogForm();
  preserveLogSheetScrollAfterRender(sheet, scrollTop);
  if (logRecipeNeedsExplicitChoice(recipe)) queueMicrotask(focusFirstRequiredRecipeChoice);
}
function updateLogRecipeChoice(patch) {
  captureLogDraft();
  let recipe = recipeByName(pendingLog?.recipeName || "");
  if (!recipe) return;
  let current = pendingLog.__recipeChoice || logRecipeChoiceState(recipe);
  let explicit = { ...(current.__explicit || {}) };
  if (Object.prototype.hasOwnProperty.call(patch, "variantIndex")) explicit.variant = true;
  if (Object.prototype.hasOwnProperty.call(patch, "oneOfId")) explicit.oneOf = true;
  if (Object.prototype.hasOwnProperty.call(patch, "milkChoiceId")) explicit.milk = true;
  let choice = { ...current, ...patch, __explicit: explicit };
  choice.confirmed = logRecipeChoiceComplete(recipe, choice);
  applyLogRecipeChoice(recipe, choice);
  renderLogForm();
  if (!choice.confirmed) queueMicrotask(focusFirstRequiredRecipeChoice);
}

function focusFirstRequiredRecipeChoice() {
  let select = [...document.querySelectorAll("[data-log-recipe-required]")].find((node) => !node.value);
  if (!select) return;
  select.scrollIntoView({ block: "center", inline: "nearest" });
  try { select.focus({ preventScroll: true }); } catch { select.focus(); }
}

function bindLogFoodResultActions(root = document) {
  root.querySelectorAll(".addLogFoodResult").forEach((button) => {
    button.onclick = () => addLogFoodFromResult(button.dataset.food);
  });
}
function bindLogRecipeResultActions(root = document) {
  root.querySelectorAll(".selectLogRecipeResult").forEach((button) => {
    button.onclick = () => selectLogRecipeFromResult(button.dataset.recipe);
  });
}
function bindLogRecipeChoiceActions(root = document) {
  root.querySelector("[data-log-recipe-variant]")?.addEventListener("change", (event) => updateLogRecipeChoice({ variantIndex: Number(event.target.value) || 0 }));
  root.querySelector("[data-log-recipe-oneof]")?.addEventListener("change", (event) => updateLogRecipeChoice({ oneOfId: event.target.value }));
  root.querySelector("[data-log-recipe-milk]")?.addEventListener("change", (event) => updateLogRecipeChoice({ milkChoiceId: event.target.value }));
}

function syncCustomFoodAction() {
  let button = document.getElementById("addCustomLogFood");
  if (!button) return;
  let rawQuery = String(logFoodQuery || "").trim();
  let hasMatches = rawQuery ? logFoodCandidates(rawQuery).length > 0 : true;
  button.hidden = !rawQuery || hasMatches;
  let results = document.querySelector("#logForm .log-food-results");
  if (results && button.previousElementSibling !== results) results.after(button);
  if (button.hidden) return;
  button.textContent = `+ „${rawQuery}“ als eigenes Lebensmittel anlegen`;
}

function renderLogFoodResults() {
  let label = document.querySelector("#logForm .log-food-results-label");
  let results = document.querySelector("#logForm .log-food-results");
  if (!label || !results) return;
  label.textContent = logFoodQuery ? "Suchergebnisse" : "";
  label.hidden = !logFoodQuery;
  results.innerHTML = logFoodResultsHtml();
  bindLogFoodResultActions(results);
  syncCustomFoodAction();
}
function renderLogRecipeResults() {
  let input = document.getElementById("logRecipeSearch");
  let label = document.querySelector("#logForm .log-recipe-results-label");
  let results = document.querySelector("#logForm .log-recipe-results");
  if (!input || !label || !results) return;
  pendingLog.__recipeQuery = input.value;
  label.textContent = pendingLog.__recipeQuery ? "Suchergebnisse" : "";
  label.hidden = !pendingLog.__recipeQuery;
  results.innerHTML = logRecipeResultsHtml(pendingLog.__recipeQuery);
  bindLogRecipeResultActions(results);
}
function clearLogSelectorSearch(nextMode) {
  if (!pendingLog) return;
  pendingLog.__recipeQuery = "";
  logFoodQuery = "";
  let recipeInput = document.getElementById("logRecipeSearch");
  let foodInput = document.getElementById("logFoodSearch");
  if (recipeInput) recipeInput.value = "";
  if (foodInput) foodInput.value = "";
  renderLogRecipeResults();
  renderLogFoodResults();
  queueMicrotask(() => {
    let input = nextMode === "recipes" ? document.getElementById("logRecipeSearch") : document.getElementById("logFoodSearch");
    input?.focus();
  });
}

function logLearningLabel(id) {
  let item = food(id);
  return learningRoleLabel(rank(item), status(item), pendingLog?.type || "");
}

function renderLogForm() {
  let p = pendingLog;
  let selected = [...selectedLogFoods].map((id) => food(id)).filter(Boolean);
  let sampleIds = [...new Set((p.sampleFoodIds || []).filter((id) => selectedLogFoods.has(id)))];
  if (p.__legacyEntryType === "sample" && !sampleIds.length) sampleIds = selected.map((f) => f.id);
  let mainIds = selected.map((f) => f.id).filter((id) => !sampleIds.includes(id));
  p.sampleFoodIds = sampleIds;
  p.baseFoodIds = [...new Set((p.baseFoodIds || []).filter((id) => mainIds.includes(id)))];
  if (!p.baseFoodIds.length) p.baseFoodIds = [...mainIds];
  document.getElementById("logTitle").textContent = p.editId ? "Essen bearbeiten" : (p.__copySource ? "Essen kopieren" : "Essen eintragen");
  let subtitle = document.getElementById("logSubtitle");
  if (subtitle) {
    subtitle.textContent = p.__copySource ? "Aus dem Protokoll übernommen. Prüfe Datum und Bewertung vor dem Speichern." : "";
    subtitle.hidden = !p.__copySource;
  }
  let stockedSelected = selected.filter((f) => inventoryPortions(f.id) > 0);
  selectedInventoryFoods = new Set([...selectedInventoryFoods].filter((id) => stockedSelected.some((f) => f.id === id)));
  let recipeItem = selectedRecipeInventoryId ? state.inventory.find((item) => item.id === selectedRecipeInventoryId) : null;
  let outcomeOptions = [["eaten", "Gegessen"], ["tried", "Probiert"], ["not_accepted", "Abgelehnt"], ["reaction", "Reaktion"], ["not_offered", "Nicht angeboten"]];
  let mainDefault = mainIds.map((id) => p.foodOutcomes[id]).find(Boolean) || "eaten";
  let focusOutcome = p.foodOutcomes[p.focusId] || sampleIds.map((id) => p.foodOutcomes[id]).find(Boolean) || mainDefault || "tried";
  let individualRows = mainIds.map((id) => `<div class="food-outcome-row"><div class="food-outcome-name"><b>${esc(food(id)?.name || id)}</b><span>Bestandteil</span></div><select data-individual-result="${id}">${outcomeOptions.map(([value, title]) => `<option value="${value}" ${(p.foodOutcomes[id] || mainDefault) === value ? "selected" : ""}>${title}</option>`).join("")}</select><span></span></div>`).join("");
  let mainBlock = mainIds.length ? `<div class="field"><label>${mainIds.length === 1 ? "Lebensmittel bewerten" : "Mahlzeit bewerten"}</label>${mainIds.length > 1 && p.individualRatings ? `<div class="sample-outcome-list">${individualRows}</div><div class="individual-rating"><button class="text-button" id="toggleIndividualRatings" type="button">Gemeinsam bewerten</button></div>` : `<div class="grouped-outcome"><div><b>${mainIds.map((id) => esc(food(id)?.name || id)).join(" + ")}</b><span>${mainIds.length === 1 ? "Ergebnis" : "gemeinsam bewertet"}</span></div><select id="mainOutcome">${outcomeOptions.map(([value, title]) => `<option value="${value}" ${mainDefault === value ? "selected" : ""}>${title}</option>`).join("")}</select></div>${mainIds.length > 1 ? `<div class="individual-rating"><button class="text-button" id="toggleIndividualRatings" type="button">Zutaten einzeln bewerten ›</button></div>` : ""}`}</div>` : "";
  let sampleBlock = sampleIds.length ? `<div class="field"><label>Einführung und Wiederholung</label><div class="sample-outcome-list">${sampleIds.map((id) => `<div class="food-outcome-row"><div class="food-outcome-name"><b>${esc(food(id)?.name || id)}</b><span>${esc(logLearningLabel(id))}</span></div><select data-sample-result="${id}">${outcomeOptions.map(([value, title]) => `<option value="${value}" ${(p.foodOutcomes[id] || "tried") === value ? "selected" : ""}>${title}</option>`).join("")}</select><button class="iconbtn" data-remove-log-food="${id}" aria-label="${esc(food(id)?.name || id)} entfernen">×</button></div>`).join("")}</div></div>` : "";
  let mealOptions = ["breakfast", "lunch", "snack", "dinner"].map((meal) => `<option value="${meal}" ${p.meal === meal ? "selected" : ""}>${esc(mealName(meal))}</option>`).join("");
  let contextHint = p.__fromPlan && !logContextHasChanged(p);
  let logContext = p.__mealContext
    ? `<div class="field" style="margin-bottom:10px"><div class="row"><div class="grow"><b id="logContextSummary">${esc(nice(p.date, true))} · ${esc(mealName(p.meal))}</b><div id="logContextPlanHint"${contextHint ? "" : " hidden"}>${contextHint ? "aus dem Plan" : ""}</div></div><button class="text-button" id="editLogContext" type="button" aria-expanded="${p.__contextEditing ? "true" : "false"}">${p.__contextEditing ? "Fertig" : "Ändern"}</button></div><div id="logContextFields" style="display:${p.__contextEditing ? "block" : "none"};margin-top:10px"><div class="grid2"><div class="field"><label>Datum</label><input type="date" id="logDate" value="${p.date}"></div><div class="field"><label>Mahlzeit</label><select id="logMeal">${mealOptions}</select></div></div></div></div>`
    : `<div class="log-date-grid"><div class="field"><label>Datum</label><input type="date" id="logDate" value="${p.date}"></div></div>`;
  let freeRecipe = !p.editId && !p.__mealContext && p.recipeName ? recipeByName(p.recipeName) : null;
  if (freeRecipe && !p.__recipeChoice) {
    p.__recipeChoice = logRecipeChoiceState(freeRecipe, p.foodIds || []);
    p.__recipeChoice.__explicit = {};
    p.__recipeChoice.confirmed = !logRecipeNeedsExplicitChoice(freeRecipe);
  }
  let freeRecipeChoice = freeRecipe ? logRecipeChoiceHtml(freeRecipe, p.__recipeChoice) : "";
  let currentTexture = logTextureStage(p);
  let textureValue = p.__textureValue !== undefined ? p.__textureValue : (currentTexture || "");
  let deferFoodSuggestions = !!p.__deferLogSuggestions && !logFoodQuery;
  p.__deferLogSuggestions = false;
  let deferredSuggestionsHtml = '<div class="small log-suggestions-pending">Vorschläge werden geladen …</div>';
  let foodResultsHtml = deferFoodSuggestions ? deferredSuggestionsHtml : logFoodResultsHtml();
  let recipeResultsHtml = logRecipeResultsHtml(p.__recipeQuery || "");
  let freeRecipePicker = !p.editId && !p.__mealContext ? `<div class="field log-recipe-picker"><label>Rezept auswählen (optional)</label><input id="logRecipeSearch" value="${esc(p.__recipeQuery || "")}" placeholder="Rezeptnamen eingeben" autocomplete="off"><div class="small log-recipe-results-label">${p.__recipeQuery ? "Suchergebnisse" : "Rezeptnamen eingeben"}</div><div class="log-recipe-results">${recipeResultsHtml}</div></div>` : "";

  document.getElementById("logForm").innerHTML = `
    ${logContext}
    ${freeRecipePicker}
    ${p.recipeName ? `<div class="selected-target"><div class="row"><b class="grow">${esc(p.recipeName)}</b>${!p.editId && !p.__mealContext ? '<button class="iconbtn" id="clearLogRecipe" type="button" aria-label="Rezeptzuordnung entfernen">×</button>' : ""}</div><div class="small">Bekannte Bestandteile gemeinsam, Einführungen und Wiederholungen separat bewerten.</div></div>` : ""}
    ${freeRecipeChoice}
    ${mainBlock}${sampleBlock}
    <div class="field log-food-picker"><label>Lebensmittel hinzufügen</label><input id="logFoodSearch" value="${esc(logFoodQuery)}" placeholder="Tippen und Treffer auswählen" autocomplete="off"><div class="field-error-message" id="logFoodError" style="display:none"></div><button class="text-button" id="addCustomLogFood" type="button">+ Eigenes Lebensmittel</button><div class="small log-food-results-label">${logFoodQuery ? "Suchergebnisse" : "Vorschläge aus Plan und Verlauf"}</div><div class="log-food-results">${foodResultsHtml}</div></div>
    <div class="field"><label>Gesamtmenge in g (optional)</label><input id="logAmount" type="number" min="0" step="1" inputmode="decimal" value="${esc(p.amount || "")}" placeholder="z. B. 5"></div>
    <div class="field"><label>Konsistenz</label><select id="logTexture"><option value="">Bitte auswählen</option>${[1, 2, 3, 4].map((n) => `<option value="${n}" ${String(textureValue) === String(n) ? "selected" : ""}>Stufe ${n} – ${esc(textureName(n))}</option>`).join("")}</select></div>
    ${conditionalQuestionsHtml(focusOutcome)}
    <details class="accordion"><summary>Notiz ergänzen</summary><div class="field"><label>Notiz oder Reaktion</label><textarea id="logNote">${esc(p.note || "")}</textarea></div></details>
    ${!p.editId && recipeItem ? `<div class="field"><label>Aus dem Rezeptvorrat verwendet</label><label class="toggleline"><input class="ds-toggle-input" type="checkbox" id="useRecipeInventory" checked><span class="toggle-copy"><b>1 ${esc(recipeItem.size || "Portion")} ${esc(recipeItem.recipeName)}</b><span class="small">Eingefroren am ${shortDate(recipeItem.frozenDate)}</span></span><span class="toggle-state" aria-hidden="true"></span></label></div>` : ""}
    ${!p.editId && !recipeItem && stockedSelected.length ? `<div class="field"><label>Aus dem Gefriervorrat verwendet</label><div class="chips">${stockedSelected.map((f) => `<label class="chip toggle-chip"><input class="ds-toggle-input" type="checkbox" data-inventory-food="${f.id}" ${selectedInventoryFoods.has(f.id) ? "checked" : ""}><span>1 Portion ${esc(f.name)} <small>(${inventoryPortions(f.id)} vorhanden)</small></span></label>`).join("")}</div></div>` : ""}
    <div class="sticky-form-actions"><div class="ds-actionbar"><button class="btn secondary" id="cancelLog" type="button">Abbrechen</button><button class="btn" id="saveLog">${p.editId ? "Änderungen speichern" : (p.__copySource ? "Kopie speichern" : "Speichern")}</button></div></div>`;
  document.querySelectorAll("#logForm select").forEach((select) => select.addEventListener("change", updateConditionalQuestions));
  document.getElementById("logTexture")?.addEventListener("change", clearLogTextureValidation);
  document.getElementById("logDate").onchange = (event) => requestLogDateChange(event.target.value, p.date);
  document.getElementById("editLogContext")?.addEventListener("click", () => { p.__contextEditing = !p.__contextEditing; syncLogContextUi(); });
  document.getElementById("logMeal")?.addEventListener("change", (event) => { captureLogDraft(); p.meal = event.target.value; p.__contextEditing = true; syncLogContextUi(); });
  document.getElementById("toggleIndividualRatings")?.addEventListener("click", () => { captureLogDraft(); p.individualRatings = !p.individualRatings; renderLogForm(); });
  document.querySelectorAll("[data-remove-log-food]").forEach((button) => button.onclick = () => { captureLogDraft(); removeLogFoodSelection(button.dataset.removeLogFood); renderLogForm(); });
  document.getElementById("logRecipeSearch")?.addEventListener("input", renderLogRecipeResults);
  document.getElementById("clearLogRecipe")?.addEventListener("click", () => { captureLogDraft(); p.recipeName = ""; p.__recipeQuery = ""; p.__recipeChoice = null; selectedRecipeInventoryId = ""; renderLogForm(); });
  document.getElementById("logFoodSearch").oninput = (event) => {
    captureLogDraft(); logFoodQuery = event.target.value; renderLogFoodResults();
  };
  document.getElementById("addCustomLogFood").onclick = () => {
    captureLogDraft();
    addCustomFoodForm({
      returnToLog: true,
      onSaved: (item) => {
        selectedLogFoods.add(item.id);
        pendingLog.foodOutcomes[item.id] = "tried";
        pendingLog.sampleFoodIds = [...new Set([...(pendingLog.sampleFoodIds || []), item.id])];
        pendingLog.baseFoodIds = (pendingLog.baseFoodIds || []).filter((id) => id !== item.id);
        if (!pendingLog.focusId) pendingLog.focusId = item.id;
        logFoodQuery = ""; renderLogForm();
      },
    });
  };
  bindLogFoodResultActions(document.getElementById("logForm"));
  bindLogRecipeResultActions(document.getElementById("logForm"));
  bindLogRecipeChoiceActions(document.getElementById("logForm"));
  document.querySelectorAll("[data-inventory-food]").forEach((checkbox) => checkbox.onchange = () => { if (checkbox.checked) selectedInventoryFoods.add(checkbox.dataset.inventoryFood); else selectedInventoryFoods.delete(checkbox.dataset.inventoryFood); });
  document.getElementById("cancelLog")?.addEventListener("click", closeLog);
  document.getElementById("saveLog").onclick = saveLog;
  document.getElementById("saveLog").disabled = !!(freeRecipe && logRecipeNeedsExplicitChoice(freeRecipe) && !p.__recipeChoice?.confirmed);
  syncCustomFoodAction();
  updateConditionalQuestions();
}

function captureLogDraft(options = {}) {
  if (!pendingLog) return;
  let value = (id) => document.getElementById(id)?.value;
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
  if (document.getElementById("logNote")) pendingLog.note = value("logNote") || "";
  if (document.getElementById("mainOutcome")) {
    let sampleIds = new Set(pendingLog.sampleFoodIds || []);
    for (let id of [...selectedLogFoods].filter((x) => !sampleIds.has(x))) pendingLog.foodOutcomes[id] = document.getElementById("mainOutcome").value;
  }
  document.querySelectorAll("[data-individual-result]").forEach((select) => pendingLog.foodOutcomes[select.dataset.individualResult] = select.value);
  document.querySelectorAll("[data-sample-result]").forEach((select) => pendingLog.foodOutcomes[select.dataset.sampleResult] = select.value);
  if (document.querySelector('input[name="rejectionStrength"]')) pendingLog.rejectionStrength = document.querySelector('input[name="rejectionStrength"]:checked')?.value || pendingLog.rejectionStrength || "";
  if (document.querySelector('input[name="notOfferedReason"]')) pendingLog.notOfferedReason = document.querySelector('input[name="notOfferedReason"]:checked')?.value || pendingLog.notOfferedReason || "";
}

function clearLogTextureValidation() {
  let textureField = document.getElementById("logTexture")?.closest(".field");
  textureField?.classList.remove("field-error");
  textureField?.querySelector(".unified-texture-error")?.remove();
}

function requestLogTextureSelection() {
  let select = document.getElementById("logTexture");
  if (!select) return;
  select.scrollIntoView({ block: "center", inline: "nearest" });
  if (typeof select.showPicker === "function") {
    try {
      select.showPicker();
      return;
    } catch {}
  }
  try {
    select.focus({ preventScroll: true });
  } catch {
    select.focus();
  }
}

function saveLog() {
  captureLogDraft();
  let freeRecipe = !pendingLog.editId && !pendingLog.__mealContext && pendingLog.recipeName ? recipeByName(pendingLog.recipeName) : null;
  let recipeChoiceError = document.querySelector(".log-recipe-choice-error");
  if (recipeChoiceError) { recipeChoiceError.textContent = ""; recipeChoiceError.style.display = "none"; }
  if (freeRecipe && logRecipeNeedsExplicitChoice(freeRecipe) && !pendingLog.__recipeChoice?.confirmed) {
    if (recipeChoiceError) {
      recipeChoiceError.textContent = "Bitte alle erforderlichen Rezeptangaben auswählen.";
      recipeChoiceError.style.display = "block";
    }
    focusFirstRequiredRecipeChoice();
    return;
  }

  let ids = [...selectedLogFoods];
  let foodPicker = document.querySelector(".log-food-picker");
  let foodError = document.getElementById("logFoodError");
  foodPicker?.classList.remove("field-error");
  if (foodError) { foodError.textContent = ""; foodError.style.display = "none"; }
  if (!ids.length) {
    foodPicker?.classList.add("field-error");
    if (foodError) { foodError.textContent = "Bitte mindestens ein tatsächlich enthaltenes Lebensmittel wählen."; foodError.style.display = "block"; }
    document.getElementById("logFoodSearch")?.focus();
    return;
  }

  let sampleIds = [...new Set((pendingLog.sampleFoodIds || []).filter((id) => ids.includes(id)))];
  let mainIds = ids.filter((id) => !sampleIds.includes(id));
  let mainOutcome = document.getElementById("mainOutcome")?.value || "eaten";
  let individual = !!pendingLog.individualRatings;
  let foodOutcomes = {};
  for (let id of mainIds) foodOutcomes[id] = individual ? (document.querySelector(`[data-individual-result="${id}"]`)?.value || mainOutcome) : mainOutcome;
  for (let id of sampleIds) foodOutcomes[id] = document.querySelector(`[data-sample-result="${id}"]`)?.value || pendingLog.foodOutcomes?.[id] || "tried";
  let focus = pendingLog.focusId && ids.includes(pendingLog.focusId) ? pendingLog.focusId : (sampleIds[0] || mainIds[0] || ids[0]);
  let reactionFoodId = ids.find((id) => foodOutcomes[id] === "reaction") || "";
  let overall = foodOutcomes[focus] || Object.values(foodOutcomes)[0] || "tried";
  let outcomes = Object.values(foodOutcomes);
  let offered = outcomes.some((outcome) => outcome !== "not_offered");
  let positiveTextureOutcome = outcomes.some((outcome) => ["eaten", "tried"].includes(outcome));
  let textureValue = document.getElementById("logTexture")?.value || "";
  let textureRequired = logTextureSelectionRequired({
    positiveOutcome: positiveTextureOutcome,
    isEdit: !!pendingLog.editId,
    legacyUnknown: !!pendingLog.__legacyTextureUnknown,
    textureValue,
  });
  let textureField = document.getElementById("logTexture")?.closest(".field");
  textureField?.classList.remove("field-error");
  textureField?.querySelector(".unified-texture-error")?.remove();
  if (textureRequired) {
    textureField?.classList.add("field-error");
    textureField?.insertAdjacentHTML("beforeend", '<div class="field-error-message unified-texture-error">Bitte die tatsächlich angebotene Konsistenz auswählen.</div>');
    requestLogTextureSelection();
    return;
  }

  let selectedTexture = validLogTextureStage(textureValue);
  let isEdit = !!pendingLog.editId;
  let oldLog = isEdit ? clone(state.logs.find((log) => log.id === pendingLog.editId)) : null;
  let newLog = {
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
    ...(document.getElementById("logNote") ? { note: document.getElementById("logNote").value } : {}),
    textureKnown: selectedTexture !== null,
    reactionFoodId,
    ...(document.querySelector('input[name="rejectionStrength"]') ? { rejectionStrength: overall === "not_accepted" ? (document.querySelector('input[name="rejectionStrength"]:checked')?.value || "interest") : "" } : {}),
    ...(document.querySelector('input[name="notOfferedReason"]') ? { notOfferedReason: overall === "not_offered" ? (document.querySelector('input[name="notOfferedReason"]:checked')?.value || "no_opportunity") : "" } : {}),
    createdAt: pendingLog.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (selectedTexture !== null) newLog.textureStage = selectedTexture;
  if (Object.prototype.hasOwnProperty.call(pendingLog, "presentationMode")) newLog.presentationMode = pendingLog.presentationMode;
  if (!isEdit && !pendingLog.__copySource) {
    delete newLog.note;
    delete newLog.rejectionStrength;
    delete newLog.notOfferedReason;
  } else if (oldLog) {
    if (oldLog.outcome === "not_accepted" && overall !== "not_accepted") delete newLog.rejectionStrength;
    if (oldLog.outcome === "not_offered" && overall !== "not_offered") delete newLog.notOfferedReason;
  }
  let stateBefore = clone(state);
  let consumedNames = [];

  if (oldLog) {
    for (let foodId of oldLog.foodIds || []) {
      let item = food(foodId);
      if (outcomeForFood(oldLog, foodId) === "reaction" && item?.manualStatus === "Pausiert" && !item.reactionPauseSourceLogId) {
        item.reactionPausePreviousStatus = "auto";
        item.reactionPauseSourceLogId = oldLog.id;
      }
    }
  }

  if (!isEdit && offered) {
    let useRecipe = document.getElementById("useRecipeInventory")?.checked;
    if (useRecipe && selectedRecipeInventoryId) {
      let item = state.inventory.find((entry) => entry.id === selectedRecipeInventoryId);
      if (consumeInventoryItem(selectedRecipeInventoryId)) consumedNames.push(item?.recipeName || "Rezeptportion");
    } else {
      [...selectedInventoryFoods]
        .filter((id) => ids.includes(id) && foodOutcomes[id] !== "not_offered")
        .forEach((id) => { if (consumeInventoryPortion(id)) consumedNames.push(food(id)?.name || id); });
    }
  }

  if (isEdit) state.logs = state.logs.map((log) => log.id === pendingLog.editId ? newLog : log);
  else state.logs.push(newLog);
  if (typeof invalidateLogsForCache === "function") invalidateLogsForCache();

  let affectedFoodIds = new Set([...(oldLog?.foodIds || []), ...ids]);
  for (let foodId of affectedFoodIds) rebuildFoodConsequences(foodId);

  save(); closeLog(); renderAll();
  let inventoryMessage = consumedNames.length ? ` · ${consumedNames.length} Vorratsportion${consumedNames.length === 1 ? "" : "en"} abgezogen` : "";
  showToast(`${isEdit ? "Eintrag geändert" : "Eintrag gespeichert"}${inventoryMessage}.`, () => {
    state = stateBefore; save(); renderAll();
    showToast("Eintrag und Folgeänderungen rückgängig gemacht.");
  });
}
