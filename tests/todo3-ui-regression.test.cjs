const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('TODO3 UI-01: Mehr-Karten behalten das gemeinsame Innenraster', () => {
  assert.match(css, /UI-01:[^]*?#more\s+\.collapsible-card\s*\{[^}]*padding\s*:\s*0\s*;/);
});

test('TODO3 UI-02: feste Sheet-Aktionsleiste bleibt undurchsichtig', () => {
  assert.match(css, /UI-02:[^]*?\.sticky-form-actions\s*\{[^}]*background\s*:\s*var\(--bg\)!important\s*;/);
  assert.match(css, /\.inventory-form-note\s*\{[^}]*margin-bottom\s*:\s*0\s*;?\s*\}/);
});

test('TODO3 UI-03: Plan-Kerninhalt behält Vorrang und lange Titel werden nicht künstlich mitten im Wort gebrochen', () => {
  assert.match(css, /UI-03:[^]*?\.meal-summary-row[^]*?grid-template-columns\s*:\s*minmax\(0,1fr\)\s+40px\s*;/);
  assert.match(css, /\.dish-title[^]*?overflow-wrap\s*:\s*break-word\s*;[^]*?word-break\s*:\s*normal\s*;[^]*?hyphens\s*:\s*none\s*;/);
});

test('TODO3 UI-04: Zusatzmahlzeiten-Aktion bleibt bewusst kompakt und zentriert; kein UI-07-Breitenfehler', () => {
  assert.match(css, /UI-04:[^]*?\.add-meal-row\s*\{[^}]*justify-content\s*:\s*center!important\s*;[^}]*text-align\s*:\s*center\s*;/);
  assert.match(css, /\.add-meal-row\s+\.btn\s*\{[^}]*text-align\s*:\s*center\s*;/);
});

test('TODO3 UI-05: kleine Inline-Aktionen dürfen nicht unter ihre Textbreite schrumpfen', () => {
  assert.match(css, /UI-05:[^]*?\.selected-target-row>\.btn\s*\{[^}]*flex\s*:\s*0\s+0\s+auto\s*;[^}]*min-width\s*:\s*max-content\s*;[^}]*white-space\s*:\s*nowrap\s*;/);
});
