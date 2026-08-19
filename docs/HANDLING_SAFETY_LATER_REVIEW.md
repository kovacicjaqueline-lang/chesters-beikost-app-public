# Handling-Review – SAFETY-REVIEW / LATER-REVIEW

Stand: 19.08.2026  
Prüfbasis: Public-`main` `ad0695a2d200791cefb7a8cf3d247aaef17c4b29`  
Branch: `audit/handling-safety-later-review`  
Status: **Review-Vorschlag – noch keine fachliche Freigabe und keine Produktänderung**

## 1. Zweck und Grenzen

Dieser Review prüft die 8 `SAFETY-REVIEW`- und 8 `LATER-REVIEW`-Rezepte aus `docs/FOOD_HANDLING_READINESS_RECIPE_AUDIT.json` einzeln gegen:

- den aktuellen Rezepttext in `data/recipes.js`;
- die aktuellen FOOD-Sicherheitsformen in `data/foods.js`;
- den bestehenden strukturierten Handling-Contract in `data/food-handling.js`;
- die tatsächliche Wirkung der Handling-Runtime in `js/handling-readiness.js`;
- offizielle Sicherheitsinformationen zur Beikost-Darreichung.

Keine neue allgemeine Regel wird daraus abgeleitet. Insbesondere gilt weiterhin:

- `feedingApproach` ist Präferenz, keine Entwicklungsstufe und kein Safety-Override;
- ein Handling-Contract darf Zutaten-, Allergen-, Mahlzeiten- oder echte Alters-/Safety-Gates nicht umgehen;
- nicht ausreichend eindeutige Fälle bleiben im Legacy-Stage-Fallback;
- keine Safety-Regel wird aus Rezept-/FOOD-Freitext technisch geparst;
- `minMonths` wird nicht stillschweigend zu einem neuen harten Alters-Gate umgedeutet.

## 2. Technischer Review-Befund

Bei einem migrierten Rezept entfernt `mergeRecipeHandlingState()` aus `requirementMissing` ausschließlich die bisherige `Konsistenz:`-Sperre aus `recipe.stage`. Andere bestehende Requirement-Gates bleiben erhalten.

Wichtig: In `recipeStatesCore()` ist aktuell nur `hardMinMonths` ein hartes Alters-Gate. `minMonths` wird in `recipeStates()` lediglich als Orientierungstext angezeigt. Deshalb kann die Aufnahme eines Stage-4-Rezepts in den Handling-Contract dessen bisherige technische Spät-Sperre deutlich früher aufheben, wenn kein passendes `hardMinMonths` existiert.

Das ist der zentrale Grund, die LATER-REVIEW-Gruppe nicht pauschal zu migrieren.

## 3. Externe Sicherheitsbasis

Verwendete offizielle Quellen:

1. Österreichisches Gesundheitsportal – Beikost / Baby-Ernährung: weiche Konsistenz zu Beginn; Textur schrittweise an Entwicklung und Fähigkeiten anpassen.  
   https://www.gesundheit.gv.at/leben/eltern/nach-der-geburt/baby/baby-ernaehrung1.html
2. NHS – Your baby's first solid foods: Fingerfood soll anfangs weich sein, im Mund leicht zerfallen und gut greifbar sein; als Beispiele werden u. a. grätenfreier Fisch, gekochtes Ei und Fleisch ohne Knochen genannt.  
   https://www.nhs.uk/baby/weaning-and-feeding/babys-first-solid-foods/
3. CDC – When, What, and How to Introduce Solid Foods / Choking Hazards: Form, Größe und Textur müssen zur Entwicklung passen; Lebensmittel weich zubereiten; Haut/Knochen/Gräten aus Fleisch, Geflügel und Fisch entfernen; zähe oder große Fleischstücke sowie Knochen vermeiden.  
   https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/when-what-and-how-to-introduce-solid-foods.html  
   https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/choking-hazards.html
4. WHO – Complementary feeding: Konsistenz und Vielfalt schrittweise an Anforderungen und Fähigkeiten des Kindes anpassen; Formen vermeiden, die eine Verschluckungsgefahr darstellen.  
   https://www.who.int/health-topics/complementary-feeding

