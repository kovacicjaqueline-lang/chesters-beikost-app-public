"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const wrapper = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const core = fs.readFileSync(path.join(ROOT, "sw-core.js"), "utf8");

test("finaler FOOD-Iconstand behält den frischen Service-Worker-Cache und die bestehende Kernlogik", () => {
  assert.match(wrapper, /importScripts\("\.\/sw-core\.js"\)/);
  assert.match(core, /const CACHE='chester-beikost-v10-1-25-icons-final'/);
  assert.match(core, /cache:'reload'/, "Kern-Precache muss Assets am HTTP-Cache vorbei frisch laden");
  assert.match(core, /keys\.filter\(key=>key!==CACHE\)\.map\(key=>caches\.delete\(key\)\)/, "alte App-Caches werden bei Aktivierung entfernt");
});
