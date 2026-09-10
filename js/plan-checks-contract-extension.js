"use strict";

/*
 * Minimale AP3-Vertragserweiterung für zwei bereits fachlich definierte Zustände:
 * - laufende Allergen-Einführung (priorisiert vor Maintenance),
 * - zentrale Ausführung des vorhandenen INACTIVE_FOOD_PLANNED-required_action.
 *
 * Keine sichtbare Copy und keine Planner-Sonderlogik. Die UI konsumiert weiterhin
 * ausschließlich strukturierte Ergebnisse und delegiert Mutationen an diese Schicht.
 */
(function extendPlanChecksContract(globalScope) {
  const baseChecks = globalScope.PlannerPlanChecks;
  const baseSolutions = globalScope.PlannerPlanCheckSolutions;
  if (!baseChecks || !baseSolutions || globalScope.__planChecksContractExtensionInstalled) return;
  globalScope.__planChecksContractExtensionInstalled = true;

  const INTRO_OPEN_CODE = baseSolutions.INTRO_OPEN_CODE;
  const INTRO_PROJECTED_CODE = baseSolutions.INTRO_PROJECTED_CODE;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function unique(values = []) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function familyKey(record) {
    if (!record) return "";
    if (text(record.allergenFamily)) return `family:${text(record.allergenFamily)}`;
    return `food:${text(record.id)}`;
  }

  function familyFoodIds(record) {
    const key = familyKey(record);
    if (!key) return [];
    return (state?.foods || [])
      .filter((candidate) => candidate?.allergenGroup && familyKey(candidate) === key)
      .map((candidate) => candidate.id);
  }

  function exposureKey(log) {
    if (typeof plannerLogExposureKey === "function") return plannerLogExposureKey(log);
    return `${log?.date || ""}|${log?.meal || log?.id || log?.createdAt || "entry"}`;
  }

  function successfulFamilyExposureCount(record) {
    if (!record) return 0;
    if (typeof familySuccessfulExposureCount === "function") {
      return Number(familySuccessfulExposureCount(record, state.foods, state.logs, outcomeForFood)) || 0;
    }
    const ids = new Set(familyFoodIds(record));
    const exposures = new Set();
    for (const log of state?.logs || []) {
      for (const id of log?.foodIds || []) {
        if (!ids.has(id) || outcomeForFood(log, id) !== "eaten") continue;
        exposures.add(exposureKey(log));
      }
    }
    return exposures.size;
  }

  function latestFamilyExposure(record) {
    const ids = new Set(familyFoodIds(record));
    let latest = "";
    for (const log of state?.logs || []) {
      if (!log?.date) continue;
      if (!(log.foodIds || []).some((id) => ids.has(id) && outcomeForFood(log, id) === "eaten")) continue;
      if (!latest || log.date > latest) latest = log.date;
    }
    return latest;
  }

  function visibleOpenMeals(days = []) {
    return (days || []).flatMap((day) => (day.meals || [])
      .filter((meal) =>
        meal?.active &&
        !meal.empty &&
        meal.focusId &&
        !(typeof mealIsCompleted === "function" && mealIsCompleted(day.date, meal.meal))
      )
      .map((meal) => ({ ...meal, date: day.date })));
  }

  function introductionItems(days = []) {
    if (!state?.foods || !state?.logs) return [];
    const meals = visibleOpenMeals(days);
    const groups = new Map();

    for (const record of state.foods) {
      if (!record?.active || !record.allergenGroup) continue;
      if (typeof status === "function" && status(record) === "Pausiert") continue;
      if (successfulFamilyExposureCount(record) !== 1) continue;

      const key = familyKey(record);
      if (!key || groups.has(key)) continue;
      const ids = familyFoodIds(record);
      const coveringMeals = meals.filter((meal) => (meal.foodIds || []).some((id) => ids.includes(id)));
      const projected = coveringMeals.length > 0;
      const lastExposureDate = latestFamilyExposure(record);

      groups.set(key, {
        code: projected ? INTRO_PROJECTED_CODE : INTRO_OPEN_CODE,
        type: projected ? "projected_covered_goal" : "open_goal",
        scope: "allergen_introduction",
        refs: {
          foodIds: ids,
          allergenTargets: [{
            key,
            kind: text(record.allergenFamily) ? "family" : "food",
            value: record.name || record.allergenGroup || record.id,
            allergenGroup: record.allergenGroup || "",
            representativeFoodId: record.id,
            lastEatenDate: lastExposureDate,
          }],
          recipeNames: unique(coveringMeals.map((meal) => meal.recipeName)),
          meals: coveringMeals.map((meal) => ({
            planId: meal.planId || "",
            date: meal.date || "",
            meal: meal.meal || "",
            focusId: meal.focusId || "",
            foodIds: unique(meal.foodIds || []),
            baseFoodIds: unique(meal.baseFoodIds || []),
            sampleFoodIds: unique(meal.sampleFoodIds || []),
            recipeName: meal.recipeName || "",
            source: meal.source || "",
          })),
        },
        solutionPaths: projected ? [] : [{
          code: "CONTINUE_ALLERGEN_INTRODUCTION",
          kind: "planning",
          allergenIntroductionKey: key,
        }],
        details: {
          allergenIntroductionKey: key,
          representativeFoodId: record.id,
          lastExposureDate,
          successfulExposureCount: 1,
          projectedCovered: projected,
        },
      });
    }

    return [...groups.values()];
  }

  function extendedReport(days = [], options = {}) {
    const report = baseChecks.report(days, options);
    const introductions = introductionItems(days);
    return {
      ...report,
      items: [...(report.items || []), ...introductions],
      domainStates: {
        ...(report.domainStates || {}),
        allergenIntroduction: {
          items: introductions,
          openKeys: introductions.filter((item) => item.type === "open_goal").map((item) => item.details.allergenIntroductionKey),
          projectedKeys: introductions.filter((item) => item.type === "projected_covered_goal").map((item) => item.details.allergenIntroductionKey),
        },
      },
    };
  }

  function installCompatibilityAdapter() {
    const adapter = function structuredPlanQualityCompatibility(days = []) {
      const report = extendedReport(days);
      return baseChecks.compatibilityMessages(report, days);
    };
    adapter.__structuredPlanCheckAdapter = true;
    globalScope.planCheckResults = extendedReport;
    globalScope.planQualityIssues = adapter;
    return true;
  }

  globalScope.PlannerPlanChecks = Object.freeze({
    ...baseChecks,
    report: extendedReport,
    installCompatibilityAdapter,
  });
  installCompatibilityAdapter();

  const originalSolutionReport = baseSolutions.report;
  function dedupedSolutionReport(days = [], options = {}) {
    const report = originalSolutionReport(days, options);
    const seen = new Set();
    const items = (report.items || []).filter((item) => {
      const targetKey = text(item.details?.allergenIntroductionKey) || text(item.details?.allergenTargetKey) || baseSolutions.goalKey(item);
      const mealKey = (item.refs?.meals || []).map((meal) => `${meal.date}|${meal.meal}|${meal.planId || ""}`).sort().join(",");
      const key = `${item.code}|${targetKey}|${mealKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const introductions = items.filter((item) => [INTRO_OPEN_CODE, INTRO_PROJECTED_CODE].includes(item.code));
    return {
      ...report,
      items,
      domainStates: {
        ...(report.domainStates || {}),
        allergenIntroduction: {
          items: introductions,
          openKeys: introductions.filter((item) => item.type === "open_goal").map(baseSolutions.goalKey),
          projectedKeys: introductions.filter((item) => item.type === "projected_covered_goal").map(baseSolutions.goalKey),
        },
      },
    };
  }

  function applyRequiredAction(item, actionCode) {
    if (!item || item.type !== "required_action") return { ok: false, reason: "not_required_action" };
    const path = (item.solutionPaths || []).find((candidate) => candidate.code === actionCode);
    if (!path) return { ok: false, reason: "unsupported_action" };

    if (item.code === "INACTIVE_FOOD_PLANNED" && actionCode === "REACTIVATE_FOOD") {
      const ids = unique(path.foodIds || item.refs?.foodIds || []);
      let changed = false;
      for (const id of ids) {
        const record = typeof food === "function" ? food(id) : state.foods?.find((candidate) => candidate.id === id);
        if (!record) continue;
        if (!record.active) {
          record.active = true;
          changed = true;
        }
        if (state.inactivePlanKept?.[id]) {
          delete state.inactivePlanKept[id];
          changed = true;
        }
      }
      if (changed) baseSolutions.bumpEvaluationRevision();
      return { ok: true, changed, foodIds: ids };
    }

    if (item.code === "INACTIVE_FOOD_PLANNED" && actionCode === "EDIT_PLANNED_MEAL") {
      const meal = path.meal || item.refs?.meals?.[0] || null;
      return { ok: !!meal, navigation: meal ? { kind: "edit_meal", meal } : null };
    }

    return { ok: false, reason: "unsupported_action" };
  }

  globalScope.PlannerPlanCheckSolutions = Object.freeze({
    ...baseSolutions,
    report: dedupedSolutionReport,
    applyRequiredAction,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
