"use strict";

/* Rezepte und Allergenplanung
 * Rezeptfreigabe nach gegessenen Zutaten, Konsistenzregeln, Karten und Allergenplanung.
 * Forschungs-/Datenstand 2026-08-22:
 * - alle Laufzeitrezepte mit reproduzierbaren Mengenangaben
 * - weiche Altersorientierung getrennt von hardMinMonths
 * - Gemüse-Fleisch-Nockerl in drei eigenständige Rezepte aufgeteilt
 * - zwei quellengestützte Wrap-Rezepte als echte graded-bite-Referenzfälle ergänzt
 */

const RECIPE_CATALOG_ADDITIONS = Object.freeze([
  Object.freeze({
    name: "Bananen-Ei-Pancakes",
    category: "pancakes",
    requires: Object.freeze(["Banane", "Ei"]),
    stage: 2,
    batch: "4–6 Mini-Pancakes",
    ingredients: "1 sehr reife Banane, 1 Ei",
    note: "Banane fein zerdrücken, mit dem Ei zu einem gleichmäßigen Teig verrühren und kleine flache Pancakes bei niedriger Hitze vollständig, aber weich durchgaren. Keine harte oder stark gebräunte Kruste.",
    searchAliases: Object.freeze([]),
    skillRequirement: "Nur weich und gut greifbar anbieten. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten.",
  }),
  Object.freeze({
    name: "Pizza Wrap",
    category: "family",
    requires: Object.freeze(["Weizen", "Tomate", "Käse"]),
    oneOf: Object.freeze(["Champignon", "Paprika", "Zucchini"]),
    stage: 4,
    batch: "1 großer gefüllter Doppel-Wrap · 4–6 Stücke",
    ingredients: "2 Vollkorn-Wraps aus Weizen, 2 EL Tomatenmark, 2 EL Wasser, 30 g geriebener pasteurisierter Käse, 1 mittelgroßer Champignon und/oder ¼ Paprika und/oder etwa 2,5 cm Zucchini, 1 TL Olivenöl",
    note: "Gemüse sehr fein würfeln und in wenig Öl etwa 5 Minuten weich dünsten. Tomatenmark mit Wasser verrühren. Einen Wrap in die Pfanne legen, mit Tomatenmischung bestreichen, weiches Gemüse und Käse daraufgeben, zweiten Wrap auflegen und leicht andrücken. Nur so lange erwärmen, dass der Käse schmilzt und der Wrap zusammenhält; für die Babyportion nicht knusprig oder hart toasten. Kurz abkühlen lassen und in gut greifbare Stücke schneiden.",
    freezable: false,
    tags: Object.freeze(["Fingerfood", "Familiengericht", "Snack"]),
    searchAliases: Object.freeze(["Pizza-Wrap", "Wrap-Pizza"]),
    skillRequirement: "Nur als weichen, zusammenhängenden und leicht gepressten Wrap ohne harte oder spröde Ränder anbieten. Gemüse muss weich sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten.",
  }),
  Object.freeze({
    name: "Chicken Fajita Wrap",
    category: "family",
    requires: Object.freeze(["Huhn", "Paprika", "Zwiebel", "Knoblauch", "Weizen", "Naturjoghurt"]),
    stage: 4,
    batch: "4 Familienportionen · je ½ mittelgroßer Wrap",
    ingredients: "1¼ rote Paprika, 1½ kleine Zwiebeln, ½ TL Paprikapulver, ¼ TL mildes Chilipulver, 1 kleine Knoblauchzehe, ½ TL gemahlener Kreuzkümmel, 2 TL Pflanzenöl, 2 kleine Hühnerbrustfilets, pro Portion ½ mittelgroßer Weizen-Tortilla-Wrap und ½ EL Naturjoghurt",
    note: "Paprika und Zwiebel in Streifen, Huhn in Fingerstreifen schneiden. Mit Knoblauch, milden Gewürzen und Öl vermengen und 5 Minuten im Kühlschrank marinieren. Huhn und Gemüse bei mittlerer Hitze 10–15 Minuten garen, bis das Huhn vollständig durchgegart und das Gemüse weich ist. Für jede Portion Huhn und Gemüse mit etwas Naturjoghurt mittig auf eine weiche Tortilla geben, eng aufrollen und in kleinere gut greifbare Abschnitte schneiden. Tortilla nicht hart oder trocken werden lassen.",
    freezable: false,
    tags: Object.freeze(["Fingerfood", "Familiengericht"]),
    searchAliases: Object.freeze(["Huhn-Fajita-Wrap", "Chicken Fajitas"]),
    skillRequirement: "Huhn vollständig durchgaren und zart halten, Gemüse weich garen und die Tortilla weich lassen. Den eng gerollten Wrap nur in beherrschbaren Abschnitten und direkt beaufsichtigt anbieten.",
  }),
]);

function installRecipeCatalogAdditions(recipes = typeof RECIPES !== "undefined" ? RECIPES : null) {
  if (!Array.isArray(recipes)) return false;
  let changed = false;
  for (let recipe of RECIPE_CATALOG_ADDITIONS) {
    if (recipes.some((item) => item?.name === recipe.name)) continue;
    recipes.push({ ...recipe });
    changed = true;
  }
  return changed;
}

