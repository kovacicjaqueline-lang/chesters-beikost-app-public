"use strict";

/* App-Schwerpunkt
 * Reine UI-/Navigationspräferenz. Planner-, FOOD-, Rezept-, Allergen-, Vorrats-
 * und Protokolldaten bleiben in ihren bestehenden Modulen und Datenstrukturen.
 */
(function appFocusModeModule(root) {
  if (typeof document === "undefined" || !root || root.AppFocusMode) return;

  const MODE_PLANNING = "planning-documentation";
  const MODE_EVERYDAY = "everyday-recipes";
  const DEFAULT_MODE = MODE_PLANNING;
  const NAV_ORDERS = Object.freeze({
    [MODE_PLANNING]: Object.freeze(["home", "plan", "prep", "foods", "more"]),
    [MODE_EVERYDAY]: Object.freeze(["home", "foods", "plan", "prep", "more"]),
  });

  function normalizeMode(value) {
    return value === MODE_EVERYDAY ? MODE_EVERYDAY : MODE_PLANNING;
  }

  // migrateStateCore() baut auf clone(DEFAULT) auf und merged gespeicherte Settings
  // darüber. Das Ergänzen des Defaults reicht daher auch für bestehende Stände;
  // eine eigene Schema-Migration ist nicht erforderlich.
  if (typeof DEFAULT !== "undefined" && DEFAULT?.settings) {
    DEFAULT.settings.appFocusMode = normalizeMode(DEFAULT.settings.appFocusMode || DEFAULT_MODE);
  }

  let lastAppliedMode = null;

  function currentMode() {
    if (typeof state === "undefined" || !state?.settings) return DEFAULT_MODE;
    return normalizeMode(state.settings.appFocusMode);
  }

  function navButton(viewId) {
    return document.querySelector(`nav button[data-view="${viewId}"]`);
  }

  function setButtonLabel(button, label) {
    if (!button) return;
    const textNode = [...button.childNodes].find((node) => node.nodeType === 3);
    if (textNode) textNode.nodeValue = label;
    else button.append(document.createTextNode(label));
    button.setAttribute("aria-label", label);
  }

  function reorderNavigation(mode) {
    const nav = document.querySelector("nav");
    if (!nav) return;
    const buttons = new Map(
      [...nav.querySelectorAll("button[data-view]")].map((button) => [button.dataset.view, button]),
    );
    for (const viewId of NAV_ORDERS[normalizeMode(mode)]) {
      const button = buttons.get(viewId);
      if (button) nav.appendChild(button);
    }
  }

  function restorePlanningCatalogMode() {
    const foodsToggle = document.querySelector('#catalogSwitch [data-catalog-mode="foods"]');
    if (foodsToggle && foodsToggle.getAttribute("aria-pressed") !== "true") foodsToggle.click();
  }

  function syncSettingControl(mode = currentMode()) {
    document.querySelectorAll('input[name="appFocusMode"]').forEach((input) => {
      input.checked = input.value === normalizeMode(mode);
    });
  }

  function updateActiveViewTitle(mode) {
    if (!document.getElementById("foods")?.classList.contains("active")) return;
    const title = document.getElementById("appBarTitle");
    if (title) title.textContent = mode === MODE_EVERYDAY ? "Rezepte" : "Beikost";
  }

  function applyFocusMode() {
    const mode = currentMode();
    const changed = mode !== lastAppliedMode;
    const foodsButton = navButton("foods");

    if (mode === MODE_EVERYDAY) {
      if (changed) reorderNavigation(mode);
      setButtonLabel(foodsButton, "Rezepte");
    } else {
      if (changed && lastAppliedMode === MODE_EVERYDAY) {
        reorderNavigation(mode);
        restorePlanningCatalogMode();
      }
      setButtonLabel(foodsButton, "Beikost");
    }

    lastAppliedMode = mode;
    syncSettingControl(mode);
    updateActiveViewTitle(mode);
    return mode;
  }

  function installSettingControl() {
    if (document.getElementById("appFocusModeSetting")) return;
    const groups = [...document.querySelectorAll(".settings-card .settings-group")];
    const host = groups.at(-1)?.querySelector(".settings-group-body");
    if (!host) return;

    const field = document.createElement("div");
    field.className = "field app-focus-mode-setting";
    field.id = "appFocusModeSetting";
    field.innerHTML = `
      <div class="field-label"><b>App-Schwerpunkt</b></div>
      <div role="radiogroup" aria-label="App-Schwerpunkt">
        <label class="toggleline app-focus-option">
          <input type="radio" name="appFocusMode" value="${MODE_EVERYDAY}">
          <span class="toggle-copy"><b>Alltag &amp; Rezepte</b><span class="small">– Tagesideen und Rezepte stehen im Vordergrund</span></span>
        </label>
        <label class="toggleline app-focus-option">
          <input type="radio" name="appFocusMode" value="${MODE_PLANNING}">
          <span class="toggle-copy"><b>Planen &amp; Dokumentieren</b><span class="small">– Planung, Fortschritt und Protokollierung stehen stärker im Vordergrund</span></span>
        </label>
      </div>`;
    host.appendChild(field);
    syncSettingControl();
  }

  function saveSelectedMode() {
    if (typeof state === "undefined" || !state?.settings) return;
    const selected = document.querySelector('input[name="appFocusMode"]:checked');
    if (!selected) return;
    state.settings.appFocusMode = normalizeMode(selected.value);
    applyFocusMode();
  }

  installSettingControl();
  applyFocusMode();

  document.getElementById("saveSettings")?.addEventListener("click", saveSelectedMode, true);
  document.getElementById("discardSettings")?.addEventListener("click", () => syncSettingControl(), true);

  // catalog-navigation.js setzt den gemeinsamen Bottom-Tab weiterhin bewusst auf
  // Lebensmittel zurück. Im Alltagsmodus wird direkt danach nur der bereits
  // bestehende Katalogumschalter auf Rezepte betätigt; es entsteht kein zweiter View.
  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.('nav button[data-view="foods"]');
    if (!button || currentMode() !== MODE_EVERYDAY) return;
    document.querySelector('#catalogSwitch [data-catalog-mode="recipes"]')?.click();
  }, true);

  root.MobileUiLifecycle?.onRender("home", applyFocusMode);
  root.MobileUiLifecycle?.onRender("more", () => {
    installSettingControl();
    applyFocusMode();
  });
  root.MobileUiLifecycle?.onViewChange(({ viewId }) => {
    installSettingControl();
    applyFocusMode();
    if (viewId === "more") syncSettingControl();
  });

  root.AppFocusMode = Object.freeze({
    MODE_PLANNING,
    MODE_EVERYDAY,
    current: currentMode,
    apply: applyFocusMode,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
