"use strict";

/*
 * Handling-Readiness-Policy.
 *
 * Löffelkost und geeignetes Fingerfood sind parallele Darreichungswege.
 * Handling, Bissabtrennung und orale Verarbeitung bleiben getrennte Dimensionen;
 * weder Fingerfood noch graded-bite noch structured-chew werden aus
 * textureStage, Alter oder einer anderen Capability abgeleitet.
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

function biteCapabilitySatisfied(capability, settings = {}) {
  if (!capability) return true;
  if (capability === "graded-bite")
    return settings?.handlingCapabilities?.gradedBite === true;
  return false;
}

function oralCapabilitySatisfied(capability, settings = {}) {
  if (!capability) return true;
  if (capability === "structured-chew")
    return settings?.handlingCapabilities?.structuredChew === true;
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

function spoonModePreference(textureStage = 1) {
  let stage = Math.max(1, Math.min(4, Number(textureStage) || 1));
  if (stage >= 3)
    return ["spoon-soft-lumpy", "spoon-mashed", "spoon-smooth"];
  if (stage === 2)
    return ["spoon-mashed", "spoon-smooth", "spoon-soft-lumpy"];
  return ["spoon-smooth", "spoon-mashed", "spoon-soft-lumpy"];
}

function sortSpoonModesByTexture(modes, textureStage = 1) {
  let list = [...(modes || [])];
  let preference = spoonModePreference(textureStage);
  let rank = (mode) => {
    let index = preference.indexOf(mode);
    return index >= 0 ? index : preference.length;
  };
  let spoons = list
    .filter((mode) => handlingModeFamily(mode) === "spoon")
    .map((mode, index) => ({ mode, index }))
    .sort((a, b) => rank(a.mode) - rank(b.mode) || a.index - b.index)
    .map((item) => item.mode);
  let spoonIndex = 0;
  return list.map((mode) =>
    handlingModeFamily(mode) === "spoon" ? spoons[spoonIndex++] : mode,
  );
}

function preferredHandlingModes(
  modes,
  feedingApproach = "mixed",
  textureStage = 1,
) {
  let approach = normalizeFeedingApproach(feedingApproach);
  let list = sortSpoonModesByTexture([...new Set(modes || [])], textureStage);
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
      biteSeparation: "",
      biteRequiredCapability: "",
      biteCapabilitySatisfied: true,
      oralProcessing: "",
      oralRequiredCapability: "",
      oralCapabilitySatisfied: true,
      blockedReasons: ["legacy-stage-fallback"],
    };
  }

  let eligibleModes = eligibleHandlingModes(contract, settings);
  let biteRequiredCapability = String(contract.biteRequiredCapability || "");
  let biteReady = biteCapabilitySatisfied(biteRequiredCapability, settings);
  let oralRequiredCapability = String(contract.oralRequiredCapability || "");
  let oralReady = oralCapabilitySatisfied(oralRequiredCapability, settings);
  let blockedReasons = [];

  if (contract.modes?.length && !eligibleModes.length) {
    blockedReasons.push("handling-requirement");
  } else if (eligibleModes.length) {
    if (!biteReady) blockedReasons.push("bite-separation-requirement");
    if (!oralReady) blockedReasons.push("oral-processing-requirement");
    if (!biteReady || !oralReady) eligibleModes = [];
  }

  return {
    migrated: true,
    eligibleModes,
    preferredModes: preferredHandlingModes(
      eligibleModes,
      settings.feedingApproach,
      settings.textureStage,
    ),
    biteSeparation: String(contract.biteSeparation || ""),
    biteRequiredCapability,
    biteCapabilitySatisfied: biteReady,
    oralProcessing: String(contract.oralProcessing || ""),
    oralRequiredCapability,
    oralCapabilitySatisfied: oralReady,
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
      settings.textureStage,
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
    settings.textureStage,
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

function recipeContractFor(recipeState, contractMap = null) {
  let map = contractMap || (
    typeof RECIPE_HANDLING_CONTRACT !== "undefined"
      ? RECIPE_HANDLING_CONTRACT
      : {}
  );
  return recipeState?.name ? map?.[recipeState.name] || null : null;
}

function mergeRecipeHandlingState(recipeState, settings = {}, contractMap = null) {
  let contract = recipeContractFor(recipeState, contractMap);
  let handling = handlingEligibility(contract, settings);
  if (!handling.migrated) return {
    ...recipeState,
    handlingMigrated: false,
    handlingModes: [],
    preferredHandlingModes: [],
    biteSeparation: "",
    biteRequiredCapability: "",
    oralProcessing: "",
    oralRequiredCapability: "",
  };

  let requirementMissing = (recipeState.requirementMissing || []).filter(
    (item) => !String(item || "").startsWith("Konsistenz:"),
  );
  if (!handling.eligibleModes.length) {
    let capabilityReason = false;
    if (handling.blockedReasons.includes("bite-separation-requirement")) {
      requirementMissing.push("Bissabtrennung: gezieltes Abtrennen eines passenden Bissens noch nicht bestätigt");
      capabilityReason = true;
    }
    if (handling.blockedReasons.includes("oral-processing-requirement")) {
      requirementMissing.push("Orale Verarbeitung: strukturiertes Kauen noch nicht bestätigt");
      capabilityReason = true;
    }
    if (!capabilityReason) {
      if (
        contract?.requiredCapabilities?.["finger-small-soft"] === "small-soft-pieces"
      )
        requirementMissing.push("Darreichungsform: kleine weiche Stücke noch nicht bestätigt");
      else
        requirementMissing.push("Darreichungsform: aktuell noch nicht passend");
    }
  }

  let ingredientMissing = [...(recipeState.ingredientMissing || [])];
  let missing = [...ingredientMissing, ...requirementMissing];
  return {
    ...recipeState,
    note: contract?.noteOverride || recipeState.note,
    skillRequirement: contract?.servingRequirement || recipeState.skillRequirement,
    requirementMissing,
    missing,
    unlocked: missing.length === 0,
    almost: missing.length > 0 && missing.length <= 2,
    handlingMigrated: true,
    handlingModes: handling.eligibleModes,
    preferredHandlingModes: handling.preferredModes,
    biteSeparation: handling.biteSeparation,
    biteRequiredCapability: handling.biteRequiredCapability,
    oralProcessing: handling.oralProcessing,
    oralRequiredCapability: handling.oralRequiredCapability,
    laterKind: contract?.laterKind || "",
  };
}

const HANDLING_OPTION_COPY = Object.freeze({
  "spoon-smooth": Object.freeze({
    key: "pureed",
    label: "Fein und glatt vom Löffel",
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

function normalizeHandlingCapabilities(settings = {}) {
  settings.handlingCapabilities = {
    smallSoftPieces: settings?.handlingCapabilities?.smallSoftPieces === true,
    gradedBite: settings?.handlingCapabilities?.gradedBite === true,
    structuredChew: settings?.handlingCapabilities?.structuredChew === true,
  };
  return settings.handlingCapabilities;
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
    field.innerHTML = `<label>Beikostform</label><select id="feedingApproach"><option value="mixed">Gemischt</option><option value="spoon">Löffelkost</option><option value="fingerfood">Fingerfood</option></select><div class="small" style="margin-top:5px">Steuert, welche sicheren Darreichungsformen bevorzugt werden. Keine Entwicklungsstufe.</div>`;
    texture.closest(".field")?.insertAdjacentElement("afterend", field);
  }
  let select = document.getElementById("feedingApproach");
  if (select) select.value = normalizeFeedingApproach(state.settings.feedingApproach);

  normalizeHandlingCapabilities(state.settings);
  let capabilityField = document.getElementById("handlingCapabilitiesField");
  if (!capabilityField) {
    capabilityField = document.createElement("div");
    capabilityField.className = "field";
    capabilityField.id = "handlingCapabilitiesField";
    capabilityField.innerHTML = `<label>Aktuelle Essfähigkeiten</label>
      <label class="check-row"><input type="checkbox" id="smallSoftPiecesCapability"> Kleine weiche Stücke gezielt aufnehmen und sicher zum Mund führen</label>
      <label class="check-row"><input type="checkbox" id="gradedBiteCapability"> Mein Kind kann bei einem weichen, aber formstabilen Stück gezielt einen passenden Bissen abtrennen.</label>
      <label class="check-row"><input type="checkbox" id="structuredChewCapability"> Strukturierte weiche Bissen sicher im Mund bewegen und wiederholt zerkleinern</label>
      <div class="small" style="margin-top:5px">Nur bestätigen, wenn die Fähigkeit tatsächlich beobachtet wurde. Die Auswahl ist keine Altersstufe; Zähne sind keine Voraussetzung.</div>`;
    field.insertAdjacentElement("afterend", capabilityField);
  }
  let smallPieces = document.getElementById("smallSoftPiecesCapability");
  let gradedBite = document.getElementById("gradedBiteCapability");
  let structuredChew = document.getElementById("structuredChewCapability");
  if (smallPieces) smallPieces.checked = state.settings.handlingCapabilities.smallSoftPieces;
  if (gradedBite) gradedBite.checked = state.settings.handlingCapabilities.gradedBite;
  if (structuredChew) structuredChew.checked = state.settings.handlingCapabilities.structuredChew;
}

function textureCoachNextStep(stage = 1) {
  return {
    1: "Eine kleine Menge etwas dicker oder weich zerdrückt anbieten. Vertraute Konsistenzen dürfen parallel bleiben.",
    2: "Bei einer passenden Mahlzeit kleine weiche Stückchen testen. Vertraute Konsistenzen dürfen parallel bleiben.",
    3: "Zunehmend weiche familiennahe Formen ausprobieren, wenn das konkrete Lebensmittel oder Rezept dafür geeignet ist.",
    4: "Weiche familiennahe Formen passend zum jeweiligen Lebensmittel oder Rezept weiter anbieten.",
  }[Math.max(1, Math.min(4, Number(stage) || 1))];
}

function renderSimplifiedTextureCoach() {
  if (typeof document === "undefined" || typeof state === "undefined") return;
  let card = document.getElementById("textureCoachCard");
  if (!card) return;
  let stage = Math.max(1, Math.min(4, Number(state.settings.textureStage) || 1));
  let next = Math.min(4, stage + 1);
  let progress = [1, 2, 3, 4]
    .map(
      (n) =>
        `<span class="texture-step ${n <= stage ? "done" : n === next ? "next" : ""}"></span>`,
    )
    .join("");
  let guidanceLabel = stage < 4 ? "Nächster kleiner Schritt:" : "Aktueller Fokus:";
  card.innerHTML = `<details class="home-control-details">
    <summary>
      <span>
        <small>Konsistenz</small>
        <b>Stufe ${stage} · ${esc(textureName(stage))}</b>
      </span>
      <span class="pill dim">Aktuell</span>
    </summary>
    <div class="home-control-body">
      <div class="texture-track" aria-label="Konsistenzstufe ${stage} von 4">${progress}</div>
      <div class="small texture-coach-next-step"><b>${guidanceLabel}</b> ${esc(textureCoachNextStep(stage))}</div>
      <div class="small texture-coach-fingerfood-hint">Geeignetes weiches Fingerfood kann unabhängig von dieser Konsistenzstufe parallel angeboten werden. Die sichere Form richtet sich nach dem jeweiligen Lebensmittel oder Rezept.</div>
      <div class="texture-coach-actions">
        ${stage > 1 ? `<button class="btn secondary" id="textureBack">Zurück</button>` : ""}
        ${stage < 4 ? `<button class="btn secondary" id="textureNext">Stufe ${next} testen</button>` : ""}
      </div>
    </div>
  </details>`;
  if (document.getElementById("textureBack"))
    document.getElementById("textureBack").onclick = () =>
      setTextureStage(stage - 1);
  if (document.getElementById("textureNext"))
    document.getElementById("textureNext").onclick = () =>
      openTextureAdvance(next);
}

function installTextureCoachRuntime() {
  if (typeof renderTextureCoach !== "function") return false;
  if (renderTextureCoach.__textureProgressionSimplified) return false;
  let simplified = function simplifiedTextureCoachRuntime() {
    return renderSimplifiedTextureCoach();
  };
  simplified.__textureProgressionSimplified = true;
  renderTextureCoach = simplified;
  return true;
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
        lock?.mode === "auto" &&
        !lock.followUpFoodId &&
        plannedMeal.recipeName
      ) {
        let recipe = typeof recipeByName === "function"
          ? recipeByName(plannedMeal.recipeName)
          : { name: plannedMeal.recipeName };
        let handling = recipeHandlingEligibility(
          recipe,
          state.settings,
          RECIPE_HANDLING_CONTRACT,
        );
        if (handling.migrated && !handling.eligibleModes.length) {
          delete state.planLocks[key];
          if (typeof save === "function") save();
          return null;
        }
      }
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
  normalizeHandlingCapabilities(state.settings);

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

  installTextureCoachRuntime();
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
      state.settings.handlingCapabilities = {
        smallSoftPieces: document.getElementById("smallSoftPiecesCapability")?.checked === true,
        gradedBite: document.getElementById("gradedBiteCapability")?.checked === true,
        structuredChew: document.getElementById("structuredChewCapability")?.checked === true,
      };
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
    biteCapabilitySatisfied,
    oralCapabilitySatisfied,
    handlingModeTextureAllowed,
    eligibleHandlingModes,
    spoonModePreference,
    sortSpoonModesByTexture,
    preferredHandlingModes,
    handlingEligibility,
    recipeHandlingEligibility,
    foodHandlingEligibility,
    presentationModeForMeal,
    applyPresentationModeToAutomaticMeal,
    applyPresentationModesToDay,
    legacyRecipeStageAllowed,
    recipeContractFor,
    mergeRecipeHandlingState,
    handlingPreparationOptions,
    normalizeHandlingCapabilities,
    textureCoachNextStep,
    renderSimplifiedTextureCoach,
    installTextureCoachRuntime,
    plannerPageStartedAt,
    pruneCurrentPagePrePolicyAutoLocks,
    installPresentationModeRuntime,
    installHandlingReadinessRuntime,
  };
}