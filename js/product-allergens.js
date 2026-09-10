"use strict";

/* Produktabhängige Allergenkennzeichnungen
 * Sulfite sind keine intrinsische FOOD-Eigenschaft und werden deshalb bewusst
 * getrennt von allergenGroup, allergenFamily und foodFamily geführt.
 */

const PRODUCT_SULFITE_STATUS = Object.freeze({
  PRESENT: "present",
  ABSENT: "absent",
  UNKNOWN: "unknown",
});

function normalizeSulfiteStatus(value) {
  let raw = String(value || "").trim().toLowerCase();
  if (["present", "declared", "yes", "true"].includes(raw)) return PRODUCT_SULFITE_STATUS.PRESENT;
  if (["absent", "not_declared", "not-declared", "no"].includes(raw)) return PRODUCT_SULFITE_STATUS.ABSENT;
  return PRODUCT_SULFITE_STATUS.UNKNOWN;
}

function sulfiteStatusLabel(status) {
  return ({
    present: "Sulfite deklariert",
    absent: "Etikett geprüft – nicht deklariert",
    unknown: "Etikett nicht geprüft / unbekannt",
  })[normalizeSulfiteStatus(status)];
}

function sulfiteStatusClass(status) {
  return ({ present: "warn", absent: "ok", unknown: "dim" })[normalizeSulfiteStatus(status)] || "dim";
}

function emptyProductAllergenSnapshot(foodId = "") {
  return {
    foodId: String(foodId || ""),
    productId: "",
    productName: "",
    brand: "",
    productAllergens: { sulfites: PRODUCT_SULFITE_STATUS.UNKNOWN },
  };
}

function normalizeProductAllergenSnapshot(raw, foodId = "") {
  if (!raw || typeof raw !== "object") return emptyProductAllergenSnapshot(foodId);
  return {
    foodId: String(foodId || raw.foodId || ""),
    productId: String(raw.productId || ""),
    productName: String(raw.productName || raw.name || ""),
    brand: String(raw.brand || ""),
    productAllergens: {
      sulfites: normalizeSulfiteStatus(raw.productAllergens?.sulfites ?? raw.sulfites),
    },
  };
}

function productAllergenSnapshotHasConcreteProduct(snapshot) {
  return !!String(snapshot?.productId || snapshot?.productName || "").trim();
}

function normalizeConcreteProducts(records, foods = []) {
  let foodList = Array.isArray(foods) ? foods : [];
  let foodById = new Map(foodList.map((item) => [item?.id, item]).filter(([id]) => id));
  let seen = new Set();
  let result = [];
  (Array.isArray(records) ? records : []).forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    let rawFoodId = String(raw.foodId || "");
    let mappedFoodId = rawFoodId;
    if (typeof canonicalId === "function") mappedFoodId = canonicalId(rawFoodId, raw.foodName || "") || rawFoodId;
    if (!foodById.has(mappedFoodId) && raw.foodName && typeof normalizeName === "function") {
      let wanted = normalizeName(raw.foodName);
      let byName = foodList.find((item) => normalizeName(item?.name) === wanted);
      if (byName) mappedFoodId = byName.id;
    }
    let id = String(raw.id || `product-legacy-${index + 1}`);
    if (seen.has(id)) return;
    seen.add(id);
    result.push({
      ...raw,
      id,
      foodId: mappedFoodId,
      foodName: String(raw.foodName || foodById.get(mappedFoodId)?.name || ""),
      name: String(raw.name || raw.productName || "").trim(),
      brand: String(raw.brand || "").trim(),
      productAllergens: {
        ...(raw.productAllergens || {}),
        sulfites: normalizeSulfiteStatus(raw.productAllergens?.sulfites ?? raw.sulfites),
      },
    });
  });
  return result;
}

function productsForFood(foodId) {
  return (Array.isArray(state?.products) ? state.products : [])
    .filter((item) => item.foodId === foodId)
    .slice()
    .sort((a, b) => String(a.brand || a.name || "").localeCompare(String(b.brand || b.name || ""), "de"));
}

function concreteProduct(productId) {
  return (Array.isArray(state?.products) ? state.products : []).find((item) => item.id === productId) || null;
}

function snapshotForConcreteProduct(foodId, productId) {
  let item = concreteProduct(productId);
  if (!item || item.foodId !== foodId) return emptyProductAllergenSnapshot(foodId);
  return {
    foodId,
    productId: item.id,
    productName: item.name || item.foodName || "",
    brand: item.brand || "",
    productAllergens: { sulfites: normalizeSulfiteStatus(item.productAllergens?.sulfites) },
  };
}

