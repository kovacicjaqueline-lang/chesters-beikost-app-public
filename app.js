"use strict";

/* Anwendungsstart
 * Initialisiert den Zustand, stellt die Testbrücke bereit, bindet die Oberfläche und registriert den Service Worker.
 * Teststand 10.1.24: allgemeine Auto-Plan-Eignung und Lebensmittel-/Allergenstämme ergänzt;
 * Phasenmodell-v2 sowie UI-01 bis UI-05 bleiben unverändert.
 */

const FOOD_PHASE_ORDER = Object.freeze(["kennenlernen", "aufbau", "drei", "familie"]);
const FOOD_POLICY_FISH_SAFE_FORM = "Vollständig garen; Haut und alle Gräten sorgfältig entfernen.";
const FOOD_POLICY_MAIN_MEALS = Object.freeze(["breakfast", "lunch", "dinner"]);
const FOOD_POLICY_FISH_MEALS = Object.freeze(["lunch", "dinner"]);

const FOOD_POLICY_DATA = Object.freeze({
  autoFish: Object.freeze([
    ["forelle", "Forelle"],
    ["saibling", "Saibling"],
    ["hering", "Hering"],
    ["karpfen", "Karpfen"],
    ["atlantische-makrele", "Atlantische Makrele"],
  ]),
  manualOnlyFish: Object.freeze([
    ["thunfisch", "Thunfisch"],
    ["schwertfisch", "Schwertfisch"],
    ["heilbutt", "Heilbutt"],
    ["hecht", "Hecht"],
    ["koenigsmakrele", "Königsmakrele"],
    ["buttermakrele", "Buttermakrele"],
    ["schlangenmakrele", "Schlangenmakrele"],
  ]),
  milkAllergenFoods: Object.freeze([
    "kuhmilch",
    "naturjoghurt",
    "buttermilch",
    "kaese",
    "frischkaese",
    "huettenkaese",
    "quark",
    "skyr",
  ]),
  nutVariantPairs: Object.freeze([
    ["erdnuss", "erdnussmus"],
    ["mandel", "mandelmus"],
    ["haselnuss", "haselnussmus"],
    ["cashew", "cashewmus"],
    ["walnuss", "walnussmus"],
    ["pistazie", "pistazienmus"],
  ]),
  safeFormOverrides: Object.freeze({
    gurke: Object.freeze({
      safeForm: "Gewaschen, geschält und in große längs halbierte Stücke schneiden, die gut greifbar sind; nicht pauschal garen.",
      prep: "frisch bei der Mahlzeit",
    }),
    tomate: Object.freeze({
      safeForm: "Sehr reif und weich: Fruchtfleisch zerdrücken oder eine große Tomate für Fingerfood in breite Viertel oder Spalten schneiden; kleine runde Tomaten nicht ganz anbieten.",
      prep: "frisch bei der Mahlzeit",
    }),
  }),
  componentOnlyFoods: Object.freeze([
    "haferdrink",
    "tahin",
  ]),
});

function foodPolicyMonthsOld(on, birthDate) {
  let [ay, am, ad] = String(birthDate || "").split("-").map(Number);
  let [by, bm, bd] = String(on || "").split("-").map(Number);
  if (![ay, am, ad, by, bm, bd].every(Number.isFinite)) return 0;
  let months = (by - ay) * 12 + (bm - am);
  if (bd < ad) months--;
  return Math.max(0, months);
}

function automaticFoodEligibility(foodRecord, on, settings = {}) {
  if (!foodRecord) return false;
  if (foodRecord.autoPlan === false) return false;

  if (foodRecord.minPhase) {
    let current = FOOD_PHASE_ORDER.indexOf(settings.phaseSelected || "kennenlernen");
    let required = FOOD_PHASE_ORDER.indexOf(foodRecord.minPhase);
    if (required < 0 || current < required) return false;
  }

  if (foodRecord.minAgeMonths !== undefined && foodRecord.minAgeMonths !== null && foodRecord.minAgeMonths !== "") {
    let minimum = Number(foodRecord.minAgeMonths);
    if (Number.isFinite(minimum) && foodPolicyMonthsOld(on, settings.birthDate) < minimum) return false;
  }

  return true;
}

