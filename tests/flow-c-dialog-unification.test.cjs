"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const runtime = fs.readFileSync(path.join(root, "js", "flow-dialog-ui.js"), "utf8");
const css = fs.readFileSync(path.join(root, "flow-dialog-ui.css"), "utf8");
const logSource = fs.readFileSync(path.join(root, "js", "log.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("FLOW-C lädt eine zentrale Dialog-UI nach den bestehenden Basisstyles und vor app.js", () => {
  const mainCss = index.indexOf('ui-meal-editor-footer.css?v=10.1.26');
  const flowCss = index.indexOf('flow-dialog-ui.css?v=10.1.26');
  const flowRuntime = index.indexOf('js/flow-dialog-ui.js?v=10.1.26');
  const app = index.indexOf('app.js?v=10.1.26');
  assert.ok(mainCss >= 0 && flowCss > mainCss, "FLOW-C CSS muss den bestehenden Sheet-Fix zentral erweitern");
  assert.ok(flowRuntime >= 0 && app > flowRuntime, "FLOW-C Runtime muss vor dem App-Binding installiert sein");
});

test("Plan- und Log-Dialog verwenden dieselbe Shell statt vier Sondervarianten", () => {
  assert.match(css, /#genericModal\.flow-dialog,\s*#logModal\.flow-dialog/);
  assert.match(css, /#genericModal\.flow-dialog \.flow-dialog-sheet,\s*#logModal\.flow-dialog \.flow-dialog-sheet/);
  assert.match(css, /#genericModal\.flow-dialog \.flow-dialog-actions,\s*#logModal\.flow-dialog \.flow-dialog-actions/);
  assert.match(runtime, /decorate\(genericModal, genericBody, subtitle\)/);
  assert.match(runtime, /decorate\(logModal, logBody, subtitle\)/);
});

test("gemeinsame Header-Hierarchie trennt Aktionstitel vom Mahlzeitenkontext", () => {
  assert.match(runtime, /\^\(Mahlzeit hinzufügen\|Mahlzeit bearbeiten\)\\s\*·\\s\*\(\.\+\)\$/);
  assert.match(runtime, /genericModal\.dataset\.flowDialogContext/);
  assert.match(runtime, /flow-dialog-title/);
  assert.match(runtime, /flow-dialog-subtitle/);
});

test("FLOW-C dekoriert nur DOM-Struktur und überschreibt keine fachlichen Controller", () => {
  const controllerAssignment = /^\s*(?:openGeneric|closeGeneric|openManualMealSelector|renderLogForm|saveLog)\s*=/m;
  assert.doesNotMatch(runtime, controllerAssignment, "FLOW-C darf keine bestehenden Controller-Funktionen neu zuweisen");
  assert.doesNotMatch(runtime, /\boriginal(?:OpenGeneric|CloseGeneric|OpenManualMealSelector|RenderLogForm)\b/, "FLOW-C darf Controller nicht über Wrapper ersetzen");
  assert.match(runtime, /new MutationObserver\(syncGeneric\)/);
  assert.match(runtime, /new MutationObserver\(syncLog\)/);
  assert.equal(runtime.includes("state.logs"), false);
  assert.equal(runtime.includes("pendingLog.meal"), false);
  assert.equal(runtime.includes("foodRoles"), false);
  assert.equal(runtime.includes("textureStage"), false);
});

test("FLOW-C beobachtet den App-Boot nicht mit breiten Subtree-Observern", () => {
  assert.match(runtime, /genericStateObserver\.observe\(genericModal,\s*\{\s*attributes:\s*true,\s*attributeFilter:\s*\["class"\],\s*\}\);/s);
  assert.match(runtime, /logStateObserver\.observe\(logModal,\s*\{\s*attributes:\s*true,\s*attributeFilter:\s*\["class"\],\s*\}\);/s);
  assert.match(runtime, /genericContentObserver\.observe\(genericBody,\s*\{\s*childList:\s*true,\s*subtree:\s*true,\s*characterData:\s*true,\s*\}\);/s);
  assert.match(runtime, /logContentObserver\.observe\(logBody,\s*\{\s*childList:\s*true,\s*subtree:\s*true,\s*characterData:\s*true,\s*\}\);/s);
  assert.doesNotMatch(runtime, /observe\(genericModal,[\s\S]{0,180}subtree:\s*true/);
  assert.doesNotMatch(runtime, /observe\(logModal,[\s\S]{0,180}subtree:\s*true/);
});

test("Mobile-Dialoge nutzen einen nativen Sheet-Scroll ohne verschachtelte Ergebnis-Scroller", () => {
  assert.match(css, /max-height:\s*92dvh/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
  assert.match(css, /scroll-padding-bottom:\s*calc\(118px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.selector-results,[\s\S]*\.log-food-results,[\s\S]*\.log-recipe-results\s*\{[\s\S]*max-height:\s*none;[\s\S]*overflow:\s*visible;/);
});

test("freier Essenseintrag bleibt ohne erzwungene Mahlzeitenzuordnung", () => {
  assert.match(logSource, /if \(!mealContext && !input\.editId\) input\.meal = "";/, "freie neue Einträge müssen ihren Mahlzeitenkontext weiterhin leeren");
  assert.match(logSource, /let logContext = p\.__mealContext[\s\S]*\? `[\s\S]*id="logMeal"[\s\S]*:\s*`<div class="log-date-grid">/, "die Mahlzeitenauswahl darf nur im bestehenden Mahlzeitenkontext gerendert werden");
});

test("FLOW-C Assets sind für den installierten PWA-Stand precached", () => {
  assert.match(sw, /\.\/flow-dialog-ui\.css\?v=10\.1\.26/);
  assert.match(sw, /\.\/js\/flow-dialog-ui\.js/);
});
