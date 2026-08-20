# FOOD Handling – Oral-Processing-Rezeptreview

Stand: 2026-08-20  
Basis-main: `61d619bfa83ff6c453c00997ce4e8688709c95f2`  
Verbindliche Fachreferenz: `docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md`

## Zweck

Dieses Dokument hält die rezeptweise Prüfung der neuen oralen Verarbeitungsdimension fest.

Die Einstufung erfolgt **je konkretem Rezept und je konkret freigegebener Servierform**. Es wird keine Gruppenfreigabe aus Kategorien wie Pancake, Muffin, Bällchen, Waffel, Brot oder Fleisch abgeleitet.

Die orale Einstufung verändert keine unabhängigen Safety-, Zutaten-, Allergen-, Alters-, Mahlzeiten- oder Planner-Gates. Ein oral klar klassifiziertes Rezept kann daher aus einem anderen Grund weiterhin nicht migrationsreif sein.

## Profile

- `soft-breakdown`: sehr weich/feucht; ein abgetrennter Bissen zerfällt oder lässt sich unter leichtem Druck von Zunge, Gaumen, Zahnleisten beziehungsweise Kiefer weiter zerdrücken.
- `easy-bite-separate`: zusammenhängendes Fingerfood; Abbeißen/Abtrennen kann nötig sein, gelingt aber leicht, und der abgetrennte Bissen bleibt weich und ohne ausgeprägte wiederholte Kau-/Zerreibarbeit beherrschbar.
- `structured-chew-required`: der abgetrennte Bissen bleibt zusammenhängend, dicht, elastisch oder faserig und benötigt wiederholte aktive Kau-/Zerreibarbeit.

`soft-breakdown` und `easy-bite-separate` sind **keine linearen Altersstufen** und benötigen allein aufgrund des Profils keine zusätzliche orale Capability.

## A. Fachlich klare Einzelentscheidungen

Die folgenden Entscheidungen gelten nur für das jeweils genannte Rezept und die beschriebene Form.

