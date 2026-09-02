import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
};

function startStaticServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filePath = path.resolve(root, `.${pathname}`);
    if (filePath !== path.join(root, "index.html") && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.stat(filePath, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      fs.createReadStream(filePath).pipe(response);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function waitForDeferredRender(page, before) {
  await page.waitForFunction((count) => window.__saveUiLatencyProbe.renderCalls > count, before);
}

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

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);
  await page.evaluate(() => window.__beikostTest.reset());

  await page.evaluate(() => {
    const baseRenderAll = window.renderAll;
    window.__saveUiLatencyProbe = { renderCalls: 0 };
    window.renderAll = function profiledRenderAll(...args) {
      window.__saveUiLatencyProbe.renderCalls += 1;
      return baseRenderAll.apply(this, args);
    };
  });

  // Konsistenz bestätigen: State und Modal-Close sind sofort sichtbar, Voll-Render folgt erst danach.
  await page.evaluate(() => window.openTextureAdvance(2));
  const textureImmediate = await page.evaluate(() => {
    const before = window.__saveUiLatencyProbe.renderCalls;
    document.getElementById("confirmTextureStage").click();
    return {
      before,
      after: window.__saveUiLatencyProbe.renderCalls,
      modalOpen: document.getElementById("genericModal").classList.contains("open"),
      stage: window.__beikostTest.getState().settings.textureStage,
      toast: document.getElementById("toastText").textContent,
    };
  });
  assert.equal(textureImmediate.after, textureImmediate.before, "Konsistenz-Confirm darf nicht synchron voll rendern");
  assert.equal(textureImmediate.modalOpen, false, "Konsistenz-Dialog muss vor dem Voll-Render schließen");
  assert.equal(textureImmediate.stage, 2, "Konsistenz muss bereits vor dem Voll-Render gespeichert sein");
  assert.match(textureImmediate.toast, /Konsistenz auf Stufe 2 gestellt/);
  await waitForDeferredRender(page, textureImmediate.before);

  // Lebensmittel reaktivieren: auch der Detaildialog darf nicht auf renderAll warten.
  const inactiveFoodId = await page.evaluate(() => {
    const snapshot = window.__beikostTest.getState();
    const item = snapshot.foods.find((food) => food.active);
    item.active = false;
    window.__beikostTest.setState(snapshot);
    window.showFoodInfo(window.food(item.id));
    return item.id;
  });
  const foodImmediate = await page.evaluate(() => {
    const before = window.__saveUiLatencyProbe.renderCalls;
    document.getElementById("foodToggleActive").click();
    return {
      before,
      after: window.__saveUiLatencyProbe.renderCalls,
      modalOpen: document.getElementById("genericModal").classList.contains("open"),
    };
  });
  assert.equal(foodImmediate.after, foodImmediate.before, "Lebensmittel-Reaktivierung darf nicht synchron voll rendern");
  assert.equal(foodImmediate.modalOpen, false, "Lebensmittel-Detaildialog muss sofort schließen");
  assert.equal(
    await page.evaluate((id) => window.__beikostTest.getState().foods.find((food) => food.id === id)?.active, inactiveFoodId),
    true,
    "Lebensmittel muss vor dem verzögerten Voll-Render bereits aktiv sein",
  );
  await waitForDeferredRender(page, foodImmediate.before);

  // Konkretes Produkt speichern und löschen: Modal-Close bleibt unabhängig vom Voll-Render.
  const productFoodId = await page.evaluate(() => window.__beikostTest.getState().foods[0].id);
  await page.evaluate((foodId) => window.openProductAllergenForm(foodId), productFoodId);
  await page.locator("#productName").fill("Latency-Testprodukt");
  const productSaveImmediate = await page.evaluate(() => {
    const before = window.__saveUiLatencyProbe.renderCalls;
    document.getElementById("saveConcreteProduct").click();
    return {
      before,
      after: window.__saveUiLatencyProbe.renderCalls,
      modalOpen: document.getElementById("genericModal").classList.contains("open"),
      count: window.__beikostTest.getState().products?.length || 0,
    };
  });
  assert.equal(productSaveImmediate.after, productSaveImmediate.before, "Produkt-Save darf nicht synchron voll rendern");
  assert.equal(productSaveImmediate.modalOpen, false);
  assert.equal(productSaveImmediate.count, 1);
  await waitForDeferredRender(page, productSaveImmediate.before);

  const productId = await page.evaluate(() => window.__beikostTest.getState().products[0].id);
  await page.evaluate((id) => window.openProductAllergenForm("", id), productId);
  const productDeleteImmediate = await page.evaluate(() => {
    const before = window.__saveUiLatencyProbe.renderCalls;
    document.getElementById("deleteConcreteProduct").click();
    return {
      before,
      after: window.__saveUiLatencyProbe.renderCalls,
      modalOpen: document.getElementById("genericModal").classList.contains("open"),
      count: window.__beikostTest.getState().products?.length || 0,
    };
  });
  assert.equal(productDeleteImmediate.after, productDeleteImmediate.before, "Produkt-Löschen darf nicht synchron voll rendern");
  assert.equal(productDeleteImmediate.modalOpen, false);
  assert.equal(productDeleteImmediate.count, 0);
  await waitForDeferredRender(page, productDeleteImmediate.before);

  // Eigenes Lebensmittel: Persistenz und Dialogschluss passieren vor dem Voll-Render.
  const foodsBeforeCustom = await page.evaluate(() => window.__beikostTest.getState().foods.length);
  await page.evaluate(() => window.addCustomFoodForm());
  await page.locator("#customName").fill("Latency-Test-Lebensmittel");
  const customImmediate = await page.evaluate(() => {
    const before = window.__saveUiLatencyProbe.renderCalls;
    document.getElementById("saveCustom").click();
    return {
      before,
      after: window.__saveUiLatencyProbe.renderCalls,
      modalOpen: document.getElementById("genericModal").classList.contains("open"),
      foodCount: window.__beikostTest.getState().foods.length,
    };
  });
  assert.equal(customImmediate.after, customImmediate.before, "Custom-Food-Save darf nicht synchron voll rendern");
  assert.equal(customImmediate.modalOpen, false);
  assert.equal(customImmediate.foodCount, foodsBeforeCustom + 1);
  await waitForDeferredRender(page, customImmediate.before);

  // Vorrat speichern: der Batch ist bereits im State, während der Voll-Render noch aussteht.
  const inventoryFoodId = await page.evaluate(() => window.__beikostTest.getState().foods.find((food) => food.active).id);
  const inventoryBefore = await page.evaluate(() => window.__beikostTest.getState().inventory.length);
  await page.evaluate((foodId) => window.addInventoryForm({ foodId, portions: 1 }), inventoryFoodId);
  await page.waitForFunction(() => !!document.getElementById("saveInv") && !document.getElementById("saveInv").disabled);
  const inventoryImmediate = await page.evaluate(() => {
    const before = window.__saveUiLatencyProbe.renderCalls;
    document.getElementById("saveInv").click();
    return {
      before,
      after: window.__saveUiLatencyProbe.renderCalls,
      modalOpen: document.getElementById("genericModal").classList.contains("open"),
      inventoryCount: window.__beikostTest.getState().inventory.length,
    };
  });
  assert.equal(inventoryImmediate.after, inventoryImmediate.before, "Vorrat-Save darf nicht synchron voll rendern");
  assert.equal(inventoryImmediate.modalOpen, false);
  assert.equal(inventoryImmediate.inventoryCount, inventoryBefore + 1);
  await waitForDeferredRender(page, inventoryImmediate.before);

  // Protokoll speichern: Save-Semantik ist synchron, Modal-Close ebenfalls; die aktuelle Ansicht bleibt erhalten.
  await page.evaluate(() => window.showView("home"));
  await page.evaluate(() => window.openLog(null));
  await page.waitForFunction(() => !!document.querySelector(".addLogFoodResult"));
  await page.evaluate(() => {
    document.querySelector(".addLogFoodResult").click();
    const texture = document.getElementById("logTexture");
    texture.value = "2";
  });
  const logsBefore = await page.evaluate(() => window.__beikostTest.getState().logs.length);
  const logImmediate = await page.evaluate(() => {
    const before = window.__saveUiLatencyProbe.renderCalls;
    document.getElementById("saveLog").click();
    return {
      before,
      after: window.__saveUiLatencyProbe.renderCalls,
      modalOpen: document.getElementById("logModal").classList.contains("open"),
      logCount: window.__beikostTest.getState().logs.length,
      homeVisible: document.getElementById("home").classList.contains("active"),
      moreVisible: document.getElementById("more").classList.contains("active"),
    };
  });
  assert.equal(logImmediate.after, logImmediate.before, "Protokoll-Save darf nicht synchron voll rendern");
  assert.equal(logImmediate.modalOpen, false, "Protokoll-Modal muss sofort schließen");
  assert.equal(logImmediate.logCount, logsBefore + 1, "Protokoll muss vor dem Voll-Render persistiert sein");
  assert.equal(logImmediate.homeVisible, true, "Ausgangsansicht muss nach dem Speichern aktiv bleiben");
  assert.equal(logImmediate.moreVisible, false, "Speichern darf nicht automatisch in die Protokollansicht wechseln");
  await waitForDeferredRender(page, logImmediate.before);
  assert.equal(
    await page.evaluate(() => document.getElementById("home").classList.contains("active")),
    true,
    "Ausgangsansicht muss auch nach dem verzögerten Voll-Render aktiv bleiben",
  );

  // Einstellungen: Toast/State werden im Klickpfad gesetzt, kompletter Re-Render folgt separat.
  await page.evaluate(() => window.showView("more"));
  const settingsImmediate = await page.evaluate(() => {
    const input = document.getElementById("allergenDays");
    input.value = String(Math.max(3, Number(input.value || 3) + 1));
    const expected = input.value;
    const before = window.__saveUiLatencyProbe.renderCalls;
    document.getElementById("saveSettings").click();
    return {
      before,
      after: window.__saveUiLatencyProbe.renderCalls,
      expected,
      saved: window.__beikostTest.getState().settings.allergenDays,
      toast: document.getElementById("toastText").textContent,
    };
  });
  assert.equal(settingsImmediate.after, settingsImmediate.before, "Settings-Save darf nicht synchron voll rendern");
  assert.equal(settingsImmediate.saved, settingsImmediate.expected);
  assert.equal(settingsImmediate.toast, "Einstellungen gespeichert.");
  await waitForDeferredRender(page, settingsImmediate.before);

  // Separates Profiling von storage.save(): keine Produktionslogik ändern, sondern den synchronen
  // Anteil (clone + JSON + localStorage) gegen einen vollständigen renderAll() auf derselben WebKit-Laufzeit messen.
  const profile = await page.evaluate(() => {
    const median = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const measure = (label) => {
      const saveMs = [];
      const renderMs = [];
      for (let i = 0; i < 7; i++) {
        const start = performance.now();
        window.save();
        saveMs.push(performance.now() - start);
      }
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        window.renderAll();
        renderMs.push(performance.now() - start);
      }
      const saveMedianMs = median(saveMs);
      const renderMedianMs = median(renderMs);
      return {
        label,
        stateBytes: new Blob([JSON.stringify(window.__beikostTest.getState())]).size,
        saveMedianMs,
        renderMedianMs,
        saveShareOfSavePlusRenderPct: (saveMedianMs + renderMedianMs) > 0
          ? saveMedianMs / (saveMedianMs + renderMedianMs) * 100
          : 0,
      };
    };

    const cloneJson = (value) => JSON.parse(JSON.stringify(value));
    const original = window.__beikostTest.getState();
    const baseline = measure("current-state");
    const template = original.logs[original.logs.length - 1] || {
      date: window.__beikostTest.today(),
      meal: "",
      entryType: "food",
      foodIds: [original.foods[0].id],
      focusId: original.foods[0].id,
      baseFoodIds: [],
      sampleFoodIds: [original.foods[0].id],
      foodRoles: { [original.foods[0].id]: "sample" },
      foodOutcomes: { [original.foods[0].id]: "tried" },
      outcome: "tried",
      textureKnown: true,
      textureStage: 2,
    };
    const historyState = cloneJson(original);
    historyState.logs = Array.from({ length: 365 }, (_, index) => ({
      ...cloneJson(template),
      id: `latency-profile-${index}`,
      createdAt: new Date(Date.UTC(2026, 0, 1, 12, 0, index % 60)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 0, 1, 12, 0, index % 60)).toISOString(),
    }));
    window.__beikostTest.setState(historyState);
    const yearHistory = measure("365-log-history");
    window.__beikostTest.setState(original);
    return { baseline, yearHistory };
  });

  assert.ok(Number.isFinite(profile.baseline.saveMedianMs));
  assert.ok(Number.isFinite(profile.baseline.renderMedianMs));
  assert.ok(profile.yearHistory.stateBytes > profile.baseline.stateBytes, "Profilzustand mit Jahresverlauf muss größer sein");
  console.log(`[save-ui-profile] ${JSON.stringify(profile)}`);
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("WebKit save/UI latency regression and storage profile passed.");
