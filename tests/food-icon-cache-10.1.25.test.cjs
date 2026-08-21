"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const wrapper = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const core = fs.readFileSync(path.join(ROOT, "sw-core.js"), "utf8");
const icons = fs.readFileSync(path.join(ROOT, "js", "icons.js"), "utf8");
const appVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "VERSION.json"), "utf8")).version;
const cacheVersion = appVersion.replace(/\./g, "-");

test("finaler FOOD-Iconstand behält den frischen Service-Worker-Cache und die bestehende Kernlogik", () => {
  assert.match(wrapper, /importScripts\("\.\/sw-core\.js"\)/);
  assert.match(core, new RegExp(`const CACHE='chester-beikost-v${cacheVersion}-icons-final'`));
  assert.match(core, /cache:'reload'/, "Kern-Precache muss Assets am HTTP-Cache vorbei frisch laden");
  assert.match(core, /keys\.filter\(key=>key!==CACHE\)\.map\(key=>caches\.delete\(key\)\)/, "alte App-Caches werden bei Aktivierung entfernt");
});

test("Honig nutzt sein eigenes Food-V2-Asset und wird precached", () => {
  assert.match(icons, /"honig": "assets\/illustrations-v2\/foods\/honig\.svg"/);
  assert.match(core, /"\.\/assets\/illustrations-v2\/foods\/honig\.svg"/);
  assert.ok(fs.existsSync(path.join(ROOT, "assets", "illustrations-v2", "foods", "honig.svg")));
});
