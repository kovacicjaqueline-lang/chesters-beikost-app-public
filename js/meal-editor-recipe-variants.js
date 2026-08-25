"use strict";

/*
 * Mahlzeit-Editor: generische Recipe-V2-Komponenten.
 *
 * `requires` bleibt die feste Rezeptbasis. `oneOf` und `milkChoices` sind die
 * einzigen Quellen für austauschbare Rezeptkomponenten. Konkrete Auswahlen
 * werden über die bereits persistierten `foodIds` gespeichert.
 */

const MEAL_EDITOR_RECIPE_COMPONENT_FIELDS = Object.freeze({
  oneOf: Object.freeze({ label: "", preparation: "category" }),
  milkChoices: Object.freeze({ label: "Milch / Milchalternative", preparation: "recipe" }),
});

const MEAL_EDITOR_HANDLING_LABELS = Object.freeze({
  "spoon-smooth": "Fein und glatt vom Löffel",
  "spoon-mashed": "Weich zerdrückt",
  "spoon-soft-lumpy": "Weich stückig",
  "finger-graspable": "Weiches Fingerfood",
  "finger-small-soft": "Kleine weiche Stücke",
});

function mealEditorRecipeUnique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function mealEditorRecipeLookup(lookup, kind, value) {
  if (!lookup || !value) return null;
  let fn = kind === "id" ? lookup.byId : lookup.byName;
  return typeof fn === "function" ? fn(value) : null;
}

function mealEditorRecipeComponentLabel(field, foods) {
  let config = MEAL_EDITOR_RECIPE_COMPONENT_FIELDS[field] || {};
  if (config.label) return config.label;
  let categories = mealEditorRecipeUnique((foods || []).map((item) => item?.category).filter(Boolean));
  if (categories.length !== 1) return "Zutat";
  if (categories[0] === "Getreide/Stärke") return "Getreide";
  return categories[0];
}

function mealEditorRecipeChoiceLabel(recipe, field, sourceName, item) {
  return recipe?.editorComponents?.[field]?.choiceLabels?.[sourceName] || item?.name || sourceName;
}

function mealEditorRecipeComponentSlots(recipe, lookup = {}) {
  if (!recipe) return [];
  return Object.entries(MEAL_EDITOR_RECIPE_COMPONENT_FIELDS)
    .map(([field, config]) => {
      let sourceNames = recipe[field] || [];
      if (!sourceNames.length) return null;
      let choices = [];
      for (let name of sourceNames) {
        let item = mealEditorRecipeLookup(lookup, "name", name);
        if (!item || choices.some((current) => current.food.id === item.id)) continue;
        choices.push({
          sourceName: name,
          food: item,
          label: mealEditorRecipeChoiceLabel(recipe, field, name, item),
        });
      }
      if (!choices.length) return null;

      let foods = choices.map((choice) => choice.food);
      let label = recipe.editorComponents?.[field]?.label || mealEditorRecipeComponentLabel(field, foods);
      let categories = mealEditorRecipeUnique(foods.map((item) => item.category));
      let explicitPreparation = recipe.editorComponents?.[field]?.preparation;
      let preparationSelectable = explicitPreparation
        ? explicitPreparation === "food"
        : config.preparation === "category" && categories.length === 1 && categories[0] === "Obst";

      return {
        field,
        label,
        foodIds: foods.map((item) => item.id),
        foods,
        choices,
        preparationSelectable,
      };
    })
    .filter(Boolean);
}

function mealEditorRecipeSelectionFromFoodIds(recipe, foodIds, lookup = {}) {
  let selected = new Set(foodIds || []);
  let result = {};
  for (let slot of mealEditorRecipeComponentSlots(recipe, lookup)) {
    let current = slot.foodIds.find((id) => selected.has(id));
    if (current) result[slot.field] = current;
  }
  return result;
}

