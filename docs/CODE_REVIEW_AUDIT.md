# Technischer Baseline-Code-Review

## Audit-Basis und Vorgehen

| Merkmal | Wert |
| --- | --- |
| Audit-Datum | 2026-08-22 |
| Audit-Basis-Commit | `ba2f326389920884b6b21210531c74973aa35f9e` |
| Basis-Branch | `main` (der für diese Aufgabe bereitgestellte Stand; im Workspace anfänglich als `work` ausgecheckt) |
| Audit-Branch | `audit/full-code-review` |
| Version | `10.1.26` laut `VERSION.json` und `package.json` |
| Gelesene Governance | `AGENTS.md`, `docs/AI_WORKFLOW.md` |

Der Review erfolgte breadth-first: Zuerst wurden Dateistruktur, Ladefolge, produktive Module, Datenkataloge, Persistenz-, PWA- und Testpfade statisch erfasst. Danach wurden auffällige Call-Chains in Planner, Migration/Persistenz, Backup/Restore, Protokoll, Vorrat, dynamischen Runtime-Policies und Service Worker vertieft. Candidates wurden gegen den tatsächlichen Daten- und Kontrollfluss sowie vorhandene Regressionen geprüft. Root-Cause-gleiche Symptome sind zusammengeführt.

Technische Grenzen: Es wurde ausschließlich der bereitgestellte PUBLIC-Workspace untersucht; es gab keinen Remote und keinen direkten GitHub-Netzwerkzugriff. Deshalb konnten Repository-Identität, externer `main`, PR-Metadaten und GitHub Actions nicht zusätzlich serverseitig geprüft werden. Die visuelle/fachliche FOOD-V2-Icon-Bewertung war gemäß Auftrag ausgeschlossen; geprüft wurden nur technische Mappings, Dateien und Cache-Referenzen. Eine fachliche Neubewertung medizinischer Inhalte fand nicht statt. Browser-spezifische Fehler wurden nur dort als bestätigt gewertet, wo der Plattformfluss aus Web-API-Semantik und Code eindeutig folgt.

## Coverage-Matrix

