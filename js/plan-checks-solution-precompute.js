"use strict";

/*
 * Vorberechnung für sichtbare Plan-Check-Lösungen.
 *
 * Die fachliche Lösungssuche bleibt vollständig in PlannerPlanCheckSolutions.
 * Diese Schicht startet unabhängige Goal-Prüfungen gemeinsam als kooperative Background-Tasks,
 * bindet Ergebnisse an den aktuellen Evaluation-Key und zeigt „Lösung ansehen“
 * erst, wenn bereits eine validierte Lösung vorliegt.
 *
 * Der Loader lädt diese Datei bewusst vor plan-checks-ui-core.js. Der Core
 * installiert den Precompute-Renderer nach seiner eigenen Initialisierung explizit,
 * bevor die aktive View erneut gerendert wird. Damit braucht dieser Pfad keinen
 * Vollrender als Installationssignal.
 */
(function bootstrapPlanCheckSolutionPrecompute(globalScope) {
  if (typeof document === "undefined" || !globalScope.PlannerPlanCheckSolutions) return;
  if (globalScope.__planCheckSolutionPrecomputeBootstrapInstalled) return;
  globalScope.__planCheckSolutionPrecomputeBootstrapInstalled = true;

  function installPrecompute({ renderNow = true } = {}) {
    if (globalScope.__planCheckSolutionPrecomputeInstalled) return true;
    if (!globalScope.__planChecksUiInstalled) return false;

    const solutions = globalScope.PlannerPlanCheckSolutions;
    const baseRenderPlanQuality = typeof renderPlanQuality === "function" ? renderPlanQuality : null;
    if (!baseRenderPlanQuality) return false;

    const cache = new Map();
    const batches = new Map();
    let activeEvaluationKey = "";
    let activeGoalFlow = null;

    function currentDays() {
      return typeof planDisplayDays === "function"
        ? planDisplayDays(visiblePlanStart(), 7)
        : (typeof buildDays === "function" ? buildDays(visiblePlanStart(), 7) : []);
    }

    function cloneValue(value) {
      if (typeof clone === "function") return clone(value);
      return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function foodName(id) {
      return typeof food === "function" ? (food(id)?.name || id || "Lebensmittel") : (id || "Lebensmittel");
    }

    function targetLabel(item) {
      const target = item?.refs?.allergenTargets?.[0];
      const representative = item?.details?.representativeFoodId || target?.representativeFoodId || item?.refs?.foodIds?.[0];
      if ([solutions.INTRO_OPEN_CODE, solutions.INTRO_PROJECTED_CODE].includes(item?.code)) return foodName(representative);
      return target?.value || target?.allergenGroup || foodName(representative) || "Allergen";
    }

    function mealTitle(meal) {
      if (!meal) return "geplante Mahlzeit";
      if (meal.recipeName) return meal.recipeName;
      if (typeof mealDisplayTitle === "function") return mealDisplayTitle(meal);
      return (meal.foodIds || []).map(foodName).filter(Boolean).join(" + ") || "geplante Mahlzeit";
    }

    function goalSolutionCopy(solution) {
      const before = mealTitle(solution.before);
      const after = mealTitle(solution.after);
      const beforeIds = new Set(solution.before?.foodIds || []);
      const added = (solution.after?.foodIds || []).filter((id) => !beforeIds.has(id)).map(foodName);
      if (solution.after?.recipeName && solution.after.recipeName !== solution.before?.recipeName) {
        return `Die geplante Mahlzeit „${before}“ durch „${after}“ ersetzen.`;
      }
      if (added.length) return `${added.join(" und ")} zur geplanten Mahlzeit „${before}“ ergänzen.`;
      return `Die geplante Mahlzeit „${before}“ zu „${after}“ ändern.`;
    }

    function cacheKey(evaluationKey, item) {
      return `${evaluationKey}|${solutions.goalKey(item)}`;
    }

    function activateEvaluation(evaluationKey) {
      if (activeEvaluationKey === evaluationKey) return;
      activeEvaluationKey = evaluationKey;
      for (const key of cache.keys()) {
        if (!key.startsWith(`${evaluationKey}|`)) cache.delete(key);
      }
    }

    function evaluationStillCurrent(evaluationKey) {
      try {
        return solutions.evaluationKey(currentDays()) === evaluationKey;
      } catch (_) {
        return false;
      }
    }

    function rerenderCurrentEvaluation(evaluationKey) {
      if (evaluationStillCurrent(evaluationKey) && typeof renderPlan === "function") renderPlan();
    }

    function backgroundTask(callback) {
      if (globalScope.scheduler?.postTask) {
        return globalScope.scheduler.postTask(callback, { priority: "background" });
      }
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            resolve(callback());
          } catch (error) {
            reject(error);
          }
        }, 0);
      });
    }

    function scheduleGoalBatch(days, goals) {
      if (!goals.length) return;
      const evaluationKey = solutions.evaluationKey(days);
      activateEvaluation(evaluationKey);
      const missing = goals.filter((item) => !cache.has(cacheKey(evaluationKey, item)));
      if (!missing.length) return;

      for (const item of missing) {
        cache.set(cacheKey(evaluationKey, item), { status: "pending", solution: null });
      }

      const batchKey = `${evaluationKey}|${missing.map((item) => solutions.goalKey(item)).sort().join(",")}`;
      if (batches.has(batchKey)) return;

      const snapshot = cloneValue(days);
      const tasks = missing.map((item) => backgroundTask(async () => {
        if (!evaluationStillCurrent(evaluationKey)) return { stale: true };
        const key = cacheKey(evaluationKey, item);
        let result;
        try {
          const solution = typeof solutions.findSolutionAsync === "function"
            ? await solutions.findSolutionAsync(item, snapshot, {
                shouldContinue: () => evaluationStillCurrent(evaluationKey),
              })
            : solutions.findSolution(item, snapshot);
          if (!evaluationStillCurrent(evaluationKey)) return { stale: true };
          cache.set(key, { status: solution ? "ready" : "none", solution: solution || null });
          result = { stale: false, goalKey: solutions.goalKey(item), found: !!solution };
        } catch (error) {
          if (evaluationStillCurrent(evaluationKey)) cache.set(key, { status: "error", solution: null });
          result = { stale: false, goalKey: solutions.goalKey(item), error: String(error?.message || error) };
        }
        rerenderCurrentEvaluation(evaluationKey);
        return result;
      }));

      const batch = Promise.allSettled(tasks).finally(() => {
        batches.delete(batchKey);
      });
      batches.set(batchKey, batch);
    }

    function goalState(days, item) {
      const evaluationKey = solutions.evaluationKey(days);
      activateEvaluation(evaluationKey);
      return cache.get(cacheKey(evaluationKey, item)) || null;
    }

    function goalTitleMarkup(item, maintenanceItems = []) {
      if (item.code === solutions.INTRO_OPEN_CODE) {
        return `<div class="plan-check-copy"><b>${esc(targetLabel(item))}-Einführung fortsetzen</b></div>`;
      }
      if (maintenanceItems.length <= 1) {
        return `<div class="plan-check-copy"><b>${esc(targetLabel(item))} diese Woche noch offen</b></div>`;
      }
      const labels = maintenanceItems.map(targetLabel);
      return `<div class="plan-check-copy"><b>${maintenanceItems.length} Allergene noch nicht eingeplant</b><div>${labels.map(esc).join(" · ")}</div></div>`;
    }

    function renderGoalState(days, item, maintenanceItems = []) {
      const box = document.getElementById("planQuality");
      if (!box) return;
      const stateEntry = goalState(days, item);
      const title = goalTitleMarkup(item, maintenanceItems);
      const introduction = item.code === solutions.INTRO_OPEN_CODE;
      box.style.display = "block";
      box.className = `notice plan-check-card ${introduction ? "plan-check-introduction" : "plan-check-open"}`;

      if (!stateEntry || stateEntry.status === "pending") {
        box.innerHTML = `${title}<div class="small plan-check-solution-status" aria-live="polite">Passende Möglichkeit wird geprüft …</div>`;
        return;
      }

      if (stateEntry.status === "none") {
        box.innerHTML = `${title}<div class="small plan-check-solution-status">Für diese Woche gibt es keine passende Möglichkeit.</div><button class="btn secondary smallbtn" id="leavePlanGoalDirect" type="button">Diese Woche so lassen</button>`;
        document.getElementById("leavePlanGoalDirect")?.addEventListener("click", () => {
          solutions.dismissGoal(item, days);
          if (typeof renderPlan === "function") renderPlan();
        });
        return;
      }

      if (stateEntry.status === "error") {
        box.innerHTML = `${title}<div class="small plan-check-solution-status">Die passende Möglichkeit konnte gerade nicht geprüft werden.</div><button class="btn secondary smallbtn" id="retryPlanGoalCheck" type="button">Erneut prüfen</button>`;
        document.getElementById("retryPlanGoalCheck")?.addEventListener("click", () => {
          cache.delete(cacheKey(solutions.evaluationKey(days), item));
          scheduleGoalBatch(days, [item]);
          renderGoalState(days, item, maintenanceItems);
        });
        return;
      }

      box.innerHTML = `${title}<button class="btn secondary smallbtn" id="openPlanGoalSolution" type="button">Lösung ansehen</button>`;
      document.getElementById("openPlanGoalSolution")?.addEventListener("click", () => startGoalFlow(item, stateEntry.solution));
    }

    function renderPrecomputedPlanQuality(days) {
      const checkReport = solutions.report(days);
      const blockers = (checkReport.items || []).filter((item) => item.type === "hard_blocker");
      const required = (checkReport.items || []).filter((item) => item.type === "required_action");
      if (blockers.length || required.length) {
        baseRenderPlanQuality(days);
        return;
      }

      const goals = solutions.openGoalItems(checkReport, days);
      if (!goals.length) {
        baseRenderPlanQuality(days);
        return;
      }

      scheduleGoalBatch(days, goals);
      const introductions = goals.filter((item) => item.code === solutions.INTRO_OPEN_CODE);
      if (introductions.length) {
        renderGoalState(days, introductions[0]);
        return;
      }

      const maintenance = goals.filter((item) => item.code === "ALLERGEN_MAINTENANCE_DUE");
      if (!maintenance.length) {
        baseRenderPlanQuality(days);
        return;
      }
      renderGoalState(days, maintenance[0], maintenance);
    }

    function finishGoalFlow() {
      const updated = !!activeGoalFlow?.appliedAny;
      activeGoalFlow = null;
      closeGeneric();
      if (updated) showToast("Plan aktualisiert");
    }

    function nextFlowGoal(preferredKey = "") {
      const days = currentDays();
      const checkReport = solutions.report(days);
      const goals = solutions.openGoalItems(checkReport, days);
      if (!goals.length) return { days, item: null };
      const preferred = preferredKey ? goals.find((item) => solutions.goalKey(item) === preferredKey) : null;
      return { days, item: preferred || goals[0] };
    }

    function openGoalStep(preferredKey = "", preparedSolution = null) {
      if (!activeGoalFlow) return;
      const { days, item } = nextFlowGoal(preferredKey);
      if (!item) {
        finishGoalFlow();
        return;
      }

      const key = solutions.goalKey(item);
      const rejected = activeGoalFlow.rejectedByGoal.get(key) || new Set();
      activeGoalFlow.rejectedByGoal.set(key, rejected);
      const preparedMatches = preparedSolution && preparedSolution.goalKey === key && !rejected.has(preparedSolution.id);
      const solution = preparedMatches
        ? preparedSolution
        : solutions.findSolution(item, days, { rejectedSolutionIds: [...rejected] });

      if (!solution) {
        openGeneric(
          targetLabel(item),
          `<p>Für diese Woche gibt es keine passende Möglichkeit.</p><div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="leavePlanGoal" type="button">Diese Woche so lassen</button></div>`,
        );
        document.getElementById("leavePlanGoal")?.addEventListener("click", () => {
          solutions.dismissGoal(item, days);
          openGoalStep();
        });
        return;
      }

      const before = mealTitle(solution.before);
      const after = mealTitle(solution.after);
      const protectedNotice = solution.requiresProtectedConfirmation
        ? `<div class="notice warn plan-solution-protected"><b>Geschützte Mahlzeit</b><div>Diese Lösung ändert die bewusst geschützte Mahlzeit am ${esc(nice(solution.date, true))} erst nach deiner Bestätigung.</div><div class="plan-change-compare"><span>Vorher</span><b>${esc(before)}</b><span>Nachher</span><b>${esc(after)}</b></div></div>`
        : "";
      const heading = item.code === solutions.INTRO_OPEN_CODE
        ? `${targetLabel(item)}-Einführung fortsetzen`
        : targetLabel(item);
      openGeneric(
        heading,
        `<div class="plan-solution-card"><b>${esc(nice(solution.date, true))} · ${esc(mealName(solution.meal))}</b><p>${esc(goalSolutionCopy(solution))}</p>${protectedNotice}</div><div class="sticky-form-actions ds-actionbar plan-solution-actions"><button class="btn" id="applyPlanGoalSolution" type="button">Änderung übernehmen</button><button class="btn secondary" id="otherPlanGoalSolution" type="button">Andere Lösung</button><button class="btn secondary" id="leavePlanGoal" type="button">Diese Woche so lassen</button></div>`,
      );

      document.getElementById("applyPlanGoalSolution")?.addEventListener("click", () => {
        if (!solutions.applySolution(solution)) return;
        activeGoalFlow.appliedAny = true;
        save();
        renderAll();
        openGoalStep();
      });
      document.getElementById("otherPlanGoalSolution")?.addEventListener("click", () => {
        rejected.add(solution.id);
        openGoalStep(key);
      });
      document.getElementById("leavePlanGoal")?.addEventListener("click", () => {
        solutions.dismissGoal(item, days);
        openGoalStep();
      });
    }

    function startGoalFlow(item, preparedSolution) {
      activeGoalFlow = { rejectedByGoal: new Map(), appliedAny: false };
      openGoalStep(solutions.goalKey(item), preparedSolution);
    }

    renderPlanQuality = function precomputedPlanQualityRenderer(days) {
      renderPrecomputedPlanQuality(days);
    };

    if (globalScope.__beikostTest) {
      globalScope.__beikostTest.planCheckSolutionPrecompute = () => {
        const days = currentDays();
        const report = solutions.report(days);
        const goals = solutions.openGoalItems(report, days);
        return goals.map((item) => {
          const entry = goalState(days, item);
          return {
            goalKey: solutions.goalKey(item),
            status: entry?.status || "missing",
            solutionId: entry?.solution?.id || "",
          };
        });
      };
    }

    globalScope.__planCheckSolutionPrecomputeInstalled = true;
    if (renderNow && typeof renderPlan === "function") renderPlan();
    return true;
  }

  globalScope.__installPlanCheckSolutionPrecompute = installPrecompute;

  if (globalScope.__planChecksUiInstalled) {
    installPrecompute({ renderNow: true });
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