Diese Quellen begründen keine neue App-Phasenlogik und keine pauschale Altersfreigabe bestimmter Rezeptkategorien.

## 4. SAFETY-REVIEW – Einzelprüfung

### 4.1 Rind-Hafer-Bällchen – **weiter blockiert**

Aktueller Rezepttext:

- vollständig durchgaren;
- kleine längliche oder flache Stücke;
- keine harten Krusten und keine festen runden Kugeln;
- `skillRequirement`: weich, leicht zerdrückbar, direkt beaufsichtigt.

Der konkrete Rezepttext ist damit bereits deutlich sicherer als ein pauschales rundes Fleischbällchen. Der aktuelle FOOD-Vertrag für `Rind` sagt jedoch weiterhin: `fein püriert, zerzupft oder später als sehr weiches Bällchen`.

**Review-Entscheidung:** Noch kein `finger-graspable`-Contract. Eine Frühmigration würde die noch vorhandene FOOD-Aussage `später` faktisch überholen, ohne dass diese Semantik strukturiert fachlich aufgelöst wurde.

### 4.2 Geflügel-Gemüse-Hafer-Bällchen – **weiter blockiert**

Aktueller Rezepttext verlangt flache/längliche statt feste runde Stücke, vollständiges Durchgaren, saftige Konsistenz, keine harte Kruste und eine Prüfung auf leichte Zerdrückbarkeit.

Der aktuelle FOOD-Vertrag für `Huhn` enthält aber ebenfalls `später als sehr weiches Bällchen`.

**Review-Entscheidung:** Noch kein `finger-graspable`-Contract. Gleicher ungelöster FOOD-/Rezept-Semantikkonflikt wie bei Rind.

### 4.3 Lachs-Kartoffel-Bällchen – **Migrationskandidat `finger-graspable`**

Aktueller Rezepttext:

- vollständig gegarter, grätenfreier Lachs;
- sehr sorgfältig entgräten;
- mit weicher Kartoffel zerdrücken;
- ausdrücklich flache Taler;
- weich erwärmen oder backen;
- `skillRequirement`: leicht zerdrückbar und direkt beaufsichtigt.

Der FOOD-Vertrag für `Lachs` verlangt vollständiges Garen sowie sorgfältiges Entfernen von Haut/Schalen/Gräten und enthält keine zusätzliche Aussage `später`.

Offizielle Fingerfood-Hinweise erlauben grätenfreien Fisch in geeigneter weicher Form. Die bestehende Rezeptform ist flach, weich und nicht rund.

**Review-Vorschlag:** Nach fachlicher Bestätigung Aufnahme als ausschließlich `finger-graspable`. Zutaten-/Allergen- und sonstige Planner-Gates bleiben unverändert.

### 4.4 Bangus-Kartoffel-Taler – **weiter blockiert**

Das Rezept weist selbst ausdrücklich darauf hin, dass Bangus viele feine Gräten besitzt und nur bei wirklich vollständiger Entgrätung verwendet werden darf.

**Review-Entscheidung:** Kein allgemeiner `finger-graspable`-Contract. Der vorhandene Handling-Contract besitzt kein eigenes strukturiertes Gate, das die Bangus-spezifische vollständige Entgrätung technisch bestätigen könnte. Das besondere Feingräten-Risiko darf nicht durch Entfernen der Stage-Sperre banalisiert werden.

### 4.5 Eier-Finger – **Migrationskandidat `finger-graspable`**

Aktueller Rezepttext:

- vollständig gegartes Ei;
- in gut greifbare längliche Stücke schneiden;
- frisch anbieten;
- `skillRequirement`: leicht zerdrückbar, aufrecht sitzend, direkt beaufsichtigt.

Der FOOD-Vertrag verlangt gut durchgegartes Vollei. Die Rezeptfreigabe verlangt weiterhin, dass `Ei` als Zutat entsprechend dem bestehenden Zutaten-/Allergenstatus bereit ist.

