const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js/plan-mobile-ui.js"), "utf8");
const css = fs.readFileSync(path.join(root, "plan-mobile-ui.css"), "utf8");
const loader = fs.readFileSync(path.join(root, "js/plan-checks-ui.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

const helperBlock = source.match(
  /\/\* MOBILE-PLAN-HELPERS START \*\/([\s\S]*?)\/\* MOBILE-PLAN-HELPERS END \*\//,
);
assert.ok(helperBlock, "Mobile-Plan-Helferblock muss vorhanden sein");

const context = { Set };
vm.runInNewContext(
  `${helperBlock[1]}; this.api = { mobilePlanDayStatus, mobilePlanSelectedDate, mobilePlanStatusLabels };`,
  context,
);
const { mobilePlanDayStatus, mobilePlanSelectedDate, mobilePlanStatusLabels } = context.api;

test("Tagesstatus bündelt Neu, Allergen, Prep, Unvollständig und Schutz ohne Planner-Semantik zu ändern", () => {
  const day = {
    date: "2026-09-01",
    meals: [
      { meal: "breakfast", active: true, focusId: "hafer", foodIds: ["hafer"], type: "bekannt kombinieren" },
      { meal: "lunch", active: true, focusId: "ei", foodIds: ["kartoffel", "ei"], type: "Allergen einführen" },
      { meal: "dinner", active: true, focusId: "", foodIds: [], type: "manuell", empty: true },
    ],
  };
  const status = mobilePlanDayStatus(
    day,
    { "2026-09-01|lunch": { mode: "manual" } },
    (date, meal) => meal === "breakfast",
    (id) => id === "ei",
    new Set(["2026-09-01"]),
  );

  assert.deepEqual(
    { ...status },
    {
      newFood: true,
      allergen: true,
      prep: true,
      incomplete: true,
      locked: true,
      done: false,
      plannedCount: 3,
      completedCount: 1,
    },
  );
  assert.deepEqual(
    [...mobilePlanStatusLabels(status)],
    ["Neu", "Allergen", "Prep", "Unvollständig", "Geschützt"],
  );
});

test("vollständig erledigter Tag wird als erledigt erkannt und nicht mehr als geschützt markiert", () => {
  const day = {
    date: "2026-09-02",
    meals: [{ meal: "lunch", active: true, focusId: "kartoffel", foodIds: ["kartoffel"], type: "bekannt kombinieren" }],
  };
  const status = mobilePlanDayStatus(
    day,
    { "2026-09-02|lunch": { mode: "auto" } },
    () => true,
  );
  assert.equal(status.done, true);
  assert.equal(status.locked, false);
  assert.equal(status.completedCount, 1);
});

test("Tagesauswahl bleibt innerhalb der sichtbaren Woche und fällt auf Heute oder den ersten Tag zurück", () => {
  const days = [
    { date: "2026-09-01" },
    { date: "2026-09-02" },
    { date: "2026-09-03" },
  ];
  assert.equal(mobilePlanSelectedDate(days, "2026-09-02", "2026-09-01"), "2026-09-02");
  assert.equal(mobilePlanSelectedDate(days, "2026-08-31", "2026-09-03"), "2026-09-03");
  assert.equal(mobilePlanSelectedDate(days, "2026-08-31", "2026-08-30"), "2026-09-01");
});

test("Mobile-Plan wird als letzte Plan-UI-Erweiterung geladen und nutzt ausschließlich planspezifische Styles", () => {
  assert.match(loader, /plan-mobile-ui\.js/);
  assert.match(source, /baseRenderPlanCore/);
  assert.match(source, /applySelectedDay/);
  assert.match(source, /plan-week-overview/);
  assert.match(source, /plan-secondary-actions/);
  assert.match(css, /#plan \.plan-week-days/);
  assert.match(css, /#plan #blockPlan > \[hidden\]/);
  assert.doesNotMatch(css, /:root\s*\{/);
  assert.match(serviceWorker, /\.\/js\/plan-mobile-ui\.js\?v=10\.1\.26/);
  assert.match(serviceWorker, /\.\/plan-mobile-ui\.css\?v=10\.1\.26/);
});
