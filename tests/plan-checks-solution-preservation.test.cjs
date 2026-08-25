"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

test("Plan-Checks-Loader installiert Contract vor Preservation vor UI-Core", () => {
  const source = fs.readFileSync(path.join(root, "js", "plan-checks-ui.js"), "utf8");
  const contract = source.indexOf("plan-checks-contract-extension.js");
  const preservation = source.indexOf("plan-checks-solution-preservation.js");
  const uiCore = source.indexOf("plan-checks-ui-core.js");

  assert.ok(contract >= 0, "Contract-Extension muss geladen werden");
  assert.ok(preservation > contract, "Preservation muss den erweiterten AP3-Report sehen");
  assert.ok(uiCore > preservation, "UI-Core darf erst nach der Preservation starten");
});

test("Preservation verwirft Lösung, die projected Allergen-Einführung wieder öffnet", () => {
  const source = fs.readFileSync(path.join(root, "js", "plan-checks-solution-preservation.js"), "utf8");
  const candidates = [
    { id: "reopens-intro", preserves: false },
    { id: "keeps-intro", preserves: true },
  ];

  const context = {
    console,
    state: { introCovered: true },
    today: () => "2026-08-25",
    buildDays: () => [{ date: "2026-08-25", meals: [] }],
  };
  context.globalThis = context;
  context.PlannerPlanCheckSolutions = Object.freeze({
    INTRO_PROJECTED_CODE: "ALLERGEN_INTRODUCTION_PROJECTED",
    goalKey: (item) => item.details.allergenIntroductionKey,
    report: () => ({
      items: context.state.introCovered ? [{
        code: "ALLERGEN_INTRODUCTION_PROJECTED",
        type: "projected_covered_goal",
        details: { allergenIntroductionKey: "family:erdnuss" },
      }] : [],
    }),
    findSolution: (_item, _days, options = {}) => {
      const rejected = new Set(options.rejectedSolutionIds || []);
      return candidates.find((candidate) => !rejected.has(candidate.id)) || null;
    },
    applySolution: (candidate) => {
      context.state.introCovered = candidate.preserves;
      return true;
    },
  });

  vm.createContext(context);
  vm.runInContext(source, context, { filename: "plan-checks-solution-preservation.js" });

  const days = [{ date: "2026-08-25", meals: [] }];
  const solution = context.PlannerPlanCheckSolutions.findSolution(
    { code: "ANY_OPEN_GOAL", details: { allergenIntroductionKey: "family:ei" } },
    days,
    {},
  );

  assert.equal(solution?.id, "keeps-intro");
  assert.equal(context.state.introCovered, true, "temporäre Simulation darf den echten State nicht verändern");
});
