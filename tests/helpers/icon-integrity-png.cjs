"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const OUTER_ALPHA_TOLERANCE = 4;
const ALPHA_GEOMETRY_THRESHOLD = 16;
const V2_CANVAS_SIZE = 128;

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
  assert.ok(width >= 128, `${label}: eingebettete PNG-Breite muss mindestens 128 sein`);
  assert.equal(height, width, `${label}: eingebettetes PNG muss quadratisch sein`);
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

function numericSvgAttribute(tag, name, { required = false, defaultValue = 0 } = {}) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*([\\x22'])(.*?)\\1`, "i"));
  if (!match) {
    assert.equal(required, false, `${name}-Attribut fehlt`);
    return defaultValue;
  }
  assert.match(match[2], /^-?(?:\d+(?:\.\d+)?|\.\d+)$/, `${name}-Attribut muss eine einheitenlose Zahl sein`);
  return Number(match[2]);
}

function embeddedImageFromSvg(svg, label) {
  const imageTags = svg.match(/<image\b[^>]*>/gi) || [];
  const embedded = imageTags.filter((tag) => /data:image\/png;base64,/i.test(tag));
  assert.equal(embedded.length, 1, `${label}: genau ein eingebettetes PNG erwartet`);
  const imageTag = embedded[0];
  const match = imageTag.match(/data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)/i);
  assert.ok(match, `${label}: eingebettetes PNG fehlt`);
  const encoded = match[1].replace(/\s+/g, "");
  const png = Buffer.from(encoded, "base64");
  assert.ok(png.length, `${label}: eingebettetes PNG ist leer`);
  assert.equal(png.toString("base64").replace(/=+$/, ""), encoded.replace(/=+$/, ""), `${label}: Base64-PNG ist nicht sauber dekodierbar`);
  const image = {
    x: numericSvgAttribute(imageTag, "x"),
    y: numericSvgAttribute(imageTag, "y"),
    width: numericSvgAttribute(imageTag, "width", { required: true }),
    height: numericSvgAttribute(imageTag, "height", { required: true }),
  };
  assert.equal(image.x, 0, `${label}: eingebettetes PNG muss bei x=0 beginnen`);
  assert.equal(image.y, 0, `${label}: eingebettetes PNG muss bei y=0 beginnen`);
  assert.equal(image.width, V2_CANVAS_SIZE, `${label}: eingebettetes PNG muss auf Wrapperbreite ${V2_CANVAS_SIZE} abgebildet werden`);
  assert.equal(image.height, V2_CANVAS_SIZE, `${label}: eingebettetes PNG muss auf Wrapperhöhe ${V2_CANVAS_SIZE} abgebildet werden`);
  return { png, image };
}

function measureVisibleGeometry(
  decoded,
  alphaThreshold = ALPHA_GEOMETRY_THRESHOLD,
  image = { x: 0, y: 0, width: V2_CANVAS_SIZE, height: V2_CANVAS_SIZE },
) {
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
  const rawMaxXExclusive = maxX + 1;
  const rawMaxYExclusive = maxY + 1;
  const scaleX = image.width / decoded.width;
  const scaleY = image.height / decoded.height;
  const wrapperMinX = image.x + minX * scaleX;
  const wrapperMinY = image.y + minY * scaleY;
  const wrapperMaxX = image.x + rawMaxXExclusive * scaleX;
  const wrapperMaxY = image.y + rawMaxYExclusive * scaleY;
  const width = wrapperMaxX - wrapperMinX;
  const height = wrapperMaxY - wrapperMinY;
  const centerX = (wrapperMinX + wrapperMaxX) / 2;
  const centerY = (wrapperMinY + wrapperMaxY) / 2;
  const margins = {
    left: wrapperMinX,
    top: wrapperMinY,
    right: V2_CANVAS_SIZE - wrapperMaxX,
    bottom: V2_CANVAS_SIZE - wrapperMaxY,
  };

  return {
    alphaThreshold,
    sourceWidth: decoded.width,
    sourceHeight: decoded.height,
    image: { ...image },
    scaleX,
    scaleY,
    bbox: { minX: wrapperMinX, minY: wrapperMinY, maxX: wrapperMaxX, maxY: wrapperMaxY },
    width,
    height,
    longAxis: Math.max(width, height),
    shortAxis: Math.min(width, height),
    longAxisPercent: (Math.max(width, height) / V2_CANVAS_SIZE) * 100,
    widthPercent: (width / V2_CANVAS_SIZE) * 100,
    heightPercent: (height / V2_CANVAS_SIZE) * 100,
    centerX,
    centerY,
    centerOffsetX: centerX - V2_CANVAS_SIZE / 2,
    centerOffsetY: centerY - V2_CANVAS_SIZE / 2,
    margins,
    minMargin: Math.min(margins.left, margins.top, margins.right, margins.bottom),
  };
}

function measureV2Asset(root, relativePath, alphaThreshold = ALPHA_GEOMETRY_THRESHOLD) {
  const svg = fs.readFileSync(path.join(root, relativePath), "utf8");
  const embedded = embeddedImageFromSvg(svg, relativePath);
  const decoded = decodeEmbeddedPng(embedded.png, relativePath);
  return measureVisibleGeometry(decoded, alphaThreshold, embedded.image);
}

function assertV2Asset(root, relativePath) {
  const svg = fs.readFileSync(path.join(root, relativePath), "utf8");
  const opening = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  assert.ok(opening, `${relativePath}: <svg>-Element fehlt`);
  assert.equal(opening.match(/\bwidth\s*=\s*([\x22'])(.*?)\1/i)?.[2], String(V2_CANVAS_SIZE), `${relativePath}: SVG width muss ${V2_CANVAS_SIZE} sein`);
  assert.equal(opening.match(/\bheight\s*=\s*([\x22'])(.*?)\1/i)?.[2], String(V2_CANVAS_SIZE), `${relativePath}: SVG height muss ${V2_CANVAS_SIZE} sein`);
  assert.equal(opening.match(/\bviewBox\s*=\s*([\x22'])(.*?)\1/i)?.[2], `0 0 ${V2_CANVAS_SIZE} ${V2_CANVAS_SIZE}`, `${relativePath}: SVG viewBox`);

  const embedded = embeddedImageFromSvg(svg, relativePath);
  const decoded = decodeEmbeddedPng(embedded.png, relativePath);
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
  V2_CANVAS_SIZE,
  assertV2Asset,
  embeddedImageFromSvg,
  measureVisibleGeometry,
  measureV2Asset,
};
