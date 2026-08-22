# Chesters Beikost-App – kanonisches Planner-Fachkonzept

Stand: 22.08.2026  
Dokumentationsbasis: Statusabgleich gegen aktuellen `main` `244ce24810a846dacdb33c4ad5bf8386900dbd23`, einschließlich gemergter Handling-/BLW-Schicht, gemergtem Nuss-/Samen-/Topping-Block, vollständiger österreichischer `seasonMonths`-Matrix und aktuellem FOOD-COUNT-Identitätsstand; zusätzlich fachlich freigegebener und im Integrations-PR umgesetzter Bite-Separation-/Oral-Processing-Stand. Historischer Phasenmodell-v2-Stand: `f9f886c82af2ce267c10571e5e89df787037c6b0`.

Dieses Dokument führt die bisher über Phasenmodell, PLAN-07, PLAN-08, MILK-01, TODO3-Regressionen und spätere Fachentscheidungen verteilte Planner-Semantik an einer Stelle zusammen.

Es ist **Fachdokumentation**, keine neue Regelquelle. Wo eine Regel nicht fachlich entschieden ist, wird sie ausdrücklich als offen markiert.

## Statuslegende

- ✅ **main** – fachlich freigegeben und auf `main` umgesetzt/regressiv abgesichert.
- 🟡 **Branch/Integrations-PR** – fachlich freigegeben und separat implementiert/getestet, aber noch nicht auf `main`.
- 🟠 **Bestandsverhalten** – technisch vorhanden und regressiv beschrieben, aber nicht als eigenständige neue Fachentscheidung aus dem Phasenmodell ableiten.
- ⚠️ **Soll/Ist-Gap** – fachlich bereits beschlossen, aber auf `main` noch nicht vollständig als Produktverhalten nachgewiesen/umgesetzt.
- 🔴 **offen** – noch fachlich zu entscheiden; nicht stillschweigend implementieren.

---

# 1. Historischer Ausgangspunkt: Phasenmodell-v2

Das Phasenmodell-v2 wurde mit Version 10.1.24 eingeführt. Sein zentraler Vertrag lautet:

**Die Phase steuert ausschließlich, welche Mahlzeitenslots automatisch geplant werden.**

Alter, gegessene Grammmenge und Konsistenz wechseln die Phase nicht automatisch. Mengenorientierung und Konsistenz bleiben getrennte Dimensionen.

Der Übergang in die nächste Phase ist entwicklungsorientiert zu empfehlen und wird bewusst durch die Nutzerin bestätigt.

## 1.1 Automatische Mahlzeitenslots ✅ main

| Phase | Automatisch geplante Slots |
|---|---|
| 1 – Kennenlernen | Mittagessen |
| 2 – Mahlzeitenaufbau | Frühstück + Mittagessen |
| 3 – Drei Hauptmahlzeiten | Frühstück + Mittagessen + Abendessen |
| 4 – Familienkost | Frühstück + Mittagessen + Snack + Abendessen |

Zusätzlich gilt:

- Phase 3 erlaubt einen Snack **manuell**, plant ihn aber nicht automatisch.
- Erst Phase 4 erzeugt automatisch einen Snackslot.
- Ein Phasenwechsel löscht oder deutet bestehende Logs, Vorräte, manuelle Mahlzeiten oder Locks nicht um.

## 1.2 Phase, Menge und Konsistenz sind getrennt ✅ main

- Die Phase ist keine Grammstufe.
- Die Phase ist keine Texturstufe.
- Die Mengenorientierung darf separat aus bisherigen Essmengen vorgeschlagen oder manuell gewählt werden.
- Die Texturentwicklung bleibt separat dokumentiert.
- Historische Texturinformationen dürfen durch spätere Planner-Erweiterungen nicht stillschweigend umgedeutet werden.

## 1.3 PHASE-TRANSITION – entwicklungsorientierte Empfehlung ⚠️ Soll/Ist-Gap

Fachlich beschlossen ist:

1. Die App **empfiehlt** den Übergang in die nächste Beikostphase entwicklungsorientiert.
2. Alter oder gegessene Grammwerte dürfen den Phasenwechsel nicht automatisch auslösen.
3. Die Empfehlung ist kein Zwang und kein automatischer Wechsel.
4. Die Nutzerin bestätigt den empfohlenen Wechsel bewusst/einmalig.
5. Bestehende Logs, Vorräte, manuelle Mahlzeiten und Locks bleiben durch den Wechsel in ihrer bisherigen Semantik erhalten.

Historisch nachgewiesenes Ist des Phasenmodell-v2:

- Die Oberfläche erklärt korrekt, dass sich die Phase nach Entwicklung und Tagesablauf richtet.
- `Zurück`/`Weiter` erlaubt den Wechsel zwischen den Phasen.
- Vor dem Wechsel erscheint eine bewusste Bestätigung.
- Alter und Grammwerte lösen den Wechsel nicht automatisch aus.