| Rezept | Handling | Orales Profil | Extra orale Capability | Verbindliche Form-/Texturbedingung |
|---|---|---|---|---|
| Obst-Hafer-Pancakes | `finger-graspable` | `easy-bite-separate` | nein | klein/flach, vollständig aber weich gegart, keine harte/stark gebräunte Kruste |
| Birne-Hirse-Pancakes | `finger-graspable` | `easy-bite-separate` | nein | klein/flach; bei späterer Rezeptpflege ausdrücklich weich garen und harte Kruste ausschließen |
| Gemüse-Hafer-Pancakes | `finger-graspable` | `easy-bite-separate` | nein | klein/flach, vollständig aber weich gegart, keine harte Kruste |
| Zucchini-Hafer-Pancakes | `finger-graspable` | `easy-bite-separate` | nein | dünn, weich, vollständig durchgegart; keine harte/trockene Kruste |
| Ube-Bananen-Pancakes | `finger-graspable` | `easy-bite-separate` | nein | Ube vollständig weich gegart, Pancake weich durchgegart; keine harte/trockene Kruste |
| Rind-Hafer-Bällchen | `finger-graspable` | `easy-bite-separate` | nein | bereits freigegebene sehr weiche, flache/längliche Form; keine runde feste Kugel, keine harte Kruste |
| Geflügel-Gemüse-Hafer-Bällchen | `finger-graspable` | `easy-bite-separate` | nein | flach/länglich, vollständig durchgegart, weich und saftig, keine harte Kruste; leicht auseinanderteilbar; abgetrennter Bissen nicht federnd, gummiartig oder kompakt-elastisch |
| Lachs-Kartoffel-Bällchen | `finger-graspable` | `soft-breakdown` | nein | Lachs vollständig gegart/grätenfrei, mit weicher Kartoffel zerdrückt, flach und weich angeboten |
| Rote-Linsen-Gemüsebällchen | `finger-graspable` | `soft-breakdown` | nein | sehr weiche Linsen + Püree, flach, weich/saftig, nicht trocken |
| Tofu-Brokkoli-Bällchen | `finger-graspable` | `soft-breakdown` | nein | Naturtofu + sehr weicher Brokkoli fein zerdrückt, flach und weich serviert |
| Brokkoli-Kartoffel-Taler | `finger-graspable` | `soft-breakdown` | nein | sehr weicher Brokkoli + Kartoffel zerdrückt, flach, nur weich erhitzt/gebacken |
| Zucchini-Hafer-Puffer | `finger-graspable` | `easy-bite-separate` | nein | dünn, weich, vollständig durchgegart, keine knusprige harte Kante |
| Kichererbsen-Kürbis-Taler | `finger-graspable` | `soft-breakdown` | nein | Kichererbsen sehr weich und sehr fein zerdrückt, Kürbispüree, flach und weich gegart; Binder nur sparsam |
| Rote-Linsen-Bratlinge | `finger-graspable` | `soft-breakdown` | nein | sehr weich gekochte Linsen, flach, weich und saftig statt trocken |
| Polenta-Zucchini-Sticks | `finger-graspable` | `soft-breakdown` | nein | dicke weiche Polenta + weich gegarte Zucchini, breite greifbare Sticks, keine harte/trockene Kruste |
| Omelettstreifen | `finger-graspable` | `easy-bite-separate` | nein | verbindlicher Referenzfall: vollständig durchgegart, weich, breite gut greifbare Streifen |
| Zucchini-Omelett | `finger-graspable` | `easy-bite-separate` | nein | gilt für breite, weich gehaltene, gut greifbare Streifen; kleine Stücke bleiben separate Handlingfrage |
| Bangus-Kartoffel-Taler | `finger-graspable` | `soft-breakdown` | nein | oral nur für die weiche, zerdrückte Fisch-Kartoffel-Masse; die separate Bangus-Entgrätungs-Safety-Sperre bleibt vollständig bestehen |
| Kichererbsenmehl-Zucchini-Taler | `finger-graspable` | `easy-bite-separate` | nein | kleiner flacher Taler, vollständig durchgegart, weich; nicht trocken/knusprig |
| Eier-Finger | `finger-graspable` | `easy-bite-separate` | nein | vollständig gegartes Ei in gut greifbaren länglichen Stücken; weich/tender anbieten, nicht trocken oder gummiartig übergaren |
| Paprika-Omelettstreifen | `finger-graspable` | `easy-bite-separate` | nein | Paprika sehr fein und weich, Omelett vollständig durchgegart und weich, breite gut greifbare Streifen |
| Ei-Champignon-Cups | `finger-graspable` | `easy-bite-separate` | nein | gilt nur für weich gebackene, nicht gummiartige Masse, die zum Servieren in breite/längliche gut greifbare Stücke geschnitten wird |
| Buchweizen-Bananen-Pancakes | `finger-graspable` | `easy-bite-separate` | nein | kleiner weicher Pancake, vollständig durchgegart; keine harte/trockene Kruste |
| Süßkartoffel-Linsen-Taler | `finger-graspable` | `soft-breakdown` | nein | Süßkartoffel + sehr weiche rote Linsen zerdrückt, flach, vollständig gegart und weich gehalten |
| Gebackene Saba-Banane | `finger-graspable` | `soft-breakdown` | nein | reife Saba vollständig weich gebacken/gedämpft, gut greifbare weiche Stücke |
| Bananen-Joghurt-Hafer-Pancakes | `finger-graspable` | `easy-bite-separate` | nein | klein/flach, niedrige Hitze, vollständig durchgegart und weich gehalten |
| Obst-Joghurt-Hafer-Ofenbites | `finger-graspable` | `easy-bite-separate` | nein | flach weich backen, nicht austrocknen, anschließend in gut greifbare Stücke schneiden |
| Zucchini-Joghurt-Hafer-Bites | `finger-graspable` | `easy-bite-separate` | nein | flach/weich vollständig backen, keine harte Kruste; gut greifbare Stücke |
| Joghurt-Hafer-Waffeln | `finger-graspable` | `easy-bite-separate` | nein | nur hell und weich ausbacken, harte Kanten entfernen; zum Servieren breite gut greifbare Streifen/Stücke |
| Weiche Joghurt-Fladen | `finger-graspable` | `easy-bite-separate` | nein | klein/flach, vollständig aber weich gebacken, keine harte oder dunkle Kruste; nicht trocken/zäh servieren |

## B. Oral klassifiziert, aber wegen unabhängiger Safety-Frage nicht automatisch migrationsreif

### Bangus-Kartoffel-Taler

Orales Profil: `soft-breakdown`.

Das ist **keine** Aufhebung des bestehenden Safety-Befunds. Bangus besitzt viele feine Gräten; die Rezeptform darf nur verwendet werden, wenn der Fisch wirklich vollständig entgrätet ist. Die orale Einstufung allein macht das Rezept nicht automatisch früh oder plannerseitig verfügbar.

### Lachs-Kartoffel-Bällchen

Orales Profil: `soft-breakdown`.

Bestehende Fisch-/Gräten-/Durchgar-Safety-Regeln bleiben unabhängig aktiv.

### Rind-Hafer-Bällchen

Orales Profil: `easy-bite-separate` in der bereits separat freigegebenen sehr weichen, flachen/länglichen Form. Alle zuvor festgelegten Fleisch-/Safety-Gates bleiben unverändert.

## C. Bewusst weiterhin offene Oral-Fälle

Diese Rezepte werden **nicht** vorsorglich einer Stufe zugeordnet.

