# FOOD seasonMonths – Österreich-Audit

Stand: 19.08.2026  
Arbeitsbranch: `audit/food-seasonmonths-at`  
Prüfbasis: `main` bei `c3de54da3f56567641cc47b534c5daa6cead4895`, App-Version 10.1.25  
Status: vollständiger Fachaudit; **noch keine Produktdaten geändert**  
Fachfreigabe: **`regional aus Lagerung` zählt bei `seasonMonths` mit** (19.08.2026)

## 1. Zweck und bestehender Vertrag

Dieser Audit klärt ausschließlich die noch offene österreichische `seasonMonths`-Datenmatrix. Er erfindet keine Planner-Sonderlogik.

Verbindlich aus `docs/PLANNER_FACHKONZEPT.md`:

- `seasonMonths` ist die einzige datengetriebene Saisoninformation des FOODs.
- Ist der aktuelle Monat enthalten, darf die bestehende Saisonpriorisierung greifen.
- Ist ein explizit saisonal gepflegtes FOOD außerhalb seiner Monate, darf die bestehende Nachreihung greifen.
- `seasonMonths: []` bleibt **bewusst neutral**: weder Saisonbonus noch Outside-Season-Nachreihung.
- Der aktuelle Consumer verletzt den letzten Punkt teilweise: `effectivePriority()` vergibt derzeit über `isSeason()` auch bei `seasonMonths: []` den Saisonbonus. Diese bestehende Abweichung muss vor bzw. zusammen mit der Datenumsetzung korrigiert und regressiv abgesichert werden.
- Dieser Audit verändert weder die Höhe des vorhandenen Scores noch Mahlzeiteneignung, Safety, Allergen-, Phasen-, Rollen- oder Vorratslogik.

## 2. Quellenhierarchie

### Primärquelle

**BMLUK – „Das isst Österreich Saisonkalender“, Wien, April 2025**  
https://www.bmluk.gv.at/dam/jcr:cfe9f490-8be4-405e-afd7-c06a3a2fa1ca/Druck_Saisonkalender_250403_DRUCK.pdf

Der Kalender unterscheidet ausdrücklich zwischen:

- `hat Saison`
- `regional aus Lagerung`

Für `seasonMonths` werden bei einem **eindeutigen FOOD-Match beide Markierungen zusammengeführt**. Diese Modellierungsentscheidung ist fachlich freigegeben. Das bestehende Datenmodell besitzt nur ein Monatsfeld; es wird keine neue zweite Planner-Dimension für Ernte vs. Lagerung eingeführt.

Bei Balken, die nur einen Teil eines Monats berühren, wird der Monat aufgenommen, weil `seasonMonths` nur Monatsauflösung besitzt.

### Ergänzungsquelle

**Öffentliches Gesundheitsportal Österreich – Saisonkalender**  
https://www.gesundheit.gv.at/leben/ernaehrung/saisonkalender.html

Diese Quelle wird **nur** verwendet, wenn das konkrete FOOD im BMLUK-Kalender fehlt oder die dortige Zeile keine Monatsinformation liefert. Bei widersprechenden Monatsangaben für dasselbe eindeutig abgebildete FOOD gilt der neuere BMLUK-Kalender als Primärreferenz; es wird keine frei gemischte Vereinigungsmenge gebildet.

Zusätzlich verwendete eindeutige Namensauflösungen:

- `Kohl` = Wirsing (`Brassica oleracea var. sabauda`) laut Gesundheitsportal.
- `Zwetschke` ist im Projekt ein Alias von `pflaume`.
- `Marille` ist die österreichische Bezeichnung des kanonischen FOODs `aprikose`.
- `Porree` = `lauch`, `Paradeiser` = `tomate`, `Erdäpfel` = `kartoffel`, `Kohlsprossen` = `rosenkohl`.

## 3. Vollständige explizite Österreich-Matrix

Die folgenden kanonischen FOODs sollen eine explizite österreichische Saisoninformation tragen.