| Bereich | Geprüft | Ergebnis | Findings |
| --- | --- | --- | --- |
| Boot, Script-Ladefolge, dynamische Policies | ja | Policy-Kette, Failure-Pfad und erster Render geprüft; kein eigenständiger relevanter Befund | – |
| Zustandsmodell und zentrale Utilities | ja | Defaults, Ableitungen, Datum/Alter, Klonen und Statusfluss geprüft | – |
| Persistenz (localStorage/IndexedDB) | ja | Failover und Wiederanlauf können neuere Daten verwerfen | CR-001 |
| Migrationen und gespeicherte Referenzen | ja | FOOD-/Log-/Vorrat-/Plan-Remapping und Legacy-Flüsse geprüft; Schema-Grenzen inkonsistent | CR-002 |
| Backup, Prüfsumme, Import und Snapshots | ja | Export-/Import-Wrapper und Restore-Flüsse geprüft | CR-001, CR-002 |
| Planner-Kern und Replanning | ja | Eligibility, Auswahl, Locks, Overrides, Materialisierung und Rebuild-Semantik geprüft | – |
| Planner-Policy-Schichten | ja | Mahlzeiteneignung, Milch, Eisen, Rollen, Qualität, Recipe-first und Proactive Recipe geprüft | – |
| Phasen-, Mengen-, Alters- und Readiness-Logik | ja | harte/weiche Gates, Phasenslots, Handling-/Oral-Contracts und UI-Verknüpfung geprüft | – |
| FOOD-Katalog und Custom-FOODs | ja | IDs, Aliasauflösung, Eligibility, Safety-Patches, Custom-Defaults und Persistenz geprüft | – |
| Rezeptkatalog und Rezeptauflösung | ja | Varianten, Zutatenauflösung, Freischaltung, Mahlzeitenklassifikation und Mengenmetadaten geprüft | – |
| Protokoll und abgeleitete Statuswerte | ja | Anlegen/Bearbeiten/Löschen, Outcomes, Rollen, Textur, Planverknüpfung und Statistiken geprüft | – |
| Follow-ups und Missed-Day-Rollover | ja | Erzeugung, Verschiebung, Konflikte, Kaskade und Konsequenz-Neuaufbau geprüft | – |
| Vorrat, Batch-Rechner und Verbrauch | ja | FOOD-/Rezeptbatches, Portionen, FIFO, Reservierungen und Frozen-Ingredient-Fluss geprüft | – |
| Produktallergene/Sulfite | ja | Schema-Wrapper, Snapshots, Log-/Vorratsübernahme und Guards geprüft | CR-002 |
| UI-State, Dialoge und Navigation | ja | View-State, Modals, Meal-Editor, Karten, Suche und Event-Bindings geprüft | – |
| Statistiken | ja | tatsächliche Gaben, Identitäten, Zeitraum und Neuberechnung geprüft | – |
| PWA, Service Worker und Offline-Cache | ja | Install/Activate/Fetch, dynamische Precache-Listen und Offline-Fallback geprüft | CR-003 |
| Icons und Assets (nur technisch) | ja | Runtime-Mappings, Existenz, V2-Coverage und Precache technisch geprüft | – |
| Security und Privacy | ja | DOM-Injektion, Backup-Eingaben, externe Requests, lokale Speicherung und Fehlerausgaben geprüft | – |
| Async/Race Conditions und Error Handling | ja | Save-Queue, IDB-Fallback, Boot-Hydration und Cache-Updatepfade geprüft | CR-001, CR-003 |
| Performance und Seiteneffekte | ja | Planner-Wochenaufbau, Renderketten, Listener/Observer und Cache-I/O risikoorientiert geprüft | – |
| Tests und CI-Konfiguration | ja | Testabdeckung, Assertions, Browsermatrix und Actions-Definitionen statisch geprüft; lokale Node-Regression ausgeführt | CR-001, CR-002, CR-003 |
| Deployment/Wrangler-Konfiguration | ja | Entrypoints, statische Assets und Dry-run-Konfiguration statisch geprüft; kein Deploy-Gate für reine Dokuänderung | – |

## Bestätigte Findings

### CR-001 | HIGH | CONFIRMED

**Bereich:** Persistenz, Wiederanlauf, Datenintegrität
**Betroffene Datei(en)/Funktion(en):** `js/storage.js`: `save`, `bootstrapStorage`, `idbPut`, `idbGet`
**Problem:** Nach einem einzelnen IndexedDB-Schreibfehler schaltet `save` für den Rest der Sitzung dauerhaft auf die localStorage-Notfallkopie um. Beim nächsten App-Start wird diese neuere Notfallkopie zwar zunächst durch `load()` geladen, `bootstrapStorage()` bevorzugt anschließend aber bedingungslos jeden vorhandenen IndexedDB-Datensatz. Ein älterer IDB-Stand überschreibt damit den neueren localStorage-Stand im Arbeitsspeicher und wird danach erneut in beide Speicher geschrieben.
**Konkrete Auswirkung / reproduzierbares Szenario:** (1) Ein persistierter IDB-Stand A existiert. (2) Ein vorübergehender Fehler lässt einen späteren IDB-Write fehlschlagen; die Änderungen B werden weiterhin erfolgreich nach localStorage geschrieben. (3) Die App wird neu gestartet, nachdem IndexedDB wieder erreichbar ist. `load()` liest B, `idbGet(STATE_RECORD)` liefert A, `bootstrapStorage()` setzt `state` auf A und `save()` spiegelt A zurück. Sämtliche Änderungen seit dem Fehler gehen verloren, obwohl die UI ausdrücklich eine aktive Notfallkopie signalisiert hatte.
**Technischer Beleg:** `save()` schreibt localStorage vor dem IDB-Write, setzt im Queue-`catch` `indexedDbUnavailable = true` und führt danach keine IDB-Writes mehr aus. `bootstrapStorage()` vergleicht weder Revision noch Zeitstempel und übernimmt bei truthy `idbState` stets IDB. Der anschließende `save()` macht die Rückstufung dauerhaft.
**Warum bestätigt:** Der Verlust ergibt sich deterministisch aus den beiden Speicherpfaden; er setzt nur einen realistischen transienten IDB-Fehler und einen später erfolgreichen Read voraus. Es gibt keinen Konfliktauflöser oder monotonen State-Zeitstempel.
**Bestehende Tests:** Die Suite prüft IDB-Grundfunktionen und einzelne Backup-/Migrationspfade, aber keinen Neustart nach einem fehlgeschlagenen IDB-Write mit neuerer localStorage-Kopie.
**Fehlender Regressionstest:** Simulierter erfolgreicher IDB-Stand A → fehlgeschlagener Write von B bei erfolgreichem localStorage → neuer Boot mit wieder erreichbarem IDB; B muss erhalten bleiben und kontrolliert nach IDB zurückgeschrieben werden.
**Kleinste sinnvolle Reparaturrichtung:** Beide Spiegel mit einer monotonen Revision bzw. `updatedAt` versehen und beim Boot den neuesten validen Stand wählen; alternativ beim Write-Fehler den IDB-Stand eindeutig als stale markieren und beim nächsten Boot die Notfallkopie priorisieren, bis ein verifizierter Write-back gelungen ist.