function normalizeSnapshotMap(rawMap, foodIds = []) {
  let mapped = {};
  let source = rawMap && typeof rawMap === "object" ? rawMap : {};
  for (let [rawId, snapshot] of Object.entries(source)) {
    let id = rawId;
    if (typeof canonicalId === "function") id = canonicalId(rawId, snapshot?.foodName || "") || rawId;
    mapped[id] = normalizeProductAllergenSnapshot(snapshot, id);
  }
  let result = {};
  for (let id of [...new Set(Array.isArray(foodIds) ? foodIds : [])]) {
    result[id] = mapped[id] || emptyProductAllergenSnapshot(id);
  }
  return result;
}

function sulfiteAggregateStatus(foodIds, snapshots) {
  let ids = [...new Set(Array.isArray(foodIds) ? foodIds : [])];
  if (!ids.length) return PRODUCT_SULFITE_STATUS.UNKNOWN;
  let statuses = ids.map((id) => normalizeSulfiteStatus(snapshots?.[id]?.productAllergens?.sulfites));
  if (statuses.includes(PRODUCT_SULFITE_STATUS.PRESENT)) return PRODUCT_SULFITE_STATUS.PRESENT;
  if (statuses.includes(PRODUCT_SULFITE_STATUS.UNKNOWN)) return PRODUCT_SULFITE_STATUS.UNKNOWN;
  return PRODUCT_SULFITE_STATUS.ABSENT;
}

function preservedOrCurrentSnapshot(foodId, selectedProductId, previousSnapshot) {
  let previous = previousSnapshot ? normalizeProductAllergenSnapshot(previousSnapshot, foodId) : null;
  let selected = String(selectedProductId || "");
  if (previous && String(previous.productId || "") === selected) return previous;
  return selected ? snapshotForConcreteProduct(foodId, selected) : emptyProductAllergenSnapshot(foodId);
}

function productSnapshotLabel(snapshot) {
  if (!productAllergenSnapshotHasConcreteProduct(snapshot)) return "kein konkretes Produkt";
  return [snapshot.brand, snapshot.productName].filter(Boolean).join(" · ") || "konkretes Produkt";
}

if (typeof DEFAULT !== "undefined" && DEFAULT && !Array.isArray(DEFAULT.products)) DEFAULT.products = [];

if (typeof migrateState === "function") {
  const productAllergenBaseMigrateState = migrateState;
  migrateState = function migrateStateWithProductAllergens(source) {
    let migrated = productAllergenBaseMigrateState(source);
    migrated.products = normalizeConcreteProducts(source?.products, migrated.foods);
    migrated.logs = (Array.isArray(migrated.logs) ? migrated.logs : []).map((log) => ({
      ...log,
      productAllergenSnapshots: normalizeSnapshotMap(log.productAllergenSnapshots, log.foodIds),
    }));
    migrated.inventory = (Array.isArray(migrated.inventory) ? migrated.inventory : []).map((item) => {
      if (item.kind === "recipe") {
        return {
          ...item,
          ingredientProductSnapshots: normalizeSnapshotMap(item.ingredientProductSnapshots, item.foodIds),
        };
      }
      if (!item.foodId) return item;
      return {
        ...item,
        productAllergenSnapshot: normalizeProductAllergenSnapshot(item.productAllergenSnapshot, item.foodId),
      };
    });
    return migrated;
  };
}

function productAllergenFoodOptions(selectedId = "") {
  return (Array.isArray(state?.foods) ? state.foods : [])
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de"))
    .map((item) => `<option value="${esc(item.id)}" ${item.id === selectedId ? "selected" : ""}>${esc(item.name)}</option>`)
    .join("");
}

function productAllergenStatusOptions(status) {
  let current = normalizeSulfiteStatus(status);
  return `
    <label class="toggleline"><input type="radio" name="productSulfites" value="present" ${current === "present" ? "checked" : ""}><span class="toggle-copy"><b>Sulfite deklariert</b><span class="small">Auf dem konkreten Produkt angegeben.</span></span></label>
    <label class="toggleline"><input type="radio" name="productSulfites" value="absent" ${current === "absent" ? "checked" : ""}><span class="toggle-copy"><b>Etikett geprüft – nicht deklariert</b><span class="small">Nur für genau dieses geprüfte Produkt.</span></span></label>
    <label class="toggleline"><input type="radio" name="productSulfites" value="unknown" ${current === "unknown" ? "checked" : ""}><span class="toggle-copy"><b>Unbekannt</b><span class="small">Etikett nicht geprüft oder keine sichere Angabe.</span></span></label>`;
}

