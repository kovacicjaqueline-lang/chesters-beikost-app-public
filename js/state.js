"use strict";

/* Zustand und Konfiguration
 * Konstanten, Schema-Version 5, Defaultzustand und flüchtige UI-Zustände.
 * Konsolidierter Produktionsstand 10.0.0.
 */

const KEY = "chester-beikost-pwa-v6";
const APP_VERSION = "10.1.26";
const SCHEMA_VERSION = 5;
const DB_NAME = "chester-beikost-db";
const DB_VERSION = 1;
const DB_STORE = "app";
const STATE_RECORD = "state";
const SNAPSHOT_RECORD = "snapshots";
const LEGACY_KEYS = [
  "chester-beikost-pwa-v5",
  "chester-beikost-pwa-v4",
  "chester-beikost-pwa-v3",
  "chester-beikost-pwa-v2",
  "chester-beikost-html-v1",
];
const ID_ALIASES = {
  carrot: "karotte",
  broccoli: "brokkoli",
  zucchini: "zucchini",
  millet: "hirse",
  rapeseed: "rapsoel",
  banana: "banane",
  oats: "hafer",
  apple: "apfel",
  potato: "kartoffel",
  sweetpotato: "suesskartoffel",
  beef: "rind",
  chicken: "huhn",
  lentils: "rote-linsen",
  egg: "ei",
  peanut: "erdnuss",
  wheat: "weizen",
  yogurt: "naturjoghurt",
  milk: "kuhmilch",
  buttermilk: "buttermilch",
};
const AMOUNT_LEVELS = {
  taste: { label: "Kost- und Miniportion (<20 g)", rank: 0, targetGrams: 25 },
  small: { label: "Kleine Portion (20–49 g)", rank: 1, targetGrams: 45 },
  building: { label: "Mahlzeit im Aufbau (50–99 g)", rank: 2, targetGrams: 70 },
  established: { label: "Mahlzeit etabliert (ab 100 g)", rank: 3, targetGrams: 100 },
};
const PHASES = {
  kennenlernen: { label: "Kennenlernen", rank: 0, meals: ["lunch"] },
  aufbau: { label: "Mahlzeitenaufbau", rank: 1, meals: ["breakfast", "lunch"] },
  drei: { label: "Drei Hauptmahlzeiten", rank: 2, meals: ["breakfast", "lunch", "dinner"] },
  familie: { label: "Familienkost", rank: 3, meals: ["breakfast", "lunch", "snack", "dinner"] },
};
const STATUS_ORDER = {
  Offen: 0,
  Probiert: 1,
  Bekannt: 2,
  Pausiert: -1,
};
const LEGACY_MILK_ID = "kuhmilch-joghurt";

const FOOD_ALIAS_AUDIT_10_1_25 = Object.freeze({
  lauch: Object.freeze(["Porree"]),
  rosenkohl: Object.freeze(["Kohlsprossen"]),
  petersilienwurzel: Object.freeze(["Petersilwurzel"]),
});

function applyFoodAliasAudit(foodDb) {
  if (!Array.isArray(foodDb)) return foodDb;
  const byId = new Map(foodDb.map((item) => [item?.id, item]).filter(([id]) => id));

  for (const [id, aliases] of Object.entries(FOOD_ALIAS_AUDIT_10_1_25)) {
    const item = byId.get(id);
    if (!item) continue;

    const seen = new Set();
    const merged = [];
    String(item.alias || "")
      .split("|")
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .concat(aliases)
      .forEach((value) => {
        const key = value.toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push(value);
      });

    item.alias = merged.join("|");
  }

  return foodDb;
}

applyFoodAliasAudit(FOOD_DB);

