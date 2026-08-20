"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const policy = require("../js/planner-iron-preference.js");
const policySource = fs.readFileSync(
  path.join(root, "js", "planner-iron-preference.js"),
  "utf8",
);

function item(id, {
  category = "Gemüse",
  ironRich = false,
  sort = 0,
  trusted = true,
  plannerRank = 2,
  meals = ["breakfast", "lunch", "dinner"],
  allergenGroup = "",
  plannerRole = "",
} = {}) {
  return {
    id,
    name: id,
    category,
    ironRich,
    sort,
    trusted,
    plannerRank,
    meals,
    allergenGroup,
    plannerRole,
  };
}

function installRuntime(foods, amount = "taste") {
  const context = {
    state: { foods: foods.map((food) => ({ ...food })) },
    AMOUNT_LEVELS: { taste: { rank: 0 }, building: { rank: 1 } },
    currentAmountLevel: () => amount,
    isTrustedBase: (food) => !!food?.trusted,
    isMilkProductFood: (food) => ["kuhmilch", "naturjoghurt", "buttermilch"].includes(food?.id),
    rank: (food) => Number(food?.plannerRank || 0),
    canCombine: (food) => Number(food?.plannerRank || 0) >= 1,
    enforceSingleStarch: (_focus, companions) => companions || [],
    combinationPaused: () => false,
  };
  context.plannerRole = (food) => String(food?.plannerRole || "");
  context.plannerFoodCanBeBase = (food) => context.plannerRole(food) !== "component";
  context.plannerFoodCanBeAutomaticFocus = (food) => context.plannerRole(food) !== "component";
  context.companionFor = (focus, meal) => context.state.foods
    .filter((candidate) =>
      candidate.id !== focus.id &&
      candidate.meals.includes(meal) &&
      !candidate.allergenGroup,
    )
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))[0] || null;
  context.ironCompanion = () => item("legacy-third", { category: "Fleisch", ironRich: true });

  vm.createContext(context);
  vm.runInContext(`${policySource}\nthis.__install = installPlannerIronPreferenceRuntime;`, context);
  assert.equal(context.__install(), true);
  return context;
}

function selected(context, focusId, meal = "lunch") {
  const focus = context.state.foods.find((food) => food.id === focusId);
  return context.companionFor(focus, meal, "2026-08-20", "bekannt");
}

test("PLAN-08 kulinarische Rollen unterscheiden Obst, Avocado, Blattgemüse, Milchformen und Akzente", () => {
  assert.equal(policy.plannerCulinaryRole({ id: "banane", category: "Obst" }), "fruit");
  assert.equal(policy.plannerCulinaryRole({ id: "avocado", category: "Obst" }), "savory-fruit");
  assert.equal(policy.plannerCulinaryRole({ id: "spinat", category: "Blattgemüse" }), "savory-vegetable");
  assert.equal(policy.plannerCulinaryRole({ id: "sojajoghurt", category: "Hülsenfrucht" }), "cultured-creamy");
  for (const id of ["zwiebel", "knoblauch", "kakao", "calamansi", "zitrone", "butter", "honig"]) {
    assert.equal(
      policy.plannerCulinaryRole({ id, category: id === "butter" ? "Milchprodukt" : "Sonstiges" }),
      "accent",
    );
  }
});

test("PLAN-08 Blattgemüse fällt außerhalb des Frühstücks unter Obst-herzhaft-Nachrangigkeit", () => {
  const banana = { id: "banane", category: "Obst" };
  const spinach = { id: "spinat", category: "Blattgemüse" };
  assert.equal(policy.plannerAutomaticPairPreferencePenalty(banana, spinach, "lunch"), 1);
  assert.equal(policy.plannerAutomaticPairPreferencePenalty(banana, spinach, "breakfast"), 0);
});

test("PLAN-08 Avocado wird nicht wie süßes Obst gegen herzhaftes Gemüse bestraft", () => {
  const avocado = { id: "avocado", category: "Obst" };
  const spinach = { id: "spinat", category: "Blattgemüse" };
  assert.equal(policy.plannerAutomaticPairPreferencePenalty(avocado, spinach, "lunch"), 0);
});

test("PLAN-08 Gurke bevorzugt die fachlich freigegebenen Begleiter gegenüber Kartoffel", () => {
  const cucumber = { id: "gurke", category: "Gemüse" };
  const potato = { id: "kartoffel", category: "Wurzel/Knolle" };
  for (const preferred of [
    { id: "avocado", category: "Obst" },
    { id: "naturjoghurt", category: "Milchprodukt" },
    { id: "ei", category: "Ei" },
    { id: "kichererbse", category: "Hülsenfrucht" },
  ]) {
    assert.equal(policy.plannerAutomaticPairPreferencePenalty(cucumber, preferred, "lunch"), 0);
  }
  assert.equal(policy.plannerAutomaticPairPreferencePenalty(cucumber, potato, "lunch"), 2);
});

