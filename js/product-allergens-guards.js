"use strict";

/* Schutzschicht für produktabhängige Sulfitdaten.
 * Hält historische Logs unabhängig von späteren Produkt-/Vorratsänderungen,
 * trennt nicht angebotene Zutaten aus der Sulfitbewertung und schützt
 * Custom-FOODs vor einer intrinsischen Sulfit-Zuordnung.
 */

const PRODUCT_ALLERGEN_DATA_SCHEMA_VERSION = 1;
const PRODUCT_ALLERGEN_BACKUP_SCHEMA_VERSION = 6;

function productAllergenForbiddenIntrinsicValue(value) {
  let normalized = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return /(^|\s)(sulfit|sulfite|sulfites|sulphit|sulphite|sulphites|schwefeldioxid)(\s|$)/.test(normalized);
}

function productAllergenApplicableFoodIds(foodIds, foodOutcomes = {}, fallbackOutcome = "") {
  return [...new Set(Array.isArray(foodIds) ? foodIds : [])]
    .filter((id) => String(foodOutcomes?.[id] || fallbackOutcome || "") !== "not_offered");
}

function productAllergenRecipeBatchSnapshotActive() {
  if (typeof pendingLog === "undefined" || !pendingLog || pendingLog.editId) return false;
  if (typeof selectedRecipeInventoryId === "undefined" || !selectedRecipeInventoryId) return false;
  let checkbox = typeof document !== "undefined" ? document.getElementById("useRecipeInventory") : null;
  return checkbox ? !!checkbox.checked : true;
}

function productAllergenCurrentLogOutcomes() {
  let outcomes = { ...((typeof pendingLog !== "undefined" && pendingLog?.foodOutcomes) || {}) };
  if (typeof document === "undefined" || typeof selectedLogFoods === "undefined") return outcomes;
  let sampleIds = new Set((typeof pendingLog !== "undefined" && pendingLog?.sampleFoodIds) || []);
  let main = document.getElementById("mainOutcome")?.value;
  if (main) {
    for (let id of selectedLogFoods) if (!sampleIds.has(id)) outcomes[id] = main;
  }
  let individual = !!document.getElementById("individualRatings")?.checked;
  if (individual) document.querySelectorAll?.("[data-individual-result]")?.forEach((select) => {
    outcomes[select.dataset.individualResult] = select.value;
  });
  document.querySelectorAll?.("[data-sample-result]")?.forEach((select) => {
    outcomes[select.dataset.sampleResult] = select.value;
  });
  return outcomes;
}

function productAllergenHistoricalOption(foodId, selectedProductId, currentProducts, previousSnapshot) {
  let selected = String(selectedProductId || "");
  if (!selected || (currentProducts || []).some((item) => item?.id === selected)) return "";
  let snapshot = typeof normalizeProductAllergenSnapshot === "function"
    ? normalizeProductAllergenSnapshot(previousSnapshot, foodId)
    : previousSnapshot;
  if (!snapshot || String(snapshot.productId || "") !== selected) return "";
  let label = typeof productSnapshotLabel === "function"
    ? productSnapshotLabel(snapshot)
    : [snapshot.brand, snapshot.productName].filter(Boolean).join(" · ") || "historisches Produkt";
  let status = typeof sulfiteStatusLabel === "function"
    ? sulfiteStatusLabel(snapshot.productAllergens?.sulfites)
    : String(snapshot.productAllergens?.sulfites || "unknown");
  let escape = typeof esc === "function" ? esc : (value) => String(value || "");
  return `<option value="${escape(selected)}" selected>${escape(label)} · historisch · ${escape(status)}</option>`;
}

if (typeof DEFAULT !== "undefined" && DEFAULT) DEFAULT.productAllergenSchemaVersion = PRODUCT_ALLERGEN_DATA_SCHEMA_VERSION;

