# AGENTS.md

Gilt für das gesamte PUBLIC-Repository `kovacicjaqueline-lang/chesters-beikost-app-public`.

## Ziel

Arbeite schnell, reproduzierbar und ohne bereits geklärte Fachentscheidungen erneut aufzurollen. Behandle den aktuellen GitHub-Stand als Source of Truth und verwende Chat-/Übergabestände nur als Kontext, nie als Ersatz für die Prüfung des Repositories.

`docs/AI_WORKFLOW.md` ist nach dieser Datei die verpflichtende Kurzreferenz für Workflow, Fast Path und Testmatrix. Bei Widersprüchen gilt `AGENTS.md`.

## Verbindlicher Startcheck

Vor jeder Repository-Arbeit:

1. tatsächlichen aktuellen `main`-HEAD ermitteln und als `BASE_SHA` des Arbeitsstrangs festhalten,
2. aktuelle `AGENTS.md` und `docs/AI_WORKFLOW.md` verwenden,
3. bei lokaler Laufzeit `git status --short --branch` prüfen,
4. vorhandenen Arbeitsbranch der Aufgabe ermitteln oder einen neuen Branch vom aktuellen `main` anlegen,
5. nur die für den Auftrag relevanten Dateien, Fachdocs und Tests lesen.

`VERSION.json` und `package.json` **nicht pauschal** bei jedem Auftrag laden. Beide sind zusätzlich zu lesen, wenn mindestens einer dieser Punkte zutrifft:

- Versionierung, Release-/Teststand oder ZIP-Artefakt ist Teil des Auftrags,
- Abhängigkeiten, npm-Scripts, Node-/Build-/Runtime-Konfiguration oder Deployment können betroffen sein,
- die aktuelle Versionsnummer ist für eine konkrete technische Entscheidung oder das verlangte Ergebnis tatsächlich erforderlich.

Wenn die aktuelle Version benötigt wird, immer `VERSION.json` **und** `package.json` prüfen und ihre Versionsangaben konsistent halten. Nicht allein für eine routinemäßige Abschlussmeldung zusätzliche Dateien laden.

Alte Commit-SHAs oder Versionsnummern aus früheren Chats niemals ungeprüft weiterverwenden.

## Fachdocs nur nach Scope laden

Nicht alle Dokumente vorsorglich lesen. Die aktuelle Aufgabe bestimmt die zusätzlich erforderlichen Fachquellen:

- **Planner, Phasen, automatische Mahlzeiten, Eignung, Rollen, Recipe-first, Readiness oder Neuplanung:** `docs/PLANNER_FACHKONZEPT.md`.
- **Neues kanonisches FOOD oder neues Laufzeitrezept:** zusätzlich den Pflichtcheck in `docs/AI_WORKFLOW.md` und `docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md`; bei Icon-Arbeit außerdem `docs/ICON_GUIDELINES.md`.
- **Handling / Oral Processing:** `docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md`.
- **FOOD-/Recipe-V2-Icons, Mapping oder Precache:** `docs/ICON_GUIDELINES.md`.
- **CI, Testauswahl, Browser-Runner oder Diagnose:** `docs/AI_WORKFLOW.md`.

Ist unklar, ob eine Fachregel betroffen ist, zuerst den naheliegenden Fachdoc prüfen. Diese Scope-Auswahl darf niemals dazu benutzt werden, eine tatsächlich relevante Regelquelle zu überspringen.

## GitHub-Workflow

- Default-Branch: `main`.
- Nicht direkt auf `main` entwickeln.
- Pro unabhängiger Aufgabe einen eigenen Branch verwenden.
- Bestehenden Aufgabenbranch weiterverwenden, wenn die Aufgabe ausdrücklich darauf fortgesetzt wird.
- Sonst kurze sprechende Branch-Namen verwenden, z. B. `fix/...`, `feat/...`, `test/...`, `chore/...`.
- GitHub-Connector/API zuerst verwenden. `gh` ist optional und darf kein notwendiger Bestandteil des Workflows sein.
- Keine Zeit mit wiederholten `gh`-Installationsversuchen verlieren, wenn ein vorgesehener GitHub-Zugriff bereits funktioniert.
- Vor PR/Merge immer Diff und geänderte Dateien prüfen.
- Unabhängige Themen dürfen parallel auf getrennten Branches bearbeitet werden; fremde Branch-Änderungen nicht ungefragt übernehmen.

## Arbeitsweise

Standardablauf:

`Kurzcheck -> Branch -> gezielte Implementierung -> betroffene Tests -> weitere Gates nur laut Testmatrix -> Diff-Selbstprüfung -> Commit -> PR/Merge gemäß Auftrag`

Dabei:

- keine Vollaudits wiederholen, wenn die Aufgabe nur einen klar abgegrenzten Bereich betrifft,
- zuerst gezielt nach Symbolen, IDs, Funktionen und direkt betroffenen Tests suchen,
- bereits fachlich freigegebene Regeln nicht erneut diskutieren oder durch neue Sonderregeln ersetzen,
- keine fachlichen Regeln erfinden, um einen technischen Fehler lokal zu kaschieren,
- gemeinsame Ursachen zentral beheben statt mehrere UI-/Planner-Sonderfälle einzubauen,
- bestehende Daten- und Backup-Kompatibilität erhalten, sofern die Aufgabe nicht ausdrücklich eine Migration verlangt,
- keine Produktivlogik außerhalb des notwendigen Scopes verändern.

