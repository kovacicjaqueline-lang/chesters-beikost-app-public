"use strict";

/* MILK-01: Tagesgrenze und Kombinationsschutz für volle Milchmahlzeiten.
 * Sobald der Tageskontext bereits eine volle Milchmahlzeit enthält, dürfen
 * Kuhmilch, Naturjoghurt und Buttermilch nicht mehr als automatische Begleiter
 * in eine weitere Hauptmahlzeit hineinrutschen. Kleine Einführungsportionen
 * bleiben möglich, weil der gewählte Focus selbst nicht aus dem Pool entfernt wird.
 *
 * Zusätzlich gilt die bereits bestehende Milch/Fleisch-/Fisch-Schranke auch für
 * Allergen-Foki. Der Core-Planner springt für allergenGroup direkt zu knownBase();
 * dieselbe Basiswahl wird auch bei der bewussten Allergen-Einplanung verwendet.
 */

function plannerMilkCompatibleKnownBase(focus, meal, exclude, knownBaseFn) {
  if (!state?.foods || typeof knownBaseFn !== "function") return null;
  let focusIsMilk = isMilkProductFood(focus);
  let focusIsMeatOrFish = isMeatOrFish(focus);
  if (!focusIsMilk && !focusIsMeatOrFish) return knownBaseFn(meal, exclude);

  let originalFoods = state.foods;
  state.foods = originalFoods.filter((item) => {
    if (item.id === focus?.id) return true;
    if (focusIsMilk && isMeatOrFish(item)) return false;
    if (focusIsMeatOrFish && isMilkProductFood(item)) return false;
    return true;
  });
  try {
    return knownBaseFn(meal, exclude);
  } finally {
    state.foods = originalFoods;
  }
}

function installPlannerMilkPolicyRuntime() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.__plannerMilkPolicyRuntimeInstalled) return false;
  if (
    typeof buildDay !== "function" ||
    typeof companionFor !== "function" ||
    typeof isMilkProductFood !== "function" ||
    typeof isMeatOrFish !== "function"
  ) return false;

  globalThis.__plannerMilkPolicyRuntimeInstalled = true;

  let originalBuildDay = buildDay;
  let originalCompanionFor = companionFor;
  let activePlannerContext = null;
  let activePlannerDate = "";

  buildDay = function milkPolicyBuildDay(date, index, ctx) {
    let previousContext = activePlannerContext;
    let previousDate = activePlannerDate;
    activePlannerContext = ctx || null;
    activePlannerDate = date || "";
    try {
      return originalBuildDay(date, index, ctx);
    } finally {
      activePlannerContext = previousContext;
      activePlannerDate = previousDate;
    }
  };

  companionFor = function milkPolicyCompanionFor(
    focus,
    meal,
    on,
    focusType = "",
  ) {
    if (!state?.foods) return originalCompanionFor(focus, meal, on, focusType);

    let fullMilkAlreadyPlanned =
      !!activePlannerContext?.fullMilkDates?.has(on) &&
      (!activePlannerDate || activePlannerDate === on);
    let focusIsMilk = isMilkProductFood(focus);
    let focusIsMeatOrFish = isMeatOrFish(focus);

    if (!fullMilkAlreadyPlanned && !focusIsMilk && !focusIsMeatOrFish) {
      return originalCompanionFor(focus, meal, on, focusType);
    }

    let originalFoods = state.foods;
    state.foods = originalFoods.filter((item) => {
      if (item.id === focus?.id) return true;
      if (fullMilkAlreadyPlanned && isMilkProductFood(item)) return false;
      if (focusIsMilk && isMeatOrFish(item)) return false;
      if (focusIsMeatOrFish && isMilkProductFood(item)) return false;
      return true;
    });
    try {
      return originalCompanionFor(focus, meal, on, focusType);
    } finally {
      state.foods = originalFoods;
    }
  };

  // scheduleAllergen() berechnet alle möglichen Mahlzeitenbasen synchron am
  // Funktionsanfang über knownBase(). Für genau diese Basisaufrufe wird derselbe
  // Kombinationsschutz angewendet; vor save()/renderAll() ist knownBase wieder
  // vollständig im Originalzustand.
  if (
    typeof scheduleAllergen === "function" &&
    typeof knownBase === "function" &&
    typeof food === "function"
  ) {
    let originalScheduleAllergen = scheduleAllergen;
    let originalKnownBase = knownBase;
    scheduleAllergen = function milkCompatibleScheduleAllergen(
      foodId,
      date,
      requestedMeal = "lunch",
    ) {
      let focus = food(foodId);
      if (!focus || (!isMilkProductFood(focus) && !isMeatOrFish(focus))) {
        return originalScheduleAllergen(foodId, date, requestedMeal);
      }

      let mealCandidates = [...new Set([requestedMeal, "lunch", "breakfast", "dinner"])]
        .filter((meal) => focus.meals?.includes(meal));
      if (!mealCandidates.length) return originalScheduleAllergen(foodId, date, requestedMeal);

      let previousKnownBase = knownBase;
      let remainingBaseCalls = mealCandidates.length;
      knownBase = function milkCompatibleScheduledKnownBase(meal, exclude = []) {
        try {
          return plannerMilkCompatibleKnownBase(
            focus,
            meal,
            exclude,
            originalKnownBase,
          );
        } finally {
          remainingBaseCalls -= 1;
          if (remainingBaseCalls <= 0) knownBase = previousKnownBase;
        }
      };
      try {
        return originalScheduleAllergen(foodId, date, requestedMeal);
      } finally {
        knownBase = previousKnownBase;
      }
    };
  }

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPlannerMilkPolicyRuntime();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    plannerMilkCompatibleKnownBase,
    installPlannerMilkPolicyRuntime,
  };
}
