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
