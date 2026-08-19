"use strict";

/*
 * Strukturierter Handling-/Darreichungsvertrag – Wave 1.
 *
 * Fachliche Trennung:
 * - keine Mahlzeiteneignung
 * - keine Alters-/Allergenregel
 * - keine Ableitung aus safeForm-/note-Freitext
 * - keine lineare Annahme "Brei -> Fingerfood"
 *
 * Nicht aufgeführte FOODs/Rezepte bleiben bis zur Einzelmigration im bestehenden
 * Legacy-Verhalten. SAFETY-REVIEW- und LATER-REVIEW-Fälle sind bewusst nicht hier.
 */

const HANDLING_MODES = Object.freeze({
  SPOON_SMOOTH: "spoon-smooth",
  SPOON_MASHED: "spoon-mashed",
  SPOON_SOFT_LUMPY: "spoon-soft-lumpy",
  FINGER_GRASPABLE: "finger-graspable",
  FINGER_SMALL_SOFT: "finger-small-soft",
});

const FOOD_HANDLING_CONTRACT = Object.freeze({
  karotte: Object.freeze({
    modes: Object.freeze([
      HANDLING_MODES.SPOON_SMOOTH,
      HANDLING_MODES.SPOON_MASHED,
      HANDLING_MODES.FINGER_GRASPABLE,
    ]),
  }),
  kartoffel: Object.freeze({
    modes: Object.freeze([
      HANDLING_MODES.SPOON_SMOOTH,
      HANDLING_MODES.SPOON_MASHED,
      HANDLING_MODES.FINGER_GRASPABLE,
    ]),
  }),
  zucchini: Object.freeze({
    modes: Object.freeze([
      HANDLING_MODES.SPOON_SMOOTH,
      HANDLING_MODES.SPOON_MASHED,
      HANDLING_MODES.FINGER_GRASPABLE,
    ]),
  }),
  brokkoli: Object.freeze({
    modes: Object.freeze([
      HANDLING_MODES.SPOON_SMOOTH,
      HANDLING_MODES.SPOON_MASHED,
      HANDLING_MODES.FINGER_GRASPABLE,
    ]),
  }),
  karfiol: Object.freeze({
    modes: Object.freeze([
      HANDLING_MODES.SPOON_SMOOTH,
      HANDLING_MODES.SPOON_MASHED,
      HANDLING_MODES.FINGER_GRASPABLE,
    ]),
  }),
  suesskartoffel: Object.freeze({
    modes: Object.freeze([
      HANDLING_MODES.SPOON_SMOOTH,
      HANDLING_MODES.SPOON_MASHED,
      HANDLING_MODES.FINGER_GRASPABLE,
    ]),
  }),
  banane: Object.freeze({
    modes: Object.freeze([
      HANDLING_MODES.SPOON_MASHED,
      HANDLING_MODES.FINGER_GRASPABLE,
    ]),
  }),
  avocado: Object.freeze({
    modes: Object.freeze([
      HANDLING_MODES.SPOON_MASHED,
      HANDLING_MODES.FINGER_GRASPABLE,
    ]),
  }),
});

const RECIPE_HANDLING_CONTRACT = Object.freeze({
  "Obst-Hafer-Pancakes": Object.freeze({
    modes: Object.freeze([HANDLING_MODES.FINGER_GRASPABLE]),
  }),
  "Birne-Hirse-Pancakes": Object.freeze({
    modes: Object.freeze([HANDLING_MODES.FINGER_GRASPABLE]),
  }),
  "Gemüse-Hafer-Pancakes": Object.freeze({
    modes: Object.freeze([HANDLING_MODES.FINGER_GRASPABLE]),
  }),
  Omelettstreifen: Object.freeze({
    modes: Object.freeze([HANDLING_MODES.FINGER_GRASPABLE]),
  }),
  "Zucchini-Omelett": Object.freeze({
    modes: Object.freeze([HANDLING_MODES.FINGER_GRASPABLE]),
  }),
  "Brokkoli-Kartoffel-Stampf": Object.freeze({
    modes: Object.freeze([
      HANDLING_MODES.SPOON_MASHED,
      HANDLING_MODES.SPOON_SOFT_LUMPY,
    ]),
  }),
  "Zucchini-Kartoffel-Brei": Object.freeze({
    modes: Object.freeze([
      HANDLING_MODES.SPOON_SMOOTH,
      HANDLING_MODES.SPOON_MASHED,
    ]),
  }),
  "Avocado-Bananen-Creme": Object.freeze({
    modes: Object.freeze([HANDLING_MODES.SPOON_MASHED]),
  }),
  "Bananen-Ei-Pancakes": Object.freeze({
    modes: Object.freeze([HANDLING_MODES.FINGER_GRASPABLE]),
  }),
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    HANDLING_MODES,
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
  };
}
