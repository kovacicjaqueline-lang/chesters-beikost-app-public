# Rezeptmengen und Altersorientierung – Recherche 2026-08-20

Stand: 20.08.2026  
Arbeitsbranch: `data/recipe-quantities-and-nockerl-split`  
Basis-main: `74056fe0dff5c6aca1b7eb688114a3152e1b495b`

## Zweck

Der bisherige Rezeptkatalog enthielt bei vielen Rezepten nur Zutatenlisten oder grobe Angaben wie „nach Variante“, „gleich viel“, „wenig“ beziehungsweise keine reproduzierbare Mengenrelation. Außerdem stammten mehrere `minMonths: 10/11`-Orientierungen aus einer historischen Rezept-/Konsistenzlogik und waren nicht als eigenständige harte Altersgrenzen belegt.

Diese Recherche verfolgt deshalb zwei getrennte Ziele:

1. **jedes Laufzeitrezept bekommt eine reproduzierbare Mengenformel**;
2. **jedes Laufzeitrezept bekommt eine weiche Altersorientierung**, ohne daraus ein neues hartes Alterstor zu machen.

Die Mengen in `js/recipes.js` sind **app-eigene normalisierte Rezepturen**. Sie wurden aus vorhandener App-Rezeptstruktur, geplanten Batchgrößen und vergleichbaren Babyrezepten öffentlicher Fachquellen abgeleitet. Sie sind keine wortgetreuen Kopien einzelner externer Rezepte.

## Alterssemantik

`minMonths` wird in dieser Welle ausschließlich als **Orientierung** verwendet:

- `6` = grundsätzlich ab allgemeiner Beikostreife beziehungsweise um den Beikoststart herum, wenn die konkrete Textur, Servierform, Zutaten- und Safety-Gates passen;
- `7` = komplexeres zusammengesetztes Gericht beziehungsweise eine Rezeptstruktur, die in öffentlichen Weaning-Rezepten typischerweise im Bereich 7–9 Monate auftaucht oder für die wir bewusst eine etwas spätere Orientierung als für reine First-Taste-Formen wählen.

`hardMinMonths` bleibt davon getrennt und wird durch diese Welle **nicht abgesenkt oder überschrieben**.

Die Altersorientierung ist ausdrücklich **keine Oral-Processing-Stufe**. Ein `minMonths: 7` bedeutet nicht automatisch `structured-chew-required`, und `minMonths: 6` hebt keine Safety-, Allergen-, Zutaten-, Handling- oder Planner-Sperre auf.

## Zentrale externe Befunde

### NHS – Lebensmittelgruppen und Texturen

**NHS: 7 to 9 months – Feeding your baby**  
https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/7-to-9-months/

Relevante Punkte:

- Proteinlebensmittel wie Fleisch, Fisch, Ei, Bohnen, Linsen, Kichererbsen und Tofu sind grundsätzlich **ab etwa 6 Monaten** geeignet.
- Vollfetter Naturjoghurt und pasteurisierte Milchprodukte sind als Lebensmittel beziehungsweise Kochzutat **ab etwa 6 Monaten** geeignet.
- Babys sollen auf zerdrückte, weich stückige und Fingerfood-Texturen übergehen, sobald sie diese bewältigen können.
- Fingerfood dient unter anderem dem Lernen von Abbeißen, Kauen und Schlucken weicher Stücke.

Daraus folgt: Rezeptkategorien wie „Fleisch“, „Muffin“, „Pancake“ oder „Fingerfood“ tragen allein keine pauschale 10-/11-Monats-Grenze.

### NHS – konkrete 6+-Referenzrezepte

**Omelette fingers**  
https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/omelette-fingers/  
Alter: 6 Monate+. Beispiel: 1 Ei plus weiches Gemüse; als Fingerstreifen serviert.

**Egg fingers**  
https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/egg-fingers/  
Alter: 6 Monate+. Beispiel: 1 Ei, in Fingerstücke geschnitten.

