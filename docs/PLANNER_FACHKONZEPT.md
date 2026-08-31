# Chesters Beikost-App – kanonisches Planner-Fachkonzept

Stand: 28.08.2026  
Dokumentationsbasis: aktueller Planner-Stand auf Basis von `main` bis `15d72f06de747cbac08de7c42b379d7b90bf2b36`, einschließlich gemergter Handling-/BLW-Schicht, dokumentiertem Oral-Processing-Contract, gemergtem Nuss-/Samen-/Topping-Block, vollständiger österreichischer `seasonMonths`-Matrix, aktuellem FOOD-COUNT-Identitätsstand und der fachlich freigegebenen täglichen Lebensmittel-Einführung; historischer Phasenmodell-v2-Stand `f9f886c82af2ce267c10571e5e89df787037c6b0`. PHASE-TRANSITION ist inzwischen über PR #83 auf `main` integriert; die strukturierte Planner-Einbindung und sichtbare Phase-Readiness-UX wurden anschließend über PR #89, #94 und #95 auf `main` ergänzt. Aktueller `main` für diesen PHASE-TRANSITION-Statusabgleich: `d7de972bd32f0a510b19c9fead7d6537ba3e20c6`.

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

## 1.3 PHASE-TRANSITION – entwicklungsorientierte Empfehlung ✅ main

Der Readiness-Core beantwortet **ausschließlich**, ob der Übergang in die nächste Beikostphase empfohlen werden kann. Er verändert `phaseSelected` nicht, ruft keinen Phasenwechsel auf und bleibt vollständig getrennt von der bestehenden bewussten Nutzerbestätigung.

Die Kriterien folgen der fachlich freigegebenen, aus offiziellen Beikostempfehlungen abgeleiteten qualitativen Logik: Mahlzeitenrhythmus wird schrittweise, ohne Druck und nach den individuellen Signalen des Kindes an den Familienrhythmus angepasst. Daraus werden **keine** starren Alters-, Mengen- oder Zeitgrenzen für den individuellen Phasenwechsel abgeleitet.

Verbindlich sind für jeden Übergang genau drei qualitative Signale:

1. `currentPatternAccepted`: Die in der aktuellen Phase vorgesehenen Beikostmahlzeiten werden grundsätzlich angenommen bzw. sind im Alltag etabliert.
2. `additionalMealCue`: Das Kind zeigt an der konkret neu hinzukommenden Essensgelegenheit Hunger, Interesse oder einen tatsächlichen zusätzlichen Essbedarf.
3. `routineCompatible`: Die zusätzliche regelmäßige Mahlzeit passt sinnvoll in den Tages-/Familienrhythmus.

Alle drei Signale werden ausdrücklich als `yes`, `no` oder `unknown` behandelt. `unknown` ist keine negative Bewertung, sondern eine fehlende Voraussetzung für eine Empfehlung.

Die Übergänge verwenden dieselbe Kernregel:

| Aktuelle Phase | Nächste Phase | Neuer Auto-Slot | Spezifische Bedeutung von `additionalMealCue` |
|---|---|---|---|
| Kennenlernen | Mahlzeitenaufbau | Frühstück | Hunger/Interesse an einer zusätzlichen regelmäßigen Frühstücks-Essensgelegenheit |
| Mahlzeitenaufbau | Drei Hauptmahlzeiten | Abendessen | Hunger/Interesse an einer zusätzlichen regelmäßigen Abend-Essensgelegenheit |
| Drei Hauptmahlzeiten | Familienkost | Snack | tatsächlicher regelmäßiger Zusatzbedarf zwischen den drei Hauptmahlzeiten |
| Familienkost | – | – | terminale Phase; keine weitere Empfehlung |

Entscheidung:

- nur `currentPatternAccepted = yes` **und** `additionalMealCue = yes` **und** `routineCompatible = yes` → `recommended`;
- sobald ein Signal `no` ist → `notYet`;
- solange mindestens ein benötigtes Signal `unknown` ist → `notYet` mit explizit ausgewiesener fehlender Voraussetzung.

