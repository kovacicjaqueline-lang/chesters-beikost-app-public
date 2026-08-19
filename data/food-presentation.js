"use strict";

/*
 * Strukturierte Darstellungsmetadaten für automatische FOOD-only-Mahlzeiten.
 *
 * Diese Daten sind keine Mahlzeiteneignung und verändern keine Planner-Auswahl.
 * Sie beschreiben ausschließlich bereits fachlich bestätigte Darstellungsrollen.
 * Neue Rollen oder Lebensmittel werden hier erst nach eigener fachlicher Freigabe
 * ergänzt; Freitext aus safeForm/prep wird nicht als Steuerlogik verwendet.
 */
const FOOD_PRESENTATION_CONTRACT = Object.freeze({
  gurke: Object.freeze({ role: "fresh-side" }),
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FOOD_PRESENTATION_CONTRACT };
}