**Sweet potato patties**  
https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/sweet-potato-patties/  
Alter: 6 Monate+. Zeigt, dass weiche geformte Patties nicht kategorisch eine spätere Altersstufe benötigen.

**Veggie finger foods**  
https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/veggie-finger-foods/  
Alter: 6 Monate+. Weich gegarte Gemüse-Fingerfoods.

**Scrambled egg**  
https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/scrambled-egg/  
Alter: 6 Monate+. 1 Ei plus 1 EL Vollmilch; NHS betont, dass das Ei gekocht, aber nicht gummiartig sein soll.

**Baked plantain**  
https://www.nhs.uk/start-for-life/baby/recipes-and-meal-ideas/baked-plantain/  
Alter: 6 Monate+. Unterstützt die frühe Orientierung für sehr weich gegarte Saba-/Plantain-artige Formen.

### NHS – konkrete 7–9-Monats-Referenzrezepte und Mengen

**Chicken noodles**  
https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/chicken-noodles/  
Alter: 7–9 Monate. Mengen für vier Portionen unter anderem 125 g Hühnerbrust, 30 g Karotte, 60 g trockene Nudeln und 235 ml Wasser. Diese Mengenrelation wurde für den App-Topf als Referenz verwendet.

**Egg and mushroom cups**  
https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/egg-and-mushroom-cups/  
Alter: 7–9 Monate. NHS verwendet 5 Eier und 4–5 Champignons für ungefähr 8 Cups. Die App-Rezeptur wurde proportional auf 3 Eier und 75 g weich gegarte Champignons normalisiert.

**Vegetable pasta**  
https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/vegetable-pasta/  
Alter: 7–9 Monate. Referenz für weiche Pasta plus Gemüse-/Linsensauce.

**Creamy hotpot**  
https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/creamy-hotpot/  
Alter: 7–9 Monate. Referenz für vollständig gegartes Huhn mit Kartoffel und weichem Gemüse.

Wichtig für die Interpretation: Die NHS-Rezeptsammlung ordnet teils sehr ähnliche Zutatenkombinationen unterschiedlichen Altersbereichen zu, abhängig von Gesamtgericht, Zerkleinerung und Servierform. Daher wird die externe Altersangabe nicht als harter Zutaten-Gate in die App kopiert.

## Philippinen – National Nutrition Council

**A Quick Guide to Complementary Feeding**  
https://nnc.gov.ph/mindanao-region/a-quick-guide-to-complementary-feeding/

Für 6–9 Monate nennt das National Nutrition Council unter anderem:

- dicke Breie/porridge;
- gekochte und zerdrückte Süßkartoffel;
- weiche Früchte;
- kleine Mengen Huhn;
- zerdrückte Mungbohnen;
- zunehmende Texturentwicklung innerhalb des Zeitfensters.

**Is Lugaw Essential? An Infant and Young Child Feeding Perspective**  
https://nnc.gov.ph/luzon-region/is-lugaw-essential-an-infant-and-young-child-feeding-perspective/

Das NNC bezeichnet dicken Reisbrei/Lugaw als geeignete erste Beikost ab etwa 6 Monaten.

**Participatory cooking a new skill for nutrition workers**  
https://nnc.gov.ph/mindanao-region/participatory-cooking-a-new-skill-for-nutrition-workers/

Für „malapot na lugaw“ wird ein **Reis-Wasser-Verhältnis von 1:8** genannt. Dieses Verhältnis ist die Referenz für die App-Lugaw-Rezepturen, sofern weitere Zutaten nicht mehr Flüssigkeit erfordern.

Die Philippinen-Rezepte der App sind weiterhin babyangepasste, ungesalzene Varianten; die NNC-Quellen rechtfertigen keine pauschale Freigabe von Fischgräten, harten Stücken oder anderen Safety-Risiken.

## Hummus-Sonderfall

**NHS: Hummus with veggie fingers**  
https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/hummus-with-veggie-fingers/