function mealEditorRecipeConfiguredFoodIds(recipe, defaultIds, selections, lookup = {}) {
  let slots = mealEditorRecipeComponentSlots(recipe, lookup);
  if (!slots.length) return mealEditorRecipeUnique(defaultIds);
  let allChoiceIds = new Set(slots.flatMap((slot) => slot.foodIds));
  let result = mealEditorRecipeUnique(defaultIds).filter((id) => !allChoiceIds.has(id));
  for (let slot of slots) {
    let selected = selections?.[slot.field];
    if (!slot.foodIds.includes(selected)) {
      selected = mealEditorRecipeUnique(defaultIds).find((id) => slot.foodIds.includes(id)) || slot.foodIds[0] || "";
    }
    if (selected && !result.includes(selected)) result.push(selected);
  }
  return result;
}

function mealEditorPreparationControlModel(options = [], recipeSelected = false) {
  let structured = [];
  for (let option of options || []) {
    if (!option?.key || structured.some((item) => item.key === option.key)) continue;
    structured.push({
      key: option.key,
      label: option.label || option.key,
      text: option.text || "",
    });
  }
  if (recipeSelected || !structured.length) {
    return { visible: false, selectable: false, staticLabel: "", keys: [] };
  }
  if (structured.length === 1) {
    return {
      visible: true,
      selectable: false,
      staticLabel: structured[0].label,
      keys: [structured[0].key],
    };
  }
  return {
    visible: true,
    selectable: true,
    staticLabel: "",
    keys: structured.map((option) => option.key),
  };
}

function mealEditorRecipePresentationModel(
  recipe,
  settings = {},
  contractMap = {},
  eligibilityFn = null,
) {
  let contract = recipe?.name ? contractMap?.[recipe.name] : null;
  if (!contract) return null;
  let handling = typeof eligibilityFn === "function"
    ? eligibilityFn(recipe, settings, contractMap)
    : null;
  let blocked = !!handling?.migrated && !(handling.eligibleModes || []).length;
  let mode = handling?.preferredModes?.[0] || (blocked ? "" : contract.modes?.[0] || "");
  return {
    mode,
    label: blocked
      ? "Aktuell noch nicht passend"
      : MEAL_EDITOR_HANDLING_LABELS[mode] || mode || "Rezeptdefinierte Form",
    blocked,
  };
}

function mealEditorRecipeRuntimeLookup() {
  return {
    byName: (name) => typeof foodByName === "function" ? foodByName(name) : null,
    byId: (id) => typeof food === "function" ? food(id) : null,
  };
}

function mealEditorRecipeNormalize(value) {
  if (typeof normalizeName === "function") return normalizeName(value || "");
  return String(value || "").trim().toLocaleLowerCase("de");
}

function mealEditorRecipeDialogOpen() {
  if (typeof document === "undefined") return false;
  let modal = document.getElementById("genericModal");
  return !!modal?.classList?.contains("open") && !!document.getElementById("confirmManualMeal");
}

function mealEditorRecipeManualContext() {
  try {
    if (typeof manualMealFlowContext !== "undefined" && manualMealFlowContext) return manualMealFlowContext;
  } catch (_error) {}
  return null;
}

let mealEditorRecipeVariantContext = null;
let mealEditorRecipeVariantObserver = null;
let mealEditorRecipeVariantEnhancing = false;

function mealEditorRecipeCurrentSelectedName() {
  let selected = document.querySelector("#genericBody .selectRecipe.selected");
  if (!selected) return "";
  try { return decodeURIComponent(selected.dataset.recipe || ""); } catch (_error) { return ""; }
}

function mealEditorRecipeSelectedFoodIds() {
  return mealEditorRecipeUnique(
    [...document.querySelectorAll("#genericBody .removeManualSelected[data-food]")].map((button) => button.dataset.food),
  );
}