**Noch nicht nachgewiesen ist eine eigenständige Entwicklungs-Empfehlungslogik**, die aus geeigneten Entwicklungsmerkmalen ableitet, dass nun der nächste Phasenwechsel empfohlen werden sollte.

Damit ist PHASE-TRANSITION **keine offene Fachfrage**, sondern eine noch offene Soll-/Ist-Lücke. Vor einer Implementierung müssen die konkreten fachlichen Entwicklungsindikatoren separat festgelegt bzw. aus der ursprünglichen Freigabe eindeutig rekonstruiert werden. Es dürfen dafür keine neuen Schwellen aus Alter, Grammwerten oder technischen Bestandswerten erfunden werden.

---

# 2. Grundreihenfolge des automatischen Planners

Für jeden aktiven Mahlzeitenslot gilt fachlich folgende Reihenfolge:

1. **bestehende manuelle/feste Planung respektieren**;
2. **harte Auto-Eignung prüfen**;
3. **gegebenenfalls genau eine Einführung/Wiederholung des Tages zuweisen**;
4. ansonsten vorhandenen geeigneten Rezeptvorrat bzw. bekannte Planung verwenden;
5. FOOD-Begleiter nur innerhalb der bestehenden Gates auswählen;
6. Recipe-first darf eine fachlich passende Rezeptdarstellung herstellen;
7. Rollen `base/component/sample` kanonisch festlegen;
8. sofern für die konkrete Mahlzeit strukturierte Handlingdaten vorliegen, `presentationMode` nur additiv aus den bereits sicheren Darreichungswegen und der Präferenz ableiten;
9. Vorrat/Locks/Persistenz aus genau diesem Ergebnis ableiten.

Nachgelagerte Darstellungslogik darf niemals eine fachlich andere Mahlzeit vortäuschen als der gespeicherte Planner-Zustand. `presentationMode` darf deshalb weder Fokus, FOOD-Komponenten, Rollen noch Rezeptidentität ändern.

---

# 3. Harte Auto-Eignung von FOODs ✅ main

Die automatische Planung darf ein FOOD nur verwenden, wenn alle für den jeweiligen Pfad geltenden harten Voraussetzungen erfüllt sind.

Dazu gehören insbesondere:

- FOOD ist aktiv;
- `FOOD.meals` erlaubt den konkreten Mahlzeitenslot;
- `autoPlan !== false`;
- `minAgeMonths` ist erreicht;
- `minPhase` ist erreicht;
- FOOD ist nicht pausiert;
- Planner-Rolle erlaubt die jeweilige Verwendung als Fokus/Basis/Komponente;
- bestehende Safety-/Allergenregeln werden eingehalten.

Diese Auto-Eignung gilt nicht nur für den Fokus, sondern auch für:

- Hauptbasis;
- Begleiter;
- Rezeptzutaten;
- automatische Snackrezepte;
- automatische Add-ons;
- automatische Follow-ups.

**Manuelle Verwendung ist davon getrennt.** `autoPlan:false` bedeutet nicht automatisch, dass ein Lebensmittel manuell verboten ist.

## 3.1 PLAN-07 – Mahlzeiteneignung ✅ main

`FOOD.meals` ist ein harter Gate vor Kombination und Scoring.

Custom-FOODs erhalten keine pauschale Frühstück/Mittag/Abend-Eignung, sondern kategoriespezifische Defaults.

Referenzfall:

- Banane + Pferdefleisch zum Frühstück war ein Mahlzeiteneignungsfehler, kein Anlass für eine allgemeine Pair-Blacklist.

---

# 4. Lebensmittelstatus und Rollen

## 4.1 Statusmodell 🟠 Bestandsverhalten

Der aktuelle Planner unterscheidet:

- `Offen`
- `Probiert`
- `Verträgliche Basis`
- `Regelmäßig`
- `Pausiert`

Das Bestandsmodell leitet automatische Statuswerte aus protokollierten Gaben ab und erlaubt weiterhin manuelle Statuswerte.

Wichtig für den Planner:

- ein bereits erfolgreich probiertes FOOD kann als bekannte Komponente kombinierbar sein;
- eine **Hauptbasis** benötigt die strengere bestehende Basis-Eignung;
- `Pausiert` bleibt ein harter Ausschluss im automatischen Pfad.

Die exakten Statusschwellen sind Bestandsverhalten und dürfen nicht nebenbei im Rahmen anderer Planner-Arbeiten verändert werden.

## 4.2 Kanonischer Rollenvertrag PLAN-08 ✅ main

Jede FOOD-Mahlzeit hat einen einheitlichen Rollenvertrag:

- `base` = Hauptbasis;
- `component` = bekannte Komponente;
- `sample` = Kostprobe/Einführung.

`baseFoodIds`, `sampleFoodIds` und `foodRoles` müssen dieselbe fachliche Aussage tragen.

Die Rollen müssen identisch bleiben zwischen:

- Planner-Erzeugung;
- Auto-Lock;
- Persistenz;
- Hydration/Reload;
- Wochenkarte;
- Bearbeiten-Dialog.

