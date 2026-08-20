"use strict";

/* Lebensmittelverwaltung
 * Statusdarstellung, Suche, Sortierung, Aktivierung und Detailansicht.
 * Konsolidierter Produktionsstand 10.0.0.
 */

function futurePlanReferences(foodId) {
  let refs = [];
  let days = buildDays(today(), 45, false);
  for (let day of days) {
    for (let meal of day.meals || []) {
      if (
        meal.active &&
        !mealIsCompleted(day.date, meal.meal) &&
        (meal.foodIds || []).includes(foodId)
      ) refs.push({ date: day.date, meal: meal.meal, title: dishTitle(meal) });
    }
  }
  return refs;
}

function cleanFoodFromFuturePlan(foodId) {
  for (let [key, value] of Object.entries(state.overrides || {})) {
    let date = key.split("|")[0];
    if (date >= today() && value === foodId) delete state.overrides[key];
  }
  for (let [key, lock] of Object.entries(state.planLocks || {})) {
    let date = key.split("|")[0];
    if (date >= today() && (lock.foodIds || []).includes(foodId)) delete state.planLocks[key];
  }
  for (let [key, meal] of Object.entries(state.manualMeals || {})) {
    let date = key.split("|")[0];
    if (date < today() || !(meal.foodIds || []).includes(foodId)) continue;
    let foodIds = (meal.foodIds || []).filter((id) => id !== foodId);
    if (!foodIds.length) {
      delete state.manualMeals[key];
      delete state.planLocks?.[key];
    } else {
      meal.foodIds = foodIds;
      meal.focusId = meal.focusId === foodId ? foodIds[0] : meal.focusId;
      meal.recipeName = "";
      meal.recipeInventoryId = "";
      state.planLocks[key] = mealSnapshot(
        date,
        key.split("|")[1],
        { ...meal, active: true },
        "manual",
      );
    }
  }
  delete state.inactivePlanKept?.[foodId];
}

function setFoodActiveWithPlanCheck(f, nextActive) {
  if (!f) return;
  if (nextActive) {
    f.active = true;
    delete state.inactivePlanKept?.[f.id];
    save();
    closeGeneric();
    renderAll();
    showToast(`${f.name} ist wieder aktiv.`);
    return;
  }
  let refs = futurePlanReferences(f.id);
  if (!refs.length) {
    f.active = false;
    delete state.inactivePlanKept?.[f.id];
    save();
    closeGeneric();
    renderAll();
    showToast(`${f.name} bleibt unter „Deaktiviert“ abrufbar.`);
    return;
  }
  openGeneric(
    `${f.name} deaktivieren?`,
    `<p>${esc(f.name)} kommt noch in ${refs.length} zukünftigen ${refs.length === 1 ? "Mahlzeit" : "Mahlzeiten"} vor.</p>
     <div class="notice warn"><b>Nächste Planung:</b> ${shortDate(refs[0].date)} · ${mealName(refs[0].meal)} · ${esc(refs[0].title)}</div>
     <div class="date-choice-grid">
      <button class="btn danger" id="deactivateReplace">Aus zukünftigen Planungen ersetzen</button>
      <button class="btn secondary" id="deactivateKeep">Bestehende Planungen behalten</button>
      <button class="btn secondary" id="deactivateCancel">Abbrechen</button>
     </div>`,
  );
  document.getElementById("deactivateReplace").onclick = () => {
    f.active = false;
    cleanFoodFromFuturePlan(f.id);
    save();
    closeGeneric();
    renderAll();
    showToast(`${f.name} deaktiviert; zukünftige Planungen wurden bereinigt.`);
  };
  document.getElementById("deactivateKeep").onclick = () => {
    f.active = false;
    state.inactivePlanKept ||= {};
    state.inactivePlanKept[f.id] = true;
    save();
    closeGeneric();
    renderAll();
    showToast(`${f.name} deaktiviert; bestehende Planungen bleiben sichtbar.`);
  };
  document.getElementById("deactivateCancel").onclick = closeGeneric;
}

