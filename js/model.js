"use strict";

/* Datenmodell und Statusableitungen
 * Protokollauswertung, Statuswerte, Mengenstufen, Phasen und Vorratsgrundfunktionen.
 * Konsolidierter Produktionsstand 10.0.0.
 */

/*
 * Strukturierte Rezept-Zutaten dürfen historische Bezeichnungen behalten, solange
 * sie eindeutig auf genau ein kanonisches FOOD zeigen. Das ist insbesondere für
 * Altbezeichnungen wie „Nudeln/Pasta“ nötig, nachdem sichtbare FOOD-Namen bewusst
 * slash-frei geführt werden. Die Normalisierung läuft vor Planning/Prep/app.js,
 * damit auch der erste (noch verborgene) Planner-Lauf bereits dieselben FOOD-IDs
 * verwendet wie Suche, Migration und der spätere PLAN-08-Recipe-first-Layer.
 */
function recipeFoodFromStructuredLabel(name, foods = FOOD_DB) {
  return foodByName(name, foods);
}
function canonicalizeRecipeFoodLabels(recipes = RECIPES, foods = FOOD_DB) {
  let canonicalize = (names) => (names || []).map((name) => recipeFoodFromStructuredLabel(name, foods)?.name || name);
  for (let recipe of recipes || []) {
    recipe.requires = canonicalize(recipe.requires);
    if (Array.isArray(recipe.alternatives)) recipe.alternatives = recipe.alternatives.map((set) => canonicalize(set));
    if (Array.isArray(recipe.oneOf)) recipe.oneOf = canonicalize(recipe.oneOf);
    if (Array.isArray(recipe.milkChoices)) recipe.milkChoices = canonicalize(recipe.milkChoices);
  }
  return recipes;
}
function recipeStructuredFoodSearchTerms(recipe) {
  let names = [
    ...(recipe?.requires || []),
    ...((recipe?.alternatives || []).flat()),
    ...(recipe?.oneOf || []),
    ...(recipe?.milkChoices || []),
  ];
  return names.flatMap((name) => {
    let item = recipeFoodFromStructuredLabel(name, FOOD_DB);
    return item ? [item.name, ...foodAliasTerms(item)] : [name];
  }).join(" ");
}
if (typeof RECIPES !== "undefined" && typeof FOOD_DB !== "undefined") canonicalizeRecipeFoodLabels(RECIPES, FOOD_DB);

function logsFor(id) {
  return state.logs
    .filter((l) => (l.foodIds || []).includes(id))
    .sort((a, b) =>
      (a.date + a.createdAt).localeCompare(b.date + b.createdAt),
    );
}
function outcomeForFood(log, id) {
  if (log.foodOutcomes && log.foodOutcomes[id]) return log.foodOutcomes[id];
  return ({ not_eaten: "not_accepted", tasted_ok: "tried", eaten_ok: "eaten" }[log.outcome] || log.outcome);
}
function autoStatus(f) {
  let ls = logsFor(f.id);
  if (ls.some((l) => outcomeForFood(l, f.id) === "reaction" && (!l.reactionFoodId || l.reactionFoodId === f.id))) return "Pausiert";
  let success = new Set(ls.filter((l) => outcomeForFood(l, f.id) === "eaten").map((l) => l.date + "|" + l.meal));
  let tried = ls.some((l) => ["tried", "eaten"].includes(outcomeForFood(l, f.id)));
  if (success.size >= 3) return "Regelmäßig";
  if (success.size >= 2) return "Verträgliche Basis";
  if (tried) return "Probiert";
  return "Offen";
}
function status(f) {
  return f.manualStatus && f.manualStatus !== "auto"
    ? f.manualStatus
    : autoStatus(f);
}
function rank(f) {
  return STATUS_ORDER[status(f)] ?? 0;
}
function statusSource(f) {
  if (f.manualStatus && f.manualStatus !== "auto") return "manuell gesetzt";
  let ls = logsFor(f.id), success = new Set(ls.filter((l) => outcomeForFood(l, f.id) === "eaten").map((l) => l.date + "|" + l.meal));
  if (success.size >= 3) return `automatisch aus ${success.size} gegessenen Gaben`;
  if (success.size === 2) return "automatisch aus 2 gegessenen Gaben";
  if (success.size === 1) return "automatisch aus einer gegessenen Gabe";
  if (ls.some((l) => outcomeForFood(l, f.id) === "tried")) return "automatisch aus einer Kostprobe";
  return "automatisch – noch ohne Protokoll";
}

