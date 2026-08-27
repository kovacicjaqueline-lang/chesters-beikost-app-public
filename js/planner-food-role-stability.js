"use strict";

/* PLAN-08 P0: kanonischer Rollenvertrag für automatisch geplante FOOD-Mahlzeiten.
 *
 * Automatische FOOD-Mahlzeiten müssen mit denselben Rollen aus dem Planner kommen,
 * die der Bearbeiten-Dialog anschließend validiert. Persistenz, Hydration und UI
 * dürfen daraus keine zweite Rollenwahrheit ableiten.
 *
 * Ergänzung Nuss/Samen:
 * - Nuss-/Samen-FOODs sind keine automatische Hauptbasis und kein normaler bekannter Fokus.
 * - Einführung, gezielte frühe Wiederholung und Allergen-Wiederholung bleiben Sample-Pfade.
 * - Eine FOOD-seitig freigegebene Mus-/Pastenform kann als sichere Sample-Form genutzt werden.
 * - Ein solches Sample kann nach der normalen Planner-Auswahl als Kostproben-Topping
 *   auf einen eindeutigen Obst-Getreide-Brei gesetzt werden. Das Topping bleibt Sample
 *   und verändert die Rezeptidentität nicht.
 */

const PLANNER_NUT_SEED_CATEGORIES = new Set(["Nuss", "Samen"]);
const PLANNER_NUT_SEED_SAMPLE_TYPES = new Set([
  "neu",
  "gezielt wiederholen",
  "Allergen einführen",
  "Allergen wiederholen",
  "manuell",
]);
const PLANNER_NUT_SEED_TOPPING_KIND = "smooth-paste";

function plannerNutSeedComponentFood(foodRecord) {
  return !!foodRecord && PLANNER_NUT_SEED_CATEGORIES.has(String(foodRecord.category || ""));
}

function plannerNutSeedToppingForm(foodRecord) {
  if (!plannerNutSeedComponentFood(foodRecord)) return false;
  if (typeof foodHasRecipeComponentKind === "function") {
    return foodHasRecipeComponentKind(foodRecord, PLANNER_NUT_SEED_TOPPING_KIND);
  }
  return Array.isArray(foodRecord.recipeComponentKinds) &&
    foodRecord.recipeComponentKinds.includes(PLANNER_NUT_SEED_TOPPING_KIND);
}

function plannerNutSeedRelatedIds(foodRecord, foods = []) {
  if (!foodRecord) return [];
  if (typeof relatedFamilyFoodIds === "function") {
    let ids = relatedFamilyFoodIds(foodRecord, foods);
    if (Array.isArray(ids) && ids.length) return ids;
  }
  let family = String(foodRecord.foodFamily || "");
  let allergenFamily = String(foodRecord.allergenFamily || "");
  if (!family && !allergenFamily) return [foodRecord.id];
  return (foods || [])
    .filter((candidate) => candidate && (
      (family && candidate.foodFamily === family) ||
      (allergenFamily && candidate.allergenFamily === allergenFamily)
    ))
    .map((candidate) => candidate.id);
}

function plannerNutSeedPreferredToppingForm(foodRecord, foods = [], eligibleFn = null) {
  if (!plannerNutSeedComponentFood(foodRecord)) return foodRecord || null;
  if (plannerNutSeedToppingForm(foodRecord)) return foodRecord;
  let related = new Set(plannerNutSeedRelatedIds(foodRecord, foods));
  let eligible = typeof eligibleFn === "function" ? eligibleFn : () => true;
  return (foods || [])
    .filter((candidate) =>
      related.has(candidate.id) &&
      plannerNutSeedToppingForm(candidate) &&
      eligible(candidate),
    )
    .sort((a, b) => (Number(a.priority) || 9999) - (Number(b.priority) || 9999))[0] || foodRecord;
}

