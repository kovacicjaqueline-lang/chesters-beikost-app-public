# Texture Progression Coach – Umsetzungsvorschlag

Stand: 2026-08-21  
Status: fachlich-technischer Umsetzungsvorschlag, noch keine Produktivlogik  
Ausgangsbasis: `main` `a4f33a663721442cd38ad01bb9f7836c9cafcaf6`, Version `10.1.26`

## Ziel

Die App soll den Übergang von glatter Löffelkost zu zunehmend strukturierter Löffelkost aktiv begleiten, ohne erneut eine lineare Entwicklung `Brei -> Fingerfood` einzuführen.

Dafür wird der bestehende Handling-/Oral-Processing-Unterbau beibehalten und um eine kleine Empfehlungsschicht ergänzt:

- **Löffeltextur** bleibt die eigene `textureStage`-Dimension.
- **Darreichungsform** bleibt über die bestehenden Handlingmodi getrennt.
- **Fingerfood** bleibt parallel möglich und wird nicht zu einer späteren Texturstufe.
- **Kleine weiche Stücke** und **strukturiertes Kauen** bleiben ausschließlich an die bestehenden beobachteten Capabilities gebunden.
- Die App empfiehlt kleine nächste Übungsschritte, schaltet aber nichts allein aufgrund von Alter, Zeitablauf oder Zählerständen automatisch frei.

## Ausgangslage im aktuellen main

### 1. Handling und Fingerfood sind bereits sauber getrennt

Der aktuelle Contract unterscheidet:

- `spoon-smooth`
- `spoon-mashed`
- `spoon-soft-lumpy`
- `finger-graspable`
- `finger-small-soft`

Dazu kommen die unabhängigen Capabilities:

- `small-soft-pieces`
- `structured-chew`

Diese Trennung bleibt unverändert.

### 2. Der aktuelle Textur-Coach verwendet zu grobe Evidenz

`textureSuccessCount()` zählt positive FOOD-Ergebnisse auf der aktuellen `textureStage` als positive Texturerfahrungen.

Damit kann ein Eintrag als Texturerfolg gezählt werden, obwohl die positive Bewertung nur bedeutet, dass ein Lebensmittel gegessen oder probiert wurde. Lebensmittelakzeptanz und tatsächliche Bewältigung einer Löffelstruktur sind unterschiedliche Informationen.

### 3. `textureStage` ordnet geeignete Löffelmodi noch nicht passend

Die Handling-Eligibility berücksichtigt `textureStage` derzeit nur als Gate für `spoon-soft-lumpy`.

Innerhalb bereits geeigneter Löffelformen bleibt die Reihenfolge aus dem Contract bestehen. Ein FOOD mit

```text
spoon-smooth, spoon-mashed, finger-graspable
```

kann daher auch bei `textureStage = 2` weiterhin `spoon-smooth` als bevorzugte Löffelform liefern.

### 4. Das aktuelle Log trennt Darreichungsform und Löffeltextur noch nicht vollständig

Bei positiven FOOD-Outcomes verlangt das Protokoll derzeit grundsätzlich eine `textureStage`.

Das ist für frühes Fingerfood semantisch problematisch: Ein tatsächlich als `finger-graspable` angebotenes Lebensmittel soll nicht künstlich einer Löffelstufe zugeordnet werden müssen und anschließend die Löffeltextur-Progression beeinflussen.

### 5. Der Home-Coach zeigt nur eine lineare Texturleiste

Die Home-Karte zeigt aktuell `Stufe 1 -> 2 -> 3 -> 4`.

Das kann die Entwicklung der Löffelstruktur begleiten, macht aber nicht sichtbar, dass geeignetes greifbares Fingerfood parallel bereits bei niedriger `textureStage` möglich sein kann.

## Sollbild

Die Home-Karte wird semantisch von **„Konsistenz“** zu **„Konsistenz & Essform“** erweitert.

Sie zeigt zwei getrennte Wege:

### A. Löffelstruktur

Beispiel:

```text
Aktuelle Löffelstruktur
Stufe 1 · glatt / fein

Nächster kleiner Schritt
Eine kleine Teilportion etwas dicker oder weich zerdrückt anbieten.
```

### B. Parallele Essform

Wenn für eine aktuelle oder nächste geeignete Mahlzeit ein `finger-graspable`-Modus fachlich verfügbar ist:

```text
Parallel möglich
Weiches, gut greifbares Fingerfood
```

