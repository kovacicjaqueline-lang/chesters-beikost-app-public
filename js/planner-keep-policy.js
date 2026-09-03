"use strict";

/*
 * Bewusstes „Behalten“ ist eine Nutzerentscheidung und wird von internen
 * Planner-Snapshots getrennt. Historische pauschale Drei-Tage-Auto-Locks werden
 * einmalig bereinigt; Follow-ups, Tracking-/Rollover-Zustände und Random-Swap-
 * Snapshots behalten ihre eigene Sondersemantik.
 */
(function installExplicitMealKeepPolicy(globalScope) {
  const RANDOM_SWAP_FLAGS = Object.freeze([
    "randomSwapPinned",
    "randomSwapPreserved",
    "randomSwapTarget",
  ]);

  function isLegacyThreeDayAutoLock(lock) {
    return !!lock &&
      lock.mode === "auto" &&
      !lock.followUpFoodId &&
      !lock.plannerTrackingSnapshot &&
      !lock.rolloverShifted &&
      !RANDOM_SWAP_FLAGS.some((flag) => !!lock[flag]);
  }

  function hasLinkedLog(currentState, lock) {
    if (!lock?.planId) return false;
    return (currentState?.logs || []).some((log) => log?.plannedMealId === lock.planId);
  }

  function cleanupLegacyThreeDayAutoLocks(currentState, currentDate, addDaysFn) {
    if (!currentState?.planLocks || !currentDate || typeof addDaysFn !== "function") return 0;
    const until = addDaysFn(currentDate, 2);
    let changed = 0;
    for (const [key, lock] of Object.entries(currentState.planLocks)) {
      const date = String(key || "").split("|")[0];
      if (date < currentDate || date > until || !isLegacyThreeDayAutoLock(lock)) continue;
      if (date === currentDate && hasLinkedLog(currentState, lock)) {
        lock.plannerTrackingSnapshot = true;
        delete currentState.autoLockExcluded?.[key];
        changed += 1;
        continue;
      }
      delete currentState.planLocks[key];
      if (currentState.overrides?.[key] === lock.focusId) delete currentState.overrides[key];
      delete currentState.autoLockExcluded?.[key];
      changed += 1;
    }
    for (const [key, excluded] of Object.entries(currentState.autoLockExcluded || {})) {
      const date = String(key || "").split("|")[0];
      if (date < currentDate || date > until || excluded !== true) continue;
      delete currentState.autoLockExcluded[key];
      changed += 1;
    }
    return changed;
  }

  function clearReplannablePlanState(currentState, from, days, addDaysFn) {
    if (!currentState || !from || typeof addDaysFn !== "function") return 0;
    currentState.planLocks ||= {};
    currentState.overrides ||= {};
    currentState.autoLockExcluded ||= {};
    const end = addDaysFn(from, Math.max(0, (Number(days) || 1) - 1));
    const inRange = (key) => {
      const date = String(key || "").split("|")[0];
      return date >= from && date <= end;
    };
    let changed = 0;

    for (const [key, lock] of Object.entries(currentState.planLocks)) {
      if (!inRange(key)) continue;
      if (lock?.mode !== "auto" || lock.followUpFoodId || lock.plannerTrackingSnapshot) continue;
      delete currentState.planLocks[key];
      changed += 1;
    }

    for (const [key] of Object.entries(currentState.overrides)) {
      if (!inRange(key)) continue;
      const lock = currentState.planLocks[key];
      if (lock?.mode === "manual" || lock?.followUpFoodId) continue;
      delete currentState.overrides[key];
      changed += 1;
    }

    for (const [key, excluded] of Object.entries(currentState.autoLockExcluded)) {
      if (!inRange(key) || excluded !== true) continue;
      delete currentState.autoLockExcluded[key];
      changed += 1;
    }
    return changed;
  }

  const policy = Object.freeze({
    RANDOM_SWAP_FLAGS,
    isLegacyThreeDayAutoLock,
    hasLinkedLog,
    cleanupLegacyThreeDayAutoLocks,
    clearReplannablePlanState,
  });
  globalScope.PlannerKeepPolicy = policy;
  if (typeof module !== "undefined" && module.exports) module.exports = policy;

  if (typeof document === "undefined" || typeof state === "undefined" || !state || globalScope.__plannerKeepPolicyInstalled) return;
  globalScope.__plannerKeepPolicyInstalled = true;

  const originalRenderPlan = typeof renderPlan === "function" ? renderPlan : null;
  const originalOpenFullPlanRebuild = typeof openFullPlanRebuild === "function" ? openFullPlanRebuild : null;

  globalScope.isAutoLockDate = () => false;
  globalScope.ensureAutoLocks = () => false;

  function rebuildVisiblePlanKeepingUserChoices() {
    const from = state.settings?.planFrom || (typeof today === "function" ? today() : "");
    if (!from || typeof addDays !== "function") return;
    clearReplannablePlanState(state, from, 7, addDays);
    if (typeof save === "function") save();
    if (typeof renderAll === "function") renderAll();
  }
  globalScope.clearAutomaticLocks = rebuildVisiblePlanKeepingUserChoices;
  globalScope.rebuildVisiblePlan = rebuildVisiblePlanKeepingUserChoices;

  globalScope.openFullPlanRebuild = function openSimplifiedPlanRebuild() {
    if (typeof openGeneric !== "function") return;
    const from = state.settings?.planFrom || (typeof today === "function" ? today() : "");
    const until = from && typeof addDays === "function" ? addDays(from, 6) : "";
    const range = from && until && typeof nice === "function"
      ? `<p>Neu erstellt wird der Zeitraum <b>${nice(from, true)} bis ${nice(until, true)}</b>.</p>`
      : "";
    openGeneric(
      "Woche neu planen",
      `${range}<div class="notice olive"><b>Bleibt erhalten:</b> protokollierte Mahlzeiten, manuell hinzugefügte oder bearbeitete Mahlzeiten, bewusst behaltene Mahlzeiten, bewusst gelöschte Mahlzeiten und Wiedervorlagen.</div><div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelPlanRebuild" type="button">Abbrechen</button><button class="btn" id="confirmPlanRebuild" type="button">Woche neu planen</button></div>`,
    );
    const cancel = document.getElementById("cancelPlanRebuild");
    const confirm = document.getElementById("confirmPlanRebuild");
    if (cancel) cancel.onclick = typeof closeGeneric === "function" ? closeGeneric : null;
    if (confirm) confirm.onclick = () => {
      if (typeof closeGeneric === "function") closeGeneric();
      rebuildVisiblePlanKeepingUserChoices();
      if (typeof showToast === "function") showToast("Woche neu geplant; deine bewusst festgelegten Mahlzeiten bleiben erhalten.");
    };
  };

  const rebuildButton = document.getElementById("planRebuildAll");
  if (rebuildButton && originalOpenFullPlanRebuild)
    rebuildButton.removeEventListener("click", originalOpenFullPlanRebuild);
  if (rebuildButton) rebuildButton.addEventListener("click", globalScope.openFullPlanRebuild);
  const recalculateButton = document.getElementById("planRecalculate");
  if (recalculateButton) {
    recalculateButton.onclick = globalScope.openFullPlanRebuild;
    recalculateButton.textContent = "Woche neu planen";
  }

  function enhanceKeepLabels() {
    document.querySelectorAll?.(".meal-lock").forEach((button) => {
      const date = button.dataset?.lockDate || "";
      const meal = button.dataset?.lockMeal || "";
      const key = date && meal ? `${date}|${meal}` : "";
      const lock = key ? state.planLocks?.[key] : null;
      const label = button.closest?.(".mealbox")?.querySelector?.(".lock-label");
      if (lock?.mode === "manual") {
        button.setAttribute("aria-label", "Mahlzeit bei automatischer Neuplanung wieder freigeben");
        button.setAttribute("title", "Behalten");
        if (label) label.textContent = "Behalten";
      } else if (!lock) {
        button.setAttribute("aria-label", "Mahlzeit bei automatischer Neuplanung behalten");
        button.setAttribute("title", "Behalten");
      }
    });

    const summary = document.querySelector("#planLockSummary .plan-lock-text");
    if (summary) {
      summary.innerHTML = summary.innerHTML
        .replace(/manuell geschützt/g, "behalten")
        .replace("Keine feste Planung", "Keine Mahlzeit bewusst behalten");
    }

    const recalculate = document.getElementById("planRecalculate");
    if (recalculate) {
      recalculate.textContent = "Woche neu planen";
      recalculate.onclick = globalScope.openFullPlanRebuild;
    }
    const rebuild = document.getElementById("planRebuildAll");
    if (rebuild) rebuild.hidden = true;

    document.querySelectorAll?.(".help-topic").forEach((topic) => {
      if (topic.querySelector("summary")?.textContent?.trim() !== "Plan und Schlösser") return;
      const body = topic.querySelector(".small");
      if (!body) return;
      body.innerHTML = `<p><b>Geschlossenes Schloss · Behalten:</b> Diese konkrete Mahlzeit bleibt bei einer automatischen Neuplanung unverändert.</p><p><b>Offenes Schloss:</b> Die App darf die Mahlzeit bei einer Neuplanung an den aktuellen Stand anpassen.</p><p>Automatisch vorgeschlagene Mahlzeiten werden nicht mehr pauschal für drei Tage eingefroren. „Woche neu planen“ berechnet normale Vorschläge neu; protokollierte, manuell hinzugefügte oder bearbeitete, bewusst behaltene oder gelöschte Mahlzeiten und Wiedervorlagen bleiben bestehen.</p>`;
    });
  }

  if (originalRenderPlan) {
    globalScope.renderPlan = function renderPlanWithKeepLabels() {
      const result = originalRenderPlan.apply(this, arguments);
      enhanceKeepLabels();
      return result;
    };
  }

  const changed = cleanupLegacyThreeDayAutoLocks(
    state,
    typeof today === "function" ? today() : "",
    typeof addDays === "function" ? addDays : null,
  );

  if (changed > 0) {
    if (typeof save === "function") save();
    if (typeof renderCurrentView === "function") renderCurrentView();
    else enhanceKeepLabels();
  } else {
    enhanceKeepLabels();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
