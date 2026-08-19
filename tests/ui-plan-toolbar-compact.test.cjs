const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ui-meal-editor-footer.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const helperBlock = ui.match(
  /\/\* PLAN-TOOLBAR-SUMMARY START \*\/([\s\S]*?)\/\* PLAN-TOOLBAR-SUMMARY END \*\//,
);
assert.ok(helperBlock, 'Plan-Toolbar-Helferblock muss vorhanden sein');
const context = {};
vm.runInNewContext(
  `${helperBlock[1]}; this.api = { planLockSummaryCounts, planLockSummaryHtml, compactPlanAmountLabel };`,
  context,
);
const { planLockSummaryCounts, planLockSummaryHtml, compactPlanAmountLabel } = context.api;

function visibleDays() {
  return [
    {
      date: '2026-08-19',
      meals: [
        { meal: 'lunch', active: true, focusId: 'karotte' },
        { meal: 'breakfast', active: false, focusId: '' },
      ],
    },
    { date: '2026-08-20', meals: [{ meal: 'lunch', active: true, focusId: 'zucchini' }] },
    { date: '2026-08-21', meals: [{ meal: 'lunch', active: true, focusId: 'kartoffel' }] },
  ];
}

test('Plan-Kopf zählt nur Locks sichtbarer tatsächlich geplanter Mahlzeiten', () => {
  const counts = planLockSummaryCounts(visibleDays(), {
    '2026-08-19|lunch': { mode: 'auto' },
    '2026-08-20|lunch': { mode: 'auto' },
    '2026-08-19|breakfast': { mode: 'manual' },
    '2026-08-30|lunch': { mode: 'auto' },
    '2026-08-31|lunch': { mode: 'manual' },
  });
  assert.deepEqual({ ...counts }, { autoCount: 2, manualCount: 0 });
});

test('Plan-Kopf trennt automatische feste Planung und manuellen Schutz fachlich korrekt', () => {
  const counts = planLockSummaryCounts(visibleDays(), {
    '2026-08-19|lunch': { mode: 'auto' },
    '2026-08-20|lunch': { mode: 'auto' },
    '2026-08-21|lunch': { mode: 'manual' },
  });
  assert.deepEqual({ ...counts }, { autoCount: 2, manualCount: 1 });
  assert.equal(
    planLockSummaryHtml(counts),
    '<b>2</b> fest eingeplant · <b>1</b> manuell geschützt',
  );
});

test('erledigte sichtbare Auto- und Manual-Locks zählen nicht mehr im Plan-Kopf', () => {
  const days = visibleDays();
  const locks = {
    '2026-08-19|lunch': { mode: 'auto' },
    '2026-08-20|lunch': { mode: 'manual' },
    '2026-08-21|lunch': { mode: 'auto' },
  };
  const completed = new Set(['2026-08-19|lunch', '2026-08-20|lunch']);
  const counts = planLockSummaryCounts(
    days,
    locks,
    (date, meal) => completed.has(`${date}|${meal}`),
  );
  assert.deepEqual({ ...counts }, { autoCount: 1, manualCount: 0 });
});

test('teilweise erledigter Tag zählt nur noch offene geschützte Mahlzeiten', () => {
  const days = [
    {
      date: '2026-08-19',
      meals: [
        { meal: 'breakfast', active: true, focusId: 'banane' },
        { meal: 'lunch', active: true, focusId: 'karotte' },
      ],
    },
  ];
  const counts = planLockSummaryCounts(
    days,
    {
      '2026-08-19|breakfast': { mode: 'auto' },
      '2026-08-19|lunch': { mode: 'manual' },
    },
    (date, meal) => date === '2026-08-19' && meal === 'breakfast',
  );
  assert.deepEqual({ ...counts }, { autoCount: 0, manualCount: 1 });
  assert.equal(planLockSummaryHtml(counts), '<b>1</b> manuell geschützt');
});

test('Plan-Kopf formuliert Auto-only, Manual-only und leeren Zustand korrekt', () => {
  assert.equal(planLockSummaryHtml({ autoCount: 2, manualCount: 0 }), '<b>2</b> fest eingeplant');
  assert.equal(planLockSummaryHtml({ autoCount: 0, manualCount: 1 }), '<b>1</b> manuell geschützt');
  assert.equal(planLockSummaryHtml({ autoCount: 0, manualCount: 0 }), 'Keine feste Planung');
});

test('Mengenorientierung wird für die kompakte Planbasis auf den Zahlenbereich gekürzt', () => {
  assert.equal(compactPlanAmountLabel('Kleine Portion (20–49 g)'), '20–49 g');
  assert.equal(compactPlanAmountLabel('Mahlzeit etabliert (ab 100 g)'), 'ab 100 g');
  assert.equal(compactPlanAmountLabel('Freie Angabe'), 'Freie Angabe');
});

test('Phase, Menge und Konsistenz liegen in der extern gestylten kompakten Planbasis', () => {
  assert.match(ui, /plan-defaults-compact/);
  assert.match(ui, /plan-defaults-line/);
  assert.match(ui, /compactPlanAmountLabel\(amountLabel\)/);
  assert.match(ui, /textureName\(\)/);
  assert.match(css, /UI-08: Kompakter Plan-Kopf/);
  assert.match(css, /#plan \.plan-defaults\.plan-defaults-compact/);
});

test('Inline-Monkey-Patch ist entfernt und Weitere Planaktionen bleibt geschlossen', () => {
  assert.doesNotMatch(html, /planToolbarCompactStyles/);
  assert.doesNotMatch(html, /renderPlanCoreCompactToolbar/);
  assert.match(
    html,
    /<details class="plan-secondary-actions"><summary>Weitere Planaktionen<\/summary>/,
  );
  assert.doesNotMatch(html, /<details class="plan-secondary-actions"\s+open/);
});

test('renderPlanCore übergibt den bestehenden Completion-Check an die Lock-Zählung', () => {
  assert.match(ui, /planLockSummaryCounts\(days, state\.planLocks \|\| \{\}, mealIsCompleted\)/);
});