Insbesondere gilt:

- Alter ist **kein** PHASE-TRANSITION-Gate und verändert `recommended` nicht;
- Grammwerte, Anzahl der Logs, Zahl erfolgreicher Tage oder Dauer in der Phase sind keine Readiness-Schwellen;
- Texturstufe, BLW-/Handling-Fähigkeit, Allergenstatus, Milchmenge, Vorrat, manuelle Mahlzeiten und Locks sind keine PHASE-TRANSITION-Readiness-Signale;
- bei 3→4 reicht „drei Mahlzeiten funktionieren“ allein nicht: Für den automatischen Snack muss ein tatsächlicher zusätzlicher Essbedarf vorliegen;
- ein tatsächlicher Phasenwechsel erfolgt weiterhin ausschließlich über die bestehende bewusste Nutzeraktion; Logs, Vorräte, manuelle Mahlzeiten und Locks behalten ihre Semantik.

### 1.3.1 Technischer Readiness-Vertrag

Der zentrale Readiness-Zustand liefert mindestens:

- `currentPhase`;
- `nextPhase`;
- den neu hinzukommenden Mahlzeitenslot;
- `recommendation`;
- `recommendable`;
- die drei qualitativen `signals`;
- `reasons`;
- `missingPrerequisites`.

Die Berechnung ist read-only und leitet die qualitativen Signale nicht stillschweigend aus Alter, Grammwerten, Logs oder Textur ab. Die bestehende Funktion zum tatsächlichen Phasenwechsel bleibt davon unberührt.

---

# 2. Grundreihenfolge des automatischen Planners

Für jeden aktiven Mahlzeitenslot gilt fachlich folgende Reihenfolge:

1. **bestehende manuelle/feste Planung respektieren**;
2. **harte Auto-Eignung prüfen**;
3. in Frühstück, Mittagessen und Abendessen bei geeigneten offenen Nicht-Allergenen **pro Mahlzeit höchstens eine Kostprobe/Einführung** vor einer rein bekannten Planung bevorzugen; eine Allergen-Einführung oder gezielte Allergen-Wiederholung bleibt dagegen die einzige Lernaufgabe des Tages;
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
- automatisch ausgewähltes bekanntes Obst als Snack;
- automatische Add-ons;
- automatische Follow-ups.

**Manuelle Verwendung ist davon getrennt.** `autoPlan:false` bedeutet nicht automatisch, dass ein Lebensmittel manuell verboten ist.

## 3.1 PLAN-07 – Mahlzeiteneignung ✅ main

`FOOD.meals` ist ein harter Gate vor Kombination und Scoring.

Custom-FOODs erhalten keine pauschale Frühstück/Mittag/Abend-Eignung, sondern kategoriespezifische Defaults.

Referenzfall:

- Banane + Pferdefleisch zum Frühstück war ein Mahlzeiteneignungsfehler, kein Anlass für eine allgemeine Pair-Blacklist.

Für Snacks wird weiterhin **kein allgemeines neues `FOOD.meals = snack`-Modell** eingeführt. Der ausdrücklich freigegebene FOOD-Snackpfad ist eng auf bereits bekanntes Obst begrenzt; alle anderen FOOD-Kategorien werden daraus nicht automatisch als Einzel-Snack abgeleitet.

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
- ein bloß erfolgreich probiertes FOOD ist **keine Pflicht-Wiederholung** und blockiert keine geeignete neue Nicht-Allergen-Einführung;
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

## 5.1 Tägliche Einführung pro Hauptmahlzeit ✅ main

Für **Nicht-Allergene** gilt:

