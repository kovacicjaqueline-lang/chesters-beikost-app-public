"use strict";

/*
 * Zentrale Recipe-V2-Komponentenoptionen.
 *
 * Bestehende FOOD-Identitäten bleiben kanonisch. Austauschbare Rezeptkomponenten
 * werden soweit möglich aus strukturierten FOOD-Eigenschaften abgeleitet statt als
 * zweite ID-/Namensliste pro Rezept gepflegt. Rezeptbezogene Anzeigenamen für
 * Zubereitungsformen (z. B. Mandelmilch) bleiben reine UI-Metadaten.
 *
 * Die Runtime ist absichtlich gekapselt: klassische Browser-Scripts teilen sich
 * einen globalen Lexical-Scope. Falls derselbe Script-Pfad erneut ausgewertet wird,
 * dürfen interne const-/function-Deklarationen deshalb nicht kollidieren.
 */
(function installRecipeV2ComponentModule(globalScope) {
  const RECIPE_V2_COMPONENT_KINDS_INTERNAL = Object.freeze({
    SMOOTH_PASTE: "smooth-paste",
  });

  const RECIPE_COMPONENT_FORMS = Object.freeze({
    CANONICAL: "canonical",
    PREPARED: "prepared",
  });

  function foodAllowsSmoothPasteComponent(foodRecord) {
    if (!foodRecord) return false;
    let category = String(foodRecord.category || "");
    let allergenGroup = String(foodRecord.allergenGroup || "");
    let family = String(foodRecord.foodFamily || foodRecord.allergenFamily || "");
    if (category === "Nuss") {
      if (family.startsWith("nuss:")) return family !== "nuss:maroni";
      return allergenGroup === "Erdnuss" || allergenGroup === "Schalenfrüchte";
    }
    return category === "Samen" && (allergenGroup === "Sesam" || family === "sesam");
  }

  function foodSmoothPasteCanonicalId(foodRecord) {
    if (!foodAllowsSmoothPasteComponent(foodRecord)) return "";
    let category = String(foodRecord.category || "");
    let family = String(foodRecord.foodFamily || foodRecord.allergenFamily || "");
    if (category === "Nuss" && family.startsWith("nuss:")) return family.slice("nuss:".length);
    if (category === "Samen" && family) return family;
    return String(foodRecord.id || "");
  }

  function foodRecipeComponentForm(foodRecord, kind = RECIPE_V2_COMPONENT_KINDS_INTERNAL.SMOOTH_PASTE) {
    if (!foodRecord || kind !== RECIPE_V2_COMPONENT_KINDS_INTERNAL.SMOOTH_PASTE) {
      return String(foodRecord?.recipeComponentForm || "");
    }
    if (!foodAllowsSmoothPasteComponent(foodRecord)) return "";
    let canonicalId = foodSmoothPasteCanonicalId(foodRecord);
    if (!canonicalId) return "";
    return String(foodRecord.id || "") === canonicalId
      ? RECIPE_COMPONENT_FORMS.CANONICAL
      : RECIPE_COMPONENT_FORMS.PREPARED;
  }

  function foodRecipeComponentKinds(foodRecord) {
    let kinds = new Set(Array.isArray(foodRecord?.recipeComponentKinds)
      ? foodRecord.recipeComponentKinds.filter(Boolean)
      : []);
    if (foodAllowsSmoothPasteComponent(foodRecord)) kinds.add(RECIPE_V2_COMPONENT_KINDS_INTERNAL.SMOOTH_PASTE);
    return [...kinds];
  }

  function foodHasRecipeComponentKind(foodRecord, kind) {
    return !!foodRecord && !!kind && foodRecipeComponentKinds(foodRecord).includes(kind);
  }

  function installFoodRecipeComponentMetadata(foods = typeof FOOD_DB !== "undefined" ? FOOD_DB : null) {
    if (!Array.isArray(foods)) return false;
    let changed = false;
    for (let item of foods) {
      if (!foodAllowsSmoothPasteComponent(item)) continue;
      let kinds = foodRecipeComponentKinds(item);
      let form = foodRecipeComponentForm(item, RECIPE_V2_COMPONENT_KINDS_INTERNAL.SMOOTH_PASTE);
      if (JSON.stringify(item.recipeComponentKinds || []) !== JSON.stringify(kinds)) {
        item.recipeComponentKinds = kinds;
        changed = true;
      }
      if (form && item.recipeComponentForm !== form) {
        item.recipeComponentForm = form;
        changed = true;
      }
    }
    return changed;
  }

  function recipeComponentFoodNames(kind, foods = [], predicate = null) {
    let allow = typeof predicate === "function" ? predicate : () => true;
    return (foods || [])
      .filter((item) => item && item.active !== false)
      .filter((item) => foodHasRecipeComponentKind(item, kind))
      .filter(allow)
      .sort((a, b) =>
        (Number(a.priority) || 9999) - (Number(b.priority) || 9999) ||
        String(a.name || "").localeCompare(String(b.name || ""), "de"),
      )
      .map((item) => item.name)
      .filter(Boolean);
  }

  function recipeCategoryChoiceNames(category, foods = []) {
    return (foods || [])
      .filter((item) => item && item.active !== false && String(item.category || "") === category)
      .sort((a, b) =>
        (Number(a.priority) || 9999) - (Number(b.priority) || 9999) ||
        String(a.name || "").localeCompare(String(b.name || ""), "de"),
      )
      .map((item) => item.name)
      .filter(Boolean);
  }

  function installRecipeCategoryComponentOptions(recipes = [], foods = [], category = "") {
    if (!Array.isArray(recipes) || !Array.isArray(foods) || !category) return false;
    let choiceNames = recipeCategoryChoiceNames(category, foods);
    if (!choiceNames.length) return false;

    let foodsByName = new Map(
      foods
        .filter((item) => item?.name)
        .map((item) => [item.name, item]),
    );
    let changed = false;

    for (let recipe of recipes) {
      if (!Array.isArray(recipe?.oneOf) || !recipe.oneOf.length) continue;
      let sourceFoods = recipe.oneOf.map((name) => foodsByName.get(name));
      if (sourceFoods.some((item) => !item || String(item.category || "") !== category)) continue;

      if (recipe.oneOf.length !== choiceNames.length || recipe.oneOf.some((name, index) => name !== choiceNames[index])) {
        recipe.oneOf = [...choiceNames];
        changed = true;
      }
      if (Array.isArray(recipe.variantLabels)) {
        if (recipe.variantLabels.length !== choiceNames.length || recipe.variantLabels.some((name, index) => name !== choiceNames[index])) {
          recipe.variantLabels = [...choiceNames];
          changed = true;
        }
      }
      if (category === "Obst" && recipe.family && /^\d+ Obstvarianten$/.test(String(recipe.familyLabel || ""))) {
        let familyLabel = `${choiceNames.length} Obstvarianten`;
        if (recipe.familyLabel !== familyLabel) {
          recipe.familyLabel = familyLabel;
          changed = true;
        }
      }
    }
    return changed;
  }

  const RECIPE_V2_COMPONENT_OPTIONS = Object.freeze({
    "Milch-Getreide-Brei": Object.freeze({
      milkChoices: Object.freeze([
        "Kuhmilch",
        "Naturjoghurt",
        "Buttermilch",
        "Haferdrink",
        "Sojabohne",
        "Mandel",
        "Kokos",
      ]),
      editorComponents: Object.freeze({
        milkChoices: Object.freeze({
          label: "Milch / Milchalternative",
          preparation: "recipe",
          choiceLabels: Object.freeze({
            Kuhmilch: "Kuhmilch",
            Naturjoghurt: "Naturjoghurt",
            Buttermilch: "Buttermilch",
            Haferdrink: "Haferdrink",
            Sojabohne: "Sojamilch",
            Mandel: "Mandelmilch",
            Kokos: "Kokosmilch",
          }),
        }),
      }),
    }),
    "Joghurt-Nussmus-Miniportion": Object.freeze({
      oneOfFromFood: Object.freeze({
        kind: RECIPE_V2_COMPONENT_KINDS_INTERNAL.SMOOTH_PASTE,
        category: "Nuss",
        componentForm: RECIPE_COMPONENT_FORMS.CANONICAL,
      }),
      editorComponents: Object.freeze({
        oneOf: Object.freeze({
          label: "Nussmus",
          preparation: "recipe",
        }),
      }),
    }),
  });

  function installRecipeV2ComponentOptions(
    recipes = typeof RECIPES !== "undefined" ? RECIPES : null,
    foods = typeof FOOD_DB !== "undefined" ? FOOD_DB : null,
  ) {
    if (!Array.isArray(recipes)) return false;
    if (Array.isArray(foods)) installFoodRecipeComponentMetadata(foods);

    let changed = false;
    if (Array.isArray(foods) && installRecipeCategoryComponentOptions(recipes, foods, "Obst")) {
      changed = true;
    }

    for (let [recipeName, config] of Object.entries(RECIPE_V2_COMPONENT_OPTIONS)) {
      let recipe = recipes.find((item) => item?.name === recipeName);
      if (!recipe) continue;

      for (let field of ["milkChoices"]) {
        if (!Array.isArray(config[field])) continue;
        recipe[field] = [...config[field]];
        changed = true;
      }

      if (config.oneOfFromFood && Array.isArray(foods)) {
        let { kind, category, componentForm } = config.oneOfFromFood;
        let names = recipeComponentFoodNames(
          kind,
          foods,
          (item) =>
            (!category || String(item.category || "") === category) &&
            (!componentForm || foodRecipeComponentForm(item, kind) === componentForm),
        );
        if (names.length) {
          recipe.oneOf = names;
          if (Array.isArray(recipe.variantLabels)) recipe.variantLabels = [...names];
          changed = true;
        }
      }

      if (config.editorComponents) {
        recipe.editorComponents = {
          ...(recipe.editorComponents || {}),
          ...config.editorComponents,
        };
        changed = true;
      }
    }
    return changed;
  }

  function installRecipeV2ComponentRuntime() {
    let foods = typeof FOOD_DB !== "undefined" ? FOOD_DB : null;
    if (Array.isArray(foods)) installFoodRecipeComponentMetadata(foods);
    if (typeof state !== "undefined" && Array.isArray(state?.foods)) installFoodRecipeComponentMetadata(state.foods);
    if (typeof RECIPES !== "undefined") installRecipeV2ComponentOptions(RECIPES, foods);
  }

  const api = {
    RECIPE_COMPONENT_KINDS: RECIPE_V2_COMPONENT_KINDS_INTERNAL,
    RECIPE_COMPONENT_FORMS,
    RECIPE_V2_COMPONENT_OPTIONS,
    foodAllowsSmoothPasteComponent,
    foodSmoothPasteCanonicalId,
    foodRecipeComponentForm,
    foodRecipeComponentKinds,
    foodHasRecipeComponentKind,
    installFoodRecipeComponentMetadata,
    recipeComponentFoodNames,
    recipeCategoryChoiceNames,
    installRecipeCategoryComponentOptions,
    installRecipeV2ComponentOptions,
    installRecipeV2ComponentRuntime,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else if (globalScope) {
    Object.assign(globalScope, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