if (typeof migrateState === "function") {
  const productAllergenGuardBaseMigrateState = migrateState;
  migrateState = function migrateStateWithProductAllergenGuards(source) {
    let migrated = productAllergenGuardBaseMigrateState(source);
    migrated.productAllergenSchemaVersion = PRODUCT_ALLERGEN_DATA_SCHEMA_VERSION;
    migrated.foods = (Array.isArray(migrated.foods) ? migrated.foods : []).map((item) => {
      if (!productAllergenForbiddenIntrinsicValue(item?.allergenGroup)) return item;
      return { ...item, allergenGroup: "" };
    });
    return migrated;
  };
}

if (typeof currentLogDraftSnapshots === "function") {
  currentLogDraftSnapshots = function currentLogDraftSnapshotsGuarded() {
    let ids = [...selectedLogFoods];
    let outcomes = productAllergenCurrentLogOutcomes();
    let result = {};
    let recipeBatch = null;
    if (productAllergenRecipeBatchSnapshotActive()) {
      recipeBatch = state.inventory.find((item) => item.id === selectedRecipeInventoryId && item.kind === "recipe") || null;
    }
    for (let id of ids) {
      if (outcomes[id] === "not_offered") {
        result[id] = emptyProductAllergenSnapshot(id);
        continue;
      }
      if (recipeBatch?.ingredientProductSnapshots?.[id]) {
        result[id] = normalizeProductAllergenSnapshot(recipeBatch.ingredientProductSnapshots[id], id);
        continue;
      }
      if (!pendingLog?.editId && typeof selectedInventoryFoods !== "undefined" && selectedInventoryFoods.has(id)) {
        let batch = state.inventory
          .filter((item) => item.kind !== "recipe" && item.foodId === id && Number(item.portions) > 0)
          .sort((a, b) => String(a.frozenDate || "").localeCompare(String(b.frozenDate || "")))[0];
        if (batch) {
          result[id] = normalizeProductAllergenSnapshot(batch.productAllergenSnapshot, id);
          continue;
        }
      }
      result[id] = preservedOrCurrentSnapshot(id, productAllergenLogSelection(id), pendingLog?.productAllergenSnapshots?.[id]);
    }
    return result;
  };
}

if (typeof productAllergenSelectHtml === "function") {
  productAllergenSelectHtml = function productAllergenSelectHtmlGuarded(foodId) {
    let selected = productAllergenLogSelection(foodId);
    let available = productsForFood(foodId);
    let previous = pendingLog?.productAllergenSnapshots?.[foodId];
    let historical = productAllergenHistoricalOption(foodId, selected, available, previous);
    let options = available.map((item) => {
      let label = [item.brand, item.name].filter(Boolean).join(" · ") || item.name;
      let status = sulfiteStatusLabel(item.productAllergens?.sulfites);
      return `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc(label)} · ${esc(status)}</option>`;
    }).join("");
    return `<div class="field product-allergen-log-row" data-product-row="${esc(foodId)}"><label>${esc(food(foodId)?.name || foodId)}</label><div class="row"><select class="grow" data-product-food="${esc(foodId)}"><option value="" ${selected ? "" : "selected"}>Kein konkretes Produkt · unbekannt</option>${historical}${options}</select><button class="btn secondary smallbtn addProductForLog" type="button" data-food="${esc(foodId)}">+ Produkt</button></div><div class="small" data-product-status="${esc(foodId)}"></div></div>`;
  };
}

if (typeof updateLogProductStatusUi === "function") {
  updateLogProductStatusUi = function updateLogProductStatusUiGuarded() {
    if (!pendingLog) return;
    document.querySelectorAll("[data-product-food]").forEach((select) => {
      let foodId = select.dataset.productFood;
      pendingLog.productSelections ||= {};
      pendingLog.productSelections[foodId] = select.value;
      let snapshot = preservedOrCurrentSnapshot(foodId, select.value, pendingLog.productAllergenSnapshots?.[foodId]);
      let statusNode = document.querySelector(`[data-product-status="${foodId}"]`);
      if (statusNode) statusNode.textContent = `${productSnapshotLabel(snapshot)} · ${sulfiteStatusLabel(snapshot.productAllergens.sulfites)}`;
    });
    let summary = document.getElementById("logProductAllergenSummary");
    if (summary) {
      let outcomes = productAllergenCurrentLogOutcomes();
      let ids = productAllergenApplicableFoodIds([...selectedLogFoods], outcomes, pendingLog?.outcome || "");
      let status = sulfiteAggregateStatus(ids, currentLogDraftSnapshots());
      summary.innerHTML = `<b>Rezept-/Mahlzeitenstatus Sulfite:</b> ${esc(sulfiteStatusLabel(status))}`;
    }
  };
}

