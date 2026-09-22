import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";



async function waitForApp(page) {
  await page.waitForFunction(() =>
    !!window.__beikostTest?.getState &&
    !!window.__plannedRecipeDetails &&
    window.__plannerPoliciesReady === true,
  );
}

async function seedCopyLog(page) {
  await page.evaluate(() => {
    const state = window.__beikostTest.reset();
    state.backupMeta.chesterContextSeeded = true;
    state.logs = [{
      id: "latency-copy-source",
      date: "2026-09-10",
      meal: "lunch",
      foodIds: ["karotte"],
      focusId: "karotte",
      recipeName: "",
      outcome: "tried",
      foodOutcomes: { karotte: "tried" },
      entryType: "food",
      baseFoodIds: [],
      sampleFoodIds: ["karotte"],
      foodRoles: { karotte: "sample" },
      individualRatings: false,
      amount: "30",
      note: "Latenztest",
      textureKnown: true,
      textureStage: 2,
      createdAt: "2026-09-10T10:00:00.000Z",
      updatedAt: "2026-09-10T10:00:00.000Z",
    }];
    window.__beikostTest.setState(state);
    window.renderAll();
  });
}

async function seedPlannedRecipe(page) {
  await page.evaluate(() => {
    const state = window.__beikostTest.reset();
    const date = window.__beikostTest.today();
    const foodIds = ["hafer", "ei", "apfel"];
    state.settings.textureStage = 2;
    state.settings.planFrom = date;
    for (const id of foodIds) {
      const item = state.foods.find((food) => food.id === id);
      if (item) item.manualStatus = "Verträgliche Basis";
    }
    const exposureDate = window.__beikostTest.addDays(date, -1);
    state.logs.push({
      id: "latency-recipe-ready",
      date: exposureDate,
      meal: "lunch",
      focusId: "hafer",
      foodIds: [...foodIds],
      baseFoodIds: [...foodIds],
      sampleFoodIds: [],
      recipeName: "",
      outcome: "eaten",
      foodOutcomes: { hafer: "eaten", ei: "eaten", apfel: "eaten" },
      entryType: "meal",
      textureStage: 2,
      createdAt: `${exposureDate}T12:00:00.000Z`,
    });
    state.manualMeals[`${date}|lunch`] = {
      date,
      meal: "lunch",
      focusId: "hafer",
      foodIds: [...foodIds],
      baseFoodIds: [...foodIds],
      sampleFoodIds: [],
      optionalAddons: [],
      recipeName: "Obst-Hafer-Pancakes",
      recipeInventoryId: "",
      type: "manuell",
      note: "Open-Latency-Regression",
      manualAdded: true,
      createdAt: new Date().toISOString(),
    };
    window.__beikostTest.setState(state);
    window.renderAll();
  });
}

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // Protokoll kopieren: nur ein Formular-Render im Klicktask; 7-Tage-Vorschläge erst nach Paint.
  await seedCopyLog(page);
  const staleLogScroll = await page.evaluate(async () => {
    window.copyLogEntry("latency-copy-source");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const sheet = document.querySelector("#logModal .sheet");
    if (!sheet) throw new Error("Log-Sheet fehlt");
    const spacer = document.createElement("div");
    spacer.setAttribute("data-test-log-scroll-spacer", "true");
    spacer.style.height = "2000px";
    document.getElementById("logForm")?.appendChild(spacer);
    sheet.scrollTop = sheet.scrollHeight;
    const scrollTop = sheet.scrollTop;
    window.closeLog();
    return scrollTop;
  });
  assert.ok(staleLogScroll > 0, "Testaufbau muss eine vorherige Log-Scrollposition erzeugen");
  const logImmediate = await page.evaluate(() => {
    const basePrepDemand = window.prepDemand;
    const baseRenderLogForm = window.renderLogForm;
    const baseLogFoodCandidates = window.logFoodCandidates;
    window.__openUiLatencyProbe = {
      painted: false,
      prepCalls: 0,
      prepBeforePaint: 0,
      foodCandidateCalls: 0,
      foodCandidateBeforePaint: 0,
      logFormCalls: 0,
      basePrepDemand,
      baseRenderLogForm,
      baseLogFoodCandidates,
    };
    window.prepDemand = function probedPrepDemand(...args) {
      window.__openUiLatencyProbe.prepCalls += 1;
      if (!window.__openUiLatencyProbe.painted) window.__openUiLatencyProbe.prepBeforePaint += 1;
      return basePrepDemand.apply(this, args);
    };
    window.renderLogForm = function probedRenderLogForm(...args) {
      window.__openUiLatencyProbe.logFormCalls += 1;
      return baseRenderLogForm.apply(this, args);
    };
    window.logFoodCandidates = function probedLogFoodCandidates(...args) {
      window.__openUiLatencyProbe.foodCandidateCalls += 1;
      if (!window.__openUiLatencyProbe.painted) window.__openUiLatencyProbe.foodCandidateBeforePaint += 1;
      return baseLogFoodCandidates.apply(this, args);
    };
    requestAnimationFrame(() => { window.__openUiLatencyProbe.painted = true; });
    window.copyLogEntry("latency-copy-source");
    const sheet = document.querySelector("#logModal .sheet");
    return {
      modalOpen: document.getElementById("logModal").classList.contains("open"),
      title: document.getElementById("logTitle").textContent,
      prepCalls: window.__openUiLatencyProbe.prepCalls,
      foodCandidateCalls: window.__openUiLatencyProbe.foodCandidateCalls,
      logFormCalls: window.__openUiLatencyProbe.logFormCalls,
      scrollTop: sheet?.scrollTop || 0,
    };
  });
  assert.equal(logImmediate.modalOpen, true, "Kopierdialog muss im Klicktask sichtbar geöffnet werden");
  assert.equal(logImmediate.title, "Essen kopieren");
  assert.equal(logImmediate.logFormCalls, 1, "Kopieren darf das vollständige Logformular nur einmal rendern");
  assert.equal(logImmediate.prepCalls, 0, "Planbasierte Lebensmittelvorschläge dürfen Öffnen nicht blockieren");
  assert.equal(logImmediate.foodCandidateCalls, 0, "Lebensmittelvorschläge dürfen den ersten Paint nicht blockieren");
  assert.equal(logImmediate.scrollTop, 0, "Kopierdialog muss immer am Formularanfang öffnen");
  await page.waitForFunction(() => window.__openUiLatencyProbe.prepCalls > 0 && window.__openUiLatencyProbe.foodCandidateCalls > 0);
  const logDeferred = await page.evaluate(() => ({
    painted: window.__openUiLatencyProbe.painted,
    prepBeforePaint: window.__openUiLatencyProbe.prepBeforePaint,
    foodCandidateBeforePaint: window.__openUiLatencyProbe.foodCandidateBeforePaint,
  }));
  assert.equal(logDeferred.painted, true);
  assert.equal(logDeferred.prepBeforePaint, 0, "prepDemand muss vollständig hinter dem ersten Paint liegen");
  assert.equal(logDeferred.foodCandidateBeforePaint, 0, "Lebensmittelvorschläge müssen vollständig hinter dem ersten Paint liegen");
  await page.evaluate(() => {
    window.prepDemand = window.__openUiLatencyProbe.basePrepDemand;
    window.renderLogForm = window.__openUiLatencyProbe.baseRenderLogForm;
    window.logFoodCandidates = window.__openUiLatencyProbe.baseLogFoodCandidates;
    window.closeLog();
  });

  // Lebensmittel-Details: 7-Tage-Plan darf erst nach sichtbarem Modal berechnet werden.
  const foodImmediate = await page.evaluate(() => {
    const baseBuildDays = window.buildDays;
    window.__openUiLatencyProbe = {
      painted: false,
      build7Calls: 0,
      build7BeforePaint: 0,
      baseBuildDays,
    };
    window.buildDays = function probedBuildDays(...args) {
      if (Number(args[1]) === 7) {
        window.__openUiLatencyProbe.build7Calls += 1;
        if (!window.__openUiLatencyProbe.painted) window.__openUiLatencyProbe.build7BeforePaint += 1;
      }
      return baseBuildDays.apply(this, args);
    };
    requestAnimationFrame(() => { window.__openUiLatencyProbe.painted = true; });
    window.showFoodInfo(window.food("karotte"));
    return {
      modalOpen: document.getElementById("genericModal").classList.contains("open"),
      loading: document.getElementById("genericBody").textContent.includes("Planung wird geladen"),
      build7Calls: window.__openUiLatencyProbe.build7Calls,
    };
  });
  assert.equal(foodImmediate.modalOpen, true, "Lebensmittel-Detaildialog muss vor der Planberechnung öffnen");
  assert.equal(foodImmediate.loading, true);
  assert.equal(foodImmediate.build7Calls, 0);
  await page.waitForFunction(() => window.__openUiLatencyProbe.build7Calls > 0);
  const foodDeferred = await page.evaluate(() => ({
    painted: window.__openUiLatencyProbe.painted,
    build7BeforePaint: window.__openUiLatencyProbe.build7BeforePaint,
    loading: document.getElementById("genericBody").textContent.includes("Planung wird geladen"),
  }));
  assert.equal(foodDeferred.painted, true);
  assert.equal(foodDeferred.build7BeforePaint, 0);
  assert.equal(foodDeferred.loading, false);
  await page.evaluate(() => {
    window.buildDays = window.__openUiLatencyProbe.baseBuildDays;
    window.closeGeneric();
  });

  // Allergen-Planung: 21-Tage-Suche liegt hinter dem Paint; bis dahin ist Speichern gesperrt.
  const allergenImmediate = await page.evaluate(() => {
    const allergen = window.__beikostTest.getState().foods.find((food) => food.active && food.allergenGroup);
    if (!allergen) throw new Error("Aktives Allergen für Latenztest fehlt");
    const baseBuildDays = window.buildDays;
    window.__openUiLatencyProbe = {
      painted: false,
      build21Calls: 0,
      build21BeforePaint: 0,
      baseBuildDays,
    };
    window.buildDays = function probedBuildDays(...args) {
      if (Number(args[1]) === 21) {
        window.__openUiLatencyProbe.build21Calls += 1;
        if (!window.__openUiLatencyProbe.painted) window.__openUiLatencyProbe.build21BeforePaint += 1;
      }
      return baseBuildDays.apply(this, args);
    };
    requestAnimationFrame(() => { window.__openUiLatencyProbe.painted = true; });
    window.openAllergenSchedule(allergen.id);
    return {
      modalOpen: document.getElementById("genericModal").classList.contains("open"),
      loading: !!document.getElementById("allergenPlanLoading"),
      saveDisabled: document.getElementById("saveAllergenDate")?.disabled,
      build21Calls: window.__openUiLatencyProbe.build21Calls,
    };
  });
  assert.equal(allergenImmediate.modalOpen, true);
  assert.equal(allergenImmediate.loading, true);
  assert.equal(allergenImmediate.saveDisabled, true, "Speichern bleibt bis zur Bestandsprüfung gesperrt");
  assert.equal(allergenImmediate.build21Calls, 0, "21-Tage-Suche darf Öffnen nicht blockieren");
  await page.waitForFunction(() => window.__openUiLatencyProbe.build21Calls > 0 && !document.getElementById("saveAllergenDate")?.disabled);
  const allergenDeferred = await page.evaluate(() => ({
    painted: window.__openUiLatencyProbe.painted,
    build21BeforePaint: window.__openUiLatencyProbe.build21BeforePaint,
    loading: !!document.getElementById("allergenPlanLoading"),
  }));
  assert.equal(allergenDeferred.painted, true);
  assert.equal(allergenDeferred.build21BeforePaint, 0);
  assert.equal(allergenDeferred.loading, false);
  await page.evaluate(() => {
    window.buildDays = window.__openUiLatencyProbe.baseBuildDays;
    window.closeGeneric();
  });

  // Geplante Rezeptdetails: teure recipeStates-Auswertung erst nach sichtbarem Ladezustand.
  await seedPlannedRecipe(page);
  await page.waitForFunction(() => !!document.querySelector('#todayCard [data-planned-recipe-name="Obst-Hafer-Pancakes"]'));
  const recipeImmediate = await page.evaluate(() => {
    const baseRecipeStates = window.recipeStates;
    window.__openUiLatencyProbe = {
      painted: false,
      recipeCalls: 0,
      recipeBeforePaint: 0,
      baseRecipeStates,
    };
    window.recipeStates = function probedRecipeStates(...args) {
      window.__openUiLatencyProbe.recipeCalls += 1;
      if (!window.__openUiLatencyProbe.painted) window.__openUiLatencyProbe.recipeBeforePaint += 1;
      return baseRecipeStates.apply(this, args);
    };
    requestAnimationFrame(() => { window.__openUiLatencyProbe.painted = true; });
    document.querySelector('#todayCard [data-planned-recipe-name="Obst-Hafer-Pancakes"]').click();
    return {
      modalOpen: document.getElementById("genericModal").classList.contains("open"),
      loading: !!document.getElementById("plannedRecipeLoading"),
      recipeCalls: window.__openUiLatencyProbe.recipeCalls,
    };
  });
  assert.equal(recipeImmediate.modalOpen, true, "Rezeptdialog muss vor recipeStates sichtbar sein");
  assert.equal(recipeImmediate.loading, true);
  assert.equal(recipeImmediate.recipeCalls, 0);
  await page.waitForFunction(() => window.__openUiLatencyProbe.recipeCalls > 0 && !!document.querySelector("#genericBody .recipe-card-v2[open]"));
  const recipeDeferred = await page.evaluate(() => ({
    painted: window.__openUiLatencyProbe.painted,
    recipeBeforePaint: window.__openUiLatencyProbe.recipeBeforePaint,
    loading: !!document.getElementById("plannedRecipeLoading"),
  }));
  assert.equal(recipeDeferred.painted, true);
  assert.equal(recipeDeferred.recipeBeforePaint, 0);
  assert.equal(recipeDeferred.loading, false);
  await page.evaluate(() => {
    window.recipeStates = window.__openUiLatencyProbe.baseRecipeStates;
    window.closeGeneric();
  });
} finally {
  await closeBrowserApp({ context, browser, server });
}

console.log("Open UI latency WebKit regressions passed.");
