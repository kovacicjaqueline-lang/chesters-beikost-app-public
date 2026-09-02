"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LEGACY_RECIPE_DIR = path.join(ROOT, "assets", "illustrations", "recipes");
const V2_RECIPE_DIR = path.join(ROOT, "assets", "illustrations-v2", "recipes");
const ICON_SOURCE = fs.readFileSync(path.join(ROOT, "js", "icons.js"), "utf8");
const SW_CORE = fs.readFileSync(path.join(ROOT, "sw-core.js"), "utf8");

function sourceFiles(dir = ROOT) {
  const ignoredDirs = new Set([".git", "node_modules", "assets", "docs"]);
  const allowedExtensions = new Set([".html", ".js", ".cjs", ".css", ".json", ".webmanifest"]);
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(full));
    else if (allowedExtensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

test("Legacy-Recipe-Assets bleiben vollständig entfernt", () => {
  assert.equal(fs.existsSync(LEGACY_RECIPE_DIR), false);
});

test("produktive und testseitige Quellen referenzieren keinen Legacy-Recipe-Pfad", () => {
  const forbidden = ["assets", "illustrations", "recipes"].join("/") + "/";
  for (const file of sourceFiles()) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(source.includes(forbidden), false, `${path.relative(ROOT, file)} referenziert ${forbidden}`);
  }
});

test("aktive Recipe-Mappings decken den V2-Bestand exakt ab und sind offline precached", () => {
  const block = ICON_SOURCE.match(/const RECIPE_ICON_PATHS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(block, "RECIPE_ICON_PATHS fehlt");
  const aliasBlock = ICON_SOURCE.match(/const RECIPE_RUNTIME_ICON_ALIASES\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(aliasBlock, "RECIPE_RUNTIME_ICON_ALIASES fehlt");

  const mappedPaths = [...block[1].matchAll(/:\s*"(assets\/illustrations-v2\/recipes\/[^\"]+\.svg)"/g)]
    .map((match) => match[1]);
  assert.ok(mappedPaths.length > 0, "keine aktiven Recipe-V2-Mappings gefunden");
  assert.equal(new Set(mappedPaths).size, mappedPaths.length, "doppelte Recipe-V2-Mappings");

  const runtimeAliasPaths = [...aliasBlock[1].matchAll(/:\s*"(assets\/illustrations-v2\/recipes\/[^\"]+\.svg)"/g)]
    .map((match) => match[1]);
  const referencedPaths = [...new Set([...mappedPaths, ...runtimeAliasPaths])];

  const v2Paths = fs.readdirSync(V2_RECIPE_DIR)
    .filter((name) => name.endsWith(".svg"))
    .map((name) => `assets/illustrations-v2/recipes/${name}`)
    .sort();

  assert.deepEqual([...referencedPaths].sort(), v2Paths, "V2-Recipe-Bestand und aktive Mappings weichen voneinander ab");
  for (const relativePath of referencedPaths) {
    assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `${relativePath}: Asset fehlt`);
    assert.ok(SW_CORE.includes(`\"./${relativePath}\"`), `${relativePath}: Offline-Precache fehlt`);
  }
});
