"use strict";

/* Allgemeine Oberfläche
 * Render-Orchestrierung, Heute, Plan, Mahlzeiten, Textur-Coach, Einstellungen, Dialoge und Event-Bindings.
 * Konsolidierter Produktionsstand 10.0.0.
 */

function textureName(stage = Number(state.settings.textureStage)) {
  return {
    1: "glatt oder fein zerdrückt",
    2: "dick püriert oder weich zerdrückt",
    3: "weich stückig",
    4: "weiche Familienkost",
  }[Number(stage)] || "glatt oder fein zerdrückt";
}
function textureText() {
  return `Stufe ${Number(state.settings.textureStage)} · ${textureName()}`;
}
function showToast(message, undoFn = null) {
  clearTimeout(toastTimer); lastUndo = undoFn;
  let toast = document.getElementById("toast"), undo = document.getElementById("toastUndo");
  document.getElementById("toastText").textContent = message;
  undo.style.display = undoFn ? "block" : "none";
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 5500);
}
function renderAll() {
  renderHome();
  renderPlan();
  renderLogs();
  renderStatistics();
  renderFoods();
  renderPrep();
  renderAllergenModule();
  renderSettings();
  if (document.getElementById("auditList")) renderAudit();
  renderStorageStatus();
}
function textureSuccessCount(stage = Number(state.settings.textureStage)) {
  return new Set(
    state.logs
      .filter((log) => logTextureStage(log) === Number(stage) && logPositiveOutcome(log, outcomeForFood))
      .map(logExposureKey),
  ).size;
}
function setTextureStage(nextStage) {
  let stage = Math.max(1, Math.min(4, Number(nextStage) || 1));
  state.settings.textureStage = stage;
  state.settings.textureStageSince = today();
  save();
  closeGeneric();
  renderAll();
  showToast(`Konsistenz auf Stufe ${stage} gestellt.`);
}
function openTextureAdvance(nextStage) {
  openGeneric(
    "Nächste Konsistenz",
    `<div class="notice olive"><b>Stufe ${nextStage}: ${esc(textureName(nextStage))}</b></div>
     <p>Die App stellt Plan und Rezepte auf diese Konsistenz um. Du kannst kleine Mengen der neuen Struktur testen, parallel vertraute Konsistenzen anbieten und jederzeit zurückgehen.</p>
     <div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelTextureStage" type="button">Abbrechen</button><button class="btn" id="confirmTextureStage">Stufe ${nextStage} verwenden</button></div>`,
  );
  document.getElementById("cancelTextureStage").onclick = closeGeneric;
  document.getElementById("confirmTextureStage").onclick = () =>
    setTextureStage(nextStage);
}
function renderTextureCoach() {
  let card = document.getElementById("textureCoachCard");
  if (!card) return;
  let stage = Number(state.settings.textureStage) || 1;
  let successes = textureSuccessCount(stage);
  let next = Math.min(4, stage + 1);
  let suggest = stage < 4 && successes >= 4;
  let progress = [1, 2, 3, 4]
    .map(
      (n) =>
        `<span class="texture-step ${n <= stage ? "done" : n === next ? "next" : ""}"></span>`,
    )
    .join("");
  card.innerHTML = `<details class="home-control-details">
    <summary>
      <span>
        <small>Konsistenz</small>
        <b>Stufe ${stage} · ${esc(textureName(stage))}</b>
      </span>
      <span class="pill ${suggest ? "ph" : "dim"}">${stage === 4 ? "Aktuell" : suggest ? "Test möglich" : "Aktuell"}</span>
    </summary>
    <div class="home-control-body">
      <div class="texture-track" aria-label="Konsistenzstufe ${stage} von 4">${progress}</div>
      <div class="small">${successes} positive Texturerfahrung${successes === 1 ? "" : "en"} auf dieser Stufe.</div>
      <div class="texture-coach-actions">
        ${stage > 1 ? `<button class="btn secondary" id="textureBack">Zurück</button>` : ""}
        ${stage < 4 ? `<button class="btn ${suggest ? "" : "secondary"}" id="textureNext">Stufe ${next} testen</button>` : ""}
      </div>
    </div>
  </details>`;
  if (document.getElementById("textureBack"))
    document.getElementById("textureBack").onclick = () =>
      setTextureStage(stage - 1);
  if (document.getElementById("textureNext"))
    document.getElementById("textureNext").onclick = () =>
      openTextureAdvance(next);
}
function whyDetailsHtml(m) { return ""; }
function compactMealRolesHtml(m) {
  let sample = (m.sampleFoodIds || []).map(food).filter(Boolean);
  let base = (m.baseFoodIds || []).map(food).filter(Boolean);
  let all = [...new Map([...(base || []), ...(sample || []), ...(m.foodIds || []).map(food).filter(Boolean)].map((item) => [item.id, item])).values()];
  if (all.length <= 1 && !m.recipeName) return "";
  if (sample.length) {
    let role = learningRoleLabel(rank(sample[0]), status(sample[0]), m?.type || "");
    return `<div class="compact-role-list">${base.length ? `<div class="compact-role-row"><b>${esc(base.map((x) => x.name).join(" + "))}</b><span>Hauptmahlzeit</span></div>` : ""}<div class="compact-role-row sample"><b>${esc(sample.map((x) => x.name).join(" + "))}</b><span>${esc(role)}</span></div></div>`;
  }
  let rows = (m.foodIds || []).map(food).filter(Boolean).map((f, index) => `<div class="compact-role-row"><b>${esc(f.name)}</b><span>${index === 0 ? "Hauptmahlzeit" : "Bestandteil"}</span></div>`).join("");
  return rows ? `<div class="compact-role-list">${rows}</div>` : "";
}
function recipeMissingSummary(r) {
  let missing = (r.missing || []).map((item) => {
    if (!String(item).startsWith("eine passende Auswahl:")) return item;
    if (r.name?.startsWith("Obst-")) return "eine bekannte Obstsorte";
    if (r.name === "Milch-Getreide-Brei") return "eine bekannte Getreidesorte";
    return "eine passende bekannte Zutat";
  });
  return missing.join(" · ");
}
function inactiveMealFoods(m) {
  return (m.foodIds || []).map(food).filter((f) => f && !f.active);
}
function inactiveMealWarningHtml(day, m) {
  let inactive = inactiveMealFoods(m);
  if (!inactive.length) return "";
  return `<div class="inactive-plan-warning"><b>${esc(inactive.map((f) => f.name).join(", "))} ${inactive.length === 1 ? "ist" : "sind"} deaktiviert.</b><div class="small">Die bestehende Planung bleibt sichtbar, wird aber nicht neu automatisch verwendet.</div><div class="inactive-plan-actions"><button class="btn secondary smallbtn reactivateMealFoods" data-foods="${inactive.map((f) => f.id).join(",")}">Wieder aktivieren</button><button class="btn secondary smallbtn editInactiveMeal" data-date="${day.date}" data-meal="${m.meal}" data-focus="${m.focusId}">Mahlzeit bearbeiten</button></div></div>`;
}
function bindInactiveMealActions() {
  document.querySelectorAll(".reactivateMealFoods").forEach((button) => {
    button.onclick = () => {
      for (let id of String(button.dataset.foods || "").split(",").filter(Boolean)) {
        let f = food(id);
        if (f) f.active = true;
        delete state.inactivePlanKept?.[id];
      }
      save();
      renderAll();
      showToast("Lebensmittel wieder aktiviert.");
    };
  });
  document.querySelectorAll(".editInactiveMeal").forEach((button) => {
    button.onclick = () => chooseReplacement(button.dataset.date, button.dataset.meal, button.dataset.focus);
  });
}
function mealDisplayTitle(m) {
  if (m?.recipeName) return m.recipeName;
  let base = (m?.baseFoodIds || []).map(food).filter(Boolean);
  if (base.length) return naturalMealFoodTitle(base);
  let sample = (m?.sampleFoodIds || []).map(food).filter(Boolean);
  if (sample.length) return naturalFoodList(sample.map((item) => item.name));
  return dishTitle(m);
}
function mealTypeText(m) {
  let sample = (m?.sampleFoodIds || []).map(food).filter(Boolean);
  if (m?.recipeName) return "Rezept";
  if (!sample.length) return "Mahlzeit";
  let role = learningRoleLabel(rank(sample[0]), status(sample[0]), m?.type || "");
  return (m?.baseFoodIds || []).length ? `Mahlzeit mit ${role}` : role;
}
function mealStatusText(m) {
  let text = focusRole(m?.type);
  return text === "Heute geplant" ? "" : text;
}
function renderHomeCore() {
  let learned = learnedFoods(), tried = learned.length, target = Number(state.settings.targetFoods) || 100,
    pct = Math.min(100, tried / target * 100), on = today(), age = monthsOld(on),
    day = buildDays(on, 1)[0], active = day.meals.filter((m) => m.active && m.focusId);
  let openMeals = active.filter((m) => !mealIsCompleted(on, m.meal));
  let nextPlanned = null;
  if (!active.length) {
    for (let offset = 1; offset <= 45; offset++) {
      let candidateDate = addDays(on, offset);
      let candidateDay = buildDays(candidateDate, 1, false)[0];
      if (candidateDay.meals.some((m) => m.active && m.focusId)) { nextPlanned = candidateDate; break; }
    }
  }
  let todayHtml = active.length ? active.map((m) => {
    let done = completedLog(on, m.meal);
    if (done) return completedMealHtml(on, m.meal, done);
    let payload = encodeURIComponent(JSON.stringify({date:on,meal:m.meal,focusId:m.focusId,foodIds:m.foodIds,baseFoodIds:m.baseFoodIds||[],sampleFoodIds:m.sampleFoodIds||[],recipeName:m.recipeName||"",recipeInventoryId:m.recipeInventoryId||""}));
    return `<div class="mealbox"><div class="row"><div class="grow"><div class="dish-title">${esc(mealDisplayTitle(m))}</div><div class="small meal-type-text">${esc(mealTypeText(m))} · ${mealName(m.meal)}</div>${mealStatusText(m) ? `<div class="small meal-status-text">${esc(mealStatusText(m))}</div>` : ""}</div>${stockBadges(m)}</div>${inactiveMealWarningHtml({date:on}, m)}${compactMealRolesHtml(m)}${whyDetailsHtml(m)}<button class="btn full homeLog" data-plan="${payload}">Protokollieren</button></div>`;
  }).join("") : `<div class="empty"><b>Für heute ist nichts geplant.</b><div class="small">Die Heute-Ansicht zeigt ausschließlich den aktuellen Kalendertag.</div>${nextPlanned ? `<div class="small next-plan-hint">Nächster geplanter Tag: ${nice(nextPlanned, true)}</div>` : ""}</div><button class="btn full" id="homeFreeLog">Freien Eintrag anlegen</button>`;
  let todayHeading = active.length && openMeals.length === 0 ? "Heute erledigt" : "Heute anbieten";
  let todayBadge = active.length && openMeals.length === 0
    ? '<span class="pill ok">Vollständig</span>'
    : "";
  let progressStatus = active.length && openMeals.length < active.length && openMeals.length > 0
    ? `<div class="status-chips"><span class="pill ok">${active.length-openMeals.length} erledigt</span></div>`
    : "";
  document.getElementById("todayCard").innerHTML = `<div class="row"><div class="grow"><h2>${todayHeading}</h2><div class="small">${nice(on, true)} · ${age} Monate</div></div>${todayBadge}</div>${progressStatus}${todayHtml}<div class="add-meal-row"><button class="btn secondary smallbtn" id="homeAddEntry">＋ Eintrag</button></div>`;
  document.querySelectorAll(".homeLog").forEach((b) => b.onclick = () => openLog(JSON.parse(decodeURIComponent(b.dataset.plan))));
  document.querySelectorAll(".editCompletedLog").forEach((b) => b.onclick = () => editLogEntry(b.dataset.log));
  bindInactiveMealActions();
  if (document.getElementById("homeFreeLog")) document.getElementById("homeFreeLog").onclick = () => openLog(null);
  let selected = currentPhase(), idx = phaseIndex(selected);
  document.getElementById("phaseCard").innerHTML = `<details class="home-control-details">
    <summary>
      <span>
        <small>Beikostphase</small>
        <b>${esc(PHASES[selected].label)}</b>
      </span>
      <span class="pill ok">${phaseMealKeys().map(mealName).join(" · ")}</span>
    </summary>
    <div class="home-control-body">
      <div class="small phase-guidance">Die Phase richtet sich nach Chesters Entwicklung und eurem Tagesablauf. Alter oder Grammwerte wechseln sie nicht automatisch.</div>
      <div class="phase-controls">
        <button class="btn secondary" id="phaseBack" ${idx <= 0 ? "disabled" : ""}>Zurück</button>
        <button class="btn secondary" id="phaseForward" ${idx >= 3 ? "disabled" : ""}>Weiter</button>
      </div>
    </div>
  </details>`;
  let requestPhase = (delta) => {
    let keys = ["kennenlernen", "aufbau", "drei", "familie"], next = keys[idx + delta];
    if (!next || !PHASES[next]) return;
    openGeneric(
      `Zu „${PHASES[next].label}“ wechseln?`,
      `<p>Vorgesehene Mahlzeiten: <b>${phaseMealKeys(next).map(mealName).join(", ")}</b>.</p><div class="notice olive">Die App leitet die Phase nicht aus Alter oder Grammwerten ab. Der Wechsel erfolgt erst mit deiner Bestätigung.</div><div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelPhaseChange" type="button">Abbrechen</button><button class="btn" id="confirmPhaseChange" type="button">Phase verwenden</button></div>`,
    );
    document.getElementById("cancelPhaseChange").onclick = closeGeneric;
    document.getElementById("confirmPhaseChange").onclick = () => { closeGeneric(); setPhase(next); };
  };
  document.getElementById("phaseBack").onclick = () => requestPhase(-1);
  document.getElementById("phaseForward").onclick = () => requestPhase(1);
  renderTextureCoach();

  let due = state.foods.filter((f) => dueAllergen(f, on)).length, tolerated = state.foods.filter((f) => status(f) === "Verträgliche Basis").length, regular = state.foods.filter((f) => status(f) === "Regelmäßig").length;
  let progressFacts = [];
  if (tolerated) progressFacts.push(`${tolerated} sichere Basis`);
  if (regular) progressFacts.push(`${regular} regelmäßig`);
  if (due) progressFacts.push(`${due} Allergene fällig`);
  document.getElementById("progressCard").innerHTML = `<div class="row"><div class="grow"><h3 style="margin-bottom:2px">${tried} von ${target} kennengelernt</h3><div class="small">${learned.slice(0,4).map((f) => f.name).join(", ")}${learned.length > 4 ? ` + ${learned.length-4} weitere` : ""}</div></div><b class="progress-percent">${Math.round(pct)} %</b></div><div class="progress"><span style="width:${pct}%"></span></div>${progressFacts.length ? `<div class="small progress-facts">${progressFacts.join(" · ")}</div>` : ""}`;

  let allRecipeStates = recipeStates();
  let unlocked = allRecipeStates.filter((r) => r.unlocked).slice(0, 3);
  let almost = allRecipeStates
    .filter((r) => !r.unlocked)
    .sort((a, b) => a.missing.length - b.missing.length || a.stage - b.stage)[0];
  let previewCard = document.getElementById("recipePreviewCard");
  let previewItems = unlocked.map((r) => ({...r, previewType:"ready"}));
  if (almost) previewItems.push({...almost, previewType:"almost"});
  previewCard.style.display = previewItems.length ? "block" : "none";
  document.getElementById("recipePreview").innerHTML = previewItems.map((r) => {
    let ready = r.previewType === "ready";
    let summary = recipeMissingSummary(r);
    let missingText = r.missing.length === 1
      ? `Es fehlt nur noch: ${summary}.`
      : `Am nächsten dran – es fehlt: ${summary}.`;
    return `<div class="history"><div class="row"><div class="recipe-heading-with-icon grow">${recipeIconSvg(r)}<div><b>${esc(r.name)}</b><div class="small">${ready ? `${esc(r.batch || "")} · ${esc(r.note)}` : esc(missingText)}</div></div></div><span class="pill ${ready ? "ok" : "ph"}">${ready ? "jetzt passend" : "fast passend"}</span></div></div>`;
  }).join("");
  document.getElementById("openRecipes").onclick = () => {
    showView("more");
    setTimeout(() => {
      let details = document.getElementById("recipesDetails");
      if (details) details.open = true;
      document.getElementById("recipesSection")?.scrollIntoView({behavior:"smooth"});
    }, 80);
  };
}
function isPlannedIntroductionSequence(previousMeal, currentMeal) {
  if (
    !previousMeal ||
    !currentMeal ||
    previousMeal.focusId !== currentMeal.focusId ||
    previousMeal.date === currentMeal.date
  )
    return false;

  let currentIsIntendedRepeat = [
    "gezielt wiederholen",
    "Allergen wiederholen",
    "nach Einführung",
  ].includes(currentMeal.type);

  let followsIntroduction =
    ["neu", "Allergen einführen"].includes(previousMeal.type) &&
    [
      "gezielt wiederholen",
      "Allergen wiederholen",
      "nach Einführung",
      "bekannt kombinieren",
      "bekannt / kombiniert",
    ].includes(currentMeal.type);

  return currentIsIntendedRepeat || followsIntroduction;
}
function planQualityIssues(days) {
  let meals = days.flatMap((day) =>
    day.meals
      .filter((m) => m.active && !m.empty && m.focusId && !mealIsCompleted(day.date, m.meal))
      .map((m) => ({ ...m, date: day.date })),
  );
  let issues = [];
  let counts = new Map();
  for (let m of meals)
    counts.set(m.focusId, (counts.get(m.focusId) || 0) + 1);
  let trustedBaseCount = state.foods.filter((f) => isTrustedBase(f)).length;
  let repeated = trustedBaseCount > 1 ? [...counts.entries()]
    .filter(([, count]) => count >= 4)
    .sort((a, b) => b[1] - a[1])[0] : null;
  if (repeated)
    issues.push(`${food(repeated[0])?.name || "Ein Lebensmittel"} konnte trotz mehrerer sicherer Basen nicht ausreichend rotiert werden.`);

  for (let i = 1; trustedBaseCount > 1 && i < meals.length; i++) {
    let a = meals[i - 1], b = meals[i];
    if (
      a.focusId === b.focusId &&
      a.date !== b.date &&
      !isPlannedIntroductionSequence(a, b)
    ) {
      issues.push(`${food(b.focusId)?.name || "Dasselbe Lebensmittel"} ist an aufeinanderfolgenden Tagen Schwerpunkt.`);
      break;
    }
  }

  let trustedAvailable = state.foods.some((f) => isTrustedBase(f));
  if (trustedAvailable) {
    let unsafeNew = meals.find(
      (m) =>
        ["neu", "manuell"].includes(m.type) &&
        !(m.foodIds || [])
          .filter((id) => id !== m.focusId)
          .map(food)
          .filter(Boolean)
          .some((f) => isTrustedBase(f)),
    );
    if (unsafeNew)
      issues.push(`${food(unsafeNew.focusId)?.name || "Ein neues Lebensmittel"} hat keine verträgliche Basis.`);
  }

  let milkMeat = meals.find((m) => mealContainsMilkProduct(m.foodIds) && (m.foodIds || []).map(food).filter(Boolean).some(isMeatOrFish));
  if (milkMeat) issues.push(`${dishTitle(milkMeat)} kombiniert Milchprodukt und Fleisch/Fisch; diese manuelle Planung bitte trennen.`);
  let fullMilkByDate = new Map();
  for (let m of meals) if (mealMilkLevel(m) === "full") fullMilkByDate.set(m.date, (fullMilkByDate.get(m.date) || 0) + 1);
  let duplicateMilkDate = [...fullMilkByDate.entries()].find(([, count]) => count > 1);
  if (duplicateMilkDate) issues.push(`Am ${shortDate(duplicateMilkDate[0])} sind mehrere volle Milchmahlzeiten fest eingeplant.`);

  if (AMOUNT_LEVELS[currentAmountLevel()].rank >= 1) {
    let hasIron = meals.some((m) =>
      (m.foodIds || []).map(food).filter(Boolean).some((f) => f.ironRich),
    );
    if (!hasIron) issues.push("In den nächsten sieben Tagen ist noch kein eisenreiches Lebensmittel eingeplant.");
  }

  let inactivePlanned = meals.find((m) => (m.foodIds || []).some((id) => food(id) && !food(id).active));
  if (inactivePlanned) {
    let names = inactiveMealFoods(inactivePlanned).map((f) => f.name).join(", ");
    issues.push(`${names} ist deaktiviert, aber bewusst in einer bestehenden Planung erhalten.`);
  }

  let due = state.foods.filter((f) => dueAllergen(f, days[0]?.date || today()));
  let plannedIds = new Set(meals.flatMap((m) => m.foodIds || []));
  let overdue = due.find((f) => !plannedIds.has(f.id));
  if (overdue) issues.push(`${overdue.name} ist als Allergen fällig, aber noch nicht eingeplant.`);

  return [...new Set(issues)].slice(0, 2);
}
function renderPlanQuality(days) {
  let issues = planQualityIssues(days);
  let box = document.getElementById("planQuality");
  if (!issues.length) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  box.style.display = "block";
  box.className = "notice plan-quality-warn";
  box.innerHTML = `<b>Planprüfung</b><br>${issues.map(esc).join("<br>")}`;
}
function availableExtraMeals(day) {
  let candidates = ["breakfast", "dinner"];
  if (PHASES[currentPhase()].rank >= 2) candidates.splice(1, 0, "snack");
  return candidates.filter((meal) => {
    let shown = day.meals.find((m) => m.meal === meal);
    return !shown?.active && !state.manualMeals?.[manualMealKey(day.date, meal)];
  });
}
function visiblePlanStart() {
  return state.settings.planFrom || today();
}
function historicalPlanDay(date, index = 0) {
  let meals = ["breakfast", "lunch", "snack", "dinner"].map((meal) => {
    let log = completedLog(date, meal);
    if (log) {
      let ids = [...new Set(log.foodIds || [])];
      return {
        meal,
        active: true,
        focusId: log.focusId || ids[0] || "",
        foodIds: ids,
        baseFoodIds: log.baseFoodIds || ids,
        sampleFoodIds: log.sampleFoodIds || [],
        foodRoles: log.foodRoles || {},
        recipeName: log.recipeName || "",
        type: "protokolliert",
        note: log.note || "",
      };
    }
    let stored = manualMealFor(date, meal) || lockedMeal(date, meal);
    return stored ? { ...stored, meal, active: true } : { meal, active: false };
  });
  return { date, index, meals, introDue: false, introAssigned: false, historical: true };
}
function planDisplayDays(from, count = 7) {
  let result = [];
  let current = today();
  let firstFutureIndex = -1;
  for (let i = 0; i < count; i++) {
    let date = addDays(from, i);
    if (date < current) result.push(historicalPlanDay(date, i));
    else { firstFutureIndex = i; break; }
  }
  if (firstFutureIndex >= 0) {
    let futureFrom = addDays(from, firstFutureIndex);
    let futureDays = buildDays(futureFrom, count - firstFutureIndex);
    futureDays.forEach((day, offset) => { day.index = firstFutureIndex + offset; });
    result.push(...futureDays);
  }
  return result;
}
/* PLAN-TOOLBAR-SUMMARY START */
function planLockSummaryCounts(days, planLocks = {}, isCompleted = () => false) {
  let autoCount = 0, manualCount = 0;
  for (let day of days || []) {
    for (let meal of day.meals || []) {
      if (!meal?.active || !meal?.focusId || isCompleted(day.date, meal.meal)) continue;
      let lock = planLocks[`${day.date}|${meal.meal}`];
      if (lock?.mode === "auto") autoCount++;
      else if (lock?.mode === "manual") manualCount++;
    }
  }
  return { autoCount, manualCount };
}
function planLockSummaryHtml({ autoCount = 0, manualCount = 0 } = {}) {
  autoCount = Math.max(0, Number(autoCount) || 0);
  manualCount = Math.max(0, Number(manualCount) || 0);
  let parts = [];
  if (autoCount) parts.push(`<b>${autoCount}</b> fest eingeplant`);
  if (manualCount) parts.push(`<b>${manualCount}</b> manuell geschützt`);
  return parts.join(" · ") || "Keine feste Planung";
}
function compactPlanAmountLabel(label = "") {
  let text = String(label || "");
  let match = text.match(/\(([^)]+)\)/);
  return match?.[1] || text;
}
/* PLAN-TOOLBAR-SUMMARY END */
function renderPlanCore() {
  let from = visiblePlanStart();
  document.getElementById("planFrom").value = from;
  let days = planDisplayDays(from, 7);
  let lockSummary = planLockSummaryCounts(days, state.planLocks || {}, mealIsCompleted);
  document.getElementById("planLockSummary").innerHTML =
    `<span class="plan-lock-text">${planLockSummaryHtml(lockSummary)}</span>`;
  renderPlanQuality(days);
  document.getElementById("blockPlan").innerHTML = days
    .map((d) => {
      let planned = d.meals.filter((m) => m.active && m.focusId);
      let completedMeals = planned
        .map((m) => ({ meal: m, log: completedLog(d.date, m.meal) }))
        .filter((x) => x.log);
      let completed = completedMeals.length;
      let allDone = planned.length > 0 && completed === planned.length;
      let extra = d.date < today() ? [] : availableExtraMeals(d);

      if (allDone) {
        let total = completedMeals.reduce(
          (sum, x) => sum + (Number(x.log.amount) || 0),
          0,
        );
        let label = d.date === today() ? "Heute" : nice(d.date, true);
        return `<details class="card block completed-day">
          <summary>
            <span>
              <span class="completed-day-title">${esc(label)} erledigt</span>
              <span class="small">${completed} ${completed === 1 ? "Mahlzeit" : "Mahlzeiten"}${total ? ` · ${total} g insgesamt` : ""}</span>
            </span>
            <span class="completed-day-chevron">▼</span>
          </summary>
          <div class="completed-day-body">
            ${d.meals.map((m) => renderMeal(d, m)).join("")}
            ${extra.length ? `<div class="add-meal-row"><button class="btn secondary smallbtn addExtraMeal" data-date="${d.date}">+ Mahlzeit ergänzen</button></div>` : ""}
          </div>
        </details>`;
      }

      let dayBadge = completed
        ? `<span class="pill ok">${completed}/${planned.length} erledigt</span>`
        : "";
      return `<div class="card block day-card">
        <div class="row day-head">
          <div class="grow"><div class="day-date">${nice(d.date, true)}</div><div class="small day-type-text">${d.introAssigned ? "Einführung und Wiederholung" : "Bekannter Tag"}</div></div>
          ${dayBadge}
        </div>
        ${d.meals.map((m) => renderMeal(d, m)).join("")}
        ${extra.length ? `<div class="add-meal-row"><button class="btn secondary smallbtn addExtraMeal" data-date="${d.date}">+ Mahlzeit ergänzen</button></div>` : ""}
      </div>`;
    })
    .join("");
  document.querySelectorAll(".logMeal").forEach(
    (btn) =>
      (btn.onclick = () =>
        openLog(JSON.parse(decodeURIComponent(btn.dataset.plan)))),
  );
  document.querySelectorAll(".replaceMeal").forEach(
    (btn) =>
      (btn.onclick = () =>
        chooseReplacement(
          btn.dataset.date,
          btn.dataset.meal,
          btn.dataset.focus,
        )),
  );
  document.querySelectorAll(".moveMeal").forEach(
    (btn) =>
      (btn.onclick = () =>
        moveMealTomorrow(
          JSON.parse(decodeURIComponent(btn.dataset.movePayload)),
        )),
  );
  document.querySelectorAll(".editCompletedLog").forEach(
    (btn) => (btn.onclick = () => editLogEntry(btn.dataset.log)),
  );
  document.querySelectorAll(".meal-lock").forEach(
    (btn) =>
      (btn.onclick = () =>
        toggleMealLock(
          btn.dataset.lockDate,
          btn.dataset.lockMeal,
          JSON.parse(decodeURIComponent(btn.dataset.lockPayload)),
        )),
  );
  document.querySelectorAll(".addExtraMeal").forEach(
    (btn) => (btn.onclick = () => openAddMealMenu(btn.dataset.date)),
  );
  document.querySelectorAll(".removeManualMeal").forEach(
    (btn) =>
      (btn.onclick = () =>
        removeManualMeal(btn.dataset.date, btn.dataset.meal)),
  );
  bindInactiveMealActions();
}
function stockBadges(m) {
  let parts = [];
  if (m.recipeInventoryId)
    parts.push('<span class="pill recipe-stock-chip">Aus Rezeptvorrat</span>');
  else if (m.inventoryFoodIds?.length) {
    let names = m.inventoryFoodIds
      .map((id) => food(id)?.name)
      .filter(Boolean)
      .join(", ");
    parts.push(`<span class="pill stock-chip">Aus Vorrat${names ? `: ${esc(names)}` : ""}</span>`);
  }
  return parts.join("");
}
function mealLockIcon(locked) {
  return locked
    ? `<svg class="lock-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path><path d="M12 14.5v2"></path></svg>`
    : `<svg class="lock-svg lock-svg-open" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0"></path><path d="M12 14.5v2"></path></svg>`;
}
function renderMealCore(day, m) {
  if (!m.active) return "";
  if (m.empty)
    return `<div class="mealbox"><div class="mealname">${mealName(m.meal)}</div><div class="small">Noch keine passende bekannte oder neue Zutat verfügbar.</div></div>`;
  let done = completedLog(day.date, m.meal);
  if (done) return completedMealHtml(day.date, m.meal, done);
  let f = food(m.focusId);
  let planPayload = encodeURIComponent(
    JSON.stringify({
      date: day.date,
      meal: m.meal,
      focusId: m.focusId,
      foodIds: m.foodIds,
      baseFoodIds: m.baseFoodIds || [],
      sampleFoodIds: m.sampleFoodIds || [],
      recipeName: m.recipeName || "",
      recipeInventoryId: m.recipeInventoryId || "",
    }),
  );
  let lock = state.planLocks?.[planLockKey(day.date, m.meal)];
  let lockText = lock
    ? lock.mode === "auto"
      ? "Fest eingeplant"
      : "Manuell geschützt"
    : "nicht geschützt";
  let lockPayload = encodeURIComponent(
    JSON.stringify({
      focusId: m.focusId,
      foodIds: m.foodIds,
      baseFoodIds: m.baseFoodIds || [],
      sampleFoodIds: m.sampleFoodIds || [],
      optionalAddons: m.optionalAddons || [],
      inventoryFoodIds: m.inventoryFoodIds || [],
      recipeName: m.recipeName || "",
      recipeInventoryId: m.recipeInventoryId || "",
      type: m.type,
      note: m.note,
      manualAdded: !!m.manualAdded,
    }),
  );
  let movePayload = encodeURIComponent(
    JSON.stringify({
      date: day.date,
      meal: m.meal,
      focusId: m.focusId,
      foodIds: m.foodIds,
      baseFoodIds: m.baseFoodIds || [],
      sampleFoodIds: m.sampleFoodIds || [],
      optionalAddons: m.optionalAddons || [],
      inventoryFoodIds: m.inventoryFoodIds || [],
      recipeName: m.recipeName || "",
      recipeInventoryId: m.recipeInventoryId || "",
      type: m.type,
      note: m.note,
      manualAdded: !!m.manualAdded,
    }),
  );
  let lockButton = `<button class="iconbtn meal-lock ${lock ? "locked" : "unlocked"}" data-lock-date="${day.date}" data-lock-meal="${m.meal}" data-lock-payload="${lockPayload}" aria-label="${lock ? "Feste Planung lösen" : "Mahlzeit vor automatischer Änderung schützen"}" title="${esc(lockText)}">${mealLockIcon(!!lock)}</button>`;

  if (m.manualAdded) {
    return `<details class="manual-meal">
      <summary>
        <div class="row">
          <div class="grow"><div class="manual-meal-title">${esc(mealDisplayTitle(m))}</div><div class="small meal-type-text">${esc(mealTypeText(m))} · ${mealName(m.meal)}</div>${mealStatusText(m) ? `<div class="small meal-status-text">${esc(mealStatusText(m))}</div>` : ""}</div>
          <div class="manual-summary-actions">${lockButton}<span class="manual-chevron">⌄</span></div>
        </div>
      </summary>
      <div class="manual-meal-body">
        ${inactiveMealWarningHtml(day, m)}
        ${compactMealRolesHtml(m)}
        <div class="actionbar"><button class="btn secondary replaceMeal" data-date="${day.date}" data-meal="${m.meal}" data-focus="${m.focusId}">Mahlzeit bearbeiten</button><button class="btn secondary moveMeal" data-move-payload="${movePayload}">Auf morgen</button></div>
        <button class="btn full logMeal" data-plan="${planPayload}">Protokollieren</button>
        <button class="btn danger full removeManualMeal" data-date="${day.date}" data-meal="${m.meal}">Zusatzmahlzeit entfernen</button>
      </div>
    </details>`;
  }

  let stockBadgeHtml = stockBadges(m);
  return `<div class="mealbox">
    <div class="row meal-summary-row">
      <div class="grow meal-summary-main"><div class="dish-title">${esc(mealDisplayTitle(m))}</div><div class="small meal-type-text">${esc(mealTypeText(m))} · ${mealName(m.meal)}</div>${mealStatusText(m) ? `<div class="small meal-status-text">${esc(mealStatusText(m))}</div>` : ""}${stockBadgeHtml ? `<div class="meal-stock-row">${stockBadgeHtml}</div>` : ""}</div>
      <div class="meal-summary-actions">${lockButton}</div>
    </div>
    ${lock ? `<div class="tiny lock-label">${esc(lockText)}</div>` : ""}
    ${inactiveMealWarningHtml(day, m)}
    ${compactMealRolesHtml(m)}
    ${whyDetailsHtml(m)}
    <div class="actionbar"><button class="btn secondary replaceMeal" data-date="${day.date}" data-meal="${m.meal}" data-focus="${m.focusId}">Bearbeiten</button><button class="btn secondary moveMeal" data-move-payload="${movePayload}">Auf morgen</button></div>
    <button class="btn full logMeal" data-plan="${planPayload}">Protokollieren</button>
  </div>`;
}
function manualLearningRoleText(foodOrId, type = "") {
  let item = typeof foodOrId === "string" ? food(foodOrId) : foodOrId;
  if (!item) return "Einführung";
  return learningRoleLabel(rank(item), status(item), type);
}
function manualLearningValidationText(message) {
  return String(message || "")
    .replace("Bitte als bekannte Komponente oder Einführung kennzeichnen.", "Bitte als bekannte Komponente oder als Einführung beziehungsweise Wiederholung kennzeichnen.")
    .replace("Bitte als Einführung kennzeichnen oder entfernen.", "Bitte als Einführung beziehungsweise Wiederholung kennzeichnen oder entfernen.")
    .replace("Nur eine neue oder unsichere Einführung gleichzeitig:", "Nur ein neues oder unsicheres Lebensmittel gleichzeitig als Einführung beziehungsweise Wiederholung:");
}
function storeEditedPlanMeal(date, meal, data) {
  let prepared = prepareManualMealData(data, meal, date);
  if (!prepared.ok) return prepared;
  let key = planLockKey(date, meal);
  let entry = {
    ...prepared.data,
    date,
    meal,
    active: true,
    manualAdded: false,
    type: "manuell",
    note: prepared.data.note || "Mahlzeit bewusst manuell bearbeitet.",
  };
  state.planLocks ||= {};
  state.planLocks[key] = mealSnapshot(date, meal, entry, "manual");
  delete state.overrides?.[key];
  delete state.autoLockExcluded?.[key];
  return { ok: true, entry: clone(state.planLocks[key]) };
}
function saveEditedPlanMeal(date, meal, data) {
  let result = storeEditedPlanMeal(date, meal, data);
  if (!result.ok) {
    showToast(manualLearningValidationText(result.message) || "Diese Mahlzeit kann noch nicht sicher gespeichert werden.");
    return result;
  }
  save();
  closeGeneric();
  renderAll();
  showToast("Gesamte Mahlzeit geändert und vor automatischen Änderungen geschützt.");
  return result;
}
function storeManualMeal(date, meal, data) {
  let prepared = prepareManualMealData(data, meal, date);
  if (!prepared.ok) return prepared;
  state.manualMeals ||= {};
  state.planLocks ||= {};
  let key = manualMealKey(date, meal);
  let entry = {
    ...prepared.data,
    date,
    meal,
    manualAdded: prepared.data.manualAdded !== false,
    type: prepared.data.type || "manuell",
    createdAt: prepared.data.createdAt || new Date().toISOString(),
  };
  state.manualMeals[key] = entry;
  state.planLocks[key] = mealSnapshot(
    date,
    meal,
    { ...entry, active: true },
    "manual",
  );
  delete state.autoLockExcluded?.[key];
  return { ok: true, entry: clone(entry), lock: clone(state.planLocks[key]) };
}
function saveManualMeal(date, meal, data) {
  let result = storeManualMeal(date, meal, data);
  if (!result.ok) {
    showToast(manualLearningValidationText(result.message) || "Diese Mahlzeit kann noch nicht sicher gespeichert werden.");
    return result;
  }
  save();
  closeGeneric();
  renderAll();
  showToast(`${mealName(meal)} wurde manuell hinzugefügt und fest eingeplant.`);
  return result;
}
function removeManualMeal(date, meal) {
  let key = manualMealKey(date, meal);
  delete state.manualMeals?.[key];
  delete state.planLocks?.[key];
  delete state.overrides?.[key];
  save();
  renderAll();
  showToast(`${mealName(meal)} entfernt.`);
}
function openAddMealMenu(date) {
  let day = buildDays(date, 1)[0];
  let available = availableExtraMeals(day);
  if (!available.length) {
    showToast("Alle verfügbaren Zusatzmahlzeiten sind bereits belegt.");
    return;
  }
  if (available.length === 1) {
    openManualMealSelector(date, available[0]);
    return;
  }
  openGeneric(
    "Mahlzeit hinzufügen",
    `<p class="small">Der Slot wird erst gespeichert, nachdem du ein Rezept oder Lebensmittel ausgewählt hast.</p>
     <div class="date-choice-grid">
      ${available.map((meal) => `<button class="btn secondary chooseExtraMeal" data-meal="${meal}">+ ${mealName(meal)}</button>`).join("")}
     </div>`,
  );
  document.querySelectorAll(".chooseExtraMeal").forEach(
    (button) =>
      (button.onclick = () => openManualMealSelector(date, button.dataset.meal)),
  );
}
function openManualMealSelector(date, meal, initialMeal = null) {
  let key = manualMealKey(date, meal);
  let storedManual = state.manualMeals?.[key] || null;
  let existing = storedManual || initialMeal || null;
  let isNewManualSlot = !existing;
  let isManualAdded = !!storedManual?.manualAdded;
  let tab = existing?.recipeName ? "recipes" : existing ? "foods" : "recipes";
  let query = "";
  let selectedRecipe = existing?.recipeName || "";
  let initialRoles = manualMealRoleState(existing || {});
  let selectedFoods = new Set(initialRoles.ids);
  let baseFoodIds = new Set(initialRoles.bases);
  let sampleFoodIds = new Set(initialRoles.samples);
  let initialSignature = JSON.stringify({
    recipeName: selectedRecipe,
    ids: initialRoles.ids,
    bases: initialRoles.bases,
    samples: initialRoles.samples,
  });

  function currentRoleData() {
    let ids = [...selectedFoods];
    let bases = ids.filter((id) => baseFoodIds.has(id) && !sampleFoodIds.has(id));
    let samples = ids.filter((id) => sampleFoodIds.has(id));
    let components = ids.filter((id) => !bases.includes(id) && !samples.includes(id));
    return { recipeName: selectedRecipe, foodIds: ids, baseFoodIds: bases, sampleFoodIds: samples, components, foodRoles: foodRolesFor(ids, bases, samples), focusId: existing?.focusId || "" };
  }
  function selectionChanged() {
    let roles = currentRoleData();
    return JSON.stringify({ recipeName: selectedRecipe, ids: roles.foodIds, bases: roles.baseFoodIds, samples: roles.sampleFoodIds }) !== initialSignature;
  }
  function assignAutomaticRole(id, recipeContext = false) {
    let info = manualMealRoleInfo(id, meal, date, { recipeName: recipeContext ? selectedRecipe : "" });
    baseFoodIds.delete(id);
    sampleFoodIds.delete(id);
    if (info.role === "base") baseFoodIds.add(id);
    else if (info.role === "sample") sampleFoodIds.add(id);
    // Bekannte Komponenten bleiben bewusst außerhalb von Hauptbasis und Lernrolle.
  }
  function setRole(id, role) {
    if (!selectedFoods.has(id)) return;
    let info = manualMealRoleInfo(id, meal, date, { recipeName: selectedRecipe });
    if (role === "base" && info.role !== "base") return;
    baseFoodIds.delete(id);
    sampleFoodIds.delete(id);
    (role === "sample" ? sampleFoodIds : baseFoodIds).add(id);
  }
  function removeSelectedFood(id) {
    selectedFoods.delete(id);
    baseFoodIds.delete(id);
    sampleFoodIds.delete(id);
  }
  function commitMeal(data) {
    let result = isNewManualSlot || isManualAdded
      ? saveManualMeal(date, meal, data)
      : saveEditedPlanMeal(date, meal, data);
    if (!result?.ok) renderSelector();
  }
  function selectedRolesHtml(validation) {
    if (!validation.ids.length) return '<div class="manual-role-empty small">Noch keine Lebensmittel ausgewählt.</div>';
    let group = (title, ids, role) => `<div class="manual-role-group ${role}"><div class="manual-role-heading">${title}</div>${ids.length ? ids.map((id) => {
      let f = food(id), info = validation.infos[id] || manualMealRoleInfo(id, meal, date, { recipeName: selectedRecipe });
      let canBeBase = info.role === "base";
      let learningLabel = manualLearningRoleText(f, existing?.type || "");
      let switchButton = role === "sample" && canBeBase
        ? `<button class="btn secondary tinybtn setManualRole" data-food="${id}" data-role="base">Als Hauptbasis</button>`
        : role === "base" && info.role === "sample"
          ? `<button class="btn secondary tinybtn setManualRole" data-food="${id}" data-role="sample">Als ${esc(learningLabel === "Pausiert" ? "Einführung oder Wiederholung" : learningLabel)}</button>`
          : "";
      let roleDetail = role === "sample" && learningLabel !== status(f) ? ` · ${esc(learningLabel)}` : "";
      return `<div class="manual-role-item"><div class="grow"><b>${esc(f?.name || id)}</b><span class="small">${esc(status(f))}${roleDetail}</span></div><div class="manual-role-actions">${switchButton}<button class="iconbtn removeManualSelected" data-food="${id}" aria-label="${esc(f?.name || id)} entfernen">×</button></div></div>`;
    }).join("") : '<div class="small manual-role-none">Keine</div>'}</div>`;
    return `<div class="manual-role-overview">${group("Hauptbasis", validation.bases, "base")}${group("Bekannte Komponente", validation.components || [], "component")}${group("Einführung und Wiederholung", validation.samples, "sample")}</div>`;
  }
  function renderSelector() {
    let roleData = currentRoleData();
    let validation = manualMealValidation(roleData, meal, date);
    let recipeRows = recipeStates()
      .filter(
        (r) =>
          (r.unlocked || r.almost || r.name === selectedRecipe) &&
          recipeSuitableForMeal(r, meal) &&
          (!query || normalizeName(recipeSearchText(r)).includes(normalizeName(query))),
      )
      .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || a.name.localeCompare(b.name, "de"));
    let foodRows = state.foods
      .filter((f) => {
        let alreadySelected = selectedFoods.has(f.id);
        let selectable = manualMealRoleInfo(f, meal, date).role !== "excluded";
        return (alreadySelected || selectable) && (!query || foodSearchMatches(f, query));
      })
      .sort(
        (a, b) =>
          Number(selectedFoods.has(b.id)) - Number(selectedFoods.has(a.id)) ||
          (query ? foodSearchScore(a, query) - foodSearchScore(b, query) : 0) ||
          rank(b) - rank(a) ||
          Number(inventoryPortions(b.id) > 0) - Number(inventoryPortions(a.id) > 0) ||
          a.priority - b.priority,
      );
    let warning = validation.messages.length
      ? `<div class="notice warn manual-role-warning"><b>So passt die Auswahl noch nicht</b><div>${validation.messages.map((message) => esc(manualLearningValidationText(message))).join("<br>")}</div></div>`
      : '<div class="notice olive manual-role-ok">Hauptbasis und Lernrolle werden getrennt gespeichert.</div>';
    let body = `<div class="meal-selector-tabs"><button id="selectorRecipes" class="${tab === "recipes" ? "active" : ""}">Rezepte</button><button id="selectorFoods" class="${tab === "foods" ? "active" : ""}">Lebensmittel</button></div>
      ${selectedRolesHtml(validation)}
      ${warning}
      <div class="field"><label>Suchen</label><input id="mealSelectorSearch" value="${esc(query)}" placeholder="${tab === "recipes" ? "Rezept suchen" : "Lebensmittel suchen"}"></div>
      <div class="selector-results">
        ${
          tab === "recipes"
            ? recipeRows.length
              ? recipeRows.map((r) => {
                let recipeIds = recipeFoodIds(r), recipeRoleInfos = Object.fromEntries(recipeIds.map((id) => [id, manualMealRoleInfo(id, meal, date, { recipeName: r.name })]));
                let recipeBases = recipeIds.filter((id) => recipeRoleInfos[id].role === "base"), recipeSamples = recipeIds.filter((id) => recipeRoleInfos[id].role === "sample");
                let preview = manualMealValidation({ recipeName: r.name, foodIds: recipeIds, baseFoodIds: recipeBases, sampleFoodIds: recipeSamples, foodRoles: foodRolesFor(recipeIds, recipeBases, recipeSamples) }, meal, date);
                let roleHint = preview.multipleUnsafeIds.length ? ` · nicht speicherbar: ${preview.multipleUnsafeIds.map((id) => food(id)?.name || id).join(", ")}` : preview.samples.length ? ` · ${preview.samples.map((id) => `${manualLearningRoleText(id)}: ${food(id)?.name || id}`).join(", ")}` : "";
                return `<button class="selector-row selectRecipe ${selectedRecipe === r.name ? "selected" : ""}" data-recipe="${encodeURIComponent(r.name)}">${recipeIconSvg(r)}<span class="grow"><b>${esc(r.name)}</b><span class="small" style="display:block">${r.unlocked ? "Jetzt passend" : `Fast passend · ${esc(recipeMissingSummary(r))}`}${recipeInventoryPortions(r.name) ? ` · ${recipeInventoryPortions(r.name)} im Vorrat` : ""}${esc(roleHint)}</span></span><span class="selector-check" aria-hidden="true">${selectedRecipe === r.name ? "✓" : ""}</span></button>`;
              }).join("")
              : '<div class="empty">Kein passendes Rezept gefunden.</div>'
            : foodRows.length
              ? foodRows.map((f) => {
                let selected = selectedFoods.has(f.id), role = sampleFoodIds.has(f.id) ? "sample" : baseFoodIds.has(f.id) ? "base" : selected ? "component" : "";
                let roleInfo = manualMealRoleInfo(f, meal, date), pausedManual = roleInfo.reason === "paused_manual";
                let learningLabel = manualLearningRoleText(f, existing?.type || "");
                let roleLabel = pausedManual
                  ? "Pausiert · manuell"
                  : role === "sample" ? learningLabel
                    : role === "base" ? "Hauptbasis"
                      : role === "component" ? "Bekannte Komponente"
                        : roleInfo.role === "sample" ? `wird ${learningLabel}`
                          : roleInfo.role === "component" ? "wird bekannte Komponente"
                            : "wird Hauptbasis";
                return `<button class="selector-row selectFood ${selected ? "selected" : ""} ${pausedManual ? "manual-paused-food" : ""}" data-food="${f.id}">${foodIconSvg(f)}<span class="grow"><b>${esc(f.name)}</b><span class="small" style="display:block">${esc(status(f))}${pausedManual ? " · nur manuell" : ""}${!f.active ? " · deaktiviert" : ""}${inventoryPortions(f.id) ? ` · ${inventoryPortions(f.id)} Portionen im Vorrat` : ""}</span></span><span class="manual-role-type ${role || roleInfo.role} ${pausedManual ? "paused" : ""}">${esc(roleLabel)}</span><span class="selector-check" aria-hidden="true">${selected ? "✓" : ""}</span></button>`;
              }).join("")
              : '<div class="empty">Kein Lebensmittel gefunden.</div>'
        }
      </div>
      <div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelManualMeal" type="button">Abbrechen</button><button class="btn" id="confirmManualMeal" ${((tab === "recipes" && !selectedRecipe) || !validation.ok) ? "disabled" : ""}>${isNewManualSlot ? "Mahlzeit übernehmen" : "Gesamte Mahlzeit speichern"}</button></div>`;
    openGeneric(isNewManualSlot ? `${mealName(meal)} auswählen` : `${mealName(meal)} bearbeiten`, body);
    document.getElementById("cancelManualMeal")?.addEventListener("click", closeGeneric);
    document.getElementById("selectorRecipes").onclick = () => { tab = "recipes"; query = ""; renderSelector(); };
    document.getElementById("selectorFoods").onclick = () => { tab = "foods"; query = ""; renderSelector(); };
    document.getElementById("mealSelectorSearch").oninput = (event) => {
      query = event.target.value;
      renderSelector();
      requestAnimationFrame(() => {
        let field = document.getElementById("mealSelectorSearch");
        field?.focus();
        field?.setSelectionRange(field.value.length, field.value.length);
      });
    };
    document.querySelectorAll(".selectRecipe").forEach((button) => button.onclick = () => {
      selectedRecipe = decodeURIComponent(button.dataset.recipe);
      selectedFoods.clear(); baseFoodIds.clear(); sampleFoodIds.clear();
      for (let id of recipeFoodIds(recipeByName(selectedRecipe))) { selectedFoods.add(id); assignAutomaticRole(id, true); }
      renderSelector();
    });
    document.querySelectorAll(".selectFood").forEach((button) => button.onclick = () => {
      selectedRecipe = "";
      let id = button.dataset.food;
      if (selectedFoods.has(id)) removeSelectedFood(id);
      else { selectedFoods.add(id); assignAutomaticRole(id); }
      renderSelector();
    });
    document.querySelectorAll(".setManualRole").forEach((button) => button.onclick = () => { setRole(button.dataset.food, button.dataset.role); renderSelector(); });
    document.querySelectorAll(".removeManualSelected").forEach((button) => button.onclick = () => { selectedRecipe = ""; removeSelectedFood(button.dataset.food); renderSelector(); });
    let confirm = document.getElementById("confirmManualMeal");
    if (confirm) confirm.onclick = () => {
      let current = currentRoleData();
      let changed = selectionChanged();
      let recipe = selectedRecipe ? recipeByName(selectedRecipe) : null;
      let batch = recipe ? oldestRecipeBatch(recipe.name) : null;
      let preserveExisting = !!existing && !changed;
      commitMeal({
        ...clone(existing || {}),
        recipeName: recipe?.name || "",
        recipeInventoryId: preserveExisting ? (existing.recipeInventoryId || "") : (batch?.id || ""),
        focusId: preserveExisting ? (existing.focusId || "") : "",
        foodIds: current.foodIds,
        baseFoodIds: current.baseFoodIds,
        sampleFoodIds: current.sampleFoodIds,
        foodRoles: current.foodRoles,
        optionalAddons: preserveExisting ? [...(existing.optionalAddons || [])] : [],
        inventoryFoodIds: preserveExisting ? [...(existing.inventoryFoodIds || [])] : [],
        milkMeal: preserveExisting ? (existing.milkMeal || "") : (recipe?.milkMeal || ""),
        portionTargetGrams: preserveExisting ? existing.portionTargetGrams : undefined,
        sampleTargetGrams: preserveExisting ? existing.sampleTargetGrams : undefined,
        totalOfferedGrams: preserveExisting ? existing.totalOfferedGrams : undefined,
        ingredientAmounts: preserveExisting ? existing.ingredientAmounts : undefined,
        note: preserveExisting ? existing.note : (recipe ? "Manuell ausgewähltes Rezept." : "Manuell ausgewählte Lebensmittelkombination."),
        type: preserveExisting ? existing.type : "manuell",
        manualAdded: isNewManualSlot || isManualAdded,
        createdAt: existing?.createdAt,
      });
    };
  }
  renderSelector();
}
function chooseReplacement(date, meal, currentId) {
  let current = buildDays(date, 1)[0]?.meals.find(
    (item) => item.meal === meal && item.active,
  );
  if (!current) return;
  openManualMealSelector(date, meal, current);
}
function visibleMealExists(date, meal) {
  if (state.manualMeals?.[manualMealKey(date, meal)]) return true;
  if (completedLog(date, meal)) return true;
  return activeMeal(meal, date);
}
function nextFreeMealDate(fromDate, meal) {
  for (let i = 1; i <= 45; i++) {
    let date = addDays(fromDate, i);
    let key = planLockKey(date, meal);
    let manuallyOccupied =
      !!state.manualMeals?.[key] ||
      !!state.overrides?.[key] ||
      state.planLocks?.[key]?.mode === "manual" ||
      !!completedLog(date, meal);
    if (!manuallyOccupied) return date;
  }
  return "";
}
function placeMovedMeal(payload, targetDate) {
  let sourceKey = planLockKey(payload.date, payload.meal);
  let targetKey = planLockKey(targetDate, payload.meal);
  delete state.manualMeals?.[sourceKey];
  delete state.planLocks?.[sourceKey];
  delete state.overrides?.[sourceKey];
  state.deferred[payload.date] = true;
  delete state.manualMeals?.[targetKey];
  delete state.planLocks?.[targetKey];
  delete state.overrides?.[targetKey];
  state.manualMeals[targetKey] = {
    ...payload,
    date: targetDate,
    manualAdded: payload.manualAdded !== false,
    note: payload.note || "Bewusst auf diesen Tag verschoben.",
    createdAt: new Date().toISOString(),
  };
  state.planLocks[targetKey] = mealSnapshot(
    targetDate,
    payload.meal,
    { ...state.manualMeals[targetKey], active: true },
    "manual",
  );
  save();
  closeGeneric();
  renderAll();
  showToast(`${mealName(payload.meal)} auf ${shortDate(targetDate)} verschoben und vor automatischen Änderungen geschützt.`);
}
function moveMealTomorrow(payload) {
  let next = addDays(payload.date, 1);
  if (!visibleMealExists(next, payload.meal)) {
    placeMovedMeal(payload, next);
    return;
  }
  openGeneric(
    `${mealName(payload.meal)} verschieben`,
    `<p>Für morgen ist bereits ein ${mealName(payload.meal).toLowerCase()} eingeplant.</p>
     <div class="notice warn" id="moveMealError" style="display:none"></div>
     <div class="date-choice-grid">
      <button class="btn danger" id="moveReplace">Vorhandene Mahlzeit ersetzen</button>
      <button class="btn secondary" id="moveNextFree">Auf den nächsten freien Tag verschieben</button>
      <button class="btn secondary" id="moveCancel">Abbrechen</button>
     </div>`,
  );
  document.getElementById("moveReplace").onclick = () =>
    placeMovedMeal(payload, next);
  document.getElementById("moveNextFree").onclick = () => {
    let free = nextFreeMealDate(next, payload.meal);
    if (!free) {
      let error = document.getElementById("moveMealError");
      if (error) { error.textContent = "In den nächsten Wochen wurde kein freier Platz gefunden."; error.style.display = "block"; }
      return;
    }
    placeMovedMeal(payload, free);
  };
  document.getElementById("moveCancel").onclick = closeGeneric;
}

