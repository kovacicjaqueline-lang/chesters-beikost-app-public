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

test("aktive Asset-Querystrings verwenden durchgehend die kanonische App-Version", () => {
  const version = JSON.parse(source("VERSION.json")).version;
  const indexVersions = versionedQueries(source("index.html"));
  const dynamicLoaderVersions = versionedQueries(source("js/planner-log-rollover-cascade.js"));

  assert.ok(indexVersions.length > 0, "index.html muss versionierte Assets enthalten");
  assert.ok(dynamicLoaderVersions.length > 0, "dynamische Loader müssen versionierte Assets enthalten");
  for (const actual of [...indexVersions, ...dynamicLoaderVersions]) {
    assert.equal(actual, version);
  }
});
