"use strict";

/* Lebensmittelstatus + Vorlieben
 * Pre-Bootstrap-Policy: dieses Skript wird nach Model, Planner und Food-UI, aber vor
 * app.js geladen. So verwenden Migration, erster Planner-Lauf und UI denselben
 * fachlichen Vertrag, ohne bestehende Log-Ereignisse oder Allergenregeln umzudeuten.
 */
const FOOD_STATUS_PREFERENCE_ORDER = Object.freeze({
  Offen: 0,
  Probiert: 1,
  Bekannt: 2,
  Pausiert: -1,
});

function normalizeFoodStatusPreferenceStatus(value) {
  let statusValue = String(value || "auto");
  if (["Noch nicht", "Offen"].includes(statusValue)) return "Offen";
  if (["Vertragen", "Verträgliche Basis", "Regelmäßig", "Bekannt"].includes(statusValue)) return "Bekannt";
  if (["Pause – Reaktion", "Pausiert"].includes(statusValue)) return "Pausiert";
  if (["Probiert", "auto"].includes(statusValue)) return statusValue;
  return "auto";
}

function foodStatusPreferenceExposureKey(log) {
  if (typeof modelExposureKey === "function") return modelExposureKey(log);
  if (typeof logExposureKey === "function") return logExposureKey(log);
  let date = String(log?.date || "");
  let hasMeal = log?.entryType !== "sample" && ["breakfast", "snack", "lunch", "dinner"].includes(String(log?.meal || ""));
  return hasMeal
    ? `${date}|${log.meal}`
    : `${date}|entry:${log?.id || log?.createdAt || log?.updatedAt || "free"}`;
}

function foodStatusPreferenceOutcome(log, foodId, outcomeFn = null) {
  if (typeof outcomeFn === "function") return outcomeFn(log, foodId);
  if (log?.foodOutcomes?.[foodId]) return log.foodOutcomes[foodId];
  return ({ not_eaten: "not_accepted", tasted_ok: "tried", eaten_ok: "eaten" }[log?.outcome] || log?.outcome || "");
}

function foodStatusPreferenceCounts(foodId, logs = [], outcomeFn = null) {
  let eaten = new Set();
  let positive = new Set();
  for (let log of logs || []) {
    if (!(log?.foodIds || []).includes(foodId)) continue;
    let outcome = foodStatusPreferenceOutcome(log, foodId, outcomeFn);
    if (!["tried", "eaten"].includes(outcome)) continue;
    let key = foodStatusPreferenceExposureKey(log);
    positive.add(key);
    if (outcome === "eaten") eaten.add(key);
  }
  return { eaten: eaten.size, positive: positive.size };
}

function deriveFoodStatusPreferenceStatus(foodRecord, logs = [], outcomeFn = null) {
  if (!foodRecord) return "Offen";
  let relevant = (logs || []).filter((log) => (log?.foodIds || []).includes(foodRecord.id));
  let reaction = relevant.some((log) => {
    let outcome = foodStatusPreferenceOutcome(log, foodRecord.id, outcomeFn);
    return outcome === "reaction" && (!log.reactionFoodId || log.reactionFoodId === foodRecord.id);
  });
  if (reaction) return "Pausiert";
  let counts = foodStatusPreferenceCounts(foodRecord.id, relevant, outcomeFn);
  if (counts.eaten >= 2) return "Bekannt";
  if (counts.positive >= 1) return "Probiert";
  return "Offen";
}

function foodStatusPreferenceLiked(foodRecord) {
  return foodRecord?.liked === true;
}

function foodStatusPreferenceCanCombine(foodRecord, logs = [], outcomeFn = null) {
  let manual = normalizeFoodStatusPreferenceStatus(foodRecord?.manualStatus);
  if (manual === "Bekannt") return true;
  return foodStatusPreferenceCounts(foodRecord?.id, logs, outcomeFn).eaten >= 1;
}

