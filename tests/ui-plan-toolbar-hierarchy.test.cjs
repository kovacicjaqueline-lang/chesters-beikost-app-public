const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'ui-meal-editor-footer.css'), 'utf8');

function lastRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  return matches.at(-1)?.[1] || '';
}

test('Wochenplan-Kopf ordnet Planbasis, Lockstatus, Prüfung und Zusatzaktionen ruhig', () => {
  assert.match(lastRule('#plan .plan-toolbar'), /display:\s*flex/);
  assert.match(lastRule('#plan .plan-toolbar'), /flex-direction:\s*column/);
  assert.match(lastRule('#plan .plan-defaults.plan-defaults-compact'), /order:\s*3/);
  assert.match(lastRule('#plan .plan-lock-strip'), /order:\s*4/);
  assert.match(lastRule('#plan #planQuality'), /order:\s*5/);
  assert.match(lastRule('#plan .plan-secondary-actions'), /order:\s*6/);
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
