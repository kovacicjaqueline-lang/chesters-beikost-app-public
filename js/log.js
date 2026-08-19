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
              <button class="iconbtn editLog" aria-label="Bearbeiten">✎</button>
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
      for (let foodId of new Set(removed.foodIds || [])) rebuildFoodConsequences(foodId);
      save(); renderAll();
      showToast("Eintrag gelöscht.", () => {
        state = stateBefore; save(); renderAll();
        showToast("Gelöschter Eintrag wiederhergestellt.");
      });
    },
  );
}

function editLogEntry(id) {
  let l = state.logs.find((x) => x.id === id);
  if (!l) return;
  openLog({ ...l, editId: id });
}

function logFoodCandidates(query) {
  let q = normalizeName(query);
  let pool = state.foods.filter((f) => f.active && !selectedLogFoods.has(f.id));
  if (q)
    return pool
      .filter((f) => foodSearchMatches(f, q))
      .sort((a, b) => foodSearchScore(a, q) - foodSearchScore(b, q) || a.name.localeCompare(b.name, "de"))
      .slice(0, 10);
  let upcomingIds = prepDemand().map((item) => item.foodId);
  let recentIds = state.logs
    .slice()
    .sort((a, b) => `${b.date}${b.createdAt || ""}`.localeCompare(`${a.date}${a.createdAt || ""}`))
    .flatMap((log) => log.foodIds || []);
  let ranked = [...new Set([...upcomingIds, ...recentIds])]
    .map(food)
    .filter((f) => f && f.active && !selectedLogFoods.has(f.id));
  let remainder = pool
    .filter((f) => !ranked.some((item) => item.id === f.id))
    .sort((a, b) => Number(inventoryPortions(b.id) > 0) - Number(inventoryPortions(a.id) > 0) || a.priority - b.priority);
  return [...ranked, ...remainder].slice(0, 6);
}

function closeLog() {
  document.getElementById("logModal").classList.remove("open");
}
function logDraftHasContent() {
  return !!(selectedLogFoods.size || pendingLog?.recipeName || document.getElementById("logAmount")?.value || document.getElementById("logNote")?.value);
}
function requestLogDateChange(nextDate, previousDate) {
  if (!pendingLog || !nextDate || nextDate === previousDate) return;
  captureLogDraft({ skipDate: true });
  if (!logDraftHasContent()) {
    pendingLog.date = nextDate;
    renderLogForm();
    return;
  }
  let chosenDate = previousDate;
  document.getElementById("logModal").classList.remove("open");
  openGeneric(
    "Entwurf verschieben?",
    `<p class="draft-day-copy">Der begonnene Eintrag bleibt vollständig erhalten.</p><div class="draft-day-actions"><button class="btn secondary" id="keepDraftDay">Beim bisherigen Tag bleiben</button><button class="btn" id="moveDraftDay">Auf ${esc(nice(nextDate, true))} verschieben</button></div>`,
    () => {
      pendingLog.date = chosenDate;
      document.getElementById("logModal").classList.add("open");
      renderLogForm();
    },
  );
  document.getElementById("keepDraftDay").onclick = closeGeneric;
  document.getElementById("moveDraftDay").onclick = () => { chosenDate = nextDate; closeGeneric(); };
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
  pendingLog.__originalMeal = originalMeal;
  pendingLog.__legacyTextureUnknown = !!pendingLog.editId && logTextureStage(plan) === null;
  pendingLog.foodRoles = { ...foodRolesFor(roles.ids, roles.bases, roles.samples), ...(pendingLog.foodRoles || {}) };
  pendingLog.foodOutcomes = { ...(pendingLog.foodOutcomes || {}) };
  pendingLog.individualRatings = !!pendingLog.individualRatings;
  logFoodQuery = "";
  selectedLogFoods = new Set(pendingLog.foodIds || []);
  selectedRecipeInventoryId = !pendingLog.editId && pendingLog.recipeInventoryId && state.inventory.some((item) => item.id === pendingLog.recipeInventoryId && item.kind === "recipe" && Number(item.portions) > 0) ? pendingLog.recipeInventoryId : "";
  selectedInventoryFoods = new Set(pendingLog.editId || selectedRecipeInventoryId ? [] : [...selectedLogFoods].filter((id) => inventoryPortions(id) > 0));
  document.getElementById("logModal").classList.add("open");
  renderLogForm();
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
  return logFoodCandidates(logFoodQuery).map((f) => {
    let stock = inventoryPortions(f.id);
    let meta = `${foodCategoryLabel(f.category)} · ${displayStatus(f)}${stock ? ` · ${stock} im Vorrat` : ""}`;
    return `<button class="live-result addLogFoodResult log-food-result" data-food="${f.id}" aria-label="${esc(f.name)} hinzufügen, ${esc(meta)}"><span class="log-result-emoji" aria-hidden="true">${foodEmoji(f)}</span><span class="grow log-result-copy"><b class="log-result-name">${esc(f.name)}</b><span class="small log-result-meta">${esc(meta)}</span></span><span class="log-result-add" aria-hidden="true">＋</span></button>`;
  }).join("");
}

