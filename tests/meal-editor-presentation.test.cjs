"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mealEditorPreparationControlModel,
  mealEditorRecipePresentationModel,
} = require("../js/meal-editor-recipe-variants.js");

test("freie FOOD-Darreichung zeigt nur strukturierte Auswahl und macht Einzeloption statisch", () => {
  assert.deepEqual(
    mealEditorPreparationControlModel([], false),
    { visible: false, selectable: false, staticLabel: "", keys: [] },
  );

  assert.deepEqual(
    mealEditorPreparationControlModel(
      [{ key: "fingerfood", label: "Weiches Fingerfood" }],
      false,
    ),
    {
      visible: true,
      selectable: false,
      staticLabel: "Weiches Fingerfood",
      keys: ["fingerfood"],
    },
  );

  assert.deepEqual(
    mealEditorPreparationControlModel(
      [
        { key: "pureed", label: "Fein und glatt vom Löffel" },
        { key: "mashed", label: "Weich zerdrückt" },
        { key: "pureed", label: "Duplikat" },
      ],
      false,
    ),
    {
      visible: true,
      selectable: true,
      staticLabel: "",
      keys: ["pureed", "mashed"],
    },
  );
});

test("bei ausgewähltem Rezept gibt es keine FOOD-eigene Darreichungsauswahl", () => {
  assert.deepEqual(
    mealEditorPreparationControlModel(
      [
        { key: "pureed", label: "Fein und glatt vom Löffel" },
        { key: "mashed", label: "Weich zerdrückt" },
      ],
      true,
    ),
    { visible: false, selectable: false, staticLabel: "", keys: [] },
  );
});

test("Rezeptdarreichung folgt dem vorhandenen Handling-Contract und der bevorzugten zulässigen Form", () => {
  const recipe = { name: "Obst-Haferbrei" };
  const contracts = {
    "Obst-Haferbrei": {
      modes: ["spoon-smooth", "spoon-mashed"],
    },
  };
  const eligibility = () => ({
    migrated: true,
    eligibleModes: ["spoon-smooth", "spoon-mashed"],
    preferredModes: ["spoon-mashed", "spoon-smooth"],
  });

  assert.deepEqual(
    mealEditorRecipePresentationModel(recipe, {}, contracts, eligibility),
    { mode: "spoon-mashed", label: "Weich zerdrückt", blocked: false },
  );
});

test("gesperrte Rezeptdarreichung wird nicht als vermeintlich zulässige Form angezeigt", () => {
  const recipe = { name: "Huhn-Gemüse-Muffins" };
  const contracts = {
    "Huhn-Gemüse-Muffins": {
      modes: ["finger-graspable"],
      oralRequiredCapability: "structured-chew",
    },
  };
  const eligibility = () => ({
    migrated: true,
    eligibleModes: [],
    preferredModes: [],
  });

  assert.deepEqual(
    mealEditorRecipePresentationModel(recipe, {}, contracts, eligibility),
    { mode: "", label: "Aktuell noch nicht passend", blocked: true },
  );
});