- an jedem Planungstag dürfen geeignete offene FOODs eingeführt werden;
- Frühstück, Mittagessen und Abendessen dürfen jeweils **höchstens ein** neues bzw. als Kostprobe behandeltes FOOD enthalten;
- wenn für einen freien automatischen Hauptmahlzeitenslot ein geeignetes offenes Nicht-Allergen vorhanden ist, wird dieses gegenüber einer rein bekannten Mahlzeit bevorzugt;
- ein bereits erfolgreich probiertes FOOD darf bekannt kombiniert werden, blockiert aber keine neue Einführung und wird nicht allein wegen `Probiert` zur Pflicht-Wiederholung;
- eine echte Ablehnung (`not_accepted`), ein bewusstes Follow-up oder ein expliziter Override darf weiterhin eine gezielte Wiederholung auslösen;
- manuelle Mahlzeiten, Locks, protokollierte Mahlzeiten, Overrides und bestehende harte Gates bleiben geschützt.

Pro Mahlzeit bleibt damit höchstens **ein unbekanntes FOOD** zulässig. Recipe-first darf diesen einen Sample-Pfad darstellen oder mit bekannten geeigneten Zutaten ergänzen, aber kein zweites unbekanntes FOOD hinzufügen.

Für **Allergene** gilt die strengere Tagesregel aus Abschnitt 6: Eine Allergen-Einführung oder gezielte Allergen-Wiederholung ist die einzige automatische Lernaufgabe dieses Tages. Bekannte Mahlzeiten und bekannter Snack bleiben daneben möglich.

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

`bekannt kombinieren` ist dabei ausdrücklich **keine neue Einführung**. Es darf deshalb keinen weiteren freien Hauptmahlzeitenslot desselben Tages als angeblich verbrauchten Lernslot blockieren.

## 5.3 Kein allgemeiner Mehrtages-Takt für Nicht-Allergene ✅ main

Der frühere `newFoodEvery`-Takt steuert die normale automatische Einführung von Nicht-Allergenen nicht mehr. Geeignete offene Nicht-Allergene können täglich und je freier aktiver Hauptmahlzeit geplant werden.

Das bestehende Setting bleibt ausschließlich aus Daten-/Backup-Kompatibilitätsgründen im State erhalten und wird in der Oberfläche nicht mehr als wirksame Planner-Einstellung angeboten. Es darf nicht stillschweigend wieder als Mindestabstand zwischen normalen Nicht-Allergen-Einführungen verwendet werden.

Allergen-Einführungen und -Wiederholungen behalten ihre eigene strengere Logik und werden nicht aus dieser Lockerung abgeleitet.

---

# 6. Allergene

## 6.1 Allergenstatus datengetrieben ✅ main

Allergenlogik verwendet das strukturierte `allergenGroup`/Allergen-Familienmodell und keine frei erfundenen Speziallisten pro neuem FOOD.

Neue Allergengruppen müssen durch dieselbe Plannerlogik laufen wie bereits vorhandene.

## 6.2 Einführung und gezielte Wiederholung ✅ main

- Ein noch offenes Allergen kann nur eingeführt werden, wenn eine geeignete bekannte Basis vorhanden ist.
- Eine gezielte Wiederholung bleibt Teil der Lernphase, wenn sie fachlich noch zur Einführung gehört, etwa als bewusstes Follow-up nach einer Einführung oder Reaktion/Ablehnung.
- Solche Allergen-Wiederholungen dürfen vorhandene harte Mahlzeiten-/Safety-Gates nicht umgehen.
- Sobald automatisch eine Allergen-Einführung oder tatsächlich noch zur Lernphase gehörende gezielte Allergen-Wiederholung geplant wird, ist sie die **einzige automatische Lernaufgabe dieses Tages**; weitere neue Nicht-Allergene oder andere automatische Lernwiederholungen werden an diesem Tag nicht zusätzlich eingeplant.
- Eine bereits manuell/fest geplante andere Kostprobe verhindert umgekehrt, dass zusätzlich automatisch ein Allergen als zweite Lernaufgabe desselben Tages eingeschoben wird.
- Eine routinemäßige Langzeitpflege eines bereits vertragenen Allergens gehört **nicht** in diesen Lernpfad; dafür gilt Abschnitt 6.3.