| FOOD-ID | Anzeigename / Quellen-Match | seasonMonths | Quelle |
|---|---|---:|---|
| `karotte` | Karotte | `[1,2,3,4,5,6,7,8,9,10,11,12]` | BMLUK |
| `kartoffel` | Erdäpfel | `[1,2,3,4,5,6,7,8,9,10,11,12]` | BMLUK |
| `brokkoli` | Brokkoli | `[6,7,8,9,10]` | BMLUK |
| `zucchini` | Zucchini | `[7,8,9,10]` | BMLUK |
| `gurke` | Gurken | `[5,6,7,8,9,10]` | BMLUK |
| `karfiol` | Karfiol | `[6,7,8,9,10]` | BMLUK |
| `erbsen-tk-moeglich` | Erbsen | `[6,7,8]` | BMLUK |
| `gruene-bohnen` | Bohnen/Fisolen | `[6,7,8,9]` | Gesundheitsportal; BMLUK-Zeile ohne Monatsbalken |
| `fenchel` | Fenchel | `[6,7,8,9,10]` | BMLUK |
| `kohlrabi` | Kohlrabi | `[4,5,6,7,8,9,10,11,12]` | BMLUK |
| `wirsing` | Kohl = Wirsing | `[1,2,3,6,7,8,9,10,11,12]` | BMLUK + eindeutige Namensauflösung Gesundheitsportal |
| `rosenkohl` | Kohlsprossen | `[1,2,3,4,9,10,11,12]` | BMLUK |
| `weisskraut` | Kraut | `[1,2,3,4,5,6,7,8,9,10,11,12]` | BMLUK |
| `rotkraut` | Rotkraut | `[1,2,3,4,5,6,7,8,9,10,11,12]` | BMLUK |
| `kuerbis` | Kürbis | `[1,2,3,4,9,10,11,12]` | BMLUK |
| `paprika` | Paprika | `[6,7,8,9,10]` | BMLUK |
| `tomate` | Paradeiser/Tomate | `[6,7,8,9,10]` | BMLUK |
| `pastinake` | Pastinaken | `[1,2,3,4,9,10,11,12]` | BMLUK |
| `lauch` | Porree/Lauch | `[7,8,9,10,11]` | BMLUK |
| `rettich` | Rettich | `[1,2,3,4,8,9,10,11,12]` | BMLUK |
| `rhabarber` | Rhabarber | `[4,5,6]` | BMLUK |
| `rote-ruebe` | Rote Rüben | `[1,2,3,4,9,10,11,12]` | BMLUK |
| `schwarzwurzel` | Schwarzwurzel | `[1,2,10,11,12]` | BMLUK |
| `sellerie` | Sellerie | `[9,10,11]` | BMLUK |
| `spargel` | Spargel | `[4,5,6]` | BMLUK |
| `spinat` | Spinat | `[3,4,5,9,10]` | BMLUK |
| `zwiebel` | Zwiebel | `[1,2,3,4,5,6,7,8,9,10,11,12]` | BMLUK |
| `aubergine` | Melanzani | `[7,8,9,10]` | Gesundheitsportal |
| `stangensellerie` | Stangensellerie | `[6,7,8,9,10]` | Gesundheitsportal |
| `mangold` | Mangold | `[5,6,7,8,9,10,11]` | Gesundheitsportal |
| `chinakohl` | Chinakohl | `[1,2,8,9,10,11,12]` | Gesundheitsportal |
| `rucola` | Rucola | `[2,3,4,5,6,7,8,9,10,11]` | Gesundheitsportal |
| `radicchio` | Radicchio | `[9,10]` | Gesundheitsportal |
| `endivie` | Endivien | `[7,8,9,10,11,12]` | Gesundheitsportal |
| `petersilienwurzel` | Petersilwurzel | `[9,10]` | Gesundheitsportal |
| `topinambur` | Topinambur | `[1,2,3,10,11,12]` | Gesundheitsportal |
| `knoblauch` | Knoblauch | `[1,2,3,4,5,6,7,8,9,10,11,12]` | Gesundheitsportal |
| `apfel` | Apfel | `[1,2,3,4,5,6,7,8,9,10,11,12]` | BMLUK |
| `birne` | Birnen | `[1,2,8,9,10,11,12]` | BMLUK |
| `brombeere` | Brombeeren | `[6,7]` | BMLUK |
| `erdbeere` | Erdbeeren | `[5,6,7,8]` | BMLUK |
| `haselnuss` | Haselnüsse | `[1,2,3,4,5,6,7,8,9,10,11,12]` | BMLUK inkl. regionaler Lagerung |
| `himbeere` | Himbeeren | `[6,7,8]` | BMLUK |
| `holunder` | Holunderbeeren | `[9,10]` | BMLUK |
| `kirsche` | Kirschen | `[6,7,8]` | BMLUK |
| `heidelbeere` | Heidelbeeren | `[6,7,8,9]` | BMLUK |
| `aprikose` | Marillen | `[7,8]` | BMLUK |
| `pfirsich` | Pfirsiche | `[8,9]` | BMLUK |
| `preiselbeere` | Preiselbeeren | `[8,9,10]` | BMLUK |
| `ribisel` | Ribisel | `[7,8]` | BMLUK |
| `walnuss` | Walnüsse | `[1,2,3,4,5,6,7,8,9,10,11,12]` | BMLUK inkl. regionaler Lagerung |
| `traube` | Weintrauben | `[9,10]` | BMLUK |
| `pflaume` | Zwetschken | `[8,9]` | BMLUK + bestehender Projektalias |
| `quitte` | Quitten | `[10]` | Gesundheitsportal |