function mealEditorRecipeEnsureContext() {
  if (!mealEditorRecipeDialogOpen()) {
    mealEditorRecipeVariantContext = null;
    return null;
  }
  let manualContext = mealEditorRecipeManualContext();
  let meal = manualContext?.meal || mealEditorRecipeVariantContext?.meal || "";
  let date = manualContext?.targetDate || manualContext?.sourceDate || mealEditorRecipeVariantContext?.date || "";
  let recipeName = mealEditorRecipeCurrentSelectedName();
  if (!mealEditorRecipeVariantContext) {
    mealEditorRecipeVariantContext = { date, meal, recipeName: "", selections: {}, searchQuery: "", refreshingSlot: false };
  } else {
    if (date) mealEditorRecipeVariantContext.date = date;
    if (meal) mealEditorRecipeVariantContext.meal = meal;
  }
  if (recipeName && recipeName !== mealEditorRecipeVariantContext.recipeName) {
    let recipe = typeof recipeByName === "function" ? recipeByName(recipeName) : null;
    mealEditorRecipeVariantContext.recipeName = recipeName;
    mealEditorRecipeVariantContext.selections = recipe
      ? mealEditorRecipeSelectionFromFoodIds(recipe, mealEditorRecipeSelectedFoodIds(), mealEditorRecipeRuntimeLookup())
      : {};
  }
  return mealEditorRecipeVariantContext;
}

function mealEditorRecipeRoleData(recipeName, ids, meal, date) {
  let uniqueIds = mealEditorRecipeUnique(ids);
  let infos = {};
  let bases = [];
  let samples = [];
  for (let id of uniqueIds) {
    let info = manualMealRoleInfo(id, meal, date, { recipeName });
    infos[id] = info;
    if (info.role === "base") bases.push(id);
    else if (info.role === "sample") samples.push(id);
  }
  return {
    infos,
    roleData: {
      recipeName,
      foodIds: uniqueIds,
      baseFoodIds: bases,
      sampleFoodIds: samples,
      foodRoles: foodRolesFor(uniqueIds, bases, samples),
    },
  };
}

function mealEditorRecipeConfiguredIdsFor(recipe, selections) {
  let defaults = typeof recipeFoodIds === "function" ? recipeFoodIds(recipe) : [];
  return mealEditorRecipeConfiguredFoodIds(recipe, defaults, selections, mealEditorRecipeRuntimeLookup());
}

function mealEditorRecipeCandidateAllowed(recipe, slot, candidateId) {
  let context = mealEditorRecipeEnsureContext();
  let item = typeof food === "function" ? food(candidateId) : null;
  if (!context || !context.meal || !context.date || !recipe || !item || item.active === false) return false;
  let selections = { ...(context.selections || {}), [slot.field]: candidateId };
  let ids = mealEditorRecipeConfiguredIdsFor(recipe, selections);
  let role = mealEditorRecipeRoleData(recipe.name, ids, context.meal, context.date);
  if (Object.values(role.infos).some((info) => info?.role === "excluded")) return false;
  let validation = manualMealValidation(role.roleData, context.meal, context.date);
  return !!validation?.ok;
}

function mealEditorRecipeEnsureFilterEmpty() {
  let results = document.querySelector("#genericBody .selector-results");
  if (!results) return null;
  let empty = results.querySelector(".meal-editor-filter-empty");
  if (!empty) {
    empty = document.createElement("div");
    empty.className = "empty meal-editor-filter-empty";
    empty.hidden = true;
    results.appendChild(empty);
  }
  let recipeMode = document.getElementById("selectorRecipes")?.classList.contains("active");
  empty.textContent = recipeMode ? "Kein passendes Rezept gefunden." : "Kein Lebensmittel gefunden.";
  return empty;
}

