# PHASE-TRANSITION – Fachaudit und Vorschlag

Stand: 20.08.2026  
Ausgangs-main: `a26d3159bdb2ecc7713341270400fcc0f599549d`

> Status: **Fachvorschlag – noch nicht freigegeben.**
>
> Dieses Dokument verändert keine Runtime-Regel. Es dient ausschließlich zur fachlichen Prüfung der noch offenen PHASE-TRANSITION-Soll/Ist-Lücke aus `docs/PLANNER_FACHKONZEPT.md`.

## 1. Bestehender verbindlicher Vertrag

Das freigegebene Phasenmodell bleibt unverändert:

1. **Kennenlernen** – automatisch: Mittagessen
2. **Mahlzeitenaufbau** – automatisch: Frühstück + Mittagessen
3. **Drei Hauptmahlzeiten** – automatisch: Frühstück + Mittagessen + Abendessen; Snack manuell möglich
4. **Familienkost** – automatisch: Frühstück + Mittagessen + Snack + Abendessen

Die Phase steuert ausschließlich die automatisch vorgesehenen Mahlzeitenslots. Sie ist weder Gramm- noch Textur- noch Handlingstufe.

Für PHASE-TRANSITION ist bereits verbindlich:

- die App empfiehlt den nächsten Phasenwechsel;
- Alter und gegessene Grammwerte lösen ihn nicht automatisch aus;
- die Empfehlung ist kein automatischer Wechsel;
- die Nutzerin bestätigt den Wechsel bewusst/einmalig;
- Logs, Vorräte, manuelle Mahlzeiten und Locks behalten ihre bisherige Semantik.

## 2. Ist-Stand auf main

`js/model.js` enthält nur den manuellen Phasenwechsel (`setPhase`) und die Slot-Zuordnung. `phaseSourceText()` stellt ausdrücklich klar, dass Alter und Grammwerte die Phase nicht automatisch wechseln.

Die Home-UI zeigt die aktuelle Phase, `Zurück`/`Weiter` und vor dem Wechsel eine Bestätigung. Sie sagt bereits: Die Phase richtet sich nach Entwicklung und Tagesablauf; Alter oder Grammwerte wechseln sie nicht automatisch.

Eine eigenständige Empfehlungslogik für den nächsten Phasenwechsel existiert nicht.

Wichtig: `mealProgressRank()` enthält historische Gramm-Schwellen. Diese Funktion darf für PHASE-TRANSITION nicht als fachliche Grundlage herangezogen werden, weil der kanonische Vertrag einen grammgetriebenen Phasenwechsel ausdrücklich ausschließt.

## 3. Externe Fachgrundlage

### 3.1 Österreichische Beikostempfehlungen

Die Österreichischen Beikostempfehlungen von „Richtig essen von Anfang an!“ geben für die Mahlzeitenfrequenz folgende Richtung vor:

- die Tageszeit der ersten Beikostmahlzeit kann unter Berücksichtigung der Bedürfnisse des Säuglings und des Familienlebens gewählt werden;
- gemeinsame Mahlzeiten fördern das Essenlernen;
- Hunger- und Sättigungssignale sollen wahrgenommen und beachtet werden;
- die Mahlzeitenfrequenz soll **Schritt für Schritt** an den Familienrhythmus mit Frühstück, Mittag- und Abendessen angepasst werden;
- akzeptiert der Säugling die erste Kost, soll der Mahlzeitenrhythmus langsam, ohne Zwang und unter Berücksichtigung seiner individuellen Bedürfnisse an den Familienrhythmus angepasst werden;
- Zwischenmahlzeiten werden abhängig vom Hunger des Kindes angeboten.

Die Leitlinie nennt ausdrücklich keine evidenzbasierte optimale Tageszeit für die erste Beikostgabe. Daraus folgt: Frühstück, Mittag und Abend dürfen nicht als medizinisch validierte Entwicklungsstufen behandelt werden.

