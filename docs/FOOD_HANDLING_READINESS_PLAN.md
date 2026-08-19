# FOOD Handling Readiness – Prüf- und Umsetzungsplan

Stand: 2026-08-18  
Arbeitsbranch: `refactor/food-handling-readiness`  
Ausgangsbasis: `main`, Version 10.1.24

## Ziel

Die bestehende Konsistenz-/Handlinglogik so prüfen und später gezielt korrigieren, dass Brei/Löffelkost und geeignetes BLW-/Fingerfood ab Beikostreife parallel möglich sind. Die Mahlzeitenphase darf nicht als lineare Schwierigkeitsstufe der Darreichungsform missverstanden werden.

Noch keine Produktivlogik ändern. Noch keine Rezeptdaten umstufen oder ergänzen.

## Fachlich bereits freigegeben

1. BLW/Fingerfood ist keine spätere Stufe nach Brei.
2. Löffel-/Breikost und geeignetes weiches Fingerfood können ab Beikostreife parallel angeboten werden.
3. `minPhase` bzw. Beikostphase steuert Mahlzeitenslots und fachliche Phaseneignung, nicht pauschal die Darreichungsform.
4. Fingerfood allein ist kein Grund, ein Rezept erst in Phase 2 oder 3 freizugeben.
5. Früh mögliches Fingerfood kann z. B. sehr weich gegarte Gemüsesticks, weiches Obst in geeigneter Form, Omelettstreifen und weiche Bananen-Ei-Pancakes umfassen.
6. Entscheidend sind sichere konkrete Form, Weichheit, Größe, notwendiges Durchgaren und tatsächliche motorische Anforderungen.
7. Spätere motorische Fähigkeiten sollen nur dort sperren, wo sie tatsächlich benötigt werden, z. B. bei kleinen Stücken/gezieltem Aufnehmen.
8. Beikostform soll als Planner-Präferenz getrennt von Reife/Phase betrachtet werden: `Brei/Löffel`, `BLW/Fingerfood`, `gemischt`.
9. `skillRequirement` darf nicht pauschal als Sperre für alle Pancakes, Taler, Sticks oder sonstiges Fingerfood verwendet werden.

## Ist-Befunde im aktuellen main

### 1. `stage` ist derzeit eine lineare Konsistenz-Schranke

`recipeStatesCore()` vergleicht `state.settings.textureStage` direkt mit `recipe.stage`. Ist die aktuelle Stufe kleiner, wird das Rezept gesperrt (`unlocked: false`).

Damit hat `stage` aktuell echte Freigabewirkung und ist nicht nur Beschreibung.

### 2. Die UI definiert Stage 3 pauschal als Fingerfood

Aktuelle Texturstufen:

- 1: `glatt / fein zerdrückt`
- 2: `dick püriert / weich zerdrückt`
- 3: `weich-stückig / Fingerfood`
- 4: `weiche Familienkost`

Diese lineare Zuordnung kollidiert mit der freigegebenen Parallelität von Brei und geeignetem frühen BLW/Fingerfood.

### 3. `skillRequirement` ist derzeit nur Hinweis

Bei Rezeptkarten wird `skillRequirement` als Hinweis unter `Sicher anbieten` ausgegeben. Es fließt aktuell nicht in `unlocked` ein.

Daraus folgt: Das aktuelle technische Problem ist primär die pauschale `stage`-/`textureStage`-Kopplung, nicht `skillRequirement` als aktive Sperre.

### 4. Auch FOOD-Folgeformen sind an Stage 3 gekoppelt

`followUpPreparationOptions()` bietet `fingerfood` nur an, wenn `textureStage >= 3` und der `safeForm`-Text passende Begriffe enthält.

Dadurch kann z. B. eine bereits fachlich sichere greifbare Darreichungsform technisch zu spät angeboten werden.

### 5. Safe-Form-Daten enthalten bereits parallele frühe Darreichungsformen

Beispiele im aktuellen FOOD-Sicherheitsaudit:

- Banane: zerdrücken **oder** als weiches gut greifbares Stück anbieten
- Avocado: zerdrücken **oder** als weiche gut greifbare Spalte anbieten
- Gurke: längliche gut greifbare Stücke; alternativ reiben/zerdrücken

Die Datenbasis selbst kennt also bereits parallele Darreichungswege. Die lineare Texturstufenlogik bildet diese Information aktuell nicht sauber ab.

### 6. Mahlzeitenphase und Konsistenz sind bereits konzeptionell getrennt

