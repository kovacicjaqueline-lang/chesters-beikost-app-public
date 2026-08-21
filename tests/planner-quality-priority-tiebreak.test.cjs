"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const quality = require("../js/planner-quality-rotation.js");

const on = "2026-08-21";
const diffDays = (a, b) => Math.round(
  (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000,
);

function context() {
  return quality.plannerQualityEnsureContext({
    lastFocus: new Map(),
    inventoryReserved: new Map(),
    plannedUse: new Map(),
  });
}

function priorityOptions({ preferInventoryInPlan = false, inventory = {}, usage = {}, priorities = {} } = {}) {
  return {
    settings: { preferInventoryInPlan },
    diffFn: diffDays,
    inventoryPortionsFn: (id) => Number(inventory[id] || 0),
    usageCountFn: (id) => Number(usage[id] || 0),
    effectivePriorityFn: (item) => Number(priorities[item.id] || 0),
  };
}

test("Weekly Rotation verdrängt keinen bevorzugten Vorratskandidaten", () => {
  const ctx = context();
  ctx.qualityFoodUse.set("vorrat", 3);
  ctx.qualityLastFoodUse.set("vorrat", "2026-08-20");
  const results = [
    { f: { id: "vorrat" }, type: "bekannt / Vorrat" },
    { f: { id: "ohne-vorrat" }, type: "bekannt kombinieren" },
  ];
  const options = priorityOptions({
    preferInventoryInPlan: true,
    inventory: { vorrat: 1 },
  });

  assert.equal(
    quality.plannerQualityChooseResult(results, ctx, on, diffDays).f.id,
    "ohne-vorrat",
    "Testaufbau muss zeigen, dass reine Rotation den kürzlich verwendeten Vorratskandidaten verdrängen würde",
  );
  assert.equal(
    quality.plannerQualityChooseKnownResult(results, ctx, on, diffDays, options).f.id,
    "vorrat",
  );
});

test("Weekly Rotation verdrängt keinen effectivePriority-Vorteil für Saison oder Reise", () => {
  const ctx = context();
  ctx.qualityFoodUse.set("priorisiert", 2);
  ctx.qualityLastFoodUse.set("priorisiert", "2026-08-20");
  const results = [
    { f: { id: "priorisiert" }, type: "bekannt kombinieren" },
    { f: { id: "neutral" }, type: "bekannt kombinieren" },
  ];
  const options = priorityOptions({
    priorities: { priorisiert: -18, neutral: 0 },
  });

  assert.equal(
    quality.plannerQualityChooseResult(results, ctx, on, diffDays).f.id,
    "neutral",
    "Testaufbau muss zeigen, dass reine Rotation den effectivePriority-Vorteil überstimmen würde",
  );
  assert.equal(
    quality.plannerQualityChooseKnownResult(results, ctx, on, diffDays, options).f.id,
    "priorisiert",
  );
});

test("Weekly Rotation bleibt Tie-Breaker zwischen ansonsten gleich priorisierten Kandidaten", () => {
  const ctx = context();
  ctx.qualityFoodUse.set("wiederholt", 2);
  ctx.qualityLastFoodUse.set("wiederholt", "2026-08-20");
  const results = [
    { f: { id: "wiederholt" }, type: "bekannt kombinieren" },
    { f: { id: "frisch" }, type: "bekannt kombinieren" },
  ];
  const options = priorityOptions();

  assert.deepEqual(
    quality.plannerQualityKnownCandidatePriorityTuple(results[0], on, ctx, options),
    quality.plannerQualityKnownCandidatePriorityTuple(results[1], on, ctx, options),
    "Testkandidaten müssen nach den bisherigen Planner-Prioritäten gleichwertig sein",
  );
  assert.equal(
    quality.plannerQualityChooseKnownResult(results, ctx, on, diffDays, options).f.id,
    "frisch",
  );
});
