# Review – Texture Progression Coach

Stand: 2026-08-21  
Review-Basis: `docs/TEXTURE_PROGRESSION_COACH_PROPOSAL.md` auf `docs/texture-progression-coach-proposal`  
Ausgangs-main: `a4f33a663721442cd38ad01bb9f7836c9cafcaf6`, Version `10.1.26`

## Review-Ergebnis

**Freigabefähiger Umsetzungsvorschlag, keine offenen Blocker.**

Der finale Vorschlag passt zum bestehenden Handling-/Oral-Processing-Modell und vermeidet insbesondere eine erneute Kopplung `Brei -> Fingerfood`.

Keine Produktivlogik wurde in diesem Branch verändert.

## Geprüfte Punkte

### 1. Fachliche Trennung – PASS

Der Vorschlag hält getrennt:

- Beikostphase;
- Löffeltextur (`textureStage`);
- Darreichungsform (`presentationMode` / Handlingmodus);
- Feeding-Präferenz;
- beobachtete Handling-/Oral-Capabilities;
- Safety-/Alters-/Planner-Gates.

Fingerfood wird nicht als spätere Texturstufe modelliert.

### 2. Bestehende Handling-Architektur – PASS

Der Vorschlag baut auf `js/handling-readiness.js` und `data/food-handling.js` auf und führt keine parallele zweite Eligibility-Engine ein.

Die geplante stageabhängige Sortierung verändert nur die Präferenz bereits geeigneter Löffelmodi, nicht deren fachliche Eligibility.

### 3. Textur-Evidenz – PASS nach Korrektur

Erster Review-Befund:

Der bestehende Coach zählt positive FOOD-Outcomes als positive Texturerfahrungen. Das ist semantisch zu grob.

Korrektur im Vorschlag:

- neues optionales `textureExperience`;
- nur explizite strukturierte `spoon-*`-Logs zählen;
- FOOD-Outcomes, Fingerfood und Alt-Logs werden nicht als neue Löffeltextur-Evidenz umgedeutet;
- Zähler bleiben rein beschreibend und werden kein Unlock-Gate.

### 4. Fingerfood-Logging – PASS nach Korrektur

Erster Review-Befund:

Das aktuelle Log verlangt bei positiven Outcomes grundsätzlich eine `textureStage`. Ein tatsächlicher Fingerfood-Log könnte dadurch künstlich einer Löffelstufe zugeordnet werden.

Korrektur im Vorschlag:

- strukturiertes `presentationMode` wird als tatsächliche Darreichungsform verwendet;
- bei strukturiertem `finger-*` wird keine künstliche Löffelstufe verlangt;
- `textureExperience` gilt nur für strukturierte `spoon-*`-Logs.

### 5. Legacy-FOOD-Kompatibilität – PASS nach Korrektur

Zweiter Review-Befund:

Die 103 Laufzeitrezepte sind vollständig migriert, die Einzel-FOOD-Handling-Migration ist aber nicht vollständig. Ein allgemeines neues `presentationMode`-Pflichtfeld würde deshalb bestehende FOOD-only-Logs gefährden.

Korrektur im Vorschlag:

- strukturierte neue Log-Semantik nur dort, wo der Contract sie trägt;
- konservativer bestehender Log-Pfad für Legacy-FOODs;
- keine Ableitung aus `safeForm`-Freitext, Kategorie oder Alter;
- keine erfundene Progressions-Evidenz aus Legacy-Logs.

Das entspricht der bestehenden Vorwärtsregel: keine automatische Gruppenmigration alter FOODs.

### 6. Stufe 3 -> 4 – PASS nach Korrektur

Review-Befund:

`weiche Familienkost` ist breiter als nur eine weitere Löffelkonsistenz.

Korrektur:

- Stufe 1 -> 2 und 2 -> 3 werden als Löffelstruktur-Tests begleitet;
- Stufe 3 -> 4 wird als konkrete familiennahe weiche Originalform behandelt;
- kein neuer Handlingmodus und keine pauschale Familienkost-Freigabe.

### 7. Planner-/Lock-Scope – PASS

Der Coach soll alternative Formen nur über eine nicht mutierende Abfrage derselben zentralen Handling-Eligibility beziehen.

Explizit ausgeschlossen sind:

- neue Mahlzeit bauen;
- Lock verändern;
- Rezeptidentität ersetzen;
- Sample-/Einführungslogik umgehen;
- Capability-Gates umgehen.

### 8. Datenmigration – PASS

Der Vorschlag benötigt im MVP nur ein optionales `textureExperience`-Feld.

`presentationMode` existiert bereits.

Keine rückwirkende Rekonstruktion und keine Schemaerhöhung ohne technischen Zwang.

### 9. Scope/Komplexität – PASS

Positiv:

- kein neues persistentes `trialStage`;
- keine neue Statistikarchitektur;
- keine neue Lebensmittelklassifikation;
- keine neuen Altersregeln;
- kein fixer Wochenplan;
- keine Freitext-Parsing-Logik.

Damit bleibt der Vorschlag für einen ersten Implementierungsschritt ausreichend klein.

## Bewusste Einschränkung

Der Coach wird im MVP bei noch nicht strukturiert migrierten Einzel-FOODs konservativ sein.

Das bedeutet: Für diese Fälle kann er nicht automatisch eine neue parallele Fingerfood-Alternative ableiten.

Das ist **kein Fehler des Vorschlags**, sondern die sichere Folge der bestehenden Regel, Legacy-FOODs nicht ohne Einzelprüfung neu zu klassifizieren.

Eine spätere breitere FOOD-Handling-Migration kann die Coach-Abdeckung erweitern, ohne das hier vorgeschlagene Modell zu ändern.

## Empfohlener Implementierungsschnitt

1. Log-Semantik + Legacy-Fallback + `textureExperience`.
2. Textur-Evidenz aus FOOD-Outcomes lösen.
3. Stageabhängige Präferenz bereits geeigneter Löffelmodi.
4. Dualen Home-Coach ergänzen.

Dieser Schnitt minimiert das Risiko, UI-Empfehlungen auf unsauberem Logging aufzubauen.

## Testanforderung bei späterer Umsetzung

Gemäß aktueller Testmatrix:

- betroffene Node-Regressionen;
- betroffene UI-/Browser-Regressionen;
- `npm run verify:fast`;
- `npm run verify:app`;
- kein Deployment-Gate ohne Deployment-Scope.

## Schlussurteil

**Kein Blocker, keine unnötige neue Architektur, Scope fachlich konsistent.**

Der Vorschlag kann als Grundlage für eine separate Implementierungsaufgabe verwendet werden. Vor der eigentlichen Implementierung ist wegen der neuen Produktsemantik weiterhin eine fachliche Freigabe des Vorschlags erforderlich; dieser Branch selbst enthält ausschließlich Dokumentation.
