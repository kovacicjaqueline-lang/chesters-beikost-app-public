"use strict";

/* Lebensmittelstatus + Vorlieben
 * Laufzeit-Policy nach Model, Planner, Food-UI und allgemeiner UI, aber vor app.js.
 * So verwenden Migration, Planner und Oberfläche denselben fachlichen Vertrag,
 * ohne Statistiklogik oder bestehende Log-Ereignisse umzudeuten.
 */
const FOOD_STATUS_PREFERENCE_ORDER = Object.freeze({
  Offen: 0,
  Probiert: 1,
  Bekannt: 2,
  Pausiert: -1,
});
const FOOD_STATUS_PREFERENCE_MIGRATION_STRENGTH = Object.freeze({
  auto: 0,
  Offen: 1,
  Probiert: 2,
  Bekannt: 3,
  Pausiert: 4,
});

function normalizeFoodStatusPreferenceStatus(value) {
  let statusValue = String(value || "auto");
  if (["Noch nicht", "Offen"].includes(statusValue)) return "Offen";
  if (["Vertragen", "Verträgliche Basis", "Regelmäßig", "Bekannt"].includes(statusValue)) return "Bekannt";
  if (["Pause – Reaktion", "Pausiert"].includes(statusValue)) return "Pausiert";
  if (["Probiert", "auto"].includes(statusValue)) return statusValue;
  return "auto";
}

function foodStatusPreferenceMigrationStrength(value) {
  return FOOD_STATUS_PREFERENCE_MIGRATION_STRENGTH[normalizeFoodStatusPreferenceStatus(value)] ?? 0;
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
  let current = manual !== "auto"
    ? manual
    : deriveFoodStatusPreferenceStatus(foodRecord, logs, outcomeFn);
  if (current === "Pausiert") return false;
  if (current === "Bekannt") return true;
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

  if (typeof normalizeStatus === "function") normalizeStatus = normalizeFoodStatusPreferenceStatus;
  if (typeof statusStrength === "function") statusStrength = foodStatusPreferenceMigrationStrength;
  if (typeof mergeFoodRecord === "function") {
    let originalMergeFoodRecord = mergeFoodRecord;
    mergeFoodRecord = function mergeFoodRecordWithPreference(target, raw, options = {}) {
      originalMergeFoodRecord(target, raw, options);
      if (target && raw && raw.liked === true) target.liked = true;
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
  if (typeof rank === "function") rank = (foodRecord) => FOOD_STATUS_PREFERENCE_ORDER[status(foodRecord)] ?? 0;
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
    canCombine = (foodRecord) => {
      if (status(foodRecord) === "Pausiert") return false;
      return status(foodRecord) === "Bekannt" || foodStatusPreferenceCounts(foodRecord.id, state?.logs || [], outcomeForFood).eaten >= 1;
    };
  }
  if (typeof isTrustedBase === "function") isTrustedBase = (foodRecord) => status(foodRecord) === "Bekannt";
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
        a.priority - b.priority ||
        foodStatusPreferenceLikedTie(a, b)
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
        a.priority - b.priority ||
        foodStatusPreferenceLikedTie(a, b)
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
        return { f: item, type: eatenExposureCount(item.id) >= 1 ? "bekannt kombinieren" : "gezielt wiederholen" };
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
        effectivePriority(a, on) - effectivePriority(b, on) ||
        foodStatusPreferenceLikedTie(a, b)
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
        effectivePriority(a, on) - effectivePriority(b, on) ||
        foodStatusPreferenceLikedTie(a, b)
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

  if (typeof renderHomeCore === "function") {
    let originalRenderHomeCore = renderHomeCore;
    renderHomeCore = function renderHomeCoreWithFoodStatusPreference(...args) {
      let result = originalRenderHomeCore.apply(this, args);
      if (typeof document === "undefined") return result;
      let on = typeof today === "function" ? today() : "";
      let known = (state?.foods || []).filter((foodRecord) => status(foodRecord) === "Bekannt").length;
      let due = typeof dueAllergen === "function"
        ? (state?.foods || []).filter((foodRecord) => dueAllergen(foodRecord, on)).length
        : 0;
      let facts = [];
      if (known) facts.push(`${known} bekannt`);
      if (due) facts.push(`${due} Allergene fällig`);
      let card = document.getElementById("progressCard");
      let existing = card?.querySelector(".progress-facts");
      if (!facts.length) {
        existing?.remove();
        return result;
      }
      if (existing) existing.textContent = facts.join(" · ");
      else card?.querySelector(".progress")?.insertAdjacentHTML("afterend", `<div class="small progress-facts">${esc(facts.join(" · "))}</div>`);
      return result;
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FOOD_STATUS_PREFERENCE_ORDER,
    normalizeFoodStatusPreferenceStatus,
    foodStatusPreferenceMigrationStrength,
    foodStatusPreferenceExposureKey,
    foodStatusPreferenceCounts,
    deriveFoodStatusPreferenceStatus,
    foodStatusPreferenceLiked,
    foodStatusPreferenceCanCombine,
    foodStatusPreferenceShouldRetry,
    foodStatusPreferenceLikedTie,
    installFoodStatusPreferencePolicy,
  };
}
