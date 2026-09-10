const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const script = resolve(__dirname, '../scripts/pre-push-sanity.mjs');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'prepush-sanity-'));
  git(cwd, ['init', '-b', 'main']);
  git(cwd, ['config', 'user.email', 'test@example.com']);
  git(cwd, ['config', 'user.name', 'Test']);
  writeFileSync(join(cwd, 'tracked.txt'), 'base\n');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', 'base']);
  git(cwd, ['checkout', '-b', 'work']);
  return { cwd };
}

function run(cwd, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
}

test('accepts a clean branch with explicitly allowed changed files', () => {
  const { cwd } = repo();
  mkdirSync(join(cwd, 'docs'));
  writeFileSync(join(cwd, 'docs', 'note.md'), 'ok\n');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', 'change']);

  const result = run(cwd, ['--base-ref', 'main', '--allow', 'docs/note.md']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Pre-Push-Sanity OK/);
});

test('rejects changed files outside the declared scope', () => {
  const { cwd } = repo();
  mkdirSync(join(cwd, 'docs'));
  writeFileSync(join(cwd, 'docs', 'note.md'), 'ok\n');
  writeFileSync(join(cwd, 'rogue.txt'), 'unexpected\n');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', 'change']);

  const result = run(cwd, ['--base-ref', 'main', '--allow', 'docs/note.md']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unerwartete Dateien/);
  assert.match(result.stderr, /rogue\.txt/);
});

test('rejects zero-byte changed files unless explicitly allowed', () => {
  const { cwd } = repo();
  writeFileSync(join(cwd, 'empty.txt'), '');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', 'empty']);

  const blocked = run(cwd, ['--base-ref', 'main', '--allow', 'empty.txt']);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /0-Byte-Dateien/);

  const allowed = run(cwd, ['--base-ref', 'main', '--allow', 'empty.txt', '--allow-empty', 'empty.txt']);
  assert.equal(allowed.status, 0, allowed.stderr);
});

test('rejects dirty or untracked working-tree changes', () => {
  const { cwd } = repo();
  writeFileSync(join(cwd, 'tracked.txt'), 'changed\n');

  const result = run(cwd, ['--base-ref', 'main']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Arbeitsbaum ist nicht sauber/);
});

test('ignores integrated main-only changes when checking the PR scope', () => {
  const { cwd } = repo();
  writeFileSync(join(cwd, 'feature.txt'), 'feature\n');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', 'feature']);

  git(cwd, ['checkout', 'main']);
  writeFileSync(join(cwd, 'workflow.txt'), 'main-only\n');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', 'main update']);

  git(cwd, ['checkout', 'work']);
  git(cwd, ['merge', '--no-edit', 'main']);

  const result = run(cwd, ['--base-ref', 'main', '--allow', 'feature.txt']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 geänderte Datei/);
});
