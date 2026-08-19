"use strict";

/*
 * Schmale Integrationsschicht für den einheitlichen Essenslog.
 * Der Log selbst lebt in log.js; hier werden nur bestehende Planner- und UI-
 * Ableitungen an die gemeinsame Semantik angebunden.
 */

function unifiedLearningLabel(meal, item = null) {
  let target = item || (typeof food === "function" ? food(meal?.focusId) : null);
  let itemRank = target && typeof rank === "function" ? rank(target) : 0;
  let itemStatus = target && typeof status === "function" ? status(target) : "";
  return learningRoleLabel(itemRank, itemStatus, meal?.type || "");
}

function unifiedSuccessfulMealSlotCount(on = today()) {
  return new Set(
    state.logs
      .filter((log) => {
        if (!log?.date || log.date > on || !logHasMealContext(log)) return false;
        let samples = new Set(log.sampleFoodIds || []);
        return (log.foodIds || []).some((id) => outcomeForFood(log, id) === "eaten" && !samples.has(id));
      })
      .map((log) => `${log.date}|${log.meal}`),
  ).size;
}

function unifiedEatenExposureCount(id) {
  return new Set(
    state.logs
      .filter((log) => (log.foodIds || []).includes(id) && outcomeForFood(log, id) === "eaten")
      .map(logExposureKey),
  ).size;
}

function unifiedTextureSuccessCount(stage = Number(state.settings.textureStage)) {
  return new Set(
    state.logs
      .filter((log) => logTextureStage(log) === Number(stage) && logPositiveOutcome(log, outcomeForFood))
      .map(logExposureKey),
  ).size;
}

function unifiedTextureName(stage = Number(state.settings.textureStage)) {
  return ({
    1: "glatt oder fein zerdrückt",
    2: "dick püriert oder weich zerdrückt",
    3: "weich stückig",
    4: "weiche Familienkost",
  })[Number(stage)] || "glatt oder fein zerdrückt";
}

function unifiedDishTitle(meal) {
  if (meal?.recipeName) return meal.recipeName;
  let samples = (meal?.sampleFoodIds || []).map(food).filter(Boolean);
  let bases = (meal?.baseFoodIds || []).map(food).filter(Boolean);
  if (samples.length) {
    let name = naturalFoodList(samples.map((item) => item.name));
    let role = unifiedLearningLabel(meal, samples[0]);
    if (!bases.length) return `${name} zur ${role}`;
    return `${naturalMealFoodTitle(bases)} mit ${name} zur ${role}`;
  }
  let all = (meal?.foodIds || []).map(food).filter(Boolean);
  if (!all.length) return "Mahlzeit";
  let fruit = all.find((item) => item.category === "Obst");
  let grain = all.find((item) => item.category === "Getreide/Stärke");
  let egg = all.find((item) => item.category === "Ei");
  if (meal.meal === "breakfast" && all.length === 2 && egg && fruit) return `Eierspeise mit ${fruit.name}`;
  if (meal.meal === "breakfast" && all.length === 2 && fruit && grain) return `${fruit.name}-${grain.name}-Brei`;
  return naturalMealFoodTitle(all);
}

function unifiedMealTypeText(meal) {
  let samples = (meal?.sampleFoodIds || []).map(food).filter(Boolean);
  if (meal?.recipeName) return "Rezept";
  if (!samples.length) return "Mahlzeit";
  let role = unifiedLearningLabel(meal, samples[0]);
  return (meal?.baseFoodIds || []).length ? `Mahlzeit mit ${role}` : role;
}