### CR-002 | MEDIUM | CONFIRMED

**Bereich:** Backup-Kompatibilität, Schema-Metadaten
**Betroffene Datei(en)/Funktion(en):** `VERSION.json`; `js/state.js`: `SCHEMA_VERSION`; `js/storage.js`: `buildBackupPackage`, `validateBackup`; `js/product-allergens-guards.js`: `PRODUCT_ALLERGEN_BACKUP_SCHEMA_VERSION`, Backup-/Validate-Wrapper
**Problem:** Der Release-Metadatensatz deklariert `schemaVersion: 7`, während der Storage-Kern Version 5 verwendet und der nachgeladene Produktallergen-Wrapper aktuelle Exporte auf Version 6 umschreibt. Der Import akzeptiert das spezielle aktuelle Format nur exakt als Version 6; alle übrigen Pakete laufen in die Basiskontrolle, die jede Version über 5 ablehnt. Damit kann der Stand `10.1.26` kein Backup mit der von seinen eigenen Release-Metadaten ausgewiesenen Schema-Version 7 importieren und exportiert selbst weiterhin Version 6.
**Konkrete Auswirkung / reproduzierbares Szenario:** Ein formal zur dokumentierten Version `10.1.26` gehörendes Backup-Paket mit `schemaVersion: 7` wird zuerst vom Produktallergen-Sonderpfad abgewiesen (nicht exakt 6) und danach von `validateBackup` als „neuere App-Version“ verworfen (`7 > 5`). Umgekehrt enthält ein frisch erzeugtes Backup Version 6 statt der in `VERSION.json` ausgewiesenen 7. Automatisierte Support-/Kompatibilitätsentscheidungen erhalten widersprüchliche Angaben.
**Technischer Beleg:** Die drei produktiven Konstanten/Metadatenwerte sind 7, 5 und 6. Der Wrapper setzt Export und Payload explizit auf 6 und lässt nur `schemaVersion === 6` mit `productAllergenSchemaVersion === 1` passieren; der Basispfad prüft gegen 5.
**Warum bestätigt:** Sowohl Exportwert als auch Ablehnung von Version 7 folgen direkt und ohne Umgebungsannahme aus den aufgerufenen Funktionen.
**Bestehende Tests:** `tests/product-allergens-guards.test.cjs` bestätigt ausdrücklich den 6er-Wrapper und die Ablehnung eines 6er-Pakets durch den isolierten 5er-Basispfad. `tests/version-consistency.test.cjs` prüft App-/Asset-Versionen, aber nicht die Schema-Angabe aus `VERSION.json` gegen die Runtime. Dadurch wird die Inkonsistenz derzeit als erwartetes Verhalten festgeschrieben statt erkannt.
**Fehlender Regressionstest:** Eine einzige kanonische Schema-Version muss zwischen `VERSION.json`, Export-Envelope, Payload und Importobergrenze übereinstimmen; zusätzlich Roundtrip eines aktuellen Backups und Kompatibilitätsfälle der ausdrücklich unterstützten Vorgängerversionen.
**Kleinste sinnvolle Reparaturrichtung:** Eine kanonische Schema-Konstante für Storage und optionale Feature-Schemas verwenden, Metadaten daran koppeln und den Import nach unterstützten Versionen statt über einen exakten Feature-Sonderfall verzweigen.

