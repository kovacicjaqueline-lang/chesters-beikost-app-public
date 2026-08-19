# Übergabe – FOOD Handling Readiness / BLW parallel

Stand: 2026-08-18  
Branch: `refactor/food-handling-readiness`  
Letzter synchronisierter `main`: `56ba854d502d0f0fa7c77596a7a0a4e85e6965e3`  
Vollständig getesteter Code-Commit: `0aaa13043379ff8c11b020e383df21a9529f6d29`  
App-Version: `10.1.25`

## Status

Die festgelegte FOOD-Handling-Readiness-Reihenfolge ist vollständig umgesetzt und gegen den aktuellen `main` getestet:

1. Branch gegen `main` synchronisiert.
2. Vollständige Regressionen hergestellt.
3. `presentationMode` additiv eingeführt.
4. `feedingApproach` als reine Planner-/Darreichungspräferenz abgesichert.
5. Eigenständiges Rezept `Bananen-Ei-Pancakes` ergänzt.
6. Später auf `main` hinzugekommene PLAN-08-Proactive-Recipe-first-Schicht integriert und regressiv geprüft.
7. Boot-Lifecycle-Lücke bei vorzeitig erzeugten Auto-Locks migrationssicher geschlossen.
8. Abschließender vollständiger `npm test` auf dem real synchronisierten Branch grün.

**Noch nichts nach `main` mergen.**

## Verbindliche Fachentscheidung

Brei/Löffelkost und geeignetes BLW-/Fingerfood sind **parallele Darreichungswege ab allgemeiner Beikostreife**. Fingerfood ist keine spätere lineare Stufe nach Brei.

`feedingApproach = spoon | fingerfood | mixed` ist eine **Präferenz**, keine Entwicklungsstufe und kein Safety-Override.

Daraus folgt weiterhin:

- sichere Löffelwege werden durch `fingerfood` nicht fachlich ungeeignet;
- sichere Fingerfoodwege werden durch `spoon` nicht fachlich ungeeignet;
- `spoon-soft-lumpy` darf weiter an tatsächliche Texturentwicklung gekoppelt sein;
- zusätzliche Fähigkeiten wie kleine weiche Stücke dürfen separat modelliert werden;
- Alter, Zutaten-/Allergenstatus, Mahlzeiteneignung, `autoPlan`, Fisch-/Safety-Regeln bleiben harte Voraussetzungen.

## Relevante Dateien

Handling:

- `docs/FOOD_HANDLING_READINESS_PLAN.md`
- `docs/FOOD_HANDLING_READINESS_AUDIT.md`
- `docs/FOOD_HANDLING_READINESS_RECIPE_AUDIT.json`
- `docs/FOOD_HANDLING_READINESS_TECHNICAL_DESIGN.md`
- `data/food-handling.js`
- `js/handling-readiness.js`
- `js/recipes.js`
- `tests/handling-readiness.test.cjs`
- `tests/handling-readiness-integration.test.cjs`
- `tests/handling-presentation-mode.test.cjs`
- `tests/handling-planner-preference.test.cjs`
- `tests/bananen-ei-pancakes.test.cjs`
- `tests/planner-policy-boot-lock.test.cjs`

PLAN-08-Integration:

- `js/planner-recipe-first.js`
- `js/planner-proactive-recipe.js`
- `data/food-presentation.js`
- `js/planner-meal-presentation.js`
- `js/planner-food-role-stability.js`
- `js/utils.js`

## Implementierter Handling-Contract

Strukturierte Modi:

- `spoon-smooth`
- `spoon-mashed`
- `spoon-soft-lumpy`
- `finger-graspable`
- `finger-small-soft`

Wave-1 FOODs:

- Karotte
- Kartoffel
- Zucchini
- Brokkoli
- Karfiol
- Süßkartoffel
- Banane
- Avocado

Explizit migrierte Rezepte:

- Obst-Hafer-Pancakes
- Birne-Hirse-Pancakes
- Gemüse-Hafer-Pancakes
- Omelettstreifen
- Zucchini-Omelett
- Brokkoli-Kartoffel-Stampf
- Zucchini-Kartoffel-Brei
- Avocado-Bananen-Creme
- Bananen-Ei-Pancakes

Nicht aufgeführte Rezepte bleiben im Legacy-Stage-Fallback.

## SAFETY-REVIEW bleibt ausdrücklich unangetastet

Folgende Rezepte **nicht pauschal früher freigeben** und nicht ohne Einzelprüfung in den Handling-Contract übernehmen:

- Rind-Hafer-Bällchen
- Geflügel-Gemüse-Hafer-Bällchen
- Lachs-Kartoffel-Bällchen
- Bangus-Kartoffel-Taler
- Eier-Finger
- Ei-Champignon-Cups
- Hummus mit weichen Gemüsesticks
- Fleisch-Gemüse-Bällchen

## LATER-REVIEW bleibt ausdrücklich unangetastet