| Rezept | Status | Grund für Offenheit |
|---|---|---|
| Süßkartoffel-Hirse-Sticks | offen | Süßkartoffelpüree + sehr weiche Hirse kann je nach Verhältnis locker zerfallend oder dicht/klebrig werden; aktuelle Anweisung „Konsistenz prüfen“ reicht für reproduzierbare Einstufung nicht |
| Baby-Bananenbrot | offen | „weich“ und gut greifbar reicht nicht; Krume kann je nach Mehlmenge/Backergebnis locker oder dicht, klebrig beziehungsweise elastisch werden |
| Obst-Hafer-Muffins | offen | innen saftig + Zwei-Finger-Test genügt noch nicht, um Verhalten eines abgebissenen Muffin-Bissens reproduzierbar zu bestimmen |
| Gemüse-Hafer-Muffins | offen | wie oben; konkrete Krume/Elastizität hängt stark von Gemüsevariante und Verhältnis ab |
| Kürbis-Hirse-Muffins | offen | saftig/zerdrückbar ist hilfreich, aber die tatsächliche Krume ist aus der Rezeptur noch nicht reproduzierbar genug ableitbar |
| Gemüse-Joghurt-Mini-Muffins | offen | Muffin-Geometrie und mögliche dichte/gummiartige Krume bleiben unzureichend bestimmt |
| Huhn-Gemüse-Muffins | offen | zusätzlich kann fein zerkleinertes Huhn innerhalb der gebackenen Masse die Struktur verändern; keine Gruppenübertragung von Gemüse-/Obstmuffins |
| Süßkartoffel-Linsen-Muffins | offen | feuchter Teig spricht für weiche Struktur, garantiert aber ohne konkrete Mengen/Servierform noch kein `soft-breakdown` |
| Fleisch-Gemüse-Bällchen | offen | zwei Fleischvarianten und fehlende Mengenverhältnisse; „weich/saftig/zerdrückbar“ reicht noch nicht, um kompakt-elastisches Abtrennverhalten auszuschließen |
| Gemüse-Fleisch-Nockerl | offen; starker Prüffall für `structured-chew-required` | gekochte Weizen-/Grieß-Teigstruktur kann trotz Weichheit elastisch/gummiartig bleiben; Zweifinger-Test allein reicht nicht |

## D. Bewusst keine einzelne Oral-Klassifikation

### Hummus mit weichen Gemüsesticks

Weiterhin **nicht als einheitliches Handling-/Oral-Rezept migrieren**.

Hummus und der jeweilige Gemüsestick sind zwei unterschiedliche Komponenten mit unterschiedlichem Handling und oralem Verhalten. Das Profil des Sticks hängt vom konkreten Gemüse und seiner konkreten Zubereitung ab. Es wird keine gemeinsame orale Stufe für das zusammengesetzte Gericht erfunden.

## E. Technische Auffälligkeit außerhalb des 41er-Audits

`Bananen-Ei-Pancakes` war im Handling-Contract historisch bereits als `finger-graspable` geführt, ist im aktuellen kanonischen Rezeptstamm beziehungsweise im 100-Rezepte-Audit jedoch nicht als eigener kanonischer Rezeptfall enthalten.

Daraus wird **keine orale Einstufung aus dem Namen** abgeleitet. Vor einer technischen Migration muss zuerst geklärt werden, welche kanonische Rezeptidentität beziehungsweise Rezeptur damit gemeint ist.

## F. Konsequenzen für die spätere technische Umsetzung

1. Nur die in Abschnitt A einzeln genannten Fälle dürfen aus diesem Review als oral fachlich klar übernommen werden.
2. `soft-breakdown` und `easy-bite-separate` erzeugen keine neue zusätzliche orale Capability.
3. Für keinen der aktuell klaren Fälle wurde `structured-chew-required` vergeben.
4. Offene Fälle bleiben im bestehenden konservativen Verhalten, bis Rezeptur/Servierform ausreichend konkretisiert und erneut geprüft wurde.
5. Keine Gruppenfreigabe für Pancakes, Bällchen, Muffins, Waffeln, Fleisch oder Backwaren.
6. Bestehende unabhängige Safety- und Planner-Gates bleiben härter als die orale Einstufung.
7. Rezepttexte, die oben zusätzliche Form-/Texturbedingungen benötigen, müssen bei der späteren technischen Migration explizit entsprechend präzisiert werden; die Bedingungen dürfen nicht nur implizit im Review-Dokument verbleiben.

## Status

Rezeptweiser Oral-Processing-Review dokumentiert.

Noch nicht umgesetzt sind:

- Runtime-Feld `oralProcessing`;
- eine Runtime-Capability für `structured-chew-required`;
- Änderungen an `data/food-handling.js`;
- Änderungen an `data/recipes.js`;
- Planner-/UI-Änderungen;
- Migration der in Abschnitt C offenen Fälle.
