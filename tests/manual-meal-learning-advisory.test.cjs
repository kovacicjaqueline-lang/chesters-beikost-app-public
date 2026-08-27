"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  manualMealFlowLearningValidation,
} = require("../js/manual-meal-flow.js");

const root = path.resolve(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(root, "js", "manual-meal-flow.js"), "utf8");

function validationFor(statuses, names = {}, overrides = {}) {
  const ids = Object.keys(statuses);
  return manualMealFlowLearningValidation(
    {
      ok: false,
      ids,
      samples: ids,
      bases: [],
      components: [],
      excludedIds: [],
      unsafeBaseIds: [],
      unsafeComponentIds: [],
      unsafeIds: ids,
      multipleUnsafeIds: ids.length > 1 ? ids : [],
      messages: ids.length > 1
        ? [`Nur eine neue oder unsichere Einführung gleichzeitig: ${ids.join(", ")}.`]
        : [],
      ...overrides,
    },
    (id) => statuses[id] || "",
    (id) => names[id] || id,
  );
}

test("Probiert/Wiederholung zählt nicht als zweites neues Lebensmittel", () => {
  const result = validationFor(
    { bangus: "Offen", reis: "Probiert" },
    { bangus: "Bangus (Milkfish)", reis: "Reis" },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.multipleUnsafeIds, []);
  assert.deepEqual(result.multipleNewIds, []);
  assert.deepEqual(result.messages, []);
  assert.deepEqual(result.advisories, []);
});

test("mehrere offene Lebensmittel erzeugen nur einen nicht blockierenden Hinweis", () => {
  const result = validationFor(
    { bangus: "Offen", tofu: "Offen" },
    { bangus: "Bangus (Milkfish)", tofu: "Tofu" },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.multipleUnsafeIds, []);
  assert.deepEqual(result.multipleNewIds, ["bangus", "tofu"]);
  assert.deepEqual(result.messages, []);
  assert.equal(result.advisories.length, 1);
  assert.match(result.advisory, /Mehrere noch nicht probierte Lebensmittel/);
  assert.match(result.advisory, /Bangus \(Milkfish\), Tofu/);
});

test("strukturelle Auswahlfehler bleiben trotz nicht blockierendem Lernhinweis blockierend", () => {
  const result = validationFor(
    { bangus: "Offen", tofu: "Offen" },
    { bangus: "Bangus (Milkfish)", tofu: "Tofu" },
    {
      unsafeBaseIds: ["bangus"],
      messages: [
        "Noch nicht als Hauptbasis geeignet: Bangus (Milkfish).",
        "Nur eine neue oder unsichere Einführung gleichzeitig: bangus, tofu.",
      ],
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.multipleUnsafeIds, []);
  assert.deepEqual(result.messages, ["Noch nicht als Hauptbasis geeignet: Bangus (Milkfish)."]);
  assert.equal(result.advisories.length, 1);
});

test("Editor wandelt den grünen Zustand bei mehreren offenen Lernlebensmitteln in einen Hinweis um", () => {
  assert.match(runtimeSource, /\.manual-role-group\.sample \.removeManualSelected\[data-food\]/);
  assert.match(runtimeSource, /status\(item\) === "Offen"/);
  assert.match(runtimeSource, /Hinweis zur Einführung/);
  assert.match(runtimeSource, /notice olive manual-role-advisory/);
  assert.match(runtimeSource, /manualMealValidation = function manualFlowManualMealValidation/);
});