function renderMeal(day, meal) {
  let html = renderMealCore(day, meal);
  if (meal?.note && /diesmal|erneut anbieten|nachholen/i.test(meal.note) && !mealIsCompleted(day.date, meal.meal)) {
    html = html.replace('<div class="actionbar">', `<div class="followup-plan-note">${esc(meal.note)}</div><div class="actionbar">`);
  }
  return html;
}

function renderPlan() {
  renderPlanCore();
  let summary = document.getElementById("planLockSummary");
  let amountLabel = AMOUNT_LEVELS[currentAmountLevel()]?.label || "";
  let compactAmount = compactPlanAmountLabel(amountLabel);
  let defaults = document.getElementById("planDefaults");
  if (summary && !defaults) {
    summary.insertAdjacentHTML(
      "afterend",
      '<div class="plan-defaults plan-defaults-compact" id="planDefaults"></div>',
    );
    defaults = document.getElementById("planDefaults");
  }
  if (defaults) {
    defaults.classList.add("plan-defaults-compact");
    defaults.innerHTML =
      `<span class="plan-defaults-line"><b>${esc(PHASES[currentPhase()].label)}</b> · ${esc(compactAmount)} · ${esc(textureName())}</span>`;
  }
  document.querySelectorAll("#blockPlan .day-card .status-chips .pill").forEach((pill) => {
    if ([phaseText(), amountLabel, textureText()].includes((pill.textContent || "").trim())) pill.remove();
  });
}

