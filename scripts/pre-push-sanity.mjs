#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

function usage() {
  console.log(`Usage: node scripts/pre-push-sanity.mjs --base <BASE_SHA> [options]\n\nOptions:\n  --base <ref>           Fixed branch base (or set BASE_SHA)\n  --allow <path>         Allow one exact changed path; repeatable\n  --allow-prefix <path>  Allow changed paths below a directory/prefix; repeatable\n  --allow-empty <path>   Explicitly allow one zero-byte changed file; repeatable\n  --help                 Show this help\n`);
}

function parseArgs(argv) {
  const options = {
    base: process.env.BASE_SHA || '',
    allowedPaths: [],
    allowedPrefixes: [],
    allowedEmptyPaths: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      options.help = true;
      continue;
    }

    const next = argv[index + 1];
    if (['--base', '--allow', '--allow-prefix', '--allow-empty'].includes(arg)) {
      if (!next || next.startsWith('--')) {
        throw new Error(`${arg} benötigt einen Wert.`);
      }
      index += 1;
      if (arg === '--base') options.base = next;
      if (arg === '--allow') options.allowedPaths.push(next);
      if (arg === '--allow-prefix') options.allowedPrefixes.push(next.replace(/\\/g, '/'));
      if (arg === '--allow-empty') options.allowedEmptyPaths.push(next);
      continue;
    }

    throw new Error(`Unbekannte Option: ${arg}`);
  }

  return options;
}

function git(args, { encoding = 'utf8' } = {}) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function verifyBase(base) {
  if (!base) {
    throw new Error('BASE_SHA fehlt. Übergib --base <BASE_SHA> oder setze BASE_SHA.');
  }
  git(['rev-parse', '--verify', `${base}^{commit}`]);
}

function changedPaths(base) {
  const output = git(['diff', '--name-only', '-z', `${base}...HEAD`], { encoding: 'buffer' });
  return output.toString('utf8').split('\0').filter(Boolean);
}

function worktreeChanges() {
  return git(['status', '--porcelain=v1', '--untracked-files=all'])
    .split(/\r?\n/)
    .filter(Boolean);
}

function isPathAllowed(path, options) {
  if (options.allowedPaths.length === 0 && options.allowedPrefixes.length === 0) return true;
  if (options.allowedPaths.includes(path)) return true;
  return options.allowedPrefixes.some((prefix) => path.startsWith(prefix));
}

function headBlobSize(path) {
  try {
    git(['cat-file', '-e', `HEAD:${path}`]);
  } catch {
    return null;
  }
  return Number(git(['cat-file', '-s', `HEAD:${path}`]).trim());
}

function run(options) {
  verifyBase(options.base);

  const dirty = worktreeChanges();
  if (dirty.length > 0) {
    console.error('Pre-Push-Sanity fehlgeschlagen: Arbeitsbaum ist nicht sauber.');
    for (const entry of dirty) console.error(`  ${entry}`);
    return 1;
  }

  const changed = changedPaths(options.base);
  const unexpected = changed.filter((path) => !isPathAllowed(path, options));
  const empty = changed.filter((path) => {
    if (options.allowedEmptyPaths.includes(path)) return false;
    return headBlobSize(path) === 0;
  });

  if (unexpected.length > 0 || empty.length > 0) {
    console.error('Pre-Push-Sanity fehlgeschlagen.');
    if (unexpected.length > 0) {
      console.error('Unerwartete Dateien im Branch-Diff:');
      for (const path of unexpected) console.error(`  ${path}`);
    }
    if (empty.length > 0) {
      console.error('Geänderte 0-Byte-Dateien ohne ausdrückliche Freigabe:');
      for (const path of empty) console.error(`  ${path}`);
    }
    return 1;
  }

  console.log(`Pre-Push-Sanity OK: ${changed.length} geänderte Datei(en) gegen ${options.base}.`);
  return 0;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    process.exit(0);
  }
  process.exit(run(options));
} catch (error) {
  console.error(`Pre-Push-Sanity fehlgeschlagen: ${error.message}`);
  process.exit(1);
}
