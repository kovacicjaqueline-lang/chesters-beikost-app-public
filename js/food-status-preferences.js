"use strict";

/* Lebensmittelstatus + Vorlieben
 * Kleiner Runtime-Adapter zwischen kanonischem Statusmodell, bestehendem Planner
 * und Lebensmittel-Detailansicht. Statusableitung und Migration bleiben in
 * state.js/model.js/migrations.js die einzige fachliche Wahrheit.
 */

function foodStatusPreferenceLiked(foodRecord) {
  return foodRecord?.liked === true;
}

function foodStatusPreferenceMergeLiked(currentLiked, incomingLiked) {
  return currentLiked === true || incomingLiked === true;
}

function foodStatusPreferenceLikedTie(a, b) {
  return Number(foodStatusPreferenceLiked(b)) - Number(foodStatusPreferenceLiked(a));
}

function foodStatusPreferenceCanCombine(foodRecord, statusValue, eatenCount = 0) {
  if (!foodRecord || statusValue === "Pausiert") return false;
  return statusValue === "Bekannt" || Number(eatenCount) >= 1;
}

function foodStatusPreferenceShouldRetry(foodRecord, rankValue, lastOutcomeValue) {
  if (lastOutcomeValue === "not_accepted") return true;
  return !!foodRecord?.allergenGroup && Number(rankValue) === 1;
}

function foodStatusPreferenceShouldSkipAutomaticResult(result, rankValue, lastOutcomeValue) {
  if (!result?.f || result.type === "manuell") return false;
  if (Number(rankValue) !== 1 || result.f.allergenGroup) return false;
  return !foodStatusPreferenceShouldRetry(result.f, rankValue, lastOutcomeValue);
}

function foodStatusPreferenceNextAutomaticResult(producer, exclude = []) {
  let blocked = [...exclude];
  let max = (state?.foods?.length || 0) + 1;
  for (let index = 0; index < max; index++) {
    let result = producer(blocked);
    if (!result?.f) return result;
    if (!foodStatusPreferenceShouldSkipAutomaticResult(
      result,
      rank(result.f),
      lastOutcome(result.f.id),
    )) return result;
    if (blocked.includes(result.f.id)) return null;
    blocked.push(result.f.id);
  }
  return null;
}

function foodStatusPreferenceKnownBase(meal, exclude = []) {
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
}

function foodStatusPreferenceCompanionFor(focus, meal, on, focusType = "") {
  if (focus.allergenGroup) return knownBase(meal, [focus.id]);

  let introductionTypes = new Set([
    "neu",
    "gezielt wiederholen",
    "Allergen wiederholen",
    "manuell",
  ]);
  let needsTrustedBase = introductionTypes.has(focusType) && !isTrustedBase(focus);

  let pool = state.foods.filter((candidate) => {
    let normalMealMatch = eligible(candidate, meal, on);
    let flexibleCerealMatch =
      focus.category === "Getreide/Stärke" &&
      candidate.active &&
      status(candidate) !== "Pausiert" &&
      ["Obst", "Gemüse", "Wurzel/Knolle"].includes(candidate.category);
    let allowedStatus = needsTrustedBase
      ? isTrustedBase(candidate)
      : canCombine(candidate);

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
    wanted = meal === "breakfast"
      ? ["Obst", "Gemüse", "Wurzel/Knolle"]
      : ["Gemüse", "Wurzel/Knolle", "Obst"];
  } else if (meal === "breakfast") {
    wanted = focus.category === "Obst"
      ? ["Getreide/Stärke", "Milchprodukt"]
      : ["Obst", "Getreide/Stärke"];
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
}

function foodStatusPreferenceProgressLabels(knownCount = 0, dueCount = 0) {
  let known = Math.max(0, Number(knownCount) || 0);
  let due = Math.max(0, Number(dueCount) || 0);
  let facts = [];
  if (known) facts.push(`${known} bekannt`);
  if (due) facts.push(`${due} ${due === 1 ? "Allergen" : "Allergene"} fällig`);
  return facts;
}

function syncFoodStatusPreferenceProgressFacts() {
  if (typeof document === "undefined") return;
  let card = document.getElementById("progressCard");
  if (!card) return;

  let on = typeof today === "function" ? today() : "";
  let known = (state?.foods || []).filter((foodRecord) => status(foodRecord) === "Bekannt").length;
  let due = typeof dueAllergen === "function"
    ? (state?.foods || []).filter((foodRecord) => dueAllergen(foodRecord, on)).length
    : 0;
  let text = foodStatusPreferenceProgressLabels(known, due).join(" · ");
  let existing = card.querySelector(".progress-facts");

  if (!text) {
    existing?.remove();
    return;
  }
  if (existing) {
    if (existing.textContent !== text) existing.textContent = text;
    return;
  }
  let progress = card.querySelector(".progress");
  if (!progress) return;
  let facts = document.createElement("div");
  facts.className = "small progress-facts";
  facts.textContent = text;
  progress.insertAdjacentElement("afterend", facts);
}

function installFoodStatusPreferenceProgressSync() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return false;
  if (globalThis.__foodStatusPreferenceProgressObserver) return true;

  let attach = () => {
    if (globalThis.__foodStatusPreferenceProgressObserver) return;
    let card = document.getElementById("progressCard");
    if (!card) return;
    let observer = new MutationObserver(() => syncFoodStatusPreferenceProgressFacts());
    observer.observe(card, { childList: true, subtree: true });
    globalThis.__foodStatusPreferenceProgressObserver = observer;
    syncFoodStatusPreferenceProgressFacts();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach, { once: true });
  } else {
    attach();
  }
  return true;
}

