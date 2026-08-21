const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ui-meal-editor-footer.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/app-tests.yml'),
  'utf8',
);

test('Mahlzeit-Editor lädt den isolierten Footer-Fix nach dem Hauptstylesheet mit derselben Asset-Version', () => {
  const match = html.match(
    /styles\.css\?v=([^"']+)[^]*ui-meal-editor-footer\.css\?v=([^"']+)/,
  );
  assert.ok(match, 'beide Stylesheets müssen in der richtigen Reihenfolge geladen werden');
  assert.equal(match[1], match[2]);
});

test('Mahlzeit-Editor nutzt auf iPhone den nativen Sheet-Scroll statt eines inneren Fokus-Scrollcontainers', () => {
  assert.match(
    css,
    /#genericModal:has\(#cancelManualMeal\) \.sheet\s*\{[^}]*display:\s*block;[^}]*height:\s*auto;[^}]*max-height:\s*92dvh;[^}]*overflow-y:\s*auto;[^}]*-webkit-overflow-scrolling:\s*touch;[^}]*padding-bottom:\s*0;/,
  );
  assert.match(
    css,
    /#genericModal:has\(#cancelManualMeal\) #genericBody\s*\{[^}]*display:\s*block;[^}]*min-height:\s*0;[^}]*overflow:\s*visible;/,
  );
  const bodyRule = css.match(/#genericModal:has\(#cancelManualMeal\) #genericBody\s*\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(bodyRule, /overflow-y\s*:\s*auto/);
});

test('Suchergebnisse erzeugen keinen zweiten verschachtelten Scrollbereich', () => {
  assert.match(
    css,
    /#genericModal:has\(#cancelManualMeal\) \.selector-results\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/,
  );
  assert.doesNotMatch(
    css,
    /#genericModal:has\(#cancelManualMeal\) \.selector-results\s*\{[^}]*overflow-y:\s*auto;/,
  );
});

test('Mahlzeit-Editor-Footer belegt echten Layoutplatz und berücksichtigt die iPhone-Safe-Area', () => {
  assert.match(
    css,
    /#genericModal:has\(#cancelManualMeal\) \.sticky-form-actions\s*\{[^}]*position:\s*static;[^}]*safe-area-inset-bottom[^}]*background:\s*var\(--bg\) !important;[^}]*z-index:\s*auto;/,
  );
});

test('iPhone-Tastatur wird vom Editor abgedeckt, ohne die App-Shell beim Schließen versteckt zu lassen', () => {
  assert.doesNotMatch(
    css,
    /body:has\(#genericModal\.open #cancelManualMeal\)[^]*visibility:\s*hidden;/,
  );
  assert.match(
    css,
    /#genericModal:has\(#cancelManualMeal\)::before\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*-100vh 0;[^}]*background:\s*var\(--bg\);/,
  );
  assert.match(
    css,
    /#genericModal:has\(#mealSelectorSearch:focus\)::before\s*\{[^}]*background:\s*#9e988f;/,
  );
  assert.match(
    css,
    /#genericModal:has\(#cancelManualMeal\)\s*\{[^}]*z-index:\s*90;/,
  );
  assert.doesNotMatch(
    css,
    /body:has\(#genericModal\.open #cancelManualMeal\)\s*\{[^}]*overflow:\s*hidden;/,
  );
});

test('Mahlzeit-Suche bleibt bei iPhone-Fokus in normaler Breite ohne transformierten Compositing-Kontext', () => {
  assert.match(
    css,
    /#genericModal:has\(#cancelManualMeal\) #mealSelectorSearch\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*font-size:\s*16px;/,
  );
  const sheetRule = css.match(/#genericModal:has\(#cancelManualMeal\) \.sheet\s*\{([^}]*)\}/)?.[1] || '';
  const footerRule = css.match(/#genericModal:has\(#cancelManualMeal\) \.sticky-form-actions\s*\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(sheetRule, /transform\s*:/);
  assert.doesNotMatch(sheetRule, /backface-visibility\s*:/);
  assert.doesNotMatch(footerRule, /transform\s*:/);
  assert.doesNotMatch(footerRule, /backface-visibility\s*:/);
});

test('isoliertes Footer-Stylesheet ist auch im PWA-Precache enthalten', () => {
  assert.match(serviceWorker, /ui-meal-editor-footer\.css/);
});

test('UI-Regressionen laufen bei HTML-, CSS- und Service-Worker-Änderungen automatisch', () => {
  assert.match(workflow, /- 'index\.html'/);
  assert.match(workflow, /- '\*\*\/\*\.css'/);
  assert.match(workflow, /- 'sw\.js'/);
});