function addLogFoodFromResult(id) {
  captureLogDraft();
  let p = pendingLog;
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
}

function bindLogFoodResultActions(root = document) {
  root.querySelectorAll(".addLogFoodResult").forEach((button) => {
    button.onclick = () => addLogFoodFromResult(button.dataset.food);
  });
}

function renderLogFoodResults() {
  let label = document.querySelector("#logForm .log-food-results-label");
  let results = document.querySelector("#logForm .log-food-results");
  if (!label || !results) return;
  label.textContent = logFoodQuery ? "Suchergebnisse" : "Vorschläge aus Plan und Verlauf";
  results.innerHTML = logFoodResultsHtml();
  bindLogFoodResultActions(results);
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
  document.getElementById("logTitle").textContent = p.editId ? "Protokolleintrag bearbeiten" : "Essen eintragen";
  document.getElementById("logSubtitle").textContent = `${nice(p.date, true)}${p.__mealContext ? ` · ${mealName(p.meal)}` : ""}`;
  let stockedSelected = selected.filter((f) => inventoryPortions(f.id) > 0);
  selectedInventoryFoods = new Set([...selectedInventoryFoods].filter((id) => stockedSelected.some((f) => f.id === id)));
  let recipeItem = selectedRecipeInventoryId ? state.inventory.find((item) => item.id === selectedRecipeInventoryId) : null;
  let outcomeOptions = [["eaten", "Gegessen"], ["tried", "Probiert"], ["not_accepted", "Abgelehnt"], ["reaction", "Reaktion"], ["not_offered", "Nicht angeboten"]];
  let mainDefault = mainIds.map((id) => p.foodOutcomes[id]).find(Boolean) || "eaten";
  let focusOutcome = p.foodOutcomes[p.focusId] || sampleIds.map((id) => p.foodOutcomes[id]).find(Boolean) || mainDefault || "tried";
  let mainBlock = mainIds.length ? `<div class="field"><label>${mainIds.length === 1 ? "Lebensmittel bewerten" : "Mahlzeit bewerten"}</label><div class="grouped-outcome"><div><b>${mainIds.map((id) => esc(food(id)?.name || id)).join(" + ")}</b><span>${mainIds.length === 1 ? "Ergebnis" : "gemeinsam bewertet"}</span></div><select id="mainOutcome">${outcomeOptions.map(([value, title]) => `<option value="${value}" ${mainDefault === value ? "selected" : ""}>${title}</option>`).join("")}</select></div>${mainIds.length > 1 ? `<details class="individual-rating"><summary>Zutaten einzeln bewerten</summary><label class="toggleline compact-toggle"><input class="ds-toggle-input" type="checkbox" id="individualRatings" ${p.individualRatings ? "checked" : ""}><span class="toggle-copy"><b>Einzelne Ergebnisse verwenden</b><span class="small">Nur bei relevanten Unterschieden nötig.</span></span><span class="toggle-state" aria-hidden="true"></span></label><div id="individualOutcomeRows" style="display:${p.individualRatings ? "block" : "none"}">${mainIds.map((id) => `<div class="food-outcome-row"><div class="food-outcome-name"><b>${esc(food(id)?.name || id)}</b><span>Bestandteil</span></div><select data-individual-result="${id}">${outcomeOptions.map(([value, title]) => `<option value="${value}" ${(p.foodOutcomes[id] || mainDefault) === value ? "selected" : ""}>${title}</option>`).join("")}</select><span></span></div>`).join("")}</div></details>` : ""}</div>` : "";
  let sampleBlock = sampleIds.length ? `<div class="field"><label>Einführung und Wiederholung</label><div class="sample-outcome-list">${sampleIds.map((id) => `<div class="food-outcome-row"><div class="food-outcome-name"><b>${esc(food(id)?.name || id)}</b><span>${esc(logLearningLabel(id))}</span></div><select data-sample-result="${id}">${outcomeOptions.map(([value, title]) => `<option value="${value}" ${(p.foodOutcomes[id] || "tried") === value ? "selected" : ""}>${title}</option>`).join("")}</select><button class="iconbtn" data-remove-log-food="${id}" aria-label="${esc(food(id)?.name || id)} entfernen">×</button></div>`).join("")}</div></div>` : "";
  let mealContext = p.__mealContext ? `<div class="field"><label>Geplante Mahlzeit</label><div class="selected-target"><b>${esc(mealName(p.meal))}</b><div class="small">Wird automatisch aus dem Plan übernommen.</div></div></div>` : "";
  let currentTexture = logTextureStage(p);
  let textureValue = p.__textureValue !== undefined ? p.__textureValue : (currentTexture || "");

  document.getElementById("logForm").innerHTML = `
    <div class="${p.__mealContext ? "grid2" : ""} log-date-grid"><div class="field"><label>Datum</label><input type="date" id="logDate" value="${p.date}"></div>${mealContext}</div>
    ${p.recipeName ? `<div class="selected-target"><b>${esc(p.recipeName)}</b><div class="small">Bekannte Bestandteile gemeinsam, Einführungen und Wiederholungen separat bewerten.</div></div>` : ""}
    ${mainBlock}${sampleBlock}
    <div class="field log-food-picker"><label>Lebensmittel hinzufügen</label><input id="logFoodSearch" value="${esc(logFoodQuery)}" placeholder="Tippen und Treffer auswählen" autocomplete="off"><div class="field-error-message" id="logFoodError" style="display:none"></div><button class="btn secondary smallbtn log-add-custom-food" id="addCustomLogFood" type="button">Eigenes Lebensmittel hinzufügen</button><div class="small log-food-results-label">${logFoodQuery ? "Suchergebnisse" : "Vorschläge aus Plan und Verlauf"}</div><div class="log-food-results">${logFoodResultsHtml()}</div></div>
    <div class="field"><label>Gesamtmenge in g (optional)</label><input id="logAmount" type="number" min="0" step="1" inputmode="decimal" value="${esc(p.amount || "")}" placeholder="z. B. 5"></div>
    <div class="field"><label>Konsistenz</label><select id="logTexture"><option value="">Bitte auswählen</option>${[1, 2, 3, 4].map((n) => `<option value="${n}" ${String(textureValue) === String(n) ? "selected" : ""}>Stufe ${n} – ${esc(textureName(n))}</option>`).join("")}</select><div class="small" style="margin-top:5px">Bei „Probiert“ oder „Gegessen“ erforderlich. Bei Ablehnung oder Reaktion optional; alte Einträge ohne dokumentierte Konsistenz bleiben unverändert.</div></div>
    ${conditionalQuestionsHtml(focusOutcome)}
    <details class="accordion"><summary>Notiz ergänzen</summary><div class="field"><label>Notiz oder Reaktion</label><textarea id="logNote">${esc(p.note || "")}</textarea></div></details>
    ${!p.editId && recipeItem ? `<div class="field"><label>Aus dem Rezeptvorrat verwendet</label><label class="toggleline"><input class="ds-toggle-input" type="checkbox" id="useRecipeInventory" checked><span class="toggle-copy"><b>1 ${esc(recipeItem.size || "Portion")} ${esc(recipeItem.recipeName)}</b><span class="small">Eingefroren am ${shortDate(recipeItem.frozenDate)}</span></span><span class="toggle-state" aria-hidden="true"></span></label></div>` : ""}
    ${!p.editId && !recipeItem && stockedSelected.length ? `<div class="field"><label>Aus dem Gefriervorrat verwendet</label><div class="chips">${stockedSelected.map((f) => `<label class="chip toggle-chip"><input class="ds-toggle-input" type="checkbox" data-inventory-food="${f.id}" ${selectedInventoryFoods.has(f.id) ? "checked" : ""}><span>1 Portion ${esc(f.name)} <small>(${inventoryPortions(f.id)} vorhanden)</small></span></label>`).join("")}</div></div>` : ""}
    <div class="sticky-form-actions"><div class="ds-actionbar"><button class="btn secondary" id="cancelLog" type="button">Abbrechen</button><button class="btn" id="saveLog">${p.editId ? "Änderungen speichern" : "Eintrag speichern"}</button></div><div class="small" style="margin-top:5px">Lebensmittelrollen und getrennte Bewertungen bleiben beim Bearbeiten erhalten.</div></div>`;
  document.querySelectorAll("#logForm select").forEach((select) => select.addEventListener("change", updateConditionalQuestions));
  document.getElementById("logDate").onchange = (event) => requestLogDateChange(event.target.value, p.date);
  document.getElementById("individualRatings")?.addEventListener("change", (event) => { p.individualRatings = event.target.checked; document.getElementById("individualOutcomeRows").style.display = event.target.checked ? "block" : "none"; });
  document.querySelectorAll("[data-remove-log-food]").forEach((button) => button.onclick = () => { captureLogDraft(); let id = button.dataset.removeLogFood; selectedLogFoods.delete(id); selectedInventoryFoods.delete(id); p.sampleFoodIds = (p.sampleFoodIds || []).filter((x) => x !== id); p.baseFoodIds = (p.baseFoodIds || []).filter((x) => x !== id); delete p.foodOutcomes[id]; renderLogForm(); });
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
  document.querySelectorAll("[data-inventory-food]").forEach((checkbox) => checkbox.onchange = () => { if (checkbox.checked) selectedInventoryFoods.add(checkbox.dataset.inventoryFood); else selectedInventoryFoods.delete(checkbox.dataset.inventoryFood); });
  document.getElementById("cancelLog")?.addEventListener("click", closeLog);
  document.getElementById("saveLog").onclick = saveLog;
  updateConditionalQuestions();
}

