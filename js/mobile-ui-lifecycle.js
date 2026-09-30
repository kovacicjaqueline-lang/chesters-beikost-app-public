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

/* Der Vorratsdialog wird beim Tippen fachlich weiterhin durch ui.js aktualisiert.
 * Auf iOS darf dabei aber das aktive Suchfeld nicht ersetzt werden: WebKit klappt
 * sonst die Tastatur kurz zu und wieder auf. Der Capture-Hook hält deshalb nur
 * dieses Feld DOM-stabil und übernimmt aus dem neu berechneten Dialog die
 * Suchergebnisse. Gleichzeitig werden Namensanfänge vor bloßen Teiltreffern aus
 * Name, Alias oder Kategorie einsortiert.
 */
(function installInventoryLiveSearchUi(root) {
  if (!root || typeof document === "undefined" || root.__inventoryLiveSearchUiInstalled) return;
  root.__inventoryLiveSearchUiInstalled = true;

  function normalize(value) {
    if (typeof root.normalizeName === "function") return root.normalizeName(value || "");
    return String(value || "").trim().toLocaleLowerCase("de");
  }

  function escapeHtml(value) {
    if (typeof root.esc === "function") return root.esc(value);
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function foodSearchRank(item, query) {
    const name = normalize(item?.name);
    const alias = normalize(item?.alias);
    const category = normalize(item?.category);
    if (name === query) return 0;
    if (name.startsWith(query)) return 1;
    if (alias.split(/\s*[;,/|]\s*/).some((part) => part.startsWith(query))) return 2;
    if (name.includes(query)) return 3;
    if (alias.includes(query)) return 4;
    if (category.startsWith(query)) return 5;
    if (category.includes(query)) return 6;
    return 99;
  }

  function selectedFoodId(body) {
    const selectedRow = body.querySelector(".chooseInventoryTarget.selected");
    if (selectedRow?.dataset.key) {
      try { return decodeURIComponent(selectedRow.dataset.key); } catch {}
    }
    const selectedLabel = body.querySelector(".selected-target b")?.textContent || "";
    const name = selectedLabel.replace(/^Ausgewählt:\s*/i, "").trim();
    if (!name || !Array.isArray(root.state?.foods)) return "";
    return root.state.foods.find((item) => item?.name === name)?.id || "";
  }

  function foodResultHtml(item, selectedId) {
    const selected = item?.id === selectedId;
    const icon = typeof root.foodIconSvg === "function" ? root.foodIconSvg(item) : "";
    const meta = `${item?.category || ""}${item?.active ? "" : " · nicht im Plan aktiv"}`;
    return `<button class="live-result chooseInventoryTarget ${selected ? "selected" : ""}" data-key="${encodeURIComponent(item?.id || "")}">${icon}<span class="grow"><b>${escapeHtml(item?.name || "")}</b><span class="small" style="display:block">${escapeHtml(meta)}</span></span><span class="selector-check" aria-hidden="true">${selected ? "✓" : ""}</span></button>`;
  }

  function rankFoodResults(container, query, selectedId) {
    if (!query || !Array.isArray(root.state?.foods)) return;
    const matches = root.state.foods
      .filter((item) => {
        const searchable = normalize(`${item?.name || ""} ${item?.alias || ""} ${item?.category || ""}`);
        return searchable.includes(query);
      })
      .sort((left, right) =>
        foodSearchRank(left, query) - foodSearchRank(right, query) ||
        String(left?.name || "").localeCompare(String(right?.name || ""), "de"),
      )
      .slice(0, 20);
    const results = container.querySelector(".live-results");
    if (!results) return;
    results.innerHTML = matches.length
      ? matches.map((item) => foodResultHtml(item, selectedId)).join("")
      : '<div class="empty">Kein Treffer.</div>';
  }

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.id !== "inventoryLiveSearch") return;

    const genericBody = document.getElementById("genericBody");
    const modal = document.getElementById("genericModal");
    const originalOpenGeneric = root.openGeneric;
    if (!genericBody?.contains(input) || !modal?.classList.contains("open") || typeof originalOpenGeneric !== "function") return;

    const query = normalize(input.value);
    const selectedId = selectedFoodId(genericBody);
    let restored = false;

    function restoreOpenGeneric() {
      if (restored) return;
      restored = true;
      if (root.openGeneric === stableInventoryOpenGeneric) root.openGeneric = originalOpenGeneric;
    }

    function stableInventoryOpenGeneric(title, body, onClose = null) {
      const next = document.createElement("div");
      next.innerHTML = body;
      const nextInput = next.querySelector("#inventoryLiveSearch");
      const currentInput = genericBody.querySelector("#inventoryLiveSearch");
      const currentResults = genericBody.querySelector(".live-results");
      const nextResults = next.querySelector(".live-results");
      if (!nextInput || currentInput !== input || !currentResults || !nextResults) {
        return originalOpenGeneric(title, body, onClose);
      }

      if (next.querySelector("#inventoryFoodTab.active")) rankFoodResults(next, query, selectedId);
      currentResults.replaceWith(next.querySelector(".live-results"));

      const currentStatus = currentInput.closest(".field")?.nextElementSibling;
      const nextStatus = nextInput.closest(".field")?.nextElementSibling;
      if (currentStatus && nextStatus) currentStatus.replaceWith(nextStatus);

      const titleNode = document.getElementById("genericTitle");
      if (titleNode && titleNode.textContent !== title) titleNode.textContent = title;
      modal.classList.add("open");
    }

    root.openGeneric = stableInventoryOpenGeneric;
    if (typeof queueMicrotask === "function") queueMicrotask(restoreOpenGeneric);
    else Promise.resolve().then(restoreOpenGeneric);
  }, true);
})(typeof globalThis !== "undefined" ? globalThis : window);