function unifiedCompactMealRolesHtml(meal) {
  let samples = (meal?.sampleFoodIds || []).map(food).filter(Boolean);
  let bases = (meal?.baseFoodIds || []).map(food).filter(Boolean);
  let all = [...new Map([...(bases || []), ...(samples || []), ...(meal?.foodIds || []).map(food).filter(Boolean)].map((item) => [item.id, item])).values()];
  if (all.length <= 1 && !meal?.recipeName) return "";
  if (samples.length) {
    let role = unifiedLearningLabel(meal, samples[0]);
    return `<div class="compact-role-list">${bases.length ? `<div class="compact-role-row"><b>${esc(bases.map((item) => item.name).join(" + "))}</b><span>Hauptmahlzeit</span></div>` : ""}<div class="compact-role-row sample"><b>${esc(samples.map((item) => item.name).join(" + "))}</b><span>${esc(role)}</span></div></div>`;
  }
  let rows = (meal?.foodIds || []).map(food).filter(Boolean).map((item, index) => `<div class="compact-role-row"><b>${esc(item.name)}</b><span>${index === 0 ? "Hauptmahlzeit" : "Bestandteil"}</span></div>`).join("");
  return rows ? `<div class="compact-role-list">${rows}</div>` : "";
}

function unifiedMealRolesHtml(meal) {
  let focus = food(meal?.focusId);
  let companions = (meal?.foodIds || []).filter((id) => id !== meal.focusId).map(food).filter(Boolean);
  let addons = (meal?.optionalAddons || []).map(food).filter(Boolean);
  let rows = `<div class="role-row"><div class="role-label">${esc(focusRole(meal?.type))}</div><div class="role-value">${esc(focus?.name || "")}</div></div>`;
  if (companions.length) {
    let introduction = ["neu", "gezielt wiederholen", "Allergen wiederholen", "manuell"].includes(meal?.type) && !isTrustedBase(focus);
    let label = introduction ? "Verträgliche Basis" : "Bekannte Kombination";
    rows += `<div class="role-row"><div class="role-label">${label}</div><div class="role-value">${companions.map((item) => esc(item.name)).join(" + ")}</div></div>`;
  }
  let addonLine = addons.length
    ? `<div class="optional-addon-line"><span>Optional:</span> ${addons.map((item) => esc(item.name)).join(" + ")}${addons.some((item) => normalizeName(item.name) === "rapsoel") ? " nach dem Erwärmen" : ""}</div>`
    : "";
  return `<div class="role-list">${rows}</div>${addonLine}`;
}

function unifiedManualMealValidation(plan, meal, on = today()) {
  let roles = manualMealRoleState(plan || {});
  let infos = Object.fromEntries(roles.ids.map((id) => [id, manualMealRoleInfo(id, meal, on, { recipeName: plan?.recipeName || "" })]));
  let excludedIds = roles.ids.filter((id) => infos[id].role === "excluded");
  let unsafeBaseIds = roles.bases.filter((id) => infos[id].role !== "base" && infos[id].role !== "excluded");
  let unsafeComponentIds = roles.components.filter((id) => infos[id].role === "sample");
  let unsafeIds = roles.ids.filter((id) => infos[id].role === "sample");
  let multipleUnsafeIds = unsafeIds.length > 1 ? unsafeIds : [];
  let messages = [];
  if (!roles.ids.length) messages.push("Bitte mindestens ein Lebensmittel auswählen.");
  if (excludedIds.length) messages.push(`Diese Lebensmittel sind für diesen Planplatz derzeit nicht auswählbar: ${excludedIds.map((id) => food(id)?.name || id).join(", ")}.`);
  if (unsafeBaseIds.length) messages.push(`Noch nicht als Hauptbasis geeignet: ${unsafeBaseIds.map((id) => food(id)?.name || id).join(", ")}. Bitte als bekannte Komponente oder Einführung kennzeichnen.`);
  if (unsafeComponentIds.length) messages.push(`Noch nicht als bekannte Komponente geeignet: ${unsafeComponentIds.map((id) => food(id)?.name || id).join(", ")}. Bitte als Einführung kennzeichnen oder entfernen.`);
  if (multipleUnsafeIds.length) messages.push(`Nur eine neue oder unsichere Einführung gleichzeitig: ${multipleUnsafeIds.map((id) => food(id)?.name || id).join(", ")}.`);
  return { ok: roles.ids.length > 0 && !excludedIds.length && !unsafeBaseIds.length && !unsafeComponentIds.length && !multipleUnsafeIds.length, ...roles, infos, excludedIds, unsafeBaseIds, unsafeComponentIds, unsafeIds, multipleUnsafeIds, messages, message: messages.join(" ") };
}

