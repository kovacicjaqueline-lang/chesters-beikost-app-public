"use strict";

/*
 * Explizit geprüfte Kombinationen aus einem vollständigen Rezept
 * und einem zusätzlichen einzelnen Lebensmittel.
 *
 * Diese Liste bleibt bewusst kuratiert: Ein Rezept darf nicht automatisch
 * mit beliebigen Lebensmitteln kombiniert werden.
 */
const RECIPE_FOOD_PAIRING_DATA = Object.freeze([
  Object.freeze({
    key: "karotten-polenta-brei+rind",
    recipeName: "Karotten-Polenta-Brei",
    meals: Object.freeze(["lunch", "dinner"]),
    additionalFoodIds: Object.freeze(["rind"]),
    priority: 10,
  }),
]);

if (typeof module !== "undefined" && module.exports) {
  module.exports = { RECIPE_FOOD_PAIRING_DATA };
}
