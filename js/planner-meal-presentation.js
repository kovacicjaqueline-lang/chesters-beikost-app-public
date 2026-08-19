"use strict";

/* PLAN-08: kulinarisch nachvollziehbare Darstellung automatischer FOOD-Mahlzeiten.
 *
 * Echte Rezepte bleiben über recipeName maßgeblich. Für FOOD-only-Mahlzeiten
 * werden keine Gerichte aus Freitext-Zubereitungshinweisen abgeleitet. Wo eine
 * fachlich bestätigte Darreichungsrolle nötig ist, kommt sie aus dem separaten
 * strukturierten FOOD_PRESENTATION_CONTRACT. Alle übrigen bestehenden
 * Planner-Titel bleiben unverändert.
 */

function plannerFoodPresentationRole(item) {
  if (!item) return "";
  if (item.plannerPresentationRole) return item.plannerPresentationRole;
  if (typeof FOOD_PRESENTATION_CONTRACT === "undefined") return "";
  return FOOD_PRESENTATION_CONTRACT[item.id]?.role || "";
}

function plannerNeutralBreakfastTitle(meal, items) {
  if (meal?.meal !== "breakfast" || items.length !== 2) return "";
  let categories = new Set(items.map((item) => item.category));

  // Ei + Obst ist als Kombination zulässig, aber ohne konkretes recipeName darf
  // der Planner daraus weder eine Eierspeise noch automatisch Pancakes erfinden.
  if (categories.has("Ei") && categories.has("Obst")) {
    return naturalFoodList(items.map((item) => item.name));
  }
  return "";
}

function plannerAutomaticComponentTitle(meal) {
  if (!meal || meal.recipeName || meal.manualAdded) return "";
  if ((meal.sampleFoodIds || []).length) return "";

  let ids = [...new Set(meal.foodIds || [])].filter(Boolean);
  let items = ids.map((id) => food(id)).filter(Boolean);
  if (items.length < 2) return "";

  let neutralBreakfastTitle = plannerNeutralBreakfastTitle(meal, items);
  if (neutralBreakfastTitle) return neutralBreakfastTitle;

  let roles = items.map(plannerFoodPresentationRole);
  let hasFreshSide = roles.includes("fresh-side");
  let hasOtherComponent = roles.some((role) => role !== "fresh-side");
  if (hasFreshSide && hasOtherComponent) {
    return `${naturalFoodList(items.map((item) => item.name))} · getrennte Komponenten`;
  }

  return "";
}

function installPlannerMealPresentationRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__plannerMealPresentationRuntimeInstalled) return false;
  if (
    typeof dishTitle !== "function" ||
    typeof food !== "function" ||
    typeof naturalFoodList !== "function"
  ) return false;

  globalThis.__plannerMealPresentationRuntimeInstalled = true;
  let originalDishTitle = dishTitle;

  dishTitle = function plan08DishTitle(meal) {
    let componentTitle = plannerAutomaticComponentTitle(meal);
    return componentTitle || originalDishTitle(meal);
  };

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerMealPresentationRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    plannerFoodPresentationRole,
    plannerNeutralBreakfastTitle,
    plannerAutomaticComponentTitle,
    installPlannerMealPresentationRuntime,
  };
}
