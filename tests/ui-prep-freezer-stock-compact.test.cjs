const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const prep = fs.readFileSync(path.join(root, 'js/prep.js'), 'utf8');
const inventoryBlock = prep.match(
  /let sizes = \[\.\.\.new Set\([\s\S]*?document\.querySelectorAll\("\.editInv"\)/,
)?.[0];

assert.ok(inventoryBlock, 'Gefriervorrat-Rendering muss auffindbar sein');

test('ein einzelner Gefriervorrat zeigt keine redundanten Vorratslabels', () => {
  assert.doesNotMatch(inventoryBlock, />Vorrat<\/span>/);
  assert.match(inventoryBlock, /batches\.length > 1/);
  assert.match(inventoryBlock, /Älteste Charge · zuerst verwenden/);
  assert.doesNotMatch(inventoryBlock, /<b class="small">Vorrat /);
});

test('Mengen- und Altersangaben sind schnell lesbar formuliert', () => {
  assert.match(inventoryBlock, /total === 1 \? "Portion" : "Portionen"/);
  assert.match(inventoryBlock, /· je \$\{esc\(sizes\[0\]\)\}/);
  assert.match(inventoryBlock, /age === 1 \? "Tag" : "Tage"/);
});

test('Bearbeiten und Löschen bleiben direkt erreichbar, dominieren die Karte aber nicht', () => {
  assert.match(inventoryBlock, /class="iconbtn editInv" aria-label="Vorratseintrag bearbeiten"/);
  assert.match(inventoryBlock, /class="iconbtn deleteInv" aria-label="Vorratseintrag löschen"/);
  assert.doesNotMatch(inventoryBlock, />Bearbeiten<\/button>/);
  assert.doesNotMatch(inventoryBlock, />×<\/button>/);
  assert.match(inventoryBlock, /padding:10px 12px/);
  assert.match(inventoryBlock, /padding:6px 0/);
});