function unifiedFollowUpMealForLog(log, foodId) {
  if (logHasMealContext(log)) return log.meal;
  let item = food(foodId);
  let allowed = (item?.meals || []).filter((meal) => LOG_MEAL_KEYS.includes(meal));
  let phasePreferred = phaseMealKeys().find((meal) => allowed.includes(meal));
  return phasePreferred || allowed[0] || "lunch";
}

function unifiedFollowUpExplanation(record) {
  let item = food(record.foodId);
  let base = food(record.baseFoodId);
  let prep = record.preparationText ? ` Zubereitung: ${record.preparationText}` : "";
  if (record.baseMode === "none" || !base)
    return `${item?.name || "Lebensmittel"} bewusst ohne Basis als kleine Wiederholung anbieten.${prep}`;
  return `${item?.name || "Lebensmittel"} diesmal mit ${base.name}${(record.previousBaseIds || []).length ? " statt der bisherigen Basis" : " als sichere Basis"}.${prep}`;
}

function unifiedMealNote(meal) {
  if (!meal || !(meal.sampleFoodIds || []).length || !String(meal.note || "").includes("Kostprobe")) return meal;
  if (meal.type === "gezielt wiederholen") meal.note = "Wiederholung nach Pause erneut klein und getrennt bewerten.";
  else meal.note = "Neue Einführung separat oder in kleiner Menge mit der sicheren Basis anbieten.";
  return meal;
}

function unifiedRebuildFoodConsequences(foodId) {
  clearLogGeneratedState(foodId);
  let log = latestLogForFood(foodId);
  if (!log) return;
  let result = outcomeForFood(log, foodId);
  if (["eaten", "tried"].includes(result)) return;
  if (result === "reaction") {
    let item = food(foodId);
    if (item) {
      item.reactionPausePreviousStatus = item.manualStatus || "auto";
      item.reactionPauseSourceLogId = log.id;
      item.manualStatus = "Pausiert";
      cleanFoodFromFuturePlan(foodId);
    }
    return;
  }
  let meal = unifiedFollowUpMealForLog(log, foodId);
  if (result === "not_accepted") {
    scheduleFollowUp(foodId, log.date, meal, "rejection", log.rejectionStrength || "interest");
    return;
  }
  if (result === "not_offered") {
    let unavailable = log.focusId === foodId && log.notOfferedReason === "unavailable";
    if (unavailable) {
      state.shoppingHints[foodId] = { foodId, status: "needed", createdAt: new Date().toISOString(), sourceLogId: log.id };
      state.followUps[foodId] = { id: `${foodId}-${Date.now()}`, foodId, reason: "not_offered", detail: "unavailable", status: "awaiting_stock", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dueDate: "", meal, baseFoodId: "", baseMode: "none", alternativeBaseIds: [], previousBaseIds: priorBaseIds(foodId), preparationKey: "standard", preparationText: food(foodId)?.safeForm || "" };
      cleanFoodFromAutomaticFuturePlan(foodId);
    } else scheduleFollowUp(foodId, log.date, meal, "not_offered", "no_opportunity");
  }
}

