const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'ui-meal-editor-footer.css'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');

test('UI-06: erledigte Plan-Tage bleiben im normalen Kartenraster und behalten den Akzent innen', () => {
  assert.match(
    css,
    /#blockPlan\s*>\s*\.completed-day\s*\{[^}]*border-left:\s*0;[^}]*margin-left:\s*0;[^}]*padding:\s*0;[^}]*box-shadow:\s*inset\s+5px\s+0\s+0\s+var\(--accent\),\s*var\(--shadow\);/,
  );
});

test('UI-06: Summary und aufgeklappter Inhalt haben genau einmal die normale Karten-Einrückung', () => {
  const cardPadding = Number(
    styles.match(/\.card\{[^}]*padding:(\d+)px;/)[1],
  );
  const match = css.match(
    /#blockPlan\s*>\s*\.completed-day\s*>\s*summary,\s*#blockPlan\s*>\s*\.completed-day\s*>\s*\.completed-day-body\s*\{[^}]*padding-left:\s*(\d+)px;/,
  );

  assert.ok(match, 'Summary und Body müssen gemeinsam ausgerichtet sein');
  assert.equal(Number(match[1]), cardPadding);
});

test('UI-06: Karte bleibt ein aufklappbares completed-day-Element mit unverändertem Inhalt', () => {
  assert.match(
    ui,
    /<details class="card block completed-day">[^]*<span class="completed-day-title">\$\{esc\(label\)\} erledigt<\/span>[^]*<div class="completed-day-body">/,
  );
});

test('UI-07: kompakte Zusatzaktion wird durch UI-06 nicht auf Kartenbreite umdefiniert', () => {
  assert.doesNotMatch(css, /add-meal-row|availableExtraMeals|Frühstück oder Abendessen/);
});
