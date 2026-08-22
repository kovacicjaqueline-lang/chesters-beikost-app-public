# Recipe-V2: verbindliche Master-Gefäße

Dieses Dokument legt die kanonischen Master-Gefäße für Recipe-V2 verbindlich fest.

Es definiert **keine neuen Rezept-Icons** und keine zusätzlichen Gefäßfamilien. Maßgeblich ist jeweils das bereits fachlich freigegebene Referenz-Asset selbst. Die textliche Beschreibung in diesem Dokument dient nur dazu festzulegen, **welche Merkmale unverändert aus der Referenz übernommen werden müssen**; sie ersetzt die visuelle Referenz nicht.

## Verbindliche Referenzzuordnung

Ausgangsstand dieser Festlegung ist `main` bei Commit `e580c66f08fdb0ce7853f491b43c1d5dd7e8bd36`.

| Master-Gefäß | Referenzrezept | Verbindliches Referenz-Asset | Referenz-Blob auf dem Ausgangsstand |
| --- | --- | --- | --- |
| **Master-Teller** | Omelettstreifen | `assets/illustrations-v2/recipes/omelettstreifen.svg` | `ea67bef6bd6e66f70d77e48c3064e2b02a2857c8` |
| **Master-Schale** | Obst-Haferbrei | `assets/illustrations-v2/recipes/obst-haferbrei.svg` | `a839883201831aa02ff49b94a0f26338858de946` |
| **Master-Topf** | Arroz-caldo-inspiriert | `assets/illustrations-v2/recipes/arroz-caldo-inspiriert.svg` | `7c3152f48329de4eb761468b641d4e8768ebe844` |

`Arroz-caldo-inspiriert` ist dabei ausdrücklich und bewusst die Referenz für den **Master-Topf**; der Topf ist keine bloße Bestandsausnahme.

Die Blob-SHAs halten den bei dieser Festlegung geprüften Ausgangszustand fest. Für die laufende Arbeit wird über den Asset-Pfad auf die Referenz zugegriffen. Wird eines dieser Referenz-Assets später verändert, darf sich der Master dadurch nicht stillschweigend mitverändern: Die Master-Festlegung muss dann ausdrücklich mitgeprüft und bei Bedarf aktualisiert werden.

## Was vom Gefäß verbindlich übernommen wird

Bei Verwendung eines Master-Gefäßes ist ausschließlich das **Gefäß selbst** die Referenz. Folgende sichtbaren Gefäßeigenschaften müssen zur jeweiligen Referenz passen:

- Form, Proportionen und Silhouette des Gefäßes einschließlich sichtbarer Gefäßbestandteile;
- Farbe und Tonalität des Gefäßes;
- Materialwirkung und Oberflächencharakter;
- Randform, Randstärke und sichtbare Randgeometrie;
- Perspektive und Kamerawinkel;
- Ansicht und Orientierung des Gefäßes;
- perspektivische Verkürzung und sichtbarer Anteil von Innen- bzw. Außenfläche;
- Beleuchtungsrichtung, Lichtcharakter, Highlights und die unmittelbar zum Gefäß gehörende Schattierung.

Die **Ansicht und Perspektive sind verbindlicher Bestandteil des Masters**. Das Gefäß darf für ein neues Recipe-V2-Motiv nicht frei gedreht, gekippt, gespiegelt, stärker von oben gezeigt oder aus einer anderen Kameraposition neu interpretiert werden. Eine bloß ähnliche Gefäßform aus abweichender Perspektive erfüllt die Master-Vorgabe nicht.

Die exakte visuelle Referenz ist immer das oben genannte bestehende Asset. Farbnamen oder andere verbale Beschreibungen sind keine Ersatzspezifikation für das Bild.

## Was ausdrücklich nicht zum Master gehört

Der Rezeptinhalt des Referenzbilds ist **nicht** Teil des Masters. Nicht zu übernehmen sind insbesondere:

- die Speise selbst;
- Zutaten oder sichtbare Bestandteile der Speise;
- Menge, Stückzahl oder Portionierung;
- Anordnung, Textur oder Farbe des Rezeptinhalts;
- Toppings, Beilagen oder sonstige inhaltsspezifische Details.

Ein neues Recipe-V2-Icon muss seinen Inhalt weiterhin ausschließlich aus seiner tatsächlichen Rezeptdefinition ableiten. Die Master-Referenz beantwortet nur die Frage, **wie das dafür verwendete Gefäß aussehen und aus welcher Ansicht es gezeigt werden muss**.

## Arbeitsregel für neue Recipe-V2-Icons

Bevor ein neues Recipe-V2-Icon auf Basis eines Tellers, einer Schale oder eines Topfs erzeugt oder überarbeitet wird:

1. aktuelle Rezeptdefinition im Repository prüfen;
2. benötigte Gefäßart bestimmen;
3. das passende Master-Gefäß aus der obigen Zuordnung als direkte visuelle Referenz verwenden;
4. Gefäßform, Farbe, Materialwirkung, Rand, Perspektive, Ansicht und Beleuchtung nicht frei neu interpretieren;
5. Rezeptinhalt unabhängig davon ausschließlich nach dem tatsächlichen Rezept darstellen.

Es darf im Rahmen dieser Regel **kein zusätzliches Master-Gefäß eigenmächtig definiert** werden. Wenn keines der drei festgelegten Gefäße fachlich passt, ist das ein eigener Freigabepunkt und keine Einladung, eine vierte Gefäßfamilie zu erfinden.

## Freigabe-Gate

Diese Master-Gefäß-Festlegung ist Voraussetzung für jede weitere Recipe-V2-Arbeit, die eines dieser Gefäße verwendet. Neue entsprechende Recipe-V2-Icons sollen erst auf Basis dieser geklärten und freigegebenen Referenzzuordnung erzeugt werden.
