# Icon-Leitlinie

Diese Leitlinie gilt verbindlich für neue und überarbeitete FOOD-Illustrationen der Beikost-App sowie für die technischen Größen- und Zentrierungsregeln von Recipe-V2-Illustrationen.

## Vollständigkeitsregel für neue FOODs und Rezepte

Ein neues kanonisches FOOD oder ein neues Laufzeitrezept ist erst vollständig, wenn gleichzeitig ein eigenes V2-Icon vorhanden ist.

Verbindlich für neue Datensätze:

- neues FOOD -> eigenes Food-V2-Asset;
- neues Rezept -> eigenes Recipe-V2-Asset;
- eindeutige zentrale Icon-Zuordnung;
- erforderlicher Service-Worker-Precache;
- passende Icon-Regressionen bzw. `npm run verify:icons` im vorgesehenen Testscope.

Kategorie-, Generic- oder Legacy-Fallbacks gelten für neue kanonische FOODs oder Rezepte nicht als fertiger Zustand. Ein Datensatz darf nicht als vollständig bzw. mergebereit behandelt werden, wenn sein eigenes V2-Icon, Mapping oder Precache noch fehlt.

Diese Asset-Regel ist Teil der allgemeinen Aufnahmebedingung aus `AGENTS.md`: Neue FOODs und Rezepte müssen außerdem ihre fachliche Handling-/Oral-Processing-Einordnung und die jeweils erforderlichen Safety-/Serving-Angaben bereitstellen.

## Grundstil

- Lebensmittel müssen auf den ersten Blick eindeutig erkennbar sein.
- Darstellung realistisch bis leicht stilisiert-realistisch, hochwertig und freundlich.
- Transparenter Hintergrund; keine fest eingebaute Kachel, Farbfläche oder Szenerie.
- Keine Beschriftungen, Logos, Verpackungen oder unnötige Deko.
- Das Lebensmittel steht klar im Mittelpunkt und bleibt auch in kleiner App-Darstellung gut lesbar.
- Natürliche Farben, klare Formen und saubere Konturen; keine übertrieben dramatische oder düstere Beleuchtung.
- Schatten nur dezent und direkt am Objekt, damit das Motiv auf unterschiedlichen UI-Hintergründen funktioniert.
- Bei mehreren Objekten nur so viele verwenden, wie zur eindeutigen Erkennung sinnvoll sind.

## Recipe-V2: Master-Gefäße

Für Recipe-V2 gelten zusätzlich die verbindlichen Master-Gefäße aus [`RECIPE_V2_MASTER_VESSELS.md`](RECIPE_V2_MASTER_VESSELS.md):

- **Master-Teller:** `assets/illustrations-v2/recipes/omelettstreifen.svg`
- **Master-Schale:** `assets/illustrations-v2/recipes/obst-haferbrei.svg`
- **Master-Topf:** `assets/illustrations-v2/recipes/arroz-caldo-inspiriert.svg`

Verbindlich ist jeweils **nur das Gefäß**, nicht der Rezeptinhalt der Referenz. Form, Farbe, Materialwirkung, Rand, Perspektive, Ansicht und Gefäßbeleuchtung sind aus dem jeweiligen Referenz-Asset zu übernehmen. Insbesondere darf die Kameraposition bzw. Ansicht nicht frei neu interpretiert werden.

Vor einer neuen Recipe-V2-Generierung mit Teller, Schale oder Topf muss die passende Master-Referenz geprüft und verwendet werden. Zusätzliche Master-Gefäße dürfen nicht eigenmächtig eingeführt werden. Die vollständige Referenzzuordnung, die festgehaltenen Ausgangs-Blobs und die Freigaberegeln stehen in `docs/RECIPE_V2_MASTER_VESSELS.md`.

## Fleisch und Fisch

Fleisch und Fisch werden **niemals roh** dargestellt.

Verbindlich:

- vollständig gegart dargestellt,
- appetitlich, sauber und frisch wirkend,
- baby-/familienfreundliche Präsentation,
- keine blutigen, rohen, glasigen oder anatomisch drastischen Darstellungen,
- keine sichtbaren Gräten, Knochen oder Hautreste, wenn sie das Motiv unappetitlich oder für eine Beikost-App ungeeignet wirken lassen,
- keine Präsentation wie an einer Fleischtheke oder als rohes Filet,
- bevorzugt eine einfache gegarte Portion bzw. ein gegartes Stück, das das Lebensmittel eindeutig erkennen lässt.

Ziel ist eine freundliche FOOD-Illustration für eine Baby-/Beikost-App, nicht eine dokumentarische Darstellung des rohen Ausgangsprodukts.

## Fisch – zusätzliche Vorgaben

