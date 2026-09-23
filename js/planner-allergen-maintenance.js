"use strict";

/*
 * Gemeinsamer Browser-Bootstrap fuer die Planner-Policy-Schichten, die app.js
 * und damit installFoodPolicyRuntime() voraussetzen. Der bestehende Script-Slot
 * bleibt absichtlich erhalten; die eigentliche Allergenpflege liegt in
 * planner-allergen-maintenance-runtime.js.
 */
(function bootstrapPlannerRuntime(globalScope) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (globalScope.__plannerRuntimeBootstrapQueued) return;
  globalScope.__plannerRuntimeBootstrapQueued = true;

  const version = "10.1.26";
  const scripts = [
    "planner-meal-eligibility.js",
    "planner-milk-policy.js",
    "planner-iron-preference.js",
    "planner-meal-presentation.js",
    "planner-recipe-first.js",
    "planner-proactive-recipe.js",
    "planner-food-role-stability.js",
    "planner-quality-rotation.js",
    "planner-introduction-policy.js",
    "planner-final-quality.js",
    "planner-allergen-maintenance-runtime.js",
    "handling-readiness.js",
  ];

  function finalize() {
    let changed = false;
    if (typeof state !== "undefined" && typeof pruneIneligibleAutomaticPlanState === "function") {
      changed = pruneIneligibleAutomaticPlanState(state);
    }
    if (changed && typeof save === "function") save();
    if (typeof invalidatePlannerWeekCache === "function") {
      invalidatePlannerWeekCache("planner-runtime-ready");
    }
    globalScope.__plannerPoliciesReady = true;
    if (typeof renderCurrentView === "function") renderCurrentView();
  }

  if (document.readyState === "loading" && typeof document.write === "function") {
    document.write(
      scripts.map((name) => `<script src="js/${name}?v=${version}"><\/script>`).join("") +
      `<script>globalThis.__finalizePlannerRuntime && globalThis.__finalizePlannerRuntime();<\/script>`,
    );
    globalScope.__finalizePlannerRuntime = () => {
      delete globalScope.__finalizePlannerRuntime;
      finalize();
    };
    return;
  }

  // Defensive fallback fuer eine spaete manuelle Script-Injektion. Die normale
  // App laeuft ueber den synchronen Parser-Pfad oben.
  let chain = Promise.resolve();
  for (const name of scripts) {
    chain = chain.then(() => new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `js/${name}?v=${version}`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    }));
  }
  chain.then(finalize);
})(typeof globalThis !== "undefined" ? globalThis : this);
