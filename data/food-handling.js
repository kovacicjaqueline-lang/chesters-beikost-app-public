"use strict";

/*
 * Strukturierter FOOD-/Rezept-Handling-, Bite-Separation- und Oral-Processing-Contract.
 *
 * Handling, Bissabtrennung, orale Verarbeitung, Safety und Altersorientierung
 * bleiben getrennte Dimensionen. Die Rezeptmigration basiert auf
 * Einzelentscheidungen; aus Kategorien, Alter oder stage werden keine
 * Capability-Regeln abgeleitet.
 */

const HANDLING_MODES = Object.freeze({
  SPOON_SMOOTH: "spoon-smooth",
  SPOON_MASHED: "spoon-mashed",
  SPOON_SOFT_LUMPY: "spoon-soft-lumpy",
  FINGER_GRASPABLE: "finger-graspable",
  FINGER_SMALL_SOFT: "finger-small-soft",
});

const BITE_SEPARATION_PROFILES = Object.freeze({
  LOW_RESISTANCE_SEPARATE: "low-resistance-separate",
  EASY_BITE_SEPARATE: "easy-bite-separate",
  GRADED_BITE_REQUIRED: "graded-bite-required",
});

const ORAL_PROCESSING_PROFILES = Object.freeze({
  SOFT_BREAKDOWN: "soft-breakdown",
  EASY_CHEW: "easy-chew",
  STRUCTURED_CHEW_REQUIRED: "structured-chew-required",
});

const HANDLING_CAPABILITIES = Object.freeze({
  SMALL_SOFT_PIECES: "small-soft-pieces",
  GRADED_BITE: "graded-bite",
  STRUCTURED_CHEW: "structured-chew",
});

const FOOD_HANDLING_CONTRACT = Object.freeze({
  karotte: Object.freeze({ modes: Object.freeze([HANDLING_MODES.SPOON_SMOOTH, HANDLING_MODES.SPOON_MASHED, HANDLING_MODES.FINGER_GRASPABLE]) }),
  kartoffel: Object.freeze({ modes: Object.freeze([HANDLING_MODES.SPOON_SMOOTH, HANDLING_MODES.SPOON_MASHED, HANDLING_MODES.FINGER_GRASPABLE]) }),
  zucchini: Object.freeze({ modes: Object.freeze([HANDLING_MODES.SPOON_SMOOTH, HANDLING_MODES.SPOON_MASHED, HANDLING_MODES.FINGER_GRASPABLE]) }),
  brokkoli: Object.freeze({ modes: Object.freeze([HANDLING_MODES.SPOON_SMOOTH, HANDLING_MODES.SPOON_MASHED, HANDLING_MODES.FINGER_GRASPABLE]) }),
  karfiol: Object.freeze({ modes: Object.freeze([HANDLING_MODES.SPOON_SMOOTH, HANDLING_MODES.SPOON_MASHED, HANDLING_MODES.FINGER_GRASPABLE]) }),
  suesskartoffel: Object.freeze({ modes: Object.freeze([HANDLING_MODES.SPOON_SMOOTH, HANDLING_MODES.SPOON_MASHED, HANDLING_MODES.FINGER_GRASPABLE]) }),
  banane: Object.freeze({ modes: Object.freeze([HANDLING_MODES.SPOON_MASHED, HANDLING_MODES.FINGER_GRASPABLE]) }),
  avocado: Object.freeze({ modes: Object.freeze([HANDLING_MODES.SPOON_MASHED, HANDLING_MODES.FINGER_GRASPABLE]) }),
});