function automaticEligibilityStatus(foodRecord, phaseLabels = {}) {
  if (!foodRecord) return "";
  if (foodRecord.autoPlan === false) return "Nicht für Beikost empfohlen";
  let age = Number(foodRecord.minAgeMonths);
  let hasAge = foodRecord.minAgeMonths !== undefined && foodRecord.minAgeMonths !== null && foodRecord.minAgeMonths !== "" && Number.isFinite(age);
  let phase = foodRecord.minPhase ? phaseLabels[foodRecord.minPhase] || foodRecord.minPhase : "";
  if (hasAge && phase) return `Ab ${age} Monaten · ${phase}`;
  if (hasAge) return `Ab ${age} Monaten`;
  if (phase) return `Ab ${phase}`;
  return "";
}

function plannerRole(foodRecord) {
  return String(foodRecord?.plannerRole || "");
}

function plannerFoodCanBeBase(foodRecord) {
  return plannerRole(foodRecord) !== "component";
}

function plannerFoodCanBeAutomaticFocus(foodRecord) {
  return plannerRole(foodRecord) !== "component";
}

function plannerManualRole(foodRecord, role) {
  return role === "base" && !plannerFoodCanBeBase(foodRecord) ? "component" : role;
}

function plannerFoodOverrideMode(foodRecord, concreteRank = 0) {
  if (plannerFoodCanBeAutomaticFocus(foodRecord)) return "focus";
  return "sample";
}

function plannerExplicitOverrideForFood(overrides, on, foodId, mealEligible = () => true) {
  if (!on || !foodId) return false;
  return Object.entries(overrides || {}).some(([key, id]) => {
    let [date, meal] = String(key || "").split("|");
    return date === on && id === foodId && mealEligible(meal);
  });
}

function plannerPlanningRank(foodRecord, concreteRank, familyRank, hasExplicitOverride = false) {
  if (hasExplicitOverride && !plannerFoodCanBeAutomaticFocus(foodRecord))
    return Math.min(Number(concreteRank) || 0, 1);
  return Number(familyRank) || 0;
}

function plannerFoodIsTrustedBase(foodRecord, trusted) {
  return !!trusted && plannerFoodCanBeBase(foodRecord);
}

function plannerAutomaticLockRoleViolation(lock, foods = []) {
  if (!lock || lock.mode !== "auto" || lock.recipeName) return false;
  let byId = new Map((foods || []).map((item) => [item.id, item]));
  let invalidBase = (lock.baseFoodIds || []).some((id) => {
    let f = byId.get(id);
    return !!f && !plannerFoodCanBeBase(f);
  });
  if (invalidBase) return true;

  let focus = byId.get(lock.focusId);
  if (!focus || plannerFoodCanBeAutomaticFocus(focus)) return false;
  let sampleTypes = new Set([
    "neu",
    "gezielt wiederholen",
    "Allergen einführen",
    "Allergen wiederholen",
    "manuell",
  ]);
  let isSampleFocus =
    (lock.sampleFoodIds || []).includes(lock.focusId) &&
    sampleTypes.has(lock.type);
  return !isSampleFocus;
}

function plannerRecipeSuitableForMeal(recipe, meal) {
  let excludedMeals = Array.isArray(recipe?.excludeMeals) ? recipe.excludeMeals : [];
  if (excludedMeals.includes(meal)) return false;
  let category = String(recipe?.category || "");
  let hasSnackTag = (recipe?.tags || []).some(
    (tag) => String(tag || "").trim().toLowerCase() === "snack",
  );
  if (meal === "snack") return hasSnackTag;
  if (meal === "breakfast") return ["porridge", "pancakes", "baking"].includes(category);
  if (meal === "dinner")
    return !["philippines"].includes(category) || Number(recipe?.stage || 1) <= 3;
  return true;
}

function plannerRecipeByStoredName(name, recipes = []) {
  let stored = String(name || "");
  if (!stored) return null;
  return (recipes || []).find((recipe) =>
    recipe?.name === stored ||
    (recipe?.legacyNames || []).includes(stored) ||
    (recipe?.searchAliases || []).includes(stored)
  ) || null;
}

function plannerAutomaticRecipeLockMealViolation(key, lock, recipes = []) {
  if (!lock || lock.mode !== "auto" || !lock.recipeName) return false;
  let meal = String(key || "").split("|")[1] || lock.meal || "";
  if (!meal) return false;
  let recipe = plannerRecipeByStoredName(lock.recipeName, recipes);
  if (!recipe) return false;
  return !plannerRecipeSuitableForMeal(recipe, meal);
}

