"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const SW_SOURCE = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
const CURRENT_CACHE = "test-app-cache-v2";
const OLD_CACHE = "test-app-cache-v1";
const CORE_FILES = ["./", "./index.html", "./app.js"];
const REQUIRED_POLICY_ASSET = "./js/planner-meal-eligibility.js";

function responseFor(url) {
  return {
    ok: true,
    url,
    clone() {
      return responseFor(url);
    },
  };
}

function createHarness({ failUrl = "" } = {}) {
  const listeners = new Map();
  const deletedCaches = [];
  const cacheData = new Map([
    [
      OLD_CACHE,
      new Map([
        ["./", { source: "old-shell" }],
        ["./index.html", { source: "old-index" }],
        ["./app.js", { source: "old-app" }],
      ]),
    ],
    [CURRENT_CACHE, new Map()],
  ]);
  let skipWaitingCalls = 0;
  let claimCalls = 0;

  const requestUrl = (request) => typeof request === "string" ? request : request.url;

  async function fetchImpl(request) {
    const url = requestUrl(request);
    if (url === failUrl) throw new Error(`network failure for ${url}`);
    return responseFor(url);
  }

  function cacheFor(name) {
    if (!cacheData.has(name)) cacheData.set(name, new Map());
    const entries = cacheData.get(name);
    return {
      async addAll(requests) {
        const staged = [];
        for (const request of requests) {
          const response = await fetchImpl(request);
          if (!response || !response.ok) throw new TypeError(`bad response for ${requestUrl(request)}`);
          staged.push([requestUrl(request), response.clone()]);
        }
        for (const [url, response] of staged) entries.set(url, response);
      },
      async match(request) {
        return entries.get(requestUrl(request)) || null;
      },
      async put(request, response) {
        entries.set(requestUrl(request), response);
      },
    };
  }

  const caches = {
    async open(name) {
      return cacheFor(name);
    },
    async keys() {
      return [...cacheData.keys()];
    },
    async delete(name) {
      deletedCaches.push(name);
      return cacheData.delete(name);
    },
    async match(request) {
      for (const entries of cacheData.values()) {
        const match = entries.get(requestUrl(request));
        if (match) return match;
      }
      return null;
    },
  };

  const self = {
    location: { origin: "https://beikost.test" },
    clients: {
      async claim() {
        claimCalls++;
      },
    },
    async skipWaiting() {
      skipWaitingCalls++;
    },
    addEventListener(type, listener) {
      const list = listeners.get(type) || [];
      list.push(listener);
      listeners.set(type, list);
    },
    removeEventListener(type, listener) {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter((item) => item !== listener));
    },
  };

  const context = vm.createContext({
    self,
    caches,
    fetch: fetchImpl,
    URL,
    console,
    CACHE: CURRENT_CACHE,
    FILES: CORE_FILES,
    Request: class Request {
      constructor(url, options = {}) {
        this.url = url;
        Object.assign(this, options);
      }
    },
    importScripts() {
      // Repräsentiert die Lifecycle-Handler aus sw-core.js. sw.js muss den alten
      // best-effort Install-Handler entfernen, den Activate-Handler aber behalten.
      self.addEventListener("install", (event) => {
        event.waitUntil((async () => {
          const cache = await caches.open(CURRENT_CACHE);
          await Promise.all(CORE_FILES.map(async (url) => {
            try {
              const response = await fetchImpl(new context.Request(url, { cache: "reload" }));
              if (response && response.ok) await cache.put(url, response.clone());
            } catch (_) {
              // Legacy-Verhalten: Fehler wurden verschluckt.
            }
          }));
        })());
        self.skipWaiting();
      });
      self.addEventListener("activate", (event) => {
        event.waitUntil((async () => {
          const keys = await caches.keys();
          await Promise.all(keys.filter((key) => key !== CURRENT_CACHE).map((key) => caches.delete(key)));
          await self.clients.claim();
        })());
      });
      self.addEventListener("fetch", () => {});
    },
  });

  new vm.Script(SW_SOURCE, { filename: "sw.js" }).runInContext(context);

  async function dispatchLifecycle(type) {
    const waitUntilPromises = [];
    for (const listener of listeners.get(type) || []) {
      listener({
        waitUntil(promise) {
          waitUntilPromises.push(Promise.resolve(promise));
        },
      });
    }
    await Promise.all(waitUntilPromises);
  }

  return {
    listeners,
    cacheData,
    deletedCaches,
    dispatchLifecycle,
    get skipWaitingCalls() {
      return skipWaitingCalls;
    },
    get claimCalls() {
      return claimCalls;
    },
  };
}

test("CR-003: Pflichtasset-Fehler bricht die neue Generation ab und lässt den alten Offline-Stand unangetastet", async () => {
  const harness = createHarness({ failUrl: REQUIRED_POLICY_ASSET });

  assert.equal((harness.listeners.get("install") || []).length, 1, "es darf nur einen wirksamen Install-Vertrag geben");
  await assert.rejects(harness.dispatchLifecycle("install"), /network failure/);

  assert.equal(harness.skipWaitingCalls, 0, "fehlgeschlagener Pflicht-Precache darf skipWaiting nicht ausführen");
  assert.deepEqual(harness.deletedCaches, [], "ohne erfolgreiche Installation darf kein alter Cache gelöscht werden");
  assert.equal(harness.cacheData.get(OLD_CACHE).get("./index.html").source, "old-index");
  assert.equal(harness.cacheData.get(OLD_CACHE).get("./app.js").source, "old-app");
  assert.equal(harness.cacheData.get(CURRENT_CACHE).size, 0, "der fehlgeschlagene transaktionale Precache darf keinen Teilstand hinterlassen");
});

test("CR-003: vollständiger Pflicht-Precache aktiviert die neue Generation und bereinigt erst danach den alten Cache", async () => {
  const harness = createHarness();

  await harness.dispatchLifecycle("install");
  assert.equal(harness.skipWaitingCalls, 1);

  const current = harness.cacheData.get(CURRENT_CACHE);
  for (const url of [
    "./index.html",
    REQUIRED_POLICY_ASSET,
    "./js/handling-readiness.js",
    "./js/log-core.js",
    "./js/manual-meal-flow.js",
  ]) {
    assert.ok(current.has(url), `${url} muss Teil des Pflicht-Precaches bleiben`);
  }
  assert.ok(harness.cacheData.has(OLD_CACHE), "alter Cache bleibt bis zum Activate erhalten");

  await harness.dispatchLifecycle("activate");
  assert.deepEqual(harness.deletedCaches, [OLD_CACHE]);
  assert.equal(harness.cacheData.has(OLD_CACHE), false);
  assert.equal(harness.cacheData.has(CURRENT_CACHE), true);
  assert.equal(harness.claimCalls, 1);
});
