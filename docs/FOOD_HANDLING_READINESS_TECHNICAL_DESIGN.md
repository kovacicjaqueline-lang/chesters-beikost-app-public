# FOOD Handling Readiness – technisches Soll- und Laufzeitmodell

Stand: 2026-08-21  
Status: Handling-, Bite-Separation- und Oral-Processing-Modell fachlich freigegeben  
Bezug: `docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md` und `docs/PLANNER_FACHKONZEPT.md`

## Ziel

Löffelkost und geeignetes Fingerfood werden parallel abgebildet, ohne Beikostphase, Alter, Allergene, Mahlzeiteneignung, FOOD-Sicherheit oder Planner-Locks abzuschwächen.

Das Modell führt ausdrücklich **keine lineare Skill-Leiter** ein.

## 1. Getrennte Dimensionen

Die Laufzeit trennt:

1. **Feeding-Präferenz**
   - `spoon`
   - `fingerfood`
   - `mixed`

2. **Handlingmodus**
   - `spoon-smooth`
   - `spoon-mashed`
   - `spoon-soft-lumpy`
   - `finger-graspable`
   - `finger-small-soft`

3. **Bite Separation** für zusammenhängende Fingerfoods
   - `low-resistance-separate`
   - `easy-bite-separate`
   - `graded-bite-required`

4. **Orales Verarbeitungsprofil nach dem Abtrennen**
   - `soft-breakdown`
   - `easy-chew`
   - `structured-chew-required`

5. **Beobachtete Fähigkeiten**
   - `small-soft-pieces`
   - `graded-bite`
   - `structured-chew`

6. **Unabhängige bestehende Gates**
   - Zutatenstatus
   - Allergene
   - Mahlzeiteneignung
   - `hardMinMonths`
   - FOOD-Safety
   - sonstige Planner-/Policy-Regeln

Keine dieser Dimensionen darf aus einer anderen automatisch abgeleitet werden.

## 2. Feeding-Präferenz

`feedingApproach` steuert ausschließlich die Reihenfolge bereits geeigneter Darreichungsformen:

```js
feedingApproach: "mixed"
```

- `spoon`: geeignete Löffelformen bevorzugen;
- `fingerfood`: geeignete Fingerfoodformen bevorzugen;
- `mixed`: beide gleichwertig behandeln.

Die Präferenz darf keine Safety-, Handling-, Bite- oder Oral-Capability umgehen.

## 3. Handling-Contract

Der strukturierte Contract liegt in `data/food-handling.js`.

Ein Rezept erhält explizit einen oder mehrere Modi. Die Zuordnung basiert auf Einzelentscheidungen und nicht auf `category` oder `stage`.

### `spoon-soft-lumpy`

Bleibt an die bestehende Texturentwicklung gekoppelt. Das ist eine Textur-/Handlingfrage und keine Altersregel.

### `finger-graspable`

Ist keine spätere Stufe. Für diese zusammenhängenden Formen muss zusätzlich `biteSeparation` explizit angegeben sein.

### `finger-small-soft`

Wird nur verwendet, wenn kleine weiche Einzelstücke Teil der kanonischen Form sind.

Aktuell:

- Huhn-Zucchini-Nockerl
- Rind-Karotten-Nockerl
- Linsen-Süßkartoffel-Nockerl

Diese drei verlangen ausschließlich:

```js
requiredCapabilities: {
  "finger-small-soft": "small-soft-pieces"
}
```

`small-soft-pieces` beschreibt Aufnehmen/Selbstfüttern, nicht eine zusätzliche orale Small-Piece-Fähigkeit.

## 4. Bite Separation

Technisches Beispiel ohne Bite-Capability:

```js
{
  modes: ["finger-graspable"],
  biteSeparation: "easy-bite-separate",
  oralProcessing: "easy-chew"
}
```

Nur `graded-bite-required` kann zusätzlich tragen:

```js
biteRequiredCapability: "graded-bite"
```

Die Capability wird unabhängig von Handling und Oral Processing geprüft.

Der bestehende Katalog enthält nach dem gezielten Einzel-Recheck:

- 13 × `low-resistance-separate`
- 24 × `easy-bite-separate`
- 4 × `graded-bite-required`

Die vier `graded-bite-required`-Rezepte sind:

- Rind-Hafer-Bällchen
- Baby-Bananenbrot
- Weiche Joghurt-Fladen
- Huhn-Gemüse-Muffins

