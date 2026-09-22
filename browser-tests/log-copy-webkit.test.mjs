import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);

  const source = await page.evaluate(() => {
    const state = window.__beikostTest.reset();
    state.inventory = [];
    state.backupMeta.chesterContextSeeded = true;
    const log = {
      id: "copy-source",
      date: "2026-09-10",
      meal: "lunch",
      foodIds: ["karotte"],
      focusId: "karotte",
      recipeName: "",
      outcome: "tried",
      foodOutcomes: { karotte: "tried" },
      entryType: "food",
      baseFoodIds: [],
      sampleFoodIds: ["karotte"],
      foodRoles: { karotte: "sample" },
      individualRatings: false,
      amount: "30",
      note: "Lässt sich gut vorbereiten",
      textureKnown: true,
      textureStage: 2,
      reactionFoodId: "",
      rejectionStrength: "",
      notOfferedReason: "",
      createdAt: "2026-09-10T10:00:00.000Z",
      updatedAt: "2026-09-10T10:00:00.000Z",
    };
    state.logs = [log];
    window.__beikostTest.setState(state);
    window.renderAll();
    return log;
  });

  await page.locator('nav button[data-view="more"]').click();
  await page.locator('.more-nav-row[data-more-target="logSection"]').click();
  const copyButton = page.locator('.log-entry[data-log="copy-source"] .copyLog');
  await copyButton.waitFor();
  assert.equal(await copyButton.getAttribute("aria-label"), "Essen kopieren");

  await copyButton.click();
  await page.locator("#logModal.open").waitFor();
  assert.equal(await page.locator("#logTitle").textContent(), "Essen kopieren");
  assert.equal(await page.locator("#saveLog").textContent(), "Kopie speichern");
  assert.match(await page.locator("#logSubtitle").textContent(), /Aus dem Protokoll übernommen/);
  assert.equal(await page.locator("#logDate").inputValue(), await page.evaluate(() => window.__beikostTest.today()));
  assert.equal(await page.locator("#logMeal").inputValue(), "lunch");
  assert.equal(await page.locator("#logAmount").inputValue(), "30");
  assert.equal(await page.locator("#logTexture").inputValue(), "2");
  assert.equal(await page.locator("#logNote").inputValue(), "Lässt sich gut vorbereiten");
  assert.doesNotMatch(await page.locator("#logForm").textContent(), /aus dem Plan/);

  await page.locator("#saveLog").click();
  await page.waitForFunction(() => !document.getElementById("logModal")?.classList.contains("open"));

  const result = await page.evaluate(() => ({
    today: window.__beikostTest.today(),
    logs: window.__beikostTest.getState().logs,
  }));
  assert.equal(result.logs.length, 2, "Kopieren muss einen zweiten Eintrag anlegen");
  const original = result.logs.find((log) => log.id === "copy-source");
  const copied = result.logs.find((log) => log.id !== "copy-source");
  assert.ok(original, "Originaleintrag muss unverändert erhalten bleiben");
  assert.ok(copied, "Kopie muss eine neue ID erhalten");
  assert.equal(original.date, source.date);
  assert.equal(original.createdAt, source.createdAt);
  assert.equal(copied.date, result.today, "Kopie soll standardmäßig für heute vorbereitet werden");
  assert.equal(copied.meal, source.meal);
  assert.deepEqual(copied.foodIds, source.foodIds);
  assert.deepEqual(copied.foodOutcomes, source.foodOutcomes);
  assert.equal(copied.amount, source.amount);
  assert.equal(copied.textureStage, source.textureStage);
  assert.equal(copied.note, source.note);
  assert.notEqual(copied.createdAt, source.createdAt, "Kopie braucht einen neuen Erstellungszeitpunkt");
} finally {
  await closeBrowserApp({ context, browser, server });
}

console.log("WebKit logged meal copy regression passed.");
