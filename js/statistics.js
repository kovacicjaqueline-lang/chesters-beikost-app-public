"use strict";

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

function statisticsCountableFoodId(id) {
  let item = food(id);
  if (!item || item.count100 === false) return "";
  return canonicalId(item.id, item.name);
}

function statisticsFirstPositiveDate(foodId) {
  let dates = state.logs
    .filter((log) => (log.foodIds || []).includes(foodId) && statisticsPositiveOutcome(outcomeForFood(log, foodId)))
    .map((log) => log.date)
    .filter(Boolean)
    .sort();
  return dates[0] || "";
}

function statisticsSnapshot(range = statisticsRange) {
  let info = statisticsRangeInfo(range);
  let logs = statisticsLogs(range);
  let mealLogs = logs.filter((log) => inferEntryType(log) !== "sample");
  let sampleLogs = logs.filter((log) => inferEntryType(log) === "sample");
  let positiveFoodIds = new Set();
  let introducedFoodIds = new Set();
  let outcomeCounts = { eaten: 0, tried: 0, not_accepted: 0, not_offered: 0, reaction: 0 };

  for (let log of logs) {
    for (let id of new Set(log.foodIds || [])) {
      let outcome = outcomeForFood(log, id);
      if (Object.prototype.hasOwnProperty.call(outcomeCounts, outcome)) outcomeCounts[outcome] += 1;
      if (!statisticsPositiveOutcome(outcome)) continue;
      let canonical = statisticsCountableFoodId(id);
      if (!canonical) continue;
      positiveFoodIds.add(canonical);
      let firstDate = statisticsFirstPositiveDate(id);
      if (firstDate && firstDate >= info.start && firstDate <= info.end) introducedFoodIds.add(canonical);
    }
  }

  let successfulMeals = mealLogs.filter((log) => (log.foodIds || []).some((id) => outcomeForFood(log, id) === "eaten"));
  let textureCounts = [1, 2, 3, 4].map((stage) => successfulMeals.filter((log) => Number(log.textureStage || state.settings.textureStage) === stage).length);
  let amounts = successfulMeals
    .map((log) => Number(log.amount))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  let averageAmount = amounts.length ? Math.round(amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length) : 0;
  let maxAmount = amounts.length ? Math.max(...amounts) : 0;

  return {
    info,
    logs,
    days: new Set(logs.map((log) => log.date).filter(Boolean)).size,
    mealCount: mealLogs.length,
    sampleCount: sampleLogs.length,
    varietyCount: positiveFoodIds.size,
    introducedCount: introducedFoodIds.size,
    outcomeCounts,
    textureCounts,
    amounts,
    averageAmount,
    maxAmount,
    totalLearned: uniqueTriedCount(),
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
  return `<div class="statistics-bar-row" data-stat-texture="${stage}"><div class="statistics-bar-head"><span>Stufe ${stage} · ${esc(textureName(stage))}</span><b>${value}</b></div><div class="statistics-bar" aria-label="Konsistenzstufe ${stage}: ${value} gegessene Mahlzeiten"><span style="width:${pct}%"></span></div></div>`;
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
    body.innerHTML = `${buttons}<div class="empty statistics-empty"><b>Noch keine Einträge in diesem Zeitraum.</b><div class="small">Sobald du Mahlzeiten oder Kostproben protokollierst, wird die Entwicklung hier automatisch zusammengefasst.</div><button class="btn statistics-add-log" type="button">Eintrag anlegen</button></div>`;
    bindStatisticsActions();
    return;
  }

  let progressPct = Math.min(100, snapshot.targetFoods ? snapshot.totalLearned / snapshot.targetFoods * 100 : 0);
  let outcomesTotal = Object.values(snapshot.outcomeCounts).reduce((sum, value) => sum + value, 0);
  let textureMax = Math.max(...snapshot.textureCounts, 0);
  let amountHtml = snapshot.amounts.length
    ? `<div class="statistics-section"><h3>Mengenentwicklung</h3><div class="grid2 statistics-amounts">${statisticsMetric(`${snapshot.averageAmount} g`, "Durchschnitt", `aus ${snapshot.amounts.length} ${snapshot.amounts.length === 1 ? "Mengenangabe" : "Mengenangaben"}`)}${statisticsMetric(`${snapshot.maxAmount} g`, "Höchste Menge", "nur gegessene Mahlzeiten")}</div></div>`
    : `<div class="notice statistics-amount-note">Für diesen Zeitraum wurden bei gegessenen Mahlzeiten keine Mengen eingetragen. Die übrige Statistik bleibt davon vollständig nutzbar.</div>`;

  body.innerHTML = `${buttons}
    <div class="statistics-progress-block">
      <div class="statistics-progress-head"><div><h3>100-Lebensmittel-Fortschritt</h3><div class="small">Gesamtstand seit Beikoststart</div></div><b>${snapshot.totalLearned} / ${snapshot.targetFoods}</b></div>
      <div class="progress statistics-progress"><span style="width:${progressPct}%"></span></div>
    </div>
    <div class="grid2 statistics-metrics">
      ${statisticsMetric(snapshot.days, "Tage mit Eintrag")}
      ${statisticsMetric(snapshot.mealCount, "Mahlzeiten", snapshot.sampleCount ? `+ ${snapshot.sampleCount} ${snapshot.sampleCount === 1 ? "Kostprobe" : "Kostproben"}` : "")}
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
      <div class="small statistics-section-copy">Gezählt werden protokollierte Mahlzeiten, bei denen mindestens ein Lebensmittel gegessen wurde.</div>
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
  document.querySelector(".statistics-add-log")?.addEventListener("click", () => {
    openLog({ date: today(), meal: "lunch", focusId: "", foodIds: [], baseFoodIds: [], sampleFoodIds: [], entryType: "meal", foodOutcomes: {} });
  });
}

function resetStatisticsTransientUi() {
  statisticsRange = "7";
  let details = document.getElementById("statisticsDetails");
  if (details) details.open = false;
  renderStatistics();
}