function plannerManualComponentBaseViolation(validation, foods = [], recipeName = "") {
  if (!validation || !validation.ok || recipeName) return validation;
  let byId = new Map((foods || []).map((item) => [item.id, item]));
  let sampleIds = new Set(validation.samples || []);
  let componentOnlyIds = (validation.ids || []).filter(
    (id) => plannerRole(byId.get(id)) === "component" && !sampleIds.has(id),
  );
  if (!componentOnlyIds.length) return validation;
  let hasValidBase = (validation.bases || []).some((id) => {
    let base = byId.get(id);
    return !!base && plannerFoodCanBeBase(base);
  });
  if (hasValidBase) return validation;

  let names = componentOnlyIds.map((id) => byId.get(id)?.name || id);
  let extraMessage = `Komponentenformen brauchen außerhalb eines Rezepts eine geeignete Hauptbasis: ${names.join(", ")}.`;
  let messages = [...(validation.messages || [])];
  if (!messages.includes(extraMessage)) messages.push(extraMessage);
  return {
    ...validation,
    ok: false,
    plannerComponentWithoutBaseIds: componentOnlyIds,
    messages,
    message: messages.join(" "),
  };
}

function foodPolicyBaseRecord(id, name, category, meals, priority) {
  return {
    id,
    name,
    category,
    priority,
    active: true,
    allergenGroup: category === "Fisch" ? "Fisch" : "",
    ironRich: false,
    ph: false,
    alias: "",
    meals: [...meals],
    safeForm: category === "Fisch" ? FOOD_POLICY_FISH_SAFE_FORM : "Alters- und phasengerecht anbieten.",
    prep: "frisch",
    seasonMonths: [],
    count100: true,
    manualStatus: "auto",
    notes: "",
  };
}

function applyFoodPolicyData(foodDb, idAliases = {}) {
  if (!Array.isArray(foodDb)) return foodDb;
  let byId = new Map(foodDb.map((item) => [item.id, item]));
  let nextPriority = Math.max(0, ...foodDb.map((item) => Number(item.priority) || 0)) + 1;
  let upsert = (id, name, category, meals) => {
    let existing = byId.get(id);
    if (existing) return existing;
    let created = foodPolicyBaseRecord(id, name, category, meals, nextPriority++);
    foodDb.push(created);
    byId.set(id, created);
    return created;
  };

  for (let [id, patch] of Object.entries(FOOD_POLICY_DATA.safeFormOverrides)) {
    let item = byId.get(id);
    if (!item) continue;
    item.safeForm = patch.safeForm;
    item.prep = patch.prep;
  }

  // Migrationssichere Bereinigung des historischen Mischdatensatzes.
  let mixedMais = byId.get("mais-polenta");
  if (mixedMais && !byId.has("mais")) {
    byId.delete("mais-polenta");
    mixedMais.id = "mais";
    mixedMais.name = "Mais";
    mixedMais.alias = "";
    mixedMais.foodFamily = "mais";
    mixedMais.illustrationId = "mais-polenta";
    byId.set("mais", mixedMais);
  }
  idAliases["mais-polenta"] = "mais";
  let mais = byId.get("mais");
  if (mais) mais.foodFamily = "mais";
  let polenta = byId.get("polenta");
  if (polenta) polenta.foodFamily = "mais";

  let sesam = byId.get("sesam");
  let tahin = byId.get("tahin");
  for (let item of [sesam, tahin].filter(Boolean)) {
    item.foodFamily = "sesam";
    item.allergenFamily = "sesam";
    item.allergenGroup = "Sesam";
  }

  let hafer = byId.get("hafer");
  let haferdrink = byId.get("haferdrink");
  for (let item of [hafer, haferdrink].filter(Boolean)) {
    item.foodFamily = "hafer";
    item.allergenFamily = "hafer";
    item.allergenGroup = "Glutenhaltiges Getreide";
  }

  for (let id of FOOD_POLICY_DATA.componentOnlyFoods) {
    let item = byId.get(id);
    if (item) item.plannerRole = "component";
  }

  // Der ausdrücklich freigegebene gemeinsame Milch-Allergenstamm.
  let cottage = upsert("huettenkaese", "Hüttenkäse", "Milchprodukt", FOOD_POLICY_MAIN_MEALS);
  cottage.name = "Hüttenkäse";
  let cottageAliases = String(cottage.alias || "").split(/[,;/|]+/).map((term) => term.trim()).filter(Boolean);
  let compactAlias = (value) => String(value || "").trim().toLocaleLowerCase("de");
  if (!cottageAliases.some((term) => compactAlias(term) === compactAlias("Cottage Cheese"))) cottageAliases.push("Cottage Cheese");
  cottage.alias = cottageAliases.filter((term) => compactAlias(term) !== compactAlias(cottage.name)).join(", ");
  cottage.allergenGroup = "Milch";
  for (let id of FOOD_POLICY_DATA.milkAllergenFoods) {
    let item = byId.get(id);
    if (item) item.allergenFamily = "milch";
  }
  for (let item of foodDb) {
    if (item.category === "Milchprodukt" && item.allergenGroup === "Milch") item.allergenFamily = "milch";
  }

  // Nur bereits vorhandene, eindeutig gleichstoffliche Nuss↔Nussmus-Paare verknüpfen.
  for (let [nutId, butterId] of FOOD_POLICY_DATA.nutVariantPairs) {
    if (!byId.has(nutId) || !byId.has(butterId)) continue;
    let family = `nuss:${nutId}`;
    byId.get(nutId).foodFamily = family;
    byId.get(butterId).foodFamily = family;
    byId.get(nutId).allergenFamily = family;
    byId.get(butterId).allergenFamily = family;
  }

  let honey = upsert("honig", "Honig", "Sonstiges", FOOD_POLICY_MAIN_MEALS);
  honey.minPhase = "familie";
  honey.minAgeMonths = 12;

  let lachs = byId.get("lachs");
  if (lachs) lachs.meals = [...FOOD_POLICY_FISH_MEALS];
  let sardine = byId.get("sardine");
  if (sardine) sardine.meals = [...FOOD_POLICY_FISH_MEALS];

  for (let [id, name] of FOOD_POLICY_DATA.autoFish) {
    let item = upsert(id, name, "Fisch", FOOD_POLICY_FISH_MEALS);
    item.meals = [...FOOD_POLICY_FISH_MEALS];
    item.allergenGroup = "Fisch";
  }
  for (let [id, name] of FOOD_POLICY_DATA.manualOnlyFish) {
    let item = upsert(id, name, "Fisch", FOOD_POLICY_FISH_MEALS);
    item.meals = [...FOOD_POLICY_FISH_MEALS];
    item.allergenGroup = "Fisch";
    item.autoPlan = false;
  }

  // Vorhandene Einzelillustrationen weiterverwenden, sonst greift der bestehende Kategorie-Fallback.
  for (let id of ["forelle", "thunfisch"]) {
    let item = byId.get(id);
    if (item) item.illustrationId = id;
  }

  return foodDb;
}