- Fischfleisch soll eindeutig gegart wirken: opak, saftig, hell bzw. arttypisch gegart.
- Keine ganzen toten Fische als Standardmotiv, wenn ein gegartes Stück die Lebensmittelart ausreichend eindeutig darstellen kann.
- Falls die Fischart visuell nur als ganzer Fisch eindeutig unterscheidbar ist, trotzdem freundlich, sauber und nicht drastisch darstellen; für die finale App-Illustration ist nach Möglichkeit eine gegarte, appetitliche Lösung zu bevorzugen.

## Meeresfrüchte und Schalentiere

- Ebenfalls neutral, sauber und appetitlich darstellen.
- Keine unnötig detailreiche Darstellung von Innereien oder feuchten Gewebestrukturen.
- Bei Miesmuscheln ist eine einfache Darstellung mit zwei geschlossenen, dunklen Schalen bevorzugt; keine Deko.

## Obst, Gemüse, Getreide, Hülsenfrüchte und weitere FOODs

- Möglichst die natürliche, typische Form zeigen.
- Ganze und angeschnittene Varianten dürfen kombiniert werden, wenn das die Erkennbarkeit verbessert.
- Bei Körnern, Samen, Flocken oder kleinen Hülsenfrüchten kann eine kleine, neutrale Schale oder ein Löffel verwendet werden, wenn das Motiv sonst nicht eindeutig lesbar wäre.
- Keine unnötigen Zutaten ergänzen, die das Lebensmittel mit einem Rezept verwechselbar machen.

## Technische Asset-Anforderungen

- Transparenter Hintergrund muss tatsächlich als Alpha-Transparenz vorliegen; ein eingebranntes Schachbrett gilt nicht als transparent.
- Quadratisches Ausgangsformat mit ausreichend Rand um das Motiv.
- Food-V2 und Recipe-V2 verwenden einen 128×128-SVG-Wrapper; das eingebettete quadratische PNG darf für scharfe Darstellung bei 96 px hochauflösend größer als 128×128 sein.
- Jedes kanonische FOOD erhält ein eigenes Asset und eine eindeutige zentrale Zuordnung.
- Keine Kategorie-Fallbacks für kanonische FOODs, wenn ein eigenes Asset vorgesehen ist.

## Sichtbare Motivgröße und Zentrierung

Für die Messung zählt die sichtbare Alpha-Bounding-Box ab Alpha ≥ 16; sehr schwache Anti-Aliasing-Randpixel bestimmen die Geometrie damit nicht künstlich. Die Bounding-Box ist eine technische Mess- und Review-Hilfe, nicht automatisch ein optisches Größenurteil.

### FOOD-V2

FOOD-Illustrationen haben sehr unterschiedliche natürliche Silhouetten. Ein Spargel, eine Bohne, eine Ölflasche, Blattgemüse oder eine kompakte Frucht können bei derselben prozentualen Bounding-Box optisch deutlich unterschiedlich groß wirken. Deshalb gibt es für FOOD-V2 **keinen universellen Prozent-Zielwert** und keinen globalen festen ±px-Zentrierungswert.

Verbindlich ist stattdessen:

- Das sichtbare Motiv darf den 128×128-Canvas nicht berühren oder abgeschnitten werden. Der technische Geometrie-Gate verlangt bei Alpha ≥ 16 mindestens **1 px transparenten Rand an jeder Seite**.
- Zentrierung wird **optisch** beurteilt. Die gemessenen X-/Y-Abstände dienen zur Review-Unterstützung, sind aber kein globaler harter Grenzwert.
- Zu kleine oder zu große Motive bleiben Review-Grund, werden aber nicht gegen einen allgemeinen Prozentwert geprüft.
- Größen werden nur innerhalb **wirklich vergleichbarer Motivfamilien** technisch gegeneinander abgesichert. Der aktuelle Gate enthält dafür explizit definierte Familien, etwa längliche Fischmotive, Ölflaschen, kompakte Nussmotive und Blattgemüse. Innerhalb einer solchen Familie darf die lange sichtbare Achse derzeit höchstens **4 px** auseinanderdriften.
- Neue Familienreferenzen werden nur ergänzt, wenn die Motive tatsächlich dieselbe visuelle Grundform haben. Aus einer Familienreferenz darf kein allgemeiner FOOD-Prozentwert abgeleitet werden.

Damit ist beispielsweise eine lange Bohne nicht allein deshalb falsch, weil ihre Bounding-Box kleiner oder größer als die einer runden Frucht ist. Entscheidend sind Erkennbarkeit, optisches Gewicht, ausreichender Rand und die Konsistenz mit vergleichbaren Motiven.

### Recipe-V2

Recipe-Illustrationen dürfen je nach Motivform deutlich unterschiedlich viel Canvas nutzen. Ein flaches Pancake-/Teller-Motiv kann bei rund 94–95 % sichtbarer Breite richtig wirken, während ein kompakteres Motiv mit demselben Prozentwert zu groß wäre. Deshalb gibt es für Recipe-V2 **keinen festen Prozent-Zielwert**.

