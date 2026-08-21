# Review – vereinfachter Texture Progression Coach

Stand: 2026-08-21  
Review-Basis: tatsächlicher Branch-Diff gegen `main` `6376520be9993c0f1960b80411c8cf1de4119ad4`  
Arbeitsbranch: `docs/texture-progression-coach-proposal`

## Ergebnis

**Kein fachlicher oder technischer Blocker im reduzierten MVP.**

Der zuvor größere Entwurf wurde bewusst verworfen. Die implementierte Variante beschränkt sich auf drei Dinge:

1. keine FOOD-basierte Textur-Bereitschaftsampel mehr;
2. eine einzige bestehende Coach-Karte mit kurzer Next-Step-Copy und Fingerfood-Hinweis;
3. passend zur `textureStage` sortierte, aber bereits vorher eligible Löffelmodi.

Keine neue persistente Produktdimension wurde eingeführt.

## Review-Findings

### 1. Produktkomplexität – PASS

Keine neue tägliche Eingabe und keine zusätzliche Bedienebene.

Nicht eingeführt wurden insbesondere:

- `textureExperience`;
- neue Log-Fragen;
- neue Fortschrittszähler;
- zweite Coach-Spur;
- dynamische Fingerfood-Empfehlungsengine;
- neue Migration oder Schemaerhöhung.

Damit bleibt der sichtbare Alltagsflow praktisch unverändert.

### 2. FOOD-Outcomes als Texturerfolg – PASS nach Entfernung

Der alte sichtbare Coach leitete aus positiven FOOD-Outcomes einen Texturerfolgszähler und ab vier Einträgen `Test möglich` ab.

Die implementierte Coach-Darstellung verwendet diese Information nicht mehr.

Es gibt bewusst **keine Ersatzmessung**. Der Coach berät nur und entscheidet nicht, dass ein Kind „bereit“ ist.

### 3. Fingerfood bleibt parallel – PASS

Der neue Hinweis erklärt ausdrücklich, dass geeignetes weiches Fingerfood unabhängig von der Löffel-Konsistenzstufe parallel angeboten werden kann.

Technisch bleibt unverändert:

- `finger-graspable` wird nicht aus `textureStage` abgeleitet;
- `feedingApproach` bleibt nur Präferenz;
- Safety- und Capability-Gates bleiben wirksam.

### 4. Löffelmodus-Sortierung – PASS

`textureStage` verändert nur die Reihenfolge bereits geeigneter Löffelmodi.

Geprüfte Referenzfälle:

- Stage 1 + `spoon`: Karotte -> `spoon-smooth` vor `spoon-mashed`;
- Stage 2 + `spoon`: Karotte -> `spoon-mashed` vor `spoon-smooth`;
- Stage 2 + Auto-Mahlzeit: `presentationMode = spoon-mashed`;
- `fingerfood`: `finger-graspable` bleibt unabhängig davon bevorzugbar.

Die eigentliche `eligibleModes`-Liste bleibt unverändert.

### 5. Mixed-Semantik – PASS

Bei `mixed` werden nur die vorhandenen Löffelplätze untereinander nach Texturstufe umsortiert. Fingerfood wird nicht zu einer späteren Familie verschoben.

Damit bleibt die freigegebene Parallelität erhalten.

### 6. Capabilities und Safety – PASS

Unverändert bleiben:

- `spoon-soft-lumpy`-Texturgate;
- `smallSoftPieces`;
- `structuredChew`;
- Recipe-/FOOD-Safety;
- Zutaten- und Altersgates.

Die neue Sortierung erzeugt keine Eligibility.

### 7. Planner-/Lock-Scope – PASS

Keine Änderung an:

- Kandidatenbildung;
- Rezeptidentität;
- FOOD-Rollen;
- manuellen Locks;
- bestehenden gespeicherten `presentationMode`-Werten.

Nur neue automatisch bestimmte Presentation Modes verwenden die verfeinerte Präferenzreihenfolge.

### 8. UI-Architektur – PASS mit bewusst kleinem Runtime-Integrationspunkt

Die finale sichtbare App wird bereits heute erst nach Installation der Planner-/Handling-Policy-Kette erneut gerendert.

Der vereinfachte Coach wird deshalb über `installTextureCoachRuntime()` innerhalb derselben bestehenden Handling-Runtime installiert, bevor der finale sichtbare `renderAll()` läuft.

Vorteile:

- keine zusätzliche JS-Datei;
- keine neue Persistenz;
- keine neue UI-Komponente;
- keine Änderung am Log;
- bestehende Policy-Ladekette bleibt erhalten.

Der ursprüngliche Coach in `js/ui.js` ist nur Teil des initial versteckten Pre-Policy-Renders; die sichtbare finale Darstellung verwendet die vereinfachte Runtime-Version.

### 9. Scope – PASS

Produktivdatei:

- `js/handling-readiness.js`

Regressionen:

- `tests/handling-planner-preference.test.cjs`
- `tests/handling-readiness-integration.test.cjs`
- `tests/ui-texture-settings-tab-state.test.cjs`
- `browser-tests/ui-settings-tab-state-webkit.test.mjs`

Nicht angefasst:

- `js/log.js`;
- FOOD-/Recipe-Daten;
- Persistenzschema;
- Statistik;
- Deployment-Konfiguration.

## Noch zu prüfen

Gemäß aktueller Testmatrix muss der tatsächliche PR-CI-Lauf `npm run verify:app` erfolgreich durchlaufen.

Kein `verify:deploy` erforderlich, da keine Deployment-Datei geändert wurde.

## Schlussurteil

**Die vereinfachte Implementierung ist dem früheren größeren Entwurf klar vorzuziehen.**

Sie behebt den fachlichen Fehler, verbessert die tatsächliche Darreichungspräferenz und erklärt die Parallelität von Fingerfood, ohne die App für die Nutzerin mit neuen Feldern oder Entscheidungen zu belasten.