### CR-003 | MEDIUM | CONFIRMED

**Bereich:** PWA, Service-Worker-Update, Offline-Verfügbarkeit
**Betroffene Datei(en)/Funktion(en):** `sw-core.js`: `precacheFresh`, Install-/Activate-Handler; `sw.js`: zusätzlicher Install-Handler
**Problem:** Beide Precache-Phasen fangen Fehler pro Datei ab und lassen die Installation trotzdem erfolgreich enden. `sw-core.js` ruft zusätzlich sofort `skipWaiting()` auf. Bei Aktivierung werden anschließend ausnahmslos alle älteren Caches gelöscht. Ein partiell geladener neuer Cache ersetzt somit einen zuvor vollständigen Offline-Stand.
**Konkrete Auswirkung / reproduzierbares Szenario:** Während eines Updates ist genau ein produktives Script oder ein dynamisches Policy-Modul vorübergehend nicht abrufbar (Netzabbruch, Teildeployment oder Serverfehler). Der Fehler wird nur geloggt; der Worker installiert und aktiviert sich, löscht den alten vollständigen Cache und übernimmt Clients. Beim nächsten Offline-Start fehlt die Datei. Bei einem Kernscript bricht die App ab; bei einer dynamischen Planner-/Handling-Policy wird die App zwar sichtbar, läuft aber ohne vollständige Policy-Kette.
**Technischer Beleg:** `precacheFresh()` und der Zusatz-Precache kapseln jeden Fetch in `try/catch` ohne Re-Throw oder Vollständigkeitsprüfung. Der Activate-Handler behält ausschließlich `CACHE`; durch `skipWaiting()` gibt es keine Schutzphase mit dem alten Worker.
**Warum bestätigt:** Ein einziger fehlgeschlagener Fetch führt deterministisch zu erfolgreicher Installation plus Löschung des alten Caches. Genau dieser partielle Fehler ist bei einem mobilen PWA-Update realistisch; keine weitere Prüfung verhindert die Aktivierung.
**Bestehende Tests:** Icon-/Precache-Tests prüfen, ob erwartete Pfade in den Listen stehen. `tests/pwa-resume-cache-strategy.test.cjs` prüft die Fetch-Strategie. Kein Test simuliert partielles Precache-Versagen und den anschließenden Activate-Cleanup.
**Fehlender Regressionstest:** Service-Worker-Test mit einem fehlschlagenden Pflichtasset: Installation muss fehlschlagen oder der alte vollständige Cache muss bis zu einer nachgewiesen vollständigen neuen Cache-Generation erhalten bleiben. Optionale Assets müssen explizit von Pflichtassets getrennt sein.
**Kleinste sinnvolle Reparaturrichtung:** Pflicht-Precache atomar behandeln (Fehler propagieren), neue Cache-Generation erst nach Vollständigkeitsnachweis aktivieren und alte Cache-Generation erst danach löschen; nur klar optionale Dateien best-effort laden.

## NEEDS-VERIFICATION

Keine verbleibenden Punkte. Alle relevanten Candidates wurden entweder als CR-001 bis CR-003 bestätigt oder nach Call-Chain-/Testprüfung verworfen.

## Abschlusszusammenfassung

### Findings nach Schweregrad

| Einstufung | Anzahl |
| --- | ---: |
| Critical | 0 |
| High | 1 |
| Medium | 2 |
| Low | 0 |
| Needs Verification | 0 |

### Systemische / Root-Cause-Probleme

1. **Mehrere Wahrheitsquellen ohne Konfliktvertrag:** Persistenzspiegel und Schema-Metadaten besitzen jeweils mehrere konkurrierende Quellen, aber keine zentrale Revision bzw. kanonische Versionsdefinition (CR-001, CR-002).
2. **Erfolgsstatus trotz unvollständiger Dauerhaftigkeit:** Sowohl IDB-Failover als auch Service-Worker-Precache setzen den Betrieb nach Teilfehlern fort, ohne die spätere Recovery atomar abzusichern (CR-001, CR-003).

