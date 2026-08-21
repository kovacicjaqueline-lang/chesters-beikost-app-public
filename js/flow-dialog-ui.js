"use strict";

/* FLOW-C: gemeinsame UI-Schicht für fachlich getrennte Eingabe-/Bearbeitungsdialoge.
 *
 * Die Runtime dekoriert ausschließlich die bereits gerenderten Dialoge. Planner- und
 * Protokoll-Controller, Persistenz, Rollen, Safety sowie Mahlzeiteneignung bleiben
 * unverändert und werden weder gewrappt noch ersetzt.
 */
(function installFlowDialogUi() {
  if (typeof document === "undefined" || typeof globalThis === "undefined") return;
  if (globalThis.__flowDialogUiInstalled) return;

  const genericModal = document.getElementById("genericModal");
  const logModal = document.getElementById("logModal");
  const genericTitle = document.getElementById("genericTitle");
  const genericBody = document.getElementById("genericBody");
  const logBody = document.getElementById("logForm");
  if (!genericModal || !logModal || !genericTitle || !genericBody || !logBody) return;

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function setHidden(node, hidden) {
    if (node && node.hidden !== hidden) node.hidden = hidden;
  }

  function visibleDate(date) {
    return date && typeof nice === "function" ? nice(date, true) : String(date || "");
  }

  function ensureGenericSubtitle() {
    let heading = genericModal.querySelector(".sheethead .grow");
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

  function markSections(body) {
    body.querySelectorAll(".log-date-grid, .manual-meal-target-date").forEach((node) =>
      node.classList.add("flow-dialog-context"),
    );
    body.querySelectorAll(".meal-selector-tabs, .log-recipe-picker, .log-food-picker").forEach((node) =>
      node.classList.add("flow-dialog-selection"),
    );
    body.querySelectorAll(".manual-role-overview, .selected-target, .log-recipe-choice").forEach((node) =>
      node.classList.add("flow-dialog-selected"),
    );
    body.querySelector(".sticky-form-actions")?.classList.add("flow-dialog-actions");
  }

  function decorate(modal, body, subtitle) {
    modal.classList.add("flow-dialog");
    modal.querySelector(".sheet")?.classList.add("flow-dialog-sheet");
    modal.querySelector(".sheethead")?.classList.add("flow-dialog-header");
    modal.querySelector(".sheethead .grow")?.classList.add("flow-dialog-heading");
    modal.querySelector(".sheethead h2")?.classList.add("flow-dialog-title");
    modal.querySelector(".sheethead .iconbtn")?.classList.add("flow-dialog-close");
    body.classList.add("flow-dialog-body");
    if (subtitle) {
      subtitle.classList.add("flow-dialog-subtitle");
      setHidden(subtitle, !String(subtitle.textContent || "").trim());
    }
    markSections(body);
  }

  function resetGeneric() {
    genericModal.classList.remove("flow-dialog");
    delete genericModal.dataset.flowDialogContext;
    let subtitle = document.getElementById("genericSubtitle");
    if (subtitle) {
      setText(subtitle, "");
      setHidden(subtitle, true);
    }
  }

  function syncGeneric() {
    if (!genericModal.classList.contains("open")) {
      resetGeneric();
      return;
    }

    let rawTitle = String(genericTitle.textContent || "").trim();
    let match = rawTitle.match(/^(Mahlzeit hinzufügen|Mahlzeit bearbeiten)\s*·\s*(.+)$/);
    if (match) {
      genericModal.dataset.flowDialogContext = match[2];
      setText(genericTitle, match[1]);
      rawTitle = match[1];
    }

    let isMealEditor = /^(Mahlzeit hinzufügen|Mahlzeit bearbeiten)$/.test(rawTitle) &&
      !!genericModal.dataset.flowDialogContext;
    if (!isMealEditor) {
      resetGeneric();
      return;
    }

    let subtitle = ensureGenericSubtitle();
    let date = document.getElementById("manualMealTargetDate")?.value || "";
    setText(subtitle, [visibleDate(date), genericModal.dataset.flowDialogContext].filter(Boolean).join(" · "));
    decorate(genericModal, genericBody, subtitle);
  }

  function syncLog() {
    if (!logModal.classList.contains("open")) return;
    let subtitle = document.getElementById("logSubtitle");
    decorate(logModal, logBody, subtitle);
  }

  const genericObserver = new MutationObserver(syncGeneric);
  genericObserver.observe(genericModal, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
    characterData: true,
  });

  const logObserver = new MutationObserver(syncLog);
  logObserver.observe(logModal, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
    characterData: true,
  });

  genericModal.addEventListener("change", (event) => {
    if (event.target?.id === "manualMealTargetDate") syncGeneric();
  });

  syncGeneric();
  syncLog();
  globalThis.__flowDialogUiInstalled = true;
})();
