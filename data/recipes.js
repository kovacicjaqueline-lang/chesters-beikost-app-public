"use strict";

/* Rezeptdaten – Version 10.0.0 konsolidiert
 * 101 kanonische Rezeptkarten; alle 108 historischen Namen bleiben über Aliase migrationssicher auffindbar.
 * Elf vorsichtig zusammengeführte Familien, individuelle Alters- und Sicherheitsprüfung.
 */

const RECIPE_DATA_REVISION = "10.0.0";

const RECIPES = [
  {
    "name": "Obst-Hafer-Pancakes",
    "category": "pancakes",
    "requires": [
      "Hafer",
      "Ei"
    ],
    "stage": 2,
    "batch": "4–6 Mini-Pancakes",
    "ingredients": "feine Haferflocken, Ei und eine sehr weiche bekannte Obstsorte nach Auswahl",
    "note": "Obst fein zerdrücken, mit Hafer und Ei zu einem dicken Teig mischen und kleine flache Pancakes bei niedriger Hitze vollständig, aber weich durchgaren. Keine harte oder stark gebräunte Kruste.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "oneOf": [
      "Banane",
      "Apfel",
      "Mango"
    ],
    "legacyNames": [
      "Banane-Hafer-Pancakes",
      "Apfel-Hafer-Pancakes",
      "Mango-Hafer-Pancakes"
    ],
    "searchAliases": [
      "Banane-Hafer-Pancakes",
      "Apfel-Hafer-Pancakes",
      "Mango-Hafer-Pancakes"
    ],
    "family": true,
    "familyLabel": "3 Obstvarianten",
    "variantLabels": [
      "Banane",
      "Apfel",
      "Mango"
    ],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Birne-Hirse-Pancakes",
    "category": "pancakes",
    "requires": [
      "Birne",
      "Hirse",
      "Ei"
    ],
    "stage": 2,
    "batch": "4–6 Mini-Pancakes",
    "ingredients": "2 EL weiche Birne, 2 EL gekochter Hirsebrei, 1 Ei",
    "note": "Birne sehr fein zerdrücken und mit dem bereits weich gekochten Hirsebrei sowie dem Ei zu einem gleichmäßigen Teig verrühren. Kleine flache Pancakes formen und bei niedriger Hitze vollständig, aber weich durchgaren. Keine harte oder stark gebräunte Kruste entstehen lassen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Gemüse-Hafer-Pancakes",
    "category": "pancakes",
    "requires": [
      "Hafer",
      "Ei"
    ],
    "stage": 2,
    "batch": "4–6 Mini-Pancakes",
    "ingredients": "feine Haferflocken, Ei und sehr weich gegartes Gemüse nach Auswahl",
    "note": "Gemüse fein zerdrücken, mit Hafer und Ei mischen und kleine flache Pancakes vollständig, aber weich durchgaren. Keine harte Kruste.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "oneOf": [
      "Kürbis",
      "Süßkartoffel"
    ],
    "legacyNames": [
      "Kürbis-Hafer-Pancakes",
      "Süßkartoffel-Pancakes"
    ],
    "searchAliases": [
      "Kürbis-Hafer-Pancakes",
      "Süßkartoffel-Pancakes"
    ],
    "family": true,
    "familyLabel": "2 Gemüsevarianten",
    "variantLabels": [
      "Kürbis",
      "Süßkartoffel"
    ],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Zucchini-Hafer-Pancakes",
    "category": "pancakes",
    "requires": [
      "Zucchini",
      "Hafer",
      "Ei"
    ],
    "stage": 3,
    "batch": "4–6 Mini-Pancakes",
    "ingredients": "2 EL fein geriebene, ausgedrückte Zucchini, 2 EL Haferflocken, 1 Ei",
    "note": "Geriebene Zucchini gut ausdrücken und mit Haferflocken und Ei zu einem gleichmäßigen Teig verrühren. Kleine dünne Pancakes bei niedriger Hitze vollständig, aber weich durchgaren und passend zuschneiden; keine harte Kruste entstehen lassen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Ube-Bananen-Pancakes",
    "category": "pancakes",
    "ph": true,
    "requires": [
      "Ube (violette Yamswurzel)",
      "Banane",
      "Hafer",
      "Ei"
    ],
    "stage": 3,
    "batch": "4–6 Mini-Pancakes",
    "ingredients": "2 EL vollständig gegarte Ube, ¼ Banane, 2 EL Haferflocken, 1 Ei",
    "note": "Ube vollständig weich garen und fein zerdrücken. Banane zerdrücken, mit Ube, Haferflocken und Ei zu einem gleichmäßigen Teig verrühren und kleine flache Pancakes vollständig, aber weich durchbacken.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Rind-Hafer-Bällchen",
    "category": "balls",
    "requires": [
      "Rind",
      "Hafer",
      "Ei"
    ],
    "stage": 3,
    "batch": "8–10 kleine weiche Stücke",
    "ingredients": "100 g Faschiertes vom Rind, 2 EL feine Haferflocken, 1 Ei, 1–2 EL mild gegarte fein gehackte Zwiebel, 1 TL Petersilie",
    "note": "Zwiebel in wenig Wasser oder Öl mild weich dünsten. Faschiertes mit Haferflocken, Ei, Zwiebel und Petersilie gleichmäßig vermengen. Kleine längliche oder flache Stücke statt fester runder Kugeln formen und vollständig durchgaren. Saftig halten und keine harte Kruste entstehen lassen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Geflügel-Gemüse-Hafer-Bällchen",
    "category": "balls",
    "requires": [
      "Huhn",
      "Zucchini",
      "Hafer"
    ],
    "stage": 3,
    "batch": "8–10 kleine weiche Stücke",
    "ingredients": "Geflügelfaschiertes, sehr fein vorbereitetes Gemüse und Hafer nach Variante, 1–2 EL mild gegarte Zwiebel, 1 TL Petersilie",
    "note": "Zwiebel mild weich dünsten. Geflügelfaschiertes mit dem sehr fein vorbereiteten Gemüse, Hafer, Zwiebel und Petersilie gleichmäßig vermengen. Kleine flache oder längliche Stücke statt fester runder Kugeln formen, vollständig durchgaren, saftig halten und vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "alternatives": [
      [
        "Pute",
        "Karotte",
        "Hafer"
      ]
    ],
    "legacyNames": [
      "Huhn-Zucchini-Hafer-Bällchen",
      "Pute-Karotten-Bällchen"
    ],
    "searchAliases": [
      "Huhn-Zucchini-Hafer-Bällchen",
      "Pute-Karotten-Bällchen"
    ],
    "family": true,
    "familyLabel": "2 Geflügelvarianten",
    "variantLabels": [
      "Huhn + Zucchini",
      "Pute + Karotte"
    ],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Lachs-Kartoffel-Bällchen",
    "category": "balls",
    "requires": [
      "Lachs",
      "Kartoffel"
    ],
    "stage": 3,
    "batch": "6–8 flache Taler",
    "ingredients": "50 g vollständig gegarter, grätenfreier Lachs, 100 g weiche Kartoffel, 1 TL Butter, 1 TL fein gehackter Dill oder Petersilie",
    "note": "Lachs sehr sorgfältig entgräten und mit der weichen Kartoffel, Butter und Dill oder Petersilie zerdrücken. Flach formen und nur weich erwärmen oder backen; die Taler saftig halten.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Rote-Linsen-Gemüsebällchen",
    "category": "balls",
    "requires": [
      "Rote Linsen",
      "Karotte",
      "Hafer"
    ],
    "stage": 3,
    "batch": "6–8 flache Stücke",
    "ingredients": "4 EL sehr weich gekochte rote Linsen, 2 EL Karottenpüree, 1 EL Haferflocken, 1 TL Petersilie oder ¼ TL milder Kreuzkümmel",
    "note": "Sehr weich gekochte rote Linsen mit Karottenpüree, Haferflocken und Petersilie oder mildem Kreuzkümmel zu einer weichen Masse vermengen. Flache Stücke formen und vollständig garen; nicht trocken, krümelig oder hart werden lassen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Tofu-Brokkoli-Bällchen",
    "category": "balls",
    "requires": [
      "Tofu",
      "Brokkoli",
      "Hafer"
    ],
    "stage": 3,
    "batch": "6–8 flache Stücke",
    "ingredients": "80 g Naturtofu, 3 EL sehr weicher Brokkoli, 1 EL Haferflocken, 1 TL Petersilie, optional ein Hauch mild gegarter Knoblauch",
    "note": "Knoblauch, falls verwendet, kurz mild weich dünsten. Naturtofu fein zerdrücken und mit sehr weichem, fein zerkleinertem Brokkoli, Haferflocken, Petersilie und dem Knoblaucharoma vermengen. Flache Stücke formen und vollständig erhitzen; weich und leicht zerdrückbar servieren.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Brokkoli-Kartoffel-Taler",
    "category": "balls",
    "requires": [
      "Brokkoli",
      "Kartoffel"
    ],
    "stage": 3,
    "batch": "6–8 Taler",
    "ingredients": "gleich viel sehr weicher Brokkoli und Kartoffel, 1 TL Butter, 1 TL Petersilie",
    "note": "Brokkoli und Kartoffel mit Butter und Petersilie fein zerdrücken. Flach formen und nur leicht erwärmen oder weich backen; keine trockene Kruste entstehen lassen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Zucchini-Hafer-Puffer",
    "category": "balls",
    "requires": [
      "Zucchini",
      "Hafer",
      "Ei"
    ],
    "stage": 3,
    "batch": "6 kleine Puffer",
    "ingredients": "3 EL fein geriebene Zucchini, 2 EL Haferflocken, 1 Ei, 1 TL Petersilie oder Schnittlauch",
    "note": "Geriebene Zucchini gut ausdrücken und mit Haferflocken, Ei und Petersilie oder Schnittlauch zu einer gleichmäßigen Masse verrühren. Kleine dünne Puffer formen und vollständig, aber weich durchgaren; keine knusprige harte Kante entstehen lassen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Kichererbsen-Kürbis-Taler",
    "category": "balls",
    "requires": [
      "Kichererbse",
      "Kürbis"
    ],
    "stage": 3,
    "batch": "6–8 Taler",
    "ingredients": "4 EL sehr weiche Kichererbsen, 3 EL Kürbispüree, ¼ TL milder Kreuzkümmel",
    "note": "Kichererbsen und Kürbispüree mit mildem Kreuzkümmel sehr fein zerdrücken, flach formen und weich garen; bei Bedarf etwas Hafer als Binder nur nach Einführung.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Rote-Linsen-Bratlinge",
    "category": "balls",
    "requires": [
      "Rote Linsen",
      "Hafer"
    ],
    "stage": 3,
    "batch": "6–8 Taler",
    "ingredients": "5 EL sehr weich gekochte rote Linsen, 1–2 EL Haferflocken, ¼ TL milder Kreuzkümmel, 1 TL Petersilie",
    "note": "Sehr weich gekochte rote Linsen fein zerdrücken und mit Haferflocken, mildem Kreuzkümmel und Petersilie zu einer weichen, formbaren Masse vermengen. Kleine flache Taler formen und vollständig garen; weich und saftig statt trocken anbieten.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Polenta-Zucchini-Sticks",
    "category": "balls",
    "requires": [
      "Polenta",
      "Zucchini"
    ],
    "stage": 3,
    "batch": "8 weiche Sticks",
    "ingredients": "dicke weiche Polenta, fein gegarte Zucchini, 1 TL Butter oder Rapsöl, 1 TL Petersilie",
    "note": "Polenta mit Wasser weich und dick kochen. Die fein gegarte Zucchini, Butter oder Rapsöl und Petersilie unterrühren. Die Masse flach ausstreichen und vollständig auskühlen beziehungsweise fest werden lassen. In breite gut greifbare Sticks schneiden, weich servieren und eine harte oder trockene Kruste vermeiden.",
    "freeze": "gut einfrierbar",
    "pantryItems": [
      "Polenta"
    ],
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "legacyNames": [
      "Polenta-Gemüse-Sticks",
      "Polenta-Zucchini-Sticks"
    ],
    "searchAliases": [
      "Polenta-Gemüse-Sticks",
      "Polenta-Zucchini-Sticks"
    ],
    "family": true,
    "familyLabel": "zusammengeführtes Grundrezept",
    "variantLabels": [
      "Polenta + Zucchini"
    ],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Süßkartoffel-Hirse-Sticks",
    "category": "balls",
    "requires": [
      "Süßkartoffel",
      "Hirse"
    ],
    "stage": 3,
    "batch": "6–8 weiche Sticks",
    "ingredients": "Süßkartoffelpüree und sehr weich gekochte Hirse",
    "note": "Mischen, länglich formen und sanft garen; Konsistenz vor dem Servieren prüfen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Omelettstreifen",
    "category": "balls",
    "requires": [
      "Ei"
    ],
    "stage": 2,
    "batch": "1 kleine Portion",
    "ingredients": "1 Ei, bei Bedarf etwas Wasser, 1 TL Butter zum Garen, 1 TL Petersilie oder Schnittlauch",
    "note": "Ei mit Wasser und Petersilie oder Schnittlauch verrühren. In wenig Butter bei niedriger Hitze vollständig stocken lassen, weich halten und in breite, gut greifbare Streifen schneiden.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Zucchini-Omelett",
    "category": "balls",
    "requires": [
      "Ei",
      "Zucchini"
    ],
    "stage": 2,
    "batch": "1 kleine Portion",
    "ingredients": "1 Ei, 1–2 EL fein geriebene Zucchini, 1 TL Butter zum Garen, 1 TL Petersilie oder Schnittlauch",
    "note": "Ei mit der fein geriebenen Zucchini und Petersilie oder Schnittlauch verrühren. In wenig Butter bei niedriger Hitze vollständig stocken lassen, weich halten und in breite Streifen schneiden.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Obst-Haferbrei",
    "category": "porridge",
    "requires": [
      "Hafer"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Mango",
      "Heidelbeere",
      "Pfirsich",
      "Pflaume",
      "Aprikose",
      "Erdbeere",
      "Himbeere",
      "Papaya",
      "Kaki"
    ],
    "stage": 1,
    "batch": "1 Portion",
    "ingredients": "Haferflocken, Wasser und eine bekannte weiche Obstsorte",
    "note": "Hafer mit Wasser weich kochen. Eine bekannte Obstsorte erst danach zerdrücken und untermischen. Es braucht nicht für jede Obstsorte ein eigenes Rezept.",
    "generic": true,
    "searchAliases": []
  },
  {
    "name": "Obst-Hirsebrei",
    "category": "porridge",
    "requires": [
      "Hirse"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Mango",
      "Heidelbeere",
      "Pfirsich",
      "Pflaume",
      "Aprikose",
      "Erdbeere",
      "Himbeere",
      "Papaya",
      "Kaki"
    ],
    "stage": 1,
    "batch": "1 Portion",
    "ingredients": "Hirseflocken, Wasser und eine bekannte weiche Obstsorte",
    "note": "Hirseflocken mit Wasser unter Rühren weich kochen. Eine bekannte weiche Obstsorte fein zerdrücken oder pürieren und erst anschließend unter den fertigen Brei rühren.",
    "generic": true,
    "searchAliases": []
  },
  {
    "name": "Obst-Polentabrei",
    "category": "porridge",
    "requires": [
      "Polenta"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Mango",
      "Heidelbeere",
      "Pfirsich",
      "Pflaume",
      "Aprikose",
      "Erdbeere",
      "Himbeere",
      "Papaya",
      "Kaki"
    ],
    "stage": 1,
    "batch": "1 Portion",
    "ingredients": "feine Polenta, Wasser und eine bekannte weiche Obstsorte",
    "note": "Polenta mit Wasser unter Rühren glatt und weich kochen. Eine bekannte weiche Obstsorte fein zerdrücken oder pürieren und anschließend unter den fertigen Brei rühren.",
    "generic": true,
    "searchAliases": []
  },
  {
    "name": "Obst-Reisbrei",
    "category": "porridge",
    "requires": [
      "Reis"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Mango",
      "Heidelbeere",
      "Pfirsich",
      "Pflaume",
      "Aprikose",
      "Erdbeere",
      "Himbeere",
      "Papaya",
      "Kaki"
    ],
    "stage": 1,
    "batch": "1 Portion",
    "ingredients": "sehr weich gekochter Reis oder Reisflocken und eine bekannte Obstsorte",
    "note": "Reis oder Reisflocken mit Wasser sehr weich kochen. Je nach Konsistenzstufe fein pürieren oder zerdrücken und eine bekannte weiche Obstsorte fein vorbereitet unterrühren.",
    "generic": true,
    "searchAliases": []
  },
  {
    "name": "Obst-Quinoabrei",
    "category": "porridge",
    "requires": [
      "Quinoa"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Mango",
      "Heidelbeere",
      "Pfirsich",
      "Pflaume",
      "Aprikose",
      "Erdbeere",
      "Himbeere",
      "Papaya",
      "Kaki"
    ],
    "stage": 1,
    "batch": "1 Portion",
    "ingredients": "sehr weich gekochter Quinoa und eine bekannte weiche Obstsorte",
    "note": "Quinoa gründlich spülen, sehr weich kochen und mit einer bekannten Obstsorte pürieren oder zerdrücken.",
    "generic": true,
    "searchAliases": []
  },
  {
    "name": "Obst-Buchweizenbrei",
    "category": "porridge",
    "requires": [
      "Buchweizen"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Mango",
      "Heidelbeere",
      "Pfirsich",
      "Pflaume",
      "Aprikose",
      "Erdbeere",
      "Himbeere",
      "Papaya",
      "Kaki"
    ],
    "stage": 1,
    "batch": "1 Portion",
    "ingredients": "Buchweizenflocken oder sehr weich gekochter Buchweizen und eine bekannte Obstsorte",
    "note": "Buchweizenflocken mit Wasser weich kochen beziehungsweise ganzen Buchweizen sehr weich garen. Je nach Konsistenzstufe fein pürieren oder zerdrücken und eine bekannte weiche Obstsorte unterrühren.",
    "generic": true,
    "searchAliases": []
  },
  {
    "name": "Obst-Grießbrei",
    "category": "porridge",
    "requires": [
      "Weizen"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Mango",
      "Heidelbeere",
      "Pfirsich",
      "Pflaume",
      "Aprikose",
      "Erdbeere",
      "Himbeere",
      "Papaya",
      "Kaki"
    ],
    "stage": 1,
    "batch": "1 Portion",
    "ingredients": "Weizengrieß, Wasser und eine bekannte weiche Obstsorte",
    "note": "Weizengrieß mit Wasser unter Rühren glatt und weich kochen. Eine bekannte weiche Obstsorte fein zerdrücken oder pürieren und erst danach unter den fertigen Brei rühren.",
    "generic": true,
    "searchAliases": []
  },
  {
    "name": "Milch-Getreide-Brei",
    "category": "porridge",
    "requires": [],
    "oneOf": [
      "Hafer",
      "Hirse",
      "Polenta",
      "Weizen",
      "Dinkel",
      "Buchweizen"
    ],
    "milkChoices": [
      "Kuhmilch",
      "Naturjoghurt",
      "Buttermilch"
    ],
    "stage": 1,
    "minMonths": 6,
    "batch": "1 frische Portion",
    "ingredients": "eine bekannte Getreidesorte und – nach jeweiliger Einführung – pasteurisierte Vollmilch, ungesüßter Naturjoghurt oder ungesüßte Buttermilch",
    "note": "Getreide zuerst mit Wasser weich kochen. Kuhmilch als Breizutat erhitzen; Naturjoghurt oder Buttermilch erst nach dem Abkühlen einrühren. Als volle Milchmahlzeit höchstens einmal täglich und nicht automatisch gemeinsam mit Fleisch planen.",
    "milkPorridge": true,
    "milkMeal": "full",
    "excludeMeat": true,
    "searchAliases": [
      "Milchbrei",
      "Joghurt Getreide Brei",
      "Buttermilch Getreide Brei"
    ],
    "hardMinMonths": 6
  },
  {
    "name": "Baby-Bananenbrot",
    "category": "baking",
    "requires": [
      "Banane",
      "Ei"
    ],
    "oneOf": [
      "Hafer",
      "Dinkel",
      "Weizen"
    ],
    "stage": 3,
    "batch": "1 kleine Kastenform",
    "ingredients": "2 sehr reife Bananen, 2 Eier, fein gemahlene Haferflocken oder Mehl; optional wenig Rapsöl",
    "note": "Zu einem weichen Teig verrühren und vollständig durchbacken. Ohne Zucker, Honig und Salz. Auskühlen lassen und in weiche, gut greifbare Stücke schneiden.",
    "freezable": true,
    "freezerNote": "Scheiben einzeln vorfrieren, danach gesammelt verpacken. Portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Kürbis-Hafer-Brei",
    "category": "porridge",
    "requires": [
      "Kürbis",
      "Hafer"
    ],
    "stage": 1,
    "batch": "1–3 kleine Portionen",
    "ingredients": "Kürbispüree, weich gekochter Hafer",
    "note": "Kürbis vollständig weich garen und zu Püree zerdrücken. Hafer mit Wasser weich kochen und mit dem Kürbispüree zu einer gleichmäßigen, löffelbaren Konsistenz verrühren. Ohne Salz anbieten; Rapsöl kann nach dem Erwärmen optional ergänzt werden.",
    "searchAliases": []
  },
  {
    "name": "Gemüse-Nudel-Sauce",
    "category": "porridge",
    "requires": [
      "Nudeln/Pasta",
      "Zucchini",
      "Tomate"
    ],
    "stage": 3,
    "batch": "2–4 Portionen Sauce",
    "ingredients": "sehr weich gekochte Nudeln, Zucchini, geschälte gegarte Tomate, 1–2 EL mild gegarte Zwiebel, 1 TL Basilikum, 1 TL Rapsöl",
    "note": "Zwiebel in wenig Rapsöl mild weich dünsten. Zucchini sehr weich garen und mit der geschälten gegarten Tomate, Zwiebel und Basilikum zu einer feinen, saftigen Sauce pürieren oder zerdrücken. Nudeln separat sehr weich kochen, passend klein schneiden und mit der Sauce vermengen. Ohne Salz und Zucker zubereiten.",
    "freezable": true,
    "freezerNote": "Rasch abkühlen, in Mahlzeitenportionen einfrieren und vollständig durcherhitzen.",
    "searchAliases": []
  },
  {
    "name": "Baby-Linsen-Bolognese",
    "category": "porridge",
    "requires": [
      "Rote Linsen",
      "Tomate",
      "Nudeln/Pasta"
    ],
    "stage": 3,
    "batch": "3–4 Portionen Sauce",
    "ingredients": "rote Linsen, gegarte Tomate, sehr weiche Nudeln, 1–2 EL mild gegarte Zwiebel, 1 TL Basilikum oder Oregano, 1 TL Rapsöl",
    "note": "Zwiebel in wenig Rapsöl mild weich dünsten. Rote Linsen mit Wasser sehr weich kochen. Gegarte Tomate, Zwiebel und Basilikum oder Oregano fein zerdrücken oder pürieren und mit den Linsen zu einer saftigen Sauce köcheln. Nudeln separat sehr weich garen, passend klein schneiden und mit der Sauce vermengen. Ohne Salz zubereiten.",
    "freezable": true,
    "freezerNote": "Rasch abkühlen, in Mahlzeitenportionen einfrieren und vollständig durcherhitzen.",
    "searchAliases": []
  },
  {
    "name": "Lugaw-Basis",
    "category": "philippines",
    "ph": true,
    "requires": [
      "Reis",
      "Huhn"
    ],
    "stage": 1,
    "batch": "2–4 Portionen",
    "ingredients": "Reis, Wasser, vollständig gegartes Huhn, wenig frischer Ingwer, optional mild gegarte Zwiebel oder Knoblauch",
    "note": "Ingwer und Zwiebel oder Knoblauch, falls verwendet, sehr mild weich dünsten. Reis mit viel Wasser sehr weich und breiig kochen. Huhn separat vollständig durchgaren, sehr fein zerkleinern und mit dem Ingweraroma unter den Reisbrei rühren. Babyportion ohne Salz, Brühewürfel oder Fischsauce anbieten.",
    "searchAliases": []
  },
  {
    "name": "Kürbis-Lugaw",
    "category": "philippines",
    "ph": true,
    "requires": [
      "Reis",
      "Kürbis"
    ],
    "stage": 1,
    "batch": "2–4 Portionen",
    "ingredients": "Reis, Wasser, Kürbis",
    "note": "Reis mit Wasser sehr weich und breiig kochen. Kürbis vollständig weich garen, fein zerdrücken und unter den Reisbrei rühren. Je nach aktueller Konsistenzstufe zusätzlich pürieren oder grob zerdrücken.",
    "searchAliases": []
  },
  {
    "name": "Monggo-Kalabasa-Brei",
    "category": "philippines",
    "ph": true,
    "requires": [
      "Mungbohne",
      "Kürbis"
    ],
    "stage": 1,
    "batch": "2–4 Portionen",
    "ingredients": "sehr weich gekochte Mungbohnen und Kürbis, mild gegarte Zwiebel, optional ein Hauch Knoblauch",
    "note": "Zwiebel und optional Knoblauch sehr mild weich dünsten. Mungbohnen mit Wasser sehr weich kochen. Kürbis vollständig weich garen, alles fein pürieren oder zerdrücken und zu einem löffelbaren Brei vermengen. Ohne Salz und Fischsauce anbieten.",
    "searchAliases": []
  },
  {
    "name": "Tinola-inspiriert",
    "category": "philippines",
    "ph": true,
    "requires": [
      "Huhn",
      "Sayote (Chayote)",
      "Malunggay (Moringablätter)"
    ],
    "stage": 2,
    "batch": "2–4 Portionen",
    "ingredients": "Huhn, Sayote, kleine Menge Malunggay, Wasser, frischer Ingwer, optional mild gegarte Zwiebel",
    "note": "Ingwer und optional Zwiebel sehr mild weich dünsten. Huhn vollständig durchgaren. Sayote sehr weich garen, Malunggay fein zerkleinern und gegen Ende kurz mitgaren. Alles mit Wasser zu einer weichen Mischung verbinden und passend zur Konsistenzstufe zerkleinern. Babyportion ohne Salz, Brühewürfel und Fischsauce anbieten.",
    "searchAliases": []
  },
  {
    "name": "Arroz-caldo-inspiriert",
    "category": "philippines",
    "ph": true,
    "requires": [
      "Reis",
      "Huhn",
      "Ingwer"
    ],
    "stage": 2,
    "batch": "2–4 Portionen",
    "ingredients": "Reis, Huhn, eine kleine Menge Ingwer, mild gegarte Zwiebel oder Knoblauch, Wasser",
    "note": "Ingwer und Zwiebel oder Knoblauch sehr mild weich dünsten. Reis mit Wasser sehr weich und breiig kochen. Huhn vollständig durchgaren, fein zerkleinern und mit dem Aromaten unter den Reisbrei rühren. Sehr mild halten und ohne Salz oder Fertigbrühe anbieten.",
    "searchAliases": []
  },
  {
    "name": "Kalabasa mit Kokos",
    "category": "philippines",
    "ph": true,
    "requires": [
      "Kürbis",
      "Kokos"
    ],
    "stage": 2,
    "batch": "2–3 Portionen",
    "ingredients": "Kürbis und kleine Menge ungesüßte Kokosmilch",
    "note": "Kürbis mit Wasser vollständig weich garen und fein zerdrücken. Ungesüßte Kokosmilch einrühren und kurz sanft erwärmen, bis eine weiche, löffelbare Konsistenz entsteht. Kokosmilch als Zutat und nicht als Getränk verwenden.",
    "searchAliases": []
  },
  {
    "name": "Tilapia-Reis-Brei",
    "category": "philippines",
    "ph": true,
    "requires": [
      "Tilapia",
      "Reis"
    ],
    "stage": 2,
    "batch": "1–2 Portionen",
    "ingredients": "vollständig gegarter grätenfreier Tilapia und sehr weicher Reis",
    "note": "Reis mit Wasser sehr weich und breiig kochen. Tilapia vollständig garen, sorgfältig auf Gräten prüfen, fein zerpflücken und unter den Reis rühren. Je nach Konsistenzstufe fein zerdrücken oder pürieren.",
    "searchAliases": []
  },
  {
    "name": "Bangus-Kartoffel-Taler",
    "category": "philippines",
    "ph": true,
    "requires": [
      "Bangus (Milkfish)",
      "Kartoffel"
    ],
    "stage": 3,
    "batch": "6 kleine Taler",
    "ingredients": "vollständig gegarter, äußerst sorgfältig entgräteter Bangus, Kartoffel und 1 TL Petersilie oder Dill",
    "note": "Bangus vollständig garen und äußerst sorgfältig von allen feinen Gräten befreien. Mit der sehr weichen Kartoffel und Petersilie oder Dill fein zerdrücken und vermengen, kleine flache Taler formen und nur so weit erwärmen oder backen, dass sie zusammenhalten und weich bleiben.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Obst-Hafer-Muffins",
    "category": "baking",
    "requires": [
      "Hafer",
      "Ei"
    ],
    "stage": 4,
    "batch": "6 Mini-Muffins",
    "ingredients": "Hafer, Ei und weiches Obst nach Auswahl",
    "note": "Weiches Obst fein zerdrücken oder pürieren und mit fein gemahlenem Hafer sowie Ei zu einem gleichmäßigen Teig verrühren. In kleine Formen füllen und ohne Zucker oder Salz vollständig backen, innen saftig halten und keine harte Kruste entstehen lassen. Vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Pfirsich",
      "Aprikose",
      "Pflaume",
      "Mango"
    ],
    "searchAliases": [
      "Bananen-Hafer-Muffins",
      "Obst-Hafer-Muffins",
      "Apfel Hafer Muffins",
      "Birne Hafer Muffins",
      "Banane Hafer Muffins",
      "Obst Muffins ohne Zucker"
    ],
    "tags": [
      "Snack",
      "Backen",
      "einfrierbar"
    ],
    "minMonths": 10,
    "legacyNames": [
      "Bananen-Hafer-Muffins",
      "Obst-Hafer-Muffins"
    ],
    "family": true,
    "familyLabel": "7 Obstvarianten",
    "variantLabels": [
      "Apfel",
      "Birne",
      "Banane",
      "Pfirsich",
      "Aprikose",
      "Pflaume",
      "Mango"
    ],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Gemüse-Hafer-Muffins",
    "category": "baking",
    "requires": [
      "Hafer",
      "Ei"
    ],
    "oneOf": [
      "Zucchini",
      "Karotte",
      "Brokkoli",
      "Süßkartoffel"
    ],
    "stage": 4,
    "batch": "8 Mini-Muffins",
    "ingredients": "Hafer, Ei und sehr fein vorbereitetes Gemüse nach Auswahl",
    "note": "Das gewählte Gemüse sehr weich garen und sehr fein vorbereiten. Mit fein gemahlenem Hafer und Ei zu einem gleichmäßigen Teig verrühren, in kleine Formen füllen und ohne Salz vollständig backen. Innen saftig halten, keine harte Kruste entstehen lassen und vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und portionsweise auftauen.",
    "tags": [
      "Snack",
      "Backen",
      "einfrierbar"
    ],
    "minMonths": 10,
    "legacyNames": [
      "Zucchini-Hafer-Muffins",
      "Ei-Hafer-Gemüse-Muffins"
    ],
    "searchAliases": [
      "Zucchini-Hafer-Muffins",
      "Ei-Hafer-Gemüse-Muffins"
    ],
    "family": true,
    "familyLabel": "4 Gemüsevarianten",
    "variantLabels": [
      "Zucchini",
      "Karotte",
      "Brokkoli",
      "Süßkartoffel"
    ],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Kürbis-Hirse-Muffins",
    "category": "baking",
    "requires": [
      "Kürbis",
      "Hirse",
      "Ei"
    ],
    "stage": 4,
    "batch": "6 Mini-Muffins",
    "ingredients": "Kürbispüree, Hirseflocken, Ei",
    "note": "Kürbispüree mit Hirseflocken und Ei zu einem gleichmäßigen, feuchten Teig verrühren. In kleine Formen füllen und vollständig, aber weich backen. Vor dem Servieren auf eine saftige, leicht zerdrückbare Konsistenz prüfen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Karotten-Polenta-Brei",
    "category": "porridge",
    "requires": [
      "Karotte",
      "Polenta"
    ],
    "stage": 1,
    "batch": "2–3 Portionen",
    "ingredients": "sehr weiche Karotte, fein gekochte Polenta, Wasser",
    "note": "Polenta weich kochen und mit Karottenpüree mischen. Rapsöl erst in die servierte Portion geben.",
    "pantryItems": [
      "Polenta",
      "Rapsöl"
    ],
    "searchAliases": []
  },
  {
    "name": "Süßkartoffel-Rote-Linsen-Brei",
    "category": "porridge",
    "requires": [
      "Süßkartoffel",
      "Rote Linsen"
    ],
    "stage": 1,
    "batch": "3–4 Portionen",
    "ingredients": "sehr weich gegarte Süßkartoffel, sehr weich gekochte rote Linsen, Wasser",
    "note": "Beides fein pürieren oder zerdrücken. Pur einfrieren; Öl erst nach dem Erwärmen ergänzen.",
    "pantryItems": [
      "rote Linsen",
      "Rapsöl"
    ],
    "searchAliases": []
  },
  {
    "name": "Zucchini-Quinoa-Brei",
    "category": "porridge",
    "requires": [
      "Zucchini",
      "Quinoa"
    ],
    "stage": 2,
    "batch": "2–3 Portionen",
    "ingredients": "sehr weich gegarte Zucchini, sehr weich gekochter weißer Quinoa",
    "note": "Quinoa gründlich spülen, sehr weich kochen und für den Anfang mit Zucchini fein pürieren.",
    "pantryItems": [
      "weißer Quinoa"
    ],
    "searchAliases": []
  },
  {
    "name": "Kichererbsenmehl-Zucchini-Taler",
    "category": "balls",
    "requires": [
      "Kichererbse",
      "Zucchini"
    ],
    "stage": 3,
    "batch": "6 kleine weiche Taler",
    "ingredients": "Kichererbsenmehl, fein geriebene Zucchini, Wasser",
    "note": "Zu einem weichen Teig verrühren, kleine flache Taler formen und vollständig durchgaren. Nicht trocken oder knusprig werden lassen.",
    "pantryItems": [
      "Kichererbsenmehl"
    ],
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Bananen-Haferbrei mit Erdnussmus",
    "category": "porridge",
    "requires": [
      "Banane",
      "Hafer",
      "Erdnuss"
    ],
    "stage": 1,
    "batch": "1 kleine Portion",
    "ingredients": "weicher Haferbrei, reife Banane, wenig glattes Erdnussmus",
    "note": "Hafer mit Wasser weich kochen. Banane fein zerdrücken und unter den fertigen Brei rühren. Nur nach sicherer Einführung von Erdnuss wenig glattes Erdnussmus vollständig und dünn in die fertige Portion einrühren.",
    "pantryItems": [
      "feine Haferflocken",
      "glattes Erdnussmus"
    ],
    "searchAliases": []
  },
  {
    "name": "Karotten-Hirse-Brei mit Tahin",
    "category": "porridge",
    "requires": [
      "Karotte",
      "Hirse",
      "Sesam"
    ],
    "stage": 1,
    "batch": "1 kleine Portion",
    "ingredients": "Karotten-Hirse-Brei, wenig glattes Tahin",
    "note": "Hirse mit Wasser weich kochen und mit sehr weich gegarter, fein zerdrückter Karotte zu einem glatten Brei verrühren. Nur nach sicherer Einführung von Sesam wenig glattes Tahin vollständig und sparsam in die servierte Portion einrühren.",
    "pantryItems": [
      "Hirseflocken",
      "Tahin"
    ],
    "searchAliases": []
  },
  {
    "name": "Apfel-Hirse-Brei mit Mandelmus",
    "category": "porridge",
    "requires": [
      "Apfel",
      "Hirse",
      "Mandel"
    ],
    "stage": 1,
    "batch": "1 kleine Portion",
    "ingredients": "Apfel-Hirse-Brei, wenig weißes Mandelmus",
    "note": "Hirse mit Wasser weich kochen und den weich gegarten Apfel fein zerdrücken oder pürieren und unterrühren. Nur nach sicherer Einführung von Mandel wenig weißes Mandelmus vollständig und glatt in die fertige Portion einrühren.",
    "pantryItems": [
      "Hirseflocken",
      "weißes Mandelmus"
    ],
    "searchAliases": []
  },
  {
    "name": "Apfel-Birnen-Kompott",
    "category": "porridge",
    "requires": [
      "Apfel",
      "Birne"
    ],
    "stage": 1,
    "batch": "4 kleine Portionen",
    "ingredients": "Apfel, Birne, wenig Wasser",
    "note": "Obst weich dünsten und passend zur Konsistenz zerdrücken oder pürieren. Pur portionsweise einfrierbar.",
    "freeze": "gut einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Karotte-Süßkartoffel-Brei",
    "category": "porridge",
    "requires": [
      "Karotte",
      "Süßkartoffel"
    ],
    "stage": 1,
    "batch": "4–6 Portionen",
    "ingredients": "Karotte, Süßkartoffel, Wasser",
    "note": "Beides sehr weich dämpfen und fein pürieren oder zerdrücken. Öl erst in die servierte Portion geben.",
    "freeze": "gut einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Brokkoli-Kartoffel-Stampf",
    "category": "porridge",
    "requires": [
      "Brokkoli",
      "Kartoffel"
    ],
    "stage": 2,
    "batch": "3–4 Portionen",
    "ingredients": "Brokkoli, Kartoffel, Wasser",
    "note": "Sehr weich garen und mit der Gabel zerdrücken. Kartoffel nicht lange mixen, damit sie nicht klebrig wird.",
    "freeze": "eher frisch oder gemischt einfrieren",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Karfiol-Kartoffel-Stampf",
    "category": "porridge",
    "requires": [
      "Karfiol",
      "Kartoffel"
    ],
    "stage": 2,
    "batch": "3–4 Portionen",
    "ingredients": "Karfiol, Kartoffel, Wasser",
    "note": "Sehr weich dämpfen und gemeinsam fein zerdrücken. Bei Bedarf mit wenig Wasser lockern.",
    "freeze": "eher frisch oder gemischt einfrieren",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Zucchini-Kartoffel-Brei",
    "category": "porridge",
    "requires": [
      "Zucchini",
      "Kartoffel"
    ],
    "stage": 1,
    "batch": "3–4 Portionen",
    "ingredients": "Zucchini, Kartoffel",
    "note": "Beides sehr weich garen. Kartoffel zerdrücken und Zucchini unterheben oder kurz pürieren.",
    "freeze": "als Mischung einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Erbsen-Kartoffel-Stampf",
    "category": "porridge",
    "requires": [
      "Erbsen (TK möglich)",
      "Kartoffel"
    ],
    "stage": 2,
    "batch": "3 Portionen",
    "ingredients": "Erbsen, Kartoffel, Wasser",
    "note": "Erbsen vollständig weich kochen und mit Kartoffel fein zerdrücken. Für eine glatte Konsistenz pürieren.",
    "freeze": "gut einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Kürbis-Linsen-Suppe",
    "category": "family",
    "requires": [
      "Kürbis",
      "Rote Linsen"
    ],
    "stage": 2,
    "batch": "4 Portionen",
    "ingredients": "Kürbis, rote Linsen, Wasser, 1 TL Petersilie, optional ¼ TL milder Kreuzkümmel und 1 TL Rapsöl",
    "note": "Kürbis und rote Linsen sehr weich köcheln. Petersilie und optional eine kleine Menge milden Kreuzkümmel einrühren, mit Rapsöl abrunden und je nach Stufe pürieren oder grob zerdrücken. Ohne Salz kochen.",
    "freeze": "gut einfrierbar",
    "freezable": true,
    "freezerNote": "Rasch abkühlen, in Mahlzeitenportionen einfrieren und vollständig durcherhitzen.",
    "searchAliases": []
  },
  {
    "name": "Hirsotto",
    "category": "family",
    "requires": [
      "Hirse",
      "Rote Linsen",
      "Kürbis",
      "Rapsöl",
      "Petersilie",
      "Butter"
    ],
    "stage": 2,
    "batch": "3–4 kleine Portionen",
    "ingredients": "60 g Goldhirse, 20 g rote Linsen, 100 g gegarter und pürierter Kürbis, 350 ml salzfreie Gemüsebrühe, 1 TL Rapsöl oder Pflanzenöl, 1 TL fein gehackte Petersilie, 1 TL Butter",
    "note": "Hirse und rote Linsen gründlich waschen. Einweichen über Nacht ist höchstens optional und keine Voraussetzung. Beides mit der salzfreien Gemüsebrühe sehr weich kochen. Das Kürbispüree einarbeiten und anschließend Öl, Petersilie und Butter unterrühren. Je nach Phase fein pürieren, grob zerdrücken oder als weiche, risottoartige Struktur servieren. Keine gesalzene Brühe verwenden.",
    "freezable": true,
    "freezerNote": "Rasch abkühlen, in kleinen Portionen einfrieren und beim Erwärmen mit etwas Wasser oder salzfreier Brühe wieder cremig rühren.",
    "searchAliases": []
  },
  {
    "name": "Mildes Rote-Linsen-Dhal",
    "category": "family",
    "requires": [
      "Rote Linsen",
      "Kurkuma"
    ],
    "alternatives": [
      [
        "Rote Linsen"
      ]
    ],
    "stage": 2,
    "batch": "6 kleine Portionen",
    "ingredients": "rote Linsen, Wasser, optional wenig Kurkuma, mild gegarte Zwiebel und ein Hauch Knoblauch",
    "note": "Linsen mit mild gegarter Zwiebel und optional einem Hauch Knoblauch sehr weich und cremig kochen. Mit wenig Kurkuma abrunden, für Babys mild halten und ohne Salz zubereiten.",
    "freeze": "gut einfrierbar",
    "pantryItems": [
      "rote Linsen"
    ],
    "freezable": true,
    "freezerNote": "Rasch abkühlen, in Mahlzeitenportionen einfrieren und vollständig durcherhitzen.",
    "searchAliases": []
  },
  {
    "name": "Huhn-Karotte-Nudel-Topf",
    "category": "family",
    "requires": [
      "Huhn",
      "Karotte",
      "Nudeln/Pasta"
    ],
    "stage": 2,
    "batch": "4 Portionen",
    "ingredients": "Huhn, Karotte, kleine Nudeln, Wasser, mild gegarte Zwiebel, 1 TL Petersilie",
    "note": "Zwiebel mild weich dünsten. Huhn vollständig durchgaren, Karotte und Nudeln sehr weich kochen und alles mit der Zwiebel sowie Petersilie passend zerkleinern.",
    "freeze": "gut einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Huhn-Lauch-Kartoffel-Topf",
    "category": "family",
    "requires": [
      "Huhn",
      "Lauch",
      "Kartoffel"
    ],
    "stage": 2,
    "batch": "4 Portionen",
    "ingredients": "Huhn, Lauch, Kartoffel, Wasser, 1 TL Petersilie, optional 1 TL Butter",
    "note": "Lauch mild weich dünsten und mit Kartoffel und Wasser vollständig weich garen. Huhn vollständig durchgaren, fein zerkleinern und mit Gemüse, Petersilie und optional Butter vermengen.",
    "freeze": "gut einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Huhn-Brokkoli-Reis",
    "category": "family",
    "requires": [
      "Huhn",
      "Brokkoli",
      "Reis"
    ],
    "stage": 2,
    "batch": "4 Portionen",
    "ingredients": "Huhn, Brokkoli, sehr weich gekochter Reis, mild gegarte Zwiebel, 1 TL Petersilie, 1 TL Rapsöl",
    "note": "Zwiebel mild weich dünsten. Huhn vollständig durchgaren, Brokkoli weich dämpfen und mit sehr weichem Reis, Zwiebel, Petersilie und Rapsöl passend zerdrücken.",
    "freeze": "gut einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Rind-Gemüse-Bolognese",
    "category": "family",
    "requires": [
      "Rind",
      "Karotte",
      "Tomate"
    ],
    "stage": 2,
    "batch": "6 Saucenportionen",
    "ingredients": "Rind, Karotte, Tomate, Wasser, mild gegarte Zwiebel, optional wenig Knoblauch, Basilikum und Oregano, 1 TL Oliven- oder Rapsöl",
    "note": "Zwiebel und optional wenig Knoblauch in Öl mild weich dünsten. Rind vollständig garen, Karotte und Tomate weich kochen und mit Basilikum und Oregano zu einer aromatischen, feinen Sauce verarbeiten. Zu weichen Nudeln oder Polenta servieren; ohne Salz zubereiten.",
    "freeze": "Sauce gut einfrierbar",
    "freezable": true,
    "freezerNote": "Rasch abkühlen, in Mahlzeitenportionen einfrieren und vollständig durcherhitzen.",
    "searchAliases": []
  },
  {
    "name": "Tomaten-Linsen-Sauce",
    "category": "family",
    "requires": [
      "Tomate",
      "Rote Linsen"
    ],
    "stage": 2,
    "batch": "6 Saucenportionen",
    "ingredients": "Tomate, rote Linsen, Wasser, mild gegarte Zwiebel, optional wenig Knoblauch und Basilikum, 1 TL Rapsöl",
    "note": "Zwiebel und optional wenig Knoblauch in Rapsöl mild weich dünsten. Linsen in der Tomatensauce sehr weich kochen, Basilikum einarbeiten und fein pürieren oder zerdrücken.",
    "freeze": "gut einfrierbar",
    "pantryItems": [
      "rote Linsen"
    ],
    "freezable": true,
    "freezerNote": "Rasch abkühlen, in Mahlzeitenportionen einfrieren und vollständig durcherhitzen.",
    "searchAliases": []
  },
  {
    "name": "Brokkoli-Linsen-Pasta",
    "category": "family",
    "requires": [
      "Brokkoli",
      "Rote Linsen",
      "Nudeln/Pasta"
    ],
    "stage": 3,
    "batch": "4 Portionen",
    "ingredients": "Brokkoli, rote Linsen, sehr weiche Nudeln, 1 TL Rapsöl, 1 TL Petersilie oder Basilikum",
    "note": "Brokkoli und Linsen mit Rapsöl und Petersilie oder Basilikum weich zu einer saftigen Sauce kochen. Mit kleinen sehr weichen Nudeln mischen.",
    "freeze": "Sauce separat einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Gemüse-Pasta mit Zucchini und Tomate",
    "category": "family",
    "requires": [
      "Zucchini",
      "Tomate",
      "Nudeln/Pasta"
    ],
    "stage": 3,
    "batch": "4 Portionen",
    "ingredients": "Zucchini, Tomate, sehr weiche Nudeln, mild gegarte Zwiebel, 1 TL Basilikum, 1 TL Rapsöl",
    "note": "Zwiebel in Rapsöl mild weich dünsten. Zucchini und Tomate weich zu einer saftigen Sauce garen, Basilikum einarbeiten und mit sehr weichen kleinen Nudeln vermengen.",
    "freeze": "Sauce separat einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Lachs-Reis-Erbsen",
    "category": "family",
    "requires": [
      "Lachs",
      "Reis",
      "Erbsen (TK möglich)"
    ],
    "stage": 2,
    "batch": "2–3 Portionen",
    "ingredients": "Lachs, Reis, Erbsen, Wasser, 1 TL Butter, 1 TL Dill",
    "note": "Lachs vollständig garen und sorgfältig auf Gräten prüfen. Mit sehr weichem Reis, weichen Erbsen, Butter und Dill zerdrücken; saftig und ohne Salz servieren.",
    "freeze": "frisch bevorzugt; Reste rasch einfrieren",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Lachs-Süßkartoffel-Stampf",
    "category": "family",
    "requires": [
      "Lachs",
      "Süßkartoffel"
    ],
    "stage": 2,
    "batch": "2–3 Portionen",
    "ingredients": "Lachs, Süßkartoffel, 1 TL Butter, 1 TL Dill oder Petersilie",
    "note": "Lachs vollständig garen, auf Gräten prüfen und fein mit weicher Süßkartoffel, Butter und Dill oder Petersilie vermengen.",
    "freeze": "gut einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Kabeljau-Tomaten-Gemüse",
    "category": "family",
    "requires": [
      "Kabeljau",
      "Tomate",
      "Zucchini"
    ],
    "stage": 2,
    "batch": "3 Portionen",
    "ingredients": "Kabeljau, Tomate, Zucchini, 1 TL Rapsöl, 1 TL Petersilie oder Dill",
    "note": "Fisch vollständig garen und sorgfältig auf Gräten prüfen. Mit weich gegartem Gemüse, Rapsöl und Petersilie oder Dill zerkleinern.",
    "freeze": "gut einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Weiches Rührei",
    "category": "family",
    "requires": [
      "Ei"
    ],
    "stage": 2,
    "batch": "1 Portion",
    "ingredients": "Ei, 1 TL Butter, 1 TL Petersilie oder Schnittlauch, optional wenig Wasser oder bereits eingeführte Milch als Zutat",
    "note": "Butter sanft schmelzen lassen. Ei mit Petersilie oder Schnittlauch verrühren, vollständig stocken lassen, dabei weich halten und in passende kleine Stücke teilen.",
    "freeze": "frisch zubereiten",
    "searchAliases": []
  },
  {
    "name": "Eier-Finger",
    "category": "balls",
    "requires": [
      "Ei"
    ],
    "stage": 3,
    "batch": "2 Fingerfood-Portionen",
    "ingredients": "vollständig gegartes Ei",
    "note": "Ei vollständig garen, schälen und in gut greifbare längliche Stücke schneiden. Frisch anbieten und nicht einfrieren.",
    "freeze": "frisch zubereiten",
    "freezable": false,
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Paprika-Omelettstreifen",
    "category": "balls",
    "requires": [
      "Ei",
      "Paprika"
    ],
    "stage": 3,
    "batch": "6–8 Streifen",
    "ingredients": "Ei, sehr fein geschnittene weich gegarte Paprika, 1 TL Butter und 1 TL Petersilie",
    "note": "Die weich gegarte Paprika sehr fein schneiden und mit Ei und Petersilie verrühren. Butter sanft schmelzen lassen, das Omelett vollständig durchgaren, weich halten und in breite gut greifbare Streifen schneiden.",
    "freeze": "kurzfristig einfrierbar",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Ei-Champignon-Cups",
    "category": "baking",
    "requires": [
      "Ei",
      "Champignon"
    ],
    "stage": 3,
    "batch": "6 kleine Cups",
    "ingredients": "Ei, fein gehackte weich gegarte Champignons, 1 TL Butter und 1 TL Schnittlauch oder Petersilie",
    "note": "Champignons weich garen, fein hacken und mit Ei und Schnittlauch oder Petersilie verrühren. Die Formen mit Butter ausstreichen, die Mischung einfüllen und vollständig durchbacken. Für Babys weich und ohne Salz zubereiten und vor dem Servieren auf eine leicht zerdrückbare Konsistenz prüfen.",
    "freeze": "gut einfrierbar",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Hummus mit weichen Gemüsesticks",
    "category": "balls",
    "requires": [
      "Kichererbse"
    ],
    "oneOf": [
      "Gurke",
      "Karotte",
      "Zucchini",
      "Süßkartoffel"
    ],
    "stage": 3,
    "batch": "3 kleine Portionen",
    "ingredients": "weich gekochte Kichererbsen, optional Tahin, Wasser und ein mechanisch weicher Gemüsestick nach Auswahl",
    "note": "Kichererbsen sehr glatt pürieren. Tahin nur nach eingeführtem Sesam verwenden. Gurke, Karotte, Zucchini oder Süßkartoffel nur in einer konkret mechanisch weichen, sicher greifbaren Form ohne harte, zähe oder spröde Bissen anbieten.",
    "freeze": "Hummus gut einfrierbar",
    "pantryItems": [
      "Kichererbsen",
      "Tahin"
    ],
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Kürbis-Kichererbsen-Creme",
    "category": "porridge",
    "requires": [
      "Kürbis",
      "Kichererbse"
    ],
    "stage": 2,
    "batch": "4 Portionen",
    "ingredients": "Kürbis, weich gekochte Kichererbsen, Wasser, ¼ TL milder Kreuzkümmel, 1 TL Rapsöl",
    "note": "Kichererbsen und Kürbis sehr weich garen, mit mildem Kreuzkümmel und Rapsöl verfeinern und glatt pürieren oder fein zerdrücken.",
    "freeze": "gut einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Avocado-Bananen-Creme",
    "category": "porridge",
    "requires": [
      "Avocado",
      "Banane"
    ],
    "stage": 1,
    "batch": "1 Portion",
    "ingredients": "reife Avocado, reife Banane",
    "note": "Frisch mit der Gabel fein zerdrücken. Nicht lange aufbewahren.",
    "freeze": "frisch zubereiten",
    "searchAliases": []
  },
  {
    "name": "Buchweizen-Bananen-Pancakes",
    "category": "pancakes",
    "requires": [
      "Buchweizen",
      "Banane",
      "Ei"
    ],
    "stage": 3,
    "batch": "6 kleine Pancakes",
    "ingredients": "Buchweizenflocken oder -mehl, Banane, Ei",
    "note": "Zu einem weichen Teig verrühren und kleine Pancakes vollständig durchgaren. Weich servieren.",
    "freeze": "gut einfrierbar",
    "pantryItems": [
      "Buchweizenflocken oder Buchweizen"
    ],
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Süßkartoffel-Linsen-Taler",
    "category": "balls",
    "requires": [
      "Süßkartoffel",
      "Rote Linsen"
    ],
    "stage": 3,
    "batch": "8 kleine Taler",
    "ingredients": "Süßkartoffel, sehr weich gekochte rote Linsen",
    "note": "Masse zerdrücken, kleine flache Taler formen und vollständig durchgaren. Weich lassen.",
    "freeze": "gut einfrierbar",
    "pantryItems": [
      "rote Linsen"
    ],
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und danach gesammelt verpacken; portionsweise auftauen.",
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Tofu-Zucchini-Reis",
    "category": "family",
    "requires": [
      "Tofu",
      "Zucchini",
      "Reis"
    ],
    "stage": 2,
    "batch": "3 Portionen",
    "ingredients": "Naturtofu, Zucchini, sehr weich gekochter Reis, 1 TL Petersilie, optional ein Hauch mild gegarter Knoblauch, 1 TL Rapsöl",
    "note": "Knoblauch, falls verwendet, kurz mild weich dünsten. Naturtofu vollständig erhitzen, fein zerdrücken und mit weicher Zucchini, Reis, Petersilie und Rapsöl vermengen.",
    "freeze": "gut einfrierbar",
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Gebackene Saba-Banane",
    "category": "philippines",
    "requires": [
      "Saba-Banane"
    ],
    "stage": 3,
    "batch": "2 Portionen",
    "ingredients": "reife Saba-Banane",
    "note": "Ohne Zucker weich backen oder dämpfen und in gut greifbaren weichen Stücken anbieten.",
    "freeze": "frisch bevorzugt",
    "ph": true,
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Huhn-Lugaw",
    "category": "philippines",
    "requires": [
      "Huhn",
      "Reis"
    ],
    "stage": 2,
    "batch": "5 Portionen",
    "ingredients": "Huhn, Reis, viel Wasser, wenig Ingwer, optional mild gegarte Zwiebel oder Knoblauch",
    "note": "Ingwer und optional Zwiebel oder Knoblauch sehr mild weich dünsten. Reis sehr weich zu einem dicken Brei kochen. Huhn vollständig garen, sehr fein zerkleinern und mit dem Aromaten untermischen.",
    "freeze": "gut einfrierbar",
    "ph": true,
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Sayote-Huhn-Reis",
    "category": "philippines",
    "requires": [
      "Sayote (Chayote)",
      "Huhn",
      "Reis"
    ],
    "stage": 2,
    "batch": "4 Portionen",
    "ingredients": "Sayote, Huhn, Reis, Wasser, wenig Ingwer, optional mild gegarte Zwiebel",
    "note": "Ingwer und optional Zwiebel mild weich dünsten. Sayote und Reis sehr weich garen, Huhn vollständig durchgaren und alles mit dem Aromaten passend zerkleinern.",
    "freeze": "gut einfrierbar",
    "ph": true,
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Monggo-Süßkartoffel-Brei",
    "category": "philippines",
    "requires": [
      "Mungbohne",
      "Süßkartoffel"
    ],
    "stage": 2,
    "batch": "5 Portionen",
    "ingredients": "Mungbohnen, Süßkartoffel, Wasser, mild gegarte Zwiebel, optional ein Hauch Knoblauch",
    "note": "Zwiebel und optional Knoblauch mild weich dünsten. Mungbohnen sehr weich kochen und mit Süßkartoffel sowie dem Aromaten pürieren oder fein zerdrücken.",
    "freeze": "gut einfrierbar",
    "ph": true,
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Ube-Hafer-Brei",
    "category": "philippines",
    "requires": [
      "Ube (violette Yamswurzel)",
      "Hafer"
    ],
    "stage": 1,
    "batch": "3 Portionen",
    "ingredients": "vollständig gegarte Ube, Haferflocken, Wasser",
    "note": "Ube vollständig weich garen. Hafer weich kochen und mit Ube fein pürieren. Keine rohe Ube verwenden.",
    "freeze": "gut einfrierbar",
    "ph": true,
    "pantryItems": [
      "feine Haferflocken"
    ],
    "searchAliases": [],
    "freezable": true,
    "freezerNote": "Portionsweise rasch abkühlen, einfrieren und vollständig auftauen beziehungsweise durcherhitzen."
  },
  {
    "name": "Obst-Joghurt",
    "category": "porridge",
    "requires": [
      "Naturjoghurt"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Pfirsich",
      "Aprikose",
      "Pflaume",
      "Mango"
    ],
    "stage": 1,
    "batch": "1 kleine Portion",
    "ingredients": "Naturjoghurt und weiches Obst nach Auswahl",
    "note": "Pasteurisierten ungesüßten Naturjoghurt mit fein zerdrücktem oder püriertem Obst verrühren. Als kleine Portion oder Teil der einmaligen Milchmahlzeit des Tages einplanen.",
    "freezable": false,
    "searchAliases": [
      "Apfel Joghurt",
      "Birne Joghurt",
      "Banane Joghurt",
      "Marille"
    ],
    "tags": [
      "Joghurt",
      "Löffelgericht"
    ],
    "milkMeal": "small",
    "hardMinMonths": 6,
    "minMonths": 6
  },
  {
    "name": "Obst-Hafer-Joghurt",
    "category": "porridge",
    "requires": [
      "Hafer",
      "Naturjoghurt"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Pfirsich",
      "Aprikose",
      "Pflaume",
      "Mango"
    ],
    "stage": 1,
    "batch": "1 Portion",
    "ingredients": "weich gekochter Hafer, pasteurisierter ungesüßter Naturjoghurt und weiches Obst nach Auswahl",
    "note": "Hafer zuerst in Wasser weich kochen, abkühlen lassen und erst dann Naturjoghurt sowie Obst einrühren.",
    "freezable": true,
    "freezerNote": "Hafer und Obst können gemeinsam eingefroren werden. Joghurt nach dem Auftauen einrühren; komplett gemischt kann sich die Konsistenz trennen.",
    "searchAliases": [
      "Obst-Hafer-Joghurt",
      "Apfel Hafer Joghurt",
      "Birne Hafer Joghurt",
      "Banane Hafer Joghurt",
      "Joghurt-Hafer-Bananenbrei"
    ],
    "tags": [
      "Joghurt",
      "Meal Prep"
    ],
    "milkMeal": "full",
    "legacyNames": [
      "Obst-Hafer-Joghurt",
      "Joghurt-Hafer-Bananenbrei"
    ],
    "family": true,
    "familyLabel": "7 Obstvarianten",
    "variantLabels": [
      "Apfel",
      "Birne",
      "Banane",
      "Pfirsich",
      "Aprikose",
      "Pflaume",
      "Mango"
    ],
    "hardMinMonths": 6,
    "minMonths": 6
  },
  {
    "name": "Obst-Hirse-Joghurt",
    "category": "porridge",
    "requires": [
      "Hirse",
      "Naturjoghurt"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Pfirsich",
      "Aprikose",
      "Pflaume",
      "Mango"
    ],
    "stage": 1,
    "batch": "1 Portion",
    "ingredients": "weich gekochte Hirse, Naturjoghurt und Obst nach Auswahl",
    "note": "Hirse in Wasser weich kochen, abkühlen und mit Naturjoghurt und Obst verrühren.",
    "freezable": true,
    "freezerNote": "Hirse-Obst-Basis einfrieren; Joghurt möglichst nach dem Auftauen ergänzen.",
    "searchAliases": [
      "Apfel Hirse Joghurt",
      "Birne Hirse Joghurt",
      "Marille"
    ],
    "tags": [
      "Joghurt",
      "Meal Prep"
    ],
    "milkMeal": "full",
    "hardMinMonths": 6,
    "minMonths": 6
  },
  {
    "name": "Obst-Grieß-Joghurt",
    "category": "porridge",
    "requires": [
      "Weizen",
      "Naturjoghurt"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Pfirsich",
      "Aprikose",
      "Pflaume",
      "Mango"
    ],
    "stage": 1,
    "batch": "1 Portion",
    "ingredients": "feiner Weizengrieß, Naturjoghurt und Obst nach Auswahl",
    "note": "Grieß in Wasser weich kochen, abkühlen lassen und Naturjoghurt sowie Obst einrühren.",
    "freezable": true,
    "freezerNote": "Grieß-Obst-Basis portionsweise einfrieren; Joghurt nach dem Auftauen ergänzen oder nach dem Auftauen kräftig umrühren.",
    "searchAliases": [
      "Apfel Grieß Joghurt",
      "Birne Grieß Joghurt",
      "Obst Griess Joghurt",
      "Marille"
    ],
    "tags": [
      "Joghurt",
      "Meal Prep"
    ],
    "milkMeal": "full",
    "hardMinMonths": 6,
    "minMonths": 6
  },
  {
    "name": "Buttermilch-Hafer-Obstbrei",
    "category": "porridge",
    "requires": [
      "Buttermilch",
      "Hafer"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Pfirsich",
      "Aprikose",
      "Pflaume",
      "Mango"
    ],
    "stage": 1,
    "minMonths": 6,
    "batch": "1 Portion",
    "ingredients": "weich gekochter Hafer, pasteurisierte ungesüßte Buttermilch und eine bekannte Obstsorte",
    "note": "Hafer in Wasser weich kochen, auf Esstemperatur abkühlen lassen und erst dann Buttermilch sowie Obst einrühren.",
    "freezable": true,
    "freezerNote": "Hafer-Obst-Basis einfrieren; Buttermilch nach dem Auftauen frisch einrühren.",
    "searchAliases": [
      "Apfel Hafer Buttermilch",
      "Banane Hafer Buttermilch",
      "Marille"
    ],
    "tags": [
      "Buttermilch",
      "Meal Prep"
    ],
    "milkMeal": "full",
    "excludeMeat": true,
    "hardMinMonths": 6
  },
  {
    "name": "Buttermilch-Hirse-Obstbrei",
    "category": "porridge",
    "requires": [
      "Buttermilch",
      "Hirse"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Pfirsich",
      "Aprikose",
      "Pflaume",
      "Mango"
    ],
    "stage": 1,
    "minMonths": 6,
    "batch": "1 Portion",
    "ingredients": "weich gekochte Hirse, pasteurisierte ungesüßte Buttermilch und eine bekannte Obstsorte",
    "note": "Hirse in Wasser weich kochen, abkühlen lassen und Buttermilch sowie Obst einrühren.",
    "freezable": true,
    "freezerNote": "Hirse-Obst-Basis einfrieren; Buttermilch erst nach dem Auftauen ergänzen.",
    "searchAliases": [
      "Apfel Hirse Buttermilch",
      "Birne Hirse Buttermilch",
      "Marille"
    ],
    "tags": [
      "Buttermilch",
      "Meal Prep"
    ],
    "milkMeal": "full",
    "excludeMeat": true,
    "hardMinMonths": 6
  },
  {
    "name": "Buttermilch-Grieß-Obstbrei",
    "category": "porridge",
    "requires": [
      "Buttermilch",
      "Weizen"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Pfirsich",
      "Aprikose",
      "Pflaume",
      "Mango"
    ],
    "stage": 1,
    "minMonths": 6,
    "batch": "1 Portion",
    "ingredients": "feiner Weizengrieß, pasteurisierte ungesüßte Buttermilch und eine bekannte Obstsorte",
    "note": "Grieß in Wasser weich kochen, abkühlen lassen und Buttermilch sowie Obst einrühren.",
    "freezable": true,
    "freezerNote": "Grieß-Obst-Basis einfrieren; Buttermilch nach dem Auftauen frisch einrühren.",
    "searchAliases": [
      "Apfel Grieß Buttermilch",
      "Obst Griess Buttermilch",
      "Marille"
    ],
    "tags": [
      "Buttermilch",
      "Meal Prep"
    ],
    "milkMeal": "full",
    "excludeMeat": true,
    "hardMinMonths": 6
  },
  {
    "name": "Joghurt-Nussmus-Miniportion",
    "category": "porridge",
    "requires": [
      "Naturjoghurt"
    ],
    "oneOf": [
      "Erdnuss",
      "Mandel",
      "Cashew",
      "Walnuss",
      "Haselnuss"
    ],
    "stage": 1,
    "batch": "1 Miniportion",
    "ingredients": "Naturjoghurt und sehr kleine Menge bereits erfolgreich eingeführtes glattes Nussmus",
    "note": "Nur nach erfolgreicher Allergeneinführung verwenden; glattes Mus vollständig und dünn in Joghurt einrühren.",
    "freezable": false,
    "tags": [
      "Joghurt",
      "Allergen"
    ],
    "milkMeal": "small",
    "searchAliases": [],
    "hardMinMonths": 6,
    "minMonths": 6
  },
  {
    "name": "Bananen-Joghurt-Hafer-Pancakes",
    "category": "pancakes",
    "requires": [
      "Banane",
      "Naturjoghurt",
      "Hafer",
      "Ei"
    ],
    "stage": 3,
    "batch": "6 Mini-Pancakes",
    "ingredients": "reife Banane, Naturjoghurt, Hafer und Ei",
    "note": "Banane fein zerdrücken und mit Naturjoghurt, Hafer und Ei zu einem gleichmäßigen Teig verrühren. Kleine flache Pancakes bei niedriger Hitze vollständig durchgaren und weich halten; keine harte oder stark gebräunte Kruste entstehen lassen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und portionsweise auftauen.",
    "tags": [
      "Fingerfood",
      "Pfanne",
      "einfrierbar"
    ],
    "milkMeal": "small",
    "searchAliases": [],
    "hardMinMonths": 6,
    "minMonths": 6,
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Obst-Joghurt-Hafer-Ofenbites",
    "category": "baking",
    "requires": [
      "Naturjoghurt",
      "Hafer",
      "Ei"
    ],
    "oneOf": [
      "Apfel",
      "Birne",
      "Banane",
      "Pfirsich",
      "Aprikose",
      "Pflaume",
      "Mango"
    ],
    "stage": 3,
    "batch": "8 weiche Bites",
    "ingredients": "Naturjoghurt, Hafer, Ei und Obst nach Auswahl",
    "note": "Obst fein zerdrücken oder pürieren und mit Naturjoghurt, Hafer und Ei zu einer gleichmäßigen Masse verrühren. In einer flachen Form vollständig, aber weich backen, nicht austrocknen lassen und in gut greifbare Stücke schneiden.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und portionsweise auftauen.",
    "searchAliases": [
      "Apfel Joghurt Ofenbites",
      "Obst Hafer Joghurt Bites",
      "Marille"
    ],
    "tags": [
      "Fingerfood",
      "Backen",
      "einfrierbar"
    ],
    "milkMeal": "small",
    "hardMinMonths": 6,
    "minMonths": 6,
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Zucchini-Joghurt-Hafer-Bites",
    "category": "baking",
    "requires": [
      "Zucchini",
      "Naturjoghurt",
      "Hafer",
      "Ei"
    ],
    "stage": 3,
    "batch": "8 weiche Bites",
    "ingredients": "fein geriebene Zucchini, Naturjoghurt, Hafer und Ei",
    "note": "Geriebene Zucchini bei Bedarf leicht ausdrücken und mit Naturjoghurt, Hafer und Ei zu einer gleichmäßigen Masse verrühren. Flach ausstreichen und vollständig, aber weich backen; keine harte Kruste entstehen lassen. In gut greifbare Stücke schneiden.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und portionsweise auftauen.",
    "tags": [
      "Fingerfood",
      "Backen",
      "einfrierbar"
    ],
    "milkMeal": "small",
    "searchAliases": [],
    "hardMinMonths": 6,
    "minMonths": 6,
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Joghurt-Hafer-Waffeln",
    "category": "baking",
    "requires": [
      "Naturjoghurt",
      "Hafer",
      "Ei"
    ],
    "stage": 4,
    "batch": "4 kleine weiche Waffeln",
    "ingredients": "Naturjoghurt, fein gemahlener Hafer und Ei",
    "note": "Naturjoghurt, fein gemahlenen Hafer und Ei zu einem glatten Teig verrühren. Im Waffeleisen vollständig, aber nur hell und weich ausbacken; harte Kanten abschneiden und vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
    "freezable": true,
    "freezerNote": "Mit Backpapier getrennt einfrieren.",
    "tags": [
      "Snack",
      "Backen",
      "einfrierbar"
    ],
    "milkMeal": "small",
    "minMonths": 10,
    "searchAliases": [],
    "hardMinMonths": 6,
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Weiche Joghurt-Fladen",
    "category": "baking",
    "requires": [
      "Naturjoghurt",
      "Weizen",
      "Ei"
    ],
    "stage": 4,
    "batch": "6 kleine Fladen",
    "ingredients": "Naturjoghurt, Weizenmehl oder feiner Grieß und Ei",
    "note": "Naturjoghurt mit Weizenmehl oder feinem Grieß und Ei zu einem weichen, gleichmäßigen Teig verrühren. Kleine flache Portionen vollständig, aber weich backen; keine harte oder dunkle Kruste entstehen lassen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und portionsweise auftauen.",
    "tags": [
      "Snack",
      "Backen",
      "einfrierbar"
    ],
    "milkMeal": "small",
    "minMonths": 10,
    "searchAliases": [],
    "hardMinMonths": 6,
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Gemüse-Joghurt-Mini-Muffins",
    "category": "baking",
    "requires": [
      "Naturjoghurt",
      "Hafer",
      "Ei"
    ],
    "oneOf": [
      "Zucchini",
      "Karotte",
      "Brokkoli",
      "Süßkartoffel"
    ],
    "stage": 4,
    "batch": "8 Mini-Muffins",
    "ingredients": "pasteurisierter ungesüßter Naturjoghurt, Hafer, Ei, sehr fein vorbereitetes Gemüse nach Auswahl, 1 TL Petersilie oder Schnittlauch",
    "note": "Das gewählte Gemüse sehr weich garen und fein vorbereiten. Mit Naturjoghurt, Hafer, Ei und Petersilie oder Schnittlauch zu einem gleichmäßigen Teig verrühren, in Mini-Formen füllen und ohne Salz oder Zucker vollständig backen. Innen saftig halten und keine harte Kruste entstehen lassen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und portionsweise auftauen.",
    "tags": [
      "Snack",
      "Backen",
      "einfrierbar"
    ],
    "milkMeal": "small",
    "minMonths": 10,
    "legacyNames": [
      "Gemüse-Joghurt-Mini-Muffins",
      "Zucchini-Joghurt-Muffins"
    ],
    "searchAliases": [
      "Gemüse-Joghurt-Mini-Muffins",
      "Zucchini-Joghurt-Muffins"
    ],
    "family": true,
    "familyLabel": "4 Gemüsevarianten",
    "variantLabels": [
      "Zucchini",
      "Karotte",
      "Brokkoli",
      "Süßkartoffel"
    ],
    "hardMinMonths": 6,
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Huhn-Gemüse-Muffins",
    "category": "baking",
    "requires": [
      "Huhn",
      "Hafer",
      "Ei"
    ],
    "oneOf": [
      "Zucchini",
      "Karotte",
      "Brokkoli",
      "Süßkartoffel"
    ],
    "stage": 4,
    "batch": "8 Mini-Muffins",
    "ingredients": "vollständig gegartes fein zerkleinertes Huhn, Hafer, Ei, Gemüse, 1 TL Petersilie, 1–2 EL mild gegarte Zwiebel",
    "note": "Zwiebel mild weich dünsten. Das vollständig gegarte Huhn fein zerkleinern und das gewählte Gemüse sehr weich garen und fein vorbereiten. Alles mit Hafer, Ei, Zwiebel und Petersilie zu einer gleichmäßigen Masse verrühren, in Mini-Formen füllen und vollständig backen. Innen saftig halten und keine harte Kruste entstehen lassen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und vollständig erwärmen.",
    "tags": [
      "Snack",
      "Backen",
      "einfrierbar"
    ],
    "minMonths": 11,
    "excludeMeals": [
      "breakfast"
    ],
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Süßkartoffel-Linsen-Muffins",
    "category": "baking",
    "requires": [
      "Süßkartoffel",
      "Rote Linsen",
      "Hafer"
    ],
    "stage": 4,
    "batch": "8 Mini-Muffins",
    "ingredients": "Süßkartoffelpüree, sehr weich gekochte rote Linsen und Hafer, ¼ TL milder Kreuzkümmel, 1 TL Petersilie",
    "note": "Süßkartoffelpüree mit den sehr weich gekochten roten Linsen, Hafer, mildem Kreuzkümmel und Petersilie zu einem feuchten, gleichmäßigen Teig vermengen. In kleine Formen füllen und vollständig, aber weich backen; nicht austrocknen lassen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und portionsweise auftauen.",
    "tags": [
      "Snack",
      "Backen",
      "einfrierbar"
    ],
    "minMonths": 10,
    "searchAliases": [],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Fleisch-Gemüse-Bällchen",
    "category": "balls",
    "requires": [
      "Rind",
      "Karotte",
      "Kartoffel"
    ],
    "stage": 4,
    "batch": "8 kleine weiche Bällchen",
    "ingredients": "mageres Faschiertes und weich gegartes Gemüse beziehungsweise Kartoffel nach Variante, mild gegarte Zwiebel, 1 TL Petersilie",
    "note": "Zwiebel mild weich dünsten und je nach Variante mit Petersilie ergänzen. Kleine flache oder längliche Stücke statt fester runder Kugeln formen. Vollständig durchgaren, saftig halten, harte Kruste vermeiden und vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
    "freezable": true,
    "freezerNote": "Einzeln vorfrieren und vollständig erwärmen.",
    "tags": [
      "Snack",
      "Fingerfood",
      "einfrierbar"
    ],
    "minMonths": 11,
    "alternatives": [
      [
        "Pute",
        "Süßkartoffel"
      ]
    ],
    "legacyNames": [
      "Rind-Karotte-Kartoffel-Bällchen",
      "Pute-Süßkartoffel-Bällchen"
    ],
    "searchAliases": [
      "Rind-Karotte-Kartoffel-Bällchen",
      "Pute-Süßkartoffel-Bällchen"
    ],
    "family": true,
    "familyLabel": "2 Fleischvarianten",
    "variantLabels": [
      "Rind + Karotte + Kartoffel",
      "Pute + Süßkartoffel"
    ],
    "skillRequirement": "Kann weiche kompakte Fingerfoodstücke sicher abbeißen und kauen. Das Stück muss zwischen zwei Fingern leicht zerdrückbar sein; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Gemüse-Fleisch-Nockerl",
    "category": "family",
    "requires": [
      "Huhn",
      "Zucchini",
      "Weizen",
      "Ei",
      "Rapsöl"
    ],
    "stage": 3,
    "batch": "12–16 kleine weiche Nockerl",
    "ingredients": "vollständig gegartes fein zerkleinertes Huhn, sehr weich gegarte Zucchini, Weizenmehl oder feiner Weizengrieß, Ei und wenig Rapsöl; Varianten mit Rind und Karotte oder roten Linsen und Süßkartoffel",
    "note": "Fleisch beziehungsweise Linsen und Gemüse vollständig garen und sehr fein vorbereiten. Mit Ei, Weizen und wenig Rapsöl zu einem weichen Teig verrühren. Kleine Nockerl in siedendem Wasser vollständig garen, ein Stück aufschneiden und die weiche, durchgegarte Konsistenz prüfen. Als weiche Stücke anbieten oder bei Bedarf zerdrücken.",
    "freezable": true,
    "freezerNote": "Gegarte Nockerl einzeln vorfrieren, portionsweise verpacken und nach dem Auftauen vollständig erwärmen.",
    "tags": [
      "Fingerfood",
      "Familiengericht",
      "einfrierbar"
    ],
    "alternatives": [
      [
        "Rind",
        "Karotte",
        "Weizen",
        "Ei",
        "Rapsöl"
      ],
      [
        "Rote Linsen",
        "Süßkartoffel",
        "Weizen",
        "Ei",
        "Rapsöl"
      ]
    ],
    "searchAliases": [
      "Huhn-Zucchini-Nockerl",
      "Rind-Karotten-Nockerl",
      "Linsen-Süßkartoffel-Nockerl",
      "Gemüse-Fleisch-Spätzle",
      "Baby-Spätzle"
    ],
    "family": true,
    "familyLabel": "3 Varianten",
    "variantLabels": [
      "Huhn + Zucchini",
      "Rind + Karotte",
      "Rote Linsen + Süßkartoffel"
    ],
    "skillRequirement": "Kann sehr weiche Stücke sicher im Mund bewegen und kauen. Die Nockerl müssen vollständig durchgegart sein und sich zwischen zwei Fingern leicht zerdrücken lassen; nur aufrecht sitzend und direkt beaufsichtigt anbieten."
  },
  {
    "name": "Bohnen-Kartoffel-Stampf",
    "category": "family",
    "requires": [
      "Kartoffel"
    ],
    "stage": 2,
    "batch": "4–6 kleine Portionen",
    "ingredients": "sehr weich gekochte Kartoffel und sehr weich gegarte weiße oder schwarze Bohnen ohne zugesetztes Salz, 1 TL Petersilie; optional Butter oder wenig Rapsöl",
    "note": "Bohnen vollständig weich garen, bei Bedarf Schalen entfernen und gemeinsam mit Kartoffel, Petersilie und Butter oder Rapsöl fein zerdrücken. Je nach aktueller Konsistenzstufe glatt, grob gestampft oder mit sehr weichen kleinen Stückchen anbieten. Keine gesüßten oder stark gesalzenen Bohnenkonserven verwenden.",
    "freezable": true,
    "freezerNote": "In kleinen Portionen einfrieren, vollständig auftauen und gleichmäßig erwärmen.",
    "tags": [
      "Löffelgericht",
      "Hülsenfrüchte",
      "Meal Prep"
    ],
    "oneOf": [
      "Weiße Bohnen",
      "Schwarze Bohnen"
    ],
    "searchAliases": [
      "Weiße-Bohnen-Kartoffel-Stampf",
      "Schwarze-Bohnen-Kartoffel-Stampf",
      "Bohnen-Kartoffel-Brei"
    ],
    "family": true,
    "familyLabel": "2 Bohnenvarianten",
    "variantLabels": [
      "Weiße Bohnen",
      "Schwarze Bohnen"
    ]
  }
];

