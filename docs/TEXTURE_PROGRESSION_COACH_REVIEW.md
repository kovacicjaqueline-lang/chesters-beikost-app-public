# Review – Texture Progression Coach

Stand: 2026-08-21  
Review-Basis: `docs/TEXTURE_PROGRESSION_COACH_PROPOSAL.md` auf `docs/texture-progression-coach-proposal`  
Ausgangs-main: `a4f33a663721442cd38ad01bb9f7836c9cafcaf6`, Version `10.1.26`

## Review-Ergebnis

**Der vorherige Vorschlag war fachlich korrekt, aber für die App unnötig komplex.**

Nach dem erneuten UX-/Komplexitätsreview wurde er deutlich reduziert.

Der jetzt empfohlene MVP benötigt:

1. keinen neuen Log-Wert;
2. keine neue Log-Frage;
3. keine zweite Coach-Spur;
4. keine dynamische Fingerfood-Empfehlungsengine;
5. keine Migration;
6. keine neue Storage-Schema-Version.

Es bleiben nur drei kleine Produktänderungen:

- falschen Texturerfolgszähler entfernen;
- Coach-Copy um nächsten kleinen Schritt + paralleles Fingerfood ergänzen;
- bereits geeignete Löffelmodi passend zur vorhandenen `textureStage` sortieren.

## Findings des erneuten Reviews

### P1 – neues `textureExperience` wäre Overengineering

Der vorige Vorschlag wollte zusätzlich zu FOOD-Outcomes, `textureStage`, `presentationMode`, `feedingApproach` und Capabilities noch

```text
textureExperience = comfortable | learning
```

speichern und im Log abfragen.

Das wäre zwar semantisch sauber, erzeugt aber für den aktuellen Nutzen unverhältnismäßig viel UX- und Datenkomplexität.

**Entscheidung:** vollständig aus dem MVP entfernt.

Die App muss nicht messen, wie oft eine Struktur „gut geklappt“ hat. Es reicht, keine falsche Sicherheit aus FOOD-Outcomes abzuleiten.

### P1 – dualer Coach wäre zu viel Oberfläche

Der vorige Vorschlag plante getrennte Wege für Löffelstruktur und dynamisch ermittelte parallele Fingerfood-Angebote.

Das hätte zusätzliche Abfragen, Sonderfälle und visuelle Elemente erzeugt.

**Entscheidung:** entfernt.

Die bestehende einzelne Konsistenzkarte bleibt. Ein kurzer Hinweis erklärt nur:

> Geeignetes weiches Fingerfood kann unabhängig von dieser Konsistenzstufe parallel angeboten werden.

Die konkrete Eligibility bleibt weiterhin dort, wo sie heute bereits strukturiert entschieden wird.

### P1 – Log-Umbau ist für dieses Ziel nicht erforderlich

Der vorige Vorschlag wollte `presentationMode` im tatsächlichen Log auswählbar machen und Fingerfood-Logs von der Löffeltextur trennen.

Das ist ein eigenständiges UX-/Datenproblem. Es ist **nicht notwendig**, um den Texture Coach fachlich zu korrigieren.

Sobald der Coach seine Empfehlung nicht mehr aus Log-Outcomes berechnet, entsteht aus dem bestehenden Log kein falscher Progressions-Unlock mehr.

**Entscheidung:** `js/log.js` bleibt im MVP außerhalb des Scopes.

Wenn die Log-Darstellung im Alltag später tatsächlich stört, separat lösen.

### P0 – bestehender `textureSuccessCount()` sollte trotzdem weg

Der aktuelle `textureSuccessCount()` zählt positive FOOD-Outcomes als Texturerfahrung und setzt ab vier Erfolgen `Test möglich`.

Das ist eine fachlich unbegründete Verknüpfung und suggeriert mehr Sicherheit, als die Daten hergeben.

**Empfehlung:** Zähler und Schwelle entfernen, nicht durch eine neue Messlogik ersetzen.

