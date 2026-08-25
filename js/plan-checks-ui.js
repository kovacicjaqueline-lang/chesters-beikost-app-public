"use strict";

/*
 * Kleiner Loader, damit die AP3-Vertragserweiterung garantiert vor der sichtbaren
 * Plan-Checks-UI installiert ist. Beide Dateien bleiben separat precachebar.
 */
(function loadPlanChecksUi() {
  if (typeof document === "undefined" || globalThis.__planChecksUiLoaderStarted) return;
  globalThis.__planChecksUiLoaderStarted = true;

  const current = document.currentScript?.src || "";
  const version = current ? new URL(current, document.baseURI).search : "";
  const base = current ? new URL("./", new URL(current, document.baseURI)) : new URL("./js/", document.baseURI);
  const files = [
    `plan-checks-contract-extension.js${version}`,
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
