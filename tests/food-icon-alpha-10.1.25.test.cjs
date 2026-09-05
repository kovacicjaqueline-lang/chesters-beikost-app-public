"use strict";

const test = require("node:test");
const path = require("node:path");

const { assertV2Asset } = require("./helpers/icon-integrity-png.cjs");

const ROOT = path.resolve(__dirname, "..");
const APPROVED_ICON_IDS = [
  "nektarine", "brombeere", "ribisel", "feige", "mangold", "spargel", "petersilienwurzel",
  "weizengriess", "bulgur", "kidneybohne", "braune-gruene-linse", "schnittlauch", "pecannuss",
  "paranuss", "macadamia", "lupine", "miesmuschel", "mohn", "tempeh", "kaeferbohne", "rhabarber",
  "chinakohl", "rucola", "radicchio", "endivie", "rettich", "blattsalat", "holunder", "preiselbeere",
  "quitte", "kren", "walnussoel", "sojaoel", "weizenkeimoel", "huettenkaese", "honig",
];

for (const id of APPROVED_ICON_IDS) {
  test(`FOOD-Icon ${id}: gemeinsamer V2-Alpha- und Rastercontract`, () => {
    assertV2Asset(ROOT, `assets/illustrations-v2/foods/${id}.svg`);
  });
}
