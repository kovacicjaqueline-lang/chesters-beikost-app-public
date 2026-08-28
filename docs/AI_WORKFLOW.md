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
| Browser-Test-/CI-Infrastruktur | betroffener Runner-/Workflow-Test + `npm run verify:app` |
| Wrangler-/Deployment-Konfiguration | `npm run verify:deploy` |
| Querschnitt, Release oder mehrere Bereiche | `npm run verify` |

`npm run verify` ist bewusst kein Standard nach jeder kleinen Änderung. Es ist der vollständige Gate, wenn der Scope mehrere Bereiche berührt oder ein Abschluss-/Releasecheck gebraucht wird.

Der GitHub-App-Workflow spiegelt diese Matrix konservativ: nur eine explizite Fast-only-Allowlist aus reinen Planner-, Daten-, Persistenz-, Utility- und Node-Testpfaden darf auf `npm run verify:fast` enden. Sobald irgendein app-relevanter geänderter Pfad nicht eindeutig auf dieser Allowlist steht, läuft weiterhin `npm run verify:app`. Die Klassifikation liegt in `scripts/ci-app-scope.mjs` und ist absichtlich fail-closed; neue, gemischte oder UI-nahe Dateien werden nie allein anhand eines Namensmusters automatisch als fast-only eingestuft.

## CI rot vermeiden: Pre-Push- und Integrationscheck

CI soll möglichst die bereits geprüfte Änderung bestätigen und nicht der erste Ort sein, an dem ein deterministischer Featurefehler entdeckt wird.

Vor jedem Push mit Code-, Test-, Workflow- oder Konfigurationsänderungen:

1. den **direkt betroffenen Test** bzw. den kleinsten passenden Bereichs-Gate tatsächlich ausführen und grün prüfen, sofern die Arbeitsumgebung die Ausführung zulässt,
2. danach nur die laut Testmatrix zusätzlich erforderlichen Gates ausführen,
3. einen verfügbaren lokalen Zieltest nicht mit „CI wird es prüfen“ überspringen,
4. wenn die lokale Ausführung technisch nicht möglich ist, das ausdrücklich dokumentieren und den dadurch erstmals ausführenden CI-Lauf direkt nach dem Push tatsächlich prüfen.

### Repository-Schreibschutz ab Finalisierung

Repository-Inhalt und PR-Metadaten sind getrennte Arbeitsphasen.

- **Implementierungs-/Reparaturphase:** Datei-, Commit- und Branch-Schreibzugriffe sind nur für den ausdrücklich beauftragten Scope erlaubt.
- **Finalisierungsphase:** Sobald der finale inhaltliche Commit steht und nur noch Diff-/CI-Prüfung, `Draft -> Ready`, Labels, Reviewstatus oder Merge-Vorbereitung anstehen, gilt ein **Repository-Write-Lock**.
- In dieser Finalisierungsphase dürfen keine Datei-/Blob-/Tree-/Commit-/Branch-Ref-Schreibaktionen ausgelöst werden. Insbesondere darf eine reine PR-Metadatenaktion niemals über `create_file`, `update_file`, `delete_file`, Blob-/Tree-/Commit-Erzeugung oder Ref-Änderungen umgesetzt werden.
- Wird nach Beginn der Finalisierungsphase ein echter inhaltlicher Fix notwendig, die Finalisierungsphase ausdrücklich verlassen, den Fix als neue Implementierungs-/Reparaturphase behandeln, gezielt testen und erst danach wieder finalisieren.
- Ein fortgeschrittener `main`, ein Wechsel von Draft auf Ready oder das erneute Prüfen eines CI-Status ist **für sich allein niemals ein Grund für einen Repository-Schreibzugriff oder einen neuen CI-Lauf**.

### Pre-Push-Sanity für lokale Git-Arbeit

Vor einem tatsächlichen Push aus einer lokalen Git-Arbeitskopie den Branch-Diff gegen den beim Start festgehaltenen `BASE_SHA` technisch prüfen:

```bash
npm run check:prepush -- --base "$BASE_SHA" \
  --allow docs/AI_WORKFLOW.md \
  --allow scripts/pre-push-sanity.mjs
```

Der Check blockiert standardmäßig:

- einen nicht sauberen Arbeitsbaum inklusive untracked Dateien,
- geänderte Dateien außerhalb einer mit `--allow <pfad>` bzw. `--allow-prefix <präfix>` angegebenen erwarteten Scope-Menge,
- geänderte 0-Byte-Dateien, sofern sie nicht ausnahmsweise mit `--allow-empty <pfad>` ausdrücklich erlaubt wurden.

Wenn der erwartete Dateisatz bereits klar bestimmbar ist, `--allow`/`--allow-prefix` verwenden. Ohne Allow-Angaben prüft das Skript weiterhin Arbeitsbaum und 0-Byte-Dateien, kann aber naturgemäß keine fachlich unerwarteten Diff-Dateien erkennen. `--allow-empty` ist nur für absichtlich leere Dateien vorgesehen und darf nicht pauschal gesetzt werden.

Der lokale Sanity-Check ist **kein Ersatz** für die Phasentrennung bei Connector-/API-Arbeit: Ein direkter GitHub-Dateischreibzugriff passiert bereits remote und kann deshalb nicht nachträglich von einem lokalen Pre-Push-Hook verhindert werden. Vor jedem Connector-/API-Content-Write muss daher feststehen, dass sich der Auftrag noch in der Implementierungs-/Reparaturphase befindet und der Zielpfad zum erwarteten Scope gehört.

Den beim Start geprüften `main`-HEAD als **BASE_SHA** des Arbeitsstrangs festhalten. Während der normalen Umsetzung ist kein wiederholtes Aktualisieren gegen einen zwischenzeitlich fortgeschrittenen `main` erforderlich.