const RECIPE_CONTRACT_GROUPS = Object.freeze({
  fingerLowResistance: Object.freeze([
    "Lachs-Kartoffel-Bällchen",
    "Rote-Linsen-Gemüsebällchen",
    "Tofu-Brokkoli-Bällchen",
    "Brokkoli-Kartoffel-Taler",
    "Kichererbsen-Kürbis-Taler",
    "Süßkartoffel-Hirse-Sticks",
    "Omelettstreifen",
    "Zucchini-Omelett",
    "Bangus-Kartoffel-Taler",
    "Paprika-Omelettstreifen",
    "Süßkartoffel-Linsen-Taler",
    "Gebackene Saba-Banane",
    "Bananen-Ei-Pancakes"
  ]),
  fingerEasy: Object.freeze([
    "Obst-Hafer-Pancakes",
    "Birne-Hirse-Pancakes",
    "Gemüse-Hafer-Pancakes",
    "Zucchini-Hafer-Pancakes",
    "Ube-Bananen-Pancakes",
    "Geflügel-Gemüse-Hafer-Bällchen",
    "Zucchini-Hafer-Puffer",
    "Rote-Linsen-Bratlinge",
    "Polenta-Zucchini-Sticks",
    "Obst-Hafer-Muffins",
    "Gemüse-Hafer-Muffins",
    "Kürbis-Hirse-Muffins",
    "Kichererbsenmehl-Zucchini-Taler",
    "Eier-Finger",
    "Hummus mit weichen Gemüsesticks",
    "Buchweizen-Bananen-Pancakes",
    "Bananen-Joghurt-Hafer-Pancakes",
    "Obst-Joghurt-Hafer-Ofenbites",
    "Zucchini-Joghurt-Hafer-Bites",
    "Joghurt-Hafer-Waffeln",
    "Gemüse-Joghurt-Mini-Muffins",
    "Süßkartoffel-Linsen-Muffins",
    "Fleisch-Gemüse-Bällchen"
  ]),
  structuredChew: Object.freeze([
    "Rind-Hafer-Bällchen",
    "Baby-Bananenbrot",
    "Weiche Joghurt-Fladen",
    "Huhn-Gemüse-Muffins"
  ]),
  spoonSmoothMash: Object.freeze([
    "Obst-Haferbrei",
    "Obst-Hirsebrei",
    "Obst-Polentabrei",
    "Obst-Reisbrei",
    "Obst-Quinoabrei",
    "Obst-Buchweizenbrei",
    "Obst-Grießbrei",
    "Milch-Getreide-Brei",
    "Kürbis-Hafer-Brei",
    "Monggo-Kalabasa-Brei",
    "Karotten-Polenta-Brei",
    "Süßkartoffel-Rote-Linsen-Brei",
    "Zucchini-Quinoa-Brei",
    "Bananen-Haferbrei mit Erdnussmus",
    "Karotten-Hirse-Brei mit Tahin",
    "Apfel-Hirse-Brei mit Mandelmus",
    "Karotte-Süßkartoffel-Brei",
    "Zucchini-Kartoffel-Brei",
    "Kürbis-Kichererbsen-Creme",
    "Monggo-Süßkartoffel-Brei",
    "Ube-Hafer-Brei",
    "Obst-Joghurt",
    "Obst-Hafer-Joghurt",
    "Obst-Hirse-Joghurt",
    "Obst-Grieß-Joghurt",
    "Buttermilch-Hafer-Obstbrei",
    "Buttermilch-Hirse-Obstbrei",
    "Buttermilch-Grieß-Obstbrei"
  ]),
  spoonSoftLumpyLater: Object.freeze([
    "Gemüse-Nudel-Sauce",
    "Baby-Linsen-Bolognese",
    "Tinola-inspiriert",
    "Huhn-Karotte-Nudel-Topf",
    "Huhn-Lauch-Kartoffel-Topf",
    "Brokkoli-Linsen-Pasta",
    "Gemüse-Pasta mit Zucchini und Tomate",
    "Sayote-Huhn-Reis"
  ]),
  spoonMash: Object.freeze([
    "Lugaw-Basis",
    "Kürbis-Lugaw",
    "Kalabasa mit Kokos",
    "Tilapia-Reis-Brei",
    "Apfel-Birnen-Kompott",
    "Mildes Rote-Linsen-Dhal",
    "Rind-Gemüse-Bolognese",
    "Tomaten-Linsen-Sauce",
    "Lachs-Süßkartoffel-Stampf",
    "Avocado-Bananen-Creme",
    "Huhn-Lugaw",
    "Joghurt-Nussmus-Miniportion"
  ]),
  spoonMashLumpy: Object.freeze([
    "Arroz-caldo-inspiriert",
    "Brokkoli-Kartoffel-Stampf",
    "Karfiol-Kartoffel-Stampf",
    "Erbsen-Kartoffel-Stampf",
    "Kürbis-Linsen-Suppe",
    "Huhn-Brokkoli-Reis",
    "Lachs-Reis-Erbsen",
    "Kabeljau-Tomaten-Gemüse",
    "Weiches Rührei",
    "Tofu-Zucchini-Reis",
    "Bohnen-Kartoffel-Stampf"
  ]),
  fingerEasyLater: Object.freeze([
    "Ei-Champignon-Cups"
  ]),
  fingerSmallSoft: Object.freeze([
    "Huhn-Zucchini-Nockerl",
    "Rind-Karotten-Nockerl",
    "Linsen-Süßkartoffel-Nockerl"
  ]),
});

