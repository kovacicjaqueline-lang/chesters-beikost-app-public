"use strict";

/* Tatsächliche Rezeptzutaten im eingefrorenen Vorrat.
 *
 * Diese Logik ist unabhängig von produktabhängigen Allergenen: Bei Rezepten
 * mit Varianten oder Auswahlzutaten wird die tatsächlich zubereitete Auswahl
 * bestätigt und im Vorrat festgehalten. Dadurch bleiben Plan, Vorrat und Log
 * auch ohne Produkt-/Sulfitdaten konsistent.
 */

function recipeInventoryBaseSets(recipe) {
  return [recipe?.requires || [], ...(recipe?.alternatives || [])]
    .filter((set, index) => set.length || index === 0);
}

function recipeInventoryNeedsExplicitChoice(recipe) {
  return recipeInventoryBaseSets(recipe).length > 1 ||
    (recipe?.oneOf || []).length > 1 ||
    (recipe?.milkChoices || []).length > 1;
}

function recipeInventoryFoodIdByName(name) {
  if (typeof foodByName === "function") return foodByName(name, state?.foods || [])?.id || "";
  let normalized = typeof normalizeName === "function" ? normalizeName(name) : String(name || "").toLowerCase();
  return (state?.foods || []).find((item) =>
    (typeof normalizeName === "function" ? normalizeName(item.name) : String(item.name || "").toLowerCase()) === normalized,
  )?.id || "";
}

function recipeInventoryChoiceState(recipe, presetFoodIds = []) {
  let preset = new Set(Array.isArray(presetFoodIds) ? presetFoodIds : []);
  let baseSets = recipeInventoryBaseSets(recipe);
  let baseIds = baseSets.map((set) => set.map(recipeInventoryFoodIdByName).filter(Boolean));
  let variantIndex = 0;
  let bestScore = -1;
  baseIds.forEach((ids, index) => {
    let score = ids.filter((id) => preset.has(id)).length +
      (ids.length && ids.every((id) => preset.has(id)) ? 1000 : 0);
    if (score > bestScore) {
      bestScore = score;
      variantIndex = index;
    }
  });
  let defaultIds = typeof recipeFoodIds === "function" ? recipeFoodIds(recipe) : [];
  if (!preset.size && defaultIds.length) {
    let defaults = new Set(defaultIds);
    let found = baseIds.findIndex((ids) => ids.length && ids.every((id) => defaults.has(id)));
    if (found >= 0) variantIndex = found;
  }
  let chooseFrom = (names) => {
    let ids = (names || []).map(recipeInventoryFoodIdByName).filter(Boolean);
    return ids.find((id) => preset.has(id)) || ids.find((id) => defaultIds.includes(id)) || ids[0] || "";
  };
  return {
    variantIndex,
    oneOfId: chooseFrom(recipe?.oneOf),
    milkChoiceId: chooseFrom(recipe?.milkChoices),
  };
}

function recipeInventoryActualFoodIds(recipe, choice) {
  if (!recipe) return [];
  let sets = recipeInventoryBaseSets(recipe);
  let selectedSet = sets[Math.max(0, Math.min(sets.length - 1, Number(choice?.variantIndex) || 0))] || [];
  let ids = selectedSet.map(recipeInventoryFoodIdByName).filter(Boolean);
  for (let id of [choice?.oneOfId, choice?.milkChoiceId]) if (id && !ids.includes(id)) ids.push(id);
  return [...new Set(ids)];
}

let recipeInventoryContext = null;

function selectedInventoryTarget() {
  let kind = document.getElementById("inventoryRecipeTab")?.classList.contains("active") ? "recipe" : "food";
  let selectedButton = document.querySelector(".chooseInventoryTarget.selected");
  let key = selectedButton?.dataset?.key ? decodeURIComponent(selectedButton.dataset.key) : "";
  if (!key) {
    let selectedText = document.querySelector(".selected-target b")?.textContent || "";
    key = selectedText.replace(/^Ausgewählt:\s*/, "").trim();
    if (kind === "food") key = state.foods.find((item) => item.name === key)?.id || "";
  }
  return { kind, key };
}

