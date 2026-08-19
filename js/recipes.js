"use strict";

/* Rezepte und Allergenplanung
 * Rezeptfreigabe nach gegessenen Zutaten, Konsistenzregeln, Karten und Allergenplanung.
 * Konsolidierter Produktionsstand 10.0.0.
 */

/*
 * Fachlich freigegebene eigenständige Rezept-Ergänzung.
 * Sie wird hier – nach data/recipes.js, aber vor app.js – registriert, damit sie
 * bereits beim allerersten Planungsdurchlauf und vor dem Anlegen von Auto-Locks
 * Teil des kanonischen Browser-Rezeptkatalogs ist.
 *
 * Kein Alias von Obst-Hafer-Pancakes: Hafer ist hier keine Pflichtzutat.
 */
const RECIPE_CATALOG_ADDITIONS = Object.freeze([
  Object.freeze({
    name: "Bananen-Ei-Pancakes",
    category: "pancakes",
    requires: Object.freeze(["Banane", "Ei"]),
    stage: 2,
    batch: "4–6 Mini-Pancakes",
    ingredients: "1 sehr reife Banane, 1 Ei",
    note: "Banane fein zerdrücken, mit dem Ei zu einem gleichmäßigen Teig verrühren und kleine flache Pancakes bei niedriger Hitze vollständig, aber weich durchgaren. Keine harte oder stark gebräunte Kruste.",
    searchAliases: Object.freeze([]),
    skillRequirement: "Nur weich und gut greifbar anbieten. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten.",
  }),
]);

function installRecipeCatalogAdditions(recipes = typeof RECIPES !== "undefined" ? RECIPES : null) {
  if (!Array.isArray(recipes)) return false;
  let changed = false;
  for (let recipe of RECIPE_CATALOG_ADDITIONS) {
    if (recipes.some((item) => item?.name === recipe.name)) continue;
    recipes.push(recipe);
    changed = true;
  }
  return changed;
}

installRecipeCatalogAdditions();

function recipeStatesCore() {
  let stage = Number(state.settings.textureStage), age = monthsOld(today());
  let normalizedQuery = normalizeName(recipeQuery);
  return RECIPES.map((r) => {
    let sets = [r.requires || [], ...(r.alternatives || [])].filter((requirements, index) => requirements.length || index === 0);
    let evaluatedSets = sets.map((requirements, index) => ({
      requirements,
      index,
      label: r.variantLabels?.[index] || "",
      missing: requirements.filter((name) => !recipeIngredientReady(name)),
    }));
    let queryVariant = evaluatedSets.find((variant) => variant.label && normalizedQuery && normalizedQuery.includes(normalizeName(variant.label)));
    if (!queryVariant && normalizedQuery && r.legacyNames?.length === evaluatedSets.length) {
      let legacyIndex = r.legacyNames.findIndex((name) => normalizedQuery.includes(normalizeName(name)));
      if (legacyIndex >= 0) queryVariant = evaluatedSets[legacyIndex];
    }
    let best = queryVariant || evaluatedSets.sort((a, b) => a.missing.length - b.missing.length || a.index - b.index)[0] || { requirements: [], missing: [], index: 0, label: "" };
    let ingredientMissing = [...best.missing];
    let availableOptions = (r.oneOf || []).filter(recipeIngredientReady);
    if (r.oneOf?.length && !availableOptions.length) ingredientMissing.push(`eine passende Auswahl: ${r.oneOf.join(", ")}`);
    let availableMilkOptions = (r.milkChoices || []).filter(recipeIngredientReady);
    if (r.milkChoices?.length && !availableMilkOptions.length) ingredientMissing.push(`ein bekanntes Milchprodukt: ${r.milkChoices.join(", ")}`);
    let requirementMissing = [];
    if (stage < Number(r.stage || 1)) requirementMissing.push(`Konsistenz: ${textureName(r.stage)}`);
    if (r.hardMinMonths && age < Number(r.hardMinMonths)) requirementMissing.push(`Alter: frühestens ab etwa ${r.hardMinMonths} Monaten`);
    let missing = [...ingredientMissing, ...requirementMissing];
    let queryOption = (r.oneOf || []).find((name) => normalizedQuery && normalizedQuery.includes(normalizeName(name))) || "";
    if (!queryOption && normalizedQuery && r.legacyNames?.length) {
      queryOption = (r.oneOf || []).find((option) => r.legacyNames.some((legacy) => normalizedQuery.includes(normalizeName(legacy)) && normalizeName(legacy).includes(normalizeName(option)))) || "";
    }
    let selectedOption = queryOption || availableOptions[0] || "";
    let queryMilkOption = (r.milkChoices || []).find((name) => normalizedQuery && normalizedQuery.includes(normalizeName(name))) || "";
    let selectedMilkOption = queryMilkOption || availableMilkOptions[0] || "";
    return {
      ...r,
      missing,
      ingredientMissing,
      requirementMissing,
      availableOptions,
      availableMilkOptions,
      selectedOption,
      selectedFromQuery: !!queryOption,
      selectedOptionReady: selectedOption ? recipeIngredientReady(selectedOption) : false,
      selectedMilkOption,
      selectedMilkFromQuery: !!queryMilkOption,
      selectedMilkOptionReady: selectedMilkOption ? recipeIngredientReady(selectedMilkOption) : false,
      selectedVariantIndex: best.index,
      selectedVariantLabel: best.label,
      selectedVariantRequirements: best.requirements,
      unlocked: missing.length === 0,
      almost: missing.length > 0 && missing.length <= 2,
    };
  });
}