const RECIPE_CONTRACT_OVERRIDES = Object.freeze({
  "Rind-Hafer-Bällchen": Object.freeze({
    servingRequirement: "Sehr weich, saftig und flach oder länglich anbieten; keine runden festen Kugeln und keine harte Kruste. Erst anbieten, wenn bei der formstabilen weichen Form gezielt ein passender Bissen abgetrennt und der strukturierte Bissen anschließend sicher im Mund positioniert und wiederholt zerkleinert werden kann.",
  }),
  "Geflügel-Gemüse-Hafer-Bällchen": Object.freeze({
    servingRequirement: "Flach oder länglich und eher dünn formen, vollständig durchgaren und saftig halten. Der abgetrennte Bissen muss weich auseinanderfallen; besonders die Pute-Karotte-Variante darf innen nicht kompakt oder federnd bleiben.",
    noteOverride: "Kleine flache oder längliche und eher dünne Stücke statt fester runder Kugeln formen. Vollständig durchgaren, saftig halten und harte Kruste vermeiden. Vor dem Servieren prüfen, dass der abgetrennte Bissen weich auseinanderfällt und innen nicht kompakt oder federnd bleibt.",
  }),
  "Baby-Bananenbrot": Object.freeze({
    servingRequirement: "Vollständig durchbacken und vollständig auskühlen lassen. Die Krume darf nicht klebrig, teigig oder ballend sein; eine solche Charge nicht anbieten. In gut greifbare Stücke schneiden und erst anbieten, wenn aus der weichen formstabilen Scheibe gezielt ein passender Bissen abgetrennt und dieser anschließend sicher strukturiert gekaut werden kann.",
    noteOverride: "Zu einem weichen Teig verrühren und vollständig durchbacken. Ohne Zucker, Honig und Salz. Vollständig auskühlen lassen und in gut greifbare Stücke schneiden. Die Krume muss durchgebacken sein und darf nicht klebrig, teigig oder ballend sein; andernfalls nicht anbieten.",
  }),
  "Zucchini-Omelett": Object.freeze({
    servingRequirement: "Vollständig durchgaren, weich halten und als kanonische Fingerfood-Form in breite, gut greifbare Streifen schneiden.",
    noteOverride: "Ei und fein geriebene Zucchini vollständig durchgaren, weich halten und in breite, gut greifbare Streifen schneiden. Kleine Stücke sind eine separate spätere Handlingform und nicht die kanonische Servierform.",
  }),
  "Eier-Finger": Object.freeze({
    servingRequirement: "Ei vollständig durchgaren und in gut greifbare längliche oder geviertelte Stücke schneiden. Frisch anbieten; nicht unnötig austrocknen oder gummiartig werden lassen.",
    noteOverride: "Ei vollständig durchgaren, schälen und in gut greifbare längliche oder geviertelte Stücke schneiden. Frisch anbieten, nicht unnötig austrocknen lassen und nicht einfrieren.",
  }),
  "Hummus mit weichen Gemüsesticks": Object.freeze({
    servingRequirement: "Hummus glatt anbieten. Die Gemüsesticks müssen in der konkret angebotenen Form mechanisch weich, sicher greifbar und frei von harten, zähen oder spröden Bissen sein; roh oder gegart ist beides möglich, wenn die konkrete Form diese Anforderung erfüllt.",
  }),
  "Tinola-inspiriert": Object.freeze({
    servingRequirement: "Huhn vollständig garen und sehr fein zerpflücken oder zerkleinern; Sayote sehr weich garen und als kleine weiche Stückchen in der Löffelmahlzeit belassen.",
    noteOverride: "Huhn vollständig garen und sehr fein zerpflücken oder zerkleinern. Sayote sehr weich garen und in kleinen weichen Stückchen belassen; Malunggay fein einarbeiten. Babyportion ohne Salz, Brühewürfel oder Fischsauce als weich-stückige Löffelmahlzeit anbieten.",
  }),
  "Sayote-Huhn-Reis": Object.freeze({
    servingRequirement: "Reis und Sayote sehr weich garen; Sayote als kleine weiche Stückchen belassen und Huhn vollständig garen und sehr fein zerpflücken oder zerkleinern.",
    noteOverride: "Reis und Sayote sehr weich garen. Sayote in kleinen weichen Stückchen belassen, Huhn vollständig durchgaren und sehr fein zerpflücken oder zerkleinern. Als weich-stückige Löffelmahlzeit anbieten.",
  }),
  "Ei-Champignon-Cups": Object.freeze({
    servingRequirement: "Vollständig durchbacken und weich halten; Champignons sehr fein und weich vorbereiten. Die Cup-Form bleibt die kanonische Form; keine harte oder trockene Kruste.",
  }),
  "Weiche Joghurt-Fladen": Object.freeze({
    servingRequirement: "Vollständig, aber weich durchbacken; die Mitte darf nicht roh, klebrig oder teigig bleiben und es darf keine harte Kruste entstehen. Erst anbieten, wenn aus dem weichen formstabilen Fladen gezielt ein passender Bissen abgetrennt und dieser anschließend sicher strukturiert gekaut werden kann.",
    noteOverride: "Kleine flache Portionen vollständig, aber weich durchbacken. Die Mitte muss vollständig durchgegart und darf nicht klebrig oder teigig sein; keine harte oder dunkle Kruste.",
  }),
  "Huhn-Gemüse-Muffins": Object.freeze({
    servingRequirement: "Vollständig durchbacken, innen saftig halten und harte Kruste vermeiden. Erst anbieten, wenn aus dem weichen formstabilen Muffin gezielt ein passender Bissen abgetrennt werden kann; die Hühnerfasern bleiben Teil des abgetrennten Bissens und verlangen anschließend sicheres strukturiertes Kauen.",
    noteOverride: "Kleine Muffins vollständig durchbacken und innen saftig halten; keine harte Kruste. Vor dem Servieren prüfen, dass die Krume vollständig durchgegart und nicht klebrig-teigig ist.",
  }),
  "Fleisch-Gemüse-Bällchen": Object.freeze({
    servingRequirement: "Flach oder länglich statt rund formen, vollständig durchgaren und saftig halten. Der Bissen muss weich auseinanderfallen und darf innen nicht kompakt oder federnd bleiben.",
    noteOverride: "Kleine flache oder längliche Stücke statt fester runder Kugeln formen. Vollständig durchgaren, saftig halten und harte Kruste vermeiden. Der abgetrennte Bissen muss weich auseinanderfallen und darf innen nicht kompakt oder federnd bleiben.",
  }),
  "Huhn-Zucchini-Nockerl": Object.freeze({
    servingRequirement: "Als kleine einzelne, längliche und sehr weiche Nockerl anbieten. Ein aufgeschnittenes Nockerl darf nicht gummiartig oder kompakt-elastisch sein; kleine weiche Stücke erst bei bestätigter passender Handhabung.",
  }),
  "Rind-Karotten-Nockerl": Object.freeze({
    servingRequirement: "Als kleine einzelne, längliche und sehr weiche Nockerl anbieten. Ein aufgeschnittenes Nockerl darf nicht gummiartig oder kompakt-elastisch sein; kleine weiche Stücke erst bei bestätigter passender Handhabung.",
  }),
  "Linsen-Süßkartoffel-Nockerl": Object.freeze({
    servingRequirement: "Als kleine einzelne, längliche und sehr weiche Nockerl anbieten. Ein aufgeschnittenes Nockerl darf nicht klebrig-gummiartig oder kompakt-elastisch sein; kleine weiche Stücke erst bei bestätigter passender Handhabung.",
  }),
});

