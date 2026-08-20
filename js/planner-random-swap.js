"use strict";

(function plannerRandomSwapModule(globalScope) {
  const PIN_FLAG = "randomSwapPinned";
  const PRESERVE_FLAG = "randomSwapPreserved";
  const TARGET_FLAG = "randomSwapTarget";

  function slotKey(date, meal) {
    return `${date}|${meal}`;
  }

  function canonicalCombination(ids) {
    return [...new Set(ids || [])].filter(Boolean).sort().join("+");
  }

  function hasFutureLearningDependency(days, targetDate, currentMeal) {
    const samples = new Set(currentMeal?.sampleFoodIds || []);
    if (!samples.size) return false;
    return (days || []).some((day) =>
      day?.date > targetDate &&
      (day.meals || []).some((meal) => {
        if (!meal?.active || meal.empty) return false;
        const used = meal.foodIds || [];
        return [...samples].some((id) => used.includes(id));
      }),
    );
  }

  function otherMealsForSlot(days, targetKey) {
    const result = [];
    for (const day of days || []) {
      for (const meal of day.meals || []) {
        if (!meal?.active || meal.empty || !meal.focusId) continue;
        if (slotKey(day.date, meal.meal) === targetKey) continue;
        result.push(meal);
      }
    }
    return result;
  }

  function mergePlanDays(primaryDays, secondaryDays) {
    const byDate = new Map();
    for (const day of [...(primaryDays || []), ...(secondaryDays || [])]) {
      if (!day?.date || byDate.has(day.date)) continue;
      byDate.set(day.date, day);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  function chooseAlternative(alternatives, otherMeals, randomFn = Math.random) {
    const unique = [];
    const seen = new Set();
    for (const meal of alternatives || []) {
      const combination = canonicalCombination(meal?.foodIds || []);
      const identity = combination || `recipe:${meal?.recipeName || ""}`;
      if (!identity || seen.has(identity)) continue;
      seen.add(identity);
      unique.push(meal);
    }
    if (!unique.length) return null;

    const otherCombinations = new Set(
      (otherMeals || []).map((meal) => canonicalCombination(meal?.foodIds || [])).filter(Boolean),
    );
    const otherFocusIds = new Set((otherMeals || []).map((meal) => meal?.focusId).filter(Boolean));
    const novel = unique.filter((meal) =>
      !otherCombinations.has(canonicalCombination(meal.foodIds || [])) &&
      !otherFocusIds.has(meal.focusId),
    );
    const combinationNovel = unique.filter((meal) =>
      !otherCombinations.has(canonicalCombination(meal.foodIds || [])),
    );
    const pool = novel.length ? novel : combinationNovel.length ? combinationNovel : unique;
    const random = Number(randomFn());
    const normalized = Number.isFinite(random) ? Math.min(0.999999999, Math.max(0, random)) : 0;
    return pool[Math.floor(normalized * pool.length)] || pool[0];
  }

  function automaticFocusAllowed(item, meal, on, baseEligible, automaticEligibility, focusPolicy) {
    if (!item) return false;
    if (typeof baseEligible === "function" && !baseEligible(item, meal, on)) return false;
    if (typeof automaticEligibility === "function" && !automaticEligibility(item, on)) return false;
    if (typeof focusPolicy === "function" && !focusPolicy(item)) return false;
    return true;
  }

  function learningCandidateCompatible(current, candidate, focusId) {
    if (!current || !candidate) return false;
    const currentSamples = new Set(current.sampleFoodIds || []);
    const candidateSamples = new Set(candidate.sampleFoodIds || []);
    if (!currentSamples.size) return candidateSamples.size === 0;
    return candidateSamples.has(focusId);
  }

  function pinVisibleAutomaticMeals(data, days, targetKey, snapshotFactory, isCompleted, todayValue) {
    if (!data || typeof snapshotFactory !== "function") return 0;
    data.planLocks ||= {};
    data.manualMeals ||= {};
    data.autoLockExcluded ||= {};
    let pinned = 0;
    for (const day of days || []) {
      if (!day?.date || day.date < todayValue) continue;
      for (const meal of day.meals || []) {
        if (!meal?.active || meal.empty || !meal.focusId) continue;
        const key = slotKey(day.date, meal.meal);
        if (key === targetKey || isCompleted?.(day.date, meal.meal)) continue;
        if (data.manualMeals?.[key]?.manualAdded) continue;
        const existing = data.planLocks?.[key];
        if (existing?.followUpFoodId || existing?.mode === "manual" || existing?.[PIN_FLAG]) continue;
        const snapshot = snapshotFactory(day.date, meal.meal, meal, "auto");
        if (!snapshot?.focusId) continue;
        snapshot.mode = "auto";
        snapshot[PIN_FLAG] = true;
        snapshot[PRESERVE_FLAG] = true;
        data.planLocks[key] = snapshot;
        delete data.autoLockExcluded?.[key];
        pinned += 1;
      }
    }
    return pinned;
  }

  const API = {
    PIN_FLAG,
    PRESERVE_FLAG,
    TARGET_FLAG,
    slotKey,
    canonicalCombination,
    hasFutureLearningDependency,
    otherMealsForSlot,
    mergePlanDays,
    chooseAlternative,
    automaticFocusAllowed,
    learningCandidateCompatible,
    pinVisibleAutomaticMeals,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Object.freeze({ ...API });
  if (typeof window === "undefined" || typeof document === "undefined") return;

  function visibleStart() {
    return typeof visiblePlanStart === "function"
      ? visiblePlanStart()
      : state.settings?.planFrom || today();
  }

  function currentVisiblePlan() {
    const from = visibleStart();
    return typeof planDisplayDays === "function"
      ? planDisplayDays(from, 7)
      : buildDays(from, 7, false);
  }

  function targetMealFrom(days, date, meal) {
    return (days || [])
      .find((day) => day?.date === date)
      ?.meals?.find((entry) => entry?.meal === meal) || null;
  }

  function targetPlanWindow(date, visibleDays) {
    if ((visibleDays || []).some((day) => day?.date === date)) return visibleDays;
    return buildDays(date, 7, false);
  }

  function shuffle(items) {
    const result = [...(items || [])];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function automaticFoodReady(item, meal, date) {
    return automaticFocusAllowed(
      item,
      meal,
      date,
      (foodRecord, concreteMeal, on) => eligible(foodRecord, concreteMeal, on),
      typeof automaticFoodEligibility === "function"
        ? (foodRecord, on) => automaticFoodEligibility(foodRecord, on, state.settings || {})
        : null,
      typeof plannerFoodCanBeAutomaticFocus === "function"
        ? plannerFoodCanBeAutomaticFocus
        : null,
    );
  }

  function focusPool(current, date, meal, days) {
    let pool = (state.foods || []).filter((item) => automaticFoodReady(item, meal, date));
    if (hasFutureLearningDependency(days, date, current)) {
      return pool.filter((item) => item.id === current.focusId);
    }
    if (current.type === "Allergen wiederholen") {
      return pool.filter((item) => dueAllergen(item, date));
    }
    if ((current.sampleFoodIds || []).length) {
      if (current.type === "gezielt wiederholen") {
        return pool.filter((item) => rank(item) === 1 || lastOutcome(item.id) === "not_accepted");
      }
      if (current.type === "Allergen einführen") {
        return pool.filter((item) => rank(item) === 0 && !!item.allergenGroup);
      }
      if (current.type === "neu") {
        return pool.filter((item) => rank(item) === 0 && !item.allergenGroup);
      }
      return pool.filter((item) => !isTrustedBase(item));
    }
    return pool.filter((item) => canCombine(item));
  }

  function seedVisiblePlannerContext(days, targetKey) {
    state.planLocks ||= {};
    for (const day of days || []) {
      for (const meal of day.meals || []) {
        if (!meal?.active || meal.empty || !meal.focusId) continue;
        const key = slotKey(day.date, meal.meal);
        if (key === targetKey || state.manualMeals?.[key]?.manualAdded) continue;
        const existing = state.planLocks[key];
        if (existing?.mode === "manual" || existing?.followUpFoodId) continue;
        const snapshot = mealSnapshot(day.date, meal.meal, meal, "auto");
        if (snapshot?.focusId) state.planLocks[key] = snapshot;
      }
    }
  }

  function buildCandidateWithPlanner(focus, date, meal, targetDays, contextDays) {
    const key = slotKey(date, meal);
    const previousLocks = clone(state.planLocks || {});
    const previousOverrides = clone(state.overrides || {});
    const previousExcluded = clone(state.autoLockExcluded || {});
    const previousFollowUps = clone(state.followUps || {});
    try {
      state.planLocks ||= {};
      state.overrides ||= {};
      state.autoLockExcluded ||= {};
      seedVisiblePlannerContext(contextDays, key);
      delete state.planLocks[key];
      delete state.autoLockExcluded[key];
      state.overrides[key] = focus.id;
      // Reine Planner-Berechnung: planDisplayDays persistiert sichtbare Rollover-Snapshots
      // und darf deshalb während der Alternativensuche nicht aufgerufen werden.
      const from = targetDays?.[0]?.date || date;
      const days = buildDays(from, 7, false);
      const generated = targetMealFrom(days, date, meal);
      if (!generated?.active || generated.empty || generated.focusId !== focus.id) return null;
      return clone(generated);
    } finally {
      state.planLocks = previousLocks;
      state.overrides = previousOverrides;
      state.autoLockExcluded = previousExcluded;
      state.followUps = previousFollowUps;
    }
  }

  function mainMealAlternatives(targetDays, contextDays, date, meal, current) {
    const alternatives = [];
    const seen = new Set();
    for (const focus of shuffle(focusPool(current, date, meal, contextDays))) {
      const generated = buildCandidateWithPlanner(focus, date, meal, targetDays, contextDays);
      if (!generated || generated.recipeName) continue;
      if (!learningCandidateCompatible(current, generated, focus.id)) continue;
      if (current.type === "Allergen wiederholen") {
        generated.type = "Allergen wiederholen";
        generated.note = "Allergen mit bekannter Basis gezielt wiederholen.";
      }
      const combination = canonicalCombination(generated.foodIds || []);
      if (!combination || combination === canonicalCombination(current.foodIds || []) || seen.has(combination)) continue;
      seen.add(combination);
      alternatives.push(generated);
      if (alternatives.length >= 12) break;
    }
    return alternatives;
  }

  function automaticRecipeFoodReady(id, date) {
    const item = food(id);
    if (!item || status(item) === "Pausiert") return false;
    if (
      typeof automaticFoodEligibility === "function" &&
      !automaticFoodEligibility(item, date, state.settings || {})
    ) return false;
    if (rank(item) >= 2) return true;
    if (typeof familySuccessfulExposureCount === "function") {
      return familySuccessfulExposureCount(item, state.foods, state.logs, outcomeForFood) >= 1;
    }
    return canCombine(item);
  }

  function reservationContext(days, targetKey) {
    const ctx = freshPlanContext();
    for (const day of days || []) {
      for (const meal of day.meals || []) {
        if (!meal?.active || meal.empty || !meal.focusId) continue;
        if (slotKey(day.date, meal.meal) === targetKey) continue;
        if (mealMilkLevel(meal) === "full") ctx.fullMilkDates?.add(day.date);
        if (meal.recipeName && meal.recipeInventoryId) {
          ctx.recipeReserved?.set(
            meal.recipeName,
            (ctx.recipeReserved?.get(meal.recipeName) || 0) + 1,
          );
        } else {
          for (const id of meal.inventoryFoodIds || []) {
            ctx.inventoryReserved?.set(id, (ctx.inventoryReserved?.get(id) || 0) + 1);
          }
        }
      }
    }
    return ctx;
  }

  function snackAlternatives(days, date, current) {
    const targetKey = slotKey(date, "snack");
    const ctx = reservationContext(days, targetKey);
    const alternatives = [];
    for (const recipe of shuffle(recipeStates())) {
      if (!recipe?.unlocked || recipe.name === current.recipeName) continue;
      if (!recipeSuitableForMeal(recipe, "snack")) continue;
      if (recipe.milkMeal === "full" && recipeContainsMeatOrFish(recipe)) continue;
      if (recipe.milkMeal === "full" && ctx.fullMilkDates?.has(date)) continue;
      const ids = recipeFoodIds(recipe);
      if (!ids.length || !ids.every((id) => automaticRecipeFoodReady(id, date))) continue;
      const generated = buildSnackRecipeMeal(recipe, date, reservationContext(days, targetKey));
      if (!generated) continue;
      if (canonicalCombination(generated.foodIds) === canonicalCombination(current.foodIds)) continue;
      alternatives.push(generated);
      if (alternatives.length >= 12) break;
    }
    return alternatives;
  }

  function randomizePlannedMeal(date, meal) {
    if (!date || !meal || date < today()) return { ok: false, reason: "past" };
    const key = slotKey(date, meal);
    if (state.manualMeals?.[key]?.manualAdded) return { ok: false, reason: "manual-added" };
    if (mealIsCompleted(date, meal)) return { ok: false, reason: "completed" };
    const existingLock = state.planLocks?.[key];
    if (existingLock?.followUpFoodId) {
      showToast("Diese Mahlzeit ist eine geplante Wiedervorlage und wird nicht zufällig ersetzt.");
      return { ok: false, reason: "follow-up" };
    }

    const visibleDays = currentVisiblePlan();
    const targetIsVisible = visibleDays.some((day) => day?.date === date);
    const targetDays = targetPlanWindow(date, visibleDays);
    const contextDays = mergePlanDays(visibleDays, targetDays);
    const current = targetMealFrom(targetDays, date, meal);
    if (!current?.active || current.empty || !current.focusId) {
      showToast("Für diesen Planplatz gibt es gerade keine austauschbare Mahlzeit.");
      return { ok: false, reason: "empty" };
    }

    const dependency = hasFutureLearningDependency(contextDays, date, current);
    const alternatives = meal === "snack"
      ? snackAlternatives(contextDays, date, current)
      : mainMealAlternatives(targetDays, contextDays, date, meal, current);
    const chosen = chooseAlternative(alternatives, otherMealsForSlot(contextDays, key));
    if (!chosen) {
      showToast(
        dependency
          ? "Diese Einführung wird später in der Woche weiterverwendet. Ohne Änderung der Folgetage gibt es gerade keine sichere Alternative."
          : "Für diese Mahlzeit gibt es gerade keine andere passende Alternative.",
      );
      return { ok: false, reason: dependency ? "future-learning-dependency" : "no-alternative" };
    }

    const snapshotFactory = (pinDate, pinMeal, generated, mode) =>
      mealSnapshot(pinDate, pinMeal, generated, mode);
    const completionCheck = (pinDate, pinMeal) => mealIsCompleted(pinDate, pinMeal);

    pinVisibleAutomaticMeals(
      state,
      visibleDays,
      key,
      snapshotFactory,
      completionCheck,
      today(),
    );

    // Liegt der Zieltag außerhalb der aktuell angezeigten Woche (z. B. Heute,
    // während der Wochenplan ab morgen gezeigt wird), bleiben nur die anderen
    // Mahlzeiten dieses Zieltags zusätzlich stabil. Der restliche unsichtbare
    // Zielzeitraum wird nicht künstlich festgeschrieben.
    if (!targetIsVisible) {
      pinVisibleAutomaticMeals(
        state,
        targetDays.filter((day) => day?.date === date),
        key,
        snapshotFactory,
        completionCheck,
        today(),
      );
    }

    const snapshot = mealSnapshot(date, meal, chosen, "auto");
    if (!snapshot) return { ok: false, reason: "snapshot" };
    snapshot[PIN_FLAG] = true;
    snapshot[TARGET_FLAG] = true;
    state.planLocks ||= {};
    state.planLocks[key] = snapshot;
    delete state.overrides?.[key];
    delete state.autoLockExcluded?.[key];
    save();
    renderAll();
    showToast("Mahlzeit getauscht. Der restliche Wochenplan bleibt unverändert.");
    return { ok: true, meal: snapshot };
  }

  const baseEnsureAutoLocks = ensureAutoLocks;
  ensureAutoLocks = function randomSwapAwareEnsureAutoLocks(days) {
    const originalIsAutoLockDate = isAutoLockDate;
    const pinnedDates = new Set(
      Object.entries(state.planLocks || {})
        .filter(([key, lock]) => lock?.[PIN_FLAG] && key.split("|")[0] >= today())
        .map(([key]) => key.split("|")[0]),
    );
    isAutoLockDate = function randomSwapAwareAutoLockDate(date) {
      return pinnedDates.has(date) || originalIsAutoLockDate(date);
    };
    try {
      return baseEnsureAutoLocks(days);
    } finally {
      isAutoLockDate = originalIsAutoLockDate;
    }
  };

  const baseRenderMealCore = renderMealCore;
  renderMealCore = function randomSwapRenderMealCore(day, meal) {
    const html = baseRenderMealCore(day, meal);
    if (
      !html ||
      !day?.date ||
      day.date < today() ||
      !meal?.active ||
      meal.empty ||
      !meal.focusId ||
      meal.manualAdded ||
      mealIsCompleted(day.date, meal.meal) ||
      state.planLocks?.[slotKey(day.date, meal.meal)]?.followUpFoodId ||
      !html.includes('<div class="actionbar">')
    ) return html;

    const button = `<button class="btn secondary randomizeMeal" data-random-date="${esc(day.date)}" data-random-meal="${esc(meal.meal)}">↻ Tauschen</button>`;
    return html.replace(
      '<div class="actionbar">',
      `<div class="actionbar random-swap-actions">${button}`,
    );
  };

  function decorateTodaySwapButtons() {
    const card = document.getElementById("todayCard");
    if (!card) return;
    for (const logButton of card.querySelectorAll(".homeLog[data-plan]")) {
      const box = logButton.closest(".mealbox");
      if (!box || box.querySelector(".randomizeMeal")) continue;
      let payload = null;
      try {
        payload = JSON.parse(decodeURIComponent(logButton.dataset.plan || ""));
      } catch (_error) {
        continue;
      }
      if (!payload?.date || !payload?.meal || payload.date < today()) continue;
      if (state.manualMeals?.[slotKey(payload.date, payload.meal)]?.manualAdded) continue;
      if (state.planLocks?.[slotKey(payload.date, payload.meal)]?.followUpFoodId) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn secondary full randomizeMeal today-randomize-meal";
      button.dataset.randomDate = payload.date;
      button.dataset.randomMeal = payload.meal;
      button.textContent = "↻ Tauschen";
      logButton.before(button);
    }
  }

  const baseRenderHomeCore = renderHomeCore;
  renderHomeCore = function randomSwapRenderHomeCore() {
    const result = baseRenderHomeCore();
    decorateTodaySwapButtons();
    return result;
  };

  const style = document.createElement("style");
  style.id = "planner-random-swap-style";
  style.textContent = `
    .actionbar.random-swap-actions{grid-template-columns:repeat(3,minmax(0,1fr))}
    .actionbar.random-swap-actions .btn{padding-left:8px;padding-right:8px}
    .today-randomize-meal{margin-bottom:8px}
    @media(max-width:380px){
      .actionbar.random-swap-actions{grid-template-columns:1fr 1fr}
      .actionbar.random-swap-actions .randomizeMeal{grid-column:1/-1}
    }
  `;
  document.head.appendChild(style);

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.(".randomizeMeal");
    if (!button) return;
    event.preventDefault();
    randomizePlannedMeal(button.dataset.randomDate, button.dataset.randomMeal);
  });

  globalScope.__plannerRandomSwap = Object.freeze({ ...API, randomizePlannedMeal });
})(typeof globalThis !== "undefined" ? globalThis : this);