/*
 * Fachlich geprüfte Safe-Form-Korrekturen.
 * Diese Schicht korrigiert nur Zubereitungs-/Darreichungsdetails und Prep-Hinweise;
 * IDs, Prioritäten, Mahlzeiteneignung, Allergene und Planungsstatus bleiben unverändert.
 *
 * Die Korrekturen werden vor dem Defaultzustand und nach dem späteren FOOD-Policy-Lauf
 * nochmals angewendet. So bleiben sie auch für zur Laufzeit ergänzte Datensätze sowie
 * für den bestehenden Gurke-/Tomate-Policy-Patch wirksam, ohne data/foods.js des
 * parallelen FOOD-Aufnahmeblocks zu verändern.
 */
const FOOD_SAFETY_AUDIT_GROUPS = Object.freeze({
  leafVegetables: Object.freeze([
    "spinat",
    "lauch",
    "wirsing",
    "weisskraut",
    "rotkraut",
    "pak-choi",
    "malunggay-moringablaetter",
    "kangkong-wasserspinat",
    "kamote-blaetter",
    "saluyot-juteblaetter",
    "mangold",
    "chinakohl",
    "rucola",
    "radicchio",
    "endivie",
    "blattsalat",
  ]),
  wholeGrains: Object.freeze([
    "weizen",
    "reis",
    "quinoa",
    "roggen",
    "gerste",
    "buchweizen",
    "amaranth",
    "dinkel",
    "bulgur",
  ]),
  standardFish: Object.freeze([
    "lachs",
    "kabeljau",
    "forelle",
    "seelachs",
    "tilapia",
    "sardine",
    "saibling",
    "hering",
    "karpfen",
    "atlantische-makrele",
  ]),
  restrictedFish: Object.freeze([
    "thunfisch",
    "schwertfisch",
    "heilbutt",
    "hecht",
    "koenigsmakrele",
    "buttermakrele",
    "schlangenmakrele",
  ]),
});