Das konkrete NHS-Rezept ist als 12-Monats-Snack geführt und verwendet 120 g Kichererbsen sowie Sugar-Snap-Peas als Dip-Gemüse. Diese Altersangabe wird **nicht** auf glatten Hummus als Lebensmittelkomponente übertragen:

- Kichererbsen/Pulses sind laut allgemeiner NHS-Weaning-Empfehlung grundsätzlich ab etwa 6 Monaten möglich;
- Tahin bleibt von der separaten Sesam-/Allergenlogik abhängig;
- die Gemüsesticks müssen unabhängig davon in der jeweils FOOD-spezifisch sicheren Form angeboten werden;
- unter 12 Monaten wird daraus kein eigener Snack-Slot abgeleitet.

## Mengen-Normalisierung

Die App-Mengen folgen diesen Regeln:

1. Mengen beziehen sich auf die in `batch` beschriebene Rezeptmenge, nicht auf eine Soll-Verzehrmenge des Babys.
2. Bei Getreide wird soweit relevant zwischen trockenem Gewicht und bereits gekochter Menge unterschieden.
3. Wasser ist Zubereitungsmenge und kann bei Naturprodukten geringfügig angepasst werden, ohne das Zielprofil zu verändern.
4. Bei feuchten Fingerfoods werden Binder bewusst begrenzt, damit die Rezeptur nicht unnötig dicht, trocken oder gummiartig wird.
5. Fleisch/Fisch wird vollständig gegart; Fisch bleibt grätenfrei beziehungsweise beim Bangus besonders streng entgrätet.
6. Nuss-/Samenmuse werden glatt und in kleinen, eingemischten Mengen verwendet; bestehende Allergen-Gates bleiben unverändert.
7. Kein Rezept enthält Salz, zugesetzten Zucker oder Honig als Baby-Zutat.

## Aufteilung Gemüse-Fleisch-Nockerl

Der bisherige Sammeldatensatz `Gemüse-Fleisch-Nockerl` enthielt drei strukturell unterschiedliche Varianten:

1. Huhn + Zucchini;
2. Rind + Karotte;
3. rote Linsen + Süßkartoffel.

Eine gemeinsame Mengen- und Oral-Processing-Aussage wäre fachlich nicht reproduzierbar. Der Sammeldatensatz wird deshalb ersetzt durch:

- `Huhn-Zucchini-Nockerl`;
- `Rind-Karotten-Nockerl`;
- `Linsen-Süßkartoffel-Nockerl`.

Der alte gespeicherte Name `Gemüse-Fleisch-Nockerl` sowie `Gemüse-Fleisch-Spätzle` und `Baby-Spätzle` bleiben migrationssicher als Legacy-/Suchnamen beim früheren Defaultpfad `Huhn-Zucchini-Nockerl` hinterlegt. Die beiden anderen Varianten behalten ihre eigenen eindeutigen Namen.

Die Nockerl erhalten eine vorsichtige Orientierung ab etwa 7 Monaten, aber **keine automatische orale Klassifikation**. Entscheidend bleibt die fertige Struktur: vollständig durchgegart, sehr weich, nicht gummiartig, nicht kompakt-elastisch beziehungsweise bei der Linsenvariante nicht klebrig-gummiartig. Die drei Rezepte werden anschließend im Oral-Processing-Strang separat beurteilt.

## Ergebnis der Datenwelle

Nach Laufzeit-Normalisierung:

- 103 eindeutige Laufzeitrezepte;
- jedes davon besitzt eine numerische/reproduzierbare Zutatenmenge;
- 66 Rezepte: Orientierung ab etwa 6 Monaten;
- 37 Rezepte: Orientierung ab etwa 7 Monaten;
- vorhandene `hardMinMonths` bleiben unverändert;
- die früheren pauschalen `minMonths: 10/11` bei weichen Back-/Fingerfoodrezepten werden nicht als versteckte Altersbarriere fortgeführt;
- die neue Orientierung ersetzt weder allgemeine Beikostreife noch Safety-, Allergen-, Zutaten-, Handling-, Mahlzeiten- oder Planner-Gates.
