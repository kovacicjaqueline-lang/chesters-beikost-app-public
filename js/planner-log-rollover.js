"use strict";

/* Planner-Log-Verknüpfung und Tageswechsel
 * Additive Planner-Schicht für konkrete Plan-Identitäten, vollständige Log-Anzeige
 * und das bewusste Verschieben offener Pläne nach einem Tageswechsel.
 *
 * Die bestehende fachliche FOOD-/Status-/Phasenlogik bleibt unverändert.
 */
(function plannerLogRolloverModule(globalScope) {
  const FEATURE_VERSION = 1;
  const MEAL_ORDER = Object.freeze({ breakfast: 1, lunch: 2, snack: 3, dinner: 4 });

  function clonePlain(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function planKey(date, meal) {
    return `${date}|${meal}`;
  }

  function previousIsoDate(date) {
    let [year, month, day] = String(date || "").split("-").map(Number);
    if (![year, month, day].every(Number.isFinite)) return "";
    let value = new Date(Date.UTC(year, month - 1, day - 1));
    return value.toISOString().slice(0, 10);
  }

  function hashText(value) {
    let hash = 2166136261;
    let text = String(value || "");
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function planFingerprint(plan = {}) {
    return JSON.stringify({
      focusId: plan.focusId || "",
      foodIds: [...new Set(plan.foodIds || [])].sort(),
      baseFoodIds: [...new Set(plan.baseFoodIds || [])].sort(),
      sampleFoodIds: [...new Set(plan.sampleFoodIds || [])].sort(),
      recipeName: plan.recipeName || "",
      recipeInventoryId: plan.recipeInventoryId || "",
      type: plan.type || "",
      manualAdded: !!plan.manualAdded,
      followUpFoodId: plan.followUpFoodId || "",
      createdAt: plan.createdAt || "",
    });
  }

  function stablePlanId(plan = {}, date = plan.date || "", meal = plan.meal || "") {
    if (plan.planId) return String(plan.planId);
    return `plan-${hashText(`${date}|${meal}|${planFingerprint(plan)}`)}`;
  }

  function logQualifiesAsCompletion(log) {
    if (!log) return false;
    if (log.foodOutcomes && typeof log.foodOutcomes === "object") {
      return Object.values(log.foodOutcomes).some((outcome) => outcome !== "not_offered");
    }
    return log.outcome !== "not_offered";
  }

  function logsForDate(data, date) {
    return (data?.logs || [])
      .filter((log) => log?.date === date)
      .slice()
      .sort((a, b) => {
        let mealOrder = (MEAL_ORDER[a.meal] || 99) - (MEAL_ORDER[b.meal] || 99);
        if (mealOrder) return mealOrder;
        return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      });
  }

  function legacyCompletedLog(data, date, meal) {
    return (data?.logs || [])
      .filter((log) => log?.date === date && log?.meal === meal && logQualifiesAsCompletion(log))
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0] || null;
  }

  function ensurePlannerMeta(data) {
    data.backupMeta ||= {};
    let current = data.backupMeta.plannerLinking;
    if (!current || typeof current !== "object" || Array.isArray(current)) current = {};
    current.version = Number(current.version) || 0;
    current.rolloverHandled = current.rolloverHandled && typeof current.rolloverHandled === "object" && !Array.isArray(current.rolloverHandled)
      ? current.rolloverHandled
      : {};
    current.carriedPlans = current.carriedPlans && typeof current.carriedPlans === "object" && !Array.isArray(current.carriedPlans)
      ? current.carriedPlans
      : {};
    data.backupMeta.plannerLinking = current;
    return current;
  }

  function ensurePrimaryPlanIds(data) {
    data.planLocks ||= {};
    data.manualMeals ||= {};
    let keys = new Set([...Object.keys(data.planLocks), ...Object.keys(data.manualMeals)]);
    let changed = false;
    for (let key of keys) {
      let [date, meal] = key.split("|");
      if (!date || !meal) continue;
      let manual = data.manualMeals?.[key] || null;
      let lock = data.planLocks?.[key] || null;
      let planId = manual?.planId || lock?.planId || stablePlanId(manual || lock || {}, date, meal);
      if (manual && manual.planId !== planId) { manual.planId = planId; changed = true; }
      if (lock && lock.planId !== planId) { lock.planId = planId; changed = true; }
    }
    return changed;
  }

  function upgradePlannerLinking(data) {
    if (!data || typeof data !== "object") return data;
    let meta = ensurePlannerMeta(data);
    let changed = ensurePrimaryPlanIds(data);
    if (meta.version < FEATURE_VERSION) {
      let keys = new Set([...Object.keys(data.planLocks || {}), ...Object.keys(data.manualMeals || {})]);
      for (let key of keys) {
        let [date, meal] = key.split("|");
        let plan = data.manualMeals?.[key] || data.planLocks?.[key];
        if (!plan?.planId) continue;
        let selected = legacyCompletedLog(data, date, meal);
        if (selected && !selected.plannedMealId) {
          selected.plannedMealId = plan.planId;
          changed = true;
        }
      }
      meta.version = FEATURE_VERSION;
      changed = true;
    }
    return data;
  }

  function linkedCompletionLog(data, planId, date = "", meal = "") {
    if (!planId) return null;
    return (data?.logs || [])
      .filter((log) =>
        log?.plannedMealId === planId &&
        (!date || log.date === date) &&
        (!meal || log.meal === meal) &&
        logQualifiesAsCompletion(log),
      )
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0] || null;
  }

  function primaryPlanInstances(data) {
    ensurePlannerMeta(data);
    ensurePrimaryPlanIds(data);
    let result = [];
    let keys = new Set([...Object.keys(data.planLocks || {}), ...Object.keys(data.manualMeals || {})]);
    for (let key of keys) {
      let [date, meal] = key.split("|");
      if (!date || !meal) continue;
      let manual = data.manualMeals?.[key] || null;
      let lock = data.planLocks?.[key] || null;
      let source = manual ? "manual" : "lock";
      let record = manual || lock;
      if (!record?.focusId) continue;
      let planId = record.planId || lock?.planId || stablePlanId(record, date, meal);
      result.push({
        ...clonePlain(lock || {}),
        ...clonePlain(record),
        planId,
        date,
        meal,
        active: true,
        source,
        mode: lock?.mode || record.mode || (manual ? "manual" : "auto"),
        manualAdded: manual ? manual.manualAdded !== false : !!record.manualAdded,
      });
    }
    return result;
  }

  function carriedPlanInstances(data) {
    let meta = ensurePlannerMeta(data);
    return Object.values(meta.carriedPlans || {})
      .filter((plan) => plan?.planId && plan?.date && plan?.meal && plan?.focusId)
      .map((plan) => ({ ...clonePlain(plan), active: true, source: "carried", carriedPlannerPlan: true }));
  }

  function allPlanInstances(data) {
    let seen = new Set();
    let result = [];
    for (let plan of [...primaryPlanInstances(data), ...carriedPlanInstances(data)]) {
      if (!plan?.planId || seen.has(plan.planId)) continue;
      seen.add(plan.planId);
      result.push(plan);
    }
    return result;
  }

  function openPlanInstances(data, predicate = () => true) {
    return allPlanInstances(data).filter((plan) =>
      predicate(plan) && !linkedCompletionLog(data, plan.planId, plan.date, plan.meal),
    );
  }

  function outstandingPastPlans(data, todayValue) {
    let handled = ensurePlannerMeta(data).rolloverHandled || {};
    let previousDay = previousIsoDate(todayValue);
    if (!previousDay) return [];
    return openPlanInstances(data, (plan) => plan.date === previousDay && !handled[plan.planId])
      .sort((a, b) => (MEAL_ORDER[a.meal] || 99) - (MEAL_ORDER[b.meal] || 99));
  }

  function markPlansKept(data, plans, at = new Date().toISOString()) {
    let handled = ensurePlannerMeta(data).rolloverHandled;
    for (let plan of plans || []) {
      if (plan?.planId) handled[plan.planId] = { action: "keep", at };
    }
    return data;
  }

  function removePlanInstance(data, plan) {
    if (!plan?.planId) return;
    let meta = ensurePlannerMeta(data);
    if (plan.source === "carried") {
      delete meta.carriedPlans[plan.planId];
      return;
    }
    let key = planKey(plan.date, plan.meal);
    if (data.manualMeals?.[key]?.planId === plan.planId) delete data.manualMeals[key];
    if (data.planLocks?.[key]?.planId === plan.planId) delete data.planLocks[key];
    if (!data.manualMeals?.[key] && !data.planLocks?.[key]) {
      delete data.overrides?.[key];
      delete data.autoLockExcluded?.[key];
    }
  }

  function normalizeMovedPlan(plan, targetDate) {
    return {
      ...clonePlain(plan),
      date: targetDate,
      meal: plan.meal,
      active: true,
      planId: plan.planId,
      rolloverShifted: true,
      source: plan.source,
    };
  }

  function writeMovedPlan(data, plan, targetDate) {
    let moved = normalizeMovedPlan(plan, targetDate);
    let key = planKey(targetDate, moved.meal);
    let targetPrimary = primaryPlanInstances(data).find((candidate) => candidate.date === targetDate && candidate.meal === moved.meal) || null;
    let targetPrimaryOpen = targetPrimary && !linkedCompletionLog(data, targetPrimary.planId, targetDate, moved.meal);
    if (targetPrimaryOpen) throw new Error("Offener Zielplan muss vor dem Schreiben kaskadiert werden.");

    if (targetPrimary) {
      ensurePlannerMeta(data).carriedPlans[moved.planId] = {
        ...moved,
        source: "carried",
        carriedPlannerPlan: true,
      };
      return moved;
    }

    let clean = { ...moved };
    delete clean.source;
    delete clean.carriedPlannerPlan;
    if (plan.source === "manual" || plan.manualAdded) {
      clean.manualAdded = plan.manualAdded !== false;
      data.manualMeals ||= {};
      data.planLocks ||= {};
      data.manualMeals[key] = { ...clonePlain(clean), mode: undefined };
      data.planLocks[key] = { ...clonePlain(clean), mode: "manual" };
    } else {
      data.planLocks ||= {};
      data.planLocks[key] = { ...clonePlain(clean), mode: plan.mode === "manual" ? "manual" : "auto" };
    }
    delete data.overrides?.[key];
    delete data.autoLockExcluded?.[key];
    return moved;
  }

  function openPlanAt(data, date, meal, exceptPlanId = "") {
    return openPlanInstances(data, (plan) => plan.date === date && plan.meal === meal && plan.planId !== exceptPlanId)[0] || null;
  }

  function shiftPlanOneDay(data, planId, addDaysFn) {
    let findById = () => allPlanInstances(data).find((plan) => plan.planId === planId) || null;
    let moving = findById();
    if (!moving) return null;
    let targetDate = addDaysFn(moving.date, 1);
    let blocker = openPlanAt(data, targetDate, moving.meal, moving.planId);
    while (blocker) {
      shiftPlanOneDay(data, blocker.planId, addDaysFn);
      blocker = openPlanAt(data, targetDate, moving.meal, moving.planId);
    }
    moving = findById();
    if (!moving) return null;
    removePlanInstance(data, moving);
    let moved = writeMovedPlan(data, moving, targetDate);
    delete ensurePlannerMeta(data).rolloverHandled[moved.planId];
    return moved;
  }

  function shiftOutstandingPlans(data, plans, addDaysFn) {
    let snapshots = (plans || []).map((plan) => ({ planId: plan.planId, date: plan.date, meal: plan.meal }));
    snapshots.sort((a, b) => b.date.localeCompare(a.date) || (MEAL_ORDER[b.meal] || 0) - (MEAL_ORDER[a.meal] || 0));
    let shifted = [];
    for (let item of snapshots) {
      let current = allPlanInstances(data).find((plan) => plan.planId === item.planId);
      if (!current || current.date !== item.date) continue;
      let moved = shiftPlanOneDay(data, item.planId, addDaysFn);
      if (moved) shifted.push(moved);
    }
    return shifted;
  }

  function dayPlannerEntries(data, date, plans = []) {
    let planList = (plans || []).filter((plan) => plan?.active && plan?.focusId);
    let linkedIds = new Set();
    let entries = [];
    for (let plan of planList) {
      let log = linkedCompletionLog(data, plan.planId, date, plan.meal);
      if (log) {
        linkedIds.add(log.id);
        entries.push({ kind: "log", meal: log.meal, log, plan, planId: plan.planId, completedPlan: true });
      } else {
        entries.push({ kind: "plan", meal: plan.meal, plan, planId: plan.planId, completedPlan: false });
      }
    }
    for (let log of logsForDate(data, date)) {
      if (linkedIds.has(log.id)) continue;
      entries.push({ kind: "log", meal: log.meal, log, plan: null, planId: log.plannedMealId || "", completedPlan: false });
    }
    return entries.sort((a, b) => {
      let mealOrder = (MEAL_ORDER[a.meal] || 99) - (MEAL_ORDER[b.meal] || 99);
      if (mealOrder) return mealOrder;
      if (a.kind !== b.kind) return a.kind === "log" ? -1 : 1;
      return String(a.log?.createdAt || a.plan?.createdAt || "").localeCompare(String(b.log?.createdAt || b.plan?.createdAt || ""));
    });
  }

  const CORE = Object.freeze({
    FEATURE_VERSION,
    MEAL_ORDER,
    planKey,
    previousIsoDate,
    stablePlanId,
    logQualifiesAsCompletion,
    legacyCompletedLog,
    ensurePlannerMeta,
    ensurePrimaryPlanIds,
    upgradePlannerLinking,
    linkedCompletionLog,
    primaryPlanInstances,
    carriedPlanInstances,
    allPlanInstances,
    openPlanInstances,
    outstandingPastPlans,
    markPlansKept,
    shiftPlanOneDay,
    shiftOutstandingPlans,
    dayPlannerEntries,
    logsForDate,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = CORE;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let baseMigrateState = migrateState;
  let baseMealSnapshot = mealSnapshot;
  let baseManualMealFor = manualMealFor;
  let baseLockedMeal = lockedMeal;
  let baseBuildDays = buildDays;
  let baseOpenLog = openLog;
  let baseSaveLog = saveLog;
  let baseBootstrapStorage = bootstrapStorage;
  let basePrepDemand = prepDemand;
  let baseRenderHomeCore = renderHomeCore;
  let plannerStorageReady = false;
  let plannerPromptOpen = false;
  let plannerPromptScheduled = false;
  let plannerSessionDeferred = false;
  let plannerLastSeenDay = "";

  function featureMeta() {
    return CORE.ensurePlannerMeta(state);
  }

  function persistPrimaryPlanId(date, meal, shown = null) {
    state.planLocks ||= {};
    state.manualMeals ||= {};
    let key = planKey(date, meal);
    let manual = state.manualMeals[key] || null;
    let lock = state.planLocks[key] || null;
    let existing = manual?.planId || lock?.planId || shown?.planId;
    let planId = existing || CORE.stablePlanId(shown || manual || lock || {}, date, meal);
    if (manual) manual.planId = planId;
    if (lock) lock.planId = planId;
    return planId;
  }

  function planIdForShownMeal(date, meal, shown = null) {
    if (shown?.planId) return shown.planId;
    return persistPrimaryPlanId(date, meal, shown);
  }

  function planCompletion(plan, date = plan?.date || "", meal = plan?.meal || "") {
    return CORE.linkedCompletionLog(state, plan?.planId, date, meal);
  }

  function linkedCompletionForSlot(date, meal) {
    let candidates = CORE.allPlanInstances(state)
      .filter((plan) => plan.date === date && plan.meal === meal)
      .map((plan) => CORE.linkedCompletionLog(state, plan.planId, date, meal))
      .filter(Boolean)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return candidates[0] || null;
  }

  migrateState = function plannerAwareMigrateState(source) {
    return CORE.upgradePlannerLinking(baseMigrateState(source));
  };

  mealSnapshot = function plannerAwareMealSnapshot(date, meal, generated, mode) {
    let snapshot = baseMealSnapshot(date, meal, generated, mode);
    if (!snapshot) return snapshot;
    snapshot.planId = generated?.planId || CORE.stablePlanId(snapshot, date, meal);
    if (generated?.rolloverShifted) snapshot.rolloverShifted = true;
    return snapshot;
  };

  manualMealFor = function plannerAwareManualMealFor(date, meal) {
    let result = baseManualMealFor(date, meal);
    if (!result) return result;
    result.planId = persistPrimaryPlanId(date, meal, result);
    return result;
  };

  lockedMeal = function plannerAwareLockedMeal(date, meal) {
    let result = baseLockedMeal(date, meal);
    if (!result) return result;
    let key = planKey(date, meal);
    let lock = state.planLocks?.[key];
    result.planId = persistPrimaryPlanId(date, meal, result);
    result.rolloverShifted = !!lock?.rolloverShifted;
    result.followUpFoodId = lock?.followUpFoodId || "";
    result.mode = lock?.mode || result.lockedMode || "auto";
    return result;
  };

  completedLog = function plannerAwareCompletedLog(date, meal) {
    return linkedCompletionForSlot(date, meal);
  };

  mealIsCompleted = function plannerAwareMealIsCompleted(date, meal) {
    return !!linkedCompletionForSlot(date, meal);
  };

  ensureAutoLocks = function plannerAwareEnsureAutoLocks(days) {
    state.planLocks ||= {};
    state.autoLockExcluded ||= {};
    let changed = CORE.ensurePrimaryPlanIds(state);
    for (let [key, lock] of Object.entries(state.planLocks)) {
      let date = key.split("|")[0];
      if (
        lock.mode === "auto" &&
        !lock.followUpFoodId &&
        date >= today() &&
        !isAutoLockDate(date) &&
        !lock.rolloverShifted
      ) {
        delete state.planLocks[key];
        changed = true;
      }
      if (date < today() && state.autoLockExcluded[key]) {
        delete state.autoLockExcluded[key];
        changed = true;
      }
    }
    for (let day of days || []) {
      if (!isAutoLockDate(day.date)) continue;
      for (let meal of day.meals || []) {
        let key = planKey(day.date, meal.meal);
        if (
          meal.active &&
          !meal.empty &&
          meal.focusId &&
          !meal.manualAdded &&
          !linkedCompletionForSlot(day.date, meal.meal) &&
          !state.planLocks[key] &&
          !state.autoLockExcluded[key]
        ) {
          let snapshot = mealSnapshot(day.date, meal.meal, meal, "auto");
          state.planLocks[key] = snapshot;
          changed = true;
        }
      }
    }
    if (changed) save();
    return changed;
  };

  function decorateDayPlans(days) {
    for (let day of days || []) {
      for (let meal of day.meals || []) {
        if (!meal?.active || !meal?.focusId) continue;
        meal.date = day.date;
        meal.planId = planIdForShownMeal(day.date, meal.meal, meal);
      }
    }
    return days;
  }

  function mergeCarriedIntoDays(days) {
    let carried = CORE.carriedPlanInstances(state);
    for (let day of days || []) {
      let existing = new Set((day.meals || []).map((meal) => meal?.planId).filter(Boolean));
      day.meals ||= [];
      day.meals.push(...carried
        .filter((plan) => plan.date === day.date && !existing.has(plan.planId))
        .map((plan) => ({ ...plan, active: true })));
    }
    return days;
  }

  buildDays = function plannerAwareBuildDays(from, n = 7, applyAutoLocks = true) {
    return decorateDayPlans(baseBuildDays(from, n, applyAutoLocks));
  };

  historicalPlanDay = function plannerAwareHistoricalPlanDay(date, index = 0) {
    let meals = CORE.allPlanInstances(state)
      .filter((plan) => plan.date === date)
      .map((plan) => ({ ...clone(plan), active: true }));
    return { date, index, meals, introDue: false, introAssigned: false, historical: true };
  };

  function planMatchesPayload(plan, payload) {
    if (!plan || !payload || plan.date !== payload.date || plan.meal !== payload.meal) return false;
    if (payload.planId && plan.planId === payload.planId) return true;
    let a = [...new Set(plan.foodIds || [])].sort().join("|");
    let b = [...new Set(payload.foodIds || [])].sort().join("|");
    return plan.focusId === payload.focusId && a === b && String(plan.recipeName || "") === String(payload.recipeName || "");
  }

  function inferPlanId(payload) {
    if (!payload?.date || !payload?.meal) return "";
    if (payload.planId) return payload.planId;
    let matches = CORE.openPlanInstances(state, (plan) => planMatchesPayload(plan, payload));
    if (matches.length === 1) return matches[0].planId;
    let sameSlot = CORE.openPlanInstances(state, (plan) => plan.date === payload.date && plan.meal === payload.meal);
    return sameSlot.length === 1 ? sameSlot[0].planId : "";
  }

  openLog = function plannerAwareOpenLog(plan) {
    if (!plan) return baseOpenLog(plan);
    let payload = { ...plan };
    let planId = payload.plannedMealId || inferPlanId(payload);
    if (planId) {
      payload.plannedMealId = planId;
      payload.plannedDate = payload.plannedDate || payload.date;
      payload.plannedMeal = payload.plannedMeal || payload.meal;
    }
    return baseOpenLog(payload);
  };

  saveLog = function plannerAwareSaveLog() {
    let current = pendingLog || null;
    let plannedMealId = current?.plannedMealId || "";
    let plannedDate = current?.plannedDate || "";
    let plannedMeal = current?.plannedMeal || "";
    let editId = current?.editId || "";
    let actualDate = document.getElementById("logDate")?.value || current?.date || "";
    let actualMeal = document.getElementById("logMeal")?.value || current?.meal || "";
    let beforeIds = new Set((state.logs || []).map((log) => log.id));
    let beforeEditedLog = editId ? state.logs.find((log) => log.id === editId) : null;
    let result = baseSaveLog();
    let saved = editId
      ? state.logs.find((log) => log.id === editId)
      : state.logs.find((log) => !beforeIds.has(log.id));
    if (!saved || (editId && saved === beforeEditedLog)) return result;
    let changed = false;
    if (plannedMealId && actualDate === plannedDate && actualMeal === plannedMeal) {
      if (saved.plannedMealId !== plannedMealId) { saved.plannedMealId = plannedMealId; changed = true; }
    } else if (saved.plannedMealId) {
      delete saved.plannedMealId;
      changed = true;
    }
    if (changed) {
      save();
      renderAll();
    }
    return result;
  };

  function nonCompletionLogHtml(log) {
    let names = (log.foodIds || []).map((id) => food(id)?.name).filter(Boolean).join(" + ");
    return `<div class="mealbox completed" data-completed-log="${log.id}">
      <div class="completed-main">
        <div>
          <div class="completed-title">${mealName(log.meal)} · ${esc(log.recipeName || names || "Mahlzeit")}</div>
          ${logOutcomeGridHtml(log)}
        </div>
        <span class="pill dim">Protokolliert</span>
      </div>
      <details class="completed-details">
        <summary>Details oder Essen bearbeiten</summary>
        <div class="completed-body">
          <div class="small"><b>Tatsächlich enthalten:</b> ${esc(names || "nicht angegeben")}</div>
          ${log.note ? `<div class="small" style="margin-top:5px"><b>Notiz:</b> ${esc(log.note)}</div>` : ""}
          <button class="btn secondary smallbtn editCompletedLog" data-log="${log.id}" style="margin-top:8px">Essen bearbeiten</button>
        </div>
      </details>
    </div>`;
  }

  function plannerLogHtml(log) {
    return CORE.logQualifiesAsCompletion(log)
      ? completedMealHtml(log.date, log.meal, log)
      : nonCompletionLogHtml(log);
  }

  function planLockForInstance(plan) {
    if (plan?.source === "carried") return plan;
    let lock = state.planLocks?.[planKey(plan.date, plan.meal)];
    return lock?.planId === plan.planId ? lock : null;
  }

  renderMealCore = function plannerAwareRenderMealCore(day, meal) {
    if (!meal?.active) return "";
    if (meal.empty)
      return `<div class="mealbox"><div class="mealname">${mealName(meal.meal)}</div><div class="small">Noch keine passende bekannte oder neue Zutat verfügbar.</div></div>`;
    meal.date = day.date;
    meal.planId = meal.planId || planIdForShownMeal(day.date, meal.meal, meal);
    let done = planCompletion(meal, day.date, meal.meal);
    if (done) return plannerLogHtml(done);

    let planPayload = encodeURIComponent(JSON.stringify({
      date: day.date,
      meal: meal.meal,
      focusId: meal.focusId,
      foodIds: meal.foodIds,
      baseFoodIds: meal.baseFoodIds || [],
      sampleFoodIds: meal.sampleFoodIds || [],
      recipeName: meal.recipeName || "",
      recipeInventoryId: meal.recipeInventoryId || "",
      planId: meal.planId,
      plannedMealId: meal.planId,
      plannedDate: day.date,
      plannedMeal: meal.meal,
    }));
    let movePayload = encodeURIComponent(JSON.stringify({
      ...meal,
      date: day.date,
      planId: meal.planId,
    }));
    let lock = planLockForInstance(meal);
    let lockText = lock
      ? lock.mode === "auto" ? "Fest eingeplant" : "Manuell geschützt"
      : "nicht geschützt";
    let lockPayload = encodeURIComponent(JSON.stringify({
      focusId: meal.focusId,
      foodIds: meal.foodIds,
      baseFoodIds: meal.baseFoodIds || [],
      sampleFoodIds: meal.sampleFoodIds || [],
      optionalAddons: meal.optionalAddons || [],
      inventoryFoodIds: meal.inventoryFoodIds || [],
      recipeName: meal.recipeName || "",
      recipeInventoryId: meal.recipeInventoryId || "",
      type: meal.type,
      note: meal.note,
      manualAdded: !!meal.manualAdded,
      planId: meal.planId,
    }));
    let lockButton = meal.source === "carried" || meal.carriedPlannerPlan
      ? ""
      : `<button class="iconbtn meal-lock ${lock ? "locked" : "unlocked"}" data-lock-date="${day.date}" data-lock-meal="${meal.meal}" data-lock-payload="${lockPayload}" aria-label="${lock ? "Feste Planung lösen" : "Mahlzeit vor automatischer Änderung schützen"}" title="${esc(lockText)}">${mealLockIcon(!!lock)}</button>`;

    if (meal.manualAdded) {
      return `<details class="manual-meal">
        <summary><div class="row"><div class="grow"><div class="manual-meal-title">${esc(mealDisplayTitle(meal))}</div><div class="small meal-type-text">${esc(mealTypeText(meal))} · ${mealName(meal.meal)}</div>${mealStatusText(meal) ? `<div class="small meal-status-text">${esc(mealStatusText(meal))}</div>` : ""}</div><div class="manual-summary-actions">${lockButton}<span class="manual-chevron">⌄</span></div></div></summary>
        <div class="manual-meal-body">${inactiveMealWarningHtml(day, meal)}${compactMealRolesHtml(meal)}<div class="actionbar">${meal.source === "carried" ? "" : `<button class="btn secondary replaceMeal" data-date="${day.date}" data-meal="${meal.meal}" data-focus="${meal.focusId}">Mahlzeit bearbeiten</button>`}<button class="btn secondary moveMeal" data-move-payload="${movePayload}">Auf morgen</button></div><button class="btn full logMeal" data-plan="${planPayload}">Essen eintragen</button>${meal.source === "carried" ? "" : `<button class="btn danger full removeManualMeal" data-date="${day.date}" data-meal="${meal.meal}">Zusatzmahlzeit entfernen</button>`}</div>
      </details>`;
    }

    let stockBadgeHtml = stockBadges(meal);
    return `<div class="mealbox">
      <div class="row meal-summary-row"><div class="grow meal-summary-main"><div class="dish-title">${esc(mealDisplayTitle(meal))}</div><div class="small meal-type-text">${esc(mealTypeText(meal))} · ${mealName(meal.meal)}</div>${mealStatusText(meal) ? `<div class="small meal-status-text">${esc(mealStatusText(meal))}</div>` : ""}${stockBadgeHtml ? `<div class="meal-stock-row">${stockBadgeHtml}</div>` : ""}</div><div class="meal-summary-actions">${lockButton}</div></div>
      ${lock ? `<div class="tiny lock-label">${esc(lockText)}</div>` : ""}${inactiveMealWarningHtml(day, meal)}${compactMealRolesHtml(meal)}${whyDetailsHtml(meal)}
      <div class="actionbar">${meal.source === "carried" ? "" : `<button class="btn secondary replaceMeal" data-date="${day.date}" data-meal="${meal.meal}" data-focus="${meal.focusId}">Mahlzeit bearbeiten</button>`}<button class="btn secondary moveMeal" data-move-payload="${movePayload}">Auf morgen</button></div>
      <button class="btn full logMeal" data-plan="${planPayload}">Essen eintragen</button>
    </div>`;
  };

  function bindPlannerRenderedActions() {
    document.querySelectorAll(".logMeal").forEach((btn) => btn.onclick = () => openLog(JSON.parse(decodeURIComponent(btn.dataset.plan))));
    document.querySelectorAll(".replaceMeal").forEach((btn) => btn.onclick = () => chooseReplacement(btn.dataset.date, btn.dataset.meal, btn.dataset.focus));
    document.querySelectorAll(".moveMeal").forEach((btn) => btn.onclick = () => {
      let payload = JSON.parse(decodeURIComponent(btn.dataset.movePayload));
      if (payload.planId) {
        let moved = CORE.shiftPlanOneDay(state, payload.planId, addDays);
        if (!moved) return;
        save();
        renderAll();
        showToast(`${mealName(moved.meal)} auf ${nice(moved.date, true)} verschoben.`);
        return;
      }
      moveMealTomorrow(payload);
    });
    document.querySelectorAll(".editCompletedLog").forEach((btn) => btn.onclick = () => editLogEntry(btn.dataset.log));
    document.querySelectorAll(".meal-lock").forEach((btn) => btn.onclick = () => toggleMealLock(btn.dataset.lockDate, btn.dataset.lockMeal, JSON.parse(decodeURIComponent(btn.dataset.lockPayload))));
    document.querySelectorAll(".addExtraMeal").forEach((btn) => btn.onclick = () => openAddMealMenu(btn.dataset.date));
    document.querySelectorAll(".removeManualMeal").forEach((btn) => btn.onclick = () => removeManualMeal(btn.dataset.date, btn.dataset.meal));
    bindInactiveMealActions();
  }

  renderPlanCore = function plannerAwareRenderPlanCore() {
    let from = visiblePlanStart();
    document.getElementById("planFrom").value = from;
    let days = mergeCarriedIntoDays(planDisplayDays(from, 7));
    let allVisiblePlans = days.flatMap((day) => (day.meals || []).filter((meal) => meal?.active && meal?.focusId).map((meal) => ({ ...meal, date: day.date })));
    let autoCount = 0, manualCount = 0;
    for (let plan of allVisiblePlans) {
      if (planCompletion(plan, plan.date, plan.meal)) continue;
      let lock = planLockForInstance(plan);
      if (lock?.mode === "auto") autoCount++;
      else if (lock?.mode === "manual" || plan.manualAdded) manualCount++;
    }
    document.getElementById("planLockSummary").innerHTML = `<span class="plan-lock-text">${planLockSummaryHtml({ autoCount, manualCount })}</span>`;
    renderPlanQuality(days);

    document.getElementById("blockPlan").innerHTML = days.map((day) => {
      let plans = (day.meals || []).filter((meal) => meal?.active && meal?.focusId).map((meal) => ({ ...meal, date: day.date, planId: meal.planId || planIdForShownMeal(day.date, meal.meal, meal) }));
      let entries = CORE.dayPlannerEntries(state, day.date, plans);
      let completedPlans = plans.filter((plan) => !!planCompletion(plan, day.date, plan.meal));
      let openPlans = plans.filter((plan) => !planCompletion(plan, day.date, plan.meal));
      let allDone = plans.length > 0 && openPlans.length === 0;
      let extra = day.date < today() ? [] : availableExtraMeals(day);
      let renderedEntries = entries.map((entry) => entry.kind === "log" ? plannerLogHtml(entry.log) : renderMealCore(day, entry.plan)).join("");

      if (allDone) {
        let completedLogIds = new Set(completedPlans.map((plan) => planCompletion(plan, day.date, plan.meal)?.id).filter(Boolean));
        let total = CORE.logsForDate(state, day.date)
          .filter((log) => completedLogIds.has(log.id))
          .reduce((sum, log) => sum + (Number(log.amount) || 0), 0);
        let label = day.date === today() ? "Heute" : nice(day.date, true);
        return `<details class="card block completed-day"><summary><span><span class="completed-day-title">${esc(label)} erledigt</span><span class="small">${completedPlans.length} ${completedPlans.length === 1 ? "Mahlzeit" : "Mahlzeiten"}${total ? ` · ${total} g insgesamt` : ""}</span></span><span class="completed-day-chevron">▼</span></summary><div class="completed-day-body">${renderedEntries}${extra.length ? `<div class="add-meal-row"><button class="btn secondary smallbtn addExtraMeal" data-date="${day.date}">+ Mahlzeit hinzufügen</button></div>` : ""}</div></details>`;
      }

      let completed = completedPlans.length;
      let dayBadge = completed && plans.length ? `<span class="pill ok">${completed}/${plans.length} erledigt</span>` : "";
      let empty = !entries.length ? '<div class="empty">Für diesen Tag gibt es weder einen offenen Plan noch einen Protokolleintrag.</div>' : "";
      return `<div class="card block day-card"><div class="row day-head"><div class="grow"><div class="day-date">${nice(day.date, true)}</div><div class="small day-type-text">${day.introAssigned ? "Einführung und Wiederholung" : "Bekannter Tag"}</div></div>${dayBadge}</div>${renderedEntries}${empty}${extra.length ? `<div class="add-meal-row"><button class="btn secondary smallbtn addExtraMeal" data-date="${day.date}">+ Mahlzeit hinzufügen</button></div>` : ""}</div>`;
    }).join("");
    bindPlannerRenderedActions();
  };

  prepDemand = function plannerAwarePrepDemand() {
    let from = state.settings.planFrom || today();
    if (from < today()) from = today();
    let days = mergeCarriedIntoDays(buildDays(from, 7));
    let map = new Map();
    days.forEach((day) => (day.meals || []).forEach((meal) => {
      if (!meal.active || meal.empty || !meal.focusId) return;
      meal.planId = meal.planId || planIdForShownMeal(day.date, meal.meal, meal);
      if (planCompletion(meal, day.date, meal.meal)) return;
      if (meal.recipeInventoryId) return;
      let allocation = meal.ingredientAmounts || plannedMealAmounts(meal).amounts;
      [...new Set(meal.foodIds || [])].forEach((id) => {
        let grams = Math.max(0, Number(allocation[id]) || 0);
        let current = map.get(id) || { foodId:id, uses:0, requiredGrams:0, reservedGrams:0, firstDate:day.date, lastDate:day.date, roles:new Set() };
        current.uses += 1;
        current.requiredGrams += grams;
        if (meal.focusId === id) current.roles.add(meal.type || "geplant");
        else if ((meal.sampleFoodIds || []).includes(id)) current.roles.add("Kostprobe");
        else current.roles.add("Bestandteil");
        if (day.date < current.firstDate) current.firstDate = day.date;
        if (day.date > current.lastDate) current.lastDate = day.date;
        map.set(id, current);
      });
    }));
    for (let demand of map.values()) {
      demand.availableGrams = inventoryGrams(demand.foodId);
      demand.reservedGrams = Math.min(demand.requiredGrams, demand.availableGrams);
      demand.missingGrams = Math.max(0, demand.requiredGrams - demand.availableGrams);
      demand.requiredPortions = demand.uses;
      demand.reserved = Math.min(demand.uses, inventoryPortions(demand.foodId));
    }
    return [...map.values()];
  };

  renderHomeCore = function plannerAwareRenderHomeCore() {
    baseRenderHomeCore();
    let on = today();
    let carriedOpen = CORE.carriedPlanInstances(state)
      .filter((plan) => plan.date === on && !CORE.linkedCompletionLog(state, plan.planId, on, plan.meal));
    if (!carriedOpen.length) return;
    let card = document.getElementById("todayCard");
    if (!card) return;
    card.querySelector("h2") && (card.querySelector("h2").textContent = "Heute anbieten");
    card.firstElementChild?.querySelector(".pill.ok")?.remove();
    card.querySelector(".empty")?.remove();
    card.querySelector("#homeFreeLog")?.remove();
    let anchor = card.querySelector(".add-meal-row");
    let html = carriedOpen.map((plan) => renderMealCore({ date: on }, { ...plan, active: true })).join("");
    if (anchor) anchor.insertAdjacentHTML("beforebegin", html);
    else card.insertAdjacentHTML("beforeend", html);
    bindPlannerRenderedActions();
  };

  function outstandingNow() {
    return CORE.outstandingPastPlans(state, today());
  }

  function rolloverPlanTitle(plan) {
    return mealDisplayTitle(plan) || food(plan?.focusId)?.name || plan?.recipeName || "Mahlzeit";
  }

  function rolloverPlanReason(plan) {
    let statusText = String(mealStatusText(plan) || "").trim();
    if (statusText) return statusText;
    let type = String(plan?.type || "").trim();
    return ["neu", "gezielt wiederholen", "Allergen einführen", "Allergen wiederholen"].includes(type)
      ? type
      : "";
  }

  function rolloverPlanListHtml(plans) {
    return `<div class="rollover-plan-list">${(plans || []).map((plan) => {
      let reason = rolloverPlanReason(plan);
      return `<div class="rollover-plan-item"><div class="small"><b>Gestern · ${esc(mealName(plan.meal))}</b></div><div><b>${esc(rolloverPlanTitle(plan))}</b>${reason ? ` <span class="small">· ${esc(reason)}</span>` : ""}</div></div>`;
    }).join("")}</div>`;
  }

  function scheduleRolloverPrompt() {
    if (!plannerStorageReady || plannerPromptOpen || plannerPromptScheduled || plannerSessionDeferred) return;
    let plans = outstandingNow();
    if (!plans.length) return;
    plannerPromptScheduled = true;
    setTimeout(() => {
      plannerPromptScheduled = false;
      if (!plannerStorageReady || plannerPromptOpen || plannerSessionDeferred) return;
      let currentPlans = outstandingNow();
      if (!currentPlans.length) return;
      plannerPromptOpen = true;
      openGeneric(
        "Offene Planung",
        `${rolloverPlanListHtml(currentPlans)}<div class="stack-actions"><button class="btn full" id="shiftOpenPlans">Plan um 1 Tag verschieben</button><button class="btn secondary full" id="backfillOpenPlans">Gestern nachtragen</button><button class="btn secondary full" id="keepOpenPlans">Nicht verschieben</button></div>`,
        () => { plannerPromptOpen = false; plannerSessionDeferred = true; },
      );
      document.getElementById("shiftOpenPlans").onclick = () => {
        let selected = outstandingNow();
        CORE.shiftOutstandingPlans(state, selected, addDays);
        plannerSessionDeferred = true;
        plannerPromptOpen = false;
        save();
        closeGeneric();
        renderAll();
        showToast("Offene Planung um einen Tag verschoben.");
      };
      document.getElementById("keepOpenPlans").onclick = () => {
        CORE.markPlansKept(state, outstandingNow());
        plannerSessionDeferred = true;
        plannerPromptOpen = false;
        save();
        closeGeneric();
        renderAll();
        showToast("Planung nicht verschoben.");
      };
      document.getElementById("backfillOpenPlans").onclick = () => {
        let selected = outstandingNow();
        let first = selected.map((plan) => plan.date).sort()[0];
        plannerSessionDeferred = true;
        plannerPromptOpen = false;
        if (first) state.settings.planFrom = first;
        save();
        closeGeneric();
        showView("plan");
        renderAll();
      };
    }, 0);
  }

  bootstrapStorage = async function plannerAwareBootstrapStorage() {
    let result = await baseBootstrapStorage();
    CORE.upgradePlannerLinking(state);
    plannerStorageReady = true;
    plannerLastSeenDay = today();
    await save();
    renderAll();
    scheduleRolloverPrompt();
    return result;
  };

  function reconcileDayChange() {
    if (!plannerStorageReady) return;
    let currentDay = today();
    if (!plannerLastSeenDay) plannerLastSeenDay = currentDay;
    if (currentDay !== plannerLastSeenDay) {
      plannerLastSeenDay = currentDay;
      plannerSessionDeferred = false;
      renderAll();
    }
    scheduleRolloverPrompt();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reconcileDayChange();
  });
  window.addEventListener("pageshow", reconcileDayChange);
  window.addEventListener("focus", reconcileDayChange);

  globalScope.__plannerLogRolloverCore = CORE;
  globalScope.__plannerLogRollover = {
    outstanding: () => clone(outstandingNow()),
    shiftOutstanding: () => {
      let plans = outstandingNow();
      let shifted = CORE.shiftOutstandingPlans(state, plans, addDays);
      save(); renderAll();
      return clone(shifted);
    },
    dayEntries: (date) => clone(CORE.dayPlannerEntries(state, date, CORE.allPlanInstances(state).filter((plan) => plan.date === date))),
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