const LEGACY_RECIPE_NAMES = [
  "Banane-Hafer-Pancakes",
  "Apfel-Hafer-Pancakes",
  "Birne-Hirse-Pancakes",
  "Kürbis-Hafer-Pancakes",
  "Zucchini-Hafer-Pancakes",
  "Süßkartoffel-Pancakes",
  "Mango-Hafer-Pancakes",
  "Ube-Bananen-Pancakes",
  "Rind-Hafer-Bällchen",
  "Huhn-Zucchini-Hafer-Bällchen",
  "Pute-Karotten-Bällchen",
  "Lachs-Kartoffel-Bällchen",
  "Rote-Linsen-Gemüsebällchen",
  "Tofu-Brokkoli-Bällchen",
  "Brokkoli-Kartoffel-Taler",
  "Zucchini-Hafer-Puffer",
  "Kichererbsen-Kürbis-Taler",
  "Rote-Linsen-Bratlinge",
  "Polenta-Gemüse-Sticks",
  "Süßkartoffel-Hirse-Sticks",
  "Omelettstreifen",
  "Zucchini-Omelett",
  "Obst-Haferbrei",
  "Obst-Hirsebrei",
  "Obst-Polentabrei",
  "Obst-Reisbrei",
  "Obst-Quinoabrei",
  "Obst-Buchweizenbrei",
  "Obst-Grießbrei",
  "Milch-Getreide-Brei",
  "Baby-Bananenbrot",
  "Kürbis-Hafer-Brei",
  "Gemüse-Nudel-Sauce",
  "Baby-Linsen-Bolognese",
  "Lugaw-Basis",
  "Kürbis-Lugaw",
  "Monggo-Kalabasa-Brei",
  "Tinola-inspiriert",
  "Arroz-caldo-inspiriert",
  "Kalabasa mit Kokos",
  "Tilapia-Reis-Brei",
  "Bangus-Kartoffel-Taler",
  "Bananen-Hafer-Muffins",
  "Obst-Hafer-Muffins",
  "Zucchini-Hafer-Muffins",
  "Kürbis-Hirse-Muffins",
  "Karotten-Polenta-Brei",
  "Süßkartoffel-Rote-Linsen-Brei",
  "Zucchini-Quinoa-Brei",
  "Kichererbsenmehl-Zucchini-Taler",
  "Bananen-Haferbrei mit Erdnussmus",
  "Karotten-Hirse-Brei mit Tahin",
  "Apfel-Hirse-Brei mit Mandelmus",
  "Apfel-Birnen-Kompott",
  "Karotte-Süßkartoffel-Brei",
  "Brokkoli-Kartoffel-Stampf",
  "Karfiol-Kartoffel-Stampf",
  "Zucchini-Kartoffel-Brei",
  "Erbsen-Kartoffel-Stampf",
  "Kürbis-Linsen-Suppe",
  "Mildes Rote-Linsen-Dhal",
  "Huhn-Karotte-Nudel-Topf",
  "Huhn-Lauch-Kartoffel-Topf",
  "Huhn-Brokkoli-Reis",
  "Rind-Gemüse-Bolognese",
  "Tomaten-Linsen-Sauce",
  "Brokkoli-Linsen-Pasta",
  "Gemüse-Pasta mit Zucchini und Tomate",
  "Lachs-Reis-Erbsen",
  "Lachs-Süßkartoffel-Stampf",
  "Kabeljau-Tomaten-Gemüse",
  "Weiches Rührei",
  "Eier-Finger",
  "Paprika-Omelettstreifen",
  "Ei-Champignon-Cups",
  "Hummus mit weichen Gemüsesticks",
  "Kürbis-Kichererbsen-Creme",
  "Avocado-Bananen-Creme",
  "Buchweizen-Bananen-Pancakes",
  "Polenta-Zucchini-Sticks",
  "Süßkartoffel-Linsen-Taler",
  "Tofu-Zucchini-Reis",
  "Gebackene Saba-Banane",
  "Huhn-Lugaw",
  "Sayote-Huhn-Reis",
  "Monggo-Süßkartoffel-Brei",
  "Ube-Hafer-Brei",
  "Obst-Joghurt",
  "Obst-Hafer-Joghurt",
  "Obst-Hirse-Joghurt",
  "Obst-Grieß-Joghurt",
  "Buttermilch-Hafer-Obstbrei",
  "Buttermilch-Hirse-Obstbrei",
  "Buttermilch-Grieß-Obstbrei",
  "Joghurt-Hafer-Bananenbrei",
  "Joghurt-Nussmus-Miniportion",
  "Bananen-Joghurt-Hafer-Pancakes",
  "Obst-Joghurt-Hafer-Ofenbites",
  "Zucchini-Joghurt-Hafer-Bites",
  "Joghurt-Hafer-Waffeln",
  "Weiche Joghurt-Fladen",
  "Gemüse-Joghurt-Mini-Muffins",
  "Huhn-Gemüse-Muffins",
  "Ei-Hafer-Gemüse-Muffins",
  "Süßkartoffel-Linsen-Muffins",
  "Zucchini-Joghurt-Muffins",
  "Rind-Karotte-Kartoffel-Bällchen",
  "Pute-Süßkartoffel-Bällchen"
];
