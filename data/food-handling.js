"use strict";

/*
 * Strukturierter Handling-/Darreichungsvertrag.
 *
 * Fachliche Trennung:
 * - keine Mahlzeiteneignung
 * - keine Alters-/Allergenregel
 * - keine Ableitung aus safeForm-/note-Freitext
 * - keine lineare Annahme "Brei -> Fingerfood"
 * - orale Verarbeitung ist eine orthogonale Dimension und keine implizite
 *   Handling-Migration
 *
 * Nicht aufgeführte FOODs/Rezepte bleiben bis zur Einzelmigration im bestehenden
 * Legacy-Verhalten. Eine orale Klassifikation in RECIPE_ORAL_PROCESSING_CONTRACT
 * ersetzt ausdrücklich nicht automatisch die Legacy-Stage-Sperre.
 */

const HANDLING_MODES = Object.freeze({
  SPOON_SMOOTH: "spoon-smooth",
  SPOON_MASHED: "spoon-mashed",
  SPOON_SOFT_LUMPY: "spoon-soft-lumpy",
  FINGER_GRASPABLE: "finger-graspable",
  FINGER_SMALL_SOFT: "finger-small-soft",
});

const ORAL_PROCESSING_PROFILES = Object.freeze({
  SOFT_BREAKDOWN: "soft-breakdown",
  EASY_BITE_SEPARATE: "easy-bite-separate",
  STRUCTURED_CHEW_REQUIRED: "structured-chew-required",
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

/*
 * Orale Verarbeitungsdimension für einzeln fachlich geprüfte, zusammenhängende
 * Fingerfoods. Dieser Contract ist absichtlich separat vom Handling-Contract:
 * Ein Eintrag hier dokumentiert die orale Material-/Bissanforderung, migriert
 * das Rezept aber nicht automatisch aus dem konservativen Stage-Fallback.
 */
const RECIPE_ORAL_PROCESSING_CONTRACT = Object.freeze({
  "Obst-Hafer-Pancakes": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Klein und flach, vollständig aber weich durchgaren; keine harte oder stark gebräunte Kruste.",
  }),
  "Birne-Hirse-Pancakes": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Klein und flach, vollständig und weich durchgaren; keine harte oder trockene Kruste.",
  }),
  "Gemüse-Hafer-Pancakes": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Klein und flach, vollständig aber weich durchgaren; keine harte Kruste.",
  }),
  "Zucchini-Hafer-Pancakes": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Dünn, weich und vollständig durchgaren; keine harte oder trockene Kruste.",
  }),
  "Ube-Bananen-Pancakes": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Ube vollständig weich garen und den Pancake weich durchgaren; keine harte oder trockene Kruste.",
  }),
  "Rind-Hafer-Bällchen": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Nur in der separat freigegebenen sehr weichen, flachen oder länglichen Form; keine feste runde Kugel und keine harte Kruste.",
  }),
  "Geflügel-Gemüse-Hafer-Bällchen": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Flach oder länglich, vollständig durchgegart, weich und saftig, ohne harte Kruste; leicht auseinanderteilbar, der abgetrennte Bissen darf nicht federnd, gummiartig oder kompakt-elastisch bleiben.",
  }),
  "Lachs-Kartoffel-Bällchen": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
    servingRequirement: "Lachs vollständig gegart und grätenfrei mit weicher Kartoffel zerdrücken, flach formen und weich anbieten.",
  }),
  "Rote-Linsen-Gemüsebällchen": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
    servingRequirement: "Sehr weiche Linsen mit weichem Gemüse beziehungsweise Püree, flach, weich und saftig; nicht trocken anbieten.",
  }),
  "Tofu-Brokkoli-Bällchen": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
    servingRequirement: "Naturtofu und sehr weichen Brokkoli fein zerdrücken, flach formen und weich servieren.",
  }),
  "Brokkoli-Kartoffel-Taler": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
    servingRequirement: "Sehr weichen Brokkoli und Kartoffel zerdrücken, flach formen und nur weich erhitzen oder backen.",
  }),
  "Zucchini-Hafer-Puffer": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Dünn, weich und vollständig durchgaren; keine knusprige oder harte Kante.",
  }),
  "Kichererbsen-Kürbis-Taler": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
    servingRequirement: "Kichererbsen sehr weich und sehr fein zerdrücken, mit Kürbispüree flach und weich garen; Binder nur sparsam verwenden.",
  }),
  "Rote-Linsen-Bratlinge": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
    servingRequirement: "Sehr weich gekochte Linsen flach formen und weich sowie saftig statt trocken garen.",
  }),
  "Polenta-Zucchini-Sticks": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
    servingRequirement: "Dicke weiche Polenta mit weich gegarter Zucchini in breite gut greifbare Sticks schneiden; keine harte oder trockene Kruste.",
  }),
  Omelettstreifen: Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Vollständig durchgaren, weich halten und in breite gut greifbare Streifen schneiden.",
  }),
  "Zucchini-Omelett": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Diese Einstufung gilt für breite, weich gehaltene und gut greifbare Streifen; kleine Stücke bleiben eine separate Handlingfrage.",
  }),
  "Bangus-Kartoffel-Taler": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
    servingRequirement: "Nur vollständig entgräteten Bangus mit weicher Kartoffel zerdrücken, flach formen und weich anbieten; die separate Entgrätungs-Safety bleibt unverändert.",
  }),
  "Kichererbsenmehl-Zucchini-Taler": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Kleine flache Taler vollständig durchgaren und weich halten; nicht trocken oder knusprig werden lassen.",
  }),
  "Eier-Finger": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Ei vollständig garen und in gut greifbaren länglichen Stücken weich anbieten; nicht trocken oder gummiartig übergaren.",
  }),
  "Paprika-Omelettstreifen": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Paprika sehr fein und weich garen, Omelett vollständig durchgaren und weich in breite gut greifbare Streifen schneiden.",
  }),
  "Ei-Champignon-Cups": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Nur weich gebackene, nicht gummiartige Masse verwenden und zum Servieren in breite oder längliche gut greifbare Stücke schneiden.",
  }),
  "Buchweizen-Bananen-Pancakes": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Kleine Pancakes vollständig durchgaren und weich halten; keine harte oder trockene Kruste.",
  }),
  "Süßkartoffel-Linsen-Taler": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
    servingRequirement: "Süßkartoffel und sehr weiche rote Linsen zerdrücken, flach formen, vollständig garen und weich halten.",
  }),
  "Gebackene Saba-Banane": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
    servingRequirement: "Nur reife Saba vollständig weich backen oder dämpfen und in gut greifbaren weichen Stücken anbieten.",
  }),
  "Bananen-Joghurt-Hafer-Pancakes": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Klein und flach bei niedriger Hitze vollständig durchgaren und weich halten.",
  }),
  "Obst-Joghurt-Hafer-Ofenbites": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Flach und weich backen, nicht austrocknen lassen und anschließend in gut greifbare Stücke schneiden.",
  }),
  "Zucchini-Joghurt-Hafer-Bites": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Flach und weich vollständig backen, keine harte Kruste entstehen lassen und gut greifbar servieren.",
  }),
  "Joghurt-Hafer-Waffeln": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Nur hell und weich ausbacken, harte Kanten entfernen und in breite gut greifbare Streifen oder Stücke schneiden.",
  }),
  "Weiche Joghurt-Fladen": Object.freeze({
    oralProcessing: ORAL_PROCESSING_PROFILES.EASY_BITE_SEPARATE,
    servingRequirement: "Klein und flach vollständig, aber weich backen; keine harte oder dunkle Kruste und nicht trocken oder zäh servieren.",
  }),
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    HANDLING_MODES,
    ORAL_PROCESSING_PROFILES,
    FOOD_HANDLING_CONTRACT,
    RECIPE_HANDLING_CONTRACT,
    RECIPE_ORAL_PROCESSING_CONTRACT,
  };
}
