"use strict";

// PHASE-TRANSITION core: recommendation only. This module never mutates phaseSelected
// and deliberately does not inspect grams, log counts, texture, inventory or planner locks.
const PHASE_READINESS_RULES = Object.freeze({
  kennenlernen: Object.freeze({
    nextPhase: "aufbau",
    nextMeal: "breakfast",
    ageWindowStartMonths: 6,
    ageTargetMonths: 9,
    targetMeals: 2,
  }),
  aufbau: Object.freeze({
    nextPhase: "drei",
    nextMeal: "dinner",
    ageWindowStartMonths: 7,
    ageTargetMonths: 9,
    targetMeals: 3,
  }),
  drei: Object.freeze({
    nextPhase: "familie",
    nextMeal: "snack",
    ageWindowStartMonths: null,
    ageTargetMonths: null,
    targetMeals: 4,
  }),
  familie: Object.freeze({
    nextPhase: null,
    nextMeal: null,
    ageWindowStartMonths: null,
    ageTargetMonths: null,
    targetMeals: null,
  }),
});

const PHASE_READINESS_PATTERN_VALUES = new Set(["unknown", "established", "notEstablished"]);
const PHASE_READINESS_SNACK_VALUES = new Set(["unknown", "yes", "no"]);

function normalizePhaseReadinessValue(value, allowed, fallback = "unknown") {
  return allowed.has(value) ? value : fallback;
}

function phaseReadinessAgeGuidance(phase, ageMonths) {
  const rule = PHASE_READINESS_RULES[phase] || PHASE_READINESS_RULES.kennenlernen;
  const normalizedAge = Number.isFinite(Number(ageMonths)) && Number(ageMonths) >= 0
    ? Math.floor(Number(ageMonths))
    : null;

  if (phase === "drei" || phase === "familie") {
    return { status: "none", ageMonths: normalizedAge, targetMeals: rule.targetMeals };
  }
  if (normalizedAge === null) {
    return { status: "unknown", ageMonths: null, targetMeals: rule.targetMeals };
  }
  if (normalizedAge < rule.ageWindowStartMonths) {
    return { status: "early", ageMonths: normalizedAge, targetMeals: rule.targetMeals };
  }
  if (normalizedAge < rule.ageTargetMonths) {
    return { status: "inWindow", ageMonths: normalizedAge, targetMeals: rule.targetMeals };
  }
  return { status: "targetPassed", ageMonths: normalizedAge, targetMeals: rule.targetMeals };
}

function phaseReadinessRecommendation(input = {}) {
  const phase = PHASE_READINESS_RULES[input.phase] ? input.phase : "kennenlernen";
  const rule = PHASE_READINESS_RULES[phase];
  const currentPattern = normalizePhaseReadinessValue(
    input.currentPattern,
    PHASE_READINESS_PATTERN_VALUES,
  );
  const snackNeed = normalizePhaseReadinessValue(
    input.snackNeed,
    PHASE_READINESS_SNACK_VALUES,
  );
  const ageGuidance = phaseReadinessAgeGuidance(phase, input.ageMonths);
  const reasons = [];
  const missingPrerequisites = [];

  if (!rule.nextPhase) {
    return {
      currentPhase: phase,
      nextPhase: null,
      nextMeal: null,
      recommendation: "notYet",
      recommendable: false,
      development: { currentPattern },
      ageGuidance,
      reasons: ["finalPhaseReached"],
      missingPrerequisites: [],
    };
  }

  if (currentPattern === "unknown") {
    reasons.push("currentPatternUnknown");
    missingPrerequisites.push("currentPattern");
  } else if (currentPattern === "notEstablished") {
    reasons.push("currentPatternNotEstablished");
  } else {
    reasons.push("currentPatternEstablished");
  }

  if (phase === "drei") {
    let recommendation = "notYet";
    if (currentPattern === "established") {
      if (snackNeed === "unknown") {
        reasons.push("snackNeedUnknown");
        missingPrerequisites.push("snackNeed");
        recommendation = "consider";
      } else if (snackNeed === "yes") {
        reasons.push("snackNeedObserved");
        recommendation = "recommended";
      } else {
        reasons.push("snackNeedNotObserved");
      }
    }

    return {
      currentPhase: phase,
      nextPhase: rule.nextPhase,
      nextMeal: rule.nextMeal,
      recommendation,
      recommendable: recommendation === "recommended",
      development: { currentPattern, snackNeed },
      ageGuidance,
      reasons,
      missingPrerequisites,
    };
  }

  if (ageGuidance.status === "unknown") reasons.push("ageGuidanceUnknown");
  else if (ageGuidance.status === "early") reasons.push("ageBeforeGuidanceWindow");
  else if (ageGuidance.status === "inWindow") reasons.push("ageGuidanceWindowReached");
  else if (ageGuidance.status === "targetPassed") reasons.push("mealFrequencyBelowAgeGuidance");

  let recommendation = "notYet";
  if (currentPattern === "established") {
    recommendation = ageGuidance.status === "inWindow" || ageGuidance.status === "targetPassed"
      ? "recommended"
      : "consider";
  } else if (
    currentPattern === "unknown" &&
    (ageGuidance.status === "inWindow" || ageGuidance.status === "targetPassed")
  ) {
    recommendation = "consider";
  }

  return {
    currentPhase: phase,
    nextPhase: rule.nextPhase,
    nextMeal: rule.nextMeal,
    recommendation,
    recommendable: recommendation === "recommended",
    development: { currentPattern },
    ageGuidance,
    reasons,
    missingPrerequisites,
  };
}

function currentPhaseReadiness(signals = {}, onDate) {
  const phase = typeof currentPhase === "function" ? currentPhase() : "kennenlernen";
  const effectiveDate = onDate || (typeof today === "function" ? today() : null);
  const ageMonths = typeof monthsOld === "function" && effectiveDate
    ? monthsOld(effectiveDate)
    : signals.ageMonths;
  return phaseReadinessRecommendation({
    phase,
    ageMonths,
    currentPattern: signals.currentPattern,
    snackNeed: signals.snackNeed,
  });
}
