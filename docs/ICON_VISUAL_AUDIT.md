# Visueller Audit: FOOD-V2- und Recipe-V2-Icons

- **Audit-Datum:** 2026-08-21
- **Geprüfter Remote-main-SHA:** `6376520be9993c0f1960b80411c8cf1de4119ad4` (gegen `origin/main` verifiziert)
- **App-Version:** 10.1.26 (`VERSION.json` und `package.json` konsistent)
- **Produktive FOOD-V2-Icons:** 210
- **Produktive Recipe-V2-Icons:** 100
- **Regeln:** `AGENTS.md`, `docs/AI_WORKFLOW.md`, `docs/ICON_GUIDELINES.md` und die dokumentierten Freigaben in `docs/RECIPE_ICON_AUDIT_MIGRATION.md`. Freigegebene/hashgeschützte Recipe-Icons wurden nur bei objektivem Fehler beanstandet.
- **Methode:** Aktive Runtime-Mappings wurden aus `FOOD_ICON_PATHS`/`RECIPE_ICON_PATHS` gegen aktive FOODs und `data/recipes.js` aufgelöst. Alle SVGs wurden lokal mit Sharp gerendert und auf beschrifteten Kontaktbögen bei 128 px sowie 27 px visuell geprüft. Technisch wurden Canvas/Alpha, Alpha-Bounding-Box ab Alpha ≥ 16, FOOD-Längsachse, Mittelpunkt und Randkontakt gemessen. Exakte Pixel-Hashes und 64-Bit-dHash lieferten Duplikat-Kandidaten; nur visuell auffällige Paare sind unten dokumentiert.

## FOOD-V2

