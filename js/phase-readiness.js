"use strict";

// PHASE-TRANSITION core: recommendation only. This module never mutates phaseSelected
// and deliberately does not inspect age, grams, log counts, texture, inventory or planner locks.
const PHASE_READINESS_RULES = Object.freeze({
  kennenlernen: Object.freeze({ nextPhase: "aufbau", nextMeal: "breakfast" }),
  aufbau: Object.freeze({ nextPhase: "drei", nextMeal: "dinner" }),
  drei: Object.freeze({ nextPhase: "familie", nextMeal: "snack" }),
  familie: Object.freeze({ nextPhase: null, nextMeal: null }),
});

function normalizePhaseReadinessSignal(value) {
  if (value === true || value === "yes") return "yes";
  if (value === false || value === "no") return "no";
  return "unknown";
}

function phaseReadinessRecommendation(input = {}) {
  const phase = PHASE_READINESS_RULES[input.phase] ? input.phase : "kennenlernen";
  const rule = PHASE_READINESS_RULES[phase];

  if (!rule.nextPhase) {
    return {
      currentPhase: phase,
      nextPhase: null,
      nextMeal: null,
      recommendation: "notYet",
      recommendable: false,
      signals: {
        currentPatternAccepted: "unknown",
        additionalMealCue: "unknown",
        routineCompatible: "unknown",
      },
      reasons: ["finalPhaseReached"],
      missingPrerequisites: [],
    };
  }

  const signals = {
    currentPatternAccepted: normalizePhaseReadinessSignal(input.currentPatternAccepted),
    additionalMealCue: normalizePhaseReadinessSignal(input.additionalMealCue),
    routineCompatible: normalizePhaseReadinessSignal(input.routineCompatible),
  };
  const reasons = [];
  const missingPrerequisites = [];

  for (const [name, value] of Object.entries(signals)) {
    if (value === "unknown") {
      missingPrerequisites.push(name);
      reasons.push(`${name}Unknown`);
    } else if (value === "yes") {
      reasons.push(`${name}Confirmed`);
    } else {
      reasons.push(`${name}NotConfirmed`);
    }
  }

  const recommendable = Object.values(signals).every((value) => value === "yes");

  return {
    currentPhase: phase,
    nextPhase: rule.nextPhase,
    nextMeal: rule.nextMeal,
    recommendation: recommendable ? "recommended" : "notYet",
    recommendable,
    signals,
    reasons,
    missingPrerequisites,
  };
}

function currentPhaseReadiness(signals = {}) {
  const phase = typeof currentPhase === "function" ? currentPhase() : "kennenlernen";
  return phaseReadinessRecommendation({
    phase,
    currentPatternAccepted: signals.currentPatternAccepted,
    additionalMealCue: signals.additionalMealCue,
    routineCompatible: signals.routineCompatible,
  });
}

// Strukturierter Planprüfungs-Vertrag. Sichtbare Texte bleiben bewusst außerhalb
// dieses Primärmodells und werden nur im Kompatibilitätsadapter erzeugt.
const PLAN_CHECK_SCHEMA_VERSION = 1;
const PLAN_CHECK_TYPES = Object.freeze({
  HARD_BLOCKER: "hard_blocker",
  REQUIRED_ACTION: "required_action",
  OPEN_GOAL: "open_goal",
  PROJECTED_COVERED_GOAL: "projected_covered_goal",
  RECOMMENDATION: "recommendation",
});
const PLAN_CHECK_CODES = Object.freeze({
  FOCUS_ROTATION_LOW: "FOCUS_ROTATION_LOW",
  CONSECUTIVE_FOCUS_REPEAT: "CONSECUTIVE_FOCUS_REPEAT",
  NEW_FOOD_WITHOUT_TRUSTED_BASE: "NEW_FOOD_WITHOUT_TRUSTED_BASE",
  MILK_WITH_MEAT_OR_FISH: "MILK_WITH_MEAT_OR_FISH",
  MULTIPLE_FULL_MILK_MEALS: "MULTIPLE_FULL_MILK_MEALS",
  IRON_RICH_MISSING: "IRON_RICH_MISSING",
  INACTIVE_FOOD_PLANNED: "INACTIVE_FOOD_PLANNED",
  ALLERGEN_MAINTENANCE_DUE: "ALLERGEN_MAINTENANCE_DUE",
  ALLERGEN_MAINTENANCE_PROJECTED: "ALLERGEN_MAINTENANCE_PROJECTED",
});

function planCheckUnique(values = []) {
  return [...new Set((values || []).filter(Boolean))];
}

