"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "..");
const RECIPE_DIR = path.join(ROOT, "assets", "illustrations-v2", "recipes");
const CSS_FILE = path.join(ROOT, "ui-meal-editor-footer.css");
const ALPHA_THRESHOLD = 16;
const RECIPE_MIN_MARGIN_PX = 2;
const EXPECTED_BREI_COUNT = 24;
const EXPECTED_STAMPF_COUNT = 5;
const EXPECTED_PANCAKES_COUNT = 7;
const EXPECTED_TALER_COUNT = 5;
const EXPECTED_MUFFINS_COUNT = 6;
const EXPECTED_BAELLCHEN_COUNT = 6;
const EXPECTED_LUGAW_COUNT = 3;
const EXPECTED_OMELETT_COUNT = 3;
const NORMALIZED_BAELLCHEN_IDS = new Set([
  "lachs-kartoffel-baellchen",
  "rote-linsen-gemuesebaellchen",
  "tofu-brokkoli-baellchen",
]);
const NORMALIZED_LUGAW_IDS = new Set([
  "kuerbis-lugaw",
  "lugaw-basis",
]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function embeddedPng(file) {
  const svg = fs.readFileSync(file, "utf8");
  const match = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)/);
  assert.ok(match, `${path.basename(file)}: eingebettetes PNG fehlt`);
  return Buffer.from(match[1].replace(/\s+/g, ""), "base64");
}

function decodePng(png, id) {
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${id}: PNG-Signatur`);
  let offset = 8;
  let ihdr = null;
  let transparency = null;
  const idat = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") ihdr = data;
    if (type === "tRNS") transparency = data;
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") break;
  }

  assert.ok(ihdr, `${id}: IHDR fehlt`);
  assert.ok(idat.length, `${id}: IDAT fehlt`);
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  assert.equal(width, 128, `${id}: Breite`);
  assert.equal(height, 128, `${id}: Höhe`);
  assert.equal(bitDepth, 8, `${id}: 8-Bit erwartet`);
  assert.equal(ihdr[12], 0, `${id}: nicht-interlaced erwartet`);

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  assert.ok(channels, `${id}: nicht unterstützter PNG-Farbtyp ${colorType}`);
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  assert.equal(raw.length, height * (stride + 1), `${id}: Scanline-Länge`);

  const rows = [];
  let pos = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const source = raw.subarray(pos, pos + stride);
    pos += stride;
    const row = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = previous[i] || 0;
      const upLeft = i >= channels ? previous[i - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upLeft);
      else assert.equal(filter, 0, `${id}: unbekannter PNG-Filter ${filter}`);
      row[i] = (source[i] + predictor) & 0xff;
    }
    rows.push(row);
    previous = row;
  }

  function alphaAt(x, y) {
    const row = rows[y];
    if (colorType === 6) return row[x * 4 + 3];
    if (colorType === 4) return row[x * 2 + 1];
    if (colorType === 3) {
      const paletteIndex = row[x];
      return transparency && paletteIndex < transparency.length ? transparency[paletteIndex] : 255;
    }
    if (colorType === 2 && transparency?.length >= 6) {
      const i = x * 3;
      return row[i] === transparency.readUInt16BE(0)
        && row[i + 1] === transparency.readUInt16BE(2)
        && row[i + 2] === transparency.readUInt16BE(4) ? 0 : 255;
    }
    if (colorType === 0 && transparency?.length >= 2) {
      return row[x] === transparency.readUInt16BE(0) ? 0 : 255;
    }
    return 255;
  }

  return { width, height, alphaAt };
}

function measure(file) {
  const id = path.basename(file, ".svg");
  const png = decodePng(embeddedPng(file), id);
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.alphaAt(x, y) < ALPHA_THRESHOLD) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  assert.ok(maxX >= minX && maxY >= minY, `${id}: keine sichtbaren Pixel`);
  return {
    id,
    minX,
    minY,
    maxX: maxX + 1,
    maxY: maxY + 1,
    centerX: (minX + maxX + 1) / 2,
    centerY: (minY + maxY + 1) / 2,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssGeometry(css, id, family) {
  const selector = `\\.illustration-icon__asset\\[src\\*="/recipes/${escapeRegExp(id)}\\.svg"\\]`;
  const blocks = Array.from(css.matchAll(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`, "g")));
  const variablePrefix = `--recipe-${family}-`;
  const numericSizeDeclaration = new RegExp(`${escapeRegExp(variablePrefix)}size:\\s*-?[0-9.]+%`);
  const block = blocks.find((candidate) => numericSizeDeclaration.test(candidate[1]));
  assert.ok(block, `${id}: CSS-Normalisierung fehlt`);

  function percent(variable) {
    const match = block[1].match(new RegExp(`${escapeRegExp(variable)}:\\s*(-?[0-9.]+)%`));
    assert.ok(match, `${id}: ${variable} fehlt`);
    return Number(match[1]);
  }

  return {
    scale: percent(`${variablePrefix}size`) / 100,
    leftPx: percent(`${variablePrefix}left`) * 128 / 100,
    topPx: percent(`${variablePrefix}top`) * 128 / 100,
  };
}

