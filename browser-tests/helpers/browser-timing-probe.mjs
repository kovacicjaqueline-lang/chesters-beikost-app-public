function describeCallback(value) {
  if (typeof value !== "function") return String(value);
  return value.toString().replace(/\s+/g, " ").slice(0, 180);
}

function recordCall(entries, label, callback, args) {
  const startedAt = Date.now();
  return Promise.resolve()
    .then(() => callback(...args))
    .finally(() => {
      entries.push({ label, durationMs: Date.now() - startedAt });
    });
}

export function installBrowserTimingProbe(page) {
  const entries = {
    waitForFunction: [],
    evaluate: [],
  };

  const originalWaitForFunction = page.waitForFunction.bind(page);
  page.waitForFunction = (...args) => recordCall(
    entries.waitForFunction,
    describeCallback(args[0]),
    originalWaitForFunction,
    args,
  );

  const originalEvaluate = page.evaluate.bind(page);
  page.evaluate = (...args) => recordCall(
    entries.evaluate,
    describeCallback(args[0]),
    originalEvaluate,
    args,
  );

  return {
    report() {
      const slowest = (items) => [...items]
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 12);
      return {
        waitForFunction: slowest(entries.waitForFunction),
        evaluate: slowest(entries.evaluate),
      };
    },
  };
}
