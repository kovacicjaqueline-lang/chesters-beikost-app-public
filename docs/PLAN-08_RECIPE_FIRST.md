# PLAN-08 – Recipe-first für bekannte Kombinationen und genau eine neue Zutat

Fachlich bestätigt und am 18.08.2026 präzisiert.

## Grundsatz

Der Planner unterscheidet zwei Recipe-first-Pfade:

1. **Exakte Promotion:** Eine bereits geplante bekannte FOOD-Kombination darf zu einem vorhandenen Rezept werden, wenn eine aktuell geeignete Rezeptvariante exakt dieselben FOOD-IDs enthält.
2. **Proaktive Rezeptwahl:** Eine bereits vom Planner gewählte FOOD-Mahlzeit darf um bekannte, automatisch geeignete Rezeptzutaten erweitert werden, wenn dadurch eine eindeutige passende Rezeptvariante entsteht.

Zusätzlich gilt die Einführungsregel:

**Ein Rezept darf genau EIN neues Lebensmittel enthalten.**

Dieses neue FOOD muss bereits die einzige geplante Kostprobe / Einführung der Mahlzeit sein. Alle übrigen Rezeptzutaten müssen nach dem bestehenden Rezeptvertrag bekannt und für die konkrete Mahlzeit automatisch geeignet sein. Zwei oder mehr neue Lebensmittel werden nie automatisch gemeinsam über ein Rezept eingeführt.

Kurzform:

**Recipe-first bei eindeutig passenden Rezepten; ein Rezept darf 0 oder genau 1 neues FOOD enthalten, niemals 2+.**

## Harte Grenzen

- Der exakte Promotion-Pfad ergänzt weiterhin keine Zutat nur damit ein Rezept passt.
- Der proaktive Pfad darf ausschließlich bereits bekannte, automatisch geeignete Zutaten ergänzen.
- Genau eine bereits geplante Kostprobe darf die einzige noch nicht rezeptbereite Zutat des Rezepts sein.
- Ohne geplante Kostprobe darf das Rezept kein unbekanntes FOOD hinzufügen.
- Zwei oder mehr neue Lebensmittel in einem Rezept sind automatisch ausgeschlossen.
- `sampleFoodIds` und der Einführungstyp bleiben bei einem Rezept mit einem neuen FOOD erhalten.
- Der kanonische Rezept-Mahlzeitenvertrag `plannerRecipeSuitableForMeal()` bleibt verbindlich, einschließlich `excludeMeals`.
- Rezept-Anforderungen an Konsistenz und Alter bleiben verbindlich.
- Bestehende FOOD.meals-/Auto-Eignungsregeln werden nicht umgangen.
- Keine allgemeine Pair-Blacklist und keine Ableitung aus `safeForm`/`prep`-Freitext.
- Ein echtes Rezept erhält seinen kanonischen `recipeName`; eine fehlende Rezeptvorratsportion wird nicht erfunden.
- Recipe-first darf die bereits vom FOOD-Planer verwendete Milchklassifikation nicht nachträglich verändern.
- base/component/sample werden nach demselben kanonischen Rollenvertrag wie im Bearbeiten-Dialog geführt.

## Exakte Promotion

Bei exakt passenden bekannten Kombinationen bleiben die auf `main` bereits bestätigten Regeln bestehen:

- Bei aktivierter Vorratspräferenz gewinnt tatsächlich verfügbarer, noch nicht reservierter Rezeptvorrat.
- Danach wird die geringere `recipePlannedUse`-Nutzung berücksichtigt.
- Bleiben mehrere Rezeptformen gleichrangig, findet keine automatische Promotion statt.
- Nur wenn eine fertige Rezeptportion die Mahlzeit tatsächlich übernimmt, werden zuvor reservierte Einzel-FOOD-Portionen freigegeben.
- Ein frisch zuzubereitendes Rezept behält seine Zutatenreservierungen und erscheint im Meal-Prep als Rezeptaufgabe.

## Auswahlprinzip des proaktiven Pfads

Die bereits vom FOOD-Planner gewählte Mahlzeit bleibt der fachliche Anker. Ein Rezept kommt nur infrage, wenn:

