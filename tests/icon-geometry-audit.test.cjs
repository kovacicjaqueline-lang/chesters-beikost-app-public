"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  V2_CANVAS_SIZE,
  embeddedImageFromSvg,
  measureVisibleGeometry,
  measureV2Asset,
} = require("./helpers/icon-integrity-png.cjs");

const ROOT = path.resolve(__dirname, "..");
const FOOD_DIR = "assets/illustrations-v2/foods";
const RECIPE_DIR = "assets/illustrations-v2/recipes";

const FOOD_MIN_VISIBLE_MARGIN_PX = 1;
const RECIPE_MIN_VISIBLE_MARGIN_PX = 2;

const FOOD_REVIEW_FAMILIES = [
  {
    name: "längliche Fischmotive",
    files: ["atlantische-makrele.svg", "hering.svg", "karpfen.svg", "saibling.svg"],
    maxLongAxisSpreadPx: 4,
  },
  {
    name: "Ölflaschen",
    files: ["sojaoel.svg", "walnussoel.svg", "weizenkeimoel.svg"],
    maxLongAxisSpreadPx: 4,
  },
  {
    name: "kompakte Nussmotive",
    files: ["macadamia.svg", "paranuss.svg", "pecannuss.svg"],
    maxLongAxisSpreadPx: 4,
  },
  {
    name: "Blattgemüse",
    files: ["blattsalat.svg", "chinakohl.svg", "endivie.svg", "mangold.svg", "radicchio.svg", "rucola.svg"],
    maxLongAxisSpreadPx: 4,
  },
];

function assetPaths(relativeDir) {
  return fs.readdirSync(path.join(ROOT, relativeDir))
    .filter((name) => name.endsWith(".svg"))
    .sort()
    .map((name) => `${relativeDir}/${name}`);
}

function familyGeometry(relativeDir, files) {
  return files.map((file) => ({
    file,
    geometry: measureV2Asset(ROOT, `${relativeDir}/${file}`),
  }));
}

function syntheticDecoded(size, bbox) {
  return {
    width: size,
    height: size,
    alphaAt(x, y) {
      return x >= bbox.minX && x < bbox.maxX && y >= bbox.minY && y < bbox.maxY ? 255 : 0;
    },
  };
}

function comparableGeometry(geometry) {
  return {
    bbox: geometry.bbox,
    width: geometry.width,
    height: geometry.height,
    longAxis: geometry.longAxis,
    shortAxis: geometry.shortAxis,
    centerX: geometry.centerX,
    centerY: geometry.centerY,
    centerOffsetX: geometry.centerOffsetX,
    centerOffsetY: geometry.centerOffsetY,
    margins: geometry.margins,
    minMargin: geometry.minMargin,
  };
}

function assertMinVisibleMargin(geometry, minimum, label) {
  assert.ok(
    geometry.minMargin >= minimum,
    `${label}: sichtbares Motiv braucht mindestens ${minimum}px transparenten Wrapperrand; gemessen ${geometry.minMargin}px`,
  );
}

function assertFamilyLongAxisSpread(measurements, maximum, label) {
  const longAxes = measurements.map(({ geometry }) => geometry.longAxis);
  const spread = Math.max(...longAxes) - Math.min(...longAxes);
  assert.ok(
    spread <= maximum,
    `${label}: lange sichtbare Achsen driften um ${spread}px auseinander (erlaubt ${maximum}px): ${measurements.map(({ file, geometry }) => `${file}=${geometry.longAxis}px`).join(", ")}`,
  );
}

test("Geometrie wird unabhängig von der eingebetteten PNG-Auflösung in Wrapperkoordinaten gemessen", () => {
  const geometry128 = measureVisibleGeometry(syntheticDecoded(128, { minX: 14, minY: 24, maxX: 114, maxY: 104 }));
  const geometry512 = measureVisibleGeometry(syntheticDecoded(512, { minX: 56, minY: 96, maxX: 456, maxY: 416 }));

  assert.deepEqual(comparableGeometry(geometry512), comparableGeometry(geometry128));
  assert.equal(geometry128.sourceWidth, 128);
  assert.equal(geometry512.sourceWidth, 512);
  assert.equal(geometry512.scaleX, 0.25);
  assert.equal(geometry512.scaleY, 0.25);
});