const RECIPE_RESEARCH_GUIDANCE = Object.freeze({
  "Obst-Hafer-Pancakes": Object.freeze(["40 g feine Haferflocken, 60 g sehr weiches bekanntes Obst nach Auswahl, 1 Ei", 6]),
  "Birne-Hirse-Pancakes": Object.freeze(["30 g weiche Birne, 30 g gekochter Hirsebrei, 1 Ei", 6]),
  "Gemüse-Hafer-Pancakes": Object.freeze(["40 g feine Haferflocken, 60 g sehr weich gegarter Kürbis oder Süßkartoffel, 1 Ei", 6]),
  "Zucchini-Hafer-Pancakes": Object.freeze(["30 g fein geriebene und gut ausgedrückte Zucchini, 20 g Haferflocken, 1 Ei", 6]),
  "Ube-Bananen-Pancakes": Object.freeze(["30 g vollständig gegarte Ube, 30 g reife Banane, 20 g Haferflocken, 1 Ei", 6]),
  "Rind-Hafer-Bällchen": Object.freeze(["100 g mageres Faschiertes vom Rind, 20 g feine Haferflocken, 1 Ei", 6]),
  "Geflügel-Gemüse-Hafer-Bällchen": Object.freeze(["100 g Hühnerfaschiertes, 60 g fein geriebene und gut ausgedrückte Zucchini, 20 g feine Haferflocken; alternativ 100 g Putenfaschiertes, 60 g sehr weich gegarte fein zerdrückte Karotte und 20 g feine Haferflocken", 6]),
  "Lachs-Kartoffel-Bällchen": Object.freeze(["50 g vollständig gegarter grätenfreier Lachs, 100 g sehr weiche Kartoffel", 6]),
  "Rote-Linsen-Gemüsebällchen": Object.freeze(["80 g sehr weich gekochte rote Linsen, 40 g Karottenpüree, 10 g feine Haferflocken", 6]),
  "Tofu-Brokkoli-Bällchen": Object.freeze(["80 g Naturtofu, 45 g sehr weicher Brokkoli, 10 g feine Haferflocken", 6]),
  "Brokkoli-Kartoffel-Taler": Object.freeze(["100 g sehr weicher Brokkoli, 100 g sehr weiche Kartoffel", 6]),
  "Zucchini-Hafer-Puffer": Object.freeze(["45 g fein geriebene Zucchini, 20 g Haferflocken, 1 Ei", 6]),
  "Kichererbsen-Kürbis-Taler": Object.freeze(["80 g sehr weiche Kichererbsen, 60 g Kürbispüree, bei Bedarf 10 g feine Haferflocken als Binder", 6]),
  "Rote-Linsen-Bratlinge": Object.freeze(["100 g sehr weich gekochte rote Linsen, 15 g feine Haferflocken", 6]),
  "Polenta-Zucchini-Sticks": Object.freeze(["40 g feine Polenta, 160 ml Wasser, 60 g fein geriebene und weich gegarte Zucchini", 6]),
  "Süßkartoffel-Hirse-Sticks": Object.freeze(["150 g Süßkartoffelpüree, 60 g sehr weich gekochte Hirse", 7]),
  "Omelettstreifen": Object.freeze(["1 Ei, 15 ml Wasser", 6]),
  "Zucchini-Omelett": Object.freeze(["1 Ei, 30 g fein geriebene Zucchini", 6]),
  "Obst-Haferbrei": Object.freeze(["20 g feine Haferflocken, 120 ml Wasser, 40 g weiches bekanntes Obst nach Auswahl", 6]),
  "Obst-Hirsebrei": Object.freeze(["20 g Hirseflocken, 120 ml Wasser, 40 g weiches bekanntes Obst nach Auswahl", 6]),
  "Obst-Polentabrei": Object.freeze(["20 g feine Polenta, 120 ml Wasser, 40 g weiches bekanntes Obst nach Auswahl", 6]),
  "Obst-Reisbrei": Object.freeze(["20 g Reis oder Reisflocken, 150 ml Wasser, 40 g weiches bekanntes Obst nach Auswahl", 6]),
  "Obst-Quinoabrei": Object.freeze(["20 g weißer Quinoa, 140 ml Wasser, 40 g weiches bekanntes Obst nach Auswahl", 6]),
  "Obst-Buchweizenbrei": Object.freeze(["20 g Buchweizenflocken oder sehr weich gekochter Buchweizen, 120 ml Wasser, 40 g weiches bekanntes Obst nach Auswahl", 6]),
  "Obst-Grießbrei": Object.freeze(["20 g feiner Weizengrieß, 120 ml Wasser, 40 g weiches bekanntes Obst nach Auswahl", 6]),
  "Milch-Getreide-Brei": Object.freeze(["20 g bekannte Getreideflocken oder feiner Grieß, 100 ml Wasser; nach Einführung zusätzlich entweder 100 ml pasteurisierte Vollmilch oder 80 g Naturjoghurt oder 100 ml ungesüßte Buttermilch", 6]),
  "Baby-Bananenbrot": Object.freeze(["240 g sehr reife Banane (etwa 2 mittelgroße), 2 Eier, 150 g fein gemahlene Haferflocken oder Dinkel-/Weizenmehl, optional 15 ml Rapsöl", 7]),
  "Kürbis-Hafer-Brei": Object.freeze(["100 g Kürbispüree, 15 g feine Haferflocken, 100 ml Wasser", 6]),
  "Gemüse-Nudel-Sauce": Object.freeze(["120 g Zucchini, 150 g geschälte gegarte Tomate, 60 g trockene kleine Nudeln, 100 ml Wasser", 7]),
  "Baby-Linsen-Bolognese": Object.freeze(["30 g trockene rote Linsen, 150 g gegarte Tomate, 60 g trockene kleine Nudeln, 150 ml Wasser", 7]),
  "Lugaw-Basis": Object.freeze(["50 g Reis, 400 ml Wasser, 80 g vollständig gegartes fein zerkleinertes Huhn", 6]),
  "Kürbis-Lugaw": Object.freeze(["50 g Reis, 400 ml Wasser, 120 g Kürbis", 6]),
  "Monggo-Kalabasa-Brei": Object.freeze(["40 g trockene Mungbohnen, 150 g Kürbis, 300 ml Wasser", 6]),
  "Tinola-inspiriert": Object.freeze(["100 g Huhn, 150 g Sayote, 5 g Malunggay-Blätter, 400 ml Wasser", 7]),
  "Arroz-caldo-inspiriert": Object.freeze(["50 g Reis, 100 g Huhn, 500 ml Wasser, 2 g frischer Ingwer", 7]),
  "Kalabasa mit Kokos": Object.freeze(["200 g Kürbis, 50 ml ungesüßte Kokosmilch, 50 ml Wasser", 6]),
  "Tilapia-Reis-Brei": Object.freeze(["60 g vollständig gegarter grätenfreier Tilapia, 30 g Reis, 200 ml Wasser", 7]),
  "Bangus-Kartoffel-Taler": Object.freeze(["60 g vollständig gegarter und äußerst sorgfältig entgräteter Bangus, 120 g sehr weiche Kartoffel", 7]),
  "Obst-Hafer-Muffins": Object.freeze(["120 g sehr weiches Obst oder Obstpüree nach Auswahl, 80 g fein gemahlene Haferflocken, 1 Ei", 7]),
  "Gemüse-Hafer-Muffins": Object.freeze(["100 g sehr fein vorbereitetes weiches Gemüse nach Auswahl, 80 g fein gemahlene Haferflocken, 1 Ei", 7]),
  "Kürbis-Hirse-Muffins": Object.freeze(["120 g Kürbispüree, 70 g Hirseflocken, 1 Ei", 7]),
  "Karotten-Polenta-Brei": Object.freeze(["150 g sehr weiche Karotte, 30 g feine Polenta, 180 ml Wasser", 6]),
  "Süßkartoffel-Rote-Linsen-Brei": Object.freeze(["200 g Süßkartoffel, 50 g trockene rote Linsen, 300 ml Wasser", 6]),
  "Zucchini-Quinoa-Brei": Object.freeze(["150 g Zucchini, 50 g weißer Quinoa, 300 ml Wasser", 6]),
  "Kichererbsenmehl-Zucchini-Taler": Object.freeze(["50 g Kichererbsenmehl, 100 g fein geriebene Zucchini, 60 ml Wasser", 6]),
  "Bananen-Haferbrei mit Erdnussmus": Object.freeze(["15 g feine Haferflocken, 100 ml Wasser, 50 g reife Banane, 5 g glattes Erdnussmus", 6]),
  "Karotten-Hirse-Brei mit Tahin": Object.freeze(["15 g Hirseflocken, 100 ml Wasser, 60 g Karottenpüree, 3 g glattes Tahin", 6]),
  "Apfel-Hirse-Brei mit Mandelmus": Object.freeze(["15 g Hirseflocken, 100 ml Wasser, 60 g weich gegarter Apfel, 3 g weißes Mandelmus", 6]),
  "Apfel-Birnen-Kompott": Object.freeze(["150 g Apfel, 150 g Birne, 50 ml Wasser", 6]),
  "Karotte-Süßkartoffel-Brei": Object.freeze(["200 g Karotte, 200 g Süßkartoffel, 120 ml Wasser zum Pürieren", 6]),
  "Brokkoli-Kartoffel-Stampf": Object.freeze(["120 g Brokkoli, 180 g Kartoffel, 60 ml Wasser zum Lockern", 6]),
  "Karfiol-Kartoffel-Stampf": Object.freeze(["120 g Karfiol, 180 g Kartoffel, 60 ml Wasser zum Lockern", 6]),
  "Zucchini-Kartoffel-Brei": Object.freeze(["150 g Zucchini, 180 g Kartoffel, 50 ml Wasser zum Pürieren", 6]),
  "Erbsen-Kartoffel-Stampf": Object.freeze(["100 g Erbsen, 180 g Kartoffel, 80 ml Wasser zum Lockern", 6]),
  "Kürbis-Linsen-Suppe": Object.freeze(["300 g Kürbis, 50 g trockene rote Linsen, 500 ml Wasser", 7]),
  "Mildes Rote-Linsen-Dhal": Object.freeze(["80 g trockene rote Linsen, 300 ml Wasser, optional 0,5 g Kurkuma (etwa ¼ TL)", 6]),
  "Huhn-Karotte-Nudel-Topf": Object.freeze(["125 g Hühnerbrust, 30 g Karotte, 60 g trockene kleine Nudeln, 235 ml Wasser", 7]),
  "Huhn-Lauch-Kartoffel-Topf": Object.freeze(["120 g Hühnerbrust, 100 g Lauch, 200 g Kartoffel, 300 ml Wasser", 7]),
  "Huhn-Brokkoli-Reis": Object.freeze(["120 g Hühnerbrust, 100 g Brokkoli, 80 g Reis, 400 ml Wasser", 7]),
  "Rind-Gemüse-Bolognese": Object.freeze(["120 g mageres Rindfaschiertes, 100 g Karotte, 300 g Tomate, 150 ml Wasser", 7]),
  "Tomaten-Linsen-Sauce": Object.freeze(["300 g Tomate, 60 g trockene rote Linsen, 250 ml Wasser", 7]),
  "Brokkoli-Linsen-Pasta": Object.freeze(["120 g Brokkoli, 50 g trockene rote Linsen, 80 g trockene kleine Nudeln, 300 ml Wasser", 7]),
  "Gemüse-Pasta mit Zucchini und Tomate": Object.freeze(["150 g Zucchini, 200 g Tomate, 80 g trockene kleine Nudeln, 100 ml Wasser", 7]),
  "Lachs-Reis-Erbsen": Object.freeze(["80 g Lachs, 50 g Reis, 60 g Erbsen, 300 ml Wasser", 7]),
  "Lachs-Süßkartoffel-Stampf": Object.freeze(["80 g vollständig gegarter grätenfreier Lachs, 200 g sehr weiche Süßkartoffel", 7]),
  "Kabeljau-Tomaten-Gemüse": Object.freeze(["90 g Kabeljau, 120 g Tomate, 120 g Zucchini, 50 ml Wasser", 7]),
  "Weiches Rührei": Object.freeze(["1 Ei, 15 ml Wasser oder bereits eingeführte Vollmilch", 6]),
  "Eier-Finger": Object.freeze(["1 Ei", 6]),
  "Paprika-Omelettstreifen": Object.freeze(["1 Ei, 30 g sehr fein geschnittene weich gegarte Paprika", 6]),
  "Ei-Champignon-Cups": Object.freeze(["3 Eier, 75 g fein gehackte weich gegarte Champignons", 7]),
  "Hummus mit weichen Gemüsesticks": Object.freeze(["120 g sehr weiche Kichererbsen, optional 10 g Tahin, 45 ml Wasser, 150 g Gurke beziehungsweise Gemüsesticks in der jeweils hinterlegten sicheren Servierform", 6]),
  "Kürbis-Kichererbsen-Creme": Object.freeze(["200 g Kürbis, 120 g sehr weiche Kichererbsen, 100 ml Wasser", 6]),
  "Avocado-Bananen-Creme": Object.freeze(["70 g reife Avocado, 60 g reife Banane", 6]),
  "Buchweizen-Bananen-Pancakes": Object.freeze(["40 g Buchweizenflocken oder Buchweizenmehl, 60 g reife Banane, 1 Ei", 6]),
  "Süßkartoffel-Linsen-Taler": Object.freeze(["150 g Süßkartoffelpüree, 100 g sehr weich gekochte rote Linsen", 6]),
  "Tofu-Zucchini-Reis": Object.freeze(["120 g Naturtofu, 150 g Zucchini, 80 g Reis, 400 ml Wasser", 7]),
  "Gebackene Saba-Banane": Object.freeze(["1 reife Saba-Banane (etwa 120 g essbarer Anteil)", 6]),
  "Huhn-Lugaw": Object.freeze(["60 g Reis, 120 g Huhn, 480 ml Wasser, optional 1 g frischer Ingwer", 7]),
  "Sayote-Huhn-Reis": Object.freeze(["100 g Sayote, 100 g Huhn, 60 g Reis, 450 ml Wasser", 7]),
  "Monggo-Süßkartoffel-Brei": Object.freeze(["50 g trockene Mungbohnen, 250 g Süßkartoffel, 500 ml Wasser", 6]),
  "Ube-Hafer-Brei": Object.freeze(["200 g vollständig gegarte Ube, 40 g feine Haferflocken, 300 ml Wasser", 6]),
  "Obst-Joghurt": Object.freeze(["80 g pasteurisierter ungesüßter Naturjoghurt, 50 g weiches Obst nach Auswahl", 6]),
  "Obst-Hafer-Joghurt": Object.freeze(["20 g feine Haferflocken, 100 ml Wasser, 80 g Naturjoghurt, 50 g weiches Obst nach Auswahl", 6]),
  "Obst-Hirse-Joghurt": Object.freeze(["20 g Hirseflocken, 100 ml Wasser, 80 g Naturjoghurt, 50 g weiches Obst nach Auswahl", 6]),
  "Obst-Grieß-Joghurt": Object.freeze(["20 g feiner Weizengrieß, 100 ml Wasser, 80 g Naturjoghurt, 50 g weiches Obst nach Auswahl", 6]),
  "Buttermilch-Hafer-Obstbrei": Object.freeze(["20 g feine Haferflocken, 100 ml Wasser, 100 ml pasteurisierte ungesüßte Buttermilch, 50 g weiches Obst nach Auswahl", 6]),
  "Buttermilch-Hirse-Obstbrei": Object.freeze(["20 g Hirseflocken, 100 ml Wasser, 100 ml pasteurisierte ungesüßte Buttermilch, 50 g weiches Obst nach Auswahl", 6]),
  "Buttermilch-Grieß-Obstbrei": Object.freeze(["20 g feiner Weizengrieß, 100 ml Wasser, 100 ml pasteurisierte ungesüßte Buttermilch, 50 g weiches Obst nach Auswahl", 6]),
  "Joghurt-Nussmus-Miniportion": Object.freeze(["50 g Naturjoghurt, 3 g bereits erfolgreich eingeführtes glattes Nussmus", 6]),
  "Bananen-Joghurt-Hafer-Pancakes": Object.freeze(["60 g reife Banane, 30 g Naturjoghurt, 30 g feine Haferflocken, 1 Ei", 6]),
  "Obst-Joghurt-Hafer-Ofenbites": Object.freeze(["80 g Naturjoghurt, 50 g feine Haferflocken, 1 Ei, 80 g weiches Obst nach Auswahl", 7]),
  "Zucchini-Joghurt-Hafer-Bites": Object.freeze(["80 g fein geriebene Zucchini, 80 g Naturjoghurt, 50 g feine Haferflocken, 1 Ei", 7]),
  "Joghurt-Hafer-Waffeln": Object.freeze(["100 g Naturjoghurt, 60 g fein gemahlene Haferflocken, 1 Ei, 40 ml Wasser", 7]),
  "Weiche Joghurt-Fladen": Object.freeze(["100 g Naturjoghurt, 80 g Weizenmehl oder feiner Weizengrieß, 1 Ei", 7]),
  "Gemüse-Joghurt-Mini-Muffins": Object.freeze(["100 g Naturjoghurt, 80 g fein gemahlene Haferflocken, 1 Ei, 100 g sehr fein vorbereitetes weiches Gemüse nach Auswahl", 7]),
  "Huhn-Gemüse-Muffins": Object.freeze(["80 g vollständig gegartes fein zerkleinertes Huhn, 80 g sehr weich gegartes Gemüse nach Auswahl, 60 g fein gemahlene Haferflocken, 1 Ei", 7]),
  "Süßkartoffel-Linsen-Muffins": Object.freeze(["120 g Süßkartoffelpüree, 100 g sehr weich gekochte rote Linsen, 50 g fein gemahlene Haferflocken", 7]),
  "Fleisch-Gemüse-Bällchen": Object.freeze(["Rind-Variante: 100 g mageres Rindfaschiertes, 60 g Karottenpüree, 80 g sehr weiche Kartoffel; Puten-Variante: 100 g Putenfaschiertes, 120 g Süßkartoffelpüree", 7]),
  "Bohnen-Kartoffel-Stampf": Object.freeze(["200 g Kartoffel, 150 g sehr weich gegarte weiße oder schwarze Bohnen, 80 ml Wasser, optional 5 ml Rapsöl", 6]),
  "Bananen-Ei-Pancakes": Object.freeze(["1 sehr reife Banane (etwa 120 g essbarer Anteil), 1 Ei", 6]),
  "Huhn-Zucchini-Nockerl": Object.freeze(["60 g vollständig gegartes fein zerkleinertes Huhn, 80 g sehr weich gegarte und gut ausgedrückte Zucchini, 1 Ei, 45 g Weizenmehl oder feiner Weizengrieß, 5 ml Rapsöl, bei Bedarf bis zu 15 ml Wasser", 7]),
  "Rind-Karotten-Nockerl": Object.freeze(["60 g vollständig gegartes fein zerkleinertes Rind, 80 g sehr weich gegarte Karotte oder Karottenpüree, 1 Ei, 45 g Weizenmehl oder feiner Weizengrieß, 5 ml Rapsöl, bei Bedarf bis zu 15 ml Wasser", 7]),
  "Linsen-Süßkartoffel-Nockerl": Object.freeze(["100 g sehr weich gekochte rote Linsen, 100 g Süßkartoffelpüree, 1 Ei, 40 g Weizenmehl oder feiner Weizengrieß, 5 ml Rapsöl", 7]),
  "Pizza Wrap": Object.freeze(["2 Vollkorn-Wraps aus Weizen, 2 EL Tomatenmark, 2 EL Wasser, 30 g geriebener pasteurisierter Käse, 1 mittelgroßer Champignon und/oder ¼ Paprika und/oder etwa 2,5 cm Zucchini, 1 TL Olivenöl", 9]),
  "Chicken Fajita Wrap": Object.freeze(["1¼ rote Paprika, 1½ kleine Zwiebeln, ½ TL Paprikapulver, ¼ TL mildes Chilipulver, 1 kleine Knoblauchzehe, ½ TL gemahlener Kreuzkümmel, 2 TL Pflanzenöl, 2 kleine Hühnerbrustfilets, pro Portion ½ mittelgroßer Weizen-Tortilla-Wrap und ½ EL Naturjoghurt", 12]),
});