if (typeof logOutcomeGridHtml === "function") {
  const productAllergenGuardBaseLogOutcomeGridHtml = logOutcomeGridHtml;
  logOutcomeGridHtml = function logOutcomeGridHtmlGuarded(log) {
    let html = productAllergenGuardBaseLogOutcomeGridHtml(log)
      .replace(/<div class="small log-entry-product-allergen"><b>Sulfite:<\/b>[^<]*(?:<[^>]+>[^<]*)*<\/div>\s*$/, "");
    let snapshots = log?.productAllergenSnapshots || {};
    let ids = productAllergenApplicableFoodIds(log?.foodIds, log?.foodOutcomes, log?.outcome);
    let concrete = ids.some((id) => productAllergenSnapshotHasConcreteProduct(snapshots[id]));
    if (!concrete) return html;
    let status = sulfiteAggregateStatus(ids, snapshots);
    return `${html}<div class="small log-entry-product-allergen"><b>Sulfite:</b> ${esc(sulfiteStatusLabel(status))}</div>`;
  };
}

if (typeof addCustomFoodForm === "function") {
  const productAllergenBaseAddCustomFoodForm = addCustomFoodForm;
  addCustomFoodForm = function addCustomFoodFormWithProductAllergenGuard(options = {}) {
    productAllergenBaseAddCustomFoodForm(options);
    let input = document.getElementById("customAllergen");
    let saveButton = document.getElementById("saveCustom");
    if (!input || !saveButton) return;
    let field = input.closest(".field");
    let label = field?.querySelector("label");
    if (label) label.textContent = "Intrinsische Allergengruppe (optional)";
    if (field && !field.querySelector(".product-allergen-custom-hint")) {
      input.insertAdjacentHTML("afterend", '<div class="small product-allergen-custom-hint">Produktabhängige Sulfite werden nicht hier eingetragen, sondern bei einem konkreten Produkt.</div>');
    }
    let originalSave = saveButton.onclick;
    saveButton.onclick = () => {
      field?.classList.remove("field-error");
      field?.querySelector(".product-allergen-custom-error")?.remove();
      if (productAllergenForbiddenIntrinsicValue(input.value)) {
        field?.classList.add("field-error");
        input.insertAdjacentHTML("afterend", '<div class="field-error-message product-allergen-custom-error">Sulfite sind produktabhängig. Bitte das Lebensmittel generisch speichern und anschließend ein konkretes Produkt erfassen.</div>');
        input.focus();
        return;
      }
      originalSave?.();
    };
  };
}

function productAllergenRecipeBaseSets(recipe) {
  return [recipe?.requires || [], ...(recipe?.alternatives || [])].filter((set, index) => set.length || index === 0);
}

function productAllergenFoodIdByName(name) {
  if (typeof foodByName === "function") return foodByName(name, state?.foods || [])?.id || "";
  let normalized = typeof normalizeName === "function" ? normalizeName(name) : String(name || "").toLowerCase();
  return (state?.foods || []).find((item) => (typeof normalizeName === "function" ? normalizeName(item.name) : String(item.name || "").toLowerCase()) === normalized)?.id || "";
}

