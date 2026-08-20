# AGENTS.md

Gilt für das gesamte Repository `kovacicjaqueline-lang/chesters-beikost-app-public`.

## Ziel

Arbeite schnell, reproduzierbar und ohne bereits geklärte Fachentscheidungen erneut aufzurollen. Behandle den aktuellen GitHub-Stand als Source of Truth und verwende Chat-/Übergabestände nur als Kontext, nie als Ersatz für die Prüfung des Repositories.

Für kurze wiederkehrende Aufträge und die Testmatrix siehe ergänzend `docs/AI_WORKFLOW.md`. Bei Widersprüchen gilt `AGENTS.md`.

## Verbindlicher Startcheck

Vor jeder Implementierung:

1. aktuellen `main`-HEAD ermitteln,
2. `VERSION.json` und `package.json` lesen,
3. bei lokaler Laufzeit `git status --short --branch` prüfen,
4. vorhandenen Arbeitsbranch der Aufgabe ermitteln oder einen neuen Branch vom aktuellen `main` anlegen,
5. nur die für die Aufgabe relevanten Dateien und Tests lesen.

Alte Commit-SHAs oder Versionsnummern aus früheren Chats niemals ungeprüft weiterverwenden.

## GitHub-Workflow

- Default-Branch: `main`.
- Nicht direkt auf `main` entwickeln.
- Pro unabhängiger Aufgabe einen eigenen Branch verwenden.
- Bestehenden Aufgabenbranch weiterverwenden, wenn die Aufgabe ausdrücklich darauf fortgesetzt wird.
- Sonst kurze sprechende Branch-Namen verwenden, z. B. `fix/...`, `feat/...`, `test/...`, `chore/...`.
- GitHub-Connector/API zuerst verwenden. `gh` ist optional und darf kein notwendiger Bestandteil des Workflows sein.
- Keine Zeit mit wiederholten `gh`-Installationsversuchen verlieren, wenn die Laufzeit keinen funktionierenden externen Netzwerkzugriff hat.
- Vor PR/Merge immer Diff und geänderte Dateien prüfen.
- Unabhängige Themen dürfen parallel auf getrennten Branches bearbeitet werden.

## Arbeitsweise

Standardablauf:

`Kurzcheck -> Branch -> gezielte Implementierung -> betroffene Tests -> vollständige Regression falls nötig -> Diff-Selbstprüfung -> Commit -> PR/Merge gemäß Auftrag`

Dabei:

- keine Vollaudits wiederholen, wenn die Aufgabe nur einen klar abgegrenzten Bereich betrifft,
- zuerst gezielt nach Symbolen, IDs, Funktionen und Tests suchen,
- bereits fachlich freigegebene Regeln nicht erneut diskutieren oder durch neue Sonderregeln ersetzen,
- keine fachlichen Regeln erfinden, um einen technischen Fehler lokal zu kaschieren,
- gemeinsame Ursachen zentral beheben statt mehrere UI-/Planner-Sonderfälle einzubauen,
- bestehende Daten- und Backup-Kompatibilität erhalten, sofern die Aufgabe nicht ausdrücklich eine Migration verlangt,
- keine Produktivlogik außerhalb des notwendigen Scopes verändern.

### Fast Path und Freigaben

Eine zusätzliche Plan-/Freigabeschleife ist nicht nötig, wenn die fachlichen Entscheidungen bereits getroffen sind und die Aufgabe nur klar spezifizierte mechanische Umsetzung enthält, z. B. freigegebene Assets, Mappings, Precache-Einträge, spezifizierte Regressionstests oder reine CI-/Dokumentationspflege.

Eine fachliche Review-/Freigabeschleife bleibt erforderlich, wenn neue Produktsemantik, neue Sicherheits-/Eignungsregeln, neue Planner-Logik, eine Migration oder eine noch nicht entschiedene Darstellung eingeführt werden soll.

Technisch gleichartige, bereits einzeln fachlich freigegebene Änderungen dürfen in einem gemeinsamen Arbeitsbranch umgesetzt und gemeinsam getestet werden. Aus einer Einzelentscheidung darf dabei keine fachliche Gruppenfreigabe abgeleitet werden.

## Tests

Offizieller Regressionstest:

```bash
npm test
```

Er läuft mit Node.js 22 und führt die vorhandenen Node-Testdateien unter `tests/` aus.

Schnelle Standardkommandos:

- `npm run verify:icons` für FOOD-/Recipe-Icon-Assets, Mappings und V2-Precache,
- `npm run verify:fast` für die vollständige Node-Regression,
- `npm run verify:app` für Node- plus Browser-Regression,
- `npm run verify:deploy` für beide Wrangler-Dry-Runs,
- `npm run verify` als vollständiger lokaler Gate aus App- und Deployment-Prüfung.

