"use strict";

/* Einheitliche Mahlzeitenkarten für „Heute“ und Wochenplan.
 *
 * Beide Ansichten verwenden denselben bestehenden renderMeal-Pfad. Dadurch bleiben
 * Umrandung, Farben, Schloss, Bearbeiten/Verschieben und Protokollieren deckungsgleich,
 * ohne Planner- oder Persistenzlogik zu duplizieren.
 */
(function mealCardUnificationModule(root) {
  function compactStockBadgeData(kind, names = "") {
    let cleanNames = String(names || "").trim();
    if (kind === "recipe") {
      return {
        visible: "❄️ Rezeptvorrat",
        accessible: "Aus Rezeptvorrat",
      };
    }
    return {
      visible: `❄️ ${cleanNames || "Vorrat"}`,
      accessible: `Aus Vorrat${cleanNames ? `: ${cleanNames}` : ""}`,
    };
  }

  function stripVisibleLockLabel(html) {
    return String(html || "").replace(
      /\s*<div class="tiny lock-label">\s*Fest eingeplant\s*<\/div>/,
      "",
    );
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      compactStockBadgeData,
      stripVisibleLockLabel,
    };
  }

  if (typeof document === "undefined") return;
  if (root.__mealCardUnificationInstalled) return;
  if (
    typeof renderHomeCore !== "function" ||
    typeof renderMeal !== "function" ||
    typeof renderMealCore !== "function" ||
    typeof stockBadges !== "function"
  ) return;

  root.__mealCardUnificationInstalled = true;

  stockBadges = function compactStockBadges(meal) {
    if (meal?.recipeInventoryId) {
      let badge = compactStockBadgeData("recipe");
      return `<span class="pill recipe-stock-chip" aria-label="${esc(badge.accessible)}" title="${esc(badge.accessible)}">${badge.visible}</span>`;
    }
    if (!meal?.inventoryFoodIds?.length) return "";

    let names = meal.inventoryFoodIds
      .map((id) => food(id)?.name)
      .filter(Boolean)
      .join(", ");
    let badge = compactStockBadgeData("food", names);
    return `<span class="pill stock-chip" aria-label="${esc(badge.accessible)}" title="${esc(badge.accessible)}">${esc(badge.visible)}</span>`;
  };

  let originalRenderMealCore = renderMealCore;
  renderMealCore = function renderMealCoreWithoutVisibleLockInfo(day, meal) {
    return stripVisibleLockLabel(originalRenderMealCore(day, meal));
  };

  function bindMealActions(container) {
    if (!container?.querySelectorAll) return;

    container.querySelectorAll(".logMeal").forEach((button) => {
      button.onclick = () =>
        openLog(JSON.parse(decodeURIComponent(button.dataset.plan)));
    });
    container.querySelectorAll(".replaceMeal").forEach((button) => {
      button.onclick = () =>
        chooseReplacement(
          button.dataset.date,
          button.dataset.meal,
          button.dataset.focus,
        );
    });
    container.querySelectorAll(".moveMeal").forEach((button) => {
      button.onclick = () =>
        moveMealTomorrow(
          JSON.parse(decodeURIComponent(button.dataset.movePayload)),
        );
    });
    container.querySelectorAll(".editCompletedLog").forEach((button) => {
      button.onclick = () => editLogEntry(button.dataset.log);
    });
    container.querySelectorAll(".meal-lock").forEach((button) => {
      button.onclick = () =>
        toggleMealLock(
          button.dataset.lockDate,
          button.dataset.lockMeal,
          JSON.parse(decodeURIComponent(button.dataset.lockPayload)),
        );
    });
    container.querySelectorAll(".removeManualMeal").forEach((button) => {
      button.onclick = () =>
        removeManualMeal(button.dataset.date, button.dataset.meal);
    });

    if (typeof bindInactiveMealActions === "function") bindInactiveMealActions();
  }

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

    bindMealActions(card);
    let freeLog = document.getElementById("homeFreeLog");
    if (freeLog) freeLog.onclick = () => openLog(null);
  }

  let originalRenderHomeCore = renderHomeCore;
  renderHomeCore = function renderHomeCoreWithUnifiedMealCards() {
    originalRenderHomeCore();
    renderUnifiedTodayCard();
  };

  root.__mealCardUnification = {
    bindMealActions,
    renderUnifiedTodayCard,
  };

  // Die Runtime wird dynamisch aus planned-recipe-details.js geladen. Nach dem
  // initialen App-Start werden beide betroffenen Ansichten einmal neu gerendert,
  // damit auch bereits erzeugtes DOM sofort die gemeinsame Darstellung verwendet.
  let refreshMealViews = () => {
    if (typeof renderHome === "function" && document.getElementById("todayCard"))
      renderHome();
    if (typeof renderPlan === "function" && document.getElementById("blockPlan"))
      renderPlan();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", refreshMealViews, { once: true });
  else
    queueMicrotask(refreshMealViews);
})(typeof window !== "undefined" ? window : globalThis);