- Maßgeblich ist zuerst ein sauberer transparenter Rand zum Canvas: **Ziel sind mindestens 3 px sichtbarer Freiraum an jeder Seite**.
- Für die technische Messung gilt wegen Pixel- und Alpha-Rundungen eine Untergrenze von **2 px je Seite**.
- Kein sichtbarer Teil des Motivs darf den Canvas berühren oder abgeschnitten werden.
- Zentrierung wird **optisch** beurteilt. Die Alpha-Bounding-Box dient als Mess- und Review-Hilfe, ist bei Recipe-V2 aber kein eigener harter ±px-Grenzwert.
- Zu viel transparenter Leerraum bleibt ebenfalls ein Review-Grund: Ein in der kleinen App-Darstellung sichtbar zu kleines Motiv soll vergrößert werden, solange der Mindest-Rand erhalten bleibt. Dafür gibt es bewusst keinen festen Mindest-Prozentwert.
- Bereits geprüfte Recipe-V2-Gruppen: **Brei** und **Stampf** wurden wegen deutlich zu großer Leerräume vergrößert und neu zentriert. **Pancakes**, **Taler** und **Muffins** werden ausdrücklich nicht auf einen gemeinsamen Prozentwert vereinheitlicht; ihre unterschiedlichen Motivgrößen bleiben erhalten, solange die Randregel erfüllt ist und der optische Review keinen Änderungsbedarf zeigt. Bei den **Bällchen** bleiben die drei bereits ausreichend großen Motive unverändert; die drei klar zu klein angelegten kompakten Motive Lachs-Kartoffel, Rote-Linsen-Gemüse und Tofu-Brokkoli werden innerhalb ihrer Familie vergrößert und neu zentriert, ohne daraus einen allgemeinen Recipe-Prozentwert abzuleiten. Bei **Lugaw** bleibt Huhn-Lugaw als bereits passende Familienreferenz unverändert; Lugaw-Basis und Kürbis-Lugaw werden als deutlich kleinere, gleichartig kompakte Schüssel-Motive auf ungefähr dieselbe sichtbare Familienbreite vergrößert und neu positioniert. Bei der **Omelett**-Familie bleiben Omelettstreifen und Zucchini-Omelett in ihrer bereits großen Originaldarstellung; nur Paprika-Omelettstreifen wird als klar zu kleines, gleichartig breites Motiv an die kleinere gute Familienreferenz von Zucchini-Omelett angeglichen und neu zentriert. Aus keiner dieser Familienreferenzen folgt ein allgemeiner Recipe-Prozentwert.

## Asset-Geometrie und UI-Rendergröße sind getrennt

Die Geometrie des 128×128-Assets darf nicht künstlich vergrößert werden, nur damit ein Icon in einem bestimmten UI-Kontext größer erscheint. Die App steuert die sichtbare Rendergröße separat.

Aktuelle verbindliche Rendergrößen:

- kompakte FOOD-Kontexte, Auswahl und Protokoll: **25 px** (`--icon-food`);
- FOOD-Katalogkarten: **32 px** als lokaler Katalog-Override;
- FOOD-Detailansicht: **96 px**;
- allgemeines Feature-/kompaktes Recipe-Token: **27 px** (`--icon-feature`);
- Recipe-Karten: **44 px**, auf schmalen Viewports bis 380 px **40 px**.

Der Planner rendert in den Mahlzeitenkartentiteln derzeit keine FOOD-/Recipe-Illustrationen; daraus folgt keine zusätzliche Planner-Rendergröße.

## Automatische Geometrieprüfung

`tests/helpers/icon-integrity-png.cjs` misst die sichtbare Geometrie der eingebetteten PNGs ab Alpha ≥ 16. `tests/icon-geometry-audit.test.cjs` nutzt diese Messung für die Canvas-/Rand-Gates und die ausdrücklich definierten familienbezogenen FOOD-Vergleiche. `tests/icon-render-sizes.test.cjs` sichert die voneinander getrennten UI-Rendergrößen ab.

Diese Tests laufen über die bestehenden Icon-/App-Gates; sie ersetzen den optischen Review nicht.

## Review-Kriterien vor Freigabe

Ein Icon wird nur freigegeben, wenn alle folgenden Punkte erfüllt sind:

1. Lebensmittel eindeutig erkennbar.
2. Stil passt zum bestehenden Food-V2-Bestand.
3. Transparenter Hintergrund ohne eingebrannte Kachel.
4. In kleiner Darstellung noch gut lesbar.
5. Sichtbare Motivgröße, Rand und Zentrierung entsprechen der jeweils geltenden FOOD-V2- oder Recipe-V2-Regel.
6. Keine unnötige Deko oder visuelle Verwechslung mit einem Rezept.
7. Fleisch/Fisch: gegart, appetitlich und baby-app-freundlich.
8. Keine unappetitlichen, drastischen oder rohen Darstellungen.