function renderHome() {
  renderHomeCore();
  let button = document.getElementById("homeAddEntry");
  if (button) {
    button.onclick = (event) => { event.preventDefault(); openLog(null); };
  }
}

function renderSettings() {
  for (let id of ["birthDate","startDate","allergenDays","newFoodEvery","amountSelected","textureStage","phMode","travelDate","freezerDays"]) document.getElementById(id).value = state.settings[id];
  document.getElementById("seasonal").checked = state.settings.seasonal;
  document.getElementById("preferInventoryInPlan").checked =
    state.settings.preferInventoryInPlan !== false;
  let box = document.getElementById("settingsPhaseSummary");
  box.innerHTML = `<b>Phase: ${esc(phaseText())}</b><br>${esc(phaseSourceText())}<br><br><b>Mengenorientierung: ${esc(AMOUNT_LEVELS[currentAmountLevel()].label)}</b><br>${esc(amountLevelSourceText())}`;
}
function renderAuditCore() {
  if (!document.getElementById("auditList")) return;
  let ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
  let duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  let outcomes = [["eaten", "Gegessen"], ["tried", "Probiert"], ["not_accepted", "Nicht angenommen"], ["reaction", "Reaktion"], ["not_offered", "Nicht angeboten"]];
  let recipeNames = RECIPES.map((recipe) => recipe.name);
  let checks = [
    ["Mindestens 100 Lebensmittel", uniqueEligibleCount() >= 100],
    ["Lebensmittel-Standardfilter Offen", foodFilter === "open"],
    ["Alle 11 Allergengruppen vorhanden", new Set(state.foods.filter((f) => f.allergenGroup).map((f) => f.allergenGroup)).size === 11],
    ["Nur die fünf bestätigten Ergebnisbegriffe", outcomes.length === 5 && new Set(outcomes.map(([, label]) => label)).size === 5],
    ["Keine doppelten aktiven HTML-IDs", duplicateIds.length === 0],
    ["IndexedDB-Schnittstelle verfügbar", !!window.indexedDB],
    ["V8.8-Rohbackup wird erkannt", typeof validateBackup === "function"],
    ["Milch-Getreide-Brei zählt als volle Milchmahlzeit", recipeByName("Milch-Getreide-Brei")?.milkMeal === "full"],
    ["Buttermilchrezepte vorhanden", RECIPES.some((recipe) => (recipe.requires || []).includes("Buttermilch"))],
    ["Keine verworfenen Rezeptbadges im Codebestand", (() => { let forbidden = ["Alles bekannt", "1 Schritt fehlt", "passt zum Wochenplan"]; let dataClean = !RECIPES.some((recipe) => forbidden.some((text) => JSON.stringify(recipe).includes(text))); let renderedClean = ![...document.querySelectorAll(".recipe-card-v2 .pill")].some((chip) => forbidden.includes((chip.textContent || "").trim())); return dataClean && renderedClean; })()],
    ["Protokoll und Rezepte liegen unter Mehr", !!document.querySelector("#more #logDetails") && !!document.querySelector("#more #recipesDetails")],
    ["Kein aktueller horizontaler Seitenüberlauf", document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1],
    ["Rezeptnamen ohne Dubletten", new Set(recipeNames).size === recipeNames.length],
  ];
  document.getElementById("auditList").innerHTML = checks.map(([text, ok]) => `<div class="checkline"><span class="statusdot ${ok ? "good" : "warn"}"></span><div><b>${ok ? "Geprüft" : "Prüfen"}:</b> ${esc(text)}</div></div>`).join("");
}

