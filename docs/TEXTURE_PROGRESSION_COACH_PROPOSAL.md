# Texture Progression Coach – Umsetzungsvorschlag

Stand: 2026-08-21  
Status: fachlich-technischer Umsetzungsvorschlag, noch keine Produktivlogik  
Ausgangsbasis: `main` `a4f33a663721442cd38ad01bb9f7836c9cafcaf6`, Version `10.1.26`

## Ziel

Die App soll den Übergang von glatter Löffelkost zu zunehmend strukturierter Löffelkost aktiv begleiten, ohne erneut eine lineare Entwicklung `Brei -> Fingerfood` einzuführen.

Dafür wird der bestehende Handling-/Oral-Processing-Unterbau beibehalten und um eine kleine Empfehlungsschicht ergänzt:

- **Löffeltextur** entwickelt sich weiterhin über die bestehende vierstufige `textureStage`-Dimension.
- **Fingerfood** bleibt ein paralleler Darreichungsweg und darf bereits bei niedriger `textureStage` angeboten werden, wenn die konkrete FOOD-/Rezeptform geeignet ist.
- **Kleine weiche Stücke** und **strukturiertes Kauen** bleiben ausschließlich über die bestehenden beobachteten Capabilities freigegeben.
- Die App empfiehlt den nächsten kleinen Übungsschritt, schaltet aber nichts allein aufgrund von Alter, Zeitablauf oder einer erreichten Zahl automatisch frei.

## Ausgangslage im aktuellen main

### 1. Handling und Fingerfood sind bereits korrekt getrennt

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

Damit kann z. B. ein Eintrag fachlich als Texturerfolg gezählt werden, obwohl die positive Bewertung nur bedeutet, dass ein Lebensmittel akzeptiert oder vertragen wurde. Lebensmittelakzeptanz und tatsächliche Bewältigung einer Konsistenz sind unterschiedliche Informationen.

### 3. `textureStage` steuert die bevorzugte Löffelform noch nicht vollständig

Die Handling-Eligibility berücksichtigt `textureStage` derzeit nur als Gate für `spoon-soft-lumpy`.

Innerhalb bereits geeigneter Löffelformen bleibt die Reihenfolge aus dem Contract bestehen. Ein FOOD mit

```text
spoon-smooth, spoon-mashed, finger-graspable
```

kann daher auch bei `textureStage = 2` weiterhin `spoon-smooth` als bevorzugte Löffelform liefern.

### 4. Der bestehende Coach ist noch eine einzelne lineare Leiste

Die Home-Karte zeigt aktuell ausschließlich `Stufe 1 -> 2 -> 3 -> 4`.

Das ist für die Löffeltextur grundsätzlich brauchbar, bildet aber nicht sichtbar ab, dass geeignetes greifbares Fingerfood parallel schon auf Stufe 1 möglich sein kann.

## Sollbild

Die Home-Karte wird semantisch von **„Konsistenz“** zu **„Konsistenz & Essform“** erweitert.

Sie zeigt zwei getrennte Informationen:

### A. Aktuelle Löffelstruktur

Beispiel:

```text
Aktuelle Löffelstruktur
Stufe 1 · glatt / fein

Nächster kleiner Schritt
Eine kleine Teilportion etwas dicker oder weich zerdrückt anbieten.
```

### B. Parallele sichere Essform

Wenn für eine aktuelle bzw. nächste geplante Mahlzeit ein geeigneter `finger-graspable`-Modus existiert:

```text
Parallel möglich
Weiches, gut greifbares Fingerfood
```

Diese Information ist **kein nächster Level-Schritt** und darf nicht hinter `textureStage >= 3` versteckt werden.

Wenn Fingerfood fachlich nicht verfügbar ist, erscheint kein künstlicher Ersatzhinweis.

## Produktsemantik

### 1. Keine automatische Progression

Die App darf `textureStage` nicht automatisch erhöhen.

Insbesondere kein automatischer Wechsel aufgrund von:

- Alter;
- Anzahl vergangener Tage;
- Beikostphase;
- Feeding-Präferenz;
- Lebensmittelanzahl;
- positiver FOOD-Bewertung allein.

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

Die Einstellung darf weiterhin keine Capability oder Safety-Regel umgehen.

### 4. Capabilities bleiben rein beobachtete Fähigkeiten