function relatedFamilyFoodIds(foodRecord, foods) {
  if (!foodRecord || !Array.isArray(foods)) return [];
  let foodFamily = foodRecord.foodFamily || "";
  let allergenFamily = foodRecord.allergenFamily || "";
  if (!foodFamily && !allergenFamily) return [foodRecord.id];
  return foods
    .filter((candidate) =>
      candidate && (
        (foodFamily && candidate.foodFamily === foodFamily) ||
        (allergenFamily && candidate.allergenFamily === allergenFamily)
      ),
    )
    .map((candidate) => candidate.id);
}

function familySuccessfulExposureCount(foodRecord, foods, logs, outcomeForFoodFn) {
  let ids = new Set(relatedFamilyFoodIds(foodRecord, foods));
  if (!ids.size) ids.add(foodRecord?.id);
  return new Set(
    (logs || [])
      .flatMap((log) => (log.foodIds || [])
        .filter((id) => ids.has(id) && outcomeForFoodFn(log, id) === "eaten")
        .map(() => typeof logExposureKey === "function" ? logExposureKey(log) : `${log.date}|${log.meal}`)),
  ).size;
}

function familyPlanningRank(foodRecord, foods, logs, outcomeForFoodFn, concreteRank) {
  let concrete = Number(concreteRank) || 0;
  let success = familySuccessfulExposureCount(foodRecord, foods, logs, outcomeForFoodFn);
  if (success >= 3) return Math.max(concrete, 3);
  if (success >= 2) return Math.max(concrete, 2);
  if (success >= 1) return Math.max(concrete, 1);
  return concrete;
}

