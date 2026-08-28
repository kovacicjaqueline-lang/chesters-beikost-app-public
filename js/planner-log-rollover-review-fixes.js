"use strict";

/* Review-Fixes für Planner-Log/Rollover:
 * 1) normale „Auf morgen“-Semantik bleibt unverändert,
 * 2) sichtbare Auto-Pläne außerhalb des +2-Lockfensters bleiben als Snapshot erhalten,
 * 3) Tageszusammenfassungen berücksichtigen alle tatsächlichen Protokolleinträge.
 */
(function plannerRolloverReviewFixesModule(globalScope) {
  function visibleSnapshotPlansForSlot(data, core, date, meal) {
    let meta = core.ensurePlannerMeta(data);
    return Object.values(meta.carriedPlans || {}).filter((plan) =>
      plan?.visibleSnapshot && plan.date === date && plan.meal === meal,
    );
  }

  function persistVisibleAutoPlans(data, core, days, todayValue, snapshotFactory, capturedAt = "") {
    if (!data || !core || typeof snapshotFactory !== "function") return { changed: false, snapshots: [] };
    data.planLocks ||= {};
    data.manualMeals ||= {};
    let meta = core.ensurePlannerMeta(data);
    let changed = false;
    let snapshots = [];

    for (let day of days || []) {
      if (!day?.date || day.date < todayValue) continue;
      for (let meal of day.meals || []) {
        if (!meal?.meal || !meal.active || meal.empty || !meal.focusId) continue;
        let key = `${day.date}|${meal.meal}`;
        let primary = data.manualMeals[key] || data.planLocks[key] || null;
        let previous = visibleSnapshotPlansForSlot(data, core, day.date, meal.meal);

        if (primary) {
          for (let snapshot of previous) {
            delete meta.carriedPlans[snapshot.planId];
            changed = true;
          }
          if (primary.planId) meal.planId = primary.planId;
          continue;
        }

        let snapshot = snapshotFactory(day.date, meal.meal, meal);
        if (!snapshot?.focusId) continue;
        let planId = meal.planId || snapshot.planId || core.stablePlanId(snapshot, day.date, meal.meal);
        meal.planId = planId;
        snapshot.planId = planId;

        for (let stored of previous) {
          if (stored.planId === planId) continue;
          delete meta.carriedPlans[stored.planId];
          changed = true;
        }

        let existing = meta.carriedPlans[planId];
        if (existing && !existing.visibleSnapshot) continue;
        if (existing?.visibleSnapshot) {
          snapshots.push(existing);
          continue;
        }

        let stored = {
          ...snapshot,
          date: day.date,
          meal: meal.meal,
          planId,
          source: "carried",
          carriedPlannerPlan: true,
          visibleSnapshot: true,
          visibleSnapshotAt: capturedAt || undefined,
        };
        meta.carriedPlans[planId] = stored;
        snapshots.push(stored);
        changed = true;
      }
    }
    return { changed, snapshots };
  }

  function actualLoggedSlot(data, core, date, meal) {
    return !!core?.legacyCompletedLog?.(data, date, meal);
  }

  function openConcretePlansAt(data, core, date, meal) {
    return core?.openPlanInstances?.(
      data,
      (plan) => plan.date === date && plan.meal === meal,
    ) || [];
  }

  function normalMoveSlotOccupied(data, core, date, meal, activeMealFn = () => false) {
    let key = `${date}|${meal}`;
    return !!data?.manualMeals?.[key] ||
      actualLoggedSlot(data, core, date, meal) ||
      openConcretePlansAt(data, core, date, meal).length > 0 ||
      !!activeMealFn(meal, date);
  }

  function normalMoveNextFreeDate(data, core, fromDate, meal, addDaysFn) {
    for (let offset = 1; offset <= 45; offset++) {
      let day = addDaysFn(fromDate, offset);
      let key = `${day}|${meal}`;
      let protectedCarried = openConcretePlansAt(data, core, day, meal)
        .some((plan) => plan.source === "carried" && !plan.visibleSnapshot);
      let manuallyOccupied = !!data?.manualMeals?.[key] ||
        !!data?.overrides?.[key] ||
        data?.planLocks?.[key]?.mode === "manual" ||
        actualLoggedSlot(data, core, day, meal) ||
        protectedCarried;
      if (!manuallyOccupied) return day;
    }
    return "";
  }

  function clearRolloverAcknowledgement(data, core, planId) {
    if (!planId || !core?.ensurePlannerMeta) return false;
    let handled = core.ensurePlannerMeta(data).rolloverHandled;
    if (!handled?.[planId]) return false;
    delete handled[planId];
    return true;
  }

  function dayActualLogSummary(logs = []) {
    return {
      count: logs.length,
      grams: logs.reduce((sum, log) => sum + (Number(log?.amount) || 0), 0),
    };
  }

  const API = Object.freeze({
    visibleSnapshotPlansForSlot,
    persistVisibleAutoPlans,
    actualLoggedSlot,
    openConcretePlansAt,
    normalMoveSlotOccupied,
    normalMoveNextFreeDate,
    clearRolloverAcknowledgement,
    dayActualLogSummary,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let core = globalScope.__plannerLogRolloverCore;
  if (!core) return;

  // Beim Bearbeiten eines freien Logs darf die Plan-ID nicht nachträglich aus
  // date|meal oder gleichen Zutaten inferiert werden. Der Sentinel durchläuft
  // die bestehende Wrapper-Kette und wird direkt nach dem Speichern entfernt.
  const FREE_EDIT_SENTINEL = "__planner_free_log_edit__";
  let originalOpenLog = openLog;
  openLog = function plannerFreeEditAwareOpenLog(plan) {
    if (plan?.editId && !plan.plannedMealId)
      return originalOpenLog({ ...plan, plannedMealId: FREE_EDIT_SENTINEL });
    return originalOpenLog(plan);
  };
  let originalSaveLog = saveLog;
  saveLog = function plannerFreeEditAwareSaveLog() {
    let freeEditId = pendingLog?.editId && pendingLog?.plannedMealId === FREE_EDIT_SENTINEL
      ? pendingLog.editId
      : "";
    let result = originalSaveLog();
    if (freeEditId) {
      let saved = state.logs?.find((log) => log.id === freeEditId);
      if (saved?.plannedMealId === FREE_EDIT_SENTINEL) {
        delete saved.plannedMealId;
        save();
        renderAll();
      }
    }
    return result;
  };

  let storageReady = false;
  let snapshotSavePending = false;
  let originalBootstrapStorage = bootstrapStorage;
  bootstrapStorage = async function plannerVisibleSnapshotBootstrap() {
    let result = await originalBootstrapStorage();
    storageReady = true;
    if (snapshotSavePending) {
      snapshotSavePending = false;
      await save();
    }
    return result;
  };

  let originalPlanDisplayDays = planDisplayDays;
  planDisplayDays = function plannerVisibleSnapshotDisplayDays(from, count = 7) {
    let days = originalPlanDisplayDays(from, count);
    let result = persistVisibleAutoPlans(
      state,
      core,
      days,
      today(),
      (date, meal, generated) => mealSnapshot(date, meal, generated, "auto"),
      new Date().toISOString(),
    );
    if (result.changed) {
      if (storageReady) save();
      else snapshotSavePending = true;
    }
    return days;
  };

  function removeCarriedSource(planId) {
    if (!planId) return;
    let meta = core.ensurePlannerMeta(state);
    delete meta.carriedPlans?.[planId];
  }

  function removeOpenCarriedTarget(date, meal) {
    let meta = core.ensurePlannerMeta(state);
    for (let [planId, plan] of Object.entries(meta.carriedPlans || {})) {
      if (plan?.date !== date || plan?.meal !== meal) continue;
      if (core.linkedCompletionLog(state, planId, date, meal)) continue;
      delete meta.carriedPlans[planId];
    }
  }

  function placeNormalMovedMeal(payload, targetDate) {
    if (!payload?.date || !payload?.meal || !targetDate) return;
    let sourceKey = `${payload.date}|${payload.meal}`;
    let targetKey = `${targetDate}|${payload.meal}`;
    let sourcePlanId = payload.planId || "";

    if (sourcePlanId) removeCarriedSource(sourcePlanId);
    if (!sourcePlanId || state.manualMeals?.[sourceKey]?.planId === sourcePlanId)
      delete state.manualMeals?.[sourceKey];
    if (!sourcePlanId || state.planLocks?.[sourceKey]?.planId === sourcePlanId)
      delete state.planLocks?.[sourceKey];
    delete state.overrides?.[sourceKey];
    clearRolloverAcknowledgement(state, core, sourcePlanId);

    // Nur die normale manuelle Verschiebeaktion benutzt weiterhin deferred.
    // Der Tageswechsel-/Rollover-Pfad bleibt davon vollständig getrennt.
    state.deferred ||= {};
    state.deferred[payload.date] = true;

    removeOpenCarriedTarget(targetDate, payload.meal);
    delete state.manualMeals?.[targetKey];
    delete state.planLocks?.[targetKey];
    delete state.overrides?.[targetKey];

    let moved = {
      ...payload,
      date: targetDate,
      meal: payload.meal,
      active: true,
      manualAdded: payload.manualAdded !== false,
      type: payload.type || "manuell",
      note: payload.note || "Bewusst auf diesen Tag verschoben.",
      createdAt: new Date().toISOString(),
    };
    state.manualMeals ||= {};
    state.planLocks ||= {};
    state.manualMeals[targetKey] = moved;
    state.planLocks[targetKey] = mealSnapshot(targetDate, payload.meal, moved, "manual");
    save();
    closeGeneric();
    renderAll();
    showToast(`${mealName(payload.meal)} auf ${shortDate(targetDate)} verschoben und vor automatischen Änderungen geschützt.`);
  }

  function normalMoveMealTomorrow(payload) {
    if (!payload?.date || !payload?.meal) return;
    let next = addDays(payload.date, 1);
    if (!normalMoveSlotOccupied(state, core, next, payload.meal, activeMeal)) {
      placeNormalMovedMeal(payload, next);
      return;
    }
    openGeneric(
      `${mealName(payload.meal)} verschieben`,
      `<p>Für morgen ist bereits ein ${mealName(payload.meal).toLowerCase()} eingeplant.</p>
       <div class="notice warn" id="moveMealError" style="display:none"></div>
       <div class="date-choice-grid">
        <button class="btn danger" id="moveReplace">Vorhandene Mahlzeit ersetzen</button>
        <button class="btn secondary" id="moveNextFree">Auf den nächsten freien Tag verschieben</button>
        <button class="btn secondary" id="moveCancel">Abbrechen</button>
       </div>`,
    );
    document.getElementById("moveReplace").onclick = () => placeNormalMovedMeal(payload, next);
    document.getElementById("moveNextFree").onclick = () => {
      let free = normalMoveNextFreeDate(state, core, next, payload.meal, addDays);
      if (!free) {
        let error = document.getElementById("moveMealError");
        if (error) {
          error.textContent = "In den nächsten Wochen wurde kein freier Platz gefunden.";
          error.style.display = "block";
        }
        return;
      }
      placeNormalMovedMeal(payload, free);
    };
    document.getElementById("moveCancel").onclick = closeGeneric;
  }

  function bindNormalMoveActions() {
    document.querySelectorAll(".moveMeal").forEach((button) => {
      button.onclick = () => normalMoveMealTomorrow(
        JSON.parse(decodeURIComponent(button.dataset.movePayload)),
      );
    });
  }

  function patchCompletedDaySummaries() {
    let container = document.getElementById("blockPlan");
    if (!container) return;
    let from = visiblePlanStart();
    [...container.children].forEach((dayNode, index) => {
      if (!dayNode.classList?.contains("completed-day")) return;
      let date = addDays(from, index);
      let summary = dayActualLogSummary(core.logsForDate(state, date));
      let label = dayNode.querySelector("summary .small");
      if (!label) return;
      label.textContent = `${summary.count} ${summary.count === 1 ? "Protokolleintrag" : "Protokolleinträge"}${summary.grams ? ` · ${summary.grams} g protokolliert` : ""}`;
    });
  }

  function patchTodayDayHeading() {
    let container = document.getElementById("blockPlan");
    if (!container) return;
    let from = visiblePlanStart();
    let current = today();
    [...container.children].forEach((dayNode, index) => {
      if (!dayNode.classList?.contains("day-card")) return;
      let date = addDays(from, index);
      if (date !== current) return;
      let heading = dayNode.querySelector(".day-date");
      if (heading) heading.textContent = `${nice(date, true)} · Heute`;
    });
  }

  let originalRenderPlanCore = renderPlanCore;
  renderPlanCore = function plannerReviewFixedRenderPlanCore() {
    let result = originalRenderPlanCore();
    bindNormalMoveActions();
    patchCompletedDaySummaries();
    patchTodayDayHeading();
    return result;
  };

  let originalRenderHomeCore = renderHomeCore;
  renderHomeCore = function plannerReviewFixedRenderHomeCore() {
    let result = originalRenderHomeCore();
    bindNormalMoveActions();
    return result;
  };

  globalScope.__plannerRolloverReviewFixes = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
