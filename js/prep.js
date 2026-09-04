"use strict";

/* Prep und Vorrat
 * Vorratsabzug, Undo, Einkaufslogik, Batch-Rechner und vollständiger Prep-Bereich.
 * Konsolidierter Produktionsstand 10.0.0.
 */

const PREP_PORTION_GRAMS = [5, 10, 20, 35];
const PREP_AT_MEAL_OVERRIDES = Object.freeze({
  gurke: "Bei der Mahlzeit frisch vorbereiten; nicht pauschal dämpfen oder als eigene Gefriercharge einplanen.",
  tomate: "Bei der Mahlzeit passend vorbereiten; nicht pauschal dämpfen oder als eigene Gefriercharge einplanen.",
});
function prepPortionSizeLabel(grams) {
  return `${Number(grams)} g`;
}
function prepPortionGramsFromSize(size) {
  let match = String(size || "").trim().match(/^(5|10|20|35)\s*g$/i);
  return match ? Number(match[1]) : 0;
}
function standardPrepPortionGramsForFood(f) {
  if (!f) return 35;
  if (["Fleisch", "Fisch", "Meeresfrucht", "Hülsenfrucht"].includes(f.category)) return 20;
  return 35;
}
function standardPrepPortionSizeForFood(f) {
  return prepPortionSizeLabel(standardPrepPortionGramsForFood(f));
}

