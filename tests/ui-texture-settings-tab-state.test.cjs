const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function functionSource(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.ok(start >= 0 && end > start, `${name} muss im UI-Modul auffindbar sein`);
  return source.slice(start, end);
}

test("UI: Konsistenzbezeichnungen liegen zentral in textureName", () => {
  const source = read("js/ui.js");
  const handling = read("js/handling-readiness.js");
  const texture = functionSource(source, "textureName", "textureText");

  assert.match(texture, /1: "glatt \/ fein"/);
  assert.match(texture, /2: "dick \/ fein zerdrückt"/);
  assert.match(texture, /3: "mit kleinen weichen Stückchen"/);
  assert.match(texture, /4: "weiche Familienkost"/);
  assert.doesNotMatch(texture, /Fingerfood/);
  assert.doesNotMatch(texture, /dick püriert/);
  assert.doesNotMatch(handling, /handlingAwareTextureName/);
  assert.doesNotMatch(handling, /textureName\s*=\s*function/);
});

test("UI: renderSettings übernimmt die zentralen Labels und beendet Sticky-Leerraum lokal", () => {
  const source = read("js/ui.js");
  const renderSettings = functionSource(source, "renderSettings", "renderAuditCore");

  assert.match(renderSettings, /option\.textContent = `\$\{stage\} – \$\{textureName\(stage\)\}`/);
  assert.match(renderSettings, /document\.getElementById\("settingsActionbar"\)/);
  assert.match(renderSettings, /position: "static"/);
  assert.match(renderSettings, /bottom: "auto"/);
  assert.match(renderSettings, /background: "transparent"/);
  assert.doesNotMatch(renderSettings, /safe-area-inset-bottom/);
});

test("UI: Haupttab-Wechsel behält Filter, Suchen und normale Accordions in der laufenden Sitzung", () => {
  const source = read("js/ui.js");
  const showView = functionSource(source, "showView", "existingFoodWithName");

  assert.doesNotMatch(showView, /recipeFilter\s*=\s*"available"/);
  assert.doesNotMatch(showView, /recipeQuery\s*=\s*""/);
  assert.doesNotMatch(showView, /foodFilter\s*=\s*"open"/);
  assert.doesNotMatch(showView, /logMonthFilter\s*=\s*"all"/);
  assert.doesNotMatch(showView, /resetMoreTransientUi\(/);
  assert.match(showView, /\.entry-chooser/);
  assert.match(showView, /foodReorderMode = false/);
  assert.match(showView, /renderFoods\(\)/);
  assert.match(showView, /window\.scrollTo/);
});

test("UI: kein nachgelagerter Session-Override wird mehr geladen", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /ui-session-state\.js/);
  assert.equal(fs.existsSync(path.join(root, "js/ui-session-state.js")), false);
});
