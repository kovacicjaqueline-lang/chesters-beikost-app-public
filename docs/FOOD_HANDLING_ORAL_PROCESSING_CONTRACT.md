# FOOD Handling – Orale Verarbeitungsdimension

Stand: 2026-08-20  
Status: fachlich freigegebene additive Contract-Erweiterung  
Bezug: `docs/FOOD_HANDLING_READINESS_TECHNICAL_DESIGN.md` und `docs/PLANNER_FACHKONZEPT.md`

## Zweck

Der bestehende Handling-Contract trennt Darreichungsformen wie Löffelkonsistenzen, `finger-graspable` und `finger-small-soft` von der historischen linearen `textureStage`-Logik.

Diese Erweiterung ergänzt eine davon unabhängige **orale Verarbeitungsdimension** für zusammenhängende Fingerfoods.

Der zentrale Befund lautet:

> `finger-graspable` darf nicht lediglich bedeuten „mit der Hand greifbar + weich“.

Sehr weiches Gemüse, Omelettstreifen, Pancakes, Bällchen, Muffins, Waffeln oder andere zusammenhängende Fingerfoods können trotz ähnlicher äußerer Weichheit unterschiedliche Anforderungen an Abbeißen, Abtrennen und die weitere Verarbeitung eines abgetrennten Bissens stellen.

Gleichzeitig darf daraus **keine neue lineare Entwicklungsstufe** entstehen, nach der alles Gebackene, Zusammenhängende oder Abbeißbare automatisch erst später möglich wäre.

## 1. Orthogonale Dimensionen

Für ein Rezept beziehungsweise eine konkrete Servierform sind mindestens drei Fragen getrennt zu beantworten:

1. **Darreichungs-/Handlingmodus**  
   z. B. `finger-graspable`, `finger-small-soft`, `spoon-mashed`.
2. **Orales Verarbeitungsprofil**  
   `soft-breakdown`, `easy-bite-separate` oder `structured-chew-required`.
3. **Zusätzliche Fähigkeit/Capability**, falls ein konkreter Fall sie tatsächlich benötigt.

Diese Dimensionen dürfen nicht ineinander umgedeutet werden.

Beispiele:

- Ein kleines weiches Stück kann oral `soft-breakdown` sein, aber wegen seiner Größe weiterhin eine feinmotorische Voraussetzung im Handling benötigen.
- Ein großes gut greifbares Stück kann `finger-graspable` sein und trotzdem oral `structured-chew-required` sein.
- Ein zusammenhängendes Fingerfood kann Abbeißen erfordern und trotzdem bereits bei allgemeiner Beikostreife geeignet sein.

## 2. Orale Profile

### 2.1 `soft-breakdown`

Bedeutung:

- sehr weiche beziehungsweise feuchte Struktur;
- ein abgetrennter Bissen lässt sich unter leichtem Druck von Zunge, Gaumen, Zahnleisten beziehungsweise Kiefer weiter zerdrücken oder zerfällt sehr leicht;
- keine relevante zähe, elastische, faserige, trockene oder kompakte Struktur bleibt bestehen.

Semantik:

- keine zusätzliche orale Capability allein aufgrund dieses Profils;
- nicht automatisch „früher“ als `easy-bite-separate`, sondern eine andere Material-/Struktureigenschaft.

### 2.2 `easy-bite-separate`

Bedeutung:

- zusammenhängendes Fingerfood;
- ein Stück kann aktiv mit Mund/Kiefer abgebissen, abgequetscht oder anderweitig abgetrennt werden;
- die Abtrennung gelingt bei der konkret freigegebenen Zubereitung leicht;
- der abgetrennte Bissen bleibt weich, gut beherrschbar, nicht zäh, nicht elastisch und nicht faserig;
- nach der Abtrennung ist keine ausgeprägte wiederholte Kau-/Zerreibarbeit nötig, um den Bissen schluckfähig zu machen.

Semantik:

- **keine zusätzliche orale Capability** bei allgemeiner Beikostreife;
- das bloße Erfordernis des Abbeißens ist ausdrücklich **kein** Grund für eine spätere Freigabe.

### 2.3 `structured-chew-required`

Verbindliche Definition:

> Nach dem Abtrennen bleibt ein essbarer Bissen mit zusammenhängender, dichter, elastischer oder faseriger Struktur bestehen. Er muss aktiv im Mund positioniert und durch wiederholte Kiefer- und Zungenbewegungen zerkleinert werden, bevor er schluckfähig wird.

Typische strukturelle Merkmale können sein:

- elastisch oder gummiartig;
- dicht und kompakt;
- deutlich faserig;
- zusammenhängend und nur durch wiederholtes Zerreiben ausreichend zerkleinerbar.

Semantik:

- `structured-chew-required` ist **keine Altersstufe**;
- insbesondere ist es kein verstecktes „ab 10 Monaten“;
- eine zusätzliche Capability darf nur dann vorgesehen werden, wenn ein konkret geprüftes Rezept beziehungsweise eine konkrete Servierform diese höhere orale Anforderung tatsächlich aufweist;
- keine Capability darf allein aus Rezeptkategorie, Altersempfehlung, `stage`, Backmethode oder Lebensmittelgruppe abgeleitet werden.

## 3. Entscheidend ist der abgetrennte Bissen

Für die Abgrenzung zwischen `easy-bite-separate` und `structured-chew-required` ist nicht primär entscheidend, wie viel Widerstand ein größeres Stück beim ersten Abbeißen bietet.

Entscheidend ist:

> **Was passiert mit dem tatsächlich abgetrennten Bissen im Mund?**

Daraus folgen zwei wichtige Regeln:

1. Ein Lebensmittel kann etwas Widerstand beim Nagen beziehungsweise Abbeißen bieten und trotzdem nach der Abtrennung leicht verarbeitbar sein.
2. Ein äußerlich weiches Lebensmittel kann nach der Abtrennung als kompakter, elastischer oder faseriger Bissen bestehen bleiben und dadurch oral anspruchsvoller sein.

## 4. Resistive Übungsformen sind nicht Gegenstand dieses Contracts

Widerstand beim Nagen ist nicht automatisch `structured-chew-required`.

Die Eignung, Sicherheit oder Verwendung resistiver Übungslebensmittel beziehungsweise resistiver Übungsformen wird durch diesen Contract **nicht fachlich freigegeben und nicht bewertet**. Solche Formen benötigen, falls sie im Projekt relevant werden, eine eigene konkrete fachliche Prüfung.

Falls eine resistive Übungsform separat geprüft wird, gilt für die Abgrenzung der oralen Dimension:

- „braucht Kraft zum Abbeißen“ != automatisch `structured-chew-required`;
- die Klassifikation richtet sich nach dem Verhalten des **essbaren abgetrennten Bissens**;
- Widerstand beim Nagen darf nicht als Beleg dafür interpretiert werden, dass ein Kind einen schwierigen abgetrennten Bissen bereits sicher oral verarbeiten kann;
- die bloße Nennung resistiver Übungsformen in externen Quellen erzeugt keine Rezept- oder FOOD-Freigabe in diesem Projekt.

## 5. Keine Kategorienlogik

Folgende Merkmale reichen **jeweils allein nicht** für eine orale Einstufung:

- „weich“;
- „zwischen zwei Fingern zerdrückbar“;
- „gebacken“;
- „Fingerfood“;
- „muss abgebissen werden“;
- „Muffin“;
- „Pancake“;
- „Waffel“;
- „Bällchen“;
- „Brot“;
- „Fleisch“;
- `stage: 3` oder `stage: 4`;
- `minMonths: 10` oder `minMonths: 11`.

Insbesondere darf aus einer Einzelentscheidung keine Gruppenfreigabe abgeleitet werden.

## 6. Zwei-Finger-Test

Die leichte Zerdrückbarkeit zwischen zwei Fingern bleibt ein nützlicher Sicherheits-/Konsistenzhinweis.

Sie ist aber **nicht ausreichend**, um das orale Verarbeitungsprofil festzulegen.

Ein Lebensmittel kann den Zwei-Finger-Test bestehen und trotzdem:

- elastisch zurückfedern;
- im Mund kompakt bleiben;
- faserig sein;
- als abgetrennter Bissen wiederholte aktive Kauarbeit verlangen.

Die orale Dimension muss deshalb separat beurteilt werden.

## 7. Verbindliche Prüfkriterien je Rezept/Servierform

Bei der Einzelprüfung sind mindestens folgende Punkte zu betrachten:

1. **konkrete Servierform und Geometrie**;
2. **Kompressibilität**;
3. **Abtrennverhalten** – muss gebissen/gequetscht/abgerissen werden und wie leicht gelingt das?;
4. **Verhalten des abgetrennten Bissens** – weich/zerfallend oder dicht/elastisch/zäh/faserig?;
5. **Feuchtigkeit, Kruste, Haut und harte Kanten**;
6. **Geometrie des entstehenden Bissens** – entstehen große, kompakte oder runde Stücke?;
7. **Reproduzierbarkeit** aus der konkreten Rezeptur und Servieranweisung;
8. bestehende unabhängige Safety-, Zutaten-, Allergen-, Alters- und Mahlzeitengates.

