const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/app-tests.yml'),
  'utf8',
);

test('Mahlzeit-Editor lädt den isolierten Footer-Fix nach dem Hauptstylesheet mit eigenem Cache-Schlüssel', () => {
  const match = html.match(
    /styles\.css\?v=([^"']+)[^]*ui-meal-editor-footer\.css\?v=([^"']+)/,
  );
  assert.ok(match, 'beide Stylesheets müssen in der richtigen Reihenfolge geladen werden');
  assert.notEqual(match[1], match[2], 'der Footer-Fix muss separat cache-bustbar sein');
  assert.equal(match[2], '10.1.26-circle-r2');
  assert.ok(serviceWorker.includes(`"./ui-meal-editor-footer.css?v=${match[2]}"`));
});

test('isoliertes Footer-Stylesheet ist auch im PWA-Precache enthalten', () => {
  assert.match(serviceWorker, /ui-meal-editor-footer\.css/);
});

test('UI-Regressionen werden bei HTML-, CSS- und Service-Worker-Änderungen nicht vom Workflow-Trigger ausgeschlossen', () => {
  assert.match(workflow, /paths-ignore:/);
  assert.doesNotMatch(workflow, /- 'index\.html'/);
  assert.doesNotMatch(workflow, /- '\*\*\/\*\.css'/);
  assert.doesNotMatch(workflow, /- 'sw\.js'/);
});
