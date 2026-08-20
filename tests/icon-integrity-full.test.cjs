"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { assertV2Asset } = require("./helpers/icon-integrity-png.cjs");
const {
  clonePlain,
  duplicateGroups,
  evaluateDeclaredValue,
  normalizeRepoPath,
  parsePrecacheFiles,
  rawStringMappingEntries,
} = require("./helpers/icon-integrity-source.cjs");

const ROOT = path.resolve(__dirname, "..");
const KNOWN_RUNTIME_FOOD_V2_GAPS = Object.freeze([
  ["schwertfisch", "Schwertfisch"],
  ["heilbutt", "Heilbutt"],
  ["hecht", "Hecht"],
  ["koenigsmakrele", "Königsmakrele"],
  ["buttermakrele", "Buttermakrele"],
  ["schlangenmakrele", "Schlangenmakrele"],
]);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function v2SvgFiles(directory, prefix) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
    .map((entry) => `${prefix}/${entry.name}`)
    .sort();
}

const iconSource = read("js/icons.js");
const appSource = read("app.js");
const foodDataSource = read("data/foods.js");
const recipeDataSource = read("data/recipes.js");
const serviceWorkerCore = read("sw-core.js");
const canonicalFoods = evaluateDeclaredValue(foodDataSource, "FOOD_DB", "data/foods.js");
const recipes = evaluateDeclaredValue(recipeDataSource, "RECIPES", "data/recipes.js");

function loadEffectiveIconRuntime() {
  const context = {
    console: { error() {}, warn() {}, log() {} },
    document: { addEventListener() {} },
    FOOD_DB: clonePlain(canonicalFoods),
    RECIPES: clonePlain(recipes),
    ID_ALIASES: {},
    esc: (value) => String(value ?? ""),
    food(id) { return context.FOOD_DB.find((item) => item.id === id) || null; },
  };
  for (const name of [
    "rank", "eatenExposureCount", "eligibleCore", "isTrustedBase", "knownBase", "chooseFocus",
    "introductionCandidate", "knownCandidate", "companionFor", "breakfastReady", "manualMealRoleInfo",
    "manualMealValidation", "recipeSuitableForMeal", "buildDay", "displayStatus", "applyFollowUpPlan",
    "recipeFoodIds", "bootstrapStorage",
  ]) context[name] = () => null;

  vm.createContext(context);
  vm.runInContext(`${iconSource}\n;this.__icons = { FOOD_ICON_PATHS, RECIPE_ICON_PATHS };`, context, { filename: "js/icons.js", timeout: 2_000 });
  vm.runInContext(`${appSource}\n;this.__install = installFoodPolicyRuntime;`, context, { filename: "app.js", timeout: 2_000 });
  vm.runInContext("__install(); this.__foods = FOOD_DB; this.__foodPath = foodIllustrationPath;", context, { timeout: 2_000 });
  return {
    foodPaths: clonePlain(context.__icons.FOOD_ICON_PATHS),
    recipePaths: clonePlain(context.__icons.RECIPE_ICON_PATHS),
    runtimeFoods: clonePlain(context.__foods),
    foodIllustrationPath: context.__foodPath,
  };
}

const runtime = loadEffectiveIconRuntime();
const foodEntries = rawStringMappingEntries(iconSource, "FOOD_ICON_PATHS");
const recipeEntries = rawStringMappingEntries(iconSource, "RECIPE_ICON_PATHS");
const foodAssets = v2SvgFiles(path.join(ROOT, "assets/illustrations-v2/foods"), "assets/illustrations-v2/foods");
const recipeAssets = v2SvgFiles(path.join(ROOT, "assets/illustrations-v2/recipes"), "assets/illustrations-v2/recipes");
const allAssets = [...foodAssets, ...recipeAssets].sort();
const precacheFiles = parsePrecacheFiles(serviceWorkerCore);

function effectiveFoodMappingId(food) {
  if (food?.illustrationId && runtime.foodPaths[food.illustrationId]) return food.illustrationId;
  if (food?.id && runtime.foodPaths[food.id]) return food.id;
  return null;
}

for (const [label, entries] of [["FOOD_ICON_PATHS", foodEntries], ["RECIPE_ICON_PATHS", recipeEntries]]) {
  test(`${label}: keine doppelten Mapping-Schlüssel oder Assetziele`, () => {
    assert.deepEqual(duplicateGroups(entries, 0).map(([key]) => key), [], `${label}: doppelte Schlüssel im Rohmapping`);
    assert.deepEqual(
      duplicateGroups(entries, 1).map(([target, group]) => [target, group.map(([key]) => key)]),
      [],
      `${label}: mehrere Mapping-Schlüssel zeigen unerwartet auf dasselbe Asset`,
    );
  });
}