function plannerNutSeedNormalizeIntroductionResult(result, foods = [], eligibleFn = null) {
  if (!result?.f || !plannerNutSeedComponentFood(result.f)) return result;
  let type = result.type === "bekannt kombinieren" ? "gezielt wiederholen" : result.type;
  if (!PLANNER_NUT_SEED_SAMPLE_TYPES.has(type)) return { ...result, type };
  let preferred = plannerNutSeedPreferredToppingForm(result.f, foods, eligibleFn);
  return { ...result, f: preferred || result.f, type };
}

function plannerNutSeedFruitGrainPorridgeCandidate(candidate, foods = []) {
  if (!candidate?.recipe || String(candidate.recipe.category || "") !== "porridge") return false;
  let byId = new Map((foods || []).map((item) => [item.id, item]));
  let categories = new Set((candidate.ids || []).map((id) => byId.get(id)?.category).filter(Boolean));
  return categories.has("Obst") && categories.has("Getreide/Stärke");
}

function plannerNutSeedCanonicalIds(ids) {
  return [...new Set(ids || [])].filter(Boolean).sort();
}

function plannerNutSeedToppingRecipeCandidates(
  meal,
  toppingId,
  recipes,
  foods,
  recipeSuitableFn,
  ingredientReadyFn,
  foodEligibleFn,
  recipeAllowedFn,
  on = "",
) {
  if (!meal?.active || meal.empty || meal.recipeName || meal.manualAdded || meal.lockedMode) return [];
  if (!toppingId || meal.meal === "snack") return [];

  let coreIds = plannerNutSeedCanonicalIds((meal.foodIds || []).filter((id) => id !== toppingId));
  if (!coreIds.length) return [];
  let planned = new Set(coreIds);
  let byName = new Map((foods || []).map((item) => [item.name, item]));
  let suitable = typeof recipeSuitableFn === "function" ? recipeSuitableFn : () => true;
  let ready = typeof ingredientReadyFn === "function" ? ingredientReadyFn : () => true;
  let foodEligible = typeof foodEligibleFn === "function" ? foodEligibleFn : () => true;
  let recipeAllowed = typeof recipeAllowedFn === "function" ? recipeAllowedFn : () => true;
  let variantsFor = typeof plannerProactiveRecipeNameVariants === "function"
    ? plannerProactiveRecipeNameVariants
    : (recipe) => [recipe?.requires || []];
  let raw = [];

  for (let recipe of recipes || []) {
    if (!recipe || !suitable(recipe, meal.meal) || !recipeAllowed(recipe)) continue;
    if (Array.isArray(recipe.requirementMissing) && recipe.requirementMissing.length) continue;
    if (String(recipe.category || "") !== "porridge") continue;

    for (let names of variantsFor(recipe)) {
      if (!names?.length) continue;
      let items = names.map((name) => byName.get(name));
      if (items.some((item) => !item)) continue;
      let ids = plannerNutSeedCanonicalIds(items.map((item) => item.id));
      if (ids.includes(toppingId)) continue;
      if (!coreIds.every((id) => ids.includes(id))) continue;
      if (items.some((item) => !ready(item.name))) continue;
      if (items.some((item) => !foodEligible(item, meal.meal, on))) continue;

      let candidate = {
        recipe,
        ids,
        addedIds: plannerNutSeedCanonicalIds(items.filter((item) => !planned.has(item.id)).map((item) => item.id)),
        sampleFoodId: toppingId,
      };
      if (!plannerNutSeedFruitGrainPorridgeCandidate(candidate, foods)) continue;
      raw.push(candidate);
    }
  }

  let byRecipe = new Map();
  for (let candidate of raw) {
    let key = candidate.recipe.name;
    if (!byRecipe.has(key)) byRecipe.set(key, []);
    byRecipe.get(key).push(candidate);
  }

  let result = [];
  for (let variants of byRecipe.values()) {
    let minAdded = Math.min(...variants.map((candidate) => candidate.addedIds.length));
    let minimal = variants.filter((candidate) => candidate.addedIds.length === minAdded);
    let unique = [];
    for (let candidate of minimal) {
      let key = candidate.ids.join("+");
      if (!unique.some((entry) => entry.key === key)) unique.push({ key, candidate });
    }
    if (unique.length === 1) result.push(unique[0].candidate);
  }
  return result;
}