function installFoodPolicyRuntime() {
  applyFoodPolicyData(FOOD_DB, ID_ALIASES);

  let autoPlanningDepth = 0;
  let autoPlanningDate = "";
  let originalRank = rank;
  let originalEatenExposureCount = eatenExposureCount;
  let originalEligibleCore = eligibleCore;
  let originalIsTrustedBase = isTrustedBase;
  let originalKnownBase = knownBase;
  let originalChooseFocus = chooseFocus;
  let originalIntroductionCandidate = introductionCandidate;
  let originalKnownCandidate = knownCandidate;
  let originalCompanionFor = companionFor;
  let originalBreakfastReady = breakfastReady;
  let originalManualMealRoleInfo = manualMealRoleInfo;
  let originalManualMealValidation = manualMealValidation;
  let originalRecipeSuitableForMeal = recipeSuitableForMeal;
  let originalBuildDay = buildDay;
  let originalDisplayStatus = displayStatus;
  let originalApplyFollowUpPlan = applyFollowUpPlan;
  let originalFoodIllustrationPath = foodIllustrationPath;
  let originalRecipeFoodIds = recipeFoodIds;
  let originalBootstrapStorage = bootstrapStorage;

  let policyEligible = (f, on = autoPlanningDate || today()) =>
    automaticFoodEligibility(f, on, state?.settings || {});

  let withEligibleFoods = (on, includeIds, callback) => {
    if (!autoPlanningDepth || !state?.foods) return callback();
    let originalFoods = state.foods;
    let keep = new Set(includeIds || []);
    state.foods = originalFoods.filter((item) => keep.has(item.id) || policyEligible(item, on));
    try { return callback(); }
    finally { state.foods = originalFoods; }
  };

  let withPlannerOverride = (key, on, callback) => {
    let allowId = state.overrides?.[key] || "";
    return withEligibleFoods(on, allowId ? [allowId] : [], () => callback(allowId));
  };

  let nextAllowedFocus = (producer, exclude = [], allowId = "") => {
    let blocked = [...exclude];
    let max = (state?.foods?.length || 0) + 1;
    for (let i = 0; i < max; i++) {
      let result = producer(blocked);
      if (!result?.f) return result;
      if (plannerFoodCanBeAutomaticFocus(result.f)) return result;
      if (result.f.id === allowId) {
        let overrideMode = plannerFoodOverrideMode(result.f, originalRank(result.f));
        if (overrideMode === "sample") return { ...result, type: "manuell" };
      }
      if (blocked.includes(result.f.id)) return null;
      blocked.push(result.f.id);
    }
    return null;
  };

  rank = function policyAwareRank(f) {
    let concrete = originalRank(f);
    if (!autoPlanningDepth || !f) return concrete;
    let familyRank = familyPlanningRank(f, state.foods, state.logs, outcomeForFood, concrete);
    let explicitOverride = plannerExplicitOverrideForFood(
      state.overrides,
      autoPlanningDate,
      f.id,
      (meal) => !!meal && eligible(f, meal, autoPlanningDate),
    );
    return plannerPlanningRank(f, concrete, familyRank, explicitOverride);
  };

  eatenExposureCount = function policyAwareExposureCount(id) {
    let concrete = originalEatenExposureCount(id);
    if (!autoPlanningDepth) return concrete;
    let f = food(id);
    if (!f) return concrete;
    return Math.max(
      concrete,
      familySuccessfulExposureCount(f, state.foods, state.logs, outcomeForFood),
    );
  };

  eligibleCore = function policyAwareEligibleCore(f, meal, on) {
    return originalEligibleCore(f, meal, on) && (!autoPlanningDepth || policyEligible(f, on));
  };

  isTrustedBase = function policyAwareTrustedBase(f) {
    return plannerFoodIsTrustedBase(f, originalIsTrustedBase(f));
  };

  knownBase = function policyAwareKnownBase(meal, exclude = []) {
    return withEligibleFoods(autoPlanningDate || today(), [], () => {
      let blocked = [...exclude];
      let max = (state?.foods?.length || 0) + 1;
      for (let i = 0; i < max; i++) {
        let result = originalKnownBase(meal, blocked);
        if (!result || plannerFoodCanBeBase(result)) return result;
        if (blocked.includes(result.id)) return null;
        blocked.push(result.id);
      }
      return null;
    });
  };

  chooseFocus = function policyAwareChooseFocus(meal, on, exclude = [], key = "") {
    return withPlannerOverride(key, on, (allowId) =>
      nextAllowedFocus(
        (blocked) => originalChooseFocus(meal, on, blocked, key),
        exclude,
        allowId,
      ),
    );
  };

  introductionCandidate = function policyAwareIntroductionCandidate(meal, on, ctx, exclude = []) {
    let key = `${on}|${meal}`;
    return withPlannerOverride(key, on, (allowId) =>
      nextAllowedFocus(
        (blocked) => originalIntroductionCandidate(meal, on, ctx, blocked),
        exclude,
        allowId,
      ),
    );
  };

  knownCandidate = function policyAwareKnownCandidate(meal, on, ctx, exclude = []) {
    let key = `${on}|${meal}`;
    return withPlannerOverride(key, on, (allowId) =>
      nextAllowedFocus(
        (blocked) => originalKnownCandidate(meal, on, ctx, blocked),
        exclude,
        allowId,
      ),
    );
  };

  companionFor = function policyAwareCompanionFor(f, meal, on, focusType = "") {
    return withEligibleFoods(on, [f?.id], () => originalCompanionFor(f, meal, on, focusType));
  };

  breakfastReady = function policyAwareBreakfastReady(on = today()) {
    return withEligibleFoods(on, [], () => originalBreakfastReady(on));
  };

  manualMealRoleInfo = function policyAwareManualMealRoleInfo(foodOrId, meal, on = today(), context = {}) {
    let result = originalManualMealRoleInfo(foodOrId, meal, on, context);
    let role = plannerManualRole(result?.food, result?.role);
    return role === result?.role ? result : { ...result, role, reason: "planner_component_only" };
  };

  manualMealValidation = function policyAwareManualMealValidation(plan, meal, on = today()) {
    let result = originalManualMealValidation(plan, meal, on);
    return plannerManualComponentBaseViolation(result, state.foods, plan?.recipeName || "");
  };

  recipeSuitableForMeal = function policyAwareRecipeSuitableForMeal(recipe, meal) {
    let result = plannerRecipeSuitableForMeal(recipe, meal);
    if (result === originalRecipeSuitableForMeal(recipe, meal)) return result;
    return result;
  };

  function autoRecipeIngredientReady(name, on) {
    let f = state.foods.find((item) => item.name === name);
    if (!f || !policyEligible(f, on) || status(f) === "Pausiert") return false;
    return originalRank(f) >= 2 || familySuccessfulExposureCount(f, state.foods, state.logs, outcomeForFood) >= 1;
  }

  function automaticRecipeFoodIds(recipe, on) {
    if (!recipe) return [];
    let sets = [recipe.requires || [], ...(recipe.alternatives || [])]
      .filter((set, index) => set.length || index === 0)
      .map((set, index) => ({ set, index }))
      .filter(({ set }) => set.every((name) => autoRecipeIngredientReady(name, on)))
      .sort((a, b) => a.index - b.index);
    let best = sets[0];
    if (!best) return [];
    let ids = best.set.map((name) => state.foods.find((item) => item.name === name)?.id).filter(Boolean);
    for (let choiceList of [recipe.oneOf || [], recipe.milkChoices || []]) {
      if (!choiceList.length) continue;
      let candidates = choiceList
        .map((name) => state.foods.find((item) => item.name === name))
        .filter((item) => item && autoRecipeIngredientReady(item.name, on))
        .sort((a, b) => rank(b) - rank(a) || a.priority - b.priority);
      if (!candidates.length) return [];
      if (!ids.includes(candidates[0].id)) ids.push(candidates[0].id);
    }
    return ids;
  }

  function autoRecipeCandidateStates(meal, on, ctx, snack = false) {
    return recipeStates()
      .filter((r) =>
        r.requirementMissing?.length === 0 &&
        automaticRecipeFoodIds(r, on).length > 0 &&
        recipeSuitableForMeal(r, meal) &&
        !(r.milkMeal === "full" && recipeContainsMeatOrFish(r)) &&
        !(r.milkMeal === "full" && ctx.fullMilkDates?.has(on)) &&
        (snack || (r.freezable && recipeInventoryPortions(r.name) > (ctx.recipeReserved?.get(r.name) || 0))),
      );
  }

  recipeStockCandidate = function policyAwareRecipeStockCandidate(meal, on, ctx) {
    if (!state.settings.preferInventoryInPlan) return null;
    let override = food(state.overrides?.[`${on}|${meal}`] || "");
    if (override && eligible(override, meal, on)) return null;
    return autoRecipeCandidateStates(meal, on, ctx, false)
      .sort((a, b) => String(oldestRecipeBatch(a.name)?.frozenDate || "9999").localeCompare(String(oldestRecipeBatch(b.name)?.frozenDate || "9999")))[0] || null;
  };

  snackRecipeCandidate = function policyAwareSnackRecipeCandidate(on, ctx) {
    return autoRecipeCandidateStates("snack", on, ctx, true)
      .sort((a, b) => {
        let aStock = recipeInventoryPortions(a.name) > (ctx.recipeReserved?.get(a.name) || 0) ? 0 : 1;
        let bStock = recipeInventoryPortions(b.name) > (ctx.recipeReserved?.get(b.name) || 0) ? 0 : 1;
        let aUsed = ctx.recipePlannedUse?.get(a.name) || 0;
        let bUsed = ctx.recipePlannedUse?.get(b.name) || 0;
        return aStock - bStock || aUsed - bUsed || a.name.localeCompare(b.name, "de");
      })[0] || null;
  };

  recipeFoodIds = function policyAwareRecipeFoodIds(recipe) {
    if (!autoPlanningDepth) return originalRecipeFoodIds(recipe);
    return automaticRecipeFoodIds(recipe, autoPlanningDate || today());
  };

  buildDay = function policyAwareBuildDay(date, index, ctx) {
    pruneIneligibleAutomaticPlanState(state);
    let previousDate = autoPlanningDate;
    autoPlanningDepth++;
    autoPlanningDate = date;
    try {
      let day = originalBuildDay(date, index, ctx);
      for (let meal of day?.meals || []) {
        if (meal?.manualAdded || meal?.lockedMode === "manual") continue;
        meal.optionalAddons = (meal.optionalAddons || []).filter((id) => policyEligible(food(id), date));
      }
      return day;
    } finally {
      autoPlanningDepth--;
      autoPlanningDate = previousDate;
    }
  };

  displayStatus = function policyAwareDisplayStatus(f) {
    let compact = automaticEligibilityStatus(
      f,
      Object.fromEntries(Object.entries(PHASES).map(([key, value]) => [key, value.label])),
    );
    return compact || originalDisplayStatus(f);
  };

  foodIllustrationPath = function policyAwareFoodIllustrationPath(f) {
    if (f?.illustrationId && FOOD_ICON_PATHS[f.illustrationId]) return FOOD_ICON_PATHS[f.illustrationId];
    return originalFoodIllustrationPath(f);
  };

  applyFollowUpPlan = function policyAwareApplyFollowUpPlan(record, requestedDate = "") {
    let result = originalApplyFollowUpPlan(record, requestedDate);
    if (!result?.ok || !result.date) return result;
    let key = planLockKey(result.date, record.meal || "lunch");
    let lock = state.planLocks?.[key];
    let blocked =
      (lock?.foodIds || []).some((id) => !policyEligible(food(id), result.date)) ||
      plannerAutomaticLockRoleViolation(lock, state.foods);
    if (!blocked) return result;
    delete state.planLocks?.[key];
    if (state.overrides?.[key] === record.foodId) delete state.overrides[key];
    record.status = "later";
    record.dueDate = "";
    record.updatedAt = new Date().toISOString();
    return { ok: true, date: "" };
  };

  bootstrapStorage = async function policyAwareBootstrapStorage() {
    let result = await originalBootstrapStorage();
    if (pruneIneligibleAutomaticPlanState(state)) {
      await save();
      renderCurrentView();
    }
    return result;
  };

  return {
    policyEligible,
    automaticRecipeFoodIds,
  };
}

