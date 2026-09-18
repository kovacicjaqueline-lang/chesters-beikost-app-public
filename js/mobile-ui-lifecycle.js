"use strict";

(function installMobileUiLifecycle(root) {
  if (!root || root.MobileUiLifecycle) return;

  const renderHooks = new Map();
  const viewHooks = new Set();

  function onRender(viewId, callback) {
    if (!viewId || typeof callback !== "function") return () => {};
    const key = String(viewId);
    if (!renderHooks.has(key)) renderHooks.set(key, new Set());
    const callbacks = renderHooks.get(key);
    callbacks.add(callback);
    return () => {
      callbacks.delete(callback);
      if (!callbacks.size) renderHooks.delete(key);
    };
  }

  function afterRender(viewId, detail = {}) {
    const key = String(viewId || "");
    const callbacks = renderHooks.get(key);
    if (!callbacks) return;
    [...callbacks].forEach((callback) => callback({ ...detail, viewId: key }));
  }

  function onViewChange(callback) {
    if (typeof callback !== "function") return () => {};
    viewHooks.add(callback);
    return () => viewHooks.delete(callback);
  }

  function afterViewChange(viewId, previousViewId = "") {
    const payload = {
      viewId: String(viewId || ""),
      previousViewId: String(previousViewId || ""),
    };
    [...viewHooks].forEach((callback) => callback(payload));
  }

  root.MobileUiLifecycle = Object.freeze({
    onRender,
    afterRender,
    onViewChange,
    afterViewChange,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);

/*
 * Häufige lokale Mutationen dürfen die übrigen, aktuell unsichtbaren Views nicht
 * vorsorglich neu aufbauen. save() invalidiert bereits den View-Render-Cache; ein
 * später geöffneter Tab wird dadurch automatisch mit aktuellem State neu gerendert.
 *
 * Die fachlichen Handler behalten renderAll() als sicheren Fallback. Nur während
 * der synchronen, eindeutig lokalen UI-Aktion wird dieser Aufruf auf den sichtbaren
 * View (bzw. beim Plan-Datumswechsel direkt auf den Plan) begrenzt.
 */
(function installTargetedActionRenderScopes(root) {
  if (!root || typeof document === "undefined" || root.__targetedActionRenderScopesInstalled) return;
  root.__targetedActionRenderScopesInstalled = true;

  const clickRules = [
    ["#planToday", "plan", false],
    [".meal-lock", "current", false],
    [".randomizeMeal", "current", false],
    ["#confirmMealDelete", "current", true],
    ["#confirmPlanRebuild", "current", false],
    ["#applyPlanGoalSolution", "current", false],
    ["#applyHardCorrection", "current", false],
    ["[data-readiness-signal]", "current", false],
  ];
  const changeRules = [
    ["#planFrom", "plan", false],
    ["#foodDetailsLiked", "current", false],
  ];

  function renderTarget(kind) {
    if (kind === "plan" && typeof root.renderPlan === "function") {
      return () => root.renderPlan();
    }
    if (typeof root.renderCurrentView === "function") {
      return () => root.renderCurrentView();
    }
    return null;
  }

  function runWithTargetedRender(callback, renderer) {
    if (typeof callback !== "function" || typeof renderer !== "function" || typeof root.renderAll !== "function") {
      return typeof callback === "function" ? callback() : undefined;
    }
    const baseRenderAll = root.renderAll;
    const targetedRenderAll = () => renderer();
    root.renderAll = targetedRenderAll;
    try {
      return callback();
    } finally {
      if (root.renderAll === targetedRenderAll) root.renderAll = baseRenderAll;
    }
  }

  function beginTargetedEvent(kind, wrapUndo) {
    const renderer = renderTarget(kind);
    if (!renderer || typeof root.renderAll !== "function") return;

    const baseRenderAll = root.renderAll;
    const targetedRenderAll = () => renderer();
    const baseShowToast = wrapUndo && typeof root.showToast === "function" ? root.showToast : null;
    let targetedShowToast = null;

    root.renderAll = targetedRenderAll;
    if (baseShowToast) {
      targetedShowToast = function showToastWithTargetedUndo(message, undoAction, ...args) {
        const targetedUndo = typeof undoAction === "function"
          ? () => runWithTargetedRender(undoAction, renderer)
          : undoAction;
        return baseShowToast.call(this, message, targetedUndo, ...args);
      };
      root.showToast = targetedShowToast;
    }

    const finish = () => {
      if (root.renderAll === targetedRenderAll) root.renderAll = baseRenderAll;
      if (targetedShowToast && root.showToast === targetedShowToast) root.showToast = baseShowToast;
    };
    if (typeof queueMicrotask === "function") queueMicrotask(finish);
    else Promise.resolve().then(finish);
  }

  function matchingRule(target, rules) {
    for (const [selector, kind, wrapUndo] of rules) {
      const matched = target?.closest?.(selector);
      if (matched) return { kind, wrapUndo };
    }
    return null;
  }

  document.addEventListener("click", (event) => {
    const rule = matchingRule(event.target, clickRules);
    if (rule) beginTargetedEvent(rule.kind, rule.wrapUndo);
  }, true);

  document.addEventListener("change", (event) => {
    const rule = matchingRule(event.target, changeRules);
    if (rule) beginTargetedEvent(rule.kind, rule.wrapUndo);
  }, true);
})(typeof globalThis !== "undefined" ? globalThis : window);