const FOOD_SAFE_FORM_AUDIT_OVERRIDES = Object.freeze({
  banane: Object.freeze({
    safeForm: "Schälen; sehr reif und weich zerdrücken oder als weiches, gut greifbares Stück anbieten.",
  }),
  apfel: Object.freeze({
    safeForm: "Für sehr junge Kinder schälen und reiben, zerdrücken oder weich dünsten; Kerne und Kerngehäuse entfernen; keine harten rohen Stücke.",
  }),
  birne: Object.freeze({
    safeForm: "Sehr reif und weich anbieten; Kerne und Kerngehäuse entfernen. Feste Birne für sehr junge Kinder schälen und weich garen.",
  }),
  avocado: Object.freeze({
    safeForm: "Schale und Kern vollständig entfernen; sehr reif zerdrücken oder als weiche, gut greifbare Spalte anbieten.",
  }),
  mango: Object.freeze({
    safeForm: "Schale und Kern vollständig entfernen; sehr reif und weich zerdrücken oder in weiche, gut greifbare Stücke schneiden.",
  }),
  papaya: Object.freeze({
    safeForm: "Reife Papaya: Schale und Kerne entfernen und weich zerdrücken oder in weiche Stücke schneiden; grüne Papaya nur vollständig gegart.",
  }),
  pflaume: Object.freeze({
    safeForm: "Sehr reif und weich anbieten; Stein vollständig entfernen. Für sehr junge Kinder harte Haut möglichst entfernen; zerdrücken oder in weiche Stücke schneiden.",
  }),
  pfirsich: Object.freeze({
    safeForm: "Sehr reif und weich anbieten; Stein vollständig entfernen. Für sehr junge Kinder harte Haut möglichst entfernen; zerdrücken oder in weiche Stücke schneiden.",
  }),
  aprikose: Object.freeze({
    safeForm: "Sehr reif und weich anbieten; Stein vollständig entfernen. Für sehr junge Kinder harte Haut möglichst entfernen; zerdrücken oder in weiche Stücke schneiden.",
  }),
  nektarine: Object.freeze({
    safeForm: "Sehr reif und weich anbieten; Stein vollständig entfernen. Für sehr junge Kinder harte Haut möglichst entfernen; zerdrücken oder in weiche Stücke schneiden.",
  }),
  gurke: Object.freeze({
    safeForm: "Gewaschen frisch anbieten; für sehr junge Kinder Haut möglichst entfernen. In längliche, gut greifbare Stücke schneiden; bei noch fester Gurke alternativ reiben oder zerdrücken; nicht pauschal garen.",
    prep: "frisch bei der Mahlzeit",
  }),
  tomate: Object.freeze({
    safeForm: "Sehr reif und weich anbieten; für sehr junge Kinder Haut möglichst entfernen. Große Tomate als breite Viertel oder Spalten anbieten; kleine runde Tomaten immer längs vierteln, nie ganz.",
    prep: "frisch bei der Mahlzeit",
  }),
  heidelbeere: Object.freeze({
    safeForm: "Zerdrücken oder in kleine Stücke teilen; nicht als ganze runde Beere anbieten.",
  }),
  erdbeere: Object.freeze({
    safeForm: "Grün entfernen; kleine runde Erdbeeren längs vierteln, größere sehr reif und weich passend zerteilen; nicht ganz anbieten.",
  }),
  himbeere: Object.freeze({
    safeForm: "Sehr reif und weich zerdrücken oder in kleine weiche Teile teilen; nicht als feste ganze Beere anbieten.",
  }),
  brombeere: Object.freeze({
    safeForm: "Sehr reif anbieten und zerdrücken oder in kleine weiche Teile teilen; nicht als feste ganze Beere anbieten.",
  }),
  ribisel: Object.freeze({
    safeForm: "Sehr reif anbieten und zerdrücken oder passieren, sodass keine feste runde Beere bleibt.",
  }),
  melone: Object.freeze({
    safeForm: "Schale und Kerne entfernen; in breite dünne Scheiben oder weiche Streifen schneiden beziehungsweise zerdrücken; keine runden Melonenkugeln.",
  }),
  wassermelone: Object.freeze({
    safeForm: "Schale und Kerne entfernen; in breite dünne Scheiben oder weiche Streifen schneiden beziehungsweise zerdrücken; keine runden Melonenkugeln.",
  }),
  orange: Object.freeze({
    safeForm: "Schale und Kerne entfernen; harte Häutchen bei Bedarf entfernen und das weiche Fruchtfleisch zerdrückt oder in kleinen weichen Stücken anbieten.",
  }),
  mandarine: Object.freeze({
    safeForm: "Schale und Kerne entfernen; harte Häutchen bei Bedarf entfernen und das weiche Fruchtfleisch zerdrückt oder in kleinen weichen Stücken anbieten.",
  }),
  pomelo: Object.freeze({
    safeForm: "Schale und Kerne entfernen; dicke oder zähe Häutchen entfernen und das weiche Fruchtfleisch fein zerteilt oder zerdrückt anbieten.",
  }),
  kiwi: Object.freeze({
    safeForm: "Schale entfernen; sehr reif und weich zerdrücken oder in weiche altersgerechte Stücke schneiden.",
  }),
  kaki: Object.freeze({
    safeForm: "Sehr reif und weich anbieten; harte Haut und vorhandene Kerne entfernen; zerdrücken oder in weiche Stücke schneiden.",
  }),
  ananas: Object.freeze({
    safeForm: "Schale und harten Strunk entfernen; sehr reif fein zerkleinern oder in weiche Streifen schneiden; keine harten faserigen Stücke.",
  }),
  granatapfel: Object.freeze({
    safeForm: "Kerne nicht ganz anbieten; Fruchtfleisch und Kerne fein zerdrücken oder nur als kleine Zutat verwenden; nicht als Getränk anbieten.",
  }),
  drachenfrucht: Object.freeze({
    safeForm: "Schale vollständig entfernen; weiches Fruchtfleisch zerdrücken oder in weiche altersgerechte Stücke schneiden.",
  }),
  guave: Object.freeze({
    safeForm: "Sehr reif und weich anbieten; Schale bei sehr jungen Kindern möglichst entfernen und harte Kerne entfernen oder das Fruchtfleisch passieren; weich zerdrücken.",
  }),
  feige: Object.freeze({
    safeForm: "Sehr reif und weich anbieten; harte Stielteile entfernen und das weiche Fruchtfleisch zerdrücken oder fein zerteilen.",
  }),
  "saba-banane": Object.freeze({
    safeForm: "Schälen und sehr reif oder gegart weich anbieten; zerdrücken oder in weiche, gut greifbare Stücke schneiden.",
  }),
  calamansi: Object.freeze({
    safeForm: "Kerne entfernen; nur kleine Mengen zum Aromatisieren verwenden, nicht als Getränk; die Säure kann die Haut rund um den Mund reizen.",
  }),
  zitrone: Object.freeze({
    safeForm: "Kerne entfernen; nur kleine Mengen zum Aromatisieren verwenden, nicht als eigenes großes Angebot oder Getränk; die Säure kann die Haut rund um den Mund reizen.",
    prep: "frisch als kleine Aromazutat",
  }),
  "jackfruit-langka": Object.freeze({
    safeForm: "Schale und Samen vollständig entfernen; reifes weiches, faseriges Fruchtfleisch sehr fein zerkleinern oder zerdrücken.",
  }),
  "chico-sapodilla": Object.freeze({
    safeForm: "Schale und harte Kerne vollständig entfernen; nur sehr reifes weiches Fruchtfleisch zerdrückt oder fein zerteilt anbieten.",
  }),
  "guyabano-soursop": Object.freeze({
    safeForm: "Schale und alle Samen vollständig entfernen; nur sehr reifes weiches Fruchtfleisch zerdrückt oder fein zerteilt anbieten.",
  }),
  dattel: Object.freeze({
    safeForm: "Stein vollständig entfernen; weich einweichen und fein zerkleinern oder zerdrücken; keine trockenen, zähen Stücke anbieten.",
  }),
  kirsche: Object.freeze({
    safeForm: "Stiel und Stein vollständig entfernen; längs vierteln oder fein zerkleinern; nie als ganze runde Kirsche anbieten.",
  }),
  rosine: Object.freeze({
    safeForm: "Unter 12 Monaten nie ganz anbieten; weich einweichen und fein zerkleinern oder zerdrücken.",
  }),
  traube: Object.freeze({
    safeForm: "Kerne entfernen und jede Traube längs vierteln beziehungsweise sehr klein schneiden; nie ganz oder nur halbiert anbieten.",
  }),
  rosenkohl: Object.freeze({
    safeForm: "Sehr weich garen; längs halbieren oder vierteln beziehungsweise zerdrücken oder pürieren; nicht als ganze runde Kugel anbieten.",
  }),
  champignon: Object.freeze({
    safeForm: "Vollständig weich garen und fein hacken, zerdrücken oder in weiche dünne Scheiben schneiden; nicht roh oder als ganze runde Pilze anbieten.",
  }),
  maroni: Object.freeze({
    safeForm: "Vollständig garen und schälen; fein zerdrücken, zerbröseln oder pürieren; nicht als ganze runde Maroni anbieten.",
  }),
  "mais-polenta": Object.freeze({
    safeForm: "Mais sehr weich garen und zerdrücken oder pürieren beziehungsweise als weiche Polenta anbieten; keine ganzen Maiskörner.",
  }),
  mais: Object.freeze({
    safeForm: "Mais sehr weich garen und zerdrücken oder pürieren; keine ganzen Maiskörner anbieten.",
  }),
  "nudeln-pasta": Object.freeze({
    safeForm: "Sehr weich kochen und altersgerecht zerteilen; keine zähen, harten oder großen klebrigen Nudelstücke anbieten.",
  }),
  brot: Object.freeze({
    safeForm: "In schmale Streifen schneiden; weiches Weißbrot möglichst leicht toasten oder eher dunkleres Brot verwenden, damit es keinen teigigen Klumpen bildet. Keine ganzen Nüsse, Samen oder Körner im Brot.",
    prep: "frisch bei der Mahlzeit",
  }),
  garnele: Object.freeze({
    safeForm: "Vollständig durchgaren; Schale und Schwanz vollständig entfernen und das Fleisch fein zerkleinern oder zerdrücken; keine ganze Garnele anbieten.",
  }),
  miesmuschel: Object.freeze({
    safeForm: "Nur vollständig durchgegart anbieten; Schale vollständig entfernen und das Muschelfleisch fein zerkleinern oder zerdrücken.",
  }),
  "bangus-milkfish": Object.freeze({
    safeForm: "Vollständig durchgaren; Haut und wegen der vielen feinen Gräten wirklich alle Gräten sorgfältig entfernen; anschließend fein zerdrücken oder zerzupfen.",
  }),
  "galunggong-round-scad": Object.freeze({
    safeForm: "Vollständig durchgaren; Haut und alle Gräten sorgfältig entfernen und weich zerdrücken oder zerzupfen; keine gesalzene oder getrocknete Variante.",
  }),
  honig: Object.freeze({
    safeForm: "Im ersten Lebensjahr nicht geben. Erst ab 12 Monaten als kleine Zutat verwenden.",
    prep: "erst ab 12 Monaten",
  }),
  kaese: Object.freeze({
    safeForm: "Nur pasteurisierten vollfetten Käse verwenden; fein reiben oder in kurze schmale Streifen schneiden, keine großen Käsewürfel. Schimmelgereifte weiche oder Blauschimmelkäse nicht ungegart anbieten.",
  }),
  frischkaese: Object.freeze({
    safeForm: "Pasteurisiert und vollfett; dünn auf geeignetes weiches Fingerfood streichen oder als kleine Zutat in eine Mahlzeit einarbeiten.",
  }),
  mozzarella: Object.freeze({
    safeForm: "Pasteurisiert und weich; fein zupfen oder in kurze schmale Streifen schneiden. Kleine Mozzarellakugeln nie ganz anbieten.",
  }),
  huettenkaese: Object.freeze({
    safeForm: "Pasteurisiert, vollfett und möglichst salzarm; weich zerdrückt oder als kleine Zutat in einer Mahlzeit anbieten.",
    prep: "frisch bei der Mahlzeit",
  }),
  rapsoel: Object.freeze({
    safeForm: "In die fertig zubereitete warme Speise passend zur Portionsgröße einrühren; nicht als eigenes Lebensmittel anbieten.",
  }),
  olivenoel: Object.freeze({
    safeForm: "In die fertig zubereitete Speise passend zur Portionsgröße einrühren; nicht als eigenes Lebensmittel anbieten.",
  }),
  kokosoel: Object.freeze({
    safeForm: "In die fertig zubereitete Speise passend zur Portionsgröße einrühren; nicht als eigenes Lebensmittel anbieten.",
  }),
  walnussoel: Object.freeze({
    safeForm: "In die fertig zubereitete Speise passend zur Portionsgröße einrühren; nicht als eigenes Lebensmittel anbieten.",
  }),
  sojaoel: Object.freeze({
    safeForm: "In die fertig zubereitete Speise passend zur Portionsgröße einrühren; nicht als eigenes Lebensmittel anbieten.",
  }),
  weizenkeimoel: Object.freeze({
    safeForm: "In die fertig zubereitete Speise passend zur Portionsgröße einrühren; nicht als eigenes Lebensmittel anbieten.",
  }),
});