Referenzfall:

**Kartoffel + Gurke**

- Kartoffel = Hauptbasis;
- Gurke = bekannte Komponente.

Die bestehende strenge Editor-Validierung wird nicht gelockert. Der Planner muss Zustände erzeugen, die seine eigene Validierung ohne Rollenänderung akzeptiert.

---

# 5. Einführung neuer Lebensmittel und Wiederholungen

## 5.1 Höchstens eine Einführung pro automatischem Planungstag ✅ main

Der Tagesplan führt nicht in mehreren Mahlzeiten unabhängig voneinander neue FOODs ein.

Der Planner besitzt dafür einen Tageszustand (`introAssigned`). Sobald die geplante Einführung/Wiederholung des Tages zugewiesen ist, werden weitere normale Slots mit bekannten Lebensmitteln geplant.

Ein bewusst gesetzter Override für ein noch nicht ausreichend bekanntes FOOD kann den Einführungsslot bestimmen.

## 5.2 Einführungsarten ✅ main

Der Planner unterscheidet aktuell insbesondere:

- `neu`;
- `gezielt wiederholen`;
- `bekannt kombinieren`;
- `Allergen einführen`;
- `Allergen wiederholen`;
- `bekannt`;
- bewusst manuell gesetzte Planung.

Eine neue Kostprobe bleibt als `sampleFoodId` erkennbar und wird nicht durch Recipe-first oder Darstellung in eine bekannte Hauptbasis umgedeutet.

## 5.3 Einführungsrhythmus 🟠 Bestandsverhalten

Der aktuelle Planner verwendet `newFoodEvery` zur zeitlichen Taktung automatischer Einführungen; der Default beträgt aktuell 2 Planungstage.

Dieser Wert ist vorhandene Planner-Konfiguration. Eine zukünftige fachliche Änderung dieses Rhythmus ist eine eigene Entscheidung und darf nicht aus dem Phasenmodell abgeleitet werden.

---

# 6. Allergene

## 6.1 Allergenstatus datengetrieben ✅ main

Allergenlogik verwendet das strukturierte `allergenGroup`/Allergen-Familienmodell und keine frei erfundenen Speziallisten pro neuem FOOD.

Neue Allergengruppen müssen durch dieselbe Plannerlogik laufen wie bereits vorhandene.

## 6.2 Einführung und Wiederholung ✅ main

- Ein noch offenes Allergen kann nur eingeführt werden, wenn eine geeignete bekannte Basis vorhanden ist.
- Fällige Allergene können gezielt wiederholt werden.
- Allergen-Wiederholungen dürfen vorhandene harte Mahlzeiten-/Safety-Gates nicht umgehen.

## 6.3 Nüsse/Samen: Komponente, Sample und Topping ✅ main

Fachlich beschlossen und auf `main` integriert:

- Nuss- und Samen-FOODs werden nach erfolgreicher Einführung **nicht** zu normalen automatischen Mahlzeiten-Fokussen oder Hauptbasen.
- Einführung, gezielte frühe Wiederholung und Allergen-Wiederholung bleiben ausdrücklich möglich. In diesen Pfaden bleibt Nuss/Samen eine `sample`-Kostprobe mit geeigneter bekannter Basis.
- Eine frühe Nuss-/Samen-Wiederholung darf nicht durch den allgemeinen Statuspfad zu `bekannt kombinieren` und damit zu einer normalen Hauptkomponente umgedeutet werden.
- Gibt es innerhalb derselben bereits strukturiert verknüpften FOOD-/Allergen-Familie eine explizit freigegebene Mus-/Pastenform, darf diese als sichere Sample-Form bevorzugt werden. Aktuell betrifft das die vorhandenen Nussmus-Varianten sowie Tahin; es wird **keine pauschale Regel aus beliebigen Nuss-/Samen-Namen abgeleitet**.
- Ein solches Mus-/Pasten-Sample darf als **Kostproben-Topping auf einen eindeutigen Obst-Getreide-Brei** gesetzt werden, wenn die zugrunde liegenden Rezeptzutaten bekannt, automatisch geeignet und nach dem bestehenden Recipe-first-Vertrag eindeutig auswählbar sind.
- Das Topping bleibt dabei `sampleFoodId` und damit separat protokollierbar. Die kanonische Rezeptidentität bleibt der Obst-Getreide-Brei; das Topping wird nicht als erfundene Pflichtzutat in das Rezept geschrieben.
- Ist keine Einführung/Wiederholung geplant, wird nicht automatisch auf jeden Brei ein Nussmus gesetzt. Bekanntes Nuss-/Samenmus kann weiterhin als echte vorhandene Rezeptzutat/Komponente vorkommen oder bewusst manuell ergänzt werden.
- Die Regel betrifft die fachliche Rolle von **Nuss/Samen**, nicht Allergene allgemein. Ei, glutenhaltiges Getreide, Milch, Fisch und andere geeignete Allergen-FOODs behalten ihre bestehenden Rollenregeln.
- Rezepte mit Nuss-/Samen-Zutaten bleiben zulässig, sofern alle bestehenden Auto-, Safety-, Mahlzeiten- und Recipe-first-Gates erfüllt sind.

