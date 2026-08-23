"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { measureV2Asset } = require("./helpers/icon-integrity-png.cjs");

const ROOT = path.resolve(__dirname, "..");
const ICON_SIZE_PX = 128;
const FOOD_LONG_AXIS_MIN_PERCENT = 78;
const FOOD_LONG_AXIS_MAX_PERCENT = 82;
const FOOD_LONG_AXIS_MIN_PX = Math.round((ICON_SIZE_PX * FOOD_LONG_AXIS_MIN_PERCENT) / 100);
const FOOD_LONG_AXIS_MAX_PX = Math.round((ICON_SIZE_PX * FOOD_LONG_AXIS_MAX_PERCENT) / 100);
const FOOD_CENTER_MAX_OFFSET_PX = 2;
const RECIPE_MIN_MARGIN_PX = 2;

// Historische Abweichungen sind keine Designfreigabe. Diese Baseline ist ein Ratchet:
// Neue Abweichungen schlagen fehl; behobene Einträge müssen aus der Baseline entfernt werden.
const FOOD_LEGACY_BELOW_MIN = new Set([
  "ananas.svg",
  "aubergine.svg",
  "buttermakrele.svg",
  "hecht.svg",
  "heilbutt.svg",
  "hirse.svg",
  "koenigsmakrele.svg",
  "kuhmilch.svg",
  "olivenoel.svg",
  "quark.svg",
  "rapsoel.svg",
  "schlangenmakrele.svg",
  "schwertfisch.svg",
]);

const FOOD_LEGACY_ABOVE_MAX = new Set([
  "atlantische-makrele.svg",
  "blattsalat.svg",
  "bohne.svg",
  "braune-gruene-linse.svg",
  "bulgur.svg",
  "chinakohl.svg",
  "endivie.svg",
  "feige.svg",
  "hering.svg",
  "holunder.svg",
  "honig.svg",
  "huettenkaese.svg",
  "kaeferbohne.svg",
  "karpfen.svg",
  "kidneybohne.svg",
  "kren.svg",
  "lupine.svg",
  "macadamia.svg",
  "mangold.svg",
  "miesmuschel.svg",
  "nektarine.svg",
  "paranuss.svg",
  "pecannuss.svg",
  "petersilienwurzel.svg",
  "preiselbeere.svg",
  "quitte.svg",
  "radicchio.svg",
  "rettich.svg",
  "rhabarber.svg",
  "ribisel.svg",
  "rucola.svg",
  "saibling.svg",
  "schnittlauch.svg",
  "sojaoel.svg",
  "spargel.svg",
  "tempeh.svg",
  "walnussoel.svg",
  "weizengriess.svg",
  "weizenkeimoel.svg",
]);

const FOOD_LEGACY_OFF_CENTER = new Set([
  "bohne.svg",
  "hecht.svg",
  "hirse.svg",
  "honig.svg",
  "kuhmilch.svg",
  "miesmuschel.svg",
  "schlangenmakrele.svg",
]);

