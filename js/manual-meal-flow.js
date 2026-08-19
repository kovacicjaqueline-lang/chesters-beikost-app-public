"use strict";

/*
 * Manueller Mahlzeiten-Flow – gezielte Integrationskorrekturen.
 *
 * Diese Runtime ergänzt ausschließlich den bestehenden manuellen Plan-Editor:
 * - expliziter/editierbarer Zieltag für manuell hinzugefügte Mahlzeiten,
 * - deterministische Rückkehr in den Plan nach dem Speichern,
 * - vorhandene FOOD-Zubereitungs-/Handlingoptionen je Lebensmittel,
 * - bestehende dishTitle()-Benennung für manuelle Karten,
 * - Durchreichen der expliziten Zubereitungsauswahl in Lock, Verschieben und Log.
 *
 * Es werden ausdrücklich keine neuen Mahlzeiteneignungs-, Safety-, Phasen- oder
 * Konsistenzregeln definiert. Die Auswahl stammt aus followUpPreparationOptions(),
 * das nach Handling-Readiness bereits die strukturierte Handling-Policy einbindet.
 */

let manualMealFlowContext = null;
let manualMealFlowObserver = null;

function manualMealFlowKey(date, meal) {
  return `${date}|${meal}`;
}

function manualMealFlowClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function manualMealFlowNormalizePreparationKeys(keys, foodIds) {
  let allowed = new Set((foodIds || []).filter(Boolean));
  return Object.fromEntries(
    Object.entries(keys || {})
      .filter(([foodId, key]) => allowed.has(foodId) && typeof key === "string" && key.trim())
      .map(([foodId, key]) => [foodId, key.trim()]),
  );
}

function manualMealFlowPreparationOptions(foodId) {
  if (typeof followUpPreparationOptions !== "function") return [];
  return (followUpPreparationOptions(foodId) || [])
    .filter((option) => option && typeof option.key === "string" && option.key)
    .map((option) => ({
      key: option.key,
      label: option.label || option.key,
      text: option.text || "",
    }));
}

function manualMealFlowValidPreparationKeys(keys, foodIds) {
  let normalized = manualMealFlowNormalizePreparationKeys(keys, foodIds);
  if (typeof followUpPreparationOptions !== "function") return normalized;
  return Object.fromEntries(
    Object.entries(normalized).filter(([foodId, key]) =>
      manualMealFlowPreparationOptions(foodId).some((option) => option.key === key),
    ),
  );
}

function manualMealFlowStoredConflict(currentState, sourceDate, targetDate, meal, hasCompletedLog = false) {
  if (!targetDate || targetDate === sourceDate) return "";
  let key = manualMealFlowKey(targetDate, meal);
  if (hasCompletedLog) return "Für diesen Tag ist diese Mahlzeit bereits protokolliert.";
  if (currentState?.manualMeals?.[key]) return "Für diesen Tag gibt es bereits eine manuelle Mahlzeit.";
  if (currentState?.planLocks?.[key]) return "Dieser Planplatz ist bereits fest eingeplant.";
  if (currentState?.overrides?.[key]) return "Dieser Planplatz ist bereits belegt.";
  return "";
}

function manualMealFlowTargetConflict(sourceDate, targetDate, meal) {
  let hasCompleted = typeof completedLog === "function" && !!completedLog(targetDate, meal);
  return manualMealFlowStoredConflict(
    typeof state !== "undefined" ? state : null,
    sourceDate,
    targetDate,
    meal,
    hasCompleted,
  );
}

