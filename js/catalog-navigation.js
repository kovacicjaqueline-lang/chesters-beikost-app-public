"use strict";

/* Gemeinsamer Katalog-Tab für Lebensmittel und Rezepte.
 * Rezeptdaten, Planner und direkte Rezeptdetail-Dialoge bleiben unverändert.
 */
(function catalogNavigationModule() {
  if (typeof document === "undefined") return;

  const MODE_FOODS = "foods";
  const MODE_RECIPES = "recipes";
  const FOOD_DETAIL_MIN_RASTER_SIZE = 384;
  const foodDetailRasterCache = new Map();

  function setCatalogMode(mode) {
    const foodsSection = document.getElementById("foodsCatalogSection");
    const recipesSection = document.getElementById("recipesSection");
    const recipesDetails = document.getElementById("recipesDetails");
    const switcher = document.getElementById("catalogSwitch");
    if (!foodsSection || !recipesSection || !switcher) return;

    const nextMode = mode === MODE_RECIPES ? MODE_RECIPES : MODE_FOODS;
    foodsSection.hidden = nextMode !== MODE_FOODS;
    recipesSection.hidden = nextMode !== MODE_RECIPES;
    if (nextMode === MODE_RECIPES && recipesDetails) recipesDetails.open = true;

    switcher.querySelectorAll("[data-catalog-mode]").forEach((button) => {
      const active = button.dataset.catalogMode === nextMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function openRecipeCatalog(filter = "") {
    if (filter && typeof recipeFilter !== "undefined") recipeFilter = filter;
    showView("foods");
    setCatalogMode(MODE_RECIPES);
    renderPrep();
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function fixLegacyNavigationCopy() {
    const prepEmpty = document.querySelector("#cookNow .empty");
    if (prepEmpty && /Unter „Mehr“/i.test(prepEmpty.textContent || "")) {
      prepEmpty.textContent = "Noch kein Rezept vollständig freigeschaltet. Unter „Rezepte“ siehst du fast passende Rezepte.";
    }

    const auditRow = [...document.querySelectorAll("#auditList .checkline")].find((node) =>
      /Protokoll und Rezepte liegen unter Mehr/.test(node.textContent || ""),
    );
    if (!auditRow) return;

    const ok = !!document.querySelector("#more #logDetails") &&
      !!document.querySelector("#foods #recipesDetails") &&
      !document.querySelector("#more #recipesDetails");
    auditRow.innerHTML = `<span class="statusdot ${ok ? "good" : "warn"}"></span><div><b>${ok ? "Geprüft" : "Prüfen"}:</b> Protokoll liegt unter Mehr; Rezepte liegen im gemeinsamen Lebensmittel-Tab</div>`;
  }

  function detailRasterTargetSize(asset) {
    const wrapper = asset.closest(".food-detail-hero-icon");
    const cssSize = Math.max(96, Math.ceil(wrapper?.getBoundingClientRect().width || 0));
    const dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
    const requiredPhysicalSize = Math.ceil(cssSize * dpr);
    return Math.max(
      FOOD_DETAIL_MIN_RASTER_SIZE,
      Math.ceil(requiredPhysicalSize / 128) * 128,
    );
  }

  function sharpenDetailRaster(context, width, height, amount = 0.14) {
    const imageData = context.getImageData(0, 0, width, height);
    const output = imageData.data;
    const source = new Uint8ClampedArray(output);
    const row = width * 4;

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * row + x * 4;
        if (source[index + 3] < 16) continue;
        const neighborIndexes = [index - row, index + row, index - 4, index + 4];

        for (let channel = 0; channel < 3; channel += 1) {
          const center = source[index + channel];
          let neighborSum = 0;
          for (const neighborIndex of neighborIndexes) {
            neighborSum += source[neighborIndex + 3] >= 16
              ? source[neighborIndex + channel]
              : center;
          }
          const laplacian = center * 4 - neighborSum;
          output[index + channel] = Math.max(
            0,
            Math.min(255, Math.round(center + amount * laplacian)),
          );
        }
      }
    }

    context.putImageData(imageData, 0, 0);
  }

  function buildFoodDetailRaster(asset, targetSize) {
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas-Kontext nicht verfügbar");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, targetSize, targetSize);
    context.drawImage(asset, 0, 0, targetSize, targetSize);
    sharpenDetailRaster(context, targetSize, targetSize);
    return canvas.toDataURL("image/png");
  }

  function enhanceFoodDetailAsset(asset) {
    if (!(asset instanceof HTMLImageElement)) return;
    if (asset.dataset.detailHidpiState === "ready" || asset.dataset.detailHidpiState === "working") return;

    const originalSource = asset.dataset.detailSource || asset.currentSrc || asset.src;
    if (!originalSource || originalSource.startsWith("data:image/png")) return;
    asset.dataset.detailSource = originalSource;

    const render = () => {
      if (asset.dataset.detailHidpiState === "ready" || asset.dataset.detailHidpiState === "working") return;
      asset.dataset.detailHidpiState = "working";

      requestAnimationFrame(() => {
        try {
          const targetSize = detailRasterTargetSize(asset);
          const cacheKey = `${originalSource}|${targetSize}`;
          const cached = foodDetailRasterCache.get(cacheKey);
          const detailSource = cached || buildFoodDetailRaster(asset, targetSize);
          if (!cached) foodDetailRasterCache.set(cacheKey, detailSource);
          asset.src = detailSource;
          asset.dataset.detailRasterWidth = String(targetSize);
          asset.dataset.detailHidpiState = "ready";
        } catch (error) {
          asset.dataset.detailHidpiState = "fallback";
          console.warn("[Illustrationen] HiDPI-Detailderivat konnte nicht erzeugt werden.", error);
        }
      });
    };

    if (asset.complete && asset.naturalWidth > 0) render();
    else asset.addEventListener("load", render, { once: true });
  }

  function enhanceFoodDetailIcons(root = document) {
    const assets = root instanceof Element && root.matches(".food-detail-hero-icon .food-illustration")
      ? [root]
      : [...root.querySelectorAll?.(".food-detail-hero-icon .food-illustration") || []];
    assets.forEach(enhanceFoodDetailAsset);
  }

  const switcher = document.getElementById("catalogSwitch");
  switcher?.querySelectorAll("[data-catalog-mode]").forEach((button) => {
    button.addEventListener("click", () => setCatalogMode(button.dataset.catalogMode));
  });

  const recipesDetails = document.getElementById("recipesDetails");
  if (recipesDetails) {
    recipesDetails.open = true;
    recipesDetails.addEventListener("toggle", () => {
      if (!recipesDetails.open) recipesDetails.open = true;
    });
    const heading = recipesDetails.querySelector(":scope > summary");
    if (heading) {
      heading.tabIndex = -1;
      heading.setAttribute("role", "heading");
      heading.setAttribute("aria-level", "2");
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("button");
    if (!button) return;

    if (button.id === "openRecipes" || button.id === "prepOpenRecipes" || button.id === "prepOpenFreezerRecipes") {
      event.preventDefault();
      event.stopImmediatePropagation();
      openRecipeCatalog(button.id === "prepOpenFreezerRecipes" ? "freezer" : "");
      return;
    }

    if (button.matches('nav button[data-view="foods"]')) {
      queueMicrotask(() => setCatalogMode(MODE_FOODS));
    }
  }, true);

  const observer = new MutationObserver(() => {
    fixLegacyNavigationCopy();
    enhanceFoodDetailIcons();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setCatalogMode(MODE_FOODS);
  fixLegacyNavigationCopy();
  enhanceFoodDetailIcons();
})();