function inventoryTargetFoodIds(kind, key) {
  if (!key) return [];
  if (kind === "food") return [key];
  let recipe = (typeof RECIPES !== "undefined" ? RECIPES : []).find((item) => item.name === key);
  return recipe && typeof recipeFoodIds === "function" ? recipeFoodIds(recipe) : [];
}

function recipeInventoryEnsureChoice(recipeName) {
  if (!recipeInventoryContext || !recipeName) return null;
  recipeInventoryContext.choices ||= {};
  if (recipeInventoryContext.choices[recipeName]) return recipeInventoryContext.choices[recipeName];
  let recipe = typeof recipeByName === "function"
    ? recipeByName(recipeName)
    : (typeof RECIPES !== "undefined" ? RECIPES.find((item) => item.name === recipeName) : null);
  if (!recipe) return null;
  let presetIds = recipeInventoryContext.originalRecipeName === recipeName
    ? recipeInventoryContext.presetFoodIds
    : [];
  let choice = recipeInventoryChoiceState(recipe, presetIds);
  choice.confirmed = !recipeInventoryNeedsExplicitChoice(recipe) ||
    (recipeInventoryContext.originalRecipeName === recipeName && !!recipeInventoryContext.presetConfirmed);
  recipeInventoryContext.choices[recipeName] = choice;
  return choice;
}

if (typeof addInventoryForm === "function") {
  const baseAddInventoryForm = addInventoryForm;
  addInventoryForm = function addInventoryFormWithActualRecipeChoice(preset = {}) {
    let context = {
      editId: preset.editId || "",
      originalRecipeName: preset.recipeName || "",
      presetFoodIds: [...(preset.foodIds || [])],
      presetConfirmed: !!preset.actualRecipeIngredientsConfirmed,
      choices: {},
    };
    recipeInventoryContext = context;
    if (preset.recipeName) recipeInventoryEnsureChoice(preset.recipeName);
    let result = baseAddInventoryForm(preset);
    recipeInventoryContext = context;
    return result;
  };
}

if (typeof inventoryTargetFoodIds === "function") {
  const baseInventoryTargetFoodIds = inventoryTargetFoodIds;
  inventoryTargetFoodIds = function inventoryTargetFoodIdsWithActualRecipeChoice(kind, key) {
    if (kind !== "recipe") return baseInventoryTargetFoodIds(kind, key);
    let recipe = typeof recipeByName === "function"
      ? recipeByName(key)
      : (typeof RECIPES !== "undefined" ? RECIPES.find((item) => item.name === key) : null);
    if (!recipe) return [];
    let choice = recipeInventoryEnsureChoice(key) || recipeInventoryChoiceState(recipe, []);
    return recipeInventoryActualFoodIds(recipe, choice);
  };
}

function recipeInventoryChoiceHtml(recipe, choice) {
  if (!recipe || !choice || !recipeInventoryNeedsExplicitChoice(recipe)) return "";
  let parts = [];
  let sets = recipeInventoryBaseSets(recipe);
  if (sets.length > 1) {
    parts.push(`<div class="field"><label>Tatsächlich zubereitete Variante</label><select data-inventory-recipe-variant>${sets.map((set, index) => `<option value="${index}" ${index === Number(choice.variantIndex) ? "selected" : ""}>${esc(recipe.variantLabels?.[index] || set.join(" + ") || `Variante ${index + 1}`)}</option>`).join("")}</select></div>`);
  }
  let choiceSelect = (label, names, value, attr) => !(names || []).length ? "" : `<div class="field"><label>${esc(label)}</label><select ${attr}>${names.map((name) => { let id = recipeInventoryFoodIdByName(name); return `<option value="${esc(id)}" ${id === value ? "selected" : ""}>${esc(name)}</option>`; }).join("")}</select></div>`;
  parts.push(choiceSelect("Tatsächlich verwendete Auswahl", recipe.oneOf, choice.oneOfId, "data-inventory-recipe-oneof"));
  parts.push(choiceSelect("Tatsächlich verwendetes Milchprodukt", recipe.milkChoices, choice.milkChoiceId, "data-inventory-recipe-milk"));
  return `<div class="notice olive"><b>Tatsächliche Rezeptzutaten</b><div class="small">Für den eingefrorenen Vorrat wird die wirklich zubereitete Variante gespeichert, nicht die aktuelle Planner-Vorauswahl.</div></div>${parts.join("")}<label class="toggleline"><input type="checkbox" data-inventory-recipe-confirm ${choice.confirmed ? "checked" : ""}><span class="toggle-copy"><b>Diese Zutaten wurden tatsächlich verwendet</b><span class="small">Erst nach dieser Bestätigung kann der Rezeptvorrat gespeichert werden.</span></span></label>`;
}

