"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function runFile(context, relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

function loadContext() {
  const context = {
    clone: (value) => JSON.parse(JSON.stringify(value)),
  };
  vm.createContext(context);
  runFile(context, "data/foods.js");
  runFile(context, "js/state.js");
  runFile(context, "js/migrations.js");
  vm.runInContext(`
    this.__foodDb = FOOD_DB;
    this.__aliasAuditKeys = Object.keys(FOOD_ALIAS_AUDIT_10_1_25).sort();
    this.__canonicalId = canonicalId;
    this.__mergeFoods = mergeFoods;
    this.__applyFoodAliasAudit = applyFoodAliasAudit;
  `, context);
  return context;
}

const EXPECTED = Object.freeze({
  Porree: "lauch",
  Kohlsprossen: "rosenkohl",
  Petersilwurzel: "petersilienwurzel",
});

function aliasTerms(food) {
  return String(food?.alias || "")
    .split(/[,;/|]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

test("approved Austrian aliases are attached to exactly the three canonical foods", () => {
  const context = loadContext();

  assert.deepEqual(
    Array.from(context.__aliasAuditKeys),
    ["lauch", "petersilienwurzel", "rosenkohl"],
    "Feldsalat/Vogerlsalat oder andere nicht freigegebene Aliasfälle dürfen nicht Teil dieses Audits sein",
  );

  for (const [alias, id] of Object.entries(EXPECTED)) {
    const food = context.__foodDb.find((entry) => entry.id === id);
    assert.ok(food, `${id}: kanonischer FOOD-Datensatz fehlt`);
    assert.ok(aliasTerms(food).includes(alias), `${id}: Alias ${alias} fehlt`);
    assert.equal(context.__canonicalId("", alias), id, `${alias}: canonicalId muss ${id} liefern`);
  }
});

test("alias audit is idempotent and never duplicates an approved alias", () => {
  const context = loadContext();
  context.__applyFoodAliasAudit(context.__foodDb);
  context.__applyFoodAliasAudit(context.__foodDb);

  for (const [alias, id] of Object.entries(EXPECTED)) {
    const food = context.__foodDb.find((entry) => entry.id === id);
    assert.equal(aliasTerms(food).filter((value) => value === alias).length, 1, `${id}: ${alias} darf nicht dupliziert werden`);
  }
});

test("mergeFoods folds saved alias records into canonical FOOD IDs without duplicates", () => {
  const context = loadContext();
  const saved = [
    { id: "custom-porree", name: "Porree", category: "Gemüse", meals: ["lunch", "dinner"] },
    { id: "custom-kohlsprossen", name: "Kohlsprossen", category: "Gemüse", meals: ["lunch", "dinner"] },
    { id: "custom-petersilwurzel", name: "Petersilwurzel", category: "Wurzel/Knolle", meals: ["lunch", "dinner"] },
  ];

  const merged = context.__mergeFoods(saved);
  const ids = Array.from(merged, (entry) => entry.id);

  for (const id of Object.values(EXPECTED)) {
    assert.equal(ids.filter((value) => value === id).length, 1, `${id}: genau ein kanonischer Datensatz erwartet`);
  }
  for (const raw of saved) {
    assert.equal(ids.includes(raw.id), false, `${raw.id}: Alias-Dublette darf nicht erhalten bleiben`);
  }
});