function jumpFoodInVisibleOrder(foodId, direction) {
  let cards = [...document.querySelectorAll("#foodList .foodcard.reorderable")];
  let ids = cards.map((card) => card.dataset.food);
  let index = ids.indexOf(foodId);
  if (index < 0) return;
  ids.splice(index, 1);
  if (direction === "top") ids.unshift(foodId);
  else ids.push(foodId);
  let activeOrder = state.foods
    .filter((f) => f.active)
    .sort((a, b) => Number(a.priority) - Number(b.priority));
  let visibleSet = new Set(ids);
  let queue = ids.map(food).filter(Boolean);
  let nextOrder = activeOrder.map((item) => visibleSet.has(item.id) ? queue.shift() : item);
  nextOrder.forEach((item, idx) => item.priority = (idx + 1) * 10);
  save();
  renderFoods();
}

function updateFoodDropTarget(y) {
  if (!foodDrag) return;
  let targets = [
    ...document.querySelectorAll("#foodList .foodcard.reorderable"),
  ].filter((item) => item !== foodDrag.card);
  let target = targets.find((item) => {
    let rect = item.getBoundingClientRect();
    return y >= rect.top && y <= rect.bottom;
  });
  if (!target) return;
  let rect = target.getBoundingClientRect();
  if (y < rect.top + rect.height / 2)
    target.parentNode.insertBefore(foodDrag.placeholder, target);
  else target.parentNode.insertBefore(foodDrag.placeholder, target.nextSibling);
}

function stopFoodAutoScroll() {
  if (foodDrag?.raf) cancelAnimationFrame(foodDrag.raf);
}

function foodAutoScrollLoop() {
  if (!foodDrag) return;
  let y = foodDrag.pointerY;
  let speed = 0;
  if (y < 95) speed = -Math.max(5, (95 - y) / 5);
  else if (y > window.innerHeight - 115)
    speed = Math.max(5, (y - (window.innerHeight - 115)) / 5);
  if (speed) {
    window.scrollBy(0, speed);
    updateFoodDropTarget(y);
  }
  foodDrag.raf = requestAnimationFrame(foodAutoScrollLoop);
}

function finishFoodDrag() {
  if (!foodDrag) return;
  let { card, placeholder } = foodDrag;
  stopFoodAutoScroll();
  placeholder.replaceWith(card);
  card.classList.remove("dragging");
  card.removeAttribute("style");
  let visibleIds = [...document.querySelectorAll("#foodList .foodcard.reorderable")]
    .map((c) => c.dataset.food)
    .filter(Boolean);
  let activeOrder = state.foods
    .filter((f) => f.active)
    .sort((a, b) => Number(a.priority) - Number(b.priority));
  let visibleSet = new Set(visibleIds);
  let queue = visibleIds.map((id) => food(id)).filter(Boolean);
  let nextOrder = activeOrder.map((item) =>
    visibleSet.has(item.id) ? queue.shift() : item,
  );
  nextOrder.forEach((f, index) => {
    f.priority = (index + 1) * 10;
  });
  let inactive = state.foods
    .filter((f) => !f.active)
    .sort((a, b) => Number(a.priority) - Number(b.priority));
  inactive.forEach((f, index) => {
    f.priority = (nextOrder.length + index + 1) * 10;
  });
  foodDrag = null;
  save();
  renderFoods();
  showToast(`Reihenfolge im Tab „${foodFilter === "open" ? "Offen" : "aktuell"}“ gespeichert.`);
}

function beginFoodDrag(event) {
  if (!foodReorderMode) return;
  event.preventDefault();
  let card = event.currentTarget.closest(".foodcard");
  if (!card || card.classList.contains("inactive")) return;
  let rect = card.getBoundingClientRect();
  let placeholder = document.createElement("div");
  placeholder.className = "food-placeholder";
  placeholder.style.height = `${rect.height}px`;
  card.parentNode.insertBefore(placeholder, card);
  document.body.appendChild(card);
  card.classList.add("dragging");
  Object.assign(card.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
  });
  foodDrag = {
    card,
    placeholder,
    offsetY: event.clientY - rect.top,
    pointerY: event.clientY,
    raf: 0,
  };
  const move = (e) => {
    if (!foodDrag) return;
    e.preventDefault();
    foodDrag.pointerY = e.clientY;
    card.style.top = `${e.clientY - foodDrag.offsetY}px`;
    updateFoodDropTarget(e.clientY);
  };
  const end = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    finishFoodDrag();
  };
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  foodAutoScrollLoop();
}