function freezeRecipeContract(modes, biteSeparation, oralProcessing, extra = {}) {
  return Object.freeze({
    modes: Object.freeze([...modes]),
    ...(biteSeparation ? { biteSeparation } : {}),
    oralProcessing,
    ...extra,
  });
}

const recipeContractEntries = [];
function addRecipeContractGroup(names, modes, biteSeparation, oralProcessing, extra = {}) {
  for (const name of names) {
    const override = RECIPE_CONTRACT_OVERRIDES[name] || {};
    recipeContractEntries.push([
      name,
      freezeRecipeContract(modes, biteSeparation, oralProcessing, { ...extra, ...override }),
    ]);
  }
}

addRecipeContractGroup(
  RECIPE_CONTRACT_GROUPS.fingerLowResistance,
  [HANDLING_MODES.FINGER_GRASPABLE],
  BITE_SEPARATION_PROFILES.LOW_RESISTANCE_SEPARATE,
  ORAL_PROCESSING_PROFILES.EASY_CHEW,
);
addRecipeContractGroup(
  RECIPE_CONTRACT_GROUPS.fingerEasy,
  [HANDLING_MODES.FINGER_GRASPABLE],
  BITE_SEPARATION_PROFILES.EASY_BITE_SEPARATE,
  ORAL_PROCESSING_PROFILES.EASY_CHEW,
);
addRecipeContractGroup(
  RECIPE_CONTRACT_GROUPS.structuredChew,
  [HANDLING_MODES.FINGER_GRASPABLE],
  BITE_SEPARATION_PROFILES.GRADED_BITE_REQUIRED,
  ORAL_PROCESSING_PROFILES.STRUCTURED_CHEW_REQUIRED,
  {
    biteRequiredCapability: HANDLING_CAPABILITIES.GRADED_BITE,
    oralRequiredCapability: HANDLING_CAPABILITIES.STRUCTURED_CHEW,
    laterKind: "bite-and-oral-capability",
  },
);
addRecipeContractGroup(
  RECIPE_CONTRACT_GROUPS.spoonSmoothMash,
  [HANDLING_MODES.SPOON_SMOOTH, HANDLING_MODES.SPOON_MASHED],
  "",
  ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
);
addRecipeContractGroup(
  RECIPE_CONTRACT_GROUPS.spoonSoftLumpyLater,
  [HANDLING_MODES.SPOON_SOFT_LUMPY],
  "",
  ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
  { laterKind: "soft-orientation" },
);
addRecipeContractGroup(
  RECIPE_CONTRACT_GROUPS.spoonMash,
  [HANDLING_MODES.SPOON_MASHED],
  "",
  ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
);
addRecipeContractGroup(
  RECIPE_CONTRACT_GROUPS.spoonMashLumpy,
  [HANDLING_MODES.SPOON_MASHED, HANDLING_MODES.SPOON_SOFT_LUMPY],
  "",
  ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
);
addRecipeContractGroup(
  RECIPE_CONTRACT_GROUPS.fingerEasyLater,
  [HANDLING_MODES.FINGER_GRASPABLE],
  BITE_SEPARATION_PROFILES.EASY_BITE_SEPARATE,
  ORAL_PROCESSING_PROFILES.EASY_CHEW,
  { laterKind: "soft-orientation" },
);
addRecipeContractGroup(
  RECIPE_CONTRACT_GROUPS.fingerSmallSoft,
  [HANDLING_MODES.FINGER_SMALL_SOFT],
  "",
  ORAL_PROCESSING_PROFILES.SOFT_BREAKDOWN,
  {
    requiredCapabilities: Object.freeze({
      [HANDLING_MODES.FINGER_SMALL_SOFT]: HANDLING_CAPABILITIES.SMALL_SOFT_PIECES,
    }),
    laterKind: "handling-capability",
  },
);

const RECIPE_HANDLING_CONTRACT = Object.freeze(
  Object.fromEntries(recipeContractEntries),
);

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    HANDLING_MODES,
    BITE_SEPARATION_PROFILES,
    ORAL_PROCESSING_PROFILES,
    HANDLING_CAPABILITIES,
    FOOD_HANDLING_CONTRACT,
    RECIPE_CONTRACT_GROUPS,
    RECIPE_HANDLING_CONTRACT,
  };
}