Vor finalem Review bzw. vor einer Merge-Freigabe genau einmal den aktuellen Integrationsstand prüfen:

1. den tatsächlichen aktuellen `main` ermitteln,
2. die Änderungen zwischen `BASE_SHA` und aktuellem `main` auf **Relevanz für den Arbeitsbranch** prüfen,
3. **keine relevante Überschneidung:** den Arbeitsbranch nicht allein wegen eines fortgeschrittenen `main` aktualisieren und bereits bestandene Gates nicht allein deshalb erneut ausführen; ein konfliktfrei mergebarer Branch kann auf seinem geprüften Stand bleiben,
4. **relevante Überschneidung oder Merge-Konflikt:** den Arbeitsbranch auf den notwendigen aktuellen Integrationsstand bringen und danach nur die durch diese Integration betroffenen Tests bzw. die laut Testmatrix erforderlichen Gates erneut ausführen.

Als relevante Überschneidung gelten insbesondere Änderungen an denselben Dateien oder Funktionen, denselben fachlichen Verträgen, gemeinsam verwendeten zentralen Utilities oder der für den Branch relevanten Test-/Runner-Infrastruktur. Ein Full-Gate wird durch einen fortgeschrittenen `main` nicht automatisch erforderlich; dafür gilt weiterhin ausschließlich die Testmatrix.

**Ein fortgeschrittener `main` allein ist kein Grund für Branch-Update, Rebase/Merge oder Wiederholung bereits bestandener Tests.**

Für Browserregressionen gilt zusätzlich:

- den direkt betroffenen Browserfall bei Bedarf gezielt mit `node browser-tests/<datei>-webkit.test.mjs` ausführen,
- feste Zeit-Waits wie `waitForTimeout(...)` nicht als Standard-Stabilisierung verwenden; auf einen fachlich/technisch beobachtbaren Zustand, Locator oder Event warten,
- `npm run test:browser` führt bewusst **alle** WebKit-Regressionsskripte aus, sammelt mehrere Fehler in einem Lauf und liefert erst am Ende einen Fehlerstatus,
- der Browser-Runner führt standardmäßig höchstens **zwei** Regressionsskripte gleichzeitig aus; für Diagnose oder knappe Laufzeitressourcen kann mit `BROWSER_TEST_CONCURRENCY=1 npm run test:browser` explizit seriell ausgeführt werden,
- der Browser-Runner schreibt `artifacts/browser-tests/summary.json`, `summary.md` und pro Test ein `output.log`; bei einem roten App-Workflow werden diese Diagnoseartefakte aus CI hochgeladen.

## CI rot: Diagnose- und Reparaturweg

Sobald ein für den Auftrag relevanter lokaler Test oder GitHub-Actions-Lauf rot ist, gilt **Diagnosemodus**. Grundregel: **Evidence first, fix second. Bis die Fehler-Evidenz gesichert ist, keine Codeänderung.**

Vor dem ersten Fix immer:

1. fehlgeschlagenen Test bzw. Workflow-Run und Job eindeutig bestimmen,
2. bei CI das **vollständige Joblog** holen,
3. den **ersten tatsächlichen Fehler** identifizieren und Warnungen bzw. Folgefehler davon trennen,
4. ein kompaktes **Failure Packet** festhalten,
5. die Ursache zunächst mit dem kleinstmöglichen passenden Test oder Prüfschritt reproduzieren bzw. eingrenzen.

Failure Packet:

```text
SHA: <Commit/Head>
Run/Job/Test: <eindeutige Identifikation>
Erster echter Fehler: <Fehlersignatur>
Log-Evidenz: <kleinster aussagekräftiger Ausschnitt>
Ursachenklasse: <Produkt/Test | Infrastruktur/Umgebung | unbekannt>
Hypothese: <eine konkrete Hypothese>
Nächster Prüfschritt: <kleinstmöglicher evidenzbildender Schritt>
```

Danach gilt:

1. nur den durch die aktuelle Evidenz gestützten **kleinstmöglichen Fix** innerhalb des beauftragten Scopes umsetzen,
2. zuerst den direkt betroffenen Test bzw. den kleinsten passenden Gate ausführen; weitere Gates nur gemäß Testmatrix,
3. **kein zweiter spekulativer Fix ohne neue Evidenz**,
4. schlägt der nächste Test oder CI-Lauf erneut fehl, zuerst dessen Fehlersignatur mit dem vorherigen Failure Packet vergleichen:
   - **gleiche Signatur:** bisherige Hypothese und Fixwirkung neu bewerten,
   - **andere Signatur:** neues Failure Packet erstellen und den neuen ersten Fehler analysieren,
5. ein bloßer Rerun ist nur bei begründetem Infrastruktur-/Transientfehler eine Reparaturmaßnahme,
6. bei knappen Zeit-, Tool- oder Kontextressourcen hat die **Sicherung von Run/Job, vollständigem Log und Failure Packet Vorrang vor einem weiteren Fixversuch**.

Für die Diagnose bevorzugt den GitHub-Connector/API-Weg verwenden: Workflow-Run -> Jobs -> fehlgeschlagener Job -> vollständiges Joblog. `gh` ist dafür nicht erforderlich.

Wichtig: Ein grüner schneller Teiltest oder eine große Zahl bereits grüner Node-Tests ersetzt den laut Testmatrix erforderlichen Browser-/App-/Deploy-Gate nicht. Ein Fix gilt erst als bestätigt, wenn der danach laut Testmatrix erforderliche Test bzw. CI-Lauf tatsächlich geprüft wurde.

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