function toggleFoodReorderMode() {
  foodReorderMode = !foodReorderMode;
  let search = document.getElementById("foodSearch");
  if (foodReorderMode && search) search.value = "";
  renderFoods();
}

function foodEmoji(f) { return foodIconSvg(f); }

function showFoodInfoCore(f) {
  let stock = inventoryPortions(f.id);
  let planned = buildDays(today(), 7)
    .flatMap((day) =>
      day.meals
        .filter(
          (m) =>
            m.active &&
            !m.empty &&
            (m.foodIds || []).includes(f.id) &&
            !mealIsCompleted(day.date, m.meal),
        )
        .map((m) => ({
          date: day.date,
          meal: m.meal,
          dish: dishTitle(m),
        })),
    )
    .slice(0, 4);
  let recipes = RECIPES.filter((r) =>
    [r.requires, ...(r.alternatives || [])].some((set) =>
      (set || []).some((name) => foodNameMatches(f, name)),
    ),
  ).slice(0, 4);

  openGeneric(
    f.name,
    `<div class="food-detail-hero" style="display:grid;grid-template-columns:minmax(0,1fr) 96px;gap:14px;align-items:start;min-height:96px;margin-bottom:4px">
      <div class="food-detail-hero-copy">
        <div class="small food-detail-type">${esc(foodCategoryLabel(f.category))}${f.ph ? " · Philippinen" : ""}${f.ironRich ? " · eisenreich" : ""}${f.allergenGroup ? ` · Allergen: ${esc(f.allergenGroup)}` : ""}</div>
        <div class="chips food-detail-status"><span class="pill ${!f.active ? "inactive-pill" : ""}">${esc(!f.active ? "Deaktiviert" : status(f))}</span></div>
        ${f.alias ? `<p class="small"><b>Anderer Name:</b> ${esc(f.alias)}</p>` : ""}
      </div>
      <div class="food-detail-hero-icon" aria-hidden="true" style="--icon-food:96px;width:96px;height:96px;display:flex;align-items:center;justify-content:center;pointer-events:none">${foodIconSvg(f)}</div>
    </div>
    <div class="food-detail-dynamic"></div>
    <details class="accordion food-detail-settings">
      <summary>Status und Planung</summary>
      <div class="grid2" style="margin-top:10px">
        <div class="field"><label>Reihenfolge</label><input id="foodDetailsPriority" type="number" min="1" step="1" value="${f.priority}"></div>
        <div class="field"><label>Status</label><select id="foodDetailsStatus"><option value="auto" ${f.manualStatus === "auto" ? "selected" : ""}>Automatisch → ${esc(status(f))}</option>${["Offen", "Probiert", "Verträgliche Basis", "Regelmäßig", "Pausiert"].map((x) => `<option value="${x}" ${f.manualStatus === x ? "selected" : ""}>${x} manuell</option>`).join("")}</select></div>
      </div>
      <div class="grid2"><button class="btn secondary smallbtn" id="foodDetailsTop">Ganz nach oben</button><button class="btn secondary smallbtn" id="foodDetailsBottom">Ganz nach unten</button></div>
    </details>
    <div class="history" style="margin-top:10px">
      <b>Gefriervorrat</b>
      <div class="small">${stock ? `${stock} Portionen vorhanden` : "Kein Vorrat eingetragen"}</div>
    </div>
    <div class="history">
      <b>Nächste Verwendung</b>
      ${
        planned.length
          ? planned
              .map(
                (p) =>
                  `<div class="small">${shortDate(p.date)} · ${mealName(p.meal)} · ${esc(p.dish)}</div>`,
              )
              .join("")
          : '<div class="small">In den nächsten sieben Tagen nicht eingeplant.</div>'
      }
    </div>
    <div class="history">
      <b>Passende Rezeptideen</b>
      ${
        recipes.length
          ? `<div class="small">${recipes.map((r) => esc(r.name)).join(" · ")}</div>`
          : '<div class="small">Noch keine hinterlegte Rezeptidee.</div>'
      }
    </div>
    <details class="accordion">
      <summary>Zubereitung und Prep</summary>
      <p class="small"><b>Sichere Form:</b> ${esc(f.safeForm)}</p>
      <p class="small"><b>Prep:</b> ${esc(f.prep)}</p>
    </details>
    <div class="sticky-form-actions ds-actionbar" style="margin-top:12px">
      <button class="btn" id="foodAddStock">Gefriervorrat hinzufügen</button>
      <button class="btn secondary" id="foodToggleActive">${f.active ? "Für Planung deaktivieren" : "Wieder aktivieren"}</button>
    </div>`,
  );
  let refreshFoodDetails = () => { save(); renderAll(); showFoodInfo(food(f.id)); };
  document.getElementById("foodDetailsPriority").onchange = (event) => { f.priority = Math.max(1, Number(event.target.value) || 999); refreshFoodDetails(); };
  document.getElementById("foodDetailsStatus").onchange = (event) => { f.manualStatus = event.target.value; delete f.reactionPauseSourceLogId; delete f.reactionPausePreviousStatus; refreshFoodDetails(); };
  document.getElementById("foodDetailsTop").onclick = () => { f.priority = Math.min(...state.foods.map((item) => Number(item.priority) || 999)) - 1; refreshFoodDetails(); };
  document.getElementById("foodDetailsBottom").onclick = () => { f.priority = Math.max(...state.foods.map((item) => Number(item.priority) || 0)) + 1; refreshFoodDetails(); };
  document.getElementById("foodAddStock").onclick = () =>
    addInventoryForm({
      foodId: f.id,
      portions: 4,
      note: "",
    });
  document.getElementById("foodToggleActive").onclick = () =>
    setFoodActiveWithPlanCheck(f, !f.active);
}

