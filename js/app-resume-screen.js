"use strict";

(function installAppResumeScreen(root, doc) {
  if (!root || !doc || root.AppResumeScreen) return;

  const screen = doc.getElementById("appResumeScreen");
  if (!screen) return;

  let appReady = !doc.documentElement.classList.contains("app-standalone");
  let wasBackgrounded = false;

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

  root.AppResumeScreen = Object.freeze({
    markReady() {
      appReady = true;
      if (!wasBackgrounded) {
        doc.documentElement.classList.add("app-ready");
        setVisible(false);
        return;
      }
      hideAfterPaint();
    },
  });
})(typeof window !== "undefined" ? window : null, typeof document !== "undefined" ? document : null);