`VERSION.json` beschreibt Phasenmodell-v2 ausdrücklich so, dass Beikostphase, Mengenorientierung und Konsistenz getrennte Dimensionen sind. Diese Trennung soll erhalten und für Handling/Darreichung konsequent fortgeführt werden.

## Abgrenzung zu PLAN-08

`refactor/plan-08-food-presentation-contract` behandelt die Darstellung/Benennung bereits ausgewählter FOOD-Mahlzeiten. Der dortige Presentation Contract verändert ausdrücklich nicht die Planner-Auswahl.

Handling Readiness ist daher ein eigener Arbeitsstrang und darf nicht in PLAN-08 vermischt werden.

## Prüfblock A – vollständiges Daten-Audit

Alle aktiven Rezepte systematisch erfassen und mindestens nach folgenden Merkmalen auswerten:

- `name`
- `category`
- `stage`
- `skillRequirement`
- `hardMinMonths` / `minMonths`
- `requires`, `oneOf`, `alternatives`
- Zubereitung/Darreichungsform aus `note`
- tatsächliche notwendige motorische Voraussetzung
- potenziell ab Beikostreife geeignete sichere Form

Zielgruppen für das Audit:

1. Brei/Löffelgerichte
2. weiches grobes/zerdrücktes Essen
3. frühes gut greifbares Fingerfood
4. kompaktes weiches Fingerfood wie Pancakes/Omelettstreifen
5. kleine Stücke / Pinzettengriff-relevante Formen
6. Familiengerichte/Backwaren mit tatsächlich höherer Handling-Anforderung

Ergebnis: Liste aller Rezepte, deren aktuelle `stage` wahrscheinlich nur wegen der Darreichungsform zu hoch ist.

## Prüfblock B – FOOD-Safe-Form-Audit

Für alle aktiven Lebensmittel prüfen:

- Welche `safeForm` enthält mehrere parallele sichere Formen?
- Welche davon sind Brei/Löffel?
- Welche davon sind frühes grobes Fingerfood?
- Welche benötigen tatsächlich spätere feinmotorische Fähigkeiten?
- Wo unterdrückt `followUpPreparationOptions()` heute eine sichere Form nur wegen `textureStage < 3`?

Keine Steuerlogik aus beliebigem Freitext ableiten. Bestehende Safe-Form-Texte dienen zunächst nur als Auditquelle.

## Prüfblock C – technische Verwendungsstellen

Vollständig erfassen, wo folgende Felder/Funktionen steuernd wirken:

- `textureStage`
- `recipe.stage`
- `skillRequirement`
- `textureName()`
- `followUpPreparationOptions()`
- `recipeStatesCore()`
- Rezeptkandidaten im Planner, die `recipeStates().filter(r => r.unlocked)` verwenden
- Logging von `textureStage`
- Textur-Coach und automatische Vorschläge zum Stufenwechsel
- Migration/Persistenz von `textureStage`

Zusätzlich prüfen, ob parallele Arbeitsbranches bereits auf diesen Stellen Änderungen enthalten, bevor später implementiert wird.

## Sollmodell – erst nach Audit technisch festlegen

Die Implementierung soll mindestens folgende Dimensionen getrennt halten:

### A. Mahlzeitenphase

Bleibt verantwortlich für aktive Mahlzeitenslots und bereits freigegebene phasenbezogene Regeln.

### B. Lebensmittel-/Alters-/Sicherheitseignung

Bestehende Dimensionen wie `autoPlan`, `minPhase`, `minAgeMonths`, Mahlzeiteneignung und sichere Zubereitung bleiben eigenständig.

### C. Darreichungs-/Handlingform

Nicht linear als `Brei -> Fingerfood` modellieren.

Mindestens fachlich unterscheiden:

- löffelbar/glatt
- weich zerdrückt/grob
- weiches gut greifbares Fingerfood ab Beikostreife
- kleine Stücke bzw. Formen mit zusätzlicher feinmotorischer Voraussetzung

Ob hierfür ein neues strukturiertes Feld, mehrere zulässige Modi oder eine andere migrationssichere Repräsentation verwendet wird, wird erst nach dem Audit entschieden.

### D. Nutzerpräferenz

Geplante Auswahl:

- `spoon` / Brei-Löffel
- `blw` / Fingerfood
- `mixed` / gemischt

Diese Angabe soll den Planner bevorzugend steuern, aber keine fachlich sichere Form fälschlich als Entwicklungsstufe deklarieren.

Vor Implementierung prüfen:

- wo die Einstellung in der UI am sinnvollsten liegt
- welcher Default migrationssicher ist
- ob `mixed` als konservativer Default für bestehende Nutzer geeignet ist
- wie bestehende Pläne/Locks dadurch unverändert bleiben

