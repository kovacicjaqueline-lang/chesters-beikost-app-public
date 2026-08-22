"use strict";

/* Einheitliche Mahlzeitenkarten für „Heute“ und Wochenplan.
 *
 * Die Planner-/Persistenzlogik und die Wochen-Tageskarten bleiben unverändert.
 * „Heute“ verwendet denselben renderMeal-Pfad wie der Wochenplan. Zusätzlich
 * wird nur die bereits vorhandene Vorratsanzeige verdichtet und das redundante
 * sichtbare Auto-Lock-Label entfernt.
 */
(function mealCardUnificationModule(root) {
  function normalizeComparable(value = "") {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("de")
      .replace(/\s+/g, " ");
  }

  function compactStockBadgeData(kind, names = "", mealTitle = "") {
    let cleanNames = String(names || "").trim();
    if (kind === "recipe") {
      return {
        visible: "❄️ Rezeptvorrat",
        accessible: "Aus Rezeptvorrat",
      };
    }

    let listed = cleanNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    let titleMatchesSingleStock =
      listed.length === 1 &&
      normalizeComparable(mealTitle) === normalizeComparable(listed[0]);

    return {
      visible: `❄️ ${titleMatchesSingleStock ? "Vorrat" : cleanNames || "Vorrat"}`,
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
    module.exports = { compactStockBadgeData, stripVisibleLockLabel };
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

  function installTodayPlanMealStyles() {
    if (document.querySelector('style[data-meal-card-unification="v1"]')) return;
    let style = document.createElement("style");
    style.dataset.mealCardUnification = "v1";
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
`;
    document.head.appendChild(style);
  }

  installTodayPlanMealStyles();

  stockBadges = function compactStockBadges(meal) {
    if (meal?.recipeInventoryId) {
      let badge = compactStockBadgeData("recipe");
      return `<span class="pill recipe-stock-chip" aria-label="${esc(badge.accessible)}" title="${esc(badge.accessible)}">${esc(badge.visible)}</span>`;
    }
    if (!meal?.inventoryFoodIds?.length) return "";

    let names = meal.inventoryFoodIds
      .map((id) => food(id)?.name)
      .filter(Boolean)
      .join(", ");
    let title = typeof mealDisplayTitle === "function" ? mealDisplayTitle(meal) : "";
    let badge = compactStockBadgeData("food", names, title);
    return `<span class="pill stock-chip" aria-label="${esc(badge.accessible)}" title="${esc(badge.accessible)}">${esc(badge.visible)}</span>`;
  };

  let originalRenderMealCore = renderMealCore;
  renderMealCore = function renderMealCoreWithoutRedundantAutoLock(day, meal) {
    return stripVisibleLockLabel(originalRenderMealCore(day, meal));
  };

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
    container.querySelectorAll(".removeManualMeal").forEach((button) => {
      button.onclick = () => removeManualMeal(button.dataset.date, button.dataset.meal);
    });
    // .moveMeal bindet die bestehende Rollover-Review-Schicht anschließend.
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

    bindTodayMealActions(card);
    if (typeof bindInactiveMealActions === "function") bindInactiveMealActions();
    let freeLog = document.getElementById("homeFreeLog");
    if (freeLog) freeLog.onclick = () => openLog(null);
  }

  let originalRenderHomeCore = renderHomeCore;
  renderHomeCore = function renderHomeCoreWithUnifiedMealCards() {
    let result = originalRenderHomeCore();
    renderUnifiedTodayCard();
    return result;
  };

  root.__mealCardUnification = {
    compactStockBadgeData,
    stripVisibleLockLabel,
    bindTodayMealActions,
    renderUnifiedTodayCard,
  };
})(typeof window !== "undefined" ? window : globalThis);