/*
 * FOOD-COUNT: Für das 100-Lebensmittel-Ziel zählt die ausdrücklich freigegebene
 * kulinarische Grundstoff-Identität, nicht jede Verarbeitungsform als neues FOOD.
 * Diese Zuordnung ist absichtlich getrennt von foodFamily/allergenFamily, weil
 * jene Felder Planner- und Allergenverhalten steuern.
 */
const COUNT100_IDENTITY_BY_ID = Object.freeze({
  sesam: "sesam",
  tahin: "sesam",
  mais: "mais",
  "mais-polenta": "mais",
  polenta: "mais",
  hafer: "hafer",
  haferdrink: "hafer",
  weizen: "weizen",
  weizengriess: "weizen",
  bulgur: "weizen",
  couscous: "weizen",
  "nudeln-pasta": "weizen",
  brot: "weizen",
});
function count100Identity(foodOrId, name = "") {
  let id = typeof foodOrId === "object" ? foodOrId?.id : foodOrId;
  let foodName = typeof foodOrId === "object" ? foodOrId?.name : name;
  let canonical = canonicalId(id || "", foodName || "");
  return COUNT100_IDENTITY_BY_ID[canonical] || canonical;
}
function learnedFoods() {
  let seen = new Set();
  return state.foods
    .filter((f) => f.count100 && rank(f) >= 1)
    .sort((a, b) => a.priority - b.priority)
    .filter((f) => {
      let identity = count100Identity(f);
      if (!identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
}
function lastDate(id, okOnly = false) {
  let ls = logsFor(id).filter((l) => !okOnly || outcomeForFood(l, id) === "eaten");
  return ls.at(-1)?.date || "";
}
function lastOutcome(id) {
  let log=logsFor(id).at(-1);
  return log ? outcomeForFood(log,id) : "";
}
function successfulFoods() {
  return state.foods.filter((f) => rank(f) >= 2);
}
function eatenAmounts() {
  return state.logs
    .filter((l) => Object.values(l.foodOutcomes || {}).some((o) => o === "eaten") || l.outcome === "eaten")
    .map((l) => Number(l.amount))
    .filter((n) => Number.isFinite(n) && n > 0);
}
function amountStats() {
  let amounts = eatenAmounts(),
    max = amounts.length ? Math.max(...amounts) : 0,
    last = amounts.at(-1) || 0;
  return { amounts, max, last };
}
function suggestedAmountLevelFromLogs(logs) {
  let amounts = (logs || [])
    .filter((l) => Object.values(l.foodOutcomes || {}).some((o) => o === "eaten") || l.outcome === "eaten")
    .map((l) => Number(l.amount))
    .filter((n) => Number.isFinite(n) && n > 0);
  let max = amounts.length ? Math.max(...amounts) : 0;
  if (max >= 100) return "established";
  if (max >= 50) return "building";
  if (max >= 20) return "small";
  return "taste";
}
function suggestedAmountLevel() {
  return suggestedAmountLevelFromLogs(state.logs);
}
function currentAmountLevel() {
  return AMOUNT_LEVELS[state.settings.amountSelected]
    ? state.settings.amountSelected
    : suggestedAmountLevel();
}
function amountLevelSourceText() {
  let suggested = suggestedAmountLevel(), selected = currentAmountLevel(), max = amountStats().max;
  let basis = max ? `aus der bisher höchsten protokollierten Menge von ${max} g` : "weil noch keine Menge protokolliert ist";
  return selected === suggested
    ? `Entspricht der Mengenorientierung ${basis}.`
    : `Von dir gewählt. Mengenorientierung: ${AMOUNT_LEVELS[suggested].label} ${basis}.`;
}
function amountLevelIndex(key) {
  return ["taste", "small", "building", "established"].indexOf(key);
}
function changeAmountLevel(delta) {
  let keys = ["taste", "small", "building", "established"], idx = amountLevelIndex(currentAmountLevel());
  state.settings.amountSelected = keys[Math.max(0, Math.min(keys.length - 1, idx + delta))];
  save(); renderAll();
}
function useSuggestedAmountLevel() {
  state.settings.amountSelected = suggestedAmountLevel();
  save(); renderAll();
}
function currentPhase() {
  return PHASES[state.settings.phaseSelected] ? state.settings.phaseSelected : "kennenlernen";
}
function phaseSourceText() {
  return "Die Phase steuert nur die vorgesehenen Mahlzeitenslots. Alter und Grammwerte wechseln sie nicht automatisch.";
}
function phaseIndex(key) {
  return ["kennenlernen", "aufbau", "drei", "familie"].indexOf(key);
}
function phaseMealKeys(key = currentPhase()) {
  return [...(PHASES[key]?.meals || PHASES.kennenlernen.meals)];
}
function setPhase(key) {
  if (!PHASES[key]) return false;
  state.settings.phaseSelected = key;
  state.settings.phaseModelVersion = 2;
  state.settings.phaseMode = "manual-v2";
  save(); renderAll();
  return true;
}
function mealProgressRank() {
  let amounts = eatenAmounts();
  if (amounts.filter((n) => n >= 100).length >= 3) return 3;
  if (amounts.filter((n) => n >= 50).length >= 3) return 2;
  if (amounts.filter((n) => n >= 20).length >= 3) return 1;
  return 0;
}
function recipeAliasValues(recipe) {
  let aliases = [...(recipe.legacyNames || [])];
  if (Array.isArray(recipe.searchAliases)) aliases.push(...recipe.searchAliases);
  else if (recipe.searchAliases) aliases.push(...String(recipe.searchAliases).split(","));
  return [...new Set(aliases.map((name) => String(name).trim()).filter(Boolean))];
}
function recipeByName(name) {
  let normalized = normalizeName(name || "");
  if (!normalized) return null;
  return RECIPES.find((recipe) =>
    normalizeName(recipe.name) === normalized ||
    recipeAliasValues(recipe).some((alias) => normalizeName(alias) === normalized)
  ) || null;
}
function canonicalRecipeName(name) {
  return recipeByName(name)?.name || name;
}
function recipeNameMatches(storedName, requestedName) {
  return normalizeName(canonicalRecipeName(storedName || "")) === normalizeName(canonicalRecipeName(requestedName || ""));
}
function recipeSearchText(recipe) {
  return `${recipe.name || ""} ${recipe.ingredients || ""} ${(recipe.requires || []).join(" ")} ${(recipe.oneOf || []).join(" ")} ${(recipe.variantLabels || []).join(" ")} ${recipeAliasValues(recipe).join(" ")} ${recipeStructuredFoodSearchTerms(recipe)}`;
}
function inventoryName(item) {
  return item.kind === "recipe"
    ? recipeByName(item.recipeName)?.name || item.recipeName || "Vorbereitetes Rezept"
    : food(item.foodId)?.name || item.foodName || "Lebensmittel";
}
function recipeInventoryPortions(recipeName) {
  return state.inventory
    .filter(
      (i) =>
        i.kind === "recipe" &&
        recipeNameMatches(i.recipeName, recipeName) &&
        Number(i.portions) > 0,
    )
    .reduce((sum, i) => sum + Math.max(0, Math.floor(Number(i.portions) || 0)), 0);
}
function oldestFoodBatch(foodId) {
  return state.inventory
    .filter(
      (i) =>
        i.kind !== "recipe" &&
        i.foodId === foodId &&
        Number(i.portions) > 0,
    )
    .sort((a, b) => String(a.frozenDate).localeCompare(String(b.frozenDate)))[0] || null;
}
function oldestRecipeBatch(recipeName) {
  return state.inventory
    .filter(
      (i) =>
        i.kind === "recipe" &&
        recipeNameMatches(i.recipeName, recipeName) &&
        Number(i.portions) > 0,
    )
    .sort((a, b) => String(a.frozenDate).localeCompare(String(b.frozenDate)))[0] || null;
}
function consumeInventoryItem(id) {
  let item = state.inventory.find((i) => i.id === id);
  if (!item || Math.floor(Number(item.portions) || 0) <= 0) return false;
  item.portions = Math.max(0, Math.floor(Number(item.portions) || 0) - 1);
  if (item.portions <= 0)
    state.inventory = state.inventory.filter((i) => i.id !== id);
  return true;
}