test("FOOD-V2: Mindest-Rand wird in Wrapperpixeln statt PNG-Rohpixeln geprüft", () => {
  const margin128 = measureVisibleGeometry(syntheticDecoded(128, { minX: 1, minY: 1, maxX: 127, maxY: 127 }));
  const margin512 = measureVisibleGeometry(syntheticDecoded(512, { minX: 4, minY: 4, maxX: 508, maxY: 508 }));
  const tooSmall512 = [1, 2, 3].map((margin) => measureVisibleGeometry(
    syntheticDecoded(512, { minX: margin, minY: margin, maxX: 512 - margin, maxY: 512 - margin }),
  ));

  assertMinVisibleMargin(margin128, FOOD_MIN_VISIBLE_MARGIN_PX, "128er Quelle");
  assertMinVisibleMargin(margin512, FOOD_MIN_VISIBLE_MARGIN_PX, "512er Quelle");
  for (const [index, geometry] of tooSmall512.entries()) {
    assert.throws(
      () => assertMinVisibleMargin(geometry, FOOD_MIN_VISIBLE_MARGIN_PX, `512er Quelle mit ${index + 1}px Rohpixelrand`),
      /mindestens 1px transparenten Wrapperrand/,
    );
  }
});

test("FOOD-V2 Familienvergleich bleibt bei gemischten Rasterauflösungen stabil", () => {
  const same128 = measureVisibleGeometry(syntheticDecoded(128, { minX: 14, minY: 20, maxX: 114, maxY: 108 }));
  const same512 = measureVisibleGeometry(syntheticDecoded(512, { minX: 56, minY: 80, maxX: 456, maxY: 432 }));
  const different512 = measureVisibleGeometry(syntheticDecoded(512, { minX: 40, minY: 80, maxX: 472, maxY: 432 }));

  assertFamilyLongAxisSpread([
    { file: "gleich-128", geometry: same128 },
    { file: "gleich-512", geometry: same512 },
  ], 4, "gemischte Auflösungen");
  assert.throws(
    () => assertFamilyLongAxisSpread([
      { file: "referenz-128", geometry: same128 },
      { file: "abweichend-512", geometry: different512 },
    ], 4, "echte Geometrieabweichung"),
    /driften um 8px auseinander/,
  );
});

test("V2-Wrapper bildet das eingebettete PNG unverändert auf 128×128 ab", () => {
  const valid = `<svg><image href="data:image/png;base64,AA==" width="128" height="128"/></svg>`;
  assert.deepEqual(embeddedImageFromSvg(valid, "synthetischer Wrapper").image, {
    x: 0,
    y: 0,
    width: V2_CANVAS_SIZE,
    height: V2_CANVAS_SIZE,
  });
  assert.throws(
    () => embeddedImageFromSvg(valid.replace("<image ", "<image x=\"1\" "), "verschobener Wrapper"),
    /muss bei x=0 beginnen/,
  );
  assert.throws(
    () => embeddedImageFromSvg(valid.replace("<image ", "<image y=\"1\" "), "vertikal verschobener Wrapper"),
    /muss bei y=0 beginnen/,
  );
  assert.throws(
    () => embeddedImageFromSvg(valid.replace('width="128"', 'width="127"'), "skalierter Wrapper"),
    /muss auf Wrapperbreite 128 abgebildet werden/,
  );
  assert.throws(
    () => embeddedImageFromSvg(valid.replace('height="128"', 'height="127"'), "vertikal skalierter Wrapper"),
    /muss auf Wrapperhöhe 128 abgebildet werden/,
  );
});

test("FOOD-V2: sichtbare Motive bleiben vollständig innerhalb des Canvas", () => {
  for (const relativePath of assetPaths(FOOD_DIR)) {
    const geometry = measureV2Asset(ROOT, relativePath);
    assertMinVisibleMargin(geometry, FOOD_MIN_VISIBLE_MARGIN_PX, relativePath);
  }
});

test("FOOD-V2: Kuhmilch sichert eine erlaubte 512×512-Rasterquelle ab", () => {
  const geometry = measureV2Asset(ROOT, `${FOOD_DIR}/kuhmilch.svg`);
  assert.equal(geometry.sourceWidth, 512);
  assert.equal(geometry.sourceHeight, 512);
  assert.deepEqual(geometry.image, { x: 0, y: 0, width: 128, height: 128 });
  assertMinVisibleMargin(geometry, FOOD_MIN_VISIBLE_MARGIN_PX, "kuhmilch.svg");
});

test("Recipe-V2: technische Mindest-Ränder bleiben erhalten", () => {
  for (const relativePath of assetPaths(RECIPE_DIR)) {
    const geometry = measureV2Asset(ROOT, relativePath);
    assertMinVisibleMargin(geometry, RECIPE_MIN_VISIBLE_MARGIN_PX, relativePath);
  }
});

for (const family of FOOD_REVIEW_FAMILIES) {
  test(`FOOD-V2 Familie: ${family.name} bleibt optisch in vergleichbarer Größenordnung`, () => {
    const measurements = familyGeometry(FOOD_DIR, family.files);
    assertFamilyLongAxisSpread(measurements, family.maxLongAxisSpreadPx, family.name);
  });
}
