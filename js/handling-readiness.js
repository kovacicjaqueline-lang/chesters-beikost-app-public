"use strict";

/*
 * Handling-Readiness-Policy.
 *
 * Grundsatz: Löffel-/Breikost und geeignetes weiches Fingerfood sind parallele
 * Darreichungswege. Fingerfood wird daher nicht aus textureStage abgeleitet.
 * Nicht migrierte Rezepte behalten konservativ die bisherige Stage-Sperre.
 */

function normalizeFeedingApproach(value) {
  return ["spoon", "fingerfood", "mixed"].includes(value) ? value : "mixed";
}

function handlingModeFamily(mode) {
  if (String(mode || "").startsWith("spoon-")) return "spoon";
  if (String(mode || "").startsWith("finger-")) return "fingerfood";
  return "";
}

function handlingModeCapability(mode, contract = null) {
  return String(contract?.requiredCapabilities?.[mode] || "");
}

function handlingCapabilitySatisfied(capability, settings = {}) {
  if (!capability) return true;
  if (capability === "small-soft-pieces")
    return settings?.handlingCapabilities?.smallSoftPieces === true;
  return false;
}

function handlingModeTextureAllowed(mode, settings = {}) {
  let textureStage = Number(settings.textureStage || 1);
  if (mode === "spoon-soft-lumpy") return textureStage >= 3;
  return true;
}

function eligibleHandlingModes(contract, settings = {}) {
  if (!contract?.modes?.length) return [];
  return [...contract.modes].filter(
    (mode) =>
      handlingModeTextureAllowed(mode, settings) &&
      handlingCapabilitySatisfied(handlingModeCapability(mode, contract), settings),
  );
}