function foodStatusPreferenceShouldRetry(foodRecord, rankValue, lastOutcomeValue) {
  if (lastOutcomeValue === "not_accepted") return true;
  return !!foodRecord?.allergenGroup && Number(rankValue) === 1;
}

function foodStatusPreferenceLikedTie(a, b) {
  return Number(foodStatusPreferenceLiked(b)) - Number(foodStatusPreferenceLiked(a));
}

function installFoodStatusPreferencePolicy() {
  if (typeof globalThis === "undefined" || globalThis.__foodStatusPreferencePolicyInstalled) return false;
  globalThis.__foodStatusPreferencePolicyInstalled = true;

  if (typeof normalizeStatus === "function") {
    normalizeStatus = normalizeFoodStatusPreferenceStatus;
  }
  if (typeof statusStrength === "function") {
    statusStrength = (value) => FOOD_STATUS_PREFERENCE_ORDER[normalizeFoodStatusPreferenceStatus(value)] ?? 0;
  }
  if (typeof mergeFoodRecord === "function") {
    let originalMergeFoodRecord = mergeFoodRecord;
    mergeFoodRecord = function mergeFoodRecordWithPreference(target, raw, options = {}) {
      originalMergeFoodRecord(target, raw, options);
      if (target && raw && Object.prototype.hasOwnProperty.call(raw, "liked")) target.liked = raw.liked === true;
    };
  }

  if (typeof autoStatus === "function") {
    autoStatus = (foodRecord) => deriveFoodStatusPreferenceStatus(foodRecord, state?.logs || [], outcomeForFood);
  }
  if (typeof status === "function") {
    status = (foodRecord) => {
      let manual = normalizeFoodStatusPreferenceStatus(foodRecord?.manualStatus);
      return manual !== "auto" ? manual : autoStatus(foodRecord);
    };
  }
  if (typeof rank === "function") {
    rank = (foodRecord) => FOOD_STATUS_PREFERENCE_ORDER[status(foodRecord)] ?? 0;
  }
  if (typeof statusSource === "function") {
    statusSource = (foodRecord) => {
      let manual = normalizeFoodStatusPreferenceStatus(foodRecord?.manualStatus);
      if (manual !== "auto") return "manuell gesetzt";
      let counts = foodStatusPreferenceCounts(foodRecord?.id, state?.logs || [], outcomeForFood);
      if (counts.eaten >= 2) return `automatisch aus ${counts.eaten} getrennten gegessenen Expositionen`;
      if (counts.eaten === 1) return "automatisch aus einer gegessenen Exposition";
      if (counts.positive > 1) return `automatisch aus ${counts.positive} protokollierten Probier-Expositionen`;
      if (counts.positive === 1) return "automatisch aus einer protokollierten Probier-Exposition";
      return "automatisch – noch ohne Protokoll";
    };
  }
  if (typeof learningRoleLabel === "function") {
    learningRoleLabel = (_rankValue = 0, statusValue = "", type = "") => {
      if (String(statusValue || "") === "Pausiert") return "Pausiert";
      return new Set(["gezielt wiederholen", "Allergen wiederholen", "nach Einführung"]).has(String(type || ""))
        ? "Wiederholung"
        : "Einführung";
    };
  }

  if (typeof canCombine === "function") {
    canCombine = (foodRecord) => status(foodRecord) === "Bekannt" || foodStatusPreferenceCounts(foodRecord.id, state?.logs || [], outcomeForFood).eaten >= 1;
  }
  if (typeof isTrustedBase === "function") {
    isTrustedBase = (foodRecord) => status(foodRecord) === "Bekannt";
  }
  if (typeof knownBase === "function") {
    knownBase = function foodStatusPreferenceKnownBase(meal, exclude = []) {
      let pool = state.foods.filter((foodRecord) =>
        foodRecord.active &&
        foodRecord.meals.includes(meal) &&
        !foodRecord.allergenGroup &&
        isTrustedBase(foodRecord) &&
        !exclude.includes(foodRecord.id) &&
        foodRecord.category !== "Kraut/Gewürz" &&
        foodRecord.category !== "Fett"
      );
      pool.sort((a, b) =>
        usageCount(a.id) - usageCount(b.id) ||
        foodStatusPreferenceLikedTie(a, b) ||
        a.priority - b.priority
      );
      return pool[0] || null;
    };
  }

  if (typeof companionFor === "function") {
    companionFor = function foodStatusPreferenceCompanionFor(focus, meal, on, focusType = "") {
      if (focus.allergenGroup) return knownBase(meal, [focus.id]);
      let introductionTypes = new Set(["neu", "gezielt wiederholen", "Allergen wiederholen", "manuell"]);
      let needsTrustedBase = introductionTypes.has(focusType) && !isTrustedBase(focus);
      let pool = state.foods.filter((candidate) => {
        let normalMealMatch = eligible(candidate, meal, on);
        let flexibleCerealMatch =
          focus.category === "Getreide/Stärke" &&
          candidate.active &&
          status(candidate) !== "Pausiert" &&
          ["Obst", "Gemüse", "Wurzel/Knolle"].includes(candidate.category);
        let allowedStatus = needsTrustedBase ? isTrustedBase(candidate) : canCombine(candidate);
        return (
          (normalMealMatch || flexibleCerealMatch) &&
          allowedStatus &&
          !candidate.allergenGroup &&
          !(isMilkProductFood(focus) && isMeatOrFish(candidate)) &&
          !(isMeatOrFish(focus) && isMilkProductFood(candidate)) &&
          candidate.id !== focus.id &&
          candidate.category !== "Kraut/Gewürz" &&
          candidate.category !== "Fett"
        );
      });
      let wanted = [];
      if (focus.category === "Getreide/Stärke") {
        wanted = meal === "breakfast" ? ["Obst", "Gemüse", "Wurzel/Knolle"] : ["Gemüse", "Wurzel/Knolle", "Obst"];
      } else if (meal === "breakfast") {
        wanted = focus.category === "Obst" ? ["Getreide/Stärke", "Milchprodukt"] : ["Obst", "Getreide/Stärke"];
      } else if (["Fleisch", "Fisch", "Meeresfrucht", "Hülsenfrucht"].includes(focus.category)) {
        wanted = ["Gemüse", "Wurzel/Knolle", "Getreide/Stärke"];
      } else if (["Gemüse", "Wurzel/Knolle"].includes(focus.category)) {
        wanted = ["Getreide/Stärke", "Gemüse", "Wurzel/Knolle"];
      } else {
        wanted = ["Gemüse", "Getreide/Stärke", "Obst", "Wurzel/Knolle"];
      }
      pool.sort((a, b) =>
        culinaryCompatibilityScore(focus, a, meal) - culinaryCompatibilityScore(focus, b, meal) ||
        (wanted.includes(a.category) ? -1 : 0) - (wanted.includes(b.category) ? -1 : 0) ||
        usageCount(a.id) - usageCount(b.id) ||
        foodStatusPreferenceLikedTie(a, b) ||
        a.priority - b.priority
      );
      return pool[0] || null;
    };
  }

  if (typeof introductionCandidate === "function") {
    introductionCandidate = function foodStatusPreferenceIntroductionCandidate(meal, on, ctx, exclude = []) {
      let key = `${on}|${meal}`;
      let override = state.overrides[key];
      if (override) {
        let item = food(override);
        if (item && eligible(item, meal, on)) return { f: item, type: rank(item) >= 2 ? "bekannt" : "manuell" };
      }
      let baseExists = !!knownBase(meal, exclude);
      let pool = state.foods.filter((item) =>
        eligible(item, meal, on) &&
        !exclude.includes(item.id) &&
        !ctx.reserved.has(item.id)
      );
      let retries = pool.filter((item) => foodStatusPreferenceShouldRetry(item, rank(item), lastOutcome(item.id)));
      retries.sort((a, b) => effectivePriority(a, on) - effectivePriority(b, on));
      if (retries.length) {
        let item = retries[0];
        return {
          f: item,
          type: eatenExposureCount(item.id) >= 1 ? "bekannt kombinieren" : "gezielt wiederholen",
        };
      }
      let due = pool.filter((item) => dueAllergen(item, on) && baseExists);
      due.sort((a, b) => (lastDate(a.id, true) || "").localeCompare(lastDate(b.id, true)));
      if (due.length) return { f: due[0], type: "Allergen wiederholen" };
      let fresh = pool.filter((item) => rank(item) === 0 && (!item.allergenGroup || baseExists));
      fresh.sort((a, b) => effectivePriority(a, on) - effectivePriority(b, on));
      return fresh.length ? { f: fresh[0], type: fresh[0].allergenGroup ? "Allergen einführen" : "neu" } : null;
    };
  }

  if (typeof chooseFocus === "function") {
    chooseFocus = function foodStatusPreferenceChooseFocus(meal, on, exclude = [], key = "") {
      let override = state.overrides[key];
      if (override) {
        let item = food(override);
        if (item && eligible(item, meal, on)) return { f: item, type: "manuell" };
      }
      let baseExists = !!knownBase(meal, exclude);
      let pool = state.foods.filter((item) => eligible(item, meal, on) && !exclude.includes(item.id));
      let retries = pool.filter((item) => foodStatusPreferenceShouldRetry(item, rank(item), lastOutcome(item.id)));
      retries.sort((a, b) => effectivePriority(a, on) - effectivePriority(b, on));
      if (retries.length) {
        let item = retries[0];
        return { f: item, type: eatenExposureCount(item.id) >= 1 ? "bekannt kombinieren" : "gezielt wiederholen" };
      }
      let due = pool.filter((item) => dueAllergen(item, on) && baseExists);
      due.sort((a, b) => (lastDate(a.id, true) || "").localeCompare(lastDate(b.id, true)));
      if (due.length) return { f: due[0], type: "Allergen wiederholen" };
      let fresh = pool.filter((item) => rank(item) === 0 && (!item.allergenGroup || baseExists));
      fresh.sort((a, b) => effectivePriority(a, on) - effectivePriority(b, on));
      if (fresh.length) return { f: fresh[0], type: fresh[0].allergenGroup ? "Allergen einführen" : "neu" };
      let known = pool.filter((item) => rank(item) >= 2);
      known.sort((a, b) =>
        usageCount(a.id) - usageCount(b.id) ||
        foodStatusPreferenceLikedTie(a, b) ||
        effectivePriority(a, on) - effectivePriority(b, on)
      );
      return known.length ? { f: known[0], type: "bekannt" } : null;
    };
  }

  if (typeof knownCandidate === "function") {
    knownCandidate = function foodStatusPreferenceKnownCandidate(meal, on, ctx, exclude = []) {
      let key = `${on}|${meal}`;
      let override = state.overrides[key];
      if (override) {
        let item = food(override);
        if (item && eligible(item, meal, on)) return { f: item, type: canCombine(item) ? "bekannt / kombiniert" : "manuell" };
      }
      let pool = state.foods.filter((item) =>
        eligible(item, meal, on) &&
        canCombine(item) &&
        !(ctx.fullMilkDates?.has(on) && isMilkProductFood(item)) &&
        !exclude.includes(item.id)
      );
      let recentFocusPenalty = (item) => {
        let last = ctx.lastFocus?.get(item.id);
        if (!last) return 0;
        let distance = diffDays(on, last);
        if (distance <= 0) return 500;
        if (distance === 1) return 250;
        if (distance === 2) return 80;
        return 0;
      };
      let inventoryPreference = (item) => {
        if (!state.settings.preferInventoryInPlan) return 0;
        let reserved = ctx.inventoryReserved?.get(item.id) || 0;
        return inventoryPortions(item.id) > reserved ? -160 : 0;
      };
      pool.sort((a, b) =>
        recentFocusPenalty(a) - recentFocusPenalty(b) ||
        inventoryPreference(a) - inventoryPreference(b) ||
        (ctx.plannedUse.get(a.id) || 0) - (ctx.plannedUse.get(b.id) || 0) ||
        usageCount(a.id) - usageCount(b.id) ||
        foodStatusPreferenceLikedTie(a, b) ||
        effectivePriority(a, on) - effectivePriority(b, on)
      );
      if (pool.length) {
        let item = pool[0];
        return {
          f: item,
          type: state.settings.preferInventoryInPlan && inventoryPortions(item.id) > (ctx.inventoryReserved?.get(item.id) || 0)
            ? "bekannt / Vorrat"
            : isTrustedBase(item)
              ? "bekannt / Vorrat"
              : "bekannt kombinieren",
        };
      }
      let last = [...ctx.introduced].reverse().map((id) => food(id)).find((item) => item && eligible(item, meal, on));
      return last ? { f: last, type: "nach Einführung" } : null;
    };
  }

  if (typeof showFoodInfoCore === "function") {
    let originalShowFoodInfoCore = showFoodInfoCore;
    showFoodInfoCore = function showFoodInfoCoreWithPreference(foodRecord) {
      originalShowFoodInfoCore(foodRecord);
      if (typeof document === "undefined") return;
      let select = document.getElementById("foodDetailsStatus");
      if (select) {
        let manual = normalizeFoodStatusPreferenceStatus(foodRecord.manualStatus);
        select.innerHTML = [
          `<option value="auto">Automatisch → ${esc(status(foodRecord))}</option>`,
          ...["Offen", "Probiert", "Bekannt", "Pausiert"].map((value) => `<option value="${value}">${value} manuell</option>`),
        ].join("");
        select.value = manual;
      }
      let statusChips = document.querySelector(".food-detail-status");
      if (foodStatusPreferenceLiked(foodRecord) && statusChips && !statusChips.querySelector("[data-food-liked-chip]")) {
        statusChips.insertAdjacentHTML("beforeend", '<span class="pill" data-food-liked-chip>❤️ Wird gern gegessen</span>');
      }
      let settings = document.querySelector(".food-detail-settings");
      if (settings && !document.getElementById("foodDetailsLiked")) {
        let label = document.createElement("label");
        label.className = "toggleline";
        label.innerHTML = `<input class="ds-toggle-input" type="checkbox" id="foodDetailsLiked" ${foodStatusPreferenceLiked(foodRecord) ? "checked" : ""}><span class="toggle-copy"><b>❤️ Wird gern gegessen</b><span class="small">Optional. Nicht markiert bedeutet neutral.</span></span><span class="toggle-state" aria-hidden="true"></span>`;
        settings.appendChild(label);
        document.getElementById("foodDetailsLiked").onchange = (event) => {
          foodRecord.liked = event.target.checked === true;
          save();
          renderAll();
          showFoodInfo(food(foodRecord.id));
        };
      }
    };
  }

  if (typeof document !== "undefined") {
    let statusTopic = [...document.querySelectorAll(".help-topic")]
      .find((detail) => detail.querySelector("summary")?.textContent?.trim() === "Lebensmittelstatus");
    let body = statusTopic?.querySelector(".small");
    if (body) {
      body.innerHTML = `
        <p><b>Offen:</b> noch kein positiver Kontakt protokolliert.</p>
        <p><b>Probiert:</b> mindestens einmal probiert oder einmal gegessen. Mehrfaches Probieren zählt als Erfahrung, macht das Lebensmittel aber nicht automatisch bekannt.</p>
        <p><b>Kombinierbar:</b> ab einer gegessenen Exposition darf das Lebensmittel als bekannte Komponente verwendet werden.</p>
        <p><b>Bekannt:</b> ab zwei getrennten gegessenen Expositionen. Weitere gegessene Expositionen erzeugen keinen zusätzlichen Status.</p>
        <p><b>Pausiert:</b> Sonderstatus; im automatischen Planner ausgeschlossen.</p>
        <p><b>❤️ Wird gern gegessen:</b> unabhängige optionale Vorliebe. Nicht markiert bedeutet neutral, nicht „mag er nicht“.</p>
        <p>Deaktivierte Lebensmittel bleiben gespeichert, werden aber nicht neu automatisch eingeplant.</p>`;
    }
  }

  return true;
}

