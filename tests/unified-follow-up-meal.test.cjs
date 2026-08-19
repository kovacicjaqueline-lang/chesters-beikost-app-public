const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const planningPath = path.join(__dirname, "..", "js", "planning.js");
const planningSource = fs.readFileSync(planningPath, "utf8");

function extractFunction(name, nextName) {
  const start = planningSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in planning.js`);
  const endMarker = `\nfunction ${nextName}(`;
  const end = planningSource.indexOf(endMarker, start);
  assert.notEqual(end, -1, `${nextName} must follow ${name} in planning.js`);
  return planningSource.slice(start, end);
}

function buildFollowUpMealForLog({ hasMealContext, foods, activeMeals }) {
  const source = extractFunction("followUpMealForLog", "rebuildFoodConsequences");
  return new Function(
    "plannerLogHasMealContext",
    "food",
    "plannerLogMealKeys",
    "phaseMealKeys",
    `${source}; return followUpMealForLog;`,
  )(
    hasMealContext,
    (id) => foods[id] || null,
    () => ["breakfast", "snack", "lunch", "dinner"],
    () => activeMeals,
  );
}

test("Unified Follow-up: planned logs keep their real meal context", () => {
  const followUpMealForLog = buildFollowUpMealForLog({
    hasMealContext: () => true,
    foods: { karotte: { meals: ["lunch"] } },
    activeMeals: ["lunch"],
  });

  assert.equal(followUpMealForLog({ meal: "lunch" }, "karotte"), "lunch");
});

test("Unified Follow-up: free logs choose only a FOOD.meals slot active in the current phase", () => {
  const followUpMealForLog = buildFollowUpMealForLog({
    hasMealContext: () => false,
    foods: { hafer: { meals: ["breakfast", "lunch"] } },
    activeMeals: ["lunch"],
  });

  assert.equal(followUpMealForLog({ meal: "" }, "hafer"), "lunch");
});

test("Unified Follow-up: no active eligible slot stays unplanned instead of fabricating lunch", () => {
  const followUpMealForLog = buildFollowUpMealForLog({
    hasMealContext: () => false,
    foods: { fruehstueck_only: { meals: ["breakfast"] } },
    activeMeals: ["lunch"],
  });

  assert.equal(followUpMealForLog({ meal: "" }, "fruehstueck_only"), "");
});

test("Unified Follow-up: planning source contains no lunch fallback for missing follow-up meal context", () => {
  const applySource = extractFunction("applyFollowUpPlan", "refusalHistory");
  assert.doesNotMatch(applySource, /record\.meal\s*\|\|\s*["']lunch["']/);
  assert.match(applySource, /let meal = plannerLogMealKeys\(\)\.includes\(record\.meal\) \? record\.meal : "";/);
  assert.match(applySource, /if \(!meal\) return \{ ok: true, date: "", unplanned: true \};/);

  assert.match(
    planningSource,
    /function scheduleFollowUp\(foodId, fromDate, meal = "", reason = "rejection", detail = "interest"\)/,
  );
});