function installFoodStatusPreferencePolicy() {
  if (typeof globalThis === "undefined" || globalThis.__foodStatusPreferencePolicyInstalled) return false;
  globalThis.__foodStatusPreferencePolicyInstalled = true;

  if (typeof mergeFoodRecord === "function") {
    let originalMergeFoodRecord = mergeFoodRecord;
    mergeFoodRecord = function mergeFoodRecordWithPreference(target, raw, options = {}) {
      let wasLiked = target?.liked === true;
      originalMergeFoodRecord(target, raw, options);
      if (target && raw) target.liked = foodStatusPreferenceMergeLiked(wasLiked, raw.liked);
    };
  }

  if (typeof canCombine === "function") {
    canCombine = (foodRecord) => foodStatusPreferenceCanCombine(
      foodRecord,
      status(foodRecord),
      eatenExposureCount(foodRecord.id),
    );
  }
  if (typeof isTrustedBase === "function") {
    isTrustedBase = (foodRecord) => !!foodRecord && status(foodRecord) === "Bekannt";
  }
  if (typeof knownBase === "function") {
    knownBase = foodStatusPreferenceKnownBase;
  }
  if (typeof companionFor === "function") {
    companionFor = foodStatusPreferenceCompanionFor;
  }

  if (typeof chooseFocus === "function") {
    let originalChooseFocus = chooseFocus;
    chooseFocus = (meal, on, exclude = [], key = "") =>
      foodStatusPreferenceNextAutomaticResult(
        (blocked) => originalChooseFocus(meal, on, blocked, key),
        exclude,
      );
  }
  if (typeof introductionCandidate === "function") {
    let originalIntroductionCandidate = introductionCandidate;
    introductionCandidate = (meal, on, ctx, exclude = []) =>
      foodStatusPreferenceNextAutomaticResult(
        (blocked) => originalIntroductionCandidate(meal, on, ctx, blocked),
        exclude,
      );
  }

  if (typeof showFoodInfoCore === "function") {
    let originalShowFoodInfoCore = showFoodInfoCore;
    showFoodInfoCore = function showFoodInfoCoreWithPreference(foodRecord) {
      originalShowFoodInfoCore(foodRecord);
      if (typeof document === "undefined") return;

      let statusChips = document.querySelector(".food-detail-status");
      if (foodStatusPreferenceLiked(foodRecord) && statusChips && !statusChips.querySelector("[data-food-liked-chip]")) {
        statusChips.insertAdjacentHTML(
          "beforeend",
          '<span class="pill" data-food-liked-chip>❤️ Wird gern gegessen</span>',
        );
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

  return true;
}

if (typeof window !== "undefined") {
  installFoodStatusPreferencePolicy();
  installFoodStatusPreferenceProgressSync();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    foodStatusPreferenceLiked,
    foodStatusPreferenceMergeLiked,
    foodStatusPreferenceLikedTie,
    foodStatusPreferenceCanCombine,
    foodStatusPreferenceShouldRetry,
    foodStatusPreferenceShouldSkipAutomaticResult,
    foodStatusPreferenceProgressLabels,
    installFoodStatusPreferencePolicy,
  };
}