function mealEditorRecipeFilterResults() {
  let context = mealEditorRecipeEnsureContext();
  if (typeof document === "undefined" || !context) return;
  let input = document.getElementById("mealSelectorSearch");
  let results = document.querySelector("#genericBody .selector-results");
  if (!input || !results) return;
  let normalized = mealEditorRecipeNormalize(context.searchQuery || "");
  let recipeMode = document.getElementById("selectorRecipes")?.classList.contains("active");
  let visible = 0;
  results.querySelectorAll(".selector-row").forEach((row) => {
    let matches = true;
    if (normalized) {
      if (recipeMode && row.classList.contains("selectRecipe")) {
        let name = "";
        try { name = decodeURIComponent(row.dataset.recipe || ""); } catch (_error) {}
        let recipe = typeof recipeByName === "function" ? recipeByName(name) : null;
        let searchable = recipe && typeof recipeSearchText === "function" ? recipeSearchText(recipe) : row.textContent || "";
        matches = mealEditorRecipeNormalize(searchable).includes(normalized);
      } else if (!recipeMode && row.classList.contains("selectFood")) {
        let item = typeof food === "function" ? food(row.dataset.food || "") : null;
        matches = item && typeof foodSearchMatches === "function"
          ? foodSearchMatches(item, context.searchQuery || "")
          : mealEditorRecipeNormalize(row.textContent || "").includes(normalized);
      }
    }
    row.hidden = !matches;
    if (matches) visible += 1;
  });
  let builtInEmpty = results.querySelector(".empty:not(.meal-editor-filter-empty)");
  if (builtInEmpty) builtInEmpty.hidden = !!visible || !!normalized;
  let empty = results.querySelector(".meal-editor-filter-empty");
  if (empty) empty.hidden = !!visible || !normalized;
}

function mealEditorInstallStableSearch() {
  let context = mealEditorRecipeEnsureContext();
  let input = document.getElementById("mealSelectorSearch");
  if (!context || !input || input.dataset.stableMealEditorSearch === "true") return;
  input.dataset.stableMealEditorSearch = "true";
  if (context.searchQuery) input.value = context.searchQuery;
  input.oninput = (event) => {
    let field = event.currentTarget;
    let sheet = field.closest(".sheet");
    let scrollTop = sheet?.scrollTop || 0;
    context.searchQuery = field.value;
    mealEditorRecipeFilterResults();
    if (sheet) sheet.scrollTop = scrollTop;
  };
}

function mealEditorRecipeFixModeCopy() {
  let recipesActive = document.getElementById("selectorRecipes")?.classList.contains("active");
  if (!recipesActive || document.querySelector("#genericBody .selectRecipe.selected")) return;
  let empty = document.querySelector("#genericBody .manual-role-empty");
  if (empty) empty.textContent = "Noch kein Rezept ausgewählt.";
  let warning = document.querySelector("#genericBody .manual-role-warning");
  if (warning) warning.innerHTML = "<b>So passt die Auswahl noch nicht</b><div>Bitte ein Rezept auswählen.</div>";
}

function mealEditorStructuredPreparationOptions(foodId) {
  if (
    typeof handlingPreparationOptions !== "function" ||
    typeof state === "undefined" ||
    typeof FOOD_HANDLING_CONTRACT === "undefined"
  ) return [];
  return handlingPreparationOptions(foodId, state.settings, FOOD_HANDLING_CONTRACT) || [];
}

function mealEditorRecipeLockIngredientControls(slots) {
  let slotByFoodId = new Map();
  for (let slot of slots) for (let id of slot.foodIds) slotByFoodId.set(id, slot);
  document.querySelectorAll("#genericBody .manual-role-item").forEach((item) => {
    let remove = item.querySelector(".removeManualSelected[data-food]");
    let foodId = remove?.dataset.food || "";
    if (!foodId) return;
    let slot = slotByFoodId.get(foodId) || null;
    item.dataset.recipeComponent = slot?.field || "fixed";
    let actions = item.querySelector(".manual-role-actions");
    if (actions) actions.hidden = true;
  });
}

