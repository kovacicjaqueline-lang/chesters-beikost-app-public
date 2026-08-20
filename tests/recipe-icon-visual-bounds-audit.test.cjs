"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "..");
const RECIPE_DIR = path.join(ROOT, "assets", "illustrations-v2", "recipes");
const ALPHA_THRESHOLD = 16;

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
  const match = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  assert.ok(match, `${path.basename(file)}: eingebettetes PNG fehlt`);
  return Buffer.from(match[1], "base64");
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
  assert.equal(bitDepth, 8, `${id}: 8-Bit erwartet`);
  assert.equal(interlace, 0, `${id}: nicht-interlaced erwartet`);

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

function measure(file) {
  const id = path.basename(file, ".svg");
  const png = decodePng(embeddedPng(file), id);
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  let alphaSum = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const alpha = png.alphaAt(x, y);
      if (alpha >= ALPHA_THRESHOLD) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if (alpha > 0) {
        alphaSum += alpha;
        weightedX += x * alpha;
        weightedY += y * alpha;
      }
    }
  }
  assert.ok(maxX >= minX && maxY >= minY, `${id}: keine sichtbaren Pixel`);
  const bboxWidth = maxX - minX + 1;
  const bboxHeight = maxY - minY + 1;
  const center = (png.width - 1) / 2;
  const bboxCenterX = (minX + maxX) / 2;
  const bboxCenterY = (minY + maxY) / 2;
  const massCenterX = weightedX / alphaSum;
  const massCenterY = weightedY / alphaSum;
  return {
    id,
    bbox: [minX, minY, maxX, maxY],
    size: [bboxWidth, bboxHeight],
    margins: [minX, png.width - 1 - maxX, minY, png.height - 1 - maxY],
    maxSpanPct: +(100 * Math.max(bboxWidth, bboxHeight) / png.width).toFixed(1),
    minSpanPct: +(100 * Math.min(bboxWidth, bboxHeight) / png.width).toFixed(1),
    bboxOffset: [+(bboxCenterX - center).toFixed(1), +(bboxCenterY - center).toFixed(1)],
    massOffset: [+(massCenterX - center).toFixed(1), +(massCenterY - center).toFixed(1)],
  };
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return +(sorted[base] + (sorted[base + 1] === undefined ? 0 : rest * (sorted[base + 1] - sorted[base]))).toFixed(1);
}

test("Recipe-V2 visual bounds audit: Breie", () => {
  const files = fs.readdirSync(RECIPE_DIR).filter((name) => name.endsWith(".svg")).sort();
  const all = files.map((name) => measure(path.join(RECIPE_DIR, name)));
  const brei = all.filter((m) => m.id.includes("brei"));
  assert.ok(brei.length > 0, "keine Brei-Icons gefunden");
  const spans = all.map((m) => m.maxSpanPct);
  const absX = all.map((m) => Math.abs(m.bboxOffset[0]));
  const absY = all.map((m) => Math.abs(m.bboxOffset[1]));
  console.log("RECIPE_VISUAL_BASELINE", JSON.stringify({
    alphaThreshold: ALPHA_THRESHOLD,
    recipeCount: all.length,
    breiCount: brei.length,
    maxSpanPct: { p10: quantile(spans, 0.1), median: quantile(spans, 0.5), p90: quantile(spans, 0.9) },
    absBBoxOffsetX: { p50: quantile(absX, 0.5), p90: quantile(absX, 0.9) },
    absBBoxOffsetY: { p50: quantile(absY, 0.5), p90: quantile(absY, 0.9) },
  }));
  for (const metric of brei) console.log("BREI_VISUAL", JSON.stringify(metric));
});
