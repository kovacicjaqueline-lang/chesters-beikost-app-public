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
  "Buttermilch-Hirse-Obstbrei": ["buttermilch-hirse-obstbrei", "0adc786fc7f817718d2bed9094a32866c04009765f36d51e2824b8b452979f47"],
  "Huhn-Brokkoli-Reis": ["huhn-brokkoli-reis", "9dcac2fa7b58e669b43e3aa194258f850e65f8058b342126ce2a768e3d79e9c9"],
  "Kalabasa mit Kokos": ["kalabasa-mit-kokos", "2f05ca46f2acec64fa2c6d980216973b380bb5b96a0bef8d2114dec123a22984"],
  "Obst-Hafer-Joghurt": ["obst-hafer-joghurt", "25d35610e3ed546b35c02efebd3af9a2bd99bab1c1ada1992aa43159227eac68"],
  "Obst-Haferbrei": ["obst-haferbrei", "7085c81889ab889ad90e32b24ed7ba1d798c727a5be96a9f358bf2c6c2ad75f5"],
  "Rind-Gemüse-Bolognese": ["rind-gemuese-bolognese", "78597c49013033df34236f5add71c8e1aaedc00f4fe8adce46d56af0e087d41b"],
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