function productAllergenRecipeChoiceState(recipe, presetFoodIds = []) {
  let preset = new Set(Array.isArray(presetFoodIds) ? presetFoodIds : []);
  let baseSets = productAllergenRecipeBaseSets(recipe);
  let baseIds = baseSets.map((set) => set.map(productAllergenFoodIdByName).filter(Boolean));
  let variantIndex = 0;
  let bestScore = -1;
  baseIds.forEach((ids, index) => {
    let score = ids.filter((id) => preset.has(id)).length + (ids.length && ids.every((id) => preset.has(id)) ? 1000 : 0);
    if (score > bestScore) { bestScore = score; variantIndex = index; }
  });
  let defaultIds = typeof recipeFoodIds === "function" ? recipeFoodIds(recipe) : [];
  if (!preset.size && defaultIds.length) {
    let defaults = new Set(defaultIds);
    let found = baseIds.findIndex((ids) => ids.length && ids.every((id) => defaults.has(id)));
    if (found >= 0) variantIndex = found;
  }
  let chooseFrom = (names) => {
    let ids = (names || []).map(productAllergenFoodIdByName).filter(Boolean);
    return ids.find((id) => preset.has(id)) || ids.find((id) => defaultIds.includes(id)) || ids[0] || "";
  };
  return {
    variantIndex,
    oneOfId: chooseFrom(recipe?.oneOf),
    milkChoiceId: chooseFrom(recipe?.milkChoices),
  };
}

function productAllergenRecipeActualFoodIds(recipe, choice) {
  if (!recipe) return [];
  let sets = productAllergenRecipeBaseSets(recipe);
  let selectedSet = sets[Math.max(0, Math.min(sets.length - 1, Number(choice?.variantIndex) || 0))] || [];
  let ids = selectedSet.map(productAllergenFoodIdByName).filter(Boolean);
  for (let id of [choice?.oneOfId, choice?.milkChoiceId]) if (id && !ids.includes(id)) ids.push(id);
  return [...new Set(ids)];
}

function productAllergenEnsureRecipeChoice(recipeName) {
  if (!productAllergenInventoryContext || !recipeName) return null;
  productAllergenInventoryContext.recipeChoices ||= {};
  if (productAllergenInventoryContext.recipeChoices[recipeName]) return productAllergenInventoryContext.recipeChoices[recipeName];
  let recipe = typeof recipeByName === "function" ? recipeByName(recipeName) : (typeof RECIPES !== "undefined" ? RECIPES.find((item) => item.name === recipeName) : null);
  if (!recipe) return null;
  let presetIds = productAllergenInventoryContext.originalRecipeName === recipeName ? productAllergenInventoryContext.presetFoodIds : [];
  let choice = productAllergenRecipeChoiceState(recipe, presetIds);
  productAllergenInventoryContext.recipeChoices[recipeName] = choice;
  return choice;
}

if (typeof addInventoryForm === "function") {
  const productAllergenGuardBaseAddInventoryForm = addInventoryForm;
  addInventoryForm = function addInventoryFormWithSulfiteRecipeChoices(preset = {}) {
    let initial = typeof inventoryProductSelectionsFromPreset === "function" ? inventoryProductSelectionsFromPreset(preset) : { selections: {}, originals: {} };
    let context = {
      editId: preset.editId || "",
      selections: initial.selections,
      originals: initial.originals,
      originalRecipeName: preset.recipeName || "",
      presetFoodIds: [...(preset.foodIds || [])],
      recipeChoices: {},
    };
    productAllergenInventoryContext = context;
    if (preset.recipeName) productAllergenEnsureRecipeChoice(preset.recipeName);
    let result = productAllergenGuardBaseAddInventoryForm(preset);
    // Der bestehende Produktebenen-Wrapper initialisiert während des Aufrufs ebenfalls
    // seinen Kontext. Danach stellen wir den erweiterten Kontext wieder her; der
    // über openGeneric eingeplante UI-Hook läuft erst im anschließenden Microtask.
    productAllergenInventoryContext = context;
    return result;
  };
}

