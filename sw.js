// sw-core.js besitzt weiterhin die vollständige, versionsgebundene Precache-Liste.
// Seine bisherige Fetch-Strategie war jedoch network-first und der Install-Precache
// best-effort. Der Wrapper übernimmt deshalb Fetch-Strategie und Install-Vertrag.
const nativeAddEventListener = self.addEventListener.bind(self);
const nativeRemoveEventListener = self.removeEventListener.bind(self);
let coreFetchHandler = null;
let coreInstallHandler = null;

self.addEventListener = (type, listener, options) => {
  nativeAddEventListener(type, listener, options);
  if (type === "fetch") coreFetchHandler = listener;
  if (type === "install") coreInstallHandler = listener;
};

// Der Core-Import ist absichtlich mit derselben App-Version versehen wie die Runtime-Assets.
// Damit kann ein bereits installierter Worker beim Update nicht einen alten sw-core.js aus
// dem HTTP-/Import-Cache übernehmen, obwohl der neue Top-Level-Worker schon geladen wurde.
importScripts("./sw-core.js?v=10.1.26");

self.addEventListener = nativeAddEventListener;
if (coreFetchHandler) nativeRemoveEventListener("fetch", coreFetchHandler);
if (coreInstallHandler) nativeRemoveEventListener("install", coreInstallHandler);

async function matchAppCache(request) {
  const cache = await caches.open(CACHE);
  const direct = await cache.match(request);
  if (direct) return direct;
  return cache.match(request, { ignoreSearch: true });
}

async function fetchAndStore(request) {
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());

    const url = new URL(request.url);
    if (url.origin === self.location.origin && url.search) {
      url.search = "";
      url.hash = "";
      await cache.put(url.toString(), response.clone());
    }
  }
  return response;
}

// Stale-while-revalidate für bereits installierte App-Dateien: Der sichtbare
// Wiederaufbau kommt sofort aus dem versionsgebundenen Cache. Parallel wird die
// angeforderte Ressource aus dem Netz aktualisiert, damit spätere Deployments
// ohne Service-Worker-Änderung nicht dauerhaft auf einem alten App-Stand hängen.
nativeAddEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const cachedPromise = matchAppCache(event.request);
  event.waitUntil((async () => {
    const cached = await cachedPromise;
    if (!cached) return;
    try {
      await fetchAndStore(event.request);
    } catch (_) {
      // Offline bleibt die bereits gecachte Ressource gültig.
    }
  })());

  event.respondWith((async () => {
    const cached = await cachedPromise;
    if (cached) return cached;

    try {
      return await fetchAndStore(event.request);
    } catch (error) {
      if (event.request.mode === "navigate") {
        const cache = await caches.open(CACHE);
        const index = await cache.match("./index.html");
        if (index) return index;
      }
      throw error;
    }
  })());
});

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
  "./js/planner-quality-rotation.js",
  "./js/planner-introduction-policy.js",
  "./js/planner-allergen-maintenance.js",
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

// Die Phase-Readiness ist ein eigenständiger read-only Core und muss für den ersten
// Offline-Start zusammen mit dem übrigen App-Core verfügbar sein.
const PHASE_READINESS_PRECACHE = [
  "./js/phase-readiness.js?v=10.1.26",
];

// Die strukturierte Planprüfung und ihre zentrale Lösungsschicht müssen vor dem
// nächsten Offline-Render gemeinsam verfügbar sein.
const PLAN_CHECK_PRECACHE = [
  "./js/plan-checks.js?v=10.1.26",
  "./js/planner-plan-check-solutions.js?v=10.1.26",
  "./js/plan-checks-solution-preservation.js?v=10.1.26",
  "./js/plan-checks-ui.js?v=10.1.26",
  "./js/plan-checks-contract-extension.js?v=10.1.26",
  "./js/plan-checks-ui-core.js?v=10.1.26",
];

// Zusätzliche UI-/Flow-Dateien, die nicht im statischen FILES-Stamm von sw-core.js liegen.
// Dateien, die index.html mit ?v=10.1.26 lädt, werden unter exakt derselben URL precached.
// Dadurch überschreibt ein Service-Worker-Update auch einen bereits vorhandenen direkten
// Query-Cachetreffer und liefert die aktuelle UI-/Flow-Runtime beim nächsten Start.
const UI_PRECACHE = [
  "./ui-meal-editor-footer.css?v=10.1.26",
  "./flow-dialog-ui.css?v=10.1.26",
  "./catalog-navigation.css",
  "./plan-checks-ui.css?v=10.1.26",
  "./js/deferred-render.js?v=10.1.26",
  "./js/manual-meal-flow.js",
  "./js/recipe-v2-component-options.js",
  "./js/meal-editor-recipe-variants.js",
  "./js/flow-dialog-ui.js",
  "./js/planned-recipe-details.js?v=10.1.26",
  "./js/meal-card-unification.js?v=10.1.26",
  "./js/recipe-frozen-ingredient-stock.js",
  "./js/planner-log-rollover.js",
  "./js/planner-log-rollover-cascade.js",
  "./js/planner-log-rollover-review-fixes.js",
  "./js/planner-random-swap.js",
  "./js/product-allergens.js",
  "./js/product-allergens-guards.js",
  "./js/catalog-navigation.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const requiredPrecache = [
      ...new Set([
        ...FILES,
        ...PLAN08_PRECACHE,
        ...HANDLING_PRECACHE,
        ...UNIFIED_LOG_PRECACHE,
        ...UI_PRECACHE,
        ...PHASE_READINESS_PRECACHE,
        ...PLAN_CHECK_PRECACHE,
      ]),
    ];
    const cache = await caches.open(CACHE);
    const requests = requiredPrecache.map((url) => new Request(url, { cache: "reload" }));
    await cache.addAll(requests);
    await self.skipWaiting();
  })());
});
