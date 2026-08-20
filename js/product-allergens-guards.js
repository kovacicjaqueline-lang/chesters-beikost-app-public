"use strict";

/* Schutzschicht für produktabhängige Sulfitdaten.
 * Hält historische Logs unabhängig von späteren Vorratsänderungen und verhindert,
 * dass Sulfite versehentlich als intrinsische Custom-FOOD-Allergengruppe gespeichert werden.
 */

function productAllergenRecipeBatchSnapshotActive() {
  if (typeof pendingLog === "undefined" || !pendingLog || pendingLog.editId) return false;
  if (typeof selectedRecipeInventoryId === "undefined" || !selectedRecipeInventoryId) return false;
  let checkbox = typeof document !== "undefined" ? document.getElementById("useRecipeInventory") : null;
  return checkbox ? !!checkbox.checked : true;
}

if (typeof currentLogDraftSnapshots === "function") {
  currentLogDraftSnapshots = function currentLogDraftSnapshotsGuarded() {
    let ids = [...selectedLogFoods];
    let result = {};
    let recipeBatch = null;
    if (productAllergenRecipeBatchSnapshotActive()) {
      recipeBatch = state.inventory.find((item) => item.id === selectedRecipeInventoryId && item.kind === "recipe") || null;
    }
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
  };
}

function productAllergenForbiddenIntrinsicValue(value) {
  let normalized = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return /(^|\s)(sulfit|sulfite|sulfites|sulphit|sulphite|sulphites|schwefeldioxid)(\s|$)/.test(normalized);
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
      input.insertAdjacentHTML(
        "afterend",
        '<div class="small product-allergen-custom-hint">Produktabhängige Sulfite werden nicht hier eingetragen, sondern bei einem konkreten Produkt.</div>',
      );
    }

    let originalSave = saveButton.onclick;
    saveButton.onclick = () => {
      field?.classList.remove("field-error");
      field?.querySelector(".product-allergen-custom-error")?.remove();
      if (productAllergenForbiddenIntrinsicValue(input.value)) {
        field?.classList.add("field-error");
        input.insertAdjacentHTML(
          "afterend",
          '<div class="field-error-message product-allergen-custom-error">Sulfite sind produktabhängig. Bitte das Lebensmittel generisch speichern und anschließend ein konkretes Produkt erfassen.</div>',
        );
        input.focus();
        return;
      }
      originalSave?.();
    };
  };
}