Wenn das Ergebnis aus Rezeptur und Servieranweisung nicht reproduzierbar ableitbar ist, bleibt das orale Profil **offen**.

Es wird weder vorsorglich `structured-chew-required` vergeben noch vorsorglich eine frühe Freigabe unterstellt.

## 8. Referenzfall Omelettstreifen

`Omelettstreifen` ist der verbindliche Regression-/Referenzfall für die neue Dimension.

Fachlich freigegeben:

- Handling: `finger-graspable`;
- orale Dimension: `easy-bite-separate`;
- zusätzliche orale Capability: **keine**;
- bei allgemeiner Beikostreife möglich, sofern die übrigen unabhängigen Gates erfüllt sind;
- weich halten und in breite, gut greifbare Streifen schneiden.

Dieser Referenzfall stellt sicher, dass die neue orale Dimension **nicht** zu einer versteckten Regel „zusammenhängend/abbeißbar = später“ wird.

## 9. Weitere ausdrücklich einzeln freigegebene Referenzentscheidungen

Die folgenden Entscheidungen wurden einzeln getroffen und dürfen nicht auf Kategorien oder ähnliche Rezepte übertragen werden:

| Rezept | Handling | Orales Profil | Zusätzliche orale Capability |
|---|---|---|---|
| Obst-Hafer-Pancakes | `finger-graspable` | `easy-bite-separate` | nein |
| Birne-Hirse-Pancakes | `finger-graspable` | `easy-bite-separate` | nein |
| Gemüse-Hafer-Pancakes | `finger-graspable` | `easy-bite-separate` | nein |
| Omelettstreifen | `finger-graspable` | `easy-bite-separate` | nein |
| Zucchini-Omelett, breite weiche Streifen | `finger-graspable` | `easy-bite-separate` | nein |
| Rind-Hafer-Bällchen in der bereits freigegebenen sehr weichen, flachen/länglichen Form | `finger-graspable` | `easy-bite-separate` | nein |

Zusatzhinweise:

- Bei `Birne-Hirse-Pancakes` soll die spätere Rezeptanweisung ausdrücklich „weich durchgaren, keine harte Kruste“ festschreiben.
- Beim `Zucchini-Omelett` gilt diese Entscheidung nur für die breite, weich gehaltene Streifenform. Kleine Stücke bleiben eine separate Handlingfrage.
- Beim `Rind-Hafer-Bällchen` bleiben alle bereits separat festgelegten Fleisch-/Safety-Gates unverändert.

## 10. Gute Prüffälle für `structured-chew-required`, aber keine Vorabfreigabe

Folgende Formen sind geeignete **Prüffälle**, weil ihre tatsächliche Struktur je nach Rezeptur zwischen leicht verarbeitbar und deutlich kaupflichtig liegen kann:

- Gemüse-Fleisch-Nockerl beziehungsweise kompakte weiche Nockerl/Gnocchi-artige Teigstücke;
- Baby-Bananenbrot, wenn die Krume dicht, elastisch oder klebrig bleibt;
- Fleisch-/Geflügelbällchen, wenn Bindung und Garung zu einer kompakten oder elastischen Struktur führen;
- zukünftige Brot-/Pitta-/Tortilla-/Roti-Formen mit zusammenhängender, im Mund weiter zu zerkleinernder Teigstruktur.

Diese Nennung ist **keine Einstufung und keine Freigabe**. Jeder konkrete Fall bleibt einzeln zu prüfen.

## 11. Alterssemantik

Die orale Dimension darf keine neue Altersleiter erzeugen.

Insbesondere gilt:

- `soft-breakdown` und `easy-bite-separate` sind keine aufeinanderfolgenden Altersstufen;
- beide können bei allgemeiner Beikostreife geeignet sein;
- `structured-chew-required` darf nicht pauschal mit 8, 9, 10, 11 oder 12 Monaten gleichgesetzt werden;
- vorhandene `minMonths`-/`hardMinMonths`-Werte bleiben eine **separate** Dimension und müssen bei späterer Überarbeitung jeweils eigenständig begründet werden;
- ein historisches `minMonths: 10` oder `stage: 4` ist kein Beweis für eine höhere orale Verarbeitungsanforderung.

## 12. Technische Zielrichtung

Die spätere technische Umsetzung soll die orale Dimension **orthogonal** zum bestehenden Handlingmodus modellieren.

Beispielhafte Zielstruktur, noch keine Produktivimplementierung:

```js
{
  modes: [HANDLING_MODES.FINGER_GRASPABLE],
  oralProcessing: "easy-bite-separate",
}
```