const RECIPE_NOCKERL_SPLIT = Object.freeze([
  Object.freeze({
    name: "Huhn-Zucchini-Nockerl",
    category: "family",
    requires: Object.freeze(["Huhn", "Zucchini", "Weizen", "Ei", "Rapsöl"]),
    stage: 3,
    batch: "12–16 kleine weiche Nockerl",
    note: "Huhn vollständig garen und sehr fein zerkleinern, Zucchini sehr weich garen und gut ausdrücken. Mit Ei, Weizen und Rapsöl zu einem weichen, nicht festen Teig verrühren. Kleine längliche Nockerl in siedendem Wasser vollständig garen. Vor dem Servieren ein Nockerl aufschneiden: es muss durchgegart, weich, nicht gummiartig und unter leichtem Druck gut zerdrückbar sein.",
    freezable: true,
    freezerNote: "Gegarte Nockerl einzeln vorfrieren, portionsweise verpacken und nach dem Auftauen vollständig erwärmen.",
    tags: Object.freeze(["Fingerfood", "Familiengericht", "einfrierbar"]),
    legacyNames: Object.freeze([]),
    searchAliases: Object.freeze([]),
    skillRequirement: "Nur vollständig durchgegart und sehr weich anbieten; ein aufgeschnittenes Nockerl darf nicht gummiartig oder kompakt-elastisch sein. Nur aufrecht sitzend und direkt beaufsichtigt anbieten.",
  }),
  Object.freeze({
    name: "Rind-Karotten-Nockerl",
    category: "family",
    requires: Object.freeze(["Rind", "Karotte", "Weizen", "Ei", "Rapsöl"]),
    stage: 3,
    batch: "12–16 kleine weiche Nockerl",
    note: "Rind vollständig garen und sehr fein zerkleinern, Karotte sehr weich garen und fein zerdrücken. Mit Ei, Weizen und Rapsöl zu einem weichen, nicht festen Teig verrühren. Kleine längliche Nockerl in siedendem Wasser vollständig garen. Vor dem Servieren ein Nockerl aufschneiden: es muss durchgegart, weich, nicht gummiartig und unter leichtem Druck gut zerdrückbar sein.",
    freezable: true,
    freezerNote: "Gegarte Nockerl einzeln vorfrieren, portionsweise verpacken und nach dem Auftauen vollständig erwärmen.",
    tags: Object.freeze(["Fingerfood", "Familiengericht", "einfrierbar"]),
    searchAliases: Object.freeze(["Rind-Karotten-Nockerl"]),
    skillRequirement: "Nur vollständig durchgegart und sehr weich anbieten; ein aufgeschnittenes Nockerl darf nicht gummiartig oder kompakt-elastisch sein. Nur aufrecht sitzend und direkt beaufsichtigt anbieten.",
  }),
  Object.freeze({
    name: "Linsen-Süßkartoffel-Nockerl",
    category: "family",
    requires: Object.freeze(["Rote Linsen", "Süßkartoffel", "Weizen", "Ei", "Rapsöl"]),
    stage: 3,
    batch: "12–16 kleine weiche Nockerl",
    note: "Linsen sehr weich kochen und Süßkartoffel vollständig weich garen. Beides fein zerdrücken und mit Ei, Weizen und Rapsöl nur so weit verrühren, dass ein weicher formbarer Teig entsteht. Kleine längliche Nockerl in siedendem Wasser vollständig garen. Vor dem Servieren ein Nockerl aufschneiden: es muss weich, nicht klebrig-gummiartig und unter leichtem Druck gut zerdrückbar sein.",
    freezable: true,
    freezerNote: "Gegarte Nockerl einzeln vorfrieren, portionsweise verpacken und nach dem Auftauen vollständig erwärmen.",
    tags: Object.freeze(["Fingerfood", "Familiengericht", "einfrierbar"]),
    searchAliases: Object.freeze(["Linsen-Süßkartoffel-Nockerl"]),
    skillRequirement: "Nur vollständig durchgegart und sehr weich anbieten; ein aufgeschnittenes Nockerl darf nicht klebrig-gummiartig oder kompakt-elastisch sein. Nur aufrecht sitzend und direkt beaufsichtigt anbieten.",
  }),
]);

