const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const recipeFirst = fs.readFileSync(path.join(root, 'js', 'planner-recipe-first.js'), 'utf8');

test('PLAN-08 Prep-Erweiterung erhält bestehende Button-Listener im echten DOM', () => {
  assert.match(
    recipeFirst,
    /typeof prepNow\.insertAdjacentHTML === \"function\"[\s\S]*insertAdjacentHTML\(\"afterbegin\", recipeHtml\)/,
  );
});

test('PLAN-08 ersetzt den Prep-Inhalt im Browserpfad nicht mehr komplett per innerHTML', () => {
  const guardedBrowserPath = recipeFirst.match(/if \(typeof prepNow\.insertAdjacentHTML === \"function\"\) \{([\s\S]*?)\n    \} else \{/);
  assert.ok(guardedBrowserPath, 'Browser-DOM-Pfad fehlt');
  assert.doesNotMatch(guardedBrowserPath[1], /prepNow\.innerHTML\s*=/);
});