function findPlannedFood(foodId, days = 21) {
  return buildDays(today(), days)
    .flatMap((day) => day.meals.map((meal) => ({ day, meal })))
    .find(({ meal }) => (meal.foodIds || []).includes(foodId));
}

function scheduleAllergen(foodId, date, requestedMeal = "lunch") {
  let f = food(foodId);
  if (!f) return false;
  let mealCandidates = [...new Set([requestedMeal, "lunch", "breakfast", "dinner"])].filter((meal) => f.meals.includes(meal));
  let selection = mealCandidates.map((meal) => ({ meal, base: knownBase(meal, [f.id]) })).find((item) => item.base);
  if (!selection) {
    let error = document.getElementById("allergenScheduleError");
    if (error) {
      error.textContent = "Für dieses Allergen ist noch keine verträgliche Basis verfügbar. Bitte zuerst eine passende Basis zweimal problemlos essen lassen.";
      error.style.display = "block";
    }
    return false;
  }
  let { meal, base } = selection;
  let previous = findPlannedFood(foodId);
  if (previous && previous.day.date !== date) {
    let oldKey = planLockKey(previous.day.date, previous.meal.meal);
    if (state.overrides?.[oldKey] === foodId) delete state.overrides[oldKey];
    delete state.planLocks?.[oldKey];
    state.deferred[previous.day.date] = true;
  }
  for (let [key, value] of Object.entries(state.overrides || {})) if (value === foodId && key !== `${date}|${meal}`) delete state.overrides[key];
  let key = `${date}|${meal}`;
  delete state.planLocks?.[key];
  state.autoLockExcluded ||= {};
  state.autoLockExcluded[key] = true;
  if (!activeMeal(meal, date) && meal !== "lunch") {
    state.manualMeals ||= {};
    state.manualMeals[key] = {
      date,
      meal,
      focusId: f.id,
      foodIds: [base.id, f.id],
      baseFoodIds: [base.id],
      sampleFoodIds: [f.id],
      optionalAddons: [],
      recipeName: "",
      recipeInventoryId: "",
      milkMeal: isMilkProductFood(f) ? "small" : "",
      type: rank(f) >= 2 ? "Allergen wiederholen" : "Allergen einführen",
      note: `Allergen bewusst mit der verträglichen Basis ${base.name} eingeplant.`,
      manualAdded: true,
      createdAt: new Date().toISOString(),
    };
    state.planLocks[key] = mealSnapshot(date, meal, { ...state.manualMeals[key], active: true }, "manual");
  } else {
    state.overrides[key] = f.id;
  }
  state.deferred[date] = false;
  save(); closeGeneric(); renderAll();
  let moved = meal !== requestedMeal ? ` · wegen der verfügbaren Basis als ${mealName(meal)} geplant` : "";
  showToast(`${f.name} für ${date === addDays(today(), 1) ? "morgen" : shortDate(date)} eingeplant${moved}.`);
  return true;
}

