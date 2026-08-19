"use strict";

/* Rezeptdaten – Version 10.0.0 konsolidiert
 * 101 kanonische Rezeptkarten; alle 109 historischen Namen bleiben über Aliase migrationssicher auffindbar.
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
    "note": "Kleine flache Pancakes formen und vollständig durchgaren.",
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
    "note": "Dünne weiche Pancakes vollständig durchgaren und passend zuschneiden.",
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
    "note": "Ube vollständig garen, fein zerdrücken und die Pancakes weich durchbacken.",
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
    "ingredients": "100 g Faschiertes vom Rind, 2 EL feine Haferflocken, 1 Ei",
    "note": "Kleine längliche oder flache Stücke formen und vollständig durchgaren. Keine harten Krusten oder runden festen Kugeln.",
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
    "ingredients": "Geflügelfaschiertes, sehr fein vorbereitetes Gemüse und Hafer nach Variante",
    "note": "Kleine flache oder längliche Stücke statt fester runder Kugeln formen. Vollständig durchgaren, saftig halten, harte Kruste vermeiden und vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
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
    "ingredients": "50 g vollständig gegarter, grätenfreier Lachs, 100 g weiche Kartoffel",
    "note": "Sehr sorgfältig entgräten, zerdrücken, flach formen und weich erwärmen oder backen.",
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
    "ingredients": "4 EL sehr weich gekochte rote Linsen, 2 EL Karottenpüree, 1 EL Haferflocken",
    "note": "Flach formen und vollständig garen; nicht trocken oder krümelig anbieten.",
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
    "ingredients": "80 g Naturtofu, 3 EL sehr weicher Brokkoli, 1 EL Haferflocken",
    "note": "Fein zerdrücken, flach formen und vollständig erhitzen; weich servieren.",
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
    "ingredients": "gleich viel sehr weicher Brokkoli und Kartoffel",
    "note": "Zerdrücken, flach formen und nur leicht erwärmen oder weich backen.",
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
    "ingredients": "3 EL fein geriebene Zucchini, 2 EL Haferflocken, 1 Ei",
    "note": "Dünn und weich vollständig durchgaren; keine knusprige harte Kante.",
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
    "ingredients": "4 EL sehr weiche Kichererbsen, 3 EL Kürbispüree",
    "note": "Sehr fein zerdrücken, flach formen und weich garen; bei Bedarf etwas Hafer als Binder nur nach Einführung.",
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
    "ingredients": "5 EL sehr weich gekochte rote Linsen, 1–2 EL Haferflocken",
    "note": "Flach formen und vollständig garen; weich und saftig statt trocken anbieten.",
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
    "ingredients": "dicke weiche Polenta und fein gegarte Zucchini",
    "note": "In breite gut greifbare Sticks schneiden, weich lassen und eine harte oder trockene Kruste vermeiden.",
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
    "ingredients": "1 Ei, bei Bedarf etwas Wasser",
    "note": "Gut durchgaren, weich halten und in breite greifbare Streifen schneiden.",
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
    "ingredients": "1 Ei, 1–2 EL fein geriebene Zucchini",
    "note": "Vollständig durchgaren und weich in Streifen oder kleine Stücke schneiden.",
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
    "note": "Hirseflocken weich kochen und mit einer bekannten Obstsorte kombinieren.",
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
    "note": "Polenta weich kochen und die Obstsorte danach untermischen.",
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
    "note": "Sehr weich kochen, bei Bedarf pürieren und mit einer bekannten Obstsorte kombinieren.",
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
    "note": "Weich kochen und mit einer bekannten Obstsorte kombinieren.",
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
    "note": "Grieß glatt und weich kochen. Die bekannte Obstsorte danach untermischen.",
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
    "note": "Herzhafte Kombination ohne Salz; Rapsöl kann nach dem Erwärmen optional ergänzt werden.",
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
    "ingredients": "sehr weich gekochte Nudeln, Zucchini, geschälte gegarte Tomate",
    "note": "Sauce ohne Salz und Zucker; Nudeln sehr weich und passend klein anbieten.",
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
    "ingredients": "rote Linsen, gegarte Tomate, sehr weiche Nudeln",
    "note": "Linsen sehr weich kochen; Sauce saftig halten und ohne Salz zubereiten.",
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
    "ingredients": "Reis, Wasser, vollständig gegartes Huhn",
    "note": "Als sehr weichen Reisbrei kochen. Babyportion ohne Salz, Brühewürfel oder Fischsauce.",
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
    "note": "Sehr weich kochen und je nach Konsistenz pürieren oder zerdrücken.",
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
    "ingredients": "sehr weich gekochte Mungbohnen und Kürbis",
    "note": "Mungbohnen sehr weich garen; Malunggay erst ergänzen, wenn separat kennengelernt.",
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
    "ingredients": "Huhn, Sayote, kleine Menge Malunggay, Wasser",
    "note": "Alles sehr weich garen; Babyportion ohne Salz, Brühewürfel und Fischsauce.",
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
    "ingredients": "Reis, Huhn, eine sehr kleine Menge Ingwer, Wasser",
    "note": "Sehr mild und weich kochen; ohne Salz und Fertigbrühe.",
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
    "note": "Weich garen; Kokosmilch als Zutat und nicht als Getränk verwenden.",
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
    "note": "Fisch sorgfältig auf Gräten prüfen und mit weichem Reis zerdrücken.",
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
    "ingredients": "vollständig gegarter, äußerst sorgfältig entgräteter Bangus und Kartoffel",
    "note": "Bangus hat viele feine Gräten: nur verwenden, wenn wirklich vollständig entgrätet; flach und weich formen.",
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
    "note": "Ohne Zucker oder Salz vollständig backen, innen saftig halten und keine harte Kruste entstehen lassen. Vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
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
    "note": "Ohne Salz vollständig backen, innen saftig halten und keine harte Kruste entstehen lassen. Vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
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
    "note": "Weich backen und vor dem Servieren auf eine saftige, leicht zerdrückbare Konsistenz prüfen.",
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
    "note": "Nur nach sicherer Einführung von Erdnuss verwenden. Erdnussmus sehr glatt und dünn in den fertigen Brei einrühren.",
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
    "note": "Nur nach sicherer Einführung von Sesam verwenden. Tahin glatt und sparsam in die servierte Portion rühren.",
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
    "note": "Nur nach sicherer Einführung von Mandel verwenden. Mandelmus glatt in die fertige Portion einrühren.",
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
    "ingredients": "Kürbis, rote Linsen, Wasser, optional milde Kräuter",
    "note": "Alles sehr weich köcheln und je nach Stufe pürieren oder grob zerdrücken. Ohne Salz kochen.",
    "freeze": "gut einfrierbar",
    "freezable": true,
    "freezerNote": "Rasch abkühlen, in Mahlzeitenportionen einfrieren und vollständig durcherhitzen.",
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
    "ingredients": "rote Linsen, Wasser, optional wenig Kurkuma",
    "note": "Linsen sehr weich und cremig kochen. Für Babys mild halten und ohne Salz zubereiten.",
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
    "ingredients": "Huhn, Karotte, kleine Nudeln, Wasser",
    "note": "Huhn vollständig durchgaren, Karotte und Nudeln sehr weich kochen und alles passend zerkleinern.",
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
    "ingredients": "Huhn, Lauch, Kartoffel, Wasser",
    "note": "Alles vollständig weich garen. Huhn fein zerkleinern und mit Gemüse sowie Kartoffel vermengen.",
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
    "ingredients": "Huhn, Brokkoli, sehr weich gekochter Reis",
    "note": "Huhn vollständig durchgaren, Brokkoli weich dämpfen und mit sehr weichem Reis passend zerdrücken.",
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
    "ingredients": "Rind, Karotte, Tomate, Wasser, optional Kräuter",
    "note": "Rind vollständig garen und mit weich gekochtem Gemüse zu einer feinen Sauce verarbeiten. Zu Nudeln oder Polenta servieren.",
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
    "ingredients": "Tomate, rote Linsen, Wasser, optional Basilikum",
    "note": "Linsen in der Tomatensauce sehr weich kochen und fein pürieren oder zerdrücken.",
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
    "ingredients": "Brokkoli, rote Linsen, sehr weiche Nudeln",
    "note": "Brokkoli und Linsen weich zu einer Sauce kochen. Mit kleinen sehr weichen Nudeln mischen.",
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
    "ingredients": "Zucchini, Tomate, sehr weiche Nudeln",
    "note": "Gemüse weich zu einer Sauce garen und mit sehr weichen kleinen Nudeln vermengen.",
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
    "ingredients": "Lachs, Reis, Erbsen, Wasser",
    "note": "Lachs vollständig garen und sorgfältig auf Gräten prüfen. Mit sehr weichem Reis und weichen Erbsen zerdrücken.",
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
    "ingredients": "Lachs, Süßkartoffel",
    "note": "Lachs vollständig garen, auf Gräten prüfen und fein mit weicher Süßkartoffel vermengen.",
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
    "ingredients": "Kabeljau, Tomate, Zucchini",
    "note": "Fisch vollständig garen und sorgfältig auf Gräten prüfen. Mit weich gegartem Gemüse zerkleinern.",
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
    "ingredients": "Ei, optional wenig Wasser oder bereits eingeführte Milch als Zutat",
    "note": "Ei vollständig stocken lassen, dabei weich halten und in passende kleine Stücke teilen.",
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
    "ingredients": "Ei, sehr fein geschnittene weich gegarte Paprika",
    "note": "Omelett vollständig durchgaren, weich halten und in breite gut greifbare Streifen schneiden.",
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
    "ingredients": "Ei, fein gehackte weich gegarte Champignons",
    "note": "In kleinen Formen vollständig durchbacken. Für Babys weich und ohne Salz zubereiten.",
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
      "Kichererbse",
      "Sesam",
      "Gurke"
    ],
    "alternatives": [
      [
        "Kichererbse",
        "Gurke"
      ]
    ],
    "stage": 3,
    "batch": "3 kleine Portionen",
    "ingredients": "weich gekochte Kichererbsen, optional Tahin, Wasser, sehr weiche Gemüsesticks",
    "note": "Kichererbsen sehr glatt pürieren. Tahin nur nach eingeführtem Sesam verwenden. Gemüse weich und sicher greifbar anbieten.",
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
    "ingredients": "Kürbis, weich gekochte Kichererbsen, Wasser",
    "note": "Kichererbsen und Kürbis sehr weich garen und glatt pürieren oder fein zerdrücken.",
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
    "ingredients": "Naturtofu, Zucchini, sehr weich gekochter Reis",
    "note": "Naturtofu vollständig erhitzen, fein zerdrücken und mit weicher Zucchini und Reis vermengen.",
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
    "ingredients": "Huhn, Reis, viel Wasser, optional wenig Ingwer nach Einführung",
    "note": "Reis sehr weich zu einem dicken Brei kochen. Huhn vollständig garen, sehr fein zerkleinern und untermischen.",
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
    "ingredients": "Sayote, Huhn, Reis, Wasser",
    "note": "Sayote und Reis sehr weich garen, Huhn vollständig durchgaren und alles passend zerkleinern.",
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
    "ingredients": "Mungbohnen, Süßkartoffel, Wasser",
    "note": "Mungbohnen sehr weich kochen und mit Süßkartoffel pürieren oder fein zerdrücken.",
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
    "note": "Kleine flache Pancakes bei niedriger Hitze vollständig durchgaren und weich halten.",
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
    "note": "In einer flachen Form weich backen, nicht austrocknen lassen und in gut greifbare Stücke schneiden.",
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
    "note": "Flach und weich backen; vollständig durchgaren, aber keine harte Kruste entstehen lassen.",
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
    "note": "Im Waffeleisen nur hell und weich ausbacken; harte Kanten abschneiden.",
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
    "note": "Kleine flache Portionen vollständig, aber weich backen. Keine harte oder dunkle Kruste.",
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
    "ingredients": "pasteurisierter ungesüßter Naturjoghurt, Hafer, Ei und sehr fein vorbereitetes Gemüse nach Auswahl",
    "note": "Ohne Salz oder Zucker vollständig backen, innen saftig halten und keine harte Kruste entstehen lassen. Vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
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
    "ingredients": "vollständig gegartes fein zerkleinertes Huhn, Hafer, Ei und Gemüse",
    "note": "Kleine Muffins vollständig durchgaren und saftig halten; keine harte Kruste.",
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
    "ingredients": "Süßkartoffelpüree, sehr weich gekochte rote Linsen und Hafer",
    "note": "Zu einem feuchten Teig mischen, vollständig backen und weich halten.",
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
    "ingredients": "mageres Faschiertes und weich gegartes Gemüse beziehungsweise Kartoffel nach Variante",
    "note": "Kleine flache oder längliche Stücke statt fester runder Kugeln formen. Vollständig durchgaren, saftig halten, harte Kruste vermeiden und vor dem Servieren auf leichte Zerdrückbarkeit prüfen.",
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
    "ingredients": "sehr weich gekochte Kartoffel und sehr weich gegarte weiße oder schwarze Bohnen ohne zugesetztes Salz; optional wenig Rapsöl",
    "note": "Bohnen vollständig weich garen, bei Bedarf Schalen entfernen und gemeinsam mit Kartoffel fein zerdrücken. Je nach aktueller Konsistenzstufe glatt, grob gestampft oder mit sehr weichen kleinen Stückchen anbieten. Keine gesüßten oder stark gesalzenen Bohnenkonserven verwenden.",
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
