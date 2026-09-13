"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const catalogNavigation = read("catalog-navigation.css");
const mobileCatalog = read("mobile-beikost-more.css");
const prepMobile = read("prep-mobile.css");

function rule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"))?.[1] || "";
}

test("mobile Sticky-Flächen sind vollständig opak und lassen keinen Scroll-Inhalt durchscheinen", () => {
  const stickyRules = [
    rule(catalogNavigation, "body.mobile-foundation .app-header"),
    rule(mobileCatalog, "body.mobile-foundation #foods .catalog-switch"),
    rule(mobileCatalog, "body.mobile-foundation #foods .mobile-catalog-search"),
    rule(mobileCatalog, "body.mobile-foundation #more .more-panel-header"),
    rule(prepMobile, "body.mobile-foundation #prep .prep-segments"),
  ];

  for (const stickyRule of stickyRules) {
    assert.match(stickyRule, /background:\s*(?:rgb\([^)]*\)|#[0-9a-f]{6})\s*;/i);
    assert.doesNotMatch(stickyRule, /background:\s*rgba\(/i);
    assert.match(stickyRule, /backdrop-filter:\s*none\s*;/);
  }
});

test("mobile Sticky-Flächen behalten ihre obere Verankerung", () => {
  assert.match(rule(mobileCatalog, "body.mobile-foundation #foods .catalog-switch"), /position:\s*sticky;[\s\S]*top:\s*0;/);
  assert.match(rule(mobileCatalog, "body.mobile-foundation #foods .mobile-catalog-search"), /position:\s*sticky;[\s\S]*top:\s*57px;/);
  assert.match(rule(mobileCatalog, "body.mobile-foundation #more .more-panel-header"), /position:\s*sticky;[\s\S]*top:\s*0;/);
  assert.match(rule(prepMobile, "body.mobile-foundation #prep .prep-segments"), /position:\s*sticky;[\s\S]*top:\s*0;/);
});
