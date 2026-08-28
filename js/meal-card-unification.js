"use strict";

/* Einheitliche Mahlzeitenkarten für „Heute“ und Wochenplan.
 *
 * Die Planner-/Persistenzlogik und die Wochen-Tageskarten bleiben unverändert.
 * „Heute“ verwendet denselben renderMeal-Pfad wie der Wochenplan. Zusätzlich
 * wird die Vorratsanzeige verdichtet, erledigte Karten zeigen nur tatsächliche
 * Protokollinformationen und einzelne Plan-Slots können bewusst entfernt werden.
 */
(function mealCardUnificationModule(root) {
  const REMOVED_PLAN_MARKER = "meal-removed";

  function normalizeComparable(value = "") {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("de")
      .replace(/\s+/g, " ");
  }

  function compactStockBadgeData(kind, names = "") {
    let cleanNames = String(names || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .join(", ");

    if (kind === "recipe") {
      return {
        visible: "Rezeptvorrat",
        accessible: "Aus Rezeptvorrat",
      };
    }
    if (!cleanNames) return null;

    return {
      visible: `Vorrat: ${cleanNames}`,
      accessible: `Aus Vorrat: ${cleanNames}`,
    };
  }

  function stockBadgeIconMarkup() {
    return '<svg class="stock-badge-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 9h14l-1 10H6L5 9Z"></path><path d="M7 9V6.5h10V9"></path></svg>';
  }

  function stripVisibleLockLabel(html) {
    return String(html || "").replace(
      /\s*<div class="tiny lock-label">\s*Fest eingeplant\s*<\/div>/,
      "",
    );
  }

  function simplifyMealTypeLabel(html) {
    return String(html || "").replace(
      /(<div class="small meal-type-text">)Mahlzeit\s*·\s*([^<]+)(<\/div>)/g,
      "$1$2$3",
    );
  }

  function planSlotKey(date, meal) {
    return `${date}|${meal}`;
  }

  function isRemovedPlanSlot(data, date, meal) {
    return data?.autoLockExcluded?.[planSlotKey(date, meal)] === REMOVED_PLAN_MARKER;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      REMOVED_PLAN_MARKER,
      compactStockBadgeData,
      stockBadgeIconMarkup,
      stripVisibleLockLabel,
      simplifyMealTypeLabel,
      isRemovedPlanSlot,
    };
  }

  if (typeof document === "undefined") return;
  if (root.__mealCardUnificationInstalled) return;
  if (
    typeof renderHomeCore !== "function" ||
    typeof renderPlanCore !== "function" ||
    typeof renderMeal !== "function" ||
    typeof renderMealCore !== "function" ||
    typeof stockBadges !== "function" ||
    typeof activeMeal !== "function"
  ) return;

  root.__mealCardUnificationInstalled = true;

  function installTodayPlanMealStyles() {
    if (document.querySelector('style[data-meal-card-unification="v3"]')) return;
    document.querySelector('style[data-meal-card-unification="v1"]')?.remove();
    document.querySelector('style[data-meal-card-unification="v2"]')?.remove();
    let style = document.createElement("style");
    style.dataset.mealCardUnification = "v3";
    style.textContent = `
#todayCard .mealbox {
  margin-top: var(--space-related);
  padding: var(--space-subcard);
  border: 1px solid var(--line);
  background: var(--surface-soft);
}
#todayCard .mealbox:first-of-type {
  border-top: 1px solid var(--line);
}
#todayCard .logMeal {
  min-height: 44px !important;
  padding: 9px 12px !important;
  margin-top: 8px;
  border-radius: 13px;
}
.stock-chip .stock-badge-icon,
.recipe-stock-chip .stock-badge-icon {
  flex: 0 0 auto;
  margin-right: 5px;
}
.mealbox > .actionbar:empty {
  display: none;
}
.mealbox > .actionbar.random-swap-actions {
  grid-template-columns: 1fr;
}
.mealbox > .actionbar.random-swap-actions .randomizeMeal {
  width: 100%;
}
.meal-plan-actions {
  margin-top: 8px;
}
.meal-plan-actions > summary {
  list-style: none;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: transparent;
  color: var(--muted);
  font-weight: 750;
  cursor: pointer;
}
.meal-plan-actions > summary::-webkit-details-marker {
  display: none;
}
.meal-plan-actions > summary::after {
  content: "⌄";
  font-size: 14px;
  line-height: 1;
  transition: transform .16s ease;
}
.meal-plan-actions[open] > summary {
  color: var(--ink);
  background: #fffdf8;
}
.meal-plan-actions[open] > summary::after {
  transform: rotate(180deg);
}
.meal-plan-actions-body {
  padding-top: 8px;
}
.meal-plan-secondary-actions {
  margin-top: 0;
}
.mealbox .meal-lock {
  width: 44px !important;
  height: 44px !important;
  min-width: 44px !important;
  min-height: 44px !important;
  padding: 10px !important;
  border-color: transparent !important;
  background: transparent !important;
  color: var(--muted) !important;
}
.mealbox .meal-lock.locked {
  color: var(--accent) !important;
}
.mealbox .meal-lock .lock-svg {
  width: 19px;
  height: 19px;
  opacity: .82;
}
.meal-delete-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 5px;
}
.meal-delete-link {
  border: 0;
  background: transparent;
  color: var(--muted);
  min-height: 36px;
  padding: 5px 2px;
  font-weight: 750;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.completed-body-direct {
  margin: 7px 0 0 39px;
  padding: 0;
  background: transparent;
}
.completed-body-direct .editCompletedLog {
  margin-top: 0 !important;
}
.log-outcome-item.single-food-outcome {
  grid-template-columns: minmax(0, 1fr);
}
.plan-secondary-actions-direct {
  margin-top: 10px;
}
.plan-secondary-actions-direct .btn {
  width: 100%;
}
`;
    document.head.appendChild(style);
  }

  installTodayPlanMealStyles();

  let originalActiveMeal = activeMeal;
  activeMeal = function removalAwareActiveMeal(meal, date) {
    if (isRemovedPlanSlot(state, date, meal)) return false;
    return originalActiveMeal(meal, date);
  };

  stockBadges = function compactStockBadges(meal) {
    if (meal?.recipeInventoryId) {
      let badge = compactStockBadgeData("recipe");
      return `<span class="pill recipe-stock-chip" aria-label="${esc(badge.accessible)}" title="${esc(badge.accessible)}">${stockBadgeIconMarkup()}<span class="stock-badge-label">${esc(badge.visible)}</span></span>`;
    }
    if (!meal?.inventoryFoodIds?.length) return "";

    let names = meal.inventoryFoodIds
      .map((id) => food(id)?.name)
      .filter(Boolean)
      .join(", ");
    let badge = compactStockBadgeData("food", names);
    if (!badge) return "";
    return `<span class="pill stock-chip" aria-label="${esc(badge.accessible)}" title="${esc(badge.accessible)}">${stockBadgeIconMarkup()}<span class="stock-badge-label">${esc(badge.visible)}</span></span>`;
  };

  function planIdForMeal(day, meal) {
    if (meal?.planId) return String(meal.planId);
    let key = planSlotKey(day?.date, meal?.meal);
    return String(state.planLocks?.[key]?.planId || state.manualMeals?.[key]?.planId || "");
  }

  function plannedMealDeleteHtml(day, meal) {
    if (!day?.date || !meal?.meal || !meal.active || meal.empty || !meal.focusId || meal.manualAdded)
      return "";
    let planId = planIdForMeal(day, meal);
    return `<div class="meal-delete-row"><button type="button" class="meal-delete-link removePlannedMeal" data-date="${esc(day.date)}" data-meal="${esc(meal.meal)}" data-plan-id="${esc(planId)}">Mahlzeit löschen</button></div>`;
  }

  function compactOpenMealActions(html, day, meal) {
    if (meal?.manualAdded) return html;
    let actionStart = html.indexOf('<div class="actionbar">');
    if (actionStart < 0) return html;
    let actionEnd = html.indexOf("</div>", actionStart);
    if (actionEnd < 0) return html;
    actionEnd += "</div>".length;

    let actionOpen = '<div class="actionbar">';
    let actionButtons = html.slice(actionStart + actionOpen.length, actionEnd - "</div>".length);
    let deleteHtml = plannedMealDeleteHtml(day, meal);
    let compactActions = `<details class="meal-plan-actions"><summary>Plan ändern</summary><div class="meal-plan-actions-body"><div class="meal-plan-secondary-actions"><div class="actionbar">${actionButtons}</div></div>${deleteHtml}</div></details>`;
    return `${html.slice(0, actionStart)}${compactActions}${html.slice(actionEnd)}`;
  }

  let originalRenderMealCore = renderMealCore;
  renderMealCore = function renderMealCoreWithSimplifiedActions(day, meal) {
    let html = simplifyMealTypeLabel(stripVisibleLockLabel(originalRenderMealCore(day, meal)));
    if (!html || !html.includes('class="btn full logMeal"')) return html;
    return compactOpenMealActions(html, day, meal);
  };

  function removeActualIngredientRepeat(card) {
    let title = card?.querySelector?.(".completed-title");
    let rows = card?.querySelectorAll?.(".log-outcome-grid .log-outcome-item") || [];
    if (!title || rows.length !== 1) return;
    let foodName = rows[0].querySelector("b");
    if (!foodName) return;
    let titleParts = String(title.textContent || "").split("·");
    let actualTitle = titleParts.length > 1 ? titleParts.slice(1).join("·").trim() : title.textContent;
    if (normalizeComparable(actualTitle) !== normalizeComparable(foodName.textContent)) return;
    foodName.remove();
    rows[0].classList.add("single-food-outcome");
  }

  function flattenCompletedDetails(container) {
    if (!container?.querySelectorAll) return;
    container.querySelectorAll(".mealbox.completed").forEach(removeActualIngredientRepeat);
    container.querySelectorAll("details.completed-details").forEach((details) => {
      let body = details.querySelector(".completed-body");
      if (!body) return;
      body.querySelectorAll(".small").forEach((line) => {
        if (/^\s*Tatsächlich enthalten\s*:/i.test(line.textContent || "")) line.remove();
      });
      let direct = document.createElement("div");
      direct.className = "completed-body completed-body-direct";
      while (body.firstChild) direct.appendChild(body.firstChild);
      details.replaceWith(direct);
    });
  }

  function flattenSinglePlanAction() {
    let details = document.querySelector("details.plan-secondary-actions");
    if (!details) return;
    let button = details.querySelector(":scope > #planRebuildAll");
    if (!button || details.querySelectorAll(":scope > button").length !== 1) return;
    let direct = document.createElement("div");
    direct.className = "plan-secondary-actions plan-secondary-actions-direct";
    direct.appendChild(button);
    details.replaceWith(direct);
  }

  function carriedPlansForSlot(date, meal) {
    let core = root.__plannerLogRolloverCore;
    if (!core?.ensurePlannerMeta) return [];
    return Object.values(core.ensurePlannerMeta(state).carriedPlans || {})
      .filter((plan) => plan?.date === date && plan?.meal === meal);
  }

  function deleteConcretePlan(date, meal, planId, manualAdded) {
    let key = planSlotKey(date, meal);
    let before = clone(state);
    state.planLocks ||= {};
    state.manualMeals ||= {};
    state.overrides ||= {};
    state.autoLockExcluded ||= {};

    if (manualAdded) {
      delete state.manualMeals[key];
      delete state.planLocks[key];
      delete state.overrides[key];
      delete state.autoLockExcluded[key];
    } else {
      let manual = state.manualMeals[key];
      let lock = state.planLocks[key];
      if (manual && (!planId || manual.planId === planId)) delete state.manualMeals[key];
      if (lock && (!planId || lock.planId === planId)) delete state.planLocks[key];

      let core = root.__plannerLogRolloverCore;
      if (core?.ensurePlannerMeta) {
        let meta = core.ensurePlannerMeta(state);
        if (planId && meta.carriedPlans?.[planId]) delete meta.carriedPlans[planId];
      }

      let remainingPrimary = !!state.manualMeals[key] || !!state.planLocks[key];
      let remainingCarried = carriedPlansForSlot(date, meal).length > 0;
      if (!remainingPrimary && !remainingCarried) {
        delete state.overrides[key];
        state.autoLockExcluded[key] = REMOVED_PLAN_MARKER;
      }
    }

    save();
    closeGeneric();
    renderAll();
    showToast(`${mealName(meal)} aus dem Plan gelöscht.`, () => {
      state = before;
      save();
      renderAll();
      showToast("Gelöschte Mahlzeit wiederhergestellt.");
    });
  }

  function requestMealDeletion(button) {
    if (!button) return;
    let date = button.dataset.date || "";
    let meal = button.dataset.meal || "";
    let planId = button.dataset.planId || "";
    let manualAdded = button.classList.contains("removeManualMeal");
    if (!date || !meal) return;
    openGeneric(
      `${mealName(meal)} löschen?`,
      `<p>Diese Mahlzeit wird nur aus dem Plan entfernt. Lebensmittel, Rezepte und bereits protokolliertes Essen bleiben erhalten.</p><div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelMealDelete" type="button">Abbrechen</button><button class="btn danger" id="confirmMealDelete" type="button">Mahlzeit löschen</button></div>`,
    );
    document.getElementById("cancelMealDelete").onclick = closeGeneric;
    document.getElementById("confirmMealDelete").onclick = () =>
      deleteConcretePlan(date, meal, planId, manualAdded);
  }

  function ensureActiveLockPayload(container) {
    if (!container?.querySelectorAll) return;
    container.querySelectorAll(".meal-lock").forEach((button) => {
      let payload = JSON.parse(decodeURIComponent(button.dataset.lockPayload || "%7B%7D"));
      button.dataset.lockPayload = encodeURIComponent(JSON.stringify({ ...payload, active: true }));
    });
  }

  function simplifyMealCards(container) {
    if (!container?.querySelectorAll) return;
    ensureActiveLockPayload(container);
    flattenCompletedDetails(container);
    container.querySelectorAll(".removeManualMeal").forEach((button) => {
      button.textContent = "Mahlzeit löschen";
      button.onclick = () => requestMealDeletion(button);
    });
    container.querySelectorAll(".removePlannedMeal").forEach((button) => {
      button.onclick = () => requestMealDeletion(button);
    });
  }

  function bindTodayMealActions(container) {
    if (!container?.querySelectorAll) return;
    container.querySelectorAll(".logMeal").forEach((button) => {
      button.onclick = () => openLog(JSON.parse(decodeURIComponent(button.dataset.plan)));
    });
    container.querySelectorAll(".replaceMeal").forEach((button) => {
      button.onclick = () => chooseReplacement(
        button.dataset.date,
        button.dataset.meal,
        button.dataset.focus,
      );
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
    simplifyMealCards(container);
    // .moveMeal bindet die bestehende Rollover-Review-Schicht anschließend.
  }

  let originalRenderPlanCore = renderPlanCore;
  renderPlanCore = function renderPlanCoreWithSimplifiedMealActions() {
    let result = originalRenderPlanCore();
    flattenSinglePlanAction();
    simplifyMealCards(document.getElementById("blockPlan"));
    return result;
  };

  function renderUnifiedTodayCard() {
    let card = document.getElementById("todayCard");
    if (!card) return;

    let on = today();
    let age = monthsOld(on);
    let day = buildDays(on, 1)[0];
    let active = day.meals.filter((meal) => meal.active && meal.focusId);
    let openMeals = active.filter((meal) => !mealIsCompleted(on, meal.meal));
    let nextPlanned = null;

    if (!active.length) {
      for (let offset = 1; offset <= 45; offset++) {
        let candidateDate = addDays(on, offset);
        let candidateDay = buildDays(candidateDate, 1, false)[0];
        if (candidateDay.meals.some((meal) => meal.active && meal.focusId)) {
          nextPlanned = candidateDate;
          break;
        }
      }
    }

    let todayHtml = active.length
      ? active.map((meal) => renderMeal(day, meal)).join("")
      : `<div class="empty"><b>Für heute ist nichts geplant.</b><div class="small">Die Heute-Ansicht zeigt ausschließlich den aktuellen Kalendertag.</div>${nextPlanned ? `<div class="small next-plan-hint">Nächster geplanter Tag: ${nice(nextPlanned, true)}</div>` : ""}</div><button class="btn full" id="homeFreeLog">Essen eintragen</button>`;
    let todayHeading = active.length && openMeals.length === 0
      ? "Heute erledigt"
      : "Heute anbieten";
    let todayBadge = active.length && openMeals.length === 0
      ? '<span class="pill ok">Vollständig</span>'
      : "";
    let progressStatus =
      active.length && openMeals.length < active.length && openMeals.length > 0
        ? `<div class="status-chips"><span class="pill ok">${active.length - openMeals.length} erledigt</span></div>`
        : "";

    card.innerHTML = `<div class="row"><div class="grow"><h2>${todayHeading}</h2><div class="small">${nice(on, true)} · ${age} Monate</div></div>${todayBadge}</div>${progressStatus}${todayHtml}<div class="add-meal-row"><button class="btn secondary smallbtn" id="homeAddEntry">＋ Essen eintragen</button></div>`;

    bindTodayMealActions(card);
    if (typeof bindInactiveMealActions === "function") bindInactiveMealActions();
    let freeLog = document.getElementById("homeFreeLog");
    if (freeLog) freeLog.onclick = () => openLog(null);
  }

  flattenSinglePlanAction();

  let originalRenderHomeCore = renderHomeCore;
  renderHomeCore = function renderHomeCoreWithUnifiedMealCards() {
    let result = originalRenderHomeCore();
    renderUnifiedTodayCard();
    return result;
  };

  root.__mealCardUnification = {
    REMOVED_PLAN_MARKER,
    compactStockBadgeData,
    stockBadgeIconMarkup,
    stripVisibleLockLabel,
    simplifyMealTypeLabel,
    isRemovedPlanSlot,
    flattenCompletedDetails,
    flattenSinglePlanAction,
    simplifyMealCards,
    renderUnifiedTodayCard,
  };
})(typeof window !== "undefined" ? window : globalThis);
