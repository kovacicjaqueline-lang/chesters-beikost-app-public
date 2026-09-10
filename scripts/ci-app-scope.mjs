import process from 'node:process';
import { pathToFileURL } from 'node:url';

// Deliberately explicit and fail-closed. A new or mixed runtime file must not
// silently skip browser coverage just because its name resembles a core file.
const FAST_ONLY_FILES = new Set([
  'js/log-core.js',
  'js/migrations.js',
  'js/model.js',
  'js/phase-readiness.js',
  'js/planner-allergen-maintenance.js',
  'js/planner-food-role-stability.js',
  'js/planner-introduction-policy.js',
  'js/planner-iron-preference.js',
  'js/planner-log-rollover-cascade.js',
  'js/planner-log-rollover-review-fixes.js',
  'js/planner-log-rollover.js',
  'js/planner-meal-eligibility.js',
  'js/planner-milk-policy.js',
  'js/planner-proactive-recipe.js',
  'js/planner-quality-rotation.js',
  'js/planner-random-swap.js',
  'js/planner-recipe-first.js',
  'js/state.js',
  'js/storage.js',
  'js/utils.js',
]);

const FAST_ONLY_PATTERNS = [
  /^data\/.+/,
  /^tests\/[^/]+\.test\.(?:js|cjs)$/,
];

// These paths can accompany an app-relevant change but are handled by another
// workflow or have no app runtime effect. Unknown paths are intentionally not
// ignored: they keep the full browser gate.
const NEUTRAL_PATTERNS = [
  /^docs\/.+/,
  /^README(?:\.[^/]+)?$/,
  /^AGENTS\.md$/,
  /^VERSION\.json$/,
  /^wrangler\.jsonc$/,
  /^js\/wrangler\.jsonc$/,
  /^\.gitignore$/,
];

function normalizePath(file) {
  return String(file || '').trim().replaceAll('\\', '/').replace(/^\.\//, '');
}

export function isNeutralPath(file) {
  const normalized = normalizePath(file);
  return NEUTRAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isFastOnlyPath(file) {
  const normalized = normalizePath(file);
  return FAST_ONLY_FILES.has(normalized)
    || FAST_ONLY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function classifyAppScope(files) {
  const relevant = (files || [])
    .map(normalizePath)
    .filter(Boolean)
    .filter((file) => !isNeutralPath(file));

  if (!relevant.length) return 'app';
  return relevant.every(isFastOnlyPath) ? 'fast' : 'app';
}

export function browserRequiredForFiles(files) {
  return classifyAppScope(files) === 'app';
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const files = input.split(/\r?\n/).filter(Boolean);
  process.stdout.write(`browser_required=${browserRequiredForFiles(files)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
