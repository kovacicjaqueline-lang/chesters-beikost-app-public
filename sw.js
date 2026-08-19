importScripts("./sw-core.js");

// PLAN-08 wird nach dem initialen HTML dynamisch geladen. Diese Dateien müssen
// schon beim Service-Worker-Install in denselben App-Cache, damit der erste
// Offline-Start nach einer frischen Installation die vollständige Policy-Kette hat.
const PLAN08_PRECACHE = [
  "./js/planner-meal-eligibility.js",
  "./js/planner-milk-policy.js",
  "./js/planner-iron-preference.js",
  "./data/food-presentation.js",
  "./js/planner-meal-presentation.js",
  "./js/planner-recipe-first.js",
  "./js/planner-proactive-recipe.js",
  "./js/planner-food-role-stability.js",
];

// Handling-Readiness wird nach der PLAN-08-Kette ebenfalls dynamisch geladen.
// Contract und Runtime müssen deshalb schon beim ersten Offline-Start verfügbar sein.
const HANDLING_PRECACHE = [
  "./data/food-handling.js",
  "./js/handling-readiness.js",
];

// Der einheitliche Essenslog wird vor app.js geladen und bleibt auch offline vollständig verfügbar.
const UNIFIED_LOG_PRECACHE = [
  "./js/log-core.js",
];

// Zusätzliche UI-/Flow-Dateien, die nicht im statischen FILES-Stamm von sw-core.js liegen.
const UI_PRECACHE = [
  "./ui-meal-editor-footer.css",
  "./js/manual-meal-flow.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all([...PLAN08_PRECACHE, ...HANDLING_PRECACHE, ...UNIFIED_LOG_PRECACHE, ...UI_PRECACHE].map(async (url) => {
      try {
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (response && response.ok) await cache.put(url, response.clone());
      } catch (error) {
        console.warn("[PWA] Zusatz-Precache fehlgeschlagen:", url, error);
      }
    }));
  })());
});