Prüfreihenfolge:

1. zuerst die direkt betroffenen Tests bzw. den passenden schnellen Bereichs-Gate,
2. danach `npm run verify:fast`, wenn Produktivlogik, Planner, Datenmodell, Persistenz oder zentrale Utilities verändert wurden,
3. `npm run verify:app`, wenn ein Browser-/UI-Fluss betroffen ist,
4. `npm run verify:deploy`, wenn Deployment-/Wrangler-relevante Dateien verändert wurden,
5. `npm run verify` nur als Querschnitts-/Release-Gate oder wenn der Änderungsumfang mehrere Bereiche betrifft,
6. vorhandene GitHub-Actions-Ergebnisse vor Merge prüfen, wenn CI ausgelöst wurde.

Nie behaupten, ein Test sei bestanden, wenn er nicht tatsächlich ausgeführt bzw. als CI-Ergebnis geprüft wurde.

Bei reinen Dokumentationsänderungen ohne Code-/Konfigurationswirkung sind keine künstlichen Regressionstests erforderlich.

## Versionsregeln

- Aktuelle Version immer aus `VERSION.json` und `package.json` ermitteln.
- Beide Versionsangaben müssen konsistent bleiben.
- Keine Versionsnummer aus einem alten Chat übernehmen.
- Versionssprünge nicht erfinden; nur im Rahmen des jeweiligen Auftrags bzw. des bestehenden Release-/Teststand-Workflows ändern.
- Wenn ein ZIP-Artefakt erstellt wird, muss der Dateiname mit der Versionsnummer enden, z. B. `Chesters_Beikost_App_<BESCHREIBUNG>_10.1.24.zip`; nach der Versionsnummer kein Zusatz.

## Fachliche Grundregeln der Beikost-App

### Phasenmodell

Das freigegebene Phasenmodell besteht aus vier entwicklungsorientierten Phasen:

1. **Kennenlernen:** automatische Planung für Mittagessen.
2. **Mahlzeitenaufbau:** automatische Planung für Frühstück und Mittagessen.
3. **Drei Hauptmahlzeiten:** Frühstück, Mittagessen und Abendessen; Snacks manuell möglich.
4. **Familienkost:** drei Hauptmahlzeiten plus ein automatisch geplanter Snack.

Phasenübergänge sind entwicklungsorientiert und werden einmalig durch die Nutzerin bestätigt. Mengenorientierung und Konsistenz sind davon getrennte Dimensionen.

### Planner und Lebensmittel-Eignung

- Mahlzeiteneignung ist eine harte Eingangsvoraussetzung vor Kombination und Scoring.
- Für Frühstück, Mittagessen und Abendessen darf ein Lebensmittel nur automatisch verwendet werden, wenn seine bestehende `meals`-Klassifikation die Mahlzeit erlaubt.
- Custom-Lebensmittel müssen fachlich dieselbe Mahlzeiteneignung wie reguläre Lebensmittel ihrer Kategorie erhalten.
- `autoPlan`, `minPhase` und `minAgeMonths` gehören zur allgemeinen automatischen FOOD-Eignung und greifen vor der Planner-Auswahl.
- Snack bleibt rezeptgetrieben; kein allgemeines neues `FOOD.meals`-Snack-Sondermodell erfinden, solange dies nicht ausdrücklich fachlich freigegeben wird.
- Fehler wie eine unpassende Frühstückskombination nicht durch neue Kombinations-Sonderregeln kaschieren, wenn die Primärursache in der Lebensmittel-Eignung liegt.

### Bestehende Semantik bewahren

- Die Semantik von `Neu planen` gegenüber `Sichtbare Woche vollständig neu planen` nicht neu definieren. Vor Änderungen die tatsächlich implementierte Semantik im Code und in Tests feststellen.
- Bereits umgesetzte UI-Fixes nur regressiv absichern, sofern die Aufgabe sie nicht ausdrücklich wieder öffnet.
- Lebensmittel-, Rezept-, Planner-, Persistenz- und Icon/Asset-Pfade bei Datensatzänderungen konsistent halten.

## Scope- und Abschlussregeln

Vor Abschluss einer Aufgabe kurz dokumentieren:

- Ausgangs-HEAD/Version,
- Arbeitsbranch,
- tatsächlich geänderte Dateien,
- ausgeführte Tests und deren Ergebnis,
- verbleibende offene Punkte,
- Commit/PR/Merge-Status.

Keine nicht ausgeführten Schritte als erledigt darstellen.