Der Coach darf weder `smallSoftPieces` noch `structuredChew` automatisch setzen.

Er darf aus Texturprotokollen auch nicht ableiten, dass eine dieser Fähigkeiten vorhanden ist.

## Änderung 1 – echte Texturerfahrung protokollieren

### Neues optionales Log-Feld

```js
textureExperience: "comfortable" | "learning"
```

Bedeutung:

- `comfortable`: Die tatsächlich angebotene Löffelstruktur wurde gut bewältigt.
- `learning`: Die Struktur ist noch ungewohnt und soll weiter in kleinen Mengen geübt werden.

Das Feld ist optional. Alte Logs ohne Feld bleiben vollständig gültig.

### UI im Essensprotokoll

Nur wenn für den Eintrag eine Löffel-`textureStage` dokumentiert wird, erscheint kompakt:

```text
Wie hat die Konsistenz geklappt?
○ Gut bewältigt
○ Noch ungewohnt
○ Nicht beurteilen
```

„Nicht beurteilen“ speichert kein `textureExperience`.

Die Auswahl bewertet **nicht**, ob das Lebensmittel geschmeckt hat oder vertragen wurde.

### Keine automatische Safety-Diagnose

Der Coach interpretiert keine Freitextnotizen, kein Würgen, Husten oder andere Beobachtungen automatisch als Capability- oder Safety-Entscheidung.

## Änderung 2 – Textur-Evidenz semantisch korrigieren

`textureSuccessCount()` wird nicht mehr aus `logPositiveOutcome()` gespeist.

Stattdessen wird eine neue rein beschreibende Auswertung verwendet, z. B.:

```js
textureComfortCount(stage)
textureLearningCount(stage)
```

Gezählt werden nur Logs mit:

```js
log.textureStage === stage
log.textureExperience === "comfortable"
```

bzw. `"learning"`.

Diese Werte sind **keine harten Eligibility-Gates**.

### Badge-Semantik

Der Coach darf beispielsweise anzeigen:

```text
3-mal gut bewältigt
```

Er darf daraus aber nicht formulieren:

```text
Jetzt bereit für Stufe 2
```

Die Empfehlung bleibt:

```text
Nächsten kleinen Schritt ausprobieren
```

## Änderung 3 – Löffelmodus an `textureStage` ausrichten

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

Für Stufe 4 wird **kein künstlicher neuer Handlingmodus** eingeführt. Familienkost bleibt eine breitere Textur-/Gerichtsebene; vorhandene kanonische Rezeptformen bleiben maßgeblich.

### Zusammenspiel mit `feedingApproach`

Reihenfolge der Entscheidung:

1. bestehende Handling-, Oral-, Safety- und Capability-Eligibility;
2. `feedingApproach` bestimmt die bevorzugte Familie;
3. innerhalb der Löffelfamilie ordnet `textureStage` die bereits geeigneten Löffelmodi;
4. innerhalb der Fingerfoodfamilie bleibt die bestehende Contract-Reihenfolge erhalten.

Für `mixed` bleibt die bestehende Familienneutralität erhalten; nur die relative Reihenfolge mehrerer Löffelmodi untereinander wird an `textureStage` angepasst.

Beispiele:

```text
Contract: smooth, mashed, finger
mixed + Stage 2 -> mashed, smooth, finger
spoon + Stage 2 -> mashed, smooth, finger
fingerfood + Stage 2 -> finger, mashed, smooth
```

Damit verändert `textureStage` keine Eligibility und Fingerfood wird nicht zu einer späteren Stufe.

## Änderung 4 – Coach statt Schwellenautomat

### Aktuelle Stufe

Der Coach zeigt weiterhin die aktuelle `textureStage`.

### Nächster kleiner Schritt

Bei Stufe 1 bis 3 zeigt er immer eine fachlich neutrale Testidee für die nächste Löffelstruktur.

Beispiel Stufe 1:

```text
Nächster kleiner Schritt
Eine kleine Teilportion weniger fein bzw. weich zerdrückt anbieten.
Vertraute Konsistenzen dürfen parallel bleiben.
```

Beispiel Stufe 2:

```text
Nächster kleiner Schritt
Bei einer geeigneten Mahlzeit kleine weiche Stückchen in der Löffelkost testen.
```