function mealEditorRecipeSyncPreparationControls(recipeName = "") {
  let recipeSelected = !!recipeName;
  document.querySelectorAll("#genericBody .manual-role-item").forEach((item) => {
    let remove = item.querySelector(".removeManualSelected[data-food]");
    let foodId = remove?.dataset.food || "";
    let preparation = item.querySelector(".manual-preparation-field");
    if (!foodId || !preparation) return;

    let options = mealEditorStructuredPreparationOptions(foodId);
    let model = mealEditorPreparationControlModel(options, recipeSelected);
    preparation.querySelector(".meal-editor-preparation-static")?.remove();
    preparation.hidden = !model.visible;
    if (!model.visible) return;

    let label = preparation.querySelector("label");
    if (label) label.textContent = "Darreichung";
    let select = preparation.querySelector("select[data-manual-preparation]");
    if (!select) return;

    if (!model.selectable) {
      select.hidden = true;
      let info = document.createElement("div");
      info.className = "small meal-editor-preparation-static";
      info.textContent = model.staticLabel;
      preparation.appendChild(info);
      return;
    }

    select.hidden = false;
    let allowed = new Set(model.keys);
    [...select.options].forEach((option) => {
      if (option.value && !allowed.has(option.value)) option.remove();
    });
  });
}

function mealEditorRecipeChoiceLabelForFood(slot, foodId) {
  return slot.choices.find((choice) => choice.food.id === foodId)?.label ||
    slot.foods.find((item) => item.id === foodId)?.name || foodId;
}

function mealEditorRecipeApplySelectionThroughExistingHandler(recipe, slot, selectedId) {
  let context = mealEditorRecipeEnsureContext();
  let activeRecipe = document.querySelector("#genericBody .selectRecipe.selected");
  if (!context || !activeRecipe || !recipe || !selectedId) return;
  context.selections[slot.field] = selectedId;
  let slots = mealEditorRecipeComponentSlots(recipe, mealEditorRecipeRuntimeLookup());
  let originals = new Map();
  try {
    for (let currentSlot of slots) {
      originals.set(currentSlot.field, recipe[currentSlot.field]);
      let id = context.selections[currentSlot.field] || currentSlot.foodIds[0];
      let choice = currentSlot.choices.find((item) => item.food.id === id);
      recipe[currentSlot.field] = choice ? [choice.sourceName] : recipe[currentSlot.field];
    }
    context.refreshingSlot = true;
    activeRecipe.click();
  } finally {
    context.refreshingSlot = false;
    for (let [field, value] of originals) recipe[field] = value;
  }
}

function mealEditorRecipeRenderSlots(recipe, slots) {
  let context = mealEditorRecipeEnsureContext();
  let overview = document.querySelector("#genericBody .manual-role-overview");
  if (!context || !overview || !slots.length) return;
  document.querySelector("#genericBody .recipe-component-controls")?.remove();
  let selectedIds = new Set(mealEditorRecipeSelectedFoodIds());
  let wrapper = document.createElement("div");
  wrapper.className = "recipe-component-controls manual-role-group";
  wrapper.dataset.recipeComponentControls = recipe.name;
  let heading = document.createElement("div");
  heading.className = "manual-role-heading";
  heading.textContent = "Rezeptbestandteile auswählen";
  wrapper.appendChild(heading);

  for (let slot of slots) {
    let current = slot.foodIds.find((id) => selectedIds.has(id)) || context.selections?.[slot.field] || "";
    if (current) context.selections[slot.field] = current;
    let field = document.createElement("div");
    field.className = "field recipe-component-field";
    let selectId = `recipeComponent-${slot.field}`;
    let label = document.createElement("label");
    label.htmlFor = selectId;
    label.textContent = slot.label;
    let select = document.createElement("select");
    select.id = selectId;
    select.dataset.recipeComponentSlot = slot.field;
    let allowed = slot.foods.filter((item) => mealEditorRecipeCandidateAllowed(recipe, slot, item.id));
    if (current && !allowed.some((item) => item.id === current)) {
      let currentFood = slot.foods.find((item) => item.id === current);
      if (currentFood) {
        let option = document.createElement("option");
        option.value = currentFood.id;
        option.textContent = `${mealEditorRecipeChoiceLabelForFood(slot, currentFood.id)} · aktuell nicht auswählbar`;
        option.disabled = true;
        option.selected = true;
        select.appendChild(option);
      }
    }
    for (let item of allowed) {
      let option = document.createElement("option");
      option.value = item.id;
      option.textContent = mealEditorRecipeChoiceLabelForFood(slot, item.id);
      option.selected = item.id === current;
      select.appendChild(option);
    }
    if (!select.options.length) {
      let option = document.createElement("option");
      option.value = "";
      option.textContent = "Aktuell keine zulässige Auswahl";
      option.disabled = true;
      option.selected = true;
      select.appendChild(option);
      select.disabled = true;
    }
    select.onchange = () => mealEditorRecipeApplySelectionThroughExistingHandler(recipe, slot, select.value);
    field.append(label, select);
    wrapper.appendChild(field);
  }
  overview.insertAdjacentElement("afterend", wrapper);
}

