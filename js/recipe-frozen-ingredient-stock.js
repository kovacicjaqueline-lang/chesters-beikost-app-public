"use strict";

/* Rezeptvorschläge aus FOOD-Gefriervorrat
 *
 * recipe.freezable bleibt ausschließlich die Aussage, ob ein frisch zubereitetes
 * fertiges Rezept eingefroren werden kann. Diese Runtime beantwortet getrennt,
 * ob eine bereits gegarte und anschließend aufgetaute FOOD-Portion als Zutat für
 * ein konkretes Rezept fachlich und kulinarisch geeignet ist.
 *
 * Nicht ausdrücklich aufgeführte Kombinationen gelten konservativ als nicht
 * freigegeben. Aus aufgetauten Zutaten zubereitete Rezepte werden frisch verbraucht
 * und nicht erneut als neuer Gefriervorrat angeboten.
 */
(function recipeFrozenIngredientStockModule(root) {
  const RECIPE_FROZEN_INGREDIENT_GUIDANCE = Object.freeze({
    "Gemüse-Hafer-Pancakes": Object.freeze({
      ingredients: Object.freeze(["Kürbis", "Süßkartoffel"]),
      note: "Aufgetautes Kürbis- oder Süßkartoffelpüree gut verrühren und mit den frischen übrigen Zutaten vollständig durchgaren. Die fertigen Pancakes nicht erneut einfrieren.",
    }),
    "Ube-Bananen-Pancakes": Object.freeze({
      ingredients: Object.freeze(["Ube (violette Yamswurzel)"]),
      note: "Vollständig gegarte aufgetaute Ube gut zerdrücken, mit den frischen übrigen Zutaten vollständig durchgaren und die fertigen Pancakes nicht erneut einfrieren.",
    }),
    "Lachs-Kartoffel-Bällchen": Object.freeze({
      ingredients: Object.freeze(["Lachs", "Kartoffel"]),
      note: "Gegarten Lachs und weiche Kartoffel vollständig auftauen, sorgfältig auf Gräten prüfen, gemeinsam zerdrücken und vollständig durcherhitzen. Die fertigen Taler nicht erneut einfrieren.",
    }),
    "Rote-Linsen-Gemüsebällchen": Object.freeze({
      ingredients: Object.freeze(["Rote Linsen", "Karotte"]),
      note: "Sehr weich gegarte Linsen und Karottenpüree vollständig auftauen, gut vermengen und die Stücke vollständig durchgaren. Die fertigen Stücke nicht erneut einfrieren.",
    }),
    "Tofu-Brokkoli-Bällchen": Object.freeze({
      ingredients: Object.freeze(["Brokkoli"]),
      note: "Sehr weichen aufgetauten Brokkoli gut abtropfen lassen, mit den frischen übrigen Zutaten vermengen und vollständig erhitzen. Die fertigen Stücke nicht erneut einfrieren.",
    }),
    "Brokkoli-Kartoffel-Taler": Object.freeze({
      ingredients: Object.freeze(["Brokkoli", "Kartoffel"]),
      note: "Sehr weichen Brokkoli und Kartoffel vollständig auftauen, überschüssige Flüssigkeit abgießen, zerdrücken und die Taler vollständig durcherhitzen. Nicht erneut einfrieren.",
    }),
    "Kichererbsen-Kürbis-Taler": Object.freeze({
      ingredients: Object.freeze(["Kichererbse", "Kürbis"]),
      note: "Sehr weiche Kichererbsen und Kürbispüree vollständig auftauen, fein zerdrücken und die Taler vollständig durchgaren. Nicht erneut einfrieren.",
    }),
    "Rote-Linsen-Bratlinge": Object.freeze({
      ingredients: Object.freeze(["Rote Linsen"]),
      note: "Sehr weich gegarte Linsen vollständig auftauen, bei Bedarf überschüssige Flüssigkeit abgießen und die Bratlinge vollständig durchgaren. Nicht erneut einfrieren.",
    }),
    "Süßkartoffel-Hirse-Sticks": Object.freeze({
      ingredients: Object.freeze(["Süßkartoffel"]),
      note: "Aufgetautes Süßkartoffelpüree gut verrühren, mit frisch zubereiteter Hirse weiterverarbeiten und die fertigen Sticks nicht erneut einfrieren.",
    }),
    "Kürbis-Hafer-Brei": Object.freeze({
      ingredients: Object.freeze(["Kürbis"]),
      note: "Aufgetautes Kürbispüree gut verrühren und nach Rezept weiterverarbeiten. Die fertige Mahlzeit frisch verbrauchen und nicht erneut einfrieren.",
    }),
    "Kürbis-Lugaw": Object.freeze({
      ingredients: Object.freeze(["Kürbis"]),
      note: "Aufgetauten sehr weich gegarten Kürbis in der frisch gekochten Reisbasis vollständig durcherhitzen und die fertige Mahlzeit nicht erneut einfrieren.",
    }),
    "Monggo-Kalabasa-Brei": Object.freeze({
      ingredients: Object.freeze(["Kürbis"]),
      note: "Aufgetauten Kürbis mit den frisch gekochten Mungbohnen vollständig durcherhitzen, Konsistenz anpassen und die fertige Mahlzeit nicht erneut einfrieren.",
    }),
    "Kürbis-Hirse-Muffins": Object.freeze({
      ingredients: Object.freeze(["Kürbis"]),
      note: "Aufgetautes Kürbispüree vor dem Abmessen gut verrühren und im frischen Teig vollständig durchbacken. Die fertigen Muffins nicht erneut einfrieren.",
    }),
    "Karotten-Polenta-Brei": Object.freeze({
      ingredients: Object.freeze(["Karotte"]),
      note: "Sehr weiche aufgetaute Karotte in der frisch gekochten Polenta vollständig durcherhitzen, passend pürieren oder zerdrücken und nicht erneut einfrieren.",
    }),
    "Süßkartoffel-Rote-Linsen-Brei": Object.freeze({
      ingredients: Object.freeze(["Süßkartoffel"]),
      note: "Aufgetaute Süßkartoffel mit frisch gekochten roten Linsen vollständig durcherhitzen, passend pürieren oder zerdrücken und nicht erneut einfrieren.",
    }),
    "Karotten-Hirse-Brei mit Tahin": Object.freeze({
      ingredients: Object.freeze(["Karotte"]),
      note: "Aufgetautes Karottenpüree vollständig erwärmen beziehungsweise im Brei weitergaren, gut verrühren und die fertige Mahlzeit nicht erneut einfrieren.",
    }),
    "Apfel-Hirse-Brei mit Mandelmus": Object.freeze({
      ingredients: Object.freeze(["Apfel"]),
      note: "Weich gegarten aufgetauten Apfel im Brei vollständig erwärmen, die Konsistenz prüfen und die fertige Mahlzeit nicht erneut einfrieren.",
    }),
    "Karotte-Süßkartoffel-Brei": Object.freeze({
      ingredients: Object.freeze(["Karotte", "Süßkartoffel"]),
      note: "Die gegarten Gemüseportionen vollständig auftauen, gemeinsam erhitzen und erst dann passend pürieren oder zerdrücken. Die fertige Mahlzeit nicht erneut einfrieren.",
    }),
    "Brokkoli-Kartoffel-Stampf": Object.freeze({
      ingredients: Object.freeze(["Brokkoli", "Kartoffel"]),
      note: "Sehr weichen Brokkoli und Kartoffel vollständig auftauen, überschüssige Flüssigkeit abgießen, gemeinsam durcherhitzen und nur kurz zerdrücken. Nicht erneut einfrieren.",
    }),
    "Karfiol-Kartoffel-Stampf": Object.freeze({
      ingredients: Object.freeze(["Karfiol", "Kartoffel"]),
      note: "Sehr weichen Karfiol und Kartoffel vollständig auftauen, überschüssige Flüssigkeit abgießen, gemeinsam durcherhitzen und nur kurz zerdrücken. Nicht erneut einfrieren.",
    }),
    "Zucchini-Kartoffel-Brei": Object.freeze({
      ingredients: Object.freeze(["Zucchini", "Kartoffel"]),
      note: "Sehr weich gegarte Zucchini und Kartoffel vollständig auftauen, wegen der Zucchini überschüssige Flüssigkeit abgießen, durcherhitzen und passend pürieren. Nicht erneut einfrieren.",
    }),
    "Erbsen-Kartoffel-Stampf": Object.freeze({
      ingredients: Object.freeze(["Erbsen (TK möglich)", "Kartoffel"]),
      note: "Sehr weich gegarte Erbsen und Kartoffel vollständig auftauen, gemeinsam durcherhitzen und passend zerdrücken. Nicht erneut einfrieren.",
    }),
    "Kürbis-Linsen-Suppe": Object.freeze({
      ingredients: Object.freeze(["Kürbis"]),
      note: "Aufgetauten Kürbis mit den frisch gekochten roten Linsen vollständig durcherhitzen, die Konsistenz anpassen und die Suppe nicht erneut einfrieren.",
    }),
    "Lachs-Süßkartoffel-Stampf": Object.freeze({
      ingredients: Object.freeze(["Lachs", "Süßkartoffel"]),
      note: "Vollständig gegarten Lachs und sehr weiche Süßkartoffel auftauen, den Fisch erneut sorgfältig auf Gräten prüfen, gemeinsam durcherhitzen und nicht erneut einfrieren.",
    }),
    "Hummus mit weichen Gemüsesticks": Object.freeze({
      ingredients: Object.freeze(["Kichererbse"]),
      note: "Sehr weiche aufgetaute Kichererbsen vollständig durcherhitzen beziehungsweise hygienisch weiterverarbeiten, fein pürieren und den fertigen Hummus nicht erneut einfrieren.",
    }),
    "Kürbis-Kichererbsen-Creme": Object.freeze({
      ingredients: Object.freeze(["Kürbis", "Kichererbse"]),
      note: "Kürbis und sehr weiche Kichererbsen vollständig auftauen, gemeinsam durcherhitzen, fein pürieren und die fertige Creme nicht erneut einfrieren.",
    }),
  });

  function recipeFrozenIngredientGuidance(recipeOrName) {
    let name = typeof recipeOrName === "string" ? recipeOrName : recipeOrName?.name;
    return RECIPE_FROZEN_INGREDIENT_GUIDANCE[name] || null;
  }

  function recipeFrozenIngredientCompatible(recipe, foodRecord) {
    if (!recipe || !foodRecord) return false;
    let guidance = recipeFrozenIngredientGuidance(recipe);
    return !!guidance && guidance.ingredients.includes(foodRecord.name);
  }

  function recipeIngredientStockSource(recipe, foodRecord, pantryState = {}, frozenPortions = 0) {
    if (!foodRecord) return "";
    if (pantryState?.[foodRecord.id]) return "pantry";
    if (Number(frozenPortions) > 0 && recipeFrozenIngredientCompatible(recipe, foodRecord)) return "frozen";
    return "";
  }

  function stockSourceForName(recipe, name, byName, pantryState, inventoryPortionsFn) {
    let item = byName.get(name) || null;
    return {
      name,
      food: item,
      source: recipeIngredientStockSource(
        recipe,
        item,
        pantryState,
        item ? inventoryPortionsFn(item.id) : 0,
      ),
    };
  }

  function recipeStockResolution(
    recipe,
    foods = [],
    pantryState = {},
    inventoryPortionsFn = () => 0,
  ) {
    if (!recipe) return { matches: false, sources: [] };
    let byName = new Map((foods || []).map((item) => [item.name, item]));
    let requirementSets = [recipe.requires || [], ...(recipe.alternatives || [])]
      .filter((set, index) => set.length || index === 0);
    let choiceGroups = [recipe.oneOf || [], recipe.milkChoices || []].filter((group) => group.length);

    for (let set of requirementSets) {
      let sources = set.map((name) => stockSourceForName(recipe, name, byName, pantryState, inventoryPortionsFn));
      if (sources.some((entry) => !entry.source)) continue;

      let choices = [];
      let allChoicesAvailable = true;
      for (let group of choiceGroups) {
        let candidates = group
          .map((name) => stockSourceForName(recipe, name, byName, pantryState, inventoryPortionsFn))
          .filter((entry) => !!entry.source)
          .sort((a, b) => (a.source === "pantry" ? 0 : 1) - (b.source === "pantry" ? 0 : 1));
        if (!candidates.length) {
          allChoicesAvailable = false;
          break;
        }
        choices.push(candidates[0]);
      }
      if (!allChoicesAvailable) continue;
      return { matches: true, sources: [...sources, ...choices] };
    }
    return { matches: false, sources: [] };
  }

  function recipeMatchesIngredientStock(recipe, foods, pantryState, inventoryPortionsFn) {
    return recipeStockResolution(recipe, foods, pantryState, inventoryPortionsFn).matches;
  }

  function recipeUsesFrozenIngredientStock(recipe, foods, pantryState, inventoryPortionsFn) {
    let resolution = recipeStockResolution(recipe, foods, pantryState, inventoryPortionsFn);
    return resolution.matches && resolution.sources.some((entry) => entry.source === "frozen");
  }

  function applyFrozenIngredientRecipeContext(
    recipeList,
    recipes,
    foods,
    pantryState,
    inventoryPortionsFn,
    escapeFn = (value) => String(value ?? ""),
  ) {
    if (!recipeList?.querySelectorAll) return 0;
    let cards = [...recipeList.querySelectorAll(".recipe-card-v2")];
    let changed = 0;
    (recipes || []).forEach((recipe, index) => {
      if (!recipeUsesFrozenIngredientStock(recipe, foods, pantryState, inventoryPortionsFn)) return;
      let card = cards[index];
      if (!card) return;
      let storage = [...card.querySelectorAll(".recipe-subsection")].find(
        (details) => String(details.querySelector("summary")?.textContent || "").trim() === "Aufbewahrung",
      );
      let body = storage?.querySelector(".recipe-subsection-body");
      if (!body) return;
      let note = recipeFrozenIngredientGuidance(recipe)?.note ||
        "Aufgetaute Zutaten nach dem Auftauen direkt verarbeiten und die fertige Mahlzeit nicht erneut einfrieren.";
      body.innerHTML = `<div class="small"><b>Aus Gefriervorrat zubereiten:</b> ${escapeFn(note)}</div>`;
      changed += 1;
    });
    return changed;
  }

  function pantryRecipeStates(
    recipes,
    foods,
    pantryState,
    inventoryPortionsFn,
    query = "",
    normalizeFn = (value) => String(value || "").toLowerCase(),
    searchTextFn = (recipe) => recipe?.name || "",
  ) {
    let normalizedQuery = normalizeFn(query);
    return (recipes || []).filter((recipe) => {
      if (!recipeMatchesIngredientStock(recipe, foods, pantryState, inventoryPortionsFn)) return false;
      return !normalizedQuery || normalizeFn(searchTextFn(recipe)).includes(normalizedQuery);
    });
  }

  function installRecipeFrozenIngredientStockRuntime() {
    if (typeof renderPrepCore !== "function" || typeof document === "undefined") return false;
    if (root.__recipeFrozenIngredientStockRuntimeInstalled) return false;
    root.__recipeFrozenIngredientStockRuntimeInstalled = true;

    let originalRenderPrepCore = renderPrepCore;
    renderPrepCore = function renderPrepWithFrozenIngredientCompatibility(...args) {
      let result = originalRenderPrepCore.apply(this, args);
      if (typeof recipeFilter === "undefined" || recipeFilter !== "pantry") return result;

      let list = document.getElementById("recipeList");
      if (!list || typeof recipeStates !== "function" || typeof inventoryPortions !== "function") return result;

      let recipes = pantryRecipeStates(
        recipeStates(),
        state?.foods || [],
        state?.pantry || {},
        inventoryPortions,
        typeof recipeQuery === "undefined" ? "" : recipeQuery,
        typeof normalizeName === "function" ? normalizeName : undefined,
        typeof recipeSearchText === "function" ? recipeSearchText : undefined,
      );

      list.innerHTML = recipes.length
        ? recipes.map(renderRecipeCard).join("")
        : '<div class="empty ds-empty"><div>Keine Rezepte für diesen Filter gefunden.</div><button class="btn" id="recipeEmptyAction" type="button">Filter zurücksetzen</button></div>';

      let countBox = document.getElementById("recipeCount");
      if (countBox)
        countBox.textContent = `${recipes.length} Rezept${recipes.length === 1 ? "" : "e"} · passend zu Filter und Suche`;

      applyFrozenIngredientRecipeContext(
        list,
        recipes,
        state?.foods || [],
        state?.pantry || {},
        inventoryPortions,
        typeof esc === "function" ? esc : undefined,
      );

      document.getElementById("recipeEmptyAction")?.addEventListener("click", () => {
        recipeQuery = "";
        recipeFilter = "available";
        if (typeof renderPrep === "function") renderPrep();
      });
      if (typeof bindRecipeStockButtons === "function") bindRecipeStockButtons();
      return result;
    };
    return true;
  }

  let api = {
    RECIPE_FROZEN_INGREDIENT_GUIDANCE,
    recipeFrozenIngredientGuidance,
    recipeFrozenIngredientCompatible,
    recipeIngredientStockSource,
    recipeStockResolution,
    recipeMatchesIngredientStock,
    recipeUsesFrozenIngredientStock,
    applyFrozenIngredientRecipeContext,
    pantryRecipeStates,
    installRecipeFrozenIngredientStockRuntime,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.__recipeFrozenIngredientStock = api;

  if (typeof document !== "undefined") installRecipeFrozenIngredientStockRuntime();
})(typeof window !== "undefined" ? window : globalThis);