Nur falls ein konkret freigegebener Fall eine zusätzliche Capability benötigt:

```js
{
  modes: [HANDLING_MODES.FINGER_GRASPABLE],
  oralProcessing: "structured-chew-required",
  requiredCapabilities: {
    "finger-graspable": "structured-chew",
  },
}
```

Die konkrete technische Feldform und Benennung ist vor Implementierung gegen den bestehenden Runtime-Contract zu prüfen. Die **fachliche Semantik dieses Dokuments ist verbindlich**, die gezeigte Objektform nur eine mögliche technische Abbildung.

## 13. Verhältnis zu bestehenden Regeln

Diese Erweiterung verändert nicht automatisch:

- `hardMinMonths`;
- Zutatenstatus;
- Allergeneinführung/-wiederholung;
- Milchregeln;
- Mahlzeiteneignung;
- FOOD-spezifische Safety-Regeln;
- Planner-Locks;
- bestehende manuelle Mahlzeiten;
- `feedingApproach` als reine Präferenz;
- `finger-small-soft` beziehungsweise feinmotorische Voraussetzungen.

Ein Rezept wird nur dann früher verfügbar, wenn **alle** unabhängigen Gates erfüllt sind und seine konkrete Handling-/orale Form fachlich entsprechend freigegeben wurde.

## 14. Externe fachliche Plausibilisierung

Abrufstand der folgenden öffentlichen Quellen: **20.08.2026**.

Die Quellen stützen die Struktur des Contract-Modells; sie erzeugen **keine pauschalen Rezept-, FOOD- oder Altersfreigaben** im Projekt.

- **NHS – Your baby's first solid foods**  
  https://www.nhs.uk/baby/weaning-and-feeding/babys-first-solid-foods/  
  Relevanz: geeignete weiche Fingerfoods ab Beikostbeginn; Lernen von Abbeißen, Kauen und Schlucken.
- **NHS – Omelette fingers**  
  https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/omelette-fingers/  
  Relevanz: konkrete weiche Omelett-Finger ab etwa 6 Monaten als Plausibilisierung des Referenzfalls.
- **Cambridge University Hospitals – Food textures: bite and dissolve/bite and melt**  
  https://www.cuh.nhs.uk/patient-information/food-textures-bite-and-dissolvebite-and-melt/  
  Relevanz: klinische Beschreibung von Texturen, die nach dem Abbeißen sehr leicht zerfallen beziehungsweise schmelzen.
- **Cambridge University Hospitals – Easy to chew foods**  
  https://www.cuh.nhs.uk/patient-information/easy-to-chew-foods/  
  Relevanz: klinische Gegenperspektive auf weiche Lebensmittel, die dennoch tatsächliche orale Bearbeitung verlangen.
- **UK Department for Education – Food safety (Help for early years providers)**  
  https://help-for-early-years-providers.education.gov.uk/get-help-to-improve-your-practice/food-safety  
  Relevanz: Hinweis, dass weiches Brot im Mund teigig beziehungsweise kompakt werden kann; „weich“ ist daher allein kein ausreichendes orales Kriterium.
- **CDC – Choking Hazards**  
  https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/choking-hazards.html  
  Relevanz: Form, Größe und Textur müssen entwicklungsangemessen sein; schwer zu kauende beziehungsweise problematische Strukturen bleiben eine getrennte Safety-Frage.

## 15. Kanonische Einbindung

Diese Datei ist die fachlich verbindliche Detailreferenz für die orale Verarbeitungsdimension und wird additiv aus folgenden bestehenden Referenzdokumenten eingebunden:

- `docs/FOOD_HANDLING_READINESS_TECHNICAL_DESIGN.md` – technisches Handling-Sollmodell;
- `docs/PLANNER_FACHKONZEPT.md` – kanonische Planner-Semantik.

Die orale Dimension ersetzt keine Regel in diesen Dokumenten, sondern präzisiert den Handling-Vertrag dort, wo zusammenhängende Fingerfoods oral unterschiedlich anspruchsvoll sein können.

## Status

Fachliche Contract-Erweiterung dokumentiert.

Noch **nicht** umgesetzt sind:

- neue Runtime-Felder für `oralProcessing`;
- eine neue Capability wie `structured-chew`;
- Änderungen an `data/food-handling.js`;
- Änderungen an Rezeptdaten;
- Änderungen an Planner-/UI-Logik;
- Migration weiterer SAFETY-/LATER-/Handling-Fälle.

Diese technischen Schritte erfolgen erst separat auf Basis des dann aktuellen `main` und nach den jeweiligen fachlichen Einzelentscheidungen.