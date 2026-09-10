"use strict";

/*
 * Zentrale Recipe-V2-Komponentenoptionen.
 *
 * Bestehende FOOD-Identitäten bleiben kanonisch. Austauschbare Rezeptkomponenten
 * werden soweit möglich aus strukturierten FOOD-Eigenschaften abgeleitet statt als
 * zweite ID-/Namensliste pro Rezept gepflegt. Rezeptbezogene Anzeigenamen für
 * Zubereitungsformen (z. B. Mandelmilch) bleiben reine UI-Metadaten.
 *
 * Bestehende FOODs erhalten ihre Recipe-V2-Capabilities über eine zentrale
 * Kompatibilitätsabbildung. Neue FOODs können dieselben Capabilities direkt über
 * `recipeComponentKinds` deklarieren und werden dann ohne Rezeptlisten-Änderung
 * automatisch in den passenden Slots berücksichtigt.
 *
 * Die Runtime ist absichtlich gekapselt: klassische Browser-Scripts teilen sich
 * einen globalen Lexical-Scope. Falls derselbe Script-Pfad erneut ausgewertet wird,
 * dürfen interne const-/function-Deklarationen deshalb nicht kollidieren.
 */
(function installRecipeV2ComponentModule(globalScope) {
  const RECIPE_V2_COMPONENT_KINDS_INTERNAL = Object.freeze({
    SMOOTH_PASTE: "smooth-paste",
    MILK_PORRIDGE_GRAIN: "milk-porridge-grain",
    BANANA_BREAD_GRAIN: "banana-bread-grain",
    MILK_PORRIDGE_LIQUID: "milk-porridge-liquid",
    PANCAKE_VEGETABLE: "pancake-vegetable",
    SOFT_MUFFIN_VEGETABLE: "soft-muffin-vegetable",
    BEAN_POTATO_STAMPF: "bean-potato-stampf",
  });

  const RECIPE_COMPONENT_FORMS = Object.freeze({
    CANONICAL: "canonical",
    PREPARED: "prepared",
  });

  const LEGACY_RECIPE_COMPONENT_KINDS_BY_FOOD_ID = Object.freeze({
    hafer: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_GRAIN,
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.BANANA_BREAD_GRAIN,
    ]),
    hirse: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_GRAIN,
    ]),
    polenta: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_GRAIN,
    ]),
    weizen: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_GRAIN,
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.BANANA_BREAD_GRAIN,
    ]),
    dinkel: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_GRAIN,
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.BANANA_BREAD_GRAIN,
    ]),
    buchweizen: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_GRAIN,
    ]),
    kuhmilch: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_LIQUID,
    ]),
    naturjoghurt: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_LIQUID,
    ]),
    buttermilch: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_LIQUID,
    ]),
    haferdrink: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_LIQUID,
    ]),
    sojabohne: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_LIQUID,
    ]),
    mandel: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_LIQUID,
    ]),
    kokos: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_LIQUID,
    ]),
    kuerbis: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.PANCAKE_VEGETABLE,
    ]),
    suesskartoffel: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.PANCAKE_VEGETABLE,
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.SOFT_MUFFIN_VEGETABLE,
    ]),
    zucchini: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.SOFT_MUFFIN_VEGETABLE,
    ]),
    karotte: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.SOFT_MUFFIN_VEGETABLE,
    ]),
    brokkoli: Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.SOFT_MUFFIN_VEGETABLE,
    ]),
    "weisse-bohnen": Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.BEAN_POTATO_STAMPF,
    ]),
    "schwarze-bohnen": Object.freeze([
      RECIPE_V2_COMPONENT_KINDS_INTERNAL.BEAN_POTATO_STAMPF,
    ]),
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
    for (let kind of LEGACY_RECIPE_COMPONENT_KINDS_BY_FOOD_ID[String(foodRecord?.id || "")] || []) {
      kinds.add(kind);
    }
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
      if (!item) continue;
      let kinds = foodRecipeComponentKinds(item);
      if (kinds.length && JSON.stringify(item.recipeComponentKinds || []) !== JSON.stringify(kinds)) {
        item.recipeComponentKinds = kinds;
        changed = true;
      }
      if (!foodAllowsSmoothPasteComponent(item)) continue;
      let form = foodRecipeComponentForm(item, RECIPE_V2_COMPONENT_KINDS_INTERNAL.SMOOTH_PASTE);
      if (form && item.recipeComponentForm !== form) {
        item.recipeComponentForm = form;
        changed = true;
      }
    }
    return changed;
  }

  function recipeComponentFoodSort(a, b) {
    return (
      (Number(a?.priority) || 9999) - (Number(b?.priority) || 9999) ||
      String(a?.name || "").localeCompare(String(b?.name || ""), "de")
    );
  }

  function recipeComponentFoodNames(kind, foods = [], predicate = null) {
    let allow = typeof predicate === "function" ? predicate : () => true;
    return (foods || [])
      .filter((item) => item && item.active !== false)
      .filter((item) => foodHasRecipeComponentKind(item, kind))
      .filter(allow)
      .sort(recipeComponentFoodSort)
      .map((item) => item.name)
      .filter(Boolean);
  }

  function recipeCategoryFoodByName(name, foods = []) {
    if (typeof foodByName === "function") return foodByName(name, foods);
    return (foods || []).find((item) => item?.name === name) || null;
  }

  function recipeCategoryChoiceNames(category, foods = []) {
    return (foods || [])
      .filter((item) => item?.active !== false && item?.category === category && item?.name)
      .sort(recipeComponentFoodSort)
      .map((item) => item.name);
  }

  function installRecipeChoiceField(recipe, field, names) {
    if (!recipe || !Array.isArray(names) || !names.length) return false;
    let current = Array.isArray(recipe[field]) ? recipe[field] : [];
    let changed = current.length !== names.length || current.some((name, index) => name !== names[index]);
    if (changed) recipe[field] = [...names];
    if (field === "oneOf") {
      if (Array.isArray(recipe.variantLabels)) recipe.variantLabels = [...names];
      if (recipe.family) {
        let familyMatch = String(recipe.familyLabel || "").match(/^\d+\s+(.+varianten)$/);
        if (familyMatch) recipe.familyLabel = `${names.length} ${familyMatch[1]}`;
      }
    }
    return changed;
  }

  function installRecipeCategoryComponentOptions(
    recipes = typeof RECIPES !== "undefined" ? RECIPES : null,
    foods = typeof FOOD_DB !== "undefined" ? FOOD_DB : null,
    category = "Obst",
  ) {
    if (!Array.isArray(recipes) || !Array.isArray(foods) || !category) return false;
    let choiceNames = recipeCategoryChoiceNames(category, foods);
    if (!choiceNames.length) return false;

    let changed = false;
    for (let recipe of recipes) {
      if (!Array.isArray(recipe?.oneOf) || !recipe.oneOf.length) continue;
      let sourceFoods = recipe.oneOf.map((name) => recipeCategoryFoodByName(name, foods));
      if (sourceFoods.some((item) => !item) || sourceFoods.some((item) => item.category !== category)) continue;
      changed = installRecipeChoiceField(recipe, "oneOf", choiceNames) || changed;
    }
    return changed;
  }

  const RECIPE_V2_COMPONENT_OPTIONS = Object.freeze({
    "Milch-Getreide-Brei": Object.freeze({
      oneOfFromFood: Object.freeze({
        kind: RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_GRAIN,
      }),
      milkChoicesFromFood: Object.freeze({
        kind: RECIPE_V2_COMPONENT_KINDS_INTERNAL.MILK_PORRIDGE_LIQUID,
      }),
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
    "Baby-Bananenbrot": Object.freeze({
      oneOfFromFood: Object.freeze({
        kind: RECIPE_V2_COMPONENT_KINDS_INTERNAL.BANANA_BREAD_GRAIN,
      }),
    }),
    "Gemüse-Hafer-Pancakes": Object.freeze({
      oneOfFromFood: Object.freeze({
        kind: RECIPE_V2_COMPONENT_KINDS_INTERNAL.PANCAKE_VEGETABLE,
      }),
    }),
    "Gemüse-Hafer-Muffins": Object.freeze({
      oneOfFromFood: Object.freeze({
        kind: RECIPE_V2_COMPONENT_KINDS_INTERNAL.SOFT_MUFFIN_VEGETABLE,
      }),
    }),
    "Gemüse-Joghurt-Mini-Muffins": Object.freeze({
      oneOfFromFood: Object.freeze({
        kind: RECIPE_V2_COMPONENT_KINDS_INTERNAL.SOFT_MUFFIN_VEGETABLE,
      }),
    }),
    "Huhn-Gemüse-Muffins": Object.freeze({
      oneOfFromFood: Object.freeze({
        kind: RECIPE_V2_COMPONENT_KINDS_INTERNAL.SOFT_MUFFIN_VEGETABLE,
      }),
    }),
    "Bohnen-Kartoffel-Stampf": Object.freeze({
      oneOfFromFood: Object.freeze({
        kind: RECIPE_V2_COMPONENT_KINDS_INTERNAL.BEAN_POTATO_STAMPF,
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

  function recipeComponentNamesFromSource(source, foods) {
    if (!source?.kind || !Array.isArray(foods)) return [];
    return recipeComponentFoodNames(
      source.kind,
      foods,
      (item) =>
        (!source.category || String(item.category || "") === source.category) &&
        (!source.componentForm || foodRecipeComponentForm(item, source.kind) === source.componentForm),
    );
  }

  function installRecipeV2ComponentOptions(
    recipes = typeof RECIPES !== "undefined" ? RECIPES : null,
    foods = typeof FOOD_DB !== "undefined" ? FOOD_DB : null,
  ) {
    if (!Array.isArray(recipes)) return false;
    if (Array.isArray(foods)) installFoodRecipeComponentMetadata(foods);

    let changed = false;
    if (Array.isArray(foods)) {
      changed = installRecipeCategoryComponentOptions(recipes, foods, "Obst") || changed;
    }

    for (let [recipeName, config] of Object.entries(RECIPE_V2_COMPONENT_OPTIONS)) {
      let recipe = recipes.find((item) => item?.name === recipeName);
      if (!recipe) continue;

      for (let field of ["oneOf", "milkChoices"]) {
        let source = config[`${field}FromFood`];
        if (!source || !Array.isArray(foods)) continue;
        let names = recipeComponentNamesFromSource(source, foods);
        if (names.length) changed = installRecipeChoiceField(recipe, field, names) || changed;
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

  function withRecipeV2IngredientReadinessMemo(run) {
    if (typeof run !== "function" || typeof recipeIngredientReady !== "function") {
      return typeof run === "function" ? run() : undefined;
    }
    let originalReady = recipeIngredientReady;
    if (originalReady.__recipeV2ReadinessMemoized) return run();

    let readinessByName = new Map();
    let memoizedReady = function recipeV2MemoizedIngredientReady(name) {
      let key = String(name || "");
      if (readinessByName.has(key)) return readinessByName.get(key);
      let ready = originalReady(name);
      readinessByName.set(key, ready);
      return ready;
    };
    memoizedReady.__recipeV2ReadinessMemoized = true;
    recipeIngredientReady = memoizedReady;
    try {
      return run();
    } finally {
      if (recipeIngredientReady === memoizedReady) recipeIngredientReady = originalReady;
    }
  }

  function installRecipeV2ReadinessMemoRuntime() {
    let changed = false;

    if (typeof recipeStates === "function" && !recipeStates.__recipeV2ReadinessMemoized) {
      let originalRecipeStates = recipeStates;
      let memoizedRecipeStates = function recipeV2MemoizedRecipeStates(...args) {
        return withRecipeV2IngredientReadinessMemo(() => originalRecipeStates.apply(this, args));
      };
      memoizedRecipeStates.__recipeV2ReadinessMemoized = true;
      recipeStates = memoizedRecipeStates;
      changed = true;
    }

    if (typeof buildDay === "function" && !buildDay.__recipeV2ReadinessMemoized) {
      let originalBuildDay = buildDay;
      let memoizedBuildDay = function recipeV2MemoizedBuildDay(...args) {
        return withRecipeV2IngredientReadinessMemo(() => originalBuildDay.apply(this, args));
      };
      memoizedBuildDay.__recipeV2ReadinessMemoized = true;
      buildDay = memoizedBuildDay;
      changed = true;
    }

    return changed;
  }

  function installRecipeV2ComponentRuntime() {
    let foods = typeof FOOD_DB !== "undefined" ? FOOD_DB : null;
    if (Array.isArray(foods)) installFoodRecipeComponentMetadata(foods);
    if (typeof state !== "undefined" && Array.isArray(state?.foods)) installFoodRecipeComponentMetadata(state.foods);
    if (typeof RECIPES !== "undefined") installRecipeV2ComponentOptions(RECIPES, foods);
    installRecipeV2ReadinessMemoRuntime();
  }

  const api = {
    RECIPE_COMPONENT_KINDS: RECIPE_V2_COMPONENT_KINDS_INTERNAL,
    RECIPE_COMPONENT_FORMS,
    LEGACY_RECIPE_COMPONENT_KINDS_BY_FOOD_ID,
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
