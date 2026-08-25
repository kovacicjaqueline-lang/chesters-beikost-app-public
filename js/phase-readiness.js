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