Das ist gleichzeitig fachlich sauberer und technisch einfacher.

### P1 – stageabhängige Löffelreihenfolge bleibt sinnvoll

Diese Änderung hat einen klaren Nutzen bei sehr geringer Komplexität.

Beispiel Karotte:

- Stage 1 + Löffel -> `spoon-smooth` bevorzugen;
- Stage 2 + Löffel -> `spoon-mashed` bevorzugen;
- Fingerfood-Präferenz bleibt davon unabhängig.

Dabei wird keine Eligibility verändert und kein neuer Modus eingeführt.

**Entscheidung:** im MVP behalten.

### P2 – Stufe 3 -> 4 nicht technisch aufblasen

`weiche Familienkost` ist fachlich breiter als nur eine weitere Löffelstufe.

Der vorige Vorschlag wollte dafür bereits konkrete geplante Originalformen dynamisch suchen.

**Entscheidung:** nicht nötig.

Im MVP reicht passende Copy. Bestehende Rezept-/Handlingregeln bleiben maßgeblich.

## Komplexitätsvergleich

### Vorheriger Vorschlag

Geplante neue bzw. ausgeweitete Konzepte:

- `textureExperience`;
- zusätzliche Log-Frage;
- Darreichungsform-Auswahl im Log;
- Comfort-/Learning-Zähler;
- dualer Coach;
- dynamische nächste Fingerfood-Mahlzeit;
- Alternative-Modes-Abfrage für den Coach;
- Legacy-Log-Sonderpfade.

### Vereinfachter Vorschlag

Nur:

- bestehende falsche Zählerlogik entfernen;
- vorhandene Coach-Karte textlich verbessern;
- vorhandene Handling-Reihenfolge besser an vorhandene `textureStage` anbinden.

Kein neues persistentes Produktkonzept.

## Architektur-Review

### Bestehende Semantik bleibt erhalten – PASS

Unverändert bleiben:

- Beikostphase;
- `textureStage`;
- `feedingApproach`;
- Handlingmodi;
- `smallSoftPieces`;
- `structuredChew`;
- Safety-/Alters-/Planner-Gates;
- bestehende Logs und Backups.

### Kein zweites System – PASS

Die vorgeschlagene Sortierung gehört zentral in `js/handling-readiness.js`.

Keine parallele Coach-Eligibility und keine Freitextableitung.

### UI-Komplexität – PASS nach Reduktion

Die Home-Ansicht behält eine einzelne Konsistenzkarte.

Keine neue Auswahl im täglichen Protokoll und keine zusätzliche Fortschrittsanzeige.

### Datenmodell – PASS

Keine neuen Felder.
Keine Migration.
Keine Schemaerhöhung.

## Empfohlener Implementierungsscope

Voraussichtlich nur:

- `js/ui.js`;
- `js/handling-readiness.js`;
- direkt betroffene Node-/Browser-Tests.

Nicht anfassen:

- `js/log.js`;
- FOOD-/Recipe-Daten;
- Planner-Kandidatenlogik;
- Persistenzschema;
- Statistik.

## Testanforderung bei späterer Umsetzung

Gemäß aktueller Testmatrix:

- gezielte Node-Tests für Handling-Reihenfolge;
- gezielte UI-/Browser-Regression für den Coach;
- `npm run verify:fast`;
- `npm run verify:app`;
- kein Deployment-Gate ohne Deployment-Scope.

## Schlussurteil

**Die vereinfachte Variante ist der bessere Produktentscheid.**

Der vorherige Entwurf war nicht falsch, aber er hätte für einen kleinen Alltagsnutzen zu viele neue Zustände und Entscheidungen eingeführt.

Der reduzierte MVP behebt den eigentlichen fachlichen Fehler und macht die gewünschte Progression sichtbar, ohne die App spürbar komplizierter zu machen.

Keine Produktivlogik wurde in diesem Branch verändert.