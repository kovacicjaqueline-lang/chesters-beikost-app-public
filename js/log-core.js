"use strict";

/* Gemeinsame, seiteneffektfreie Regeln für das einheitliche Essensprotokoll. */
const LOG_MEAL_KEYS = Object.freeze(["breakfast", "snack", "lunch", "dinner"]);

function logHasMealContext(log) {
  return !!log && log.entryType !== "sample" && LOG_MEAL_KEYS.includes(String(log.meal || ""));
}
function logExposureKey(log) {
  let date = String(log?.date || "");
  if (logHasMealContext(log)) return `${date}|${log.meal}`;
  let identity = String(log?.id || log?.createdAt || log?.updatedAt || "free");
  return `${date}|entry:${identity}`;
}
function validLogTextureStage(value) {
  let stage = Number(value);
  return Number.isInteger(stage) && stage >= 1 && stage <= 4 ? stage : null;
}
function logTextureStage(log) {
  if (!log || log.textureKnown === false) return null;
  if (!Object.prototype.hasOwnProperty.call(log, "textureStage")) return null;
  return validLogTextureStage(log.textureStage);
}
function logTextureSelectionRequired({ offered = false, isEdit = false, legacyUnknown = false, textureValue = "" } = {}) {
  if (!offered || String(textureValue || "")) return false;
  return !(isEdit && legacyUnknown);
}
function logPositiveOutcome(log, outcomeForFoodFn) {
  if (!log || typeof outcomeForFoodFn !== "function") return false;
  return (log.foodIds || []).some((id) => ["eaten", "tried"].includes(outcomeForFoodFn(log, id)));
}
function logTextureCounts(logs, outcomeForFoodFn) {
  let counts = [0, 0, 0, 0];
  for (let log of logs || []) {
    let stage = logTextureStage(log);
    if (!stage || !logPositiveOutcome(log, outcomeForFoodFn)) continue;
    counts[stage - 1] += 1;
  }
  return counts;
}
function foodCategoryLabel(category) {
  return ({
    "Getreide/Stärke": "Getreide und Stärke",
    "Kraut/Gewürz": "Kräuter und Gewürze",
    "Wurzel/Knolle": "Wurzel- und Knollengemüse",
    "Soja/Tofu": "Soja und Tofu",
  })[String(category || "")] || String(category || "");
}
function learningRoleLabel(rankValue = 0, statusValue = "", type = "") {
  if (String(statusValue || "") === "Pausiert") return "Pausiert";
  let repeatTypes = new Set(["gezielt wiederholen", "Allergen wiederholen", "nach Einführung"]);
  if (repeatTypes.has(String(type || "")) || Number(rankValue) === 1) return "Wiederholung";
  return "Einführung";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { LOG_MEAL_KEYS, logHasMealContext, logExposureKey, validLogTextureStage, logTextureStage, logTextureSelectionRequired, logPositiveOutcome, logTextureCounts, foodCategoryLabel, learningRoleLabel };
}