## Konkreter Referenzfall: Bananen-Ei-Pancakes

Das fehlende Rezept `Bananen-Ei-Pancakes` dient als Regression-/Referenzfall, wird aber in diesem Plan-Commit noch nicht angelegt.

Spätere Anforderungen:

- eigenes Rezept aus Banane + Ei
- kein Hafer als Pflichtzutat
- vollständig durchgaren
- weich halten
- gut greifbare sichere Form
- nicht allein wegen `pancakes` oder `Fingerfood` auf eine spätere Texturstufe sperren
- tatsächliche Freigabe aus Zutatenstatus + Sicherheit + passender Darreichungsform ableiten

## Weitere Referenzfälle

Mindestens prüfen:

- Omelettstreifen
- Weiches Rührei
- Avocado-Banane
- Karotte-Süßkartoffel-Brei
- Zucchini-Kartoffel-Brei
- Obst-Hafer-Pancakes
- Birne-Hirse-Pancakes
- Brokkoli-Kartoffel-Taler
- Polenta-Zucchini-Sticks
- Süßkartoffel-Hirse-Sticks
- geeignete einzelne FOODs wie Banane, Avocado, Karotte, Brokkoli und Gurke

## Regressionen, die später zwingend abzudecken sind

### P0

1. Phase 1 darf weiterhin ausschließlich die freigegebenen Mahlzeitenslots steuern.
2. Ein geeignetes weiches Fingerfood darf nicht allein deshalb gesperrt sein, weil `textureStage < 3`.
3. Ein tatsächlich feinmotorisch anspruchsvolles Rezept darf nicht versehentlich zu früh freigegeben werden.
4. Alters-/Sicherheitsgrenzen (`hardMinMonths`, `minAgeMonths`, `autoPlan=false`) bleiben wirksam.
5. Zutaten müssen weiterhin entsprechend der bestehenden Rezeptfreigabe bekannt/geeignet sein.
6. Bestehende PLAN-07-Mahlzeiteneignung darf nicht umgangen werden.
7. Bestehende Pläne, Locks und Nutzerlogs dürfen durch neue Präferenzfelder nicht verloren gehen.

### P1

1. `Brei/Löffel` bevorzugt passende löffelbare Formen.
2. `BLW/Fingerfood` bevorzugt passende sichere greifbare Formen.
3. `gemischt` lässt beide Formen parallel zu.
4. Nutzer können eine andere sichere Form manuell wählen, ohne ihre Beikostphase ändern zu müssen.
5. Rezeptkarten erklären Sicherheit/Handling verständlich, ohne eine falsche lineare Entwicklungsstufe zu behaupten.

### P2

1. Textur-Coach wird semantisch überprüft und ggf. so umgebaut, dass er Texturentwicklung begleitet, aber BLW nicht als Stage 3 definiert.
2. Statistik/Logging kann Darreichungsform getrennt von Mahlzeitenphase und ggf. Textur erfassen, falls dies für spätere Empfehlungen benötigt wird.

## Nicht Teil des ersten Implementierungsschritts

- keine pauschale Neueinstufung aller Rezepte ohne Audit
- keine automatische Ableitung von Steuerlogik aus `safeForm`-Freitext
- keine Änderung des freigegebenen Vier-Phasen-Mahlzeitenmodells
- keine neue Ernährungsregel für bestimmte Lebensmittelkombinationen
- keine Vermischung mit PLAN-08-Darstellungslogik
- keine Änderung an Bananen-Ei-Pancakes im Plan-Commit selbst

## Empfohlene Umsetzungsreihenfolge nach Planfreigabe

1. Vollständiges Audit + maschinenlesbare Befundliste erstellen.
2. Soll-Datenmodell für Handling/Darreichung festlegen und migrationssicher prüfen.
3. Regressionstests zuerst schreiben.
4. Lineare Fingerfood-Sperre aus den betroffenen Pfaden lösen, ohne Alters-/Sicherheitslogik abzuschwächen.
5. Nutzerpräferenz `Brei / BLW / gemischt` ergänzen.
6. Rezept- und FOOD-Daten anhand des Audits einzeln korrigieren.
7. Bananen-Ei-Pancakes als Referenzrezept ergänzen.
8. Vollständige Regression gegen Phasenmodell, Planner, Allergene, Persistenz und UI durchführen.

## Status dieses Branches nach diesem Commit

Nur Dokumentation/Planung. Keine Produktivdatei verändert. Keine Rezeptdaten verändert. Keine Versionserhöhung vorgesehen.
