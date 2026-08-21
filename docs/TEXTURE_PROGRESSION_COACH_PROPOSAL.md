# Texture Progression Coach – vereinfachter Umsetzungsvorschlag

Stand: 2026-08-21  
Status: fachlich-technischer Umsetzungsvorschlag, noch keine Produktivlogik  
Ausgangsbasis: `main` `a4f33a663721442cd38ad01bb9f7836c9cafcaf6`, Version `10.1.26`

## Ziel

Die App soll den Übergang von glatter Löffelkost zu zunehmend strukturierter Löffelkost sinnvoll begleiten, **ohne dafür neue Bedienebenen, neue Bewertungsfelder oder eine zweite Progressionslogik einzuführen**.

Der bestehende Unterbau bleibt maßgeblich:

- `textureStage` beschreibt die aktuelle Konsistenz-/Löffeltextur;
- Handlingmodi beschreiben die Darreichungsform;
- `feedingApproach` bleibt Präferenz für Löffel / Fingerfood / gemischt;
- Fingerfood bleibt parallel möglich und wird nicht zur späteren Texturstufe;
- `smallSoftPieces` und `structuredChew` bleiben eigenständige beobachtete Fähigkeiten.

## Ausgangslage im aktuellen main

### 1. Fachlicher Unterbau ist bereits vorhanden

`js/handling-readiness.js` trennt bereits:

- `spoon-smooth`
- `spoon-mashed`
- `spoon-soft-lumpy`
- `finger-graspable`
- `finger-small-soft`

Damit braucht der Texture Coach **kein neues Datenmodell für Essformen**.

### 2. Der aktuelle Textur-Coach zählt das Falsche

`textureSuccessCount()` zählt positive FOOD-Outcomes auf einer `textureStage` als positive Texturerfahrungen.

Ein Lebensmittel zu essen oder zu probieren beweist aber nicht, dass eine bestimmte Struktur gut bewältigt wurde.

Der aktuelle Schwellwert `successes >= 4` erzeugt dadurch eine scheinbar objektive Freigabe, die fachlich nicht sauber begründet ist.

### 3. Die aktuelle Texturstufe beeinflusst die bevorzugte Löffelform nicht vollständig

`spoon-soft-lumpy` ist bereits an eine passende `textureStage` gekoppelt. Bei `spoon-smooth` und `spoon-mashed` bleibt aber die ursprüngliche Contract-Reihenfolge erhalten.

Dadurch kann bei Stufe 2 weiterhin `spoon-smooth` bevorzugt werden, obwohl `spoon-mashed` besser zur eingestellten Textur passt.

## Vereinfachtes Sollbild

Es werden **nur drei kleine Änderungen** umgesetzt.

## Änderung 1 – Coach-Zähler entfernen statt neues Tracking einzuführen

`textureSuccessCount()` und der daraus abgeleitete Schwellwert `successes >= 4` werden aus dem Home-Coach entfernt.

Es wird **kein Ersatzfeld wie `textureExperience`** eingeführt.

Es gibt auch:

- keine neue Frage im Essensprotokoll;
- keine neue Statistik;
- keine neue Verlaufsauswertung;
- keine automatische Bereitschaftsentscheidung.

Der Coach zeigt nur:

- die aktuell eingestellte Stufe;
- den nächsten möglichen kleinen Testschritt;
- die bestehenden Buttons zum Zurückgehen bzw. Testen der nächsten Stufe.

Beispiel Stufe 1:

```text
Konsistenz
Stufe 1 · glatt / fein

Nächster kleiner Schritt:
Eine kleine Menge etwas dicker oder weich zerdrückt anbieten.
Vertraute Konsistenzen dürfen parallel bleiben.
```

Beispiel Stufe 2:

```text
Nächster kleiner Schritt:
Bei einer passenden Mahlzeit kleine weiche Stückchen testen.
```

Der Wechsel auf die nächste Stufe bleibt wie bisher eine bewusste Nutzerentscheidung.