function preferredHandlingModes(modes, feedingApproach = "mixed") {
  let approach = normalizeFeedingApproach(feedingApproach);
  let list = [...new Set(modes || [])];
  if (approach === "mixed") return list;
  return list
    .map((mode, index) => ({
      mode,
      index,
      rank: handlingModeFamily(mode) === approach ? 0 : 1,
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.mode);
}

function handlingEligibility(contract, settings = {}) {
  if (!contract) {
    return {
      migrated: false,
      eligibleModes: [],
      preferredModes: [],
      blockedReasons: ["legacy-stage-fallback"],
    };
  }
  let eligibleModes = eligibleHandlingModes(contract, settings);
  let blockedReasons = contract.modes?.length && !eligibleModes.length
    ? ["handling-requirement"]
    : [];
  return {
    migrated: true,
    eligibleModes,
    preferredModes: preferredHandlingModes(
      eligibleModes,
      settings.feedingApproach,
    ),
    blockedReasons,
  };
}

function recipeHandlingEligibility(recipe, settings = {}, contractMap = null) {
  let map = contractMap || (
    typeof RECIPE_HANDLING_CONTRACT !== "undefined"
      ? RECIPE_HANDLING_CONTRACT
      : {}
  );
  let contract = recipe?.name ? map?.[recipe.name] : null;
  return handlingEligibility(contract, settings);
}

function foodHandlingEligibility(foodOrId, settings = {}, contractMap = null) {
  let map = contractMap || (
    typeof FOOD_HANDLING_CONTRACT !== "undefined"
      ? FOOD_HANDLING_CONTRACT
      : {}
  );
  let id = typeof foodOrId === "string" ? foodOrId : foodOrId?.id;
  let contract = id ? map?.[id] : null;
  return handlingEligibility(contract, settings);
}

function presentationModeForMeal(
  meal,
  settings = {},
  foodContractMap = null,
  recipeContractMap = null,
) {
  if (
    !meal ||
    meal.active === false ||
    meal.empty ||
    (meal.sampleFoodIds || []).length
  ) return "";

  if (meal.recipeName) {
    let map = recipeContractMap || (
      typeof RECIPE_HANDLING_CONTRACT !== "undefined"
        ? RECIPE_HANDLING_CONTRACT
        : {}
    );
    let handling = handlingEligibility(map?.[meal.recipeName], settings);
    if (!handling.migrated) return "";
    return preferredHandlingModes(
      handling.eligibleModes,
      settings.feedingApproach,
    )[0] || "";
  }

  let foodIds = [...new Set((meal.foodIds || []).filter(Boolean))];
  if (!foodIds.length) return "";

  let commonModes = null;
  for (let foodId of foodIds) {
    let handling = foodHandlingEligibility(foodId, settings, foodContractMap);
    if (!handling.migrated) return "";
    commonModes = commonModes === null
      ? [...handling.eligibleModes]
      : commonModes.filter((mode) => handling.eligibleModes.includes(mode));
  }

  return preferredHandlingModes(
    commonModes || [],
    settings.feedingApproach,
  )[0] || "";
}

function applyPresentationModeToAutomaticMeal(
  meal,
  settings = {},
  foodContractMap = null,
  recipeContractMap = null,
) {
  if (!meal || typeof meal !== "object") return meal;
  if (Object.prototype.hasOwnProperty.call(meal, "presentationMode")) return meal;
  if (meal.lockedMode || meal.manualAdded || meal.active === false || meal.empty)
    return meal;

  let presentationMode = presentationModeForMeal(
    meal,
    settings,
    foodContractMap,
    recipeContractMap,
  );
  if (presentationMode) meal.presentationMode = presentationMode;
  return meal;
}

function applyPresentationModesToDay(
  day,
  settings = {},
  foodContractMap = null,
  recipeContractMap = null,
) {
  if (!day || !Array.isArray(day.meals)) return day;
  day.meals.forEach((meal) =>
    applyPresentationModeToAutomaticMeal(
      meal,
      settings,
      foodContractMap,
      recipeContractMap,
    ),
  );
  return day;
}

function legacyRecipeStageAllowed(recipe, textureStage) {
  return Number(textureStage || 1) >= Number(recipe?.stage || 1);
}

function mergeRecipeHandlingState(recipeState, settings = {}, contractMap = null) {
  let handling = recipeHandlingEligibility(recipeState, settings, contractMap);
  if (!handling.migrated) return {
    ...recipeState,
    handlingMigrated: false,
    handlingModes: [],
    preferredHandlingModes: [],
  };

  let requirementMissing = (recipeState.requirementMissing || []).filter(
    (item) => !String(item || "").startsWith("Konsistenz:"),
  );
  if (!handling.eligibleModes.length)
    requirementMissing.push("Darreichungsform: aktuell noch nicht passend");

  let ingredientMissing = [...(recipeState.ingredientMissing || [])];
  let missing = [...ingredientMissing, ...requirementMissing];
  return {
    ...recipeState,
    requirementMissing,
    missing,
    unlocked: missing.length === 0,
    almost: missing.length > 0 && missing.length <= 2,
    handlingMigrated: true,
    handlingModes: handling.eligibleModes,
    preferredHandlingModes: handling.preferredModes,
  };
}

const HANDLING_OPTION_COPY = Object.freeze({
  "spoon-smooth": Object.freeze({
    key: "pureed",
    label: "Fein / glatt vom Löffel",
    text: "Sehr weich zubereiten und fein beziehungsweise glatt anbieten.",
  }),
  "spoon-mashed": Object.freeze({
    key: "mashed",
    label: "Weich zerdrückt",
    text: "Sehr weich zubereiten und mit der Gabel weich zerdrückt anbieten; keine harten Stücke.",
  }),
  "spoon-soft-lumpy": Object.freeze({
    key: "soft-lumpy",
    label: "Weich stückig",
    text: "Weich und gut zerdrückbar mit kleinen weichen Stückchen anbieten.",
  }),
  "finger-graspable": Object.freeze({
    key: "fingerfood",
    label: "Weiches Fingerfood",
    text: "Weich, gut greifbar und in der hinterlegten sicheren Form als Fingerfood anbieten; direkt beaufsichtigen.",
  }),
  "finger-small-soft": Object.freeze({
    key: "small-soft-pieces",
    label: "Kleine weiche Stücke",
    text: "Nur bei bestätigter passender Handhabung in kleinen weichen Stücken anbieten.",
  }),
});

function handlingPreparationOptions(foodOrId, settings = {}, contractMap = null) {
  let handling = foodHandlingEligibility(foodOrId, settings, contractMap);
  if (!handling.migrated) return null;
  return handling.preferredModes
    .map((mode) => HANDLING_OPTION_COPY[mode] ? { ...HANDLING_OPTION_COPY[mode], mode } : null)
    .filter(Boolean);
}

function ensureFeedingApproachControl() {
  if (typeof document === "undefined" || typeof state === "undefined") return;
  let texture = document.getElementById("textureStage");
  if (!texture) return;
  let field = document.getElementById("feedingApproachField");
  if (!field) {
    field = document.createElement("div");
    field.className = "field";
    field.id = "feedingApproachField";
    field.innerHTML = `<label>Beikostform</label><select id="feedingApproach"><option value="mixed">Gemischt</option><option value="spoon">Löffel / Brei</option><option value="fingerfood">Fingerfood / BLW</option></select><div class="small" style="margin-top:5px">Steuert, welche sicheren Darreichungsformen bevorzugt werden. Keine Entwicklungsstufe.</div>`;
    texture.closest(".field")?.insertAdjacentElement("afterend", field);
  }
  let select = document.getElementById("feedingApproach");
  if (select) select.value = normalizeFeedingApproach(state.settings.feedingApproach);
}

function plannerPageStartedAt() {
  if (typeof performance === "undefined") return Number.NaN;
  let origin = Number(performance.timeOrigin);
  return Number.isFinite(origin) ? origin : Number.NaN;
}

function pruneCurrentPagePrePolicyAutoLocks(
  currentState,
  pageStartedAt = plannerPageStartedAt(),
) {
  let startedAt = Number(pageStartedAt);
  if (!currentState?.planLocks || !Number.isFinite(startedAt)) return false;
  let changed = false;
  for (let [key, lock] of Object.entries(currentState.planLocks)) {
    if (lock?.mode !== "auto" || lock.followUpFoodId) continue;
    let createdAt = Date.parse(String(lock.createdAt || ""));
    if (!Number.isFinite(createdAt) || createdAt < startedAt) continue;
    delete currentState.planLocks[key];
    changed = true;
  }
  return changed;
}

function installPresentationModeRuntime() {
  if (
    typeof state === "undefined" ||
    typeof FOOD_HANDLING_CONTRACT === "undefined" ||
    typeof RECIPE_HANDLING_CONTRACT === "undefined"
  ) return;

  if (typeof buildDay === "function" && !buildDay.__handlingPresentationModeWrapped) {
    let originalBuildDay = buildDay;
    let wrappedBuildDay = function handlingPresentationBuildDay(...args) {
      let day = originalBuildDay.apply(this, args);
      return applyPresentationModesToDay(
        day,
        state.settings,
        FOOD_HANDLING_CONTRACT,
        RECIPE_HANDLING_CONTRACT,
      );
    };
    wrappedBuildDay.__handlingPresentationModeWrapped = true;
    buildDay = wrappedBuildDay;
  }

  if (typeof mealSnapshot === "function" && !mealSnapshot.__handlingPresentationModeWrapped) {
    let originalMealSnapshot = mealSnapshot;
    let wrappedMealSnapshot = function handlingPresentationMealSnapshot(...args) {
      let snapshot = originalMealSnapshot.apply(this, args);
      let generated = args[2];
      if (
        snapshot &&
        generated &&
        Object.prototype.hasOwnProperty.call(generated, "presentationMode")
      ) snapshot.presentationMode = generated.presentationMode;
      return snapshot;
    };
    wrappedMealSnapshot.__handlingPresentationModeWrapped = true;
    mealSnapshot = wrappedMealSnapshot;
  }

  if (typeof lockedMeal === "function" && !lockedMeal.__handlingPresentationModeWrapped) {
    let originalLockedMeal = lockedMeal;
    let wrappedLockedMeal = function handlingPresentationLockedMeal(date, meal, ...rest) {
      let plannedMeal = originalLockedMeal.call(this, date, meal, ...rest);
      if (!plannedMeal) return plannedMeal;
      let key = typeof planLockKey === "function" ? planLockKey(date, meal) : `${date}|${meal}`;
      let lock = state.planLocks?.[key];
      if (
        lock &&
        Object.prototype.hasOwnProperty.call(lock, "presentationMode")
      ) plannedMeal.presentationMode = lock.presentationMode;
      return plannedMeal;
    };
    wrappedLockedMeal.__handlingPresentationModeWrapped = true;
    lockedMeal = wrappedLockedMeal;
  }

  if (typeof saveLog === "function" && !saveLog.__handlingPresentationModeWrapped) {
    let originalSaveLog = saveLog;
    let wrappedSaveLog = function handlingPresentationSaveLog(...args) {
      let draft = typeof pendingLog !== "undefined" ? pendingLog : null;
      let presentationMode = draft && Object.prototype.hasOwnProperty.call(draft, "presentationMode")
        ? draft.presentationMode
        : "";
      let editId = draft?.editId || "";
      let previousEdited = editId ? state.logs?.find((log) => log.id === editId) : null;
      let existingIds = new Set((state.logs || []).map((log) => log.id));
      let result = originalSaveLog.apply(this, args);
      if (!presentationMode) return result;

      let savedLog = editId
        ? state.logs?.find((log) => log.id === editId)
        : state.logs?.find((log) => !existingIds.has(log.id));
      let saveSucceeded = editId ? !!savedLog && savedLog !== previousEdited : !!savedLog;
      if (saveSucceeded && savedLog.presentationMode !== presentationMode) {
        savedLog.presentationMode = presentationMode;
        if (typeof save === "function") save();
      }
      return result;
    };
    wrappedSaveLog.__handlingPresentationModeWrapped = true;
    saveLog = wrappedSaveLog;
  }
}

function installHandlingReadinessRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__handlingReadinessRuntimeInstalled) return false;
  if (
    typeof recipeStatesCore !== "function" ||
    typeof followUpPreparationOptions !== "function" ||
    typeof state === "undefined" ||
    typeof RECIPE_HANDLING_CONTRACT === "undefined" ||
    typeof FOOD_HANDLING_CONTRACT === "undefined"
  ) return false;

  globalThis.__handlingReadinessRuntimeInstalled = true;
  state.settings.feedingApproach = normalizeFeedingApproach(state.settings.feedingApproach);

  let prunedBootAutoLocks = false;
  if (typeof window !== "undefined" && window.__plannerPoliciesReady === false) {
    prunedBootAutoLocks = pruneCurrentPagePrePolicyAutoLocks(state);
    if (prunedBootAutoLocks && typeof save === "function") save();
  }

  let originalRecipeStatesCore = recipeStatesCore;
  recipeStatesCore = function handlingAwareRecipeStatesCore(...args) {
    return originalRecipeStatesCore(...args).map((recipeState) =>
      mergeRecipeHandlingState(
        recipeState,
        state.settings,
        RECIPE_HANDLING_CONTRACT,
      ),
    );
  };

  let originalFollowUpPreparationOptions = followUpPreparationOptions;
  followUpPreparationOptions = function handlingAwarePreparationOptions(foodId) {
    let structured = handlingPreparationOptions(
      foodId,
      state.settings,
      FOOD_HANDLING_CONTRACT,
    );
    if (!structured) return originalFollowUpPreparationOptions(foodId);
    let standard = originalFollowUpPreparationOptions(foodId)
      .find((option) => option.key === "standard");
    return standard ? [...structured, standard] : structured;
  };

  if (typeof renderSettings === "function") {
    let originalRenderSettings = renderSettings;
    renderSettings = function handlingAwareRenderSettings(...args) {
      let result = originalRenderSettings(...args);
      ensureFeedingApproachControl();
      return result;
    };
  }

  installPresentationModeRuntime();
  ensureFeedingApproachControl();
  let saveButton = typeof document !== "undefined"
    ? document.getElementById("saveSettings")
    : null;
  if (saveButton && !saveButton.dataset.handlingReadinessBound) {
    saveButton.dataset.handlingReadinessBound = "true";
    let originalSave = saveButton.onclick;
    saveButton.onclick = function handlingAwareSaveSettings(event) {
      let selected = document.getElementById("feedingApproach")?.value;
      state.settings.feedingApproach = normalizeFeedingApproach(selected);
      return typeof originalSave === "function"
        ? originalSave.call(this, event)
        : undefined;
    };
  }

  if (typeof window !== "undefined" && window.__beikostTest) {
    window.__beikostTest.handlingEligibility = (recipeName) => {
      let recipe = typeof recipeByName === "function" ? recipeByName(recipeName) : null;
      return recipe ? recipeHandlingEligibility(recipe, state.settings, RECIPE_HANDLING_CONTRACT) : null;
    };
    window.__beikostTest.foodHandlingEligibility = (foodId) =>
      foodHandlingEligibility(foodId, state.settings, FOOD_HANDLING_CONTRACT);
    window.__beikostTest.presentationModeForMeal = (meal) =>
      presentationModeForMeal(
        meal,
        state.settings,
        FOOD_HANDLING_CONTRACT,
        RECIPE_HANDLING_CONTRACT,
      );
  }

  return true;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeFeedingApproach,
    handlingModeFamily,
    handlingModeCapability,
    handlingCapabilitySatisfied,
    handlingModeTextureAllowed,
    eligibleHandlingModes,
    preferredHandlingModes,
    handlingEligibility,
    recipeHandlingEligibility,
    foodHandlingEligibility,
    presentationModeForMeal,
    applyPresentationModeToAutomaticMeal,
    applyPresentationModesToDay,
    legacyRecipeStageAllowed,
    mergeRecipeHandlingState,
    handlingPreparationOptions,
    plannerPageStartedAt,
    pruneCurrentPagePrePolicyAutoLocks,
    installPresentationModeRuntime,
    installHandlingReadinessRuntime,
  };
}