"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const OUTER_ALPHA_TOLERANCE = 4;
const ALPHA_GEOMETRY_THRESHOLD = 16;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunks(png, label) {
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${label}: PNG-Signatur`);
  let offset = 8;
  let ihdr = null;
  let transparency = null;
  let sawIend = false;
  const idat = [];

  while (offset < png.length) {
    assert.ok(offset + 12 <= png.length, `${label}: abgeschnittener PNG-Chunk-Header`);
    const length = png.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    assert.ok(chunkEnd <= png.length, `${label}: abgeschnittener PNG-Chunk`);
    const typeBytes = png.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    assert.equal(
      crc32(Buffer.concat([typeBytes, data])),
      png.readUInt32BE(offset + 8 + length),
      `${label}: ungültige CRC im PNG-Chunk ${type}`,
    );
    if (type === "IHDR") ihdr = data;
    if (type === "tRNS") transparency = data;
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") {
      sawIend = true;
      offset = chunkEnd;
      break;
    }
    offset = chunkEnd;
  }

  assert.ok(ihdr, `${label}: IHDR fehlt`);
  assert.equal(ihdr.length, 13, `${label}: IHDR-Länge`);
  assert.ok(idat.length, `${label}: IDAT fehlt`);
  assert.ok(sawIend, `${label}: IEND fehlt`);
  assert.equal(offset, png.length, `${label}: unerwartete Daten nach IEND`);
  return { ihdr, transparency, idat };
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

function decodeEmbeddedPng(png, label) {
  const { ihdr, transparency, idat } = pngChunks(png, label);
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  assert.equal(width, 128, `${label}: eingebettete PNG-Breite`);
  assert.equal(height, 128, `${label}: eingebettete PNG-Höhe`);
  assert.equal(bitDepth, 8, `${label}: nur 8-Bit-PNGs im V2-Assetformat`);
  assert.equal(ihdr[10], 0, `${label}: PNG-Kompressionsmethode`);
  assert.equal(ihdr[11], 0, `${label}: PNG-Filtermethode`);
  assert.equal(ihdr[12], 0, `${label}: nicht-interlaced erwartet`);

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  assert.ok(channels, `${label}: nicht unterstützter PNG-Farbtyp ${colorType}`);
  assert.ok(colorType === 4 || colorType === 6 || Buffer.isBuffer(transparency), `${label}: PNG besitzt keine Alpha-/Transparenzinformation`);

  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat));
  } catch (error) {
    assert.fail(`${label}: PNG-IDAT ist nicht dekodierbar (${error.message})`);
  }
  const stride = width * channels;
  assert.equal(raw.length, height * (stride + 1), `${label}: unerwartete PNG-Scanline-Länge`);

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
      else assert.equal(filter, 0, `${label}: unbekannter PNG-Filter ${filter}`);
      row[i] = (source[i] + predictor) & 0xff;
    }
    rows.push(row);
    previous = row;
  }

  function alphaAt(x, y) {
    const row = rows[y];
    if (colorType === 6) return row[x * 4 + 3];
    if (colorType === 4) return row[x * 2 + 1];
    if (colorType === 3) return transparency && row[x] < transparency.length ? transparency[row[x]] : 255;
    if (colorType === 2 && transparency?.length >= 6) {
      const i = x * 3;
      return row[i] === transparency.readUInt16BE(0) && row[i + 1] === transparency.readUInt16BE(2) && row[i + 2] === transparency.readUInt16BE(4) ? 0 : 255;
    }
    if (colorType === 0 && transparency?.length >= 2) return row[x] === transparency.readUInt16BE(0) ? 0 : 255;
    return 255;
  }
  return { width, height, alphaAt };
}

function embeddedPngFromSvg(svg, label) {
  const match = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)/);
  assert.ok(match, `${label}: eingebettetes PNG fehlt`);
  const encoded = match[1].replace(/\s+/g, "");
  const png = Buffer.from(encoded, "base64");
  assert.ok(png.length, `${label}: eingebettetes PNG ist leer`);
  assert.equal(png.toString("base64").replace(/=+$/, ""), encoded.replace(/=+$/, ""), `${label}: Base64-PNG ist nicht sauber dekodierbar`);
  return png;
}

function measureVisibleGeometry(decoded, alphaThreshold = ALPHA_GEOMETRY_THRESHOLD) {
  let minX = decoded.width;
  let minY = decoded.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x++) {
      if (decoded.alphaAt(x, y) < alphaThreshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  assert.ok(maxX >= minX && maxY >= minY, `kein sichtbares Motiv bei Alpha >= ${alphaThreshold}`);
  const maxXExclusive = maxX + 1;
  const maxYExclusive = maxY + 1;
  const width = maxXExclusive - minX;
  const height = maxYExclusive - minY;
  const centerX = (minX + maxXExclusive) / 2;
  const centerY = (minY + maxYExclusive) / 2;
  const margins = {
    left: minX,
    top: minY,
    right: decoded.width - maxXExclusive,
    bottom: decoded.height - maxYExclusive,
  };

  return {
    alphaThreshold,
    bbox: { minX, minY, maxX: maxXExclusive, maxY: maxYExclusive },
    width,
    height,
    longAxis: Math.max(width, height),
    shortAxis: Math.min(width, height),
    longAxisPercent: (Math.max(width, height) / Math.max(decoded.width, decoded.height)) * 100,
    widthPercent: (width / decoded.width) * 100,
    heightPercent: (height / decoded.height) * 100,
    centerX,
    centerY,
    centerOffsetX: centerX - decoded.width / 2,
    centerOffsetY: centerY - decoded.height / 2,
    margins,
    minMargin: Math.min(margins.left, margins.top, margins.right, margins.bottom),
  };
}

function measureV2Asset(root, relativePath, alphaThreshold = ALPHA_GEOMETRY_THRESHOLD) {
  const svg = fs.readFileSync(path.join(root, relativePath), "utf8");
  const decoded = decodeEmbeddedPng(embeddedPngFromSvg(svg, relativePath), relativePath);
  return measureVisibleGeometry(decoded, alphaThreshold);
}

function assertV2Asset(root, relativePath) {
  const svg = fs.readFileSync(path.join(root, relativePath), "utf8");
  const opening = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  assert.ok(opening, `${relativePath}: <svg>-Element fehlt`);
  assert.equal(opening.match(/\bwidth\s*=\s*([\x22'])(.*?)\1/i)?.[2], "128", `${relativePath}: SVG width muss 128 sein`);
  assert.equal(opening.match(/\bheight\s*=\s*([\x22'])(.*?)\1/i)?.[2], "128", `${relativePath}: SVG height muss 128 sein`);
  assert.equal(opening.match(/\bviewBox\s*=\s*([\x22'])(.*?)\1/i)?.[2], "0 0 128 128", `${relativePath}: SVG viewBox`);

  const decoded = decodeEmbeddedPng(embeddedPngFromSvg(svg, relativePath), relativePath);
  for (let x = 0; x < decoded.width; x++) {
    assert.ok(decoded.alphaAt(x, 0) <= OUTER_ALPHA_TOLERANCE, `${relativePath}: oberer Außenrand muss praktisch transparent sein (Alpha <= ${OUTER_ALPHA_TOLERANCE})`);
    assert.ok(decoded.alphaAt(x, decoded.height - 1) <= OUTER_ALPHA_TOLERANCE, `${relativePath}: unterer Außenrand muss praktisch transparent sein (Alpha <= ${OUTER_ALPHA_TOLERANCE})`);
  }
  for (let y = 0; y < decoded.height; y++) {
    assert.ok(decoded.alphaAt(0, y) <= OUTER_ALPHA_TOLERANCE, `${relativePath}: linker Außenrand muss praktisch transparent sein (Alpha <= ${OUTER_ALPHA_TOLERANCE})`);
    assert.ok(decoded.alphaAt(decoded.width - 1, y) <= OUTER_ALPHA_TOLERANCE, `${relativePath}: rechter Außenrand muss praktisch transparent sein (Alpha <= ${OUTER_ALPHA_TOLERANCE})`);
  }

  let visible = 0;
  let transparent = 0;
  for (let y = 0; y < decoded.height; y++) for (let x = 0; x < decoded.width; x++) {
    const alpha = decoded.alphaAt(x, y);
    if (alpha > 0) visible++;
    if (alpha === 0) transparent++;
  }
  const pixels = decoded.width * decoded.height;
  assert.ok(visible > 0, `${relativePath}: PNG darf nicht vollständig transparent sein`);
  assert.ok(transparent / pixels >= 0.1, `${relativePath}: mindestens 10 % der PNG-Fläche müssen vollständig transparent sein`);
}

module.exports = {
  ALPHA_GEOMETRY_THRESHOLD,
  assertV2Asset,
  measureVisibleGeometry,
  measureV2Asset,
};
