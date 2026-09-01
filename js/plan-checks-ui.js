"use strict";

/*
 * Kleiner Loader, damit zuerst die AP3-Vertragserweiterung, danach die zentrale
 * Solution-Preservation, die kooperative Suche und anschließend die Lösungsvorbereitung
 * installiert werden. Die Vorbereitung fängt den ersten Core-Render einmal ab; dadurch
 * kann die sichtbare Plan-Checks-UI nie vor der Lösungsprüfung einen irreführenden CTA
 * zeichnen. Mobile-Plan wird zuletzt geladen und verdichtet ausschließlich die Darstellung.
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
    `plan-checks-cooperative-search.js${version}`,
    `plan-checks-solution-precompute.js${version}`,
    `plan-checks-ui-core.js${version}`,
    `plan-mobile-ui.js${version}`,
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
