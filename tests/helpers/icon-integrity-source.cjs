"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function evaluateDeclaredValue(source, name, filename) {
  const context = Object.create(null);
  vm.createContext(context);
  vm.runInContext(`${source}\n;this.__integrityValue = ${name};`, context, {
    filename,
    timeout: 2_000,
  });
  return clonePlain(context.__integrityValue);
}

function matchingBracket(source, openIndex) {
  const pairs = { "{": "}", "[": "]", "(": ")" };
  const open = source[openIndex];
  const close = pairs[open];
  assert.ok(close, `Kein unterstütztes Startzeichen bei ${openIndex}`);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1] || "";
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      i++;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === open) depth++;
    else if (char === close && --depth === 0) return i;
  }
  assert.fail(`Kein schließendes ${close} für Position ${openIndex}`);
}

function extractFreezeObject(source, name) {
  const marker = `const ${name} = Object.freeze(`;
  const declaration = source.indexOf(marker);
  assert.notEqual(declaration, -1, `${name}: Deklaration fehlt`);
  const open = source.indexOf("{", declaration + marker.length);
  assert.notEqual(open, -1, `${name}: Objektanfang fehlt`);
  const close = matchingBracket(source, open);
  return source.slice(open, close + 1);
}

function rawStringMappingEntries(source, name) {
  const body = extractFreezeObject(source, name).slice(1, -1);
  const entryPattern = /\s*"((?:\\.|[^"\\])*)"\s*:\s*"((?:\\.|[^"\\])*)"\s*(?:,|$)/gy;
  const entries = [];
  let cursor = 0;
  while (cursor < body.length) {
    entryPattern.lastIndex = cursor;
    const match = entryPattern.exec(body);
    if (!match) {
      const rest = body.slice(cursor);
      if (/^\s*$/.test(rest)) break;
      assert.fail(`${name}: unerwartete Mapping-Syntax nahe ${JSON.stringify(rest.slice(0, 80))}`);
    }
    entries.push([JSON.parse(`"${match[1]}"`), JSON.parse(`"${match[2]}"`)]);
    cursor = entryPattern.lastIndex;
  }
  return entries;
}

function duplicateGroups(entries, index) {
  const groups = new Map();
  for (const entry of entries) {
    const value = entry[index];
    const group = groups.get(value) || [];
    group.push(entry);
    groups.set(value, group);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

function normalizeRepoPath(value) {
  return String(value || "").replace(/^\.\//, "").replaceAll("\\", "/");
}

function parsePrecacheFiles(source) {
  const marker = source.indexOf("const FILES=");
  assert.notEqual(marker, -1, "sw-core.js: FILES-Precache fehlt");
  const open = source.indexOf("[", marker);
  assert.notEqual(open, -1, "sw-core.js: FILES-Array fehlt");
  const close = matchingBracket(source, open);
  return Array.from(
    vm.runInNewContext(source.slice(open, close + 1), Object.create(null), { timeout: 2_000 }),
    normalizeRepoPath,
  );
}

module.exports = {
  clonePlain,
  duplicateGroups,
  evaluateDeclaredValue,
  matchingBracket,
  normalizeRepoPath,
  parsePrecacheFiles,
  rawStringMappingEntries,
};
