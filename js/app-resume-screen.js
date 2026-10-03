"use strict";

(function installAppResumeScreen(root, doc) {
  if (!root || !doc || root.AppResumeScreen) return;

  const screen = doc.getElementById("appResumeScreen");
  if (!screen) return;

  let appReady = doc.documentElement.classList.contains("app-ready");
  let wasBackgrounded = false;
  let resolveAppReady;
  const appReadyPromise = new Promise((resolve) => {
    resolveAppReady = resolve;
  });
  if (appReady) resolveAppReady({ state: "ready" });

  function setVisible(visible) {
    doc.documentElement.classList.toggle("app-resume-cover", visible);
    screen.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function hideAfterPaint() {
    if (!appReady) return;
    root.requestAnimationFrame(() => root.requestAnimationFrame(() => {
      if (doc.visibilityState === "visible") {
        wasBackgrounded = false;
        doc.documentElement.classList.add("app-ready");
        setVisible(false);
      }
    }));
  }

  function resume() {
    if (!wasBackgrounded) return;
    setVisible(true);
    hideAfterPaint();
  }

  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "hidden") {
      wasBackgrounded = true;
      setVisible(true);
      return;
    }
    resume();
  });
  root.addEventListener("pagehide", () => {
    wasBackgrounded = true;
    setVisible(true);
  });
  root.addEventListener("pageshow", resume);
  root.addEventListener("focus", resume);

  function markAppReady() {
    if (!appReady) {
      appReady = true;
      resolveAppReady({ state: "ready" });
    }
    if (!wasBackgrounded) {
      doc.documentElement.classList.add("app-ready");
      setVisible(false);
      return;
    }
    hideAfterPaint();
  }

  root.AppReadiness = Object.freeze({
    get ready() { return appReady; },
    whenReady() { return appReadyPromise; },
    markReady: markAppReady,
  });
  root.AppResumeScreen = Object.freeze({ markReady: markAppReady });
})(typeof window !== "undefined" ? window : null, typeof document !== "undefined" ? document : null);
