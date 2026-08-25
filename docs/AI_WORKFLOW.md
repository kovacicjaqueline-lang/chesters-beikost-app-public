# AI-Workflow für Chesters Beikost-App

Diese Datei ist die kurze Arbeitsreferenz für wiederkehrende Chat-/Coding-Aufträge. Die verbindlichen Regeln stehen in `AGENTS.md`; bei Widersprüchen gilt immer `AGENTS.md`.

## Minimaler Starttext

Für einen neuen technischen Auftrag reichen normalerweise:

```text
Arbeite ausschließlich im PUBLIC-Repository kovacicjaqueline-lang/chesters-beikost-app-public.
Prüfe zuerst den tatsächlichen aktuellen Remote-main.
Arbeitsbranch: <branch>

Ziel: <konkretes Ergebnis>
Scope: <betroffene Dateien/Funktionen/Daten>
Bereits fachlich freigegeben: <ja/nein + Entscheidungen>
Nicht ändern: <wichtige Grenzen>
Nichts mergen.
```

Alte Versionen, Commit-SHAs, vollständige Projektchroniken oder bereits in `AGENTS.md` dokumentierte Grundregeln müssen nicht in jeden neuen Chat kopiert werden. Der aktuelle Repository-Stand bleibt Source of Truth.

## Wann direkt umgesetzt werden kann

Direkt nach dem Startcheck umsetzen, wenn die fachliche Entscheidung schon feststeht und nur mechanische Arbeit offen ist, zum Beispiel:

- freigegebene Assets einbauen,
- vorhandene Mappings/Precache-Einträge ergänzen,
- einen klar beschriebenen UI-Fix umsetzen,
- spezifizierte Regressionstests ergänzen,
- CI-, Workflow- oder Dokumentationspflege ohne Produktsemantik.

Eine erneute fachliche Freigabe ist nötig, wenn neue Produktsemantik, Sicherheits-/Eignungsregeln, Planner-Logik, Migrationen oder noch offene Darstellungsentscheidungen entstehen.

## Neue FOODs und Rezepte: Pflichtcheck

Bei jedem neuen kanonischen FOOD oder neuen Laufzeitrezept gehört die Vollständigkeitsprüfung zum selben Auftrag. Vor Abschluss müssen mindestens gemeinsam vorhanden sein:

- vollständige fachliche Stammdaten und Safety-/Zubereitungsangaben;
- individuelle Handling-Einordnung;
- explizite Oral-Processing-Einordnung und nur bei tatsächlichem Bedarf eine zusätzliche Capability;
- bei Rezepten die kanonische Servierform und erforderliche Serving-Guidance;
- eigenes Food-V2- bzw. Recipe-V2-Icon;
- zentrales Icon-Mapping und erforderlicher Precache;
- passende Regressionen für Contract-/Katalogvollständigkeit und `npm run verify:icons` bei Icon-Änderungen.

Ein neuer Datensatz mit Kategorie-/Generic-/Legacy-Iconfallback oder ein neues Rezept im Legacy-Stage-Fallback ist **nicht fertig**. Für bestehende Legacy-FOODs gilt diese Vorwärtsregel nicht als automatische Gruppenmigration; sie müssen weiterhin einzeln fachlich geprüft werden.

Die verbindlichen Details stehen in `AGENTS.md`, `docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md` und `docs/ICON_GUIDELINES.md`.

## Testmatrix

| Änderung | Standardprüfung |
| --- | --- |
| Nur Dokumentation | keine künstliche Regression |
| FOOD-/Recipe-V2-Icons, Mapping, Precache | `npm run verify:icons` |
| Datenmodell, Planner, Persistenz, zentrale Utilities | betroffene Tests + `npm run verify:fast` |
| UI-/Browser-Fluss | betroffene Tests + `npm run verify:app` |
| Wrangler-/Deployment-Konfiguration | `npm run verify:deploy` |
| Querschnitt, Release oder mehrere Bereiche | `npm run verify` |

`npm run verify` ist bewusst kein Standard nach jeder kleinen Änderung. Es ist der vollständige Gate, wenn der Scope mehrere Bereiche berührt oder ein Abschluss-/Releasecheck gebraucht wird.

## CI rot: Diagnose- und Reparaturweg

Wenn ein GitHub-Actions-Lauf rot wird, nicht pauschal rerunnen und nicht aus der letzten Warnung im Log auf die Ursache schließen.

Standardweg:

1. den tatsächlich fehlgeschlagenen Workflow und Job bestimmen,
2. das vollständige Log dieses Jobs lesen,
3. den **ersten tatsächlichen Fehler** identifizieren und von bloßen Warnungen trennen,
4. den Fehler klassifizieren:
   - **Test-/Produktfehler** wie Assertion, Locator-Timeout, Exception oder reproduzierbarer Testabbruch: gezielt Code, Test oder Fixture beheben; ein bloßer Rerun ist keine Reparatur,
   - **Infrastrukturfehler** vor oder unabhängig von der Testausführung, z. B. Runner-/Checkout-/GitHub-5xx-/transienter Netzwerkfehler: ein Rerun des betroffenen Jobs bzw. Laufs kann sinnvoll sein,
5. nur den zum Fehler passenden minimalen Fix innerhalb des beauftragten Scopes umsetzen,
6. nach Push den **neuen tatsächlichen CI-Lauf** prüfen,
7. bleibt CI rot, wieder beim neu fehlgeschlagenen Job und dessen aktuellem ersten Fehler beginnen.

Für die Diagnose bevorzugt den GitHub-Connector/API-Weg verwenden: Workflow-Run -> Jobs -> fehlgeschlagener Job -> vollständiges Joblog. `gh` ist dafür nicht erforderlich.

Wichtig: Ein grüner schneller Teiltest oder eine große Zahl bereits grüner Node-Tests ersetzt den laut Testmatrix erforderlichen Browser-/App-/Deploy-Gate nicht. Ebenso darf ein Fix nicht als erfolgreich gelten, solange der danach ausgelöste relevante CI-Lauf nicht tatsächlich grün geprüft wurde.

## Bündelung gleichartiger Aufgaben

Mehrere technisch gleichartige Änderungen dürfen gemeinsam umgesetzt werden, wenn jede fachliche Einzelentscheidung bereits vorliegt. Beispiel: mehrere einzeln freigegebene FOOD-Icons können in einem Branch ergänzt und mit einem gemeinsamen Icon-Integrity-Gate geprüft werden.

Dabei gilt weiterhin: Eine Freigabe für ein Element ist keine automatische fachliche Freigabe für andere Elemente.

## Abschlussformat

Am Ende knapp festhalten:

```text
Ausgangs-HEAD/Version: ...
Branch: ...
Geändert: ...
Tests: ...
Offen: ...
Commit/PR/Merge: ...
```