function renderedBounds(source, geometry) {
  return {
    minX: geometry.leftPx + source.minX * geometry.scale,
    minY: geometry.topPx + source.minY * geometry.scale,
    maxX: geometry.leftPx + source.maxX * geometry.scale,
    maxY: geometry.topPx + source.maxY * geometry.scale,
  };
}

function assertMargins(id, bounds) {
  const margins = {
    left: bounds.minX,
    top: bounds.minY,
    right: 128 - bounds.maxX,
    bottom: 128 - bounds.maxY,
  };
  for (const [side, margin] of Object.entries(margins)) {
    assert.ok(margin >= RECIPE_MIN_MARGIN_PX, `${id}: ${side}-Rand ${margin.toFixed(2)} px liegt unter ${RECIPE_MIN_MARGIN_PX} px`);
  }
}

function assertCssNormalizedFamily(css, family, expectedCount) {
  const files = fs.readdirSync(RECIPE_DIR)
    .filter((name) => name.endsWith(".svg") && name.includes(family))
    .sort();
  assert.equal(files.length, expectedCount, `${family}: Icon-Bestand hat sich geändert; Prüfung gezielt nachziehen`);

  for (const name of files) {
    const source = measure(path.join(RECIPE_DIR, name));
    const geometry = cssGeometry(css, source.id, family);
    assertMargins(source.id, renderedBounds(source, geometry));
  }
}

function assertRawFamilyMargins(family, expectedCount) {
  const files = fs.readdirSync(RECIPE_DIR)
    .filter((name) => name.endsWith(".svg") && name.includes(family))
    .sort();
  assert.equal(files.length, expectedCount, `${family}: Icon-Bestand hat sich geändert; Prüfung gezielt nachziehen`);

  for (const name of files) {
    const source = measure(path.join(RECIPE_DIR, name));
    assertMargins(source.id, source);
  }
}

test("Recipe-V2 Brei-Icons: Mindest-Rand bleibt nach visueller Normalisierung erhalten", () => {
  const css = fs.readFileSync(CSS_FILE, "utf8");
  assertCssNormalizedFamily(css, "brei", EXPECTED_BREI_COUNT);
});

test("Recipe-V2 Stampf-Icons: Mindest-Rand bleibt nach visueller Normalisierung erhalten", () => {
  const css = fs.readFileSync(CSS_FILE, "utf8");
  assertCssNormalizedFamily(css, "stampf", EXPECTED_STAMPF_COUNT);
});

test("Recipe-V2 Pancakes: Originalgrößen bleiben erhalten und erfüllen die Rand-Toleranz", () => {
  const css = fs.readFileSync(CSS_FILE, "utf8");
  assert.doesNotMatch(css, /--recipe-pancakes-(?:size|left|top)/, "Pancakes dürfen nicht pauschal auf einen Prozent-Zielwert normalisiert werden");
  assertRawFamilyMargins("pancakes", EXPECTED_PANCAKES_COUNT);
});

test("Recipe-V2 Taler: Originalgrößen bleiben erhalten und erfüllen die Rand-Toleranz", () => {
  const css = fs.readFileSync(CSS_FILE, "utf8");
  assert.doesNotMatch(css, /--recipe-taler-(?:size|left|top)/, "Taler dürfen nicht pauschal auf einen Prozent-Zielwert normalisiert werden");
  assertRawFamilyMargins("taler", EXPECTED_TALER_COUNT);
});

test("Recipe-V2 Muffins: Originalgrößen bleiben erhalten und erfüllen die Rand-Toleranz", () => {
  const css = fs.readFileSync(CSS_FILE, "utf8");
  assert.doesNotMatch(css, /--recipe-muffins-(?:size|left|top)/, "Muffins dürfen nicht pauschal auf einen Prozent-Zielwert normalisiert werden");
  assertRawFamilyMargins("muffins", EXPECTED_MUFFINS_COUNT);
});