if (typeof window !== "undefined") installFoodStatusPreferencePolicy();

/* Statistik 10.1.15
 * Rein aus dem bestehenden Protokoll abgeleitete, nicht persistierte Kennzahlen.
 * Keine Schemaänderung und keine medizinische Bewertung.
 */

let statisticsRange = "7";

function statisticsRangeInfo(range = statisticsRange) {
  let end = today();
  if (range === "30") return { key: "30", start: addDays(end, -29), end, label: "30 Tage" };
  if (range === "all") return { key: "all", start: state.settings.startDate || "0000-01-01", end, label: "Seit Beikoststart" };
  return { key: "7", start: addDays(end, -6), end, label: "7 Tage" };
}

function statisticsLogs(range = statisticsRange) {
  let { start, end } = statisticsRangeInfo(range);
  return state.logs.filter((log) => log.date && log.date >= start && log.date <= end);
}

function statisticsPositiveOutcome(outcome) {
  return outcome === "eaten" || outcome === "tried";
}

function statisticsCountableIdentityIds(id) {
  let item = food(id);
  if (!item || item.count100 === false) return [];
  if (typeof resolvedCount100Identities === "function") return resolvedCount100Identities(item);
  let canonical = canonicalId(item.id, item.name);
  return canonical ? [canonical] : [];
}