function openAllergenSchedule(foodId) {
  let f = food(foodId);
  if (!f) return;
  let planned = findPlannedFood(foodId);
  let defaultDate = planned?.day.date || addDays(today(), 1);
  let defaultMeal = planned?.meal.meal || "lunch";
  openGeneric(
    `${f.name} einplanen`,
    `<div class="grid2">
      <div class="field"><label>Datum</label><input type="date" id="allergenDate" min="${today()}" value="${defaultDate}"></div>
      <div class="field"><label>Mahlzeit</label><select id="allergenMeal"><option value="lunch" ${defaultMeal === "lunch" ? "selected" : ""}>Mittag</option><option value="breakfast" ${defaultMeal === "breakfast" ? "selected" : ""}>Frühstück</option><option value="dinner" ${defaultMeal === "dinner" ? "selected" : ""}>Abendessen</option></select></div>
     </div>
     <div class="notice warn" id="allergenScheduleError" style="display:none"></div>
     <div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelAllergenDate" type="button">Abbrechen</button><button class="btn" id="saveAllergenDate">${planned ? "Planung ändern" : "Einplanen"}</button></div>`,
  );
  document.getElementById("cancelAllergenDate").onclick = closeGeneric;
  document.getElementById("saveAllergenDate").onclick = () =>
    scheduleAllergen(
      f.id,
      document.getElementById("allergenDate").value,
      document.getElementById("allergenMeal").value,
    );
}

function renderAllergenModule() {
  let on=today();
  let allergenFoods=state.foods.filter((f)=>f.active&&f.allergenGroup).sort((a,b)=>a.allergenGroup.localeCompare(b.allergenGroup,"de")||a.priority-b.priority);
  let groups=[...new Set(allergenFoods.map((f)=>f.allergenGroup))];
  let next=allergenFoods.filter((f)=>dueAllergen(f,on)||rank(f)===0).slice(0,3);
  let card=(f)=>{ let due=dueAllergen(f,on), stateText=status(f), action=due?"Jetzt wiederholen":rank(f)===0?"Einführen":stateText; return `<div class="allergen-row"><div class="grow"><b>${esc(f.name)}</b><div class="small">${esc(f.allergenGroup)} · ${esc(stateText)}</div></div><button class="btn secondary smallbtn planAllergen" data-food="${f.id}">${esc(action)}</button></div>`; };
  document.getElementById("allergenModule").innerHTML=`<div class="allergen-overview"><span class="pill ${next.length?"warn":"ok"}">${next.length?`${next.length} nächste Schritte`:"Aktuell nichts fällig"}</span></div>${next.length?next.map(card).join(""):'<div class="empty">Keine Einführung oder Wiederholung fällig.</div>'}<details class="all-allergens"><summary>Alle Allergene · ${groups.length} Gruppen</summary><div class="allergen-group-list">${groups.map((group)=>`<div class="allergen-group"><b>${esc(group)}</b>${allergenFoods.filter((f)=>f.allergenGroup===group).map(card).join("")}</div>`).join("")}</div></details>`;
  document.querySelectorAll(".planAllergen").forEach((button)=>button.onclick=()=>openAllergenSchedule(button.dataset.food));
}