## 4. Bewusst neutrale `seasonMonths: []`

Alle übrigen FOODs bleiben im Österreich-Saisonmodell bewusst neutral, **sofern sie nicht in Abschnitt 3 stehen**. Damit ist der gesamte aktuelle FOOD-Stamm abgedeckt und ein leeres Array ist nicht mehr automatisch als „Audit vergessen“ zu interpretieren.

### 4.1 Keine Obst-/Gemüse-Saisonsteuerung für andere Lebensmittelgruppen

Bewusst `[]` bleiben insbesondere:

- Fleisch, Geflügel, Fisch, Meeresfrüchte und Ei;
- Milch und Milchprodukte;
- Öle und Fette;
- Getreide, Pseudogetreide und daraus abgeleitete trockene/verarbeitete Formen;
- getrocknete Hülsenfrüchte;
- Nuss-/Samenmuse, Pasten und andere Verarbeitungsformen;
- verarbeitete Komponenten wie Drinks, Mehle oder Grießformen.

Die Saisonlogik wird damit nicht nebenbei zu einer allgemeinen Herkunfts-, Ernte- oder Produktionslogik für sämtliche Lebensmittel erweitert.

### 4.2 Import-/Tropen-Foods ohne österreichische Saisonpriorisierung

Ohne belastbare österreichische regionale Saisonmatrix bleiben z. B. Banane/Saba-Banane, Mango, Avocado, Papaya, Ananas, Ube und weitere überwiegend importierte/tropische FOODs neutral.

### 4.3 Bewusst neutrale Sonderfälle

