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
        const stillSamples = new Set(meal.sampleFoodIds || []);
        return [...samples].some((id) => used.includes(id) && !stillSamples.has(id));
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
        if (data.manualMeals?.[key]?.manualAdded || data.autoLockExcluded?.[key]) continue;
        const existing = data.planLocks?.[key];
        if (existing?.followUpFoodId || existing?.mode === "manual" || existing?.[PIN_FLAG]) continue;
        const snapshot = snapshotFactory(day.date, meal.meal, meal, "auto");
        if (!snapshot?.focusId) continue;
        snapshot.mode = "auto";
        snapshot[PIN_FLAG] = true;
        snapshot[PRESERVE_FLAG] = true;
        data.planLocks[key] = snapshot;
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
    chooseAlternative,
    pinVisibleAutomaticMeals,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Object.freeze({ ...API });
  if (typeof window === "undefined" || typeof document === "undefined") return;

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
        if (meal.focusId) {
          ctx.plannedUse?.set(meal.focusId, (ctx.plannedUse?.get(meal.focusId) || 0) + 1);
          ctx.lastFocus?.set(meal.focusId, day.date);
        }
      }
    }
    return ctx;
  }

  function currentVisiblePlan() {
    const from = typeof visiblePlanStart === "function"
      ? visiblePlanStart()
      : state.settings?.planFrom || today();
    return typeof planDisplayDays === "function"
      ? planDisplayDays(from, 7)
      : buildDays(from, 7);
  }

  function targetMealFrom(days, date, meal) {
    return (days || [])
      .find((day) => day?.date === date)
      ?.meals?.find((entry) => entry?.meal === meal) || null;
  }

  function randomSwapFocusPool(current, date, meal, days) {
    const pool = (state.foods || []).filter((item) => eligible(item, meal, date));
    const dependency = hasFutureLearningDependency(days, date, current);
    if (dependency) return pool.filter((item) => item.id === current.focusId);

    if (current.type === "Allergen wiederholen") {
      return pool.filter((item) => dueAllergen(item, date));
    }

    const isLearning = (current.sampleFoodIds || []).length > 0;
    if (isLearning) {
      if (current.type === "gezielt wiederholen") {
        return pool.filter((item) => rank(item) === 1 || lastOutcome(item.id) === "not_accepted");
      }
      if (current.type === "Allergen einführen") {
        return pool.filter((item) => rank(item) === 0 && item.allergenGroup && !!knownBase(meal, [item.id]));
      }
      if (current.type === "neu") {
        return pool.filter((item) => rank(item) === 0 && !item.allergenGroup);
      }
      return pool.filter((item) => !isTrustedBase(item));
    }

    return pool.filter((item) => canCombine(item));
  }

  function randomSwapTypeForFood(item, current, date, meal, ctx) {
    if (current.type === "Allergen wiederholen" && dueAllergen(item, date)) return "Allergen wiederholen";
    if ((current.sampleFoodIds || []).length) {
      if (rank(item) === 0) return item.allergenGroup ? "Allergen einführen" : "neu";
      if (rank(item) === 1 || lastOutcome(item.id) === "not_accepted") {
        return eatenExposureCount(item.id) >= 1 ? "bekannt kombinieren" : "gezielt wiederholen";
      }
      return "manuell";
    }
    const reserved = ctx.inventoryReserved?.get(item.id) || 0;
    if (state.settings?.preferInventoryInPlan && inventoryPortions(item.id) > reserved) return "bekannt / Vorrat";
    return isTrustedBase(item) ? "bekannt / Vorrat" : "bekannt kombinieren";
  }

  function buildFoodSwapCandidate(item, type, date, meal, ctx) {
    let focus = item;
    let focusType = type;
    let introduction = ["neu", "gezielt wiederholen", "Allergen einführen", "Allergen wiederholen", "manuell"]
      .includes(focusType) && !isTrustedBase(focus);
    let base = companionFor(focus, meal, date, focusType);
    let companions = enforceSingleStarch(focus, base ? [base] : []);
    let ids = introduction ? companions.map((entry) => entry.id) : [focus.id, ...companions.map((entry) => entry.id)];
    if (introduction && !ids.includes(focus.id)) ids.push(focus.id);

    const iron = introduction ? null : ironCompanion(focus, meal, date, ids);
    if (
      iron &&
      !ids.includes(iron.id) &&
      !(isStarchyFood(iron) && ids.some((id) => isStarchyFood(food(id))))
    ) ids.push(iron.id);

    if (combinationPaused(ids, date)) {
      const alternatives = (state.foods || [])
        .filter((candidate) =>
          eligible(candidate, meal, date) &&
          isTrustedBase(candidate) &&
          candidate.id !== focus.id &&
          !companions.some((entry) => entry.id === candidate.id),
        )
        .filter((candidate) => !combinationPaused([candidate.id, focus.id], date))
        .filter((candidate) => !(isStarchyFood(candidate) && isStarchyFood(focus)))
        .sort((a, b) => usageCount(a.id) - usageCount(b.id) || a.priority - b.priority);
      if (introduction && alternatives.length) {
        companions = [alternatives[0]];
        ids = [alternatives[0].id, focus.id];
      } else {
        const fallback = knownBase(meal, [focus.id]);
        if (fallback) {
          focus = fallback;
          focusType = "bekannt";
          ids = [fallback.id];
          companions = [];
          introduction = false;
        } else {
          ids = [focus.id];
          companions = [];
        }
      }
    }

    const optionalAddons = [];
    const level = typeof currentAmountLevel === "function" ? currentAmountLevel() : "taste";
    const amountRank = AMOUNT_LEVELS?.[level]?.rank || 0;
    if (!introduction && meal !== "breakfast" && amountRank >= 1 && !mealContainsMilkProduct(ids)) {
      const oil = food("rapsoel");
      if (oil?.active) optionalAddons.push(oil.id);
    }
    const baseFoodIds = introduction ? companions.map((entry) => entry.id) : ids.filter((id) => id !== focus.id);
    const sampleFoodIds = introduction ? [focus.id] : [];
    const note = focusType === "neu"
      ? "Neue Einführung separat oder in kleiner Menge mit der sicheren Basis anbieten."
      : focusType === "gezielt wiederholen"
        ? "Wiederholung nach Pause erneut klein und getrennt bewerten."
        : focusType === "Allergen wiederholen"
          ? "Allergen mit bekannter Basis gezielt wiederholen."
          : "Bekannte Lebensmittel sinnvoll rotieren; Vorrat bevorzugt nutzen.";
    const generated = applyPlannedMealAmounts({
      meal,
      active: true,
      focusId: focus.id,
      foodIds: ids,
      baseFoodIds,
      sampleFoodIds,
      optionalAddons,
      milkMeal: mealContainsMilkProduct(ids) ? (introduction ? "small" : "full") : "",
      type: focusType,
      note,
    });
    if (mealMilkLevel(generated) === "full" && ctx.fullMilkDates?.has(date)) return null;
    reserveMealInventory(generated, ctx);
    return generated;
  }

  function foodSwapAlternatives(days, date, meal, current) {
    const targetKey = slotKey(date, meal);
    const result = [];
    for (const item of randomSwapFocusPool(current, date, meal, days)) {
      const ctx = reservationContext(days, targetKey);
      const type = randomSwapTypeForFood(item, current, date, meal, ctx);
      const generated = buildFoodSwapCandidate(item, type, date, meal, ctx);
      if (!generated?.focusId) continue;
      if (canonicalCombination(generated.foodIds) === canonicalCombination(current.foodIds)) continue;
      result.push(generated);
    }
    return result;
  }

  function snackSwapAlternatives(days, date, current) {
    const targetKey = slotKey(date, "snack");
    const baseCtx = reservationContext(days, targetKey);
    return recipeStates()
      .filter((recipe) =>
        recipe.unlocked &&
        recipeSuitableForMeal(recipe, "snack") &&
        !(recipe.milkMeal === "full" && recipeContainsMeatOrFish(recipe)) &&
        !(recipe.milkMeal === "full" && baseCtx.fullMilkDates?.has(date)) &&
        recipe.name !== current.recipeName,
      )
      .map((recipe) => buildSnackRecipeMeal(recipe, date, reservationContext(days, targetKey)))
      .filter(Boolean)
      .filter((entry) => canonicalCombination(entry.foodIds) !== canonicalCombination(current.foodIds));
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

    const days = currentVisiblePlan();
    const current = targetMealFrom(days, date, meal);
    if (!current?.active || current.empty || !current.focusId) {
      showToast("Für diesen Planplatz gibt es gerade keine austauschbare Mahlzeit.");
      return { ok: false, reason: "empty" };
    }

    const dependency = hasFutureLearningDependency(days, date, current);
    const alternatives = meal === "snack"
      ? snackSwapAlternatives(days, date, current)
      : foodSwapAlternatives(days, date, meal, current);
    const chosen = chooseAlternative(alternatives, otherMealsForSlot(days, key));
    if (!chosen) {
      showToast(
        dependency
          ? "Diese Einführung wird später in der Woche weiterverwendet. Ohne Änderung der Folgetage gibt es gerade keine sichere Alternative."
          : "Für diese Mahlzeit gibt es gerade keine andere passende Alternative.",
      );
      return { ok: false, reason: dependency ? "future-learning-dependency" : "no-alternative" };
    }

    pinVisibleAutomaticMeals(
      state,
      days,
      key,
      (pinDate, pinMeal, generated, mode) => mealSnapshot(pinDate, pinMeal, generated, mode),
      (pinDate, pinMeal) => mealIsCompleted(pinDate, pinMeal),
      today(),
    );

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
    let html = baseRenderMealCore(day, meal);
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

  const style = document.createElement("style");
  style.id = "planner-random-swap-style";
  style.textContent = `
    .actionbar.random-swap-actions{grid-template-columns:repeat(3,minmax(0,1fr))}
    .actionbar.random-swap-actions .btn{padding-left:8px;padding-right:8px}
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
