# FOOD Handling Readiness – technisches Soll- und Laufzeitmodell

Stand: 2026-08-20  
Status: Handling- und Oral-Processing-Contract für alle 103 Laufzeitrezepte migriert  
Bezug: `docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md` und `docs/PLANNER_FACHKONZEPT.md`

## Ziel

Löffelkost und geeignetes Fingerfood werden parallel abgebildet, ohne Beikostphase, Alter, Allergene, Mahlzeiteneignung, FOOD-Sicherheit oder Planner-Locks abzuschwächen.

Das Modell ersetzt weder die Beikostphase noch führt es eine lineare Skill-Leiter ein.

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

3. **Orales Verarbeitungsprofil**
   - `soft-breakdown`
   - `easy-bite-separate`
   - `structured-chew-required`

4. **Beobachtete Fähigkeiten**
   - `small-soft-pieces`
   - `structured-chew`

5. **Unabhängige bestehende Gates**
   - Zutatenstatus
   - Allergene
   - Mahlzeiteneignung
   - `hardMinMonths`
   - FOOD-Safety
   - sonstige Planner-/Policy-Regeln

Keine dieser Dimensionen darf aus einer anderen automatisch abgeleitet werden.

## 2. Feeding-Präferenz

`feedingApproach` steuert ausschließlich die Reihenfolge bereits geeigneter Darreichungsformen.

```js
feedingApproach: "mixed"
```

Semantik:

- `spoon`: geeignete Löffelformen bevorzugen;
- `fingerfood`: geeignete Fingerfoodformen bevorzugen;
- `mixed`: beide gleichwertig behandeln.

Die Präferenz darf keine Safety-, Handling- oder Oral-Capability umgehen.

## 3. Handling-Contract

Der strukturierte Contract liegt in:

`data/food-handling.js`

Ein Rezept erhält explizit einen oder mehrere Modi. Die Zuordnung basiert auf Einzelentscheidungen und nicht auf `category` oder `stage`.

Beispiel:

```js
"Obst-Hafer-Pancakes": {
  modes: ["finger-graspable"],
  oralProcessing: "easy-bite-separate"
}
```

### `spoon-soft-lumpy`

Dieser Modus bleibt an die bestehende Texturentwicklung gekoppelt. Das ist eine Textur-/Handlingfrage und keine Altersregel.

### `finger-graspable`

Dieser Modus ist keine spätere Stufe. Ein weiches gut greifbares Fingerfood kann bei allgemeiner Beikostreife geeignet sein.

### `finger-small-soft`

Dieser Modus wird nur dort verwendet, wo kleine weiche Einzelstücke Teil der kanonischen Form sind und die zusätzliche Handlingfähigkeit individuell freigegeben wurde.

Aktuell:

- Huhn-Zucchini-Nockerl
- Rind-Karotten-Nockerl
- Linsen-Süßkartoffel-Nockerl

Diese drei verlangen:

```js
requiredCapabilities: {
  "finger-small-soft": "small-soft-pieces"
}
```

## 4. Orale Verarbeitungsdimension

`oralProcessing` ist unabhängig vom Handlingmodus.

Für die vollständige fachliche Definition gilt:

`docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md`

Nur vier konkrete Rezepte verlangen aktuell `structured-chew`:

- Rind-Hafer-Bällchen
- Baby-Bananenbrot
- Weiche Joghurt-Fladen
- Huhn-Gemüse-Muffins

Technische Form:

```js
{
  modes: ["finger-graspable"],
  oralProcessing: "structured-chew-required",
  oralRequiredCapability: "structured-chew"
}
```

Alle anderen zusammenhängenden Fingerfoods werden nicht aufgrund ihrer Kategorie pauschal hochgestuft.

## 5. Nutzerfähigkeiten

Die beiden Fähigkeiten werden unabhängig gespeichert:

```js
handlingCapabilities: {
  smallSoftPieces: false,
  structuredChew: false
}
```

Fehlende Altwerte werden konservativ als `false` normalisiert.

Die Nutzerin bestätigt die Fähigkeiten in den Einstellungen nur dann, wenn sie tatsächlich beobachtet wurden.

Wichtig:

- kein Auto-Unlock nach Alter;
- kein Auto-Unlock aus `textureStage`;
- kein Auto-Unlock aus `feedingApproach`;
- `smallSoftPieces` schaltet Structured Chew nicht frei;
- `structuredChew` schaltet kleine Stücke nicht frei.

## 6. Vollmigration der 103 Laufzeitrezepte

Der vorherige Wave-1-Zwischenstand ist abgeschlossen.

Der aktuelle Contract enthält genau **103 Rezeptnamen** und muss exakt mit dem normalisierten Laufzeitkatalog übereinstimmen.

Auditmatrix:

| Gruppe | Anzahl | Technische Wirkung |
| --- | ---: | --- |
| kein zusätzliches späteres Gate | 87 | expliziter Handling-/Oral-Contract, historische Stage-Sperre entfällt handlingseitig |
| `structured-chew` | 4 | harte beobachtete orale Capability |
| `small-soft-pieces` | 3 | harte beobachtete Handling-Capability |
| weiche spätere Formorientierung | 9 | keine neue Capability; kanonische Form/`minMonths`-Orientierung bleibt erhalten |
| offen | 0 | – |

Die neun weichen späteren Formfälle sind:

- Gemüse-Nudel-Sauce
- Baby-Linsen-Bolognese
- Huhn-Karotte-Nudel-Topf
- Huhn-Lauch-Kartoffel-Topf
- Brokkoli-Linsen-Pasta
- Gemüse-Pasta mit Zucchini und Tomate
- Ei-Champignon-Cups
- Tinola-inspiriert
- Sayote-Huhn-Reis

