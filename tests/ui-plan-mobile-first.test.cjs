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
  `${helperBlock[1]}; this.api = { mobilePlanDayStatus, mobilePlanSelectedDate, mobilePlanStatusLabels, mobilePlanCompletionTitle };`,
  context,
);
const {
  mobilePlanDayStatus,
  mobilePlanSelectedDate,
  mobilePlanStatusLabels,
  mobilePlanCompletionTitle,
} = context.api;

test("Tagesstatus bündelt Neu, Allergen, Prep, Unvollständig und manuellen Schutz ohne Planner-Semantik zu ändern", () => {
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

test("automatische Drei-Tage-Fixierung wird nicht als manueller Schutz markiert", () => {
  const day = {
    date: "2026-09-02",
    meals: [{ meal: "lunch", active: true, focusId: "kartoffel", foodIds: ["kartoffel"], type: "bekannt" }],
  };
  const status = mobilePlanDayStatus(
    day,
    { "2026-09-02|lunch": { mode: "auto" } },
  );
  assert.equal(status.locked, false);
  assert.doesNotMatch(mobilePlanStatusLabels(status).join(" "), /Geschützt/);
});

test("aktiver leerer Slot hält einen teilweise gegessenen Tag offen statt ihn als erledigt auszugeben", () => {
  const day = {
    date: "2026-09-02",
    meals: [
      { meal: "breakfast", active: true, focusId: "hafer", foodIds: ["hafer"], type: "bekannt" },
      { meal: "lunch", active: true, focusId: "", foodIds: [], type: "bekannt", empty: true },
    ],
  };
  const status = mobilePlanDayStatus(day, {}, (date, meal) => meal === "breakfast");
  assert.equal(status.done, false);
  assert.equal(status.incomplete, true);
  assert.equal(status.completedCount, 1);
  assert.equal(
    mobilePlanCompletionTitle("Heute erledigt", status),
    "Heute teilweise erledigt",
  );
  assert.equal(
    mobilePlanCompletionTitle("Heute teilweise erledigt", status),
    "Heute teilweise erledigt",
    "Teilweise-erledigt-Titel bleibt bei wiederholter Tagesauswahl idempotent",
  );
});

test("vollständig erledigter Tag bleibt ausschließlich erledigt markiert", () => {
  const day = {
    date: "2026-09-02",
    meals: [{ meal: "lunch", active: true, focusId: "kartoffel", foodIds: ["kartoffel"], type: "bekannt" }],
  };
  const status = mobilePlanDayStatus(
    day,
    { "2026-09-02|lunch": { mode: "auto" } },
    () => true,
  );
  assert.equal(status.done, true);
  assert.equal(status.incomplete, false);
  assert.equal(status.locked, false);
  assert.equal(status.completedCount, 1);
  assert.equal(mobilePlanCompletionTitle("Heute erledigt", status), "Heute erledigt");
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

test("Mobile-Plan bleibt lazy, wird als letzte Plan-UI-Erweiterung geladen und nutzt planspezifische Styles", () => {
  assert.match(loader, /plan-mobile-ui\.js/);
  assert.match(source, /MobileUiLifecycle\.onRender\("plan", enhanceMobilePlan\)/);
  assert.doesNotMatch(source, /baseRenderPlanCore|renderPlanCore\s*=/);
  assert.match(source, /applySelectedDay/);
  assert.match(source, /plan-week-overview/);
  assert.match(source, /plan-secondary-actions/);
  assert.match(source, /document\.getElementById\("plan"\)\?\.classList\.contains\("active"\)/);
  assert.match(source, /state\.settings\.planFrom = nextFrom;[\s\S]*?save\(\);[\s\S]*?renderPlan\(\);/);
  assert.doesNotMatch(source, /save\(\);\s*renderAll\(\);/);
  assert.match(css, /#plan \.plan-week-days/);
  assert.match(css, /#plan #blockPlan > \[hidden\]/);
  assert.match(css, /flex:0 0 44px/);
  assert.match(css, /overflow-x:auto/);
  assert.doesNotMatch(css, /:root\s*\{/);
  assert.match(serviceWorker, /\.\/js\/plan-mobile-ui\.js\?v=10\.1\.26/);
  assert.match(serviceWorker, /\.\/plan-mobile-ui\.css\?v=10\.1\.26/);
});