function recipeInventoryRenderBox(box, target) {
  let recipe = target.kind === "recipe" && typeof recipeByName === "function" ? recipeByName(target.key) : null;
  let choice = recipe ? recipeInventoryEnsureChoice(target.key) : null;
  let ids = target.kind === "recipe" ? recipeInventoryActualFoodIds(recipe, choice) : [];
  if (!recipe || !recipeInventoryNeedsExplicitChoice(recipe)) return ids;
  box.innerHTML = `<summary>Tatsächliche Rezeptzutaten</summary><div style="margin-top:10px">${recipeInventoryChoiceHtml(recipe, choice)}</div>`;
  let rerender = () => {
    recipeInventoryRenderBox(box, target);
    box.open = true;
  };
  box.querySelector("[data-inventory-recipe-variant]")?.addEventListener("change", (event) => {
    choice.variantIndex = Number(event.target.value) || 0;
    choice.confirmed = false;
    rerender();
  });
  box.querySelector("[data-inventory-recipe-oneof]")?.addEventListener("change", (event) => {
    choice.oneOfId = event.target.value;
    choice.confirmed = false;
    rerender();
  });
  box.querySelector("[data-inventory-recipe-milk]")?.addEventListener("change", (event) => {
    choice.milkChoiceId = event.target.value;
    choice.confirmed = false;
    rerender();
  });
  box.querySelector("[data-inventory-recipe-confirm]")?.addEventListener("change", (event) => {
    choice.confirmed = !!event.target.checked;
    rerender();
  });
  return ids;
}

function recipeInventoryApplyConfirmedBatchIngredients(meal, enforceAutoEligibility = false) {
  if (!meal?.recipeInventoryId || typeof state === "undefined") return meal;
  let batch = state.inventory?.find((item) => item.id === meal.recipeInventoryId) || null;
  if (!batch || batch.kind !== "recipe" || batch.actualRecipeIngredientsConfirmed !== true || !Array.isArray(batch.foodIds) || !batch.foodIds.length) return meal;
  let ids = [...new Set(batch.foodIds.filter((id) => typeof food !== "function" || food(id)))];
  if (!ids.length) return meal;
  let isAutoEligible = (foodId) => {
    let item = typeof food === "function" ? food(foodId) : null;
    if (!item || item.active === false || item.autoPlan === false) return false;
    if (typeof status === "function" && status(item) === "Pausiert") return false;
    if (meal?.meal && Array.isArray(item.meals) && !item.meals.includes(meal.meal)) return false;
    if (typeof automaticFoodEligibility === "function") {
      let on = meal?.date || (typeof today === "function" ? today() : "");
      if (!automaticFoodEligibility(item, on, state?.settings || {})) return false;
    }
    return true;
  };
  if (enforceAutoEligibility && ids.some((id) => !isAutoEligible(id))) {
    meal.recipeInventoryId = "";
    if (meal.type === "Rezeptvorrat") meal.type = "Rezept";
    meal.note = [meal.note, "Der vorhandene Rezeptvorrat enthält aktuell nicht automatisch geeignete Zutaten und wird deshalb nicht automatisch verwendet."].filter(Boolean).join(" ");
    return meal;
  }
  meal.foodIds = ids;
  meal.focusId = ids.includes(meal.focusId) ? meal.focusId : ids[0];
  meal.baseFoodIds = [...ids];
  meal.sampleFoodIds = [];
  if (typeof foodRolesFor === "function") meal.foodRoles = foodRolesFor(ids, ids, []);
  if (typeof plannedMealAmounts === "function") {
    let allocation = plannedMealAmounts({ ...meal, ingredientAmounts: {} });
    meal.portionTargetGrams = allocation.targetGrams;
    meal.sampleTargetGrams = allocation.sampleGrams;
    meal.totalOfferedGrams = allocation.totalOfferedGrams;
    meal.ingredientAmounts = { ...allocation.amounts };
  }
  return meal;
}