function mealEditorRecipeRenderPresentation(recipe) {
  let overview = document.querySelector("#genericBody .manual-role-overview");
  let existing = document.querySelector("#genericBody .recipe-presentation-summary");
  if (!overview || !recipe) {
    existing?.remove();
    return;
  }
  let contracts = typeof RECIPE_HANDLING_CONTRACT !== "undefined" ? RECIPE_HANDLING_CONTRACT : {};
  let settings = typeof state !== "undefined" ? state.settings : {};
  let eligibility = typeof recipeHandlingEligibility === "function" ? recipeHandlingEligibility : null;
  let model = mealEditorRecipePresentationModel(recipe, settings, contracts, eligibility);
  if (!model) {
    existing?.remove();
    return;
  }

  let wrapper = existing || document.createElement("div");
  wrapper.className = "recipe-presentation-summary manual-role-group";
  wrapper.dataset.recipePresentation = recipe.name;
  wrapper.replaceChildren();
  let heading = document.createElement("div");
  heading.className = "manual-role-heading";
  heading.textContent = "Darreichung";
  let value = document.createElement("div");
  value.className = "meal-editor-recipe-presentation-value";
  value.textContent = model.label;
  let note = document.createElement("div");
  note.className = "small";
  note.textContent = "Vom Rezept vorgegeben; einzelne Zutaten haben hier keine eigene Konsistenzauswahl.";
  wrapper.append(heading, value, note);

  let anchor = document.querySelector("#genericBody .recipe-component-controls") || overview;
  if (!existing || wrapper.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", wrapper);
}

function mealEditorRecipeEnhanceRecipeMode() {
  let context = mealEditorRecipeEnsureContext();
  let recipesActive = document.getElementById("selectorRecipes")?.classList.contains("active");
  let selectedButton = document.querySelector("#genericBody .selectRecipe.selected");
  if (!context || !recipesActive || !selectedButton) {
    document.querySelector("#genericBody .recipe-component-controls")?.remove();
    document.querySelector("#genericBody .recipe-presentation-summary")?.remove();
    return;
  }
  let name = mealEditorRecipeCurrentSelectedName();
  let recipe = typeof recipeByName === "function" ? recipeByName(name) : null;
  if (!recipe) return;
  context.recipeName = recipe.name;
  let slots = mealEditorRecipeComponentSlots(recipe, mealEditorRecipeRuntimeLookup());
  mealEditorRecipeLockIngredientControls(slots);
  mealEditorRecipeRenderSlots(recipe, slots);
  mealEditorRecipeRenderPresentation(recipe);
}

function mealEditorRecipeEnhance() {
  if (mealEditorRecipeVariantEnhancing || !mealEditorRecipeDialogOpen()) return;
  mealEditorRecipeVariantEnhancing = true;
  mealEditorRecipeVariantObserver?.disconnect();
  try {
    mealEditorRecipeEnsureContext();
    mealEditorRecipeEnsureFilterEmpty();
    mealEditorInstallStableSearch();
    mealEditorRecipeFixModeCopy();
    mealEditorRecipeEnhanceRecipeMode();
    mealEditorRecipeSyncPreparationControls(mealEditorRecipeCurrentSelectedName());
    mealEditorRecipeFilterResults();
  } finally {
    mealEditorRecipeVariantEnhancing = false;
    mealEditorRecipeObserveBody();
  }
}

function mealEditorRecipeObserveBody() {
  let body = typeof document !== "undefined" ? document.getElementById("genericBody") : null;
  if (!body || !mealEditorRecipeVariantObserver) return;
  mealEditorRecipeVariantObserver.observe(body, { childList: true, subtree: true });
}

function mealEditorRecipeHandleCapture(event) {
  let target = event.target?.closest?.("button");
  if (!target || !mealEditorRecipeDialogOpen()) return;
  let context = mealEditorRecipeEnsureContext();
  if (!context) return;
  if (target.id === "selectorRecipes" || target.id === "selectorFoods") {
    context.searchQuery = "";
    if (target.id === "selectorFoods") {
      context.recipeName = "";
      context.selections = {};
    }
    return;
  }
  if (target.classList.contains("selectRecipe")) {
    let name = "";
    try { name = decodeURIComponent(target.dataset.recipe || ""); } catch (_error) {}
    if (!name) return;
    context.recipeName = name;
    if (!context.refreshingSlot) {
      let recipe = typeof recipeByName === "function" ? recipeByName(name) : null;
      context.selections = recipe
        ? mealEditorRecipeSelectionFromFoodIds(recipe, typeof recipeFoodIds === "function" ? recipeFoodIds(recipe) : [], mealEditorRecipeRuntimeLookup())
        : {};
    }
  }
}

function installMealEditorRecipeVariantsRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__mealEditorRecipeVariantsInstalled) return false;
  if (
    typeof manualMealRoleInfo !== "function" ||
    typeof manualMealValidation !== "function" ||
    typeof recipeFoodIds !== "function"
  ) return false;
  globalThis.__mealEditorRecipeVariantsInstalled = true;
  if (typeof document !== "undefined") {
    document.addEventListener("click", mealEditorRecipeHandleCapture, true);
    mealEditorRecipeVariantObserver = new MutationObserver(() => mealEditorRecipeEnhance());
    mealEditorRecipeObserveBody();
    queueMicrotask(mealEditorRecipeEnhance);
  }
  if (typeof window !== "undefined" && window.__beikostTest) {
    window.__beikostTest.mealEditorRecipeComponentSlots = (recipeName) => {
      let recipe = typeof recipeByName === "function" ? recipeByName(recipeName) : null;
      return mealEditorRecipeComponentSlots(recipe, mealEditorRecipeRuntimeLookup()).map((slot) => ({
        field: slot.field,
        label: slot.label,
        foodIds: [...slot.foodIds],
        labels: slot.choices.map((choice) => choice.label),
        preparationSelectable: slot.preparationSelectable,
      }));
    };
  }
  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") installMealEditorRecipeVariantsRuntime();

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MEAL_EDITOR_RECIPE_COMPONENT_FIELDS,
    MEAL_EDITOR_HANDLING_LABELS,
    mealEditorRecipeComponentLabel,
    mealEditorRecipeChoiceLabel,
    mealEditorRecipeComponentSlots,
    mealEditorRecipeSelectionFromFoodIds,
    mealEditorRecipeConfiguredFoodIds,
    mealEditorPreparationControlModel,
    mealEditorRecipePresentationModel,
    installMealEditorRecipeVariantsRuntime,
  };
}