## 6.3 Langfristige Allergenpflege 🟡 Branch/Integrations-PR

Für bereits verträgliche Allergene ist die regelmäßige Pflegeexposition fachlich von Einführung und gezielter Lernwiederholung getrennt:

- Langfristige Pflege ist **keine neue FOOD-Einführung, keine Kostprobe und keine Lernaufgabe**. Sie darf daher keinen ansonsten freien FOOD-Einführungsslot verbrauchen und wird als normale bekannte Mahlzeit/Komponente behandelt.
- Die Fälligkeit wird nicht mehr allein pro FOOD-ID über `lastDate(foodId)` bewertet. Maßgeblich ist ein zentrales Maintenance-Ziel aus dem vorhandenen strukturierten Allergenmodell.
- Wo eine feinere `allergenFamily` fachlich eine konkrete Allergenquelle trennt, bleibt diese Trennung erhalten. Insbesondere werden unterschiedliche Nussfamilien nicht allein über die breite Gruppe `Schalenfrüchte` gleichgesetzt.
- Für die ausdrücklich freigegebene **Glutenpflege** gilt dagegen `Glutenhaltiges Getreide` als gemeinsames langfristiges Maintenance-Ziel. Ein bereits geeignetes glutenhaltiges Lebensmittel wie Hafer, Weizen oder Dinkel kann deshalb dasselbe Pflegeziel erfüllen. Das macht diese FOODs **nicht** zu derselben Einführungsfamilie und verändert ihre Einführungs-/Statuslogik nicht.
- Ohne feinere Familie wird die bestehende strukturierte `allergenGroup` als langfristiges Pflegeziel verwendet; es wird dafür keine neue medizinische Gruppe erfunden.
- Ein anderes FOOD darf ein Pflegeziel nur erfüllen, wenn es selbst über den normalen bekannten Planner-Pfad für die konkrete Mahlzeit geeignet ist. `autoPlan`, Mahlzeiteneignung, `minPhase`, Alter, `Pausiert`, Safety, Rollen und weitere harte Gates bleiben vollständig wirksam.
- Rezepte können ein oder mehrere Pflegeziele über ihre **tatsächlichen kanonischen Zutaten** abdecken. Ein bloßer Rezeptname genügt nicht.
- Eine bereits geplante passende Mahlzeit oder ein passendes Rezept zählt als **voraussichtliche Abdeckung** für die Planung. Historisch erfüllt bzw. zeitlich zurückgesetzt wird das Pflegeziel erst durch eine protokollierte relevante Zutat mit Ergebnis `eaten`.
- Eine normale Mahlzeit darf mehrere bereits bekannte Pflegeziele gleichzeitig abdecken.
- Der Planner versucht Pflege innerhalb ohnehin geeigneter normaler Mahlzeiten, bekannter Komponenten oder geeigneter Rezepte unterzubringen. Bei wenigen verfügbaren Mahlzeiten darf Pflege nicht praktisch alle Slots als Lernslots blockieren; eine echte FOOD-Einführung behält ihren eigenen Lernslot.
- Ist in einem knappen Plan keine geeignete normale Abdeckung möglich, wird daraus **keine künstliche neue Lernaufgabe** konstruiert.

Referenzfall:

**„Hafer sollte als Allergen wieder angeboten werden; kein geeigneter freier Slot.“**

Eine fällige Langzeitpflege darf diesen FOOD-Lernslot nicht mehr allein wegen der FOOD-ID `hafer` blockieren. Ist das gemeinsame Glutenpflegeziel bereits durch eine andere geeignete geplante glutenhaltige Quelle oder ein passendes Rezept abgedeckt, gilt die Planung voraussichtlich als gedeckt; tatsächlich erfüllt ist sie erst nach protokolliertem Essen der relevanten Zutat.

## 6.4 Nüsse/Samen: Komponente, Sample und Topping ✅ main

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