Die App verwendet dafür **keinen harten Mindestzähler**.

### Beschreibende Erfahrung statt Freigabeampel

Wenn Logs vorhanden sind, kann zusätzlich stehen:

```text
Diese Stufe: 4-mal gut bewältigt · 1-mal noch ungewohnt
```

Das ist ausschließlich Verlauf, keine Diagnose.

### Aktionen

Empfohlen:

- `Testidee ansehen`
- `Stufe X als Standard verwenden`
- `Zurück` bei Stufe > 1

`Testidee ansehen` verändert keinen Zustand.

`Stufe X als Standard verwenden` nutzt weiterhin die bestehende manuelle `setTextureStage()`-Semantik.

Dadurch ist kein neues persistentes `trialStage` nötig.

## Änderung 5 – paralleles Fingerfood sichtbar machen

Der Coach soll, wenn fachlich möglich, eine parallele Fingerfood-Option sichtbar machen.

MVP-Regel:

- nur bereits strukturierte `finger-graspable`-Eligibility verwenden;
- niemals aus `safeForm`-Freitext neue Steuerlogik ableiten;
- keine Empfehlung für `finger-small-soft`, solange `smallSoftPieces` nicht bestätigt ist;
- keine Empfehlung für ein Rezept mit `structured-chew-required`, solange `structuredChew` nicht bestätigt ist.

### Quelle für den Hinweis

Bevorzugt wird die nächste bereits geplante, noch offene Mahlzeit, deren bestehender FOOD-/Recipe-Contract einen geeigneten `finger-graspable`-Modus enthält.

Wenn keine solche Mahlzeit vorliegt, zeigt der Coach keinen generischen täglichen Fingerfood-Zwang.

Beispiel:

```text
Parallel möglich bei der nächsten geeigneten Mahlzeit:
Karotte als weiches, gut greifbares Fingerfood
```

Die konkrete sichere Form kommt weiterhin aus der bereits hinterlegten Serving-/Safe-Form-Guidance.

## Datenmodell und Migration

### Additiv

Neu ist nur das optionale Log-Feld:

```js
textureExperience
```

Keine rückwirkende Rekonstruktion aus alten FOOD-Outcomes.

### Bestehende Daten

- alte Logs ohne `textureExperience`: unverändert gültig;
- bestehende `textureStage`: unverändert;
- bestehende `textureStageSince`: unverändert;
- bestehende `feedingApproach`: unverändert;
- bestehende `handlingCapabilities`: unverändert;
- bestehende Plan-Locks und Logs mit `presentationMode`: unverändert.

Eine Storage-Schemaerhöhung ist für das additive Log-Feld voraussichtlich nicht nötig.

## Technische Zielstellen

Voraussichtlich betroffen:

- `js/ui.js`
  - `textureSuccessCount()` ersetzen/umbauen;
  - `renderTextureCoach()` dual darstellen;
  - Copy von `openTextureAdvance()` auf „als Standard verwenden“ schärfen.
- `js/log.js`
  - `textureExperience` im Log-Formular erfassen;
  - Feld beim Erstellen/Bearbeiten erhalten;
  - optional in der Log-Anzeige knapp darstellen.
- `js/handling-readiness.js`
  - stageabhängige Reihenfolge innerhalb der Löffelmodi ergänzen;
  - keine Eligibility-Regel ändern.
- `js/state.js` / Migration nur prüfen
  - kein neues Pflichtfeld;
  - keine automatische Alt-Datenableitung.
- passende Node- und Browser-Regressionen.

## Nicht Teil dieses Vorschlags

- keine neue Beikostphase;
- keine neue Rezept- oder FOOD-Einstufung;
- keine Änderung von `hardMinMonths`, `minMonths`, `autoPlan` oder Mahlzeiteneignung;
- keine automatische Capability-Erkennung;
- keine automatische Stufenerhöhung;
- kein fixer Wochenplan für Textursteigerung;
- keine Ableitung aus `safeForm`-Freitext;
- keine Statistik-Neukonzeption;
- keine neue Storage-Schema-Version ohne technischen Zwang.

## Regressionen / Akzeptanzkriterien

### P0 – Semantik