function openProductAllergenForm(foodId = "", productId = "") {
  let existing = concreteProduct(productId);
  let selectedFoodId = existing?.foodId || foodId || state?.foods?.[0]?.id || "";
  let status = normalizeSulfiteStatus(existing?.productAllergens?.sulfites);
  let body = `
    <div class="notice olive"><b>Konkretes Produkt, nicht das Lebensmittel allgemein</b><br><span class="small">Sulfite werden nur aus der tatsächlichen Kennzeichnung dieses Produkts übernommen. FOOD, Familien und Allergen-Wiederholungen bleiben unverändert.</span></div>
    <div class="field"><label>Lebensmittel</label><select id="productFoodId">${productAllergenFoodOptions(selectedFoodId)}</select></div>
    <div class="field"><label>Produkt / Variante</label><input id="productName" value="${esc(existing?.name || "")}" placeholder="z. B. Bio-Rosinen"></div>
    <div class="field"><label>Marke (optional)</label><input id="productBrand" value="${esc(existing?.brand || "")}" placeholder="z. B. Marke"></div>
    <div class="field"><label>Sulfite</label>${productAllergenStatusOptions(status)}</div>
    <div class="sticky-form-actions ds-actionbar">
      ${existing ? '<button class="btn danger" id="deleteConcreteProduct" type="button">Löschen</button>' : ""}
      <button class="btn secondary" id="cancelConcreteProduct" type="button">Abbrechen</button>
      <button class="btn" id="saveConcreteProduct" type="button">Speichern</button>
    </div>`;
  openGeneric(existing ? "Produkt bearbeiten" : "Konkretes Produkt erfassen", body);
  document.getElementById("cancelConcreteProduct").onclick = closeGeneric;
  document.getElementById("saveConcreteProduct").onclick = () => {
    let foodIdValue = document.getElementById("productFoodId").value;
    let name = document.getElementById("productName").value.trim();
    if (!foodIdValue || !name) {
      document.getElementById("productName")?.focus();
      showToast("Bitte Produkt oder Variante benennen.");
      return;
    }
    let now = new Date().toISOString();
    let values = {
      foodId: foodIdValue,
      foodName: food(foodIdValue)?.name || "",
      name,
      brand: document.getElementById("productBrand").value.trim(),
      productAllergens: {
        sulfites: normalizeSulfiteStatus(document.querySelector('input[name="productSulfites"]:checked')?.value),
      },
      updatedAt: now,
    };
    if (existing) Object.assign(existing, values);
    else {
      state.products ||= [];
      state.products.push({ id: `product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: now, ...values });
    }
    save();
    closeGeneric();
    renderAll();
    if (document.getElementById("logModal")?.classList.contains("open") && typeof renderLogForm === "function") renderLogForm();
    showToast("Produktkennzeichnung gespeichert.");
  };
  document.getElementById("deleteConcreteProduct")?.addEventListener("click", () => {
    state.products = (state.products || []).filter((item) => item.id !== existing.id);
    save();
    closeGeneric();
    renderAll();
    if (document.getElementById("logModal")?.classList.contains("open") && typeof renderLogForm === "function") renderLogForm();
    showToast("Produkt gelöscht. Historische Einträge bleiben unverändert.");
  });
}

function renderProductAllergenCard() {
  if (typeof document === "undefined" || !state) return;
  let more = document.getElementById("more");
  if (!more) return;
  let card = document.getElementById("productAllergenCard");
  if (!card) {
    card = document.createElement("div");
    card.id = "productAllergenCard";
    card.className = "card product-allergen-card";
    let anchor = more.querySelector(".allergen-card");
    if (anchor) more.insertBefore(card, anchor);
    else more.appendChild(card);
  }
  let products = Array.isArray(state.products) ? state.products : [];
  let rows = products.length ? products.map((item) => {
    let f = food(item.foodId);
    let status = normalizeSulfiteStatus(item.productAllergens?.sulfites);
    let title = [item.brand, item.name].filter(Boolean).join(" · ") || item.name || "Produkt";
    return `<div class="row" style="align-items:flex-start;margin-top:9px"><div class="grow"><b>${esc(title)}</b><div class="small">${esc(f?.name || item.foodName || item.foodId)} · ${esc(sulfiteStatusLabel(status))}</div></div><span class="pill ${sulfiteStatusClass(status)}">${esc(status === "present" ? "deklariert" : status === "absent" ? "geprüft" : "unbekannt")}</span><button class="iconbtn editConcreteProduct" data-product="${esc(item.id)}" aria-label="Produkt bearbeiten">✎</button></div>`;
  }).join("") : '<div class="empty">Noch kein konkretes Produkt erfasst. Generische Lebensmittel bleiben bei Sulfiten automatisch „unbekannt“.</div>';
  card.innerHTML = `<div class="row"><div class="grow"><div class="eyebrow">PRODUKTKENNZEICHNUNG</div><h3>Konkrete Produkte</h3><div class="small">Für produktabhängige Angaben wie Sulfite. Keine Allergen-Einführung oder Familienvererbung.</div></div><button class="btn secondary smallbtn" id="addConcreteProduct">+ Produkt</button></div><div style="margin-top:9px">${rows}</div>`;
  document.getElementById("addConcreteProduct").onclick = () => openProductAllergenForm();
  card.querySelectorAll(".editConcreteProduct").forEach((button) => button.onclick = () => openProductAllergenForm("", button.dataset.product));
}

if (typeof renderAll === "function") {
  const productAllergenBaseRenderAll = renderAll;
  renderAll = function renderAllWithProductAllergens() {
    productAllergenBaseRenderAll();
    renderProductAllergenCard();
  };
}

if (typeof renderView === "function") {
  const productAllergenBaseRenderView = renderView;
  renderView = function renderViewWithProductAllergens(id) {
    let result = productAllergenBaseRenderView(id);
    if (id === "more") renderProductAllergenCard();
    return result;
  };
}

function productAllergenLogSelection(foodId) {
  pendingLog.productSelections ||= {};
  if (Object.prototype.hasOwnProperty.call(pendingLog.productSelections, foodId)) return String(pendingLog.productSelections[foodId] || "");
  let fromSnapshot = String(pendingLog.productAllergenSnapshots?.[foodId]?.productId || "");
  pendingLog.productSelections[foodId] = fromSnapshot;
  return fromSnapshot;
}

function productAllergenSelectHtml(foodId) {
  let selected = productAllergenLogSelection(foodId);
  let options = productsForFood(foodId).map((item) => {
    let label = [item.brand, item.name].filter(Boolean).join(" · ") || item.name;
    let status = sulfiteStatusLabel(item.productAllergens?.sulfites);
    return `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc(label)} · ${esc(status)}</option>`;
  }).join("");
  return `<div class="field product-allergen-log-row" data-product-row="${esc(foodId)}"><label>${esc(food(foodId)?.name || foodId)}</label><div class="row"><select class="grow" data-product-food="${esc(foodId)}"><option value="">Kein konkretes Produkt · unbekannt</option>${options}</select><button class="btn secondary smallbtn addProductForLog" type="button" data-food="${esc(foodId)}">+ Produkt</button></div><div class="small" data-product-status="${esc(foodId)}"></div></div>`;
}

function currentLogDraftSnapshots() {
  let ids = [...selectedLogFoods];
  let result = {};
  let recipeBatch = null;
  let recipeBatchId = typeof selectedRecipeInventoryId !== "undefined" && selectedRecipeInventoryId ? selectedRecipeInventoryId : pendingLog?.recipeInventoryId;
  if (recipeBatchId) recipeBatch = state.inventory.find((item) => item.id === recipeBatchId && item.kind === "recipe") || null;
  for (let id of ids) {
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
}

function updateLogProductStatusUi() {
  if (!pendingLog) return;
  document.querySelectorAll("[data-product-food]").forEach((select) => {
    pendingLog.productSelections ||= {};
    pendingLog.productSelections[select.dataset.productFood] = select.value;
    let snapshot = select.value ? snapshotForConcreteProduct(select.dataset.productFood, select.value) : emptyProductAllergenSnapshot(select.dataset.productFood);
    let statusNode = document.querySelector(`[data-product-status="${select.dataset.productFood}"]`);
    if (statusNode) statusNode.textContent = `${productSnapshotLabel(snapshot)} · ${sulfiteStatusLabel(snapshot.productAllergens.sulfites)}`;
  });
  let summary = document.getElementById("logProductAllergenSummary");
  if (summary) {
    let status = sulfiteAggregateStatus([...selectedLogFoods], currentLogDraftSnapshots());
    summary.innerHTML = `<b>Rezept-/Mahlzeitenstatus Sulfite:</b> ${esc(sulfiteStatusLabel(status))}`;
  }
}

function injectLogProductAllergens() {
  if (typeof document === "undefined" || !pendingLog) return;
  let form = document.getElementById("logForm");
  if (!form || form.querySelector("#logProductAllergens")) return;
  let actions = form.querySelector(".sticky-form-actions");
  if (!actions) return;
  let ids = [...selectedLogFoods];
  if (!ids.length) return;
  let wrapper = document.createElement("details");
  wrapper.id = "logProductAllergens";
  wrapper.className = "accordion";
  wrapper.innerHTML = `<summary>Konkrete Produkte & Sulfite</summary><div style="margin-top:10px"><div class="small">Nur tatsächliche Produktkennzeichnungen werden gespeichert. Ohne konkretes Produkt bleibt der Status unbekannt.</div>${ids.map(productAllergenSelectHtml).join("")}${pendingLog.recipeName ? '<div class="notice olive" id="logProductAllergenSummary" style="margin-top:8px"></div>' : ""}</div>`;
  actions.parentNode.insertBefore(wrapper, actions);
  wrapper.querySelectorAll("[data-product-food]").forEach((select) => select.addEventListener("change", updateLogProductStatusUi));
  wrapper.querySelectorAll(".addProductForLog").forEach((button) => button.onclick = () => {
    updateLogProductStatusUi();
    openProductAllergenForm(button.dataset.food);
  });
  updateLogProductStatusUi();
}

if (typeof renderLogForm === "function") {
  const productAllergenBaseRenderLogForm = renderLogForm;
  renderLogForm = function renderLogFormWithProductAllergens() {
    productAllergenBaseRenderLogForm();
    injectLogProductAllergens();
  };
}

if (typeof captureLogDraft === "function") {
  const productAllergenBaseCaptureLogDraft = captureLogDraft;
  captureLogDraft = function captureLogDraftWithProductAllergens(options = {}) {
    productAllergenBaseCaptureLogDraft(options);
    if (!pendingLog) return;
    pendingLog.productSelections ||= {};
    document.querySelectorAll("[data-product-food]").forEach((select) => pendingLog.productSelections[select.dataset.productFood] = select.value);
  };
}

if (typeof saveLog === "function") {
  const productAllergenBaseSaveLog = saveLog;
  saveLog = function saveLogWithProductAllergens() {
    if (!pendingLog) return productAllergenBaseSaveLog();
    if (typeof captureLogDraft === "function") captureLogDraft();
    let editId = pendingLog.editId || "";
    let beforeRef = editId ? state.logs.find((log) => log.id === editId) : null;
    let beforeIds = new Set(state.logs.map((log) => log.id));
    let snapshots = currentLogDraftSnapshots();
    productAllergenBaseSaveLog();
    let savedLog = editId
      ? state.logs.find((log) => log.id === editId)
      : state.logs.find((log) => !beforeIds.has(log.id));
    if (!savedLog || (editId && savedLog === beforeRef)) return;
    savedLog.productAllergenSnapshots = normalizeSnapshotMap(snapshots, savedLog.foodIds);
    save();
    renderAll();
  };
}

if (typeof logOutcomeGridHtml === "function") {
  const productAllergenBaseLogOutcomeGridHtml = logOutcomeGridHtml;
  logOutcomeGridHtml = function logOutcomeGridHtmlWithProductAllergens(log) {
    let html = productAllergenBaseLogOutcomeGridHtml(log);
    let snapshots = log?.productAllergenSnapshots || {};
    let concrete = (log?.foodIds || []).some((id) => productAllergenSnapshotHasConcreteProduct(snapshots[id]));
    if (!concrete) return html;
    let status = sulfiteAggregateStatus(log.foodIds, snapshots);
    return `${html}<div class="small log-entry-product-allergen"><b>Sulfite:</b> ${esc(sulfiteStatusLabel(status))}</div>`;
  };
}

let productAllergenInventoryContext = null;

function inventoryProductSelectionsFromPreset(preset) {
  let selections = {};
  let originals = {};
  if (preset?.kind === "recipe" || preset?.recipeName) {
    for (let [id, snapshot] of Object.entries(preset.ingredientProductSnapshots || {})) {
      let normalized = normalizeProductAllergenSnapshot(snapshot, id);
      selections[id] = normalized.productId || "";
      originals[id] = normalized;
    }
  } else if (preset?.foodId) {
    let normalized = normalizeProductAllergenSnapshot(preset.productAllergenSnapshot, preset.foodId);
    selections[preset.foodId] = normalized.productId || "";
    originals[preset.foodId] = normalized;
  }
  return { selections, originals };
}

if (typeof addInventoryForm === "function") {
  const productAllergenBaseAddInventoryForm = addInventoryForm;
  addInventoryForm = function addInventoryFormWithProductAllergens(preset = {}) {
    let initial = inventoryProductSelectionsFromPreset(preset);
    productAllergenInventoryContext = {
      editId: preset.editId || "",
      selections: initial.selections,
      originals: initial.originals,
    };
    return productAllergenBaseAddInventoryForm(preset);
  };
}

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

function attachInventorySnapshotsAfterSave(beforeIds, kind, foodIds) {
  let item = productAllergenInventoryContext?.editId
    ? state.inventory.find((entry) => entry.id === productAllergenInventoryContext.editId)
    : state.inventory.find((entry) => !beforeIds.has(entry.id));
  if (!item) return;
  if (kind === "recipe") {
    let snapshots = {};
    for (let id of item.foodIds || foodIds) {
      snapshots[id] = preservedOrCurrentSnapshot(id, productAllergenInventoryContext?.selections?.[id], productAllergenInventoryContext?.originals?.[id]);
    }
    item.ingredientProductSnapshots = normalizeSnapshotMap(snapshots, item.foodIds || foodIds);
  } else if (item.foodId) {
    item.productAllergenSnapshot = preservedOrCurrentSnapshot(item.foodId, productAllergenInventoryContext?.selections?.[item.foodId], productAllergenInventoryContext?.originals?.[item.foodId]);
  }
  save();
}

function injectInventoryProductAllergens() {
  if (typeof document === "undefined" || !state || !document.getElementById("saveInv")) return;
  if (document.getElementById("inventoryProductAllergens")) return;
  let target = selectedInventoryTarget();
  let ids = inventoryTargetFoodIds(target.kind, target.key);
  if (!ids.length) return;
  productAllergenInventoryContext ||= { editId: "", selections: {}, originals: {} };
  let note = document.querySelector(".inventory-form-note");
  if (!note) return;
  let box = document.createElement("details");
  box.id = "inventoryProductAllergens";
  box.className = "accordion";
  box.innerHTML = `<summary>Verwendete konkrete Produkte</summary><div style="margin-top:10px"><div class="small">Diese Auswahl wird mit dem eingefrorenen Batch gespeichert und später unverändert ins Protokoll übernommen.</div>${ids.map((id) => {
    let selected = String(productAllergenInventoryContext.selections[id] || "");
    let options = productsForFood(id).map((item) => `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc([item.brand, item.name].filter(Boolean).join(" · ") || item.name)} · ${esc(sulfiteStatusLabel(item.productAllergens?.sulfites))}</option>`).join("");
    return `<div class="field"><label>${esc(food(id)?.name || id)}</label><select data-inventory-product-food="${esc(id)}"><option value="">Kein konkretes Produkt · unbekannt</option>${options}</select></div>`;
  }).join("")}</div>`;
  note.parentNode.insertBefore(box, note);
  box.querySelectorAll("[data-inventory-product-food]").forEach((select) => select.addEventListener("change", () => {
    productAllergenInventoryContext.selections[select.dataset.inventoryProductFood] = select.value;
  }));
  let beforeIds = new Set(state.inventory.map((item) => item.id));
  document.getElementById("saveInv").addEventListener("click", () => {
    box.querySelectorAll("[data-inventory-product-food]").forEach((select) => productAllergenInventoryContext.selections[select.dataset.inventoryProductFood] = select.value);
    attachInventorySnapshotsAfterSave(beforeIds, target.kind, ids);
  }, { once: true });
}

function productAllergenQueueTask(callback) {
  if (typeof queueMicrotask === "function") queueMicrotask(callback);
  else Promise.resolve().then(callback);
}

if (typeof openGeneric === "function") {
  const productAllergenBaseOpenGeneric = openGeneric;
  openGeneric = function openGenericWithProductAllergens(title, body, onClose) {
    let result = productAllergenBaseOpenGeneric(title, body, onClose);
    if (title === "Vorrat hinzufügen" || title === "Vorrat bearbeiten") productAllergenQueueTask(injectInventoryProductAllergens);
    return result;
  };
}