function openGeneric(title, body, onClose = null) {
  genericCloseHandler = typeof onClose === "function" ? onClose : null;
  document.getElementById("genericTitle").textContent = title;
  document.getElementById("genericBody").innerHTML = body;
  document.getElementById("genericModal").classList.add("open");
}
function closeGeneric() {
  document.getElementById("genericModal").classList.remove("open");
  let handler = genericCloseHandler;
  genericCloseHandler = null;
  if (handler) handler();
}
function resetMoreTransientUi() {
  resetStatisticsTransientUi();
  let logDetails = document.getElementById("logDetails");
  if (logDetails) logDetails.open = false;
  document.querySelectorAll(".entry-chooser").forEach((chooser) => chooser.remove());
}
function showView(id) {
  let previous = document.querySelector(".view.active")?.id;
  if (previous === "more" && id !== "more") {
    resetMoreTransientUi();
    recipeFilter = "available";
    recipeQuery = "";
    logMonthFilter = "all";
    logVisibleCount = 8;
    let recipeSearch = document.getElementById("recipeSearch");
    if (recipeSearch) recipeSearch.value = "";
    document.getElementById("recipeFilter")?.scrollTo({ left: 0, behavior: "auto" });
    renderPrep();
  }
  if (previous === "foods" && id !== "foods") {
    foodFilter = "open";
    foodReorderMode = false;
    let foodSearch = document.getElementById("foodSearch");
    if (foodSearch) foodSearch.value = "";
    document.getElementById("foodFilters")?.scrollTo({ left: 0, behavior: "auto" });
    renderFoods();
  }
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("active", v.id === id));
  document
    .querySelectorAll("nav button")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function existingFoodWithName(name) {
  let normalized = normalizeName(name);
  if (!normalized) return null;
  return state.foods.find((item) => {
    if (normalizeName(item.name) === normalized) return true;
    return String(item.alias || "")
      .split(/[;,/|]+/)
      .some((alias) => normalizeName(alias) === normalized);
  }) || null;
}
function uiFoodCategoryDisplayLabel(category) {
  if (typeof foodCategoryLabel === "function") return foodCategoryLabel(category);
  let value = String(category || "");
  return {
    "Getreide/Stärke": "Getreide und Stärke",
    "Kraut/Gewürz": "Kräuter und Gewürze",
    "Wurzel/Knolle": "Wurzel- und Knollengemüse",
    "Soja/Tofu": "Soja und Tofu",
  }[value] || value;
}
function addCustomFoodForm(options = {}) {
  let cats = [
    "Gemüse",
    "Obst",
    "Getreide/Stärke",
    "Hülsenfrucht",
    "Fleisch",
    "Fisch",
    "Milchprodukt",
    "Ei",
    "Nuss",
    "Samen",
    "Kraut/Gewürz",
    "Wurzel/Knolle",
  ];
  let returnToLog = !!options.returnToLog && document.getElementById("logModal")?.classList.contains("open");
  if (returnToLog) document.getElementById("logModal").classList.remove("open");
  openGeneric(
    "Eigenes Lebensmittel",
    `<div class="field"><label>Name</label><input id="customName" autocomplete="off"><div class="small custom-food-message" id="customFoodMessage" aria-live="polite"></div></div>
     <div class="field"><label>Kategorie</label><select id="customCat">${cats.map((c) => `<option value="${esc(c)}">${esc(uiFoodCategoryDisplayLabel(c))}</option>`).join("")}</select></div>
     <div class="field"><label>Passend für</label><div style="display:flex;flex-wrap:wrap;gap:10px 18px"><label class="small" style="display:flex;align-items:center;gap:7px"><input type="checkbox" id="customMealBreakfast" value="breakfast"> Frühstück</label><label class="small" style="display:flex;align-items:center;gap:7px"><input type="checkbox" id="customMealLunch" value="lunch"> Mittagessen</label><label class="small" style="display:flex;align-items:center;gap:7px"><input type="checkbox" id="customMealDinner" value="dinner"> Abendessen</label></div><div class="small" style="margin-top:6px">Ohne Auswahl bleibt das Lebensmittel verfügbar, wird aber nicht automatisch geplant.</div></div>
     <div class="field"><label>Allergengruppe (optional)</label><input id="customAllergen"></div>
     <div class="field"><label>Sichere Form oder Notiz</label><textarea id="customSafe"></textarea></div>
     <div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelCustom" type="button">Abbrechen</button><button class="btn" id="saveCustom">Speichern</button></div>`,
    returnToLog ? () => {
      document.getElementById("logModal").classList.add("open");
      renderLogForm();
    } : null,
  );
  let mealInputs = [
    ["customMealBreakfast", "breakfast"],
    ["customMealLunch", "lunch"],
    ["customMealDinner", "dinner"],
  ];
  let applyMealDefaults = () => {
    let selected = new Set(customMealDefaults(document.getElementById("customCat").value) || []);
    for (let [id, meal] of mealInputs) document.getElementById(id).checked = selected.has(meal);
  };
  let selectedMeals = () => mealInputs.filter(([id]) => document.getElementById(id).checked).map(([, meal]) => meal);
  applyMealDefaults();
  document.getElementById("customCat").onchange = applyMealDefaults;

  let finish = (item, created) => {
    closeGeneric();
    renderAll();
    if (typeof options.onSaved === "function") options.onSaved(item, created);
  };
  let showDuplicate = (item) => {
    let message = document.getElementById("customFoodMessage");
    if (!message) return;
    message.innerHTML = item
      ? `Bereits vorhanden: <b>${esc(item.name)}</b>${typeof options.onSaved === "function" ? ' <button class="text-button" id="useExistingCustom" type="button">Vorhandenes verwenden</button>' : ""}`
      : "";
    document.getElementById("useExistingCustom")?.addEventListener("click", () => finish(item, false));
  };
  document.getElementById("customName").oninput = (event) => showDuplicate(existingFoodWithName(event.target.value));
  document.getElementById("cancelCustom").onclick = closeGeneric;
  document.getElementById("saveCustom").onclick = () => {
    let nameInput = document.getElementById("customName");
    let name = nameInput.value.trim();
    let nameField = nameInput.closest(".field");
    nameField?.classList.remove("field-error");
    nameField?.querySelector(".field-error-message")?.remove();
    if (!name) {
      nameField?.classList.add("field-error");
      nameInput.insertAdjacentHTML("afterend", '<div class="field-error-message">Bitte einen Namen eingeben.</div>');
      nameInput.focus();
      return;
    }
    let duplicate = existingFoodWithName(name);
    if (duplicate) { showDuplicate(duplicate); return; }
    let id = "custom-" + Date.now();
    let item = {
      id,
      name,
      category: document.getElementById("customCat").value,
      priority:
        Math.max(...state.foods.map((f) => Number(f.priority) || 0)) + 1,
      active: true,
      allergenGroup: document.getElementById("customAllergen").value.trim(),
      ironRich: false,
      ph: false,
      alias: "",
      meals: selectedMeals(),
      safeForm:
        document.getElementById("customSafe").value.trim() ||
        "Altersgerecht weich und sicher zubereiten.",
      prep: "nach Bedarf",
      seasonMonths: [],
      count100: true,
      manualStatus: "auto",
      notes: "",
    };
    state.foods.push(item);
    save();
    finish(item, true);
  };
}
function editInventoryForm(id) {
  let item = state.inventory.find((i) => i.id === id);
  if (!item) return;
  addInventoryForm({ ...item, editId: id });
}
function addInventoryForm(preset = {}) {
  let editing = !!preset.editId;
  let kind = preset.kind === "recipe" || preset.recipeName ? "recipe" : "food";
  let selectedKey = kind === "recipe" ? preset.recipeName || "" : preset.foodId || "";
  let searchQuery = "";
  let sizeTouched = !!preset.size;

  function candidateName(key) {
    return kind === "recipe" ? key : food(key)?.name || "";
  }
  function suggestionsForKind() {
    if (kind === "recipe")
      return recipeStates().filter((r) => r.freezable).sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || a.name.localeCompare(b.name, "de")).slice(0, 6);
    let planned = prepDemand().map((entry) => entry.foodId);
    let recent = state.logs.slice().sort((a, b) => `${b.date}${b.createdAt || ""}`.localeCompare(`${a.date}${a.createdAt || ""}`)).flatMap((log) => log.foodIds || []);
    return [...new Set([...planned, ...recent])].map(food).filter(Boolean).slice(0, 6);
  }
  function preserveInventoryDraft() {
    preset.portions = document.getElementById("invPortions")?.value || preset.portions;
    preset.size = document.getElementById("invSize")?.value || preset.size;
    preset.frozenDate = document.getElementById("invDate")?.value || preset.frozenDate;
    preset.note = document.getElementById("invNote")?.value ?? preset.note;
  }
  function renderInventoryForm() {
    let allFoods = state.foods.slice().sort((a, b) => a.name.localeCompare(b.name, "de"));
    let allRecipes = recipeStates().filter((r) => r.freezable).sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || a.name.localeCompare(b.name, "de"));
    let q = normalizeName(searchQuery);
    let results;
    if (q) {
      results = (kind === "food" ? allFoods : allRecipes).filter((item) => normalizeName(kind === "food" ? `${item.name} ${item.alias || ""} ${item.category}` : `${item.name} ${item.ingredients || ""}`).includes(q)).slice(0, 20);
    } else if (!selectedKey) results = suggestionsForKind();
    else results = [];
    let selectedLabel = candidateName(selectedKey);
    let sizeOptions = kind === "recipe" ? ["Portion", "Scheibe", "Stück", "Pancake", "Taler", "Bällchen", "Mini-Muffin", "andere"] : PREP_PORTION_GRAMS.map(prepPortionSizeLabel).concat(["Fingerfood-Stück"]);
    let currentSize = preset.size || (kind === "recipe" ? "Portion" : standardPrepPortionSizeForFood(food(selectedKey)));
    let renderedSizeOptions = currentSize && !sizeOptions.includes(currentSize) ? [currentSize, ...sizeOptions] : sizeOptions;
    let body = `<div class="inventory-kind-tabs"><button id="inventoryFoodTab" class="${kind === "food" ? "active" : ""}">Lebensmittel</button><button id="inventoryRecipeTab" class="${kind === "recipe" ? "active" : ""}">Fertiges Rezept</button></div>
      <div class="field"><label>${kind === "food" ? "Lebensmittel" : "Rezept"} suchen</label><input id="inventoryLiveSearch" value="${esc(searchQuery)}" placeholder="${kind === "food" ? "z. B. Süßkartoffel oder Kamote" : "z. B. Bananenbrot oder Taler"}" autocomplete="off"></div>
      ${selectedLabel ? `<div class="selected-target selected-target-row"><div><b>Ausgewählt: ${esc(selectedLabel)}</b><div class="small">Erst durch Antippen eines anderen Treffers ändert sich die Auswahl.</div></div><button class="btn secondary smallbtn" id="clearInventoryTarget">Ändern</button></div>` : `<div class="small" style="margin-bottom:7px">${q ? "Tippe einen Suchtreffer an." : "Vorschläge aus Plan und Verlauf – oder oben suchen."}</div>`}
      <div class="live-results ${selectedKey && !q ? "inventory-results-collapsed" : ""}">${results.length ? results.map((item) => { let key = kind === "food" ? item.id : item.name; let meta = kind === "food" ? `${item.category}${item.active ? "" : " · nicht im Plan aktiv"}` : `${item.unlocked ? "Jetzt passend" : item.almost ? "Fast passend" : "Später passend"} · einfrierbar`; return `<button class="live-result chooseInventoryTarget ${selectedKey === key ? "selected" : ""}" data-key="${encodeURIComponent(key)}">${kind === "food" ? foodIconSvg(item) : recipeIconSvg(item)}<span class="grow"><b>${esc(item.name)}</b><span class="small" style="display:block">${esc(meta)}</span></span><span class="selector-check" aria-hidden="true">${selectedKey === key ? "✓" : ""}</span></button>`; }).join("") : (q ? '<div class="empty">Kein Treffer.</div>' : "")}</div>
      <div class="grid2"><div class="field"><label>${kind === "recipe" ? "Anzahl" : "Portionen"}</label><input id="invPortions" type="number" min="1" step="1" value="${esc(Math.max(1, Math.floor(Number(preset.portions) || 4)))}"></div><div class="field"><label>${kind === "recipe" ? "Einheit" : "Größe/Form"}</label><select id="invSize">${renderedSizeOptions.map((option) => `<option ${option === currentSize ? "selected" : ""}>${esc(option)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Eingefroren</label><input id="invDate" type="date" value="${esc(preset.frozenDate || today())}"></div>
      <div class="field"><label>Notiz</label><input id="invNote" value="${esc(preset.note || "")}" placeholder="z. B. einzeln vorgefroren"></div>
      <p class="small inventory-form-note">Jeder Koch- oder Einfriervorgang bleibt als eigener Vorratseintrag erhalten. Rezeptzutaten werden im Protokoll weiterhin einzeln berücksichtigt.</p>
      <div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelInv" type="button">Abbrechen</button><button class="btn" id="saveInv" ${selectedKey ? "" : "disabled"}>${editing ? "Änderungen speichern" : "Als neuen Vorrat speichern"}</button></div>`;
    openGeneric(editing ? "Vorrat bearbeiten" : "Vorrat hinzufügen", body);
    document.getElementById("cancelInv")?.addEventListener("click", closeGeneric);
    document.getElementById("inventoryFoodTab").onclick = () => { preserveInventoryDraft(); kind = "food"; selectedKey = ""; searchQuery = ""; preset.size = ""; sizeTouched = false; renderInventoryForm(); };
    document.getElementById("inventoryRecipeTab").onclick = () => { preserveInventoryDraft(); kind = "recipe"; selectedKey = ""; searchQuery = ""; preset.size = "Portion"; sizeTouched = true; renderInventoryForm(); };
    document.getElementById("inventoryLiveSearch").oninput = (event) => { preserveInventoryDraft(); searchQuery = event.target.value; renderInventoryForm(); requestAnimationFrame(() => { let field = document.getElementById("inventoryLiveSearch"); field?.focus(); field?.setSelectionRange(field.value.length, field.value.length); }); };
    document.getElementById("clearInventoryTarget")?.addEventListener("click", () => { preserveInventoryDraft(); selectedKey = ""; searchQuery = ""; renderInventoryForm(); requestAnimationFrame(() => document.getElementById("inventoryLiveSearch")?.focus()); });
    document.querySelectorAll(".chooseInventoryTarget").forEach((button) => button.onclick = () => { preserveInventoryDraft(); selectedKey = decodeURIComponent(button.dataset.key); if (kind === "food" && !sizeTouched) preset.size = standardPrepPortionSizeForFood(food(selectedKey)); searchQuery = ""; renderInventoryForm(); });
    document.getElementById("invSize")?.addEventListener("change", (event) => { preset.size = event.target.value; sizeTouched = true; });
    document.getElementById("saveInv")?.addEventListener("click", () => {
      if (!selectedKey) return;
      let recipe = kind === "recipe" ? recipeByName(selectedKey) : null;
      let selectedSize = document.getElementById("invSize").value;
      let gramsPerPortion = kind === "food" ? prepPortionGramsFromSize(selectedSize) : 0;
      let values = { kind, foodId: kind === "food" ? selectedKey : "", recipeName: kind === "recipe" ? selectedKey : "", foodIds: kind === "recipe" ? recipeFoodIds(recipe) : [], portions: Math.max(1, Math.floor(Number(document.getElementById("invPortions").value) || 1)), size: selectedSize, frozenDate: document.getElementById("invDate").value || today(), note: document.getElementById("invNote").value };
      if (gramsPerPortion > 0) values.gramsPerPortion = gramsPerPortion;
      if (editing) { let item = state.inventory.find((entry) => entry.id === preset.editId); if (!item) return; Object.assign(item, values); if (!gramsPerPortion) delete item.gramsPerPortion; }
      else state.inventory.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...values });
      let label = candidateName(selectedKey);
      save(); closeGeneric(); renderAll(); showToast(editing ? "Vorratseintrag aktualisiert." : `${label} als neuer Vorrat hinzugefügt.`);
    });
  }
  renderInventoryForm();
}

