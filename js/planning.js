"use strict";

/* Planung und Wiedervorlagen
 * Planerzeugung, Drei-Tage-Fixierung, manuelle Schutzmechanik, Rollen, Ablehnungen, Reaktionen und Wiedervorlagen.
 * Konsolidierter Produktionsstand 10.0.0.
 */

function recipeFoodIds(recipe) {
  if (!recipe) return [];
  let sets = [recipe.requires || [], ...(recipe.alternatives || [])];
  let best = sets.map((set) => ({
    set,
    score: set.reduce((sum, name) => {
      let f = foodByName(name, state.foods);
      return sum + (f ? (rank(f) >= 2 ? 0 : 2) : 5);
    }, 0),
  })).sort((a, b) => a.score - b.score)[0]?.set || [];
  let ids = best.map((name) => foodByName(name, state.foods)?.id).filter(Boolean);
  for (let choiceList of [recipe.oneOf || [], recipe.milkChoices || []]) {
    if (!choiceList.length) continue;
    let choice = choiceList.map((name) => foodByName(name, state.foods)).filter(Boolean).sort((a, b) => rank(b) - rank(a) || a.priority - b.priority)[0];
    if (choice && !ids.includes(choice.id)) ids.push(choice.id);
  }
  return ids;
}
function recipeSuitableForMeal(recipe, meal) {
  let c = recipe?.category || "";
  if (meal === "snack")
    return (recipe?.tags || []).some((tag) => normalizeName(tag) === "snack");
  if (meal === "breakfast")
    return ["porridge", "pancakes", "baking"].includes(c);
  if (meal === "dinner")
    return !["philippines"].includes(c) || Number(recipe.stage || 1) <= 3;
  return true;
}
function manualMealKey(date, meal) {
  return `${date}|${meal}`;
}
function manualMealFor(date, meal) {
  let data = state.manualMeals?.[manualMealKey(date, meal)];
  if (!data) return null;
  return {
    ...clone(data),
    meal,
    active: true,
    type: data.type || "manuell",
    note: data.note || "Bewusst manuell zum Plan hinzugefügt.",
    manualAdded: data.manualAdded !== false,
    lockedMode: state.planLocks?.[planLockKey(date, meal)]?.mode || null,
  };
}
function plannerLogMealKeys() {
  return typeof LOG_MEAL_KEYS !== "undefined" ? LOG_MEAL_KEYS : ["breakfast", "snack", "lunch", "dinner"];
}
function plannerLogHasMealContext(log) {
  if (typeof logHasMealContext === "function") return logHasMealContext(log);
  return !!log && log.entryType !== "sample" && plannerLogMealKeys().includes(String(log.meal || ""));
}
function plannerLogExposureKey(log) {
  if (typeof logExposureKey === "function") return logExposureKey(log);
  let date = String(log?.date || "");
  if (plannerLogHasMealContext(log)) return `${date}|${log.meal}`;
  let identity = String(log?.id || log?.createdAt || log?.updatedAt || "free");
  return `${date}|entry:${identity}`;
}
function plannerLearningRoleLabel(item, type = "") {
  let itemRank = typeof rank === "function" ? rank(item) : 0;
  let itemStatus = typeof status === "function" ? status(item) : "";
  if (typeof learningRoleLabel === "function") return learningRoleLabel(itemRank, itemStatus, type);
  if (itemStatus === "Pausiert") return "Pausiert";
  if (itemRank === 1 || ["gezielt wiederholen", "Allergen wiederholen", "nach Einführung"].includes(String(type || ""))) return "Wiederholung";
  return "Einführung";
}
function successfulMealSlotCount(on = today()) {
  return new Set(
    state.logs
      .filter((log) => {
        if (!log?.date || log.date > on || !plannerLogHasMealContext(log)) return false;
        let sampleIds = new Set(log.sampleFoodIds || []);
        return (log.foodIds || []).some(
          (id) => outcomeForFood(log, id) === "eaten" && !sampleIds.has(id),
        );
      })
      .map((log) => `${log.date}|${log.meal}`),
  ).size;
}
function breakfastPairCompatible(a, b) {
  if (!a || !b || a.id === b.id) return false;
  let pair = new Set([a.category, b.category]);
  if (pair.has("Getreide/Stärke"))
    return ["Obst", "Gemüse", "Wurzel/Knolle", "Milchprodukt", "Ei"].some((category) => pair.has(category));
  if (pair.has("Obst"))
    return ["Milchprodukt", "Ei"].some((category) => pair.has(category));
  if (pair.has("Ei"))
    return ["Gemüse", "Wurzel/Knolle"].some((category) => pair.has(category));
  return false;
}
function breakfastReady(on = today()) {
  if (successfulMealSlotCount(on) < 3) return false;
  let pool = state.foods.filter(
    (f) =>
      f.active &&
      f.meals.includes("breakfast") &&
      status(f) !== "Pausiert" &&
      f.category !== "Fett" &&
      f.category !== "Kraut/Gewürz" &&
      canCombine(f),
  );
  return pool.some(
    (base, index) =>
      isTrustedBase(base) &&
      pool.some((candidate, candidateIndex) => candidateIndex !== index && breakfastPairCompatible(base, candidate)),
  );
}
function activeMeal(meal, on) {
  let day = diffDays(on, state.settings.startDate) + 1;
  if (day < 1) return false;
  return phaseMealKeys().includes(meal);
}
function usageCount(id) {
  return state.logs.filter(
    (l) => (l.foodIds || []).includes(id) && outcomeForFood(l, id) === "eaten",
  ).length;
}
function eatenExposureCount(id) {
  return new Set(
    state.logs
      .filter(
        (l) =>
          (l.foodIds || []).includes(id) &&
          outcomeForFood(l, id) === "eaten",
      )
      .map(plannerLogExposureKey),
  ).size;
}
function canCombine(f) {
  return (
    eatenExposureCount(f.id) >= 1 ||
    ["Verträgliche Basis", "Regelmäßig"].includes(status(f))
  );
}
function isTrustedBase(f) {
  return ["Verträgliche Basis", "Regelmäßig"].includes(status(f));
}
function knownBase(meal, exclude = []) {
  let pool = state.foods.filter(
    (f) =>
      f.active &&
      f.meals.includes(meal) &&
      !f.allergenGroup &&
      isTrustedBase(f) &&
      !exclude.includes(f.id) &&
      f.category !== "Kraut/Gewürz" &&
      f.category !== "Fett",
  );
  pool.sort(
    (a, b) => usageCount(a.id) - usageCount(b.id) || a.priority - b.priority,
  );
  return pool[0] || null;
}
function isSeason(f, on) {
  return (
    !f.seasonMonths?.length ||
    f.seasonMonths.includes(dateObj(on).getMonth() + 1)
  );
}
function travelSoon(on) {
  let d = diffDays(state.settings.travelDate, on);
  return d >= 0 && d <= 150;
}
function effectivePriority(f, on) {
  let p = Number(f.priority) || 9999;
  let phMode = state.settings.phMode || (state.settings.travelPrep ? "prepare" : "off");
  if (phMode !== "travel" && state.settings.seasonal && f.seasonMonths?.length && isSeason(f, on)) p -= 3;
  if (phMode !== "travel" && state.settings.seasonal && !isSeason(f, on) && f.seasonMonths?.length) p += 6;
  if (phMode === "prepare" && travelSoon(on) && f.ph) p -= 18;
  if (phMode === "travel") p += f.ph ? -35 : 5;
  return p;
}
function dueAllergen(f, on) {
  if (!f.allergenGroup || rank(f) < 2) return false;
  let ld = lastDate(f.id, true);
  return ld && diffDays(on, ld) >= Number(state.settings.allergenDays);
}
function eligibleCore(f, meal, on) {
  return (
    f.active &&
    f.meals.includes(meal) &&
    status(f) !== "Pausiert" &&
    f.category !== "Fett"
  );
}
function chooseFocus(meal, on, exclude = [], key = "") {
  let override = state.overrides[key];
  if (override) {
    let f = food(override);
    if (f && eligible(f, meal, on)) return { f, type: "manuell" };
  }
  let baseExists = !!knownBase(meal, exclude);
  let pool = state.foods.filter(
    (f) => eligible(f, meal, on) && !exclude.includes(f.id),
  );
  let retries = pool.filter(
    (f) => rank(f) === 1 || lastOutcome(f.id) === "not_accepted",
  );
  retries.sort((a, b) => effectivePriority(a, on) - effectivePriority(b, on));
  if (retries.length) {
    let f = retries[0];
    return {
      f,
      type: eatenExposureCount(f.id) >= 1
        ? "bekannt kombinieren"
        : "gezielt wiederholen",
    };
  }
  let due = pool.filter((f) => dueAllergen(f, on) && baseExists);
  due.sort((a, b) =>
    (lastDate(a.id, true) || "").localeCompare(lastDate(b.id, true)),
  );
  if (due.length) return { f: due[0], type: "Allergen wiederholen" };
  let fresh = pool.filter(
    (f) => rank(f) === 0 && (!f.allergenGroup || baseExists),
  );
  fresh.sort((a, b) => effectivePriority(a, on) - effectivePriority(b, on));
  if (fresh.length) return { f: fresh[0], type: fresh[0].allergenGroup ? "Allergen einführen" : "neu" };
  let regular = pool.filter((f) => rank(f) >= 2);
  regular.sort(
    (a, b) =>
      usageCount(a.id) - usageCount(b.id) ||
      effectivePriority(a, on) - effectivePriority(b, on),
  );
  return regular.length ? { f: regular[0], type: "bekannt" } : null;
}
function isStarchyFood(f) {
  return !!f && ["Getreide/Stärke", "Wurzel/Knolle"].includes(f.category);
}
function isMilkProductFood(f) {
  return !!f && ["kuhmilch", "naturjoghurt", "buttermilch"].includes(f.id);
}
function mealContainsMilkProduct(ids) {
  return (ids || []).some((id) => isMilkProductFood(food(id)));
}
function isMeatOrFish(f) {
  return !!f && ["Fleisch", "Fisch", "Meeresfrucht"].includes(f.category);
}
function recipeContainsMeatOrFish(recipe) {
  return recipeFoodIds(recipe).some((id) => isMeatOrFish(food(id)));
}
function mealMilkLevel(meal) {
  if (!meal) return "";
  if (meal.milkMeal) return meal.milkMeal;
  let recipe = meal.recipeName ? recipeByName(meal.recipeName) : null;
  if (recipe?.milkMeal) return recipe.milkMeal;
  return mealContainsMilkProduct(meal.foodIds) ? "full" : "";
}
function combinationKey(ids) {
  return [...new Set(ids || [])].filter(Boolean).sort().join("+");
}
function combinationHistory(ids) {
  let key = combinationKey(ids);
  return state.logs
    .filter((l) => combinationKey(l.foodIds) === key)
    .sort((a, b) => `${a.date}|${a.createdAt || ""}`.localeCompare(`${b.date}|${b.createdAt || ""}`));
}
function logCombinationSucceeded(log, ids) {
  return (ids || []).every((id) => outcomeForFood(log, id) === "eaten");
}
function logCombinationRejected(log, ids) {
  return (ids || []).some((id) => outcomeForFood(log, id) === "not_accepted");
}
function lastCombinationRejection(ids) {
  let history = combinationHistory(ids);
  let lastSuccessIndex = history.map((l) => logCombinationSucceeded(l, ids)).lastIndexOf(true);
  return history.slice(lastSuccessIndex + 1).filter((l) => logCombinationRejected(l, ids)).at(-1) || null;
}
function combinationPaused(ids, on) {
  if ((ids || []).length < 2) return false;
  let history = combinationHistory(ids);
  let lastSuccessIndex = history.map((l) => logCombinationSucceeded(l, ids)).lastIndexOf(true);
  let recent = history.slice(lastSuccessIndex + 1);
  let rejected = recent.filter((l) => logCombinationRejected(l, ids)).at(-1);
  if (!rejected) return false;
  let sameRejections = recent.filter((l) => logCombinationRejected(l, ids)).length;
  let pauseDays = sameRejections >= 2 ? 7 : 3;
  return diffDays(on, rejected.date) < pauseDays;
}
function enforceSingleStarch(focus, companions) {
  let items = [focus, ...(companions || [])].filter(Boolean);
  let starches = items.filter(isStarchyFood);
  if (starches.length <= 1) return companions || [];
  let keep = isStarchyFood(focus) ? focus.id : starches[0].id;
  return (companions || []).filter((x) => !isStarchyFood(x) || x.id === keep);
}