function recipeStates() {
  return recipeStatesCore().map((recipe) => {
    let hintParts = [];
    if (recipe.hardMinMonths) hintParts.push(`Frühestens ab etwa ${recipe.hardMinMonths} Monaten`);
    if (recipe.minMonths && Number(recipe.minMonths) > Number(recipe.hardMinMonths || 0)) hintParts.push(`Orientierung ab etwa ${recipe.minMonths} Monaten`);
    return { ...recipe, ageHint: hintParts.join(" · ") };
  });
}
function renderRecipeCard(r) {
  let optionParts = [];
  if (r.selectedVariantLabel) optionParts.push(`<div><b>Variante:</b> ${esc(r.selectedVariantLabel)}${(r.selectedVariantRequirements || []).every(recipeIngredientReady) ? "" : " · noch offen"}</div>`);
  if (r.selectedOption || r.availableOptions?.length) optionParts.push(`<div><b>${r.oneOf?.length && r.name === "Milch-Getreide-Brei" ? "Getreide" : r.selectedOption ? "Vorausgewählt" : "Jetzt mögliche Auswahl"}:</b> ${r.selectedOption ? `${esc(r.selectedOption)}${r.selectedOptionReady ? "" : " · noch offen"}` : r.availableOptions.map(esc).join(", ")}</div>`);
  if (r.milkChoices?.length) optionParts.push(`<div><b>Milchprodukt:</b> ${r.selectedMilkOption ? `${esc(r.selectedMilkOption)}${r.selectedMilkOptionReady ? "" : " · noch offen"}` : "noch keines gegessen"}</div>`);
  let variants = optionParts.length ? optionParts.join("") : '<div class="small">Keine zusätzliche Variante nötig.</div>';
  let type = ({
    porridge: "Brei & Löffelgericht",
    pancakes: "Pancake",
    balls: "Fingerfood",
    family: "Familiengericht",
    philippines: "Philippinen-Rezept",
    baking: "Backrezept",
  })[r.category] || ((r.tags || []).some((tag) => /fingerfood/i.test(String(tag))) ? "Fingerfood" : "Rezept");
  let statusBadge = !r.unlocked
    ? '<span class="pill warn">Noch nicht passend</span>'
    : r.freezable
      ? '<span class="pill ok">Einfrierbar</span>'
      : "";
  let familyText = r.familyLabel ? ` · ${esc(r.familyLabel)}` : "";
  let importantHints = `${r.skillRequirement ? `<div class="notice"><b>Sicher anbieten:</b> ${esc(r.skillRequirement)}</div>` : ""}${r.unlocked ? "" : `<div class="recipe-missing"><b>Noch offen:</b> ${esc(recipeMissingSummary(r))}</div>`}${r.milkMeal === "full" ? '<div class="notice olive"><b>Milchmahlzeit:</b> Als volle Milchmahlzeit zählen; keine zweite volle Milchmahlzeit am selben Tag einplanen und nicht mit Fleisch oder Fisch kombinieren.</div>' : ""}`;
  let hints = `${r.ageHint ? `<div class="small recipe-age-hint">${esc(r.ageHint)}</div>` : ""}${r.milkMeal === "small" ? '<div class="small">Kleine Milchproduktmenge; sie zählt nicht automatisch als volle Milchmahlzeit.</div>' : ""}` || '<div class="small">Keine zusätzlichen Hinweise.</div>';
  let storage = r.freezable
    ? `<div class="small">${esc(r.freezerNote || "Portionsweise einfrieren und vollständig auftauen beziehungsweise erwärmen.")}</div><button class="btn secondary full" style="margin-top:9px" data-add-recipe-stock="${encodeURIComponent(r.name)}">Als Vorrat eintragen</button>`
    : '<div class="small">Am besten frisch zubereiten.</div>';
  return `<details class="recipe-card-v2">
    <summary>
      <div class="recipe-summary-grid">
        <div class="recipe-heading-with-icon">${recipeIconSvg(r)}<div><b>${esc(r.name)}</b><div class="small recipe-type-text">${esc(type)}</div><div class="tiny recipe-tech-text">${esc(r.batch || "kleine Portion")}${familyText}</div></div></div>
        <div class="recipe-summary-end">${statusBadge}<span class="recipe-chevron" aria-hidden="true">⌄</span></div>
      </div>
    </summary>
    <div class="recipe-body-v2">
      <section class="recipe-open-section"><h3>Zutaten</h3><p class="small">${esc(r.ingredients || (r.requires || []).join(", "))}</p></section>
      <section class="recipe-open-section"><h3>Zubereitung</h3><p class="small">${esc(r.note)}</p></section>
      ${importantHints}
      <details class="recipe-subsection"><summary>Varianten</summary><div class="recipe-subsection-body recipe-option-list">${variants}</div></details>
      <details class="recipe-subsection"><summary>Aufbewahrung</summary><div class="recipe-subsection-body">${storage}</div></details>
      <details class="recipe-subsection"><summary>Hinweise</summary><div class="recipe-subsection-body">${hints}</div></details>
    </div>
  </details>`;
}