function captureLogDraft(options = {}) {
  if (!pendingLog) return;
  let value = (id) => document.getElementById(id)?.value;
  if (!options.skipDate && value("logDate")) pendingLog.date = value("logDate");
  pendingLog.amount = value("logAmount") || "";
  pendingLog.__textureValue = value("logTexture") ?? pendingLog.__textureValue ?? "";
  if (pendingLog.__textureValue) {
    pendingLog.textureStage = Number(pendingLog.__textureValue);
    pendingLog.textureKnown = true;
  } else {
    delete pendingLog.textureStage;
    pendingLog.textureKnown = false;
  }
  pendingLog.note = value("logNote") || "";
  pendingLog.individualRatings = !!document.getElementById("individualRatings")?.checked;
  if (document.getElementById("mainOutcome")) {
    let sampleIds = new Set(pendingLog.sampleFoodIds || []);
    for (let id of [...selectedLogFoods].filter((x) => !sampleIds.has(x))) pendingLog.foodOutcomes[id] = document.getElementById("mainOutcome").value;
  }
  document.querySelectorAll("[data-individual-result]").forEach((select) => pendingLog.foodOutcomes[select.dataset.individualResult] = select.value);
  document.querySelectorAll("[data-sample-result]").forEach((select) => pendingLog.foodOutcomes[select.dataset.sampleResult] = select.value);
  pendingLog.rejectionStrength = document.querySelector('input[name="rejectionStrength"]:checked')?.value || pendingLog.rejectionStrength || "";
  pendingLog.notOfferedReason = document.querySelector('input[name="notOfferedReason"]:checked')?.value || pendingLog.notOfferedReason || "";
}