- Obst-Hafer-Muffins
- Gemüse-Hafer-Muffins
- Kürbis-Hirse-Muffins
- Joghurt-Hafer-Waffeln
- Weiche Joghurt-Fladen
- Gemüse-Joghurt-Mini-Muffins
- Huhn-Gemüse-Muffins
- Süßkartoffel-Linsen-Muffins

## `presentationMode` – umgesetzt

`js/handling-readiness.js` ergänzt für **frisch automatisch erzeugte** geeignete Mahlzeiten optional ein strukturiertes `presentationMode`.

Grenzen:

- bestehende Locks ohne `presentationMode` bleiben ohne Feld;
- bestehende Logs ohne `presentationMode` bleiben ohne Feld;
- vorhandenes explizites `presentationMode` wird nicht durch `feedingApproach` überschrieben;
- manuelle Mahlzeiten werden nicht rückwirkend umgedeutet;
- Kostprobe/Einführung erhält nicht pauschal eine gemeinsame Darreichungsform;
- unmigrierte Rezepte erhalten kein erfundenes `presentationMode`;
- FOOD-only erhält nur dann einen Modus, wenn alle Komponenten einen strukturierten Contract besitzen und einen gemeinsamen geeigneten Modus haben;
- es gibt **keinen** Fallback von historischem `textureStage` auf `presentationMode`.

Persistenzpfad für neue automatische Planung:

`buildDay()` → `presentationMode` → `mealSnapshot()` → neuer Auto-Lock → Hydration über `lockedMeal()` → neuer Log kann das Feld additiv übernehmen.

Historische `textureStage`-Logs werden weder gelöscht noch neu interpretiert.

## `feedingApproach` – Planner-Präferenz umgesetzt

`feedingApproach` sortiert nur bereits geeignete Handling-Modi.

Regressionen beweisen:

- `spoon` und `fingerfood` verändern bei derselben Planung nicht Fokus, FOOD-Komponenten, Rollen oder Rezeptidentität;
- nur die bevorzugte sichere Darreichungsform kann sich unterscheiden;
- keine sichere Alternative wird aus der Eligibility entfernt;
- SAFETY-REVIEW und LATER-REVIEW bleiben auch unter `fingerfood` unmigriert;
- PLAN-08-Rezeptidentität bleibt erhalten.

Fehlender/alter `feedingApproach` fällt migrationssicher auf `mixed` zurück.

## PLAN-08 inklusive Proactive Recipe-first bleibt getrennt und intakt

`data/food-presentation.js` bleibt ausschließlich **Anzeige-/Komponentenrollen-Contract** und wird nicht zur Handling-Eignung verwendet.

Aktuelle Browser-Policy-Reihenfolge:

1. `planner-meal-eligibility`
2. `planner-milk-policy`
3. `planner-iron-preference`
4. `data/food-presentation`
5. `planner-meal-presentation`
6. `planner-recipe-first`
7. `planner-proactive-recipe`
8. `planner-food-role-stability`
9. `data/food-handling`
10. `handling-readiness`
11. finaler sichtbarer Render

Die später auf `main` ergänzte Proactive-Recipe-first-Schicht wurde vollständig übernommen. Ihre Regressionen bleiben grün, insbesondere:

- höchstens genau ein neues FOOD über ein Rezept;
- keine unbekannte Zusatz-Zutat ohne Einführung;
- Mahlzeiteneignung bleibt hart;
- mehrdeutige Rezeptformen werden nicht geraten;
- Rollen und Kostprobe bleiben kanonisch;
- Handling wird erst danach installiert und verändert Recipe-first-Auswahl oder Rollen nicht.

## Boot-Lifecycle / Auto-Locks – zusätzlicher Integrationsfix

Beim Review des synchronisierten Browsers wurde festgestellt:

- `js/utils.js` setzt vor der dynamischen Policy-Kette `window.__plannerPoliciesReady = false` und versteckt die Oberfläche;
- `app.js` führt dennoch bereits einen ersten unsichtbaren `renderAll()` aus;
- dieser kann `buildDays()` und `ensureAutoLocks()` aufrufen, bevor PLAN-08/Proactive Recipe-first/Handling vollständig installiert sind.

Dadurch konnten normale Auto-Locks aus dem aktuellen Seiten-Boot den späteren vollständigen Policy-Stand konservieren beziehungsweise `presentationMode` umgehen.

Migrationssichere Lösung in `js/handling-readiness.js`:

- beim Installieren der Handling-Runtime werden **nur normale Auto-Locks verworfen, die im aktuellen Seitenstart entstanden sind**;
- Erkennung über `createdAt >= performance.timeOrigin`;
- nur solange `window.__plannerPoliciesReady === false`;
- historische Auto-Locks bleiben unverändert;
- manuelle Locks bleiben unverändert;
- Follow-up-Auto-Locks bleiben unverändert;
- Locks ohne sicher auswertbares `createdAt` bleiben unverändert;
- wenn kein sicherer Seitenstart bestimmbar ist, wird gar nichts gelöscht;
- der finale sichtbare Render erzeugt anschließend neue Auto-Locks unter der vollständig installierten Policy-Kette.