function culinaryCompatibilityScore(focus, candidate, meal) {
  if (!focus || !candidate) return 0;
  let score = 0;
  let fc = focus.category || "", cc = candidate.category || "";
  let fn = normalizeName(focus.name || ""), cn = normalizeName(candidate.name || "");
  let brassica = (name) => ["karfiol", "blumenkohl", "brokkoli", "kohl", "kraut"].some((x) => name.includes(x));
  if (meal === "breakfast") {
    if (fc === "Obst" && cc === "Getreide/Stärke") score -= 40;
    if (fc === "Getreide/Stärke" && cc === "Obst") score -= 40;
  } else {
    if (["Gemüse", "Wurzel/Knolle"].includes(fc) && ["Gemüse", "Wurzel/Knolle"].includes(cc)) score -= 35;
    if (fc === "Wurzel/Knolle" && cc === "Gemüse" || fc === "Gemüse" && cc === "Wurzel/Knolle") score -= 15;
    if (brassica(fn) && cc === "Getreide/Stärke") score += 45;
    if (brassica(cn) && fc === "Getreide/Stärke") score += 45;
  }
  if (isStarchyFood(focus) && isStarchyFood(candidate)) score += 100;
  return score;
}
function plannedMealAmounts(meal) {
  let ids = [...new Set(meal?.foodIds || [])].filter(Boolean);
  let target = meal?.meal === "snack" ? 0 : phasePortion();
  let samples = new Set(meal?.sampleFoodIds || []);
  if (meal?.meal === "snack") return { targetGrams: 0, sampleGrams: 0, totalOfferedGrams: 0, amounts: {} };
  let mainIds = ids.filter((id) => !samples.has(id));
  let sampleAmount = Math.max(3, Math.min(10, Math.round(target * 0.12)));
  let weights = {};
  mainIds.forEach((id) => {
    let f = food(id), category = f?.category || "";
    weights[id] = ["Fleisch", "Fisch", "Meeresfrucht", "Hülsenfrucht", "Ei", "Soja/Tofu"].includes(category) ? 0.2
      : category === "Getreide/Stärke" ? 0.3
      : category === "Wurzel/Knolle" ? 0.4
      : 0.5;
  });
  let weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  let amounts = {};
  let assigned = 0;
  mainIds.forEach((id, index) => {
    let amount = index === mainIds.length - 1 ? target - assigned : Math.max(1, Math.round(target * weights[id] / weightTotal));
    amounts[id] = amount; assigned += amount;
  });
  samples.forEach((id) => { amounts[id] = sampleAmount; });
  return { targetGrams: target, sampleGrams: samples.size ? sampleAmount : 0, totalOfferedGrams: target + samples.size * sampleAmount, amounts };
}
function applyPlannedMealAmounts(meal) {
  let allocation = plannedMealAmounts(meal);
  meal.portionTargetGrams = allocation.targetGrams;
  meal.sampleTargetGrams = allocation.sampleGrams;
  meal.totalOfferedGrams = allocation.totalOfferedGrams;
  meal.ingredientAmounts = allocation.amounts;
  return meal;
}