## Änderung 2 – Fingerfood nur mit einem kurzen Hinweis parallel sichtbar machen

Der bestehende Coach bleibt **eine einzige Karte**.

Keine zweite Spur, kein zweiter Fortschrittsbalken und keine dynamische Suche nach einer passenden nächsten Fingerfood-Mahlzeit.

Stattdessen steht unter der Texturinfo ein kurzer statischer Hinweis:

```text
Geeignetes weiches Fingerfood kann unabhängig von dieser Konsistenzstufe parallel angeboten werden.
```

Optional etwas konkreter:

```text
Geeignetes weiches Fingerfood bleibt parallel möglich. Die sichere Form richtet sich nach dem jeweiligen Lebensmittel oder Rezept.
```

Damit wird die fachlich wichtige Parallelität sichtbar, ohne zusätzliche UI-Mechanik einzubauen.

Die bestehende Handling-/Safety-Logik entscheidet weiterhin, welche konkrete Form tatsächlich geeignet ist.

## Änderung 3 – bereits geeignete Löffelmodi passend zur `textureStage` sortieren

Die bestehende Eligibility wird **nicht** verändert.

Es wird nur die Reihenfolge bereits geeigneter Löffelmodi innerhalb von `preferredHandlingModes()` bzw. einer kleinen zentralen Hilfsfunktion angepasst.

Empfohlene Reihenfolge:

| `textureStage` | bevorzugte Löffelmodi |
| --- | --- |
| 1 | `spoon-smooth` -> `spoon-mashed` |
| 2 | `spoon-mashed` -> `spoon-smooth` |
| 3 | `spoon-soft-lumpy` -> `spoon-mashed` -> `spoon-smooth` |
| 4 | `spoon-soft-lumpy` -> `spoon-mashed` -> `spoon-smooth` |

Regeln:

1. zuerst unverändert bestehende Handling-/Oral-/Capability-Eligibility;
2. `feedingApproach` bestimmt weiterhin die bevorzugte Familie;
3. nur innerhalb der Löffelfamilie wird nach `textureStage` sortiert;
4. kein Modus wird durch die Sortierung neu freigegeben;
5. Fingerfood bleibt unabhängig von der Texturstufe möglich, sofern bereits eligible.

Beispiele:

```text
Contract: smooth, mashed, finger
spoon + Stage 1 -> smooth, mashed, finger
spoon + Stage 2 -> mashed, smooth, finger
fingerfood + Stage 1 -> finger, smooth, mashed
```

Für `mixed` wird ebenfalls nur die relative Reihenfolge vorhandener Löffelmodi angepasst; es entsteht kein neues Auswahlmodell.

## Was ausdrücklich nicht umgesetzt wird

Der frühere größere Vorschlag wird bewusst reduziert.

Nicht Teil des MVP:

- kein neues `textureExperience`-Feld;
- keine neue Frage „Wie hat die Konsistenz geklappt?“;
- keine Komfort-/Learning-Zähler;
- keine neue Darreichungsform-Auswahl im Log;
- keine neue Log-Migration;
- keine dynamische Fingerfood-Empfehlung aus der nächsten Mahlzeit;
- keine zweite Coach-Spur;
- kein neues `trialStage`;
- keine automatische Stufenerhöhung;
- kein fixer Wochenplan;
- keine neue Capability-Ableitung;
- keine neue FOOD-Klassifikation;
- keine neue Storage-Schema-Version;
- keine Änderung von Alters-, Safety-, Planner- oder Mahlzeiteneignungsregeln.

## Umgang mit dem bestehenden Log

Das bestehende Log bleibt im MVP unverändert.

Dass `textureStage` dort derzeit allgemein als Konsistenz dokumentiert wird, wird **nicht** im selben Auftrag neu modelliert. Da der neue Coach keine Fortschrittszähler mehr aus Logs ableitet, entsteht daraus für die vorgeschlagene Progressionshilfe kein falsches Unlock- oder Empfehlungssignal mehr.