function statisticsCountableFoodId(id) {
  return statisticsCountableIdentityIds(id)[0] || "";
}

function statisticsFirstPositiveDate(foodId) {
  let dates = state.logs
    .filter((log) => (log.foodIds || []).includes(foodId) && statisticsPositiveOutcome(outcomeForFood(log, foodId)))
    .map((log) => log.date)
    .filter(Boolean)
    .sort();
  return dates[0] || "";
}

function statisticsFirstPositiveDateByIdentity() {
  let firstDates = new Map();
  for (let log of state.logs || []) {
    if (!log.date) continue;
    for (let id of new Set(log.foodIds || [])) {
      if (!statisticsPositiveOutcome(outcomeForFood(log, id))) continue;
      for (let identity of statisticsCountableIdentityIds(id)) {
        let previous = firstDates.get(identity);
        if (!previous || log.date < previous) firstDates.set(identity, log.date);
      }
    }
  }
  return firstDates;
}

function statisticsTextureCounts(logs) {
  if (typeof logTextureCounts === "function") return logTextureCounts(logs, outcomeForFood);
  let counts = [0, 0, 0, 0];
  for (let log of logs || []) {
    let stage = log?.textureKnown === false ? null : Number(log?.textureStage);
    if (![1, 2, 3, 4].includes(stage)) continue;
    if (!(log.foodIds || []).some((id) => statisticsPositiveOutcome(outcomeForFood(log, id)))) continue;
    counts[stage - 1] += 1;
  }
  return counts;
}

