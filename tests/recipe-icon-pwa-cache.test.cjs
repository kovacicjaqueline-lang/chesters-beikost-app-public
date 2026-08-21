"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const recipeCss = fs.readFileSync(path.join(ROOT, "ui-meal-editor-footer.css"), "utf8");

test("Recipe-V2 sizing CSS wird unter exakt der in index.html verwendeten URL frisch precached", () => {
  const match = index.match(/href="(ui-meal-editor-footer\.css\?v=[^"]+)"/);
  assert.ok(match, "index.html muss die versionierte UI-CSS referenzieren");

  const cssUrl = `./${match[1]}`;
  assert.ok(
    worker.includes(`"${cssUrl}"`),
    `sw.js muss ${cssUrl} direkt precachen, damit kein alter Query-Cachetreffer die Recipe-Icon-Skalierung überdeckt`,
  );
  assert.match(worker, /new Request\(url, \{ cache: "reload" \}\)/, "UI-Precache muss den HTTP-Cache umgehen");
});

test("der frisch gecachte Stylesheet enthält die Recipe-V2-Brei-Normalisierung", () => {
  assert.match(recipeCss, /\.illustration-icon--recipe > \.illustration-icon__asset\[src\*="\/recipes\/"\]\[src\*="brei"\]/);
  assert.match(recipeCss, /milch-getreide-brei\.svg/);
  assert.match(recipeCss, /--recipe-brei-size:\s*222\.609%/);
});
