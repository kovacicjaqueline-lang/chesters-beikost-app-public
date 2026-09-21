"use strict";

/* Geplante Rezepte direkt aus Heute und Wochenplan öffnen.
 * Die vorhandene Recipe-V2-Darstellung und die zentrale recipeByName-Auflösung
 * bleiben die einzigen Quellen für Rezeptdetails und Rezeptnamen.
 *
 * Wichtig: Dieses UI-Feature baut den Planner nicht erneut auf. Der bereits
 * gerenderte Mahlzeitenkontext wird ausschließlich aus vorhandenen data-plan-
 * Payloads beziehungsweise dem tatsächlich gespeicherten Protokoll gelesen.
 */
(function plannedRecipeDetailsModule(root) {
  // Die Laufzeit-Mengenangaben werden in js/recipes.js präzisiert. Diese Korrekturen
  // halten die dazugehörige Zubereitung synchron, damit jede dort aufgeführte
  // Wassermenge auch eindeutig einem Zubereitungsschritt zugeordnet ist.
  const RECIPE_WATER_INSTRUCTION_FIXES = Object.freeze({
    "Obst-Quinoabrei": "Quinoa gründlich spülen und im Wasser sehr weich kochen. Je nach Konsistenzstufe fein pürieren oder zerdrücken und eine bekannte weiche Obstsorte fein vorbereitet unterrühren.",
    "Gemüse-Nudel-Sauce": "Zwiebel in wenig Rapsöl mild weich dünsten. Zucchini mit dem Wasser sehr weich garen und mit der geschälten gegarten Tomate, Zwiebel und Basilikum zu einer feinen, saftigen Sauce pürieren oder zerdrücken. Nudeln separat sehr weich kochen, passend klein schneiden und mit der Sauce vermengen. Ohne Salz und Zucker zubereiten.",
    "Karotten-Polenta-Brei": "Polenta mit dem Wasser weich kochen und mit Karottenpüree mischen. Rapsöl erst in die servierte Portion geben.",
    "Süßkartoffel-Rote-Linsen-Brei": "Rote Linsen im Wasser sehr weich kochen. Süßkartoffel sehr weich garen und beides fein pürieren oder zerdrücken. Pur einfrieren; Öl erst nach dem Erwärmen ergänzen.",
    "Zucchini-Quinoa-Brei": "Quinoa gründlich spülen und im Wasser sehr weich kochen. Zucchini sehr weich garen und für den Anfang mit dem Quinoa fein pürieren.",
    "Kichererbsenmehl-Zucchini-Taler": "Kichererbsenmehl, fein geriebene Zucchini und Wasser zu einem weichen Teig verrühren, kleine flache Taler formen und vollständig durchgaren. Nicht trocken oder knusprig werden lassen.",
    "Apfel-Birnen-Kompott": "Apfel und Birne mit dem Wasser weich dünsten und passend zur Konsistenz zerdrücken oder pürieren. Pur portionsweise einfrierbar.",
    "Karotte-Süßkartoffel-Brei": "Karotte und Süßkartoffel sehr weich dämpfen und nach und nach mit dem Wasser fein pürieren oder zerdrücken. Öl erst in die servierte Portion geben.",
    "Brokkoli-Kartoffel-Stampf": "Brokkoli und Kartoffel sehr weich garen, mit der Gabel zerdrücken und nach und nach mit dem Wasser bis zur gewünschten weichen Konsistenz lockern. Kartoffel nicht lange mixen, damit sie nicht klebrig wird.",
    "Zucchini-Kartoffel-Brei": "Zucchini und Kartoffel sehr weich garen. Kartoffel zerdrücken, Zucchini unterheben und nach und nach mit dem Wasser bis zur passenden Konsistenz pürieren oder lockern.",
    "Erbsen-Kartoffel-Stampf": "Erbsen vollständig weich kochen und mit Kartoffel fein zerdrücken. Nach und nach mit dem Wasser bis zur gewünschten Konsistenz lockern; für eine glatte Konsistenz pürieren.",
    "Kürbis-Linsen-Suppe": "Kürbis und rote Linsen im Wasser sehr weich köcheln. Petersilie und optional eine kleine Menge milden Kreuzkümmel einrühren, mit Rapsöl abrunden und je nach Stufe pürieren oder grob zerdrücken. Ohne Salz kochen.",
    "Mildes Rote-Linsen-Dhal": "Linsen im Wasser mit mild gegarter Zwiebel und optional einem Hauch Knoblauch sehr weich und cremig kochen. Mit wenig Kurkuma abrunden, für Babys mild halten und ohne Salz zubereiten.",
    "Huhn-Karotte-Nudel-Topf": "Zwiebel mild weich dünsten. Huhn vollständig durchgaren. Karotte und Nudeln im Wasser sehr weich kochen und alles mit Huhn, Zwiebel sowie Petersilie passend zerkleinern.",
    "Huhn-Brokkoli-Reis": "Zwiebel mild weich dünsten. Reis im Wasser sehr weich kochen. Huhn vollständig durchgaren, Brokkoli weich dämpfen und mit Reis, Zwiebel, Petersilie und Rapsöl passend zerdrücken.",
    "Rind-Gemüse-Bolognese": "Zwiebel und optional wenig Knoblauch in Öl mild weich dünsten. Rind vollständig garen, Karotte und Tomate mit dem Wasser weich kochen und mit Basilikum und Oregano zu einer aromatischen, feinen Sauce verarbeiten. Zu weichen Nudeln oder Polenta servieren; ohne Salz zubereiten.",
    "Tomaten-Linsen-Sauce": "Zwiebel und optional wenig Knoblauch in Rapsöl mild weich dünsten. Rote Linsen mit Tomate und Wasser sehr weich kochen, Basilikum einarbeiten und fein pürieren oder zerdrücken.",
    "Brokkoli-Linsen-Pasta": "Brokkoli und rote Linsen im Wasser sehr weich kochen. Rapsöl und Petersilie oder Basilikum einarbeiten und zu einer saftigen Sauce verarbeiten. Mit kleinen sehr weichen Nudeln mischen.",
    "Gemüse-Pasta mit Zucchini und Tomate": "Zwiebel in Rapsöl mild weich dünsten. Zucchini und Tomate mit dem Wasser weich zu einer saftigen Sauce garen, Basilikum einarbeiten und mit sehr weichen kleinen Nudeln vermengen.",
    "Lachs-Reis-Erbsen": "Reis im Wasser sehr weich kochen und Erbsen vollständig weich garen. Lachs vollständig garen und sorgfältig auf Gräten prüfen. Alles mit Butter und Dill zerdrücken; saftig und ohne Salz servieren.",
    "Kabeljau-Tomaten-Gemüse": "Tomate und Zucchini mit dem Wasser weich garen. Kabeljau vollständig garen und sorgfältig auf Gräten prüfen. Mit Gemüse, Rapsöl und Petersilie oder Dill zerkleinern.",
    "Weiches Rührei": "Butter sanft schmelzen lassen. Ei mit Wasser oder bereits eingeführter Vollmilch und Petersilie oder Schnittlauch verrühren, vollständig stocken lassen, dabei weich halten und in passende kleine Stücke teilen.",
    "Hummus mit weichen Gemüsesticks": "Kichererbsen mit dem Wasser sehr glatt und cremig pürieren. Tahin nur nach eingeführtem Sesam verwenden. Gurke, Karotte, Zucchini oder Süßkartoffel nur in einer konkret mechanisch weichen, sicher greifbaren Form ohne harte, zähe oder spröde Bissen anbieten.",
    "Kürbis-Kichererbsen-Creme": "Kichererbsen und Kürbis sehr weich garen und mit dem Wasser, mildem Kreuzkümmel und Rapsöl glatt pürieren oder fein zerdrücken.",
    "Tofu-Zucchini-Reis": "Reis im Wasser sehr weich kochen. Knoblauch, falls verwendet, kurz mild weich dünsten. Naturtofu vollständig erhitzen, fein zerdrücken und mit weicher Zucchini, Reis, Petersilie und Rapsöl vermengen.",
    "Huhn-Lugaw": "Ingwer und optional Zwiebel oder Knoblauch sehr mild weich dünsten. Reis im Wasser sehr weich zu einem dicken Brei kochen. Huhn vollständig garen, sehr fein zerkleinern und mit dem Aromaten untermischen.",
    "Sayote-Huhn-Reis": "Ingwer und optional Zwiebel mild weich dünsten. Sayote und Reis im Wasser sehr weich garen, Huhn vollständig durchgaren und alles mit dem Aromaten passend zerkleinern.",
    "Monggo-Süßkartoffel-Brei": "Zwiebel und optional Knoblauch mild weich dünsten. Mungbohnen im Wasser sehr weich kochen und mit Süßkartoffel sowie dem Aromaten pürieren oder fein zerdrücken.",
    "Ube-Hafer-Brei": "Ube vollständig weich garen. Hafer im Wasser weich kochen und mit Ube fein pürieren. Keine rohe Ube verwenden.",
    "Joghurt-Hafer-Waffeln": "Naturjoghurt, fein gemahlenen Hafer, Ei und Wasser zu einem glatten Teig verrühren. Im Waffeleisen vollständig, aber nur hell und weich ausbacken; harte Kanten abschneiden und vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
    "Bohnen-Kartoffel-Stampf": "Bohnen vollständig weich garen, bei Bedarf Schalen entfernen und gemeinsam mit Kartoffel, Petersilie und Butter oder Rapsöl fein zerdrücken. Mit dem Wasser bis zur gewünschten weichen Konsistenz lockern. Je nach aktueller Konsistenzstufe glatt, grob gestampft oder mit sehr weichen kleinen Stückchen anbieten. Keine gesüßten oder stark gesalzenen Bohnenkonserven verwenden.",
    "Huhn-Zucchini-Nockerl": "Zwiebel mild weich dünsten. Huhn vollständig garen und sehr fein zerkleinern, Zucchini sehr weich garen und gut ausdrücken. Mit Ei, Weizen, Rapsöl, Zwiebel und Petersilie zu einem weichen, nicht festen Teig verrühren; bei Bedarf bis zu 15 ml Wasser einarbeiten. Kleine längliche Nockerl in siedendem Wasser vollständig garen. Vor dem Servieren ein Nockerl aufschneiden: es muss durchgegart, weich, nicht gummiartig und unter leichtem Druck gut zerdrückbar sein.",
    "Rind-Karotten-Nockerl": "Zwiebel mild weich dünsten. Rind vollständig garen und sehr fein zerkleinern, Karotte sehr weich garen und fein zerdrücken. Mit Ei, Weizen, Rapsöl, Zwiebel und Petersilie zu einem weichen, nicht festen Teig verrühren; bei Bedarf bis zu 15 ml Wasser einarbeiten. Kleine längliche Nockerl in siedendem Wasser vollständig garen. Vor dem Servieren ein Nockerl aufschneiden: es muss durchgegart, weich, nicht gummiartig und unter leichtem Druck gut zerdrückbar sein.",
  });

  function installRecipeWaterInstructionFixes(recipes = typeof RECIPES !== "undefined" ? RECIPES : null) {
    if (!Array.isArray(recipes)) return false;
    let changed = false;
    for (let recipe of recipes) {
      let note = RECIPE_WATER_INSTRUCTION_FIXES[recipe?.name];
      if (!note || recipe.note === note) continue;
      recipe.note = note;
      changed = true;
    }
    return changed;
  }

  installRecipeWaterInstructionFixes();

  function normalizedRecipeContext(recipeName, foodIds = []) {
    return {
      recipeName: String(recipeName || "").trim(),
      foodIds: [...new Set((foodIds || []).filter(Boolean).map(String))],
    };
  }

  function planPayloadRecipeContext(encodedPayload) {
    if (!encodedPayload) return normalizedRecipeContext("", []);
    try {
      let payload = JSON.parse(decodeURIComponent(String(encodedPayload)));
      return normalizedRecipeContext(payload?.recipeName, payload?.foodIds || []);
    } catch (_error) {
      return normalizedRecipeContext("", []);
    }
  }

  function completedLogRecipeContext(logId, logs = []) {
    let log = (logs || []).find((entry) => String(entry?.id || "") === String(logId || ""));
    if (!log) return normalizedRecipeContext("", []);
    return normalizedRecipeContext(log.recipeName, log.foodIds || []);
  }

  function recipeContextHints(recipe, foodIds = [], resolveFoodId = (name) => name) {
    if (!recipe) return [];
    let plannedIds = new Set((foodIds || []).filter(Boolean));
    if (!plannedIds.size) return [];
    let hints = [];
    let sets = [recipe.requires || [], ...(recipe.alternatives || [])];
    let hasSetVariants =
      (recipe.alternatives || []).length > 0 &&
      (recipe.variantLabels?.length === sets.length || recipe.legacyNames?.length === sets.length);
    if (hasSetVariants) {
      let variantIndex = sets.findIndex((requirements) =>
        requirements.length > 0 &&
        requirements.every((name) => {
          let id = resolveFoodId(name);
          return !!id && plannedIds.has(id);
        })
      );
      if (variantIndex >= 0) {
        let label = recipe.variantLabels?.[variantIndex] || recipe.legacyNames?.[variantIndex] || "";
        if (label) hints.push(label);
      }
    }
    for (let option of [...(recipe.oneOf || []), ...(recipe.milkChoices || [])]) {
      let id = resolveFoodId(option);
      if (id && plannedIds.has(id)) hints.push(option);
    }
    return [...new Set(hints.filter(Boolean))];
  }

  function addRecipeChevron(node) {
    if (!node || node.querySelector?.(".planned-recipe-chevron")) return;
    let doc = node.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!doc?.createElement) return;
    let chevron = doc.createElement("span");
    chevron.className = "planned-recipe-chevron";
    chevron.textContent = "›";
    chevron.setAttribute?.("aria-hidden", "true");
    if (chevron.style) {
      chevron.style.color = "var(--accent)";
      chevron.style.fontSize = "20px";
      chevron.style.lineHeight = "1";
      chevron.style.flex = "0 0 auto";
    }
    node.appendChild?.(chevron);
  }

  function markRecipeTitle(node, recipeName, foodIds = []) {
    if (!node || !recipeName) return node;
    node.dataset.plannedRecipeName = String(recipeName);
    node.dataset.plannedRecipeFoodIds = (foodIds || []).filter(Boolean).join(",");
    node.classList?.add("planned-recipe-title");
    node.setAttribute?.("role", "button");
    node.setAttribute?.("tabindex", "0");
    node.setAttribute?.("aria-label", `Rezept ${recipeName} öffnen`);
    node.setAttribute?.("title", "Rezept öffnen");
    if (node.style) {
      node.style.cursor = "pointer";
      node.style.touchAction = "manipulation";
      node.style.color = "var(--accent)";
      node.style.display = "inline-flex";
      node.style.alignItems = "center";
      node.style.gap = "5px";
      node.style.minHeight = "44px";
      node.style.maxWidth = "100%";
      node.style.padding = "7px 0";
    }
    addRecipeChevron(node);
    return node;
  }

  function markRecipeHitArea(node, recipeName, foodIds = []) {
    if (!node || !recipeName) return node;
    node.dataset.plannedRecipeName = String(recipeName);
    node.dataset.plannedRecipeFoodIds = (foodIds || []).filter(Boolean).join(",");
    node.classList?.add("planned-recipe-hit-area");
    node.setAttribute?.("title", "Rezept öffnen");
    if (node.style) {
      node.style.cursor = "pointer";
      node.style.touchAction = "manipulation";
    }
    return node;
  }

  function markCompletedRecipeTitle(node, recipeName, foodIds = []) {
    if (!node || !recipeName) return null;
    if (node.querySelector?.("[data-planned-recipe-name]"))
      return node.querySelector("[data-planned-recipe-name]");
    let text = String(node.textContent || "");
    let index = text.lastIndexOf(recipeName);
    if (index < 0) return markRecipeTitle(node, recipeName, foodIds);
    let prefix = text.slice(0, index);
    let doc = node.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!doc?.createElement) return markRecipeTitle(node, recipeName, foodIds);
    node.textContent = "";
    if (prefix && doc.createTextNode) node.appendChild(doc.createTextNode(prefix));
    let recipeTarget = doc.createElement("span");
    recipeTarget.textContent = recipeName;
    node.appendChild(recipeTarget);
    return markRecipeTitle(recipeTarget, recipeName, foodIds);
  }

  function recipeContextForMealNode(mealNode, currentState = null) {
    if (!mealNode) return normalizedRecipeContext("", []);
    if (mealNode.querySelector?.(".completed-title")) {
      let edit = mealNode.querySelector?.(".editCompletedLog[data-log]");
      return completedLogRecipeContext(edit?.dataset?.log || "", currentState?.logs || []);
    }
    let planSource = mealNode.querySelector?.("[data-plan]");
    return planPayloadRecipeContext(planSource?.dataset?.plan || "");
  }

  function decorateMealRecipeTitle(mealNode, currentState = null) {
    let context = recipeContextForMealNode(mealNode, currentState);
    if (!context.recipeName) return null;
    let completedTitle = mealNode.querySelector?.(".completed-title");
    if (completedTitle)
      return markCompletedRecipeTitle(completedTitle, context.recipeName, context.foodIds);

    let title = markRecipeTitle(
      mealNode.querySelector?.(".dish-title, .manual-meal-title"),
      context.recipeName,
      context.foodIds,
    );
    let hitArea = mealNode.querySelector?.(
      ".meal-summary-main, :scope > .row > .grow, :scope > summary .grow",
    );
    if (hitArea && hitArea !== title)
      markRecipeHitArea(hitArea, context.recipeName, context.foodIds);
    return title;
  }

  function decorateRecipeTitles(container, currentState = null) {
    if (!container?.querySelectorAll) return 0;
    let decorated = 0;
    for (let mealNode of container.querySelectorAll(".mealbox, .manual-meal")) {
      if (decorateMealRecipeTitle(mealNode, currentState)) decorated += 1;
    }
    return decorated;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      RECIPE_WATER_INSTRUCTION_FIXES,
      installRecipeWaterInstructionFixes,
      normalizedRecipeContext,
      planPayloadRecipeContext,
      completedLogRecipeContext,
      recipeContextHints,
      markRecipeTitle,
      markRecipeHitArea,
      markCompletedRecipeTitle,
      recipeContextForMealNode,
      decorateMealRecipeTitle,
      decorateRecipeTitles,
    };
  }

  if (
    typeof document === "undefined" ||
    typeof renderHome !== "function" ||
    typeof renderPlan !== "function"
  ) return;

  function currentRecipeState(storedName, foodIds = []) {
    if (typeof recipeByName !== "function" || typeof recipeStates !== "function") return null;
    let recipeRecord = recipeByName(storedName);
    if (!recipeRecord) return null;
    let resolveFoodId = (name) => {
      let item = typeof foodByName === "function" ? foodByName(name) : null;
      return item?.id || "";
    };
    let hints = recipeContextHints(recipeRecord, foodIds, resolveFoodId);
    let previousQuery = typeof recipeQuery !== "undefined" ? recipeQuery : "";
    let states = [];
    try {
      if (typeof recipeQuery !== "undefined")
        recipeQuery = [storedName, recipeRecord.name, ...hints].filter(Boolean).join(" ");
      states = recipeStates();
    } finally {
      if (typeof recipeQuery !== "undefined") recipeQuery = previousQuery;
    }
    return states.find((recipe) => recipe?.name === recipeRecord.name) || null;
  }

  function openPlannedRecipeDetails(storedName, foodIds = []) {
    let recipe = currentRecipeState(storedName, foodIds);
    if (!recipe) {
      if (typeof showToast === "function") showToast("Rezeptbeschreibung nicht gefunden.");
      return false;
    }
    if (typeof openGeneric !== "function" || typeof renderRecipeCard !== "function") return false;

    openGeneric("Rezept", renderRecipeCard(recipe, { showDetails: true }));
    let card = document.querySelector("#genericBody .recipe-card-v2");
    if (card) card.open = true;
    if (typeof bindRecipeStockButtons === "function") bindRecipeStockButtons();
    return true;
  }

  function decorateHomeRecipeTitles() {
    return decorateRecipeTitles(
      document.getElementById("todayCard"),
      typeof state !== "undefined" ? state : null,
    );
  }

  function decoratePlanRecipeTitles() {
    return decorateRecipeTitles(
      document.getElementById("blockPlan"),
      typeof state !== "undefined" ? state : null,
    );
  }

  let originalRenderHome = renderHome;
  renderHome = function renderHomeWithPlannedRecipeDetails() {
    originalRenderHome();
    decorateHomeRecipeTitles();
  };

  let originalRenderPlan = renderPlan;
  renderPlan = function renderPlanWithPlannedRecipeDetails() {
    originalRenderPlan();
    decoratePlanRecipeTitles();
  };

  function recipeTarget(event) {
    return event.target?.closest?.("[data-planned-recipe-name]") || null;
  }

  function targetFoodIds(target) {
    return String(target?.dataset?.plannedRecipeFoodIds || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  document.addEventListener("click", (event) => {
    let target = recipeTarget(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    openPlannedRecipeDetails(target.dataset.plannedRecipeName, targetFoodIds(target));
  });

  document.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    let target = recipeTarget(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    openPlannedRecipeDetails(target.dataset.plannedRecipeName, targetFoodIds(target));
  });

  root.__plannedRecipeDetails = {
    openPlannedRecipeDetails,
    decorateHomeRecipeTitles,
    decoratePlanRecipeTitles,
  };
})(typeof window !== "undefined" ? window : globalThis);
