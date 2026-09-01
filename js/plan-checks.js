"use strict";

// Strukturierter Planner-Check-Core. Fachliche Ergebnisse sind primär strukturiert;
// sichtbare Texte entstehen ausschließlich im dünnen Kompatibilitätsadapter.
(function structuredPlanChecksModule(globalScope) {
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

  function unique(values = []) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function foodRecord(foodId) {
    return typeof food === "function" ? food(foodId) : null;
  }

  function mealRef(meal = {}) {
    return {
      planId: meal.planId || "",
      date: meal.date || "",
      meal: meal.meal || "",
      focusId: meal.focusId || "",
      foodIds: unique(meal.foodIds || []),
      baseFoodIds: unique(meal.baseFoodIds || []),
      sampleFoodIds: unique(meal.sampleFoodIds || []),
      recipeName: meal.recipeName || "",
      source: meal.source || "",
    };
  }

  function refs({ foodIds = [], allergenTargets = [], recipeNames = [], meals = [] } = {}) {
    return {
      foodIds: unique(foodIds),
      allergenTargets: (allergenTargets || []).map((target) => ({
        key: target.key || "",
        kind: target.kind || "",
        value: target.value || "",
        allergenGroup: target.allergenGroup || "",
        representativeFoodId: target.representativeFoodId || "",
        lastEatenDate: target.lastEatenDate || "",
      })),
      recipeNames: unique(recipeNames),
      meals: (meals || []).map(mealRef),
    };
  }

  function exactPlanCompletion(meal, date) {
    const core = globalScope?.__plannerLogRolloverCore;
    if (
      meal?.planId &&
      core &&
      typeof core.linkedCompletionLog === "function" &&
      typeof state !== "undefined"
    ) {
      return core.linkedCompletionLog(state, meal.planId, date, meal.meal) || null;
    }
    return null;
  }

  function mealCompleted(meal, date) {
    if (meal?.planId && globalScope?.__plannerLogRolloverCore?.linkedCompletionLog) {
      return !!exactPlanCompletion(meal, date);
    }
    return typeof mealIsCompleted === "function" && mealIsCompleted(date, meal?.meal);
  }

  function visibleMeals(days = []) {
    return (days || []).flatMap((day) =>
      (day.meals || [])
        .filter((meal) =>
          meal?.active &&
          !meal.empty &&
          meal.focusId &&
          !mealCompleted(meal, day.date)
        )
        .map((meal) => ({ ...meal, date: day.date })),
    );
  }

  function recipeHelpers() {
    return {
      recipeByNameFn: (name) => typeof recipeByName === "function" ? recipeByName(name) : null,
      recipeFoodIdsFn: (recipe) => typeof recipeFoodIds === "function" ? recipeFoodIds(recipe) : [],
    };
  }

  function maintenanceState(meals, asOf) {
    const core = globalScope?.PlannerAllergenMaintenance;
    if (
      !core ||
      typeof state === "undefined" ||
      !Array.isArray(state.foods) ||
      !Array.isArray(state.logs) ||
      !asOf
    ) {
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

    const helpers = recipeHelpers();
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
      rankFn: (record) => typeof rank === "function" ? rank(record) : 0,
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
        refs: refs({
          foodIds: core.targetFoodIds(target, state.foods),
          allergenTargets: [target],
          recipeNames: coveringMeals.map((meal) => meal.recipeName),
          meals: coveringMeals,
        }),
        solutionPaths: covered ? [] : [
          { code: "COVER_WITH_KNOWN_ELIGIBLE_FOOD", kind: "planning", allergenTargetKey: target.key },
          { code: "COVER_WITH_ELIGIBLE_RECIPE", kind: "planning", allergenTargetKey: target.key },
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

  function structuredReport(days = [], options = {}) {
    const meals = visibleMeals(days);
    const items = [];
    const add = (item) => items.push({
      code: item.code,
      type: item.type,
      scope: item.scope || "plan",
      refs: item.refs || refs(),
      solutionPaths: item.solutionPaths || [],
      details: item.details || {},
    });

    const counts = new Map();
    for (const meal of meals) counts.set(meal.focusId, (counts.get(meal.focusId) || 0) + 1);
    const trustedBases = typeof state !== "undefined" && Array.isArray(state.foods)
      ? state.foods.filter((record) => typeof isTrustedBase === "function" && isTrustedBase(record))
      : [];
    const trustedBaseCount = trustedBases.length;

    if (trustedBaseCount > 1) {
      for (const [focusId, occurrenceCount] of [...counts.entries()]
        .filter(([, count]) => count >= 4)
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))) {
        const matchingMeals = meals.filter((meal) => meal.focusId === focusId);
        add({
          code: PLAN_CHECK_CODES.FOCUS_ROTATION_LOW,
          type: PLAN_CHECK_TYPES.RECOMMENDATION,
          scope: "plan",
          refs: refs({
            foodIds: [focusId],
            recipeNames: matchingMeals.map((meal) => meal.recipeName),
            meals: matchingMeals,
          }),
          solutionPaths: [{ code: "ROTATE_TRUSTED_BASE", kind: "optimization" }],
          details: { occurrenceCount, trustedBaseCount },
        });
      }

      for (let index = 1; index < meals.length; index++) {
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
            refs: refs({ foodIds: [current.focusId], meals: [previous, current] }),
            solutionPaths: [{ code: "ROTATE_NEXT_FOCUS", kind: "optimization" }],
            details: {},
          });
        }
      }
    }

    if (trustedBaseCount > 0) {
      for (const unsafeMeal of meals.filter((meal) =>
        ["neu", "manuell"].includes(meal.type) &&
        !(meal.foodIds || [])
          .filter((id) => id !== meal.focusId)
          .map(foodRecord)
          .filter(Boolean)
          .some((record) => typeof isTrustedBase === "function" && isTrustedBase(record))
      )) {
        add({
          code: PLAN_CHECK_CODES.NEW_FOOD_WITHOUT_TRUSTED_BASE,
          type: PLAN_CHECK_TYPES.HARD_BLOCKER,
          scope: "meal",
          refs: refs({
            foodIds: unsafeMeal.foodIds || [unsafeMeal.focusId],
            recipeNames: [unsafeMeal.recipeName],
            meals: [unsafeMeal],
          }),
          solutionPaths: [{ code: "ADD_TRUSTED_BASE", kind: "meal_adjustment" }],
          details: { focusId: unsafeMeal.focusId },
        });
      }
    }

    for (const milkMeatMeal of meals.filter((meal) =>
      typeof mealContainsMilkProduct === "function" &&
      mealContainsMilkProduct(meal.foodIds) &&
      (meal.foodIds || [])
        .map(foodRecord)
        .filter(Boolean)
        .some((record) => typeof isMeatOrFish === "function" && isMeatOrFish(record))
    )) {
      add({
        code: PLAN_CHECK_CODES.MILK_WITH_MEAT_OR_FISH,
        type: PLAN_CHECK_TYPES.HARD_BLOCKER,
        scope: "meal",
        refs: refs({
          foodIds: milkMeatMeal.foodIds || [],
          recipeNames: [milkMeatMeal.recipeName],
          meals: [milkMeatMeal],
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
    for (const [date, dateMeals] of fullMilkByDate.entries()) {
      if (dateMeals.length <= 1) continue;
      add({
        code: PLAN_CHECK_CODES.MULTIPLE_FULL_MILK_MEALS,
        type: PLAN_CHECK_TYPES.HARD_BLOCKER,
        scope: "day",
        refs: refs({
          foodIds: dateMeals.flatMap((meal) => meal.foodIds || []),
          recipeNames: dateMeals.map((meal) => meal.recipeName),
          meals: dateMeals,
        }),
        solutionPaths: [{ code: "KEEP_SINGLE_FULL_MILK_MEAL", kind: "day_adjustment" }],
        details: { date, count: dateMeals.length },
      });
    }

    if (
      typeof AMOUNT_LEVELS !== "undefined" &&
      typeof currentAmountLevel === "function" &&
      AMOUNT_LEVELS[currentAmountLevel()]?.rank >= 1
    ) {
      const hasIron = meals.some((meal) =>
        (meal.foodIds || []).map(foodRecord).filter(Boolean).some((record) => record.ironRich)
      );
      if (!hasIron) {
        add({
          code: PLAN_CHECK_CODES.IRON_RICH_MISSING,
          type: PLAN_CHECK_TYPES.RECOMMENDATION,
          scope: "plan",
          refs: refs(),
          solutionPaths: [{ code: "INCLUDE_IRON_RICH_FOOD", kind: "optimization" }],
          details: {},
        });
      }
    }

    for (const inactiveMeal of meals.filter((meal) =>
      (meal.foodIds || []).some((id) => {
        const record = foodRecord(id);
        return record && !record.active;
      })
    )) {
      const inactiveIds = (inactiveMeal.foodIds || []).filter((id) => {
        const record = foodRecord(id);
        return record && !record.active;
      });
      add({
        code: PLAN_CHECK_CODES.INACTIVE_FOOD_PLANNED,
        type: PLAN_CHECK_TYPES.REQUIRED_ACTION,
        scope: "meal",
        refs: refs({
          foodIds: inactiveIds,
          recipeNames: [inactiveMeal.recipeName],
          meals: [inactiveMeal],
        }),
        solutionPaths: [
          { code: "REACTIVATE_FOOD", kind: "state_change", foodIds: inactiveIds },
          { code: "EDIT_PLANNED_MEAL", kind: "meal_adjustment", meal: mealRef(inactiveMeal) },
        ],
        details: {},
      });
    }

    const maintenance = maintenanceState(
      meals,
      days?.[0]?.date || (typeof today === "function" ? today() : ""),
    );
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

  function mealForRef(days, ref) {
    if (!ref) return {};
    for (const day of days || []) {
      if (day.date !== ref.date) continue;
      const exact = ref.planId
        ? (day.meals || []).find((item) => item.planId === ref.planId)
        : null;
      if (exact) return { ...exact, date: day.date };
      const fallback = (day.meals || []).find((item) => item.meal === ref.meal);
      if (fallback) return { ...fallback, date: day.date };
    }
    return ref;
  }

  function compatibilityMessage(item, days = []) {
    const firstFoodId = item.refs?.foodIds?.[0] || item.details?.focusId || "";
    const firstFood = foodRecord(firstFoodId);
    const firstMeal = item.refs?.meals?.[0];
    switch (item.code) {
      case PLAN_CHECK_CODES.FOCUS_ROTATION_LOW:
        return `${firstFood?.name || "Ein Lebensmittel"} konnte trotz mehrerer sicherer Basen nicht ausreichend rotiert werden.`;
      case PLAN_CHECK_CODES.CONSECUTIVE_FOCUS_REPEAT:
        return `${firstFood?.name || "Dasselbe Lebensmittel"} ist an aufeinanderfolgenden Tagen Schwerpunkt.`;
      case PLAN_CHECK_CODES.NEW_FOOD_WITHOUT_TRUSTED_BASE:
        return `${foodRecord(item.details?.focusId)?.name || "Ein neues Lebensmittel"} hat keine verträgliche Basis.`;
      case PLAN_CHECK_CODES.MILK_WITH_MEAT_OR_FISH: {
        const meal = mealForRef(days, firstMeal);
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
        const names = (item.refs?.foodIds || []).map((id) => foodRecord(id)?.name || id).join(", ");
        return `${names || "Ein Lebensmittel"} ist deaktiviert, aber bewusst in einer bestehenden Planung erhalten.`;
      }
      case PLAN_CHECK_CODES.ALLERGEN_MAINTENANCE_DUE: {
        const target = item.refs?.allergenTargets?.[0];
        const representative = foodRecord(target?.representativeFoodId);
        return `${representative?.name || target?.value || "Ein Allergen"} ist als Allergen fällig, aber noch nicht eingeplant.`;
      }
      default:
        return "";
    }
  }

  function compatibilityMessages(report, days = []) {
    const messages = [];
    let maintenanceMessageAdded = false;
    for (const item of report?.items || []) {
      if (item.type === PLAN_CHECK_TYPES.PROJECTED_COVERED_GOAL) continue;
      if (item.code === PLAN_CHECK_CODES.ALLERGEN_MAINTENANCE_DUE) {
        if (maintenanceMessageAdded) continue;
        maintenanceMessageAdded = true;
      }
      const message = compatibilityMessage(item, days);
      if (message && !messages.includes(message)) messages.push(message);
      if (messages.length >= 2) break;
    }
    return messages;
  }

  function installCompatibilityAdapter() {
    if (!globalScope) return false;
    const adapter = function structuredPlanQualityCompatibility(days = []) {
      const report = structuredReport(days);
      return compatibilityMessages(report, days);
    };
    adapter.__structuredPlanCheckAdapter = true;
    globalScope.planCheckResults = structuredReport;
    globalScope.planQualityIssues = adapter;
    return true;
  }

  globalScope.PlannerPlanChecks = Object.freeze({
    schemaVersion: PLAN_CHECK_SCHEMA_VERSION,
    types: PLAN_CHECK_TYPES,
    codes: PLAN_CHECK_CODES,
    report: structuredReport,
    compatibilityMessages,
    installCompatibilityAdapter,
  });

  // index.html loads this module after ui.js and before app.js. Therefore the
  // compatibility adapter is active before the first visible render, without a
  // DOMContentLoaded race and without mixing this contract into Phase Readiness.
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    installCompatibilityAdapter();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