Regression: `tests/planner-policy-boot-lock.test.cjs`.

Damit wird die Vorgabe „bestehende Locks nicht stillschweigend umdeuten oder löschen“ eingehalten; bereinigt wird ausschließlich temporärer, im selben unvollständigen Browser-Boot erzeugter Auto-Zustand.

## Eigenständiges Rezept `Bananen-Ei-Pancakes` – umgesetzt

Das Rezept ist **kein Alias** von `Obst-Hafer-Pancakes`.

Verbindlicher Datensatz:

- Name: `Bananen-Ei-Pancakes`
- Kategorie: `pancakes`
- `requires: ["Banane", "Ei"]`
- kein Pflicht-Hafer
- vollständig, aber weich durchgaren
- keine harte/stark gebräunte Kruste
- weich und gut greifbar anbieten
- Handling-Contract: ausschließlich `finger-graspable`

Zutaten-/Allergenstatus und Mahlzeiteneignung bleiben harte Voraussetzungen. Eine frühe `textureStage` allein sperrt dieses explizit migrierte Fingerfood-Rezept nicht.

### Ladezeit

Der Rezeptdatensatz wird in `js/recipes.js` direkt nach dem statischen `data/recipes.js`-Katalog und **vor `app.js`** additiv registriert.

Das Rezept ist dadurch bereits vor dem ersten Planungs-/Lock-Zugriff im Katalog vorhanden. `data/food-handling.js` enthält ausschließlich Handling-/Darreichungscontracts.

## Tests – finaler Prüfstand

Vollständiger GitHub-Actions-Lauf auf dem real synchronisierten Branch-Head

`0aaa13043379ff8c11b020e383df21a9529f6d29`

gegen `main`

`56ba854d502d0f0fa7c77596a7a0a4e85e6965e3`

Ergebnis:

- `npm test`
- **297 Tests**
- **285 bestanden**
- **0 fehlgeschlagen**
- **12 bewusst übersprungen**
- 0 abgebrochen
- 0 TODO

Abgedeckt sind insbesondere:

- Handling Wave 1;
- `presentationMode` Plan/Lock/Log;
- historische Locks ohne Feld bleiben unverändert;
- kein `textureStage`-Fallback;
- `feedingApproach` nur als Präferenz;
- SAFETY-/LATER-Review bleiben Legacy;
- PLAN-08 Loader, Recipe-first, **Proactive Recipe-first**, Rollenstabilität und Präsentationsvertrag;
- Boot-Lifecycle und nur-current-page Auto-Lock-Bereinigung;
- MILK-01;
- Mahlzeiteneignung/PLAN-07;
- FOOD-/Alias-/Allergen-/Persistenzregressionen;
- Bananen-Ei-Pancakes inklusive Registrierung vor ersten Auto-Locks;
- aktuelle iPhone-Mahlzeit-Editor-Regressionen aus `main`.

## Main-Synchronisation

Der Branch wurde während der Arbeit mehrfach gegen parallel weiterlaufenden `main` aktualisiert.

Letzter verifizierter Vergleich vor dieser Dokumentationsänderung:

- `main`: `56ba854d502d0f0fa7c77596a7a0a4e85e6965e3`
- Branch-Code-Head: `0aaa13043379ff8c11b020e383df21a9529f6d29`
- **33 Commits ahead / 0 behind**

Vor jeder späteren technischen Änderung erneut vergleichen, weil `main` parallel weiterlaufen kann.

## Weiteres Vorgehen

Die ursprünglich festgelegte FOOD-Handling-Readiness-Umsetzung ist fachlich und technisch abgeschlossen und vollständig getestet.

Nicht erneut implementieren:

- `presentationMode`
- Planner-Präferenz über `feedingApproach`
- `Bananen-Ei-Pancakes`
- Boot-Lifecycle-Fix

Ohne neuen fachlichen Auftrag keine SAFETY-/LATER-Review-Rezepte weiter migrieren.

Ohne ausdrücklichen Auftrag weiterhin **nicht nach `main` mergen**.

## Dauerhaft nicht vergessen

- BLW/Fingerfood und Löffel-/Breikost bleiben parallele Darreichungswege.
- `feedingApproach` ist Präferenz, keine Reifestufe und kein Safety-Override.
- `presentationMode` ist optional und additiv; historische Datensätze bleiben historisch.
- PLAN-08 Presentation Contract und Handling Contract bleiben getrennte fachliche Dimensionen.
- Keine Steuerlogik aus `safeForm`-/`note`-Freitext ableiten.
- Keine SAFETY-REVIEW-/LATER-REVIEW-Fälle pauschal freigeben.
- Bestehende historische Locks und Logs nie stillschweigend löschen oder semantisch umdeuten.