function planCheckFood(foodId) {
  return typeof food === "function" ? food(foodId) : null;
}

function planCheckMealRef(meal = {}) {
  return {
    date: meal.date || "",
    meal: meal.meal || "",
    focusId: meal.focusId || "",
    foodIds: planCheckUnique(meal.foodIds || []),
    baseFoodIds: planCheckUnique(meal.baseFoodIds || []),
    sampleFoodIds: planCheckUnique(meal.sampleFoodIds || []),
    recipeName: meal.recipeName || "",
  };
}

function planCheckRefs({ foodIds = [], allergenTargets = [], recipeNames = [], meals = [] } = {}) {
  return {
    foodIds: planCheckUnique(foodIds),
    allergenTargets: (allergenTargets || []).map((target) => ({
      key: target.key || "",
      kind: target.kind || "",
      value: target.value || "",
      allergenGroup: target.allergenGroup || "",
      representativeFoodId: target.representativeFoodId || "",
      lastEatenDate: target.lastEatenDate || "",
    })),
    recipeNames: planCheckUnique(recipeNames),
    meals: (meals || []).map(planCheckMealRef),
  };
}

function visiblePlanCheckMeals(days = []) {
  return (days || []).flatMap((day) =>
    (day.meals || [])
      .filter((meal) =>
        meal.active &&
        !meal.empty &&
        meal.focusId &&
        !(typeof mealIsCompleted === "function" && mealIsCompleted(day.date, meal.meal))
      )
      .map((meal) => ({ ...meal, date: day.date })),
  );
}

function planCheckRecipeHelpers() {
  return {
    recipeByNameFn: (name) => typeof recipeByName === "function" ? recipeByName(name) : null,
    recipeFoodIdsFn: (recipe) => typeof recipeFoodIds === "function" ? recipeFoodIds(recipe) : [],
  };
}

function planCheckMaintenanceState(meals, asOf) {
  const core = typeof globalThis !== "undefined" ? globalThis.PlannerAllergenMaintenance : null;
  if (!core || !state?.foods || !state?.logs || !asOf) {
    return {
      available: false,
      asOf: asOf || "",
      dueTargets: [],
      projectedTargetKeys: [],
      openTargetKeys: [],
      coveredTargetKeys: [],
      items: [],
    };
  }

  const helpers = planCheckRecipeHelpers();
  const projectedMealsByTarget = new Map();
  for (const meal of meals || []) {
    for (const targetKey of core.projectedTargetKeysForRecord(meal, state.foods, helpers)) {
      if (!projectedMealsByTarget.has(targetKey)) projectedMealsByTarget.set(targetKey, []);
      projectedMealsByTarget.get(targetKey).push(meal);
    }
  }
  const projectedTargetKeys = new Set(projectedMealsByTarget.keys());
  const dueTargets = core.dueTargets({
    foods: state.foods,
    logs: state.logs,
    on: asOf,
    intervalDays: Number(state.settings?.allergenDays) || 7,
    rankFn: (foodRecord) => typeof rank === "function" ? rank(foodRecord) : 0,
    outcomeForFoodFn: (logRecord, id) => typeof outcomeForFood === "function" ? outcomeForFood(logRecord, id) : "",
    projectedTargetKeys: new Set(),
  });

  const items = dueTargets.map((target) => {
    const coveringMeals = projectedMealsByTarget.get(target.key) || [];
    const covered = coveringMeals.length > 0;
    return {
      code: covered
        ? PLAN_CHECK_CODES.ALLERGEN_MAINTENANCE_PROJECTED
        : PLAN_CHECK_CODES.ALLERGEN_MAINTENANCE_DUE,
      type: covered
        ? PLAN_CHECK_TYPES.PROJECTED_COVERED_GOAL
        : PLAN_CHECK_TYPES.OPEN_GOAL,
      scope: "allergen_maintenance",
      refs: planCheckRefs({
        foodIds: core.targetFoodIds(target, state.foods),
        allergenTargets: [target],
        recipeNames: coveringMeals.map((meal) => meal.recipeName),
        meals: coveringMeals,
      }),
      solutionPaths: covered ? [] : [
        {
          code: "COVER_WITH_KNOWN_ELIGIBLE_FOOD",
          kind: "planning",
          allergenTargetKey: target.key,
        },
        {
          code: "COVER_WITH_ELIGIBLE_RECIPE",
          kind: "planning",
          allergenTargetKey: target.key,
        },
      ],
      details: {
        allergenTargetKey: target.key,
        lastEatenDate: target.lastEatenDate || "",
        projectedCovered: covered,
      },
    };
  });

  return {
    available: true,
    asOf,
    dueTargets: dueTargets.map((target) => ({
      key: target.key,
      kind: target.kind,
      value: target.value,
      allergenGroup: target.allergenGroup,
      representativeFoodId: target.representativeFoodId || "",
      lastEatenDate: target.lastEatenDate || "",
    })),
    projectedTargetKeys: [...projectedTargetKeys],
    openTargetKeys: items
      .filter((item) => item.type === PLAN_CHECK_TYPES.OPEN_GOAL)
      .map((item) => item.details.allergenTargetKey),
    coveredTargetKeys: items
      .filter((item) => item.type === PLAN_CHECK_TYPES.PROJECTED_COVERED_GOAL)
      .map((item) => item.details.allergenTargetKey),
    items,
  };
}

