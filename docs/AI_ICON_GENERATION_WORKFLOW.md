# AI-Workflow für FOOD-/Recipe-V2-Bildgenerierung

Diese Datei ergänzt `docs/ICON_GUIDELINES.md` um die operative Regel, **wie** neue oder neu zu erzeugende Illustrationen entstehen müssen. Sie ändert keine fachlichen Motiventscheidungen aus der Icon-Leitlinie.

## Verbindliche Grundregel

Wenn ein Auftrag verlangt, ein FOOD-/Recipe-V2-Icon oder eine andere App-Illustration **zu erstellen, zu generieren, neu zu generieren, neu zu zeichnen oder visuell zu ersetzen**, muss der sichtbare Bildinhalt mit der dafür vorgesehenen **Bild-KI / Image-Generation-Funktion** erzeugt werden.

Für ChatGPT-Arbeit bedeutet das: Ist ein Image-Generation-Tool verfügbar, muss dieses für die eigentliche visuelle Erzeugung verwendet werden. Wenn kein solches Tool verfügbar ist, darf nicht ersatzweise ein Bild per Code, SVG-Pfaden, CSS, Emoji, Icon-Library oder aus einem bestehenden Asset konstruiert und anschließend als „KI-generiert“ bezeichnet werden.

Ein vorhandenes Repository-Asset ist nur ein **bestehendes Asset**. Das bloße Auslesen, Dekodieren, Extrahieren, Skalieren, Umverpacken oder Anzeigen eines vorhandenen PNG/SVG ist **keine neue Bildgenerierung**.

## Was ausdrücklich nicht als Bildgenerierung zählt

Folgende Schritte dürfen technische Nachbearbeitung oder Asset-Integration sein, ersetzen aber niemals den eigentlichen Image-Generation-Schritt:

- ein bestehendes eingebettetes PNG aus einem SVG extrahieren oder Base64 dekodieren;
- ein vorhandenes FOOD-/Recipe-Asset kopieren oder nur umbenennen;
- ein Motiv mit SVG-Pfaden oder sonstigem Zeichencode nachbauen;
- CSS-, Emoji-, Font- oder Icon-Library-Symbole als FOOD-/Recipe-V2-Illustration verwenden;
- ein altes oder fremdes Asset in einen neuen 128×128-SVG-Wrapper einbetten;
- ein bereits vorhandenes Repository-Bild ohne verifizierte Herkunft als „neu generiertes Icon“ präsentieren.

Ein SVG-Wrapper mit eingebettetem PNG kann weiterhin das technische Zielformat des Repositories sein. Entscheidend ist: **Der sichtbare Bildinhalt muss zuvor tatsächlich durch die Bild-KI erzeugt worden sein.**

## Pflichtablauf bei Generierungsaufträgen

1. Aktuelle Vorgaben aus `AGENTS.md`, `docs/AI_WORKFLOW.md`, `docs/ICON_GUIDELINES.md` und gegebenenfalls den Recipe-V2-Master-Referenzen prüfen.
2. Bereits getroffene fachliche Motiventscheidung übernehmen; keine neue Motivsemantik erfinden.
3. Das Bild mit der vorgesehenen Bild-KI erzeugen. Transparenz, Motiv, Perspektive, Stil und Referenzen gemäß Icon-Leitlinie vorgeben.
4. Das tatsächlich erzeugte Bild visuell prüfen.
5. Wenn die Nutzerin das generierte Icon sehen möchte, **genau dieses Image-Generation-Ergebnis** zeigen. Nicht stattdessen ein bereits vorhandenes Repository-Asset anzeigen.
6. Erst danach – sofern der Auftrag auch die Repository-Integration umfasst – das akzeptierte Bild technisch in das bestehende 128×128-Assetformat überführen, Mapping/Precache ergänzen und die erforderlichen Icon-Prüfungen ausführen.

## Sprachregel gegen falsche Herkunftsbehauptungen

Die Bezeichnungen „generiert“, „neu generiert“ oder „mit der Bild-KI erstellt“ dürfen nur verwendet werden, wenn im betreffenden Arbeitsgang tatsächlich eine Image-Generation-Funktion ausgeführt wurde.

Wenn lediglich ein vorhandenes Asset gezeigt wird, muss es entsprechend bezeichnet werden, zum Beispiel als „aktuelles Repository-Asset“ oder „vorhandene Icon-Datei“.

Wenn eine Generierung beauftragt ist, aber technisch nicht ausgeführt werden kann, ist das als Blocker zu benennen. Es darf kein Ersatzverfahren verwendet und als erfolgreiche Bildgenerierung ausgegeben werden.

## Abgrenzung zu Audit und technischer Asset-Arbeit

Für einen reinen Sichtaudit, Geometriecheck, Mapping-/Precache-Fix oder das Anzeigen eines ausdrücklich bereits vorhandenen Assets ist keine neue Bildgenerierung erforderlich.

Sobald der Auftrag jedoch auf **Erzeugung oder visuelle Neuerstellung** zielt, gilt die Bild-KI-Pflicht oben. Technische Nachbearbeitung folgt der Generierung; sie ersetzt sie nicht.