Der Block ist auf `main` integriert und durch die vorhandenen Nuss-/Samen-/Topping-Regressionen abgesichert.

---

# 7. Milch – MILK-01 ✅ main

Für volle Milchmahlzeiten gelten harte Tagesregeln:

- höchstens eine automatische **volle Milchmahlzeit** pro Tag;
- `milkMeal:"small"` zählt nicht als volle Milchmahlzeit und darf eine spätere volle Milchmahlzeit nicht blockieren;
- eine volle Milchmahlzeit wird automatisch nicht mit Fleisch/Fisch kombiniert;
- Rapsöl wird einer vollen Milchmahlzeit nicht automatisch als Zubereitungs-Add-on ergänzt;
- Recipe-first darf die während der FOOD-Planung verwendete Milchklassifikation nicht nachträglich widersprüchlich ändern.

Diese Regeln gelten auch gegen bekannte Allergen-/Basis-Bypasspfade.

---

# 8. Kombinationen und Eisen – PLAN-08-X1 ✅ main

## 8.1 Keine blind angehängte dritte Eisenkomponente

Der alte nachgelagerte `ironCompanion()`-Dreierfallback ist produktiv neutralisiert.

FOOD-only entsteht grundsätzlich als:

**Fokus + höchstens ein normal gewählter Begleiter.**

Eisen darf innerhalb dieser normalen Begleiterauswahl bevorzugt werden, aber nicht als dritte freie FOOD-Komponente nachträglich angehängt werden.

## 8.2 Kulinarische Nachrangigkeit

Außerhalb des Frühstücks werden bekannte schräge generische FOOD-only-Kombinationen nachrangig behandelt:

- Obst + Gemüse/Wurzel, Referenz `Banane + Karotte`;
- Obst + herzhafte Proteinquelle, Referenz `Banane + Rind`.

Gibt es eine fachlich neutralere geeignete Alternative, wird diese bevorzugt.

Es gibt weiterhin **keine allgemeine harte Pair-Blacklist**.

Ein echtes vorhandenes Rezept kann eine Kombination über seinen eigenen Rezeptvertrag legitimieren.

## 8.3 Single-Starch bleibt hart

Automatische freie Kombinationen sollen nicht mehrere konkurrierende Stärkequellen erzwingen. Die bestehende Single-Starch-Schranke bleibt erhalten.

---

# 9. Recipe-first ✅ main

Recipe-first ersetzt keine fachlichen Gates, sondern arbeitet innerhalb der bereits geeigneten Planung.

## 9.1 Exakte Promotion

Eine bekannte FOOD-Kombination darf zu einem vorhandenen Rezept promoviert werden, wenn eine aktuell geeignete Rezeptvariante exakt dieselben FOOD-IDs verwendet.

Kein Rezeptname darf nur aus einer optisch ähnlichen Kombination erfunden werden.

## 9.2 Proaktive Rezeptwahl

Eine bereits geplante FOOD-Mahlzeit darf um **bekannte und automatisch geeignete** Rezeptzutaten erweitert werden, wenn dadurch eine eindeutige passende Rezeptvariante entsteht.

Dabei gilt verbindlich:

**Ein Rezept darf 0 oder genau 1 neues FOOD enthalten – niemals 2 oder mehr.**

Das eine neue FOOD muss bereits die einzige geplante Kostprobe der Mahlzeit sein. Alle übrigen Rezeptzutaten müssen bekannt und automatisch geeignet sein.

Ohne geplante Kostprobe darf Recipe-first kein unbekanntes FOOD ergänzen.

Ein nach Abschnitt 6.3 geplantes Nuss-/Samenmus-Topping bleibt die eine Kostprobe der Mahlzeit. Die zugrunde liegenden Zutaten des Obst-Getreide-Breis müssen vollständig bekannt und geeignet sein; das Topping wird nicht in die kanonische Rezeptzutatenmenge umgedeutet.

## 9.3 Mehrdeutige Rezepte

Wenn mehrere unterschiedliche Rezeptformen nach bestehenden Kriterien gleichrangig passen, wird keine Darreichungsform geraten.

Technische Auswahlpriorität bei proaktiven Kandidaten:

1. möglichst wenige zusätzliche bekannte Zutaten;
2. danach geringere `recipePlannedUse`-Nutzung;
3. bei weiterem Gleichstand keine automatische Auswahl.

## 9.4 Vorrat und Prep

- echter Rezeptvorrat darf bevorzugt verwendet werden, wenn die Vorratspräferenz aktiv und Bestand vorhanden ist;
- eine frische Recipe-first-Mahlzeit behält ihre einzelnen Zutatenreservierungen;
- erst tatsächlich verwendeter Rezeptvorrat ersetzt diese Einzelreservierungen;
- frische Recipe-first-Gerichte erscheinen als Rezept-Prep und nicht zusätzlich als mehrere lose Prep-Aufgaben;
- die Einkaufsliste berücksichtigt weiterhin die Zutaten.