Quelle: Österreichische Beikostempfehlungen, Kapitel 3.4 „Optimale Tageszeit der ersten Beikostgabe“ und Abschnitt „Mahlzeitenfrequenz“.

### 3.2 Responsive Feeding / WHO

WHO beschreibt responsive feeding als Füttern in Reaktion auf Hunger- und Sättigungssignale und empfiehlt eine mit zunehmender Entwicklung steigende Mahlzeitenfrequenz. Die WHO-Altersbereiche beschreiben populationsbezogene Ernährungsfrequenz, liefern aber keine validierten motorischen Meilensteine für den Wechsel eines konkreten App-Slots.

Für dieses App-Modell dürfen diese Altersbereiche deshalb nicht als automatische PHASE-TRANSITION-Schwellen verwendet werden.

### 3.3 Entwicklungssignale

REVAN beschreibt verschiedene mögliche Hunger- und Sättigungssignale – z. B. nach Essen oder Löffel greifen, Interesse am Essen, Mund öffnen, Esstempo verlangsamen, Essen wegschieben oder den Kopf wegdrehen.

Diese Einzelgesten sind **Beispiele**, keine Pflicht-Checkliste für einen Phasenwechsel. Die App sollte nicht versuchen, aus einem bestimmten motorischen Meilenstein wie Sitzen, Krabbeln, Pinzettengriff, Zähnen oder einer bestimmten Texturfähigkeit abzuleiten, dass nun Frühstück, Abendessen oder ein Snack automatisch geplant werden muss.

## 4. Zentraler Auditbefund

Für die drei Übergänge zwischen den vier App-Phasen gibt es **keine belastbare fachliche Grundlage für jeweils einen eigenen motorischen Entwicklungsmeilenstein**.

Die fachlich tragfähige Interpretation von „entwicklungsorientierte Empfehlung“ ist deshalb:

> **kindresponsiv und alltagsorientiert:** Akzeptanz von Beikost, erkennbare Hunger-/Interessesignale für eine zusätzliche Essgelegenheit und die schrittweise Einbindung in den tatsächlichen Familienrhythmus.

Nicht tragfähig wären:

- Alter als Trigger;
- Grammwerte oder Portionsgröße als Trigger;
- Anzahl protokollierter Tage/Gaben als versteckte Ersatzschwelle;
- Texturstufe;
- Brei vs. Fingerfood;
- orale Processing-Capabilities;
- Sitzen, Krabbeln, Pinzettengriff, Zahndurchbruch oder andere einzelne Motorikmeilensteine als Bedingung für einen zusätzlichen Mahlzeitenslot;
- Anzahl gelernter FOODs;
- Anzahl eingeführter Allergene.

## 5. Vorgeschlagener fachlicher Empfehlungsvertrag

### 5.1 Grundprinzip

Die App soll den nächsten Phasenwechsel **nicht passiv aus Logdaten errechnen**, sondern über einen kurzen expliziten Entwicklungs-/Tagesrhythmus-Check-in beurteilen.

Der Check-in fragt beobachtbare, alltagsnahe Signale ab. Die Empfehlung entsteht aus den Antworten der Nutzerin, nicht aus Alters-, Gramm- oder Tageszählung.

Ein positives Ergebnis erzeugt nur:

> „Die nächste Phase könnte jetzt zu eurem Tagesrhythmus passen.“

Der Phasenwechsel erfolgt weiterhin erst nach gesonderter Bestätigung.

„Noch nicht“ bleibt ohne Nachteil möglich. Es gibt keine automatische Rückstufung.

### 5.2 Phase 1 → Phase 2

**Ziel:** von einer geplanten Hauptmahlzeit auf zwei Hauptmahlzeiten erweitern.

Vorgeschlagene positive Indikatoren:

1. **Grundsätzliche Akzeptanz:** Das Kind nimmt Beikost grundsätzlich an. Gemeint ist Bereitschaft zur Esssituation, nicht eine bestimmte Menge.
2. **Zweite Essgelegenheit passt zum Kind:** Bei einer weiteren Familienmahlzeit zeigt das Kind wiederholt Hunger, Interesse oder Bereitschaft zum Mitessen.
3. **Zweite Essgelegenheit passt in den Alltag:** Eine zweite ruhige Essgelegenheit lässt sich sinnvoll in den Tages-/Familienrhythmus integrieren.

Sind diese Punkte aus Sicht der Nutzerin erfüllt, empfiehlt die App Phase 2.

Nicht erforderlich: eine bestimmte Zahl erfolgreicher Mittagessen, eine bestimmte Grammmenge oder eine bestimmte Konsistenz.

### 5.3 Phase 2 → Phase 3

**Ziel:** drei Hauptmahlzeiten in den Tagesrhythmus aufnehmen.

Vorgeschlagene positive Indikatoren:

1. **Die bisherigen zwei Essgelegenheiten passen grundsätzlich:** Frühstück und Mittag lassen sich als Beikostgelegenheiten in den Alltag integrieren; einzelne schlechte Tage sind kein Ausschluss.
2. **Dritte Hauptmahlzeit passt zum Kind:** Rund um die zusätzliche Hauptmahlzeit zeigt das Kind wiederholt Hunger, Interesse oder Bereitschaft zum Mitessen.
3. **Dritte Hauptmahlzeit passt in den Familienrhythmus:** Das gemeinsame Abendessen ist eine realistische zusätzliche Essgelegenheit.

Sind diese Punkte erfüllt, empfiehlt die App Phase 3.

Nicht erforderlich: eine bestimmte Portionsgröße, dass Milchmahlzeiten ersetzt wurden oder dass das Kind bereits „Familienkost“ im Textursinn isst.

### 5.4 Phase 3 → Phase 4

**Ziel:** zusätzlich zu drei Hauptmahlzeiten einen regulären automatischen Snackslot aktivieren.

Die Bezeichnung „Familienkost“ darf hier **nicht** als Textur- oder Handlinggate interpretiert werden; nach dem kanonischen Modell steuert die Phase nur Mahlzeitenslots.

Vorgeschlagene positive Indikatoren:

1. **Drei Hauptmahlzeiten passen in den Tagesrhythmus:** Frühstück, Mittag und Abendessen sind als Essgelegenheiten grundsätzlich in den Familienalltag eingebunden.
2. **Zwischenmahlzeit entspricht einem echten Bedarf:** Zwischen den Hauptmahlzeiten zeigt das Kind wiederholt Hunger/Interesse oder im Tagesablauf besteht eine regelmäßig sinnvolle Zwischenmahlzeit.
3. **Snackslot ist gewollt:** Die Nutzerin möchte, dass die App diese Zwischenmahlzeit nun regulär automatisch mitplant.

Sind diese Punkte erfüllt, empfiehlt die App Phase 4.

Wichtig: Ein gelegentlicher Snack allein ist kein Grund für Phase 4; Phase 3 erlaubt Snacks bereits manuell. Die Empfehlung ist erst sinnvoll, wenn ein **regulärer** Snackslot zum Kind und Tagesrhythmus passt.

## 6. Check-in statt versteckter Schwellen

Fachlich empfohlen wird ein expliziter Check-in mit verständlichen Ja/Noch-nicht-Antworten.

Beispielhafte Struktur:

- „Nimmt dein Kind die bisherigen Beikost-Mahlzeiten grundsätzlich an?“
- „Zeigt es bei der nächsten Familienmahlzeit häufig Hunger, Interesse oder den Wunsch mitzuessen?“
- „Passt diese zusätzliche Essenszeit in euren Tagesablauf?“

Für Phase 4 zusätzlich:

- „Braucht bzw. wünscht dein Kind zwischen den Hauptmahlzeiten regelmäßig eine Zwischenmahlzeit?“
- „Soll die App diesen Snack künftig automatisch einplanen?“

Die konkrete UI-Formulierung ist noch keine fachliche Freigabe dieses Dokuments.

## 7. Was die Runtime später ausdrücklich nicht tun darf

Eine spätere Implementierung darf nicht:

- `monthsOld()` oder Geburtsdatum als Empfehlungsbedingung verwenden;
- `amount`, `amountSelected`, `mealProgressRank()` oder Grammstatistiken als Empfehlungsbedingung verwenden;
- eine Mindestanzahl Logs, Gaben oder erfolgreicher Tage als fachliche Schwelle erfinden;
- `textureStage`, `presentationMode`, `feedingApproach`, `safeForm`, Handling- oder Oral-Processing-Daten auswerten;
- FOOD-COUNT, Allergene oder FOOD-Status als Ersatz für Phasenreife verwenden;
- die Phase ohne ausdrückliche Bestätigung ändern;
- bei „Noch nicht“ automatisch zurückstufen oder Plan-/Logdaten umdeuten.

## 8. Technischer Folgeschritt nach fachlicher Freigabe

Erst nach Freigabe dieses Fachvertrags sollte ein technisches Design erstellt werden. Zu entscheiden wären dann insbesondere:

- wo der Check-in aufgerufen wird;
- wie Antworten gespeichert werden;
- wie eine Empfehlung als Zustand von der tatsächlichen Phase getrennt wird;
- wie „Noch nicht“ und erneutes Prüfen funktionieren, ohne willkürliche Zeitintervalle einzuführen;
- wie die bestehende Bestätigung wiederverwendet wird;
- welche Regressionen die Trennung Empfehlung → Bestätigung → Phasenwechsel absichern.

## 9. Noch zur Freigabe offen

Vor einer technischen Umsetzung müssen fachlich ausdrücklich bestätigt oder geändert werden:

1. PHASE-TRANSITION wird als **kindresponsiver Tagesrhythmus-Check-in** und nicht als motorische Meilensteinlogik verstanden.
2. Phase 1 → 2 verwendet Akzeptanz + passende zweite Essgelegenheit + Familienrhythmus.
3. Phase 2 → 3 verwendet passende bestehende Hauptmahlzeiten + erkennbare Bereitschaft für die dritte Hauptmahlzeit + Familienrhythmus.
4. Phase 3 → 4 verwendet drei passende Hauptmahlzeiten + regulären Bedarf/Wunsch nach Zwischenmahlzeit + ausdrücklichen Wunsch nach automatischem Snackslot.
5. Es gibt keine Alters-, Gramm-, Loganzahl-, Textur-, Handling- oder Motorikschwelle für diese Empfehlungen.
6. Der Name „Familienkost“ in Phase 4 bleibt eine Phasenbezeichnung; er erzeugt keinen Textur-/Handlinggate.

## 10. Quellen

- Richtig essen von Anfang an! / Österreichische Beikostempfehlungen, aktuelle Langfassung: https://www.richtigessenvonanfangan.at/de/oesterreichische-beikostempfehlungen/
- Richtig essen von Anfang an! / Entwicklung von Kindern: https://www.richtigessenvonanfangan.at/de/die-entwicklung-von-kindern/
- Richtig essen von Anfang an! / FAQ „Wie oft sollte Beikost gegeben werden?“: https://www.richtigessenvonanfangan.at/de/eltern/faqs/
- WHO / Complementary feeding: https://www.who.int/health-topics/complementary-feeding
- WHO / Guideline for complementary feeding of infants and young children 6–23 months of age (2023): https://www.who.int/publications/i/item/9789240081864
- WHO/UNICEF / Nurturing young children through responsive feeding (2023): https://www.who.int/publications/i/item/9789240070301
