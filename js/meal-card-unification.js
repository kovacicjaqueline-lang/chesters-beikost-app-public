"use strict";

/* Einheitliche Mahlzeiten- und Tageskarten für „Heute“ und Wochenplan.
 *
 * Die bestehende Planner-/Persistenzlogik bleibt unverändert. „Heute“ verwendet
 * denselben renderMeal-Pfad wie der Wochenplan. Die Wochenansicht verdichtet nur
 * die Darstellung: heutiger Tag offen, zukünftige normale Tage aufklappbar,
 * vollständig erledigte Tage weiter über das vorhandene Completed-Day-Muster.
 */
(function mealCardUnificationModule(root) {
  const expandedPlanDays = new Set();
  const MEAL_SLOT_LABELS = new Set([
    "frühstück",
    "mittag",
    "mittagessen",
    "snack",
    "abendessen",
  ]);

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

  function mealSlotFromMeta(text = "") {
    let parts = String(text || "")
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean);
    let slot = parts.find((part) => MEAL_SLOT_LABELS.has(normalizeComparable(part)));
    return slot || parts.at(-1) || "Mahlzeit";
  }

  function compactKnownMealMeta(mealNode) {
    let typeNode = mealNode?.querySelector?.(".meal-type-text");
    if (!typeNode) return;
    let typeText = String(typeNode.textContent || "").trim();
    if (!/^Mahlzeit\s*·/i.test(typeText)) return;

    let slot = mealSlotFromMeta(typeText);
    let statusNode = mealNode.querySelector(".meal-status-text");
    let statusText = String(statusNode?.textContent || "").trim();
    typeNode.textContent = statusText ? `${slot} · ${statusText}` : slot;
    statusNode?.remove();
  }

  function manualMealRecord(mealNode) {
    if (!mealNode?.classList?.contains("manual-meal")) return null;
    let lock = mealNode.querySelector(".meal-lock[data-lock-date][data-lock-meal]");
    if (!lock) return null;
    let key = typeof planLockKey === "function"
      ? planLockKey(lock.dataset.lockDate, lock.dataset.lockMeal)
      : `${lock.dataset.lockDate}|${lock.dataset.lockMeal}`;
    return state?.planLocks?.[key] || state?.manualMeals?.[key] || null;
  }

  function ensureManualProtectionLabel(mealNode) {
    if (!mealNode?.classList?.contains("manual-meal")) return;
    let lock = mealNode.querySelector('.meal-lock.locked[title="Manuell geschützt"]');
    let main = mealNode.querySelector("summary .grow");
    if (!lock || !main || main.querySelector(".manual-protection-label")) return;
    let label = document.createElement("div");
    label.className = "tiny manual-protection-label";
    label.textContent = "Manuell geschützt";
    main.appendChild(label);
  }

  function ensureManualStockBadge(mealNode) {
    if (!mealNode?.classList?.contains("manual-meal")) return;
    let main = mealNode.querySelector("summary .grow");
    if (!main || main.querySelector(".meal-stock-row")) return;
    let record = manualMealRecord(mealNode);
    if (!record) return;
    let badgeHtml = stockBadges(record);
    if (!badgeHtml) return;
    let row = document.createElement("div");
    row.className = "meal-stock-row";
    row.innerHTML = badgeHtml;
    main.appendChild(row);
  }

  function decorateMealCards(container) {
    if (!container?.querySelectorAll) return;
    for (let mealNode of container.querySelectorAll(".mealbox, .manual-meal")) {
      compactKnownMealMeta(mealNode);
      ensureManualProtectionLabel(mealNode);
      ensureManualStockBadge(mealNode);
      if (
        mealNode.classList.contains("manual-meal") &&
        mealNode.querySelector(".inactive-plan-warning")
      ) mealNode.open = true;
    }
  }

  function dayMealSummaryData(mealNode) {
    let completed = mealNode.classList.contains("completed");
    let titleNode = mealNode.querySelector(
      ".dish-title, .manual-meal-title, .completed-title",
    );
    let title = String(titleNode?.textContent || "Mahlzeit").trim();
    let meta = String(mealNode.querySelector(".meal-type-text")?.textContent || "").trim();
    let slot = mealSlotFromMeta(meta);

    if (completed && !meta && title.includes("·")) {
      let parts = title.split("·").map((part) => part.trim()).filter(Boolean);
      if (parts.length > 1) {
        slot = parts.shift();
        title = parts.join(" · ");
      }
    }

    let status = String(mealNode.querySelector(".meal-status-text")?.textContent || "").trim();
    if (status === "Bekannt kombinieren") status = "";
    let followUp = String(mealNode.querySelector(".followup-plan-note")?.textContent || "").trim();

    let lock = mealNode.querySelector(".meal-lock.locked");
    let manualProtected = lock?.getAttribute("title") === "Manuell geschützt";
    let stock = mealNode.querySelector(".stock-chip, .recipe-stock-chip");
    let stockLabel = stock?.getAttribute("aria-label") || stock?.textContent?.trim() || "";
    let warning = !!mealNode.querySelector(".inactive-plan-warning");

    return {
      completed,
      title,
      slot,
      status,
      followUp,
      locked: !!lock,
      manualProtected,
      stockLabel,
      warning,
    };
  }

  function dayMealSummaryHtml(mealNode) {
    let data = dayMealSummaryData(mealNode);
    let state = [];
    if (data.completed)
      state.push('<span class="day-summary-complete" aria-label="Erledigt">✓</span>');
    if (data.stockLabel)
      state.push(`<span class="day-summary-stock" aria-label="${esc(data.stockLabel)}" title="${esc(data.stockLabel)}">❄️</span>`);
    if (data.locked)
      state.push(`<span class="day-summary-lock" aria-label="${data.manualProtected ? "Manuell geschützt" : "Fest eingeplant"}">${mealLockIcon(true)}</span>`);
    if (data.warning)
      state.push('<span class="day-summary-warning" aria-label="Hinweis vorhanden">!</span>');

    return `<div class="day-summary-meal ${data.completed ? "is-completed" : ""}">
      <span class="day-summary-slot">${esc(data.slot)}</span>
      <span class="day-summary-title"><b>${esc(data.title)}</b>${data.status ? `<small>${esc(data.status)}</small>` : ""}${data.followUp ? `<small class="day-summary-followup">${esc(data.followUp)}</small>` : ""}${data.manualProtected ? '<small class="day-summary-manual">Manuell geschützt</small>' : ""}</span>
      <span class="day-summary-state">${state.join("")}</span>
    </div>`;
  }

  function rememberDayToggle(details) {
    if (!details || details.dataset.dayToggleBound === "true") return;
    details.dataset.dayToggleBound = "true";
    details.addEventListener("toggle", () => {
      let date = details.dataset.dayDate || "";
      if (!date || date === today()) return;
      if (details.open) expandedPlanDays.add(date);
      else expandedPlanDays.delete(date);
    });
  }

  function transformNormalDayCard(dayNode, date) {
    let dayHead = [...dayNode.children].find((child) => child.classList?.contains("day-head"));
    let dateText = String(dayHead?.querySelector(".day-date")?.textContent || nice(date, true)).trim();
    let dayType = String(dayHead?.querySelector(".day-type-text")?.textContent || "").trim();
    let specialDayType = dayType && dayType !== "Bekannter Tag" ? dayType : "";
    let progressBadge = dayHead?.querySelector(".pill")?.outerHTML || "";
    let mealNodes = [...dayNode.children].filter(
      (child) => child.classList?.contains("mealbox") || child.classList?.contains("manual-meal"),
    );
    let hasWarning = mealNodes.some((meal) => !!meal.querySelector(".inactive-plan-warning"));
    let details = document.createElement("details");
    details.className = `${dayNode.className} day-details`;
    details.dataset.dayDate = date;

    let summary = document.createElement("summary");
    summary.className = "day-details-summary";
    summary.innerHTML = `<span class="day-details-copy">
      <span class="day-details-heading"><span class="day-date">${esc(dateText)}</span>${progressBadge}</span>
      ${specialDayType ? `<span class="small day-type-text">${esc(specialDayType)}</span>` : ""}
      <span class="day-summary-meals">${mealNodes.map(dayMealSummaryHtml).join("")}</span>
    </span><span class="day-details-chevron" aria-hidden="true">⌄</span>`;

    let body = document.createElement("div");
    body.className = "day-details-body";
    for (let child of [...dayNode.children]) {
      if (child === dayHead) continue;
      body.appendChild(child);
    }

    details.append(summary, body);
    let pastNeedsAttention = date < today() && mealNodes.some(
      (meal) => !meal.classList.contains("completed"),
    );
    details.open =
      date === today() ||
      expandedPlanDays.has(date) ||
      hasWarning ||
      pastNeedsAttention;
    rememberDayToggle(details);
    dayNode.replaceWith(details);
  }

  function decorateCompletedDay(dayNode, date) {
    dayNode.dataset.dayDate = date;
    dayNode.classList.add("day-details-completed");
    if (date === today() || expandedPlanDays.has(date)) dayNode.open = true;
    rememberDayToggle(dayNode);
  }

  function decoratePlanDays() {
    let container = document.getElementById("blockPlan");
    if (!container) return;
    decorateMealCards(container);

    let from = visiblePlanStart();
    let days = [...container.children];
    days.forEach((dayNode, index) => {
      let date = addDays(from, index);
      if (dayNode.classList.contains("completed-day")) {
        decorateCompletedDay(dayNode, date);
        return;
      }
      if (dayNode.classList.contains("day-card") && dayNode.tagName !== "DETAILS")
        transformNormalDayCard(dayNode, date);
    });
  }

  function installPresentationStyles() {
    if (document.getElementById("meal-card-unification-style")) return;
    let style = document.createElement("style");
    style.id = "meal-card-unification-style";
    style.textContent = `
      .meal-lock{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;padding:11px!important;border-color:transparent!important;background:rgba(232,231,216,.58)!important}
      .meal-lock.unlocked{background:rgba(255,253,248,.82)!important;color:var(--ochre)!important}
      .meal-lock .lock-svg{width:20px!important;height:20px!important}
      .meal-lock:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      .manual-protection-label{margin-top:4px;color:var(--accent);font-weight:750}

      .day-details.day-card{padding:0!important;overflow:hidden}
      .day-details.day-card>summary{list-style:none;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:start;padding:11px 12px;cursor:pointer}
      .day-details.day-card>summary::-webkit-details-marker{display:none}
      .day-details-copy{min-width:0;display:block}
      .day-details-heading{display:flex;align-items:center;gap:8px;justify-content:space-between;min-width:0}
      .day-details-heading .day-date{margin:0;min-width:0}
      .day-details-heading .pill{flex:0 0 auto}
      .day-details .day-type-text{display:block;margin-top:2px;color:var(--terracotta);font-weight:750}
      .day-details-chevron{font-size:18px;line-height:1;color:var(--muted);margin-top:3px;transition:transform .18s ease}
      .day-details[open]>.day-details-summary .day-details-chevron{transform:rotate(180deg)}
      .day-details-body{padding:0 10px 10px;border-top:1px solid var(--line)}
      .day-details-body>.mealbox:first-child{margin-top:9px}
      .day-summary-meals{display:grid;margin-top:5px}
      .day-summary-meal{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;align-items:center;min-width:0;padding:5px 0;border-top:1px solid rgba(216,204,188,.72)}
      .day-summary-meal:first-child{border-top:0}
      .day-summary-slot{font-size:11px;color:var(--muted);font-weight:750;white-space:nowrap}
      .day-summary-title{min-width:0;display:block;font-size:12.5px;line-height:1.25;overflow-wrap:break-word;word-break:normal}
      .day-summary-title b{font-weight:760}
      .day-summary-title small{display:block;margin-top:1px;font-size:10.5px;color:var(--terracotta);font-weight:700}
      .day-summary-title .day-summary-manual{color:var(--accent)}
      .day-summary-title .day-summary-followup{color:var(--ochre)}
      .day-summary-state{display:flex;align-items:center;justify-content:flex-end;gap:4px;min-width:18px}
      .day-summary-lock{display:grid;place-items:center;color:var(--accent)}
      .day-summary-lock .lock-svg{width:15px;height:15px}
      .day-summary-stock{font-size:13px;line-height:1}
      .day-summary-complete{width:17px;height:17px;border-radius:50%;display:grid;place-items:center;background:var(--okbg);color:var(--ok);font-size:11px;font-weight:900}
      .day-summary-warning{width:17px;height:17px;border-radius:50%;display:grid;place-items:center;background:var(--terrabg);color:var(--terracotta);font-size:11px;font-weight:900}
      .day-summary-meal.is-completed .day-summary-title{color:var(--muted)}
      .day-details[open] .day-summary-meals{display:none}
      .day-details[open]>.day-details-summary .day-type-text{margin-bottom:2px}

      @media(max-width:359px){
        .day-details.day-card>summary{padding:10px}
        .day-summary-meal{grid-template-columns:1fr auto;gap:4px 7px}
        .day-summary-slot{grid-column:1/-1}
      }
    `;
    document.head.appendChild(style);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      compactStockBadgeData,
      stripVisibleLockLabel,
      mealSlotFromMeta,
    };
  }

  if (typeof document === "undefined") return;
  if (root.__mealCardUnificationInstalled) return;
  if (
    typeof renderHomeCore !== "function" ||
    typeof renderPlanCore !== "function" ||
    typeof renderMeal !== "function" ||
    typeof renderMealCore !== "function" ||
    typeof stockBadges !== "function"
  ) return;

  root.__mealCardUnificationInstalled = true;
  installPresentationStyles();

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
    // .moveMeal bleibt bewusst der nachfolgenden Rollover-Review-Schicht überlassen.
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

    decorateMealCards(card);
    bindTodayMealActions(card);
    if (typeof bindInactiveMealActions === "function") bindInactiveMealActions();
    let freeLog = document.getElementById("homeFreeLog");
    if (freeLog) freeLog.onclick = () => openLog(null);
  }

  let originalRenderHomeCore = renderHomeCore;
  renderHomeCore = function renderHomeCoreWithUnifiedMealCards() {
    originalRenderHomeCore();
    renderUnifiedTodayCard();
  };

  let originalRenderPlanCore = renderPlanCore;
  renderPlanCore = function renderPlanCoreWithCompactDayCards() {
    let result = originalRenderPlanCore();
    decoratePlanDays();
    return result;
  };

  root.__mealCardUnification = {
    compactStockBadgeData,
    bindTodayMealActions,
    decorateMealCards,
    decoratePlanDays,
    renderUnifiedTodayCard,
  };
})(typeof window !== "undefined" ? window : globalThis);
