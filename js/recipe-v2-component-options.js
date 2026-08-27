"use strict";

/*
 * Zentrale Recipe-V2-Komponentenoptionen.
 *
 * Bestehende FOOD-Identitäten bleiben kanonisch. Austauschbare Rezeptkomponenten
 * werden soweit möglich aus strukturierten FOOD-Eigenschaften abgeleitet statt als
 * zweite ID-/Namensliste pro Rezept gepflegt. Rezeptbezogene Anzeigenamen für
 * Zubereitungsformen (z. B. Mandelmilch) bleiben reine UI-Metadaten.
 */

const RECIPE_COMPONENT_KINDS = Object.freeze({
  SMOOTH_PASTE: "smooth-paste",
});

function foodRecipeComponentKinds(foodRecord) {
  return Array.isArray(foodRecord?.recipeComponentKinds)
    ? foodRecord.recipeComponentKinds.filter(Boolean)
    : [];
}

function foodHasRecipeComponentKind(foodRecord, kind) {
  return !!foodRecord && !!kind && foodRecipeComponentKinds(foodRecord).includes(kind);
}

function foodAllowsSmoothPasteComponent(foodRecord) {
  if (!foodRecord || !["Nuss", "Samen"].includes(String(foodRecord.category || ""))) return false;
  return /\bMus\b/i.test(String(foodRecord.safeForm || ""));
}

function installFoodRecipeComponentMetadata(foods = typeof FOOD_DB !== "undefined" ? FOOD_DB : null) {
  if (!Array.isArray(foods)) return false;
  let changed = false;
  for (let item of foods) {
    if (!foodAllowsSmoothPasteComponent(item)) continue;
    let kinds = new Set(foodRecipeComponentKinds(item));
    if (kinds.has(RECIPE_COMPONENT_KINDS.SMOOTH_PASTE)) continue;
    kinds.add(RECIPE_COMPONENT_KINDS.SMOOTH_PASTE);
    item.recipeComponentKinds = [...kinds];
    changed = true;
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
      kind: RECIPE_COMPONENT_KINDS.SMOOTH_PASTE,
      category: "Nuss",
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
  for (let [recipeName, config] of Object.entries(RECIPE_V2_COMPONENT_OPTIONS)) {
    let recipe = recipes.find((item) => item?.name === recipeName);
    if (!recipe) continue;

    for (let field of ["milkChoices"]) {
      if (!Array.isArray(config[field])) continue;
      recipe[field] = [...config[field]];
      changed = true;
    }

    if (config.oneOfFromFood && Array.isArray(foods)) {
      let { kind, category } = config.oneOfFromFood;
      let names = recipeComponentFoodNames(
        kind,
        foods,
        (item) => !category || String(item.category || "") === category,
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

if (typeof RECIPES !== "undefined") {
  installRecipeV2ComponentOptions(
    RECIPES,
    typeof FOOD_DB !== "undefined" ? FOOD_DB : null,
  );
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    RECIPE_COMPONENT_KINDS,
    RECIPE_V2_COMPONENT_OPTIONS,
    foodRecipeComponentKinds,
    foodHasRecipeComponentKind,
    foodAllowsSmoothPasteComponent,
    installFoodRecipeComponentMetadata,
    recipeComponentFoodNames,
    installRecipeV2ComponentOptions,
  };
}
