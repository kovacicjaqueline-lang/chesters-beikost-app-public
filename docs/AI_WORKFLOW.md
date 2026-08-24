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

## FOOD-/Recipe-V2: Bildgenerierung ist ein eigener Pflichtschritt

Wenn ein Auftrag ein Icon bzw. eine Illustration **erstellen, generieren, neu generieren, neu zeichnen oder visuell ersetzen** soll, muss der sichtbare Bildinhalt mit der vorgesehenen Bild-KI / Image-Generation-Funktion erzeugt werden. Das bloße Auslesen, Extrahieren, Dekodieren, Skalieren oder Umverpacken eines vorhandenen Repository-Assets ist keine neue Bildgenerierung und darf nicht als solche bezeichnet werden.

Bei ChatGPT-Arbeit gilt insbesondere: Ist ein Image-Generation-Tool verfügbar, muss es für die eigentliche visuelle Erzeugung verwendet werden. Ein per Code, SVG-Pfad, CSS, Emoji, Icon-Library oder durch Kopieren eines bestehenden Assets erzeugter Ersatz ist nicht zulässig, wenn Bildgenerierung beauftragt wurde.

Wenn die Nutzerin das **generierte Icon sehen** möchte, ist das tatsächliche Ergebnis des Image-Generation-Schritts zu zeigen – nicht ersatzweise ein vorhandenes Repository-Asset. Technische Asset-Integration in SVG/128×128, Mapping und Precache erfolgt erst danach, sofern sie zum Scope gehört.

Der vollständige operative Ablauf und die Abgrenzung zu reinem Audit bzw. technischer Asset-Arbeit stehen in `docs/AI_ICON_GENERATION_WORKFLOW.md`. Die fachlichen Stil- und Motivregeln bleiben in `docs/ICON_GUIDELINES.md` verbindlich.

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