Falls sich die Log-Darstellung von Fingerfood später im echten Gebrauch als störend erweist, kann das separat und klein gelöst werden. Es ist keine Voraussetzung für diesen Coach.

## Stufe 3 -> 4

`weiche Familienkost` bleibt breiter als eine reine Löffeltextur.

Im MVP braucht dafür keine neue Speziallogik gebaut zu werden. Die vorhandene Stufe bleibt bestehen; die Copy soll lediglich vermeiden, sie als automatische nächste grobe Konsistenz darzustellen.

Beispiel:

```text
Nächster Schritt:
Zunehmend weiche familiennahe Formen ausprobieren, wenn das konkrete Lebensmittel oder Rezept dafür geeignet ist.
```

Keine neue Rezeptfreigabe und kein neuer Handlingmodus.

## Technische Zielstellen

Voraussichtlich nur:

- `js/ui.js`
  - `textureSuccessCount()` aus dem Coach entfernen;
  - Schwellenlogik `successes >= 4` entfernen;
  - kurze neutrale Next-Step-Copy und Fingerfood-Hinweis ergänzen.
- `js/handling-readiness.js`
  - Reihenfolge bereits geeigneter Löffelmodi an `textureStage` ausrichten.
- gezielte Tests für diese beiden Verhaltensänderungen.

Kein `js/log.js`-Umbau im MVP.
Kein neues Datenfeld.
Keine Migration.

## Akzeptanzkriterien

### Coach

1. Der Home-Coach zeigt keinen angeblichen Texturerfolgszähler mehr.
2. FOOD-Outcomes lösen keine Empfehlung oder Freigabe der nächsten Stufe aus.
3. Die nächste Stufe wird weiterhin nur manuell bestätigt.
4. Vertraute Konsistenzen dürfen laut Copy parallel bleiben.
5. Ein kurzer Hinweis macht sichtbar, dass geeignetes Fingerfood unabhängig von der Löffelstufe parallel möglich ist.
6. Keine zweite Coach-Spur und keine zusätzliche Nutzerentscheidung entstehen.

### Handling

7. `feedingApproach = spoon`, Stage 1 bevorzugt bei Karotte `spoon-smooth` vor `spoon-mashed`.
8. `feedingApproach = spoon`, Stage 2 bevorzugt bei Karotte `spoon-mashed` vor `spoon-smooth`.
9. `feedingApproach = fingerfood`, Stage 1 bevorzugt weiterhin ein bereits geeignetes `finger-graspable`.
10. `spoon-soft-lumpy` bleibt nur dort eligible, wo die bestehende Texturregel es erlaubt.
11. `smallSoftPieces` und `structuredChew` bleiben unverändert harte, unabhängige Capabilities.
12. Rezeptidentität, FOOD-Auswahl, Planner-Rollen und Locks ändern sich durch die Sortierung nicht.

## Testmatrix bei späterer Implementierung

Da zentrale Handling-Logik und Home-UI betroffen wären:

1. gezielte Node-Tests für `preferredHandlingModes` / Löffelreihenfolge;
2. gezielte UI-/Browser-Regression für den Texture Coach;
3. `npm run verify:fast`;
4. `npm run verify:app`;
5. kein `verify:deploy` ohne Deployment-Scope.

## Empfohlener Implementierungsschnitt

Ein einziger kleiner Implementierungsauftrag ist ausreichend:

1. falschen Texturerfolgszähler entfernen;
2. Coach-Copy vereinfachen und Parallelität von Fingerfood erwähnen;
3. Löffelmodus-Reihenfolge an die bestehende Texturstufe anpassen;
4. gezielte Regressionen ausführen.

## Ergebnis

Der Nutzer bekommt genau die Information, die im Alltag gebraucht wird:

- **Wo stehen wir bei der Konsistenz?**
- **Was kann ich als kleinen nächsten Schritt probieren?**
- **Fingerfood darf parallel stattfinden.**

Dafür entstehen keine neuen Log-Fragen, keine neuen Entwicklungswerte und keine zusätzliche Bedienebene.