function manualMealFlowRemoveSource(currentState, sourceDate, targetDate, meal) {
  if (!currentState || !sourceDate || sourceDate === targetDate) return false;
  let sourceKey = manualMealFlowKey(sourceDate, meal);
  let changed = false;
  if (currentState.manualMeals?.[sourceKey]) {
    delete currentState.manualMeals[sourceKey];
    changed = true;
  }
  if (currentState.planLocks?.[sourceKey]?.mode === "manual") {
    delete currentState.planLocks[sourceKey];
    changed = true;
  }
  if (currentState.overrides?.[sourceKey] && !currentState.planLocks?.[sourceKey]) {
    delete currentState.overrides[sourceKey];
    changed = true;
  }
  if (currentState.autoLockExcluded?.[sourceKey]) {
    delete currentState.autoLockExcluded[sourceKey];
    changed = true;
  }
  return changed;
}

function manualMealFlowSourceData(date, meal, initialMeal = null) {
  let key = manualMealFlowKey(date, meal);
  let stored = typeof state !== "undefined" ? state.manualMeals?.[key] : null;
  let lock = typeof state !== "undefined" ? state.planLocks?.[key] : null;
  return stored || initialMeal || lock || null;
}

function manualMealFlowCanEditDate(date, meal, initialMeal = null) {
  let key = manualMealFlowKey(date, meal);
  let stored = typeof state !== "undefined" ? state.manualMeals?.[key] : null;
  return !initialMeal || !!stored?.manualAdded || !!initialMeal?.manualAdded;
}

function manualMealFlowEsc(value) {
  if (typeof esc === "function") return esc(value);
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function manualMealFlowVisibleDate(date) {
  if (typeof nice === "function") return nice(date, true);
  return date;
}

function manualMealFlowEnsureTargetVisible(targetDate) {
  if (typeof state === "undefined" || !targetDate) return;
  let from = typeof visiblePlanStart === "function"
    ? visiblePlanStart()
    : (state.settings?.planFrom || (typeof today === "function" ? today() : targetDate));
  let until = typeof addDays === "function" ? addDays(from, 6) : from;
  if (targetDate < from || targetDate > until) {
    state.settings ||= {};
    state.settings.planFrom = targetDate;
  }
}

function manualMealFlowPreparationMapFor(date, meal) {
  if (typeof state === "undefined") return {};
  let key = manualMealFlowKey(date, meal);
  let source = state.manualMeals?.[key] || state.planLocks?.[key] || null;
  return manualMealFlowClone(source?.foodPreparationKeys || {});
}

function manualMealFlowPatchPayloadButton(button, date, meal) {
  if (!button?.dataset?.plan) return;
  let keys = manualMealFlowPreparationMapFor(date, meal);
  if (!Object.keys(keys).length) return;
  try {
    let payload = JSON.parse(decodeURIComponent(button.dataset.plan));
    payload.foodPreparationKeys = keys;
    button.dataset.plan = encodeURIComponent(JSON.stringify(payload));
  } catch (_error) {
    // Bestehendes Datenattribut unverändert lassen, falls ein Legacy-Payload nicht lesbar ist.
  }
}

function manualMealFlowEnhanceCards() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".manual-meal").forEach((details) => {
    let body = details.querySelector(".manual-meal-body");
    if (!body) return;
    let remove = body.querySelector(".removeManualMeal");
    let log = body.querySelector(".logMeal");
    let date = remove?.dataset?.date || "";
    let meal = remove?.dataset?.meal || "";
    if (date && meal) manualMealFlowPatchPayloadButton(log, date, meal);

    if (log && remove && !body.querySelector(":scope > .manual-meal-actions")) {
      let actions = document.createElement("div");
      actions.className = "manual-meal-actions";
      body.insertBefore(actions, log);
      actions.append(log, remove);
    }
  });
}

