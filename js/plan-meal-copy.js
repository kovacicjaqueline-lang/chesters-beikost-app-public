"use strict";

/* Mahlzeiten im Wochenplan gezielt auf einen weiteren Tag kopieren.
 * Die Quelle bleibt unverändert; die Kopie wird wie eine bewusst manuell
 * gesetzte Mahlzeit gespeichert und dadurch vor automatischer Neuplanung geschützt.
 */
function copiedPlanMealPayload(payload, targetDate, createdAt = new Date().toISOString()) {
  return {
    ...payload,
    date: targetDate,
    manualAdded: true,
    note: payload?.note || "",
    createdAt,
  };
}

function applyPlanMealCopy(appState, payload, targetDate, helpers = {}) {
  if (!appState || !payload?.meal || !targetDate) return null;
  const keyFor = helpers.keyFor || ((date, meal) => `${date}|${meal}`);
  const snapshot = helpers.snapshot || ((date, meal, item, mode) => ({ ...item, date, meal, mode }));
  const targetKey = keyFor(targetDate, payload.meal);

  appState.manualMeals ||= {};
  appState.planLocks ||= {};
  appState.overrides ||= {};
  delete appState.manualMeals[targetKey];
  delete appState.planLocks[targetKey];
  delete appState.overrides[targetKey];

  const copied = copiedPlanMealPayload(payload, targetDate, helpers.createdAt);
  appState.manualMeals[targetKey] = copied;
  appState.planLocks[targetKey] = snapshot(
    targetDate,
    payload.meal,
    { ...copied, active: true },
    "manual",
  );
  return { targetKey, copied };
}

(function installPlanMealCopy(root) {
  if (typeof document === "undefined" || root.__planMealCopyInstalled) return;
  root.__planMealCopyInstalled = true;

  function placeCopiedMeal(payload, targetDate) {
    const result = applyPlanMealCopy(state, payload, targetDate, {
      keyFor: planLockKey,
      snapshot: mealSnapshot,
    });
    if (!result) return;
    save();
    closeGeneric();
    renderAll();
    showToast(
      `${mealName(payload.meal)} auf ${shortDate(targetDate)} kopiert und vor automatischen Änderungen geschützt.`,
    );
  }

  function openCopyConflict(payload, targetDate) {
    openGeneric(
      `${mealName(payload.meal)} kopieren`,
      `<p>Am ${esc(nice(targetDate, true))} ist bereits ein ${esc(mealName(payload.meal).toLowerCase())} eingeplant.</p>
       <div class="notice warn" id="copyMealError" style="display:none"></div>
       <div class="date-choice-grid">
        <button class="btn danger" id="copyMealReplace" type="button">Vorhandene Mahlzeit ersetzen</button>
        <button class="btn secondary" id="copyMealNextFree" type="button">Nächsten freien Tag verwenden</button>
        <button class="btn secondary" id="copyMealCancel" type="button">Abbrechen</button>
       </div>`,
    );
    document.getElementById("copyMealReplace").onclick = () =>
      placeCopiedMeal(payload, targetDate);
    document.getElementById("copyMealNextFree").onclick = () => {
      const free = nextFreeMealDate(targetDate, payload.meal);
      if (!free) {
        const error = document.getElementById("copyMealError");
        if (error) {
          error.textContent = "In den nächsten Wochen wurde kein freier Platz gefunden.";
          error.style.display = "block";
        }
        return;
      }
      placeCopiedMeal(payload, free);
    };
    document.getElementById("copyMealCancel").onclick = closeGeneric;
  }

  function copyMealToDate(payload, targetDate) {
    if (visibleMealExists(targetDate, payload.meal)) {
      openCopyConflict(payload, targetDate);
      return;
    }
    placeCopiedMeal(payload, targetDate);
  }

  function chooseCopyTarget(payload) {
    const firstTarget = addDays(payload.date, 1);
    openGeneric(
      `${mealName(payload.meal)} kopieren`,
      `<p>Die bestehende Mahlzeit bleibt erhalten. Wähle den Tag für die zusätzliche Kopie.</p>
       <label class="field"><span>Tag</span><input id="copyMealDate" type="date" min="${firstTarget}" value="${firstTarget}"></label>
       <div class="sticky-form-actions ds-actionbar">
        <button class="btn secondary" id="copyMealTargetCancel" type="button">Abbrechen</button>
        <button class="btn" id="copyMealTargetConfirm" type="button">Mahlzeit kopieren</button>
       </div>`,
    );
    document.getElementById("copyMealTargetCancel").onclick = closeGeneric;
    document.getElementById("copyMealTargetConfirm").onclick = () => {
      const targetDate = document.getElementById("copyMealDate")?.value || "";
      if (!targetDate || targetDate < firstTarget) return;
      copyMealToDate(payload, targetDate);
    };
  }

  function decodeCopyPayload(button) {
    try {
      return JSON.parse(decodeURIComponent(button.dataset.copyPayload || ""));
    } catch (_error) {
      return null;
    }
  }

  function ensurePlanCopyButtons(container = document.getElementById("plan")) {
    if (!container?.querySelectorAll) return;
    container.querySelectorAll(".moveMeal[data-move-payload]").forEach((moveButton) => {
      const actionbar = moveButton.closest(".actionbar");
      if (!actionbar || actionbar.querySelector(".copyPlanMeal")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn secondary copyPlanMeal";
      button.textContent = "Mahlzeit kopieren";
      button.dataset.copyPayload = moveButton.dataset.movePayload || "";
      button.onclick = () => {
        const payload = decodeCopyPayload(button);
        if (payload) chooseCopyTarget(payload);
      };
      actionbar.insertBefore(button, moveButton);
    });
  }

  const plan = document.getElementById("plan");
  if (!plan) return;
  ensurePlanCopyButtons(plan);

  if (typeof MutationObserver === "function") {
    const observer = new MutationObserver(() => ensurePlanCopyButtons(plan));
    observer.observe(plan, { childList: true, subtree: true });
  }
  root.MobileUiLifecycle?.onRender?.("plan", () => ensurePlanCopyButtons(plan));
})(typeof globalThis !== "undefined" ? globalThis : window);

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    copiedPlanMealPayload,
    applyPlanMealCopy,
  };
}