---

# 10. Automatischer Snack ✅ main

- Kein automatischer Snack in Phase 1–3.
- Phase 3: Snack nur manuell möglich.
- Phase 4: automatischer Snackslot.
- Automatische Snack-Eignung wird über vorhandene geeignete Snack-Rezepte bestimmt, nicht über ein pauschales allgemeines FOOD-`snack`-Feld.
- Auch Snack-Rezeptzutaten müssen die harten Auto-Gates erfüllen.

---

# 11. Vorrat und Rotation 🟠 Bestandsverhalten

Der aktuelle Planner berücksichtigt vorhandenen Vorrat sowie Nutzungs-/Rotationshistorie bei der Auswahl.

Verbindliche Grenzen:

- Vorrat darf keine Safety-, Mahlzeiten-, Alters-, Phasen- oder Auto-Eignungsregel umgehen;
- ein vorhandener Rezept-/FOOD-Vorrat darf nur reserviert werden, wenn er tatsächlich für die geplante Mahlzeit verwendet wird;
- Neuplanung und Auto-Lock-Rebuild dürfen keine Doppelreservierung erzeugen.

Die konkrete Gewichtung von Vorrat gegenüber anderen gleich geeigneten Kandidaten ist Bestandsverhalten und keine implizite neue Fachregel.

---

# 12. Saison und Reisepriorisierung

## 12.1 Datengetriebene Saisonpriorität ✅ main

Der Planner liest ausschließlich `seasonMonths` aus den FOOD-Daten.

Wenn Saisonpriorisierung aktiv ist:

- FOOD in Saison wird bevorzugt (`-3` bestehender Score);
- FOOD mit definierter Saison außerhalb seiner Saison wird nachgereiht (`+6` bestehender Score);
- `seasonMonths: []` bleibt bewusst neutral und erhält weder Saisonbonus noch Outside-Season-Nachreihung.

Der frühere Consumer-Gap, bei dem `isSeason()` leere `seasonMonths` als saisonal behandeln und dadurch einen ungewollten Bonus auslösen konnte, ist auf `main` geschlossen: Der Saisonbonus setzt tatsächlich vorhandene Saisonmonate voraus. Im `phMode === "travel"` greift die Österreich-Saisonwertung weiterhin nicht.

## 12.2 Vollständige Saisonmatrix ✅ main

Der vollständige österreichische `seasonMonths`-Audit ist fachlich abgeschlossen. Verbindliche Modellierungsentscheidung:

**`regional aus Lagerung` zählt bei `seasonMonths` mit.**

Die exakte Matrix und die bewusst neutralen `seasonMonths: []`-Fälle sind in `docs/FOOD_SEASONMONTHS_AT_AUDIT.md` dokumentiert. Die fachlich freigegebene Matrix wurde auf `main` integriert und mit PR #11 vollständig gegen den aktuellen FOOD-Stamm abgeglichen. Die Regression prüft den gesamten physischen FOOD-Stamm exakt gegen diese Matrix; Runtime-Policy-Ergänzungen ohne eigene freigegebene Österreich-Matrix bleiben neutral.

Der Planner leitet daraus **keine neue Sonderlogik** ab, sondern konsumiert weiterhin ausschließlich die Daten.

## 12.3 Philippinen-/Reisepriorität 🟠 Bestandsverhalten

Der bestehende Planner kann `ph`/Reisevorbereitung als Priorisierung verwenden. Diese Priorisierung darf harte Auto-/Safety-Gates nicht übergehen.

---

# 13. Reaktionen, Ablehnungen und Kombination-Pause ✅ main

- Ein FOOD mit Reaktionsstatus kann pausiert werden und fällt aus automatischer Planung.
- Abgelehnte Kombinationen können zeitweise nachgereiht/pausiert werden.
- Eine pausierte Kombination darf weder über Eisenpräferenz noch über einen weichen kulinarischen Fallback wieder eingeschleust werden.
- Spätere erfolgreiche Kombinationen dürfen die Historie entsprechend neu bewerten.

---

# 14. Neuplanung und Schutzmechanismen ✅ main

## 14.1 „Neu planen“

Die normale Neuplanung bereinigt nur den normalen automatischen Zustand der sichtbaren sieben Tage.

Erhalten bleiben insbesondere:

- manuelle Schutzmechanismen;
- Follow-ups/Wiedervorlagen;
- manuell hinzugefügte Mahlzeiten;
- Zustände außerhalb der sichtbaren Woche.

## 14.2 Einzelnes „Bearbeiten“

Das Bearbeiten eines einzelnen bestehenden Slots ersetzt nur diesen Slot und schützt ihn anschließend manuell.

Andere Slots werden nicht mitneu geplant.

## 14.3 „Sichtbare Woche vollständig neu planen“