if (typeof reserveMealInventory === "function") {
  const baseReserveMealInventory = reserveMealInventory;
  reserveMealInventory = function reserveMealInventoryWithActualRecipeBatch(meal, ctx) {
    let result = baseReserveMealInventory(meal, ctx);
    return recipeInventoryApplyConfirmedBatchIngredients(result || meal, true);
  };
}

if (typeof openLog === "function") {
  const baseOpenLog = openLog;
  openLog = function openLogWithActualRecipeBatch(plan) {
    if (!plan?.editId && plan?.recipeInventoryId) {
      plan = recipeInventoryApplyConfirmedBatchIngredients({ ...plan, foodIds: [...(plan.foodIds || [])], baseFoodIds: [...(plan.baseFoodIds || [])], sampleFoodIds: [...(plan.sampleFoodIds || [])] }, false);
    }
    return baseOpenLog(plan);
  };
}

function recipeInventoryQueueTask(callback) {
  if (typeof queueMicrotask === "function") queueMicrotask(callback);
  else Promise.resolve().then(callback);
}

function injectRecipeInventoryIngredients() {
  if (typeof document === "undefined" || !state || !document.getElementById("saveInv")) return;
  if (document.getElementById("recipeInventoryIngredients")) return;
  let target = typeof selectedInventoryTarget === "function" ? selectedInventoryTarget() : { kind: "", key: "" };
  if (target.kind !== "recipe" || !target.key) return;
  let recipe = typeof recipeByName === "function" ? recipeByName(target.key) : null;
  let choice = recipeInventoryEnsureChoice(target.key);
  if (!recipe || !choice || !recipeInventoryNeedsExplicitChoice(recipe)) return;
  let box = document.createElement("details");
  box.id = "recipeInventoryIngredients";
  box.className = "accordion";
  let note = document.querySelector(".inventory-form-note");
  if (!note) return;
  recipeInventoryRenderBox(box, target);
  note.parentNode.insertBefore(box, note);
  let saveButton = document.getElementById("saveInv");
  if (saveButton && !choice.confirmed) box.open = true;
  saveButton.addEventListener("click", (event) => {
    if (choice.confirmed) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showToast?.("Bitte die tatsächlich verwendeten Rezeptzutaten bestätigen.");
    box.open = true;
  }, { capture: true });

  let actualIds = () => recipeInventoryActualFoodIds(recipe, choice);
  saveButton.addEventListener("click", () => {
    let selectedIds = actualIds();
    let originalRecipeFoodIds = recipeFoodIds;
    recipeFoodIds = function recipeFoodIdsForActualInventoryBatch(recipeRecord) {
      let inventoryModalOpen = document.getElementById("genericModal")?.classList?.contains("open");
      if (inventoryModalOpen && recipeRecord?.name === target.key) return [...selectedIds];
      return originalRecipeFoodIds(recipeRecord);
    };
    recipeInventoryQueueTask(() => { recipeFoodIds = originalRecipeFoodIds; });
  }, { capture: true, once: true });

  let beforeIds = new Set(state.inventory.map((item) => item.id));
  saveButton.addEventListener("click", () => {
    let item = recipeInventoryContext?.editId
      ? state.inventory.find((entry) => entry.id === recipeInventoryContext.editId)
      : state.inventory.find((entry) => !beforeIds.has(entry.id));
    if (!item) return;
    item.foodIds = [...new Set(actualIds())];
    item.actualRecipeIngredientsConfirmed = true;
    save();
  }, { once: true });
}

if (typeof openGeneric === "function") {
  const baseOpenGeneric = openGeneric;
  openGeneric = function openGenericWithRecipeIngredients(title, body, onClose) {
    let result = baseOpenGeneric(title, body, onClose);
    if (title === "Vorrat hinzufügen" || title === "Vorrat bearbeiten") recipeInventoryQueueTask(injectRecipeInventoryIngredients);
    return result;
  };
}