function structuredPlanCheckReport(days = [], options = {}) {
  const meals = visiblePlanCheckMeals(days);
  const items = [];
  const add = (item) => items.push({
    code: item.code,
    type: item.type,
    scope: item.scope || "plan",
    refs: item.refs || planCheckRefs(),
    solutionPaths: item.solutionPaths || [],
    details: item.details || {},
  });

  const counts = new Map();
  for (const meal of meals) counts.set(meal.focusId, (counts.get(meal.focusId) || 0) + 1);
  const trustedBases = (state?.foods || []).filter((foodRecord) =>
    typeof isTrustedBase === "function" && isTrustedBase(foodRecord)
  );
  const trustedBaseCount = trustedBases.length;
  const repeated = trustedBaseCount > 1
    ? [...counts.entries()].filter(([, count]) => count >= 4).sort((a, b) => b[1] - a[1])[0]
    : null;
  if (repeated) {
    const matchingMeals = meals.filter((meal) => meal.focusId === repeated[0]);
    add({
      code: PLAN_CHECK_CODES.FOCUS_ROTATION_LOW,
      type: PLAN_CHECK_TYPES.RECOMMENDATION,
      scope: "plan",
      refs: planCheckRefs({
        foodIds: [repeated[0]],
        recipeNames: matchingMeals.map((meal) => meal.recipeName),
        meals: matchingMeals,
      }),
      solutionPaths: [{ code: "ROTATE_TRUSTED_BASE", kind: "optimization" }],
      details: { occurrenceCount: repeated[1], trustedBaseCount },
    });
  }

  for (let index = 1; trustedBaseCount > 1 && index < meals.length; index++) {
    const previous = meals[index - 1];
    const current = meals[index];
    if (
      previous.focusId === current.focusId &&
      previous.date !== current.date &&
      !(typeof isPlannedIntroductionSequence === "function" && isPlannedIntroductionSequence(previous, current))
    ) {
      add({
        code: PLAN_CHECK_CODES.CONSECUTIVE_FOCUS_REPEAT,
        type: PLAN_CHECK_TYPES.RECOMMENDATION,
        scope: "plan",
        refs: planCheckRefs({ foodIds: [current.focusId], meals: [previous, current] }),
        solutionPaths: [{ code: "ROTATE_NEXT_FOCUS", kind: "optimization" }],
        details: {},
      });
      break;
    }
  }

  if (trustedBaseCount > 0) {
    const unsafeNew = meals.find((meal) =>
      ["neu", "manuell"].includes(meal.type) &&
      !(meal.foodIds || [])
        .filter((id) => id !== meal.focusId)
        .map(planCheckFood)
        .filter(Boolean)
        .some((foodRecord) => typeof isTrustedBase === "function" && isTrustedBase(foodRecord))
    );
    if (unsafeNew) {
      add({
        code: PLAN_CHECK_CODES.NEW_FOOD_WITHOUT_TRUSTED_BASE,
        type: PLAN_CHECK_TYPES.HARD_BLOCKER,
        scope: "meal",
        refs: planCheckRefs({
          foodIds: unsafeNew.foodIds || [unsafeNew.focusId],
          recipeNames: [unsafeNew.recipeName],
          meals: [unsafeNew],
        }),
        solutionPaths: [{ code: "ADD_TRUSTED_BASE", kind: "meal_adjustment" }],
        details: { focusId: unsafeNew.focusId },
      });
    }
  }

  const milkMeat = meals.find((meal) =>
    typeof mealContainsMilkProduct === "function" &&
    mealContainsMilkProduct(meal.foodIds) &&
    (meal.foodIds || [])
      .map(planCheckFood)
      .filter(Boolean)
      .some((foodRecord) => typeof isMeatOrFish === "function" && isMeatOrFish(foodRecord))
  );
  if (milkMeat) {
    add({
      code: PLAN_CHECK_CODES.MILK_WITH_MEAT_OR_FISH,
      type: PLAN_CHECK_TYPES.HARD_BLOCKER,
      scope: "meal",
      refs: planCheckRefs({
        foodIds: milkMeat.foodIds || [],
        recipeNames: [milkMeat.recipeName],
        meals: [milkMeat],
      }),
      solutionPaths: [{ code: "SEPARATE_MILK_AND_MEAT_FISH", kind: "meal_adjustment" }],
      details: {},
    });
  }

  const fullMilkByDate = new Map();
  for (const meal of meals) {
    if (typeof mealMilkLevel !== "function" || mealMilkLevel(meal) !== "full") continue;
    if (!fullMilkByDate.has(meal.date)) fullMilkByDate.set(meal.date, []);
    fullMilkByDate.get(meal.date).push(meal);
  }
  const duplicateMilkDate = [...fullMilkByDate.entries()].find(([, dateMeals]) => dateMeals.length > 1);
  if (duplicateMilkDate) {
    add({
      code: PLAN_CHECK_CODES.MULTIPLE_FULL_MILK_MEALS,
      type: PLAN_CHECK_TYPES.HARD_BLOCKER,
      scope: "day",
      refs: planCheckRefs({
        foodIds: duplicateMilkDate[1].flatMap((meal) => meal.foodIds || []),
        recipeNames: duplicateMilkDate[1].map((meal) => meal.recipeName),
        meals: duplicateMilkDate[1],
      }),
      solutionPaths: [{ code: "KEEP_SINGLE_FULL_MILK_MEAL", kind: "day_adjustment" }],
      details: { date: duplicateMilkDate[0], count: duplicateMilkDate[1].length },
    });
  }

  if (
    typeof AMOUNT_LEVELS !== "undefined" &&
    typeof currentAmountLevel === "function" &&
    AMOUNT_LEVELS[currentAmountLevel()]?.rank >= 1
  ) {
    const hasIron = meals.some((meal) =>
      (meal.foodIds || []).map(planCheckFood).filter(Boolean).some((foodRecord) => foodRecord.ironRich)
    );
    if (!hasIron) {
      add({
        code: PLAN_CHECK_CODES.IRON_RICH_MISSING,
        type: PLAN_CHECK_TYPES.RECOMMENDATION,
        scope: "plan",
        refs: planCheckRefs(),
        solutionPaths: [{ code: "INCLUDE_IRON_RICH_FOOD", kind: "optimization" }],
        details: {},
      });
    }
  }

  const inactivePlanned = meals.find((meal) =>
    (meal.foodIds || []).some((id) => planCheckFood(id) && !planCheckFood(id).active)
  );
  if (inactivePlanned) {
    const inactiveIds = (inactivePlanned.foodIds || []).filter((id) => {
      const foodRecord = planCheckFood(id);
      return foodRecord && !foodRecord.active;
    });
    add({
      code: PLAN_CHECK_CODES.INACTIVE_FOOD_PLANNED,
      type: PLAN_CHECK_TYPES.REQUIRED_ACTION,
      scope: "meal",
      refs: planCheckRefs({
        foodIds: inactiveIds,
        recipeNames: [inactivePlanned.recipeName],
        meals: [inactivePlanned],
      }),
      solutionPaths: [
        { code: "REACTIVATE_FOOD", kind: "state_change", foodIds: inactiveIds },
        {
          code: "EDIT_PLANNED_MEAL",
          kind: "meal_adjustment",
          meal: planCheckMealRef(inactivePlanned),
        },
      ],
      details: {},
    });
  }

  const maintenance = planCheckMaintenanceState(meals, days?.[0]?.date || (typeof today === "function" ? today() : ""));
  items.push(...maintenance.items);

  const phaseReadiness = typeof currentPhaseReadiness === "function"
    ? currentPhaseReadiness(options.phaseReadinessSignals || {})
    : null;

  return {
    schemaVersion: PLAN_CHECK_SCHEMA_VERSION,
    items,
    domainStates: {
      phaseReadiness,
      allergenMaintenance: {
        available: maintenance.available,
        asOf: maintenance.asOf,
        dueTargets: maintenance.dueTargets,
        projectedTargetKeys: maintenance.projectedTargetKeys,
        openTargetKeys: maintenance.openTargetKeys,
        coveredTargetKeys: maintenance.coveredTargetKeys,
      },
    },
  };
}