test("Recipe-V2 Bällchen: nur klar zu kleine kompakte Motive werden familienbezogen vergrößert", () => {
  const css = fs.readFileSync(CSS_FILE, "utf8");
  const files = fs.readdirSync(RECIPE_DIR)
    .filter((name) => name.endsWith(".svg") && name.includes("baellchen"))
    .sort();
  assert.equal(files.length, EXPECTED_BAELLCHEN_COUNT, "baellchen: Icon-Bestand hat sich geändert; Prüfung gezielt nachziehen");

  for (const name of files) {
    const source = measure(path.join(RECIPE_DIR, name));
    if (!NORMALIZED_BAELLCHEN_IDS.has(source.id)) {
      assertMargins(source.id, source);
      const selector = `\\.illustration-icon__asset\\[src\\*="/recipes/${escapeRegExp(source.id)}\\.svg"\\]`;
      assert.doesNotMatch(
        css,
        new RegExp(`${selector}\\s*\\{[^}]*--recipe-baellchen-(?:size|left|top)`, "s"),
        `${source.id}: bereits ausreichend großes Motiv soll unverändert bleiben`,
      );
      continue;
    }

    const geometry = cssGeometry(css, source.id, "baellchen");
    const bounds = renderedBounds(source, geometry);
    assertMargins(source.id, bounds);
    const renderedWidth = bounds.maxX - bounds.minX;
    assert.ok(
      renderedWidth >= 99.9 && renderedWidth <= 100.1,
      `${source.id}: sichtbare Zielbreite ${renderedWidth.toFixed(2)} px liegt nicht bei der geprüften Familienreferenz von 100 px`,
    );
  }
});

test("Recipe-V2 Lugaw: nur die zwei zu kleinen Schüssel-Motive werden an Huhn-Lugaw angeglichen", () => {
  const css = fs.readFileSync(CSS_FILE, "utf8");
  const files = fs.readdirSync(RECIPE_DIR)
    .filter((name) => name.endsWith(".svg") && name.includes("lugaw"))
    .sort();
  assert.deepEqual(files, ["huhn-lugaw.svg", "kuerbis-lugaw.svg", "lugaw-basis.svg"]);
  assert.equal(files.length, EXPECTED_LUGAW_COUNT, "lugaw: Icon-Bestand hat sich geändert; Prüfung gezielt nachziehen");

  for (const name of files) {
    const source = measure(path.join(RECIPE_DIR, name));
    if (!NORMALIZED_LUGAW_IDS.has(source.id)) {
      assertMargins(source.id, source);
      const selector = `\\.illustration-icon__asset\\[src\\*="/recipes/${escapeRegExp(source.id)}\\.svg"\\]`;
      assert.doesNotMatch(
        css,
        new RegExp(`${selector}\\s*\\{[^}]*--recipe-lugaw-(?:size|left|top)`, "s"),
        `${source.id}: Familienreferenz soll unverändert bleiben`,
      );
      continue;
    }

    const geometry = cssGeometry(css, source.id, "lugaw");
    const bounds = renderedBounds(source, geometry);
    assertMargins(source.id, bounds);
    const renderedWidth = bounds.maxX - bounds.minX;
    assert.ok(
      renderedWidth >= 91.9 && renderedWidth <= 92.1,
      `${source.id}: sichtbare Zielbreite ${renderedWidth.toFixed(2)} px liegt nicht bei der Huhn-Lugaw-Familienreferenz von 92 px`,
    );
  }
});

test("Recipe-V2 Omelett: nur das klar zu kleine Paprika-Motiv wird an die kleinere gute Familienreferenz angeglichen", () => {
  const css = fs.readFileSync(CSS_FILE, "utf8");
  const files = ["omelettstreifen.svg", "paprika-omelettstreifen.svg", "zucchini-omelett.svg"];
  for (const name of files) assert.ok(fs.existsSync(path.join(RECIPE_DIR, name)), `${name}: Asset fehlt`);
  assert.equal(files.length, EXPECTED_OMELETT_COUNT);

  for (const name of files) {
    const source = measure(path.join(RECIPE_DIR, name));
    if (source.id !== "paprika-omelettstreifen") {
      assertMargins(source.id, source);
      const selector = `\\.illustration-icon__asset\\[src\\*="/recipes/${escapeRegExp(source.id)}\\.svg"\\]`;
      assert.doesNotMatch(
        css,
        new RegExp(`${selector}\\s*\\{[^}]*--recipe-omelett-(?:size|left|top)`, "s"),
        `${source.id}: bereits ausreichend großes Omelett-Motiv soll unverändert bleiben`,
      );
      continue;
    }

    const geometry = cssGeometry(css, source.id, "omelett");
    const bounds = renderedBounds(source, geometry);
    assertMargins(source.id, bounds);
    const renderedWidth = bounds.maxX - bounds.minX;
    assert.ok(
      renderedWidth >= 108.9 && renderedWidth <= 109.1,
      `${source.id}: sichtbare Zielbreite ${renderedWidth.toFixed(2)} px liegt nicht bei der geprüften Zucchini-Omelett-Familienreferenz von 109 px`,
    );
  }
});