if (typeof inventoryTargetFoodIds === "function") {
  const productAllergenGuardBaseInventoryTargetFoodIds = inventoryTargetFoodIds;
  inventoryTargetFoodIds = function inventoryTargetFoodIdsWithActualRecipeChoice(kind, key) {
    if (kind !== "recipe") return productAllergenGuardBaseInventoryTargetFoodIds(kind, key);
    let recipe = typeof recipeByName === "function" ? recipeByName(key) : (typeof RECIPES !== "undefined" ? RECIPES.find((item) => item.name === key) : null);
    if (!recipe) return [];
    let choice = productAllergenEnsureRecipeChoice(key) || productAllergenRecipeChoiceState(recipe, []);
    return productAllergenRecipeActualFoodIds(recipe, choice);
  };
}

function productAllergenRecipeChoiceHtml(recipe, choice) {
  if (!recipe || !choice) return "";
  let parts = [];
  let sets = productAllergenRecipeBaseSets(recipe);
  if (sets.length > 1) {
    parts.push(`<div class="field"><label>Tatsächlich zubereitete Variante</label><select data-inventory-recipe-variant>${sets.map((set, index) => `<option value="${index}" ${index === Number(choice.variantIndex) ? "selected" : ""}>${esc(recipe.variantLabels?.[index] || set.join(" + ") || `Variante ${index + 1}`)}</option>`).join("")}</select></div>`);
  }
  let choiceSelect = (label, names, value, attr) => {
    if (!(names || []).length) return "";
    return `<div class="field"><label>${esc(label)}</label><select ${attr}>${names.map((name) => { let id = productAllergenFoodIdByName(name); return `<option value="${esc(id)}" ${id === value ? "selected" : ""}>${esc(name)}</option>`; }).join("")}</select></div>`;
  };
  parts.push(choiceSelect("Tatsächlich verwendete Auswahl", recipe.oneOf, choice.oneOfId, "data-inventory-recipe-oneof"));
  parts.push(choiceSelect("Tatsächlich verwendetes Milchprodukt", recipe.milkChoices, choice.milkChoiceId, "data-inventory-recipe-milk"));
  return parts.filter(Boolean).length ? `<div class="notice olive"><b>Tatsächliche Rezeptzutaten</b><div class="small">Für den eingefrorenen Batch wird die wirklich zubereitete Variante gespeichert, nicht die aktuelle Planner-Vorauswahl.</div></div>${parts.join("")}` : "";
}

function productAllergenInventoryRows(ids) {
  return ids.map((id) => {
    let selected = String(productAllergenInventoryContext?.selections?.[id] || "");
    let available = productsForFood(id);
    let historical = productAllergenHistoricalOption(id, selected, available, productAllergenInventoryContext?.originals?.[id]);
    let options = available.map((item) => `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc([item.brand, item.name].filter(Boolean).join(" · ") || item.name)} · ${esc(sulfiteStatusLabel(item.productAllergens?.sulfites))}</option>`).join("");
    return `<div class="field"><label>${esc(food(id)?.name || id)}</label><select data-inventory-product-food="${esc(id)}"><option value="" ${selected ? "" : "selected"}>Kein konkretes Produkt · unbekannt</option>${historical}${options}</select></div>`;
  }).join("");
}

function productAllergenCaptureInventorySelections(root = document) {
  root.querySelectorAll?.("[data-inventory-product-food]")?.forEach((select) => {
    productAllergenInventoryContext.selections[select.dataset.inventoryProductFood] = select.value;
  });
}