function installRecipeResearchGuidance(recipes = typeof RECIPES !== "undefined" ? RECIPES : null) {
  if (!Array.isArray(recipes)) return false;
  let changed = false;

  let aggregateIndex = recipes.findIndex((recipe) => recipe?.name === "Gemüse-Fleisch-Nockerl");
  if (aggregateIndex >= 0) {
    recipes.splice(aggregateIndex, 1, ...RECIPE_NOCKERL_SPLIT.map((recipe) => ({ ...recipe })));
    changed = true;
  } else {
    let insertAt = recipes.findIndex((recipe) => recipe?.name === "Bohnen-Kartoffel-Stampf");
    if (insertAt < 0) insertAt = recipes.length;
    for (let recipe of [...RECIPE_NOCKERL_SPLIT].reverse()) {
      if (!recipes.some((item) => item?.name === recipe.name)) {
        recipes.splice(insertAt, 0, { ...recipe });
        changed = true;
      }
    }
  }

  for (let recipe of recipes) {
    let guidance = RECIPE_RESEARCH_GUIDANCE[recipe?.name];
    if (!guidance) continue;
    let [ingredients, recommendedMonths] = guidance;
    if (recipe.ingredients !== ingredients) {
      recipe.ingredients = ingredients;
      changed = true;
    }
    let hardMinimum = Number(recipe.hardMinMonths || 0);
    let recommendation = Math.max(hardMinimum, Number(recommendedMonths || 0));
    if (Number(recipe.minMonths || 0) !== recommendation) {
      recipe.minMonths = recommendation;
      changed = true;
    }
    recipe.quantityGuidanceRevision = "2026-08-22";
    recipe.ageGuidanceKind = "orientation";
  }

  return changed;
}