function assetPaths(kind) {
  const dir = path.join(ROOT, "assets", "illustrations-v2", kind);
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
    .map((entry) => `assets/illustrations-v2/${kind}/${entry.name}`)
    .sort();
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function round(value) {
  return Number(value.toFixed(2));
}

function distribution(items, key) {
  const values = items.map((item) => item[key]);
  return Object.fromEntries([
    ["min", Math.min(...values)],
    ["p10", percentile(values, 0.10)],
    ["p25", percentile(values, 0.25)],
    ["median", percentile(values, 0.50)],
    ["p75", percentile(values, 0.75)],
    ["p90", percentile(values, 0.90)],
    ["max", Math.max(...values)],
  ].map(([name, value]) => [name, round(value)]));
}

function audit(kind) {
  return assetPaths(kind).map((relativePath) => {
    const geometry = measureV2Asset(ROOT, relativePath);
    return {
      relativePath,
      file: path.basename(relativePath),
      ...geometry,
      absCenterOffsetX: Math.abs(geometry.centerOffsetX),
      absCenterOffsetY: Math.abs(geometry.centerOffsetY),
    };
  });
}

function summary(items) {
  return {
    width: distribution(items, "width"),
    height: distribution(items, "height"),
    longAxisPercent: distribution(items, "longAxisPercent"),
    minMargin: distribution(items, "minMargin"),
    absCenterOffsetX: distribution(items, "absCenterOffsetX"),
    absCenterOffsetY: distribution(items, "absCenterOffsetY"),
  };
}

function geometryLabel(item) {
  return `${item.file}: bbox ${item.width}×${item.height}px, lange Achse ${round(item.longAxisPercent)} %, Ränder ${item.margins.left}/${item.margins.top}/${item.margins.right}/${item.margins.bottom}px, Zentrum ${round(item.centerOffsetX)}/${round(item.centerOffsetY)}px`;
}

function assertLegacyCategory(item, actualViolation, baseline, label) {
  const expectedLegacyViolation = baseline.has(item.file);
  assert.equal(
    actualViolation,
    expectedLegacyViolation,
    expectedLegacyViolation
      ? `${geometryLabel(item)}; Legacy-Abweichung „${label}“ ist behoben – Baseline-Eintrag entfernen`
      : `${geometryLabel(item)}; neue FOOD-Abweichung „${label}“ ist nicht zulässig`,
  );
}

function assertBaselineFilesExist(foodNames, baseline, label) {
  for (const file of baseline) {
    assert.ok(foodNames.has(file), `${file}: Legacy-Baseline „${label}“ ist veraltet – Eintrag entfernen`);
  }
}

test("FOOD-V2: Zielgeometrie ist als Legacy-Ratchet abgesichert", async (t) => {
  const foods = audit("foods");
  assert.ok(foods.length > 0, "FOOD-V2-Bestand darf nicht leer sein");
  const foodNames = new Set(foods.map((item) => item.file));

  assertBaselineFilesExist(foodNames, FOOD_LEGACY_BELOW_MIN, "unter Mindestgröße");
  assertBaselineFilesExist(foodNames, FOOD_LEGACY_ABOVE_MAX, "über Maximalgröße");
  assertBaselineFilesExist(foodNames, FOOD_LEGACY_OFF_CENTER, "außerhalb Zentrierung");

  for (const item of foods) {
    await t.test(item.file, () => {
      assertLegacyCategory(
        item,
        item.longAxis < FOOD_LONG_AXIS_MIN_PX,
        FOOD_LEGACY_BELOW_MIN,
        `${FOOD_LONG_AXIS_MIN_PERCENT} % / ${FOOD_LONG_AXIS_MIN_PX}px unterschritten`,
      );
      assertLegacyCategory(
        item,
        item.longAxis > FOOD_LONG_AXIS_MAX_PX,
        FOOD_LEGACY_ABOVE_MAX,
        `${FOOD_LONG_AXIS_MAX_PERCENT} % / ${FOOD_LONG_AXIS_MAX_PX}px überschritten`,
      );
      assertLegacyCategory(
        item,
        item.absCenterOffsetX > FOOD_CENTER_MAX_OFFSET_PX || item.absCenterOffsetY > FOOD_CENTER_MAX_OFFSET_PX,
        FOOD_LEGACY_OFF_CENTER,
        `Zentrum außerhalb ±${FOOD_CENTER_MAX_OFFSET_PX}px`,
      );
    });
  }

  console.log(`ICON_GEOMETRY_FOOD ${JSON.stringify({
    count: foods.length,
    target: {
      longAxisPercent: [FOOD_LONG_AXIS_MIN_PERCENT, FOOD_LONG_AXIS_MAX_PERCENT],
      longAxisPx: [FOOD_LONG_AXIS_MIN_PX, FOOD_LONG_AXIS_MAX_PX],
      centerOffsetPx: FOOD_CENTER_MAX_OFFSET_PX,
    },
    legacy: {
      belowMin: FOOD_LEGACY_BELOW_MIN.size,
      aboveMax: FOOD_LEGACY_ABOVE_MAX.size,
      offCenter: FOOD_LEGACY_OFF_CENTER.size,
    },
    ...summary(foods),
  })}`);
});

test("Recipe-V2: kompletter Bestand hält den technischen Mindestrand ein", async (t) => {
  const recipes = audit("recipes");
  assert.ok(recipes.length > 0, "Recipe-V2-Bestand darf nicht leer sein");

  for (const item of recipes) {
    await t.test(item.file, () => {
      assert.ok(
        item.margins.left >= RECIPE_MIN_MARGIN_PX &&
        item.margins.top >= RECIPE_MIN_MARGIN_PX &&
        item.margins.right >= RECIPE_MIN_MARGIN_PX &&
        item.margins.bottom >= RECIPE_MIN_MARGIN_PX,
        `${geometryLabel(item)}; mindestens ${RECIPE_MIN_MARGIN_PX}px sichtbarer Freiraum je Seite erwartet`,
      );
    });
  }

  console.log(`ICON_GEOMETRY_RECIPE ${JSON.stringify({ count: recipes.length, ...summary(recipes) })}`);
});