function pruneIneligibleAutomaticPlanState(currentState, recipes = typeof RECIPES !== "undefined" ? RECIPES : []) {
  if (!currentState?.planLocks) return false;
  let changed = false;
  for (let [key, lock] of Object.entries(currentState.planLocks)) {
    if (lock?.mode !== "auto") continue;
    let date = key.split("|")[0];
    let automaticIds = [...new Set([...(lock.foodIds || []), ...(lock.optionalAddons || [])])];
    let blocked = automaticIds.some((id) => {
      let f = currentState.foods?.find((item) => item.id === id);
      return f && !automaticFoodEligibility(f, date, currentState.settings || {});
    }) ||
      plannerAutomaticLockRoleViolation(lock, currentState.foods) ||
      plannerAutomaticRecipeLockMealViolation(key, lock, recipes);
    if (!blocked) continue;
    delete currentState.planLocks[key];
    if (currentState.overrides?.[key] && !String(currentState.overrides[key]).startsWith("__")) delete currentState.overrides[key];
    if (lock.followUpFoodId && currentState.followUps?.[lock.followUpFoodId]) {
      currentState.followUps[lock.followUpFoodId].status = "later";
      currentState.followUps[lock.followUpFoodId].dueDate = "";
    }
    changed = true;
  }
  return changed;
}

