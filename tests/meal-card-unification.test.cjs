const assert = require("node:assert/strict");
const test = require("node:test");

const {
  compactStockBadgeData,
  stockBadgeIconMarkup,
} = require("../js/meal-card-unification.js");

test("FOOD-Vorrat zeigt eine einzelne Vorratszutat auch bei identischem Mahlzeitentitel", () => {
  assert.deepEqual(
    compactStockBadgeData("food", "Kartoffel", "Kartoffel"),
    {
      visible: "Vorrat: Kartoffel",
      accessible: "Aus Vorrat: Kartoffel",
    },
  );
});

test("FOOD-Vorrat zeigt mehrere Vorratszutaten", () => {
  assert.deepEqual(
    compactStockBadgeData("food", "Kartoffel, Zucchini"),
    {
      visible: "Vorrat: Kartoffel, Zucchini",
      accessible: "Aus Vorrat: Kartoffel, Zucchini",
    },
  );
});

test("FOOD-Vorrat ohne auflösbare Zutaten erzeugt kein alleinstehendes Vorratsbadge", () => {
  assert.equal(compactStockBadgeData("food", ""), null);
});

test("Rezeptvorrat bleibt als eigener sichtbarer Zustand erhalten", () => {
  assert.deepEqual(
    compactStockBadgeData("recipe"),
    {
      visible: "Rezeptvorrat",
      accessible: "Aus Rezeptvorrat",
    },
  );
});

test("Vorratsbadge verwendet ein neutrales currentColor-Outline-Icon statt Schneeflocke", () => {
  const icon = stockBadgeIconMarkup();
  assert.doesNotMatch(icon, /❄/);
  assert.match(icon, /class="stock-badge-icon"/);
  assert.match(icon, /fill="none"/);
  assert.match(icon, /stroke="currentColor"/);
  assert.match(icon, /aria-hidden="true"/);
});
