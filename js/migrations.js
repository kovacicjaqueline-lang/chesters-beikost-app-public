"use strict";

/* Migrationen
 * Alle Altformat-, Milchprodukt- und Schema-5-Migrationen mit einer einzigen kanonischen migrateState-Funktion.
 * Konsolidierte Migrationslogik für Produktionsstand 10.0.0; bestehende Nutzerdaten bleiben kompatibel.
 */

function normalizeName(x) {
  return String(x || "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function migrationAliasTerms(alias) {
  return String(alias || "").split(/[,;/|]+/).map((term) => term.trim()).filter(Boolean);
}
function migrationFoodNameMatches(foodRecord, value) {
  let n = normalizeName(value);
  return !!n && (
    normalizeName(foodRecord?.name) === n ||
    migrationAliasTerms(foodRecord?.alias).some((alias) => normalizeName(alias) === n)
  );
}
const CUSTOM_MEAL_DEFAULTS = Object.freeze({
  "Gemüse": ["lunch", "dinner"],
  "Obst": ["breakfast", "lunch", "dinner"],
  "Getreide/Stärke": ["breakfast", "lunch", "dinner"],
  "Hülsenfrucht": ["lunch", "dinner"],
  "Fleisch": ["lunch", "dinner"],
  "Fisch": ["lunch", "dinner"],
  "Milchprodukt": ["breakfast", "lunch", "dinner"],
  "Ei": ["breakfast", "lunch", "dinner"],
  "Nuss": ["breakfast", "lunch", "dinner"],
  "Samen": ["breakfast", "lunch", "dinner"],
  "Kraut/Gewürz": ["lunch", "dinner"],
  "Wurzel/Knolle": ["lunch", "dinner"],
});
function customMealDefaults(category) {
  let defaults = CUSTOM_MEAL_DEFAULTS[category];
  return defaults ? [...defaults] : null;
}
function hasLegacyCustomMealFallback(meals) {
  return Array.isArray(meals) &&
    meals.length === 3 &&
    meals[0] === "breakfast" &&
    meals[1] === "lunch" &&
    meals[2] === "dinner";
}
function normalizeStatus(x) {
  let value = String(x || "auto");
  if (["Noch nicht", "Offen"].includes(value)) return "Offen";
  if (["Vertragen", "Verträgliche Basis", "Regelmäßig", "Bekannt"].includes(value)) return "Bekannt";
  if (["Pause – Reaktion", "Pausiert"].includes(value)) return "Pausiert";
  if (["Probiert", "auto"].includes(value)) return value;
  return "auto";
}
function statusStrength(x) {
  return ({ auto: 0, Offen: 1, Probiert: 2, Bekannt: 3, Pausiert: 4 }[normalizeStatus(x)] ?? 0);
}
function isLegacyMilkReference(id, name = "") {
  return id === LEGACY_MILK_ID || normalizeName(name) === "kuhmilch joghurt";
}
function migratedFoodIds(id, name = "") {
  if (isLegacyMilkReference(id, name)) return ["kuhmilch", "naturjoghurt"];
  let mapped = canonicalId(id, name);
  return mapped ? [mapped] : [];
}
function normalizeOutcome(value) {
  return ({ not_eaten: "not_accepted", tasted_ok: "tried", eaten_ok: "eaten" }[value] || value || "tried");
}
function conservativeLegacyMilkOutcome(value) {
  let normalized = normalizeOutcome(value);
  if (normalized === "eaten") return "tried";
  return normalized;
}
function canonicalId(id, name = "") {
  if (!id && !name) return "";
  if (isLegacyMilkReference(id, name)) return "kuhmilch";
  if (ID_ALIASES[id]) return ID_ALIASES[id];
  if (FOOD_DB.some((f) => f.id === id)) return id;
  let n = normalizeName(name);
  if (!n) return id || "";
  let byName = FOOD_DB.find((f) => migrationFoodNameMatches(f, name));
  return byName?.id || id || "";
}
function mergeFoodRecord(target, raw, options = {}) {
  if (!target || !raw) return;
  if (!options.keepPriority && Number.isFinite(Number(raw.priority))) target.priority = Number(raw.priority);
  if (typeof raw.active === "boolean") target.active = raw.active;
  if (Object.prototype.hasOwnProperty.call(raw, "liked")) target.liked = raw.liked === true;
  let incoming = normalizeStatus(raw.manualStatus);
  if (options.legacyMilk && incoming !== "Pausiert" && statusStrength(incoming) > 0) incoming = "Probiert";
  if (statusStrength(incoming) > statusStrength(target.manualStatus)) target.manualStatus = incoming;
  if (raw.notes) target.notes = [target.notes, raw.notes].filter(Boolean).join(" · ");
  if (raw.reactionPauseSourceLogId) {
    target.reactionPauseSourceLogId = String(raw.reactionPauseSourceLogId);
    target.reactionPausePreviousStatus = normalizeStatus(raw.reactionPausePreviousStatus || "auto");
  }
  if (options.legacyMilk) {
    let note = "Aus dem früheren kombinierten Eintrag Kuhmilch und Joghurt übernommen; beide Produkte bitte getrennt bestätigen.";
    if (!String(target.notes || "").includes(note)) target.notes = [target.notes, note].filter(Boolean).join(" · ");
  }
}
function mergeFoods(saved) {
  let result = FOOD_DB.map(clone),
    byId = new Map(result.map((f) => [f.id, f])),
    customByName = new Map();
  for (let raw of saved || []) {
    if (isLegacyMilkReference(raw.id, raw.name)) {
      mergeFoodRecord(byId.get("kuhmilch"), raw, { legacyMilk: true, keepPriority: true });
      mergeFoodRecord(byId.get("naturjoghurt"), raw, { legacyMilk: true, keepPriority: true });
      continue;
    }
    let cid = canonicalId(raw.id, raw.name), target = byId.get(cid);
    if (!target) {
      target = result.find((f) => migrationFoodNameMatches(f, raw.name));
      if (target) cid = target.id;
    }
    if (target) { mergeFoodRecord(target, raw); continue; }
    let n = normalizeName(raw.name);
    if (customByName.has(n)) {
      mergeFoodRecord(customByName.get(n), raw);
      continue;
    }
    let customDefaults = customMealDefaults(raw.category);
    let extra = {
      ...raw,
      id: cid || "custom-" + Date.now() + "-" + result.length,
      count100: raw.count100 !== false,
      manualStatus: normalizeStatus(raw.manualStatus),
      active: raw.active !== false,
      liked: raw.liked === true,
      meals: customDefaults && (!Array.isArray(raw.meals) || hasLegacyCustomMealFallback(raw.meals))
      ? customDefaults
      : Array.isArray(raw.meals)
        ? [...raw.meals]
        : ["breakfast", "lunch", "dinner"],
    };
    result.push(extra); byId.set(extra.id, extra); customByName.set(n, extra);
  }
  return result;
}
function buildFoodIdMigrationMap(savedFoods, mergedFoods) {
  let mergedById = new Map((mergedFoods || []).map((f) => [f.id, f]));
  let mergedByName = new Map();
  for (let f of mergedFoods || []) {
    let n = normalizeName(f.name);
    if (n && !mergedByName.has(n)) mergedByName.set(n, f);
  }
  let result = new Map();
  for (let raw of savedFoods || []) {
    if (!raw?.id || isLegacyMilkReference(raw.id, raw.name)) continue;
    let candidate = canonicalId(raw.id, raw.name);
    let target = mergedById.get(candidate) || mergedByName.get(normalizeName(raw.name));
    if (target) result.set(raw.id, target.id);
  }
  return result;
}
function mappedSourceFoodId(id, name, idMap) {
  if (isLegacyMilkReference(id, name)) return "kuhmilch";
  return idMap?.get(id) || canonicalId(id, name);
}
function mappedSourceFoodIds(id, name, idMap) {
  if (isLegacyMilkReference(id, name)) return ["kuhmilch", "naturjoghurt"];
  let mapped = mappedSourceFoodId(id, name, idMap);
  return mapped ? [mapped] : [];
}
function remapRoleObject(roles, idMap) {
  let result = {};
  for (let [rawId, role] of Object.entries(roles || {})) {
    for (let id of mappedSourceFoodIds(rawId, "", idMap)) if (!(id in result)) result[id] = role;
  }
  return result;
}
function mapFoodId(id, name = "") {
  return canonicalId(id, name);
}
function migrationHasMealContext(log) {
  return typeof logHasMealContext === "function"
    ? logHasMealContext(log)
    : !!log && log.entryType !== "sample" && ["breakfast", "snack", "lunch", "dinner"].includes(String(log.meal || ""));
}
function migrationTextureStage(value) {
  if (typeof validLogTextureStage === "function") return validLogTextureStage(value);
  let stage = Number(value);
  return Number.isInteger(stage) && stage >= 1 && stage <= 4 ? stage : null;
}
function migrateStateCore(s) {
  let d = clone(DEFAULT), source = s || {};
  d.settings = { ...d.settings, ...(source.settings || {}) };
  let legacyAmountKeys = ["taste", "small", "building", "established"];
  let newPhaseKeys = ["kennenlernen", "aufbau", "drei", "familie"];
  let sourcePhase = source.settings?.phaseSelected;
  if (source.settings?.amountSelected && AMOUNT_LEVELS[source.settings.amountSelected]) {
    d.settings.amountSelected = source.settings.amountSelected;
  } else {
    d.settings.amountSelected = legacyAmountKeys.includes(sourcePhase)
      ? sourcePhase
      : suggestedAmountLevelFromLogs(source.logs || []);
  }
  if (!newPhaseKeys.includes(sourcePhase)) {
    let logs = Array.isArray(source.logs) ? source.logs : [];
    let autoLocks = Object.entries(source.planLocks || {}).filter(([, lock]) => lock?.mode === "auto" && !lock?.manualAdded);
    let hadAutomaticDinner = autoLocks.some(([key]) => key.endsWith("|dinner"));
    let hadAutomaticBreakfast = autoLocks.some(([key]) => key.endsWith("|breakfast"));
    let successfulSlots = new Set(logs.filter((log) => {
      if (!migrationHasMealContext(log)) return false;
      let ids = log.foodIds || [];
      return ids.some((id) => (log.foodOutcomes?.[id] || log.outcome) === "eaten");
    }).map((log) => `${log.date}|${log.meal}`)).size;
    let amountValues = logs
      .filter((log) => Object.values(log.foodOutcomes || {}).includes("eaten") || log.outcome === "eaten")
      .map((log) => Number(log.amount))
      .filter((n) => Number.isFinite(n));
    let oldDinnerProgress = amountValues.filter((n) => n >= 100).length >= 3;
    let day = source.settings?.startDate ? diffDays(today(), source.settings.startDate) + 1 : 0;
    let dayMode = source.settings?.mealActivation === "days";
    let oldDinnerDay = dayMode && day >= Number(source.settings?.dinnerDay || 99999);
    let oldBreakfastDay = dayMode && day >= Number(source.settings?.breakfastDay || 99999);
    d.settings.phaseSelected = (hadAutomaticDinner || oldDinnerProgress || oldDinnerDay)
      ? "drei"
      : (hadAutomaticBreakfast || successfulSlots >= 3 || oldBreakfastDay)
        ? "aufbau"
        : "kennenlernen";
  }
  d.settings.phaseModelVersion = 2;
  d.settings.phaseMode = "manual-v2";
  if (!d.settings.textureStageSince) d.settings.textureStageSince = source.settings?.startDate || today();
  if (source.planFrom && !d.settings.planFrom) d.settings.planFrom = source.planFrom;
  d.foods = mergeFoods(source.foods);
  let sourceFoodIdMap = buildFoodIdMigrationMap(source.foods, d.foods);
  let mapSourceId = (id, name = "") => mappedSourceFoodId(id, name, sourceFoodIdMap);
  let mapSourceIds = (id, name = "") => mappedSourceFoodIds(id, name, sourceFoodIdMap);

  let legacyMilkFoods = (source.foods || []).filter((item) => isLegacyMilkReference(item.id, item.name));
  let legacyMilkLogs = (source.logs || []).filter((log) =>
    (log.foodIds || []).some((id) => isLegacyMilkReference(id)) ||
    isLegacyMilkReference(log.focusId) ||
    Object.keys(log.foodOutcomes || {}).some((id) => isLegacyMilkReference(id))
  );

  d.logs = (Array.isArray(source.logs) ? source.logs : []).map((l) => {
    let rawIds = Array.isArray(l.foodIds) ? l.foodIds : [];
    let ids = [...new Set(rawIds.flatMap((id) => mapSourceIds(id)).filter(Boolean))];
    let legacyMilk = rawIds.some((id) => isLegacyMilkReference(id)) || isLegacyMilkReference(l.focusId) || Object.keys(l.foodOutcomes || {}).some((id) => isLegacyMilkReference(id));
    let foodOutcomes = {};
    if (l.foodOutcomes && typeof l.foodOutcomes === "object") {
      for (let [rawId, rawOutcome] of Object.entries(l.foodOutcomes)) {
        let targets = mapSourceIds(rawId);
        for (let id of targets) foodOutcomes[id] = isLegacyMilkReference(rawId) ? conservativeLegacyMilkOutcome(rawOutcome) : normalizeOutcome(rawOutcome);
      }
    } else {
      for (let rawId of rawIds) {
        for (let id of mapSourceIds(rawId)) foodOutcomes[id] = isLegacyMilkReference(rawId) ? conservativeLegacyMilkOutcome(l.outcome) : normalizeOutcome(l.outcome);
      }
    }
    let note = l.note || "";
    if (legacyMilk) {
      let migrationNote = "Aus V8.8 übernommen: Kuhmilch und Joghurt waren nicht getrennt; beide Kontakte wurden vorsichtig als ‚Probiert‘ markiert und müssen einzeln bestätigt werden.";
      if (!note.includes(migrationNote)) note = [note, migrationNote].filter(Boolean).join(" · ");
    }
    let baseFoodIds = [...new Set((l.baseFoodIds || []).flatMap((id) => mapSourceIds(id)).filter(Boolean))];
    let sampleFoodIds = [...new Set((l.sampleFoodIds || []).flatMap((id) => mapSourceIds(id)).filter(Boolean))];
    let foodRoles = remapRoleObject(l.foodRoles, sourceFoodIdMap);
    let legacySample = l.entryType === "sample";
    let storedTexture = migrationTextureStage(l.textureStage);
    let textureKnown = storedTexture !== null && (l.textureKnown === true || (!legacySample && l.textureKnown !== false));
    let migrated = {
      ...l,
      foodIds: ids,
      focusId: mapSourceId(l.focusId || ids[0] || ""),
      reactionFoodId: mapSourceId(l.reactionFoodId || ""),
      outcome: legacyMilk ? conservativeLegacyMilkOutcome(l.outcome) : normalizeOutcome(l.outcome),
      foodOutcomes,
      baseFoodIds,
      sampleFoodIds,
      foodRoles,
      note,
      legacyMilkAmbiguous: legacyMilk || undefined,
      textureKnown,
    };
    if (textureKnown) migrated.textureStage = storedTexture;
    else delete migrated.textureStage;
    return migrated;
  });

  d.inventory = (Array.isArray(source.inventory) ? source.inventory : []).map((i) => {
    let legacyMilk = isLegacyMilkReference(i.foodId, i.foodName) || (i.foodIds || []).some((id) => isLegacyMilkReference(id));
    if (legacyMilk) return {
      ...i,
      kind: "recipe",
      portions: Math.max(0, Math.floor(Number(i.portions) || 0)),
      foodId: "",
      foodIds: ["kuhmilch", "naturjoghurt"],
      recipeName: "Milchprodukt (Altbestand – prüfen)",
      note: [i.note, "Aus V8.8: Kuhmilch oder Joghurt nicht eindeutig getrennt."].filter(Boolean).join(" · "),
      legacyMilkUnknown: true,
    };
    return {
      ...i,
      kind: i.kind === "recipe" ? "recipe" : "food",
      portions: Math.max(0, Math.floor(Number(i.portions) || 0)),
      foodId: i.kind === "recipe" ? "" : mapSourceId(i.foodId || "", i.foodName || ""),
      foodIds: (i.foodIds || []).flatMap((id) => mapSourceIds(id)).filter(Boolean),
    };
  });
  d.overrides = {};
  for (let [k, v] of Object.entries(source.overrides || {})) d.overrides[k] = String(v).startsWith("__") ? v : mapSourceId(v);
  d.deferred = { ...(source.deferred || {}) };
  d.pantry = {};
  for (let [rawId, value] of Object.entries(source.pantry || {})) {
    let id = mapSourceId(rawId);
    if (id) d.pantry[id] = value;
  }
  d.autoLockExcluded = { ...(source.autoLockExcluded || {}) };
  d.inactivePlanKept = { ...(source.inactivePlanKept || {}) };
  d.combinationPauses = {};
  for (let [rawKey, value] of Object.entries(source.combinationPauses || {})) {
    let key = rawKey.split("+").flatMap((id) => mapSourceIds(id)).filter(Boolean).sort().join("+");
    if (key) d.combinationPauses[key] = value;
  }
  d.backupMeta = { ...d.backupMeta, ...(source.backupMeta || {}) };
  if (legacyMilkFoods.length || legacyMilkLogs.length) {
    d.backupMeta.legacyMilkMigration = {
      needsReview: true,
      migratedAt: new Date().toISOString(),
      originalFoods: clone(legacyMilkFoods),
      originalLogs: clone(legacyMilkLogs),
    };
  }
  d.manualMeals = {};
  for (let [key, meal] of Object.entries(source.manualMeals || {})) {
    let foodIds = [...new Set((meal.foodIds || []).flatMap((id) => mapSourceIds(id)).filter(Boolean))];
    if (!foodIds.length) continue;
    d.manualMeals[key] = {
      ...meal,
      foodIds,
      baseFoodIds: (meal.baseFoodIds || []).flatMap((id) => mapSourceIds(id)).filter(Boolean),
      sampleFoodIds: (meal.sampleFoodIds || []).flatMap((id) => mapSourceIds(id)).filter(Boolean),
      foodRoles: remapRoleObject(meal.foodRoles, sourceFoodIdMap),
      inventoryFoodIds: (meal.inventoryFoodIds || []).flatMap((id) => mapSourceIds(id)).filter(Boolean),
      focusId: mapSourceId(meal.focusId || foodIds[0]),
      manualAdded: meal.manualAdded !== false,
    };
  }
  d.planLocks = {};
  for (let [key, lock] of Object.entries(source.planLocks || {})) {
    let focusId = mapSourceId(lock.focusId || "");
    let foodIds = [...new Set((lock.foodIds || []).flatMap((id) => mapSourceIds(id)).filter(Boolean))];
    if (!focusId || !foodIds.length) continue;
    d.planLocks[key] = {
      ...lock,
      focusId,
      foodIds,
      baseFoodIds: (lock.baseFoodIds || []).flatMap((id) => mapSourceIds(id)).filter(Boolean),
      sampleFoodIds: (lock.sampleFoodIds || []).flatMap((id) => mapSourceIds(id)).filter(Boolean),
      foodRoles: remapRoleObject(lock.foodRoles, sourceFoodIdMap),
      optionalAddons: (lock.optionalAddons || []).flatMap((id) => mapSourceIds(id)).filter(Boolean),
      inventoryFoodIds: (lock.inventoryFoodIds || []).flatMap((id) => mapSourceIds(id)).filter(Boolean),
      followUpFoodId: mapSourceId(lock.followUpFoodId || ""),
      mode: lock.mode === "manual" ? "manual" : "auto",
    };
  }
  if (!d.settings.phMode) d.settings.phMode = source.settings?.travelPrep ? "prepare" : "off";
  let activeIds = new Set(d.foods.filter((f) => f.active).map((f) => f.id));
  for (let [key, value] of Object.entries(d.overrides)) if (!String(value).startsWith("__") && !activeIds.has(value)) delete d.overrides[key];
  for (let [key, lock] of Object.entries(d.planLocks)) {
    let hasInactive = (lock.foodIds || []).some((id) => !activeIds.has(id));
    if (hasInactive && lock.mode === "auto") delete d.planLocks[key];
  }

  let chesterContext = d.settings.birthDate === "2026-01-24" && d.settings.startDate === "2026-07-14";
  let hasHuhnContact = d.logs.some((log) => (log.foodIds || []).includes("huhn"));
  if (chesterContext && !hasHuhnContact && source.backupMeta?.chesterContextSeeded !== true) {
    d.logs.push({
      id: "chester-huhn-kostprobe-2026-07-22",
      date: "2026-07-22",
      meal: "lunch",
      foodIds: ["huhn"],
      focusId: "huhn",
      outcome: "tried",
      foodOutcomes: { huhn: "tried" },
      amount: "",
      textureStage: 1,
      note: "Am von der Nutzerin durchgehend festgehaltenen Hühnerknochen gesaugt; keine gegessene Menge.",
      createdAt: "2026-07-22T12:00:00.000Z",
      sourceKind: "transition-context",
    });
    d.backupMeta.chesterContextSeeded = true;
  } else if (hasHuhnContact) d.backupMeta.chesterContextSeeded = true;
  return d;
}

function upgradeV92State(data) {
  data.followUps ||= {};
  data.shoppingHints ||= {};
  data.logs = (data.logs || []).map((log) => {
    let sampleFoodIds = [...new Set((log.sampleFoodIds || []).filter(Boolean))];
    let baseFoodIds = [...new Set((log.baseFoodIds || []).filter(Boolean))];
    if (!sampleFoodIds.length && log.entryType === "sample") sampleFoodIds = [...(log.foodIds || [])];
    if (!baseFoodIds.length && sampleFoodIds.length) baseFoodIds = (log.foodIds || []).filter((id) => !sampleFoodIds.includes(id));
    if (!sampleFoodIds.length && !baseFoodIds.length) baseFoodIds = [...(log.foodIds || [])];
    let foodRoles = { ...(log.foodRoles || {}) };
    for (let id of log.foodIds || []) {
      if (!foodRoles[id]) foodRoles[id] = sampleFoodIds.includes(id) ? "sample" : baseFoodIds.includes(id) ? "base" : "component";
    }
    let entryType = log.entryType || (sampleFoodIds.length && baseFoodIds.length === 0 ? "sample" : "meal");
    return {
      ...log,
      entryType,
      sampleFoodIds,
      baseFoodIds,
      foodRoles,
      amount: entryType === "sample" ? "" : (log.amount || ""),
      rejectionStrength: log.rejectionStrength || "",
      notOfferedReason: log.notOfferedReason || "",
    };
  });
  return data;
}
function migrateState(source) {
  let upgraded = upgradeV92State(migrateStateCore(source));
  let idMap = buildFoodIdMigrationMap(source?.foods, upgraded.foods);
  let mapId = (id) => mappedSourceFoodId(id, "", idMap);
  upgraded.followUps = {};
  for (let [rawKey, record] of Object.entries(source?.followUps || {})) {
    let foodId = mapId(record?.foodId || rawKey);
    if (!foodId) continue;
    upgraded.followUps[foodId] = {
      ...clone(record),
      foodId,
      baseFoodId: mapId(record?.baseFoodId || ""),
      alternativeBaseIds: [...new Set((record?.alternativeBaseIds || []).map(mapId).filter(Boolean))],
      previousBaseIds: [...new Set((record?.previousBaseIds || []).map(mapId).filter(Boolean))],
    };
  }
  upgraded.shoppingHints = {};
  for (let [rawKey, hint] of Object.entries(source?.shoppingHints || {})) {
    let foodId = mapId(hint?.foodId || rawKey);
    if (foodId) upgraded.shoppingHints[foodId] = { ...clone(hint), foodId };
  }
  return upgraded;
}