function plannerReserveNutSeedSampleInventory(
  meal,
  toppingId,
  ctx,
  preferInventory = false,
  inventoryPortionsFn = null,
) {
  if (!meal || !toppingId || !preferInventory || !ctx?.inventoryReserved) return meal;
  if ((meal.inventoryFoodIds || []).includes(toppingId)) return meal;
  let inventoryPortions = typeof inventoryPortionsFn === "function" ? inventoryPortionsFn : () => 0;
  let reserved = Number(ctx.inventoryReserved.get(toppingId) || 0);
  if (Number(inventoryPortions(toppingId) || 0) <= reserved) return meal;
  meal.inventoryFoodIds = [...new Set([...(meal.inventoryFoodIds || []), toppingId])];
  ctx.inventoryReserved.set(toppingId, reserved + 1);
  return meal;
}

function plannerAutomaticFoodRoleState(meal, roleInfoFn, on = "") {
  if (!meal?.active || meal.empty || meal.recipeName || meal.manualAdded) return null;
  if (meal.lockedMode === "manual" || meal.mode === "manual") return null;

  let ids = [...new Set(meal.foodIds || [])].filter(Boolean);
  if (!ids.length) return null;
  let samples = [...new Set(meal.sampleFoodIds || [])].filter((id) => ids.includes(id));
  let sampleSet = new Set(samples);
  let bases = [];
  let components = [];

  for (let id of ids) {
    if (sampleSet.has(id)) continue;
    let info = typeof roleInfoFn === "function"
      ? roleInfoFn(id, meal.meal, on, { recipeName: "" })
      : null;
    if (info?.role === "base") bases.push(id);
    else if (info?.role === "component") components.push(id);
    else return null;
  }

  let foodRoles = Object.fromEntries(
    ids.map((id) => [
      id,
      sampleSet.has(id) ? "sample" : bases.includes(id) ? "base" : "component",
    ]),
  );

  return { ids, bases, samples, components, foodRoles };
}

function plannerApplyAutomaticFoodRoleState(meal, roles) {
  if (!meal || !roles) return meal;
  meal.foodIds = [...roles.ids];
  meal.baseFoodIds = [...roles.bases];
  meal.sampleFoodIds = [...roles.samples];
  meal.foodRoles = { ...roles.foodRoles };
  return meal;
}

function plannerFoodRolesEqual(meal, roles) {
  if (!meal || !roles) return false;
  let sameArray = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
  return (
    sameArray(meal.foodIds, roles.ids) &&
    sameArray(meal.baseFoodIds, roles.bases) &&
    sameArray(meal.sampleFoodIds, roles.samples) &&
    JSON.stringify(meal.foodRoles || {}) === JSON.stringify(roles.foodRoles || {})
  );
}

function plannerCompactFoodRoleRows(meal, roleStateFn) {
  if (!meal || meal.recipeName) return [];
  let state = typeof roleStateFn === "function" ? roleStateFn(meal) : null;
  let ids = state?.ids || [...new Set(meal.foodIds || [])].filter(Boolean);
  if (ids.length <= 1 && !(state?.samples || []).length) return [];
  let bases = new Set(state?.bases || []);
  let samples = new Set(state?.samples || []);
  let components = new Set(state?.components || []);
  return ids.map((id) => {
    let role = samples.has(id)
      ? "sample"
      : bases.has(id)
        ? "base"
        : components.has(id)
          ? "component"
          : "component";
    return {
      id,
      role,
      label: role === "sample" ? "Kostprobe" : role === "base" ? "Hauptmahlzeit" : "Bestandteil",
    };
  });
}

function installPlannerFoodRoleStabilityRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__plannerFoodRoleStabilityRuntimeInstalled) return false;
  if (
    typeof buildDay !== "function" ||
    typeof lockedMeal !== "function" ||
    typeof manualMealRoleInfo !== "function" ||
    typeof manualMealRoleState !== "function" ||
    typeof compactMealRolesHtml !== "function" ||
    typeof food !== "function" ||
    typeof esc !== "function" ||
    typeof plannerFoodCanBeBase !== "function" ||
    typeof plannerFoodCanBeAutomaticFocus !== "function" ||
    typeof plannerAutomaticLockRoleViolation !== "function" ||
    typeof introductionCandidate !== "function" ||
    typeof knownCandidate !== "function" ||
    typeof chooseFocus !== "function"
  ) return false;

  globalThis.__plannerFoodRoleStabilityRuntimeInstalled = true;
  let originalBuildDay = buildDay;
  let originalLockedMeal = lockedMeal;
  let originalCompactMealRolesHtml = compactMealRolesHtml;
  let originalPlannerFoodCanBeBase = plannerFoodCanBeBase;
  let originalPlannerFoodCanBeAutomaticFocus = plannerFoodCanBeAutomaticFocus;
  let originalPlannerAutomaticLockRoleViolation = plannerAutomaticLockRoleViolation;
  let originalIntroductionCandidate = introductionCandidate;
  let originalKnownCandidate = knownCandidate;
  let originalChooseFocus = chooseFocus;
  let nutSeedSampleFocusDepth = 0;
  let repairSaveScheduled = false;

  plannerFoodCanBeBase = function plan08NutSeedComponentBase(foodRecord) {
    if (plannerNutSeedComponentFood(foodRecord)) return false;
    return originalPlannerFoodCanBeBase(foodRecord);
  };

  plannerFoodCanBeAutomaticFocus = function plan08NutSeedAutomaticFocus(foodRecord) {
    if (plannerNutSeedComponentFood(foodRecord)) return nutSeedSampleFocusDepth > 0;
    return originalPlannerFoodCanBeAutomaticFocus(foodRecord);
  };

  plannerAutomaticLockRoleViolation = function plan08NutSeedAutomaticLockRoleViolation(lock, foods = []) {
    if (originalPlannerAutomaticLockRoleViolation(lock, foods)) return true;
    if (!lock || lock.mode !== "auto" || lock.recipeName) return false;
    let byId = new Map((foods || []).map((item) => [item.id, item]));
    if ((lock.baseFoodIds || []).some((id) => plannerNutSeedComponentFood(byId.get(id)))) return true;
    let focus = byId.get(lock.focusId);
    if (!plannerNutSeedComponentFood(focus)) return false;
    let isSample = (lock.sampleFoodIds || []).includes(lock.focusId) && PLANNER_NUT_SEED_SAMPLE_TYPES.has(lock.type);
    return !isSample;
  };

  introductionCandidate = function plan08NutSeedIntroductionCandidate(meal, on, ctx, exclude = []) {
    let result;
    nutSeedSampleFocusDepth++;
    try {
      result = originalIntroductionCandidate(meal, on, ctx, exclude);
    } finally {
      nutSeedSampleFocusDepth--;
    }
    return plannerNutSeedNormalizeIntroductionResult(
      result,
      state?.foods || [],
      (candidate) => typeof eligible !== "function" || eligible(candidate, meal, on),
    );
  };

  knownCandidate = function plan08NutSeedKnownCandidate(meal, on, ctx, exclude = []) {
    let blocked = [...exclude];
    let max = (state?.foods?.length || 0) + 1;
    let explicitOverride = state?.overrides?.[`${on}|${meal}`] || "";
    for (let i = 0; i < max; i++) {
      let result = originalKnownCandidate(meal, on, ctx, blocked);
      if (!result?.f || !plannerNutSeedComponentFood(result.f)) return result;
      if (explicitOverride === result.f.id) {
        let preferred = plannerNutSeedPreferredToppingForm(
          result.f,
          state?.foods || [],
          (candidate) => typeof eligible !== "function" || eligible(candidate, meal, on),
        );
        return { ...result, f: preferred || result.f, type: "manuell" };
      }
      if (blocked.includes(result.f.id)) return null;
      blocked.push(result.f.id);
    }
    return null;
  };

  chooseFocus = function plan08NutSeedChooseFocus(meal, on, exclude = [], key = "") {
    let blocked = [...exclude];
    let max = (state?.foods?.length || 0) + 1;
    let explicitOverride = state?.overrides?.[key] || "";
    for (let i = 0; i < max; i++) {
      let result = originalChooseFocus(meal, on, blocked, key);
      if (!result?.f || !plannerNutSeedComponentFood(result.f)) return result;
      let normalized = plannerNutSeedNormalizeIntroductionResult(
        result,
        state?.foods || [],
        (candidate) => typeof eligible !== "function" || eligible(candidate, meal, on),
      );
      if (PLANNER_NUT_SEED_SAMPLE_TYPES.has(normalized?.type)) return normalized;
      if (explicitOverride === result.f.id) return { ...normalized, type: "manuell" };
      if (blocked.includes(result.f.id)) return null;
      blocked.push(result.f.id);
    }
    return null;
  };

  let normalizeMeal = (meal, on = "") => {
    let roles = plannerAutomaticFoodRoleState(meal, manualMealRoleInfo, on);
    if (!roles) return { meal, changed: false };
    let changed = !plannerFoodRolesEqual(meal, roles);
    plannerApplyAutomaticFoodRoleState(meal, roles);
    return { meal, changed };
  };

  let scheduleRepairSave = () => {
    if (repairSaveScheduled || typeof save !== "function") return;
    repairSaveScheduled = true;
    Promise.resolve().then(() => {
      repairSaveScheduled = false;
      save();
    });
  };

  let promoteNutSeedSampleTopping = (meal, date, ctx) => {
    if (!meal?.active || meal.empty || meal.recipeName || meal.manualAdded || meal.lockedMode) return meal;
    let toppingId = (meal.sampleFoodIds || []).find((id) => plannerNutSeedToppingForm(food(id)));
    if (!toppingId) return meal;
    if (
      typeof recipeStates !== "function" ||
      typeof plannerRecipeSuitableForMeal !== "function" ||
      typeof recipeIngredientReady !== "function" ||
      typeof plannerProactiveRuntimeFoodEligible !== "function" ||
      typeof plannerProactiveRecipeRoleState !== "function" ||
      typeof plannerSelectProactiveRecipe !== "function" ||
      typeof plannerApplyProactiveRecipeMeal !== "function" ||
      typeof reserveMealInventory !== "function"
    ) return meal;

    let candidates = plannerNutSeedToppingRecipeCandidates(
      meal,
      toppingId,
      recipeStates(),
      state?.foods || [],
      plannerRecipeSuitableForMeal,
      recipeIngredientReady,
      plannerProactiveRuntimeFoodEligible,
      (recipe) =>
        (typeof plannerRecipeMilkContextCompatible !== "function" || plannerRecipeMilkContextCompatible(meal, recipe)) &&
        !(recipe?.milkMeal === "full" && typeof recipeContainsMeatOrFish === "function" && recipeContainsMeatOrFish(recipe)),
      date,
    )
      .map((candidate) => {
        let synthetic = {
          ...meal,
          foodIds: (meal.foodIds || []).filter((id) => id !== toppingId),
          baseFoodIds: (meal.baseFoodIds || []).filter((id) => id !== toppingId),
          sampleFoodIds: [],
          foodRoles: Object.fromEntries(Object.entries(meal.foodRoles || {}).filter(([id]) => id !== toppingId)),
        };
        return {
          ...candidate,
          roleState: plannerProactiveRecipeRoleState(synthetic, candidate, date, manualMealRoleInfo),
        };
      })
      .filter((candidate) => !!candidate.roleState);

    let selected = plannerSelectProactiveRecipe(candidates, ctx);
    if (!selected) return meal;
    let originalType = meal.type;
    plannerApplyProactiveRecipeMeal(meal, selected, date, ctx, reserveMealInventory, selected.roleState);

    if (!(meal.foodIds || []).includes(toppingId)) meal.foodIds.push(toppingId);
    meal.baseFoodIds = (meal.baseFoodIds || []).filter((id) => id !== toppingId);
    meal.sampleFoodIds = [...new Set([...(meal.sampleFoodIds || []), toppingId])];
    meal.foodRoles = { ...(meal.foodRoles || {}), [toppingId]: "sample" };
    meal.type = originalType;
    plannerReserveNutSeedSampleInventory(
      meal,
      toppingId,
      ctx,
      !!state?.settings?.preferInventoryInPlan,
      typeof inventoryPortions === "function" ? inventoryPortions : null,
    );
    let toppingName = food(toppingId)?.name || toppingId;
    let toppingNote = `${toppingName} als Kostproben-Topping zum Obst-Getreide-Brei anbieten.`;
    if (!String(meal.note || "").includes(toppingNote)) meal.note = meal.note ? `${meal.note} ${toppingNote}` : toppingNote;
    if (typeof applyPlannedMealAmounts === "function") applyPlannedMealAmounts(meal);
    return meal;
  };

  lockedMeal = function plan08RoleStableLockedMeal(date, mealKey) {
    let result = originalLockedMeal(date, mealKey);
    if (!result || result.recipeName || result.lockedMode === "manual") return result;
    let normalized = normalizeMeal(result, date);
    if (!normalized.changed) return result;

    let key = typeof planLockKey === "function" ? planLockKey(date, mealKey) : `${date}|${mealKey}`;
    let lock = state?.planLocks?.[key];
    if (lock?.mode === "auto" && !lock.recipeName) {
      let lockRoles = plannerAutomaticFoodRoleState(
        { ...lock, meal: mealKey, active: true },
        manualMealRoleInfo,
        date,
      );
      if (lockRoles) {
        plannerApplyAutomaticFoodRoleState(lock, lockRoles);
        scheduleRepairSave();
      }
    }
    return result;
  };

  buildDay = function plan08RoleStableBuildDay(date, index, ctx) {
    let day = originalBuildDay(date, index, ctx);
    for (let meal of day?.meals || []) {
      promoteNutSeedSampleTopping(meal, date, ctx);
      normalizeMeal(meal, date);
    }
    return day;
  };

  compactMealRolesHtml = function plan08RoleStableCompactMealRolesHtml(meal) {
    if (!meal || meal.recipeName) return originalCompactMealRolesHtml(meal);
    let rows = plannerCompactFoodRoleRows(meal, manualMealRoleState);
    if (!rows.length) return originalCompactMealRolesHtml(meal);
    return `<div class="compact-role-list">${rows
      .map((row) => {
        let item = food(row.id);
        if (!item) return "";
        return `<div class="compact-role-row ${row.role === "sample" ? "sample" : ""}"><b>${esc(item.name)}</b><span>${row.label}</span></div>`;
      })
      .join("")}</div>`;
  };

  if (typeof state !== "undefined" && state && typeof pruneIneligibleAutomaticPlanState === "function") {
    let changed = pruneIneligibleAutomaticPlanState(state);
    if (changed) {
      if (typeof save === "function") save();
      if (typeof renderAll === "function") renderAll();
    }
  }

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerFoodRoleStabilityRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PLANNER_NUT_SEED_CATEGORIES,
    PLANNER_NUT_SEED_SAMPLE_TYPES,
    PLANNER_NUT_SEED_TOPPING_KIND,
    plannerNutSeedComponentFood,
    plannerNutSeedToppingForm,
    plannerNutSeedRelatedIds,
    plannerNutSeedPreferredToppingForm,
    plannerNutSeedNormalizeIntroductionResult,
    plannerNutSeedFruitGrainPorridgeCandidate,
    plannerNutSeedCanonicalIds,
    plannerNutSeedToppingRecipeCandidates,
    plannerReserveNutSeedSampleInventory,
    plannerAutomaticFoodRoleState,
    plannerApplyAutomaticFoodRoleState,
    plannerFoodRolesEqual,
    plannerCompactFoodRoleRows,
    installPlannerFoodRoleStabilityRuntime,
  };
}
