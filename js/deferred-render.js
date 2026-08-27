"use strict";

/* Sichtbare UI-Reaktion vor teuren Voll-Rendern
 * State-Mutation und Persistenz bleiben synchron im auslösenden Event-Pfad.
 * Nur renderAll() wird hinter die nächste Render-Gelegenheit verschoben.
 */

function afterNextPaint(callback) {
  if (typeof callback !== "function") return;
  let afterPaint = () => {
    if (typeof setTimeout === "function") setTimeout(callback, 0);
    else callback();
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(afterPaint);
  else afterPaint();
}

function renderAllAfterNextPaint(afterRender = null) {
  afterNextPaint(() => {
    if (typeof renderAll === "function") renderAll();
    if (typeof afterRender === "function") afterRender();
  });
}
