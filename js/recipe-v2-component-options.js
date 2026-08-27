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

function foodAllowsSmoothPasteComponent(foodRecord) {
  if (!foodRecord) return false;
  let category = String(foodRecord.category || "");
  let allergenGroup = String(foodRecord.allergenGroup || "");
  if (category === "Nuss") {
    return allergenGroup === "Erdnuss" || allergenGroup === "Schalenfrüchte";
  }
  return category === "Samen" && allergenGroup === "Sesam";
}

function foodHasRecipeComponentKind(foodRecord, kind) {
  if (!foodRecord || !kind) return false;
  if (kind === RECIPE_COMPONENT_KINDS.SMOOTH_PASTE) {
    return foodAllowsSmoothPasteComponent(foodRecord);
  }
  return Array.isArray(foodRecord.recipeComponentKinds) && foodRecord.recipeComponentKinds.includes(kind);
}

function foodIsDedicatedSmoothPasteVariant(foodRecord) {
  let id = String(foodRecord?.id || "");
  return id === "tahin" || id.endsWith("mus");
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
      canonicalFoodOnly: true,
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
      let { kind, category, canonicalFoodOnly } = config.oneOfFromFood;
      let names = recipeComponentFoodNames(
        kind,
        foods,
        (item) =>
          (!category || String(item.category || "") === category) &&
          (!canonicalFoodOnly || !foodIsDedicatedSmoothPasteVariant(item)),
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
    foodAllowsSmoothPasteComponent,
    foodHasRecipeComponentKind,
    foodIsDedicatedSmoothPasteVariant,
    recipeComponentFoodNames,
    installRecipeV2ComponentOptions,
  };
}
