const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

for (const id of ['foodSearch', 'recipeSearch']) {
  test(`${id} uses a native search input with a clear control`, () => {
    assert.match(
      html,
      new RegExp(`<input[^>]*type=["']search["'][^>]*id=["']${id}["'][^>]*>`),
    );
  });
}
