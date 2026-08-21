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
- Für die App in das bestehende Food-V2-Assetformat überführen.
- Jedes kanonische FOOD erhält ein eigenes Asset und eine eindeutige zentrale Zuordnung.
- Keine Kategorie-Fallbacks für kanonische FOODs, wenn ein eigenes Asset vorgesehen ist.

## Sichtbare Motivgröße und Zentrierung

Für die Messung zählt die sichtbare Alpha-Bounding-Box ab Alpha ≥ 16; sehr schwache Anti-Aliasing-Randpixel bestimmen die Geometrie damit nicht künstlich.

### FOOD-V2

- Maßgeblich ist die **längere sichtbare Motivachse** innerhalb des 128×128-Canvas, nicht die gesamte rechteckige Fläche des Motivs.
- **Zielwert sind 80 %** der Canvas-Kantenlänge.
- Für technische Prüfungen gilt ein Zielkorridor von **78–82 %**.
- Die sichtbare Bounding-Box wird horizontal und vertikal auf die Canvas-Mitte ausgerichtet. Als technische Toleranz gelten höchstens **2 px Abweichung je Achse** auf dem 128×128-Canvas.
- Skalierung oder Zentrierung darf das eigentliche Motiv nicht abschneiden.

### Recipe-V2

Recipe-Illustrationen dürfen je nach Motivform deutlich unterschiedlich viel Canvas nutzen. Ein flaches Pancake-/Teller-Motiv kann bei rund 94–95 % sichtbarer Breite richtig wirken, während ein kompakteres Motiv mit demselben Prozentwert zu groß wäre. Deshalb gibt es für Recipe-V2 **keinen festen Prozent-Zielwert**.

- Maßgeblich ist zuerst ein sauberer transparenter Rand zum Canvas: **Ziel sind mindestens 3 px sichtbarer Freiraum an jeder Seite**.
- Für die technische Messung gilt wegen Pixel- und Alpha-Rundungen eine Untergrenze von **2 px je Seite**.
- Kein sichtbarer Teil des Motivs darf den Canvas berühren oder abgeschnitten werden.
- Zentrierung wird **optisch** beurteilt. Die Alpha-Bounding-Box dient als Mess- und Review-Hilfe, ist bei Recipe-V2 aber kein eigener harter ±px-Grenzwert.
- Zu viel transparenter Leerraum bleibt ebenfalls ein Review-Grund: Ein in der kleinen App-Darstellung sichtbar zu kleines Motiv soll vergrößert werden, solange der Mindest-Rand erhalten bleibt. Dafür gibt es bewusst keinen festen Mindest-Prozentwert.
- Bereits geprüfte Recipe-V2-Gruppen: **Brei** und **Stampf** wurden wegen deutlich zu großer Leerräume vergrößert und neu zentriert. **Pancakes**, **Taler** und **Muffins** werden ausdrücklich nicht auf einen gemeinsamen Prozentwert vereinheitlicht; ihre unterschiedlichen Motivgrößen bleiben erhalten, solange die Randregel erfüllt ist und der optische Review keinen Änderungsbedarf zeigt. Bei den **Bällchen** bleiben die drei bereits ausreichend großen Motive unverändert; die drei klar zu klein angelegten kompakten Motive Lachs-Kartoffel, Rote-Linsen-Gemüse und Tofu-Brokkoli werden innerhalb ihrer Familie vergrößert und neu zentriert, ohne daraus einen allgemeinen Recipe-Prozentwert abzuleiten. Bei **Lugaw** bleibt Huhn-Lugaw als bereits passende Familienreferenz unverändert; Lugaw-Basis und Kürbis-Lugaw werden als deutlich kleinere, gleichartig kompakte Schüssel-Motive auf ungefähr dieselbe sichtbare Familienbreite vergrößert und neu positioniert. Bei der **Omelett**-Familie bleiben Omelettstreifen und Zucchini-Omelett in ihrer bereits großen Originaldarstellung; nur Paprika-Omelettstreifen wird als klar zu kleines, gleichartig breites Motiv an die kleinere gute Familienreferenz von Zucchini-Omelett angeglichen und neu zentriert. Aus keiner dieser Familienreferenzen folgt ein allgemeiner Recipe-Prozentwert.

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