test("PLAN-08 Runtime ersetzt den alten Kartoffel-Gurke-Favoriten durch Gurke-Avocado", () => {
  const context = installRuntime([
    item("gurke", { category: "Gemüse" }),
    item("kartoffel", { category: "Wurzel/Knolle", sort: 0 }),
    item("avocado", { category: "Obst", sort: 50 }),
  ]);
  assert.equal(selected(context, "gurke")?.id, "avocado");
});

test("PLAN-08 bekannte allergene Gurken-Begleiter bleiben auswählbar, ohne ihre Allergenidentität zu verlieren", () => {
  for (const preferred of [
    item("naturjoghurt", { category: "Milchprodukt", allergenGroup: "Milch", sort: 50 }),
    item("ei", { category: "Ei", allergenGroup: "Ei", ironRich: true, sort: 50 }),
  ]) {
    const context = installRuntime([
      item("gurke", { category: "Gemüse" }),
      item("kartoffel", { category: "Wurzel/Knolle", sort: 0 }),
      preferred,
    ]);
    const result = selected(context, "gurke");
    assert.equal(result?.id, preferred.id);
    assert.equal(result?.allergenGroup, preferred.allergenGroup);
  }
});

test("PLAN-08 unbekannte allergene Gurken-Begleiter werden nicht beiläufig eingeführt", () => {
  const context = installRuntime([
    item("gurke", { category: "Gemüse" }),
    item("kartoffel", { category: "Wurzel/Knolle", sort: 0 }),
    item("naturjoghurt", {
      category: "Milchprodukt",
      allergenGroup: "Milch",
      plannerRank: 0,
      trusted: false,
      sort: 50,
    }),
  ]);
  assert.equal(selected(context, "gurke")?.id, "kartoffel");
});

test("PLAN-08 Gurke bleibt ein weicher Fallback, wenn noch keine bessere bekannte Basis verfügbar ist", () => {
  const context = installRuntime([
    item("gurke", { category: "Gemüse" }),
    item("kartoffel", { category: "Wurzel/Knolle", sort: 0 }),
  ]);
  assert.equal(selected(context, "gurke")?.id, "kartoffel");
});

test("PLAN-08 Runtime bevorzugt für Kartoffel einen neutralen Begleiter statt Gurke", () => {
  const context = installRuntime([
    item("kartoffel", { category: "Wurzel/Knolle" }),
    item("gurke", { category: "Gemüse", sort: 0 }),
    item("brokkoli", { category: "Gemüse", sort: 50 }),
  ]);
  assert.equal(selected(context, "kartoffel")?.id, "brokkoli");
});

test("PLAN-08 Runtime bevorzugt bei Banane eine neutrale Alternative statt Spinat", () => {
  const context = installRuntime([
    item("banane", { category: "Obst" }),
    item("spinat", { category: "Blattgemüse", sort: 0 }),
    item("hafer", { category: "Getreide/Stärke", sort: 50 }),
  ]);
  assert.equal(selected(context, "banane")?.id, "hafer");
});

test("PLAN-08 Kefir und Sojajoghurt werden kulinarisch cremig statt wie generische Protein-/Milchkomponenten gewertet", () => {
  for (const focus of [
    item("kefir", { category: "Milchprodukt" }),
    item("sojajoghurt", { category: "Hülsenfrucht" }),
  ]) {
    const context = installRuntime([
      focus,
      item("kartoffel", { category: "Wurzel/Knolle", sort: 0 }),
      item("hafer", { category: "Getreide/Stärke", sort: 50 }),
    ]);
    assert.equal(selected(context, focus.id)?.id, "hafer");
  }
});

test("PLAN-08 Akzentformen laufen über den zentralen component-Rollenvertrag und nicht als generische Begleiter", () => {
  const context = installRuntime([
    item("karotte", { category: "Gemüse" }),
    item("butter", { category: "Milchprodukt", sort: 0 }),
    item("hafer", { category: "Getreide/Stärke", sort: 50 }),
  ]);
  const butter = context.state.foods.find((food) => food.id === "butter");
  assert.equal(context.plannerRole(butter), "component");
  assert.equal(context.plannerFoodCanBeBase(butter), false);
  assert.equal(context.plannerFoodCanBeAutomaticFocus(butter), false);
  assert.equal(selected(context, "karotte")?.id, "hafer");
});