Diese Zuordnung entsteht aus der konkreten formstabilen beziehungsweise kohäsiven kanonischen Servierform, nicht aus Rezeptkategorie, Alter, `stage` oder einer anderen Capability.

## 5. Oral Processing

`oralProcessing` beschreibt ausschließlich den bereits abgetrennten Bissen.

`easy-bite-separate` ist deshalb kein Oral-Profil mehr. Sein bisher vermischter post-separation-Anteil wird als `easy-chew` modelliert.

Dieselben vier bestehenden Rezepte verlangen nach separater Einzelprüfung zusätzlich `structured-chew`:

- Rind-Hafer-Bällchen
- Baby-Bananenbrot
- Weiche Joghurt-Fladen
- Huhn-Gemüse-Muffins

Technische Form dieser vier aktuellen Bestandsfälle:

```js
{
  modes: ["finger-graspable"],
  biteSeparation: "graded-bite-required",
  biteRequiredCapability: "graded-bite",
  oralProcessing: "structured-chew-required",
  oralRequiredCapability: "structured-chew"
}
```

Die identische Vierergruppe ist ein Ergebnis zweier unabhängiger Einzelprüfungen und **keine Kopplungsregel**. Das Modell muss weiterhin auch `graded-bite-required` + `easy-chew` sowie `easy-bite-separate` + `structured-chew-required` abbilden können.

Daraus folgt ausdrücklich weder `structured-chew => graded-bite` noch `graded-bite => structured-chew`.

## 6. Nutzerfähigkeiten und Persistenz

Die drei Fähigkeiten werden unabhängig gespeichert:

```js
handlingCapabilities: {
  smallSoftPieces: false,
  gradedBite: false,
  structuredChew: false
}
```

Fehlende Altwerte werden konservativ als `false` normalisiert.

Die Settings-UI enthält drei getrennte beobachtbare Bestätigungen:

- kleine weiche Stücke gezielt aufnehmen und zum Mund führen;
- bei weichen formstabilen Stücken gezielt einen passenden Bissen abtrennen;
- strukturierte weiche Bissen sicher im Mund bewegen und wiederholt zerkleinern.

Eine neue Storage-Schema-Version ist nicht erforderlich, weil `gradedBite` additiv ist.

Wichtig:

- kein Auto-Unlock nach Alter;
- kein Auto-Unlock aus `textureStage`;
- kein Auto-Unlock aus `feedingApproach`;
- keine Capability entsperrt eine andere;
- Zähne sind kein Capability-Gate.

## 7. Vollmigration der 103 Laufzeitrezepte

Der Contract enthält weiterhin genau **103 Rezeptnamen** und muss exakt mit dem normalisierten Laufzeitkatalog übereinstimmen.

Die bestehende Later-Matrix bleibt insgesamt bei 87 / 4 / 3 / 9, die Vierergruppe verlangt jetzt jedoch zwei unabhängige Capabilities:

| Gruppe | Anzahl | technische Wirkung |
| --- | ---: | --- |
| kein zusätzliches späteres Gate | 87 | expliziter Handling-/Bite-/Oral-Contract |
| `graded-bite` + `structured-chew` | 4 | zwei unabhängige beobachtete Capabilities |
| `small-soft-pieces` | 3 | harte beobachtete Handling-Capability |
| weiche spätere Formorientierung | 9 | keine neue Capability; Form/`minMonths`-Orientierung bleibt erhalten |
| offen | 0 | – |

Die neun weichen späteren Formfälle bleiben:

- Gemüse-Nudel-Sauce
- Baby-Linsen-Bolognese
- Huhn-Karotte-Nudel-Topf
- Huhn-Lauch-Kartoffel-Topf
- Brokkoli-Linsen-Pasta
- Gemüse-Pasta mit Zucchini und Tomate
- Ei-Champignon-Cups
- Tinola-inspiriert
- Sayote-Huhn-Reis

## 8. Zentrale Eligibility

`js/handling-readiness.js` bleibt die einzige zentrale Policy.

Ablauf für ein migriertes Rezept:

1. Contract nach Rezeptname lesen;
2. Modi gegen Textur- und Handlingvoraussetzungen prüfen;
3. `biteRequiredCapability` unabhängig prüfen;
4. `oralRequiredCapability` unabhängig prüfen;
5. wenn beide fehlen, beide Blockgründe erhalten;
6. Feeding-Präferenz nur auf bereits geeignete Modi anwenden;
7. alte `Konsistenz:`-Stage-Sperre für das migrierte Rezept entfernen;
8. Zutaten-/Alters-/Safety-Gates unverändert lassen.