function applyFoodSafetyAudit(foodDb) {
  if (!Array.isArray(foodDb)) return foodDb;
  let byId = new Map(foodDb.map((item) => [item?.id, item]).filter(([id]) => id));
  let patchIds = (ids, patch) => {
    for (let id of ids) {
      let item = byId.get(id);
      if (!item) continue;
      if (patch.safeForm) item.safeForm = patch.safeForm;
      if (patch.prep) item.prep = patch.prep;
    }
  };

  patchIds(FOOD_SAFETY_AUDIT_GROUPS.leafVegetables, {
    safeForm: "Sehr weich garen und fein zerkleinert, zerdrückt oder püriert in einer weichen Speise anbieten; keine faserigen ganzen Blätter.",
  });
  patchIds(FOOD_SAFETY_AUDIT_GROUPS.wholeGrains, {
    safeForm: "Sehr weich kochen und für junge Beikostkinder zerdrücken, fein mahlen oder als weichen Brei anbieten; keine festen ganzen Körner.",
  });
  patchIds(FOOD_SAFETY_AUDIT_GROUPS.standardFish, {
    safeForm: "Vollständig durchgaren; Haut und alle Gräten sorgfältig entfernen und weich zerzupft oder zerdrückt anbieten.",
  });
  patchIds(FOOD_SAFETY_AUDIT_GROUPS.restrictedFish, {
    safeForm: "Nicht als Beikost empfohlen; nicht automatisch oder als Standardangebot einplanen.",
    prep: "nicht als Beikost planen",
  });

  for (let [id, patch] of Object.entries(FOOD_SAFE_FORM_AUDIT_OVERRIDES)) {
    let item = byId.get(id);
    if (!item) continue;
    if (patch.safeForm) item.safeForm = patch.safeForm;
    if (patch.prep) item.prep = patch.prep;
  }
  return foodDb;
}