Die vorhandene Semantik bleibt:

- mit Schutz: entspricht im Wesentlichen der normalen automatischen Bereinigung;
- mit Freigabe lösbarer Locks: lösbare feste Planungen können aufgehoben werden;
- protokollierte Mahlzeiten, Follow-ups und manuell hinzugefügte Mahlzeiten bleiben geschützt.

Diese beiden Neuplanungsarten dürfen nicht stillschweigend semantisch zusammengelegt werden.

---

# 15. Persistenz und Rollenstabilität ✅ main

Ein automatisch erzeugter Plan muss auch nach Auto-Lock und Reload fachlich derselbe Plan bleiben.

Insbesondere dürfen sich nicht verändern:

- `focusId`;
- `foodIds`;
- `baseFoodIds`;
- `sampleFoodIds`;
- `foodRoles`;
- `recipeName`/Rezeptidentität;
- Milchklassifikation;
- relevante Vorratsreservierungen;
- `presentationMode`, sofern es für eine neu geplante Mahlzeit strukturiert gesetzt wurde.

Für historische Datensätze ohne `presentationMode` darf kein Fallback aus `textureStage` erfunden werden.

Der Bearbeiten-Dialog muss einen automatisch erzeugten Plan ohne fachliche Umklassifizierung wieder öffnen können.

Für Nuss-/Samen-Toppings gilt zusätzlich: Eine automatisch gelockte Kostprobe muss nach Reload weiterhin Sample bleiben. Ein alter automatischer Nuss-/Samen-Hauptfokus darf nicht als gültige neue Rollenwahrheit konserviert werden; echte Rezeptzutaten bleiben davon unberührt.

---

# 16. Darreichungsweg / Handling ✅ main

Die allgemeine Handling-/BLW-Schicht ist auf `main` integriert.

Verbindlicher Vertrag:

**Brei/Löffelkost und geeignetes BLW/Fingerfood sind parallele Darreichungswege ab allgemeiner Beikostreife.**

`feedingApproach = spoon | fingerfood | mixed` ist:

- eine Präferenz;
- keine Entwicklungsstufe;
- kein Safety-Override;
- kein Grund, Fokus, FOOD-Komponenten, Rollen oder Rezeptidentität zu ändern.

Strukturiertes `presentationMode` ist additiv und wird nur dort gesetzt, wo für die konkrete Mahlzeit bereits sichere strukturierte Darreichungswege vorliegen. Die Präferenz darf sichere Alternativen nur gewichten, nicht fachlich verbieten.

Historische Locks/Logs ohne Feld bleiben unverändert und historische `textureStage`-Werte werden nicht umgedeutet. Die Steuerlogik leitet Handling nicht aus `safeForm`-/`note`-Freitexten ab.

### 16.1 Bite Separation und orale Verarbeitung 🟡 Branch/Integrations-PR

Für zusammenhängende Fingerfoods reicht der Handlingmodus allein nicht aus. Die fachlich freigegebene Detailreferenz ist:

`docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md`

Der Integrations-PR trennt drei unabhängige Ebenen:

1. **Handling** – z. B. `finger-graspable` oder `finger-small-soft`;
2. **Bite Separation** – was das gezielte Abtrennen eines passenden beherrschbaren Bissens aus der zusammenhängenden Form verlangt;
3. **Oral Processing** – was der bereits abgetrennte Bissen im Mund verlangt.

Bite Separation verwendet für zusammenhängende `finger-graspable`-Formen:

- `low-resistance-separate`;
- `easy-bite-separate`;
- `graded-bite-required`.

Nur `graded-bite-required` verlangt die beobachtete Capability `graded-bite`: einen gezielt dosierten Kieferschluss bei einem weichen, aber formstabilen zusammenhängenden Stück, um einen passenden Bissen abzutrennen. Das ist keine Alters-, Zahn- oder Rezeptkategorie-Regel.

Post-separation-Oral-Processing verwendet:

- `soft-breakdown`;
- `easy-chew`;
- `structured-chew-required`.

Nur `structured-chew-required` verlangt die beobachtete Capability `structured-chew`.

Zusätzlich bleibt `small-soft-pieces` ausschließlich eine Handling-/Selbstfütterungs-Capability für `finger-small-soft`: kleine weiche Stücke gezielt aufnehmen und zum Mund führen.

Alle drei Capabilities werden getrennt gespeichert:

```js
handlingCapabilities: {
  smallSoftPieces: false,
  gradedBite: false,
  structuredChew: false
}
```

Verbindlich gilt:

- keine lineare Skill-Leiter;
- `graded-bite` impliziert nicht `structured-chew` und umgekehrt;
- keine Capability wird aus einer anderen Capability, Alter, Zähnen, `textureStage`, Rezeptkategorie, `stage` oder `minMonths` abgeleitet;
- `minMonths` bleibt Altersorientierung, `hardMinMonths` bleibt echten unabhängigen Alters-/Safety-Gates vorbehalten;
- Zwei-Finger-Zerdrückbarkeit ist ein relevantes Prüfmerkmal, aber keine automatische Einstufungsregel;
- die konkrete kanonische Servierform entscheidet, nicht der bloße Rezepttyp.