Ein nach Abschnitt 6.4 geplantes Nuss-/Samenmus-Topping bleibt die eine Kostprobe der Mahlzeit. Die zugrunde liegenden Zutaten des Obst-Getreide-Breis müssen vollständig bekannt und geeignet sein; das Topping wird nicht in die kanonische Rezeptzutatenmenge umgedeutet.

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
- Der Snack nimmt **nicht** an der automatischen Neueinführung teil; offene FOODs werden dort nicht neu eingeführt.
- Ein Snack darf ein vorhandenes geeignetes Snack-Rezept **oder bereits bekanntes geeignetes Obst** sein.
- Vorhandener echter Rezeptvorrat darf weiterhin Vorrang haben; ohne solchen Vorrat kann bekanntes Obst als einfacher Snack geplant werden.
- Der Obstpfad ist ausdrücklich **kein allgemeines neues `FOOD.meals = snack`-Modell**. Aus ihm werden weder Gemüse noch Stärke, Fleisch, Ei oder andere Kategorien pauschal als einzelne automatische Snacks freigeschaltet.
- Bekanntes Obst darf auch manuell als Snack gewählt werden; dafür wird es nicht künstlich zu einem Rezept umgedeutet.
- Auch Snack-Rezeptzutaten und automatisch ausgewähltes Obst müssen die für ihren jeweiligen automatischen Pfad geltenden harten Gates erfüllen.

---

# 11. Vorrat und Rotation 🟠 Bestandsverhalten

Der aktuelle Planner berücksichtigt vorhandenen Vorrat sowie Nutzungs-/Rotationshistorie bei der Auswahl.

Verbindliche Grenzen:

- Vorrat darf keine Safety-, Mahlzeiten-, Alters-, Phasen- oder Auto-Eignungsregel umgehen;
- ein vorhandener Rezept-/FOOD-Vorrat darf nur reserviert werden, wenn er tatsächlich für die geplante Mahlzeit verwendet wird;
- Neuplanung und Auto-Lock-Rebuild dürfen keine Doppelreservierung erzeugen.

Die konkrete Gewichtung von Vorrat gegenüber anderen gleich geeigneten Kandidaten ist Bestandsverhalten und keine implizite neue Fachregel. Eine geeignete neue Nicht-Allergen-Einführung hat in einem freien Hauptmahlzeitenslot fachlich Vorrang vor einer rein bekannten Planung; innerhalb gleichartiger bekannter Alternativen bleibt die bestehende Vorrats-/Rotationsgewichtung bestehen.

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
- Eine echte Ablehnung eines einzelnen FOODs darf als gezielte Wiederholung priorisiert werden; ein lediglich erfolgreich probiertes FOOD erhält diesen Pflichtstatus nicht.
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

Die Handling-/BLW-Schicht ist seit PR #45 auf `main` integriert.

Verbindlicher Vertrag:

**Brei/Löffelkost und geeignetes BLW/Fingerfood sind parallele Darreichungswege ab allgemeiner Beikostreife.**

`feedingApproach = spoon | fingerfood | mixed` ist:

- eine Präferenz;
- keine Entwicklungsstufe;
- kein Safety-Override;
- kein Grund, Fokus, FOOD-Komponenten, Rollen oder Rezeptidentität zu ändern.

Strukturiertes `presentationMode` ist additiv und wird nur dort gesetzt, wo für die konkrete Mahlzeit bereits sichere strukturierte Darreichungswege vorliegen. Die Präferenz darf sichere Alternativen nur gewichten, nicht fachlich verbieten.

Historische Locks/Logs ohne Feld bleiben unverändert und historische `textureStage`-Werte werden nicht umgedeutet. Die Steuerlogik leitet Handling nicht aus `safeForm`-/`note`-Freitexten ab.

FOODs und Rezepte werden nur über explizit geprüfte strukturierte Handling-Contracts migriert. SAFETY-REVIEW- und LATER-REVIEW-Rezepte werden dadurch **nicht pauschal früher freigegeben** und bleiben bis zur jeweiligen Einzelprüfung im bisherigen Verhalten.