function sanitizeUnifiedManualEditor() {
  let body = document.getElementById("genericBody");
  if (!body?.querySelector(".manual-role-overview")) return;
  body.querySelectorAll(".manual-role-heading").forEach((node) => {
    if (node.textContent.trim() === "Kostprobe") node.textContent = "Einführung und Wiederholung";
  });
  body.querySelectorAll(".setManualRole").forEach((button) => {
    if (!button.textContent.includes("Kostprobe")) return;
    let item = food(button.dataset.food);
    button.textContent = `Als ${learningRoleLabel(rank(item), status(item))}`;
  });
  body.querySelectorAll(".selectFood").forEach((button) => {
    let role = button.querySelector(".manual-role-type");
    if (!role || !role.textContent.includes("Kostprobe")) return;
    let item = food(button.dataset.food);
    let label = learningRoleLabel(rank(item), status(item));
    role.textContent = role.textContent.includes("pausiert") ? `${label} · pausiert` : label;
  });
  body.querySelectorAll(".selectRecipe .small").forEach((node) => {
    if (node.textContent.includes("Kostprobe:")) node.textContent = node.textContent.replace("Kostprobe:", "Einführung oder Wiederholung:");
  });
  let ok = body.querySelector(".manual-role-ok");
  if (ok?.textContent.includes("Kostprobe")) ok.textContent = "Hauptbasis und Lernrolle werden getrennt gespeichert.";
}

function bindUnifiedManualEditorSanitizer() {
  let body = document.getElementById("genericBody");
  if (!body || body.dataset.unifiedLogSanitizerBound) return;
  body.dataset.unifiedLogSanitizerBound = "true";
  let sanitizeAfterAction = () => queueMicrotask(sanitizeUnifiedManualEditor);
  body.addEventListener("click", sanitizeAfterAction);
  body.addEventListener("input", sanitizeAfterAction);
  body.addEventListener("change", sanitizeAfterAction);
}

function sanitizeUnifiedFoodCards() {
  document.querySelectorAll("#foodList .foodcard[data-food]").forEach((card) => {
    let item = food(card.dataset.food);
    let meta = card.querySelector(".foodmeta");
    if (!item || !meta || item.alias) return;
    let statusNode = meta.querySelector(".food-status-text");
    if (statusNode) meta.firstChild.nodeValue = `${foodCategoryLabel(item.category)} · `;
  });
}