- alle bereits geplanten FOOD-IDs in einer konkreten Rezeptvariante enthalten sind;
- bei einer bekannten FOOD-Mahlzeit die Variante mindestens eine zusätzliche bekannte Zutat enthält;
- bei einer Kostprobe auch ein exakt passendes Rezept zulässig ist, wenn genau diese eine Kostprobe die einzige neue Zutat bleibt;
- jede zusätzliche Zutat bereits bekannt und automatisch für die Mahlzeit geeignet ist;
- bei einer Kostprobe genau diese eine Sample-FOOD die einzige noch nicht rezeptbereite Zutat sein darf;
- ohne Kostprobe alle Zutaten rezeptbereit sind;
- Milchklassifikation, Mahlzeiteneignung, Alter und Konsistenz unverändert passen.

Innerhalb desselben Rezepts wird keine Variantenwahl geraten. Wenn mehrere Varianten mit gleich wenig Ergänzungen möglich bleiben, wird dieses Rezept nicht automatisch gewählt.

Zwischen mehreren Rezepten gilt als konservative technische Auswahl:

1. möglichst wenige zusätzliche bekannte Zutaten;
2. danach geringere `recipePlannedUse`-Nutzung im aktuellen Planlauf.

Bleibt danach ein Gleichstand zwischen unterschiedlichen Rezeptformen, findet keine automatische Auswahl statt.

## Rollen- und Lebenszyklusvertrag

Recipe-first ist kein reines Darstellungslabel:

- `recipePlannedUse` wird berücksichtigt;
- fertiger Rezeptvorrat bleibt der bestehende eigene Vorratspfad;
- frische Recipe-first-Gerichte behalten beziehungsweise reservieren ihre einzelnen FOOD-Zutaten;
- Auto-Lock/Rebuild darf diese Zutatenreservierungen nicht verlieren;
- die Einkaufsliste behält die enthaltenen FOOD-Zutaten im Blick;
- bei einem Rezept mit genau einem neuen Lebensmittel bleibt `sampleFoodIds` erhalten;
- der Einführungstyp bleibt erhalten, damit derselbe Tag nicht zusätzlich ein zweites neues Lebensmittel bekommt;
- `baseFoodIds`, `sampleFoodIds` und `foodRoles` folgen auch nach einer proaktiven Rezeptwahl dem kanonischen Rollenvertrag;
- die bestehende strenge Rollenvalidierung wird nicht gelockert.

## Referenzfälle

- Huhn + Zucchini, Hafer bereits bekannt → kann proaktiv zu `Geflügel-Gemüse-Hafer-Bällchen` erweitert werden, wenn der Rezepttreffer eindeutig ist.
- Lachs + Kartoffel → `Lachs-Kartoffel-Bällchen`, wenn der exakte Treffer eindeutig und für die Mahlzeit geeignet ist.
- Banane + Hafer + Ei → bei gleichrangigen Pancake-/Bananenbrot-Varianten keine automatische Darreichungsentscheidung.
- Ei + Banane → nur dann proaktive Erweiterung um eine bereits bekannte Zutat, wenn dadurch ein eindeutiges geeignetes Rezept entsteht.
- Eine geplante Kostprobe `Neu` + bekannte Basis darf zu einem Rezept mit `Neu` plus weiteren bekannten Zutaten werden; `Neu` bleibt das einzige `sampleFoodId`.
- Zwei neue Lebensmittel im selben Rezept → automatisch ausgeschlossen.
- Süßkartoffel + Gurke ohne passenden eindeutigen Rezeptpfad → FOOD-only und getrennte Komponenten.

## Zusammenspiel mit PLAN-08-X1

PLAN-08-X1 neutralisiert den früheren nachgelagerten `ironCompanion()`-Dreierfallback. Eisen wird nur noch innerhalb der normalen Zweier-Begleiterauswahl berücksichtigt; eine dritte freie FOOD-Komponente wird nicht allein zur Eisenoptimierung ergänzt.

Außerhalb des Frühstücks werden schräge Obst + Gemüse/Wurzel beziehungsweise Obst + herzhafte Proteinquelle nicht als letzter FOOD-only-Fallback erzwungen. Ein echtes vorhandenes Rezept kann eine solche Kombination weiterhin über seinen eigenen Rezeptvertrag legitimieren.