### 16.1 Orale Verarbeitungsdimension 🟡 fachlich freigegeben, noch nicht Runtime

Für zusammenhängende Fingerfoods ist der Handlingmodus allein nicht ausreichend. Die fachlich freigegebene additive Detailreferenz ist:

`docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md`

Sie unterscheidet orthogonal zum Handlingmodus:

- `soft-breakdown`;
- `easy-bite-separate`;
- `structured-chew-required`.

Diese Profile sind **keine lineare Entwicklungs- oder Altersleiter**. Insbesondere gilt:

- `finger-graspable` bedeutet nicht automatisch eine bestimmte orale Anforderung;
- bloßes Abbeißen ist kein Grund für eine spätere Freigabe;
- entscheidend für die Abgrenzung zu `structured-chew-required` ist das Verhalten des tatsächlich abgetrennten Bissens;
- Zwei-Finger-Zerdrückbarkeit, Rezeptkategorie, `stage` oder `minMonths` reichen allein nicht zur Einstufung;
- eine zusätzliche orale Capability darf nur nach konkreter Einzelprüfung eines Rezeptes beziehungsweise einer Servierform eingeführt werden;
- resistive Übungsformen werden durch diesen Contract nicht pauschal freigegeben.

Die fachliche Erweiterung ändert noch keine Produktlogik, Rezeptdaten oder Planner-Auswahl. Eine spätere technische Abbildung muss die orale Dimension getrennt von `presentationMode`, `feedingApproach`, Texturstage und unabhängigen Safety-/Alters-/Zutatengates behandeln.

Die dynamisch geladene Handling-Contract-/Runtime-Schicht wird zusammen mit der Planner-Policy-Kette vor dem finalen sichtbaren Render installiert und für den ersten Offline-Start vorgecached.

---

# 17. Bewusst offene Planner-Punkte

## 17.1 Fachlich noch offen

Aktuell nicht als erledigt behandeln:

1. 🔴 Einzelprüfung der noch bewusst zurückgestellten SAFETY-REVIEW-/LATER-REVIEW-Rezepte vor Aufnahme in den strukturierten Handling-Contract. Diese Prüfung läuft ausschließlich im separaten Handling-/Oral-Arbeitsstrang und wird in diesem Planner-Track nicht parallel neu bewertet.

Die vollständige österreichische `seasonMonths`-Matrix und die Nuss-/Samen-Rollen- und Toppingregel sind auf `main` integriert und nicht mehr als offene Planner-Blöcke zu behandeln. Die allgemeine Handling-/BLW-Schicht ist **keine offene Fachfrage mehr**. Der Oral-Processing-Contract ist fachlich auf `main` dokumentiert; Review, Einzelmigrationen und eine spätere technische Runtime-Abbildung bleiben ein separater Handling-/Oral-Arbeitsstrang und sind nicht Teil dieses Planner-Statusabgleichs.

## 17.2 PHASE-TRANSITION ✅ main

Für PHASE-TRANSITION besteht kein offener Soll/Ist-Gap mehr. Der read-only Readiness-Core, seine strukturierte Planner-Einbindung und die sichtbare Phase-Readiness-UX sind auf `main` integriert. Die bestehende bewusste Nutzerbestätigung bleibt der einzige Weg zum tatsächlichen Phasenwechsel; Alter, Grammwerte, Loganzahl, Phasendauer und Textur sind weiterhin keine Readiness-Schwellen.

Weitere offene FOOD-Datenfragen werden separat im FOOD-Fachregel-Track geklärt und dürfen nicht als implizite Planner-Regel erfunden werden.

---

# 18. Verbindliche Regressionen

Änderungen am Planner müssen mindestens folgende Verträge regressiv erhalten:

- Phasenmodell und Mahlzeitenslots;
- PHASE-TRANSITION: Readiness ist read-only; `recommended` setzt `currentPatternAccepted`, `additionalMealCue` und `routineCompatible` gemeinsam voraus; Alter, Grammwerte, Loganzahl, Phasendauer und Textur verändern die Empfehlung nicht und lösen niemals einen Phasenwechsel aus; fehlende qualitative Signale bleiben explizit `unknown`;
- tägliche Nicht-Allergen-Einführung mit höchstens einem unbekannten FOOD je Frühstück/Mittag/Abend;
- ein erfolgreich `Probiert`-FOOD blockiert keine geeignete offene Neueinführung; echte Ablehnung bleibt gezielter Wiederholungspfad;
- Allergen-Einführung oder gezielte Allergen-Wiederholung bleibt die einzige automatische Lernaufgabe des Tages;
- langfristige Allergenpflege ist keine Lernaufgabe, kein `sample` und verbraucht keinen FOOD-Einführungsslot;
- Maintenance-Fälligkeit wird pro Pflegeziel statt ausschließlich pro FOOD-ID bewertet; nur `eaten` erfüllt die historische Exposition;
- Glutenpflege darf durch eine andere bereits geeignete glutenhaltige Quelle oder ein Rezept mit tatsächlicher kanonischer Gluten-Zutat abgedeckt werden, ohne Hafer/Weizen/Dinkel als Einführungsfamilie gleichzusetzen;
- feinere vorhandene Allergenfamilien – insbesondere einzelne Nussfamilien – bleiben als getrennte Maintenance-Ziele erhalten;
- geplante FOODs/Rezepte zählen nur als voraussichtliche Maintenance-Abdeckung; mehrere bekannte Pflegeziele dürfen durch dieselbe normale Mahlzeit abgedeckt werden;
- Snack führt keine neuen FOODs ein, darf aber ein geeignetes Rezept oder bekanntes Obst sein;
- der Obst-Snackpfad erzeugt kein generisches FOOD-`snack`-Modell für andere Kategorien;
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
- Recipe-first einschließlich maximal einem neuen FOOD **pro Mahlzeit**;
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
- Handling-Contract und -Runtime stehen vor finalem sichtbaren Render sowie beim ersten Offline-Start zur Verfügung;
- bei späterer Umsetzung der oralen Dimension bleiben `soft-breakdown` und `easy-bite-separate` nicht-lineare Profile ohne implizite Altersleiter;
- Omelettstreifen bleiben Referenzfall für `finger-graspable` + `easy-bite-separate` ohne zusätzliche orale Capability;
- `structured-chew-required` darf nur aus konkret freigegebener Struktur abgeleitet werden, nicht aus Rezeptkategorie, `stage`, `minMonths` oder bloßem Zwei-Finger-Test.

---

# 19. Quellen im Repository

Historischer Ursprung:

- Commit `f9f886c82af2ce267c10571e5e89df787037c6b0` – `Import Chesters Beikost App 10.1.24 Phasenmodell-v2`.

Aktuelle Kernquellen:

- `js/state.js`
- `js/model.js`
- `js/phase-readiness.js`
- `js/planning.js`
- `js/planner-meal-eligibility.js`
- `js/planner-milk-policy.js`
- `js/planner-iron-preference.js`
- `js/planner-recipe-first.js`
- `js/planner-proactive-recipe.js`
- `js/planner-food-role-stability.js`
- `js/planner-quality-rotation.js`
- `js/planner-introduction-policy.js`
- `js/planner-allergen-maintenance.js`
- `docs/PLAN-08_COMBINATION_AUDIT.md`
- `docs/PLAN-08_RECIPE_FIRST.md`
- `docs/FOOD_SEASONMONTHS_AT_AUDIT.md`

Zentrale Regressionen:

- `tests/todo3-phase-model.test.cjs`
- `tests/phase-readiness.test.cjs`
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
- `tests/planner-quality-rotation.test.cjs`
- `tests/planner-introduction-frequency.test.cjs`
- `tests/planner-allergen-maintenance.test.cjs`
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