function planCheckMealForRef(days, ref) {
  for (const day of days || []) {
    if (day.date !== ref?.date) continue;
    const meal = (day.meals || []).find((item) => item.meal === ref.meal);
    if (meal) return { ...meal, date: day.date };
  }
  return ref || {};
}

function planCheckCompatibilityMessage(item, days = []) {
  const firstFoodId = item.refs?.foodIds?.[0] || item.details?.focusId || "";
  const firstFood = planCheckFood(firstFoodId);
  const firstMeal = item.refs?.meals?.[0];
  switch (item.code) {
    case PLAN_CHECK_CODES.FOCUS_ROTATION_LOW:
      return `${firstFood?.name || "Ein Lebensmittel"} konnte trotz mehrerer sicherer Basen nicht ausreichend rotiert werden.`;
    case PLAN_CHECK_CODES.CONSECUTIVE_FOCUS_REPEAT:
      return `${firstFood?.name || "Dasselbe Lebensmittel"} ist an aufeinanderfolgenden Tagen Schwerpunkt.`;
    case PLAN_CHECK_CODES.NEW_FOOD_WITHOUT_TRUSTED_BASE:
      return `${planCheckFood(item.details?.focusId)?.name || "Ein neues Lebensmittel"} hat keine verträgliche Basis.`;
    case PLAN_CHECK_CODES.MILK_WITH_MEAT_OR_FISH: {
      const meal = planCheckMealForRef(days, firstMeal);
      const title = typeof dishTitle === "function" ? dishTitle(meal) : meal.recipeName || "Diese Mahlzeit";
      return `${title} kombiniert Milchprodukt und Fleisch/Fisch; diese manuelle Planung bitte trennen.`;
    }
    case PLAN_CHECK_CODES.MULTIPLE_FULL_MILK_MEALS: {
      const date = item.details?.date || firstMeal?.date || "";
      const label = typeof shortDate === "function" ? shortDate(date) : date;
      return `Am ${label} sind mehrere volle Milchmahlzeiten fest eingeplant.`;
    }
    case PLAN_CHECK_CODES.IRON_RICH_MISSING:
      return "In den nächsten sieben Tagen ist noch kein eisenreiches Lebensmittel eingeplant.";
    case PLAN_CHECK_CODES.INACTIVE_FOOD_PLANNED: {
      const names = (item.refs?.foodIds || []).map((id) => planCheckFood(id)?.name || id).join(", ");
      return `${names || "Ein Lebensmittel"} ist deaktiviert, aber bewusst in einer bestehenden Planung erhalten.`;
    }
    case PLAN_CHECK_CODES.ALLERGEN_MAINTENANCE_DUE: {
      const target = item.refs?.allergenTargets?.[0];
      const representative = planCheckFood(target?.representativeFoodId);
      return `${representative?.name || target?.value || "Ein Allergen"} ist als Allergen fällig, aber noch nicht eingeplant.`;
    }
    default:
      return "";
  }
}