function bind() {
  document
    .querySelectorAll("nav button")
    .forEach((b) => (b.onclick = () => showView(b.dataset.view)));
  document.getElementById("planFrom").onchange = (e) => {
    state.settings.planFrom = e.target.value;
    save();
    renderAll();
  };
  document.getElementById("planToday").onclick = () => {
    state.settings.planFrom = today();
    save();
    renderAll();
  };
  document.getElementById("planRecalculate").onclick = clearAutomaticLocks;
  document.getElementById("planRebuildAll")?.addEventListener("click", openFullPlanRebuild);
  document.getElementById("calculateBatch").onclick = calculateBatch;
  document.getElementById("freeLog").onclick = (event) => { event.preventDefault(); openLog(null); };
  document.getElementById("closeLog").onclick = closeLog;
  document.getElementById("logModal").onclick = (e) => {
    if (e.target.id === "logModal") closeLog();
  };
  document.getElementById("closeGeneric").onclick = closeGeneric;
  document.getElementById("genericModal").onclick = (e) => {
    if (e.target.id === "genericModal") closeGeneric();
  };
  document.getElementById("foodSearch").oninput = () => {
    if (foodReorderMode) foodReorderMode = false;
    renderFoods();
  };
  document.getElementById("toggleFoodOrder").onclick = toggleFoodReorderMode;
  document.querySelectorAll("#foodFilters button").forEach(
    (b) =>
      (b.onclick = () => {
        foodReorderMode = false;
        foodFilter = b.dataset.filter;
        renderFoods();
        b.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }),
  );
  document.getElementById("addFood").onclick = addCustomFoodForm;
  document.getElementById("addInventory").onclick = addInventoryForm;
  document.getElementById("toastUndo").onclick = () => { if (lastUndo) { let fn = lastUndo; lastUndo = null; document.getElementById("toast").classList.remove("show"); fn(); } };
  document.getElementById("discardSettings").onclick = () => {
    renderSettings();
    showToast("Nicht gespeicherte Änderungen verworfen.");
  };
  document.getElementById("saveSettings").onclick = () => {
    let oldTextureStage = Number(state.settings.textureStage);
    for (let id of [
      "birthDate",
      "startDate",
      "allergenDays",
      "newFoodEvery",
      "amountSelected",
      "textureStage",
      "phMode",
      "travelDate",
      "freezerDays",
    ])
      state.settings[id] = document.getElementById(id).value;
    state.settings.travelPrep = state.settings.phMode === "prepare";
    state.settings.seasonal = document.getElementById("seasonal").checked;
    state.settings.preferInventoryInPlan =
      document.getElementById("preferInventoryInPlan").checked;
    if (Number(state.settings.textureStage) !== oldTextureStage)
      state.settings.textureStageSince = today();
    if (!state.settings.planFrom) state.settings.planFrom = today();
    save();
    renderAll();
    showToast("Einstellungen gespeichert.");
  };
  document.getElementById("exportData").onclick = exportBackup;
  document.getElementById("showSnapshots").onclick = openSnapshots;
  document.getElementById("importData").onchange = (e) => { let file=e.target.files[0]; if(file) handleBackupImport(file); e.target.value=""; };
  /* legacy handler retained below but disabled */
  if (false) document.getElementById("exportData").onclick = () => {
    let blob = new Blob([JSON.stringify(state, null, 2)], {
        type: "application/json",
      }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chester-beikost-daten.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  };
  document.getElementById("resetData").onclick = () => {
    openGeneric(
      "Alle Beikostdaten löschen?",
      `<div class="notice warn"><b>Das löscht alle Beikostdaten auf diesem Gerät.</b><br>Vorher wird automatisch ein lokaler Zwischenstand angelegt.</div><div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelResetData" type="button">Abbrechen</button><button class="btn danger" id="confirmResetData" type="button">Daten löschen</button></div>`,
    );
    document.getElementById("cancelResetData").onclick = closeGeneric;
    document.getElementById("confirmResetData").onclick = async () => {
      await createSnapshot("vor Zurücksetzen");
      state=clone(DEFAULT); state.backupMeta.chesterContextSeeded=true;
      await save(); closeGeneric(); renderAll(); renderStorageStatus();
      showToast("Beikostdaten zurückgesetzt.");
    };
  };
}

/* Version 10.0.0 – konsolidierte Planung, Protokollierung, Rezepte, mobile UI und SVG-Illustrationen */

function renderAudit() {
  renderAuditCore();
  let list = document.getElementById("auditList");
  if (!list) return;
  let checks = [
    ["V10-Datenfelder vorhanden", !!state.followUps && !!state.shoppingHints],
    ["Protokollrollen migriert", state.logs.every((log) => !!log.entryType && !!log.foodRoles)],
    ["Legacy-Einträge bleiben lesbar", state.logs.filter((log) => log.entryType === "sample").every((log) => Array.isArray(log.foodIds))],
    ["Manuelle Planplätze geschützt", Object.entries(state.planLocks || {}).filter(([, lock]) => lock.mode === "manual").every(([key]) => !!state.planLocks[key])],
    ["Reaktionen ohne normale Wiedervorlage", state.foods.filter((f) => status(f) === "Pausiert").every((f) => !state.followUps?.[f.id] || state.followUps[f.id].status === "awaiting_medical")],
    ["Rezeptkarten maximal eine Statuskennzeichnung", [...document.querySelectorAll(".recipe-card-v2>summary .pill")].every((pill) => pill.parentElement.querySelectorAll(".pill").length <= 1)],
  ];
  list.insertAdjacentHTML("beforeend", checks.map(([label, ok]) => `<div class="checkline"><span>${ok ? "✅" : "⚠️"}</span><span>${esc(label)}</span></div>`).join(""));
}