Ein fehlender Contract behält den konservativen Legacy-Fallback.

### Blockgründe

Handling-Capability:

```text
Darreichungsform: kleine weiche Stücke noch nicht bestätigt
```

Bite-Capability:

```text
Bissabtrennung: gezieltes Abtrennen eines passenden Bissens noch nicht bestätigt
```

Orale Capability:

```text
Orale Verarbeitung: strukturiertes Kauen noch nicht bestätigt
```

Mehrere unabhängige Capability-Gründe dürfen gleichzeitig vorhanden sein.

## 9. Rezept-Serving-Guidance

Der Contract darf individuell geprüfte Serving-/Safety-Guidance tragen. Freitext wird nie zurück in Steuerlogik geparst.

Besonders relevant bleiben:

- breite Streifen beim Zucchini-Omelett;
- saftige flache/längliche Form bei Geflügel- und Fleischbällchen;
- nicht klebrig-teigige Krume beim Baby-Bananenbrot;
- keine rohe/klebrige Mitte bei Joghurt-Fladen;
- Safety-/Texturkontrolle der drei Nockerl;
- Eier-Finger vollständig gegart, aber nicht unnötig trocken/gummiartig;
- bei Hummus-Sticks ist „weich“ eine mechanische Eigenschaft: roh oder gegart möglich, wenn die konkret angebotene Form weich und sicher ist.

## 10. Integration in `recipeStatesCore()`

Die bestehende zentrale Rezeptfreigabe wird weiterhin gewrappt.

Für migrierte Rezepte:

- historische `Konsistenz:`-Sperre entfernen;
- Handling-/Bite-/Oral-Eligibility anwenden;
- `hardMinMonths` unverändert lassen;
- `ingredientMissing` unverändert lassen;
- `unlocked` anschließend aus allen verbleibenden Gründen neu bestimmen.

Rezeptliste, Vorrat und PLAN-08 Recipe-first verwenden damit dieselbe zentrale Entscheidung. Keine zweite Bite-/Oral-Schranke in `planner-recipe-first.js` einbauen.

## 11. Presentation Mode

Eine automatisch erzeugte Mahlzeit kann weiterhin additiv tragen:

```js
presentationMode: "finger-graspable"
```

`presentationMode` beschreibt Handling, nicht Bite-/Oral-Capabilities.

Bestehende Locks und Logs ohne dieses Feld bleiben gültig. Aus historischem `textureStage` darf kein `presentationMode` rückwirkend erfunden werden.

## 12. Safety bleibt unabhängig

Ein Safety-Problem darf nie durch eine Capability freigeschaltet werden.

Beispiel Baby-Bananenbrot:

- `gradedBite: true` und `structuredChew: true` erlauben nur eine korrekt gebackene, vollständig ausgekühlte, nicht klebrig-teigige Krume;
- eine klebrig, teigig oder ballend geratene Charge bleibt ungeeignet.

Dasselbe Prinzip gilt für harte Krusten, kompakt-federnde Bällchen oder gummiartige Nockerl.

## 13. Regressionen

Mindestens abzusichern:

1. 103 Runtime-Rezepte = 103 Contract-Einträge;
2. keine Doppelzuordnung;
3. bestehende Later-Matrix 87 / 4 / 3 / 9;
4. 41 `finger-graspable` = 13 low-resistance / 24 easy-bite / 4 graded-bite;
5. jeder `finger-graspable`-Contract hat Bite Separation;
6. vier Einzelprüfungen verlangen sowohl `graded-bite` als auch `structured-chew`;
7. `gradedBite` und `structuredChew` werden unabhängig geprüft und entsperren sich nicht gegenseitig;
8. reales Bestandsrezept mit zwei Capabilities bleibt gesperrt, solange nur eine bestätigt ist;
9. drei Nockerl nur durch `small-soft-pieces` freigegeben;
10. Feeding-Präferenz umgeht keine Capability;
11. `spoon-soft-lumpy` bleibt an Texturentwicklung gekoppelt;
12. `hardMinMonths` und fehlende Zutaten bleiben unabhängig aktiv;
13. Settings speichern alle drei Capability-Werte getrennt und Reload erhält sie;
14. PLAN-08-Rezeptidentität und bestehende Locks bleiben stabil.

Nach Produktivänderungen in diesem Bereich gelten gemäß `AGENTS.md` / `docs/AI_WORKFLOW.md`:

- betroffene Node-Regressionen;
- `npm run verify:fast`;
- wegen Settings-/Browserfluss zusätzlich `npm run verify:app`.
