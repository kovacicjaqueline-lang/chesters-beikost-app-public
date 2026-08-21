# Texture Progression Coach – Umsetzungsvorschlag

Stand: 2026-08-21  
Status: fachlich-technischer Umsetzungsvorschlag, noch keine Produktivlogik  
Ausgangsbasis: `main` `a4f33a663721442cd38ad01bb9f7836c9cafcaf6`, Version `10.1.26`

## Ziel

Die App soll den Übergang von glatter Löffelkost zu zunehmend strukturierter Löffelkost aktiv begleiten, ohne erneut eine lineare Entwicklung `Brei -> Fingerfood` einzuführen.

Der bestehende Handling-/Oral-Processing-Unterbau bleibt maßgeblich:

- **Löffeltextur** bleibt die eigene `textureStage`-Dimension.
- **Darreichungsform** bleibt über Handlingmodi getrennt.
- **Fingerfood** bleibt parallel möglich und wird nicht zu einer späteren Texturstufe.
- **Kleine weiche Stücke** und **strukturiertes Kauen** bleiben an die bestehenden beobachteten Capabilities gebunden.
- Die App empfiehlt kleine nächste Übungsschritte, schaltet aber nichts allein aufgrund von Alter, Zeitablauf oder Zählerständen automatisch frei.

## Ausgangslage im aktuellen main

### 1. Handling und Fingerfood sind bereits getrennt

Der aktuelle Contract unterscheidet:

- `spoon-smooth`
- `spoon-mashed`
- `spoon-soft-lumpy`
- `finger-graspable`
- `finger-small-soft`

Dazu kommen unabhängig:

- `small-soft-pieces`
- `structured-chew`

Alle 103 Laufzeitrezepte sind bereits in den strukturierten Rezept-Contract migriert. Bei Einzel-FOODs ist die strukturierte Handling-Migration dagegen noch nicht vollständig; bestehende Legacy-FOODs dürfen durch diesen Vorschlag nicht implizit neu klassifiziert werden.

### 2. Der aktuelle Textur-Coach verwendet zu grobe Evidenz

`textureSuccessCount()` zählt positive FOOD-Ergebnisse auf der aktuellen `textureStage` als positive Texturerfahrungen.

Damit kann ein Eintrag als Texturerfolg zählen, obwohl er nur aussagt, dass ein Lebensmittel gegessen oder probiert wurde. Lebensmittelakzeptanz und tatsächliche Bewältigung einer Löffelstruktur sind unterschiedliche Informationen.

### 3. `textureStage` ordnet geeignete Löffelmodi noch nicht passend

Die Handling-Eligibility berücksichtigt `textureStage` derzeit nur als Gate für `spoon-soft-lumpy`.

Ein bereits strukturierter FOOD-Contract mit

```text
spoon-smooth, spoon-mashed, finger-graspable
```

kann daher auch bei `textureStage = 2` weiterhin `spoon-smooth` als bevorzugte Löffelform liefern.

### 4. Das Log trennt Darreichungsform und Löffeltextur noch nicht vollständig

Bei positiven FOOD-Outcomes verlangt das Protokoll derzeit grundsätzlich eine `textureStage`.

Für frühes Fingerfood ist das semantisch unsauber: Ein tatsächlich als `finger-graspable` angebotenes Lebensmittel soll nicht künstlich einer Löffelstufe zugeordnet werden und anschließend die Löffeltextur-Progression beeinflussen.

### 5. Der Home-Coach zeigt nur eine lineare Texturleiste

Die Home-Karte zeigt `Stufe 1 -> 2 -> 3 -> 4`, aber nicht sichtbar den parallelen Weg geeigneten Fingerfoods.

## Sollbild

Die Home-Karte wird zu **„Konsistenz & Essform“**.

Sie zeigt zwei getrennte Wege.

### A. Löffelstruktur

Beispiel:

```text
Aktuelle Löffelstruktur
Stufe 1 · glatt / fein

Nächster kleiner Schritt
Eine kleine Teilportion etwas dicker oder weich zerdrückt anbieten.
```

### B. Parallele Essform

Wenn für eine aktuelle oder nächste konkrete Mahlzeit ein strukturierter `finger-graspable`-Modus fachlich verfügbar ist:

```text
Parallel möglich
Weiches, gut greifbares Fingerfood
```

Diese Information ist **kein nächster Level-Schritt** und darf nicht hinter `textureStage >= 3` versteckt werden.

Wenn keine passende konkrete strukturierte Mahlzeit existiert, wird kein generischer Fingerfood-Hinweis erzeugt.