function manualMealFlowUpdateDateState() {
  let context = manualMealFlowContext;
  let input = typeof document !== "undefined" ? document.getElementById("manualMealTargetDate") : null;
  let error = typeof document !== "undefined" ? document.getElementById("manualMealTargetDateError") : null;
  let confirm = typeof document !== "undefined" ? document.getElementById("confirmManualMeal") : null;
  if (!context || !input) return;
  context.targetDate = input.value || context.sourceDate;
  let conflict = manualMealFlowTargetConflict(context.sourceDate, context.targetDate, context.meal);
  if (error) {
    error.textContent = conflict;
    error.style.display = conflict ? "block" : "none";
  }
  if (confirm) {
    if (confirm.dataset.manualFlowBaseDisabled == null)
      confirm.dataset.manualFlowBaseDisabled = confirm.disabled ? "true" : "false";
    confirm.disabled = confirm.dataset.manualFlowBaseDisabled === "true" || !!conflict;
  }
}

function manualMealFlowPreparationSelect(foodId) {
  let context = manualMealFlowContext;
  if (!context) return null;
  let options = manualMealFlowPreparationOptions(foodId);
  if (!options.length) return null;
  let wrapper = document.createElement("div");
  wrapper.className = "manual-preparation-field";
  let selectId = `manualPreparation-${String(foodId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  let saved = context.foodPreparationKeys?.[foodId] || "";
  if (saved && !options.some((option) => option.key === saved)) saved = "";
  wrapper.innerHTML = `<label for="${manualMealFlowEsc(selectId)}">Konsistenz / Darreichung</label><select id="${manualMealFlowEsc(selectId)}" data-manual-preparation="${manualMealFlowEsc(foodId)}"><option value="">Nicht festgelegt</option>${options.map((option) => `<option value="${manualMealFlowEsc(option.key)}" ${saved === option.key ? "selected" : ""}>${manualMealFlowEsc(option.label)}</option>`).join("")}</select>`;
  let select = wrapper.querySelector("select");
  if (select) {
    select.onchange = () => {
      context.foodPreparationKeys ||= {};
      if (select.value) context.foodPreparationKeys[foodId] = select.value;
      else delete context.foodPreparationKeys[foodId];
    };
  }
  return wrapper;
}

function manualMealFlowEnhanceEditor() {
  if (typeof document === "undefined" || !manualMealFlowContext) return;
  let body = document.getElementById("genericBody");
  if (!body || !document.getElementById("cancelManualMeal")) return;

  if (manualMealFlowContext.allowDateChange && !document.getElementById("manualMealTargetDate")) {
    let field = document.createElement("div");
    field.className = "field manual-meal-target-date";
    field.innerHTML = `<label for="manualMealTargetDate">Datum</label><input type="date" id="manualMealTargetDate" value="${manualMealFlowEsc(manualMealFlowContext.targetDate)}"><div class="field-error-message" id="manualMealTargetDateError" style="display:none"></div>`;
    body.insertBefore(field, body.firstChild);
    field.querySelector("input").onchange = manualMealFlowUpdateDateState;
  }

  body.querySelectorAll(".manual-role-item").forEach((item) => {
    if (item.querySelector(".manual-preparation-field")) return;
    let remove = item.querySelector(".removeManualSelected[data-food]");
    let foodId = remove?.dataset?.food || "";
    if (!foodId) return;
    let control = manualMealFlowPreparationSelect(foodId);
    if (control) item.appendChild(control);
  });

  manualMealFlowUpdateDateState();
}

function manualMealFlowEnsureObserver() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  let body = document.getElementById("genericBody");
  if (!body) return;
  if (manualMealFlowObserver) manualMealFlowObserver.disconnect();
  manualMealFlowObserver = new MutationObserver(() => manualMealFlowEnhanceEditor());
  manualMealFlowObserver.observe(body, { childList: true, subtree: true });
}

function manualMealFlowRestorePlan(targetDate, meal) {
  manualMealFlowEnsureTargetVisible(targetDate);
  if (typeof save === "function") save();
  if (typeof closeGeneric === "function") closeGeneric();
  if (typeof renderAll === "function") renderAll();
  if (typeof showView === "function") showView("plan");
  manualMealFlowContext = null;
  if (manualMealFlowObserver) {
    manualMealFlowObserver.disconnect();
    manualMealFlowObserver = null;
  }
  let restore = () => {
    manualMealFlowEnhanceCards();
    if (typeof document === "undefined") return;
    let target = document.querySelector(`.removeManualMeal[data-date="${targetDate}"][data-meal="${meal}"]`);
    let details = target?.closest(".manual-meal");
    if (details) {
      details.open = true;
      details.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
  else restore();
}

function installManualMealFlowRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__manualMealFlowRuntimeInstalled) return false;
  if (
    typeof openManualMealSelector !== "function" ||
    typeof saveManualMeal !== "function" ||
    typeof storeManualMeal !== "function" ||
    typeof mealDisplayTitle !== "function"
  ) return false;

  globalThis.__manualMealFlowRuntimeInstalled = true;

  let originalOpenManualMealSelector = openManualMealSelector;
  openManualMealSelector = function manualFlowOpenManualMealSelector(date, meal, initialMeal = null) {
    let source = manualMealFlowSourceData(date, meal, initialMeal);
    manualMealFlowContext = {
      sourceDate: date,
      targetDate: date,
      meal,
      allowDateChange: manualMealFlowCanEditDate(date, meal, initialMeal),
      foodPreparationKeys: manualMealFlowClone(source?.foodPreparationKeys || {}),
    };
    let result = originalOpenManualMealSelector.apply(this, arguments);
    manualMealFlowEnsureObserver();
    manualMealFlowEnhanceEditor();
    return result;
  };

  let originalStoreManualMeal = storeManualMeal;
  saveManualMeal = function manualFlowSaveManualMeal(sourceDate, meal, data) {
    let context = manualMealFlowContext;
    let targetDate = context && context.sourceDate === sourceDate && context.meal === meal
      ? (context.targetDate || sourceDate)
      : sourceDate;
    let conflict = manualMealFlowTargetConflict(sourceDate, targetDate, meal);
    if (conflict) {
      if (typeof showToast === "function") showToast(conflict);
      return { ok: false, message: conflict };
    }

    let foodIds = [...new Set(data?.foodIds || [])];
    let preparationKeys = manualMealFlowValidPreparationKeys(
      context?.foodPreparationKeys || data?.foodPreparationKeys || {},
      foodIds,
    );
    let payload = { ...data, foodPreparationKeys: preparationKeys };
    let result = originalStoreManualMeal(targetDate, meal, payload);
    if (!result?.ok) {
      if (typeof showToast === "function")
        showToast(result?.message || "Diese Mahlzeit kann noch nicht sicher gespeichert werden.");
      return result;
    }

    manualMealFlowRemoveSource(state, sourceDate, targetDate, meal);
    try { document.activeElement?.blur?.(); } catch (_error) {}
    manualMealFlowRestorePlan(targetDate, meal);
    if (typeof showToast === "function") {
      let moved = targetDate !== sourceDate;
      showToast(moved
        ? `${mealName(meal)} wurde auf ${manualMealFlowVisibleDate(targetDate)} verschoben und fest eingeplant.`
        : `${mealName(meal)} wurde manuell hinzugefügt und fest eingeplant.`);
    }
    return result;
  };

  if (typeof saveEditedPlanMeal === "function") {
    let originalSaveEditedPlanMeal = saveEditedPlanMeal;
    saveEditedPlanMeal = function manualFlowSaveEditedPlanMeal(date, meal, data) {
      let context = manualMealFlowContext;
      let foodIds = [...new Set(data?.foodIds || [])];
      let preparationKeys = manualMealFlowValidPreparationKeys(
        context?.foodPreparationKeys || data?.foodPreparationKeys || {},
        foodIds,
      );
      let result = originalSaveEditedPlanMeal.call(this, date, meal, {
        ...data,
        foodPreparationKeys: preparationKeys,
      });
      if (result?.ok) {
        manualMealFlowContext = null;
        if (manualMealFlowObserver) {
          manualMealFlowObserver.disconnect();
          manualMealFlowObserver = null;
        }
      }
      return result;
    };
  }

  let originalMealDisplayTitle = mealDisplayTitle;
  mealDisplayTitle = function manualFlowMealDisplayTitle(meal) {
    if (meal?.manualAdded && typeof dishTitle === "function")
      return dishTitle(meal);
    return originalMealDisplayTitle(meal);
  };

  if (typeof mealSnapshot === "function") {
    let originalMealSnapshot = mealSnapshot;
    mealSnapshot = function manualFlowMealSnapshot(...args) {
      let snapshot = originalMealSnapshot.apply(this, args);
      let generated = args[2];
      if (snapshot && generated?.foodPreparationKeys)
        snapshot.foodPreparationKeys = manualMealFlowClone(generated.foodPreparationKeys);
      return snapshot;
    };
  }

  if (typeof lockedMeal === "function") {
    let originalLockedMeal = lockedMeal;
    lockedMeal = function manualFlowLockedMeal(date, meal, ...rest) {
      let result = originalLockedMeal.call(this, date, meal, ...rest);
      let lock = typeof state !== "undefined" ? state.planLocks?.[manualMealFlowKey(date, meal)] : null;
      if (result && lock?.foodPreparationKeys)
        result.foodPreparationKeys = manualMealFlowClone(lock.foodPreparationKeys);
      return result;
    };
  }

  if (typeof placeMovedMeal === "function") {
    let originalPlaceMovedMeal = placeMovedMeal;
    placeMovedMeal = function manualFlowPlaceMovedMeal(payload, targetDate) {
      let preparationKeys = manualMealFlowPreparationMapFor(payload?.date, payload?.meal);
      let augmented = Object.keys(preparationKeys).length
        ? { ...payload, foodPreparationKeys: preparationKeys }
        : payload;
      return originalPlaceMovedMeal.call(this, augmented, targetDate);
    };
  }

  if (typeof renderPlan === "function") {
    let originalRenderPlan = renderPlan;
    renderPlan = function manualFlowRenderPlan(...args) {
      let result = originalRenderPlan.apply(this, args);
      manualMealFlowEnhanceCards();
      return result;
    };
  }

  if (typeof saveLog === "function") {
    let originalSaveLog = saveLog;
    saveLog = function manualFlowSaveLog(...args) {
      let draft = typeof pendingLog !== "undefined" ? pendingLog : null;
      let rawPreparationKeys = manualMealFlowClone(draft?.foodPreparationKeys || {});
      let editId = draft?.editId || "";
      let existingIds = new Set((state?.logs || []).map((log) => log.id));
      let existingEditLog = editId ? state.logs?.find((log) => log.id === editId) : null;
      let result = originalSaveLog.apply(this, args);
      let savedLog = editId
        ? state.logs?.find((log) => log.id === editId)
        : state.logs?.find((log) => !existingIds.has(log.id));
      if (!savedLog || (editId && savedLog === existingEditLog)) return result;

      let preparationKeys = manualMealFlowValidPreparationKeys(
        rawPreparationKeys,
        [...new Set(savedLog.foodIds || [])],
      );
      if (Object.keys(preparationKeys).length) {
        savedLog.foodPreparationKeys = manualMealFlowClone(preparationKeys);
        if (typeof save === "function") save();
      }
      return result;
    };
  }

  manualMealFlowEnhanceCards();

  if (typeof window !== "undefined" && window.__beikostTest) {
    window.__beikostTest.manualMealFlowTargetConflict = manualMealFlowTargetConflict;
    window.__beikostTest.manualMealFlowPreparationOptions = (foodId) =>
      manualMealFlowClone(manualMealFlowPreparationOptions(foodId));
  }

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installManualMealFlowRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    manualMealFlowKey,
    manualMealFlowNormalizePreparationKeys,
    manualMealFlowStoredConflict,
    manualMealFlowRemoveSource,
    installManualMealFlowRuntime,
  };
}
