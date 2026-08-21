const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.join(__dirname, "..", "ui-meal-editor-footer.css"), "utf8");

test("manual meal editor does not hide the app shell via ancestor :has()", () => {
  assert.doesNotMatch(
    css,
    /body:has\(#genericModal\.open #cancelManualMeal\)[\s\S]{0,700}?visibility\s*:\s*hidden/,
    "Der manuelle Editor darf Header/Main/Nav nicht über einen ancestor-:has()-Visibility-Hack ausblenden.",
  );
});

test("manual meal editor owns an opaque backdrop that disappears with the modal", () => {
  assert.match(
    css,
    /#genericModal:has\(#cancelManualMeal\)::before\s*\{[\s\S]*?position\s*:\s*fixed;[\s\S]*?background\s*:\s*var\(--bg\);[\s\S]*?\}/,
    "Der Editor braucht einen eigenen festen Hintergrund statt versteckter App-Inhalte.",
  );
  assert.match(
    css,
    /#genericModal:has\(#cancelManualMeal\) \.sheet\s*\{[\s\S]*?position\s*:\s*relative;[\s\S]*?z-index\s*:\s*1;/,
    "Das Sheet muss über dem modal-eigenen Hintergrund liegen.",
  );
});