function productAllergenRenderInventoryBox(box, target) {
  let recipe = target.kind === "recipe" && typeof recipeByName === "function" ? recipeByName(target.key) : null;
  let choice = recipe ? productAllergenEnsureRecipeChoice(target.key) : null;
  let ids = target.kind === "recipe" ? productAllergenRecipeActualFoodIds(recipe, choice) : [target.key].filter(Boolean);
  box.innerHTML = `<summary>Verwendete konkrete Produkte</summary><div style="margin-top:10px"><div class="small">Diese Auswahl wird mit dem eingefrorenen Batch gespeichert und später unverändert ins Protokoll übernommen.</div>${productAllergenRecipeChoiceHtml(recipe, choice)}${productAllergenInventoryRows(ids)}</div>`;
  box.querySelectorAll("[data-inventory-product-food]").forEach((select) => select.addEventListener("change", () => {
    productAllergenInventoryContext.selections[select.dataset.inventoryProductFood] = select.value;
  }));
  let rerender = () => {
    productAllergenCaptureInventorySelections(box);
    productAllergenRenderInventoryBox(box, target);
    box.open = true;
  };
  box.querySelector("[data-inventory-recipe-variant]")?.addEventListener("change", (event) => { choice.variantIndex = Number(event.target.value) || 0; rerender(); });
  box.querySelector("[data-inventory-recipe-oneof]")?.addEventListener("change", (event) => { choice.oneOfId = event.target.value; rerender(); });
  box.querySelector("[data-inventory-recipe-milk]")?.addEventListener("change", (event) => { choice.milkChoiceId = event.target.value; rerender(); });
  return ids;
}

if (typeof attachInventorySnapshotsAfterSave === "function") {
  attachInventorySnapshotsAfterSave = function attachInventorySnapshotsAfterSaveGuarded(beforeIds, kind, foodIds) {
    let item = productAllergenInventoryContext?.editId
      ? state.inventory.find((entry) => entry.id === productAllergenInventoryContext.editId)
      : state.inventory.find((entry) => !beforeIds.has(entry.id));
    if (!item) return;
    if (kind === "recipe") {
      item.foodIds = [...new Set(foodIds || [])];
      let snapshots = {};
      for (let id of item.foodIds) snapshots[id] = preservedOrCurrentSnapshot(id, productAllergenInventoryContext?.selections?.[id], productAllergenInventoryContext?.originals?.[id]);
      item.ingredientProductSnapshots = normalizeSnapshotMap(snapshots, item.foodIds);
    } else if (item.foodId) {
      item.productAllergenSnapshot = preservedOrCurrentSnapshot(item.foodId, productAllergenInventoryContext?.selections?.[item.foodId], productAllergenInventoryContext?.originals?.[item.foodId]);
    }
    save();
  };
}

if (typeof injectInventoryProductAllergens === "function") {
  injectInventoryProductAllergens = function injectInventoryProductAllergensGuarded() {
    if (typeof document === "undefined" || !state || !document.getElementById("saveInv")) return;
    if (document.getElementById("inventoryProductAllergens")) return;
    let target = selectedInventoryTarget();
    if (!target.key) return;
    productAllergenInventoryContext ||= { editId: "", selections: {}, originals: {}, recipeChoices: {} };
    let note = document.querySelector(".inventory-form-note");
    if (!note) return;
    let box = document.createElement("details");
    box.id = "inventoryProductAllergens";
    box.className = "accordion";
    let ids = productAllergenRenderInventoryBox(box, target);
    note.parentNode.insertBefore(box, note);
    let beforeIds = new Set(state.inventory.map((item) => item.id));
    let saveButton = document.getElementById("saveInv");
    if (target.kind === "recipe" && typeof recipeFoodIds === "function") {
      saveButton.addEventListener("click", () => {
        productAllergenCaptureInventorySelections(box);
        let actualIds = inventoryTargetFoodIds("recipe", target.key);
        let originalRecipeFoodIds = recipeFoodIds;
        recipeFoodIds = function recipeFoodIdsForActualInventoryBatch(recipe) {
          let inventoryModalOpen = document.getElementById("genericModal")?.classList?.contains("open");
          if (inventoryModalOpen && recipe?.name === target.key) return [...actualIds];
          return originalRecipeFoodIds(recipe);
        };
        productAllergenQueueTask(() => { recipeFoodIds = originalRecipeFoodIds; });
      }, { capture: true, once: true });
    }
    saveButton.addEventListener("click", () => {
      productAllergenCaptureInventorySelections(box);
      let actualIds = target.kind === "recipe" ? inventoryTargetFoodIds("recipe", target.key) : ids;
      attachInventorySnapshotsAfterSave(beforeIds, target.kind, actualIds);
    }, { once: true });
  };
}