function openFollowUpEditor(foodId) {
  let record = state.followUps?.[foodId];
  let f = food(foodId);
  if (!record || !f) return;
  let candidates = safeBaseCandidates(foodId, record.meal || "lunch", record.previousBaseIds || priorBaseIds(foodId));
  let prepOptions = followUpPreparationOptions(foodId);
  let baseValue = record.baseMode === "none" ? "__none__" : record.baseMode === "manual" ? record.baseFoodId : "__auto__";
  let automatic = candidates[0]?.food;
  openGeneric(`${f.name} wieder anbieten`, `
    <div class="notice olive"><b>${esc(followUpStatusText(record))}</b><div class="small">Zeitfenster ${record.earliestDate ? shortDate(record.earliestDate) : "–"} bis ${record.latestDate ? shortDate(record.latestDate) : "offen"}</div></div>
    <div class="field"><label>Datum</label><input type="date" id="followupEditDate" value="${esc(record.dueDate || addDays(today(), 1))}"></div>
    <div class="field"><label>Mahlzeit</label><select id="followupEditMeal"><option value="breakfast">Frühstück</option><option value="lunch">Mittagessen</option><option value="dinner">Abendessen</option></select></div>
    <div class="field"><label>Sichere Basis</label><select id="followupEditBase">
      <option value="__auto__">Automatisch${automatic ? ` – ${esc(automatic.name)}` : " – keine passende Basis"}</option>
      <option value="__none__">Bewusst ohne Basis anbieten</option>
      ${candidates.map((item) => `<option value="${esc(item.food.id)}">${esc(item.food.name)}${item.food.id === automatic?.id ? " – beste Wahl" : ""}</option>`).join("")}
    </select>${record.alternativeBaseIds?.length ? `<div class="small followup-editor-hint">Ähnlich geeignete Alternativen: ${record.alternativeBaseIds.map((id) => food(id)?.name).filter(Boolean).map(esc).join(" · ")}</div>` : ""}</div>
    <div class="field"><label>Zubereitung</label><select id="followupEditPreparation">${prepOptions.map((option) => `<option value="${esc(option.key)}">${esc(option.label)}</option>`).join("")}</select><div class="small followup-editor-hint" id="followupPreparationHint"></div></div>
    <div class="notice warn" id="followupEditError" style="display:none"></div>
    <div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelFollowUpEdit" type="button">Abbrechen</button><button class="btn" id="saveFollowUpEdit">Änderung übernehmen</button></div>
  `);
  let meal = document.getElementById("followupEditMeal");
  let base = document.getElementById("followupEditBase");
  let prep = document.getElementById("followupEditPreparation");
  meal.value = record.meal || "lunch";
  base.value = [...base.options].some((option) => option.value === baseValue) ? baseValue : "__auto__";
  prep.value = prepOptions.some((option) => option.key === record.preparationKey) ? record.preparationKey : (prepOptions[0]?.key || "standard");
  let updatePrepHint = () => { document.getElementById("followupPreparationHint").textContent = prepOptions.find((option) => option.key === prep.value)?.text || ""; };
  prep.onchange = updatePrepHint;
  updatePrepHint();
  document.getElementById("cancelFollowUpEdit").onclick = closeGeneric;
  document.getElementById("saveFollowUpEdit").onclick = () => {
    let editorError = document.getElementById("followupEditError");
    if (editorError) { editorError.textContent = ""; editorError.style.display = "none"; }
    let requestedDate = document.getElementById("followupEditDate").value;
    if (!requestedDate) {
      if (editorError) { editorError.textContent = "Bitte ein Datum wählen."; editorError.style.display = "block"; }
      document.getElementById("followupEditDate")?.focus();
      return;
    }
    record.meal = meal.value;
    if (base.value === "__none__") {
      record.baseMode = "none";
      record.baseFoodId = "";
    } else if (base.value === "__auto__") {
      let best = safeBaseCandidates(foodId, record.meal, record.previousBaseIds || [])[0]?.food;
      record.baseMode = "auto";
      record.baseFoodId = best?.id || "";
    } else {
      record.baseMode = "manual";
      record.baseFoodId = base.value;
    }
    let selectedPrep = prepOptions.find((option) => option.key === prep.value) || prepOptions[0];
    record.preparationKey = selectedPrep?.key || "standard";
    record.preparationText = selectedPrep?.text || f.safeForm || "";
    if (record.status === "later") record.status = "scheduled";
    let result = applyFollowUpPlan(record, requestedDate);
    if (!result.ok) {
      if (editorError) { editorError.textContent = result.message; editorError.style.display = "block"; }
      return;
    }
    save();
    closeGeneric();
    renderAll();
    showToast("Wiedervorlage angepasst.");
  };
}

