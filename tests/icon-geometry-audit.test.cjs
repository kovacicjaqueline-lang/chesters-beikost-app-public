"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { measureV2Asset } = require("./helpers/icon-integrity-png.cjs");

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

test("FOOD-V2: sichtbare Motive bleiben vollständig innerhalb des Canvas", () => {
  for (const relativePath of assetPaths(FOOD_DIR)) {
    const geometry = measureV2Asset(ROOT, relativePath);
    assert.ok(
      geometry.minMargin >= FOOD_MIN_VISIBLE_MARGIN_PX,
      `${relativePath}: sichtbares Motiv braucht mindestens ${FOOD_MIN_VISIBLE_MARGIN_PX}px transparenten Rand; gemessen ${geometry.minMargin}px`,
    );
  }
});

test("Recipe-V2: technische Mindest-Ränder bleiben erhalten", () => {
  for (const relativePath of assetPaths(RECIPE_DIR)) {
    const geometry = measureV2Asset(ROOT, relativePath);
    assert.ok(
      geometry.minMargin >= RECIPE_MIN_VISIBLE_MARGIN_PX,
      `${relativePath}: Recipe-V2 braucht mindestens ${RECIPE_MIN_VISIBLE_MARGIN_PX}px transparenten Rand; gemessen ${geometry.minMargin}px`,
    );
  }
});

for (const family of FOOD_REVIEW_FAMILIES) {
  test(`FOOD-V2 Familie: ${family.name} bleibt optisch in vergleichbarer Größenordnung`, () => {
    const measurements = familyGeometry(FOOD_DIR, family.files);
    const longAxes = measurements.map(({ geometry }) => geometry.longAxis);
    const spread = Math.max(...longAxes) - Math.min(...longAxes);

    assert.ok(
      spread <= family.maxLongAxisSpreadPx,
      `${family.name}: lange sichtbare Achsen driften um ${spread}px auseinander (erlaubt ${family.maxLongAxisSpreadPx}px): ${measurements.map(({ file, geometry }) => `${file}=${geometry.longAxis}px`).join(", ")}`,
    );
  });
}
