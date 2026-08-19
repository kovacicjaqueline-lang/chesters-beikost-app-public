# PLAN-08 – Audit automatisch möglicher FOOD-Kombinationen

Stand: Branch `refactor/plan-08-food-presentation-contract`, PLAN-08-X1 ergänzt und nach Review gehärtet.

## Ziel und Abgrenzung

Der Audit prüft die strukturell möglichen automatischen FOOD-Kombinationspfade des aktuellen Planners. Er führt **keine neue allgemeine Pair-Blacklist** ein.

Gezählt werden Kombinationen, die unter den bestehenden Hard-Gates grundsätzlich erreichbar sind, wenn die beteiligten Lebensmittel ausreichend eingeführt/vertraut sind und Nutzungs-/Rotationshistorie die Sortierung entsprechend verschiebt. Die Zahlen sind deshalb eine Obermenge der Kombinationen einer konkreten Planwoche und kein Häufigkeitsmaß.

Berücksichtigt werden insbesondere:

- `FOOD.meals` für Frühstück/Mittag/Abend;
- `autoPlan`, `minPhase`, `minAgeMonths`;
- `plannerRole` für automatische Fokus-/Basisfähigkeit;
- Allergen-Fokus über `knownBase()`;
- normaler `companionFor()`-Pfad;
- bestehende Begleitersortierung;
- Single-Starch-Schranke;
- MILK-01-Policy;
- Kombination-Pause/Rotation;
- PLAN-08-X1-Eisenpräferenz innerhalb der Begleiterauswahl;
- weiche kulinarische Nachrangigkeit bestätigter herzhafter Obst-Mischungen außerhalb des Frühstücks;
- strukturierter PLAN-08-Präsentationsvertrag;
- nachgelagerte Recipe-first-Promotion bei exakt gleichen FOOD-IDs.

## PLAN-08-X1 – Status

Der frühere Core-Pfad bleibt aus Migrations-/Scopegründen in `planning.js` syntaktisch vorhanden: Nach Fokus und normalem Begleiter ruft `buildDay()` weiterhin `ironCompanion()` auf.

Er ist im produktiven Planner jedoch **nicht mehr als eigenständiger Dreierpfad wirksam**:

1. `planner-meal-eligibility.js` härtet zuerst die allgemeine FOOD-/Mahlzeiteneignung.
2. `planner-milk-policy.js` legt anschließend MILK-01 über denselben Begleiterpfad.
3. `planner-iron-preference.js` läuft danach und prüft zuerst die normale Zweierkombination.
4. Ist diese außerhalb des Frühstücks eine bestätigte schräge Obst-Mischung, wird eine vorhandene neutralere Begleiteralternative bevorzugt. Das ist eine weiche Priorität, kein Pair-Verbot.
5. Erst danach darf ein ausreichend eingeführter `ironRich`-Kandidat über denselben bereits gehärteten `companionFor()`-Pfad bevorzugt werden – und nur, wenn er die kulinarische Präferenz gegenüber der normalen Kombination nicht verschlechtert.
6. Ein pausiertes Paar wird weder durch den weichen Fallback noch durch die Eisenpräferenz nach vorne geholt; Single-Starch bleibt hart.
7. Gibt es keinen geeigneten Eisenbegleiter, bleibt die normale Zweierkombination bestehen.
8. Anschließend wird `ironCompanion()` zentral auf `null` neutralisiert. Der spätere `ids.push(iron.id)`-Core-Zweig erhält daher keinen Kandidaten mehr.

Damit gilt nach PLAN-08-X1 für FOOD-only-Mahlzeiten grundsätzlich **Fokus + höchstens ein normal gewählter Begleiter**. Eine dritte FOOD-Komponente wird nicht mehr allein zur Eisenoptimierung angehängt.

Frühstück, Mengenstufe `taste`, eisenreicher Fokus, Milchprodukt-Fokus sowie Einführung/Kostprobe behalten ihre bisherige Nicht-Anwendung der Eisenpräferenz.

## Struktureller Radar

Der Audit behält den früheren Dreier-Enumerator bewusst als **Legacy-Radar**. Er zeigt nicht mehr aktuell erreichbare PLAN-08-X1-Mahlzeiten, sondern die Größe des Fehlerraums, der bei einer Loader-/Policy-Regression wieder erreichbar würde.

Der Runtime-Vertrag des Audits fordert deshalb ausdrücklich:

- `reachableIronTriplesAfterX1: 0`;
- eisenreiche Kandidaten bleiben als normale `companionFor()`-Paarpfade sichtbar;
- `planner-iron-preference.js` wählt über den bestehenden `companionFor()`-Pfad;
- `combinationPaused()` und `enforceSingleStarch()` bleiben Teil der X1-Entscheidung;
- `ironCompanion()` liefert nach Installation der X1-Policy immer `null`;
- die Loader-Reihenfolge bleibt `Meal-Eligibility → MILK-01 → PLAN-08-X1 → Präsentation → Recipe-first`.