Diese Information ist **kein nächster Level-Schritt** und darf nicht hinter `textureStage >= 3` versteckt werden.

Wenn keine passende konkrete Mahlzeit existiert, wird kein generischer täglicher Fingerfood-Zwang erzeugt.

## Produktsemantik

### 1. Keine automatische Progression

Die App darf `textureStage` nicht automatisch erhöhen.

Insbesondere kein automatischer Wechsel aufgrund von:

- Alter;
- Anzahl vergangener Tage;
- Beikostphase;
- Feeding-Präferenz;
- Lebensmittelanzahl;
- positiver FOOD-Bewertung;
- Anzahl positiver Texturerfahrungen.

Der Wechsel bleibt eine Nutzerentscheidung.

### 2. Kein fester Zeitplan

Die App formuliert keine Regel wie:

- „nach sieben Tagen wechseln“;
- „ab acht Monaten stückig“;
- „drei Tage Brei, dann Fingerfood“.

Stattdessen empfiehlt sie kleine Tests und lässt vertraute Konsistenzen parallel zu.

### 3. Fingerfood bleibt parallel

`feedingApproach` behält seine bestehende Bedeutung:

- `spoon`: geeignete Löffelformen bevorzugen;
- `fingerfood`: geeignete Fingerfoodformen bevorzugen;
- `mixed`: beide Wege zulassen.

Die Einstellung darf keine Safety-, Handling- oder Oral-Capability umgehen.

### 4. Capabilities bleiben rein beobachtete Fähigkeiten

Der Coach darf weder `smallSoftPieces` noch `structuredChew` automatisch setzen.

Aus Logs, `textureStage`, Alter oder Feeding-Präferenz darf keine dieser Fähigkeiten abgeleitet werden.

## Änderung 1 – tatsächliche Darreichungsform im Log sauber führen

`presentationMode` existiert bereits für automatische Mahlzeiten und Logs. Diese vorhandene Dimension wird für das tatsächliche Protokoll konsequent genutzt.

### Log-UI

Bei einem positiven Essenseintrag wird die **tatsächlich angebotene Darreichungsform** aus den für FOOD/Rezept bereits strukturiert geeigneten Modi angezeigt bzw. gewählt.

Beispiele:

```text
Darreichungsform
○ Fein und glatt vom Löffel
○ Weich zerdrückt
○ Weiches Fingerfood
```

Regeln:

- vorhandenes geplantes `presentationMode` wird vorausgewählt;
- Nutzerin kann die tatsächlich verwendete andere **bereits geeignete** Form auswählen;
- keine neuen Modi aus Freitext erzeugen;
- ein Capability-gesperrter Modus wird nicht auswählbar;
- Safety-/Serving-Guidance bleibt unabhängig wirksam.

### Löffeltextur nur für Löffelmodi

Eine `textureStage` ist bei positiven Logs nur dann erforderlich bzw. als Löffelstruktur zu erfassen, wenn die tatsächliche Darreichungsform zur Familie `spoon-*` gehört.

Für `finger-graspable` und `finger-small-soft` wird keine künstliche Löffelstufe verlangt.

Alte Logs bleiben unverändert gültig; es wird rückwirkend kein `presentationMode` aus `textureStage` erfunden.

## Änderung 2 – echte Löffeltexturerfahrung protokollieren

### Neues optionales Log-Feld

```js
textureExperience: "comfortable" | "learning"
```

Bedeutung:

- `comfortable`: Mit der tatsächlich angebotenen Löffelstruktur kam das Kind gut zurecht.
- `learning`: Die Struktur ist noch ungewohnt und soll weiter in kleinen Mengen geübt werden.

Das Feld beschreibt keine medizinische Sicherheitsbewertung und keine Lebensmittelakzeptanz.

### UI

Nur bei tatsächlichem `spoon-*`-Handling und dokumentierter `textureStage` erscheint:

```text
Wie hat die Löffelstruktur geklappt?
○ Gut zurechtgekommen
○ Noch ungewohnt
○ Nicht beurteilen
```

„Nicht beurteilen“ speichert kein `textureExperience`.

### Keine automatische Safety-Diagnose

Freitextnotizen, Würgen, Husten oder andere Beobachtungen werden nicht automatisch in Capability-, Safety- oder Progressionsentscheidungen übersetzt.

## Änderung 3 – Textur-Evidenz semantisch korrigieren

`textureSuccessCount()` wird nicht mehr aus `logPositiveOutcome()` gespeist.

Stattdessen wird ausschließlich explizite Löffeltextur-Evidenz ausgewertet, z. B.:

```js
textureComfortCount(stage)
textureLearningCount(stage)
```

Gezählt werden nur Logs, die gleichzeitig erfüllen:

```js
handlingModeFamily(log.presentationMode) === "spoon"
log.textureStage === stage
log.textureExperience === "comfortable"
```

bzw. `"learning"`.

Diese Zähler sind **keine Eligibility-Gates**.

### Badge-Semantik

Erlaubt:

```text
Diese Stufe: 3-mal gut zurechtgekommen · 1-mal noch ungewohnt
```

Nicht erlaubt:

```text
Jetzt bereit für Stufe 2
```

## Änderung 4 – Löffelmodus an `textureStage` ausrichten

Die bestehende Eligibility bleibt unverändert. Es wird nur die Reihenfolge bereits geeigneter Löffelmodi korrigiert.

Neue zentrale Hilfsfunktion, z. B.:

```js
spoonModePreference(textureStage)
```

Empfohlene Reihenfolge:

| `textureStage` | bevorzugte Löffelmodi |
| --- | --- |
| 1 | `spoon-smooth` -> `spoon-mashed` |
| 2 | `spoon-mashed` -> `spoon-smooth` |
| 3 | `spoon-soft-lumpy` -> `spoon-mashed` -> `spoon-smooth` |
| 4 | `spoon-soft-lumpy` -> `spoon-mashed` -> `spoon-smooth` |

Für Stufe 4 wird **kein künstlicher neuer Handlingmodus** eingeführt. `weiche Familienkost` bleibt eine breitere Textur-/Gerichtsebene; die kanonische FOOD-/Rezeptform bleibt maßgeblich.

### Zusammenspiel mit `feedingApproach`

Reihenfolge:

1. bestehende Handling-, Oral-, Safety- und Capability-Eligibility;
2. `feedingApproach` bestimmt die bevorzugte Familie;
3. innerhalb der Löffelfamilie ordnet `textureStage` die geeigneten Löffelmodi;
4. innerhalb der Fingerfoodfamilie bleibt die bestehende Contract-Reihenfolge erhalten.

Für `mixed` bleibt die bestehende Familienneutralität erhalten; nur mehrere Löffelmodi werden untereinander an `textureStage` ausgerichtet.

Beispiel:

```text
Contract: smooth, mashed, finger
mixed + Stage 2 -> mashed, smooth, finger
spoon + Stage 2 -> mashed, smooth, finger
fingerfood + Stage 2 -> finger, mashed, smooth
```

Damit verändert `textureStage` keine Eligibility.

## Änderung 5 – Coach statt Schwellenautomat

### Stufe 1 -> 2

Coach-Idee:

```text
Nächster kleiner Schritt
Eine kleine Teilportion weniger fein bzw. weich zerdrückt anbieten.
Vertraute Konsistenzen dürfen parallel bleiben.
```

### Stufe 2 -> 3

Coach-Idee:

```text
Nächster kleiner Schritt
Bei einer geeigneten Löffelmahlzeit kleine weiche Stückchen testen.
```

### Stufe 3 -> 4

Dieser Übergang wird **nicht** als bloß „noch gröbere Löffelstufe“ dargestellt.

Stufe 4 ist breiter und familiennäher. Der Coach zeigt deshalb nur dann eine konkrete Testidee, wenn eine bereits geeignete geplante FOOD-/Rezeptform dafür vorhanden ist.

Beispiel:

```text
Familiennahe weiche Struktur ausprobieren
Bei der nächsten geeigneten Mahlzeit eine bereits freigegebene weiche Originalform anbieten.
```

Kein neuer Handlingmodus und keine pauschale Freigabe von Familienessen.

### Erfahrung statt Freigabeampel

Vorhandene explizite `textureExperience`-Logs werden nur beschreibend zusammengefasst.

Die App verwendet keinen harten Mindestzähler.

### Aktionen

- `Testidee ansehen`
- `Stufe X als Standard verwenden`
- `Zurück` bei Stufe > 1

`Testidee ansehen` verändert keinen Zustand.

`Stufe X als Standard verwenden` bleibt eine explizite manuelle Änderung von `textureStage`.

Ein neues persistentes `trialStage` ist für den ersten Umsetzungsschritt nicht nötig.

## Änderung 6 – paralleles Fingerfood sichtbar machen

Der Coach soll eine konkrete parallele Fingerfood-Option nur dann zeigen, wenn sie aus der bestehenden strukturierten Eligibility einer tatsächlich geplanten Mahlzeit hervorgeht.

