"use strict";

/* Mobile-First Prep
 * Rein präsentative Schicht auf der bestehenden Prep-/Vorratslogik.
 * Bestehende IDs bleiben erhalten, damit Fachlogik und Formulare unverändert weiterarbeiten.
 */
(function mobilePrepModule(root) {
  if (typeof document === "undefined") return;
  if (root.__mobilePrepInstalled) return;
  if (typeof renderPrep !== "function") return;

  root.__mobilePrepInstalled = true;
  let activePanel = "prepare";

  function hasNeededShoppingHint() {
    return typeof state !== "undefined" &&
      Object.values(state.shoppingHints || {}).some((hint) => hint?.status === "needed");
  }

  function installPrepMarkup() {
    const prep = document.getElementById("prep");
    if (!prep || prep.dataset.mobilePrep === "true") return;
    prep.dataset.mobilePrep = "true";
    prep.innerHTML = `
      <div class="prep-mobile-head">
        <div>
          <span class="prep-kicker">PREP</span>
          <h2>Was steht an?</h2>
          <p>Vorbereiten, einkaufen oder direkt aus dem Vorrat nehmen.</p>
        </div>
      </div>
      <div class="prep-segments" role="tablist" aria-label="Prep-Bereich">
        <button type="button" class="active" role="tab" aria-selected="true" aria-controls="prepPanelPrepare" data-prep-panel="prepare">Vorbereiten</button>
        <button type="button" role="tab" aria-selected="false" aria-controls="prepPanelShopping" data-prep-panel="shopping">Einkauf</button>
        <button type="button" role="tab" aria-selected="false" aria-controls="prepPanelStock" data-prep-panel="stock">Vorrat</button>
      </div>

      <section class="prep-panel" id="prepPanelPrepare" role="tabpanel">
        <div class="prep-summary-strip" id="prepSummary"></div>

        <section class="prep-priority-block" aria-labelledby="prepTodayHeading">
          <div class="prep-section-title"><div><span class="prep-order">1</span><h3 id="prepTodayHeading">Jetzt vorbereiten</h3></div><span class="small">Heute</span></div>
          <div id="prepToday" class="prep-task-list"></div>
        </section>

        <section class="prep-priority-block" aria-labelledby="prepTomorrowHeading">
          <div class="prep-section-title"><div><span class="prep-order">2</span><h3 id="prepTomorrowHeading">Morgen vorbereiten</h3></div><span class="small">Nächster Tag</span></div>
          <div id="prepTomorrow" class="prep-task-list"></div>
        </section>

        <details class="prep-group prep-covered-mobile" id="prepCoveredGroup">
          <summary><span class="prep-summary-with-order"><span class="prep-order">3</span><span><b>Durch Vorrat gedeckt</b><small id="prepCoveredCount">Keine Reservierung</small></span></span></summary>
          <div id="prepCovered" class="panel-body"></div>
        </details>

        <div id="prepLater" class="prep-later-slot"></div>

        <details class="prep-group prep-fresh-mobile" id="prepFreshGroup">
          <summary><span><b>Frisch bei der Mahlzeit</b><small id="prepFreshCount">Keine Aufgabe für jetzt</small></span></summary>
          <div id="prepFresh" class="panel-body"></div>
        </details>

        <section class="prep-ideas" aria-labelledby="prepIdeasHeading">
          <div class="prep-section-title"><div><span class="prep-order">4</span><h3 id="prepIdeasHeading">Batch-Prep & Kochideen</h3></div></div>
          <div class="prep-idea-block">
            <div class="prep-idea-head"><div><b>Aus bekannten Zutaten kochen</b><span class="small">Direkt passende Ideen</span></div><button class="btn secondary smallbtn" id="prepOpenRecipes" type="button">Alle</button></div>
            <div id="cookNow" class="prep-idea-list"></div>
          </div>
          <div class="prep-idea-block">
            <div class="prep-idea-head"><div><b>Rezepte auf Vorrat</b><span class="small">Sinnvoll portionsweise einfrierbar</span></div><button class="btn secondary smallbtn" id="prepOpenFreezerRecipes" type="button">Alle</button></div>
            <div id="freezerRecipes" class="prep-idea-list"></div>
          </div>
        </section>

        <details class="prep-tools" id="prepTools">
          <summary><span><span class="prep-order">5</span><b>Werkzeuge & Hinweise</b><small>Rechnen, vorbereiten, einfrieren</small></span></summary>
          <div class="prep-tools-body">
            <details class="accordion" id="batchCalculator">
              <summary>Portions- & Batch-Rechner</summary>
              <div class="prep-tool-content">
                <div class="field"><label>Lebensmittel</label><select id="batchFood"></select></div>
                <div class="grid2">
                  <div class="field"><label>Rohgewicht in g</label><input id="batchRaw" type="number" min="1" step="1" inputmode="decimal" placeholder="z. B. 340"><div class="small">Verwendbarer roher Anteil – nach Schälen/Putzen, falls nötig.</div></div>
                  <div class="field"><label>Fertiges Gesamtgewicht in g (optional)</label><input id="batchCooked" type="number" min="1" step="1" inputmode="decimal" placeholder="nach Garen/Pürieren"><div class="small">Für ein genaues Ergebnis nach dem Garen und nach tatsächlich zugegebenem Wasser wiegen.</div></div>
                </div>
                <div class="field"><label>Portionsgröße</label><select id="batchPortion"><option value="5">5 g</option><option value="10">10 g</option><option value="20">20 g</option><option value="35">35 g</option></select><div class="small">Standardgrößen für den Vorrat; kleine Restmengen werden separat gekennzeichnet.</div></div>
                <button class="btn secondary" id="calculateBatch" type="button">Portionen berechnen</button>
                <div id="batchResult" class="notice olive" style="display:none;margin-top:10px"></div>
              </div>
            </details>
            <details class="accordion">
              <summary>Vorbereitungshinweise</summary>
              <div id="starchGuide" class="guide-grid prep-tool-content"></div>
            </details>
            <details class="accordion">
              <summary>Sicher abkühlen, einfrieren und auftauen</summary>
              <div class="prep-tool-content small">Gekochtes rasch in kleine Portionen teilen und innerhalb von etwa 1–2 Stunden kühlen oder einfrieren; Reis innerhalb einer Stunde. Pur einfrieren; Muttermilch, Pre und Öl erst nach dem Erwärmen ergänzen. Aufgetautes innerhalb von 24 Stunden verwenden und nicht erneut einfrieren.</div>
            </details>
          </div>
        </details>

        <div id="prepNow" class="prep-render-staging" hidden></div>
      </section>

      <section class="prep-panel" id="prepPanelShopping" role="tabpanel" hidden>
        <div class="prep-panel-heading"><div><span class="prep-kicker">EINKAUF</span><h2>Einkauf für 7 Tage</h2><p>Aus Plan und eingetragenem Gefriervorrat. Abhaken bedeutet: bereits zu Hause.</p></div></div>
        <div id="shoppingList" class="prep-shopping-list"></div>
      </section>

      <section class="prep-panel" id="prepPanelStock" role="tabpanel" hidden>
        <div class="prep-panel-heading prep-stock-heading"><div><span class="prep-kicker">VORRAT</span><h2>Gefriervorrat</h2><p>Älteste Portionen werden zuerst verbraucht.</p></div><button class="btn secondary smallbtn" id="addInventory" type="button">+ Vorrat</button></div>
        <div id="inventoryList" class="prep-inventory-list"></div>
      </section>`;
  }

  function applyPanelState() {
    document.querySelectorAll("#prep [data-prep-panel]").forEach((button) => {
      const selected = button.dataset.prepPanel === activePanel;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    const panels = {
      prepare: document.getElementById("prepPanelPrepare"),
      shopping: document.getElementById("prepPanelShopping"),
      stock: document.getElementById("prepPanelStock"),
    };
    Object.entries(panels).forEach(([key, panel]) => {
      if (panel) panel.hidden = key !== activePanel;
    });
  }

  function bindSegments() {
    document.querySelectorAll("#prep [data-prep-panel]").forEach((button) => {
      button.onclick = () => {
        activePanel = button.dataset.prepPanel || "prepare";
        applyPanelState();
        document.getElementById("prep")?.scrollIntoView({ block: "start" });
      };
    });
    document.querySelector('nav button[data-view="prep"]')?.addEventListener("click", () => {
      if (!hasNeededShoppingHint()) return;
      activePanel = "shopping";
      applyPanelState();
    });
    applyPanelState();
  }

  function actionablePrepItems() {
    return prepItems()
      .filter((item) =>
        !item.advice.covered &&
        item.f.id !== "rapsoel" &&
        !freshAtMealFood(item.f) &&
        item.advice.missingGrams > 0,
      )
      .sort((a, b) => a.demand.firstDate.localeCompare(b.demand.firstDate));
  }

  function compactTaskNode(node) {
    node.classList.add("prep-task-mobile");
    const row = node.querySelector(":scope > .row");
    if (row && !row.querySelector(".prep-task-marker")) {
      const marker = document.createElement("span");
      marker.className = "prep-task-marker";
      marker.setAttribute("aria-hidden", "true");
      row.prepend(marker);
    }
    return node;
  }

  function organizePrepTasks() {
    const staging = document.getElementById("prepNow");
    const todayBox = document.getElementById("prepToday");
    const tomorrowBox = document.getElementById("prepTomorrow");
    const laterBox = document.getElementById("prepLater");
    if (!staging || !todayBox || !tomorrowBox || !laterBox) return;

    todayBox.replaceChildren();
    tomorrowBox.replaceChildren();
    laterBox.replaceChildren();

    const all = actionablePrepItems();
    const urgent = all.filter((item) => item.demand.firstDate <= addDays(today(), 1));
    const nodes = [...staging.querySelectorAll(":scope > .prep-task")];
    nodes.forEach((node, index) => {
      const item = urgent[index];
      if (!item) return;
      const target = item.demand.firstDate <= today() ? todayBox : tomorrowBox;
      target.appendChild(compactTaskNode(node));
    });

    const later = staging.querySelector(":scope > .later-prep");
    if (later) laterBox.appendChild(later);

    if (!todayBox.children.length) todayBox.innerHTML = '<div class="prep-empty-row">Heute ist nichts vorab vorzubereiten.</div>';
    if (!tomorrowBox.children.length) tomorrowBox.innerHTML = '<div class="prep-empty-row">Für morgen ist nichts vorab vorzubereiten.</div>';
  }

  function updatePrepSummary() {
    const box = document.getElementById("prepSummary");
    if (!box) return;
    const items = actionablePrepItems();
    const todayCount = items.filter((item) => item.demand.firstDate <= today()).length;
    const tomorrowDate = addDays(today(), 1);
    const tomorrowCount = items.filter((item) => item.demand.firstDate === tomorrowDate).length;
    const coveredText = document.getElementById("prepCoveredCount")?.textContent || "Keine Reservierung";
    box.innerHTML = `<span><b>${todayCount}</b> heute</span><span><b>${tomorrowCount}</b> morgen</span><span class="prep-summary-covered">${esc(coveredText)}</span>`;
  }

  function groupShoppingRows() {
    const list = document.getElementById("shoppingList");
    if (!list) return;
    const rows = [...list.querySelectorAll(":scope > .shopping-row")].filter((row) => row.querySelector("[data-pantry]"));
    if (!rows.length) return;

    const groups = new Map();
    rows.forEach((row) => {
      const id = row.querySelector("[data-pantry]")?.dataset.pantry;
      const category = food(id)?.category || "Sonstiges";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(row);
      row.querySelector(":scope > div")?.classList.add("prep-shopping-copy");
    });

    const followups = list.querySelector(":scope > .shopping-followups");
    const empty = list.querySelector(":scope > .empty");
    const fragment = document.createDocumentFragment();
    if (followups) fragment.appendChild(followups);
    groups.forEach((groupRows, category) => {
      const section = document.createElement("section");
      section.className = "prep-shopping-category";
      section.innerHTML = `<h3>${esc(category)}</h3>`;
      groupRows.forEach((row) => section.appendChild(row));
      fragment.appendChild(section);
    });
    if (empty) fragment.appendChild(empty);
    list.replaceChildren(fragment);
  }

  function recipeReservations() {
    const reservations = new Map();
    const days = buildDays(
      state.settings.planFrom && state.settings.planFrom >= today() ? state.settings.planFrom : today(),
      7,
    );
    days.forEach((day) => day.meals.forEach((meal) => {
      if (!meal.active || !meal.recipeInventoryId || mealIsCompleted(day.date, meal.meal)) return;
      reservations.set(meal.recipeName, (reservations.get(meal.recipeName) || 0) + 1);
    }));
    return reservations;
  }

  function stockStatusForItem(item, reservations, demandByFood) {
    if (item.kind === "recipe") {
      const required = reservations.get(item.recipeName) || 0;
      const available = recipeInventoryPortions(item.recipeName);
      if (!required) return { label: "frei", className: "dim" };
      if (available >= required) return { label: "gedeckt", className: "ok" };
      return { label: "knapp", className: "warn" };
    }
    const demand = demandByFood.get(item.foodId);
    if (!demand?.requiredGrams) return { label: "frei", className: "dim" };
    if (Number(demand.missingGrams) <= 0) return { label: "gedeckt", className: "ok" };
    if (Number(demand.availableGrams) > 0) return { label: "knapp", className: "warn" };
    return { label: "fehlt", className: "warn" };
  }

  function decorateInventory() {
    const list = document.getElementById("inventoryList");
    if (!list) return;
    const demandByFood = new Map(prepDemand().map((item) => [item.foodId, item]));
    const reservations = recipeReservations();
    const inv = state.inventory
      .slice()
      .filter((item) => inventoryPortionCount(item) > 0)
      .sort((a, b) => inventoryName(a).localeCompare(inventoryName(b), "de") || String(a.frozenDate).localeCompare(String(b.frozenDate)));
    const grouped = new Map();
    inv.forEach((item) => {
      const key = `${item.kind || "food"}|${item.kind === "recipe" ? item.recipeName : item.foodId || item.foodName}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });

    const groups = [...list.querySelectorAll(":scope > .stock-group")];
    [...grouped.values()].forEach((items, index) => {
      const group = groups[index];
      if (!group || !items.length) return;
      group.classList.add("prep-stock-group");
      const topRow = group.querySelector(":scope > .row");
      if (topRow && !topRow.querySelector(".prep-stock-status")) {
        const status = stockStatusForItem(items[0], reservations, demandByFood);
        const pill = document.createElement("span");
        pill.className = `pill prep-stock-status ${status.className}`;
        pill.textContent = status.label;
        topRow.appendChild(pill);
      }
      group.querySelectorAll(".stockline .small").forEach((line) => {
        if (line.querySelector(".prep-storage-kind")) return;
        const label = document.createElement("span");
        label.className = "prep-storage-kind";
        label.textContent = "eingefroren";
        line.prepend(document.createTextNode(" · "));
        line.prepend(label);
      });
    });
  }

  function compactIdeaRows() {
    document.querySelectorAll("#cookNow > .history").forEach((row) => row.classList.add("prep-idea-row"));
    document.querySelectorAll("#freezerRecipes > .freezer-recipe").forEach((row) => row.classList.add("prep-idea-row"));
  }

  function openRecipeCatalog(filter = "") {
    if (filter) recipeFilter = filter;
    showView("foods");
    setTimeout(() => {
      document.querySelector('#catalogSwitch [data-catalog-mode="recipes"]')?.click();
      if (filter) renderPrep();
      document.getElementById("recipesSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function rebindPrepCatalogActions() {
    const recipes = document.getElementById("prepOpenRecipes");
    if (recipes) recipes.onclick = () => openRecipeCatalog("");
    const freezer = document.getElementById("prepOpenFreezerRecipes");
    if (freezer) freezer.onclick = () => openRecipeCatalog("freezer");
  }

  installPrepMarkup();
  bindSegments();

  const baseRenderPrep = renderPrep;
  renderPrep = function mobilePrepRender() {
    const result = baseRenderPrep.apply(this, arguments);
    organizePrepTasks();
    updatePrepSummary();
    groupShoppingRows();
    decorateInventory();
    compactIdeaRows();
    rebindPrepCatalogActions();
    applyPanelState();
    return result;
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