## Produktsemantik

### Keine automatische Progression

`textureStage` wird niemals automatisch erhöht aufgrund von:

- Alter;
- Zeitablauf;
- Beikostphase;
- Feeding-Präferenz;
- Lebensmittelanzahl;
- FOOD-Outcomes;
- Anzahl positiver Texturerfahrungen.

Der Wechsel bleibt eine Nutzerentscheidung.

### Kein fixer Zeitplan

Keine Regeln wie „nach sieben Tagen wechseln“, „ab acht Monaten stückig“ oder „erst Brei, dann Fingerfood“.

Stattdessen: kleine Tests, vertraute Konsistenzen parallel möglich.

### Fingerfood bleibt parallel

`feedingApproach` behält seine bestehende Bedeutung:

- `spoon`: geeignete Löffelformen bevorzugen;
- `fingerfood`: geeignete Fingerfoodformen bevorzugen;
- `mixed`: beide Wege zulassen.

Keine Safety-, Handling- oder Oral-Capability darf dadurch umgangen werden.

### Capabilities bleiben beobachtet

`smallSoftPieces` und `structuredChew` werden nie aus Logs, Alter, `textureStage` oder `feedingApproach` automatisch abgeleitet.

## Änderung 1 – tatsächliche Darreichungsform im Log nutzen

`presentationMode` existiert bereits für automatische Mahlzeiten und Logs. Diese Dimension soll im tatsächlichen Protokoll konsequenter verwendet werden, **aber nur dort, wo eine strukturierte Handling-Eligibility vorhanden ist**.

### Vollständig migrierte Rezepte

Für Rezeptlogs wird die tatsächlich angebotene Darreichungsform aus dem bestehenden Rezept-Contract angezeigt bzw. gewählt.

Beispiel:

```text
Darreichungsform
○ Weich zerdrückt
○ Weiches Fingerfood
```

Regeln:

- geplantes `presentationMode` vorauswählen;
- nur andere bereits geeignete Modi anbieten;
- Capability-gesperrte Modi nicht auswählbar machen;
- keine Modi aus Freitext erzeugen;
- Safety-/Serving-Guidance unabhängig erhalten.

### Strukturierte FOOD-only-Mahlzeiten

Nur wenn alle für die tatsächliche Mahlzeit relevanten FOODs über strukturierte Handlingdaten verfügen und eine gemeinsame geeignete Form bestimmt werden kann, gilt dieselbe Logik.

### Legacy-FOOD-Fallback

Bei FOOD-only-Logs ohne vollständigen strukturierten Handling-Contract bleibt der bestehende konservative Log-Pfad erhalten.

Das bedeutet für den ersten Umsetzungsschritt:

- kein neues `presentationMode` erzwingen;
- bestehende `textureStage`-Erfassung nicht automatisch entfernen;
- solche Legacy-Logs **nicht** als neue explizite Löffeltextur-Evidenz für den Coach interpretieren;
- keine Darreichungsform aus `safeForm`-Freitext, Kategorie oder Alter ableiten.

Damit wird die bestehende Nutzung nicht blockiert und eine spätere Einzelmigration der FOODs bleibt möglich.

### Löffeltextur bei strukturierten Modi

Wenn ein strukturierter tatsächlicher Modus vorliegt:

- bei `spoon-*` wird `textureStage` als Löffelstruktur erfasst;
- bei `finger-graspable` oder `finger-small-soft` wird keine künstliche Löffelstufe verlangt.

Alte Logs werden rückwirkend nicht umgedeutet.

## Änderung 2 – echte Löffeltexturerfahrung protokollieren

Neues optionales Log-Feld:

```js
textureExperience: "comfortable" | "learning"
```

Bedeutung:

- `comfortable`: Mit der tatsächlich angebotenen Löffelstruktur kam das Kind gut zurecht.
- `learning`: Die Struktur ist noch ungewohnt und soll weiter in kleinen Mengen geübt werden.

Das ist keine medizinische Sicherheitsbewertung und keine Lebensmittelakzeptanz.

### UI

Nur bei **strukturiert bestätigtem `spoon-*`-Handling** und dokumentierter `textureStage`:

```text
Wie hat die Löffelstruktur geklappt?
○ Gut zurechtgekommen
○ Noch ungewohnt
○ Nicht beurteilen
```

„Nicht beurteilen“ speichert kein `textureExperience`.

Bei Legacy-FOOD-Logs ohne strukturierten Modus wird diese neue Frage im MVP nicht als Progressionssignal verwendet.

