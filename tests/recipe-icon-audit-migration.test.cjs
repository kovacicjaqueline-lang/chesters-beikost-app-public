"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const iconSource = fs.readFileSync(path.join(ROOT, "js", "icons.js"), "utf8");
const serviceWorkerCore = fs.readFileSync(path.join(ROOT, "sw-core.js"), "utf8");

const APPROVED_RECIPE_ICONS = Object.freeze({
  "Baby-Linsen-Bolognese": ["baby-linsen-bolognese", "bbe9acba946bdfc17c55997c4dea939a55b0bc735acbb419166da38ea528483c"],
  "Bohnen-Kartoffel-Stampf": ["bohnen-kartoffel-stampf", "0aa5b33ad434bcc7b57287da8fa6a5543585c0a52d94d092e9054b6032d845d9"],
  "Buttermilch-Hirse-Obstbrei": ["buttermilch-hirse-obstbrei", "2da12512713ef0778dd5f2c2c05b6ad6104e846b9ca4e15af9663381ece29b8a"],
  "Huhn-Brokkoli-Reis": ["huhn-brokkoli-reis", "0e2e42777072927e9b573a7f56d654b4155fce5f3ba2eafb7cfd19121945ee65"],
  "Kalabasa mit Kokos": ["kalabasa-mit-kokos", "e5b8084cd16b79a3527134b5e5a17873a389f11ecbffee7f711742b370cdc649"],
  "Obst-Hafer-Joghurt": ["obst-hafer-joghurt", "666c38942fd019e3bca21c0804798df30805cf162ec94b22296cf208cc6f76de"],
  "Obst-Haferbrei": ["obst-haferbrei", "866bcf6f234f0bbc6b6e65e3d66617320f77055c8b988d06c5d621f08e82f5c4"],
  "Rind-Gemüse-Bolognese": ["rind-gemuese-bolognese", "a7c1819f24fb256aa99e24133c36881c66b2c341539e624e17158d038c45e00f"],
  "Weiches Rührei": ["weiches-ruehrei", "e97df2635b49be396be300a6e0dbcf9ec6ac4a2b4abc79a32483ce215ab90225"],
});

for (const [recipeName, [id, expectedHash]] of Object.entries(APPROVED_RECIPE_ICONS)) {
  test(`migriertes Recipe-Icon bleibt freigegeben: ${recipeName}`, () => {
    const relativePath = `assets/illustrations-v2/recipes/${id}.svg`;
    const svg = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    const actualHash = crypto.createHash("sha256").update(svg).digest("hex");

    assert.equal(actualHash, expectedHash, `${recipeName}: freigegebener Assetstand wurde verändert`);
    assert.match(svg, /<svg[^>]+(?:width="128"[^>]+height="128"|height="128"[^>]+width="128")[^>]*>/);
    assert.match(svg, /viewBox="0 0 128 128"/);
    assert.match(svg, /data:image\/png;base64,[A-Za-z0-9+/=]+/);
    assert.ok(iconSource.includes(`"${recipeName}": "${relativePath}"`), `${recipeName}: aktive Zuordnung fehlt`);
    assert.ok(serviceWorkerCore.includes(`"./${relativePath}"`), `${recipeName}: Offline-Precache fehlt`);
  });
}

test("Joghurt-Zutatenwürfel bleibt vollständig aus dem aktiven Public-Stand entfernt", () => {
  const recipeSource = fs.readFileSync(path.join(ROOT, "data", "recipes.js"), "utf8");
  assert.doesNotMatch(recipeSource, /Joghurt-Zutatenwürfel|joghurt-zutatenwuerfel/);
  assert.doesNotMatch(iconSource, /Joghurt-Zutatenwürfel|joghurt-zutatenwuerfel/);
  assert.doesNotMatch(serviceWorkerCore, /joghurt-zutatenwuerfel/);
});
