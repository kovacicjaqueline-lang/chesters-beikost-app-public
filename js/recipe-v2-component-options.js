"use strict";

/*
 * Zentrale Recipe-V2-Komponentenoptionen.
 *
 * Bestehende FOOD-Identitäten bleiben kanonisch. Rezeptbezogene Anzeigenamen für
 * Zubereitungsformen (z. B. Mandelmilch) liegen als UI-Metadaten am Rezept; die
 * fachlich zulässigen Identitäten selbst stehen vollständig in `milkChoices`.
 */

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
});

function installRecipeV2ComponentOptions(recipes = typeof RECIPES !== "undefined" ? RECIPES : null) {
  if (!Array.isArray(recipes)) return false;
  let changed = false;
  for (let [recipeName, config] of Object.entries(RECIPE_V2_COMPONENT_OPTIONS)) {
    let recipe = recipes.find((item) => item?.name === recipeName);
    if (!recipe) continue;
    for (let field of ["milkChoices"]) {
      if (!Array.isArray(config[field])) continue;
      recipe[field] = [...config[field]];
    }
    recipe.editorComponents = {
      ...(recipe.editorComponents || {}),
      ...(config.editorComponents || {}),
    };
    changed = true;
  }
  return changed;
}

if (typeof RECIPES !== "undefined") installRecipeV2ComponentOptions(RECIPES);

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    RECIPE_V2_COMPONENT_OPTIONS,
    installRecipeV2ComponentOptions,
  };
}
