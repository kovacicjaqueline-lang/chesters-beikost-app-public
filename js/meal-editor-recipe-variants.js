"use strict";

/*
 * Mahlzeit-Editor: generische Recipe-V2-Komponenten.
 *
 * `requires` bleibt die feste Rezeptbasis. Die bestehenden Recipe-V2-Felder
 * `oneOf` und `milkChoices` werden als austauschbare Komponenten behandelt.
 * Konkrete Auswahlwerte bleiben über die bereits persistierten `foodIds`
 * schema-kompatibel. Zusätzliche Editor-Semantik lebt pro Feld, nicht pro Rezept-ID.
 */

const MEAL_EDITOR_RECIPE_COMPONENT_FIELDS = Object.freeze({
  oneOf: Object.freeze({
    label: "",
    extraFoodIds: Object.freeze([]),
    preparation: "category",
  }),
  milkChoices: Object.freeze({
    label: "Milch / Milchalternative",
    extraFoodIds: Object.freeze(["haferdrink"]),
    preparation: "recipe",
  }),
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

  let categories = mealEditorRecipeUnique(
    (foods || []).map((item) => item?.category).filter(Boolean),
  );
  if (categories.length !== 1) return "Zutat";
  if (categories[0] === "Getreide/Stärke") return "Getreide";
  return categories[0];
}

function mealEditorRecipeComponentSlots(recipe, lookup = {}) {
  if (!recipe) return [];
  return Object.entries(MEAL_EDITOR_RECIPE_COMPONENT_FIELDS)
    .map(([field, config]) => {
      let sourceNames = recipe[field] || [];
      if (!sourceNames.length) return null;
      let foods = [];
      for (let name of sourceNames) {
        let item = mealEditorRecipeLookup(lookup, "name", name);
        if (item && !foods.some((current) => current.id === item.id)) foods.push(item);
      }
      for (let id of config.extraFoodIds || []) {
        let item = mealEditorRecipeLookup(lookup, "id", id);
        if (item && !foods.some((current) => current.id === item.id)) foods.push(item);
      }
      if (!foods.length) return null;

      let label = recipe.editorComponents?.[field]?.label ||
        mealEditorRecipeComponentLabel(field, foods);
      let category = mealEditorRecipeUnique(foods.map((item) => item.category))[0] || "";
      let explicitPreparation = recipe.editorComponents?.[field]?.preparation;
      let preparationSelectable = explicitPreparation
        ? explicitPreparation === "food"
        : config.preparation === "category" && category === "Obst";

      return {
        field,
        label,
        foodIds: foods.map((item) => item.id),
        foods,
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
      selected = mealEditorRecipeUnique(defaultIds).find((id) => slot.foodIds.includes(id)) ||
        slot.foodIds[0] ||
        "";
    }
    if (selected && !result.includes(selected)) result.push(selected);
  }
  return result;
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

let mealEditorRecipeVariantContext = null;
let mealEditorRecipeVariantObserver = null;
let mealEditorRecipeVariantEnhancing = false;
let mealEditorRecipeVariantOriginalFoodIds = null;

function mealEditorRecipeRuntimeLookup() {
  return {
    byName: (name) => typeof foodByName === "function" ? foodByName(name) : null,
    byId: (id) => typeof food === "function" ? food(id) : null,
  };
}

function mealEditorRecipeDialogOpen() {
  if (typeof document === "undefined") return false;
  let modal = document.getElementById("genericModal");
  return !!modal?.classList?.contains("open") && !!document.getElementById("confirmManualMeal");
}

function mealEditorRecipeCurrentSource(date, meal, initialMeal) {
  let key = typeof manualMealKey === "function" ? manualMealKey(date, meal) : `${date}|${meal}`;
  let stored = typeof state !== "undefined" ? state.manualMeals?.[key] : null;
  return stored || initialMeal || null;
}

function mealEditorRecipeBeginContext(date, meal, initialMeal) {
  let source = mealEditorRecipeCurrentSource(date, meal, initialMeal);
  let recipeName = source?.recipeName || "";
  let lookup = mealEditorRecipeRuntimeLookup();
  let recipe = recipeName && typeof recipeByName === "function" ? recipeByName(recipeName) : null;
  mealEditorRecipeVariantContext = {
    date,
    meal,
    recipeName,
    selections: recipe
      ? mealEditorRecipeSelectionFromFoodIds(recipe, source?.foodIds || [], lookup)
      : {},
    searchQuery: "",
    refreshingSlot: false,
  };
}

function mealEditorRecipeEndContext() {
  mealEditorRecipeVariantContext = null;
  if (mealEditorRecipeVariantObserver) {
    mealEditorRecipeVariantObserver.disconnect();
    mealEditorRecipeVariantObserver = null;
  }
}

function mealEditorRecipeDefaultSelections(recipe) {
  if (!recipe || typeof mealEditorRecipeVariantOriginalFoodIds !== "function") return {};
  let defaults = mealEditorRecipeVariantOriginalFoodIds(recipe) || [];
  return mealEditorRecipeSelectionFromFoodIds(recipe, defaults, mealEditorRecipeRuntimeLookup());
}

function mealEditorRecipeConfiguredRuntimeFoodIds(recipe) {
  let defaults = mealEditorRecipeVariantOriginalFoodIds(recipe) || [];
  let context = mealEditorRecipeVariantContext;
  if (
    !context ||
    !mealEditorRecipeDialogOpen() ||
    !recipe?.name ||
    context.recipeName !== recipe.name
  ) return defaults;

  return mealEditorRecipeConfiguredFoodIds(
    recipe,
    defaults,
    context.selections,
    mealEditorRecipeRuntimeLookup(),
  );
}

function mealEditorRecipeCandidateAllowed(recipe, slot, candidateId) {
  let context = mealEditorRecipeVariantContext;
  let item = typeof food === "function" ? food(candidateId) : null;
  if (!context || !recipe || !item || item.active === false) return false;

  let selections = { ...(context.selections || {}), [slot.field]: candidateId };
  let ids = mealEditorRecipeConfiguredFoodIds(
    recipe,
    mealEditorRecipeVariantOriginalFoodIds(recipe) || [],
    selections,
    mealEditorRecipeRuntimeLookup(),
  );

  let previousSelections = context.selections;
  context.selections = selections;
  try {
    let role = mealEditorRecipeRoleData(recipe.name, ids, context.meal, context.date);
    if (Object.values(role.infos).some((info) => info?.role === "excluded")) return false;
    let validation = manualMealValidation(role.roleData, context.meal, context.date);
    return !!validation?.ok;
  } finally {
    context.selections = previousSelections;
  }
}

function mealEditorRecipeNormalize(value) {
  if (typeof normalizeName === "function") return normalizeName(value || "");
  return String(value || "").trim().toLocaleLowerCase("de");
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
  empty.textContent = recipeMode
    ? "Kein passendes Rezept gefunden."
    : "Kein Lebensmittel gefunden.";
  return empty;
}

function mealEditorRecipeFilterResults() {
  if (typeof document === "undefined" || !mealEditorRecipeVariantContext) return;
  let input = document.getElementById("mealSelectorSearch");
  let results = document.querySelector("#genericBody .selector-results");
  if (!input || !results) return;

  let query = mealEditorRecipeVariantContext.searchQuery || "";
  let normalized = mealEditorRecipeNormalize(query);
  let recipeMode = document.getElementById("selectorRecipes")?.classList.contains("active");
  let visible = 0;

  results.querySelectorAll(".selector-row").forEach((row) => {
    let matches = true;
    if (normalized) {
      if (recipeMode && row.classList.contains("selectRecipe")) {
        let name = "";
        try { name = decodeURIComponent(row.dataset.recipe || ""); } catch (_error) {}
        let recipe = typeof recipeByName === "function" ? recipeByName(name) : null;
        let searchable = recipe && typeof recipeSearchText === "function"
          ? recipeSearchText(recipe)
          : row.textContent || "";
        matches = mealEditorRecipeNormalize(searchable).includes(normalized);
      } else if (!recipeMode && row.classList.contains("selectFood")) {
        let item = typeof food === "function" ? food(row.dataset.food || "") : null;
        matches = item && typeof foodSearchMatches === "function"
          ? foodSearchMatches(item, query)
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
  let input = document.getElementById("mealSelectorSearch");
  if (!input || input.dataset.stableMealEditorSearch === "true") return;
  input.dataset.stableMealEditorSearch = "true";

  if (mealEditorRecipeVariantContext?.searchQuery) {
    input.value = mealEditorRecipeVariantContext.searchQuery;
  }

  input.oninput = (event) => {
    let field = event.currentTarget;
    let sheet = field.closest(".sheet");
    let scrollTop = sheet?.scrollTop || 0;
    mealEditorRecipeVariantContext.searchQuery = field.value;
    mealEditorRecipeFilterResults();
    if (sheet) sheet.scrollTop = scrollTop;
  };
}

function mealEditorRecipeFixModeCopy() {
  let recipesActive = document.getElementById("selectorRecipes")?.classList.contains("active");
  if (!recipesActive) return;
  let selectedRecipe = document.querySelector("#genericBody .selectRecipe.selected");
  if (selectedRecipe) return;

  let empty = document.querySelector("#genericBody .manual-role-empty");
  if (empty) empty.textContent = "Noch kein Rezept ausgewählt.";

  let warning = document.querySelector("#genericBody .manual-role-warning");
  if (warning) {
    warning.innerHTML = "<b>So passt die Auswahl noch nicht</b><div>Bitte ein Rezept auswählen.</div>";
  }
}

function mealEditorRecipeSelectedFoodIds() {
  return mealEditorRecipeUnique(
    [...document.querySelectorAll("#genericBody .removeManualSelected[data-food]")]
      .map((button) => button.dataset.food),
  );
}

function mealEditorRecipePreparationCount(foodId) {
  if (typeof manualMealFlowPreparationOptions !== "function") return 0;
  return (manualMealFlowPreparationOptions(foodId) || []).length;
}

function mealEditorRecipeLockIngredientControls(recipe, slots) {
  let slotByFoodId = new Map();
  for (let slot of slots) {
    for (let id of slot.foodIds) slotByFoodId.set(id, slot);
  }

  document.querySelectorAll("#genericBody .manual-role-item").forEach((item) => {
    let remove = item.querySelector(".removeManualSelected[data-food]");
    let foodId = remove?.dataset.food || "";
    if (!foodId) return;

    let slot = slotByFoodId.get(foodId) || null;
    item.dataset.recipeComponent = slot?.field || "fixed";
    let actions = item.querySelector(".manual-role-actions");
    if (actions) actions.hidden = true;

    let preparation = item.querySelector(".manual-preparation-field");
    if (!preparation) return;
    let allowPreparation = !!slot?.preparationSelectable &&
      mealEditorRecipePreparationCount(foodId) > 1;
    preparation.hidden = !allowPreparation;

    if (!allowPreparation) {
      let select = preparation.querySelector("select[data-manual-preparation]");
      if (select?.value) {
        select.value = "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });
}

function mealEditorRecipeRenderSlots(recipe, slots) {
  let overview = document.querySelector("#genericBody .manual-role-overview");
  if (!overview || !slots.length) return;

  let old = document.querySelector("#genericBody .recipe-component-controls");
  if (old) old.remove();

  let selectedIds = new Set(mealEditorRecipeSelectedFoodIds());
  let wrapper = document.createElement("div");
  wrapper.className = "recipe-component-controls manual-role-group";
  wrapper.dataset.recipeComponentControls = recipe.name;

  let heading = document.createElement("div");
  heading.className = "manual-role-heading";
  heading.textContent = "Rezeptbestandteile auswählen";
  wrapper.appendChild(heading);

  for (let slot of slots) {
    let current = slot.foodIds.find((id) => selectedIds.has(id)) ||
      mealEditorRecipeVariantContext.selections?.[slot.field] ||
      "";
    if (current) mealEditorRecipeVariantContext.selections[slot.field] = current;

    let field = document.createElement("div");
    field.className = "field recipe-component-field";

    let selectId = `recipeComponent-${slot.field}`;
    let label = document.createElement("label");
    label.htmlFor = selectId;
    label.textContent = slot.label;

    let select = document.createElement("select");
    select.id = selectId;
    select.dataset.recipeComponentSlot = slot.field;

    let allowed = slot.foods.filter((item) =>
      mealEditorRecipeCandidateAllowed(recipe, slot, item.id),
    );
    if (current && !allowed.some((item) => item.id === current)) {
      let currentFood = slot.foods.find((item) => item.id === current);
      if (currentFood) {
        let option = document.createElement("option");
        option.value = currentFood.id;
        option.textContent = `${currentFood.name} · aktuell nicht auswählbar`;
        option.disabled = true;
        option.selected = true;
        select.appendChild(option);
      }
    }
    for (let item of allowed) {
      let option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
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

    select.onchange = () => {
      if (!select.value || !mealEditorRecipeVariantContext) return;
      mealEditorRecipeVariantContext.selections[slot.field] = select.value;
      let activeRecipe = document.querySelector("#genericBody .selectRecipe.selected");
      if (!activeRecipe) return;
      mealEditorRecipeVariantContext.refreshingSlot = true;
      activeRecipe.click();
      mealEditorRecipeVariantContext.refreshingSlot = false;
    };

    field.append(label, select);
    wrapper.appendChild(field);
  }

  overview.insertAdjacentElement("afterend", wrapper);
}

function mealEditorRecipeEnhanceRecipeMode() {
  let context = mealEditorRecipeVariantContext;
  if (!context) return;
  let recipesActive = document.getElementById("selectorRecipes")?.classList.contains("active");
  let selectedButton = document.querySelector("#genericBody .selectRecipe.selected");
  if (!recipesActive || !selectedButton) {
    document.querySelector("#genericBody .recipe-component-controls")?.remove();
    return;
  }

  let name = "";
  try { name = decodeURIComponent(selectedButton.dataset.recipe || ""); } catch (_error) {}
  let recipe = typeof recipeByName === "function" ? recipeByName(name) : null;
  if (!recipe) return;
  context.recipeName = recipe.name;

  let slots = mealEditorRecipeComponentSlots(recipe, mealEditorRecipeRuntimeLookup());
  mealEditorRecipeLockIngredientControls(recipe, slots);
  mealEditorRecipeRenderSlots(recipe, slots);
}

function mealEditorRecipeObserveBody() {
  let body = typeof document !== "undefined" ? document.getElementById("genericBody") : null;
  if (!body || !mealEditorRecipeVariantObserver) return;
  mealEditorRecipeVariantObserver.observe(body, { childList: true, subtree: true });
}

function mealEditorRecipeEnhance() {
  if (
    mealEditorRecipeVariantEnhancing ||
    !mealEditorRecipeVariantContext ||
    !mealEditorRecipeDialogOpen()
  ) return;

  mealEditorRecipeVariantEnhancing = true;
  mealEditorRecipeVariantObserver?.disconnect();
  try {
    mealEditorRecipeEnsureFilterEmpty();
    mealEditorInstallStableSearch();
    mealEditorRecipeFixModeCopy();
    mealEditorRecipeEnhanceRecipeMode();
    mealEditorRecipeFilterResults();
  } finally {
    mealEditorRecipeVariantEnhancing = false;
    mealEditorRecipeObserveBody();
  }
}

function mealEditorRecipeEnsureObserver() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  if (mealEditorRecipeVariantObserver) mealEditorRecipeVariantObserver.disconnect();
  mealEditorRecipeVariantObserver = new MutationObserver(() => mealEditorRecipeEnhance());
  mealEditorRecipeObserveBody();
}

function mealEditorRecipeHandleCapture(event) {
  let context = mealEditorRecipeVariantContext;
  if (!context) return;
  let target = event.target?.closest?.("button");
  if (!target) return;

  if (target.id === "selectorRecipes" || target.id === "selectorFoods") {
    context.searchQuery = "";
    if (target.id === "selectorFoods") context.recipeName = "";
    return;
  }

  if (target.classList.contains("selectRecipe")) {
    let name = "";
    try { name = decodeURIComponent(target.dataset.recipe || ""); } catch (_error) {}
    if (!name) return;
    context.recipeName = name;
    if (!context.refreshingSlot) {
      let recipe = typeof recipeByName === "function" ? recipeByName(name) : null;
      context.selections = mealEditorRecipeDefaultSelections(recipe);
    }
    return;
  }

  if (target.classList.contains("selectFood") || target.classList.contains("removeManualSelected")) {
    context.recipeName = "";
    return;
  }

  if (target.id === "cancelManualMeal") {
    queueMicrotask(mealEditorRecipeEndContext);
    return;
  }

  if (target.id === "confirmManualMeal") {
    queueMicrotask(() => {
      if (!mealEditorRecipeDialogOpen()) mealEditorRecipeEndContext();
    });
  }
}

function installMealEditorRecipeVariantsRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__mealEditorRecipeVariantsInstalled) return false;
  if (
    typeof openManualMealSelector !== "function" ||
    typeof recipeFoodIds !== "function" ||
    typeof manualMealRoleInfo !== "function" ||
    typeof manualMealValidation !== "function"
  ) return false;

  globalThis.__mealEditorRecipeVariantsInstalled = true;

  mealEditorRecipeVariantOriginalFoodIds = recipeFoodIds;
  recipeFoodIds = function mealEditorRecipeVariantFoodIds(recipe) {
    return mealEditorRecipeConfiguredRuntimeFoodIds(recipe);
  };

  let originalOpenManualMealSelector = openManualMealSelector;
  openManualMealSelector = function mealEditorRecipeVariantsOpen(date, meal, initialMeal = null) {
    mealEditorRecipeBeginContext(date, meal, initialMeal);
    let result = originalOpenManualMealSelector.apply(this, arguments);
    mealEditorRecipeEnsureObserver();
    mealEditorRecipeEnhance();
    return result;
  };

  if (typeof document !== "undefined") {
    document.getElementById("genericBody")?.addEventListener(
      "click",
      mealEditorRecipeHandleCapture,
      true,
    );
  }

  if (typeof window !== "undefined" && window.__beikostTest) {
    window.__beikostTest.mealEditorRecipeComponentSlots = (recipeName) => {
      let recipe = typeof recipeByName === "function" ? recipeByName(recipeName) : null;
      return mealEditorRecipeComponentSlots(recipe, mealEditorRecipeRuntimeLookup())
        .map((slot) => ({
          field: slot.field,
          label: slot.label,
          foodIds: [...slot.foodIds],
          preparationSelectable: slot.preparationSelectable,
        }));
    };
  }

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installMealEditorRecipeVariantsRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MEAL_EDITOR_RECIPE_COMPONENT_FIELDS,
    mealEditorRecipeComponentLabel,
    mealEditorRecipeComponentSlots,
    mealEditorRecipeSelectionFromFoodIds,
    mealEditorRecipeConfiguredFoodIds,
    installMealEditorRecipeVariantsRuntime,
  };
}