function inventoryUnitGrams(item) {
  if (Number(item?.gramsPerPortion) > 0) return Number(item.gramsPerPortion);
  let text = String(item?.size || "").replace(",", ".");
  let range = text.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*g/i);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  let values = [...text.matchAll(/(\d+(?:\.\d+)?)\s*g/gi)].map((match) => Number(match[1]));
  if (values.length) return values.reduce((sum, value) => sum + value, 0) / values.length;
  return standardPrepPortionGramsForFood(food(item?.foodId));
}
function inventoryPortionCount(item) {
  return Math.max(0, Math.floor(Number(item?.portions) || 0));
}
function inventoryGrams(foodId) {
  return state.inventory
    .filter((i) => i.kind !== "recipe" && i.foodId === foodId)
    .reduce((sum, i) => sum + inventoryPortionCount(i) * inventoryUnitGrams(i), 0);
}
function inventoryPortions(foodId) {
  return state.inventory
    .filter((i) => i.kind !== "recipe" && i.foodId === foodId)
    .reduce((sum, i) => sum + inventoryPortionCount(i), 0);
}
function formatPrepNumber(value) {
  let rounded = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString("de-AT", { maximumFractionDigits: 1 });
}
function completedLog(date, meal) {
  return state.logs
    .filter(
      (l) =>
        l.date === date &&
        l.meal === meal &&
        (l.foodOutcomes
          ? Object.values(l.foodOutcomes).some((outcome) => outcome !== "not_offered")
          : l.outcome !== "not_offered"),
    )
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0] || null;
}
function mealIsCompleted(date, meal) {
  return !!completedLog(date, meal);
}
function completedMealHtml(date, meal, log) {
  let names = (log.foodIds || [])
    .map((id) => food(id)?.name)
    .filter(Boolean)
    .join(" + ");
  return `<div class="mealbox completed" data-completed-log="${log.id}">
    <div class="completed-main">
      <div>
        <div class="completed-title">${mealName(meal)} · ${esc(log.recipeName || names || "Mahlzeit")}</div>
        ${logOutcomeGridHtml(log)}
      </div>
      <span class="pill ok">Erledigt</span>
    </div>
    <details class="completed-details">
      <summary>Details oder Essen bearbeiten</summary>
      <div class="completed-body">
        <div class="small"><b>Tatsächlich enthalten:</b> ${esc(names || "nicht angegeben")}</div>
        ${log.note ? `<div class="small" style="margin-top:5px"><b>Notiz:</b> ${esc(log.note)}</div>` : ""}
        <button class="btn secondary smallbtn editCompletedLog" data-log="${log.id}" style="margin-top:8px">Essen bearbeiten</button>
      </div>
    </details>
  </div>`;
}
function consumeInventoryPortion(foodId) {
  let batches = state.inventory
    .filter(
      (i) =>
        i.kind !== "recipe" &&
        i.foodId === foodId &&
        Number(i.portions) > 0,
    )
    .sort((a, b) => a.frozenDate.localeCompare(b.frozenDate));
  let batch = batches[0];
  if (!batch) return false;
  batch.portions = Math.max(0, Number(batch.portions) - 1);
  if (batch.portions <= 0)
    state.inventory = state.inventory.filter((i) => i.id !== batch.id);
  return true;
}
function freshAtMealFood(f) {
  if (!f) return false;
  if (f.prepMode === "fresh") return true;
  if (f.prepMode === "batch") return false;
  if (PREP_AT_MEAL_OVERRIDES[f.id]) return true;
  if (f.category === "Ei") return true;
  if (f.allergenGroup && rank(f) < 2) return true;
  if (f.id === "hafer") return true;
  if (f.category === "Obst") return true;
  return /frisch/i.test(f.prep || "");
}
function freshMealText(f) {
  if (!f) return "Bei der Mahlzeit passend vorbereiten.";
  if (PREP_AT_MEAL_OVERRIDES[f.id]) return PREP_AT_MEAL_OVERRIDES[f.id];
  if (f.category === "Ei") return "Erst bei der Mahlzeit vollständig durchgaren; nicht vorab als Vorrat einplanen.";
  if (f.id === "hafer") return "Die kleine Breimenge am Tag der Mahlzeit frisch mit Wasser kochen.";
  if (f.allergenGroup && rank(f) < 2) return "Nur die kleine Einführung frisch mit bekannter Basis zubereiten.";
  return f.safeForm || "Bei der Mahlzeit passend vorbereiten; keine eigene kleine Kochmenge nötig.";
}
function prepDemand() {
  let from = state.settings.planFrom || today();
  if (from < today()) from = today();
  let days = buildDays(from, 7);
  let map = new Map();
  days.forEach((day) =>
    day.meals.forEach((meal) => {
      if (!meal.active || meal.empty || mealIsCompleted(day.date, meal.meal)) return;
      if (meal.recipeInventoryId) return;
      let allocation = meal.ingredientAmounts || plannedMealAmounts(meal).amounts;
      [...new Set(meal.foodIds || [])].forEach((id) => {
        let grams = Math.max(0, Number(allocation[id]) || 0);
        let current = map.get(id) || { foodId:id, uses:0, requiredGrams:0, reservedGrams:0, firstDate:day.date, lastDate:day.date, roles:new Set() };
        current.uses += 1;
        current.requiredGrams += grams;
        if (meal.focusId === id) current.roles.add(meal.type || "geplant");
        else if ((meal.sampleFoodIds || []).includes(id)) current.roles.add("Kostprobe");
        else current.roles.add("Bestandteil");
        if (day.date < current.firstDate) current.firstDate = day.date;
        if (day.date > current.lastDate) current.lastDate = day.date;
        map.set(id, current);
      });
    }),
  );
  for (let demand of map.values()) {
    demand.availableGrams = inventoryGrams(demand.foodId);
    demand.reservedGrams = Math.min(demand.requiredGrams, demand.availableGrams);
    demand.missingGrams = Math.max(0, demand.requiredGrams - demand.availableGrams);
    demand.requiredPortions = demand.uses;
    demand.reserved = Math.min(demand.uses, inventoryPortions(demand.foodId));
  }
  return [...map.values()];
}
function phasePortion() {
  return AMOUNT_LEVELS[currentAmountLevel()]?.targetGrams || 35;
}
function wholeBatchGuide(f) {
  let n = normalizeName(f.name);
  let guides = {
    zucchini:{buy:"1 mittelgroße Zucchini",yield:6,method:"Waschen, Enden entfernen, längs halbieren und in Stücke schneiden. Dämpfen, bis sie sehr weich ist; pürieren oder passend zur Konsistenz zerdrücken. Wegen des hohen Wasseranteils nach dem Auftauen kurz umrühren.",size:"35 g",note:"Pur und ohne Öl einfrieren."},
    suesskartoffel:{buy:"1 mittelgroße Süßkartoffel",yield:5,method:"Schälen, in gleich große Würfel schneiden und etwa 15–20 Minuten dämpfen, bis sie sich mit der Gabel leicht zerdrücken lässt. Mit wenig Garwasser pürieren oder zerdrücken. Für Fingerfood später dicke Stifte sehr weich dämpfen oder backen.",size:"35 g",note:"Eine Portion frisch anbieten, den Rest pur einfrieren."},
    karotte:{buy:"3–4 Karotten",yield:6,method:"Schälen, in Stücke schneiden und sehr weich dämpfen. Pürieren oder zerdrücken.",size:"35 g",note:"Pur einfrieren; Öl erst nach dem Erwärmen."},
    brokkoli:{buy:"1 kleiner Brokkoli",yield:6,method:"In Röschen teilen, Strunk schälen und alles sehr weich dämpfen. Pürieren oder zerdrücken; später weiche Röschen als Fingerfood.",size:"35 g",note:"Röschen und Strunk gemeinsam nutzen."},
    kartoffel:{buy:"3–4 Kartoffeln",yield:5,method:"Schälen, weich dämpfen oder kochen und nur kurz zerdrücken. Nicht lange mixen, sonst wird die Konsistenz klebrig.",size:"35 g",note:"Am besten mit Gemüse gemischt oder später als Taler einfrieren."},
    reis:{buy:"1 kleine Kochportion Reis",yield:6,method:"Mit reichlich Wasser sehr weich kochen. Für den Anfang pürieren oder fein zerdrücken; pur portionsweise einfrieren. Innerhalb einer Stunde abkühlen und einfrieren.",size:"35 g",note:"Nur einmal wieder erhitzen."},
    hirse:{buy:"Hirseflocken oder 1 kleine Kochportion ganze Hirse",yield:5,method:"Flocken besser trocken vorportionieren. Ganze Hirse sehr weich kochen und für den Anfang fein pürieren; pur einfrieren.",size:"35 g",note:"Muttermilch/Pre erst nach dem Erwärmen."},
    hafer:{buy:"Haferflocken",yield:0,method:"Am praktischsten trocken in 5–10-g-Portionen abwiegen und frisch mit Wasser kochen. Optional dicken puren Wasserbrei einfrieren.",size:"35 g",note:"Trocken vorbereiten ist meist sinnvoller."},
    polenta:{buy:"1 Kochportion Polenta",yield:6,method:"Weich kochen. Als Brei einfrieren; ab Konsistenzstufe 3 dick ausstreichen, abkühlen, in Sticks schneiden und einfrieren.",size:"35 g",note:"Nach dem Auftauen mit Wasser lockern."},
    quinoa:{buy:"1 kleine Kochportion Quinoa",yield:5,method:"Gründlich spülen und sehr weich kochen. Für den Anfang fein pürieren; pur einfrieren.",size:"35 g",note:"Lässt sich gut mit Gemüse kombinieren."},
    nudeln_pasta:{buy:"1 kleine Kochportion Nudeln",yield:4,method:"Sehr weich kochen. Eher in einem fertigen Gemüsegericht oder als weiche greifbare Form einfrieren; pur werden sie leicht klebrig.",size:"35 g",note:"Sauce und Nudeln zusammen einfrieren."},
    buchweizen:{buy:"1 kleine Kochportion Buchweizen",yield:5,method:"Sehr weich kochen und bei Bedarf pürieren; pur einfrieren.",size:"35 g",note:"Nach dem Auftauen Konsistenz anpassen."},
    amaranth:{buy:"1 kleine Kochportion Amaranth",yield:5,method:"Mit reichlich Wasser sehr weich kochen; der Brei lässt sich pur einfrieren.",size:"35 g",note:"Gut abkühlen lassen."}
  };
  let key = f.id.replaceAll("-","_");
  if (guides[key]) return guides[key];
  if (n.includes("susskartoffel") || n.includes("su kartoffel")) return guides.suesskartoffel;
  return null;
}
function prepAdvice(f, demand) {
  let availableGrams = Number(demand.availableGrams ?? inventoryGrams(f.id)) || 0;
  let requiredGrams = Number(demand.requiredGrams) || 0;
  let missingGrams = Math.max(0, requiredGrams - availableGrams);
  let available = inventoryPortions(f.id);
  let missing = Math.max(0, Number(demand.uses || 0) - Number(demand.reserved || 0));
  let category=f.category||"", known=rank(f)>=2;
  if (f.id === "rapsoel" || category === "Fett") return {mode:"Vorratsschrank",covered:true,headline:"Nicht einfrieren",recommendation:"Nach dem Erwärmen frisch zugeben.",form:"Keine eigene Gefrierportion.",details:"Rapsöl ist nur Zubereitungszugabe.",available,missing:0,availableGrams,requiredGrams,missingGrams:0};
  if (PREP_AT_MEAL_OVERRIDES[f.id]) return {mode:"Frisch",covered:false,headline:"Bei der Mahlzeit vorbereiten",recommendation:freshMealText(f),form:"Keine eigene Koch- oder Gefriercharge einplanen.",details:`${demand.uses} Einsätze geplant.`,available,missing,availableGrams,requiredGrams,missingGrams};
  let guide=wholeBatchGuide(f);
  if (guide) {
    let covered = missingGrams <= 0 && requiredGrams > 0;
    let portions = guide.yield ? Math.max(1, guide.yield) : 0;
    return {mode:covered?"Vorrat reicht":(f.id==="hafer"||f.id==="hirse"?"Trocken/gekocht":"Ganze Kochmenge zubereiten"),covered,headline:covered?"Durch Vorrat gedeckt":guide.buy,recommendation:guide.method,form:`Erwartung: etwa ${portions||"mehrere"} Portionen à ${guide.size}. ${guide.note}`,details:`${formatPrepNumber(requiredGrams)} g geplant, ${formatPrepNumber(availableGrams)} g vorhanden, ${formatPrepNumber(missingGrams)} g fehlen. Der Rest des ganzen Lebensmittels bleibt als flexibler Vorrat.`,available,missing,availableGrams,requiredGrams,missingGrams,inventorySize:guide.size,inventoryNote:`${f.name} pur · ganze Kochmenge`,inventoryPortions:portions||4};
  }
  if (f.allergenGroup && rank(f)<2) return {mode:"Frisch testen",covered:false,headline:"Nur die Testmenge frisch zubereiten",recommendation:"Allergen klar erkennbar mit bekannter Basis anbieten.",form:"Erst nach problemloser Einführung in größere Rezeptmengen einbauen.",details:"Keine große gemischte Charge vor der ersten Einführung.",available,missing,availableGrams,requiredGrams,missingGrams};
  if (["Fleisch","Fisch","Meeresfrucht"].includes(category)) return {mode:missingGrams?"Ganze Kochmenge zubereiten":"Vorrat reicht",covered:missingGrams===0,headline:missingGrams?"Etwa 120–150 g vollständig garen":"Durch Vorrat gedeckt",recommendation:"Fein zerkleinern oder pürieren und separat einfrieren.",form:"Ergibt etwa 6–7 Proteinportionen à 20 g.",details:`${formatPrepNumber(requiredGrams)} g geplant, ${formatPrepNumber(availableGrams)} g vorhanden, ${formatPrepNumber(missingGrams)} g fehlen.`,available,missing,availableGrams,requiredGrams,missingGrams,inventorySize:"20 g",inventoryNote:"vollständig gegart, pur",inventoryPortions:7};
  if (category === "Hülsenfrucht") return {mode:missingGrams?"Ganze Kochmenge zubereiten":"Vorrat reicht",covered:missingGrams===0,headline:missingGrams?"Eine kleine Tasse sehr weich kochen":"Durch Vorrat gedeckt",recommendation:"Sehr weich kochen, fein pürieren und pur einfrieren.",form:"In 20-g-Portionen einfrieren.",details:`${formatPrepNumber(requiredGrams)} g geplant, ${formatPrepNumber(availableGrams)} g vorhanden, ${formatPrepNumber(missingGrams)} g fehlen.`,available,missing,availableGrams,requiredGrams,missingGrams,inventorySize:"20 g",inventoryNote:"sehr weich, pur",inventoryPortions:6};
  if (category.includes("Obst")) return {mode:"Frisch",covered:false,headline:"Bei der Mahlzeit vorbereiten",recommendation:freshMealText(f),form:"Keine pauschale Batch-Kochmenge. Nur passend vorbereiteten, unberührten Überschuss separat aufbewahren.",details:`${demand.uses} Einsätze geplant.`,available,missing,availableGrams,requiredGrams,missingGrams};
  if (["Gemüse","Blattgemüse","Wurzel/Knolle"].includes(category)) return {mode:missingGrams?"Nach Bedarf":"Vorrat reicht",covered:missingGrams===0,headline:missingGrams?"Nach Planbedarf vorbereiten":"Durch Vorrat gedeckt",recommendation:f.safeForm||"Altersgerecht passend zubereiten.",form:"Nur tatsächlich vorbereiteten, unberührten Überschuss portionsweise als Vorrat eintragen; keine ganze Packung automatisch verarbeiten.",details:`${formatPrepNumber(requiredGrams)} g geplant, ${formatPrepNumber(availableGrams)} g vorhanden, ${formatPrepNumber(missingGrams)} g fehlen.`,available,missing,availableGrams,requiredGrams,missingGrams,inventorySize:"35 g",inventoryNote:"pur, nach Bedarf"};
  return {mode:missingGrams?"Nach Bedarf":"Vorrat reicht",covered:missingGrams===0,headline:missingGrams?(f.prep||"Eine normale Kochmenge vorbereiten"):"Durch Vorrat gedeckt",recommendation:f.safeForm||"Altersgerecht weich zubereiten.",form:"Überschuss flexibel portionieren.",details:`${formatPrepNumber(requiredGrams)} g geplant, ${formatPrepNumber(availableGrams)} g vorhanden, ${formatPrepNumber(missingGrams)} g fehlen.`,available,missing,availableGrams,requiredGrams,missingGrams,inventorySize:standardPrepPortionSizeForFood(f),inventoryNote:"",inventoryPortions:4};
}
function prepItems() {
  return prepDemand()
    .map((demand) => {
      let f = food(demand.foodId);
      return f ? { f, demand, advice: prepAdvice(f, demand) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      let score = (x) =>
        (x.advice.covered ? 3 : 0) +
        (x.advice.mode === "Frisch" ? 2 : 0) +
        (x.advice.mode.includes("Trocken") || x.advice.mode === "Je nach Form" ? 1 : 0);
      return score(a) - score(b) || a.demand.firstDate.localeCompare(b.demand.firstDate);
    });
}
function shoppingQuantity(f) {
  let n=normalizeName(f.name);
  if (n.includes("zucchini")||n.includes("susskartoffel")||n.includes("kurbis")||n.includes("brokkoli")) return "1 Stück";
  if (f.category==="Obst") return "1–2 Stück";
  if (["Fleisch","Fisch","Meeresfrucht"].includes(f.category)) return "ca. 150 g";
  if (["Getreide/Stärke","Hülsenfrucht"].includes(f.category)) return "1 Packung prüfen";
  return "1 Einheit";
}
function shoppingItems() {
  let demands = prepDemand();
  let requiredGrams = new Map(demands.map((demand) => [demand.foodId, demand.requiredGrams]));
  return demands.map((d)=>food(d.foodId)).filter(Boolean).filter((f)=>f.id!=="rapsoel" && inventoryGrams(f.id) < (requiredGrams.get(f.id)||0));
}
function defaultBatchPortion() {
  return AMOUNT_LEVELS[currentAmountLevel()].rank === 0 ? 20 : 35;
}
function estimatedYieldFactor(f) {
  let n = normalizeName(f?.name);
  if (n.includes("kurbis")) return 0.65;
  if (n.includes("brokkoli") || n.includes("karfiol") || n.includes("blumenkohl")) return 0.75;
  if (n.includes("banane")) return 0.65;
  if (n.includes("apfel") || n.includes("birne")) return 0.82;
  if (["Blattgemüse", "Kraut/Gewürz"].includes(f?.category)) return 0.35;
  if (["Wurzel/Knolle"].includes(f?.category)) return 0.86;
  if (["Gemüse", "Obst"].includes(f?.category)) return 0.88;
  return 0.9;
}
function batchPortionBreakdown(usableGrams, portionGrams, remainderThreshold = 20) {
  let usable = Math.max(0, Number(usableGrams) || 0);
  let portion = Math.max(0, Number(portionGrams) || 0);
  if (!portion) return { fullPortions: 0, remainderGrams: Math.round(usable), extraRemainderPortion: 0, storedPortions: 0 };
  let fullPortions = Math.floor(usable / portion);
  let remainderGrams = Math.max(0, Math.round(usable - fullPortions * portion));
  let extraRemainderPortion = remainderGrams > Math.max(0, Number(remainderThreshold) || 0) ? 1 : 0;
  return {
    fullPortions,
    remainderGrams,
    extraRemainderPortion,
    storedPortions: fullPortions + extraRemainderPortion,
  };
}
function populateBatchCalculator() {
  let select = document.getElementById("batchFood");
  if (!select) return;
  let current = select.value;
  select.innerHTML = state.foods
    .filter(
      (f) =>
        f.active &&
        !PREP_AT_MEAL_OVERRIDES[f.id] &&
        ["Gemüse", "Obst", "Wurzel/Knolle", "Blattgemüse"].includes(
          f.category,
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((f) => `<option value="${f.id}">${esc(f.name)}</option>`)
    .join("");
  if (current && food(current)) select.value = current;
  let portionSelect = document.getElementById("batchPortion");
  if (portionSelect && !portionSelect.dataset.initialized) {
    portionSelect.value = String(defaultBatchPortion());
    portionSelect.dataset.initialized = "true";
  }
}
function calculateBatch() {
  let f = food(document.getElementById("batchFood").value);
  let raw = Number(document.getElementById("batchRaw").value);
  let cooked = Number(document.getElementById("batchCooked").value);
  let portion = Number(document.getElementById("batchPortion").value);
  let box = document.getElementById("batchResult");
  if (!f || !raw || raw <= 0 || !portion || portion <= 0) {
    box.style.display = "block";
    box.className = "notice plan-quality-warn";
    box.textContent = "Bitte Lebensmittel, Rohgewicht und Portionsgröße eintragen.";
    return;
  }
  let exact = cooked > 0;
  let usable = exact ? cooked : Math.round(raw * estimatedYieldFactor(f));
  let breakdown = batchPortionBreakdown(usable, portion);
  let portions = breakdown.fullPortions;
  let rest = breakdown.remainderGrams;
  let storedPortions = breakdown.storedPortions;
  let restText = breakdown.extraRemainderPortion
    ? `${rest} g werden als eigene ganze Restportion erfasst.`
    : rest
      ? `${rest} g Rest werden nicht als Planportion erfasst.`
      : "Kein Rest.";
  let note = exact
    ? "Exakt nach dem fertigen Gewicht – zugegebenes Wasser ist damit bereits berücksichtigt."
    : "Nur grob geschätzt aus dem Rohgewicht. Wasserzugabe, Schälverlust und Garverlust können die Ausbeute verändern.";
  box.style.display = "block";
  box.className = "notice olive";
  box.innerHTML = `<b>${esc(f.name)}: ${portions} volle Portionen</b><div class="batch-metric"><div><span class="small">Grundlage</span><b>${usable} g</b></div><div><span class="small">Portion</span><b>${portion} g</b></div><div><span class="small">Rest</span><b>${rest} g</b></div></div><p class="small">${esc(note)} ${esc(restText)}</p><button class="btn secondary smallbtn" id="saveBatchResult" ${storedPortions < 1 ? "disabled" : ""}>${storedPortions} ${storedPortions === 1 ? "Portion" : "Portionen"} als Vorrat eintragen</button>`;
  let saveButton = document.getElementById("saveBatchResult");
  if (saveButton)
    saveButton.onclick = () => {
      let batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (portions > 0)
        state.inventory.push({
          id: `${batchId}-full`,
          kind: "food",
          foodId: f.id,
          portions,
          size: `${portion} g`,
          gramsPerPortion: portion,
          frozenDate: today(),
          note: `${raw} g roh${exact ? ` · ${cooked} g fertig` : " · Ausbeute geschätzt"}${breakdown.extraRemainderPortion ? " · Rest separat erfasst" : rest ? ` · ${rest} g Rest nicht für Planung` : ""}`,
        });
      if (breakdown.extraRemainderPortion)
        state.inventory.push({
          id: `${batchId}-remainder`,
          kind: "food",
          foodId: f.id,
          portions: 1,
          size: `${rest} g`,
          gramsPerPortion: rest,
          frozenDate: today(),
          note: "Restportion aus derselben Kochmenge",
        });
      save();
      renderAll();
      showToast(`${storedPortions} ${storedPortions === 1 ? "Portion" : "Portionen"} ${f.name} zum Vorrat hinzugefügt.`);
    };
}
function recipeCategoryLabel(category) {
  return ({
    porridge: "Brei",
    pancakes: "Pancakes",
    balls: "Fingerfood",
    baking: "Backen",
    family: "Familiengericht",
    philippines: "Philippinen",
  })[category] || "Rezept";
}
function bindRecipeStockButtons() {
  document.querySelectorAll("[data-add-recipe-stock]").forEach(
    (button) =>
      (button.onclick = () =>
        addInventoryForm({
          kind: "recipe",
          recipeName: decodeURIComponent(button.dataset.addRecipeStock),
          portions: 6,
          size: "Stück",
          note: "einzeln vorgefroren",
        })),
  );
}
function renderPrepCore() {
  populateBatchCalculator();
  let items = prepItems();
  let actionable = items.filter(
    (x) =>
      !x.advice.covered &&
      x.f.id !== "rapsoel" &&
      !freshAtMealFood(x.f) &&
      x.advice.missingGrams > 0,
  );
  let fresh = items.filter(
    (x) =>
      x.f.id !== "rapsoel" &&
      freshAtMealFood(x.f) &&
      x.demand.requiredGrams > x.demand.reservedGrams,
  );
  let days = buildDays(
    state.settings.planFrom && state.settings.planFrom >= today()
      ? state.settings.planFrom
      : today(),
    7,
  );
  let recipeReservations = new Map();
  for (let day of days) {
    for (let meal of day.meals) {
      if (
        meal.active &&
        meal.recipeInventoryId &&
        !mealIsCompleted(day.date, meal.meal)
      ) {
        let current = recipeReservations.get(meal.recipeName) || {
          name: meal.recipeName,
          reserved: 0,
          firstDate: day.date,
        };
        current.reserved += 1;
        if (day.date < current.firstDate) current.firstDate = day.date;
        recipeReservations.set(meal.recipeName, current);
      }
    }
  }
  let coveredFood = items.filter((x) => x.demand.reserved > 0);
  let coveredCount =
    coveredFood.reduce((sum, x) => sum + x.demand.reserved, 0) +
    [...recipeReservations.values()].reduce(
      (sum, x) => sum + x.reserved,
      0,
    );

  document.getElementById("prepSummary").innerHTML = `
    <div class="prep-metric"><b>${actionable.length}</b><span>jetzt vorbereiten</span></div>
    <div class="prep-metric"><b>${formatPrepNumber(coveredCount)}</b><span>aus Vorrat reserviert</span></div>
    <div class="prep-metric"><b>${fresh.length}</b><span>später frisch</span></div>`;

  let actionableSorted = actionable.slice().sort((a, b) => a.demand.firstDate.localeCompare(b.demand.firstDate));
  let urgentPrep = actionableSorted.filter((item) => item.demand.firstDate <= addDays(today(), 1));
  let laterPrep = actionableSorted.filter((item) => item.demand.firstDate > addDays(today(), 1));
  function prepTaskHtml({ f, demand, advice }) {
    let size = advice.inventorySize || standardPrepPortionSizeForFood(f);
    let suggestedUnit = inventoryUnitGrams({ size });
    let batchTotal = Math.max(Number(advice.inventoryPortions) || 0, Math.ceil(advice.missingGrams / Math.max(1, suggestedUnit)));
    let batchGrams = batchTotal * suggestedUnit;
    let planGrams = Math.min(batchGrams, advice.missingGrams);
    let freeGrams = Math.max(0, batchGrams - planGrams);
    return `<div class="prep-task"><div class="row"><div class="grow"><b>${esc(f.name)}</b><div class="small">Nächster Einsatz ${shortDate(demand.firstDate)} · Einsätze bis ${shortDate(demand.lastDate || demand.firstDate)}</div></div><span class="pill ph">${formatPrepNumber(advice.missingGrams)} g fehlen</span></div><div class="batch-balance"><span><b>${formatPrepNumber(advice.requiredGrams)} g</b>Planbedarf</span><span><b>${formatPrepNumber(advice.availableGrams)} g</b>Vorrat</span><span><b>${formatPrepNumber(advice.missingGrams)} g</b>vorbereiten</span></div><div class="prep-main"><b>${esc(advice.headline)}</b><div class="small">${esc(advice.recommendation)}</div></div><details class="prep-details"><summary>Zubereitung & Aufteilung</summary><p class="small"><b>Aufteilen:</b> ${esc(advice.form)}</p><p class="small">Vorgeschlagene Kochmenge: ${batchTotal} × ${esc(size)} (ca. ${formatPrepNumber(batchGrams)} g). Davon ca. ${formatPrepNumber(planGrams)} g für den Plan und ${formatPrepNumber(freeGrams)} g flexibel.</p><p class="small">${esc(advice.details)}</p></details>${advice.inventorySize ? `<div class="prep-actions"><button class="btn secondary smallbtn addSuggestedStock" data-food="${f.id}" data-size="${esc(advice.inventorySize)}" data-note="${esc(advice.inventoryNote || "")}" data-portions="${batchTotal}">Als Vorrat eintragen</button></div>` : ""}</div>`;
  }
  document.getElementById("prepNow").innerHTML = actionableSorted.length
    ? `${urgentPrep.length ? urgentPrep.map(prepTaskHtml).join("") : '<div class="empty">Für heute oder morgen ist nichts vorab zuzubereiten.</div>'}${laterPrep.length ? `<details class="prep-group later-prep"><summary><span><b>Später diese Woche</b><small>${laterPrep.length} ${laterPrep.length === 1 ? "Aufgabe" : "Aufgaben"}</small></span></summary><div class="panel-body">${laterPrep.map(prepTaskHtml).join("")}</div></details>` : ""}`
    : '<div class="empty">Aktuell ist nichts vorab zuzubereiten.</div>';
  document.querySelectorAll(".addSuggestedStock").forEach(
    (button) =>
      (button.onclick = () =>
        addInventoryForm({
          kind: "food",
          foodId: button.dataset.food,
          size: button.dataset.size,
          note: button.dataset.note,
          portions: button.dataset.portions,
        })),
  );

  document.getElementById("prepFreshCount").textContent = fresh.length
    ? `${fresh.length} ${fresh.length === 1 ? "Mahlzeitenhinweis" : "Mahlzeitenhinweise"} · keine Aufgabe für jetzt`
    : "Keine Aufgabe für jetzt";
  document.getElementById("prepFresh").innerHTML = fresh.length
    ? fresh
        .map(({ f, demand }) => {
          let text = freshMealText(f);
          return `<div class="prep-compact-row"><div><b>${esc(f.name)}</b><div class="small">${shortDate(demand.firstDate)} · ${demand.uses} ${demand.uses === 1 ? "Mahlzeit" : "Mahlzeiten"} · ${esc(text)}</div></div><span class="pill dim">frisch</span></div>`;
        })
        .join("")
    : '<div class="empty">Keine frisch zuzubereitenden Hinweise.</div>';

  let coveredRows = coveredFood
    .map(({ f, demand }) => {
      let available = demand.availableGrams;
      let reserved = Math.min(demand.reservedGrams, available);
      let free = Math.max(0, available - reserved);
      return `<div class="prep-compact-row"><div><b>${esc(f.name)}</b><div class="small">Nächster Einsatz ${shortDate(demand.firstDate)}</div><div class="reserve-grid"><span><b>${formatPrepNumber(available)} g</b>vorhanden</span><span><b>${formatPrepNumber(reserved)} g</b>reserviert</span><span><b>${formatPrepNumber(free)} g</b>frei</span></div></div><span class="pill ok">gedeckt</span></div>`;
    })
    .join("");
  let coveredRecipeRows = [...recipeReservations.values()]
    .map((entry) => {
      let available = recipeInventoryPortions(entry.name);
      let reserved = Math.min(entry.reserved, available);
      let free = Math.max(0, available - reserved);
      return `<div class="prep-compact-row"><div><b>${esc(entry.name)}</b><div class="small">Fertiges Rezept · nächster Einsatz ${shortDate(entry.firstDate)}</div><div class="reserve-grid"><span><b>${formatPrepNumber(available)}</b>vorhanden</span><span><b>${formatPrepNumber(reserved)}</b>reserviert</span><span><b>${formatPrepNumber(free)}</b>frei</span></div></div><span class="pill recipe-stock-chip">Rezeptvorrat</span></div>`;
    })
    .join("");
  document.getElementById("prepCoveredCount").textContent = coveredCount
    ? `${coveredCount} Portion${coveredCount === 1 ? "" : "en"} im Plan reserviert`
    : "Keine Reservierung";
  document.getElementById("prepCovered").innerHTML =
    coveredRows || coveredRecipeRows
      ? coveredRows + coveredRecipeRows
      : '<div class="empty">Noch keine geplante Mahlzeit ist durch Vorrat gedeckt.</div>';

  let shopping = shoppingItems();
  document.getElementById("shoppingList").innerHTML = shopping.length
    ? shopping
        .map(
          (f) => `<label class="shopping-row ${state.pantry[f.id] ? "shopping-done" : ""}"><input class="ds-toggle-input" type="checkbox" data-pantry="${f.id}" ${state.pantry[f.id] ? "checked" : ""}><div><b>${esc(f.name)}</b><div class="small">${esc(shoppingQuantity(f))}${f.ph ? " · auf den Philippinen typisch" : ""}</div></div><span class="shopping-toggle" aria-hidden="true"></span></label>`,
        )
        .join("")
    : '<div class="empty">Für den Plan ist alles als vorhanden markiert oder im Gefriervorrat.</div>';
  document.querySelectorAll("[data-pantry]").forEach(
    (checkbox) =>
      (checkbox.onchange = () => {
        state.pantry[checkbox.dataset.pantry] = checkbox.checked;
        save();
        renderPrep();
      }),
  );

  let availableRecipes = recipeStates().filter((r) => r.unlocked).slice(0, 6);
  document.getElementById("cookNow").innerHTML = availableRecipes.length
    ? availableRecipes
        .map(
          (r) => `<div class="history"><b>${esc(r.name)}</b><div class="small">${esc(r.ingredients || r.requires.join(", "))}</div></div>`,
        )
        .join("")
    : '<div class="empty">Noch kein Rezept vollständig freigeschaltet. Unter „Mehr“ siehst du fast passende Rezepte.</div>';
  document.getElementById("prepOpenRecipes").onclick = () => {
    showView("more");
    setTimeout(() => {
      let details = document.getElementById("recipesDetails");
      if (details) details.open = true;
      document
        .getElementById("recipesSection")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  };

  let freezerStates = recipeStates().filter((r) => r.freezable);
  let freezerReady = freezerStates.filter((r) => r.unlocked).slice(0, 5);
  let freezerAlmost = freezerStates
    .filter((r) => r.almost)
    .sort((a, b) => a.stage - b.stage)[0];
  let bananaBread = freezerStates.find((r) => r.name === "Baby-Bananenbrot");
  let freezerShown = [...freezerReady];
  for (let candidate of [freezerAlmost, bananaBread]) {
    if (candidate && !freezerShown.some((r) => r.name === candidate.name))
      freezerShown.push(candidate);
  }
  document.getElementById("freezerRecipes").innerHTML = freezerShown.length
    ? freezerShown
        .map(
          (r) => `<div class="freezer-recipe"><div class="row">${recipeIconSvg(r)}<div class="grow"><b>${esc(r.name)}</b><div class="small">${r.unlocked ? esc(r.freezerNote || r.batch || "") : `${r.almost ? "Fast passend" : "Später passend"} · ${esc(recipeMissingSummary(r))}`}</div></div><button class="btn secondary smallbtn" data-add-recipe-stock="${encodeURIComponent(r.name)}">Als Vorrat</button></div></div>`,
        )
        .join("")
    : '<div class="empty">Noch kein einfrierbares Rezept hinterlegt.</div>';
  document.getElementById("prepOpenFreezerRecipes").onclick = () => {
    recipeFilter = "freezer";
    showView("more");
    setTimeout(() => {
      renderPrep();
      let details = document.getElementById("recipesDetails");
      if (details) details.open = true;
      document
        .getElementById("recipesSection")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  };

  let guides = [
    ["Reis", "Sehr weich kochen und pur einfrieren. Innerhalb 1 Stunde abkühlen; nur einmal wieder erhitzen."],
    ["Ganze Hirse, Quinoa, Buchweizen, Amaranth", "Sehr weich gekocht gut einfrierbar; anfangs pürieren oder fein zerdrücken."],
    ["Hafer- und Hirseflocken", "Kleine Breimengen besser frisch kochen. Trocken bevorraten zählt nicht als Meal Prep."],
    ["Polenta", "Als weicher Brei; später auch dick ausgestrichen als Sticks einfrieren."],
    ["Süßkartoffel, Ube, Taro", "Als Mus oder sehr weiche Stifte gut einfrierbar."],
    ["Kartoffel", "Eher zerdrückt, in Gemüsemischungen oder als Taler; langes Mixen vermeiden."],
    ["Nudeln", "Am besten im fertigen Gemüsegericht; pur werden sie oft klebrig."],
    ["Couscous und Grieß", "So schnell frisch zubereitet, dass trockenes Vorportionieren meist praktischer ist."],
  ];
  document.getElementById("starchGuide").innerHTML = guides
    .map(
      ([a, b]) => `<div class="guide-item"><b>${a}</b><div class="small">${b}</div></div>`,
    )
    .join("");

  let inv = state.inventory
    .slice()
    .filter((i) => inventoryPortionCount(i) > 0)
    .sort(
      (a, b) =>
        inventoryName(a).localeCompare(inventoryName(b), "de") ||
        String(a.frozenDate).localeCompare(String(b.frozenDate)),
    );
  let groups = new Map();
  for (let item of inv) {
    let key = `${item.kind || "food"}|${item.kind === "recipe" ? item.recipeName : item.foodId || item.foodName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  document.getElementById("inventoryList").innerHTML = inv.length
    ? [...groups.entries()]
        .map(([key, batches]) => {
          batches.sort((a, b) =>
            String(a.frozenDate).localeCompare(String(b.frozenDate)),
          );
          let isRecipe = batches[0].kind === "recipe";
          let name = inventoryName(batches[0]);
          let total = batches.reduce(
            (sum, item) => sum + inventoryPortionCount(item),
            0,
          );
          let sizes = [...new Set(batches.map((item) => String(item.size || "").trim()).filter(Boolean))];
          let stockSummary = isRecipe
            ? `${total} ${esc(batches[0].size || "Portionen")} insgesamt${batches.length > 1 ? ` · ${batches.length} Vorratseinträge` : ""}`
            : `${total} ${total === 1 ? "Portion" : "Portionen"}${sizes.length === 1 ? ` · je ${esc(sizes[0])}` : ""}${batches.length > 1 ? ` · ${batches.length} Chargen` : ""}`;
          let stockBadge = isRecipe
            ? '<span class="pill recipe-stock-chip">Fertiges Rezept</span>'
            : batches.length > 1
              ? '<span class="pill">ältester zuerst</span>'
              : "";
          return `<div class="history stock-group ${isRecipe ? "recipe-group" : ""}" style="padding:10px 12px"><div class="row"><div class="grow"><b>${esc(name)}</b><div class="small">${stockSummary}</div>${isRecipe ? '<div class="stock-source-note">Fertiges Rezept; die enthaltenen Lebensmittel bleiben im Protokoll einzeln sichtbar.</div>' : ""}</div>${stockBadge}</div><div style="margin-top:4px">${batches
            .map((item, index) => {
              let age = diffDays(today(), item.frozenDate);
              let old = age > Number(state.settings.freezerDays);
              let batchLabel = batches.length > 1
                ? `<b class="small">${index === 0 ? "Älteste Charge · zuerst verwenden" : `Charge ${index + 1}`}</b>`
                : "";
              return `<div class="stockline" data-inv="${item.id}" style="padding:6px 0;border-top:1px solid var(--line)"><div class="grow">${batchLabel}<div class="small">${inventoryPortionCount(item)} × ${esc(item.size)} · ${shortDate(item.frozenDate)}${item.note ? ` · ${esc(item.note)}` : ""}</div></div><span class="pill ${old ? "warn" : "ok"}">${age} ${age === 1 ? "Tag" : "Tage"}</span><div class="row" style="gap:5px"><button class="iconbtn editInv" aria-label="Vorratseintrag bearbeiten" title="Bearbeiten"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.5 6.5 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button><button class="stockbtn useInv" aria-label="Eine Portion aus diesem Vorrat verbrauchen">−1</button><button class="iconbtn deleteInv" aria-label="Vorratseintrag löschen" title="Löschen"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>`;
            })
            .join("")}</div></div>`;
        })
        .join("")
    : '<div class="empty">Noch kein Gefriervorrat erfasst.</div>';
  document.querySelectorAll(".editInv").forEach(
    (button) =>
      (button.onclick = () =>
        editInventoryForm(button.closest("[data-inv]").dataset.inv)),
  );
  document.querySelectorAll(".deleteInv").forEach(
    (button) =>
      (button.onclick = () => {
        let id = button.closest("[data-inv]").dataset.inv;
        state.inventory = state.inventory.filter((i) => i.id !== id);
        save();
        renderAll();
      }),
  );
  document.querySelectorAll(".useInv").forEach(
    (button) =>
      (button.onclick = () => {
        let id = button.closest("[data-inv]").dataset.inv;
        if (!consumeInventoryItem(id)) return;
        save();
        renderAll();
        showToast("Eine Vorratsportion verbraucht.");
      }),
  );

  let filterBar = document.getElementById("recipeFilter");
  let search = document.getElementById("recipeSearch");
  if (filterBar) {
    filterBar.querySelectorAll("[data-recipe-filter]").forEach((button) =>
      button.classList.toggle("active", button.dataset.recipeFilter === recipeFilter),
    );
  }
  if (search) search.value = recipeQuery;
  let q = normalizeName(recipeQuery);
  let rs = recipeStates().filter((r) => {
    let categoryMatch =
      recipeFilter === "available"
        ? r.unlocked
        : recipeFilter === "almost"
          ? r.almost
          : recipeFilter === "all"
            ? true
            : recipeFilter === "pantry"
              ? (r.requires || []).every((name) => {
                  let f = state.foods.find((x) => x.name === name);
                  return f && (inventoryPortions(f.id) > 0 || state.pantry[f.id]);
                })
              : recipeFilter === "freezer"
                ? !!r.freezable
                : recipeFilter === "philippines"
                  ? r.ph || r.category === "philippines"
                  : recipeFilter === "snack"
                    ? (r.tags || []).some((tag) => normalizeName(tag) === "snack")
                    : r.category === recipeFilter;
    if (!categoryMatch) return false;
    if (!q) return true;
    return normalizeName(recipeSearchText(r)).includes(q);
  });
  let countBox = document.getElementById("recipeCount");
  if (countBox) {
    let context = recipeFilter === "almost"
      ? "es fehlen höchstens zwei Schritte"
      : recipeFilter === "snack"
        ? "Snack"
        : "passend zu Filter und Suche";
    countBox.textContent = `${rs.length} Rezept${rs.length === 1 ? "" : "e"} · ${context}`;
  }
  let allRecipeStatesForEmpty = recipeStates();
  let recipeEmptyMode = q || recipeFilter !== "available"
    ? "reset"
    : allRecipeStatesForEmpty.some((item) => item.almost)
      ? "almost"
      : "all";
  let recipeEmptyLabel = recipeEmptyMode === "reset"
    ? "Filter zurücksetzen"
    : recipeEmptyMode === "almost"
      ? "Fast passende Rezepte anzeigen"
      : "Alle Rezepte anzeigen";
  document.getElementById("recipeList").innerHTML = rs.length
    ? rs.map(renderRecipeCard).join("")
    : `<div class="empty ds-empty"><div>Keine Rezepte für diesen Filter gefunden.</div><button class="btn" id="recipeEmptyAction" type="button">${recipeEmptyLabel}</button></div>`;
  document.getElementById("recipeEmptyAction")?.addEventListener("click", () => {
    recipeQuery = "";
    if (recipeEmptyMode === "almost") recipeFilter = "almost";
    else if (recipeEmptyMode === "all") recipeFilter = "all";
    else recipeFilter = "available";
    renderPrep();
  });
  if (filterBar) {
    filterBar.querySelectorAll("[data-recipe-filter]").forEach((button) => {
      button.onclick = () => {
        recipeFilter = button.dataset.recipeFilter;
        renderPrep();
      };
    });
  }
  if (search)
    search.oninput = (e) => {
      recipeQuery = e.target.value;
      renderPrep();
    };
  bindRecipeStockButtons();
}
function recipeIngredientReady(name) {
  let f = state.foods.find((x) => x.name === name);
  return !!f && eatenExposureCount(f.id) >= 1 && f.active && status(f) !== "Pausiert";
}

function renderPrep() {
  renderPrepCore();
  let shoppingBox = document.getElementById("shoppingList");
  let hints = Object.values(state.shoppingHints || {}).filter((hint) => hint.status === "needed" && food(hint.foodId));
  if (shoppingBox && hints.length) {
    shoppingBox.insertAdjacentHTML("afterbegin", `<div class="shopping-followups"><div class="small shopping-followup-title">Nicht angebotene Lebensmittel</div>${hints.map((hint) => { let f = food(hint.foodId); return `<label class="shopping-row shopping-priority"><input class="ds-toggle-input" type="checkbox" data-shopping-hint="${f.id}"><div><b>${esc(f.name)}</b><div class="small">Zutat nicht verfügbar · nach Kauf wieder einplanen</div></div><span class="shopping-toggle" aria-hidden="true"></span></label>`; }).join("")}</div>`);
    document.querySelectorAll("[data-shopping-hint]").forEach((checkbox) => checkbox.onchange = () => {
      if (!checkbox.checked) return;
      let id = checkbox.dataset.shoppingHint;
      state.shoppingHints[id].status = "available"; state.pantry[id] = true;
      scheduleFollowUp(id, today(), state.followUps?.[id]?.meal || "lunch", "not_offered", "no_opportunity");
      save(); renderAll(); showToast(`${food(id)?.name || "Zutat"} ist vorhanden und wird wieder eingeplant.`);
    });
  }
  globalThis.MobileUiLifecycle?.afterRender("prep");
}
