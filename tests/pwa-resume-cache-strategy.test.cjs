"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const SW_PATH = path.join(__dirname, "..", "sw.js");
const SW_SOURCE = fs.readFileSync(SW_PATH, "utf8");

function createHarness({ matchImpl, fetchImpl }) {
  const listeners = new Map();
  const puts = [];

  const self = {
    location: { origin: "https://beikost.test" },
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

  const cache = {
    async match(request, options = {}) {
      return matchImpl(request, options);
    },
    async put(request, response) {
      puts.push({ name: "test-app-cache", request, response });
    },
  };

  const caches = {
    async open(name) {
      assert.equal(name, "test-app-cache");
      return cache;
    },
  };

  const context = vm.createContext({
    self,
    caches,
    fetch: fetchImpl,
    URL,
    console,
    CACHE: "test-app-cache",
    Request: class Request {
      constructor(url, options = {}) {
        this.url = url;
        Object.assign(this, options);
      }
    },
    importScripts() {
      // Simuliert den bisherigen network-first Fetch-Handler aus sw-core.js.
      // sw.js muss ihn nach dem Import entfernen und genau einen eigenen Handler registrieren.
      self.addEventListener("fetch", () => {
        throw new Error("legacy fetch handler must not remain registered");
      });
    },
  });

  new vm.Script(SW_SOURCE, { filename: "sw.js" }).runInContext(context);

  return { listeners, puts };
}

function dispatchFetch(listener, request) {
  let responsePromise;
  let lifetimePromise;
  listener({
    request,
    respondWith(promise) {
      responsePromise = Promise.resolve(promise);
    },
    waitUntil(promise) {
      lifetimePromise = Promise.resolve(promise);
    },
  });
  assert.ok(responsePromise, "fetch handler must call respondWith");
  assert.ok(lifetimePromise, "fetch handler must extend the event for background refresh");
  return { responsePromise, lifetimePromise };
}

test("PWA resume returns a cached versioned app asset before background network refresh finishes", async () => {
  let fetchCalls = 0;
  let releaseNetwork;
  const cached = { source: "cache" };
  const networkResponse = {
    ok: true,
    source: "network",
    clone() {
      return { ok: true, source: "network-clone" };
    },
  };

  const { listeners, puts } = createHarness({
    async matchImpl(request, options = {}) {
      if (options.ignoreSearch) return cached;
      return null;
    },
    async fetchImpl() {
      fetchCalls++;
      return new Promise((resolve) => {
        releaseNetwork = () => resolve(networkResponse);
      });
    },
  });

  const fetchListeners = listeners.get("fetch") || [];
  assert.equal(fetchListeners.length, 1, "legacy network-first handler must be replaced");

  const request = {
    method: "GET",
    url: "https://beikost.test/app.js?v=10.1.25",
    mode: "same-origin",
  };
  const { responsePromise, lifetimePromise } = dispatchFetch(fetchListeners[0], request);

  const response = await responsePromise;
  assert.equal(response, cached, "cached shell must render immediately");
  assert.equal(fetchCalls, 1, "cached shell must still be refreshed in background");
  assert.equal(puts.length, 0, "background network response is still pending");

  releaseNetwork();
  await lifetimePromise;
  assert.equal(puts.length, 2, "versioned refresh must update both request and canonical cache keys");
  assert.equal(puts[0].request, request);
  assert.equal(puts[1].request, "https://beikost.test/app.js");
  assert.equal(puts[0].response.source, "network-clone");
  assert.equal(puts[1].response.source, "network-clone");
});

test("PWA cache hit stays usable when background refresh is offline", async () => {
  const cached = { source: "cache" };
  const { listeners } = createHarness({
    async matchImpl() {
      return cached;
    },
    async fetchImpl() {
      throw new Error("offline");
    },
  });

  const fetchListener = (listeners.get("fetch") || [])[0];
  const { responsePromise, lifetimePromise } = dispatchFetch(fetchListener, {
    method: "GET",
    url: "https://beikost.test/styles.css?v=10.1.25",
    mode: "same-origin",
  });

  assert.equal(await responsePromise, cached);
  await lifetimePromise;
});

test("PWA cache miss still fetches and stores a successful same-origin response once", async () => {
  let fetchCalls = 0;
  const networkResponse = {
    ok: true,
    source: "network",
    clone() {
      return { ok: true, source: "network-clone" };
    },
  };

  const { listeners, puts } = createHarness({
    async matchImpl() {
      return null;
    },
    async fetchImpl() {
      fetchCalls++;
      return networkResponse;
    },
  });

  const fetchListener = (listeners.get("fetch") || [])[0];
  const request = {
    method: "GET",
    url: "https://beikost.test/new-runtime-file.js",
    mode: "same-origin",
  };
  const { responsePromise, lifetimePromise } = dispatchFetch(fetchListener, request);
  const response = await responsePromise;
  await lifetimePromise;

  assert.equal(response, networkResponse);
  assert.equal(fetchCalls, 1, "cache miss must not duplicate the network request");
  assert.equal(puts.length, 1);
  assert.equal(puts[0].request, request);
  assert.equal(puts[0].response.source, "network-clone");
});

test("PWA navigation keeps the cached index fallback when network is unavailable", async () => {
  const cachedIndex = { source: "cached-index" };

  const { listeners } = createHarness({
    async matchImpl(request) {
      if (request === "./index.html") return cachedIndex;
      return null;
    },
    async fetchImpl() {
      throw new Error("offline");
    },
  });

  const fetchListener = (listeners.get("fetch") || [])[0];
  const { responsePromise, lifetimePromise } = dispatchFetch(fetchListener, {
    method: "GET",
    url: "https://beikost.test/plan",
    mode: "navigate",
  });

  assert.equal(await responsePromise, cachedIndex);
  await lifetimePromise;
});
