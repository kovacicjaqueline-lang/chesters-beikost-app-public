"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  mealEditorPreparationControlModel,
  mealEditorRecipePresentationModel,
  mealEditorRecipeNormalizePresentationData,
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

test("ein echter Rezeptwechsel übernimmt keine veraltete Darreichung", () => {
  const unchanged = {
    recipeName: "Obst-Haferbrei",
    presentationMode: "spoon-smooth",
  };
  assert.strictEqual(
    mealEditorRecipeNormalizePresentationData(
      unchanged,
      "Obst-Haferbrei",
      "finger-graspable",
    ),
    unchanged,
    "ohne Rezeptwechsel bleibt die gespeicherte Darreichung unverändert",
  );

  assert.deepEqual(
    mealEditorRecipeNormalizePresentationData(
      {
        recipeName: "Bananen-Ei-Pancakes",
        presentationMode: "spoon-smooth",
      },
      "Obst-Haferbrei",
      "finger-graspable",
    ),
    {
      recipeName: "Bananen-Ei-Pancakes",
      presentationMode: "finger-graspable",
    },
    "ein neues Rezept bekommt seine eigene Darreichung statt der alten",
  );

  assert.deepEqual(
    mealEditorRecipeNormalizePresentationData(
      { recipeName: "", presentationMode: "spoon-smooth" },
      "Obst-Haferbrei",
      "",
    ),
    { recipeName: "" },
    "beim Wechsel auf freie FOODs darf keine Rezeptdarreichung hängen bleiben",
  );
});

const runtimeSource = fs.readFileSync(
  path.resolve(__dirname, "..", "js", "meal-editor-recipe-variants.js"),
  "utf8",
);

test("Editor filtert nur die UI und löscht bestehende foodPreparationKeys nicht still", () => {
  assert.match(runtimeSource, /handlingPreparationOptions\(foodId, state\.settings, FOOD_HANDLING_CONTRACT\)/);
  assert.doesNotMatch(runtimeSource, /manualMealFlowPreparationOptions/);
  assert.doesNotMatch(runtimeSource, /dispatchEvent\(/);
  assert.match(runtimeSource, /recipe-presentation-summary/);
});