| FOOD-ID | Entscheidung | Begründung |
|---|---|---|
| `nektarine` | `[]` | Österreichische Produktion ist belegt, aber die verwendeten offiziellen Monatskalender besitzen keine eigene Nektarinenzeile. Die Pfirsichmonate werden nicht stillschweigend übertragen. |
| `feige` | `[]` | Keine belastbare eigene Monatsmatrix in den beiden kanonischen Österreich-Quellen. |
| `blattsalat` | `[]` | Das FOOD ist bewusst ein Sammelbegriff; Häuptelsalat, Eisberg, Endivie, Lollo, Radicchio usw. haben unterschiedliche Saisonen. Eine künstliche Sammel-Union würde eine neue Regel erfinden. |
| `champignon` | `[]` | Das Gesundheitsportal listet allgemein „Pilze“ ganzjährig, nicht spezifisch Champignon. Keine unscharfe Gattungsübertragung. |
| `kren` | `[]` | Österreichischer Anbau ist klar belegt, aber in den verwendeten Saisonkalendern fehlt eine belastbare Monatsmatrix. |
| `mais-polenta` | `[]` | Das kanonische FOOD ist Mais/Polenta als Stärke-/Verarbeitungsform. Die BMLUK-Zeile `Zuckermais` beschreibt frischen Zuckermais und wird nicht übertragen. |
| `polenta` | `[]` | Verarbeitungsform; keine Übertragung von frischem Zuckermais. |
| `kaeferbohne` | `[]` | Der Datensatz beschreibt die Hülsenfrucht/Grundform; getrocknete Käferbohnen sind lagerfähig. Die Frischsaison der grünen Hülsen wird nicht übertragen. |

`erbsen-tk-moeglich` bleibt trotz des Hinweises „TK möglich“ **nicht neutral**: Der kanonische Grundstoff ist Erbse und besitzt eine eindeutige BMLUK-Saison. Tiefkühlverfügbarkeit verändert die FOOD-Identität nicht und macht die vorhandene Saisoninformation nicht falsch; sie führt auch zu keinem Verbot außerhalb der Saison, sondern nur zur bestehenden Priorisierung/Nachreihung.

## 5. Abweichungen zu bisher gepflegten Monaten

Der bisherige Bestand ist nicht einfach unvollständig, sondern teilweise auch anders abgegrenzt. Der Audit darf deshalb nicht nur leere Arrays füllen. Unter anderem ändern sich nach der Primärquelle:

- `kartoffel`: bisher nur ein Teil des Jahres → regional inkl. Lagerung ganzjährig;
- `apfel`: bisher nicht ganzjährig → regional inkl. Lagerung ganzjährig;
- `brokkoli`, `karfiol`, `zucchini`, `kohlrabi`, `kuerbis`, `pfirsich`, `pflaume`, `spinat`, `lauch`, `rosenkohl`, `weisskraut`, `rotkraut`, `erdbeere`, `himbeere` und `aprikose`: bestehende Monatslisten müssen gegen die neue Primärmatrix ersetzt, nicht ergänzt werden;
- zahlreiche bisher leere österreichische Gemüse-/Obst-FOODs erhalten erstmals explizite Monate.

Damit ist eine datenweise Regression erforderlich; ein Test nur auf „nicht leer“ wäre fachlich zu schwach.

## 6. Vorgesehene Umsetzung nach fachlicher Freigabe dieses Audits

Mit der Freigabe „regional aus Lagerung zählt mit“ ist die Quellen-/Lagersemantik entschieden. Im Implementierungsschritt soll **ohne neue Fachregel**:

1. der bestehende Consumer-Gap korrigiert werden, sodass `seasonMonths: []` tatsächlich weder `-3` Saisonbonus noch `+6` Outside-Season-Nachreihung erhält;
2. `data/foods.js` exakt auf die Matrix aus Abschnitt 3 gesetzt werden;
3. alle in Abschnitt 4 bewusst neutralen Fälle bei `[]` bleiben;
4. `TODO3 SEASON-AUDIT` in `tests/todo3-pending-regressions.test.cjs` aus dem Skip geholt und als exakte Matrix-/Neutralitätsregression umgesetzt werden;
5. zusätzlich abgesichert werden, dass Monate weiterhin nur eindeutige Ganzzahlen `1..12` sind;
6. `docs/PLANNER_FACHKONZEPT.md` erst nach erfolgreicher Implementierung/Testung vom offenen Saison-Audit auf den tatsächlichen Branch-/main-Status aktualisiert werden.

Nicht Teil dieses Blocks sind FOOD-COUNT, PHASE-TRANSITION, Rezept-Handling-Reviews oder Änderungen an der Höhe des saisonalen Scores.