if (typeof calculateBatch === "function") {
  const productAllergenBaseCalculateBatch = calculateBatch;
  calculateBatch = function calculateBatchWithProductSnapshot() {
    let result = productAllergenBaseCalculateBatch();
    if (typeof document === "undefined") return result;
    let button = document.getElementById("saveBatchResult");
    let foodId = document.getElementById("batchFood")?.value || "";
    if (!button || !foodId) return result;
    let products = productsForFood(foodId);
    if (products.length) {
      let holder = document.createElement("div");
      holder.id = "batchProductAllergenChoice";
      holder.className = "field";
      holder.innerHTML = `<label>Konkretes Produkt (optional)</label><select id="batchConcreteProduct"><option value="">Kein konkretes Produkt · unbekannt</option>${products.map((item) => `<option value="${esc(item.id)}">${esc([item.brand, item.name].filter(Boolean).join(" · ") || item.name)} · ${esc(sulfiteStatusLabel(item.productAllergens?.sulfites))}</option>`).join("")}</select>`;
      button.parentNode.insertBefore(holder, button);
    }
    let original = button.onclick;
    button.onclick = () => {
      let selectedId = document.getElementById("batchConcreteProduct")?.value || "";
      let beforeIds = new Set(state.inventory.map((item) => item.id));
      original?.();
      let snapshot = selectedId ? snapshotForConcreteProduct(foodId, selectedId) : emptyProductAllergenSnapshot(foodId);
      state.inventory
        .filter((item) => !beforeIds.has(item.id) && item.kind !== "recipe" && item.foodId === foodId)
        .forEach((item) => { item.productAllergenSnapshot = normalizeProductAllergenSnapshot(snapshot, foodId); });
      save();
    };
    return result;
  };
}

if (typeof buildBackupPackage === "function") {
  const productAllergenBaseBuildBackupPackage = buildBackupPackage;
  buildBackupPackage = async function buildBackupPackageWithProductSchema() {
    let pack = await productAllergenBaseBuildBackupPackage();
    pack.schemaVersion = PRODUCT_ALLERGEN_BACKUP_SCHEMA_VERSION;
    pack.productAllergenSchemaVersion = PRODUCT_ALLERGEN_DATA_SCHEMA_VERSION;
    pack.payload ||= {};
    pack.payload.schemaVersion = PRODUCT_ALLERGEN_BACKUP_SCHEMA_VERSION;
    pack.payload.productAllergenSchemaVersion = PRODUCT_ALLERGEN_DATA_SCHEMA_VERSION;
    if (typeof sha256Text === "function") pack.checksum = await sha256Text(JSON.stringify(pack.payload));
    return pack;
  };
}

if (typeof validateBackup === "function") {
  const productAllergenBaseValidateBackup = validateBackup;
  validateBackup = async function validateBackupWithProductSchema(raw) {
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { return productAllergenBaseValidateBackup(raw); }
    let productSchema = Number(parsed?.productAllergenSchemaVersion || parsed?.payload?.productAllergenSchemaVersion || 0);
    if (parsed?.type === "chester-beikost-backup" && parsed.payload && Number(parsed.schemaVersion) === PRODUCT_ALLERGEN_BACKUP_SCHEMA_VERSION && productSchema === PRODUCT_ALLERGEN_DATA_SCHEMA_VERSION) {
      if (typeof sha256Text === "function") {
        let checksum = await sha256Text(JSON.stringify(parsed.payload));
        if (parsed.checksum !== "unsupported" && checksum !== "unsupported" && checksum !== parsed.checksum) throw new Error("Die Backup-Datei scheint beschädigt oder verändert zu sein.");
      }
      return parsed;
    }
    return productAllergenBaseValidateBackup(raw);
  };
}
