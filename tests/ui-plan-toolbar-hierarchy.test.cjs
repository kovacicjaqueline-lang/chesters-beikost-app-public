const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'ui-meal-editor-footer.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function lastRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  return matches.at(-1)?.[1] || '';
}

// Die Reihenfolge wird absichtlich im DOM geprüft, nicht über rein visuelles CSS-order.
test('Wochenplan-Kopf hat dieselbe visuelle und semantische DOM-Reihenfolge', () => {
  const plan = html.match(/<section id="plan" class="view">[\s\S]*?<div id="blockPlan"><\/div>/)?.[0] || '';
  const controls = plan.indexOf('class="plan-controls"');
  const defaults = plan.indexOf('id="planDefaults"');
  const locks = plan.indexOf('id="planLockSummary"');
  const quality = plan.indexOf('id="planQuality"');
  const secondary = plan.indexOf('class="plan-secondary-actions"');

  assert.ok(controls >= 0 && defaults > controls, 'Planbasis steht nach den Hauptaktionen');
  assert.ok(locks > defaults, 'Lockstatus steht nach der Planbasis');
  assert.ok(quality > locks, 'Planprüfung steht nach dem Lockstatus');
  assert.ok(secondary > quality, 'Weitere Planaktionen stehen nach der Planprüfung');
  assert.doesNotMatch(css, /#plan [^{]+\{[^}]*\border\s*:/s);
});

test('Planbasis und Lockstatus verwenden keine eigenen Kartenflächen mehr', () => {
  const defaultsLine = lastRule('#plan .plan-defaults-compact .plan-defaults-line');
  assert.match(defaultsLine, /padding:\s*0/);
  assert.match(defaultsLine, /border-radius:\s*0/);
  assert.match(defaultsLine, /background:\s*transparent/);

  const lockStrip = lastRule('#plan .plan-lock-strip');
  assert.match(lockStrip, /padding:\s*0/);
  assert.match(lockStrip, /border:\s*0/);
  assert.match(lockStrip, /border-radius:\s*0/);
  assert.match(lockStrip, /background:\s*transparent/);
});

test('Leerer Lockstatus wird ausgeblendet, echte Lock-Zahlen bleiben sichtbar', () => {
  assert.match(
    css,
    /#plan \.plan-lock-strip:not\(:has\(\.plan-lock-text > b\)\)\s*\{[\s\S]*?display:\s*none;?[\s\S]*?\}/,
  );
});
