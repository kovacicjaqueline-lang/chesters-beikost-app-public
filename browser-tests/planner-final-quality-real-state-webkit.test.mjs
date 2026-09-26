import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

function compactMainDays(days = []) {
  return days.map((day) => ({
    date: day.date,
    meals: (day.meals || [])
      .filter((meal) => ["breakfast", "lunch", "dinner"].includes(meal.meal))
      .map((meal) => ({
        meal: meal.meal,
        active: !!meal.active,
        empty: !!meal.empty,
        focusId: meal.focusId || "",
        foodIds: [...(meal.foodIds || [])],
        baseFoodIds: [...(meal.baseFoodIds || [])],
        sampleFoodIds: [...(meal.sampleFoodIds || [])],
        recipeName: meal.recipeName || "",
        type: meal.type || "",
        lockedMode: meal.lockedMode || "",
        note: meal.note || "",
      })),
  }));
}

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    !!window.__beikostTest?.setState && window.__plannerPoliciesReady === true,
  );

  const diagnostics = await page.evaluate(() => {
    const api = window.__beikostTest;
    const culinaryTrace = [];
    const baseCulinaryAssessment = window.plannerCulinaryAssessment;
    if (typeof baseCulinaryAssessment === "function") {
      window.plannerCulinaryAssessment = function tracedPlannerCulinaryAssessment(ids, foods, meal, options = {}) {
        const result = baseCulinaryAssessment(ids, foods, meal, options);
        if (
          result &&
          !result.allowed &&
          ["breakfast", "lunch", "dinner"].includes(meal)
        ) {
          culinaryTrace.push({
            meal,
            foodIds: [...(ids || [])],
            foods: (ids || []).map((id) => {
              const record = (foods || []).find((item) => item?.id === id) || null;
              return {
                id,
                name: record?.name || "",
                category: record?.category || "",
                manualStatus: record?.manualStatus || "",
              };
            }),
            issues: [...(result.issues || [])],
            recipeBacked: !!options?.recipeBacked,
            learningOnly: !!options?.learningOnly,
            sampleOnly: !!options?.sampleOnly,
          });
        }
        return result;
      };
    }

    api.reset();
    let everyday = api.getState();
    const everydayDate = api.today();
    const banana = api.foodId("Banane");
    const egg = api.foodId("Ei");
    const carrot = api.foodId("Karotte");
    everyday.settings.appFocusMode = "everyday-recipes";
    everyday.settings.planFrom = everydayDate;
    everyday.settings.phaseSelected = "drei";
    everyday.planLocks = {};
    everyday.manualMeals = {};
    everyday.overrides = {};
    everyday.planLocks[`${everydayDate}|breakfast`] = {
      date: everydayDate,
      meal: "breakfast",
      focusId: banana,
      foodIds: [banana, egg],
      baseFoodIds: [banana, egg],
      sampleFoodIds: [],
      recipeName: "Bananen-Ei-Pancakes",
      recipeInventoryId: "",
      type: "bekannt kombinieren",
      active: true,
      mode: "manual",
      locked: true,
      planId: "everyday-recipe-plan",
    };
    everyday.planLocks[`${everydayDate}|lunch`] = {
      date: everydayDate,
      meal: "lunch",
      focusId: carrot,
      foodIds: [carrot],
      baseFoodIds: [],
      sampleFoodIds: [carrot],
      recipeName: "",
      recipeInventoryId: "",
      type: "Allergen einführen",
      active: true,
      mode: "manual",
      locked: true,
      planId: "everyday-food-plan",
    };
    api.setState(everyday);
    const everydayDays = window.buildDays(everydayDate, 1, false);
    const everydayTrace = culinaryTrace.splice(0);

    api.reset();
    let trusted = api.getState();
    const on = api.today();
    trusted.settings.phaseSelected = "drei";
    trusted.settings.planFrom = on;
    trusted.logs = [];
    trusted.manualMeals = {};
    trusted.planLocks = {};
    trusted.overrides = {};
    trusted.autoLockExcluded = {};
    trusted.inactivePlanKept = {};
    for (const record of trusted.foods) {
      if (record.allergenGroup) {
        record.active = false;
        record.manualStatus = "auto";
      } else if (record.active && record.category !== "Fett" && record.category !== "Kraut/Gewürz") {
        record.manualStatus = "Verträgliche Basis";
      }
    }
    const bread = trusted.foods.find((record) => record.id === "brot");
    if (!bread) throw new Error("Brot-FOOD fehlt");
    bread.active = false;
    bread.manualStatus = "auto";
    const exposureDate = api.addDays(on, -1);
    trusted.logs = [{
      id: "diagnostic-bread-history",
      date: exposureDate,
      meal: "lunch",
      entryType: "meal",
      focusId: bread.id,
      foodIds: [bread.id],
      baseFoodIds: [bread.id],
      sampleFoodIds: [],
      outcome: "eaten",
      foodOutcomes: { [bread.id]: "eaten" },
      createdAt: `${exposureDate}T12:00:00.000Z`,
    }];
    api.setState(trusted);
    const trustedDays = api.buildDays(on, 7);
    const trustedTrace = culinaryTrace.splice(0);
    if (typeof baseCulinaryAssessment === "function") {
      window.plannerCulinaryAssessment = baseCulinaryAssessment;
    }

    const compact = (days) => days.map((day) => ({
      date: day.date,
      meals: (day.meals || [])
        .filter((meal) => ["breakfast", "lunch", "dinner"].includes(meal.meal))
        .map((meal) => ({
          meal: meal.meal,
          active: !!meal.active,
          empty: !!meal.empty,
          focusId: meal.focusId || "",
          foodIds: [...(meal.foodIds || [])],
          baseFoodIds: [...(meal.baseFoodIds || [])],
          sampleFoodIds: [...(meal.sampleFoodIds || [])],
          recipeName: meal.recipeName || "",
          type: meal.type || "",
          lockedMode: meal.lockedMode || "",
          note: meal.note || "",
        })),
    }));

    return {
      everyday: compact(everydayDays),
      everydayTrace,
      trusted: compact(trustedDays),
      trustedTrace,
    };
  });

  console.log(`[planner-final-quality-real-state] ${JSON.stringify(diagnostics)}`);

  const trustedVisible = diagnostics.trusted.flatMap((day) => day.meals)
    .filter((meal) => meal.active && !meal.empty && meal.focusId);
  assert.equal(
    trustedVisible.length,
    21,
    `Sieben Tage mit bekannten Nicht-Allergenen müssen 21 vollständige Hauptmahlzeiten liefern: ${JSON.stringify(diagnostics.trusted)}`,
  );
} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