installRecipeCatalogAdditions();
installRecipeResearchGuidance();

function recipeStatesCore() {
  let stage = Number(state.settings.textureStage), age = monthsOld(today());
  let normalizedQuery = normalizeName(recipeQuery);
  return RECIPES.map((r) => {
    let sets = [r.requires || [], ...(r.alternatives || [])].filter((requirements, index) => requirements.length || index === 0);
    let evaluatedSets = sets.map((requirements, index) => ({
      requirements,
      index,
      label: r.variantLabels?.[index] || "",
      missing: requirements.filter((name) => !recipeIngredientReady(name)),
    }));
    let queryVariant = evaluatedSets.find((variant) => variant.label && normalizedQuery && normalizedQuery.includes(normalizeName(variant.label)));
    if (!queryVariant && normalizedQuery && r.legacyNames?.length === evaluatedSets.length) {
      let legacyIndex = r.legacyNames.findIndex((name) => normalizedQuery.includes(normalizeName(name)));
      if (legacyIndex >= 0) queryVariant = evaluatedSets[legacyIndex];
    }
    let best = queryVariant || evaluatedSets.sort((a, b) => a.missing.length - b.missing.length || a.index - b.index)[0] || { requirements: [], missing: [], index: 0, label: "" };
    let ingredientMissing = [...best.missing];
    let availableOptions = (r.oneOf || []).filter(recipeIngredientReady);
    if (r.oneOf?.length && !availableOptions.length) ingredientMissing.push(`eine passende Auswahl: ${r.oneOf.join(", ")}`);
    let availableMilkOptions = (r.milkChoices || []).filter(recipeIngredientReady);
    if (r.milkChoices?.length && !availableMilkOptions.length) ingredientMissing.push(`ein bekanntes Milchprodukt: ${r.milkChoices.join(", ")}`);
    let requirementMissing = [];
    if (stage < Number(r.stage || 1)) requirementMissing.push(`Konsistenz: ${textureName(r.stage)}`);
    if (r.hardMinMonths && age < Number(r.hardMinMonths)) requirementMissing.push(`Alter: frühestens ab etwa ${r.hardMinMonths} Monaten`);
    let missing = [...ingredientMissing, ...requirementMissing];
    let queryOption = (r.oneOf || []).find((name) => normalizedQuery && normalizedQuery.includes(normalizeName(name))) || "";
    if (!queryOption && normalizedQuery && r.legacyNames?.length) {
      queryOption = (r.oneOf || []).find((option) => r.legacyNames.some((legacy) => normalizedQuery.includes(normalizeName(legacy)) && normalizeName(legacy).includes(normalizeName(option)))) || "";
    }
    let selectedOption = queryOption || availableOptions[0] || "";
    let queryMilkOption = (r.milkChoices || []).find((name) => normalizedQuery && normalizedQuery.includes(normalizeName(name))) || "";
    let selectedMilkOption = queryMilkOption || availableMilkOptions[0] || "";
    return {
      ...r,
      missing,
      ingredientMissing,
      requirementMissing,
      availableOptions,
      availableMilkOptions,
      selectedOption,
      selectedFromQuery: !!queryOption,
      selectedOptionReady: selectedOption ? recipeIngredientReady(selectedOption) : false,
      selectedMilkOption,
      selectedMilkFromQuery: !!queryMilkOption,
      selectedMilkOptionReady: selectedMilkOption ? recipeIngredientReady(selectedMilkOption) : false,
      selectedVariantIndex: best.index,
      selectedVariantLabel: best.label,
      selectedVariantRequirements: best.requirements,
      unlocked: missing.length === 0,
      almost: missing.length > 0 && missing.length <= 2,
    };
  });
}

