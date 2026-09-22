import { spawnSync } from "node:child_process";
import process from "node:process";
import { listNodeTests, selectRelevantTests } from "./test-manifest.mjs";

const [, , group = "fast", ...args] = process.argv;
const fileArgs = args.flatMap((arg, index) => {
  if (arg === "--files") return [];
  if (index > 0 && args[index - 1] === "--files") return arg.split(",");
  return [];
});

const changedFiles = fileArgs.length
  ? fileArgs
  : String(process.env.CHANGED_FILES || "").split(/\r?\n/).filter(Boolean);

if (group === "relevant" && !changedFiles.length) {
  console.error("test:relevant requires --files <path,...> or CHANGED_FILES.");
  process.exit(2);
}

const files = group === "relevant"
  ? selectRelevantTests(changedFiles).node
  : listNodeTests(group);

if (!files.length) {
  console.log(`No Node tests selected for group ${group}.`);
  process.exit(0);
}

console.log(`Running ${files.length} Node test files (${group}).`);
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