### Fast Path und Freigaben

Eine zusätzliche Plan-/Freigabeschleife ist nicht nötig, wenn die fachlichen Entscheidungen bereits getroffen sind und nur klar spezifizierte mechanische Umsetzung offen ist, z. B. freigegebene Assets, Mappings, Precache-Einträge, spezifizierte Regressionstests oder reine CI-/Dokumentationspflege.

Eine fachliche Review-/Freigabeschleife bleibt erforderlich, wenn neue Produktsemantik, neue Sicherheits-/Eignungsregeln, neue Planner-Logik, eine Migration oder eine noch nicht entschiedene Darstellung eingeführt werden soll.

Technisch gleichartige, bereits einzeln fachlich freigegebene Änderungen dürfen gemeinsam umgesetzt und getestet werden. Aus einer Einzelentscheidung darf dabei keine fachliche Gruppenfreigabe abgeleitet werden.

## Tests

Die aktuelle Testmatrix in `docs/AI_WORKFLOW.md` ist für die Testauswahl verbindlich. Insbesondere:

- zuerst den direkt betroffenen Test bzw. kleinsten passenden Gate ausführen,
- zusätzliche Gates nur ausführen, wenn die Testmatrix oder der konkrete Scope sie verlangt,
- `npm run verify` nicht reflexartig als Standard nach jeder kleinen Änderung verwenden,
- vorhandene GitHub-Actions-Ergebnisse vor Merge prüfen, wenn für den Scope CI ausgelöst wurde,
- nie behaupten, ein Test sei bestanden, wenn er nicht tatsächlich ausgeführt bzw. als tatsächliches CI-Ergebnis geprüft wurde,
- bei rotem CI nach `docs/AI_WORKFLOW.md` **Evidence first, fix second** vorgehen; kein blindes Rerun oder spekulatives Reparieren,
- bei reinen Dokumentationsänderungen ohne Code-/Konfigurationswirkung keine künstlichen Regressionstests erzeugen.

## Versionsregeln

Diese Regeln gelten, sobald Versionierung für den Auftrag relevant ist:

- aktuelle Version aus `VERSION.json` und `package.json` ermitteln,
- beide Versionsangaben konsistent halten,
- keine Versionsnummer aus einem alten Chat übernehmen,
- Versionssprünge nicht erfinden; nur im Rahmen des bestehenden Release-/Teststand-Workflows ändern,
- ZIP-Dateinamen müssen mit der Versionsnummer enden, z. B. `Chesters_Beikost_App_<BESCHREIBUNG>_10.1.24.zip`; nach der Versionsnummer kein Zusatz.

## Harte fachliche Invarianten

Die Details stehen in den oben gerouteten Fachdocs; folgende Leitplanken gelten unabhängig davon:

- Die Beikostphase steuert die automatisch geplanten Mahlzeitenslots; Mengenorientierung und Konsistenz sind getrennte Dimensionen. Ein tatsächlicher Phasenwechsel bleibt eine bewusste Nutzeraktion.
- Mahlzeiteneignung ist vor Kombination und Scoring ein harter Gate. `autoPlan`, `minPhase` und `minAgeMonths` gehören ebenfalls zur allgemeinen automatischen FOOD-Eignung.
- Custom-Lebensmittel müssen fachlich dieselbe Mahlzeiteneignung wie reguläre Lebensmittel ihrer Kategorie erhalten.
- Automatische Snacks bleiben grundsätzlich rezeptgetrieben; in Familienkost darf zusätzlich bereits bekanntes, geeignetes Obst als eng begrenzter Einzel-Snack geplant werden. Daraus kein allgemeines `FOOD.meals = snack`-Modell ableiten.
- Einen Eignungsfehler nicht durch neue Pairing-/Kombinations-Sonderregeln kaschieren, wenn die Primärursache in den Eingangsdaten oder Gates liegt.
- Ein neues kanonisches FOOD bzw. Laufzeitrezept ist erst vollständig, wenn die im Pflichtcheck von `docs/AI_WORKFLOW.md` geforderten Stammdaten, Handling-/Oral-Einordnung, erforderliche Serving-/Safety-Guidance, V2-Icon-Zuordnung/Precache und Regressionen vollständig sind.
- Die bestehende Semantik von `Neu planen` gegenüber `Sichtbare Woche vollständig neu planen` nicht nebenbei neu definieren; bei Änderungen zuerst tatsächlichen Code, Tests und `docs/PLANNER_FACHKONZEPT.md` prüfen.
- Lebensmittel-, Rezept-, Planner-, Persistenz- und Icon/Asset-Pfade bei Datensatzänderungen konsistent halten.

## Scope- und Abschlussregeln

Vor Abschluss einer Aufgabe knapp dokumentieren:

- Ausgangs-`main`/`BASE_SHA`; Version nur, wenn sie für den Auftrag relevant war,
- Arbeitsbranch,
- tatsächlich geänderte Dateien,
- tatsächlich ausgeführte Tests/CI-Ergebnisse,
- verbleibende offene Punkte oder Abhängigkeiten,
- Commit-SHA und PR-/Merge-Status.

Keine nicht ausgeführten Schritte als erledigt darstellen.