function findPlannedFood(foodId, days = 21) {
  return buildDays(today(), days)
    .flatMap((day) => day.meals.map((meal) => ({ day, meal })))
    .find(({ meal }) => (meal.foodIds || []).includes(foodId));
}

function scheduleAllergen(foodId, date, requestedMeal = "lunch") {
  let f = food(foodId);
  if (!f) return false;
  let mealCandidates = [...new Set([requestedMeal, "lunch", "breakfast", "dinner"])].filter((meal) => f.meals.includes(meal));
  let selection = mealCandidates.map((meal) => ({ meal, base: knownBase(meal, [f.id]) })).find((item) => item.base);
  if (!selection) {
    let error = document.getElementById("allergenScheduleError");
    if (error) {
      error.textContent = "Für dieses Allergen ist noch keine verträgliche Basis verfügbar. Bitte zuerst eine passende Basis zweimal problemlos essen lassen.";
      error.style.display = "block";
    }
    return false;
  }
  let { meal, base } = selection;
  let previous = findPlannedFood(foodId);
  if (previous && previous.day.date !== date) {
    let oldKey = planLockKey(previous.day.date, previous.meal.meal);
    if (state.overrides?.[oldKey] === foodId) delete state.overrides[oldKey];
    delete state.planLocks?.[oldKey];
    state.deferred[previous.day.date] = true;
  }
  for (let [key, value] of Object.entries(state.overrides || {})) if (value === foodId && key !== `${date}|${meal}`) delete state.overrides[key];
  let key = `${date}|${meal}`;
  delete state.planLocks?.[key];
  state.autoLockExcluded ||= {};
  state.autoLockExcluded[key] = true;
  if (!activeMeal(meal, date) && meal !== "lunch") {
    state.manualMeals ||= {};
    state.manualMeals[key] = {
      date,
      meal,
      focusId: f.id,
      foodIds: [base.id, f.id],
      baseFoodIds: [base.id],
      sampleFoodIds: [f.id],
      optionalAddons: [],
      recipeName: "",
      recipeInventoryId: "",
      milkMeal: isMilkProductFood(f) ? "small" : "",
      type: rank(f) >= 2 ? "Allergen wiederholen" : "Allergen einführen",
      note: `Allergen bewusst mit der verträglichen Basis ${base.name} eingeplant.`,
      manualAdded: true,
      createdAt: new Date().toISOString(),
    };
    state.planLocks[key] = mealSnapshot(date, meal, { ...state.manualMeals[key], active: true }, "manual");
  } else {
    state.overrides[key] = f.id;
  }
  state.deferred[date] = false;
  save(); closeGeneric(); renderAll();
  let moved = meal !== requestedMeal ? ` · wegen der verfügbaren Basis als ${mealName(meal)} geplant` : "";
  showToast(`${f.name} für ${date === addDays(today(), 1) ? "morgen" : shortDate(date)} eingeplant${moved}.`);
  return true;
}