test("aktive FOOD-/Recipe-Mappings zeigen auf existente V2-Assets", () => {
  for (const [id, relativePath] of foodEntries) {
    assert.match(relativePath, /^assets\/illustrations-v2\/foods\/[^/]+\.svg$/, `${id}: FOOD-Mapping außerhalb Food-V2`);
    assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `${id}: FOOD-Asset fehlt: ${relativePath}`);
  }
  for (const [name, relativePath] of recipeEntries) {
    assert.match(relativePath, /^assets\/illustrations-v2\/recipes\/[^/]+\.svg$/, `${name}: Recipe-Mapping außerhalb Recipe-V2`);
    assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `${name}: Recipe-Asset fehlt: ${relativePath}`);
  }

  const activeFoodMappingIds = [...new Set(runtime.runtimeFoods
    .filter((food) => food.active !== false)
    .map(effectiveFoodMappingId)
    .filter(Boolean))].sort();
  assert.deepEqual(Object.keys(runtime.foodPaths).sort(), activeFoodMappingIds, "FOOD_ICON_PATHS enthält verwaiste oder fehlende aktive Mapping-Schlüssel");

  const activeRecipeNames = recipes.filter((recipe) => recipe.active !== false).map((recipe) => recipe.name).sort((a, b) => a.localeCompare(b, "de"));
  assert.deepEqual(Object.keys(runtime.recipePaths).sort((a, b) => a.localeCompare(b, "de")), activeRecipeNames, "RECIPE_ICON_PATHS enthält verwaiste oder fehlende aktive Mapping-Schlüssel");
});

test("Runtime-FOODs: nur die 6 dokumentierten V2-Soll/Ist-Gaps bleiben offen", () => {
  const missing = runtime.runtimeFoods
    .filter((food) => food.active !== false && !effectiveFoodMappingId(food))
    .map((food) => [food.id, food.name])
    .sort(([a], [b]) => a.localeCompare(b));
  const expected = [...KNOWN_RUNTIME_FOOD_V2_GAPS].sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(missing, expected);
});

test("Runtime-FOOD-Illustration berücksichtigt illustrationId und id-Fallback exakt", () => {
  const redirects = runtime.runtimeFoods.filter((food) => food.active !== false && food.illustrationId && food.illustrationId !== food.id);
  assert.ok(redirects.some((food) => food.id === "mais" && food.illustrationId === "mais-polenta"), "Mais-Redirect muss erhalten bleiben");
  for (const food of runtime.runtimeFoods.filter((item) => item.active !== false)) {
    const mappingId = effectiveFoodMappingId(food);
    if (mappingId) assert.equal(runtime.foodIllustrationPath(food), runtime.foodPaths[mappingId], `${food.name}: falsche effektive Runtime-Illustration`);
  }
  const fallback = runtime.runtimeFoods.find((food) => food.active !== false && runtime.foodPaths[food.id]);
  assert.ok(fallback, "FOOD mit direktem id-Mapping für Fallback-Test fehlt");
  assert.equal(
    runtime.foodIllustrationPath({ ...fallback, illustrationId: "__missing_integrity_illustration__" }),
    runtime.foodPaths[fallback.id],
    "ungültige illustrationId muss auf vorhandenes id-Mapping zurückfallen",
  );
});

test("V2-Mappings, Dateibestand und Service-Worker-Precache sind exakt deckungsgleich", () => {
  const referenced = [...Object.values(runtime.foodPaths), ...Object.values(runtime.recipePaths)].map(normalizeRepoPath).sort();
  assert.deepEqual(allAssets, referenced, "unreferenzierte V2-Assets oder Mapping auf nicht vorhandene V2-Datei");
  const precached = precacheFiles.filter((item) => item.startsWith("assets/illustrations-v2/") && item.endsWith(".svg")).sort();
  assert.deepEqual(precached, allAssets, "V2-Precache enthält fehlende, doppelte oder veraltete Assetpfade");
});

test("sämtliche Food-/Recipe-V2-SVGs erfüllen 128×128, PNG-CRC/Decode und Alpha-Integrität", () => {
  for (const relativePath of allAssets) assertV2Asset(ROOT, relativePath);
});