function saveLog() {
  captureLogDraft();
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
  let individual = !!document.getElementById("individualRatings")?.checked;
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
    document.getElementById("logTexture")?.focus();
    return;
  }

  let selectedTexture = offered ? validLogTextureStage(textureValue) : null;
  let newLog = {
    id: pendingLog.editId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: document.getElementById("logDate").value,
    meal: pendingLog.editId
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
    note: document.getElementById("logNote").value,
    textureKnown: selectedTexture !== null,
    reactionFoodId,
    rejectionStrength: overall === "not_accepted" ? (document.querySelector('input[name="rejectionStrength"]:checked')?.value || "interest") : "",
    notOfferedReason: overall === "not_offered" ? (document.querySelector('input[name="notOfferedReason"]:checked')?.value || "no_opportunity") : "",
    createdAt: pendingLog.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (selectedTexture !== null) newLog.textureStage = selectedTexture;
  if (Object.prototype.hasOwnProperty.call(pendingLog, "presentationMode")) newLog.presentationMode = pendingLog.presentationMode;

  let isEdit = !!pendingLog.editId;
  let oldLog = isEdit ? clone(state.logs.find((log) => log.id === pendingLog.editId)) : null;
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

  let affectedFoodIds = new Set([...(oldLog?.foodIds || []), ...ids]);
  for (let foodId of affectedFoodIds) rebuildFoodConsequences(foodId);

  save(); closeLog(); renderAll(); showView("more");
  let details = document.getElementById("logDetails");
  if (details) details.open = true;
  requestAnimationFrame(() => {
    let entry = document.querySelector(`[data-log="${newLog.id}"]`);
    (entry || document.getElementById("logSection"))?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  let inventoryMessage = consumedNames.length ? ` · ${consumedNames.length} Vorratsportion${consumedNames.length === 1 ? "" : "en"} abgezogen` : "";
  showToast(`${isEdit ? "Eintrag geändert" : "Eintrag gespeichert"}${inventoryMessage}.`, () => {
    state = stateBefore; save(); renderAll();
    showToast("Eintrag und Folgeänderungen rückgängig gemacht.");
  });
}
