"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const foodSource = fs.readFileSync(path.join(root, "data", "foods.js"), "utf8");
const {
  HANDLING_MODES,
  ORAL_PROCESSING_PROFILES,
  FOOD_HANDLING_CONTRACT,
} = require(path.join(root, "data", "food-handling.js"));

/*
 * Eingefrorene Legacy-Allowlist zum Rollout des strukturierten FOOD-Contracts.
 * Diese IDs dürfen bestehende Legacy-FOODs bleiben. Neue kanonische FOODs hier
 * NICHT ergänzen, sondern vollständig in FOOD_HANDLING_CONTRACT klassifizieren.
 */
const LEGACY_FOOD_HANDLING_IDS = new Set(`
karotte
kartoffel
zucchini
rind
brokkoli
banane
hafer
apfel
ei
birne
huhn
hirse
karfiol
suesskartoffel
rote-linsen
erdnuss
weizen
lachs
rapsoel
sesam
erbsen-tk-moeglich
kuhmilch
kuerbis
naturjoghurt
buttermilch
mais-polenta
avocado
kohlrabi
mango
reis
kichererbse
gruene-bohnen
papaya
mungbohne
pflaume
pfirsich
pute
gurke
kabeljau
tomate
paprika
heidelbeere
sellerie
mandel
rote-ruebe
lauch
spinat
quinoa
kiwi
mandarine
schwein
lamm
soja-tofu
roggen
gerste
wirsing
aubergine
walnuss
zimt
rosenkohl
weisskraut
rotkraut
maroni
buchweizen
amaranth
kaki
forelle
weisse-bohnen
zwiebel
knoblauch
petersilie
basilikum
oregano
haselnuss
steckruebe
schwarzwurzel
topinambur
gelbe-linsen
schwarze-bohnen
seelachs
kokos
ananas
granatapfel
sonnenblumenkerne
kuerbiskerne
dill
thymian
majoran
rosmarin
cashew
champignon
pak-choi
okra
schwarze-linsen
melone
guave
drachenfrucht
pistazie
garnele
leinsamen
koriandergruen
kurkuma
ingwer
vanille
wassermelone
orange
erdbeere
himbeere
aprikose
nudeln-pasta
dinkel
saba-banane
upo-flaschenkuerbis
sayote-chayote
patola-ridge-gourd
malunggay-moringablaetter
kangkong-wasserspinat
kamote-blaetter
sitaw-lange-bohnen
gabi-taro
cassava-kamoting-kahoy
ube-violette-yamswurzel
bangus-milkfish
tilapia
galunggong-round-scad
calamansi
pomelo
jackfruit-langka
rambutan
lanzones
chico-sapodilla
guyabano-soursop
caimito-sternapfel
rimas-brotfrucht
saluyot-juteblaetter
senf
fenchel
pastinake
stangensellerie
dattel
kirsche
rosine
traube
zitrone
brot
couscous
haferdrink
polenta
butter
frischkaese
kaese
kefir
mozzarella
quark
skyr
chiasamen
tahin
kokosoel
olivenoel
sardine
thunfisch
sojabohne
sojajoghurt
kakao
nektarine
brombeere
ribisel
feige
mangold
spargel
petersilienwurzel
weizengriess
bulgur
kidneybohne
braune-gruene-linse
schnittlauch
pecannuss
paranuss
macadamia
lupine
miesmuschel
mohn
tempeh
kaeferbohne
rhabarber
chinakohl
rucola
radicchio
endivie
rettich
blattsalat
holunder
preiselbeere
quitte
kren
walnussoel
sojaoel
weizenkeimoel
`.trim().split(/\s+/));

function runtimeFoodIds() {
  const context = vm.createContext({ console });
  vm.runInContext(foodSource, context, { filename: "data/foods.js" });
  return JSON.parse(vm.runInContext("JSON.stringify(FOOD_DB.map((food) => food.id))", context));
}

test("FOOD handling forward gate: Legacy-Allowlist ist der explizite Rollout-Bestand", () => {
  const ids = runtimeFoodIds();
  const current = new Set(ids);
  assert.equal(LEGACY_FOOD_HANDLING_IDS.size, 198);
  assert.equal(ids.length, new Set(ids).size, "kanonische FOOD-IDs müssen eindeutig bleiben");
  for (const id of LEGACY_FOOD_HANDLING_IDS)
    assert.ok(current.has(id), `Legacy-Allowlist enthält nicht mehr vorhandenes FOOD: ${id}`);
});

test("FOOD handling forward gate: jedes neue kanonische FOOD braucht einen vollständigen Contract", () => {
  const validModes = new Set(Object.values(HANDLING_MODES));
  const validOralProfiles = new Set(Object.values(ORAL_PROCESSING_PROFILES));

  for (const id of runtimeFoodIds()) {
    if (LEGACY_FOOD_HANDLING_IDS.has(id)) continue;
    const contract = FOOD_HANDLING_CONTRACT[id];
    assert.ok(contract, `Neues FOOD ohne Handling-/Oral-Contract: ${id}`);
    assert.ok(Array.isArray(contract.modes) && contract.modes.length > 0, `${id}: modes fehlen`);
    for (const mode of contract.modes)
      assert.ok(validModes.has(mode), `${id}: unbekannter Handlingmodus ${mode}`);
    assert.ok(
      validOralProfiles.has(contract.oralProcessing),
      `${id}: gültiges oralProcessing fehlt`,
    );
    assert.equal(typeof contract.servingRequirement, "string", `${id}: servingRequirement fehlt`);
    assert.ok(contract.servingRequirement.trim(), `${id}: servingRequirement ist leer`);
  }
});