function openAllergenSchedule(foodId) {
  let f = food(foodId);
  if (!f) return;
  let planned = findPlannedFood(foodId);
  let defaultDate = planned?.day.date || addDays(today(), 1);
  let defaultMeal = planned?.meal.meal || "lunch";
  openGeneric(
    `${f.name} einplanen`,
    `<div class="grid2">
      <div class="field"><label>Datum</label><input type="date" id="allergenDate" min="${today()}" value="${defaultDate}"></div>
      <div class="field"><label>Mahlzeit</label><select id="allergenMeal"><option value="lunch" ${defaultMeal === "lunch" ? "selected" : ""}>Mittag</option><option value="breakfast" ${defaultMeal === "breakfast" ? "selected" : ""}>Frühstück</option><option value="dinner" ${defaultMeal === "dinner" ? "selected" : ""}>Abendessen</option></select></div>
     </div>
     <div class="notice warn" id="allergenScheduleError" style="display:none"></div>
     <div class="sticky-form-actions ds-actionbar"><button class="btn secondary" id="cancelAllergenDate" type="button">Abbrechen</button><button class="btn" id="saveAllergenDate">${planned ? "Planung ändern" : "Einplanen"}</button></div>`,
  );
  document.getElementById("cancelAllergenDate").onclick = closeGeneric;
  document.getElementById("saveAllergenDate").onclick = () =>
    scheduleAllergen(
      f.id,
      document.getElementById("allergenDate").value,
      document.getElementById("allergenMeal").value,
    );
}

function renderAllergenModule() {
  let on=today();
  let allergenFoods=state.foods.filter((f)=>f.active&&f.allergenGroup).sort((a,b)=>a.allergenGroup.localeCompare(b.allergenGroup,"de")||a.priority-b.priority);
  let groups=[...new Set(allergenFoods.map((f)=>f.allergenGroup))];
  let next=allergenFoods.filter((f)=>dueAllergen(f,on)||rank(f)===0).slice(0,3);
  let card=(f)=>{ let due=dueAllergen(f,on), stateText=status(f), action=due?"Jetzt wiederholen":rank(f)===0?"Einführen":stateText; return `<div class="allergen-row"><div class="grow"><b>${esc(f.name)}</b><div class="small">${esc(f.allergenGroup)} · ${esc(stateText)}</div></div><button class="btn secondary smallbtn planAllergen" data-food="${f.id}">${esc(action)}</button></div>`; };
  document.getElementById("allergenModule").innerHTML=`<div class="allergen-overview"><span class="pill ${next.length?"warn":"ok"}">${next.length?`${next.length} nächste Schritte`:"Aktuell nichts fällig"}</span></div>${next.length?next.map(card).join(""):'<div class="empty">Keine Einführung oder Wiederholung fällig.</div>'}<details class="all-allergens"><summary>Alle Allergene · ${groups.length} Gruppen</summary><div class="allergen-group-list">${groups.map((group)=>`<div class="allergen-group"><b>${esc(group)}</b>${allergenFoods.filter((f)=>f.allergenGroup===group).map(card).join("")}</div>`).join("")}</div></details>`;
  document.querySelectorAll(".planAllergen").forEach((button)=>button.onclick=()=>openAllergenSchedule(button.dataset.food));
}