Der NHS führt gekochtes Ei ausdrücklich als mögliches Fingerfood auf und empfiehlt anfangs weiche, gut greifbare Formen.

**Review-Vorschlag:** Nach fachlicher Bestätigung Aufnahme als ausschließlich `finger-graspable`. Keine Änderung an der Allergen-Einführung oder am Zutatenstatus.

### 4.6 Ei-Champignon-Cups – **weiter blockiert**

Das Rezept verlangt vollständig durchgebackene, weiche kleine Cups aus Ei und fein gehackten weich gegarten Champignons. Der Sicherheitstext verlangt leichte Zerdrückbarkeit.

Nicht eindeutig strukturiert ist jedoch die konkrete greifbare Geometrie: `6 kleine Cups` sagt nicht, ob sie als ausreichend große Streifen/flache Stücke oder als kleine kompakte Einzelstücke serviert werden.

**Review-Entscheidung:** Noch kein `finger-graspable`-Contract. Vor einer Migration sollte die tatsächlich sichere Servierform im Rezept eindeutig festgelegt werden; alternativ wäre zu prüfen, ob eine spätere `finger-small-soft`-Fähigkeit gemeint ist. Diese Entscheidung wird hier nicht erfunden.

### 4.7 Hummus mit weichen Gemüsesticks – **weiter blockiert**

Der ursprüngliche Audit hat bereits einen konkreten Konflikt dokumentiert:

- Rezept: `sehr weiche Gemüsesticks`;
- kanonische Zutat: aktuell `Gurke`;
- geprüfte Gurken-Sicherheitsform: längliche gut greifbare Stücke bzw. bei fester Form reiben/zerdrücken, aber keine pauschale Vorgabe `weich garen`.

Zusätzlich kombiniert das Rezept einen glatten Dip mit einem Fingerfood-Bestandteil; der aktuelle Rezept-Handling-Contract modelliert nur eine Liste zulässiger Modi für das Gesamtgericht und keinen zusammengesetzten `Dip + Stick`-Vertrag.

**Review-Entscheidung:** Nicht migrieren, bis Rezept-/FOOD-Form und die zusammengesetzte Darreichung eindeutig geklärt sind.

### 4.8 Fleisch-Gemüse-Bällchen – **weiter blockiert**

Aktueller Rezepttext ist sicherheitsbewusst: flache/längliche statt feste runde Stücke, vollständig durchgaren, saftig halten, harte Kruste vermeiden und auf leichte Zerdrückbarkeit prüfen.

Gleichzeitig:

- berührt der Fall erneut die FOOD-Semantik `später als sehr weiches Bällchen` bei Fleisch;
- das Rezept trägt zusätzlich `minMonths: 11`, das technisch nur Orientierung ist und durch eine Handling-Migration nicht als Gate erhalten würde.

**Review-Entscheidung:** Nicht migrieren, bevor sowohl die Fleisch-Handling-Semantik als auch die beabsichtigte spätere Rezeptorientierung fachlich strukturiert geklärt sind.

## 5. LATER-REVIEW – Einzelprüfung

### 5.1 Obst-Hafer-Muffins – **weiter LATER**

- `stage: 4`
- `minMonths: 10`
- weich/saftig, keine harte Kruste, Zerdrückbarkeit prüfen
- kein `hardMinMonths`

Eine Handling-Migration würde die technische Stage-Sperre entfernen und die bisherige 10-Monats-Orientierung nicht als Gate erhalten.

### 5.2 Gemüse-Hafer-Muffins – **weiter LATER**

- `stage: 4`
- `minMonths: 10`
- weich/saftig, keine harte Kruste, Zerdrückbarkeit prüfen
- kein entsprechendes hartes Alters-Gate

**Entscheidung:** Keine Frühmigration ohne separate fachliche Klärung der späteren Intention.

### 5.3 Kürbis-Hirse-Muffins – **weiter LATER / Datenlücke**

- `stage: 4`
- saftig und leicht zerdrückbar gefordert
- keine klare `minMonths`- oder `hardMinMonths`-Absicherung im Datensatz

Das ist kein Beleg für eine frühe Freigabe. Ebenso darf aus den anderen Muffins nicht stillschweigend `10 Monate` übertragen werden.

