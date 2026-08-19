"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "..");
const APPROVED_ICON_IDS = [
  "nektarine", "brombeere", "ribisel", "feige", "mangold", "spargel", "petersilienwurzel",
  "weizengriess", "bulgur", "kidneybohne", "braune-gruene-linse", "schnittlauch", "pecannuss",
  "paranuss", "macadamia", "lupine", "miesmuschel", "mohn", "tempeh", "kaeferbohne", "rhabarber",
  "chinakohl", "rucola", "radicchio", "endivie", "rettich", "blattsalat", "holunder", "preiselbeere",
  "quitte", "kren", "walnussoel", "sojaoel", "weizenkeimoel", "huettenkaese",
];

function embeddedPng(id) {
  const file = path.join(ROOT, "assets", "illustrations-v2", "foods", `${id}.svg`);
  const svg = fs.readFileSync(file, "utf8");
  const match = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  assert.ok(match, `${id}: eingebettetes PNG fehlt`);
  return Buffer.from(match[1], "base64");
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
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
  const interlace = ihdr[12];
  assert.equal(width, 128, `${id}: Breite`);
  assert.equal(height, 128, `${id}: Höhe`);
  assert.equal(bitDepth, 8, `${id}: nur 8-Bit-PNGs im Food-V2-Assetformat`);
  assert.equal(interlace, 0, `${id}: nicht-interlaced erwartet`);

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  assert.ok(channels, `${id}: nicht unterstützter PNG-Farbtyp ${colorType}`);
  const stride = width * channels;
  const compressed = Buffer.concat(idat);
  let raw;
  try {
    raw = zlib.inflateSync(compressed);
  } catch (error) {
    assert.fail(`${id}: PNG-IDAT ist nicht dekodierbar (${error.message})`);
  }
  assert.equal(raw.length, height * (stride + 1), `${id}: unerwartete PNG-Scanline-Länge`);

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
      const r = row[x * 3];
      const g = row[x * 3 + 1];
      const b = row[x * 3 + 2];
      return r === transparency.readUInt16BE(0) && g === transparency.readUInt16BE(2) && b === transparency.readUInt16BE(4) ? 0 : 255;
    }
    if (colorType === 0 && transparency?.length >= 2) {
      return row[x] === transparency.readUInt16BE(0) ? 0 : 255;
    }
    return 255;
  }

  return { width, height, alphaAt };
}

for (const id of APPROVED_ICON_IDS) {
  test(`FOOD-Icon ${id}: echtes Alpha und transparenter Außenrand`, () => {
    const png = decodePng(embeddedPng(id), id);
    const corners = [
      png.alphaAt(0, 0),
      png.alphaAt(png.width - 1, 0),
      png.alphaAt(0, png.height - 1),
      png.alphaAt(png.width - 1, png.height - 1),
    ];
    assert.deepEqual(corners, [0, 0, 0, 0], `${id}: Außenrand muss tatsächlich transparent sein`);
  });
}
