import assert from "node:assert/strict";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";

const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function round(value) {
  return value === null || value === undefined ? null : Number(Number(value).toFixed(2));
}

function summarize(samples, key) {
  const values = samples.map((sample) => sample[key]).filter(Number.isFinite);
  return {
    medianMs: round(median(values)),
    minMs: round(Math.min(...values)),
    maxMs: round(Math.max(...values)),
    samplesMs: values.map(round),
  };
}

async function settleView(id) {
  const active = await page.evaluate((viewId) => document.getElementById(viewId)?.classList.contains("active") || false, id);
  if (!active) {
    await page.locator(`nav button[data-view="${id}"]`).click();
    await page.waitForFunction((viewId) => {
      const view = document.getElementById(viewId);
      return !!view?.classList.contains("active") && view.getAttribute("aria-busy") !== "true";
    }, id);
  }
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState && typeof window.renderView === "function");
  await page.evaluate(() => window.__beikostTest.reset());
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));

  const profile = await page.evaluate(() => {
    const medianInPage = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const roundInPage = (value) => Number(value.toFixed(2));
    const measure = (callback, runs = 7) => {
      callback();
      const samples = [];
      for (let index = 0; index < runs; index += 1) {
        const startedAt = performance.now();
        callback();
        samples.push(performance.now() - startedAt);
      }
      return {
        medianMs: roundInPage(medianInPage(samples)),
        minMs: roundInPage(Math.min(...samples)),
        maxMs: roundInPage(Math.max(...samples)),
        samplesMs: samples.map(roundInPage),
      };
    };

    const views = {};
    for (const id of ["home", "plan", "prep", "foods", "more"]) {
      views[id] = measure(() => window.renderView(id));
    }
    const fullApp = measure(() => window.renderAll(), 5);

    return {
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      stateBytes: new Blob([JSON.stringify(window.__beikostTest.getState())]).size,
      views,
      fullApp,
    };
  });

  for (const [id, timing] of Object.entries(profile.views)) {
    assert.ok(Number.isFinite(timing.medianMs), `${id} median render duration must be finite`);
    assert.equal(timing.samplesMs.length, 7, `${id} must record seven render samples`);
  }
  assert.ok(Number.isFinite(profile.fullApp.medianMs), "full-app median render duration must be finite");

  await page.evaluate(() => {
    const probe = {
      expectedTarget: "",
      current: null,
      last: null,
    };

    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("nav button[data-view]");
      const target = button?.dataset?.view || "";
      if (!target || target !== probe.expectedTarget) return;
      probe.current = {
        target,
        tapAt: performance.now(),
        activeAt: null,
        renderStartAt: null,
        renderEndAt: null,
        firstPostRenderRafAt: null,
        stableFrameAt: null,
        done: false,
      };
    }, true);

    document.addEventListener("click", () => {
      const run = probe.current;
      if (!run || run.done || run.activeAt !== null) return;
      if (document.getElementById(run.target)?.classList.contains("active")) {
        run.activeAt = performance.now();
      }
    });

    const baseRenderView = window.renderView;
    window.renderView = function measuredRenderView(viewId, ...args) {
      const run = probe.current;
      const measured = !!run && !run.done && String(viewId || "") === run.target;
      if (measured && run.renderStartAt === null) run.renderStartAt = performance.now();
      const result = baseRenderView.call(this, viewId, ...args);
      if (measured) {
        run.renderEndAt = performance.now();
        requestAnimationFrame(() => {
          if (probe.current !== run || run.done) return;
          run.firstPostRenderRafAt = performance.now();
          requestAnimationFrame(() => {
            if (probe.current !== run || run.done) return;
            run.stableFrameAt = performance.now();
            run.done = true;
            probe.last = { ...run };
          });
        });
      }
      return result;
    };

    window.__tabPaintProbe = {
      arm(target) {
        probe.expectedTarget = String(target || "");
        probe.current = null;
        probe.last = null;
      },
      snapshot() {
        return probe.last ? { ...probe.last } : null;
      },
    };
  });

  const navigation = {};
  const viewIds = ["home", "plan", "prep", "foods", "more"];
  for (const target of viewIds) {
    const source = target === "home" ? "plan" : "home";
    const samples = [];
    for (let index = 0; index < 5; index += 1) {
      await settleView(source);
      await page.evaluate((targetId) => {
        window.save();
        window.__tabPaintProbe.arm(targetId);
      }, target);
      await page.locator(`nav button[data-view="${target}"]`).click();
      await page.waitForFunction((targetId) => {
        const sample = window.__tabPaintProbe?.snapshot?.();
        return sample?.target === targetId && sample.done === true;
      }, target);
      const run = await page.evaluate(() => window.__tabPaintProbe.snapshot());
      assert.ok(Number.isFinite(run.tapAt), `${target} must record tap time`);
      assert.ok(Number.isFinite(run.renderStartAt), `${target} must record render start`);
      assert.ok(Number.isFinite(run.renderEndAt), `${target} must record render end`);
      assert.ok(Number.isFinite(run.stableFrameAt), `${target} must record stable frame`);
      samples.push({
        tapToActiveMs: Number.isFinite(run.activeAt) ? run.activeAt - run.tapAt : null,
        tapToRenderStartMs: run.renderStartAt - run.tapAt,
        renderMs: run.renderEndAt - run.renderStartAt,
        tapToFirstPostRenderRafMs: run.firstPostRenderRafAt - run.tapAt,
        tapToStableFrameMs: run.stableFrameAt - run.tapAt,
        renderEndToStableFrameMs: run.stableFrameAt - run.renderEndAt,
      });
    }

    navigation[target] = {
      tapToActive: summarize(samples, "tapToActiveMs"),
      tapToRenderStart: summarize(samples, "tapToRenderStartMs"),
      render: summarize(samples, "renderMs"),
      tapToFirstPostRenderRaf: summarize(samples, "tapToFirstPostRenderRafMs"),
      tapToStableFrame: summarize(samples, "tapToStableFrameMs"),
      renderEndToStableFrame: summarize(samples, "renderEndToStableFrameMs"),
    };
  }

  console.log(`VIEW_RENDER_PROFILE ${JSON.stringify(profile)}`);
  console.log(`TAB_PAINT_PROFILE ${JSON.stringify({
    note: "stableFrame is approximated by the second requestAnimationFrame after render completion",
    navigation,
  })}`);
} finally {
  await closeBrowserApp({ context, browser, server });
}

console.log("WebKit per-view render and tab paint latency profile passed.");