**Entscheidung:** Fachliche spätere Voraussetzung ausdrücklich klären; bis dahin Legacy-Fallback behalten.

### 5.4 Joghurt-Hafer-Waffeln – **weiter LATER**

- `stage: 4`
- `minMonths: 10`
- `hardMinMonths: 6`
- hell und weich ausbacken, harte Kanten entfernen

Eine Migration würde ab dem bereits vorhandenen harten 6-Monats-Gate zulassen und damit die bisherige 10-Monats-Orientierung technisch deutlich vorziehen.

### 5.5 Weiche Joghurt-Fladen – **weiter LATER**

- `stage: 4`
- `minMonths: 10`
- `hardMinMonths: 6`
- weich, flach, keine harte/dunkle Kruste

**Entscheidung:** Keine Frühmigration; bestehende spätere Intention zunächst erhalten.

### 5.6 Gemüse-Joghurt-Mini-Muffins – **weiter LATER**

- `stage: 4`
- `minMonths: 10`
- `hardMinMonths: 6`
- innen saftig, keine harte Kruste, leichte Zerdrückbarkeit prüfen

**Entscheidung:** Keine Frühmigration; sonst würde technisch das 6-Monats-Gate anstelle der bisherigen späteren Orientierung greifen.

### 5.7 Huhn-Gemüse-Muffins – **weiter LATER**

- `stage: 4`
- `minMonths: 11`
- vollständig gegartes fein zerkleinertes Huhn, saftige kleine Muffins, keine harte Kruste
- kein entsprechendes `hardMinMonths`

Zusätzlich berührt das Rezept Fleisch-Handling.

**Entscheidung:** Keine Frühmigration.

### 5.8 Süßkartoffel-Linsen-Muffins – **weiter LATER**

- `stage: 4`
- `minMonths: 10`
- feuchter Teig, vollständig backen, weich halten
- kein entsprechendes hartes Alters-Gate

**Entscheidung:** Keine Frühmigration.

## 6. Ergebnis

### Direkt fachlich zur Freigabe vorgeschlagen

Nur zwei der 16 Reviewfälle sind anhand des aktuellen Datenvertrags und der offiziellen Sicherheitsbasis hinreichend eindeutig, ohne eine neue allgemeine Regel zu erfinden:

1. `Lachs-Kartoffel-Bällchen` → `finger-graspable`
2. `Eier-Finger` → `finger-graspable`

Diese Einordnung ist **noch keine Produktfreigabe**. Sie wird erst nach ausdrücklicher fachlicher Bestätigung umgesetzt.

### Weiter blockiert

- Rind-Hafer-Bällchen
- Geflügel-Gemüse-Hafer-Bällchen
- Bangus-Kartoffel-Taler
- Ei-Champignon-Cups
- Hummus mit weichen Gemüsesticks
- Fleisch-Gemüse-Bällchen
- alle 8 LATER-REVIEW-Rezepte

## 7. Nächster technischer Schritt nach fachlicher Freigabe

Falls die beiden Kandidaten fachlich bestätigt werden:

1. auf einem frischen Implementierungsbranch vom dann aktuellen `main` arbeiten;
2. ausschließlich die beiden expliziten Rezeptnamen im `RECIPE_HANDLING_CONTRACT` ergänzen;
3. keine `stage`, `minMonths`, `hardMinMonths`, FOOD-`safeForm` oder Rezepttexte nebenbei ändern;
4. Regressionen ergänzen, die beweisen:
   - beide Kandidaten werden über `finger-graspable` von der linearen Stage-Sperre entkoppelt;
   - Zutaten-/Allergen-/Mahlzeiten-Gates bleiben hart;
   - alle sechs übrigen SAFETY-REVIEW- und alle acht LATER-REVIEW-Fälle bleiben unmigriert;
   - bestehende Logs/Locks und `presentationMode`-Semantik bleiben unverändert;
5. vollständige Node- und WebKit-Regression ausführen;
6. nichts ohne ausdrückliche Merge-Freigabe mergen.
