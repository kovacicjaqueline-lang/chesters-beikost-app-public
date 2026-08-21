"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function source(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function versionedQueries(text) {
  return [...text.matchAll(/\?v=(\d+\.\d+\.\d+)/g)].map((match) => match[1]);
}

function serviceWorkerCacheVersion(text) {
  const match = text.match(/const CACHE=['"]chester-beikost-v(\d+)-(\d+)-(\d+)(?:-[^'"]*)?['"]/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : "";
}

test("aktive Asset-Querystrings verwenden durchgehend die kanonische App-Version", () => {
  const version = JSON.parse(source("VERSION.json")).version;
  const runtimeSources = [
    "index.html",
    "js/utils.js",
    "js/planner-log-rollover-cascade.js",
  ];

  for (const file of runtimeSources) {
    const actualVersions = versionedQueries(source(file));
    assert.ok(actualVersions.length > 0, `${file} muss versionierte Assets enthalten`);
    for (const actual of actualVersions) assert.equal(actual, version, `${file} verwendet eine veraltete Asset-Version`);
  }
});

test("Service-Worker-Cache verwendet die kanonische App-Version", () => {
  const version = JSON.parse(source("VERSION.json")).version;
  const cacheVersion = serviceWorkerCacheVersion(source("sw-core.js"));

  assert.ok(cacheVersion, "sw-core.js muss einen versionierten App-Cache definieren");
  assert.equal(cacheVersion, version);
});