1. Ein positives FOOD-Ergebnis ohne `textureExperience` zählt nicht als Texturerfolg.
2. Ein alter Log ohne `textureExperience` bleibt gültig und erzeugt keinen erfundenen Texturerfolg.
3. `textureExperience = comfortable` zählt nur für die tatsächlich dokumentierte `textureStage`.
4. `textureExperience = learning` erhöht keine Stufe und setzt keine Capability.
5. Kein Alter, keine Phase und keine Anzahl an Logs erhöht `textureStage` automatisch.
6. `feedingApproach = fingerfood` funktioniert auch bei `textureStage = 1`, wenn `finger-graspable` fachlich geeignet ist.
7. `smallSoftPieces` und `structuredChew` bleiben unabhängige harte Voraussetzungen an den bestehenden Stellen.

### P0 – Modusreihenfolge

8. Karotte mit `feedingApproach = spoon`, `textureStage = 1` bevorzugt `spoon-smooth`.
9. Karotte mit `feedingApproach = spoon`, `textureStage = 2` bevorzugt `spoon-mashed`.
10. Karotte mit `feedingApproach = fingerfood`, `textureStage = 1` bevorzugt weiterhin `finger-graspable`.
11. `spoon-soft-lumpy` bleibt unterhalb der dafür vorgesehenen Texturstufe nicht eligible.
12. Die neue Reihenfolge verändert keine Rezeptidentität, FOOD-Auswahl, Rollen oder Plan-Locks.

### P1 – Coach-UI

13. Der Coach zeigt Löffeltextur und paralleles Fingerfood als getrennte Wege.
14. `Testidee ansehen` verändert `textureStage` nicht.
15. Erst `Stufe X als Standard verwenden` verändert `textureStage`.
16. Der Coach bezeichnet Erfahrungszähler nicht als Freigabe oder Bereitschaftsnachweis.
17. Ohne geeignete `finger-graspable`-Option wird kein künstlicher Fingerfood-Hinweis erzeugt.

### P1 – Logging

18. `textureExperience` kann bei einem Log gespeichert und bearbeitet werden.
19. „Nicht beurteilen“ speichert keinen künstlichen Wert.
20. Alte Logs bleiben editierbar.
21. FOOD-Outcomes und `textureExperience` bleiben getrennte Felder.

## Testmatrix bei späterer Implementierung

Da Produktivlogik, Datenfluss und UI betroffen wären:

1. gezielte Node-Tests für Texture-Evidence und Handling-Reihenfolge;
2. gezielte UI-/Log-Tests;
3. `npm run verify:fast`;
4. `npm run verify:app`;
5. kein `verify:deploy`, solange keine Deployment-Datei verändert wird;
6. vollständiges `npm run verify` nur bei zusätzlichem Querschnitts-/Release-Scope.

## Empfohlene Umsetzungsreihenfolge

### Schritt 1 – Semantik zuerst

- `textureExperience` additiv einführen;
- FOOD-Outcomes aus der Textur-Evidenz entfernen;
- Regressionen für Alt-Logs und Nicht-Automatik ergänzen.

### Schritt 2 – Handling-Präferenz korrigieren

- stageabhängige Reihenfolge der Löffelmodi zentral in `js/handling-readiness.js` ergänzen;
- bestehende Eligibility unverändert lassen;
- Referenzfälle Karotte und weitere Multi-Mode-FOODs absichern.

### Schritt 3 – Coach umbauen

- duale Darstellung `Löffelstruktur` + `parallel mögliche Essform`;
- Testidee ohne Zustandsmutation;
- manuelle Standardübernahme weiterhin explizit.

### Schritt 4 – Log-UX ergänzen

- kompakte Texturerfahrungsfrage;
- Bearbeiten/Persistenz absichern;
- keine Pflichtangabe.

## Erwarteter Nutzen

Die App bildet danach nicht nur ab, **welche Konsistenz eingestellt ist**, sondern unterstützt konkret beim nächsten sinnvollen Schritt:

- vertraute Löffelstruktur bleibt möglich;
- eine etwas anspruchsvollere Struktur kann in kleiner Menge getestet werden;
- geeignetes Fingerfood kann parallel sichtbar werden;
- tatsächliche Texturerfahrung wird getrennt von Geschmack/Verträglichkeit dokumentiert;
- die App entscheidet nicht automatisch, dass ein Kind aufgrund von Alter oder Zählerstand „bereit“ sein muss.