| ID | Name | Asset | Status | Prio | Befund | Empfehlung |
| --- | --- | --- | --- | --- | --- | --- |
| karotte | Karotte | `assets/illustrations-v2/foods/karotte.svg` | OK | — | — | — |
| kartoffel | Kartoffel | `assets/illustrations-v2/foods/kartoffel.svg` | OK | — | — | — |
| zucchini | Zucchini | `assets/illustrations-v2/foods/zucchini.svg` | OK | — | — | — |
| rind | Rind | `assets/illustrations-v2/foods/rind.svg` | OK | — | — | — |
| brokkoli | Brokkoli | `assets/illustrations-v2/foods/brokkoli.svg` | OK | — | — | — |
| banane | Banane | `assets/illustrations-v2/foods/banane.svg` | OK | — | — | — |
| hafer | Hafer | `assets/illustrations-v2/foods/hafer.svg` | OK | — | — | — |
| apfel | Apfel | `assets/illustrations-v2/foods/apfel.svg` | OK | — | — | — |
| ei | Ei | `assets/illustrations-v2/foods/ei.svg` | OK | — | — | — |
| birne | Birne | `assets/illustrations-v2/foods/birne.svg` | OK | — | — | — |
| huhn | Huhn | `assets/illustrations-v2/foods/huhn.svg` | OK | — | — | — |
| hirse | Hirse | `assets/illustrations-v2/foods/hirse.svg` | REVIEW | P2 | Technik: sichtbare Achse 61,72 %, Mittelpunkt Δx 8,5 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| karfiol | Karfiol | `assets/illustrations-v2/foods/karfiol.svg` | OK | — | — | — |
| suesskartoffel | Süßkartoffel | `assets/illustrations-v2/foods/suesskartoffel.svg` | OK | — | — | — |
| rote-linsen | Rote Linsen | `assets/illustrations-v2/foods/rote-linsen.svg` | OK | — | — | — |
| erdnuss | Erdnuss | `assets/illustrations-v2/foods/erdnuss.svg` | OK | — | — | — |
| weizen | Weizen | `assets/illustrations-v2/foods/weizen.svg` | OK | — | — | — |
| lachs | Lachs | `assets/illustrations-v2/foods/lachs.svg` | OK | — | — | — |
| rapsoel | Rapsöl | `assets/illustrations-v2/foods/rapsoel.svg` | REVIEW | P3 | Technik: sichtbare Achse 75,00 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| sesam | Sesam | `assets/illustrations-v2/foods/sesam.svg` | OK | — | — | — |
| erbsen-tk-moeglich | Erbsen (TK möglich) | `assets/illustrations-v2/foods/erbsen-tk-moeglich.svg` | OK | — | — | — |
| kuhmilch | Kuhmilch | `assets/illustrations-v2/foods/kuhmilch.svg` | REVIEW | P2 | Technik: sichtbare Achse 72,66 %, Mittelpunkt Δx 16,5 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| kuerbis | Kürbis | `assets/illustrations-v2/foods/kuerbis.svg` | OK | — | — | — |
| naturjoghurt | Naturjoghurt | `assets/illustrations-v2/foods/naturjoghurt.svg` | OK | — | — | — |
| buttermilch | Buttermilch | `assets/illustrations-v2/foods/buttermilch.svg` | OK | — | — | — |
| mais-polenta | Mais | `assets/illustrations-v2/foods/mais-polenta.svg` | OK | — | — | — |
| avocado | Avocado | `assets/illustrations-v2/foods/avocado.svg` | OK | — | — | — |
| kohlrabi | Kohlrabi | `assets/illustrations-v2/foods/kohlrabi.svg` | OK | — | — | — |
| mango | Mango | `assets/illustrations-v2/foods/mango.svg` | OK | — | — | — |
| reis | Reis | `assets/illustrations-v2/foods/reis.svg` | OK | — | — | — |
| kichererbse | Kichererbse | `assets/illustrations-v2/foods/kichererbse.svg` | OK | — | — | — |
| gruene-bohnen | Grüne Bohnen (Fisolen) | `assets/illustrations-v2/foods/bohne.svg` | REVIEW | P3 | Technik: sichtbare Achse 82,81 %, Mittelpunkt Δx 1 px / Δy -3,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| papaya | Papaya | `assets/illustrations-v2/foods/papaya.svg` | OK | — | — | — |
| mungbohne | Mungbohne | `assets/illustrations-v2/foods/mungbohne.svg` | OK | — | — | — |
| pflaume | Pflaume | `assets/illustrations-v2/foods/pflaume.svg` | OK | — | — | — |
| pfirsich | Pfirsich | `assets/illustrations-v2/foods/pfirsich.svg` | OK | — | — | — |
| pute | Pute | `assets/illustrations-v2/foods/pute.svg` | OK | — | — | — |
| gurke | Gurke | `assets/illustrations-v2/foods/gurke.svg` | OK | — | — | — |
| kabeljau | Kabeljau | `assets/illustrations-v2/foods/kabeljau.svg` | OK | — | — | — |
| tomate | Tomate | `assets/illustrations-v2/foods/tomate.svg` | OK | — | — | — |
| paprika | Paprika | `assets/illustrations-v2/foods/paprika.svg` | OK | — | — | — |
| heidelbeere | Heidelbeere | `assets/illustrations-v2/foods/heidelbeere.svg` | OK | — | — | — |
| sellerie | Knollensellerie | `assets/illustrations-v2/foods/knollensellerie.svg` | OK | — | — | — |
| mandel | Mandel | `assets/illustrations-v2/foods/mandel.svg` | OK | — | — | — |
| rote-ruebe | Rote Rübe | `assets/illustrations-v2/foods/rote-ruebe.svg` | OK | — | — | — |
| lauch | Lauch | `assets/illustrations-v2/foods/lauch.svg` | OK | — | — | — |
| spinat | Spinat | `assets/illustrations-v2/foods/spinat.svg` | OK | — | — | — |
| quinoa | Quinoa | `assets/illustrations-v2/foods/quinoa.svg` | OK | — | — | — |
| kiwi | Kiwi | `assets/illustrations-v2/foods/kiwi.svg` | OK | — | — | — |
| mandarine | Mandarine | `assets/illustrations-v2/foods/mandarine.svg` | OK | — | — | — |
| schwein | Schwein | `assets/illustrations-v2/foods/schwein.svg` | OK | — | — | — |
| lamm | Lamm | `assets/illustrations-v2/foods/lamm.svg` | KLARER FEHLER | P1 | Gegartes Kotelett mit dominant sichtbarem Knochen; für die baby-/familienfreundliche FOOD-Darstellung ungeeignet. | Knochenfreie, gegarte und appetitliche Lammportion verwenden. |
| soja-tofu | Tofu | `assets/illustrations-v2/foods/soja-tofu.svg` | OK | — | — | — |
| roggen | Roggen | `assets/illustrations-v2/foods/roggen.svg` | OK | — | — | — |
| gerste | Gerste | `assets/illustrations-v2/foods/gerste.svg` | OK | — | — | — |
| wirsing | Wirsing | `assets/illustrations-v2/foods/wirsing.svg` | OK | — | — | — |
| aubergine | Aubergine | `assets/illustrations-v2/foods/aubergine.svg` | REVIEW | P3 | Technik: sichtbare Achse 75,00 %, Mittelpunkt Δx -0,5 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| walnuss | Walnuss | `assets/illustrations-v2/foods/walnuss.svg` | OK | — | — | — |
| zimt | Zimt | `assets/illustrations-v2/foods/zimt.svg` | OK | — | — | — |
| rosenkohl | Rosenkohl | `assets/illustrations-v2/foods/rosenkohl.svg` | OK | — | — | — |
| weisskraut | Weißkraut | `assets/illustrations-v2/foods/weisskraut.svg` | OK | — | — | — |
| rotkraut | Rotkraut | `assets/illustrations-v2/foods/rotkraut.svg` | OK | — | — | — |
| maroni | Maroni | `assets/illustrations-v2/foods/maroni.svg` | OK | — | — | — |
| buchweizen | Buchweizen | `assets/illustrations-v2/foods/buchweizen.svg` | OK | — | — | — |
| amaranth | Amaranth | `assets/illustrations-v2/foods/amaranth.svg` | OK | — | — | — |
| kaki | Kaki | `assets/illustrations-v2/foods/kaki.svg` | OK | — | — | — |
| forelle | Forelle | `assets/illustrations-v2/foods/forelle.svg` | OK | — | — | — |
| weisse-bohnen | Weiße Bohnen | `assets/illustrations-v2/foods/weisse-bohnen.svg` | OK | — | — | — |
| zwiebel | Zwiebel | `assets/illustrations-v2/foods/zwiebel.svg` | OK | — | — | — |
| knoblauch | Knoblauch | `assets/illustrations-v2/foods/knoblauch.svg` | OK | — | — | — |
| petersilie | Petersilie | `assets/illustrations-v2/foods/petersilie.svg` | OK | — | — | — |
| basilikum | Basilikum | `assets/illustrations-v2/foods/basilikum.svg` | OK | — | — | — |
| oregano | Oregano | `assets/illustrations-v2/foods/oregano.svg` | OK | — | — | — |
| haselnuss | Haselnuss | `assets/illustrations-v2/foods/haselnuss.svg` | OK | — | — | — |
| steckruebe | Steckrübe | `assets/illustrations-v2/foods/steckruebe.svg` | OK | — | — | — |
| schwarzwurzel | Schwarzwurzel | `assets/illustrations-v2/foods/schwarzwurzel.svg` | OK | — | — | — |
| topinambur | Topinambur | `assets/illustrations-v2/foods/topinambur.svg` | OK | — | — | — |
| gelbe-linsen | Gelbe Linsen | `assets/illustrations-v2/foods/gelbe-linsen.svg` | OK | — | — | — |
| schwarze-bohnen | Schwarze Bohnen | `assets/illustrations-v2/foods/schwarze-bohnen.svg` | OK | — | — | — |
| seelachs | Seelachs | `assets/illustrations-v2/foods/seelachs.svg` | OK | — | — | — |
| kokos | Kokos | `assets/illustrations-v2/foods/kokos.svg` | OK | — | — | — |
| ananas | Ananas | `assets/illustrations-v2/foods/ananas.svg` | REVIEW | P3 | Technik: sichtbare Achse 75,00 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| granatapfel | Granatapfel | `assets/illustrations-v2/foods/granatapfel.svg` | OK | — | — | — |
| sonnenblumenkerne | Sonnenblumenkerne | `assets/illustrations-v2/foods/sonnenblumenkerne.svg` | OK | — | — | — |
| kuerbiskerne | Kürbiskerne | `assets/illustrations-v2/foods/kuerbiskerne.svg` | OK | — | — | — |
| dill | Dill | `assets/illustrations-v2/foods/dill.svg` | OK | — | — | — |
| thymian | Thymian | `assets/illustrations-v2/foods/thymian.svg` | OK | — | — | — |
| majoran | Majoran | `assets/illustrations-v2/foods/majoran.svg` | OK | — | — | — |
| rosmarin | Rosmarin | `assets/illustrations-v2/foods/rosmarin.svg` | OK | — | — | — |
| cashew | Cashew | `assets/illustrations-v2/foods/cashew.svg` | OK | — | — | — |
| champignon | Champignon | `assets/illustrations-v2/foods/champignon.svg` | OK | — | — | — |
| pak-choi | Pak Choi | `assets/illustrations-v2/foods/pak-choi.svg` | OK | — | — | — |
| okra | Okra | `assets/illustrations-v2/foods/okra.svg` | OK | — | — | — |
| schwarze-linsen | Schwarze Linsen | `assets/illustrations-v2/foods/schwarze-linsen.svg` | OK | — | — | — |
| melone | Melone | `assets/illustrations-v2/foods/melone.svg` | OK | — | — | — |
| guave | Guave | `assets/illustrations-v2/foods/guave.svg` | OK | — | — | — |
| drachenfrucht | Drachenfrucht | `assets/illustrations-v2/foods/drachenfrucht.svg` | OK | — | — | — |
| pistazie | Pistazie | `assets/illustrations-v2/foods/pistazie.svg` | OK | — | — | — |
| garnele | Garnele | `assets/illustrations-v2/foods/garnele.svg` | OK | — | — | — |
| leinsamen | Leinsamen | `assets/illustrations-v2/foods/leinsamen.svg` | OK | — | — | — |
| koriandergruen | Koriandergrün | `assets/illustrations-v2/foods/koriandergruen.svg` | OK | — | — | — |
| kurkuma | Kurkuma | `assets/illustrations-v2/foods/kurkuma.svg` | OK | — | — | — |
| ingwer | Ingwer | `assets/illustrations-v2/foods/ingwer.svg` | OK | — | — | — |
| vanille | Vanille | `assets/illustrations-v2/foods/vanille.svg` | OK | — | — | — |
| wassermelone | Wassermelone | `assets/illustrations-v2/foods/wassermelone.svg` | OK | — | — | — |
| orange | Orange | `assets/illustrations-v2/foods/orange.svg` | OK | — | — | — |
| erdbeere | Erdbeere | `assets/illustrations-v2/foods/erdbeere.svg` | OK | — | — | — |
| himbeere | Himbeere | `assets/illustrations-v2/foods/himbeere.svg` | OK | — | — | — |
| aprikose | Aprikose | `assets/illustrations-v2/foods/aprikose.svg` | OK | — | — | — |
| nudeln-pasta | Nudeln | `assets/illustrations-v2/foods/nudeln-pasta.svg` | OK | — | — | — |
| dinkel | Dinkel | `assets/illustrations-v2/foods/dinkel.svg` | OK | — | — | — |
| saba-banane | Saba-Banane | `assets/illustrations-v2/foods/saba-banane.svg` | OK | — | — | — |
| upo-flaschenkuerbis | Upo (Flaschenkürbis) | `assets/illustrations-v2/foods/upo-flaschenkuerbis.svg` | OK | — | — | — |
| sayote-chayote | Sayote (Chayote) | `assets/illustrations-v2/foods/sayote-chayote.svg` | OK | — | — | — |
| patola-ridge-gourd | Patola (Ridge Gourd) | `assets/illustrations-v2/foods/patola-ridge-gourd.svg` | OK | — | — | — |
| malunggay-moringablaetter | Malunggay (Moringablätter) | `assets/illustrations-v2/foods/malunggay-moringablaetter.svg` | OK | — | — | — |
| kangkong-wasserspinat | Kangkong (Wasserspinat) | `assets/illustrations-v2/foods/kangkong-wasserspinat.svg` | OK | — | — | — |
| kamote-blaetter | Kamote-Blätter | `assets/illustrations-v2/foods/kamote-blaetter.svg` | OK | — | — | — |
| sitaw-lange-bohnen | Sitaw (lange Bohnen) | `assets/illustrations-v2/foods/sitaw-lange-bohnen.svg` | OK | — | — | — |
| gabi-taro | Gabi | `assets/illustrations-v2/foods/gabi-taro.svg` | OK | — | — | — |
| cassava-kamoting-kahoy | Cassava | `assets/illustrations-v2/foods/cassava-kamoting-kahoy.svg` | OK | — | — | — |
| ube-violette-yamswurzel | Ube (violette Yamswurzel) | `assets/illustrations-v2/foods/ube-violette-yamswurzel.svg` | OK | — | — | — |
| bangus-milkfish | Bangus (Milkfish) | `assets/illustrations-v2/foods/bangus-milkfish.svg` | OK | — | — | — |
| tilapia | Tilapia | `assets/illustrations-v2/foods/tilapia.svg` | OK | — | — | — |
| galunggong-round-scad | Galunggong (Round Scad) | `assets/illustrations-v2/foods/galunggong-round-scad.svg` | KLARER FEHLER | P1 | Ganzer Fisch mit Kopf/Auge und Zitronendekoration statt einfacher gegarter Portion; wirkt nicht baby-/familienfreundlich. | Gegartes, gräten- und hautfreies Stück ohne Dekoration verwenden. |
| calamansi | Calamansi | `assets/illustrations-v2/foods/calamansi.svg` | OK | — | — | — |
| pomelo | Pomelo | `assets/illustrations-v2/foods/pomelo.svg` | OK | — | — | — |
| jackfruit-langka | Jackfruit | `assets/illustrations-v2/foods/jackfruit-langka.svg` | OK | — | — | — |
| rambutan | Rambutan | `assets/illustrations-v2/foods/rambutan.svg` | OK | — | — | — |
| lanzones | Lanzones | `assets/illustrations-v2/foods/lanzones.svg` | OK | — | — | — |
| chico-sapodilla | Chico (Sapodilla) | `assets/illustrations-v2/foods/chico-sapodilla.svg` | OK | — | — | — |
| guyabano-soursop | Guyabano (Soursop) | `assets/illustrations-v2/foods/guyabano-soursop.svg` | OK | — | — | — |
| caimito-sternapfel | Caimito (Sternapfel) | `assets/illustrations-v2/foods/caimito-sternapfel.svg` | OK | — | — | — |
| rimas-brotfrucht | Rimas (Brotfrucht) | `assets/illustrations-v2/foods/rimas-brotfrucht.svg` | OK | — | — | — |
| saluyot-juteblaetter | Saluyot (Juteblätter) | `assets/illustrations-v2/foods/saluyot-juteblaetter.svg` | OK | — | — | — |
| senf | Senf | `assets/illustrations-v2/foods/senf.svg` | OK | — | — | — |
| stangensellerie | Stangensellerie | `assets/illustrations-v2/foods/stangensellerie.svg` | OK | — | — | — |
| fenchel | Fenchel | `assets/illustrations-v2/foods/fenchel.svg` | OK | — | — | — |
| pastinake | Pastinake | `assets/illustrations-v2/foods/pastinake.svg` | OK | — | — | — |
| dattel | Dattel | `assets/illustrations-v2/foods/dattel.svg` | OK | — | — | — |
| kirsche | Kirsche | `assets/illustrations-v2/foods/kirsche.svg` | OK | — | — | — |
| rosine | Rosine | `assets/illustrations-v2/foods/rosine.svg` | OK | — | — | — |
| traube | Traube | `assets/illustrations-v2/foods/traube.svg` | OK | — | — | — |
| zitrone | Zitrone | `assets/illustrations-v2/foods/zitrone.svg` | OK | — | — | — |
| brot | Brot | `assets/illustrations-v2/foods/brot.svg` | OK | — | — | — |
| couscous | Couscous | `assets/illustrations-v2/foods/couscous.svg` | OK | — | — | — |
| haferdrink | Haferdrink | `assets/illustrations-v2/foods/haferdrink.svg` | OK | — | — | — |
| polenta | Polenta | `assets/illustrations-v2/foods/polenta.svg` | OK | — | — | — |
| butter | Butter | `assets/illustrations-v2/foods/butter.svg` | OK | — | — | — |
| frischkaese | Frischkäse | `assets/illustrations-v2/foods/frischkaese.svg` | OK | — | — | — |
| huettenkaese | huettenkaese | `assets/illustrations-v2/foods/huettenkaese.svg` | REVIEW | P2 | Technik: sichtbare Achse 93,75 %, Mittelpunkt Δx 0 px / Δy 0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| kaese | Käse | `assets/illustrations-v2/foods/kaese.svg` | OK | — | — | — |
| kefir | Kefir | `assets/illustrations-v2/foods/kefir.svg` | OK | — | — | — |
| mozzarella | Mozzarella | `assets/illustrations-v2/foods/mozzarella.svg` | OK | — | — | — |
| quark | Quark | `assets/illustrations-v2/foods/quark.svg` | REVIEW | P3 | Technik: sichtbare Achse 75,00 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| skyr | Skyr | `assets/illustrations-v2/foods/skyr.svg` | OK | — | — | — |
| chiasamen | Chiasamen | `assets/illustrations-v2/foods/chiasamen.svg` | OK | — | — | — |
| tahin | Tahin | `assets/illustrations-v2/foods/tahin.svg` | OK | — | — | — |
| kokosoel | Kokosöl | `assets/illustrations-v2/foods/kokosoel.svg` | OK | — | — | — |
| olivenoel | Olivenöl | `assets/illustrations-v2/foods/olivenoel.svg` | REVIEW | P3 | Technik: sichtbare Achse 75,00 %, Mittelpunkt Δx -0,5 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| sardine | Sardine | `assets/illustrations-v2/foods/sardine.svg` | OK | — | — | — |
| thunfisch | Thunfisch | `assets/illustrations-v2/foods/thunfisch.svg` | OK | — | — | — |
| sojabohne | Sojabohne | `assets/illustrations-v2/foods/sojabohne.svg` | OK | — | — | — |
| sojajoghurt | Sojajoghurt | `assets/illustrations-v2/foods/sojajoghurt.svg` | OK | — | — | — |
| kakao | Kakao | `assets/illustrations-v2/foods/kakao.svg` | OK | — | — | — |
| nektarine | Nektarine | `assets/illustrations-v2/foods/nektarine.svg` | REVIEW | P2 | Stilbruch: flächiges Piktogramm mit eingebrannter heller Kachel statt transparent-fotorealistischem FOOD-V2-Motiv. | Motiv im bestehenden FOOD-V2-Stil mit echter Transparenz neu erstellen. |
| brombeere | Brombeere | `assets/illustrations-v2/foods/brombeere.svg` | REVIEW | P2 | Stilbruch: flächiges Piktogramm mit eingebrannter heller Kachel statt transparent-fotorealistischem FOOD-V2-Motiv. | Motiv im bestehenden FOOD-V2-Stil mit echter Transparenz neu erstellen. |
| ribisel | Ribisel | `assets/illustrations-v2/foods/ribisel.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| feige | Feige | `assets/illustrations-v2/foods/feige.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| mangold | Mangold | `assets/illustrations-v2/foods/mangold.svg` | REVIEW | P2 | Stilbruch: schematisches Piktogramm mit eingebrannter heller Kachel statt transparent-fotorealistischem FOOD-V2-Motiv. | Motiv im bestehenden FOOD-V2-Stil mit echter Transparenz neu erstellen. |
| spargel | Spargel | `assets/illustrations-v2/foods/spargel.svg` | REVIEW | P2 | Technik: sichtbare Achse 95,31 %, Mittelpunkt Δx 0 px / Δy 0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| petersilienwurzel | Petersilienwurzel | `assets/illustrations-v2/foods/petersilienwurzel.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| weizengriess | Weizengrieß | `assets/illustrations-v2/foods/weizengriess.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| bulgur | Bulgur | `assets/illustrations-v2/foods/bulgur.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| kidneybohne | Kidneybohne | `assets/illustrations-v2/foods/kidneybohne.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| braune-gruene-linse | Braune Linse | `assets/illustrations-v2/foods/braune-gruene-linse.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| schnittlauch | Schnittlauch | `assets/illustrations-v2/foods/schnittlauch.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| pecannuss | Pecannuss | `assets/illustrations-v2/foods/pecannuss.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| paranuss | Paranuss | `assets/illustrations-v2/foods/paranuss.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| macadamia | Macadamia | `assets/illustrations-v2/foods/macadamia.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| lupine | Lupine | `assets/illustrations-v2/foods/lupine.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| miesmuschel | Miesmuschel | `assets/illustrations-v2/foods/miesmuschel.svg` | REVIEW | P2 | Technik: sichtbare Achse 89,06 %, Mittelpunkt Δx 2 px / Δy -3 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| mohn | Mohn | `assets/illustrations-v2/foods/mohn.svg` | REVIEW | P2 | Stilbruch: abstraktes Piktogramm auf heller Kachel; Mohn als Lebensmittel nicht eindeutig. | Mohnkörner eindeutig und im bestehenden FOOD-V2-Stil darstellen. |
| tempeh | Tempeh | `assets/illustrations-v2/foods/tempeh.svg` | REVIEW | P2 | Stilbruch: abstraktes Piktogramm auf heller Kachel; deutlich inkonsistent zum FOOD-V2-Bestand. | Tempeh eindeutig und im bestehenden FOOD-V2-Stil darstellen. |
| kaeferbohne | Käferbohne | `assets/illustrations-v2/foods/kaeferbohne.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| rhabarber | Rhabarber | `assets/illustrations-v2/foods/rhabarber.svg` | REVIEW | P2 | Technik: sichtbare Achse 98,44 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| chinakohl | Chinakohl | `assets/illustrations-v2/foods/chinakohl.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| rucola | Rucola | `assets/illustrations-v2/foods/rucola.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| radicchio | Radicchio | `assets/illustrations-v2/foods/radicchio.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| endivie | Endivie | `assets/illustrations-v2/foods/endivie.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| rettich | Rettich | `assets/illustrations-v2/foods/rettich.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| blattsalat | Blattsalat | `assets/illustrations-v2/foods/blattsalat.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| holunder | Holunderbeere | `assets/illustrations-v2/foods/holunder.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| preiselbeere | Preiselbeere | `assets/illustrations-v2/foods/preiselbeere.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| quitte | Quitte | `assets/illustrations-v2/foods/quitte.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| kren | Kren | `assets/illustrations-v2/foods/kren.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| walnussoel | Walnussöl | `assets/illustrations-v2/foods/walnussoel.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy -0,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| sojaoel | Sojaöl | `assets/illustrations-v2/foods/sojaoel.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| weizenkeimoel | Weizenkeimöl | `assets/illustrations-v2/foods/weizenkeimoel.svg` | REVIEW | P2 | Technik: sichtbare Achse 92,19 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| honig | honig | `assets/illustrations-v2/foods/honig.svg` | REVIEW | P2 | Technik: sichtbare Achse 84,38 %, Mittelpunkt Δx 7 px / Δy -3 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| schwertfisch | schwertfisch | `assets/illustrations-v2/foods/schwertfisch.svg` | REVIEW | P2 | Technik: sichtbare Achse 65,63 %, Mittelpunkt Δx 2 px / Δy 2 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| heilbutt | heilbutt | `assets/illustrations-v2/foods/heilbutt.svg` | REVIEW | P2 | Technik: sichtbare Achse 60,94 %, Mittelpunkt Δx 1 px / Δy 1 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| hecht | hecht | `assets/illustrations-v2/foods/hecht.svg` | REVIEW | P2 | Technik: sichtbare Achse 65,63 %, Mittelpunkt Δx -2 px / Δy 2,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| koenigsmakrele | koenigsmakrele | `assets/illustrations-v2/foods/koenigsmakrele.svg` | REVIEW | P2 | Technik: sichtbare Achse 67,97 %, Mittelpunkt Δx 1,5 px / Δy 1 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| buttermakrele | buttermakrele | `assets/illustrations-v2/foods/buttermakrele.svg` | REVIEW | P2 | Technik: sichtbare Achse 56,25 %, Mittelpunkt Δx -2 px / Δy 1,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| schlangenmakrele | schlangenmakrele | `assets/illustrations-v2/foods/schlangenmakrele.svg` | REVIEW | P3 | Technik: sichtbare Achse 75,00 %, Mittelpunkt Δx 0 px / Δy 3,5 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| saibling | saibling | `assets/illustrations-v2/foods/saibling.svg` | REVIEW | P3 | Technik: sichtbare Achse 85,94 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| hering | hering | `assets/illustrations-v2/foods/hering.svg` | REVIEW | P3 | Technik: sichtbare Achse 85,94 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| karpfen | karpfen | `assets/illustrations-v2/foods/karpfen.svg` | REVIEW | P3 | Technik: sichtbare Achse 85,94 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |
| atlantische-makrele | atlantische-makrele | `assets/illustrations-v2/foods/atlantische-makrele.svg` | REVIEW | P3 | Technik: sichtbare Achse 85,94 %, Mittelpunkt Δx 0 px / Δy 0 px. | Auf 78–82 % skalieren und auf maximal 2 px Achsabweichung zentrieren; nicht clippen. |

## Recipe-V2

| Rezept | Asset | Status | Prio | Befund | Empfehlung |
| --- | --- | --- | --- | --- | --- | --- |
| Obst-Hafer-Pancakes | `assets/illustrations-v2/recipes/obst-hafer-pancakes.svg` | OK | — | — | — |
| Birne-Hirse-Pancakes | `assets/illustrations-v2/recipes/birne-hirse-pancakes.svg` | OK | — | — | — |
| Gemüse-Hafer-Pancakes | `assets/illustrations-v2/recipes/gemuese-hafer-pancakes.svg` | OK | — | — | — |
| Zucchini-Hafer-Pancakes | `assets/illustrations-v2/recipes/zucchini-hafer-pancakes.svg` | OK | — | — | — |
| Ube-Bananen-Pancakes | `assets/illustrations-v2/recipes/ube-bananen-pancakes.svg` | OK | — | — | — |
| Rind-Hafer-Bällchen | `assets/illustrations-v2/recipes/rind-hafer-baellchen.svg` | OK | — | — | — |
| Geflügel-Gemüse-Hafer-Bällchen | `assets/illustrations-v2/recipes/gefluegel-gemuese-hafer-baellchen.svg` | OK | — | — | — |
| Lachs-Kartoffel-Bällchen | `assets/illustrations-v2/recipes/lachs-kartoffel-baellchen.svg` | OK | — | — | — |
| Rote-Linsen-Gemüsebällchen | `assets/illustrations-v2/recipes/rote-linsen-gemuesebaellchen.svg` | OK | — | — | — |
| Tofu-Brokkoli-Bällchen | `assets/illustrations-v2/recipes/tofu-brokkoli-baellchen.svg` | OK | — | — | — |
| Brokkoli-Kartoffel-Taler | `assets/illustrations-v2/recipes/brokkoli-kartoffel-taler.svg` | OK | — | — | — |
| Zucchini-Hafer-Puffer | `assets/illustrations-v2/recipes/zucchini-hafer-puffer.svg` | OK | — | — | — |
| Kichererbsen-Kürbis-Taler | `assets/illustrations-v2/recipes/kichererbsen-kuerbis-taler.svg` | OK | — | — | — |
| Rote-Linsen-Bratlinge | `assets/illustrations-v2/recipes/rote-linsen-bratlinge.svg` | OK | — | — | — |
| Polenta-Zucchini-Sticks | `assets/illustrations-v2/recipes/polenta-zucchini-sticks.svg` | OK | — | — | — |
| Süßkartoffel-Hirse-Sticks | `assets/illustrations-v2/recipes/suesskartoffel-hirse-sticks.svg` | OK | — | — | — |
| Omelettstreifen | `assets/illustrations-v2/recipes/omelettstreifen.svg` | OK | — | — | — |
| Zucchini-Omelett | `assets/illustrations-v2/recipes/zucchini-omelett.svg` | OK | — | — | — |
| Obst-Haferbrei | `assets/illustrations-v2/recipes/obst-haferbrei.svg` | OK | — | — | — |
| Obst-Hirsebrei | `assets/illustrations-v2/recipes/obst-hirsebrei.svg` | OK | — | — | — |
| Obst-Polentabrei | `assets/illustrations-v2/recipes/obst-polentabrei.svg` | OK | — | — | — |
| Obst-Reisbrei | `assets/illustrations-v2/recipes/obst-reisbrei.svg` | OK | — | — | — |
| Obst-Quinoabrei | `assets/illustrations-v2/recipes/obst-quinoabrei.svg` | OK | — | — | — |
| Obst-Buchweizenbrei | `assets/illustrations-v2/recipes/obst-buchweizenbrei.svg` | OK | — | — | — |
| Obst-Grießbrei | `assets/illustrations-v2/recipes/obst-griessbrei.svg` | OK | — | — | — |
| Milch-Getreide-Brei | `assets/illustrations-v2/recipes/milch-getreide-brei.svg` | OK | — | — | — |
| Baby-Bananenbrot | `assets/illustrations-v2/recipes/baby-bananenbrot.svg` | OK | — | — | — |
| Kürbis-Hafer-Brei | `assets/illustrations-v2/recipes/kuerbis-hafer-brei.svg` | OK | — | — | — |
| Gemüse-Nudel-Sauce | `assets/illustrations-v2/recipes/gemuese-nudel-sauce.svg` | OK | — | — | — |
| Baby-Linsen-Bolognese | `assets/illustrations-v2/recipes/baby-linsen-bolognese.svg` | OK | — | — | — |
| Lugaw-Basis | `assets/illustrations-v2/recipes/lugaw-basis.svg` | OK | — | — | — |
| Kürbis-Lugaw | `assets/illustrations-v2/recipes/kuerbis-lugaw.svg` | OK | — | — | — |
| Monggo-Kalabasa-Brei | `assets/illustrations-v2/recipes/monggo-kalabasa-brei.svg` | OK | — | — | — |
| Tinola-inspiriert | `assets/illustrations-v2/recipes/tinola-inspiriert.svg` | OK | — | — | — |
| Arroz-caldo-inspiriert | `assets/illustrations-v2/recipes/arroz-caldo-inspiriert.svg` | OK | — | — | — |
| Kalabasa mit Kokos | `assets/illustrations-v2/recipes/kalabasa-mit-kokos.svg` | OK | — | — | — |
| Tilapia-Reis-Brei | `assets/illustrations-v2/recipes/tilapia-reis-brei.svg` | REVIEW | P2 | Motiv ist in der kleinen App-Darstellung deutlich zu klein und kaum lesbar. | Schüsselmotiv unter Wahrung des transparenten Mindestrands optisch vergrößern. |
| Bangus-Kartoffel-Taler | `assets/illustrations-v2/recipes/bangus-kartoffel-taler.svg` | OK | — | — | — |
| Obst-Hafer-Muffins | `assets/illustrations-v2/recipes/obst-hafer-muffins.svg` | OK | — | — | — |
| Gemüse-Hafer-Muffins | `assets/illustrations-v2/recipes/gemuese-hafer-muffins.svg` | OK | — | — | — |
| Kürbis-Hirse-Muffins | `assets/illustrations-v2/recipes/kuerbis-hirse-muffins.svg` | OK | — | — | — |
| Karotten-Polenta-Brei | `assets/illustrations-v2/recipes/karotten-polenta-brei.svg` | OK | — | — | — |
| Süßkartoffel-Rote-Linsen-Brei | `assets/illustrations-v2/recipes/suesskartoffel-rote-linsen-brei.svg` | OK | — | — | — |
| Zucchini-Quinoa-Brei | `assets/illustrations-v2/recipes/zucchini-quinoa-brei.svg` | OK | — | — | — |
| Kichererbsenmehl-Zucchini-Taler | `assets/illustrations-v2/recipes/kichererbsenmehl-zucchini-taler.svg` | OK | — | — | — |
| Bananen-Haferbrei mit Erdnussmus | `assets/illustrations-v2/recipes/bananen-haferbrei-mit-erdnussmus.svg` | OK | — | — | — |
| Karotten-Hirse-Brei mit Tahin | `assets/illustrations-v2/recipes/karotten-hirse-brei-mit-tahin.svg` | OK | — | — | — |
| Apfel-Hirse-Brei mit Mandelmus | `assets/illustrations-v2/recipes/apfel-hirse-brei-mit-mandelmus.svg` | OK | — | — | — |
| Apfel-Birnen-Kompott | `assets/illustrations-v2/recipes/apfel-birnen-kompott.svg` | OK | — | — | — |
| Karotte-Süßkartoffel-Brei | `assets/illustrations-v2/recipes/karotte-suesskartoffel-brei.svg` | OK | — | — | — |
| Brokkoli-Kartoffel-Stampf | `assets/illustrations-v2/recipes/brokkoli-kartoffel-stampf.svg` | OK | — | — | — |
| Karfiol-Kartoffel-Stampf | `assets/illustrations-v2/recipes/karfiol-kartoffel-stampf.svg` | OK | — | — | — |
| Zucchini-Kartoffel-Brei | `assets/illustrations-v2/recipes/zucchini-kartoffel-brei.svg` | OK | — | — | — |
| Erbsen-Kartoffel-Stampf | `assets/illustrations-v2/recipes/erbsen-kartoffel-stampf.svg` | OK | — | — | — |
| Kürbis-Linsen-Suppe | `assets/illustrations-v2/recipes/kuerbis-linsen-suppe.svg` | OK | — | — | — |
| Mildes Rote-Linsen-Dhal | `assets/illustrations-v2/recipes/mildes-rote-linsen-dhal.svg` | OK | — | — | — |
| Huhn-Karotte-Nudel-Topf | `assets/illustrations-v2/recipes/huhn-karotte-nudel-topf.svg` | OK | — | — | — |
| Huhn-Lauch-Kartoffel-Topf | `assets/illustrations-v2/recipes/huhn-lauch-kartoffel-topf.svg` | OK | — | — | — |
| Huhn-Brokkoli-Reis | `assets/illustrations-v2/recipes/huhn-brokkoli-reis.svg` | OK | — | — | — |
| Rind-Gemüse-Bolognese | `assets/illustrations-v2/recipes/rind-gemuese-bolognese.svg` | OK | — | — | — |
| Tomaten-Linsen-Sauce | `assets/illustrations-v2/recipes/tomaten-linsen-sauce.svg` | OK | — | — | — |
| Brokkoli-Linsen-Pasta | `assets/illustrations-v2/recipes/brokkoli-linsen-pasta.svg` | OK | — | — | — |
| Gemüse-Pasta mit Zucchini und Tomate | `assets/illustrations-v2/recipes/gemuese-pasta-mit-zucchini-und-tomate.svg` | OK | — | — | — |
| Lachs-Reis-Erbsen | `assets/illustrations-v2/recipes/lachs-reis-erbsen.svg` | OK | — | — | — |
| Lachs-Süßkartoffel-Stampf | `assets/illustrations-v2/recipes/lachs-suesskartoffel-stampf.svg` | OK | — | — | — |
| Kabeljau-Tomaten-Gemüse | `assets/illustrations-v2/recipes/kabeljau-tomaten-gemuese.svg` | OK | — | — | — |
| Weiches Rührei | `assets/illustrations-v2/recipes/weiches-ruehrei.svg` | OK | — | — | — |
| Eier-Finger | `assets/illustrations-v2/recipes/eier-finger.svg` | OK | — | — | — |
| Paprika-Omelettstreifen | `assets/illustrations-v2/recipes/paprika-omelettstreifen.svg` | OK | — | — | — |
| Ei-Champignon-Cups | `assets/illustrations-v2/recipes/ei-champignon-cups.svg` | OK | — | — | — |
| Hummus mit weichen Gemüsesticks | `assets/illustrations-v2/recipes/hummus-mit-weichen-gemuesesticks.svg` | OK | — | — | — |
| Kürbis-Kichererbsen-Creme | `assets/illustrations-v2/recipes/kuerbis-kichererbsen-creme.svg` | OK | — | — | — |
| Avocado-Bananen-Creme | `assets/illustrations-v2/recipes/avocado-bananen-creme.svg` | OK | — | — | — |
| Buchweizen-Bananen-Pancakes | `assets/illustrations-v2/recipes/buchweizen-bananen-pancakes.svg` | OK | — | — | — |
| Süßkartoffel-Linsen-Taler | `assets/illustrations-v2/recipes/suesskartoffel-linsen-taler.svg` | OK | — | — | — |
| Tofu-Zucchini-Reis | `assets/illustrations-v2/recipes/tofu-zucchini-reis.svg` | REVIEW | P2 | Kleine, kontrastarme Schüssel; Gericht und Hauptzutaten sind in App-Größe kaum unterscheidbar. | Gericht optisch vergrößern und Tofu/Zucchini klarer lesbar machen. |
| Gebackene Saba-Banane | `assets/illustrations-v2/recipes/gebackene-saba-banane.svg` | OK | — | — | — |
| Huhn-Lugaw | `assets/illustrations-v2/recipes/huhn-lugaw.svg` | OK | — | — | — |
| Sayote-Huhn-Reis | `assets/illustrations-v2/recipes/sayote-huhn-reis.svg` | REVIEW | P2 | Kleine, kontrastarme Schüssel; Gericht und Hauptzutaten sind in App-Größe kaum unterscheidbar. | Gericht optisch vergrößern und Sayote/Huhn klarer lesbar machen. |
| Monggo-Süßkartoffel-Brei | `assets/illustrations-v2/recipes/monggo-suesskartoffel-brei.svg` | OK | — | — | — |
| Ube-Hafer-Brei | `assets/illustrations-v2/recipes/ube-hafer-brei.svg` | OK | — | — | — |
| Obst-Joghurt | `assets/illustrations-v2/recipes/obst-joghurt.svg` | OK | — | — | — |
| Obst-Hafer-Joghurt | `assets/illustrations-v2/recipes/obst-hafer-joghurt.svg` | OK | — | — | — |
| Obst-Hirse-Joghurt | `assets/illustrations-v2/recipes/obst-hirse-joghurt.svg` | OK | — | — | — |
| Obst-Grieß-Joghurt | `assets/illustrations-v2/recipes/obst-griess-joghurt.svg` | OK | — | — | — |
| Buttermilch-Hafer-Obstbrei | `assets/illustrations-v2/recipes/buttermilch-hafer-obstbrei.svg` | OK | — | — | — |
| Buttermilch-Hirse-Obstbrei | `assets/illustrations-v2/recipes/buttermilch-hirse-obstbrei.svg` | OK | — | — | — |
| Buttermilch-Grieß-Obstbrei | `assets/illustrations-v2/recipes/buttermilch-griess-obstbrei.svg` | OK | — | — | — |
| Joghurt-Nussmus-Miniportion | `assets/illustrations-v2/recipes/joghurt-nussmus-miniportion.svg` | OK | — | — | — |
| Bananen-Joghurt-Hafer-Pancakes | `assets/illustrations-v2/recipes/bananen-joghurt-hafer-pancakes.svg` | OK | — | — | — |
| Obst-Joghurt-Hafer-Ofenbites | `assets/illustrations-v2/recipes/obst-joghurt-hafer-ofenbites.svg` | OK | — | — | — |
| Zucchini-Joghurt-Hafer-Bites | `assets/illustrations-v2/recipes/zucchini-joghurt-hafer-bites.svg` | OK | — | — | — |
| Joghurt-Hafer-Waffeln | `assets/illustrations-v2/recipes/joghurt-hafer-waffeln.svg` | OK | — | — | — |
| Weiche Joghurt-Fladen | `assets/illustrations-v2/recipes/weiche-joghurt-fladen.svg` | REVIEW | P2 | Sehr kleines Tellermotiv; die Fladen sind in App-Größe kaum lesbar. | Motiv unter Wahrung des transparenten Mindestrands deutlich vergrößern. |
| Gemüse-Joghurt-Mini-Muffins | `assets/illustrations-v2/recipes/gemuese-joghurt-mini-muffins.svg` | OK | — | — | — |
| Huhn-Gemüse-Muffins | `assets/illustrations-v2/recipes/huhn-gemuese-muffins.svg` | OK | — | — | — |
| Süßkartoffel-Linsen-Muffins | `assets/illustrations-v2/recipes/suesskartoffel-linsen-muffins.svg` | OK | — | — | — |
| Fleisch-Gemüse-Bällchen | `assets/illustrations-v2/recipes/fleisch-gemuese-baellchen.svg` | OK | — | — | — |
| Gemüse-Fleisch-Nockerl | `assets/illustrations-v2/recipes/gemuese-fleisch-nockerl.svg` | OK | — | — | — |
| Bohnen-Kartoffel-Stampf | `assets/illustrations-v2/recipes/bohnen-kartoffel-stampf.svg` | OK | — | — | — |

## Findings

### P1

- **Lamm:** dominanter Knochen widerspricht der baby-/familienfreundlichen, knochenfreien Fleischdarstellung.
- **Galunggong (Round Scad):** ganzer Fisch mit Kopf/Auge und Zitronendekoration statt einfacher gegarter Portion.

### P2

- **FOOD-Stil/Erkennbarkeit:** Nektarine, Brombeere, Mangold, Mohn und Tempeh fallen als flächige/abstrakte Piktogramme mit heller Kachel objektiv aus dem transparent-fotorealistischen V2-Bestand.
- **FOOD-Geometrie:** Die in der Tabelle als P2 markierten Assets verfehlen den 78–82-%-Korridor bzw. die Zentrierung deutlich; besonders große Motive erreichen bis 98,44 %, besonders kleine nur 56,25 %.
- **Recipe-Lesbarkeit:** Tilapia-Reis-Brei, Tofu-Zucchini-Reis, Sayote-Huhn-Reis und Weiche Joghurt-Fladen sind bei 27 px deutlich zu klein bzw. zu kontrastarm.

### P3

- **FOOD-Geometrie:** Die in der Tabelle als P3 markierten Assets liegen nur moderat außerhalb des verbindlichen Größen-/Zentrierkorridors; Transparenz und Canvasformat bleiben intakt.

## Duplikat-Kandidaten

| Paar | Einordnung | Befund |
| --- | --- | --- |
| Schwertfisch / Heilbutt | problematisches Fast-Duplikat | Sehr ähnliche helle Fischquerschnitte mit nahezu gleicher Innenzeichnung; in kleiner Darstellung nicht belastbar unterscheidbar. |
| Tofu-Zucchini-Reis / Sayote-Huhn-Reis | problematisches Fast-Duplikat | Kleine violette Schüsseln mit nahezu identischem hellem Reisbild; die namensgebenden Zutaten sind in App-Größe nicht unterscheidbar. |

Keine technisch identischen aktiven Assets wurden gefunden. Weitere algorithmische Kandidaten waren nach Sichtprüfung lediglich plausibel ähnliche Motive derselben Lebensmittel- oder Rezeptfamilie.

## Zusammenfassung

- **FOOD:** 154 OK / 54 REVIEW / 2 KLARER FEHLER
- **Recipe:** 96 OK / 4 REVIEW / 0 KLARER FEHLER
- **Prioritäten:** 2 P1 / 47 P2 / 11 P3
