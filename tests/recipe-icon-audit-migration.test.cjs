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
  "Baby-Linsen-Bolognese": ["baby-linsen-bolognese", "194806d22d64a90109e93cf41db80230c62cf9861d048f502e56a5d1ef17b1a2"],
  "Bohnen-Kartoffel-Stampf": ["bohnen-kartoffel-stampf", "9128dbbbeebe80058b7639ceecfcf935e5feeb0de109079359d23c48adfa9aca"],
  "Buttermilch-Hirse-Obstbrei": ["buttermilch-hirse-obstbrei", "d3e71fb6745d6a9e830ed893b9767dceb64e7ef0a714def8215e16d8b3d1bb2d"],
  "Huhn-Brokkoli-Reis": ["huhn-brokkoli-reis", "9dcac2fa7b58e669b43e3aa194258f850e65f8058b342126ce2a768e3d79e9c9"],
  "Kalabasa mit Kokos": ["kalabasa-mit-kokos", "84b198bd44aebf16d4566aeec2157a8d0939ec5c724bad0dd9689d667d57ec0d"],
  "Obst-Hafer-Joghurt": ["obst-hafer-joghurt", "25d35610e3ed546b35c02efebd3af9a2bd99bab1c1ada1992aa43159227eac68"],
  "Obst-Haferbrei": ["obst-haferbrei", "d2f821f135855a3de990af5f1a2ff64739ede98bec98c7d161a7990d3d939a48"],
  "Rind-Gemüse-Bolognese": ["rind-gemuese-bolognese", "a1c25e883ca12b116502eb69cda0eadc88a4ba828591448390f673dd2e4c682d"],
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