### Verbindliche Grenzen

- nur strukturierte `finger-graspable`-Eligibility verwenden;
- keine Steuerlogik aus `safeForm`-Freitext ableiten;
- `finger-small-soft` nur bei bestätigtem `smallSoftPieces`;
- `structured-chew-required` nur bei bestätigtem `structuredChew`;
- Sample-/Einführungsmahlzeiten, manuelle Locks und bestehende Planner-Sonderfälle nicht durch eine neue Parallelberechnung umgehen.

### Technische Quelle

Der Hinweis soll dieselbe zentrale Handling-Eligibility verwenden wie der Planner, aber als **nicht mutierende Alternative-Modes-Abfrage**.

Die Funktion darf keine neue Mahlzeit bauen, keinen Lock verändern und keine Rezeptidentität ersetzen.

Wenn die nächste offene Mahlzeit keinen passenden sicheren `finger-graspable`-Modus hat, erscheint kein Ersatzhinweis.

## Datenmodell und Migration

### Neu

Optionales Log-Feld:

```js
textureExperience
```

`presentationMode` wird nicht neu erfunden, sondern im bestehenden Datenmodell für die tatsächlich angebotene Form konsequenter verwendet.

### Keine rückwirkende Ableitung

Aus alten Logs werden weder `presentationMode` noch `textureExperience` rekonstruiert.

### Bestehende Daten bleiben gültig

- alte Logs ohne `textureExperience`;
- alte Logs ohne `presentationMode`;
- bestehende `textureStage`;
- bestehende `textureStageSince`;
- bestehende `feedingApproach`;
- bestehende `handlingCapabilities`;
- bestehende Plan-Locks.

Eine Storage-Schemaerhöhung ist für die additiven Felder voraussichtlich nicht nötig.

## Technische Zielstellen

Voraussichtlich betroffen:

- `js/ui.js`
  - `textureSuccessCount()` ersetzen;
  - `renderTextureCoach()` in zwei Wege aufteilen;
  - `openTextureAdvance()` semantisch schärfen.
- `js/log.js`
  - tatsächliches `presentationMode` anzeigen/auswählen;
  - `textureStage` nur für tatsächliche Löffelmodi verlangen;
  - `textureExperience` erfassen und beim Bearbeiten erhalten;
  - Log-Anzeige um tatsächliche Darreichungsform ergänzen.
- `js/handling-readiness.js`
  - stageabhängige Reihenfolge innerhalb der Löffelmodi;
  - zentrale nicht mutierende Abfrage alternativer geeigneter Modi für Coach/Log;
  - keine Eligibility-Regel lockern.
- `js/log-core.js`
  - nur falls gemeinsame Helper für neue Log-Semantik sinnvoll sind.
- `js/state.js` / Migration
  - nur Kompatibilität prüfen;
  - keine Pflichtfelder und keine Alt-Daten-Rekonstruktion.
- passende Node- und Browser-Regressionen.

## Nicht Teil dieses Vorschlags

- keine neue Beikostphase;
- keine neue Rezept- oder FOOD-Einstufung;
- keine Änderung von `hardMinMonths`, `minMonths`, `autoPlan` oder Mahlzeiteneignung;
- keine automatische Capability-Erkennung;
- keine automatische Stufenerhöhung;
- kein fixer Wochenplan;
- kein täglicher Fingerfood-Zwang;
- keine Ableitung aus `safeForm`-Freitext;
- keine neue medizinische Bewertungslogik;
- keine Statistik-Neukonzeption;
- keine neue Storage-Schema-Version ohne technischen Zwang.

## Regressionen / Akzeptanzkriterien

### P0 – Trennung der Dimensionen

1. Ein positives FOOD-Ergebnis ohne `textureExperience` zählt nicht als Texturerfolg.
2. Ein Fingerfood-Log zählt nicht zur Löffeltextur-Progression.
3. Ein positiver Fingerfood-Log benötigt keine künstliche Löffel-`textureStage`.
4. Ein `spoon-*`-Log kann `textureStage` plus optional `textureExperience` dokumentieren.
5. Ein alter Log ohne `presentationMode` oder `textureExperience` bleibt gültig.
6. Aus alten Logs wird nichts rückwirkend erfunden.
7. `textureExperience = learning` erhöht keine Stufe und setzt keine Capability.
8. Kein Alter, keine Phase und kein Zähler erhöht `textureStage` automatisch.

