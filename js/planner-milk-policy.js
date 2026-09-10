"use strict";

/* MILK-01: Tagesgrenze, Rollenvertrag und Kombinationsschutz für Milchmahlzeiten.
 * Kuhmilch ist außerhalb eines Rezepts nur als Zutat/Kostprobe zulässig und deshalb
 * eine Planner-Komponente: keine normale Hauptbasis und kein regulärer Auto-Fokus.
 * Für die automatische Allergen-Einführung/-Wiederholung wird sie eng als Sample
 * freigeschaltet und nur mit einer bekannten Getreidebasis kombiniert.
 *
 * Naturjoghurt und Buttermilch behalten ihre bisherigen Planner-Rollen.
 * Sobald der Tageskontext bereits eine volle Milchmahlzeit enthält, dürfen
 * Kuhmilch, Naturjoghurt und Buttermilch nicht mehr als automatische Begleiter
 * in eine weitere Hauptmahlzeit hineinrutschen. Kleine Einführungsportionen
 * bleiben möglich.
 *
 * Zusätzlich gilt die Milch/Fleisch-/Fisch-Schranke auch für Allergen-Foki.
 * Der Core-Planner springt für allergenGroup direkt zu knownBase(); dieselbe
 * Basiswahl wird auch bei der bewussten Allergen-Einplanung verwendet.
 */

const PLANNER_COW_MILK_ID = "kuhmilch";

function plannerCowMilkIngredientOnly(foodRecord) {
  return String(foodRecord?.id || "") === PLANNER_COW_MILK_ID;
}

function plannerMilkNormalizeIntroductionResult(result) {
  if (!plannerCowMilkIngredientOnly(result?.f)) return result;
  if (result.type === "bekannt kombinieren") {
    return { ...result, type: "gezielt wiederholen" };
  }
  return result;
}

function plannerMilkCompatibleKnownBase(focus, meal, exclude, knownBaseFn) {
  if (!state?.foods || typeof knownBaseFn !== "function") return null;
  let focusIsMilk = isMilkProductFood(focus);
  let focusIsCowMilk = plannerCowMilkIngredientOnly(focus);
  let focusIsMeatOrFish = isMeatOrFish(focus);
  if (!focusIsMilk && !focusIsMeatOrFish) return knownBaseFn(meal, exclude);

  let originalFoods = state.foods;
  state.foods = originalFoods.filter((item) => {
    if (item.id === focus?.id) return true;
    if (focusIsCowMilk && item.category !== "Getreide/Stärke") return false;
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

  // Der bestehende zentrale Rollenvertrag bleibt die einzige Rollenwahrheit.
  // MILK-01 liefert für Kuhmilch nur die fachliche Zuordnung "component".
  if (typeof plannerRole === "function") {
    let originalPlannerRole = plannerRole;
    plannerRole = function milkPolicyPlannerRole(foodRecord) {
      if (plannerCowMilkIngredientOnly(foodRecord)) return "component";
      return originalPlannerRole(foodRecord);
    };
  }

  // Component-FOODs sind regulär kein Auto-Fokus. Kuhmilch darf diese Schranke
  // ausschließlich während einer echten automatischen Einführung/Wiederholung
  // als Kostprobe passieren. Explizite Overrides laufen weiterhin über den
  // bestehenden generischen Component-Override-Vertrag.
  let cowMilkSampleFocusDepth = 0;
  if (
    typeof plannerFoodCanBeAutomaticFocus === "function" &&
    typeof introductionCandidate === "function" &&
    typeof knownBase === "function"
  ) {
    let originalPlannerFoodCanBeAutomaticFocus = plannerFoodCanBeAutomaticFocus;
    let originalIntroductionCandidate = introductionCandidate;

    plannerFoodCanBeAutomaticFocus = function milkPolicyAutomaticFocus(foodRecord) {
      if (plannerCowMilkIngredientOnly(foodRecord)) {
        return cowMilkSampleFocusDepth > 0;
      }
      return originalPlannerFoodCanBeAutomaticFocus(foodRecord);
    };

    introductionCandidate = function milkPolicyIntroductionCandidate(
      meal,
      on,
      ctx,
      exclude = [],
    ) {
      let explicitOverride =
        String(state?.overrides?.[`${on}|${meal}`] || "") === PLANNER_COW_MILK_ID;

      // Der generische Component-Override-Vertrag markiert eine bewusst gewählte
      // Kuhmilch bereits als "manuell" und damit als Sample; diese Auswahl darf
      // durch die temporäre Auto-Freigabe nicht versehentlich zu "bekannt" werden.
      if (explicitOverride) {
        return plannerMilkNormalizeIntroductionResult(
          originalIntroductionCandidate(meal, on, ctx, exclude),
        );
      }

      let blocked = [...exclude];
      let max = (state?.foods?.length || 0) + 1;
      for (let i = 0; i < max; i++) {
        let result;
        cowMilkSampleFocusDepth++;
        try {
          result = originalIntroductionCandidate(meal, on, ctx, blocked);
        } finally {
          cowMilkSampleFocusDepth--;
        }

        result = plannerMilkNormalizeIntroductionResult(result);
        if (!plannerCowMilkIngredientOnly(result?.f)) return result;

        let base = plannerMilkCompatibleKnownBase(
          result.f,
          meal,
          [result.f.id],
          knownBase,
        );
        if (base) return result;

        if (blocked.includes(result.f.id)) return null;
        blocked.push(result.f.id);
      }
      return null;
    };
  }

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
    let focusIsCowMilk = plannerCowMilkIngredientOnly(focus);
    let focusIsMeatOrFish = isMeatOrFish(focus);

    if (!fullMilkAlreadyPlanned && !focusIsMilk && !focusIsMeatOrFish) {
      return originalCompanionFor(focus, meal, on, focusType);
    }

    let originalFoods = state.foods;
    state.foods = originalFoods.filter((item) => {
      if (item.id === focus?.id) return true;
      if (fullMilkAlreadyPlanned && isMilkProductFood(item)) return false;
      if (focusIsCowMilk && item.category !== "Getreide/Stärke") return false;
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
  // Kombinationsschutz angewendet; bei Kuhmilch ist damit zusätzlich eine bekannte
  // Getreidebasis zwingend. Vor save()/renderAll() ist knownBase wieder vollständig
  // im Originalzustand.
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
    PLANNER_COW_MILK_ID,
    plannerCowMilkIngredientOnly,
    plannerMilkNormalizeIntroductionResult,
    plannerMilkCompatibleKnownBase,
    installPlannerMilkPolicyRuntime,
  };
}