## 7. Zentrale Eligibility

`js/handling-readiness.js` bleibt die zentrale Policy.

Ablauf für ein migriertes Rezept:

1. Contract nach Rezeptname lesen;
2. Modi gegen Textur- und Handlingvoraussetzungen prüfen;
3. orale Capability unabhängig prüfen;
4. Feeding-Präferenz nur auf bereits geeignete Modi anwenden;
5. alte `Konsistenz:`-Stage-Sperre für das migrierte Rezept entfernen;
6. unabhängige Zutaten-/Alters-/Safety-Gates unverändert lassen.

Ein fehlender Contract behält weiterhin den konservativen Legacy-Fallback. Im aktuellen Laufzeitkatalog soll dieser Fall durch die 103/103-Migration jedoch nicht mehr vorkommen.

### Blockgründe

Handling-Capability:

```text
Darreichungsform: kleine weiche Stücke noch nicht bestätigt
```

Orale Capability:

```text
Orale Verarbeitung: strukturiertes Kauen noch nicht bestätigt
```

Diese Blockgründe ersetzen nicht unabhängige andere Sperren.

## 8. Rezept-Serving-Guidance

Der Contract darf für individuell geprüfte Fälle strukturierte Serving-Guidance tragen.

Dazu gehören insbesondere:

- eindeutige breite Streifen beim Zucchini-Omelett;
- saftige flache/längliche Form bei Geflügel- und Fleischbällchen;
- weich-stückige kanonische Form bei Tinola und Sayote-Huhn-Reis;
- Safety-Ausschluss klebrig-teigiger Krume beim Baby-Bananenbrot;
- Ausschluss klebrig/roh-teigiger Mitte bei Joghurt-Fladen;
- Safety-/Texturkontrolle der drei Nockerl.

Die Runtime darf diese strukturierte Guidance als angezeigten Zubereitungs-/Sicherheitstext verwenden. Freitext wird niemals zurück in Steuerlogik geparst.

## 9. Integration in `recipeStatesCore()`

Die bestehende zentrale Rezeptfreigabe wird weiterhin gewrappt.

Für migrierte Rezepte:

- historische `Konsistenz:`-Sperre entfernen;
- Handling-/Oral-Eligibility anwenden;
- `hardMinMonths` unverändert lassen;
- `ingredientMissing` unverändert lassen;
- `unlocked` anschließend aus allen verbleibenden Gründen neu bestimmen.

Dadurch verwenden Rezeptliste, Vorrat und PLAN-08 Recipe-first dieselbe zentrale Entscheidung.

Keine zweite parallele Oral-/Handling-Schranke in `planner-recipe-first.js` einbauen.

## 10. Presentation Mode

Eine automatisch erzeugte Mahlzeit kann additiv tragen:

```js
presentationMode: "finger-graspable"
```

Das Feld kann in neue Auto-Locks und Logs übernommen werden.

Bestehende Locks und Logs ohne dieses Feld bleiben gültig. Aus historischem `textureStage` darf kein `presentationMode` rückwirkend erfunden werden.

## 11. Settings-UI und Persistenz

Die Settings-UI enthält:

- Beikostform;
- Bestätigung für kleine weiche Stücke;
- Bestätigung für strukturiertes Kauen.

Die beiden Capability-Werte werden im bestehenden Settings-Objekt gespeichert. Eine neue Storage-Schema-Version ist dafür nicht erforderlich, weil die Felder additiv sind und fehlende Altwerte konservativ normalisiert werden.

## 12. Safety bleibt unabhängig

Ein Safety-Problem darf nie durch eine Capability freigeschaltet werden.

Beispiel Baby-Bananenbrot:

- `structuredChew: true` erlaubt nur eine korrekt gebackene, vollständig ausgekühlte, nicht klebrig-teigige Krume;
- eine klebrig, teigig oder ballend geratene Charge bleibt ungeeignet.

Dasselbe Prinzip gilt für harte Krusten, kompakt-federnde Bällchen oder gummiartige Nockerl.

## 13. Regressionen

Mindestens abzusichern:

1. 103 Runtime-Rezepte = 103 Contract-Einträge;
2. keine Doppelzuordnung;
3. Auditmatrix 87 / 4 / 3 / 9;
4. vier Structured-Chew-Fälle ohne Capability gesperrt und mit Capability freigegeben;
5. drei Nockerl nur durch `small-soft-pieces` freigegeben;
6. die beiden Fähigkeiten entsperren sich nicht gegenseitig;
7. Feeding-Präferenz umgeht keine Capability;
8. weiche Referenz-Fingerfoods bleiben ohne zusätzliche Capability möglich;
9. `spoon-soft-lumpy` bleibt an Texturentwicklung gekoppelt;
10. `hardMinMonths` und fehlende Zutaten bleiben unabhängig aktiv;
11. Safety-/Serving-Guidance für Bananenbrot und weitere Einzelentscheidungen bleibt erhalten;
12. Settings speichern beide Capability-Werte getrennt und Reload erhält sie;
13. PLAN-08-Rezeptidentität und bestehende Locks bleiben stabil.

Nach Produktivänderungen in diesem Bereich gelten gemäß `AGENTS.md` / `docs/AI_WORKFLOW.md`:

- betroffene Node-Regressionen;
- `npm run verify:fast`;
- wegen Settings-/Browserfluss zusätzlich `npm run verify:app`.