### P0 – Handling und Planner

9. Karotte mit `feedingApproach = spoon`, `textureStage = 1` bevorzugt `spoon-smooth`.
10. Karotte mit `feedingApproach = spoon`, `textureStage = 2` bevorzugt `spoon-mashed`.
11. Karotte mit `feedingApproach = fingerfood`, `textureStage = 1` bevorzugt weiterhin `finger-graspable`.
12. `spoon-soft-lumpy` bleibt unterhalb der vorgesehenen Texturstufe nicht eligible.
13. `smallSoftPieces` und `structuredChew` bleiben unabhängige harte Voraussetzungen.
14. Die neue Reihenfolge verändert keine Rezeptidentität, FOOD-Auswahl, Rollen oder bestehende Locks.
15. Coach-Alternativmodi umgehen keine Sample-/Einführungs- oder Lock-Semantik.

### P1 – Log-UX

16. Geplantes `presentationMode` wird als tatsächliche Darreichungsform vorausgewählt.
17. Nutzerin kann nur auf eine andere bereits geeignete Form wechseln.
18. Capability-gesperrte Formen sind nicht auswählbar.
19. `textureExperience` kann gespeichert und bearbeitet werden.
20. „Nicht beurteilen“ speichert keinen künstlichen Wert.
21. FOOD-Outcomes, `presentationMode`, `textureStage` und `textureExperience` bleiben getrennte Felder.

### P1 – Coach-UI

22. Der Coach zeigt Löffelstruktur und paralleles Fingerfood als getrennte Wege.
23. `Testidee ansehen` verändert `textureStage` nicht.
24. Erst `Stufe X als Standard verwenden` verändert `textureStage`.
25. Erfahrungszähler werden nicht als Freigabe oder Bereitschaftsnachweis bezeichnet.
26. Stage 3 -> 4 wird nicht als bloße gröbere Löffelstufe dargestellt.
27. Ohne konkrete geeignete `finger-graspable`-Mahlzeit wird kein Fingerfood-Hinweis erzeugt.

## Testmatrix bei späterer Implementierung

Da Produktivlogik, Datenfluss und UI betroffen wären:

1. gezielte Node-Tests für Log-Semantik, Texture-Evidence und Handling-Reihenfolge;
2. gezielte UI-/Browser-Tests für Log und Coach;
3. `npm run verify:fast`;
4. `npm run verify:app`;
5. kein `verify:deploy`, solange keine Deployment-Datei verändert wird;
6. vollständiges `npm run verify` nur bei zusätzlichem Querschnitts-/Release-Scope.

## Empfohlene Umsetzungsreihenfolge

### Schritt 1 – Log-Semantik zuerst

- tatsächliches `presentationMode` im Log eindeutig führen;
- Fingerfood nicht mehr zu einer künstlichen Löffelstufe zwingen;
- `textureExperience` additiv einführen;
- Alt-Log-Kompatibilität absichern.

### Schritt 2 – Textur-Evidenz korrigieren

- FOOD-Outcomes aus der Progressionsauswertung entfernen;
- nur explizite `spoon-*`-Texturerfahrungen zählen;
- keine Schwellenfreigabe einführen.

### Schritt 3 – Handling-Präferenz korrigieren

- stageabhängige Reihenfolge der Löffelmodi zentral ergänzen;
- Eligibility unverändert lassen;
- Referenzfälle Karotte und weitere Multi-Mode-FOODs absichern.

### Schritt 4 – Coach umbauen

- duale Darstellung `Löffelstruktur` + `parallel mögliche Essform`;
- Testidee ohne Zustandsmutation;
- Stufe 3 -> 4 separat und konkret behandeln;
- Fingerfood-Hinweis nur aus bestehender Meal-/Handling-Eligibility.

## Erwarteter Nutzen

Die App bildet danach nicht nur ab, **welche Konsistenz eingestellt ist**, sondern unterstützt beim nächsten sinnvollen Schritt:

- vertraute Löffelstruktur bleibt möglich;
- eine etwas anspruchsvollere Löffelstruktur kann in kleiner Menge getestet werden;
- geeignetes Fingerfood kann parallel sichtbar werden;
- tatsächliche Darreichungsform wird im Log korrekt erfasst;
- Löffeltexturerfahrung bleibt getrennt von Geschmack, Verträglichkeit und Fingerfood;
- die App entscheidet nicht automatisch, dass ein Kind aufgrund von Alter oder Zählerstand „bereit“ sein muss.