Freitextnotizen oder Symptome werden nicht automatisch in Safety-, Capability- oder Progressionsentscheidungen übersetzt.

## Änderung 3 – Textur-Evidenz semantisch korrigieren

`textureSuccessCount()` wird nicht mehr aus `logPositiveOutcome()` gespeist.

Neue rein beschreibende Auswertung, z. B.:

```js
textureComfortCount(stage)
textureLearningCount(stage)
```

Gezählt werden nur explizit strukturierte Löffellogs:

```js
handlingModeFamily(log.presentationMode) === "spoon"
log.textureStage === stage
log.textureExperience === "comfortable"
```

bzw. `"learning"`.

Nicht gezählt werden:

- FOOD-Outcomes ohne `textureExperience`;
- Fingerfood-Logs;
- Legacy-Logs ohne strukturiertes `presentationMode`;
- rückwirkend geschätzte Altwerte.

Die Zähler sind **keine Eligibility-Gates**.

Erlaubte Copy:

```text
Diese Stufe: 3-mal gut zurechtgekommen · 1-mal noch ungewohnt
```

Nicht erlaubt:

```text
Jetzt bereit für Stufe 2
```

## Änderung 4 – Löffelmodus an `textureStage` ausrichten

Nur die Reihenfolge **bereits geeigneter** Löffelmodi wird geändert. Eligibility bleibt unverändert.

Zentrale Hilfsfunktion, z. B.:

```js
spoonModePreference(textureStage)
```

| `textureStage` | bevorzugte Löffelmodi |
| --- | --- |
| 1 | `spoon-smooth` -> `spoon-mashed` |
| 2 | `spoon-mashed` -> `spoon-smooth` |
| 3 | `spoon-soft-lumpy` -> `spoon-mashed` -> `spoon-smooth` |
| 4 | `spoon-soft-lumpy` -> `spoon-mashed` -> `spoon-smooth` |

Für Stufe 4 wird kein neuer Handlingmodus eingeführt. `weiche Familienkost` bleibt breiter; die kanonische FOOD-/Rezeptform bleibt maßgeblich.

### Zusammenspiel mit `feedingApproach`

1. bestehende Eligibility;
2. `feedingApproach` bestimmt die bevorzugte Familie;
3. innerhalb der Löffelfamilie ordnet `textureStage` die geeigneten Löffelmodi;
4. Fingerfood-Reihenfolge bleibt contractbasiert.

Für `mixed` bleibt die Familienneutralität erhalten; nur mehrere Löffelmodi werden untereinander an `textureStage` ausgerichtet.

Beispiel:

```text
Contract: smooth, mashed, finger
mixed + Stage 2 -> mashed, smooth, finger
spoon + Stage 2 -> mashed, smooth, finger
fingerfood + Stage 2 -> finger, mashed, smooth
```

Kein Modus wird dadurch neu eligible.

## Änderung 5 – Coach statt Schwellenautomat

### Stufe 1 -> 2

```text
Nächster kleiner Schritt
Eine kleine Teilportion weniger fein bzw. weich zerdrückt anbieten.
Vertraute Konsistenzen dürfen parallel bleiben.
```

### Stufe 2 -> 3

```text
Nächster kleiner Schritt
Bei einer geeigneten Löffelmahlzeit kleine weiche Stückchen testen.
```

### Stufe 3 -> 4

Nicht als bloß „noch gröbere Löffelstufe“ darstellen.

Stufe 4 ist breiter und familiennäher. Eine konkrete Testidee erscheint nur, wenn eine bereits geeignete geplante FOOD-/Rezeptform dafür vorhanden ist.

```text
Familiennahe weiche Struktur ausprobieren
Bei der nächsten geeigneten Mahlzeit eine bereits freigegebene weiche Originalform anbieten.
```

Kein neuer Handlingmodus und keine pauschale Freigabe von Familienessen.

### Erfahrung statt Freigabeampel

Explizite `textureExperience`-Logs werden nur beschreibend zusammengefasst. Es gibt keinen harten Mindestzähler.

### Aktionen

- `Testidee ansehen`
- `Stufe X als Standard verwenden`
- `Zurück` bei Stufe > 1

`Testidee ansehen` verändert keinen Zustand.

Nur `Stufe X als Standard verwenden` ändert `textureStage` explizit.

Ein persistentes `trialStage` ist im MVP nicht nötig.

## Änderung 6 – paralleles Fingerfood sichtbar machen

Eine konkrete parallele Fingerfood-Option wird nur gezeigt, wenn sie aus der bestehenden strukturierten Eligibility einer tatsächlich geplanten Mahlzeit hervorgeht.

