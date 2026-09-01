"use strict";

/* Allgemeine Hilfsfunktionen
 * Klonen, Escaping, Datumsrechnungen und Lebensmittelzugriff.
 * Technische Basis: V9.2R; fachliches Verhalten unverändert zu V9.2.
 */

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}
function esc(x) {
  return String(x ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
}
function today() {
  let d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}
function dateObj(s) {
  let [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function iso(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}
function addDays(s, n) {
  let d = dateObj(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
function diffDays(a, b) {
  return Math.floor((dateObj(a) - dateObj(b)) / 86400000);
}
function monthsOld(on) {
  let a = dateObj(state.settings.birthDate),
    b = dateObj(on);
  let m =
    (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  if (b.getDate() < a.getDate()) m--;
  return Math.max(0, m);
}
function nice(s, year = false) {
  return new Intl.DateTimeFormat("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: year ? "numeric" : undefined,
  }).format(dateObj(s));
}
function shortDate(s) {
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(dateObj(s));
}
function foodAliasTerms(f) {
  return String(f?.alias || "").split(/[,;/|]+/).map((term) => term.trim()).filter(Boolean);
}
function foodNameMatches(f, query) {
  let q = normalizeName(query);
  if (!q || !f) return false;
  return normalizeName(f.name) === q || foodAliasTerms(f).some((alias) => normalizeName(alias) === q);
}
function foodByName(name, foods = state.foods) {
  let pool = foods || [];
  let direct = pool.find((f) => foodNameMatches(f, name));
  if (direct) return direct;

  // Historische zusammengesetzte Labels wie „Nudeln/Pasta“ sind nur dann ein
  // Alias-Fallback, wenn jeder Teil auf dasselbe kanonische FOOD zeigt. Dadurch
  // bleiben echte Alternativen wie „Banane/Apfel“ ausdrücklich unaufgelöst.
  let terms = String(name || "")
    .split("/")
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length < 2) return null;
  let matches = terms.map((term) => pool.find((f) => foodNameMatches(f, term)) || null);
  if (matches.some((item) => !item)) return null;
  return new Set(matches.map((item) => item.id)).size === 1 ? matches[0] : null;
}
function foodSearchScore(f, query) {
  let q = normalizeName(query);
  if (!q || !f) return q ? Number.POSITIVE_INFINITY : 0;
  let name = normalizeName(f.name || "");
  let aliases = foodAliasTerms(f).map((alias) => normalizeName(alias));
  let nameWords = name.split(" ").filter(Boolean);
  let aliasWords = aliases.flatMap((alias) => alias.split(" ").filter(Boolean));
  if (name === q) return 0;
  if (aliases.some((alias) => alias === q)) return 1;
  if (name.startsWith(q)) return 2;
  if (aliases.some((alias) => alias.startsWith(q))) return 3;
  if (nameWords.some((word) => word === q)) return 4;
  if (aliasWords.some((word) => word === q)) return 5;
  if (nameWords.some((word) => word.startsWith(q))) return 6;
  if (aliasWords.some((word) => word.startsWith(q))) return 7;
  if (q.length < 3) return Number.POSITIVE_INFINITY;
  if (name.includes(q)) return 8;
  if (aliases.some((alias) => alias.includes(q))) return 9;
  let metadata = normalizeName(`${f.category || ""} ${f.allergenGroup || ""} ${f.ph ? "philippinen" : ""}`);
  if (metadata.split(" ").some((word) => word === q)) return 20;
  if (metadata.split(" ").some((word) => word.startsWith(q))) return 21;
  if (metadata.includes(q)) return 22;
  return Number.POSITIVE_INFINITY;
}
function foodSearchMatches(f, query) {
  return Number.isFinite(foodSearchScore(f, query));
}
function food(id) {
  return state.foods.find((f) => f.id === id);
}

// Planner-Mahlzeiteneignung wird als eigene Policy-Schicht nach app.js geladen.
// Der erste ungeschützte renderAll()-Aufruf aus app.js bleibt währenddessen unsichtbar;
// sichtbar wird die App erst nach Installation der vollständigen Policy-Kette und
// einem erneuten Render mit den aktiven Planner-Regeln.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  let plannerPolicyBody = document.body;
  if (plannerPolicyBody) plannerPolicyBody.style.visibility = "hidden";
  window.__plannerPoliciesReady = false;
  window.__handlingReadinessReady = false;
  let plannerPoliciesFinished = false;
  let handlingReadinessLoading = false;

  let completePlannerPolicies = () => {
    if (plannerPoliciesFinished) return;
    plannerPoliciesFinished = true;
    window.__plannerPoliciesReady = true;
    if (typeof renderCurrentView === "function") renderCurrentView();
    if (plannerPolicyBody) plannerPolicyBody.style.visibility = "";
  };

  let finishPlannerPolicies = () => {
    if (plannerPoliciesFinished) return;
    if (window.__handlingReadinessReady) {
      completePlannerPolicies();
      return;
    }

    let installHandlingAndFinish = () => {
      if (typeof installHandlingReadinessRuntime !== "function") {
        failPlannerPolicies(new Error("Handling-Readiness-Policy fehlt."));
        return;
      }
      installHandlingReadinessRuntime();
      window.__handlingReadinessReady = true;
      handlingReadinessLoading = false;
      completePlannerPolicies();
    };

    let loadHandlingPolicy = () => {
      if (typeof installHandlingReadinessRuntime === "function") {
        installHandlingAndFinish();
        return;
      }
      let existingPolicy = document.querySelector('script[data-handling-readiness="wave-1"]');
      if (existingPolicy) {
        existingPolicy.addEventListener("load", installHandlingAndFinish, { once: true });
        attachPlannerLoadError(existingPolicy);
        return;
      }
      let policyScript = document.createElement("script");
      policyScript.src = "js/handling-readiness.js?v=10.1.26";
      policyScript.dataset.handlingReadiness = "wave-1";
      policyScript.addEventListener("load", installHandlingAndFinish, { once: true });
      attachPlannerLoadError(policyScript);
      document.head.appendChild(policyScript);
    };

    if (handlingReadinessLoading) return;
    handlingReadinessLoading = true;
    if (typeof FOOD_HANDLING_CONTRACT !== "undefined" && typeof RECIPE_HANDLING_CONTRACT !== "undefined") {
      loadHandlingPolicy();
      return;
    }

    let existingContract = document.querySelector('script[data-food-handling-contract="wave-1"]');
    if (existingContract) {
      existingContract.addEventListener("load", loadHandlingPolicy, { once: true });
      attachPlannerLoadError(existingContract);
      return;
    }
    let handlingContractScript = document.createElement("script");
    handlingContractScript.src = "data/food-handling.js?v=10.1.26";
    handlingContractScript.dataset.foodHandlingContract = "wave-1";
    handlingContractScript.addEventListener("load", loadHandlingPolicy, { once: true });
    attachPlannerLoadError(handlingContractScript);
    document.head.appendChild(handlingContractScript);
  };

  let failPlannerPolicies = (event) => {
    if (plannerPoliciesFinished) return;
    plannerPoliciesFinished = true;
    window.__plannerPoliciesReady = false;
    console.error("Planner-Policy konnte nicht vollständig geladen werden.", event?.error || event || "");
    if (typeof renderAll === "function") renderAll();
    if (plannerPolicyBody) plannerPolicyBody.style.visibility = "";
  };

  let attachPlannerLoadError = (script) => {
    script?.addEventListener?.("error", failPlannerPolicies, { once: true });
  };

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      let loadMilkPolicy = () => {
        if (typeof installPlannerMealEligibilityRuntime === "function") installPlannerMealEligibilityRuntime();
        let existingMilk = document.querySelector('script[data-planner-milk-policy="milk-01"]');
        if (existingMilk) {
          let continueAfterMilk = () => {
            if (typeof installPlannerMilkPolicyRuntime === "function") installPlannerMilkPolicyRuntime();
            loadIronPolicy();
          };
          if (typeof installPlannerMilkPolicyRuntime === "function") continueAfterMilk();
          else {
            existingMilk.addEventListener("load", continueAfterMilk, { once: true });
            attachPlannerLoadError(existingMilk);
          }
          return;
        }
        let milkScript = document.createElement("script");
        milkScript.src = "js/planner-milk-policy.js?v=10.1.26";
        milkScript.dataset.plannerMilkPolicy = "milk-01";
        milkScript.addEventListener(
          "load",
          () => {
            if (typeof installPlannerMilkPolicyRuntime === "function") installPlannerMilkPolicyRuntime();
            loadIronPolicy();
          },
          { once: true },
        );
        attachPlannerLoadError(milkScript);
        document.head.appendChild(milkScript);
      };

      let loadIronPolicy = () => {
        let loadRecipeFirstPolicy = () => {
          if (typeof installPlannerMealPresentationRuntime === "function") installPlannerMealPresentationRuntime();

          let loadQualityPolicy = () => {
            let loadIntroductionPolicy = () => {
              let loadMaintenancePolicy = () => {
                let existingMaintenance = document.querySelector('script[data-planner-allergen-maintenance="maintenance-v2"]');
                let installMaintenanceAndFinish = () => {
                  if (typeof PlannerAllergenMaintenance === "undefined") {
                    failPlannerPolicies(new Error("Planner-Allergenpflege fehlt."));
                    return;
                  }
                  finishPlannerPolicies();
                };
                if (existingMaintenance) {
                  if (typeof PlannerAllergenMaintenance !== "undefined") installMaintenanceAndFinish();
                  else {
                    existingMaintenance.addEventListener("load", installMaintenanceAndFinish, { once: true });
                    attachPlannerLoadError(existingMaintenance);
                  }
                  return;
                }
                let maintenanceScript = document.createElement("script");
                maintenanceScript.src = "js/planner-allergen-maintenance.js?v=10.1.26";
                maintenanceScript.dataset.plannerAllergenMaintenance = "maintenance-v2";
                maintenanceScript.addEventListener("load", installMaintenanceAndFinish, { once: true });
                attachPlannerLoadError(maintenanceScript);
                document.head.appendChild(maintenanceScript);
              };

              let existingIntroduction = document.querySelector('script[data-planner-introduction-policy="daily-food-introductions"]');
              let installIntroductionAndContinue = () => {
                if (typeof installPlannerIntroductionPolicyRuntime !== "function") {
                  failPlannerPolicies(new Error("Planner-Einführungspolicy fehlt."));
                  return;
                }
                installPlannerIntroductionPolicyRuntime();
                loadMaintenancePolicy();
              };
              if (existingIntroduction) {
                if (typeof installPlannerIntroductionPolicyRuntime === "function") installIntroductionAndContinue();
                else {
                  existingIntroduction.addEventListener("load", installIntroductionAndContinue, { once: true });
                  attachPlannerLoadError(existingIntroduction);
                }
                return;
              }
              let introductionScript = document.createElement("script");
              introductionScript.src = "js/planner-introduction-policy.js?v=10.1.26";
              introductionScript.dataset.plannerIntroductionPolicy = "daily-food-introductions";
              introductionScript.addEventListener("load", installIntroductionAndContinue, { once: true });
              attachPlannerLoadError(introductionScript);
              document.head.appendChild(introductionScript);
            };

            let existingQuality = document.querySelector('script[data-planner-quality-rotation="planner-quality"]');
            let installQualityAndContinue = () => {
              if (typeof installPlannerQualityRotationRuntime !== "function") {
                failPlannerPolicies(new Error("Planner-Quality-Policy fehlt."));
                return;
              }
              installPlannerQualityRotationRuntime();
              loadIntroductionPolicy();
            };
            if (existingQuality) {
              if (typeof installPlannerQualityRotationRuntime === "function") installQualityAndContinue();
              else {
                existingQuality.addEventListener("load", installQualityAndContinue, { once: true });
                attachPlannerLoadError(existingQuality);
              }
              return;
            }
            let qualityScript = document.createElement("script");
            qualityScript.src = "js/planner-quality-rotation.js?v=10.1.26";
            qualityScript.dataset.plannerQualityRotation = "planner-quality";
            qualityScript.addEventListener("load", installQualityAndContinue, { once: true });
            attachPlannerLoadError(qualityScript);
            document.head.appendChild(qualityScript);
          };

          let loadRoleStabilityPolicy = () => {
            let existingRoles = document.querySelector('script[data-planner-food-role-stability="plan-08-p0"]');
            if (existingRoles) {
              if (typeof installPlannerFoodRoleStabilityRuntime === "function") {
                installPlannerFoodRoleStabilityRuntime();
                loadQualityPolicy();
              } else {
                existingRoles.addEventListener(
                  "load",
                  () => {
                    if (typeof installPlannerFoodRoleStabilityRuntime === "function") installPlannerFoodRoleStabilityRuntime();
                    loadQualityPolicy();
                  },
                  { once: true },
                );
                attachPlannerLoadError(existingRoles);
              }
              return;
            }
            let roleScript = document.createElement("script");
            roleScript.src = "js/planner-food-role-stability.js?v=10.1.26";
            roleScript.dataset.plannerFoodRoleStability = "plan-08-p0";
            roleScript.addEventListener(
              "load",
              () => {
                if (typeof installPlannerFoodRoleStabilityRuntime === "function") installPlannerFoodRoleStabilityRuntime();
                loadQualityPolicy();
              },
              { once: true },
            );
            attachPlannerLoadError(roleScript);
            document.head.appendChild(roleScript);
          };

          let loadProactiveRecipePolicy = () => {
            let existingProactive = document.querySelector('script[data-planner-proactive-recipe="plan-08-proactive"]');
            if (existingProactive) {
              if (typeof installPlannerProactiveRecipeRuntime === "function") {
                installPlannerProactiveRecipeRuntime();
                loadRoleStabilityPolicy();
              } else {
                existingProactive.addEventListener(
                  "load",
                  () => {
                    if (typeof installPlannerProactiveRecipeRuntime === "function") installPlannerProactiveRecipeRuntime();
                    loadRoleStabilityPolicy();
                  },
                  { once: true },
                );
                attachPlannerLoadError(existingProactive);
              }
              return;
            }
            let proactiveScript = document.createElement("script");
            proactiveScript.src = "js/planner-proactive-recipe.js?v=10.1.26";
            proactiveScript.dataset.plannerProactiveRecipe = "plan-08-proactive";
            proactiveScript.addEventListener(
              "load",
              () => {
                if (typeof installPlannerProactiveRecipeRuntime === "function") installPlannerProactiveRecipeRuntime();
                loadRoleStabilityPolicy();
              },
              { once: true },
            );
            attachPlannerLoadError(proactiveScript);
            document.head.appendChild(proactiveScript);
          };

          let existingRecipeFirst = document.querySelector('script[data-planner-recipe-first="plan-08"]');
          if (existingRecipeFirst) {
            if (typeof installPlannerRecipeFirstRuntime === "function") {
              installPlannerRecipeFirstRuntime();
              loadProactiveRecipePolicy();
            } else {
              existingRecipeFirst.addEventListener(
                "load",
                () => {
                  if (typeof installPlannerRecipeFirstRuntime === "function") installPlannerRecipeFirstRuntime();
                  loadProactiveRecipePolicy();
                },
                { once: true },
              );
              attachPlannerLoadError(existingRecipeFirst);
            }
            return;
          }
          let recipeFirstScript = document.createElement("script");
          recipeFirstScript.src = "js/planner-recipe-first.js?v=10.1.26";
          recipeFirstScript.dataset.plannerRecipeFirst = "plan-08";
          recipeFirstScript.addEventListener(
            "load",
            () => {
              if (typeof installPlannerRecipeFirstRuntime === "function") installPlannerRecipeFirstRuntime();
              loadProactiveRecipePolicy();
            },
            { once: true },
          );
          attachPlannerLoadError(recipeFirstScript);
          document.head.appendChild(recipeFirstScript);
        };

        let loadPresentationPolicy = () => {
          let existingPresentation = document.querySelector('script[data-planner-meal-presentation="plan-08"]');
          if (existingPresentation) {
            if (typeof installPlannerMealPresentationRuntime === "function") loadRecipeFirstPolicy();
            else {
              existingPresentation.addEventListener("load", loadRecipeFirstPolicy, { once: true });
              attachPlannerLoadError(existingPresentation);
            }
            return;
          }
          let presentationScript = document.createElement("script");
          presentationScript.src = "js/planner-meal-presentation.js?v=10.1.26";
          presentationScript.dataset.plannerMealPresentation = "plan-08";
          presentationScript.addEventListener("load", loadRecipeFirstPolicy, { once: true });
          attachPlannerLoadError(presentationScript);
          document.head.appendChild(presentationScript);
        };

        let loadPresentationStack = () => {
          if (typeof installPlannerIronPreferenceRuntime === "function") installPlannerIronPreferenceRuntime();
          if (typeof FOOD_PRESENTATION_CONTRACT !== "undefined") {
            loadPresentationPolicy();
            return;
          }

          let existingContract = document.querySelector('script[data-food-presentation-contract="plan-08"]');
          if (existingContract) {
            existingContract.addEventListener("load", loadPresentationPolicy, { once: true });
            attachPlannerLoadError(existingContract);
            return;
          }

          let contractScript = document.createElement("script");
          contractScript.src = "data/food-presentation.js?v=10.1.26";
          contractScript.dataset.foodPresentationContract = "plan-08";
          contractScript.addEventListener("load", loadPresentationPolicy, { once: true });
          attachPlannerLoadError(contractScript);
          document.head.appendChild(contractScript);
        };

        let existingIronPolicy = document.querySelector('script[data-planner-iron-preference="plan-08-x1"]');
        if (existingIronPolicy) {
          if (typeof installPlannerIronPreferenceRuntime === "function") loadPresentationStack();
          else {
            existingIronPolicy.addEventListener("load", loadPresentationStack, { once: true });
            attachPlannerLoadError(existingIronPolicy);
          }
          return;
        }

        let ironScript = document.createElement("script");
        ironScript.src = "js/planner-iron-preference.js?v=10.1.26";
        ironScript.dataset.plannerIronPreference = "plan-08-x1";
        ironScript.addEventListener("load", loadPresentationStack, { once: true });
        attachPlannerLoadError(ironScript);
        document.head.appendChild(ironScript);
      };

      let existingEligibility = document.querySelector('script[data-planner-meal-eligibility="p0"]');
      if (existingEligibility) {
        if (typeof installPlannerMealEligibilityRuntime === "function") loadMilkPolicy();
        else {
          existingEligibility.addEventListener("load", loadMilkPolicy, { once: true });
          attachPlannerLoadError(existingEligibility);
        }
        return;
      }

      let script = document.createElement("script");
      script.src = "js/planner-meal-eligibility.js?v=10.1.26";
      script.dataset.plannerMealEligibility = "p0";
      script.addEventListener("load", loadMilkPolicy, { once: true });
      attachPlannerLoadError(script);
      document.head.appendChild(script);
    },
    { once: true },
  );
}