function companionFor(f, meal, on, focusType = "") {
  if (f.allergenGroup) return knownBase(meal, [f.id]);

  let introductionTypes = new Set([
    "neu",
    "gezielt wiederholen",
    "Allergen wiederholen",
    "manuell",
  ]);
  let needsTrustedBase =
    introductionTypes.has(focusType) && !isTrustedBase(f);

  let pool = state.foods.filter((x) => {
    let normalMealMatch = eligible(x, meal, on);
    let flexibleCerealMatch =
      f.category === "Getreide/Stärke" &&
      x.active &&
      status(x) !== "Pausiert" &&
      ["Obst", "Gemüse", "Wurzel/Knolle"].includes(x.category);

    let allowedStatus = needsTrustedBase
      ? isTrustedBase(x)
      : canCombine(x);

    return (
      (normalMealMatch || flexibleCerealMatch) &&
      allowedStatus &&
      !x.allergenGroup &&
      !(isMilkProductFood(f) && isMeatOrFish(x)) &&
      !(isMeatOrFish(f) && isMilkProductFood(x)) &&
      x.id !== f.id &&
      x.category !== "Kraut/Gewürz" &&
      x.category !== "Fett"
    );
  });

  let wanted = [];
  if (f.category === "Getreide/Stärke") {
    wanted =
      meal === "breakfast"
        ? ["Obst", "Gemüse", "Wurzel/Knolle"]
        : ["Gemüse", "Wurzel/Knolle", "Obst"];
  } else if (meal === "breakfast") {
    if (f.category === "Obst")
      wanted = ["Getreide/Stärke", "Milchprodukt"];
    else
      wanted = ["Obst", "Getreide/Stärke"];
  } else if (
    ["Fleisch", "Fisch", "Meeresfrucht", "Hülsenfrucht"].includes(
      f.category,
    )
  ) {
    wanted = ["Gemüse", "Wurzel/Knolle", "Getreide/Stärke"];
  } else if (
    ["Gemüse", "Wurzel/Knolle"].includes(f.category)
  ) {
    wanted = ["Getreide/Stärke", "Gemüse", "Wurzel/Knolle"];
  } else {
    wanted = ["Gemüse", "Getreide/Stärke", "Obst", "Wurzel/Knolle"];
  }

  pool.sort(
    (a, b) =>
      culinaryCompatibilityScore(f, a, meal) - culinaryCompatibilityScore(f, b, meal) ||
      (wanted.includes(a.category) ? -1 : 0) -
        (wanted.includes(b.category) ? -1 : 0) ||
      usageCount(a.id) - usageCount(b.id) ||
      a.priority - b.priority,
  );
  return pool[0] || null;
}
function ironCompanion(f, meal, on, exclude = []) {
  if (meal === "breakfast" || AMOUNT_LEVELS[currentAmountLevel()].rank < 1 || f.ironRich || isMilkProductFood(f) || mealContainsMilkProduct(exclude))
    return null;
  let pool = state.foods.filter(
    (x) =>
      eligible(x, meal, on) &&
      rank(x) >= 2 &&
      x.ironRich &&
      !exclude.includes(x.id) &&
      !x.allergenGroup,
  );
  pool.sort(
    (a, b) => usageCount(a.id) - usageCount(b.id) || a.priority - b.priority,
  );
  return pool[0] || null;
}
function introductionCandidate(meal, on, ctx, exclude = []) {
  let key = on + "|" + meal,
    override = state.overrides[key];
  if (override) {
    let f = food(override);
    if (f && eligible(f, meal, on))
      return { f, type: rank(f) >= 2 ? "bekannt" : "manuell" };
  }
  let baseExists = !!knownBase(meal, exclude);
  let pool = state.foods.filter(
    (f) =>
      eligible(f, meal, on) &&
      !exclude.includes(f.id) &&
      !ctx.reserved.has(f.id),
  );
  let retries = pool.filter(
    (f) => rank(f) === 1 || lastOutcome(f.id) === "not_accepted",
  );
  retries.sort((a, b) => effectivePriority(a, on) - effectivePriority(b, on));
  if (retries.length) {
    let f = retries[0];
    return {
      f,
      type: eatenExposureCount(f.id) >= 1
        ? "bekannt kombinieren"
        : "gezielt wiederholen",
    };
  }
  let due = pool.filter((f) => dueAllergen(f, on) && baseExists);
  due.sort((a, b) =>
    (lastDate(a.id, true) || "").localeCompare(lastDate(b.id, true)),
  );
  if (due.length) return { f: due[0], type: "Allergen wiederholen" };
  let fresh = pool.filter(
    (f) => rank(f) === 0 && (!f.allergenGroup || baseExists),
  );
  fresh.sort((a, b) => effectivePriority(a, on) - effectivePriority(b, on));
  return fresh.length ? { f: fresh[0], type: fresh[0].allergenGroup ? "Allergen einführen" : "neu" } : null;
}
function knownCandidate(meal, on, ctx, exclude = []) {
  let key = on + "|" + meal,
    override = state.overrides[key];
  if (override) {
    let f = food(override);
    if (f && eligible(f, meal, on))
      return {
        f,
        type: canCombine(f) ? "bekannt / kombiniert" : "manuell",
      };
  }

  let pool = state.foods.filter(
    (f) =>
      eligible(f, meal, on) &&
      canCombine(f) &&
      !(ctx.fullMilkDates?.has(on) && isMilkProductFood(f)) &&
      !exclude.includes(f.id),
  );

  function recentFocusPenalty(f) {
    let last = ctx.lastFocus?.get(f.id);
    if (!last) return 0;
    let distance = diffDays(on, last);
    if (distance <= 0) return 500;
    if (distance === 1) return 250;
    if (distance === 2) return 80;
    return 0;
  }
  function inventoryPreference(f) {
    if (!state.settings.preferInventoryInPlan) return 0;
    let reserved = ctx.inventoryReserved?.get(f.id) || 0;
    return inventoryPortions(f.id) > reserved ? -160 : 0;
  }

  pool.sort(
    (a, b) =>
      recentFocusPenalty(a) - recentFocusPenalty(b) ||
      inventoryPreference(a) - inventoryPreference(b) ||
      (ctx.plannedUse.get(a.id) || 0) - (ctx.plannedUse.get(b.id) || 0) ||
      usageCount(a.id) - usageCount(b.id) ||
      effectivePriority(a, on) - effectivePriority(b, on),
  );

  if (pool.length)
    return {
      f: pool[0],
      type:
        state.settings.preferInventoryInPlan &&
        inventoryPortions(pool[0].id) >
          (ctx.inventoryReserved?.get(pool[0].id) || 0)
          ? "bekannt / Vorrat"
          : isTrustedBase(pool[0])
            ? "bekannt / Vorrat"
            : "bekannt kombinieren",
    };

  let last = [...ctx.introduced]
    .reverse()
    .map((id) => food(id))
    .find((f) => f && eligible(f, meal, on));
  return last ? { f: last, type: "nach Einführung" } : null;
}
function recipeStockCandidate(meal, on, ctx) {
  if (!state.settings.preferInventoryInPlan) return null;
  let states = recipeStates()
    .filter(
      (r) =>
        r.unlocked &&
        r.freezable &&
        recipeSuitableForMeal(r, meal) &&
        !(r.milkMeal === "full" && recipeContainsMeatOrFish(r)) &&
        !(r.milkMeal === "full" && ctx.fullMilkDates?.has(on)) &&
        recipeInventoryPortions(r.name) >
          (ctx.recipeReserved?.get(r.name) || 0),
    )
    .sort((a, b) => {
      let ba = oldestRecipeBatch(a.name);
      let bb = oldestRecipeBatch(b.name);
      return String(ba?.frozenDate || "9999").localeCompare(
        String(bb?.frozenDate || "9999"),
      );
    });
  return states[0] || null;
}
function snackRecipeCandidate(on, ctx) {
  let candidates = recipeStates()
    .filter((r) =>
      r.unlocked &&
      recipeSuitableForMeal(r, "snack") &&
      !(r.milkMeal === "full" && recipeContainsMeatOrFish(r)) &&
      !(r.milkMeal === "full" && ctx.fullMilkDates?.has(on))
    )
    .sort((a, b) => {
      let aStock = recipeInventoryPortions(a.name) > (ctx.recipeReserved?.get(a.name) || 0) ? 0 : 1;
      let bStock = recipeInventoryPortions(b.name) > (ctx.recipeReserved?.get(b.name) || 0) ? 0 : 1;
      let aUsed = ctx.recipePlannedUse?.get(a.name) || 0;
      let bUsed = ctx.recipePlannedUse?.get(b.name) || 0;
      return aStock - bStock || aUsed - bUsed || a.name.localeCompare(b.name, "de");
    });
  return candidates[0] || null;
}
function buildSnackRecipeMeal(recipe, on, ctx) {
  if (!recipe) return null;
  let ids = recipeFoodIds(recipe);
  if (!ids.length) return null;
  let batch = oldestRecipeBatch(recipe.name);
  let meal = applyPlannedMealAmounts({
    meal: "snack",
    active: true,
    focusId: ids[0],
    foodIds: ids,
    baseFoodIds: ids,
    sampleFoodIds: [],
    optionalAddons: [],
    inventoryFoodIds: [],
    recipeName: recipe.name,
    recipeInventoryId: batch?.id || "",
    milkMeal: recipe.milkMeal || "",
    type: batch ? "Rezeptvorrat" : "Snack-Rezept",
    note: "Snack nach Hunger- und Sättigungssignalen anbieten; die Phase gibt keine Grammmenge vor.",
  });
  ctx.recipePlannedUse?.set(recipe.name, (ctx.recipePlannedUse.get(recipe.name) || 0) + 1);
  reserveMealInventory(meal, ctx);
  return meal;
}
function reserveMealInventory(meal, ctx) {
  if (meal.recipeName) {
    let currentItem = state.inventory.find(
      (i) =>
        i.id === meal.recipeInventoryId &&
        i.kind === "recipe" &&
        Number(i.portions) > 0,
    );
    if (!currentItem) {
      let replacement = oldestRecipeBatch(meal.recipeName);
      meal.recipeInventoryId = replacement?.id || "";
    }
    if (meal.recipeInventoryId) {
      ctx.recipeReserved.set(
        meal.recipeName,
        (ctx.recipeReserved.get(meal.recipeName) || 0) + 1,
      );
    }
    meal.inventoryFoodIds = [];
    return meal;
  }
  meal.inventoryFoodIds = [];
  if (!state.settings.preferInventoryInPlan) return meal;
  for (let id of meal.foodIds || []) {
    let reserved = ctx.inventoryReserved.get(id) || 0;
    if (inventoryPortions(id) > reserved) {
      meal.inventoryFoodIds.push(id);
      ctx.inventoryReserved.set(id, reserved + 1);
    }
  }
  return meal;
}
function planLockKey(date, meal) {
  return `${date}|${meal}`;
}
function isAutoLockDate(date) {
  return date >= today() && date <= addDays(today(), 2);
}
function mealSnapshot(date, meal, generated, mode = "manual") {
  if (!generated || !generated.active || generated.empty || !generated.focusId)
    return null;
  let expectedIds = [...new Set(generated.foodIds || [])];
  let storedAmounts = generated.ingredientAmounts || {};
  let storedKeys = Object.keys(storedAmounts).filter((id) => Number(storedAmounts[id]) > 0);
  let storedAmountsMatch = expectedIds.length === storedKeys.length &&
    expectedIds.every((id) => storedKeys.includes(id) && Number.isFinite(Number(storedAmounts[id])) && Number(storedAmounts[id]) > 0);
  let allocation = storedAmountsMatch
    ? {
        targetGrams: Number.isFinite(Number(generated.portionTargetGrams)) ? Number(generated.portionTargetGrams) : (meal === "snack" ? 0 : phasePortion()),
        sampleGrams: Number(generated.sampleTargetGrams) || 0,
        totalOfferedGrams: Number.isFinite(Number(generated.totalOfferedGrams)) ? Number(generated.totalOfferedGrams) : (meal === "snack" ? 0 : (Number(generated.portionTargetGrams) || phasePortion())),
        amounts: { ...storedAmounts },
      }
    : plannedMealAmounts(generated);
  return {
    date,
    meal,
    focusId: generated.focusId,
    foodIds: [...(generated.foodIds || [])],
    baseFoodIds: [...(generated.baseFoodIds || [])],
    sampleFoodIds: [...(generated.sampleFoodIds || [])],
    foodRoles: { ...(generated.foodRoles || foodRolesFor(generated.foodIds || [], generated.baseFoodIds || [], generated.sampleFoodIds || [])) },
    optionalAddons: [...(generated.optionalAddons || [])],
    inventoryFoodIds: [...(generated.inventoryFoodIds || [])],
    recipeName: generated.recipeName || "",
    recipeInventoryId: generated.recipeInventoryId || "",
    milkMeal: generated.milkMeal || mealMilkLevel(generated),
    type: generated.type,
    note: generated.note,
    manualAdded: !!generated.manualAdded,
    mode,
    portionTargetGrams: allocation.targetGrams,
    sampleTargetGrams: allocation.sampleGrams,
    totalOfferedGrams: allocation.totalOfferedGrams,
    ingredientAmounts: { ...allocation.amounts },
    createdAt: generated.createdAt || new Date().toISOString(),
  };
}
function lockSnapshot(date, meal) {
  let manual = manualMealFor(date, meal);
  if (manual) return mealSnapshot(date, meal, manual, "manual");
  let generated = buildDaysUnlocked(date, 1)[0]?.meals.find(
    (m) => m.meal === meal,
  );
  return mealSnapshot(date, meal, generated, "manual");
}
function validPlanLock(lock) {
  if (!lock || !food(lock.focusId)) return false;
  if (status(food(lock.focusId)) === "Pausiert") return false;
  return (lock.foodIds || []).every((id) => {
    let f = food(id);
    return !!f && (f.active || !!state.inactivePlanKept?.[id]);
  });
}
function lockedMeal(date, meal) {
  let key = planLockKey(date, meal);
  let lock = state.planLocks?.[key];
  if (!validPlanLock(lock)) {
    if (lock) delete state.planLocks[key];
    return null;
  }
  return {
    meal,
    active: true,
    focusId: lock.focusId,
    foodIds: [...lock.foodIds],
    baseFoodIds: [...(lock.baseFoodIds || [])],
    sampleFoodIds: [...(lock.sampleFoodIds || [])],
    foodRoles: { ...(lock.foodRoles || foodRolesFor(lock.foodIds || [], lock.baseFoodIds || [], lock.sampleFoodIds || [])) },
    optionalAddons: [...(lock.optionalAddons || [])],
    inventoryFoodIds: [...(lock.inventoryFoodIds || [])],
    recipeName: lock.recipeName || "",
    recipeInventoryId: lock.recipeInventoryId || "",
    type: lock.type || "bekannt",
    note: lock.note || "Diese Mahlzeit ist fest eingeplant.",
    manualAdded: !!lock.manualAdded,
    portionTargetGrams: Number.isFinite(Number(lock.portionTargetGrams)) ? Number(lock.portionTargetGrams) : (meal === "snack" ? 0 : phasePortion()),
    sampleTargetGrams: Number(lock.sampleTargetGrams) || 0,
    totalOfferedGrams: Number.isFinite(Number(lock.totalOfferedGrams)) ? Number(lock.totalOfferedGrams) : (meal === "snack" ? 0 : (Number(lock.portionTargetGrams) || phasePortion())),
    ingredientAmounts: { ...(lock.ingredientAmounts || plannedMealAmounts(lock).amounts) },
    lockedMode: lock.mode || "manual",
    createdAt: lock.createdAt,
  };
}
function ensureAutoLocks(days) {
  state.planLocks ||= {};
  state.autoLockExcluded ||= {};
  let changed = false;
  for (let [key, lock] of Object.entries(state.planLocks)) {
    let date = key.split("|")[0];
    if (lock.mode === "auto" && !lock.followUpFoodId && !isAutoLockDate(date)) {
      delete state.planLocks[key];
      changed = true;
    }
    if (date < today()) delete state.autoLockExcluded[key];
  }
  for (let day of days) {
    if (!isAutoLockDate(day.date)) continue;
    for (let meal of day.meals) {
      let key = planLockKey(day.date, meal.meal);
      if (
        meal.active &&
        !meal.empty &&
        meal.focusId &&
        !meal.manualAdded &&
        !mealIsCompleted(day.date, meal.meal) &&
        !state.planLocks[key] &&
        !state.autoLockExcluded[key]
      ) {
        state.planLocks[key] = mealSnapshot(day.date, meal.meal, meal, "auto");
        changed = true;
      }
    }
  }
  if (changed) save();
  return changed;
}
function toggleMealLock(date, meal, shownMeal = null) {
  let key = planLockKey(date, meal);
  let existing = state.planLocks?.[key];
  state.planLocks ||= {};
  state.autoLockExcluded ||= {};
  if (existing) {
    if (state.manualMeals?.[key]?.manualAdded) {
      showToast("Manuell hinzugefügte Mahlzeiten bleiben fest eingeplant.");
      return;
    }
    delete state.planLocks[key];
    if (isAutoLockDate(date)) state.autoLockExcluded[key] = true;
    showToast(
      existing.mode === "auto"
        ? "Feste Planung aufgehoben."
        : "Schutz der Mahlzeit aufgehoben.",
    );
  } else {
    let snapshot = shownMeal?.focusId
      ? mealSnapshot(date, meal, shownMeal, "manual")
      : lockSnapshot(date, meal);
    if (!snapshot) return;
    snapshot.mode = "manual";
    state.planLocks[key] = snapshot;
    delete state.autoLockExcluded[key];
    showToast("Mahlzeit vor automatischen Änderungen geschützt.");
  }
  save();
  renderAll();
}
function clearAutomaticPlanState(from = state.settings.planFrom || today(), days = 7) {
  state.planLocks ||= {};
  state.overrides ||= {};
  state.autoLockExcluded ||= {};
  let end = addDays(from, Math.max(0, days - 1));
  let inRange = (key) => { let date = key.split("|")[0]; return date >= from && date <= end; };
  for (let [key, lock] of Object.entries(state.planLocks)) {
    if (!inRange(key)) continue;
    if (lock.mode === "auto" && !lock.followUpFoodId) delete state.planLocks[key];
  }
  for (let [key] of Object.entries(state.overrides)) {
    if (!inRange(key)) continue;
    let lock = state.planLocks[key];
    if (!lock || (lock.mode === "auto" && !lock.followUpFoodId)) delete state.overrides[key];
  }
  for (let key of Object.keys(state.autoLockExcluded)) if (inRange(key)) delete state.autoLockExcluded[key];
}
function clearAutomaticLocks() {
  let from = state.settings.planFrom || today();
  clearAutomaticPlanState(from, 7);
  save();
  renderAll();
  showToast("Der sichtbare Bereich wurde neu geplant; manuell geschützte Mahlzeiten und Wiedervorlagen bleiben erhalten.");
}
function rebuildVisiblePlan(releaseManualLocks = false) {
  let from = state.settings.planFrom || today();
  let end = addDays(from, 6);
  clearAutomaticPlanState(from, 7);
  if (releaseManualLocks) {
    for (let [key, lock] of Object.entries(state.planLocks || {})) {
      let date = key.split("|")[0];
      if (date < from || date > end || completedLog(date, key.split("|")[1])) continue;
      if (lock.followUpFoodId || state.manualMeals?.[key]?.manualAdded) continue;
      delete state.planLocks[key];
      delete state.overrides?.[key];
    }
  }
  save();
  renderAll();
}
function openFullPlanRebuild() {
  let from = state.settings.planFrom || today();
  openGeneric("Sichtbare Woche vollständig neu planen", `<p>Neu erstellt wird der Zeitraum <b>${nice(from, true)} bis ${nice(addDays(from, 6), true)}</b>.</p><div class="notice olive"><b>Erhalten bleiben immer:</b> protokollierte Mahlzeiten, manuell hinzugefügte Mahlzeiten und Wiedervorlagen.</div><div class="stack-actions"><button class="btn secondary full" id="rebuildKeepLocks">Neu planen · geschützte Mahlzeiten behalten</button><button class="btn secondary full" id="rebuildReleaseLocks">Neu planen · lösbare feste Planungen aufheben</button></div>`);
  document.getElementById("rebuildKeepLocks").onclick = () => { closeGeneric(); rebuildVisiblePlan(false); showToast("Woche vollständig neu geplant; manuell geschützte Mahlzeiten wurden behalten."); };
  document.getElementById("rebuildReleaseLocks").onclick = () => { closeGeneric(); rebuildVisiblePlan(true); showToast("Woche vollständig neu geplant; lösbare feste Planungen wurden aufgehoben."); };
}
function buildDay(date, index, ctx) {
  let meals = [];
  let activeMeals = ["breakfast", "lunch", "snack", "dinner"].filter((m) => activeMeal(m, date) || !!state.manualMeals?.[manualMealKey(date, m)]);
  // A later fixed/manual milk meal must already protect earlier automatic meals on the same day.
  let hasPresetFullMilk = ["breakfast", "lunch", "snack", "dinner"].some((meal) => {
    let preset = manualMealFor(date, meal) || lockedMeal(date, meal);
    return mealMilkLevel(preset) === "full";
  });
  if (hasPresetFullMilk) ctx.fullMilkDates?.add(date);
  let forcedIntroMeal = activeMeals.find((m) => { let f = food(state.overrides[date + "|" + m]); return f && rank(f) < 2; }) || "";
  let introDue = !state.deferred?.[date] && (forcedIntroMeal || index % Math.max(1, Number(state.settings.newFoodEvery) || 2) === 0);
  let introAssigned = false;
  let used = [];
  for (let meal of ["breakfast", "lunch", "snack", "dinner"]) {
    let manual = manualMealFor(date, meal);
    if (manual) {
      reserveMealInventory(manual, ctx);
      if (mealMilkLevel(manual) === "full") ctx.fullMilkDates?.add(date);
      meals.push(manual); used.push(manual.focusId); continue;
    }
    if (!activeMeals.includes(meal)) { meals.push({ meal, active: false }); continue; }
    let fixed = lockedMeal(date, meal);
    if (fixed) {
      reserveMealInventory(fixed, ctx);
      if (mealMilkLevel(fixed) === "full") ctx.fullMilkDates?.add(date);
      meals.push(fixed); used.push(fixed.focusId);
      ctx.plannedUse.set(fixed.focusId, (ctx.plannedUse.get(fixed.focusId) || 0) + 1); ctx.lastFocus.set(fixed.focusId, date);
      if (["neu", "gezielt wiederholen", "Allergen einführen", "Allergen wiederholen", "manuell"].includes(fixed.type)) { introAssigned = true; ctx.reserved.add(fixed.focusId); ctx.introduced.push(fixed.focusId); }
      continue;
    }
    if (meal === "snack") {
      let snack = buildSnackRecipeMeal(snackRecipeCandidate(date, ctx), date, ctx);
      if (!snack) { meals.push({ meal, active: true, empty: true }); continue; }
      if (mealMilkLevel(snack) === "full") ctx.fullMilkDates?.add(date);
      meals.push(snack); used.push(snack.focusId);
      continue;
    }
    let c = null;
    if (introDue && !introAssigned && (!forcedIntroMeal || meal === forcedIntroMeal)) c = introductionCandidate(meal, date, ctx, used);
    if (c && ["neu", "gezielt wiederholen", "bekannt kombinieren", "Allergen einführen", "Allergen wiederholen", "manuell"].includes(c.type)) {
      introAssigned = true; ctx.reserved.add(c.f.id); ctx.introduced.push(c.f.id);
    }
    if (!c && (!introDue || introAssigned)) {
      let recipe = recipeStockCandidate(meal, date, ctx);
      if (recipe) {
        let batch = oldestRecipeBatch(recipe.name), ids = recipeFoodIds(recipe);
        let recipeMeal = applyPlannedMealAmounts({ meal, active: true, focusId: ids[0], foodIds: ids, baseFoodIds: ids, sampleFoodIds: [], optionalAddons: [], inventoryFoodIds: [], recipeName: recipe.name, recipeInventoryId: batch?.id || "", milkMeal: recipe.milkMeal || "", type: "Rezeptvorrat", note: "Eine vorbereitete Portion aus dem Gefriervorrat verwenden." });
        reserveMealInventory(recipeMeal, ctx);
        if (recipe.milkMeal === "full") ctx.fullMilkDates?.add(date);
        meals.push(recipeMeal); used.push(recipeMeal.focusId); continue;
      }
    }
    if (!c) c = knownCandidate(meal, date, ctx, used);
    if (!c && introDue && !introAssigned && (!forcedIntroMeal || meal === forcedIntroMeal)) {
      c = introductionCandidate(meal, date, ctx, used);
      if (c) { introAssigned = true; ctx.reserved.add(c.f.id); ctx.introduced.push(c.f.id); }
    }
    if (!c) { meals.push({ meal, active: true, empty: true }); continue; }
    let f = c.f;
    used.push(f.id); ctx.plannedUse.set(f.id, (ctx.plannedUse.get(f.id) || 0) + 1); ctx.lastFocus.set(f.id, date);
    let introduction = ["neu", "gezielt wiederholen", "Allergen einführen", "Allergen wiederholen", "manuell"].includes(c.type) && !isTrustedBase(f);
    let base = companionFor(f, meal, date, c.type);
    let companions = enforceSingleStarch(f, base ? [base] : []);
    let ids = introduction ? companions.map((x) => x.id) : [f.id, ...companions.map((x) => x.id)];
    if (introduction && !ids.includes(f.id)) ids.push(f.id);
    let iron = introduction ? null : ironCompanion(f, meal, date, ids);
    if (iron && !ids.includes(iron.id) && !(isStarchyFood(iron) && ids.some((id) => isStarchyFood(food(id))))) ids.push(iron.id);
    if (combinationPaused(ids, date)) {
      let alternatives = state.foods
        .filter((candidate) => eligible(candidate, meal, date) && isTrustedBase(candidate) && candidate.id !== f.id && !companions.some((x) => x.id === candidate.id))
        .filter((candidate) => !combinationPaused([candidate.id, f.id], date))
        .filter((candidate) => !(isStarchyFood(candidate) && isStarchyFood(f)))
        .sort((a, b) => usageCount(a.id) - usageCount(b.id) || a.priority - b.priority);
      if (introduction && alternatives.length) {
        companions = [alternatives[0]];
        ids = [alternatives[0].id, f.id];
      } else {
        let fallback = knownBase(meal, [f.id]);
        if (fallback) {
          f = fallback;
          c = { f, type: "bekannt" };
          ids = [fallback.id];
          companions = [];
          introduction = false;
        } else {
          ids = [f.id];
          companions = [];
        }
      }
    }
    let optionalAddons = [];
    if (!introduction && meal !== "breakfast" && AMOUNT_LEVELS[currentAmountLevel()].rank >= 1 && !mealContainsMilkProduct(ids)) { let oil = food("rapsoel"); if (oil?.active) optionalAddons.push(oil.id); }
    let baseFoodIds = introduction ? companions.map((x) => x.id) : ids.filter((id) => id !== f.id);
    let sampleFoodIds = introduction ? [f.id] : [];
    let note = c.type === "neu" ? "Neue Einführung separat oder in kleiner Menge mit der sicheren Basis anbieten." : c.type === "gezielt wiederholen" ? "Wiederholung nach Pause erneut klein und getrennt bewerten." : c.type === "Allergen wiederholen" ? "Allergen mit bekannter Basis gezielt wiederholen." : "Bekannte Lebensmittel sinnvoll rotieren; Vorrat bevorzugt nutzen.";
    let generated = applyPlannedMealAmounts({ meal, active: true, focusId: f.id, foodIds: ids, baseFoodIds, sampleFoodIds, optionalAddons, milkMeal: mealContainsMilkProduct(ids) ? (introduction ? "small" : "full") : "", type: c.type, note });
    if (mealMilkLevel(generated) === "full") ctx.fullMilkDates?.add(date);
    reserveMealInventory(generated, ctx); meals.push(generated);
  }
  return { date, index, meals, introDue, introAssigned };
}
function freshPlanContext() {
  return {
    reserved: new Set(),
    introduced: [],
    plannedUse: new Map(),
    lastFocus: new Map(),
    inventoryReserved: new Map(),
    recipeReserved: new Map(),
    recipePlannedUse: new Map(),
    fullMilkDates: new Set(),
  };
}
function buildDaysUnlocked(from, n = 7) {
  let savedLocks = state.planLocks;
  state.planLocks = {};
  let ctx = freshPlanContext();
  let arr = [];
  for (let i = 0; i < n; i++) arr.push(buildDay(addDays(from, i), i, ctx));
  state.planLocks = savedLocks;
  return arr;
}
function buildDays(from, n = 7, applyAutoLocks = true) {
  let ctx = freshPlanContext();
  let arr = [];
  for (let i = 0; i < n; i++) arr.push(buildDay(addDays(from, i), i, ctx));
  if (applyAutoLocks && ensureAutoLocks(arr)) return buildDays(from, n, false);
  return arr;
}
function mealName(m) {
  return { breakfast: "Frühstück", snack: "Snack", lunch: "Mittag", dinner: "Abendessen" }[m] || "Mahlzeit";
}
function outcomeLabel(o) {
  return ({ not_offered: "Nicht angeboten", not_accepted: "Nicht angenommen", tried: "Probiert", eaten: "Gegessen", reaction: "Reaktion" }[o] || o);
}
function phaseText() {
  return PHASES[currentPhase()].label;
}
function uniqueTriedCount() {
  return new Set(
    state.foods
      .filter((f) => f.count100 && rank(f) >= 1)
      .map((f) => canonicalId(f.id, f.name)),
  ).size;
}
function uniqueEligibleCount() {
  return new Set(
    state.foods
      .filter((f) => f.count100)
      .map((f) => canonicalId(f.id, f.name)),
  ).size;
}
function focusRole(type) {
  return ({
    neu: "Neu kennenlernen",
    "gezielt wiederholen": "Gezielt wiederholen",
    "Allergen einführen": "Allergen einführen",
    "Allergen wiederholen": "Allergen wiederholen",
    manuell: "Manuell gewählt",
    "bekannt / Vorrat": "Bekannt kombinieren",
    "bekannt / kombiniert": "Bekannt kombinieren",
    "bekannt kombinieren": "Bekannt kombinieren",
    "nach Einführung": "Gezielt wiederholen",
    bekannt: "Bekannt kombinieren",
    Rezeptvorrat: "Bekannt kombinieren",
  })[type] || "Heute geplant";
}
function naturalFoodList(names) {
  let clean = (names || []).filter(Boolean);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} und ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} und ${clean.at(-1)}`;
}
function mealTitleMainRank(item) {
  return ({
    Fleisch: 100,
    Fisch: 95,
    Meeresfrucht: 94,
    Ei: 90,
    Hülsenfrucht: 85,
    Milchprodukt: 80,
  })[item?.category] || 0;
}
function naturalMealFoodTitle(items) {
  let all = (items || []).filter(Boolean);
  if (!all.length) return "Mahlzeit";
  if (all.length === 1) return all[0].name;
  let mainIndex = 0;
  for (let i = 1; i < all.length; i++) {
    if (mealTitleMainRank(all[i]) > mealTitleMainRank(all[mainIndex])) mainIndex = i;
  }
  let main = all[mainIndex];
  let companions = all.filter((_, i) => i !== mainIndex).map((x) => x.name);
  return `${main.name} mit ${naturalFoodList(companions)}`;
}
function dishTitle(m) {
  if (m.recipeName) return m.recipeName;
  let sample = (m.sampleFoodIds || []).map(food).filter(Boolean);
  let base = (m.baseFoodIds || []).map(food).filter(Boolean);
  if (sample.length) {
    let sampleName = naturalFoodList(sample.map((x) => x.name));
    let role = plannerLearningRoleLabel(sample[0], m.type || "");
    if (!base.length) return `${sampleName} zur ${role}`;
    return `${naturalMealFoodTitle(base)} mit ${sampleName} zur ${role}`;
  }
  let all = (m.foodIds || []).map(food).filter(Boolean);
  if (!all.length) return "Mahlzeit";
  let fruit = all.find((x) => x.category === "Obst");
  let grain = all.find((x) => x.category === "Getreide/Stärke");
  let egg = all.find((x) => x.category === "Ei");
  if (m.meal === "breakfast" && all.length === 2 && egg && fruit) return `Eierspeise mit ${fruit.name}`;
  if (m.meal === "breakfast" && all.length === 2 && fruit && grain) return `${fruit.name}-${grain.name}-Brei`;
  return naturalMealFoodTitle(all);
}

function mealRolesHtml(m) {
  let f = food(m.focusId),
    companions = (m.foodIds || [])
      .filter((id) => id !== m.focusId)
      .map(food)
      .filter(Boolean),
    addons = (m.optionalAddons || []).map(food).filter(Boolean);
  let rows = `<div class="role-row"><div class="role-label">${esc(focusRole(m.type))}</div><div class="role-value">${esc(f?.name || "")}</div></div>`;
  if (companions.length) {
    let introduction =
      ["neu", "gezielt wiederholen", "Allergen wiederholen", "manuell"].includes(m.type) &&
      !isTrustedBase(f);
    let companionLabel = introduction
      ? "Verträgliche Basis"
      : "Bekannte Kombination";
    rows += `<div class="role-row"><div class="role-label">${companionLabel}</div><div class="role-value">${companions.map((x) => esc(x.name)).join(" + ")}</div></div>`;
  }
  let addonLine = addons.length
    ? `<div class="optional-addon-line"><span>Optional:</span> ${addons
        .map((x) => esc(x.name))
        .join(" + ")}${addons.some((x) => normalizeName(x.name) === "rapsoel") ? " nach dem Erwärmen" : ""}</div>`
    : "";
  return `<div class="role-list">${rows}</div>${addonLine}`;
}
function mealExplanation(m) {
  let f = food(m.focusId), companions = (m.foodIds || []).filter((id) => id !== m.focusId).map(food).filter(Boolean), addons = (m.optionalAddons || []).map(food).filter(Boolean);
  let parts = [];
  if (m.type === "neu") parts.push(`${f.name} ist heute neu.`);
  else if (m.type === "gezielt wiederholen") parts.push(`${f.name} wird gezielt noch einmal angeboten.`);
  else if (m.type === "bekannt kombinieren" || m.type === "bekannt / kombiniert")
    parts.push(`${f.name} wurde bereits mindestens einmal problemlos gegessen und darf heute kombiniert werden.`);
  else if (m.type === "nach Einführung")
    parts.push(`${f.name} war zuletzt neu. Wenn es problemlos gegessen wurde, darf es heute kombiniert werden; sonst noch einmal einfach anbieten.`);
  else if (m.type === "Allergen wiederholen") parts.push(`${f.name} ist heute als Allergen-Wiederholung geplant.`);
  else parts.push(`${f.name} ist heute als bekanntes Lebensmittel geplant.`);
  if (companions.length) {
    let trusted =
      ["neu", "gezielt wiederholen", "Allergen wiederholen", "manuell"].includes(m.type) &&
      !isTrustedBase(f);
    parts.push(
      trusted
        ? `${companions.map((x) => x.name).join(" und ")} ${companions.length === 1 ? "ist" : "sind"} die bereits verträgliche Basis.`
        : `${companions.map((x) => x.name).join(" und ")} wurde bereits problemlos gegessen und ergänzt die Mahlzeit.`,
    );
  }
  if (addons.length) parts.push(`${addons.map((x) => x.name).join(" und ")} ist nur eine optionale Zubereitungszugabe und wird nicht automatisch als gegessen protokolliert.`);
  return parts.join(" ");
}

function displayStatus(f) {
  return ({ Offen: "Noch offen", "Verträgliche Basis": "Vertragen" }[status(f)] || status(f));
}
function offeredCount(foodId) {
  return logsFor(foodId).filter((log) => outcomeForFood(log, foodId) !== "not_offered").length;
}
function isFoodUnavailable(foodId) {
  return state.shoppingHints?.[foodId]?.status === "needed" && !state.pantry?.[foodId];
}
function eligible(f, meal, on) {
  return eligibleCore(f, meal, on) && !isFoodUnavailable(f.id);
}

function roleIdsFromPlan(plan) {
  let ids = [...new Set(plan?.foodIds || [])];
  let samples = [...new Set((plan?.sampleFoodIds || []).filter((id) => ids.includes(id)))];
  let bases = [...new Set((plan?.baseFoodIds || []).filter((id) => ids.includes(id) && !samples.includes(id)))];
  if (!bases.length && samples.length) bases = ids.filter((id) => !samples.includes(id));
  if (!samples.length && plan?.entryType === "sample") samples = [...ids];
  if (!bases.length && !samples.length) bases = [...ids];
  return { ids, samples, bases };
}
function inferEntryType(plan) {
  let { ids, samples, bases } = roleIdsFromPlan(plan || {});
  return plan?.entryType || (ids.length && samples.length === ids.length && bases.length === 0 ? "sample" : "meal");
}
function foodRolesFor(ids, bases, samples) {
  return Object.fromEntries(ids.map((id) => [id, samples.includes(id) ? "sample" : bases.includes(id) ? "base" : "component"]));
}
function manualMealRoleInfo(foodOrId, meal, on = today(), context = {}) {
  let f = typeof foodOrId === "string" ? food(foodOrId) : foodOrId;
  if (!f) return { role: "excluded", reason: "missing" };
  let recipeContext = !!context.recipeName || context.recipe === true;
  if (!f.active) return { role: "excluded", reason: "inactive", food: f };
  if (!recipeContext && !(f.meals || []).includes(meal)) return { role: "excluded", reason: "meal", food: f };
  if (!recipeContext && f.category === "Fett") return { role: "excluded", reason: "category", food: f };
  if (isFoodUnavailable(f.id)) return { role: "excluded", reason: "unavailable", food: f };
  if (status(f) === "Pausiert") return { role: "sample", reason: "paused_manual", manualOnly: true, food: f };
  if (!recipeContext && !eligible(f, meal, on)) return { role: "excluded", reason: "unavailable", food: f };
  if (isTrustedBase(f)) return { role: "base", reason: "trusted", food: f };
  if (canCombine(f)) return { role: "component", reason: "known_component", food: f };
  return { role: "sample", reason: "not_trusted", food: f };
}
function manualMealRoleState(plan = {}) {
  let roleMap = plan.foodRoles || {};
  let ids = [...new Set([
    ...(plan.foodIds || []),
    ...(plan.baseFoodIds || []),
    ...(plan.sampleFoodIds || []),
    ...Object.keys(roleMap),
  ])].filter((id) => !!food(id));
  let samples = [...new Set([
    ...(plan.sampleFoodIds || []),
    ...ids.filter((id) => roleMap[id] === "sample"),
  ])].filter((id) => ids.includes(id));
  let bases = [...new Set([
    ...(plan.baseFoodIds || []),
    ...ids.filter((id) => roleMap[id] === "base"),
  ])].filter((id) => ids.includes(id) && !samples.includes(id));
  let components = [...new Set(
    ids.filter((id) => roleMap[id] === "component"),
  )].filter((id) => !bases.includes(id) && !samples.includes(id));
  // Alte Datensätze ohne Rollenangaben bleiben wie bisher Hauptbasis.
  for (let id of ids) if (!bases.includes(id) && !samples.includes(id) && !components.includes(id)) bases.push(id);
  return {
    ids,
    bases,
    samples,
    components,
    foodRoles: foodRolesFor(ids, bases, samples),
    focusId: ids.includes(plan.focusId) ? plan.focusId : (samples[0] || components[0] || bases[0] || ids[0] || ""),
  };
}
function manualMealValidation(plan, meal, on = today()) {
  let roles = manualMealRoleState(plan || {});
  let infos = Object.fromEntries(roles.ids.map((id) => [id, manualMealRoleInfo(id, meal, on, { recipeName: plan?.recipeName || "" })]));
  let excludedIds = roles.ids.filter((id) => infos[id].role === "excluded");
  let unsafeBaseIds = roles.bases.filter((id) => infos[id].role !== "base" && infos[id].role !== "excluded");
  let unsafeComponentIds = roles.components.filter((id) => infos[id].role === "sample");
  let unsafeIds = roles.ids.filter((id) => infos[id].role === "sample");
  let multipleUnsafeIds = unsafeIds.length > 1 ? unsafeIds : [];
  let messages = [];
  if (!roles.ids.length) messages.push("Bitte mindestens ein Lebensmittel auswählen.");
  if (excludedIds.length) {
    messages.push(`Diese Lebensmittel sind für diesen Planplatz derzeit nicht auswählbar: ${excludedIds.map((id) => food(id)?.name || id).join(", ")}.`);
  }
  if (unsafeBaseIds.length) messages.push(`Noch nicht als Hauptbasis geeignet: ${unsafeBaseIds.map((id) => food(id)?.name || id).join(", ")}. Bitte als bekannte Komponente oder Einführung kennzeichnen.`);
  if (unsafeComponentIds.length) messages.push(`Noch nicht als bekannte Komponente geeignet: ${unsafeComponentIds.map((id) => food(id)?.name || id).join(", ")}. Bitte als Einführung kennzeichnen oder entfernen.`);
  if (multipleUnsafeIds.length) messages.push(`Nur eine neue oder unsichere Einführung gleichzeitig: ${multipleUnsafeIds.map((id) => food(id)?.name || id).join(", ")}.`);
  return {
    ok: roles.ids.length > 0 && !excludedIds.length && !unsafeBaseIds.length && !unsafeComponentIds.length && !multipleUnsafeIds.length,
    ...roles,
    infos,
    excludedIds,
    unsafeBaseIds,
    unsafeComponentIds,
    unsafeIds,
    multipleUnsafeIds,
    messages,
    message: messages.join(" "),
  };
}
function prepareManualMealData(data, meal, on = today()) {
  let validation = manualMealValidation(data, meal, on);
  if (!validation.ok) return { ok: false, validation, message: validation.message };
  let focusId = validation.ids.includes(data.focusId)
    ? data.focusId
    : validation.samples[0] || validation.bases[0] || validation.ids[0];
  return {
    ok: true,
    validation,
    data: {
      ...data,
      foodIds: [...validation.ids],
      baseFoodIds: [...validation.bases],
      sampleFoodIds: [...validation.samples],
      foodRoles: foodRolesFor(validation.ids, validation.bases, validation.samples),
      focusId,
    },
  };
}
function planSlotProtected(date, meal) {
  let key = planLockKey(date, meal);
  return !!state.manualMeals?.[key] || state.planLocks?.[key]?.mode === "manual" || !!completedLog(date, meal);
}
function nextMovableSlot(fromDate, meal, maxDays = 60) {
  for (let i = 1; i <= maxDays; i++) {
    let date = addDays(fromDate, i), key = planLockKey(date, meal);
    if (!planSlotProtected(date, meal) && !state.planLocks?.[key] && !state.overrides?.[key]) return date;
  }
  return "";
}
function shiftAutomaticSlot(date, meal) {
  let key = planLockKey(date, meal);
  let lock = state.planLocks?.[key];
  let override = state.overrides?.[key];
  if (!lock && !override) return true;
  if (planSlotProtected(date, meal)) return false;
  let target = nextMovableSlot(date, meal);
  if (!target) return false;
  let targetKey = planLockKey(target, meal);
  if (lock?.mode === "auto") {
    state.planLocks[targetKey] = { ...clone(lock), date: target, createdAt: new Date().toISOString() };
    if (lock.followUpFoodId && state.followUps?.[lock.followUpFoodId]) {
      state.followUps[lock.followUpFoodId].dueDate = target;
      state.followUps[lock.followUpFoodId].updatedAt = new Date().toISOString();
    }
    delete state.planLocks[key];
  }
  if (override) {
    state.overrides[targetKey] = override;
    delete state.overrides[key];
  }
  return true;
}
function priorBaseIds(foodId) {
  return state.logs
    .filter((log) => (log.foodIds || []).includes(foodId))
    .sort((a, b) => `${b.date}${b.createdAt || ""}`.localeCompare(`${a.date}${a.createdAt || ""}`))[0]?.baseFoodIds || [];
}
function safeBaseCandidates(foodId, meal = "lunch", previous = priorBaseIds(foodId)) {
  const excludedCategories = new Set(["Fett", "Kraut/Gewürz", "Fleisch", "Fisch", "Meeresfrucht", "Ei", "Milchprodukt", "Soja/Tofu"]);
  return state.foods
    .filter((candidate) => candidate.id !== foodId && candidate.active && eligible(candidate, meal, today()) && isTrustedBase(candidate))
    .filter((candidate) => !candidate.allergenGroup && !excludedCategories.has(candidate.category))
    .map((candidate) => {
      let successful = logsFor(candidate.id).filter((log) => ["eaten", "tried"].includes(outcomeForFood(log, candidate.id))).length;
      let score = 50;
      if ((candidate.meals || []).includes(meal)) score += 18;
      if (inventoryPortions(candidate.id) > 0) score += 16;
      score += Math.min(15, successful * 3);
      score += Math.max(0, 8 - Math.min(8, usageCount(candidate.id)));
      if (!previous.includes(candidate.id)) score += 14;
      else score -= 10;
      score -= Math.max(0, Number(candidate.priority || 0)) / 1000;
      return { food: candidate, score };
    })
    .sort((a, b) => b.score - a.score || a.food.priority - b.food.priority || a.food.name.localeCompare(b.food.name, "de"));
}
function chooseAlternativeBase(foodId, meal = "lunch", previous = priorBaseIds(foodId)) {
  return safeBaseCandidates(foodId, meal, previous)[0]?.food || null;
}
function followUpPreparationOptions(foodId) {
  let f = food(foodId);
  if (!f) return [];
  let stage = Number(state.settings.textureStage || 1);
  let source = String(f.safeForm || "Sehr weich und altersgerecht anbieten.");
  let options = [{ key: "standard", label: "Sichere Standardform", text: source }];
  if (stage <= 2 || /pürier|brei|fein/i.test(source)) options.push({ key: "pureed", label: "Fein püriert", text: "Sehr weich garen und fein beziehungsweise glatt püriert anbieten." });
  if (stage >= 2 && /zerdrück|stamp|weich/i.test(source)) options.push({ key: "mashed", label: "Weich zerdrückt", text: "Sehr weich garen und mit der Gabel weich zerdrückt anbieten; keine harten Stücke." });
  if (stage >= 3 && /fingerfood|streifen|länglich|stück|greif/i.test(source)) options.push({ key: "fingerfood", label: "Weiches Fingerfood", text: "Sehr weich, gut greifbar und zwischen zwei Fingern leicht zerdrückbar als Fingerfood anbieten; direkt beaufsichtigen." });
  return [...new Map(options.map((option) => [option.key, option])).values()];
}
function followUpExplanation(record) {
  let f = food(record.foodId), base = food(record.baseFoodId);
  let prep = record.preparationText ? ` Zubereitung: ${record.preparationText}` : "";
  if (record.baseMode === "none" || !base) return `${f?.name || "Lebensmittel"} bewusst ohne Basis als kleine Wiederholung anbieten.${prep}`;
  return `${f?.name || "Lebensmittel"} diesmal mit ${base.name}${(record.previousBaseIds || []).length ? " statt der bisherigen Basis" : " als sichere Basis"}.${prep}`;
}
function removeFollowUpPlan(foodId) {
  for (let [key, lock] of Object.entries(state.planLocks || {})) {
    if (lock?.followUpFoodId === foodId && lock.mode === "auto") delete state.planLocks[key];
  }
  for (let [key, value] of Object.entries(state.overrides || {})) {
    if (value === foodId && !state.planLocks?.[key]) delete state.overrides[key];
  }
}
function applyFollowUpPlan(record, requestedDate = "") {
  if (!record) return { ok: false, message: "Wiedervorlage fehlt." };
  removeFollowUpPlan(record.foodId);
  if (record.status !== "scheduled" || isFoodUnavailable(record.foodId)) return { ok: true, date: "" };
  let meal = plannerLogMealKeys().includes(record.meal) ? record.meal : "";
  if (!meal) return { ok: true, date: "", unplanned: true };
  let date = requestedDate || record.dueDate || record.earliestDate || addDays(today(), 1);
  let key = planLockKey(date, meal);
  if (planSlotProtected(date, meal)) return { ok: false, message: "Dieser Planplatz ist geschützt oder bereits manuell belegt." };
  if (!shiftAutomaticSlot(date, meal)) return { ok: false, message: "Für diesen Planplatz konnte keine sichere Verschiebung gefunden werden." };
  key = planLockKey(date, meal);
  let base = record.baseMode === "none" ? null : food(record.baseFoodId);
  state.planLocks[key] = {
    date,
    meal,
    focusId: record.foodId,
    foodIds: base ? [base.id, record.foodId] : [record.foodId],
    baseFoodIds: base ? [base.id] : [],
    sampleFoodIds: [record.foodId],
    optionalAddons: [],
    inventoryFoodIds: base && inventoryPortions(base.id) > 0 ? [base.id] : [],
    recipeName: "",
    recipeInventoryId: "",
    milkMeal: "",
    type: "gezielt wiederholen",
    note: followUpExplanation(record),
    followUpFoodId: record.foodId,
    preparationKey: record.preparationKey || "standard",
    preparationText: record.preparationText || "",
    mode: "auto",
    createdAt: new Date().toISOString(),
  };
  state.overrides[key] = record.foodId;
  record.dueDate = date;
  record.updatedAt = new Date().toISOString();
  return { ok: true, date };
}
function refusalHistory(foodId) {
  return state.logs.filter((log) => (log.foodIds || []).includes(foodId) && outcomeForFood(log, foodId) === "not_accepted");
}
function followUpStatusText(record) {
  if (record.status === "later") return "Später wieder anbieten";
  if (record.status === "awaiting_stock") return "Wartet auf Einkauf";
  return "Wieder anbieten";
}
function scheduleFollowUp(foodId, fromDate, meal = "", reason = "rejection", detail = "interest") {
  let f = food(foodId);
  if (!f || status(f) === "Pausiert" || isFoodUnavailable(foodId)) return null;
  let clearCount = refusalHistory(foodId).filter((log) => log.rejectionStrength === "refused").length;
  let minDays = reason === "not_offered" ? 1 : detail === "refused" ? 5 : 3;
  let maxDays = reason === "not_offered" ? 3 : detail === "refused" ? 10 : 5;
  let statusValue = "scheduled";
  if (reason === "rejection" && detail === "refused" && clearCount >= 3) {
    minDays = 14; maxDays = 21; statusValue = "later";
  }
  let previous = priorBaseIds(foodId);
  let candidates = safeBaseCandidates(foodId, meal, previous);
  let base = candidates[0]?.food || null;
  let target = "";
  for (let i = minDays; i <= maxDays; i++) {
    let date = addDays(fromDate, i);
    if (!planSlotProtected(date, meal)) { target = date; break; }
  }
  if (!target) {
    for (let i = maxDays + 1; i <= 45; i++) {
      let date = addDays(fromDate, i);
      if (!planSlotProtected(date, meal)) { target = date; break; }
    }
  }
  let prepOptions = followUpPreparationOptions(foodId);
  let previousRecord = state.followUps?.[foodId] || {};
  let record = {
    id: previousRecord.id || `${foodId}-${Date.now()}`,
    foodId,
    reason,
    detail,
    status: statusValue,
    createdAt: previousRecord.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    earliestDate: addDays(fromDate, minDays),
    latestDate: addDays(fromDate, maxDays),
    dueDate: target || addDays(fromDate, minDays),
    meal,
    baseFoodId: previousRecord.baseMode === "manual" && food(previousRecord.baseFoodId) ? previousRecord.baseFoodId : (base?.id || ""),
    baseMode: previousRecord.baseMode || "auto",
    alternativeBaseIds: candidates.filter((item) => !base || item.food.id !== base.id).filter((item) => !candidates.length || item.score >= candidates[0].score - 7).map((item) => item.food.id),
    previousBaseIds: previous,
    preparationKey: prepOptions.some((item) => item.key === previousRecord.preparationKey) ? previousRecord.preparationKey : (prepOptions[0]?.key || "standard"),
    preparationText: prepOptions.find((item) => item.key === previousRecord.preparationKey)?.text || prepOptions[0]?.text || f.safeForm || "",
  };
  if (record.baseMode === "none") record.baseFoodId = "";
  state.followUps[foodId] = record;
  if (statusValue === "later") { removeFollowUpPlan(foodId); return record; }
  if (target) applyFollowUpPlan(record, target);
  return record;
}
function cleanFoodFromAutomaticFuturePlan(foodId) {
  for (let [key, value] of Object.entries(state.overrides || {})) {
    let date = key.split("|")[0];
    if (date >= today() && value === foodId && state.planLocks?.[key]?.mode !== "manual") delete state.overrides[key];
  }
  for (let [key, lock] of Object.entries(state.planLocks || {})) {
    let date = key.split("|")[0];
    if (date >= today() && lock.mode === "auto" && (lock.foodIds || []).includes(foodId)) delete state.planLocks[key];
  }
}
function clearFollowUp(foodId) {
  delete state.followUps?.[foodId];
  removeFollowUpPlan(foodId);
}
function latestLogForFood(foodId) {
  return state.logs.filter((log) => (log.foodIds || []).includes(foodId)).sort((a, b) => `${b.date}${b.updatedAt || b.createdAt || ""}`.localeCompare(`${a.date}${a.updatedAt || a.createdAt || ""}`))[0] || null;
}
function clearLogGeneratedState(foodId) {
  clearFollowUp(foodId);
  if (state.shoppingHints?.[foodId]?.sourceLogId) delete state.shoppingHints[foodId];
  let f = food(foodId);
  if (f?.reactionPauseSourceLogId) {
    f.manualStatus = f.reactionPausePreviousStatus || "auto";
    delete f.reactionPauseSourceLogId;
    delete f.reactionPausePreviousStatus;
  }
}
function followUpMealForLog(log, foodId) {
  if (plannerLogHasMealContext(log)) return log.meal;
  let item = food(foodId);
  let allowed = (item?.meals || []).filter((meal) => plannerLogMealKeys().includes(meal));
  return phaseMealKeys().find((meal) => allowed.includes(meal)) || "";
}
function rebuildFoodConsequences(foodId) {
  clearLogGeneratedState(foodId);
  let log = latestLogForFood(foodId);
  if (!log) return;
  let result = outcomeForFood(log, foodId);
  if (["eaten", "tried"].includes(result)) return;
  if (result === "reaction") {
    let f = food(foodId);
    if (f) {
      f.reactionPausePreviousStatus = f.manualStatus || "auto";
      f.reactionPauseSourceLogId = log.id;
      f.manualStatus = "Pausiert";
      cleanFoodFromFuturePlan(foodId);
    }
    return;
  }
  if (result === "not_accepted") {
    scheduleFollowUp(foodId, log.date, followUpMealForLog(log, foodId), "rejection", log.rejectionStrength || "interest");
    return;
  }
  if (result === "not_offered") {
    let unavailable = log.focusId === foodId && log.notOfferedReason === "unavailable";
    if (unavailable) {
      state.shoppingHints[foodId] = { foodId, status: "needed", createdAt: new Date().toISOString(), sourceLogId: log.id };
      state.followUps[foodId] = { id: `${foodId}-${Date.now()}`, foodId, reason: "not_offered", detail: "unavailable", status: "awaiting_stock", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dueDate: "", meal: followUpMealForLog(log, foodId), baseFoodId: "", baseMode: "none", alternativeBaseIds: [], previousBaseIds: priorBaseIds(foodId), preparationKey: "standard", preparationText: food(foodId)?.safeForm || "" };
      cleanFoodFromAutomaticFuturePlan(foodId);
    } else scheduleFollowUp(foodId, log.date, followUpMealForLog(log, foodId), "not_offered", "no_opportunity");
  }
}
function followUpEntries() {
  return Object.values(state.followUps || {})
    .filter((record) => record && food(record.foodId) && status(food(record.foodId)) !== "Pausiert")
    .sort((a, b) => {
      let planA = Number(!isFoodUnavailable(a.foodId) && (a.baseMode === "none" || !!food(a.baseFoodId) || !!chooseAlternativeBase(a.foodId, a.meal)));
      let planB = Number(!isFoodUnavailable(b.foodId) && (b.baseMode === "none" || !!food(b.baseFoodId) || !!chooseAlternativeBase(b.foodId, b.meal)));
      let refusalsA = refusalHistory(a.foodId).length, refusalsB = refusalHistory(b.foodId).length;
      return planB - planA || String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")) || refusalsB - refusalsA;
    });
}