function startBeikostApp() {
  installFoodPolicyRuntime();

  state = load();
  if (!state.settings.planFrom) state.settings.planFrom = today();
  if (pruneIneligibleAutomaticPlanState(state)) save();

  window.__beikostTest = {
    getState: () => clone(state),
    setState: (next) => { state = migrateState(next); if (!state.settings.planFrom) state.settings.planFrom = today(); pruneIneligibleAutomaticPlanState(state); save(); renderAll(); return clone(state); },
    reset: () => { state = migrateState(clone(DEFAULT)); state.backupMeta.chesterContextSeeded = true; state.settings.planFrom = today(); save(); renderAll(); return clone(state); },
    buildDays: (from = today(), count = 7) => clone(buildDays(from, count)),
    scheduleFollowUp: (...args) => { let result = scheduleFollowUp(...args); save(); renderAll(); return clone(result); },
    followUpEntries: () => clone(followUpEntries()),
    displayStatus: (id) => displayStatus(food(id)),
    automaticFoodEligibility: (id, on = today()) => automaticFoodEligibility(food(id), on, state.settings),
    familySuccessfulExposureCount: (id) => familySuccessfulExposureCount(food(id), state.foods, state.logs, outcomeForFood),
    recipeStates: () => clone(recipeStates()),
    recipeSuitableForMeal: (name, meal) => plannerRecipeSuitableForMeal(recipeByName(name), meal),
    plannerRole: (id) => plannerRole(food(id)),
    today,
    addDays,
    openLog: (plan) => openLog(plan),
    setLogQuery: (query) => {
      logFoodQuery = String(query || "");
      let field = document.getElementById("logFoodSearch");
      if (field) field.value = logFoodQuery;
      renderLogFoodResults();
    },
    showRecipes: (query = "", filter = "all") => { recipeQuery = String(query || ""); recipeFilter = filter; showView("more"); renderPrep(); },
    foodId: (name) => state.foods.find((item) => item.name === name)?.id || "",
    safeBaseIds: (foodId, meal = "lunch") => safeBaseCandidates(foodId, meal).map((item) => item.food.id),
    preparationOptions: (foodId) => clone(followUpPreparationOptions(foodId)),
    updateFollowUp: (foodId, patch = {}, requestedDate = "") => {
      let record = state.followUps?.[foodId];
      if (!record) return { ok: false, message: "Wiedervorlage fehlt." };
      Object.assign(record, clone(patch));
      let result = applyFollowUpPlan(record, requestedDate || record.dueDate);
      save(); renderAll(); return clone(result);
    },
    rebuildFoodConsequences: (foodId) => { rebuildFoodConsequences(foodId); save(); renderAll(); return clone(state); },
    idbRoundTrip: async (key, value) => { await idbPut(key, value); return clone(await idbGet(key)); },
    sha256: (text) => sha256Text(String(text)),
    renderAll: () => renderAll(),
    manualMealRoleInfo: (foodId, meal = "lunch", on = today(), context = {}) => clone(manualMealRoleInfo(foodId, meal, on, context)),
    manualMealRoleState: (plan = {}) => clone(manualMealRoleState(plan)),
    manualMealValidation: (plan = {}, meal = "lunch", on = today()) => clone(manualMealValidation(plan, meal, on)),
    prepareManualMealData: (data = {}, meal = "lunch", on = today()) => clone(prepareManualMealData(data, meal, on)),
    storeManualMeal: (date, meal, data, kind = "manual") => {
      let before = clone(state);
      let result = kind === "edited" ? storeEditedPlanMeal(date, meal, data) : storeManualMeal(date, meal, data);
      if (!result.ok) state = before;
      return { ...clone(result), state: clone(state) };
    },
    openManualMealSelector: (date, meal, initialMeal = null) => openManualMealSelector(date, meal, initialMeal),
    planSlotProtected: (date, meal = "lunch") => planSlotProtected(date, meal),
    isStarchyFood: (foodId) => isStarchyFood(food(foodId)),
    version: APP_VERSION,
  };

  const versionNode = document.getElementById("appVersion");
  if (versionNode) versionNode.textContent = APP_VERSION;

  bind();
  renderCurrentView();
  bootstrapStorage();
  if (navigator.serviceWorker && location.protocol.startsWith("http"))
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("./sw.js").then((r) => r.update()).catch(() => {}),
    );
}

if (typeof window !== "undefined" && typeof document !== "undefined") startBeikostApp();

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FOOD_PHASE_ORDER,
    FOOD_POLICY_DATA,
    foodPolicyMonthsOld,
    automaticFoodEligibility,
    automaticEligibilityStatus,
    plannerRole,
    plannerFoodCanBeBase,
    plannerFoodCanBeAutomaticFocus,
    plannerManualRole,
    plannerFoodOverrideMode,
    plannerExplicitOverrideForFood,
    plannerPlanningRank,
    plannerFoodIsTrustedBase,
    plannerAutomaticLockRoleViolation,
    plannerRecipeSuitableForMeal,
    plannerRecipeByStoredName,
    plannerAutomaticRecipeLockMealViolation,
    plannerManualComponentBaseViolation,
    applyFoodPolicyData,
    relatedFamilyFoodIds,
    familySuccessfulExposureCount,
    familyPlanningRank,
    pruneIneligibleAutomaticPlanState,
  };
}