applyFoodSafetyAudit(FOOD_DB);

function reapplyFoodSafetyAuditAfterRuntime() {
  applyFoodSafetyAudit(FOOD_DB);
  if (Array.isArray(state?.foods)) applyFoodSafetyAudit(state.foods);
  if (state && typeof renderAll === "function") renderAll();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", reapplyFoodSafetyAuditAfterRuntime, { once: true });
}

const DEFAULT = {
  settings: {
    birthDate: "2026-01-24",
    startDate: "2026-07-14",
    planFrom: "",
    mealActivation: "progress",
    breakfastDay: 11,
    dinnerDay: 55,
    allergenDays: 7,
    textureStage: 1,
    textureStageSince: "2026-07-14",
    phaseMode: "manual-v2",
    phaseModelVersion: 2,
    phaseSelected: "kennenlernen",
    amountSelected: "taste",
    travelDate: "2027-01-29",
    travelPrep: true,
    phMode: "prepare",
    seasonal: true,
    freezerDays: 30,
    targetFoods: 100,
    newFoodEvery: 2,
    preferInventoryInPlan: true,
  },
  foods: FOOD_DB,
  logs: [],
  inventory: [],
  overrides: {},
  deferred: {},
  pantry: {},
  planLocks: {},
  autoLockExcluded: {},
  manualMeals: {},
  inactivePlanKept: {},
  combinationPauses: {},
  followUps: {},
  shoppingHints: {},
  backupMeta: { lastExternalBackup: "", storagePersisted: "unknown", migratedAt: "", chesterContextSeeded: false, legacyMilkMigration: null },
};
let state = null;
let foodFilter = "open";
let recipeFilter = "available";
let recipeQuery = "";
let logVisibleCount = 8;
let logMonthFilter = "all";
let foodReorderMode = false;
let foodDrag = null;
let toastTimer = null;
let lastUndo = null;
let pendingLog = null;
let selectedLogFoods = new Set();
let selectedInventoryFoods = new Set();
let selectedRecipeInventoryId = "";
let logFoodQuery = "";
let genericCloseHandler = null;
