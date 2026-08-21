"use strict";

/* FLOW-C: gemeinsame UI-Schicht für fachlich getrennte Eingabe-/Bearbeitungsdialoge.
 *
 * Die Runtime vereinheitlicht ausschließlich Dialog-Shell, Header-Hierarchie,
 * Abschnittsklassen und Actionbar. Planner- und Protokoll-Controller, Persistenz,
 * Rollen, Safety sowie Mahlzeiteneignung bleiben bewusst in ihren bestehenden Flows.
 */
(function installFlowDialogUi() {
  if (typeof document === "undefined" || typeof globalThis === "undefined") return;
  if (globalThis.__flowDialogUiInstalled) return;
  if (
    typeof openGeneric !== "function" ||
    typeof closeGeneric !== "function" ||
    typeof openManualMealSelector !== "function" ||
    typeof renderLogForm !== "function"
  ) return;

  let manualContext = null;

  function flowDialogVisibleDate(date) {
    return typeof nice === "function" ? nice(date, true) : String(date || "");
  }

  function flowDialogMealName(meal) {
    return meal && typeof mealName === "function" ? mealName(meal) : "";
  }

  function flowDialogContextSubtitle(date, meal) {
    return [flowDialogVisibleDate(date), flowDialogMealName(meal)].filter(Boolean).join(" · ");
  }

  function ensureGenericSubtitle() {
    let heading = document.querySelector("#genericModal .sheethead .grow");
    if (!heading) return null;
    let subtitle = document.getElementById("genericSubtitle");
    if (!subtitle) {
      subtitle = document.createElement("div");
      subtitle.id = "genericSubtitle";
      subtitle.className = "small flow-dialog-subtitle";
      heading.appendChild(subtitle);
    }
    return subtitle;
  }

  function markFlowDialogSections(body) {
    if (!body) return;
    body.querySelectorAll(".log-date-grid, .manual-meal-target-date").forEach((node) =>
      node.classList.add("flow-dialog-context"),
    );
    body.querySelectorAll(".meal-selector-tabs, .log-recipe-picker, .log-food-picker").forEach((node) =>
      node.classList.add("flow-dialog-selection"),
    );
    body.querySelectorAll(".manual-role-overview, .selected-target, .log-recipe-choice, .grouped-outcome, .sample-outcome-list").forEach((node) =>
      node.classList.add("flow-dialog-selected"),
    );
    let actions = body.querySelector(".sticky-form-actions");
    if (actions) actions.classList.add("flow-dialog-actions");
  }

  function decorateFlowDialog(modalId, bodyId, subtitleText = "") {
    let modal = document.getElementById(modalId);
    let body = document.getElementById(bodyId);
    if (!modal || !body) return;

    modal.classList.add("flow-dialog");
    modal.querySelector(".sheet")?.classList.add("flow-dialog-sheet");
    modal.querySelector(".sheethead")?.classList.add("flow-dialog-header");
    modal.querySelector(".sheethead .grow")?.classList.add("flow-dialog-heading");
    modal.querySelector(".sheethead h2")?.classList.add("flow-dialog-title");
    modal.querySelector(".sheethead .iconbtn")?.classList.add("flow-dialog-close");
    body.classList.add("flow-dialog-body");

    let subtitle = modalId === "genericModal"
      ? ensureGenericSubtitle()
      : document.getElementById("logSubtitle");
    if (subtitle) {
      subtitle.classList.add("flow-dialog-subtitle");
      if (modalId === "genericModal") subtitle.textContent = subtitleText;
      subtitle.hidden = !String(subtitle.textContent || "").trim();
    }

    markFlowDialogSections(body);
  }

  function resetGenericFlowDialog() {
    let modal = document.getElementById("genericModal");
    if (!modal) return;
    modal.classList.remove("flow-dialog");
    let subtitle = document.getElementById("genericSubtitle");
    if (subtitle) {
      subtitle.textContent = "";
      subtitle.hidden = true;
    }
  }

  function syncManualHeader() {
    if (!manualContext) return;
    let subtitle = flowDialogContextSubtitle(manualContext.date, manualContext.meal);
    decorateFlowDialog("genericModal", "genericBody", subtitle);
  }

  const originalOpenGeneric = openGeneric;
  openGeneric = function flowDialogOpenGeneric(title, body, onClose = null) {
    let manualTitle = manualContext && String(title || "").match(/^(Mahlzeit hinzufügen|Mahlzeit bearbeiten)(?:\s*·.*)?$/);
    if (!manualTitle) {
      let result = originalOpenGeneric.call(this, title, body, onClose);
      resetGenericFlowDialog();
      manualContext = null;
      return result;
    }

    let result = originalOpenGeneric.call(this, manualTitle[1], body, onClose);
    syncManualHeader();
    return result;
  };

  const originalCloseGeneric = closeGeneric;
  closeGeneric = function flowDialogCloseGeneric(...args) {
    let result = originalCloseGeneric.apply(this, args);
    resetGenericFlowDialog();
    manualContext = null;
    return result;
  };

  const originalOpenManualMealSelector = openManualMealSelector;
  openManualMealSelector = function flowDialogOpenManualMealSelector(date, meal, initialMeal = null) {
    manualContext = { date, meal };
    let result = originalOpenManualMealSelector.apply(this, arguments);
    syncManualHeader();
    return result;
  };

  const originalRenderLogForm = renderLogForm;
  renderLogForm = function flowDialogRenderLogForm(...args) {
    let result = originalRenderLogForm.apply(this, args);
    decorateFlowDialog("logModal", "logForm");
    return result;
  };

  document.getElementById("genericModal")?.addEventListener("change", (event) => {
    if (!manualContext || event.target?.id !== "manualMealTargetDate") return;
    manualContext.date = event.target.value || manualContext.date;
    syncManualHeader();
  });

  let genericBody = document.getElementById("genericBody");
  if (genericBody && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => {
      if (document.getElementById("genericModal")?.classList.contains("flow-dialog")) syncManualHeader();
    }).observe(genericBody, { childList: true, subtree: true });
  }

  decorateFlowDialog("logModal", "logForm");
  globalThis.__flowDialogUiInstalled = true;
})();