function statisticsSnapshot(range = statisticsRange) {
  let info = statisticsRangeInfo(range);
  let logs = statisticsLogs(range);
  let positiveIdentities = new Set();
  let introducedIdentities = new Set();
  let firstPositiveDates = statisticsFirstPositiveDateByIdentity();
  let outcomeCounts = { eaten: 0, tried: 0, not_accepted: 0, not_offered: 0, reaction: 0 };

  for (let log of logs) {
    for (let id of new Set(log.foodIds || [])) {
      let outcome = outcomeForFood(log, id);
      if (Object.prototype.hasOwnProperty.call(outcomeCounts, outcome)) outcomeCounts[outcome] += 1;
      if (!statisticsPositiveOutcome(outcome)) continue;
      for (let identity of statisticsCountableIdentityIds(id)) {
        positiveIdentities.add(identity);
        let firstDate = firstPositiveDates.get(identity) || "";
        if (firstDate && firstDate >= info.start && firstDate <= info.end) introducedIdentities.add(identity);
      }
    }
  }

  let eatenLogs = logs.filter((log) => (log.foodIds || []).some((id) => outcomeForFood(log, id) === "eaten"));
  let textureCounts = statisticsTextureCounts(logs);
  let amounts = eatenLogs
    .map((log) => Number(log.amount))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  let averageAmount = amounts.length ? Math.round(amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length) : 0;
  let maxAmount = amounts.length ? Math.max(...amounts) : 0;

  return {
    info,
    logs,
    days: new Set(logs.map((log) => log.date).filter(Boolean)).size,
    entryCount: logs.length,
    mealCount: logs.length,
    sampleCount: 0,
    varietyCount: positiveIdentities.size,
    introducedCount: introducedIdentities.size,
    outcomeCounts,
    textureCounts,
    amounts,
    averageAmount,
    maxAmount,
    totalLearned: typeof learnedCountIdentities === "function" ? learnedCountIdentities().length : learnedFoods().length,
    targetFoods: Number(state.settings.targetFoods) || 100,
  };
}