### Zusammengehörige Findings

- CR-001 und CR-002 sollten gemeinsam als Persistenz-/Backup-Härtung bearbeitet werden, weil beide die Verlässlichkeit gespeicherter bzw. wiederhergestellter Zustände betreffen.
- CR-003 ist unabhängig reparierbar; die Tests sollten aber dieselbe Fehler-Injection-Strategie für persistente Web-APIs verwenden wie CR-001.

### Empfohlene Fix-Reihenfolge

1. **CR-001:** mögliches Verwerfen neuerer Nutzerdaten nach transientem IDB-Fehler.
2. **CR-002:** widersprüchlicher Backupvertrag und Ablehnung der ausgewiesenen Schema-Version.
3. **CR-003:** Verlust eines funktionierenden Offline-Standes bei partiellem PWA-Update.

### Geprüfte Bereiche ohne relevante Befunde

Planner-Kern und Policy-Schichten; FOOD- und Rezeptdatenflüsse; Phasen-, Alters-, Mengen- und Readiness-Logik; Protokoll und Statistiken; Follow-ups/Rollover; Vorrats- und Rezeptbestandslogik; UI-State/Dialoge/Navigation; technische Icon-/Asset-Mappings; Security/Privacy; praktisch relevante Performance; Deploymentkonfiguration. „Ohne relevante Befunde“ bedeutet nicht Fehlerfreiheit, sondern dass nach statischer Prüfung, Call-Chain-Verifikation und vorhandener Regression kein weiterer belastbarer Finding-Kandidat übrig blieb.

### Tests / Verifikation

| Befehl | Ergebnis | Bezug |
| --- | --- | --- |
| `npm test` | PASS: 572 Tests, 0 Fehler, 0 übersprungen | Breite bestehende Node-Regression; zeigt insbesondere die Testlücken zu CR-001 bis CR-003, ohne die Findings zu widerlegen |
| `npm audit --offline --omit=dev` | PASS: 0 bekannte Vulnerabilities im lokalen Lockfile | Abhängigkeits-/Security-Coverage; rein lokale Metadatenprüfung |

Kein Browser-Gate und kein Deployment-Dry-run wurden ausgeführt: Der einzige Repository-Änderungsscope ist Dokumentation, und `AGENTS.md`/`docs/AI_WORKFLOW.md` verlangen dafür keine künstliche Regression. `npm test` wurde als beweiswertige Baseline gegen die untersuchten produktiven Candidates ausgeführt, nicht als Release-Gate.

### Audit-Grenzen

- **Fachlich nicht verifizierbar:** Keine erneute medizinische/fachliche Bewertung der freigegebenen FOOD-, Rezept-, Safety-, Handling- oder Planner-Regeln; keine visuelle/fachliche Icon-Prüfung.
- **Lokal technisch nicht ausgeführt:** Keine Browser-Regression und keine Wrangler-Dry-runs, da der finale Scope ausschließlich diese Dokumentation ändert.
- **Fehlende Laufzeitumgebung:** Kein manuelles iOS-/installiertes-PWA-Gerät; CR-003 basiert auf dem eindeutig verifizierten Service-Worker-Kontrollfluss, nicht auf einer behaupteten Geräteausführung.
- **GitHub/CI:** Im Workspace existierte kein Git-Remote und keine integrierte Funktion zum Lesen von Actions-Status. Es wurde kein direkter GitHub-Netzwerkweg verwendet; CI-Läufe wurden nicht geprüft.
- **Repository-Kontext:** Der bereitgestellte Commit war lokal auf Branch `work` ausgecheckt und es gab keinen lokalen `main`-Ref. Der vom Auftrag als bereitgestellter `main` definierte unveränderte SHA `ba2f326389920884b6b21210531c74973aa35f9e` wurde deshalb als feste Audit-Basis verwendet; kein Fetch, Pull oder Rebase erfolgte.
