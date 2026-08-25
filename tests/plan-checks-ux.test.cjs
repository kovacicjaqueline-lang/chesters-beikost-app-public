const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("Planhinweise konsumieren den strukturierten AP3-Vertrag und filtern nach Typ", () => {
  assert.match(ui, /window\.PlannerPlanChecks\.report\(days/);
  assert.match(ui, /item\.type === "hard_blocker"/);
  assert.match(ui, /item\.type === "open_goal"/);
  assert.doesNotMatch(ui.slice(ui.indexOf("function renderPlanQuality"), ui.indexOf("function availableExtraMeals")), /planQualityIssues\(/);
});

test("Projected-Coverage und Empfehlungen werden nicht als Wochenbanner gerendert", () => {
  const renderer = ui.slice(ui.indexOf("function renderPlanQuality"), ui.indexOf("function availableExtraMeals"));
  assert.doesNotMatch(renderer, /projected_covered_goal|recommendation/);
  assert.doesNotMatch(renderer, /Alles in Ordnung|Alle Ziele erfüllt|<b>Planprüfung<\/b>/);
});

test("Allergenlösung ist konkret, sequenziell und verwirft abgelehnte Kandidaten", () => {
  assert.match(ui, /zur geplanten Mahlzeit „\$\{esc\(currentTitle\)\}“ ergänzen/);
  assert.match(ui, /Andere Lösung/);
  assert.match(ui, /planCheckUxSession\.rejected\.add/);
  assert.match(ui, /goals\.sort\(.*lastEatenDate/s);
  assert.match(ui, /Diese Woche so lassen/);
});

test("Bestätigte Änderungen erhalten Manual- und Lock-Modus", () => {
  assert.match(ui, /let mode = existingLock\?\.mode \|\| \(existingManual \? "manual" : "auto"\)/);
  assert.match(ui, /state\.planLocks\[key\]\.mode = mode/);
  assert.match(ui, /if \(existingManual\) state\.manualMeals\[key\]/);
});

test("Harte Fehler verdrängen offene Ziele und werden gemeinsam bestätigt", () => {
  const renderer = ui.slice(ui.indexOf("function renderPlanQuality"), ui.indexOf("function availableExtraMeals"));
  assert.match(renderer, /if \(blockers\.length\)/);
  assert.match(renderer, /openHardBlockerSolution\(blockers\)/);
  assert.match(ui, /Vorgeschlagene Korrektur/);
  assert.match(ui, /Änderungen übernehmen/);
});

test("Phase-Readiness bleibt separat und öffnet die bestehende Phasenbestätigung", () => {
  assert.match(ui, /Phase-Details ansehen/);
  assert.match(ui, /readiness\?\.signals/);
  assert.match(ui, /Die nächste Phase wird noch nicht empfohlen/);
  assert.match(ui, /requestPhase\(1\)/);
  assert.ok(html.indexOf('id="phaseCard"') < html.indexOf('id="planQuality"'));
});

test("Erfolgreiche Planänderungen verwenden die temporäre Toast-Meldung", () => {
  assert.match(ui, /showToast\("Plan aktualisiert"\)/);
});