Die bisherigen Legacy-Zahlen des Dreier-Audits bleiben damit diagnostisch nützlich, sind aber **keine erreichbaren FOOD-only-Dreierkombinationen mehr**.

## Befund A – PLAN-08-Präsentationsrolle Gurke bleibt unverändert

Der bestätigte `fresh-side`-Fall bleibt ausschließlich strukturiert über `data/food-presentation.js` modelliert. PLAN-08-X1 erweitert weder den Gurkenfall noch Präsentationsrollen und leitet keine Steuerlogik aus Freitextfeldern wie `safeForm` oder `prep` ab.

## Befund B – MILK-01 bleibt harte Policy

Der bereits geschlossene Allergen-`knownBase()`-Bypass bleibt unverändert geschlossen. PLAN-08-X1 läuft **nach** der MILK-01-Policy und ruft deren bereits gehärteten `companionFor()`-Pfad auf. Die Eisenpräferenz kann die Milch/Fleisch-/Fisch-Schranke daher nicht umgehen.

Der Audit darf die zugrunde liegenden Core-Kandidaten weiterhin als Radar ausweisen; die Runtime-Regressionen von MILK-01 bestimmen, dass diese nicht produktiv durchgelassen werden.

## Befund C – bestätigte schräge Obst-Kombinationen werden weich nachrangig

Außerhalb des Frühstücks gibt es weiterhin **keine harte allgemeine Pair-Blockliste**. Nach der fachlichen Rückmeldung werden jedoch zwei Klassen bei automatischen FOOD-only-Begleitern weich nach hinten gestellt:

- Obst + Gemüse/Wurzel, Referenzfall `Banane + Karotte`;
- Obst + herzhafte Proteinquelle (`Fleisch`, `Fisch`, `Meeresfrucht`, `Hülsenfrucht`), Referenzfall `Banane + Rind`.

Gibt es eine neutralere geeignete Begleiteralternative, wird diese bevorzugt. Fehlt eine solche Alternative, bleibt der bestehende Planner-Pfad technisch erhalten; dadurch wird kein plausibles echtes Gericht pauschal verboten. Recipe-first bleibt für vorhandene exakte Rezepte separat zuständig.

Wichtig für X1: Ein Eisenkandidat darf die aktuelle kulinarische Präferenz **nicht verschlechtern**. So wird aus einer normalen Obstkombination nicht allein wegen `ironRich` automatisch `Banane + Rind`.

## Befund D – früherer `ironCompanion()`-Dreierpfad ist neutralisiert

Die adversarialen Beispiele

- Karotte + Banane + Rind
- Karotte + Birne + Rote Linsen

können nicht mehr allein dadurch entstehen, dass nach einer bereits gewählten Zweierkombination blind eine dritte Eisenkomponente angehängt wird.

Ist Rind bzw. Rote Linse als Begleiter nach allen bestehenden Gates und der kulinarischen Präferenz geeignet, kann der eisenreiche Kandidat innerhalb der normalen Zweierauswahl bevorzugt werden. Ist er nicht geeignet, bleibt die sonst zulässige Zweierkombination bestehen. Eine dritte Zutat wird nicht erzwungen.

## Recipe-first bleibt nachgelagert und unverändert

PLAN-08-X1 verändert Recipe-first nicht.

- Ein vorhandenes Rezept wird weiterhin nur übernommen, wenn seine geeignete Variante **exakt dieselben bereits geplanten FOOD-IDs** enthält.
- Keine fehlende Rezeptzutat wird ergänzt.
- Einführungen/Kostproben bleiben FOOD-first.
- Ein exakt passendes Rezept mit drei oder mehr FOOD-Komponenten bleibt technisch zulässig, wenn die zugrunde liegende Mahlzeit diese FOOD-IDs bereits legitim enthält.
- FOOD-Kombinationen ohne exakten Rezepttreffer werden nicht künstlich zu Rezepten.

## Weiter bewusst offen

Nicht durch PLAN-08-X1 entschieden oder verändert:

- keine allgemeine positive FOOD-Kombinationsmatrix;
- keine harte Pair-Blacklist;
- keine neue Präsentationsrolle;
- keine Erweiterung des Gurkenfalls;
- keine Änderung von `FOOD.meals`, `autoPlan`, `minPhase`, `minAgeMonths` oder Phasenlogik;
- keine Entscheidung, ob ganze Nuss-/Samen-Allergen-FOODs nach Einführung normaler automatischer Fokus sein dürfen.

## Regressionen

`tests/plan-08-iron-preference.test.cjs` sichert den Runtime-Vertrag adversarial ab und verwendet zusätzlich **echtes `planning.js` plus echte FOOD-Datensätze** für die Referenzfälle Banane/Karotte/Hafer/Zucchini/Rind. Der bestehende `tests/plan-08-combination-audit.test.cjs` bleibt als struktureller Radar erhalten und prüft zusätzlich, dass der alte Dreierpfad nur noch als neutralisierter Legacy-Core sichtbar ist.

Die bestehenden Recipe-first-, MILK-01-, Planner-, FOOD- und Phasenregressionen bleiben unverändert Teil der vollständigen Suite.