function installUnifiedFoodLogPolicy() {
  if (globalThis.__unifiedFoodLogPolicyInstalled) return false;
  globalThis.__unifiedFoodLogPolicyInstalled = true;

  if (typeof successfulMealSlotCount === "function") successfulMealSlotCount = unifiedSuccessfulMealSlotCount;
  if (typeof eatenExposureCount === "function") eatenExposureCount = unifiedEatenExposureCount;
  if (typeof textureSuccessCount === "function") textureSuccessCount = unifiedTextureSuccessCount;
  if (typeof textureName === "function") textureName = unifiedTextureName;
  if (typeof dishTitle === "function") dishTitle = unifiedDishTitle;
  if (typeof mealTypeText === "function") mealTypeText = unifiedMealTypeText;
  if (typeof compactMealRolesHtml === "function") compactMealRolesHtml = unifiedCompactMealRolesHtml;
  if (typeof mealRolesHtml === "function") mealRolesHtml = unifiedMealRolesHtml;
  if (typeof manualMealValidation === "function") manualMealValidation = unifiedManualMealValidation;
  if (typeof rebuildFoodConsequences === "function") rebuildFoodConsequences = unifiedRebuildFoodConsequences;
  if (typeof followUpExplanation === "function") followUpExplanation = unifiedFollowUpExplanation;

  if (typeof buildDay === "function") {
    let originalBuildDay = buildDay;
    buildDay = function unifiedBuildDay(...args) {
      let day = originalBuildDay.apply(this, args);
      (day?.meals || []).forEach(unifiedMealNote);
      return day;
    };
  }

  if (typeof toggleEntryChooser === "function") {
    toggleEntryChooser = function unifiedEntryAction(_anchor, date = today()) {
      openLog({ date, meal: "", focusId: "", foodIds: [], baseFoodIds: [], sampleFoodIds: [], entryType: "food", foodOutcomes: {} });
    };
  }

  if (typeof renderTextureCoach === "function") {
    renderTextureCoach = function unifiedRenderTextureCoach() {
      let card = document.getElementById("textureCoachCard");
      if (!card) return;
      let stage = Number(state.settings.textureStage) || 1;
      let successes = unifiedTextureSuccessCount(stage);
      let next = Math.min(4, stage + 1);
      let suggest = stage < 4 && successes >= 4;
      let progress = [1, 2, 3, 4].map((n) => `<span class="texture-step ${n <= stage ? "done" : n === next ? "next" : ""}"></span>`).join("");
      card.innerHTML = `<details class="home-control-details"><summary><span><small>Konsistenz</small><b>Stufe ${stage} · ${esc(unifiedTextureName(stage))}</b></span><span class="pill ${suggest ? "ph" : "dim"}">${stage === 4 ? "Aktuell" : suggest ? "Test möglich" : "Aktuell"}</span></summary><div class="home-control-body"><div class="texture-track" aria-label="Konsistenzstufe ${stage} von 4">${progress}</div><div class="small">${successes} positive Texturerfahrung${successes === 1 ? "" : "en"} auf dieser Stufe.</div><div class="texture-coach-actions">${stage > 1 ? `<button class="btn secondary" id="textureBack">Zurück</button>` : ""}${stage < 4 ? `<button class="btn ${suggest ? "" : "secondary"}" id="textureNext">Stufe ${next} testen</button>` : ""}</div></div></details>`;
      document.getElementById("textureBack")?.addEventListener("click", () => setTextureStage(stage - 1));
      document.getElementById("textureNext")?.addEventListener("click", () => openTextureAdvance(next));
    };
  }

  if (typeof renderHome === "function") {
    let originalRenderHome = renderHome;
    renderHome = function unifiedRenderHome(...args) {
      let result = originalRenderHome(...args);
      let button = document.getElementById("homeAddEntry");
      if (button) {
        button.textContent = "＋ Eintrag";
        button.onclick = (event) => { event.preventDefault(); openLog(null); };
      }
      return result;
    };
  }

  if (typeof renderFoods === "function") {
    let originalRenderFoods = renderFoods;
    renderFoods = function unifiedRenderFoods(...args) {
      let result = originalRenderFoods(...args);
      sanitizeUnifiedFoodCards();
      return result;
    };
  }

  if (typeof openGeneric === "function") {
    let originalOpenGeneric = openGeneric;
    openGeneric = function unifiedOpenGeneric(...args) {
      let result = originalOpenGeneric(...args);
      bindUnifiedManualEditorSanitizer();
      sanitizeUnifiedManualEditor();
      return result;
    };
  }

  return true;
}

installUnifiedFoodLogPolicy();

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    if (typeof familySuccessfulExposureCount === "function") {
      familySuccessfulExposureCount = function unifiedFamilySuccessfulExposureCount(foodRecord, foods, logs, outcomeForFoodFn) {
        let ids = new Set(relatedFamilyFoodIds(foodRecord, foods));
        if (!ids.size) ids.add(foodRecord?.id);
        return new Set((logs || []).flatMap((log) => (log.foodIds || []).filter((id) => ids.has(id) && outcomeForFoodFn(log, id) === "eaten").map(() => logExposureKey(log)))).size;
      };
    }
  });
  window.addEventListener("load", () => {
    if (typeof textureName === "function") textureName = unifiedTextureName;
    let select = document.getElementById("feedingApproach");
    if (select) {
      let labels = { mixed: "Gemischt", spoon: "Löffelkost", fingerfood: "Fingerfood" };
      [...select.options].forEach((option) => { if (labels[option.value]) option.textContent = labels[option.value]; });
    }
    if (typeof renderAll === "function") renderAll();
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    unifiedSuccessfulMealSlotCount,
    unifiedEatenExposureCount,
    unifiedTextureSuccessCount,
    unifiedTextureName,
    unifiedFollowUpMealForLog,
    unifiedFollowUpExplanation,
    unifiedDishTitle,
    unifiedMealTypeText,
  };
}