function followUpCard(record) {
  let f = food(record.foodId), base = food(record.baseFoodId);
  let due = record.dueDate ? shortDate(record.dueDate) : "nach Einkauf";
  let alternatives = (record.alternativeBaseIds || []).map((id) => food(id)?.name).filter(Boolean);
  let prepLabel = followUpPreparationOptions(record.foodId).find((option) => option.key === record.preparationKey)?.label || "Sichere Standardform";
  let returnPrompt = record.status === "later" && record.dueDate && record.dueDate <= today();
  return `<div class="foodcard followup-food-card" data-food="${f.id}"><div class="row"><div class="grow"><div class="foodtitle"><span class="food-emoji">${foodEmoji(f)}</span>${esc(f.name)} <span class="pill ph">${esc(followUpStatusText(record))}</span></div><div class="foodmeta">${record.baseMode === "none" ? "Ohne Basis" : base ? `Mit ${esc(base.name)}` : "Basis automatisch"} · ${record.dueDate ? `fällig ${due}` : "Zutat fehlt"}</div>${alternatives.length ? `<div class="small followup-alternatives">Alternativ: ${alternatives.map(esc).join(" · ")}</div>` : ""}<div class="small followup-preparation">${esc(prepLabel)}</div></div><div class="followup-card-actions"><button class="btn secondary smallbtn followupEdit" data-food="${f.id}">Ändern</button><button class="btn secondary smallbtn foodInfo">Details</button></div></div><div class="notice warn followup-card-error" style="display:none"></div>${returnPrompt ? `<div class="return-prompt"><b>${esc(f.name)} wieder einplanen?</b><div class="inline-actions"><button class="btn smallbtn followupYes" data-food="${f.id}">Ja</button><button class="btn secondary smallbtn followupLater" data-food="${f.id}">Später</button></div></div>` : ""}</div>`;
}
function renderFoods() {
  document.querySelectorAll("#foodFilters button").forEach((button) => button.classList.toggle("active", button.dataset.filter === foodFilter));
  let q = normalizeName(document.getElementById("foodSearch").value || "");
  let inactiveCount = state.foods.filter((f) => !f.active).length;
  let inactiveButton = document.getElementById("inactiveFoodFilter"); if (inactiveButton) inactiveButton.textContent = `Deaktiviert${inactiveCount ? ` (${inactiveCount})` : ""}`;
  let reorderButton = document.getElementById("toggleFoodOrder"); if (reorderButton) { reorderButton.textContent = foodReorderMode ? "Reihenfolge fertig" : "Reihenfolge ändern"; reorderButton.classList.toggle("ochre", foodReorderMode); }
  let hint = document.getElementById("foodReorderHint"); if (hint) hint.style.display = foodReorderMode ? "block" : "none";
  document.getElementById("foodList").classList.toggle("reorder-mode", foodReorderMode);
  let followups = foodFilter === "open" && !q && !foodReorderMode ? followUpEntries() : [];
  let followupIds = new Set(followups.map((record) => record.foodId));
  let arr = state.foods.filter((f) => {
    let hit = !q || foodSearchMatches(f, q);
    if (!hit) return false;
    if (foodFilter === "inactive") return !f.active;
    if (foodFilter === "open") return f.active && rank(f) < 2 && status(f) !== "Pausiert" && !followupIds.has(f.id);
    if (foodFilter === "allergen") return f.active && !!f.allergenGroup;
    if (foodFilter === "ph") return f.active && f.ph;
    if (foodFilter === "iron") return f.active && f.ironRich;
    if (foodFilter === "paused") return f.active && status(f) === "Pausiert";
    return true;
  }).sort((a, b) => {
    if (q) {
      let bySearch = foodSearchScore(a, q) - foodSearchScore(b, q);
      if (bySearch) return bySearch;
    }
    return Number(a.active) === Number(b.active) ? Number(a.priority) - Number(b.priority) : Number(b.active) - Number(a.active);
  });
  let activeCount = state.foods.length - inactiveCount;
  document.getElementById("foodCountText").textContent = `${arr.length + followups.length} angezeigt · ${activeCount} aktiv · ${inactiveCount} deaktiviert`;
  let renderFoodCard = (f) => {
    let raw = status(f), statusClass = raw === "Offen" ? "status-open" : raw === "Probiert" ? "status-tried" : raw === "Verträgliche Basis" ? "status-tolerated" : raw === "Regelmäßig" ? "status-regular" : "status-paused";
    return `<div class="foodcard ${statusClass} ${f.active ? "" : "inactive"} ${foodReorderMode && f.active ? "reorderable" : ""}" data-food="${f.id}"><div class="row">${foodReorderMode && f.active ? `<div class="food-sort-actions"><button class="food-jump jumpTop" aria-label="Ganz nach oben">⇧</button><button class="drag-handle" aria-label="Lebensmittel verschieben">⠿</button><button class="food-jump jumpBottom" aria-label="Ganz nach unten">⇩</button></div>` : ""}<div class="grow"><div class="foodtitle"><span class="food-emoji">${foodEmoji(f)}</span>${esc(f.name)} ${!f.active ? '<span class="pill inactive-pill">Deaktiviert</span>' : ""}</div><div class="foodmeta">${esc(f.alias || f.category)} · <span class="food-status-text">${esc(displayStatus(f))}</span></div>${!f.active ? '<div class="inactive-note">Nicht in neuen Planungen, Rezeptvorschlägen oder Prep.</div>' : ""}</div><button class="btn secondary smallbtn foodInfo">Details</button></div></div>`;
  };
  let sections = [];
  if (followups.length) sections.push(`<section class="followup-section"><div class="followup-section-head"><h3>Wieder anbieten</h3><div class="small">Planbare Lebensmittel zuerst, danach nach Fälligkeit.</div></div>${followups.map(followUpCard).join("")}</section>`);
  if (arr.length) sections.push(arr.map(renderFoodCard).join(""));
  let emptyFoodAction = q
    ? { label: "Suche zurücksetzen", mode: "search" }
    : foodFilter !== "all"
      ? { label: "Alle Lebensmittel anzeigen", mode: "all" }
      : { label: "Lebensmittel hinzufügen", mode: "add" };
  document.getElementById("foodList").innerHTML = sections.join("") || `<div class="empty ds-empty"><div>Keine passenden Lebensmittel.</div><button class="btn" id="foodEmptyAction" type="button">${emptyFoodAction.label}</button></div>`;
  document.getElementById("foodEmptyAction")?.addEventListener("click", () => {
    if (emptyFoodAction.mode === "search") {
      document.getElementById("foodSearch").value = "";
    } else if (emptyFoodAction.mode === "all") {
      foodFilter = "all";
    } else {
      addCustomFoodForm();
      return;
    }
    renderFoods();
  });
  document.querySelectorAll(".drag-handle").forEach((handle) => handle.onpointerdown = beginFoodDrag);
  document.querySelectorAll(".jumpTop").forEach((button) => button.onclick = () => jumpFoodInVisibleOrder(button.closest("[data-food]").dataset.food, "top"));
  document.querySelectorAll(".jumpBottom").forEach((button) => button.onclick = () => jumpFoodInVisibleOrder(button.closest("[data-food]").dataset.food, "bottom"));
  document.querySelectorAll(".foodcard").forEach((card) => { let f = food(card.dataset.food); let info = card.querySelector(".foodInfo"); if (info) info.onclick = () => showFoodInfo(f); });
  document.querySelectorAll(".followupEdit").forEach((button) => button.onclick = () => openFollowUpEditor(button.dataset.food));
  document.querySelectorAll(".followupYes").forEach((button) => button.onclick = () => {
    let record = state.followUps[button.dataset.food];
    if (!record) return;
    record.status = "scheduled";
    let target = record.dueDate && record.dueDate >= today() ? record.dueDate : "";
    if (!target) for (let i = 0; i <= 45; i++) { let date = addDays(today(), i); if (!planSlotProtected(date, record.meal || "lunch")) { target = date; break; } }
    let result = applyFollowUpPlan(record, target);
    if (!result.ok) {
      let error = button.closest(".followup-food-card")?.querySelector(".followup-card-error");
      if (error) { error.textContent = result.message; error.style.display = "block"; }
      return;
    }
    save(); renderAll();
  });
  document.querySelectorAll(".followupLater").forEach((button) => button.onclick = () => {
    let record = state.followUps[button.dataset.food];
    if (!record) return;
    removeFollowUpPlan(record.foodId);
    record.dueDate = addDays(today(), 7);
    record.status = "later";
    record.updatedAt = new Date().toISOString();
    save(); renderAll();
  });
}

function showFoodInfo(f) {
  showFoodInfoCore(f);
  let raw = status(f), count = offeredCount(f.id);
  let modal = document.getElementById("genericBody");
  let dynamic = modal?.querySelector(".food-detail-dynamic");
  modal?.querySelectorAll(".chips .pill").forEach((pill) => { if (["Offen", "Verträgliche Basis"].includes((pill.textContent || "").trim())) pill.textContent = ({ Offen: "Noch offen", "Verträgliche Basis": "Vertragen" })[(pill.textContent || "").trim()]; });
  if (["Probiert", "Verträgliche Basis"].includes(raw)) {
    dynamic?.insertAdjacentHTML("beforeend", `<div class="small food-offer-count">${count}× angeboten · ${esc(statusSource(f))}</div>`);
  }
  let follow = state.followUps?.[f.id];
  if (follow) dynamic?.insertAdjacentHTML("afterbegin", `<div class="notice olive"><b>${esc(followUpStatusText(follow))}</b><div class="small">${follow.dueDate ? `Fällig ${shortDate(follow.dueDate)}` : "Wird nach dem Einkauf wieder eingeplant."}</div></div>`);
}