function recipeStates() {
  return recipeStatesCore().map((recipe) => {
    let hintParts = [];
    if (recipe.hardMinMonths) hintParts.push(`Frühestens ab etwa ${recipe.hardMinMonths} Monaten`);
    if (recipe.minMonths && Number(recipe.minMonths) > Number(recipe.hardMinMonths || 0)) hintParts.push(`Orientierung ab etwa ${recipe.minMonths} Monaten`);
    return { ...recipe, ageHint: hintParts.join(" · ") };
  });
}
function renderRecipeCard(r) {
  let optionParts = [];
  if (r.selectedVariantLabel) optionParts.push(`<div><b>Variante:</b> ${esc(r.selectedVariantLabel)}${(r.selectedVariantRequirements || []).every(recipeIngredientReady) ? "" : " · noch offen"}</div>`);
  if (r.selectedOption || r.availableOptions?.length) optionParts.push(`<div><b>${r.oneOf?.length && r.name === "Milch-Getreide-Brei" ? "Getreide" : r.selectedOption ? "Vorausgewählt" : "Jetzt mögliche Auswahl"}:</b> ${r.selectedOption ? `${esc(r.selectedOption)}${r.selectedOptionReady ? "" : " · noch offen"}` : r.availableOptions.map(esc).join(", ")}</div>`);
  if (r.milkChoices?.length) optionParts.push(`<div><b>Milchprodukt:</b> ${r.selectedMilkOption ? `${esc(r.selectedMilkOption)}${r.selectedMilkOptionReady ? "" : " · noch offen"}` : "noch keines gegessen"}</div>`);
  let variants = optionParts.length ? optionParts.join("") : '<div class="small">Keine zusätzliche Variante nötig.</div>';
  let type = ({
    porridge: "Brei & Löffelgericht",
    pancakes: "Pancake",
    balls: "Fingerfood",
    family: "Familiengericht",
    philippines: "Philippinen-Rezept",
    baking: "Backrezept",
  })[r.category] || ((r.tags || []).some((tag) => /fingerfood/i.test(String(tag))) ? "Fingerfood" : "Rezept");
  let statusBadge = !r.unlocked
    ? '<span class="pill warn">Noch nicht passend</span>'
    : r.freezable
      ? '<span class="pill ok">Einfrierbar</span>'
      : "";
  let familyText = r.familyLabel ? ` · ${esc(r.familyLabel)}` : "";
  let importantHints = `${r.skillRequirement ? `<div class="notice"><b>Sicher anbieten:</b> ${esc(r.skillRequirement)}</div>` : ""}${r.unlocked ? "" : `<div class="recipe-missing"><b>Noch offen:</b> ${esc(recipeMissingSummary(r))}</div>`}${r.milkMeal === "full" ? '<div class="notice olive"><b>Milchmahlzeit:</b> Als volle Milchmahlzeit zählen; keine zweite volle Milchmahlzeit am selben Tag einplanen und nicht mit Fleisch oder Fisch kombinieren.</div>' : ""}`;
  let hints = `${r.ageHint ? `<div class="small recipe-age-hint">${esc(r.ageHint)}</div>` : ""}${r.milkMeal === "small" ? '<div class="small">Kleine Milchproduktmenge; sie zählt nicht automatisch als volle Milchmahlzeit.</div>' : ""}` || '<div class="small">Keine zusätzlichen Hinweise.</div>';
  let storage = r.freezable
    ? `<div class="small">${esc(r.freezerNote || "Portionsweise einfrieren und vollständig auftauen beziehungsweise erwärmen.")}</div><button class="btn secondary full" style="margin-top:9px" data-add-recipe-stock="${encodeURIComponent(r.name)}">Als Vorrat eintragen</button>`
    : '<div class="small">Am besten frisch zubereiten.</div>';
  return `<details class="recipe-card-v2">
    <summary>
      <div class="recipe-summary-grid">
        <div class="recipe-heading-with-icon">${recipeIconSvg(r)}<div><b>${esc(r.name)}</b><div class="small recipe-type-text">${esc(type)}</div><div class="tiny recipe-tech-text">${esc(r.batch || "kleine Portion")}${familyText}</div></div></div>
        <div class="recipe-summary-end">${statusBadge}<span class="recipe-chevron" aria-hidden="true">⌄</span></div>
      </div>
    </summary>
    <div class="recipe-body-v2">
      <section class="recipe-open-section"><h3>Zutaten</h3><p class="small">${esc(r.ingredients || (r.requires || []).join(", "))}</p></section>
      <section class="recipe-open-section"><h3>Zubereitung</h3><p class="small">${esc(r.note)}</p></section>
      ${importantHints}
      <details class="recipe-subsection"><summary>Varianten</summary><div class="recipe-subsection-body recipe-option-list">${variants}</div></details>
      <details class="recipe-subsection"><summary>Aufbewahrung</summary><div class="recipe-subsection-body">${storage}</div></details>
      <details class="recipe-subsection"><summary>Hinweise</summary><div class="recipe-subsection-body">${hints}</div></details>
    </div>
  </details>`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    RECIPE_CATALOG_ADDITIONS,
    RECIPE_RESEARCH_GUIDANCE,
    RECIPE_NOCKERL_SPLIT,
    installRecipeCatalogAdditions,
    installRecipeResearchGuidance,
  };
}