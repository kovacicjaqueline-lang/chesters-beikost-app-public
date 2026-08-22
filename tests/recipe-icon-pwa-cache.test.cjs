"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const icons = fs.readFileSync(path.join(ROOT, "js/icons.js"), "utf8");
const recipeCss = fs.readFileSync(path.join(ROOT, "ui-meal-editor-footer.css"), "utf8");
const plannedRecipeDetails = fs.readFileSync(
  path.join(ROOT, "js", "planned-recipe-details.js"),
  "utf8",
);

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

test("graded-bite-Wraps haben eigene Recipe-V2-Assets und werden beim ersten Offline-Start precached", () => {
  const expected = {
    "Pizza Wrap": "assets/illustrations-v2/recipes/pizza-wrap.svg",
    "Chicken Fajita Wrap": "assets/illustrations-v2/recipes/chicken-fajita-wrap.svg",
  };
  for (const [name, asset] of Object.entries(expected)) {
    assert.ok(fs.existsSync(path.join(ROOT, asset)), `${name}: eigenes Recipe-V2-Asset fehlt`);
    assert.ok(icons.includes(`"${name}": "${asset}"`), `${name}: Runtime-Mapping fehlt`);
    assert.ok(worker.includes(`"./${asset}"`), `${name}: PWA-Precache fehlt`);
  }
  assert.notEqual(expected["Pizza Wrap"], expected["Chicken Fajita Wrap"]);
});

test("der frisch gecachte Stylesheet enthält die Recipe-V2-Brei-Normalisierung", () => {
  assert.match(recipeCss, /\.illustration-icon--recipe > \.illustration-icon__asset\[src\*="\/recipes\/"\]\[src\*="brei"\]/);
  assert.match(
    recipeCss,
    /\.illustration-icon__asset\[src\*="\/recipes\/milch-getreide-brei\.svg"\]\s*\{[\s\S]*?--recipe-brei-size:\s*[0-9.]+%;/,
  );
});

test("geplante Rezeptdetails werden unter exakt der in index.html verwendeten JS-URL frisch precached", () => {
  const match = index.match(/src="(js\/planned-recipe-details\.js\?v=[^"]+)"/);
  assert.ok(match, "index.html muss die versionierte Planned-Recipe-Details-Runtime referenzieren");

  const scriptUrl = `./${match[1]}`;
  assert.ok(
    worker.includes(`"${scriptUrl}"`),
    `sw.js muss ${scriptUrl} direkt precachen, damit kein alter Query-Cachetreffer Klick und Markierung des Rezeptnamens überdeckt`,
  );
  assert.match(worker, /new Request\(url, \{ cache: "reload" \}\)/, "UI-Precache muss den HTTP-Cache umgehen");
  assert.match(plannedRecipeDetails, /node\.style\.color = "var\(--accent\)"/);
  assert.match(plannedRecipeDetails, /planned-recipe-chevron/);
  assert.match(plannedRecipeDetails, /document\.addEventListener\("click"/);
});
