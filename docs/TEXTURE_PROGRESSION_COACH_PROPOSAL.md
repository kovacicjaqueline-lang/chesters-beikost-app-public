# Texture Progression Coach – freigegebener MVP

Stand: 2026-08-21  
Status: auf `docs/texture-progression-coach-proposal` implementiert, Draft-PR #38  
Ausgangsbasis: `main` `6376520be9993c0f1960b80411c8cf1de4119ad4`, Version `10.1.26`

## Ziel

Die App begleitet die Entwicklung der Löffeltextur, ohne eine neue Entwicklungslogik oder zusätzliche tägliche Eingaben einzuführen.

Bestehende Dimensionen bleiben getrennt:

- `textureStage`: aktuelle Konsistenz-/Löffeltextur;
- Handlingmodus: konkrete Darreichungsform;
- `feedingApproach`: Präferenz für Löffel / Fingerfood / gemischt;
- `smallSoftPieces` und `structuredChew`: beobachtete Fähigkeiten;
- Safety-, Alters-, Zutaten- und Planner-Gates: unverändert.

Fingerfood bleibt ein paralleler Weg und wird nicht zur späteren Texturstufe.

## Implementierter MVP

### 1. Keine FOOD-basierte Bereitschaftsampel mehr

Der sichtbare Texture Coach verwendet nicht mehr den bisherigen FOOD-basierten Texturerfolgszähler und keinen Schwellwert `successes >= 4`.

Es gibt keinen Ersatz-Zähler und kein neues Trackingfeld.

Der Coach zeigt stattdessen nur:

- die aktuelle Stufe;
- einen kleinen nächsten Testschritt;
- die bestehenden manuellen Aktionen `Zurück` und `Stufe X testen`.

Beispiele:

- Stufe 1: kleine Menge etwas dicker oder weich zerdrückt anbieten;
- Stufe 2: bei einer passenden Mahlzeit kleine weiche Stückchen testen;
- Stufe 3: zunehmend weiche familiennahe Formen ausprobieren, wenn FOOD/Rezept dafür geeignet ist;
- Stufe 4: geeignete weiche familiennahe Formen weiter variieren.

Die App erhöht `textureStage` nie automatisch.

### 2. Fingerfood wird in derselben Karte als parallel erklärt

Die bestehende Konsistenzkarte bleibt eine einzelne Karte.

Zusätzlicher Hinweis:

> Geeignetes weiches Fingerfood kann unabhängig von dieser Konsistenzstufe parallel angeboten werden. Die sichere Form richtet sich nach dem jeweiligen Lebensmittel oder Rezept.

Es gibt:

- keine zweite Fortschrittsspur;
- keine dynamische Suche nach einer nächsten Fingerfood-Mahlzeit;
- keine neue Nutzerentscheidung.

Die bestehende Handling-/Safety-Eligibility bleibt maßgeblich.

### 3. Bereits geeignete Löffelmodi passen zur `textureStage`

Die Eligibility wird nicht verändert. Nur die Reihenfolge bereits geeigneter Löffelmodi wird angepasst:

| `textureStage` | bevorzugte Löffelmodi |
| --- | --- |
| 1 | `spoon-smooth` -> `spoon-mashed` |
| 2 | `spoon-mashed` -> `spoon-smooth` |
| 3 | `spoon-soft-lumpy` -> `spoon-mashed` -> `spoon-smooth` |
| 4 | `spoon-soft-lumpy` -> `spoon-mashed` -> `spoon-smooth` |

Regeln:

1. bestehende Handling-/Oral-/Capability-Eligibility zuerst;
2. `feedingApproach` bestimmt weiterhin die bevorzugte Familie;
3. nur vorhandene Löffelmodi werden nach `textureStage` umsortiert;
4. kein Modus wird neu freigegeben;
5. Fingerfood bleibt parallel, sofern bereits eligible.

Beispiel Karotte:

- `spoon` + Stage 1 -> `spoon-smooth` zuerst;
- `spoon` + Stage 2 -> `spoon-mashed` zuerst;
- `fingerfood` + Stage 1 -> `finger-graspable` bleibt zuerst.

## Technische Umsetzung

Produktiv geändert wird zentral `js/handling-readiness.js`:

- `spoonModePreference()` und `sortSpoonModesByTexture()` ordnen nur bereits eligible Löffelmodi;
- `preferredHandlingModes()` erhält `textureStage` als reine Sortierinformation;
- `installTextureCoachRuntime()` installiert vor dem finalen sichtbaren `renderAll()` die vereinfachte einzelne Coach-Darstellung.

Die vorhandene Planner-Policy-Ladekette installiert `handling-readiness.js`, bevor die App nach dem initial versteckten Render sichtbar wird. Dadurch wird keine zusätzliche UI-Datei oder zweite persistente Coach-Architektur benötigt.

## Bewusst nicht umgesetzt

- kein `textureExperience`;
- keine neue Log-Frage;
- keine Darreichungsform-Auswahl im Log;
- keine Log-Migration;
- kein neues `trialStage`;
- keine automatische Stufenerhöhung;
- kein fixer Wochenplan;
- keine neue Capability-Ableitung;
- keine neue FOOD-/Recipe-Klassifikation;
- keine neue Storage-Schema-Version;
- keine Änderung von `js/log.js`;
- keine Änderung der Planner-Kandidatenlogik;
- keine Änderung von Alters-, Safety- oder Mahlzeiteneignungsregeln.

## Regressionen

Abgedeckt werden mindestens:

1. Stage 1 + `spoon` bevorzugt bei Karotte `spoon-smooth`;
2. Stage 2 + `spoon` bevorzugt bei Karotte `spoon-mashed`;
3. eine neue Auto-Mahlzeit erhält bei Stage 2 entsprechend `presentationMode = spoon-mashed`;
4. `fingerfood` bleibt bei Stage 1 parallel bevorzugbar;
5. Eligibility-Listen bleiben durch die Sortierung unverändert;
6. `spoon-soft-lumpy` bleibt an die bestehende Texturregel gebunden;
7. `smallSoftPieces` und `structuredChew` bleiben unabhängige harte Capabilities;
8. der sichtbare Coach zeigt keinen FOOD-basierten Erfolgszähler und kein `Test möglich`;
9. der sichtbare Coach zeigt den kleinen nächsten Schritt und den parallelen Fingerfood-Hinweis.

## Testmatrix

Für die Implementierung gelten gemäß `AGENTS.md` / `docs/AI_WORKFLOW.md`:

- gezielte Node-Regressionen;
- gezielte Browser-Regression für den Coach;
- `npm run verify:fast`;
- `npm run verify:app`;
- kein Deployment-Gate ohne Deployment-Scope.
