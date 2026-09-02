"use strict";

/*
 * Kleiner Loader, damit zuerst die AP3-Vertragserweiterung und die zentrale
 * Solution-Preservation, danach Keep-Policy und Tracking, die kooperative Suche
 * und anschließend die Lösungsvorbereitung installiert werden. Der UI-Core
 * installiert den vorbereiteten Renderer anschließend explizit vor seinem ersten
 * sichtbaren Render; dadurch kann die Plan-Checks-UI nie vor der Lösungsprüfung
 * einen irreführenden CTA zeichnen. Die Dateien bleiben separat precachebar.
 */
(function loadPlanChecksUi() {
  if (typeof document === "undefined" || globalThis.__planChecksUiLoaderStarted) return;
  globalThis.__planChecksUiLoaderStarted = true;

  const current = document.currentScript?.src || "";
  const version = current ? new URL(current, document.baseURI).search : "";
  const base = current ? new URL("./", new URL(current, document.baseURI)) : new URL("./js/", document.baseURI);
  const files = [
    `plan-checks-contract-extension.js${version}`,
    `plan-checks-solution-preservation.js${version}`,
    `planner-keep-policy.js${version}`,
    `planner-keep-tracking.js${version}`,
    `plan-checks-cooperative-search.js${version}`,
    `plan-checks-solution-precompute.js${version}`,
    `plan-checks-ui-core.js${version}`,
  ];

  function loadNext(index) {
    if (index >= files.length) return;
    const script = document.createElement("script");
    script.src = new URL(files[index], base).toString();
    script.async = false;
    script.onload = () => loadNext(index + 1);
    script.onerror = () => console.error(`Plan-Checks-UI konnte ${files[index]} nicht laden.`);
    document.head.appendChild(script);
  }

  loadNext(0);
})();