Der gezielte Recheck der 41 zuvor bestehenden zusammenhängenden `finger-graspable`-Rezepte ergibt im Integrations-PR:

- 13 × `low-resistance-separate`;
- 28 × `easy-bite-separate`;
- 0 × `graded-bite-required`.

Im aktuellen **105er Laufzeitkatalog** kommen zwei einzeln geprüfte neue graded-bite-Referenzfälle hinzu:

- `Pizza Wrap`: `graded-bite-required` + `easy-chew`, verlangt nur `graded-bite`;
- `Chicken Fajita Wrap`: `graded-bite-required` + `structured-chew-required`, verlangt `graded-bite` und `structured-chew`.

Damit bleibt die 41er Bestandsmatrix unverändert. Die beiden neuen Wrap-Einstufungen sind Einzelentscheidungen aus ihrer konkreten kanonischen Servierform und keine Kategorienregel.

Vier zuvor bestehende Rezepte verlangen nach separater Prüfung des bereits abgetrennten Bissens weiterhin `structured-chew`, bleiben Bite-seitig aber `easy-bite-separate`:

- Rind-Hafer-Bällchen;
- Baby-Bananenbrot;
- Weiche Joghurt-Fladen;
- Huhn-Gemüse-Muffins.

Die drei Nockerl bleiben `finger-small-soft` + `small-soft-pieces` und oral `soft-breakdown`; Bite Separation ist für bereits einzeln angebotene kleine Stücke nicht anwendbar.

Die dynamisch geladene Handling-/Bite-/Oral-Contract-/Runtime-Schicht wird zusammen mit der Planner-Policy-Kette vor dem finalen sichtbaren Render installiert und für den ersten Offline-Start vorgecached. Recipe-first verwendet dieselbe zentrale Eligibility und erhält keine zweite parallele Bite-/Oral-Schranke.

---

# 17. Bewusst offene Planner-Punkte

## 17.1 Fachlich beschlossen, aber noch nicht vollständig auf main nachgewiesen

1. ⚠️ **PHASE-TRANSITION:** entwicklungsorientierte Empfehlung des nächsten Phasenwechsels plus bewusste Bestätigung. Bestätigung und manueller Wechsel sind vorhanden; eine eigenständige Entwicklungs-Empfehlungslogik ist noch nicht nachgewiesen.

Für den Handling-/Bite-/Oral-Bereich besteht im Integrations-PR keine offene Gruppenmigration mehr: alle **105 Laufzeitrezepte** sind explizit im Contract vertreten. Die bestehende 103er Auditmatrix bleibt erhalten, die 41 zuvor bestehenden zusammenhängenden Fingerfoods wurden gezielt für Bite Separation nachgeprüft und die zwei neuen Wrap-Rezepte sind separat als graded-bite-Referenzfälle klassifiziert. Neue FOODs/Rezepte benötigen weiterhin ihre eigene explizite Einzelklassifikation gemäß `AGENTS.md`.

Weitere offene FOOD-Datenfragen werden separat im FOOD-Fachregel-Track geklärt und dürfen nicht als implizite Planner-Regel erfunden werden.

---

# 18. Verbindliche Regressionen

Änderungen am Planner müssen mindestens folgende Verträge regressiv erhalten:

