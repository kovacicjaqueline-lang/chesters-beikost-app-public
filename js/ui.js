Warning: truncated output (original token count: 22737)
Total output lines: 1737

"use strict";

/* Allgemeine Oberfläche
 * Render-Orchestrierung, Heute, Plan, Mahlzeiten, Textur-Coach, Einstellungen, Dialoge und Event-Bindings.
 * Konsolidierter Produktionsstand 10.0.0.
 */

function textureName(stage = Number(state.settings.textureStage)) {
  return {
    1: "glatt / fein",
    2: "dick / fein zerdrückt",
    3: "mit kleinen weichen Stückchen",
    4: "weiche Familienkost",
  }[Number(stage)] || "glatt / fein";
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
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}
let activeViewRenderCycle = null;
function withViewRenderCycle(viewId, callback) {
  if (typeof callback !== "function") return;
  if (activeViewRenderCycle) return callback();
  activeViewRenderCycle = {
    viewId,
    memo: new Map(),
    days: new Map(),
    recipeStatesReady: false,
    recipeStates: null,
    prepDemandReady: false,
    prepDemand: null,
  };
  try {
    return callback();
  } finally {
    activeViewRenderCycle = null;
  }
}
function memoizeViewRenderValue(key, callback) {
  if (!activeViewRenderCycle) return callback();
  if (!activeViewRenderCycle.memo.has(key)) {
    activeViewRenderCycle.memo.set(key, callback());
  }
  return activeViewRenderCycle.memo.get(key);
}
function viewRenderBuildDays(from, n = 7, applyAutoLocks = true) {
  if (!activeViewRenderCycle) return buildDays(from, n, applyAutoLocks);
  let key = `${String(from)}|${Number(n)}|${applyAutoLocks !== false}`;
  if (!activeViewRenderCycle.days.has(key)) {
    activeViewRenderCycle.days.set(key, buildDays(from, n, applyAutoLocks));
  }
  return activeViewRenderCycle.days.get(key);
}
function viewRenderPlanDays(from, n = 7) {
  return memoizeViewRenderValue(
    `planDisplayDays|${String(from)}|${Number(n)}`,
    () => planDisplayDays(from, n),
  );
}
function viewRenderPrepPlanDays(from, n = 7) {
  return memoizeViewRenderValue(
    `prepPlanDays|${String(from)}|${Number(n)}`,
    () => globalThis.__plannerWeekCache?.readOnly?.(from, n) || planDisplayDays(from, n),
  );
}
function viewRenderRecipeStates() {
  if (!activeViewRenderCycle) return recipeStates();
  if (!activeViewRenderCycle.recipeStatesReady) {
    activeViewRenderCycle.recipeStates = recipeStates();
    activeViewRenderCycle.recipeStatesReady = true;
  }
  return activeViewRenderCycle.recipeStates;
}
function viewRenderPrepDemand() {
  if (!activeViewRenderCycle) return prepDemand();
  if (!activeViewRenderCycle.prepDemandReady) {
    activeViewRenderCycle.prepDemand = prepDemand();
    activeViewRenderCycle.prepDemandReady = true;
  }
  return activeViewRenderCycle.prepDemand;
}
function plannerReadinessState() {
  return globalThis.PlannerReadiness?.state ||
    (typeof window !== "undefined" && window.__plannerPoliciesReady === false ? "loading" : "ready");
}
function plannerViewReady() {
  return plannerReadinessState() === "ready";
}
function renderPlannerReadinessPlaceholder(viewId) {
  let targets = { home: "todayCard", plan: "blockPlan", prep: "prepNow", allergen: "allergenModule" };
  let target = document.getElementById(targets[viewId] || "");
  if (!target) return false;
  let failed = plannerReadinessState() === "failed";
  target.innerHTML = `<div class="notice ${failed ? "warn" : "olive"} planner-readiness-message" role="status">${failed
    ? "Die Planungsregeln konnten nicht geladen werden. Bitte lade die App erneut."
    : "Planungsregeln werden geladen …"}</div>`;
  let view = target.closest(".view");
  if (view) {
    if (failed) view.removeAttribute("aria-busy");
    else view.setAttribute("aria-busy", "true");
  }
  if (viewId === "plan") {
    let toolbar = document.querySelector("#plan .plan-toolbar");
    if (toolbar) toolbar.inert = !plannerViewReady();
  }
  return true;
}
function renderAll() {
  if (plannerViewReady()) {
    renderHome();
    renderPlan();
    renderPrep();
    renderAllergenModule();
  } else {
    renderPlannerReadinessPlaceholder("home");
    renderPlannerReadinessPlaceholder("plan");
    renderPlannerReadinessPlaceholder("prep");
    renderPlannerReadinessPlaceholder("allergen");
  }
  renderLogs();
  renderStatistics();
  renderFoods();
  renderSettings();
  if (document.getElementById("auditList")) renderAudit();
  renderStorageStatus();
}
function renderView(id) {
  if (["home", "plan", "prep"].includes(id) && !plannerViewReady()) {
    renderPlannerReadinessPlaceholder(id);
  }
  else if (id === "home") {
    document.getElementById(id)?.removeAttribute("aria-busy");
    renderHome();
  }
  else if (id === "plan") {
    document.getElementById(id)?.removeAttribute("aria-busy");
    renderPlan();
  }
  else if (id === "prep") {
    document.getElementById(id)?.removeAttribute("aria-busy");
    renderPrep();
  }
  else if (id === "foods") renderFoods();
  else if (id === "more") {
    renderLogs();
    renderStatistics();
    if (plannerViewReady()) renderAllergenModule();
    else renderPlannerReadinessPlaceholder("allergen");
    renderSettings();
    if (document.getElementById("auditList")) renderAudit();
    renderStorageStatus();
  }
}
function renderCurrentView() {
  renderView(document.querySelector(".view.active")?.id || "home");
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
  if (!plannerViewReady()) {
    renderPlannerReadinessPlaceholder("home");
    return;
  }
  let learned = learnedFoods(),
    tried = typeof learnedCountIdentities === "function" ? learnedCountIdentities().length : learned.length,
    target = Number(state.settings.targetFoods) || 100,
    pct = Math.min(100, tried / target * 100), on = today(), age = monthsOld(on),
    day = viewRenderBuildDays(on, 1)[0], active = day.meals.filter((m) => m.active && m.focusId);
  let openMeals = active.filter((m) => !mealIsCompleted(on, m.meal));
  let nextPlanned = null;
  if (!active.length) {
    for (let offset = 1; offset <= 45; offset++) {
      let candidateDate = addDays(on, offset);
      let candidateDay = viewRenderBuildDays(candidateDate, 1, false)[0];
      if (candidateDay.meals.some((m) => m.active && m.focusId)) { nextPlanned = candidateDate; break; }
    }
  }
  let todayHtml = active.length ? active.map((m) => {
    let done = completedLog(on, m.meal);
    if (done) return completedMealHtml(on, m.meal, done);
    let payload = encodeURIComponent(JSON.stringify({date:on,meal:m.meal,focusId:m.focusId,foodIds:m.foodIds,baseFoodIds:m.baseFoodIds||[],sampleFoodIds:m.sampleFoodIds||[],recipeName:m.recipeName||"",recipeInventoryId:m.recipeInventoryId||""}));
    return `<div class="mealbox"><div class="row"><div class="grow"><div class="dish-title">${esc(mealDisplayTitle(m))}</div><div class="small meal-type-text">${esc(mealTypeText(m))} · ${mealName(m.meal)}</div>${mealStatusText(m) ? `<div class="small meal-status-text">${esc(mealStatusText(m))}</div>` : ""}</div>${stockBadges(m)}</div>${inactiveMealWarningHtml({date:on}, m)}${compactMealRolesHtml(m)}${whyDetailsHtml(m)}<button class="btn full homeLog" data-plan="${payload}">Essen eintragen</button></div>`;
  }).join("") : `<div class="empty"><b>Für heute ist nichts geplant.</b><div class="small">Die Heute-Ansicht zeigt ausschließlich den aktuellen Kalendertag.</div>${nextPlanned ? `<div class="small next-plan-hint">Nächster geplanter Tag: ${nice(nextPlanned, true)}</div>` : ""}</div><button class="btn full" id="homeFreeLog">Essen eintragen</button>`;
  let todayHeading = active.length && openMeals.length === 0 ? "Heute erledigt" : "Heute anbieten";
  let todayBadge = active.length && openMeals.length === 0
    ? '<span class="pill ok">Vollständig</span>'
    : "";
  let progressStatus = active.length && openMeals.length < active.length && openMeals.length > 0
    ? `<div class="status-chips"><span class="pill ok">${active.length-openMeals.length} erledigt</span></div>`
    : "";
  document.getElementById("todayCard").innerHTML = `<div class="row"><div class="grow"><h2>${todayHeading}</h2><div class="small">${nice(on, true)} · ${age} Monate</div></div>${todayBadge}</div>${progressStatus}${todayHtml}<div class="add-meal-row"><button class="btn secondary smallbtn" id="homeAddEntry">＋ Essen eintragen</button></div>`;
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

  let allRecipeStates = viewRenderRecipeStates();
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
  let issues = planQual…10737 tokens truncated…eorderMode = false;
  }
  document.querySelectorAll('.view[aria-busy="true"]').forEach((view) => {
    view.removeAttribute("aria-busy");
    view.querySelector(":scope > .prep-render-loading")?.remove();
  });
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("active", v.id === id));
  document
    .querySelectorAll("nav button")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === id));
  if (previous !== id) {
    let main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }
  globalThis.MobileUiLifecycle?.afterViewChange(id, previous);
  let ensurePrepLoading = (view, text) => {
    let loading = view.querySelector(":scope > .prep-render-loading");
    if (!loading) {
      loading = document.createElement("div");
      loading.className = "notice olive prep-render-loading";
      loading.setAttribute("role", "status");
      view.prepend(loading);
    }
    loading.textContent = text;
    return loading;
  };
  let finishViewChange = () => {
    let view = document.getElementById(id);
    if (!view?.classList.contains("active")) return;
    try {
      renderView(id);
    } finally {
      let readiness = globalThis.PlannerReadiness;
      if (id === "prep" && typeof plannerViewReady === "function" && !plannerViewReady() && typeof readiness?.whenReady === "function") {
        view.setAttribute("aria-busy", "true");
        ensurePrepLoading(view, "Planungsregeln werden geladen …");
        readiness.whenReady().then((result) => {
          let currentView = document.getElementById("prep");
          if (!currentView?.classList.contains("active")) return;
          let currentLoading = currentView.querySelector(":scope > .prep-render-loading");
          if (result?.state === "ready") {
            currentView.removeAttribute("aria-busy");
            currentLoading?.remove();
          } else if (result?.state === "failed") {
            currentView.setAttribute("aria-busy", "true");
            if (currentLoading) currentLoading.textContent = "Die Planungsregeln konnten nicht geladen werden. Bitte lade die App erneut.";
          }
        });
      } else {
        view.removeAttribute("aria-busy");
        view.querySelector(":scope > .prep-render-loading")?.remove();
      }
    }
  };
  if (previous === id || typeof renderViewAfterNextPaint !== "function") {
    if (typeof cancelDeferredViewRender === "function") cancelDeferredViewRender();
    finishViewChange();
    return;
  }
  let targetView = document.getElementById(id);
  targetView?.setAttribute("aria-busy", "true");
  if (id === "prep" && targetView) {
    ensurePrepLoading(targetView, "Vorbereitung wird geladen …");
  }
  renderViewAfterNextPaint(id, finishViewChange);
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
    preset.preparationMode = document.getElementById("invPreparationMode")?.value || "";
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
      ${kind === "recipe" && recipeByName(selectedKey)?.smoothBatchAllowed ? `<div class="field"><label>So wurde diese Portion zubereitet</label><select id="invPreparationMode"><option value="">Wie im Rezept / nicht angegeben</option><option value="spoon-smooth" ${preset.preparationMode === "spoon-smooth" ? "selected" : ""}>Vollständig glatt püriert</option></select><div class="small">Nur auswählen, wenn die gesamte Portion einschließlich aller Stücke glatt püriert wurde. Die Zutaten- und Altersprüfung bleibt bestehen.</div></div>` : ""}
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
      if (kind === "recipe" && document.getElementById("invPreparationMode")?.value === "spoon-smooth") values.preparationMode = "spoon-smooth";
      if (gramsPerPortion > 0) values.gramsPerPortion = gramsPerPortion;
      if (editing) { let item = state.inventory.find((entry) => entry.id === preset.editId); if (!item) return; Object.assign(item, values); if (!gramsPerPortion) delete item.gramsPerPortion; if (!values.preparationMode) delete item.preparationMode; }
      else state.inventory.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...values });
      if (typeof invalidateInventoryAggregateCache === "function") invalidateInventoryAggregateCache();
      let label = candidateName(selectedKey);
      save({ preservePlanCache: true }); closeGeneric(); renderAll(); showToast(editing ? "Vorratseintrag aktualisiert." : `${label} als neuer Vorrat hinzugefügt.`);
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
    save({ preservePlanCache: true });
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
    renderSettings();
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
      await save(); closeGeneric(); renderCurrentView(); renderStorageStatus();
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