function statisticsMetric(value, label, hint = "") {
  return `<div class="metric statistics-metric"><b>${esc(value)}</b><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ""}</div>`;
}

function statisticsOutcomeRow(key, label, value, total) {
  let pct = total ? Math.round(value / total * 100) : 0;
  return `<div class="statistics-bar-row" data-stat-outcome="${key}"><div class="statistics-bar-head"><span>${esc(label)}</span><b>${value}</b></div><div class="statistics-bar" aria-label="${esc(label)}: ${value}"><span style="width:${pct}%"></span></div></div>`;
}

function statisticsTextureRow(stage, value, maxValue) {
  let pct = maxValue ? Math.round(value / maxValue * 100) : 0;
  return `<div class="statistics-bar-row" data-stat-texture="${stage}"><div class="statistics-bar-head"><span>Stufe ${stage} · ${esc(textureName(stage))}</span><b>${value}</b></div><div class="statistics-bar" aria-label="Konsistenzstufe ${stage}: ${value} positive Einträge"><span style="width:${pct}%"></span></div></div>`;
}

function renderStatistics() {
  let body = document.getElementById("statisticsBody");
  let summary = document.getElementById("statisticsSummary");
  if (!body) return;

  let snapshot = statisticsSnapshot();
  if (summary) summary.textContent = `${snapshot.info.label} · ${snapshot.logs.length} ${snapshot.logs.length === 1 ? "Eintrag" : "Einträge"}`;

  let buttons = `<div class="seg statistics-range" id="statisticsRange" role="group" aria-label="Zeitraum der Statistik">
    <button type="button" data-stat-range="7" class="${statisticsRange === "7" ? "active" : ""}">7 Tage</button>
    <button type="button" data-stat-range="30" class="${statisticsRange === "30" ? "active" : ""}">30 Tage</button>
    <button type="button" data-stat-range="all" class="${statisticsRange === "all" ? "active" : ""}">Seit Beikoststart</button>
  </div>`;

  if (!snapshot.logs.length) {
    body.innerHTML = `${buttons}<div class="empty statistics-empty"><b>Noch keine Einträge in diesem Zeitraum.</b><div class="small">Sobald du Essen protokollierst, wird die Entwicklung hier automatisch zusammengefasst.</div><button class="btn statistics-add-log" type="button">Eintrag anlegen</button></div>`;
    bindStatisticsActions();
    return;
  }

  let progressPct = Math.min(100, snapshot.targetFoods ? snapshot.totalLearned / snapshot.targetFoods * 100 : 0);
  let outcomesTotal = Object.values(snapshot.outcomeCounts).reduce((sum, value) => sum + value, 0);
  let textureMax = Math.max(...snapshot.textureCounts, 0);
  let amountHtml = snapshot.amounts.length
    ? `<div class="statistics-section"><h3>Mengenentwicklung</h3><div class="grid2 statistics-amounts">${statisticsMetric(`${snapshot.averageAmount} g`, "Durchschnitt", `aus ${snapshot.amounts.length} ${snapshot.amounts.length === 1 ? "Mengenangabe" : "Mengenangaben"}`)}${statisticsMetric(`${snapshot.maxAmount} g`, "Höchste Menge", "nur gegessene Einträge")}</div></div>`
    : `<div class="notice statistics-amount-note">Für diesen Zeitraum wurden bei gegessenen Einträgen keine Mengen eingetragen. Die übrige Statistik bleibt davon vollständig nutzbar.</div>`;

  body.innerHTML = `${buttons}
    <div class="statistics-progress-block">
      <div class="statistics-progress-head"><div><h3>100-Lebensmittel-Fortschritt</h3><div class="small">Gesamtstand seit Beikoststart</div></div><b>${snapshot.totalLearned} / ${snapshot.targetFoods}</b></div>
      <div class="progress statistics-progress"><span style="width:${progressPct}%"></span></div>
    </div>
    <div class="grid2 statistics-metrics">
      ${statisticsMetric(snapshot.days, "Tage mit Eintrag")}
      ${statisticsMetric(snapshot.entryCount, "Einträge")}
      ${statisticsMetric(snapshot.varietyCount, "Verschiedene Lebensmittel", "gegessen oder probiert")}
      ${statisticsMetric(snapshot.introducedCount, "Neu kennengelernt", statisticsRange === "all" ? "seit Beikoststart" : "in diesem Zeitraum")}
    </div>
    <div class="statistics-section">
      <h3>Ergebnisse im Protokoll</h3>
      <div class="small statistics-section-copy">Jedes enthaltene Lebensmittel zählt mit seinem protokollierten Ergebnis einmal.</div>
      <div class="statistics-bars">
        ${statisticsOutcomeRow("eaten", "Gegessen", snapshot.outcomeCounts.eaten, outcomesTotal)}
        ${statisticsOutcomeRow("tried", "Probiert", snapshot.outcomeCounts.tried, outcomesTotal)}
        ${statisticsOutcomeRow("not_accepted", "Nicht angenommen", snapshot.outcomeCounts.not_accepted, outcomesTotal)}
        ${statisticsOutcomeRow("not_offered", "Nicht angeboten", snapshot.outcomeCounts.not_offered, outcomesTotal)}
        ${statisticsOutcomeRow("reaction", "Reaktion", snapshot.outcomeCounts.reaction, outcomesTotal)}
      </div>
    </div>
    <div class="statistics-section">
      <h3>Konsistenzfortschritt</h3>
      <div class="small statistics-section-copy">Gezählt werden positive Einträge mit ausdrücklich dokumentierter Konsistenz.</div>
      <div class="statistics-bars">
        ${[1, 2, 3, 4].map((stage, index) => statisticsTextureRow(stage, snapshot.textureCounts[index], textureMax)).join("")}
      </div>
    </div>
    ${amountHtml}`;
  bindStatisticsActions();
}

function bindStatisticsActions() {
  document.querySelectorAll("#statisticsRange [data-stat-range]").forEach((button) => {
    button.onclick = () => {
      statisticsRange = button.dataset.statRange || "7";
      renderStatistics();
    };
  });
  document.querySelector(".statistics-add-log")?.addEventListener("click", () => openLog(null));
}

function resetStatisticsTransientUi() {
  statisticsRange = "7";
  let details = document.getElementById("statisticsDetails");
  if (details) details.open = false;
  renderStatistics();
}
