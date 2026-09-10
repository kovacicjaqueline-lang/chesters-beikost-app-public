"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

function requiredHtmlAsset(pattern, label) {
  const match = html.match(pattern);
  assert.ok(match, `${label} muss von index.html geladen werden`);
  return `./${match[1]}`;
}

test("Mobile Beikost/Mehr: neue Runtime-Dateien sind beim ersten Offline-Start vorgecached", () => {
  const styleAsset = requiredHtmlAsset(/href="(mobile-beikost-more\.css\?v=[^"]+)"/, "Mobile-Beikost/Mehr-CSS");
  const scriptAsset = requiredHtmlAsset(/src="(js\/mobile-beikost-more\.js\?v=[^"]+)"/, "Mobile-Beikost/Mehr-JavaScript");

  const uiPrecache = sw.match(/const UI_PRECACHE\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(uiPrecache, "sw.js muss einen UI_PRECACHE-Vertrag besitzen");

  for (const asset of [styleAsset, scriptAsset]) {
    assert.ok(
      uiPrecache[1].includes(`"${asset}"`),
      `${asset} muss mit exakt derselben versionierten URL in UI_PRECACHE stehen`,
    );
  }

  assert.match(
    sw,
    /const requiredPrecache\s*=\s*\[[\s\S]*\.\.\.UI_PRECACHE[\s\S]*\];/,
    "UI_PRECACHE muss Teil des atomaren Install-Precaches bleiben",
  );
});