function legacySulfiteValue(value) {
  let normalized = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return /(^|\s)(sulfit|sulfite|sulfites|sulphit|sulphite|sulphites|schwefeldioxid)(\s|$)/.test(normalized);
}

function stripLegacySulfiteValue(value) {
  let raw = String(value || "").trim();
  if (!raw || !legacySulfiteValue(raw)) return raw;
  let cleaned = raw
    .replace(/\b(?:sulfit|sulfite|sulfites|sulphit|sulphite|sulphites|schwefeldioxid)\b/gi, " ")
    .replace(/[()\[\]{}]/g, " ")
    .replace(/\s*(?:,|;|\/|\||\+|&|\bund\b|\band\b)\s*/gi, " / ")
    .replace(/(?:\s*\/\s*)+/g, " / ")
    .replace(/^\s*\/\s*|\s*\/\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return legacySulfiteValue(cleaned) ? "" : cleaned;
}

function removeLegacyProductData(migrated) {
  if (!migrated || typeof migrated !== "object") return migrated;
  delete migrated.products;
  delete migrated.productAllergenSchemaVersion;
  if (Array.isArray(migrated.foods)) {
    migrated.foods = migrated.foods.map((item) => {
      let allergenGroup = item?.allergenGroup;
      if (!legacySulfiteValue(allergenGroup)) return item;
      return { ...item, allergenGroup: stripLegacySulfiteValue(allergenGroup) };
    });
  }
  if (Array.isArray(migrated.logs)) {
    migrated.logs = migrated.logs.map((log) => {
      let { productAllergenSnapshots, ...rest } = log || {};
      return rest;
    });
  }
  if (Array.isArray(migrated.inventory)) {
    migrated.inventory = migrated.inventory.map((item) => {
      if (!item || typeof item !== "object") return item;
      let { productAllergenSnapshot, ingredientProductSnapshots, ...rest } = item;
      return rest;
    });
  }
  return migrated;
}

if (typeof migrateState === "function") {
  const baseMigrateState = migrateState;
  migrateState = function migrateStateWithoutProductSulfites(source) {
    return removeLegacyProductData(baseMigrateState(source));
  };
}

if (typeof validateBackup === "function") {
  const baseValidateBackup = validateBackup;
  validateBackup = async function validateBackupWithLegacyProductCompatibility(raw) {
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { return baseValidateBackup(raw); }
    let productSchema = Number(parsed?.productAllergenSchemaVersion || parsed?.payload?.productAllergenSchemaVersion || 0);
    if (parsed?.type === "chester-beikost-backup" && parsed.payload && Number(parsed.schemaVersion) === 6 && productSchema === 1) {
      if (typeof sha256Text === "function") {
        let checksum = await sha256Text(JSON.stringify(parsed.payload));
        if (parsed.checksum !== "unsupported" && checksum !== "unsupported" && checksum !== parsed.checksum) throw new Error("Die Backup-Datei scheint beschädigt oder verändert zu sein.");
      }
      if (typeof validateBackupPayloadShape === "function") validateBackupPayloadShape(parsed.payload);
      if (typeof stateSummary === "function") parsed.summary = stateSummary(parsed.payload);
      return parsed;
    }
    return baseValidateBackup(raw);
  };
}

if (typeof buildBackupPackage === "function") {
  const baseBuildBackupPackage = buildBackupPackage;
  buildBackupPackage = async function buildBackupPackageWithoutProductSulfites() {
    let pack = await baseBuildBackupPackage();
    pack.payload = removeLegacyProductData(pack.payload);
    pack.payload.schemaVersion = typeof SCHEMA_VERSION === "number" ? SCHEMA_VERSION : 5;
    pack.schemaVersion = pack.payload.schemaVersion;
    delete pack.productAllergenSchemaVersion;
    delete pack.payload.productAllergenSchemaVersion;
    pack.checksum = await sha256Text(JSON.stringify(pack.payload));
    if (typeof stateSummary === "function") pack.summary = stateSummary(pack.payload);
    return pack;
  };
}
