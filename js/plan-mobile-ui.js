"use strict";

/*
 * Mobile-First Plan
 *
 * Die bestehende Planner-/Meal-Logik bleibt im Core. Diese Schicht verdichtet nur
 * die Wochenorientierung: sieben kompakte Tage oben, genau ein Plantag im Detail.
 */
(function installMobilePlanUi() {
  if (typeof document === "undefined" || globalThis.__mobilePlanUiInstalled) return;
  if (typeof renderPlanCore !== "function" || typeof planDisplayDays !== "function") return;

  globalThis.__mobilePlanUiInstalled = true;

  const currentScript = document.currentScript?.src || "";
  const version = currentScript ? new URL(currentScript, document.baseURI).search : "";
  const styleHref = new URL(`../plan-mobile-ui.css${version}`, currentScript || document.baseURI).toString();
  if (!document.querySelector('link[data-plan-mobile-ui="true"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = styleHref;
    link.dataset.planMobileUi = "true";
    document.head.appendChild(link);
  }

  /* MOBILE-PLAN-HELPERS START */
  function mobilePlanDayStatus(
    day,
    planLocks = {},
    isCompleted = () => false,
    isAllergenFood = () => false,
    prepDates = new Set(),
  ) {
    const planned = (day?.meals || []).filter((meal) => meal?.active);
    const open = planned.filter((meal) => !isCompleted(day.date, meal.meal));
    const allFoodIds = open.flatMap((meal) => meal.foodIds || []);
    const hasAllergenType = open.some((meal) => /allergen/i.test(String(meal.type || "")));
    return {
      newFood: open.some((meal) => ["neu", "Allergen einführen"].includes(meal.type)),
      allergen: hasAllergenType || allFoodIds.some((id) => isAllergenFood(id)),
      prep: prepDates.has(day?.date),
      incomplete: open.some((meal) => meal?.empty || !meal?.focusId),
      locked: open.some((meal) => planLocks[`${day.date}|${meal.meal}`]?.mode === "manual"),
      done: planned.length > 0 && open.length === 0 && planned.every((meal) => !meal?.empty && !!meal?.focusId),
      plannedCount: planned.length,
      completedCount: planned.filter((meal) => !meal?.empty && !!meal?.focusId && isCompleted(day.date, meal.meal)).length,
    };
  }

  function mobilePlanSelectedDate(days = [], requested = "", current = "") {
    const dates = days.map((day) => day?.date).filter(Boolean);
    if (requested && dates.includes(requested)) return requested;
    if (current && dates.includes(current)) return current;
    return dates[0] || "";
  }

  function mobilePlanStatusLabels(status = {}) {
    const labels = [];
    if (status.newFood) labels.push("Neu");
    if (status.allergen) labels.push("Allergen");
    if (status.prep) labels.push("Prep");
    if (status.incomplete) labels.push("Unvollständig");
    if (status.locked) labels.push("Geschützt");
    if (status.done) labels.push("Erledigt");
    return labels;
  }

  function mobilePlanCompletionTitle(currentTitle = "", status = {}) {
    const title = String(currentTitle || "");
    const base = title.replace(/\s+(?:teilweise\s+)?erledigt\s*$/i, "").trim();
    if (!base) return title;
    if (status.done) return `${base} erledigt`;
    if (status.completedCount > 0 && status.incomplete) return `${base} teilweise erledigt`;
    return title;
  }
  /* MOBILE-PLAN-HELPERS END */

  function parsePlanDate(date) {
    return new Date(`${date}T12:00:00`);
  }

  function compactWeekRange(from) {
    const to = addDays(from, 6);
    const start = parsePlanDate(from);
    const end = parsePlanDate(to);
    const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
    const sameYear = start.getFullYear() === end.getFullYear();
    const day = new Intl.DateTimeFormat("de-AT", { day: "numeric" });
    const month = new Intl.DateTimeFormat("de-AT", { month: "long" });
    const shortMonth = new Intl.DateTimeFormat("de-AT", { month: "short" });

    if (sameMonth) return `${day.format(start)}.–${day.format(end)}. ${month.format(end)}`;
    if (sameYear) return `${day.format(start)}. ${shortMonth.format(start)} – ${day.format(end)}. ${shortMonth.format(end)}`;
    return `${day.format(start)}. ${shortMonth.format(start)} ${start.getFullYear()} – ${day.format(end)}. ${shortMonth.format(end)} ${end.getFullYear()}`;
  }

  function shortWeekday(date) {
    return new Intl.DateTimeFormat("de-AT", { weekday: "short" })
      .format(parsePlanDate(date))
      .replace(".", "");
  }

  function dayNumber(date) {
    return new Intl.DateTimeFormat("de-AT", { day: "numeric" }).format(parsePlanDate(date));
  }

  function prepRequiredDates() {
    const dates = new Set();
    if (typeof prepDemand !== "function" || typeof prepAdvice !== "function") return dates;
    try {
      for (const demand of prepDemand()) {
        const item = food(demand.foodId);
        const advice = item ? prepAdvice(item, demand) : null;
        if (!advice || advice.covered || advice.mode === "Frisch") continue;
        if (Number(demand.missingGrams) <= 0 && Number(demand.missing) <= 0) continue;
        if (demand.firstDate) dates.add(demand.firstDate);
      }
    } catch (error) {
      console.warn("Plan-Wochenstatus konnte Prep-Hinweise nicht bestimmen.", error);
    }
    return dates;
  }

  function ensureSecondaryActions(toolbar) {
    let secondary = toolbar?.querySelector(".plan-secondary-actions");
    const controls = document.getElementById("planFrom")?.closest(".plan-controls") || toolbar?.querySelector(".plan-controls");
    if (!secondary || !controls) return;

    if (secondary.tagName === "DETAILS") {
      const replacement = document.createElement("div");
      replacement.className = secondary.className;
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "btn ghost plan-secondary-toggle";
      toggle.textContent = "Weitere Planaktionen";
      toggle.setAttribute("aria-expanded", "false");
      const rebuild = secondary.querySelector("#planRebuildAll");
      replacement.appendChild(toggle);
      replacement.appendChild(controls);
      if (rebuild) replacement.appendChild(rebuild);
      secondary.replaceWith(replacement);
      secondary = replacement;
    }

    const toggle = secondary.querySelector(".plan-secondary-toggle");
    const rebuild = secondary.querySelector("#planRebuildAll");
    if (controls.parentElement !== secondary) {
      if (rebuild) secondary.insertBefore(controls, rebuild);
      else secondary.appendChild(controls);
    }

    const setExpanded = (expanded) => {
      secondary.toggleAttribute("open", expanded);
      if (toggle) toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      controls.hidden = !expanded;
      if (rebuild) rebuild.hidden = !expanded;
    };

    if (toggle && toggle.dataset.mobilePlanSecondaryBound !== "true") {
      toggle.onclick = () => setExpanded(!secondary.hasAttribute("open"));
      toggle.dataset.mobilePlanSecondaryBound = "true";
    }
    setExpanded(secondary.hasAttribute("open"));
  }

  function ensureTodaySelection(toolbar) {
    const button = toolbar?.querySelector("#planToday");
    if (!button || button.dataset.mobilePlanTodayBound === "true") return;
    button.addEventListener("click", () => {
      globalThis.__mobilePlanSelectedDate = today();
    }, { capture: true });
    button.dataset.mobilePlanTodayBound = "true";
  }

  function ensureWeekNavigation(toolbar, from, selectedDate) {
    if (!toolbar) return;
    const heading = toolbar.querySelector(".plan-heading");
    const title = heading?.querySelector("h2");
    if (title) title.textContent = compactWeekRange(from);

    let nav = toolbar.querySelector(".plan-week-nav");
    if (!nav) {
      nav = document.createElement("div");
      nav.className = "plan-week-nav";
      nav.setAttribute("aria-label", "Woche wechseln");
      nav.innerHTML = `
        <button class="iconbtn plan-week-step" type="button" data-week-step="-7" aria-label="Vorherige Woche">‹</button>
        <div class="plan-week-nav-copy"><b>Woche</b><span>7 Tage</span></div>
        <button class="iconbtn plan-week-step" type="button" data-week-step="7" aria-label="Nächste Woche">›</button>
      `;
      heading?.insertAdjacentElement("afterend", nav);
    }

    nav.querySelectorAll(".plan-week-step").forEach((button) => {
      button.onclick = () => {
        const delta = Number(button.dataset.weekStep) || 0;
        const days = planDisplayDays(from, 7);
        const selectedIndex = Math.max(0, days.findIndex((day) => day.date === selectedDate));
        const nextFrom = addDays(from, delta);
        globalThis.__mobilePlanSelectedDate = addDays(nextFrom, selectedIndex);
        state.settings.planFrom = nextFrom;
        save();
        renderPlan();
      };
    });
  }

  function statusDotHtml(key, label) {
    return `<span class="plan-week-status-dot status-${key}" aria-hidden="true"></span><span class="plan-week-status-sr">${esc(label)}</span>`;
  }

  function statusMarkersHtml(status) {
    const markers = [];
    if (status.newFood) markers.push(statusDotHtml("new", "Neues Lebensmittel"));
    if (status.allergen) markers.push(statusDotHtml("allergen", "Allergen"));
    if (status.prep) markers.push(statusDotHtml("prep", "Prep notwendig"));
    if (status.incomplete) markers.push(statusDotHtml("incomplete", "Tag unvollständig"));
    if (status.locked) markers.push(statusDotHtml("locked", "Geschützte Mahlzeit"));
    if (status.done) markers.push(statusDotHtml("done", "Tag erledigt"));
    return markers.join("");
  }

  function legendHtml(statuses) {
    const keys = [
      ["newFood", "new", "Neu"],
      ["allergen", "allergen", "Allergen"],
      ["prep", "prep", "Prep"],
      ["incomplete", "incomplete", "Offen"],
      ["locked", "locked", "Geschützt"],
      ["done", "done", "Erledigt"],
    ];
    return keys
      .filter(([prop]) => statuses.some((status) => status[prop]))
      .map(([, key, label]) => `<span><i class="plan-week-status-dot status-${key}" aria-hidden="true"></i>${label}</span>`)
      .join("");
  }

  function ensureWeekOverview(toolbar, block, days, selectedDate, statuses) {
    let overview = document.getElementById("planWeekOverview");
    if (!overview) {
      overview = document.createElement("section");
      overview.id = "planWeekOverview";
      overview.className = "plan-week-overview";
      overview.setAttribute("aria-label", "Tage dieser Woche");
      toolbar.insertAdjacentElement("afterend", overview);
    }

    overview.innerHTML = `
      <div class="plan-week-days" role="group" aria-label="Tag auswählen">
        ${days.map((day, index) => {
          const selected = day.date === selectedDate;
          const status = statuses[index];
          const labels = mobilePlanStatusLabels(status);
          const todayLabel = day.date === today() ? ", heute" : "";
          const statusLabel = labels.length ? `, ${labels.join(", ")}` : "";
          return `<button
            type="button"
            class="plan-week-day${selected ? " selected" : ""}${day.date === today() ? " today" : ""}"
            data-plan-date="${day.date}"
            aria-pressed="${selected ? "true" : "false"}"
            aria-label="${esc(`${shortWeekday(day.date)} ${dayNumber(day.date)}${todayLabel}${statusLabel}`)}"
          >
            <span class="plan-week-weekday">${esc(shortWeekday(day.date))}</span>
            <b>${esc(dayNumber(day.date))}</b>
            <span class="plan-week-status">${statusMarkersHtml(status)}</span>
          </button>`;
        }).join("")}
      </div>
      <div class="plan-week-legend" aria-label="Status der Woche">${legendHtml(statuses)}</div>
    `;

    overview.querySelectorAll(".plan-week-day").forEach((button) => {
      button.onclick = () => {
        globalThis.__mobilePlanSelectedDate = button.dataset.planDate;
        applySelectedDay(block, days, button.dataset.planDate, statuses);
        overview.querySelectorAll(".plan-week-day").forEach((item) => {
          const active = item.dataset.planDate === button.dataset.planDate;
          item.classList.toggle("selected", active);
          item.setAttribute("aria-pressed", active ? "true" : "false");
        });
      };
    });
  }

  function normalizeCompletedDayPresentation(node, status) {
    if (!node?.matches?.("details.completed-day")) return;
    const title = node.querySelector(".completed-day-title");
    if (!title) return;
    if (!title.dataset.planBaseTitle) title.dataset.planBaseTitle = title.textContent || "";
    title.textContent = mobilePlanCompletionTitle(title.dataset.planBaseTitle, status);
    node.classList.toggle("plan-partial-day", status.completedCount > 0 && status.incomplete && !status.done);
  }

  function applySelectedDay(block, days, selectedDate, statuses = []) {
    const dayNodes = [...block.children].filter(
      (node) => node.classList.contains("day-card") || node.classList.contains("completed-day"),
    );
    dayNodes.forEach((node, index) => {
      const date = days[index]?.date || "";
      const status = statuses[index] || {};
      node.dataset.planDate = date;
      normalizeCompletedDayPresentation(node, status);
      const selected = date === selectedDate;
      node.hidden = !selected;
      node.classList.toggle("plan-selected-day", selected);
      if (selected && node.matches("details.completed-day")) node.open = true;
    });
  }

  function enhanceMobilePlan() {
    const toolbar = document.querySelector("#plan > .plan-toolbar");
    const block = document.getElementById("blockPlan");
    if (!toolbar || !block) return;

    const from = visiblePlanStart();
    const days = planDisplayDays(from, 7);
    const selectedDate = mobilePlanSelectedDate(
      days,
      globalThis.__mobilePlanSelectedDate || "",
      today(),
    );
    globalThis.__mobilePlanSelectedDate = selectedDate;

    const prepDates = prepRequiredDates();
    const statuses = days.map((day) =>
      mobilePlanDayStatus(
        day,
        state.planLocks || {},
        mealIsCompleted,
        (id) => !!food(id)?.allergenGroup,
        prepDates,
      ),
    );

    ensureTodaySelection(toolbar);
    ensureSecondaryActions(toolbar);
    ensureWeekNavigation(toolbar, from, selectedDate);
    ensureWeekOverview(toolbar, block, days, selectedDate, statuses);
    applySelectedDay(block, days, selectedDate, statuses);
  }

  const baseRenderPlanCore = renderPlanCore;
  renderPlanCore = function renderMobileFirstPlanCore() {
    baseRenderPlanCore();
    enhanceMobilePlan();
  };

  globalThis.__mobilePlanUi = {
    mobilePlanDayStatus,
    mobilePlanSelectedDate,
    mobilePlanStatusLabels,
    mobilePlanCompletionTitle,
    enhance: enhanceMobilePlan,
  };

  if (document.getElementById("plan")?.classList.contains("active")) renderPlan();
})();