Verbindliche Grenzen:

- nur strukturierte `finger-graspable`-Eligibility;
- kein Parsing von `safeForm`-Freitext;
- `finger-small-soft` nur bei `smallSoftPieces`;
- `structured-chew-required` nur bei `structuredChew`;
- keine neue Ableitung für unmigrierte Legacy-FOODs;
- Sample-/Einführungsmahlzeiten, manuelle Locks und Planner-Sonderfälle nicht umgehen.

Technisch soll der Coach dieselbe zentrale Handling-Eligibility verwenden wie der Planner, aber über eine **nicht mutierende Alternative-Modes-Abfrage**.

Die Funktion baut keine Mahlzeit neu, verändert keinen Lock und ersetzt keine Rezeptidentität.

Ohne passende konkrete strukturierte Mahlzeit erscheint kein Ersatzhinweis.

## Datenmodell und Migration

### Neu

Optional:

```js
textureExperience
```

`presentationMode` bleibt das bestehende Feld und wird nur für tatsächlich strukturierte Fälle konsequenter verwendet.

### Keine rückwirkende Ableitung

Aus alten Logs werden weder `presentationMode` noch `textureExperience` rekonstruiert.

### Bestehende Daten bleiben gültig

- Logs ohne `textureExperience`;
- Logs ohne `presentationMode`;
- Legacy-FOOD-Logs;
- bestehende `textureStage` und `textureStageSince`;
- bestehende `feedingApproach`;
- bestehende `handlingCapabilities`;
- bestehende Plan-Locks.

Eine Storage-Schemaerhöhung ist für additive Felder voraussichtlich nicht nötig.

## Technische Zielstellen

Voraussichtlich betroffen:

- `js/ui.js`
  - `textureSuccessCount()` ersetzen;
  - `renderTextureCoach()` in zwei Wege aufteilen;
  - `openTextureAdvance()` semantisch schärfen.
- `js/log.js`
  - strukturiertes tatsächliches `presentationMode` anzeigen/auswählen;
  - bei strukturierten Fingerfood-Logs keine Löffelstufe erzwingen;
  - Legacy-FOOD-Fallback erhalten;
  - `textureExperience` erfassen/bearbeiten;
  - Darreichungsform in der Log-Anzeige ergänzen.
- `js/handling-readiness.js`
  - stageabhängige Löffelreihenfolge;
  - nicht mutierende Abfrage geeigneter Modi für Coach/Log;
  - keine Eligibility-Regel lockern.
- `js/log-core.js`
  - gemeinsame Helper nur falls sinnvoll.
- `js/state.js` / Migration
  - Kompatibilität prüfen, keine Pflichtfelder.
- passende Node- und Browser-Regressionen.

## Nicht Teil dieses Vorschlags

- keine neue Beikostphase;
- keine Gruppenmigration bestehender FOODs;
- keine neue Rezept-/FOOD-Einstufung;
- keine Änderung von `hardMinMonths`, `minMonths`, `autoPlan` oder Mahlzeiteneignung;
- keine automatische Capability-Erkennung;
- keine automatische Stufenerhöhung;
- kein fixer Wochenplan;
- kein täglicher Fingerfood-Zwang;
- keine Ableitung aus `safeForm`-Freitext;
- keine neue medizinische Bewertungslogik;
- keine Statistik-Neukonzeption;
- keine Schemaerhöhung ohne technischen Zwang.

## Regressionen / Akzeptanzkriterien

### P0 – Trennung und Kompatibilität

1. FOOD-Outcomes ohne `textureExperience` zählen nicht als Texturerfolg.
2. Strukturierte Fingerfood-Logs zählen nicht zur Löffeltextur-Progression.
3. Ein strukturierter positiver Fingerfood-Log benötigt keine künstliche Löffel-`textureStage`.
4. Ein strukturierter `spoon-*`-Log kann `textureStage` plus optional `textureExperience` dokumentieren.
5. Ein alter Log ohne `presentationMode` oder `textureExperience` bleibt gültig.
6. Ein Legacy-FOOD-Log ohne Handling-Contract bleibt speicher- und editierbar.
7. Legacy-FOOD-Logs erzeugen keine erfundene neue Progressions-Evidenz.
8. Aus alten Daten wird nichts rückwirkend abgeleitet.
9. `textureExperience = learning` erhöht keine Stufe und setzt keine Capability.
10. Kein Alter, keine Phase und kein Zähler erhöht `textureStage` automatisch.

### P0 – Handling und Planner

