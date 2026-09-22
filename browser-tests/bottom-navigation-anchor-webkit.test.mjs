import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { closeBrowserApp, startStaticServer } from "./helpers/app-harness.mjs";



const server = await startStaticServer();
const { port } = server.address();
const browser = await webkit.launch();

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__beikostTest?.getState);

  await page.evaluate(() => {
    const filler = document.createElement("div");
    filler.id = "bottomNavTestFiller";
    filler.style.height = "1800px";
    const marker = document.createElement("div");
    marker.id = "bottomNavTestMarker";
    marker.textContent = "Ende";
    marker.style.height = "40px";
    document.querySelector("#home").append(filler, marker);
  });

  const initial = await page.evaluate(() => {
    const main = document.querySelector("main");
    const nav = document.querySelector("nav");
    const navRect = nav.getBoundingClientRect();
    return {
      bodyOverflow: getComputedStyle(document.body).overflow,
      mainOverflowY: getComputedStyle(main).overflowY,
      navPosition: getComputedStyle(nav).position,
      navBottom: navRect.bottom,
      viewportBottom: window.innerHeight,
      windowScrollY: window.scrollY,
      mainScrollable: main.scrollHeight > main.clientHeight,
    };
  });

  assert.equal(initial.bodyOverflow, "hidden", "Das Dokument selbst darf für die stabile Bottom-Navigation nicht scrollen");
  assert.equal(initial.mainOverflowY, "auto", "Der Inhaltsbereich muss der einzige vertikale Scroll-Container sein");
  assert.equal(initial.navPosition, "absolute", "Die Bottom-Navigation muss am nicht scrollenden App-Shell verankert sein");
  assert.equal(initial.windowScrollY, 0, "Der Window-Viewport darf nicht vertikal verschoben sein");
  assert.equal(initial.mainScrollable, true, "Der Testinhalt muss im Hauptbereich scrollbar sein");
  assert.ok(Math.abs(initial.navBottom - initial.viewportBottom) <= 1, "Die Bottom-Navigation muss am unteren Viewport-Rand beginnen");

  const afterScroll = await page.evaluate(async () => {
    const main = document.querySelector("main");
    const nav = document.querySelector("nav");
    const marker = document.querySelector("#bottomNavTestMarker");
    main.scrollTop = 700;
    window.scrollTo(0, 700);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const navRect = nav.getBoundingClientRect();
    return {
      mainScrollTop: main.scrollTop,
      windowScrollY: window.scrollY,
      navBottom: navRect.bottom,
      viewportBottom: window.innerHeight,
      markerBottomBeforeEnd: marker.getBoundingClientRect().bottom,
    };
  });

  assert.ok(afterScroll.mainScrollTop > 0, "Der Inhalt muss unabhängig von der Navigation scrollen können");
  assert.equal(afterScroll.windowScrollY, 0, "Auch nach Scrollversuch darf nur der Hauptbereich scrollen");
  assert.ok(Math.abs(afterScroll.navBottom - afterScroll.viewportBottom) <= 1, "Die Bottom-Navigation darf beim Scrollen nicht nach oben driften");

  const atEnd = await page.evaluate(async () => {
    const main = document.querySelector("main");
    const nav = document.querySelector("nav");
    const marker = document.querySelector("#bottomNavTestMarker");
    main.scrollTop = main.scrollHeight;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const navRect = nav.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    return {
      navTop: navRect.top,
      navBottom: navRect.bottom,
      viewportBottom: window.innerHeight,
      markerBottom: markerRect.bottom,
    };
  });

  assert.ok(Math.abs(atEnd.navBottom - atEnd.viewportBottom) <= 1, "Die Bottom-Navigation muss auch am Seitenende am Viewport-Rand bleiben");
  assert.ok(atEnd.markerBottom <= atEnd.navTop + 1, "Der letzte Inhalt muss oberhalb der Bottom-Navigation vollständig erreichbar bleiben");

} finally {
  await closeBrowserApp({ context: typeof context !== "undefined" ? context : null, browser, server });
}