- Phasenmodell und Mahlzeitenslots;
- PHASE-TRANSITION: kein automatischer Phasenwechsel durch Alter oder Grammwerte; bei späterer Implementierung der Empfehlung klare Trennung zwischen Empfehlung und bestätigtem Wechsel;
- genau eine Einführung/Wiederholung pro automatischem Planungstag;
- Mahlzeiteneignung/PLAN-07;
- Auto-Gates für Fokus, Basis, Begleiter, Rezeptzutaten, Snack und Add-ons;
- MILK-01;
- Allergen-Einführung/-Wiederholung;
- Nuss/Samen werden nicht normale automatische Hauptbasis oder bekannter Fokus;
- Nuss-/Samen-Einführung und gezielte Wiederholung bleiben Sample-Pfade; eine geeignete verknüpfte Mus-/Pastenform darf dabei bevorzugt werden;
- Nuss-/Samenmus als Sample-Topping darf nur auf einen eindeutigen geeigneten Obst-Getreide-Brei promoviert werden, bleibt protokollierbares `sampleFoodId` und verändert nicht die Rezeptidentität;
- keine pauschale automatische Nussmus-Zugabe zu jedem Brei;
- andere Allergene werden durch die Nuss-/Samen-Rollenregel nicht eingeschränkt;
- PLAN-08-X1 / kein dritter Eisenfallback;
- Single-Starch;
- Recipe-first einschließlich maximal einem neuen FOOD;
- Rollenstabilität `base/component/sample` Plan → Lock → Reload → Editor;
- Vorrats-/Recipe-first-Reservierungen;
- Replan-Semantik;
- bestehende Follow-up-/Schutzmechanismen;
- vollständige österreichische `seasonMonths`-Matrix einschließlich bewusst neutraler FOODs;
- `seasonMonths: []` erhält weder Saisonbonus noch Outside-Season-Nachreihung; PH-Travel ignoriert die Österreich-Saisonwertung;
- `feedingApproach` verändert nur die Darreichungspräferenz und nicht die fachliche Mahlzeitenauswahl;
- keine sichere Darreichung wird durch die Präferenz fachlich unzulässig;
- keine historische Lock-/Log-/`textureStage`-Semantik wird durch Handling umgedeutet;
- `presentationMode` bleibt additiv und persistiert nur, wenn es strukturiert gesetzt wurde;
- PLAN-08-Auswahl, Rollen und Rezeptidentität bleiben durch Handling unverändert;
- Handling-/Bite-/Oral-Contract und -Runtime stehen vor finalem sichtbaren Render sowie beim ersten Offline-Start zur Verfügung;
- 105 Laufzeitrezepte bleiben 105 expliziten Contract-Einträgen zugeordnet;
- 41 zuvor bestehende `finger-graspable`-Rezepte bleiben explizit 13 `low-resistance-separate` / 28 `easy-bite-separate` / 0 `graded-bite-required` zugeordnet;
- `Pizza Wrap` verlangt `graded-bite` + `easy-chew`, `Chicken Fajita Wrap` verlangt `graded-bite` + `structured-chew`;
- `graded-bite` bleibt als eigenständige Capability technisch prüfbar und darf nicht aus Alter, Zähnen, Rezeptkategorie oder `structured-chew` abgeleitet werden;
- die vier zuvor bestehenden `structured-chew`-Fälle bleiben Bite-seitig `easy-bite-separate` und benötigen kein `graded-bite`;
- die drei `finger-small-soft`-Nockerl werden nur durch `small-soft-pieces` freigegeben;
- Omelettstreifen bleiben ein Gegenbeispiel gegen Kategorienlogik: `finger-graspable` + `low-resistance-separate` ohne zusätzliche Bite-/Oral-Capability;
- keine Bite-/Oral-Einstufung wird aus Rezeptkategorie, `stage`, `minMonths`, Zähnen oder bloßem Zwei-Finger-Test abgeleitet.

---

# 19. Quellen im Repository

Historischer Ursprung:

- Commit `f9f886c82af2ce267c10571e5e89df787037c6b0` – `Import Chesters Beikost App 10.1.24 Phasenmodell-v2`.

Aktuelle Kernquellen:

- `js/state.js`
- `js/model.js`
- `js/planning.js`
- `js/planner-meal-eligibility.js`
- `js/planner-milk-policy.js`
- `js/planner-iron-preference.js`
- `js/planner-recipe-first.js`
- `js/planner-proactive-recipe.js`
- `js/planner-food-role-stability.js`
- `docs/PLAN-08_COMBINATION_AUDIT.md`
- `docs/PLAN-08_RECIPE_FIRST.md`
- `docs/FOOD_SEASONMONTHS_AT_AUDIT.md`

Zentrale Regressionen:

- `tests/todo3-phase-model.test.cjs`
- `tests/todo3-food-auto-integration.test.cjs`
- `tests/todo3-replanning.test.cjs`
- `tests/planner-meal-eligibility-p0.test.cjs`
- `tests/milk-01-planner.test.cjs`
- `tests/plan-08-combination-audit.test.cjs`
- `tests/plan-08-iron-preference.test.cjs`
- `tests/plan-08-food-role-stability-p0.test.cjs`
- `tests/planner-recipe-first.test.cjs`
- `tests/planner-proactive-recipe-first.test.cjs`
- `tests/planner-proactive-recipe-intro-exact.test.cjs`
- `tests/planner-nut-seed-toppings.test.cjs`
- `tests/planner-nut-seed-review-fixes.test.cjs`
- `tests/planner-nut-seed-focus-gate-chain.test.cjs`
- `tests/todo3-pending-regressions.test.cjs`
- `tests/food-seasonmonths-at.test.cjs`
- `tests/food-seasonmonths-runtime.test.cjs`

Handling-Integrationsstand zusätzlich:

- `docs/NEXT_CHAT_FOOD_HANDLING_READINESS.md`
- `docs/FOOD_HANDLING_READINESS_PLAN.md`
- `docs/FOOD_HANDLING_READINESS_TECHNICAL_DESIGN.md`
- `docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md`
- `data/food-handling.js`
- `js/handling-readiness.js`
- `tests/handling-readiness.test.cjs`
- `tests/handling-readiness-integration.test.cjs`
- `tests/handling-planner-preference.test.cjs`
- `tests/handling-presentation-mode.test.cjs`
- `tests/planner-policy-boot-lock.test.cjs`
- `tests/handling-offline-precache.test.cjs`
- `tests/bananen-ei-pancakes.test.cjs`