function planCheckCompatibilityMessages(report, days = []) {
  const messages = [];
  let maintenanceMessageAdded = false;
  for (const item of report?.items || []) {
    if (item.type === PLAN_CHECK_TYPES.PROJECTED_COVERED_GOAL) continue;
    if (item.code === PLAN_CHECK_CODES.ALLERGEN_MAINTENANCE_DUE) {
      if (maintenanceMessageAdded) continue;
      maintenanceMessageAdded = true;
    }
    const message = planCheckCompatibilityMessage(item, days);
    if (message && !messages.includes(message)) messages.push(message);
    if (messages.length >= 2) break;
  }
  return messages;
}

function installStructuredPlanCheckAdapter() {
  if (typeof globalThis === "undefined" || typeof globalThis.planQualityIssues !== "function") return false;
  if (globalThis.planQualityIssues.__structuredPlanCheckAdapter === true) return true;

  const adapter = function structuredPlanQualityCompatibility(days = []) {
    const report = structuredPlanCheckReport(days);
    return planCheckCompatibilityMessages(report, days);
  };
  adapter.__structuredPlanCheckAdapter = true;
  globalThis.planCheckResults = structuredPlanCheckReport;
  globalThis.planQualityIssues = adapter;
  return true;
}

if (typeof globalThis !== "undefined") {
  globalThis.PlannerPlanChecks = Object.freeze({
    schemaVersion: PLAN_CHECK_SCHEMA_VERSION,
    types: PLAN_CHECK_TYPES,
    codes: PLAN_CHECK_CODES,
    report: structuredPlanCheckReport,
    compatibilityMessages: planCheckCompatibilityMessages,
    installCompatibilityAdapter: installStructuredPlanCheckAdapter,
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const installPlanChecks = () => installStructuredPlanCheckAdapter();
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", installPlanChecks, { once: true });
  } else {
    installPlanChecks();
  }
}