11. Karotte mit `feedingApproach = spoon`, `textureStage = 1` bevorzugt `spoon-smooth`.
12. Karotte mit `feedingApproach = spoon`, `textureStage = 2` bevorzugt `spoon-mashed`.
13. Karotte mit `feedingApproach = fingerfood`, `textureStage = 1` bevorzugt weiterhin `finger-graspable`.
14. `spoon-soft-lumpy` bleibt unterhalb der vorgesehenen Texturstufe nicht eligible.
15. `smallSoftPieces` und `structuredChew` bleiben unabhängige harte Voraussetzungen.
16. Reihenfolgeänderungen verändern keine Rezeptidentität, FOOD-Auswahl, Rollen oder Locks.
17. Coach-Alternativmodi umgehen keine Sample-/Einführungs- oder Lock-Semantik.
18. Unmigrierte FOODs erhalten keine neue Gruppen- oder Freitextklassifikation.

### P1 – Log-UX

19. Geplantes strukturiertes `presentationMode` wird vorausgewählt.
20. Nutzerin kann nur auf andere bereits geeignete strukturierte Modi wechseln.
21. Capability-gesperrte Modi sind nicht auswählbar.
22. Legacy-FOODs bleiben im bisherigen konservativen Log-Pfad.
23. `textureExperience` kann gespeichert und bearbeitet werden.
24. „Nicht beurteilen“ speichert keinen künstlichen Wert.
25. FOOD-Outcomes, `presentationMode`, `textureStage` und `textureExperience` bleiben getrennte Felder.

### P1 – Coach-UI

26. Coach zeigt Löffelstruktur und paralleles Fingerfood getrennt.
27. `Testidee ansehen` verändert `textureStage` nicht.
28. Erst `Stufe X als Standard verwenden` verändert `textureStage`.
29. Erfahrungszähler werden nicht als Bereitschaftsnachweis bezeichnet.
30. Stage 3 -> 4 wird nicht als bloße gröbere Löffelstufe dargestellt.
31. Ohne konkrete geeignete strukturierte `finger-graspable`-Mahlzeit entsteht kein Fingerfood-Hinweis.

## Testmatrix bei späterer Implementierung

Da Produktivlogik, Datenfluss und UI betroffen wären:

1. gezielte Node-Tests für Log-Semantik, Legacy-Fallback, Texture-Evidence und Handling-Reihenfolge;
2. gezielte UI-/Browser-Tests für Log und Coach;
3. `npm run verify:fast`;
4. `npm run verify:app`;
5. kein `verify:deploy`, solange keine Deployment-Datei verändert wird;
6. `npm run verify` nur bei zusätzlichem Querschnitts-/Release-Scope.

## Empfohlene Umsetzungsreihenfolge

### Schritt 1 – Log-Semantik und Legacy-Fallback

- strukturiertes `presentationMode` im tatsächlichen Log führen;
- strukturierte Fingerfood-Logs nicht zu einer Löffelstufe zwingen;
- Legacy-FOOD-Pfad erhalten;
- `textureExperience` additiv einführen;
- Alt-Daten-Kompatibilität absichern.

### Schritt 2 – Textur-Evidenz

- FOOD-Outcomes aus der Progressionsauswertung entfernen;
- nur explizite strukturierte `spoon-*`-Texturerfahrungen zählen;
- keine Schwellenfreigabe.

### Schritt 3 – Handling-Präferenz

- stageabhängige Reihenfolge der Löffelmodi zentral ergänzen;
- Eligibility unverändert lassen;
- Multi-Mode-Referenzfälle absichern.

### Schritt 4 – Coach

- duale Darstellung `Löffelstruktur` + `parallel mögliche Essform`;
- Testidee ohne Zustandsmutation;
- Stufe 3 -> 4 separat behandeln;
- Fingerfood-Hinweis nur aus bestehender strukturierter Meal-/Handling-Eligibility.

## Erwarteter Nutzen

Die App unterstützt danach den nächsten sinnvollen Schritt, ohne ihre getrennten Dimensionen wieder zu vermischen:

- vertraute Löffelstruktur bleibt möglich;
- anspruchsvollere Löffelstruktur kann in kleiner Menge getestet werden;
- geeignetes Fingerfood kann parallel sichtbar werden;
- tatsächliche Darreichungsform wird dort korrekt erfasst, wo sie strukturiert bekannt ist;
- Legacy-FOODs bleiben kompatibel statt implizit neu klassifiziert zu werden;
- Löffeltexturerfahrung bleibt getrennt von Geschmack, Verträglichkeit und Fingerfood;
- keine automatische „Bereitschaft“ aus Alter oder Zählerstand.
