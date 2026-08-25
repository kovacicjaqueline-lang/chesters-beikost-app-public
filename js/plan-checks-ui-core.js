"use strict";

/*
 * Sichtbare UX für den strukturierten AP3-/Solution-Vertrag.
 * Auswahl, Scoring, Validierung und Planmutation bleiben in PlannerPlanCheckSolutions.
 */
(function installPlanChecksUiCore(globalScope) {
  if (typeof document === "undefined" || !globalScope.PlannerPlanCheckSolutions) return;
  if (globalScope.__planChecksUiInstalled) return;
  globalScope.__planChecksUiInstalled = true;

  const solutions = globalScope.PlannerPlanCheckSolutions;
  let activeGoalFlow = null;

  function currentDays() {
    return typeof planDisplayDays === "function"
      ? planDisplayDays(visiblePlanStart(), 7)
      : (typeof buildDays === "function" ? buildDays(visiblePlanStart(), 7) : []);
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

  function hardBlockerText(item) {
    const meal = item?.refs?.meals?.[0] || {};
    switch (item?.code) {
      case "NEW_FOOD_WITHOUT_TRUSTED_BASE": {
        const focus = item.details?.focusId || meal.focusId || item.refs?.foodIds?.[0];
        return `${foodName(focus)} ist ohne verträgliche Basis eingeplant.`;
      }
      case "MILK_WITH_MEAT_OR_FISH": {
        const where = meal.date ? `${nice(meal.date, true)} · ${mealName(meal.meal)}` : "Eine Mahlzeit";
        return `${where} kombiniert in „${mealTitle(meal)}“ Milchprodukt und Fleisch oder Fisch.`;
      }
      case "MULTIPLE_FULL_MILK_MEALS": {
        const date = item.details?.date || meal.date;
        const labels = (item.refs?.meals || []).map((ref) => mealName(ref.meal)).filter(Boolean);
        return `${date ? nice(date, true) : "Ein Tag"} enthält mehrere volle Milchmahlzeiten${labels.length ? ` (${labels.join(" und ")})` : ""}.`;
      }
      default:
        return "";
    }
  }

  function blockerReasonText(code) {
    return ({
      NEW_FOOD_WITHOUT_TRUSTED_BASE: "Das neue Lebensmittel wird wieder mit einer verträglichen Basis geplant.",
      MILK_WITH_MEAT_OR_FISH: "Milchprodukt und Fleisch oder Fisch werden nicht mehr in derselben Mahlzeit kombiniert.",
      MULTIPLE_FULL_MILK_MEALS: "An diesem Tag bleibt höchstens eine volle Milchmahlzeit.",
    })[code] || "";
  }

  function requiredActionText(item) {
    if (item?.code !== "INACTIVE_FOOD_PLANNED") return "";
    const names = (item.refs?.foodIds || []).map(foodName).filter(Boolean).join(" und ");
    const meal = item.refs?.meals?.[0];
    const where = meal?.date && meal?.meal ? `${nice(meal.date, true)} · ${mealName(meal.meal)}` : "im Wochenplan";
    return `${names || "Ein deaktiviertes Lebensmittel"} ist ${where} weiterhin eingeplant.`;
  }

  function hidePlanCheckBox() {
    const box = document.getElementById("planQuality");
    if (!box) return;
    box.style.display = "none";
    box.innerHTML = "";
    box.className = "notice";
  }

  function renderStructuredPlanQuality(days) {
    const box = document.getElementById("planQuality");
    if (!box) return;
    const checkReport = solutions.report(days);
    const blockers = (checkReport.items || []).filter((item) => item.type === "hard_blocker");

    if (blockers.length) {
      const concrete = blockers.map(hardBlockerText).filter(Boolean);
      box.style.display = "block";
      box.className = "notice plan-check-card plan-check-hard";
      box.innerHTML = `<div class="plan-check-copy"><b>Plan anpassen</b><div>${esc(concrete[0] || "Der Wochenplan braucht eine Korrektur.")}</div></div><button class="btn smallbtn" id="openPlanCorrection" type="button">Korrektur ansehen</button>`;
      document.getElementById("openPlanCorrection")?.addEventListener("click", () => openHardCorrection(days, blockers));
      return;
    }

    const required = (checkReport.items || []).filter((item) => item.type === "required_action");
    if (required.length) {
      const item = required[0];
      const concrete = requiredActionText(item);
      if (concrete) {
        box.style.display = "block";
        box.className = "notice plan-check-card plan-check-required";
        box.innerHTML = `<div class="plan-check-copy"><b>Planentscheidung offen</b><div>${esc(concrete)}</div></div><button class="btn secondary smallbtn" id="openPlanRequiredAction" type="button">Entscheidung ansehen</button>`;
        document.getElementById("openPlanRequiredAction")?.addEventListener("click", () => openRequiredAction(item));
        return;
      }
    }

    const goals = solutions.openGoalItems(checkReport, days);
    if (!goals.length) {
      hidePlanCheckBox();
      return;
    }

    const introductions = goals.filter((item) => item.code === solutions.INTRO_OPEN_CODE);
    if (introductions.length) {
      const item = introductions[0];
      box.style.display = "block";
      box.className = "notice plan-check-card plan-check-introduction";
      box.innerHTML = `<div class="plan-check-copy"><b>${esc(targetLabel(item))}-Einführung fortsetzen</b></div><button class="btn secondary smallbtn" id="openPlanGoalSolution" type="button">Lösung ansehen</button>`;
      document.getElementById("openPlanGoalSolution")?.addEventListener("click", () => startGoalFlow(item));
      return;
    }

    const maintenance = goals.filter((item) => item.code === "ALLERGEN_MAINTENANCE_DUE");
    if (!maintenance.length) {
      hidePlanCheckBox();
      return;
    }
    const labels = maintenance.map(targetLabel);
    box.style.display = "block";
    box.className = "notice plan-check-card plan-check-open";
    box.innerHTML = maintenance.length === 1
      ? `<div class="plan-check-copy"><b>${esc(labels[0])} diese Woche noch offen</b></div><button class="btn secondary smallbtn" id="openPlanGoalSolution" type="button">Lösung ansehen</button>`
      : `<div class="plan-check-copy"><b>${maintenance.length} Allergene noch nicht eingeplant</b><div>${labels.map(esc).join(" · ")}</div></div><button class="btn secondary smallbtn" id="openPlanGoalSolution" type="button">Lösung ansehen</button>`;
    document.getElementById("openPlanGoalSolution")?.addEventListener("click", () => startGoalFlow(maintenance[0]));
  }

  function openRequiredAction(item) {
    const paths = item.solutionPaths || [];
    const canReactivate = paths.some((path) => path.code === "REACTIVATE_FOOD");
    const canEdit = paths.some((path) => path.code === "EDIT_PLANNED_MEAL");
    const concrete = requiredActionText(item);
    openGeneric(
      "Geplante Mahlzeit prüfen",
      `<p>${esc(concrete)}</p><div class="sticky-form-actions ds-actionbar plan-required-actions">${canReactivate ? '<button class="btn" id="reactivateRequiredFood" type="button">Wieder aktivieren</button>' : ""}${canEdit ? '<button class="btn secondary" id="editRequiredMeal" type="button">Mahlzeit bearbeiten</button>' : ""}</div>`,
    );
    document.getElementById("reactivateRequiredFood")?.addEventListener("click", () => {
      const result = solutions.applyRequiredAction(item, "REACTIVATE_FOOD");
      if (!result?.ok) return;
      save();
      closeGeneric();
      renderAll();
      if (result.changed) showToast("Lebensmittel wieder aktiviert.");
    });
    document.getElementById("editRequiredMeal")?.addEventListener("click", () => {
      const result = solutions.applyRequiredAction(item, "EDIT_PLANNED_MEAL");
      const ref = result?.navigation?.meal;
      if (!result?.ok || !ref) return;
      closeGeneric();
      if (typeof chooseReplacement === "function") chooseReplacement(ref.date, ref.meal, ref.focusId);
    });
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

  function openGoalStep(preferredKey = "") {
    if (!activeGoalFlow) return;
    const { days, item } = nextFlowGoal(preferredKey);
    if (!item) {
      finishGoalFlow();
      return;
    }
    const key = solutions.goalKey(item);
    const rejected = activeGoalFlow.rejectedByGoal.get(key) || new Set();
    activeGoalFlow.rejectedByGoal.set(key, rejected);
    const solution = solutions.findSolution(item, days, { rejectedSolutionIds: [...rejected] });

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

  function startGoalFlow(item) {
    activeGoalFlow = { rejectedByGoal: new Map(), appliedAny: false };
    openGoalStep(solutions.goalKey(item));
  }

  function openHardCorrection(days, blockers) {
    const proposal = solutions.proposeHardCorrection(days, blockers);
    if (!proposal) {
      const details = blockers.map(hardBlockerText).filter(Boolean);
      openGeneric(
        "Plan anpassen",
        `${details.map((entry) => `<p>${esc(entry)}</p>`).join("")}<div class="notice warn">Für diesen Plan kann die App gerade keinen regelkonformen Gesamtkorrekturvorschlag erzeugen.</div>`,
      );
      return;
    }

    const changes = proposal.changes.map((change) => {
      const reasons = change.reasonCodes.map(blockerReasonText).filter(Boolean);
      const protectedCopy = change.requiresProtectedConfirmation
        ? '<div class="small plan-protected-change">Diese Mahlzeit ist manuell oder bewusst geschützt und wird nur mit dieser Bestätigung geändert.</div>'
        : "";
      return `<div class="plan-correction-change"><b>${esc(nice(change.date, true))} · ${esc(mealName(change.meal))}</b><div class="plan-change-compare"><span>Vorher</span><b>${esc(mealTitle(change.before))}</b><span>Nachher</span><b>${esc(mealTitle(change.after))}</b></div>${reasons.map((reason) => `<div class="small">${esc(reason)}</div>`).join("")}${protectedCopy}</div>`;
    }).join("");

    openGeneric(
      "Vorgeschlagene Korrektur",
      `<div class="plan-correction-list">${changes}</div><div class="sticky-form-actions ds-actionbar"><button class="btn" id="applyHardCorrection" type="button">Änderungen übernehmen</button></div>`,
    );
    document.getElementById("applyHardCorrection")?.addEventListener("click", () => {
      if (!solutions.applyHardCorrection(proposal)) return;
      save();
      renderAll();
      closeGeneric();
      showToast("Plan aktualisiert");
    });
  }

  function readinessImpact(readiness) {
    if (readiness?.nextMeal === "breakfast") return "Mit der nächsten Phase plant die App zusätzlich ein Frühstück. Mittagessen bleibt bestehen.";
    if (readiness?.nextMeal === "dinner") return "Mit der nächsten Phase plant die App zusätzlich ein Abendessen. Frühstück und Mittagessen bleiben bestehen.";
    if (readiness?.nextMeal === "snack") return "Mit der nächsten Phase plant die App zusätzlich einen Snack. Frühstück, Mittagessen und Abendessen bleiben bestehen.";
    return "";
  }

  function readinessReasonText(code) {
    return ({
      currentPatternAcceptedConfirmed: "Das aktuelle Mahlzeitenmuster funktioniert im Alltag.",
      currentPatternAcceptedNotConfirmed: "Das aktuelle Mahlzeitenmuster funktioniert im Alltag noch nicht zuverlässig.",
      currentPatternAcceptedUnknown: "Ob das aktuelle Mahlzeitenmuster im Alltag gut funktioniert, ist noch nicht angegeben.",
      additionalMealCueConfirmed: "Es gibt Signale für eine zusätzliche Mahlzeit.",
      additionalMealCueNotConfirmed: "Signale für eine zusätzliche Mahlzeit fehlen noch.",
      additionalMealCueUnknown: "Ob es Signale für eine zusätzliche Mahlzeit gibt, ist noch nicht angegeben.",
      routineCompatibleConfirmed: "Die zusätzliche Mahlzeit passt in euren Tagesablauf.",
      routineCompatibleNotConfirmed: "Die zusätzliche Mahlzeit passt noch nicht gut in euren Tagesablauf.",
      routineCompatibleUnknown: "Ob die zusätzliche Mahlzeit in euren Tagesablauf passt, ist noch nicht angegeben.",
      finalPhaseReached: "Familienkost ist die letzte Beikostphase.",
    })[code] || "";
  }

  function readinessSignalLabel(code) {
    return ({
      currentPatternAccepted: "Aktuelles Mahlzeitenmuster klappt gut",
      additionalMealCue: "Bedarf für eine zusätzliche Mahlzeit",
      routineCompatible: "Zusätzliche Mahlzeit passt in den Alltag",
    })[code] || code;
  }

  function phaseReadinessState() {
    return solutions.report([]).domainStates?.phaseReadiness || null;
  }

  function openPhaseDetails() {
    const readiness = phaseReadinessState();
    const phase = currentPhase();
    if (!readiness) return;
    const reasons = (readiness.reasons || []).map((code) => ({ code, text: readinessReasonText(code) })).filter((item) => item.text);
    const fulfilled = reasons.filter((item) => item.code.endsWith("Confirmed"));
    const missing = reasons.filter((item) => item.code.endsWith("NotConfirmed") || item.code.endsWith("Unknown"));
    const representedMissing = new Set(missing.flatMap((item) => ["currentPatternAccepted", "additionalMealCue", "routineCompatible"].filter((signal) => item.code.startsWith(signal))));
    for (const signal of readiness.missingPrerequisites || []) {
      if (!representedMissing.has(signal)) missing.push({ code: `${signal}Unknown`, text: `${readinessSignalLabel(signal)} ist noch nicht angegeben.` });
    }

    const signalRows = ["currentPatternAccepted", "additionalMealCue", "routineCompatible"].map((signal) => {
      const value = readiness.signals?.[signal] || "unknown";
      return `<div class="readiness-signal-row"><b>${esc(readinessSignalLabel(signal))}</b><div class="readiness-choice" role="group" aria-label="${esc(readinessSignalLabel(signal))}"><button type="button" class="btn smallbtn ${value === "yes" ? "" : "secondary"}" data-readiness-signal="${signal}" data-readiness-value="yes">Ja</button><button type="button" class="btn smallbtn ${value === "no" ? "" : "secondary"}" data-readiness-signal="${signal}" data-readiness-value="no">Nein</button><button type="button" class="btn smallbtn ${value === "unknown" ? "" : "secondary"}" data-readiness-signal="${signal}" data-readiness-value="unknown">Noch offen</button></div></div>`;
    }).join("");
    const fulfilledHtml = fulfilled.length
      ? `<div class="readiness-reasons"><b>Erfüllt</b>${fulfilled.map((item) => `<div class="readiness-reason"><span aria-hidden="true">✓</span><span>${esc(item.text)}</span></div>`).join("")}</div>`
      : "";
    const missingHtml = missing.length
      ? `<div class="readiness-reasons"><b>Fehlt noch</b>${missing.map((item) => `<div class="readiness-reason"><span aria-hidden="true">${item.code.endsWith("Unknown") ? "?" : "–"}</span><span>${esc(item.text)}</span></div>`).join("")}</div>`
      : "";
    const impact = readinessImpact(readiness);
    const conclusion = readiness.nextPhase
      ? `<div class="notice olive phase-readiness-conclusion"><b>${readiness.recommendable ? "Nächste Phase empfohlen" : "Nächste Phase noch nicht empfohlen"}</b>${impact ? `<div>${esc(impact)}</div>` : ""}</div>`
      : '<div class="notice olive phase-readiness-conclusion">Familienkost ist die letzte Beikostphase. Es kommt kein weiterer automatischer Mahlzeitenslot hinzu.</div>';
    const action = readiness.recommendable && readiness.nextPhase
      ? `<div class="sticky-form-actions ds-actionbar"><button class="btn" id="startRecommendedPhase" type="button">${esc(PHASES[readiness.nextPhase].label)} starten</button></div>`
      : "";

    openGeneric(`${PHASES[phase].label} · Phase-Details`, `${signalRows}${fulfilledHtml}${missingHtml}${conclusion}${action}`);
    document.querySelectorAll("[data-readiness-signal]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!solutions.setPhaseSignal(button.dataset.readinessSignal, button.dataset.readinessValue)) return;
        save();
        renderAll();
        openPhaseDetails();
      });
    });
    document.getElementById("startRecommendedPhase")?.addEventListener("click", () => {
      closeGeneric();
      document.getElementById("phaseForward")?.click();
    });
  }

  function enhancePhaseCard() {
    const card = document.getElementById("phaseCard");
    const details = card?.querySelector("details.home-control-details");
    const summary = details?.querySelector(":scope > summary");
    const label = summary?.querySelector("b");
    const body = details?.querySelector(".home-control-body");
    if (!summary || !label || !body) return;

    label.classList.add("phase-details-trigger");
    label.setAttribute("role", "button");
    label.setAttribute("tabindex", "0");
    const openFromLabel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPhaseDetails();
    };
    label.onclick = openFromLabel;
    label.onkeydown = (event) => {
      if (["Enter", " "].includes(event.key)) openFromLabel(event);
    };

    let detailsButton = body.querySelector(".open-phase-details");
    if (!detailsButton) {
      detailsButton = document.createElement("button");
      detailsButton.type = "button";
      detailsButton.className = "btn secondary full open-phase-details";
      detailsButton.textContent = "Phase-Details ansehen";
      body.insertBefore(detailsButton, body.querySelector(".phase-controls"));
    }
    detailsButton.onclick = openPhaseDetails;

    body.querySelector(".phase-readiness-hint")?.remove();
    const readiness = phaseReadinessState();
    if (!readiness?.recommendable || !readiness.nextPhase) return;
    const hint = document.createElement("div");
    hint.className = "phase-readiness-hint";
    hint.innerHTML = `<b>Bereit für ${esc(PHASES[readiness.nextPhase].label)}</b><div class="small">${esc(readinessImpact(readiness))}</div><button class="btn secondary smallbtn" id="openPhaseReadinessHint" type="button">Mehr erfahren</button>`;
    body.appendChild(hint);
    hint.querySelector("#openPhaseReadinessHint")?.addEventListener("click", openPhaseDetails);
  }

  const baseRenderPlanQuality = typeof renderPlanQuality === "function" ? renderPlanQuality : null;
  renderPlanQuality = function structuredPlanQualityRenderer(days) {
    if (!globalScope.PlannerPlanChecks?.report) {
      if (baseRenderPlanQuality) return baseRenderPlanQuality(days);
      return;
    }
    renderStructuredPlanQuality(days);
  };

  const baseRenderHome = typeof renderHome === "function" ? renderHome : null;
  if (baseRenderHome) {
    renderHome = function structuredReadinessHomeRenderer() {
      baseRenderHome();
      enhancePhaseCard();
    };
  }

  const baseClearAutomaticLocks = typeof clearAutomaticLocks === "function" ? clearAutomaticLocks : null;
  if (baseClearAutomaticLocks) {
    clearAutomaticLocks = function planCheckAwareClearAutomaticLocks() {
      solutions.bumpEvaluationRevision();
      return baseClearAutomaticLocks();
    };
    const recalcButton = document.getElementById("planRecalculate");
    if (recalcButton) recalcButton.onclick = clearAutomaticLocks;
  }

  const baseSaveLog = typeof saveLog === "function" ? saveLog : null;
  if (baseSaveLog) {
    saveLog = function planCheckAwareSaveLog() {
      const before = solutions.stableStringify((state.logs || []).map((entry) => ({
        id: entry.id,
        updatedAt: entry.updatedAt || "",
        outcome: entry.outcome || "",
        foodOutcomes: entry.foodOutcomes || {},
      })));
      solutions.beginLogSuppression(currentDays());
      const result = baseSaveLog();
      const after = solutions.stableStringify((state.logs || []).map((entry) => ({
        id: entry.id,
        updatedAt: entry.updatedAt || "",
        outcome: entry.outcome || "",
        foodOutcomes: entry.foodOutcomes || {},
      })));
      if (before === after) solutions.cancelLogSuppression();
      return result;
    };
  }

  if (globalScope.__beikostTest) {
    globalScope.__beikostTest.planCheckReport = () => clone(solutions.report(currentDays()));
    globalScope.__beikostTest.planCheckEvaluationKey = () => solutions.evaluationKey(currentDays());
    globalScope.__beikostTest.phaseReadinessReport = () => clone(phaseReadinessState());
    globalScope.__beikostTest.planCheckOpenGoals = () => {
      const days = currentDays();
      return clone(solutions.openGoalItems(solutions.report(days), days));
    };
  }

  renderAll();
})(typeof globalThis !== "undefined" ? globalThis : this);
