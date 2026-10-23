import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const testsDir = path.join(root, "tests");
const browserTestsDir = path.join(root, "browser-tests");

const nodeTestFiles = fs.readdirSync(testsDir)
  .filter((name) => /^.+\.test\.(?:cjs|js)$/.test(name))
  .sort()
  .map((name) => path.join(testsDir, name));

const browserTestFiles = fs.readdirSync(browserTestsDir)
  .filter((name) => name.endsWith("-webkit.test.mjs"))
  .sort()
  .map((name) => path.join(browserTestsDir, name));

const basename = (file) => path.basename(file);
const matchesAny = (file, patterns) => patterns.some((pattern) => pattern.test(basename(file)));

const integrationPatterns = [
  /app\.js/, /backup-/, /day-plan-/, /deferred-render/, /mobile-/, /pwa-/, /storage-/,
  /structured-/, /todo3-/, /unified-/, /ui-/, /flow-/, /meal-/, /manual-/, /prep-/,
  /search-/, /completed-/, /plan-check/, /planner-/, /recipe-/, /handling-/, /phase-/,
  /milk-/, /hummus-/, /mais-/, /rind-/, /performance-/, /ci-/, /browser-/,
];

const criticalBrowserPerformanceNames = new Set([
  "save-ui-latency-webkit.test.mjs",
  "targeted-action-rendering-webkit.test.mjs",
  "app-resume-lifecycle-webkit.test.mjs",
  "view-render-latency-webkit.test.mjs",
]);

export const TEST_GROUPS = Object.freeze({
  unit: () => nodeTestFiles.filter((file) => !matchesAny(file, integrationPatterns)),
  integration: () => nodeTestFiles.filter((file) => matchesAny(file, integrationPatterns)),
  fast: () => nodeTestFiles,
  browser: () => browserTestFiles,
  browserStandard: () => browserTestFiles.filter((file) => !criticalBrowserPerformanceNames.has(basename(file))),
  browserPerformance: () => browserTestFiles.filter((file) => criticalBrowserPerformanceNames.has(basename(file))),
});

const areaRules = [
  { name: "planner", changed: [/^js\/planner-/, /^js\/phase-readiness\.js$/, /^tests\/planner-/, /^tests\/plan-/, /^tests\/todo3-/, /^browser-tests\/planner-/], node: [/^(planner|plan-|todo3-|phase-readiness)/], browser: [/^planner-/] },
  { name: "food", changed: [/^data\//, /^tests\/food-/, /^tests\/(bananen|hummus|mais|rind)-/, /^tests\/recipe-/], node: [/^(food-|bananen-|hummus-|mais-|rind-|recipe-)/], browser: [/^(recipe-|everyday-recipes|meal-card)/] },
  { name: "handling", changed: [/^js\/handling-/, /^tests\/handling-/, /^tests\/food-handling/, /^tests\/phase-readiness/], node: [/^(handling-|food-handling|phase-readiness)/], browser: [/^(meal-editor|manual-meal|phase-readiness)/] },
  { name: "logging", changed: [/^js\/(log|storage)/, /^tests\/(unified-food-log|manual-meal|storage-)/, /^browser-tests\/(unified-food-log|log-)/], node: [/^(unified-food-log|manual-meal|storage-|log-)/], browser: [/^(unified-food-log|log-|manual-meal)/] },
  { name: "icons", changed: [/^assets\/illustrations-v2\//, /^js\/icons\.js$/, /icon/i], node: [/icon/i], browser: [/icon-render-sizes/] },
  { name: "ui", changed: [/^index\.html$/, /^app\.js$/, /^.+\.css$/, /^js\/(?!planner-|handling-|log|storage)/, /^tests\/ui-/, /^browser-tests\//], node: [/^(ui-|flow-|meal-|completed-|search-|prep-|plan-check|planned-recipe)/], browser: [/.*/] },
  { name: "ci", changed: [/^\.github\//, /^scripts\//, /^tests\/ci-/], node: [/^(browser-|ci-|pre-push)/], browser: [] },
];

const sharedNodeDependencies = [
  {
    changed: /^data\/foods\.js$/,
    node: [/^plan-07-custom-meals\.test\.js$/],
  },
];

const neutralChangedPaths = [
  /^docs\//,
  /^README(?:\.[^/]+)?$/,
  /^AGENTS\.md$/,
  /^VERSION\.json$/,
  /^\.gitignore$/,
];

function normalize(file) {
  return String(file || "").trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

export function classifyChangedFiles(files) {
  const normalized = files.map(normalize).filter(Boolean);
  if (!normalized.length) return { areas: [], full: true };
  if (normalized.every((file) => neutralChangedPaths.some((pattern) => pattern.test(file)))) {
    return { areas: [], full: false, neutral: true };
  }
  const areas = new Set();
  let full = false;
  for (const file of normalized) {
    const matched = areaRules.filter((rule) => rule.changed.some((pattern) => pattern.test(file)));
    if (!matched.length || /^(package(-lock)?\.json|wrangler\.jsonc|js\/wrangler\.jsonc)$/.test(file)) full = true;
    for (const rule of matched) areas.add(rule.name);
  }
  return { areas: [...areas].sort(), full };
}

export function selectRelevantTests(files) {
  const normalized = files.map(normalize).filter(Boolean);
  const classification = classifyChangedFiles(normalized);
  if (classification.full) return { ...classification, node: nodeTestFiles, browser: browserTestFiles };

  const rules = areaRules.filter((rule) => classification.areas.includes(rule.name));
  const node = nodeTestFiles.filter((file) => (
    rules.some((rule) => matchesAny(file, rule.node))
    || sharedNodeDependencies.some((dependency) => (
      normalized.some((changedFile) => dependency.changed.test(changedFile))
      && matchesAny(file, dependency.node)
    ))
  ));
  const browser = browserTestFiles.filter((file) => rules.some((rule) => matchesAny(file, rule.browser)));
  return { ...classification, node, browser };
}

export function listNodeTests(group) {
  const resolver = TEST_GROUPS[group];
  if (!resolver) throw new Error(`Unknown test group: ${group}`);
  return resolver();
}

export { nodeTestFiles, browserTestFiles };
