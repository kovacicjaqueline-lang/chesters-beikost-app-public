"use strict";

/*
 * Gegen Audit 2026-09-17 vervollständigte Zubereitungstexte.
 * Ausschließlich bestehende Rezeptschritte werden präzisiert; Mengen, Stufen,
 * Alters-/Safety-Gates und Rezeptauswahl bleiben unverändert.
 */
const RECIPE_PREPARATION_OVERRIDES = Object.freeze({
  "Birne-Hirse-Pancakes": "Birne sehr fein zerdrücken und mit dem bereits weich gekochten Hirsebrei sowie dem Ei zu einem gleichmäßigen Teig verrühren. Kleine flache Pancakes formen und bei niedriger Hitze vollständig, aber weich durchgaren. Keine harte oder stark gebräunte Kruste entstehen lassen.",
  "Rind-Hafer-Bällchen": "Faschiertes mit Haferflocken und Ei gleichmäßig vermengen. Kleine längliche oder flache Stücke statt fester runder Kugeln formen und vollständig durchgaren. Saftig halten und keine harte Kruste entstehen lassen.",
  "Geflügel-Gemüse-Hafer-Bällchen": "Geflügelfaschiertes mit dem sehr fein vorbereiteten Gemüse und Hafer gleichmäßig vermengen. Kleine flache oder längliche Stücke statt fester runder Kugeln formen, vollständig durchgaren, saftig halten und vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
  "Rote-Linsen-Gemüsebällchen": "Sehr weich gekochte rote Linsen mit Karottenpüree und Haferflocken zu einer weichen Masse vermengen. Flache Stücke formen und vollständig garen; nicht trocken, krümelig oder hart werden lassen.",
  "Tofu-Brokkoli-Bällchen": "Naturtofu fein zerdrücken und mit sehr weichem, fein zerkleinertem Brokkoli sowie Haferflocken vermengen. Flache Stücke formen und vollständig erhitzen; weich und leicht zerdrückbar servieren.",
  "Zucchini-Hafer-Puffer": "Geriebene Zucchini gut ausdrücken und mit Haferflocken und Ei zu einer gleichmäßigen Masse verrühren. Kleine dünne Puffer formen und vollständig, aber weich durchgaren; keine knusprige harte Kante entstehen lassen.",
  "Polenta-Zucchini-Sticks": "Polenta mit Wasser weich und dick kochen. Die fein gegarte Zucchini unterrühren, die Masse flach ausstreichen und vollständig auskühlen beziehungsweise fest werden lassen. In breite gut greifbare Sticks schneiden, weich servieren und eine harte oder trockene Kruste vermeiden.",
  "Zucchini-Omelett": "Ei mit der fein geriebenen Zucchini verrühren und die Mischung bei niedriger Hitze vollständig stocken lassen. Das Omelett weich halten und in breite Streifen oder passende kleine Stücke schneiden.",
  "Kürbis-Hafer-Brei": "Kürbis vollständig weich garen und zu Püree zerdrücken. Hafer mit Wasser weich kochen und mit dem Kürbispüree zu einer gleichmäßigen, löffelbaren Konsistenz verrühren. Ohne Salz anbieten; Rapsöl kann nach dem Erwärmen optional ergänzt werden.",
  "Gemüse-Nudel-Sauce": "Zucchini sehr weich garen und mit der geschälten gegarten Tomate zu einer feinen, saftigen Sauce pürieren oder zerdrücken. Nudeln separat sehr weich kochen, passend klein schneiden und mit der Sauce vermengen. Ohne Salz und Zucker zubereiten.",
  "Baby-Linsen-Bolognese": "Rote Linsen mit Wasser sehr weich kochen. Gegarte Tomate fein zerdrücken oder pürieren und mit den Linsen zu einer saftigen Sauce köcheln. Nudeln separat sehr weich garen, passend klein schneiden und mit der Sauce vermengen. Ohne Salz zubereiten.",
  "Bangus-Kartoffel-Taler": "Bangus vollständig garen und äußerst sorgfältig von allen feinen Gräten befreien. Mit der sehr weichen Kartoffel fein zerdrücken und vermengen, kleine flache Taler formen und nur so weit erwärmen oder backen, dass sie zusammenhalten und weich bleiben.",
  "Obst-Hafer-Muffins": "Weiches Obst fein zerdrücken oder pürieren und mit fein gemahlenem Hafer sowie Ei zu einem gleichmäßigen Teig verrühren. In kleine Formen füllen und ohne Zucker oder Salz vollständig backen, innen saftig halten und keine harte Kruste entstehen lassen. Vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
  "Gemüse-Hafer-Muffins": "Das gewählte Gemüse sehr weich garen und sehr fein vorbereiten. Mit fein gemahlenem Hafer und Ei zu einem gleichmäßigen Teig verrühren, in kleine Formen füllen und ohne Salz vollständig backen. Innen saftig halten, keine harte Kruste entstehen lassen und vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
  "Kürbis-Hirse-Muffins": "Kürbispüree mit Hirseflocken und Ei zu einem gleichmäßigen, feuchten Teig verrühren. In kleine Formen füllen und vollständig, aber weich backen. Vor dem Servieren auf eine saftige, leicht zerdrückbare Konsistenz prüfen.",
  "Bananen-Haferbrei mit Erdnussmus": "Hafer mit Wasser weich kochen. Banane fein zerdrücken und unter den fertigen Brei rühren. Nur nach sicherer Einführung von Erdnuss wenig glattes Erdnussmus vollständig und dünn in die fertige Portion einrühren.",
  "Karotten-Hirse-Brei mit Tahin": "Hirse mit Wasser weich kochen und mit sehr weich gegarter, fein zerdrückter Karotte zu einem glatten Brei verrühren. Nur nach sicherer Einführung von Sesam wenig glattes Tahin vollständig und sparsam in die servierte Portion einrühren.",
  "Apfel-Hirse-Brei mit Mandelmus": "Hirse mit Wasser weich kochen und den weich gegarten Apfel fein zerdrücken oder pürieren und unterrühren. Nur nach sicherer Einführung von Mandel wenig weißes Mandelmus vollständig und glatt in die fertige Portion einrühren.",
  "Paprika-Omelettstreifen": "Die weich gegarte Paprika sehr fein schneiden und mit dem Ei verrühren. Das Omelett vollständig durchgaren, weich halten und in breite gut greifbare Streifen schneiden.",
  "Ei-Champignon-Cups": "Champignons weich garen, fein hacken und mit dem Ei verrühren. Die Mischung in kleine Formen füllen und vollständig durchbacken. Für Babys weich und ohne Salz zubereiten und vor dem Servieren auf eine leicht zerdrückbare Konsistenz prüfen.",

  "Zucchini-Hafer-Pancakes": "Geriebene Zucchini gut ausdrücken und mit Haferflocken und Ei zu einem gleichmäßigen Teig verrühren. Kleine dünne Pancakes bei niedriger Hitze vollständig, aber weich durchgaren und passend zuschneiden; keine harte Kruste entstehen lassen.",
  "Ube-Bananen-Pancakes": "Ube vollständig weich garen und fein zerdrücken. Banane zerdrücken, mit Ube, Haferflocken und Ei zu einem gleichmäßigen Teig verrühren und kleine flache Pancakes vollständig, aber weich durchbacken.",
  "Lachs-Kartoffel-Bällchen": "Lachs vollständig garen und sehr sorgfältig auf Gräten prüfen. Mit der sehr weichen Kartoffel fein zerdrücken, zu kleinen flachen Talern formen und nur so weit erwärmen oder backen, dass sie zusammenhalten und weich bleiben.",
  "Brokkoli-Kartoffel-Taler": "Brokkoli und Kartoffel vollständig weich garen und gemeinsam fein zerdrücken. Kleine flache Taler formen und nur leicht erwärmen oder weich backen, sodass sie zusammenhalten und sich weiterhin leicht zerdrücken lassen.",
  "Kichererbsen-Kürbis-Taler": "Sehr weiche Kichererbsen fein zerdrücken und mit Kürbispüree zu einer weichen Masse vermengen. Bei Bedarf nur nach Einführung etwas Hafer als Binder einarbeiten. Kleine flache Taler formen und weich garen; nicht trocken oder hart werden lassen.",
  "Rote-Linsen-Bratlinge": "Sehr weich gekochte rote Linsen fein zerdrücken und mit Haferflocken zu einer weichen, formbaren Masse vermengen. Kleine flache Taler formen und vollständig garen; weich und saftig statt trocken anbieten.",
  "Süßkartoffel-Hirse-Sticks": "Süßkartoffel vollständig weich garen und zu Püree zerdrücken. Mit der sehr weich gekochten Hirse vermengen, längliche Sticks formen und sanft garen beziehungsweise erwärmen, bis sie zusammenhalten. Vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
  "Omelettstreifen": "Ei mit dem Wasser verrühren und bei niedriger Hitze vollständig stocken lassen. Das Omelett weich halten und in breite, gut greifbare Streifen schneiden.",
  "Obst-Hirsebrei": "Hirseflocken mit Wasser unter Rühren weich kochen. Eine bekannte weiche Obstsorte fein zerdrücken oder pürieren und erst anschließend unter den fertigen Brei rühren.",
  "Obst-Polentabrei": "Polenta mit Wasser unter Rühren glatt und weich kochen. Eine bekannte weiche Obstsorte fein zerdrücken oder pürieren und anschließend unter den fertigen Brei rühren.",
  "Obst-Reisbrei": "Reis oder Reisflocken mit Wasser sehr weich kochen. Je nach Konsistenzstufe fein pürieren oder zerdrücken und eine bekannte weiche Obstsorte fein vorbereitet unterrühren.",
  "Obst-Buchweizenbrei": "Buchweizenflocken mit Wasser weich kochen beziehungsweise ganzen Buchweizen sehr weich garen. Je nach Konsistenzstufe fein pürieren oder zerdrücken und eine bekannte weiche Obstsorte unterrühren.",
  "Obst-Grießbrei": "Weizengrieß mit Wasser unter Rühren glatt und weich kochen. Eine bekannte weiche Obstsorte fein zerdrücken oder pürieren und erst danach unter den fertigen Brei rühren.",
  "Lugaw-Basis": "Reis mit viel Wasser sehr weich und breiig kochen. Huhn separat vollständig durchgaren, sehr fein zerkleinern und unter den Reisbrei rühren. Babyportion ohne Salz, Brühewürfel oder Fischsauce anbieten.",
  "Kürbis-Lugaw": "Reis mit Wasser sehr weich und breiig kochen. Kürbis vollständig weich garen, fein zerdrücken und unter den Reisbrei rühren. Je nach aktueller Konsistenzstufe zusätzlich pürieren oder grob zerdrücken.",
  "Tinola-inspiriert": "Huhn vollständig durchgaren. Sayote sehr weich garen, Malunggay fein zerkleinern und gegen Ende kurz mitgaren. Alles mit Wasser zu einer weichen, milden Mischung verbinden und passend zur Konsistenzstufe zerkleinern. Babyportion ohne Salz, Brühewürfel und Fischsauce anbieten.",
  "Arroz-caldo-inspiriert": "Reis mit Wasser sehr weich und breiig kochen. Huhn vollständig durchgaren, fein zerkleinern und mit der sehr kleinen Menge Ingwer unter den Reisbrei rühren. Sehr mild halten und ohne Salz oder Fertigbrühe anbieten.",
  "Kalabasa mit Kokos": "Kürbis mit Wasser vollständig weich garen und fein zerdrücken. Ungesüßte Kokosmilch einrühren und kurz sanft erwärmen, bis eine weiche, löffelbare Konsistenz entsteht. Kokosmilch als Zutat und nicht als Getränk verwenden.",
  "Tilapia-Reis-Brei": "Reis mit Wasser sehr weich und breiig kochen. Tilapia vollständig garen, sorgfältig auf Gräten prüfen, fein zerpflücken und unter den Reis rühren. Je nach Konsistenzstufe fein zerdrücken oder pürieren.",
  "Kürbis-Linsen-Suppe": "Rote Linsen und Kürbis mit Wasser sehr weich köcheln, bis beides vollständig zerfällt. Nach Konsistenzstufe fein pürieren oder grob zerdrücken; optional nur bereits bekannte milde Kräuter verwenden. Ohne Salz kochen.",
  "Mildes Rote-Linsen-Dhal": "Rote Linsen mit Wasser sehr weich und cremig kochen und dabei regelmäßig umrühren. Optional nur wenig bereits eingeführte Kurkuma einrühren. Für Babys mild halten, ohne Salz zubereiten und bei Bedarf mit Wasser auf eine löffelbare Konsistenz verdünnen.",
  "Huhn-Karotte-Nudel-Topf": "Huhn vollständig durchgaren und fein zerkleinern. Karotte sehr weich garen und kleine Nudeln sehr weich kochen. Alles mit etwas Kochwasser zu einer saftigen, weichen Mischung verbinden und passend zur Konsistenzstufe weiter zerkleinern.",
  "Huhn-Lauch-Kartoffel-Topf": "Huhn vollständig durchgaren und fein zerkleinern. Lauch und Kartoffel mit Wasser vollständig weich garen. Alles zu einer weichen, saftigen Mischung vermengen und je nach Konsistenzstufe zerdrücken oder klein schneiden.",
});

function installRecipePreparationOverrides(recipes = typeof RECIPES !== "undefined" ? RECIPES : null) {
  if (!Array.isArray(recipes)) return false;
  let changed = false;
  for (const recipe of recipes) {
    const note = RECIPE_PREPARATION_OVERRIDES[recipe?.name];
    if (!note || recipe.note === note) continue;
    recipe.note = note;
    changed = true;
  }

  const monggo = recipes.find((recipe) => recipe?.name === "Monggo-Kalabasa-Brei");
  if (monggo) {
    const note = "Mungbohnen mit Wasser sehr weich kochen. Kürbis vollständig weich garen, beides fein pürieren oder zerdrücken und zu einem löffelbaren Brei vermengen.";
    if (monggo.note !== note) {
      monggo.note = note;
      changed = true;
    }
  }
  return changed;
}
